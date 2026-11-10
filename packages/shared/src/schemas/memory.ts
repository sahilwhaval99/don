import { z } from 'zod';

export const MemoryCategorySchema = z.enum([
  'PREFERENCE',
  'ROUTINE',
  'PROJECT',
  'EXPLICIT_NOTE',
  'CONTACT_DETAIL',
]);
export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const MemorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  category: MemoryCategorySchema,
  key: z.string().min(1),
  content: z.string().min(1),
  reasonForStorage: z.string().default('Explicit user instruction'),
  isEncrypted: z.boolean().default(true),
  confidenceScore: z.number().min(0).max(1).default(1.0),
  lastAccessedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Memory = z.infer<typeof MemorySchema>;

export const CreateMemoryRequestSchema = z.object({
  category: MemoryCategorySchema,
  key: z.string().min(1),
  content: z.string().min(1),
  reasonForStorage: z.string().default('Explicit user instruction'),
  userConsentGiven: z.literal(true, {
    errorMap: () => ({ message: 'Explicit consent is required to store personal memory.' }),
  }),
});
export type CreateMemoryRequest = z.infer<typeof CreateMemoryRequestSchema>;

export const MemoryCitationSchema = z.object({
  memoryId: z.string().uuid(),
  key: z.string(),
  reasonUsed: z.string(),
});
export type MemoryCitation = z.infer<typeof MemoryCitationSchema>;
