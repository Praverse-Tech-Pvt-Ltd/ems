import { apiClient } from '@/lib/api-client';

export const workUpdatesService = {
  submit: (data: { rawText: string; updateDate: string; companyId?: string }) =>
    apiClient.post('/work-updates', data).then(r => r.data),

  my: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/work-updates/my', { params }).then(r => r.data),

  all: (params?: { companyId?: string; employeeId?: string; needsReview?: boolean; page?: number; limit?: number }) =>
    apiClient.get('/work-updates', { params }).then(r => r.data),

  review: (id: string, status: 'APPROVED' | 'NEEDS_CORRECTION', correction?: string) =>
    apiClient.patch(`/work-updates/${id}/review`, { status, correction }).then(r => r.data),
};

export const aiService = {
  ownerDashboard: () =>
    apiClient.get('/ai-overview/owner-dashboard').then(r => r.data),

  weeklySummary: () =>
    apiClient.post('/ai-overview/weekly-summary').then(r => r.data),

  employeeWorkMap: () =>
    apiClient.get('/ai-overview/employee-work-map').then(r => r.data),

  chat: (sessionId: string, question: string) =>
    apiClient.post('/ai-chat/message', { sessionId, question }).then(r => r.data),

  chatHistory: (sessionId: string) =>
    apiClient.get(`/ai-chat/history/${sessionId}`).then(r => r.data),
};
