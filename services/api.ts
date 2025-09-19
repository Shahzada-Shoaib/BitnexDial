import { Contact, CallRecord, Voicemail, BlockedContact } from '../types';

class ApiService {
  private baseURL = 'https://bkpmanual.bitnexdial.com';
  
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  getContacts = async (): Promise<Contact[]> => {
    try {
      const userNumber = localStorage.getItem("myPhoneNumber") || "";
      const cleanOwner = userNumber.replace(/[^\d]/g, "");
      
      console.log('Debug - userNumber:', userNumber);
      console.log('Debug - cleanOwner:', cleanOwner);
      
      if (!cleanOwner) {
        throw new Error("No phone number found in localStorage");
      }

      const endpoint = `/api/get-contacts?owner=${cleanOwner}`;
      console.log('Debug - calling endpoint:', endpoint);
      
      const data = await this.request<any[]>(endpoint);
      console.log('Debug - received data:', data);
      
      const processedContacts = Array.isArray(data)
        ? data.map((row, i) => ({
            id: row.contact || `contact-${i}`,
            phone: row.contact || "",
            name: typeof row.name === 'string' && row.name.trim() !== ''
              ? row.name
              : row.contact,
            type: 'personal' as const,
            profileColor: "bg-blue-500",
          }))
        : [];
        
      console.log('Debug - processed contacts:', processedContacts);
      return processedContacts;
    } catch (error) {
      console.error('Debug - getContacts error:', error);
      throw error;
    }
  }

  saveContact = async (contactData: {
    myPhoneNumber: string;
    contactNumber: string;
    name: string;
    type: string;
  }): Promise<{ success: boolean; error?: string }> => {
    return this.request('/api/save-contact', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  deleteContact = async (data: {
    myPhoneNumber: string;
    contactNumber: string;
  }): Promise<{ success: boolean; error?: string }> => {
    return this.request('/api/delete-contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getCallHistory = async (limit = 100, offset = 0): Promise<CallRecord[]> => {
    const raw = localStorage.getItem("myPhoneNumber") || "";
    const myPhone = raw.replace(/[^\d]/g, "").replace(/^1/, "");
    
    if (!myPhone) {
      throw new Error("No phone number found");
    }

    const result = await this.request<{ data?: any[] } | any[]>(
      `/api/call-history?extension=${myPhone}&limit=${limit}&offset=${offset}`
    );

    const callData = Array.isArray(result) ? result : result.data || [];

    return callData.map((cdr: any) => {
      const isOutbound = cdr.direction === "outbound";
      const buddyNum = isOutbound ? cdr.callee : cdr.caller;
      const dt = new Date(cdr.start_time);

      return {
        id: cdr.id.toString(),
        number: buddyNum || 'Unknown',
        name: buddyNum || 'Unknown',
        type: cdr.duration === 0 ? "missed" :
          isOutbound ? "outgoing" : "incoming",
        date: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        time: dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        duration: cdr.duration ? `${cdr.duration}s` : undefined,
      };
    });
  }

  getBlockedContacts = async (): Promise<Set<string>> => {
    const userNumber = localStorage.getItem("myPhoneNumber") || "";
    const myNumber = userNumber.replace(/[^\d]/g, "");
    
    const result = await this.request<{ success: boolean; blockedContacts: BlockedContact[] }>(
      `/api/blocked-contacts?owner=${myNumber}`
    );
    
    if (result.success) {
      return new Set(result.blockedContacts.map((c: BlockedContact) => c.contact));
    }
    return new Set();
  }

  blockContact = async (data: {
    myPhoneNumber: string;
    contactNumber: string;
    action: 'block' | 'unblock';
  }): Promise<{ success: boolean; error?: string }> => {
    return this.request('/api/block-contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

//ApiService class

getRecordings = async (filters?: {
  direction?: 'all' | 'inbound' | 'outbound';
  searchTerm?: string;
  dateRange?: { from: string; to: string };
  page?: number;
  limit?: number;
}): Promise<any[]> => {
  const myExtension = localStorage.getItem("sipUsername") || "";
  
  if (!myExtension) {
    throw new Error("No extension found in localStorage");
  }

  const params = new URLSearchParams({
    extension: myExtension,
    limit: (filters?.limit || 10).toString(),
    offset: (((filters?.page || 1) - 1) * (filters?.limit || 10)).toString()
  });

  if (filters?.direction && filters.direction !== 'all') {
    params.append('direction', filters.direction);
  }

  if (filters?.dateRange?.from) {
    params.append('from', filters.dateRange.from.replace(/-/g, ''));
  }
  
  if (filters?.dateRange?.to) {
    params.append('to', filters.dateRange.to.replace(/-/g, ''));
  }

  if (filters?.searchTerm?.trim()) {
    const searchDigits = filters.searchTerm.replace(/\D/g, '');
    if (searchDigits) {
      params.append('other', searchDigits);
    }
  }

  const result = await this.request<any>(`/api/call-recordings?${params}`);
  return result.data || result || [];
}


}

export const apiService = new ApiService();