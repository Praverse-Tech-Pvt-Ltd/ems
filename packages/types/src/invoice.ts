import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  type: z.enum(['VENDOR', 'CLIENT']),
  partyName: z.string().min(1).max(200),
  amount: z.number().positive(),
  gstPercent: z.number().min(0).max(100).optional(),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
