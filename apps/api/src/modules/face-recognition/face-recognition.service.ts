import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface RegisterFaceResult {
  success: boolean;
  employeeId: string;
  message: string;
}

export interface RecognizeResult {
  success: boolean;
  employeeId?: string;
  confidence?: number;
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
  private readonly faceServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.faceServiceUrl =
      this.config.get<string>('FACE_SERVICE_URL') ?? 'http://localhost:8000';
  }

  async registerFace(employeeId: string, imageBase64: string): Promise<RegisterFaceResult> {
    try {
      const { data } = await axios.post<RegisterFaceResult>(
        `${this.faceServiceUrl}/register`,
        { employee_id: employeeId, image_base64: imageBase64 },
        { timeout: 15000 },
      );
      return data;
    } catch (err) {
      this.handleError(err, 'registerFace');
    }
  }

  async recognize(imageBase64: string): Promise<RecognizeResult> {
    try {
      const { data } = await axios.post<RecognizeResult>(
        `${this.faceServiceUrl}/recognize`,
        { image_base64: imageBase64 },
        { timeout: 15000 },
      );
      return data;
    } catch (err) {
      this.handleError(err, 'recognize');
    }
  }

  async verify(employeeId: string, imageBase64: string): Promise<VerifyResult> {
    try {
      const { data } = await axios.post<VerifyResult>(
        `${this.faceServiceUrl}/verify`,
        { employee_id: employeeId, image_base64: imageBase64 },
        { timeout: 15000 },
      );
      return data;
    } catch (err) {
      this.handleError(err, 'verify');
    }
  }

  async deleteFace(employeeId: string): Promise<void> {
    try {
      await axios.delete(`${this.faceServiceUrl}/employee/${employeeId}`, { timeout: 10000 });
    } catch (err) {
      this.handleError(err, 'deleteFace');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.faceServiceUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private handleError(err: unknown, context: string): never {
    this.logger.error(`Face service error in ${context}:`, err);
    if (err instanceof AxiosError) {
      const status = err.response?.status ?? 502;
      const message = err.response?.data?.detail ?? 'Face recognition service error';
      throw new HttpException(message, status);
    }
    throw new HttpException('Face recognition service unavailable', HttpStatus.BAD_GATEWAY);
  }
}
