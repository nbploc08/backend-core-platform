import { z } from 'zod';

export const WS_UNREAD_COUNT_UPDATED = 'unreadCount:updated' as const;

export const UnreadCountUpdatedPayloadSchema = z.object({
  count: z.number().int().min(0),
});

export type UnreadCountUpdatedPayload = z.infer<typeof UnreadCountUpdatedPayloadSchema>;
