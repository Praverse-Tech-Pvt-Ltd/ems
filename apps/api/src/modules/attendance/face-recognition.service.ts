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

  private get frUrl(): string {
    return this.config.get<string>('FACE_SERVICE_URL') ?? 'http://localhost:8000';
  }

  async ping(): Promise<void> {
    await axios.get(`${this.frUrl}/health`, { timeout: 5000 });
  }

  async verify(employeeId: string, faceImageBase64: string): Promise<FrVerifyResult> {
    try {
      const { data } = await axios.post<{ success: boolean; match: boolean; confidence?: number; message: string }>(
        `${this.frUrl}/verify`,
        { employee_id: employeeId, image_base64: faceImageBase64 },
        { timeout: 45000 },
      );
      return {
        verified: data.match,
        confidence: data.confidence ?? 0,
        reason: data.message,
      };
    } catch (error) {
      this.logger.error('Face recognition service unavailable', error);
      throw new ServiceUnavailableException(
        'Face recognition service is unavailable. Please contact admin.',
      );
    }
  }

  async enroll(employeeId: string, frames: string[]): Promise<void> {
    let lastError: unknown;
    for (const frame of frames) {
      try {
        await axios.post(
          `${this.frUrl}/register`,
          { employee_id: employeeId, image_base64: frame },
          { timeout: 20000 },
        );
        return; // first successful frame wins
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status < 500) {
          // 4xx = no face detected in this frame — try next
          lastError = error;
          continue;
        }
        // 5xx / network = service down
        this.logger.error('Face enrollment failed', error);
        throw new ServiceUnavailableException('Face enrollment service unavailable');
      }
    }
    // All frames failed with 4xx (no face detected in any frame)
    const msg =
      (lastError as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
      'No face detected in any captured frame. Ensure good lighting and face the camera directly.';
    throw new Error(msg);
  }

  async deleteFace(employeeId: string): Promise<void> {
    try {
      await axios.delete(`${this.frUrl}/register/employee/${employeeId}`, { timeout: 10000 });
    } catch (error) {
      this.logger.warn(`Could not delete face embedding for ${employeeId}: ${(error as Error).message}`);
    }
  }
}
