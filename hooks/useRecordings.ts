import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';

export interface CallRecording {
  id: string;
  filename: string;
  caller: string;
  callee: string;
  other_party: string;
  direction: 'inbound' | 'outbound';
  created_time: number;
  file_size: number;
  audio_url: string;
  date_iso?: string;
  date_local?: string;
  extension?: string;
}

export const useRecordings = (filters?: {
  direction?: 'all' | 'inbound' | 'outbound';
  searchTerm?: string;
  dateRange?: { from: string; to: string };
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['recordings', filters],
    queryFn: () => apiService.getRecordings(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};