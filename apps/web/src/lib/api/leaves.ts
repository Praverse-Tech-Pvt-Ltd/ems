import { apiClient } from '@/lib/api-client';

export const leavesService = {
  apply: (data: { leaveType: string; fromDate: string; toDate: string; reason: string }) =>
    apiClient.post('/leaves', data).then(r => r.data),

  my: () =>
    apiClient.get('/leaves/my').then(r => r.data),

  balance: (year?: number) =>
    apiClient.get('/leaves/balance', { params: year ? { year } : {} }).then(r => r.data),

  forEmployee: (id: string) =>
    apiClient.get(`/leaves/employee/${id}`).then(r => r.data),

  all: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get('/leaves', { params }).then(r => r.data),

  approve: (id: string, action: 'APPROVE' | 'REJECT', comment?: string) =>
    apiClient.patch(`/leaves/${id}/approve`, { action, comment }).then(r => r.data),
};
