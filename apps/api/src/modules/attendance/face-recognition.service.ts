import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FrVerifyResult {
  verified: boolean;
  confidence: number;
  reason?: string;
}

@Injectable()
export class FaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService) {
    const baseURL =
      this.config.get<string>('FACE_SERVICE_URL') ?? 'http://localhost:8000';
    const apiKey = this.config.getOrThrow<string>('FACE_SERVICE_API_KEY');

    // Pre-configure a shared axios instance with the internal auth header so
    // every call to the face service is authenticated automatically.
    this.client = axios.create({
      baseURL,
      headers: { 'X-Internal-Token': apiKey },
    });
  }

  async ping(): Promise<void> {
    await this.client.get('/health', { timeout: 5000 });
  }

  async verify(employeeId: string, faceImageBase64: string): Promise<FrVerifyResult> {
    try {
      const { data } = await this.client.post<{
        verified?: boolean;
        match?: boolean;
        success?: boolean;
        confidence: number;
        reason?: string;
        message?: string;
      }>(
        '/verify',
        { employee_id: employeeId, face_image: faceImageBase64 },
        { timeout: 45000 },
      );
      const verified = data.verified ?? data.match ?? data.success ?? false;
      return {
        verified,
        confidence: data.confidence ?? 0,
        reason: data.reason ?? data.message,
      };
    } catch (error) {
      this.logger.error('Face recognition service unavailable', error);
      throw new ServiceUnavailableException(
        'Face recognition service is unavailable. Please contact admin.',
      );
    }
  }

  async enroll(employeeId: string, frames: string[]): Promise<void> {
    try {
      await this.client.post(
        '/enroll',
        { employee_id: employeeId, frames },
        { timeout: 60000 },
      );
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && status < 500) {
        const msg =
          (error as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ??
          'No face detected in any captured frame. Ensure good lighting and face the camera directly.';
        throw new Error(msg);
      }
      this.logger.error('Face enrollment failed', error);
      throw new ServiceUnavailableException('Face enrollment service unavailable');
    }
  }

  async deleteFace(employeeId: string): Promise<void> {
    try {
      await this.client.delete(`/enroll/employee/${employeeId}`, { timeout: 10000 });
    } catch (error) {
      this.logger.warn(
        `Could not delete face embedding for ${employeeId}: ${(error as Error).message}`,
      );
    }
  }
}
