export enum PermissionCode {
  // User management
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Order management
  ORDER_READ = 'order:read',
  ORDER_CREATE = 'order:create',
  ORDER_REFUND = 'order:refund',

  // Product management
  PRODUCT_READ = 'product:read',
  PRODUCT_CREATE = 'product:create',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',

  // Notifications
  NOTIFICATIONS_READ = 'notifications:read',

  // Admin
  ADMIN_MANAGE_USERS = 'admin:manage-users',
  ADMIN_MANAGE_ROLES = 'admin:manage-roles',
}
