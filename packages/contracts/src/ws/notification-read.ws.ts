import { z } from 'zod';

export const WS_NOTIFICATION_READ = 'notification:read' as const;

export const NotificationReadRequestSchema = z.object({
  notificationId: z.string().uuid(),
});

export type NotificationReadRequest = z.infer<typeof NotificationReadRequestSchema>;
