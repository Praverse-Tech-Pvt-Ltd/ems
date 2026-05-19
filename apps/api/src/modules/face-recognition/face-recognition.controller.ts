import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { FaceRecognitionService } from './face-recognition.service';
import { RegisterFaceDto } from './dto/register-face.dto';
import { RecognizeFaceDto, VerifyFaceDto } from './dto/recognize-face.dto';
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

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a face for an employee (base64)' })
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  async register(@Body() dto: RegisterFaceDto) {
    return this.faceService.registerFace(dto.employeeId, dto.imageBase64);
  }

  @Post('register/upload')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a face via file upload' })
  @UseInterceptors(FileInterceptor('file'))
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  async registerUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('employeeId') employeeId: string,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    if (!employeeId) throw new BadRequestException('employeeId is required');
    const imageBase64 = file.buffer.toString('base64');
    return this.faceService.registerFace(employeeId, imageBase64);
  }

  @Post('recognize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Identify an employee from a face image (1:N)' })
  async recognize(@Body() dto: RecognizeFaceDto) {
    return this.faceService.recognize(dto.imageBase64);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '1:1 verify a face against a specific employee' })
  async verify(@Body() dto: VerifyFaceDto) {
    return this.faceService.verify(dto.employeeId, dto.imageBase64);
  }

  @Delete('employee/:employeeId')
  @ApiOperation({ summary: 'Delete stored face data for an employee' })
  @Roles('ADMIN', 'SUPER_ADMIN')
  async deleteFace(@Param('employeeId') employeeId: string) {
    await this.faceService.deleteFace(employeeId);
    return { success: true, message: `Face data removed for ${employeeId}` };
  }
}
