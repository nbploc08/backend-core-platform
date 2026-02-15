import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { Response } from 'express';

import { InternalJwtService } from 'src/modules/internal-jwt/internal-jwt.service';
import { handleAxiosError, ServiceError } from '@common/core';
import { IdempotencyService } from 'src/modules/share/idempotency.service';

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
    private idempotency: IdempotencyService,
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

  private getHeaders(requestId: string, token?: string) {
    const headers: Record<string, string> = {
      'x-request-id': requestId,
    };
    if (token) {
      headers['Authorization'] = token;
    } else {
      const internalToken = this.internalJwt.signInternalToken({});
      headers['Authorization'] = `Bearer ${internalToken}`;
    }
    return headers;
  }

  async getProfileByUserId(
    userId: string,
    requestId: string,
    token?: string,
  ): Promise<ProfileResponse> {
    try {
      const response = await this.client.get<ProfileResponse>('auth/internal/me', {
        headers: this.getHeaders(requestId, token),
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
    try {
      const response = await this.client.post<LoginResponse>('auth/internal/login', loginDto, {
        headers: this.getHeaders(requestId),
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

  async register(
    registerDto: Record<string, unknown>,
    requestId: string,
    requestPath: string,
    idempotencyKey?: string,
  ): Promise<any> {
    let recordId = '';
    try {
      // Check idempotency
      const {
        recordId: rId,
        shouldExecute,
        cachedResponse,
      } = await this.idempotency.checkIdempotency({
        method: 'POST',
        path: requestPath || '/client/auth/register',
        body: registerDto,
        key: idempotencyKey || '',
      });
      recordId = rId;

      // Return cached response if exists
      if (!shouldExecute && cachedResponse !== undefined) {
        return cachedResponse;
      }

      // Execute request
      const response = await this.client.post('auth/internal/register', registerDto, {
        headers: this.getHeaders(requestId),
      });

      if (response.status >= 400) {
        // Mark failed
        if (recordId) {
          await this.idempotency.markFailed(recordId, response.status, response.data);
        }
        handleAxiosError(
          { response: { status: response.status, data: response.data } },
          'Auth service request failed',
        );
      }

      // Mark completed
      if (recordId) {
        await this.idempotency.markCompleted(recordId, response.status, response.data);
        this.idempotency.cacheResponse(idempotencyKey || '', response.data);
      }

      return response.data;
    } catch (err: unknown) {
      // Mark as failed if record exists
      if (recordId) {
        await this.idempotency.markFailed(recordId, 500, {
          error: 'Internal server error',
          details: err instanceof Error ? err.message : String(err),
        });
      }
      handleAxiosError(err, 'Register request failed');
    }
  }

  async verify(verifyDto: { email: string; code: string }, requestId: string): Promise<any> {
    try {
      const response = await this.client.post('auth/internal/register/verify', verifyDto, {
        headers: this.getHeaders(requestId),
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
          headers: this.getHeaders(requestId),
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
            ...this.getHeaders(requestId),
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
    token?: string,
  ): Promise<string> {
    try {
      const response = await this.client.post<string>(
        'auth/internal/logout-device',
        {},
        {
          headers: {
            ...this.getHeaders(requestId, token),
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

  async logoutAll(
    userId: string,
    requestId: string,
    clientRes?: Response,
    token?: string,
  ): Promise<string> {
    try {
      const response = await this.client.post<string>(
        'auth/internal/logout-all',
        {},
        {
          headers: this.getHeaders(requestId, token),
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
          headers: this.getHeaders(requestId),
        },
      );
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
  async forgotPasswordVerify(
    forgotPasswordVerifyDto: { email: string; code: string },
    requestId: string,
  ): Promise<any> {
    try {
      const response = await this.client.post<any>(
        'auth/internal/forgot/password/verify',
        forgotPasswordVerifyDto,
        {
          headers: this.getHeaders(requestId),
        },
      );
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
  async forgotPasswordReset(
    forgotPasswordResetDto: { email: string; code: string; password: string },
    requestId: string,
  ): Promise<any> {
    try {
      const response = await this.client.post<any>(
        'auth/internal/forgot/password/reset',
        forgotPasswordResetDto,
      );
      return response.data;
    } catch (err: unknown) {
      handleAxiosError(err, 'Auth service request failed');
    }
  }
}
