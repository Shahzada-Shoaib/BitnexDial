import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './useContacts';

export function useCallEventListener() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const handleCallEnd = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls });
      }, 2000);
    };

    const events = ['globalCallEnd', 'callTerminated', 'callEndWithMetrics'];
    
    events.forEach(event => {
      window.addEventListener(event, handleCallEnd);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleCallEnd);
      });
    };
  }, [queryClient]);
}