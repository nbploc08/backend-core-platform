import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ConfigService } from '@nestjs/config';
import { InternalJwtService } from 'src/modules/internal-jwt/internal-jwt.service';
import axios, { AxiosInstance } from 'axios';
import { handleAxiosError } from '@common/core';
export type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
};

@Injectable()
export class NotificationService {
  private readonly client: AxiosInstance;
  private readonly baseURL: string;
  constructor(
    private config: ConfigService,
    private internalJwt: InternalJwtService,
  ) {
    this.baseURL = this.config.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3002';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
      maxRedirects: 0,
      validateStatus: () => true,
    });
  }

  private internalHeaders(requestId: string, payload?: object) {
    const token = this.internalJwt.signInternalToken(payload ?? {});
    return {
      Authorization: `Bearer ${token}`,
      'x-request-id': requestId,
    };
  }

  async getProfileByUserId(userId: string, requestId: string): Promise<ProfileResponse> {
    try {
      const response = await this.client.get<ProfileResponse>('auth/internal/me', {
        headers: this.internalHeaders(requestId, { id: userId }),
      });
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
  async ping(): Promise<any> {
    try {
      const response = await this.client.get<any>('health', {
        headers: this.internalHeaders('health-check'), // ← THÊM headers
      });
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      return response;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
}
