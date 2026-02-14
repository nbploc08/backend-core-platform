import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ConfigService } from '@nestjs/config';
import { InternalJwtService } from 'src/modules/internal-jwt/internal-jwt.service';
import axios, { AxiosInstance } from 'axios';
import { handleAxiosError } from '@common/core';

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

  private getHeaders(requestId: string, userToken?: string, internalData?: object) {
    const headers: Record<string, string> = {
      'x-request-id': requestId,
    };
    if (userToken) {
      headers['Authorization'] = userToken;
    } else {
      const token = this.internalJwt.signInternalToken(internalData ?? {});
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async ping(): Promise<any> {
    try {
      const response = await this.client.get<any>('health', {
        headers: this.getHeaders('health-check'),
      });
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Notification service request failed',
        );
      }
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }

  async create(createNotificationDto: CreateNotificationDto, authToken: string, requestId: string) {
    try {
      const response = await this.client.post('notification', createNotificationDto, {
        headers: this.getHeaders(requestId, authToken),
      });
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }

  async findAll(authToken: string, requestId: string, page?: string, limit?: string) {
    try {
      const response = await this.client.get('notification/list', {
        headers: this.getHeaders(requestId, authToken),
        params: { page, limit },
      });
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }

  async unreadCount(authToken: string, requestId: string) {
    try {
      const response = await this.client.get('notification/unread-count', {
        headers: this.getHeaders(requestId, authToken),
      });
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }

  async markRead(id: string, authToken: string, requestId: string) {
    try {
      const response = await this.client.post(`notification/${id}/read`, null, {
        headers: this.getHeaders(requestId, authToken),
      });
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }

  async readAll(authToken: string, requestId: string) {
    try {
      const response = await this.client.post('notification/read-all', null, {
        headers: this.getHeaders(requestId, authToken),
      });
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Notification service request failed');
    }
  }
}
