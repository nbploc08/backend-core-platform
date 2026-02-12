import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../permission/permission.enum';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

export const RequirePermission = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
