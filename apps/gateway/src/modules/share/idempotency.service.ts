import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCodes, ServiceError } from '@common/core';

export interface IdempotencyRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
  key: string;
}

export interface IdempotencyResponse {
  success: boolean;
  cached: boolean;
  data?: any;
  error?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly idempotencyCache: Map<string, { response: any; expiresAt: number }> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Compute SHA256 hash from method, path, and body
   */
  private computeRequestHash(method: string, path: string, body: Record<string, unknown>): string {
    const canonical = {
      method,
      path,
      body: JSON.stringify(body),
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Get response from in-memory cache if exists and not expired
   */
  private getFromCache(key: string): any | null {
    const cached = this.idempotencyCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.idempotencyCache.delete(key);
      return null;
    }

    return cached.response;
  }

  /**
   * Save response to in-memory cache with TTL (default 5 minutes)
   */
  private setCache(key: string, response: any, ttlMs: number = 5 * 60 * 1000): void {
    this.idempotencyCache.set(key, {
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Check or create idempotency record
   * Returns: { recordId, shouldExecute, response? }
   */
  async checkIdempotency(req: IdempotencyRequest): Promise<{
    recordId: string;
    shouldExecute: boolean;
    cachedResponse?: any;
  }> {
    if (!req.key) {
      // No idempotency key, always execute
      return { recordId: '', shouldExecute: true };
    }

    // 1. Check in-memory cache first
    const cachedResponse = this.getFromCache(req.key);
    if (cachedResponse !== null) {
      return { recordId: '', shouldExecute: false, cachedResponse };
    }

    // 2. Check database
    const requestHash = this.computeRequestHash(req.method, req.path, req.body);
    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: { key: req.key },
    });

    if (existingRecord) {
      // Verify hash matches (same key but different request)
      if (existingRecord.requestHash !== requestHash) {
        throw new ServiceError({
          code: ErrorCodes.CONFLICT,
          statusCode: 409,
          message: 'Idempotency key conflict: different request with same key',
          exposeMessage: true,
        });
      }

      // Request already completed, return cached response
      if (existingRecord.status === 'completed') {
        this.setCache(req.key, existingRecord.responseBody);
        return {
          recordId: existingRecord.id,
          shouldExecute: false,
          cachedResponse: existingRecord.responseBody,
        };
      }

      // Request still processing
      if (existingRecord.status === 'processing') {
        throw new ServiceError({
          code: ErrorCodes.CONFLICT,
          statusCode: 409,
          message: 'Request is still processing',
          exposeMessage: true,
        });
      }

      // Status is 'failed', retry allowed - update to processing
      const updated = await this.prisma.idempotencyRecord.update({
        where: { id: existingRecord.id },
        data: {
          status: 'processing',
          responseStatus: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { recordId: updated.id, shouldExecute: true };
    }

    // No record exists, create new 'processing' record
    const newRecord = await this.prisma.idempotencyRecord.create({
      data: {
        key: req.key,
        requestHash,
        status: 'processing',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { recordId: newRecord.id, shouldExecute: true };
  }

  /**
   * Mark record as completed and save response
   */
  async markCompleted(recordId: string, responseStatus: number, responseBody: any): Promise<void> {
    if (!recordId) return;

    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        responseStatus,
        responseBody,
      },
    });
  }

  /**
   * Mark record as failed and save error response
   */
  async markFailed(recordId: string, responseStatus: number = 500, errorData?: any): Promise<void> {
    if (!recordId) return;

    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'failed',
        responseStatus,
        responseBody: errorData || { error: 'Internal server error' },
      },
    });
  }

  /**
   * Cache successful response
   */
  cacheResponse(key: string, response: any): void {
    if (!key) return;
    this.setCache(key, response);
  }
}
