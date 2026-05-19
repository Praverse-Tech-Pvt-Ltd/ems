import { Module } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { FaceRecognitionController } from './face-recognition.controller';
import { AttendanceFaceController } from './attendance-face.controller';
import { AttendanceFaceService } from './attendance-face.service';

@Module({
  controllers: [FaceRecognitionController, AttendanceFaceController],
  providers: [FaceRecognitionService, AttendanceFaceService],
  exports: [FaceRecognitionService],
})
export class FaceRecognitionModule {}
