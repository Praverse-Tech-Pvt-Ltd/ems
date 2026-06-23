import { Controller, Get, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private storage: StorageService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async getFile(
    @Query('key') key: string,
    @CurrentUser() user: { id: string; role: string },
    @Res() res: any,
  ) {
    if (key.startsWith('employee-documents/')) {
      const isPrivileged = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      if (!isPrivileged) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: user.id },
          select: { employeeCode: true },
        });
        if (!employee) {
          throw new ForbiddenException('Access denied');
        }
        const prefix = `employee-documents/${employee.employeeCode}/`;
        if (!key.startsWith(prefix)) {
          throw new ForbiddenException('Access denied');
        }
      }
    }

    return res.sendFile(this.storage.getLocalPath(key));
  }
}

