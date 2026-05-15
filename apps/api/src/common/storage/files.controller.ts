import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private storage: StorageService) {}

  @Get()
  getFile(@Query('key') key: string, @Res() res: any) {
    return res.sendFile(this.storage.getLocalPath(key));
  }
}
