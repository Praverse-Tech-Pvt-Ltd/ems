import {
  Controller,
  Post,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ChangePasswordDto } from './dto/password.dto';

/** Cookie configuration shared by login and refresh.
 *  In production the frontend and API are on different domains (Vercel vs Render),
 *  so we need sameSite:'none' + secure:true to allow cross-site cookie sending.
 *  In development, 'lax' works fine for same-origin localhost traffic.
 */
const isProd = process.env['NODE_ENV'] === 'production';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login: returns accessToken in the response body (short-lived, 15 min)
   * and sets the refreshToken as an httpOnly cookie so it is never
   * accessible to JavaScript running on the page.
   *
   * Rate-limited to 5 attempts per minute to mitigate brute-force.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken, user: result.user };
  }

  /**
   * Refresh: reads the httpOnly refresh-token cookie, rotates it, and
   * returns a new short-lived accessToken in the response body.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string> | undefined)?.['refresh_token'];
    if (!token) throw new UnauthorizedException('No refresh token');
    const result = await this.authService.refresh(token);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string> | undefined)?.['refresh_token'];
    if (token) await this.authService.logout(token);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  /**
   * Admin-only password reset.
   * Requires an active admin session — this endpoint MUST NOT be publicly
   * accessible without authentication, as it allows setting any employee's
   * password without the current password.
   * For self-service password changes, authenticated users should use PATCH /change-password.
   */
  @Post('forgot-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin: reset an employee password by email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.newPassword);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated employee' })
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
