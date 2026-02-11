import { IsString, IsUUID, IsNotEmpty, MaxLength } from 'class-validator';
export class AssignRoleDto {
  @IsUUID()
  userId!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleName!: string;
}
