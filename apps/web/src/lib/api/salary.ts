import { apiClient } from '@/lib/api-client';

export const salaryService = {
  mySlips: () =>
    apiClient.get('/salary/slips/my').then(r => r.data),

  allSlips: (params?: { month?: number; year?: number }) =>
    apiClient.get('/salary/slips', { params }).then(r => r.data),

  structures: () =>
    apiClient.get('/salary/structures').then(r => r.data),

  slipPdfUrl: (id: string) =>
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/salary/slips/${id}/pdf`,

  approve: (id: string) =>
    apiClient.patch(`/salary/slips/${id}/approve`).then(r => r.data),

  transfer: (id: string, data: { transferRef: string; transferredAt: string }) =>
    apiClient.patch(`/salary/slips/${id}/transfer`, data).then(r => r.data),

  reject: (id: string, reason: string) =>
    apiClient.patch(`/salary/slips/${id}/reject`, { reason }).then(r => r.data),

  generate: (data: { employeeIds: string[]; month: number; year: number }) =>
    apiClient.post('/salary/slips/generate', data).then(r => r.data),

  upsertStructure: (employeeId: string, data: Record<string, unknown>) =>
    apiClient.post(`/salary/structures/${employeeId}`, data).then(r => r.data),
};
