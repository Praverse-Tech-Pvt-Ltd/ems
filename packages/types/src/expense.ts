import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  category: z.enum(['TRAVEL', 'FOOD', 'OFFICE', 'CLIENT_VISIT', 'HOTEL', 'STATIONERY', 'MISC']),
  amount: z.number().positive(),
  expenseDate: z.string().datetime(),
  description: z.string().optional(),
  paymentMode: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']).optional(),
});

export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;

export const ApproveExpenseSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type ApproveExpenseDto = z.infer<typeof ApproveExpenseSchema>;

export const MarkExpensePaidSchema = z.object({
  paymentRef: z.string().min(1),
});

export type MarkExpensePaidDto = z.infer<typeof MarkExpensePaidSchema>;
