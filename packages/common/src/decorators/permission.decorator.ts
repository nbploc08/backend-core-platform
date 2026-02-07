import { SetMetadata } from '@nestjs/common';

export enum Permission {
  // User
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_CREATE = 'user:create',
  // User role
  // Event
  EVENT_CREATE = 'event:create',
  EVENT_READ = 'event:read',
  EVENT_UPDATE = 'event:update',
  EVENT_PUBLISH = 'event:publish',
  EVENT_DELETE = 'event:delete',

  // Ticket
  TICKET_CREATE = 'ticket:create',
  TICKET_UPDATE = 'ticket:update',
  //
  TICKET_TYPE_CREATE = 'ticket-type:create',
  TICKET_TYPE_UPDATE = 'ticket-type:update',
  TICKET_TYPE_DELETE = 'ticket-type:delete',

  // Seat
  SEAT_CREATE = 'seat:create',
  SEAT_UPDATE = 'seat:update',
  SEAT_DELETE = 'seat:delete',

  // Order
  ORDER_READ = 'order:read',
  ORDER_REFUND = 'order:refund',

  // Check-in
  CHECKIN_SCAN = 'checkin:scan',

  // Admin
  USER_BAN = 'user:ban',
}
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: Object.values(Permission),
  ORGANIZER: [
    Permission.EVENT_CREATE,
    Permission.EVENT_READ,
    Permission.EVENT_UPDATE,
    Permission.EVENT_PUBLISH,
    Permission.TICKET_CREATE,
    Permission.TICKET_UPDATE,
    Permission.ORDER_READ,
    Permission.CHECKIN_SCAN,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.TICKET_TYPE_CREATE,
    Permission.TICKET_TYPE_UPDATE,
    Permission.TICKET_TYPE_DELETE,
    Permission.SEAT_CREATE,
  ],
  USER: [Permission.USER_READ, Permission.USER_UPDATE],
};
