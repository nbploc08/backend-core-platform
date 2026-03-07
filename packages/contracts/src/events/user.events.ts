import { z } from 'zod';

export const USER_REGISTERED = 'user.registered' as const;

export const UserRegisteredSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  code: z.string(),
  createdAt: z.string().datetime(), // hoặc z.coerce.date()
  requestId: z.string().optional(), // Thêm trường requestId nếu cần thiết
});

export type UserRegisteredEvent = z.infer<typeof UserRegisteredSchema>;
