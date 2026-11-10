import { z } from 'zod';

export const SupportedDocTypeSchema = z.enum(['PDF', 'DOCX', 'TXT', 'MARKDOWN']);
export type SupportedDocType = z.infer<typeof SupportedDocTypeSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  fileType: SupportedDocTypeSchema,
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().default(1),
  rawText: z.string(),
  summary: z.string().default(''),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentSnippetCitationSchema = z.object({
  documentId: z.string().uuid(),
  documentName: z.string(),
  pageOrSection: z.string(),
  retrievalConfidence: z.number().min(0).max(1),
  snippet: z.string(),
});
export type DocumentSnippetCitation = z.infer<typeof DocumentSnippetCitationSchema>;

export const DocumentSearchResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(DocumentSnippetCitationSchema),
  uncertaintyNotes: z.string().optional(),
});
export type DocumentSearchResponse = z.infer<typeof DocumentSearchResponseSchema>;
