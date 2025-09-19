import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ContactsParams {
  userNumber: string;
  searchTerm: string;
  activeTab: string;
}

interface MessagesParams {
  myNumber: string;
  contactId: string;
  enabled: boolean;
}

interface SMSParams {
  from: string;
  to: string;
  message: string;
}

export const useContacts = ({ userNumber, searchTerm, activeTab }: ContactsParams) => {
  return useInfiniteQuery({
    queryKey: ['contacts', userNumber, searchTerm, activeTab],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      try {
        const response = await fetch('https://bkpmanual.bitnexdial.com/sms-latest-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: userNumber,
            limit: 20,
            offset: (pageParam as number) * 20
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`📞 Loaded contacts page ${pageParam}:`, result.conversations?.length || result.length || 0, 'contacts');
        
        return result.isPaginated ? result : { conversations: result, hasMore: false };
      } catch (error) {
        console.error('❌ Failed to load contacts:', error);
        throw error;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    staleTime: 1 * 60 * 1000, // Reduced to 1 minute for more frequent updates
    gcTime: 10 * 60 * 1000,
    enabled: !!userNumber,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

export const useMessages = ({ myNumber, contactId, enabled }: MessagesParams) => {
  return useInfiniteQuery({
    queryKey: ['messages', myNumber, contactId],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      if (!enabled || !myNumber || !contactId) {
        return { messages: [], hasMore: false };
      }

      try {
        console.log(`📨 Loading messages for ${contactId}, page ${pageParam}`);
        
        const response = await fetch('https://bkpmanual.bitnexdial.com/sms-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: myNumber,
            contact: contactId,
            limit: 20,
            offset: (pageParam as number) * 20
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        const messages = Array.isArray(result) ? result : result.messages || [];
        
        console.log(`✅ Loaded ${messages.length} messages for ${contactId}, page ${pageParam}`);
        
        return Array.isArray(result) ? result : { messages: result.messages || [], hasMore: messages.length === 20 };
      } catch (error) {
        console.error(`❌ Failed to load messages for ${contactId}:`, error);
        throw error;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const messages = Array.isArray(lastPage) ? lastPage : lastPage.messages || [];
      return messages && messages.length === 20 ? allPages.length : undefined;
    },
    staleTime: 10 * 1000, // Reduced to 10 seconds for real-time feel
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
    // Add refetch options for better real-time updates
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
};

export const useSendSMS = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ from, to, message }: SMSParams) => {
      return new Promise<{ from: string; to: string; message: string }>((resolve, reject) => {
        if (!(window as any).globalSocket) {
          reject(new Error('Socket not available'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('SMS send timeout after 10 seconds'));
        }, 10000);

        try {
          console.log(`📤 Sending SMS from ${from} to ${to}:`, message.substring(0, 50) + '...');
          
          (window as any).globalSocket.emit('send-sms', { 
            from, 
            to, 
            message,
            alreadySaved: true
          });
          
          // For now, assume success immediately since we don't have server ACK
          clearTimeout(timeout);
          resolve({ from, to, message });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    },
    onSuccess: (data) => {
      console.log('✅ SMS sent successfully');
      const myNumber = data.from.replace('+1', '');
      
      // Invalidate queries after a short delay to allow server processing
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['messages', myNumber, data.to] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['contacts', myNumber] 
        });
      }, 500);
    },
    onError: (error) => {
      console.error('❌ SMS send failed:', error);
      // You could show a user notification here
      window.dispatchEvent(new CustomEvent('showToast', {
        detail: {
          message: 'Failed to send message. Please try again.',
          type: 'error',
          duration: 3000
        }
      }));
    },
    retry: 2,
    retryDelay: 1000
  });
};