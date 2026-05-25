import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FaceRecognitionService } from './face-recognition.service';
import { RegisterFaceDto } from './dto/register-face.dto';
import { VerifyFaceDto } from './dto/recognize-face.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Face Recognition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('face')
export class FaceRecognitionController {
  constructor(private readonly faceService: FaceRecognitionService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check face recognition service health' })
  async health() {
    const ok = await this.faceService.healthCheck();
    return { status: ok ? 'ok' : 'unavailable' };
  }

  /**
   * Enrol one or more face frames for an employee.
   * Accepts an array of base64-encoded images for a more robust average embedding.
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enrol face frames for an employee' })
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  async register(@Body() dto: RegisterFaceDto) {
    const frames = Array.isArray(dto.imageBase64) ? dto.imageBase64 : [dto.imageBase64];
    return this.faceService.registerFace(dto.employeeId, frames);
  }

  /** 1:1 verify a face against a specific employee's stored embedding. */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '1:1 verify a face against a specific employee' })
  async verify(@Body() dto: VerifyFaceDto) {
    return this.faceService.verify(dto.employeeId, dto.imageBase64);
  }
}
