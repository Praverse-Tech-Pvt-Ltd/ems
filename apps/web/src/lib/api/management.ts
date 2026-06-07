import { apiClient } from '@/lib/api-client';

export const managementService = {
  weeklyReview: () =>
    apiClient.get('/management-review/weekly').then(r => r.data),

  aiRecommendations: () =>
    apiClient.get('/management-review/ai-recommendations').then(r => r.data),

  employeePerformance: (days = 30) =>
    apiClient.get('/management-review/employee-performance', { params: { days } }).then(r => r.data),

  exportPdf: () =>
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/management-review/export/pdf`,
};

export const dashboardService = {
  stats: () =>
    apiClient.get('/reports/dashboard').then(r => r.data),

  attendance: (params?: { from?: string; to?: string; employeeId?: string }) =>
    apiClient.get('/reports/attendance', { params }).then(r => r.data),

  expenses: (params?: { from?: string; to?: string }) =>
    apiClient.get('/reports/expenses', { params }).then(r => r.data),

  payroll: (params?: { month?: number; year?: number }) =>
    apiClient.get('/reports/payroll', { params }).then(r => r.data),
};

export const auditLogsService = {
  list: (params?: {
    actorId?: string;
    resourceType?: string;
    action?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }) => apiClient.get('/audit-logs', { params }).then(r => r.data),
};

export const calendarService = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/company-calendar', { params }).then(r => r.data),

  upcoming: (days = 30) =>
    apiClient.get('/company-calendar/upcoming', { params: { days } }).then(r => r.data),

  auditCountdowns: () =>
    apiClient.get('/company-calendar/audit-countdowns').then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/company-calendar', data).then(r => r.data),
};

export const meetingNotesService = {
  list: (params?: { companyId?: string; needsReview?: boolean; page?: number; limit?: number }) =>
    apiClient.get('/meeting-notes', { params }).then(r => r.data),

  create: (data: { rawText: string; meetingDate: string; companyId?: string }) =>
    apiClient.post('/meeting-notes', data).then(r => r.data),

  review: (id: string, status: string, corrections?: string) =>
    apiClient.patch(`/meeting-notes/${id}/review`, { status, corrections }).then(r => r.data),
};

export const notificationsService = {
  list: () =>
    apiClient.get('/notifications').then(r => r.data),

  unreadCount: () =>
    apiClient.get('/notifications/unread-count').then(r => r.data),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all').then(r => r.data),

  broadcast: (data: { title: string; body: string; type?: string }) =>
    apiClient.post('/notifications/broadcast', data).then(r => r.data),
};

export const chatService = {
  channels: () =>
    apiClient.get('/chat/channels').then(r => r.data),

  messages: (channelId: string, params?: { cursor?: string; limit?: number }) =>
    apiClient.get(`/chat/channels/${channelId}/messages`, { params }).then(r => r.data),

  send: (channelId: string, body: string) =>
    apiClient.post(`/chat/channels/${channelId}/messages`, { body }).then(r => r.data),

  markRead: (channelId: string) =>
    apiClient.patch(`/chat/channels/${channelId}/read`).then(r => r.data),

  createDirect: (memberId: string) =>
    apiClient.post('/chat/channels/direct', { memberId }).then(r => r.data),

  createGroup: (name: string, memberIds: string[]) =>
    apiClient.post('/chat/channels/group', { name, memberIds }).then(r => r.data),
};
