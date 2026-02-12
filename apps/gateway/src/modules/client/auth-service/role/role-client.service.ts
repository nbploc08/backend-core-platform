import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { InternalJwtService } from '../../../share/internal-jwt/internal-jwt.service';
import { handleAxiosError } from '@common/core';

@Injectable()
export class RoleClientService {
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

  async create(
    createRoleDto: { name: string; description?: string; permissionIds?: string[] },
    requestId: string,
    user: any,
  ): Promise<any> {
    try {
      const response = await this.client.post('roles', createRoleDto, {
        headers: this.internalHeaders(requestId, {
          id: user.userId,
          permVersion: user.permVersion,
        }),
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

  async findAll(requestId: string): Promise<any> {
    try {
      const response = await this.client.get('roles', {
        headers: this.internalHeaders(requestId),
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

  async findOne(id: string, requestId: string): Promise<any> {
    try {
      const response = await this.client.get(`roles/${id}`, {
        headers: this.internalHeaders(requestId),
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

  async update(
    id: string,
    updateRoleDto: { name?: string; description?: string; permissionIds?: string[] },
    requestId: string,
  ): Promise<any> {
    try {
      const response = await this.client.patch(`roles/${id}`, updateRoleDto, {
        headers: this.internalHeaders(requestId),
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

  async remove(id: string, requestId: string): Promise<any> {
    try {
      const response = await this.client.delete(`roles/${id}`, {
        headers: this.internalHeaders(requestId),
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

  async getRolesForUser(userId: string, requestId: string): Promise<any> {
    try {
      const response = await this.client.get(`roles/users/${userId}/roles`, {
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

  async getPermissionsForUser(userId: string, requestId: string): Promise<any> {
    try {
      const response = await this.client.get(`roles/users/${userId}/permissions`, {
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

  async assignRole(dto: { userId: string; roleName: string }, requestId: string): Promise<any> {
    try {
      const response = await this.client.post('roles/assign-role', dto, {
        headers: this.internalHeaders(requestId),
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

  async unassignRole(dto: { userId: string; roleName: string }, requestId: string): Promise<any> {
    try {
      const response = await this.client.post('roles/unassign-role', dto, {
        headers: this.internalHeaders(requestId),
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
}
