import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

export interface RegisterFaceResult {
  success: boolean;
  employeeId: string;
  message: string;
}

export interface VerifyResult {
  success: boolean;
  match: boolean;
  confidence?: number;
  message: string;
}

@Injectable()
export class FaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL =
      this.config.get<string>('FACE_SERVICE_URL') ?? 'http://localhost:8000';
    const apiKey = this.config.getOrThrow<string>('FACE_SERVICE_API_KEY');

    // Shared instance — every request carries the internal auth header.
    this.client = axios.create({
      baseURL,
      headers: { 'X-Internal-Token': apiKey },
    });
  }

  async registerFace(employeeId: string, frames: string[]): Promise<RegisterFaceResult> {
    try {
      const { data } = await this.client.post<{ success: boolean; message: string }>(
        '/enroll',
        { employee_id: employeeId, frames },
        { timeout: 60000 },
      );
      return { success: data.success, employeeId, message: data.message };
    } catch (err) {
      this.handleError(err, 'registerFace');
    }
  }

  async verify(employeeId: string, imageBase64: string): Promise<VerifyResult> {
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
        { employee_id: employeeId, face_image: imageBase64 },
        { timeout: 45000 },
      );
      const verified = data.verified ?? data.match ?? data.success ?? false;
      return {
        success: verified,
        match: verified,
        confidence: data.confidence,
        message: data.reason ?? data.message ?? 'OK',
      };
    } catch (err) {
      this.handleError(err, 'verify');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private handleError(err: unknown, context: string): never {
    this.logger.error(`Face service error in ${context}:`, err);
    if (err instanceof AxiosError) {
      const status = err.response?.status ?? 502;
      const message =
        err.response?.data?.detail ?? 'Face recognition service error';
      throw new HttpException(message, status);
    }
    throw new HttpException(
      'Face recognition service unavailable',
      HttpStatus.BAD_GATEWAY,
    );
  }
}
