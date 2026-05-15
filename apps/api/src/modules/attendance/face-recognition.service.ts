import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface FrVerifyResult {
  verified: boolean;
  confidence: number;
  reason?: string;
}

@Injectable()
export class FaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);

  constructor(private config: ConfigService) {}

  async verify(employeeId: string, faceImageBase64: string): Promise<FrVerifyResult> {
    const frUrl = this.config.get<string>('FR_SERVICE_URL');
    try {
      const response = await axios.post<FrVerifyResult>(
        `${frUrl}/verify`,
        { employee_id: employeeId, face_image: faceImageBase64 },
        { timeout: 10000 },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Face recognition service unavailable', error);
      throw new ServiceUnavailableException(
        'Face recognition service is unavailable. Please contact admin.',
      );
    }
  }

  async enroll(employeeId: string, frames: string[]): Promise<void> {
    const frUrl = this.config.get<string>('FR_SERVICE_URL');
    try {
      await axios.post(
        `${frUrl}/enroll`,
        { employee_id: employeeId, frames },
        { timeout: 30000 },
      );
    } catch (error) {
      this.logger.error('Face enrollment failed', error);
      throw new ServiceUnavailableException('Face enrollment service unavailable');
    }
  }
}
