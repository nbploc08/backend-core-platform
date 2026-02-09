import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { Response } from 'express';
import { InternalJwtService } from '../../internal-jwt/internal-jwt.service';
import { handleAxiosError } from '@common/core';

export type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
};

export type LoginResponse = {
  id: string;
  email: string;
  access_token: string;
};

function forwardSetCookie(authResponse: AxiosResponse, clientRes: Response): void {
  const setCookie = authResponse.headers['set-cookie'];
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  list.forEach((c) => clientRes.append('Set-Cookie', c));
}

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

  async login(
    loginDto: { email?: string; password?: string; username?: string; [k: string]: unknown },
    requestId: string,
    clientRes?: Response,
  ): Promise<LoginResponse> {
    const token = this.internalJwt.signInternalToken(loginDto);
    try {
      const response = await this.client.post<LoginResponse>('auth/internal/login', loginDto, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
        maxRedirects: 0,
      });
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      if (clientRes) forwardSetCookie(response, clientRes);
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }

  async register(registerDto: Record<string, unknown>, requestId: string): Promise<any> {
    const token = this.internalJwt.signInternalToken(registerDto);
    try {
      const response = await this.client.post('auth/internal/register', registerDto, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
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

  async verify(verifyDto: { email: string; code: string }, requestId: string): Promise<any> {
    const token = this.internalJwt.signInternalToken(verifyDto);
    try {
      const response = await this.client.post('auth/internal/register/verify', verifyDto, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
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

  async confirm(confirmDto: { email: string; code: string }, requestId: string): Promise<any> {
    return this.verify(confirmDto, requestId);
  }

  async resendCode(email: string, requestId: string): Promise<{ message: string }> {
    try {
      const response = await this.client.post<{ message: string }>(
        'auth/internal/resend-code',
        { email },
        {
          headers: this.internalHeaders(requestId),
        },
      );
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

  async refresh(
    refreshToken: string,
    deviceId: string,
    requestId: string,
    clientRes?: Response,
  ): Promise<LoginResponse> {
    try {
      const response = await this.client.post<LoginResponse>(
        'auth/internal/refresh',
        {},
        {
          headers: {
            ...this.internalHeaders(requestId),
            Cookie: `refreshToken=${refreshToken}; deviceId=${deviceId}`,
          },
        },
      );
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      if (clientRes) forwardSetCookie(response, clientRes);
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }

  async logoutDevice(
    deviceId: string,
    refreshToken: string,
    userId: string,
    requestId: string,
    clientRes?: Response,
  ): Promise<string> {
    try {
      const response = await this.client.post<string>(
        'auth/internal/logout-device',
        {},
        {
          headers: {
            ...this.internalHeaders(requestId, { id: userId }),
            Cookie: `refreshToken=${refreshToken}; deviceId=${deviceId}`,
          },
        },
      );
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      if (clientRes) {
        clientRes.clearCookie('refreshToken');
        clientRes.clearCookie('deviceId');
      }
      return response.data ?? 'logout success';
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }

  async logoutAll(userId: string, requestId: string, clientRes?: Response): Promise<string> {
    try {
      const response = await this.client.post<string>(
        'auth/internal/logout-all',
        {},
        {
          headers: this.internalHeaders(requestId, { id: userId }),
        },
      );
      if (response.status >= 400) {
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }
      if (clientRes) {
        clientRes.clearCookie('refreshToken');
        clientRes.clearCookie('deviceId');
      }
      return response.data ?? 'logout success';
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
  async forgotPassword(forgotPasswordDto: { email: string }, requestId: string): Promise<any> {
    try {
      const response = await this.client.post<any>(
        'auth/internal/forgot/password',
        forgotPasswordDto,
        {
          headers: this.internalHeaders(requestId),
        },
      );
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
}
