import { z } from 'zod';

export const paymentRemindersSchema = z.object({
  query: z.object({
    dias: z.coerce.number().int().min(0).max(14).default(3),
  }),
});
