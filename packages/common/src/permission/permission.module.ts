import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PermissionCache } from './permission.cache';
import { PermissionProvider } from './permission.provider';
import { PermissionGuard } from './permission.guard';
import { TokenTypeGuard } from './token-type.guard';
import axios from 'axios';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    Reflector,
    PermissionCache,
    PermissionProvider,
    PermissionGuard,
    TokenTypeGuard,
    {
      provide: 'HTTP_CLIENT',
      useValue: axios.create({
        timeout: 10_000,
        validateStatus: () => true,
      }),
    },
  ],
  exports: [Reflector, PermissionCache, PermissionProvider, PermissionGuard, TokenTypeGuard],
})
export class PermissionModule {}
