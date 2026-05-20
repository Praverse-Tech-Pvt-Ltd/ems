import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const employee = await this.prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee || employee.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(employee.id, employee.email, employee.role);

    return {
      ...tokens,
      user: {
        id: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
      },
    };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { employee: { select: { id: true, email: true, role: true, status: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.employee.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    return this.generateTokens(
      stored.employee.id,
      stored.employee.email,
      stored.employee.role,
    );
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }

  async forgotPassword(email: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const employee = await this.prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, status: true },
    });
    if (!employee || employee.status !== 'ACTIVE') {
      throw new NotFoundException('No active account found with that email');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash: hash },
    });
    return { message: 'Password reset successfully. You can now log in.' };
  }

  async changePassword(employeeId: string, currentPassword: string, newPassword: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { passwordHash: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const valid = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: hash },
    });
    return { message: 'Password changed successfully' };
  }

  private async generateTokens(id: string, email: string, role: string) {
    const payload = { sub: id, email, role };
    const accessToken = this.jwt.sign(payload);

    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
      jwtid: randomUUID(),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, employeeId: id, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
