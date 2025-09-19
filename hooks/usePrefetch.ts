import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { QUERY_KEYS } from './useContacts';

export function usePrefetch() {
  const queryClient = useQueryClient();
  
  const prefetchContacts = () => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.contacts,
      queryFn: apiService.getContacts,
      staleTime: 5 * 60 * 1000,
    });
  };
  
  const prefetchCalls = () => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.calls,
      queryFn: () => apiService.getCallHistory(),
      staleTime: 2 * 60 * 1000,
    });
  };
  
  const prefetchVoicemails = () => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.voicemails,
      queryFn: () => Promise.resolve([]),
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return {
    prefetchContacts,
    prefetchCalls,
    prefetchVoicemails,
  };
}