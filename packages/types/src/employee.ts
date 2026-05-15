import { z } from 'zod';

export const RoleEnum = z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']);
export type Role = z.infer<typeof RoleEnum>;

export const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  designation: z.string().optional(),
  role: RoleEnum.default('EMPLOYEE'),
  managerId: z.string().uuid().optional(),
  joiningDate: z.string().datetime(),
  salaryGrade: z.string().optional(),
});

export type CreateEmployeeDto = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().omit({
  email: true,
});

export type UpdateEmployeeDto = z.infer<typeof UpdateEmployeeSchema>;

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  designation: string | null;
  role: Role;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  joiningDate: string;
  profilePhotoUrl: string | null;
  faceEnrolled: boolean;
  status: string;
  createdAt: string;
}
