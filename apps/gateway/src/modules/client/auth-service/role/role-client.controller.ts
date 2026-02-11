import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../share/strategy/jwt-auth.guard';
import { RoleClientService } from './role-client.service';

function getRequestId(req: Request & { requestId?: string }): string {
  const rid = req.requestId ?? req.headers['x-request-id'];
  return Array.isArray(rid) ? (rid[0] ?? '') : (rid ?? '');
}

@Controller('client/roles')
@UseGuards(JwtAuthGuard)
export class RoleClientController {
  constructor(private readonly roleClient: RoleClientService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createRoleDto: { name: string; description?: string; permissionIds?: string[] },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.create(createRoleDto, getRequestId(req));
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: Request & { requestId?: string }) {
    return this.roleClient.findAll(getRequestId(req));
  }

  @Get('users/:userId/roles')
  @HttpCode(HttpStatus.OK)
  async getRolesForUser(
    @Param('userId') userId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.getRolesForUser(userId, getRequestId(req));
  }

  @Get('users/:userId/permissions')
  @HttpCode(HttpStatus.OK)
  async getPermissionsForUser(
    @Param('userId') userId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.getPermissionsForUser(userId, getRequestId(req));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Req() req: Request & { requestId?: string }) {
    return this.roleClient.findOne(id, getRequestId(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: { name?: string; description?: string; permissionIds?: string[] },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.update(id, updateRoleDto, getRequestId(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request & { requestId?: string }) {
    return this.roleClient.remove(id, getRequestId(req));
  }

  @Post('assign-role')
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @Body() dto: { userId: string; roleName: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.assignRole(dto, getRequestId(req));
  }

  @Post('unassign-role')
  @HttpCode(HttpStatus.OK)
  async unassignRole(
    @Body() dto: { userId: string; roleName: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.unassignRole(dto, getRequestId(req));
  }
}
