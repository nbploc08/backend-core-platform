import { z } from 'zod';

export const WS_NOTIFICATION_READ_ALL = 'notification:read-all' as const;

export const NotificationReadAllRequestSchema = z.object({});

export type NotificationReadAllRequest = z.infer<typeof NotificationReadAllRequestSchema>;
