import { apiClient } from '@/lib/api-client';

export const clientsService = {
  list: (params?: { status?: string; criticality?: string; search?: string; archived?: boolean }) =>
    apiClient.get('/client-companies', { params }).then(r => r.data),

  byId: (id: string) =>
    apiClient.get(`/client-companies/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/client-companies', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/client-companies/${id}`, data).then(r => r.data),

  timeline: (id: string, limit?: number) =>
    apiClient.get(`/client-companies/${id}/timeline`, { params: { limit } }).then(r => r.data),

  aiSummary: (id: string) =>
    apiClient.post(`/client-companies/${id}/ai-summary`).then(r => r.data),

  addVisit: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/client-companies/${id}/visits`, data).then(r => r.data),
};

export const auditReadinessService = {
  get: (projectId: string) =>
    apiClient.get(`/audit-readiness/${projectId}`).then(r => r.data),

  createItem: (projectId: string, data: Record<string, unknown>) =>
    apiClient.post(`/audit-readiness/${projectId}/items`, data).then(r => r.data),

  updateItem: (projectId: string, itemId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/audit-readiness/${projectId}/items/${itemId}`, data).then(r => r.data),

  aiGaps: (projectId: string) =>
    apiClient.post(`/audit-readiness/${projectId}/ai-gaps`).then(r => r.data),
};

export const followUpService = {
  list: (params?: { status?: string; companyId?: string; assignedToMe?: boolean }) =>
    apiClient.get('/follow-up-tasks', { params }).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/follow-up-tasks', data).then(r => r.data),

  complete: (id: string, note: string) =>
    apiClient.patch(`/follow-up-tasks/${id}/complete`, { note }).then(r => r.data),
};
