import { z } from 'zod';

export const WS_NOTIFICATION_UPDATED = 'notification:updated' as const;

export const NotificationUpdatedPayloadSchema = z.object({
  action: z.enum(['read', 'read-all']),
  notificationId: z.string().uuid().optional(),
  unreadCount: z.number().int().min(0),
});

export type NotificationUpdatedPayload = z.infer<typeof NotificationUpdatedPayloadSchema>;
