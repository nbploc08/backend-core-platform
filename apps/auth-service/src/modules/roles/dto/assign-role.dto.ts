import { IsString, IsUUID, IsIn } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsIn(['user', 'admin'])
  roleName!: 'user' | 'admin';
}
