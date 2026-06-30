import { apiClient } from '@/lib/api-client';

export const companyTrackerService = {
  options: () =>
    apiClient.get('/company-tracker/options').then(r => r.data),

  dashboard: (params?: Record<string, string | boolean | undefined>) =>
    apiClient.get('/company-tracker/dashboard', { params }).then(r => r.data),

  projects: (params?: Record<string, string | boolean | undefined>) =>
    apiClient.get('/company-tracker/projects', { params }).then(r => r.data),

  project: (id: string) =>
    apiClient.get(`/company-tracker/projects/${id}`).then(r => r.data),

  createProject: (data: Record<string, unknown>) =>
    apiClient.post('/company-tracker/projects', data).then(r => r.data),

  updateProject: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/company-tracker/projects/${id}`, data).then(r => r.data),

  deleteProject: (id: string) =>
    apiClient.delete(`/company-tracker/projects/${id}`).then(r => r.data),

  addRequirement: (projectId: string, data: Record<string, unknown>) =>
    apiClient.post(`/company-tracker/projects/${projectId}/requirements`, data).then(r => r.data),

  updateRequirement: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/company-tracker/requirements/${id}`, data).then(r => r.data),

  addDocument: (requirementId: string, data: Record<string, unknown>) =>
    apiClient.post(`/company-tracker/requirements/${requirementId}/documents`, data).then(r => r.data),

  createFollowUp: (data: Record<string, unknown>) =>
    apiClient.post('/company-tracker/follow-ups', data).then(r => r.data),

  updateFollowUp: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/company-tracker/follow-ups/${id}`, data).then(r => r.data),

  exportReport: (type: string) =>
    apiClient.get(`/company-tracker/reports/${type}`, { responseType: 'blob' }).then(r => r.data),
};
