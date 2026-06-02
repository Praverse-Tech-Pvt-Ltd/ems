import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const apiClient = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the httpOnly refresh-token cookie
  // and the API can set new cookies on responses.
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  // Let the browser set Content-Type for FormData (includes boundary).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  // Read the short-lived access token from the in-memory store (not localStorage).
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

/** Tracks an in-flight refresh so concurrent 401s only fire one request. */
let refreshPromise: Promise<string> | null = null;
let isRedirecting = false;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as import('axios').AxiosError;
    const status = axiosError.response?.status;
    const config = axiosError.config as import('axios').InternalAxiosRequestConfig & { _retry?: boolean };

    if (status === 401 && !config._retry && typeof window !== 'undefined') {
      if (isRedirecting) {
        return Promise.reject(error);
      }
      config._retry = true;

      try {
        // Deduplicate: if a refresh is already underway reuse the same promise.
        if (!refreshPromise) {
          refreshPromise = axios
            .post<{ accessToken: string }>(
              `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/refresh`,
              {},
              { withCredentials: true }, // cookie is sent automatically
            )
            .then((r) => r.data.accessToken)
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;
        useAuthStore.getState().setAccessToken(newAccessToken);
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(config);
      } catch (err) {
        isRedirecting = true;
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);
