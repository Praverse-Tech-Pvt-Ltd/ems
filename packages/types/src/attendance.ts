import { z } from 'zod';

export const PunchInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceInfo: z
    .object({
      userAgent: z.string(),
      deviceId: z.string().optional(),
    })
    .optional(),
});

export type PunchInDto = z.infer<typeof PunchInSchema>;

export const PunchOutSchema = PunchInSchema;
export type PunchOutDto = z.infer<typeof PunchOutSchema>;

export const RegularizeAttendanceSchema = z.object({
  punchInTime: z.string().datetime().optional(),
  punchOutTime: z.string().datetime().optional(),
  status: z
    .enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WFH', 'OD', 'LEAVE', 'HOLIDAY'])
    .optional(),
  reason: z.string().min(1),
});

export type RegularizeAttendanceDto = z.infer<typeof RegularizeAttendanceSchema>;

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  punchInTime: string | null;
  punchOutTime: string | null;
  status: string;
  workingHours: number | null;
  isGeoValidIn: boolean | null;
  isRegularized: boolean;
}
