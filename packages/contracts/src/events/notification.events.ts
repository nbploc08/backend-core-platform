import { z } from 'zod';

export const NOTIFICATION_CREATED = 'notification.created' as const;

export const NotificationCreatedSchema = z.object({
  notificationId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string().optional(),
  data: z.any().optional(),
  actionCreatedAt: z.string().datetime(),
});

export type NotificationCreatedEvent = z.infer<typeof NotificationCreatedSchema>;
