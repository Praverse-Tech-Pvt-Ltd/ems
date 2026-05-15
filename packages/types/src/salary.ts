import { z } from 'zod';

export const UploadSalarySlipSchema = z.object({
  employeeId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  grossSalary: z.number().positive(),
  deductions: z.number().min(0),
  netPayable: z.number().positive(),
  lopDays: z.number().int().min(0).default(0),
  daysPresent: z.number().int().min(0),
});

export type UploadSalarySlipDto = z.infer<typeof UploadSalarySlipSchema>;
