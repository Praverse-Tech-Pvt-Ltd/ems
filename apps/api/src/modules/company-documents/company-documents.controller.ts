import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyDocumentsService } from './company-documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('company-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-documents')
export class CompanyDocumentsController {
  constructor(private readonly service: CompanyDocumentsService) {}

  @Get('expiring')
  @Roles('ADMIN', 'SUPER_ADMIN')
  findExpiring(@Query('days') days?: string) {
    return this.service.findExpiring(days ? parseInt(days) : 30);
  }

  @Get(':companyId')
  findAll(@Param('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Post(':companyId')
  create(
    @Param('companyId') companyId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(companyId, dto, userId);
  }

  @Post(':companyId/:docId/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('companyId') companyId: string,
    @Param('docId') docId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadFile(companyId, docId, file);
  }

  @Get(':companyId/:docId/download')
  async download(@Param('docId') docId: string, @Res() res: Response) {
    const url = await this.service.getDownloadUrl(docId);
    res.redirect(url);
  }

  @Patch(':companyId/:docId')
  update(@Param('docId') docId: string, @Body() dto: any) {
    return this.service.update(docId, dto);
  }

  @Delete(':companyId/:docId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('docId') docId: string) {
    return this.service.remove(docId);
  }
}
