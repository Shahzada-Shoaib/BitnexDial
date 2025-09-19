// contexts/DataContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface Contact {
    id: string;
    phone: string;
    name: string;
    type: 'personal';
    profileColor?: string;
}

interface CallRecord {
    id: string;
    number: string;
    name: string;
    type: 'missed' | 'incoming' | 'outgoing';
    time: string;
    date: string;
    duration?: string;
}

interface Voicemail {
    id?: string;
    callerid?: string;
    caller?: string;
    origtime?: number;
    duration?: number;
    read?: string;
    recording_url?: string;
    audio_url?: string;
}

interface DataState {
    contacts: Contact[];
    calls: CallRecord[];
    voicemails: Voicemail[];
    isLoading: {
        contacts: boolean;
        calls: boolean;
        voicemails: boolean;
    };
    lastFetched: {
        contacts: number;
        calls: number;
        voicemails: number;
    };
    error: {
        contacts: string | null;
        calls: string | null;
        voicemails: string | null;
    };
}

type DataAction = 
    | { type: 'SET_CONTACTS'; payload: Contact[] }
    | { type: 'SET_CALLS'; payload: CallRecord[] }
    | { type: 'SET_VOICEMAILS'; payload: Voicemail[] }
    | { type: 'SET_LOADING'; payload: { key: keyof DataState['isLoading']; value: boolean } }
    | { type: 'SET_ERROR'; payload: { key: keyof DataState['error']; value: string | null } }
    | { type: 'UPDATE_LAST_FETCHED'; payload: { key: keyof DataState['lastFetched'] } }
    | { type: 'ADD_CONTACT'; payload: Contact }
    | { type: 'UPDATE_CONTACT'; payload: Contact }
    | { type: 'DELETE_CONTACT'; payload: string }
    | { type: 'ADD_CALL'; payload: CallRecord }
    | { type: 'DELETE_CALLS'; payload: string[] };

const initialState: DataState = {
    contacts: [],
    calls: [],
    voicemails: [],
    isLoading: {
        contacts: false,
        calls: false,
        voicemails: false,
    },
    lastFetched: {
        contacts: 0,
        calls: 0,
        voicemails: 0,
    },
    error: {
        contacts: null,
        calls: null,
        voicemails: null,
    },
};

function dataReducer(state: DataState, action: DataAction): DataState {
    switch (action.type) {
        case 'SET_CONTACTS':
            return { ...state, contacts: action.payload };
        case 'SET_CALLS':
            return { ...state, calls: action.payload };
        case 'SET_VOICEMAILS':
            return { ...state, voicemails: action.payload };
        case 'SET_LOADING':
            return { 
                ...state, 
                isLoading: { ...state.isLoading, [action.payload.key]: action.payload.value }
            };
        case 'SET_ERROR':
            return { 
                ...state, 
                error: { ...state.error, [action.payload.key]: action.payload.value }
            };
        case 'UPDATE_LAST_FETCHED':
            return { 
                ...state, 
                lastFetched: { ...state.lastFetched, [action.payload.key]: Date.now() }
            };
        case 'ADD_CONTACT':
            return { ...state, contacts: [...state.contacts, action.payload] };
        case 'UPDATE_CONTACT':
            return { 
                ...state, 
                contacts: state.contacts.map(c => c.id === action.payload.id ? action.payload : c)
            };
        case 'DELETE_CONTACT':
            return { 
                ...state, 
                contacts: state.contacts.filter(c => c.id !== action.payload)
            };
        case 'ADD_CALL':
            return { ...state, calls: [action.payload, ...state.calls] };
        case 'DELETE_CALLS':
            return { 
                ...state, 
                calls: state.calls.filter(c => !action.payload.includes(c.id))
            };
        default:
            return state;
    }
}

const DataContext = createContext<{
    state: DataState;
    dispatch: React.Dispatch<DataAction>;
    actions: {
        fetchContacts: (force?: boolean) => Promise<void>;
        fetchCalls: (force?: boolean) => Promise<void>;
        fetchVoicemails: (force?: boolean) => Promise<void>;
        addContact: (contact: Omit<Contact, 'id'>) => Promise<void>;
        updateContact: (contact: Contact) => Promise<void>;
        deleteContact: (contactId: string) => Promise<void>;
        refreshCallHistory: () => Promise<void>;
    };
} | null>(null);

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(dataReducer, initialState);

    const shouldRefetch = (lastFetched: number) => {
        return Date.now() - lastFetched > CACHE_DURATION;
    };

    const fetchContacts = async (force = false) => {
        if (!force && !shouldRefetch(state.lastFetched.contacts) && state.contacts.length > 0) {
            return; // Use cached data
        }

        dispatch({ type: 'SET_LOADING', payload: { key: 'contacts', value: true } });
        dispatch({ type: 'SET_ERROR', payload: { key: 'contacts', value: null } });

        try {
            const userNumber = localStorage.getItem("myPhoneNumber") || "";
            const cleanOwner = userNumber.replace(/[^\d]/g, "");
            
            const response = await fetch(`https://bkpmanual.bitnexdial.com/api/get-contacts?owner=${cleanOwner}`);
            const data = await response.json();
            
            const processedContacts: Contact[] = Array.isArray(data)
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

            dispatch({ type: 'SET_CONTACTS', payload: processedContacts });
            dispatch({ type: 'UPDATE_LAST_FETCHED', payload: { key: 'contacts' } });
            
            // Update global window object for compatibility
            if (typeof window !== 'undefined') {
                window.contactsData = processedContacts;
                window.dispatchEvent(new CustomEvent('globalContactsLoaded', {
                    detail: { contacts: processedContacts, rawContacts: data }
                }));
            }
        } catch (error) {
            console.error('Failed to fetch contacts:', error);
            dispatch({ type: 'SET_ERROR', payload: { key: 'contacts', value: 'Failed to load contacts' } });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'contacts', value: false } });
        }
    };

    const fetchCalls = async (force = false) => {
        if (!force && !shouldRefetch(state.lastFetched.calls) && state.calls.length > 0) {
            return; // Use cached data
        }

        dispatch({ type: 'SET_LOADING', payload: { key: 'calls', value: true } });
        dispatch({ type: 'SET_ERROR', payload: { key: 'calls', value: null } });

        try {
            const raw = localStorage.getItem("myPhoneNumber") || "";
            const myPhone = raw.replace(/[^\d]/g, "").replace(/^1/, "");
            
            if (!myPhone) {
                throw new Error("No phone number found");
            }

            const response = await fetch(
                `https://bkpmanual.bitnexdial.com/api/call-history?extension=${myPhone}&limit=100&offset=0`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const callData = result.data || result;

            const mapped: CallRecord[] = callData.map((cdr: any, index: number) => {
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

            dispatch({ type: 'SET_CALLS', payload: mapped });
            dispatch({ type: 'UPDATE_LAST_FETCHED', payload: { key: 'calls' } });
        } catch (error) {
            console.error('Failed to fetch calls:', error);
            dispatch({ type: 'SET_ERROR', payload: { key: 'calls', value: 'Failed to load call history' } });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'calls', value: false } });
        }
    };

    const fetchVoicemails = async (force = false) => {
        if (!force && !shouldRefetch(state.lastFetched.voicemails) && state.voicemails.length > 0) {
            return; // Use cached data
        }

        dispatch({ type: 'SET_LOADING', payload: { key: 'voicemails', value: true } });
        dispatch({ type: 'SET_ERROR', payload: { key: 'voicemails', value: null } });

        try {
            const myExtension = localStorage.getItem("sipUsername") || "";
            const response = await fetch(`https://bkpmanual.bitnexdial.com/api/voicemails?mailbox=${myExtension}`);
            const data = await response.json();
            
            dispatch({ type: 'SET_VOICEMAILS', payload: (data || []) as Voicemail[] });
            dispatch({ type: 'UPDATE_LAST_FETCHED', payload: { key: 'voicemails' } });
        } catch (error) {
            console.error('Failed to fetch voicemails:', error);
            dispatch({ type: 'SET_ERROR', payload: { key: 'voicemails', value: 'Failed to load voicemails' } });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'voicemails', value: false } });
        }
    };

    const addContact = async (contactData: Omit<Contact, 'id'>) => {
        try {
            const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
            const response = await fetch('https://bkpmanual.bitnexdial.com/api/save-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    myPhoneNumber,
                    contactNumber: contactData.phone,
                    name: contactData.name,
                    type: contactData.type
                })
            });

            const result = await response.json();
            if (result.success) {
                const newContact: Contact = {
                    ...contactData,
                    id: `contact-${Date.now()}`, // Generate ID
                };
                dispatch({ type: 'ADD_CONTACT', payload: newContact });
                
                // Update global state
                if (typeof window !== 'undefined') {
                    const updatedContacts = [...state.contacts, newContact];
                    window.contactsData = updatedContacts;
                    window.dispatchEvent(new CustomEvent('globalContactsLoaded', {
                        detail: { contacts: updatedContacts, rawContacts: [] }
                    }));
                }
            } else {
                throw new Error(result.error || 'Failed to save contact');
            }
        } catch (error) {
            console.error('Failed to add contact:', error);
            throw error;
        }
    };

    const updateContact = async (contact: Contact) => {
        try {
            const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
            const cleanMyNumber = myPhoneNumber.replace(/[^\d]/g, "");
            const cleanContactPhone = contact.phone.replace(/[^\d]/g, "");

            const response = await fetch('https://bkpmanual.bitnexdial.com/api/save-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    myPhoneNumber: cleanMyNumber,
                    contactNumber: cleanContactPhone,
                    name: contact.name,
                    type: contact.type
                })
            });

            const result = await response.json();
            if (result.success) {
                dispatch({ type: 'UPDATE_CONTACT', payload: contact });
                
                // Update global state
                if (typeof window !== 'undefined') {
                    const updatedContacts = state.contacts.map(c => c.id === contact.id ? contact : c);
                    window.contactsData = updatedContacts;
                    window.dispatchEvent(new CustomEvent('globalContactsLoaded', {
                        detail: { contacts: updatedContacts, rawContacts: [] }
                    }));
                }
            } else {
                throw new Error(result.error || 'Failed to update contact');
            }
        } catch (error) {
            console.error('Failed to update contact:', error);
            throw error;
        }
    };

    const deleteContact = async (contactId: string) => {
        try {
            const contact = state.contacts.find(c => c.id === contactId);
            if (!contact) throw new Error('Contact not found');

            const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';
            const cleanMyNumber = myPhoneNumber.replace(/[^\d]/g, "");
            const cleanContactPhone = contact.phone.replace(/[^\d]/g, "");

            const response = await fetch('https://bkpmanual.bitnexdial.com/api/delete-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    myPhoneNumber: cleanMyNumber,
                    contactNumber: cleanContactPhone
                })
            });

            const result = await response.json();
            if (result.success) {
                dispatch({ type: 'DELETE_CONTACT', payload: contactId });
                
                // Update global state
                if (typeof window !== 'undefined') {
                    const updatedContacts = state.contacts.filter(c => c.id !== contactId);
                    window.contactsData = updatedContacts;
                    window.dispatchEvent(new CustomEvent('globalContactsLoaded', {
                        detail: { contacts: updatedContacts, rawContacts: [] }
                    }));
                }
            } else {
                throw new Error(result.error || 'Failed to delete contact');
            }
        } catch (error) {
            console.error('Failed to delete contact:', error);
            throw error;
        }
    };

    const refreshCallHistory = async () => {
        await fetchCalls(true); // Force refresh
    };

    // Auto-fetch data on mount
    useEffect(() => {
        fetchContacts();
        fetchCalls();
        fetchVoicemails();
    }, []);

    // Listen for call events to refresh call history
    useEffect(() => {
        const handleCallEnd = () => {
            setTimeout(() => {
                refreshCallHistory();
            }, 2000); // Delay to ensure call is recorded
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('globalCallEnd', handleCallEnd);
            window.addEventListener('callTerminated', handleCallEnd);
            window.addEventListener('callEndWithMetrics', handleCallEnd);

            return () => {
                window.removeEventListener('globalCallEnd', handleCallEnd);
                window.removeEventListener('callTerminated', handleCallEnd);
                window.removeEventListener('callEndWithMetrics', handleCallEnd);
            };
        }
    }, []);

    const actions = {
        fetchContacts,
        fetchCalls,
        fetchVoicemails,
        addContact,
        updateContact,
        deleteContact,
        refreshCallHistory,
    };

    return (
        <DataContext.Provider value={{ state, dispatch, actions }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}