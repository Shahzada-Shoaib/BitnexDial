// hooks/useContacts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { Contact } from '../types';

export const QUERY_KEYS = {
  contacts: ['contacts'] as const,
  calls: ['calls'] as const,
  voicemails: ['voicemails'] as const,
  blockedContacts: ['blockedContacts'] as const,
};

// Contacts Hook
export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: QUERY_KEYS.contacts,
    queryFn: apiService.getContacts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useAddContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contactData: Omit<Contact, 'id'>) => {
      const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
      return apiService.saveContact({
        myPhoneNumber,
        contactNumber: contactData.phone,
        name: contactData.name,
        type: contactData.type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
    },
    onError: (error) => {
      console.error('Failed to add contact:', error);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contact: Contact) => {
      const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
      const cleanMyNumber = myPhoneNumber.replace(/[^\d]/g, "");
      const cleanContactPhone = contact.phone.replace(/[^\d]/g, "");

      return apiService.saveContact({
        myPhoneNumber: cleanMyNumber,
        contactNumber: cleanContactPhone,
        name: contact.name,
        type: contact.type,
      });
    },
    onMutate: async (updatedContact) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.contacts });
      
      // Snapshot previous value
      const previousContacts = queryClient.getQueryData<Contact[]>(QUERY_KEYS.contacts);
      
      // Optimistically update
      if (previousContacts) {
        queryClient.setQueryData<Contact[]>(QUERY_KEYS.contacts, (old) => 
          old?.map(contact => 
            contact.id === updatedContact.id ? updatedContact : contact
          ) || []
        );
      }
      
      return { previousContacts };
    },
    onError: (err, updatedContact, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(QUERY_KEYS.contacts, context.previousContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactId, contact }: { contactId: string; contact: Contact }) => {
      const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
      const cleanMyNumber = myPhoneNumber.replace(/[^\d]/g, "");
      const cleanContactPhone = contact.phone.replace(/[^\d]/g, "");

      return apiService.deleteContact({
        myPhoneNumber: cleanMyNumber,
        contactNumber: cleanContactPhone,
      });
    },
    onMutate: async ({ contactId }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.contacts });
      
      const previousContacts = queryClient.getQueryData<Contact[]>(QUERY_KEYS.contacts);
      
      if (previousContacts) {
        queryClient.setQueryData<Contact[]>(QUERY_KEYS.contacts, (old) => 
          old?.filter(contact => contact.id !== contactId) || []
        );
      }
      
      return { previousContacts };
    },
    onError: (err, variables, context) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(QUERY_KEYS.contacts, context.previousContacts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
    },
  });
}

// Blocked Contacts
export function useBlockedContacts() {
  return useQuery<Set<string>>({
    queryKey: QUERY_KEYS.blockedContacts,
    queryFn: apiService.getBlockedContacts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useBlockContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactNumber, action }: { contactNumber: string; action: 'block' | 'unblock' }) => {
      const userNumber = localStorage.getItem("myPhoneNumber") || "";
      const myNumber = userNumber.replace(/[^\d]/g, "");
      const cleanContactPhone = contactNumber.replace(/[^\d]/g, "");

      return apiService.blockContact({
        myPhoneNumber: myNumber,
        contactNumber: cleanContactPhone,
        action,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blockedContacts });
    },
  });
}