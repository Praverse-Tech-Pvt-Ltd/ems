import { apiClient } from '@/lib/api-client';

export const expensesService = {
  submit: (data: {
    category: string;
    amount: number;
    expenseDate: string;
    description?: string;
    paymentMode?: string;
  }) => apiClient.post('/expenses', data).then(r => r.data),

  my: () =>
    apiClient.get('/expenses/my').then(r => r.data),

  all: (params?: { status?: string; employeeId?: string }) =>
    apiClient.get('/expenses', { params }).then(r => r.data),

  byId: (id: string) =>
    apiClient.get(`/expenses/${id}`).then(r => r.data),

  approveL1: (id: string, action: 'APPROVE' | 'REJECT', comment?: string) =>
    apiClient.patch(`/expenses/${id}/approve-l1`, { action, comment }).then(r => r.data),

  approveFinance: (id: string, action: 'APPROVE' | 'REJECT', comment?: string) =>
    apiClient.patch(`/expenses/${id}/approve-finance`, { action, comment }).then(r => r.data),

  markPaid: (id: string, data: { paymentRef: string; paidAt: string }) =>
    apiClient.patch(`/expenses/${id}/mark-paid`, data).then(r => r.data),
};
