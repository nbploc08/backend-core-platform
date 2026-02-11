import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Role with name '${dto.name}' already exists`);
    }
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? undefined,
      },
    });
    if (dto.permissionIds?.length) {
      for (const permissionId of dto.permissionIds) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }
    return this.findOne(role.id);
  }

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, code: true, description: true } } },
        },
      },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, code: true, description: true } } },
        },
      },
    });
    if (!role) throw new NotFoundException(`Role with id '${id}' not found`);
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    if (dto.name != null) {
      const existing = await this.prisma.role.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Role with name '${dto.name}' already exists`);
      }
    }
    await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      for (const permissionId of dto.permissionIds) {
        await this.prisma.rolePermission.create({
          data: { roleId: id, permissionId },
        });
      }
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.role.delete({ where: { id } });
    return { deleted: true, id };
  }

  async assignRole(userId: string, roleName: string): Promise<{ userId: string; roleName: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role '${roleName}' not found`);

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    return { userId, roleName };
  }

  async unassignRole(userId: string, roleName: string): Promise<{ userId: string; roleName: string }> {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role '${roleName}' not found`);
    await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
    return { userId, roleName };
  }

  async getPermissionCodesForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });
    const codes = new Set<string>();
    for (const r of rows) {
      for (const rp of r.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }
    return Array.from(codes);
  }

  async getRolesForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }
}
