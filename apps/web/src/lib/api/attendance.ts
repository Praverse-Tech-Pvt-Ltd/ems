import { apiClient } from '@/lib/api-client';

export const attendanceService = {
  punchIn: (latitude?: number, longitude?: number) =>
    apiClient.post('/attendance/punch-in', { latitude, longitude }).then(r => r.data),

  punchOut: (latitude?: number, longitude?: number) =>
    apiClient.post('/attendance/punch-out', { latitude, longitude }).then(r => r.data),

  today: () =>
    apiClient.get('/attendance/today').then(r => r.data),

  myStats: () =>
    apiClient.get('/attendance/my/stats').then(r => r.data),

  my: (params?: { from?: string; to?: string; limit?: number }) =>
    apiClient.get('/attendance/my', { params }).then(r => r.data),

  forEmployee: (id: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`/attendance/employee/${id}`, { params }).then(r => r.data),

  all: (params?: { from?: string; to?: string; status?: string }) =>
    apiClient.get('/attendance', { params }).then(r => r.data),

  regularize: (id: string, data: { date: string; punchIn: string; punchOut: string; reason: string }) =>
    apiClient.patch(`/attendance/${id}/regularize`, data).then(r => r.data),
};
