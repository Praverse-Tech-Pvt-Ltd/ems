import { apiClient } from '@/lib/api-client';

export const requestsService = {
  create: (requestType: string, details: Record<string, unknown>) =>
    apiClient.post('/requests', { requestType, details }).then(r => r.data),

  my: () =>
    apiClient.get('/requests/my').then(r => r.data),

  all: (params?: { status?: string }) =>
    apiClient.get('/requests', { params }).then(r => r.data),

  approve: (id: string, status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW', comment?: string) =>
    apiClient.patch(`/requests/${id}/approve`, { status, comment }).then(r => r.data),
};
