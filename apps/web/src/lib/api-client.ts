import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('nexgen-auth');
    if (stored) {
      const { state } = JSON.parse(stored) as { state: { accessToken?: string } };
      if (state.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const stored = localStorage.getItem('nexgen-auth');
      if (stored) {
        const { state } = JSON.parse(stored) as { state: { refreshToken?: string } };
        if (state.refreshToken) {
          try {
            const res = await axios.post(
              `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/refresh`,
              { refreshToken: state.refreshToken },
            );
            const parsed = JSON.parse(stored) as { state: Record<string, unknown> };
            parsed.state.accessToken = res.data.accessToken;
            parsed.state.refreshToken = res.data.refreshToken;
            localStorage.setItem('nexgen-auth', JSON.stringify(parsed));
            error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return apiClient(error.config);
          } catch {
            localStorage.removeItem('nexgen-auth');
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  },
);
