import { z } from 'zod';

export const WS_NOTIFICATION_NEW = 'notification:new' as const;

export const NotificationNewPayloadSchema = z.object({
  notificationId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string().optional(),
  createdAt: z.string().datetime(),
  unreadCount: z.number().int().min(0),
});

export type NotificationNewPayload = z.infer<typeof NotificationNewPayloadSchema>;
