import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { InternalJwtService } from '../../internal-jwt/internal-jwt.service';
import { handleAxiosError } from '@common/core';

export type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
};

@Injectable()
export class AuthClientService {
  private readonly client: AxiosInstance;
  private readonly baseURL: string;

  constructor(
    private config: ConfigService,
    private internalJwt: InternalJwtService,
  ) {
    this.baseURL = this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getProfileByUserId(userId: string, requestId: string): Promise<ProfileResponse> {
    const token = this.internalJwt.signInternalToken(userId);
    try {
      const { data } = await this.client.get<ProfileResponse>('auth/internal/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
      });
      return data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }

  async login(loginDto: any, requestId: string): Promise<any> {
    const token = this.internalJwt.signInternalToken(loginDto);
    try {
      const { data } = await this.client.post<any>('auth/login', loginDto, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
      });
      return data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
}
