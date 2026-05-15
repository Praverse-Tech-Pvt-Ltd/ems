import { z } from 'zod';

export const CreateLeaveSchema = z.object({
  leaveType: z.enum(['CL', 'SL', 'PL', 'UL', 'CO']),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  reason: z.string().min(1),
});

export type CreateLeaveDto = z.infer<typeof CreateLeaveSchema>;

export const ApproveLeaveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional(),
});

export type ApproveLeaveDto = z.infer<typeof ApproveLeaveSchema>;
