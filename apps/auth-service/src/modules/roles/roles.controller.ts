import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { PermissionCode, RequirePermission } from '@common/core';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermission(PermissionCode.ADMIN_MANAGE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('users/:userId/roles')
  getRolesForUser(@Param('userId') userId: string) {
    return this.rolesService.getRolesForUser(userId);
  }

  @Get('users/:userId/permissions')
  getPermissionsForUser(@Param('userId') userId: string) {
    return this.rolesService.getPermissionCodesForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post('assign-role')
  @HttpCode(HttpStatus.OK)
  assignRole(@Body() dto: AssignRoleDto) {
    return this.rolesService.assignRole(dto.userId, dto.roleName);
  }

  @Post('unassign-role')
  @HttpCode(HttpStatus.OK)
  unassignRole(@Body() dto: AssignRoleDto) {
    return this.rolesService.unassignRole(dto.userId, dto.roleName);
  }
}
