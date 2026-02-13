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
import { JwtAuthGuard } from 'src/modules/internal-jwt/strategy/jwt-auth.guard';
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
    return this.roleClient.create(createRoleDto, getRequestId(req), req.headers.authorization);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: Request & { requestId?: string }) {
    return this.roleClient.findAll(getRequestId(req), req.headers.authorization);
  }

  @Get('users/:userId/roles')
  @HttpCode(HttpStatus.OK)
  async getRolesForUser(
    @Param('userId') userId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.getRolesForUser(userId, getRequestId(req), req.headers.authorization);
  }

  @Get('users/:userId/permissions')
  @HttpCode(HttpStatus.OK)
  async getPermissionsForUser(
    @Param('userId') userId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.getPermissionsForUser(
      userId,
      getRequestId(req),
      req.headers.authorization,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Req() req: Request & { requestId?: string }) {
    return this.roleClient.findOne(id, getRequestId(req), req.headers.authorization);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: { name?: string; description?: string; permissionIds?: string[] },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.update(id, updateRoleDto, getRequestId(req), req.headers.authorization);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request & { requestId?: string }) {
    return this.roleClient.remove(id, getRequestId(req), req.headers.authorization);
  }

  @Post('assign-role')
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @Body() dto: { userId: string; roleName: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.assignRole(dto, getRequestId(req), req.headers.authorization);
  }

  @Post('unassign-role')
  @HttpCode(HttpStatus.OK)
  async unassignRole(
    @Body() dto: { userId: string; roleName: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.roleClient.unassignRole(dto, getRequestId(req), req.headers.authorization);
  }
}
