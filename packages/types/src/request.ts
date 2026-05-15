import { z } from 'zod';

export const CreateRequestSchema = z.object({
  requestType: z.enum([
    'WFH',
    'ADVANCE_PAYMENT',
    'DOCUMENT_REQUEST',
    'ASSET_REQUEST',
    'TRAVEL_APPROVAL',
    'ATTENDANCE_CORRECTION',
    'OTHER',
  ]),
  details: z.record(z.unknown()),
});

export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
