import { apiClient } from '@/lib/api-client';

export const employeesService = {
  me: () =>
    apiClient.get('/employees/me').then(r => r.data),

  list: (params?: { search?: string; departmentId?: string; role?: string }) =>
    apiClient.get('/employees', { params }).then(r => r.data),

  byId: (id: string) =>
    apiClient.get(`/employees/${id}`).then(r => r.data),

  departments: () =>
    apiClient.get('/employees/departments').then(r => r.data),

  colleagues: () =>
    apiClient.get('/employees/colleagues').then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/employees', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/employees/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/employees/${id}`).then(r => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.patch('/auth/change-password', data).then(r => r.data),
};
