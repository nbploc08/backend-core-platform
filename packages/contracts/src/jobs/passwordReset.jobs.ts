import { z } from 'zod';

export const PASSWORD_RESET_REQUESTED = 'passwordReset.requested' as const;

export const PasswordResetRequestedSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export type PasswordResetRequestedEvent = z.infer<typeof PasswordResetRequestedSchema>;
