import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useAvatarUrl(photoKey: string | null | undefined): string | null {
  const { data } = useQuery<string | null>({
    queryKey: ['avatar-url', photoKey],
    enabled: !!photoKey,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      const res = await apiClient.get('/files', {
        params: { key: photoKey },
        responseType: 'blob',
      });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(res.data);
      });
    },
  });
  return data ?? null;
}
