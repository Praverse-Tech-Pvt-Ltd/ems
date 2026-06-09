import { apiClient } from '@/lib/api-client';

export const invoicesService = {
  list: (params?: { status?: string }) =>
    apiClient.get('/invoices', { params }).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/invoices', data).then(r => r.data),

  updateStatus: (id: string, status: 'APPROVED' | 'REJECTED' | 'PAID', paymentRef?: string) =>
    apiClient.patch(`/invoices/${id}/status`, { status, paymentRef }).then(r => r.data),
};
