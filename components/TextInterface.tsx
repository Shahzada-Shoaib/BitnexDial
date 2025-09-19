'use client';

import { useState, useEffect, useCallback } from 'react'; import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { BiSearchAlt } from "react-icons/bi";
import { LiaEdit } from "react-icons/lia";
import { TbMessagePlus } from "react-icons/tb";
import { IoMdContacts } from "react-icons/io";
import { PiStarThin, PiStarFill } from "react-icons/pi";
import { FiPhone } from "react-icons/fi";
import { TbDotsVertical } from "react-icons/tb";
import { TbTrash } from "react-icons/tb";
import { TbArrowsExchange } from "react-icons/tb";
import { CiFaceSmile } from "react-icons/ci";
import { FiCamera, FiPaperclip } from "react-icons/fi";
import { IoSend, IoClose } from "react-icons/io5";
import { MdBackspace, MdDelete } from "react-icons/md";
import { BsTelephoneFill } from "react-icons/bs";
import { BsChatText } from "react-icons/bs";
import { io, Socket } from 'socket.io-client';
import { useRef } from 'react';
import AlertModal from './AlertModal';
import { useSMSCounter } from '../hooks/useSMSCounter';
import { useMemo } from 'react'; // Add this import at the top
import { useGlobalSocket } from '../hooks/useGlobalSocket';

// Add these imports at the top
import CallOverlay from './CallOverlay';
import FavoriteContactCard from './FavoriteContactCard';
import { useCallStatus } from '../app/context/callStatusContext';
import EmojiSelector from './EmojiSelector';


declare global {
    interface Window {
        DialByLine?: (
            type: 'audio' | 'video',
            buddy: any,
            number: string,
            CallerID?: string,
            extraHeaders?: string[]
        ) => void;
        Lines?: any[];
        getActiveLineNum?: () => number;
        endSession?: (lineNum: number) => void;
        cancelSession?: (lineNum: number) => void;
        HangupAll?: () => void;
        EndCall?: () => void;
        HangUp?: () => void;
        StopSession?: (lineNum: number) => void;
        TerminateCall?: () => void;
        DisconnectCall?: () => void;
        HangupCall?: () => void;
        [key: string]: any;
    }
}

interface Contact {
    id: string;
    phone: string;
    name: string;
    hasUnread?: boolean;
    unreadCount?: number;
    lastMessage?: string;
    lastMessageDate?: string;
    lastMessageTime?: string;
    isFavorite?: boolean;
}


// Improved phone number normalization function
// const normalizePhoneNumber = (phoneNumber: string): string => {
//     if (!phoneNumber) return '';

//     // Remove all non-digit characters
//     const digitsOnly = phoneNumber.replace(/\D/g, '');
//     const isSelfCall = (dialedNumber: string, myNumber: string): boolean => {
//     const normalizedDialed = normalizePhoneNumber(dialedNumber);
//     const normalizedMy = normalizePhoneNumber(myNumber);

//     return normalizedDialed === normalizedMy;
// };

//     // Handle different cases:
//     // - If 11 digits starting with 1: remove the 1 (US country code)
//     // - If 10 digits: use as is
//     // - Otherwise: return as is (for international numbers)
//     if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
//         return digitsOnly.slice(1); // Remove leading 1
//     } else if (digitsOnly.length === 10) {
//         return digitsOnly;
//     } else {
//         return digitsOnly;
//     }
// };

const normalizePhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return '';
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Always return 10-digit format for US numbers
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return digitsOnly.slice(1);
    } else if (digitsOnly.length === 10) {
        return digitsOnly;
    }

    // For international or other formats, return as-is but prefer 10-digit
    return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
};

// Add these interfaces after the existing CallState interface
interface CallControls {
    isOnHold: boolean;
    isMuted: boolean;
    volume: number;
    showKeypad: boolean;
    showTransfer: boolean;
}

interface SessionState {
    isOnHold: boolean;
    isMuted: boolean;
    isConnected: boolean;
    lineNumber?: number;
}

// Add these interfaces after your existing interfaces
interface CallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connecting' | 'connected' | 'ended';
}


declare global {
    interface Window {
        PreviewImage: (img: HTMLImageElement) => void;
    }
}

declare global {
    interface Window {
        FindBuddyByIdentity?: (id: string) => any;
        FetchSMSHistory?: (buddyObj: any) => void;
        phoneLoaded?: boolean;
        socket?: any;
    }
}

// SMS model so TypeScript knows what r.json() returns
interface SMS {
    id?: number; // Add this line - optional because some messages might not have IDs yet
    tx_rx_datetime: string;
    sender: string;
    receiver: string;
    body: string;
    mediaUrl?: string
    direction: string; // "outbound" or "inbound"
}
interface CallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connecting' | 'connected' | 'ended'; // Added 'connecting'
}

// Phone‐number formatter (used when building contactList threads)
function formatPhone(raw: string): string {
    const d = raw.replace(/\D/g, '');
    return d.length === 10
        ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
        : raw;
}

// Function to clean and format phone number for dialing
function cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // If it's a 10-digit number, add +1 prefix
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    // If it's 11 digits starting with 1, add + prefix
    else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }
    // Otherwise return as-is with + prefix if not already there
    else if (!phoneNumber.startsWith('+')) {
        return `+${cleaned}`;
    }

    return cleaned;
}
export default function TextInterface() {

    useGlobalSocket();
    const { callActive } = useCallStatus();
    const { smsData, isLoading: counterLoading, markAsRead } = useSMSCounter();
    // Get URL search params
    const searchParams = useSearchParams();

    // always get a 10-digit string (strip +, non-digits, drop leading 1)
    function getMy10DigitNumber(): string {
    if (typeof window === "undefined") return ""; // SSR-safe
    const raw = localStorage.getItem("myPhoneNumber") || "";
    return normalizePhoneNumber(raw);
    }

////////////cache
// Add caching state
////////////cache
// Cache state initialized from localStorage
const [hasLoadedMessagesFor, setHasLoadedMessagesFor] = useState<Set<string>>(new Set());
const [contactsCache] = useState<Map<string, Contact[]>>(() => {
    try {
        const cached = localStorage.getItem('contactsCache');
        return cached ? new Map(JSON.parse(cached)) : new Map();
    } catch {
        return new Map();
    }
});

const [messagesCache] = useState<Map<string, SMS[]>>(() => {
    try {
        const cached = localStorage.getItem('messagesCache');
        return cached ? new Map(JSON.parse(cached)) : new Map();
    } catch {
        return new Map();
    }
});

const [contactsCacheTime] = useState<Map<string, number>>(() => {
    try {
        const cached = localStorage.getItem('contactsCacheTime');
        return cached ? new Map(JSON.parse(cached)) : new Map();
    } catch {
        return new Map();
    }
});

const [messagesCacheTime] = useState<Map<string, number>>(() => {
    try {
        const cached = localStorage.getItem('messagesCacheTime');
        return cached ? new Map(JSON.parse(cached)) : new Map();
    } catch {
        return new Map();
    }
});

const [hasLoadedContactsOnce, setHasLoadedContactsOnce] = useState(false);
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache persistence helpers
const saveToLocalStorage = (key: string, map: Map<any, any>) => {
    try {
        localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
    } catch (error) {
        console.warn('Failed to save cache to localStorage:', error);
    }
};

const updateContactsCache = (key: string, data: Contact[]) => {
    const now = Date.now();
    contactsCache.set(key, data);
    contactsCacheTime.set(key, now);
    saveToLocalStorage('contactsCache', contactsCache);
    saveToLocalStorage('contactsCacheTime', contactsCacheTime);
};

const updateMessagesCache = (key: string, data: SMS[]) => {
    const now = Date.now();
    messagesCache.set(key, data);
    messagesCacheTime.set(key, now);
    saveToLocalStorage('messagesCache', messagesCache);
    saveToLocalStorage('messagesCacheTime', messagesCacheTime);
};
/////////////
////////////////////

    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [messageText, setMessageText] = useState('');
    const [myPhoneNumber, setMyPhoneNumber] = useState<string>("");
    const [messageAnimation, setMessageAnimation] = useState('');
    const [isOnline, setIsOnline] = useState(true);
    const [contactList, setContactList] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<SMS[]>([]);
    const chatRef = useRef<HTMLDivElement>(null); //updated 02-07-2025 Wednesday

    // New state for dialer and edit modes
    const [showDialer, setShowDialer] = useState(false);
    const [dialedNumber, setDialedNumber] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartTime, setDragStartTime] = useState(0);
    const [mouseStartPos, setMouseStartPos] = useState({ x: 0, y: 0 });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Add these after the existing call state variables
    const [callControls, setCallControls] = useState<CallControls>({
        isOnHold: false,
        isMuted: false,
        volume: 80,
        showKeypad: false,
        showTransfer: false
    });
    const [dialpadNumber, setDialpadNumber] = useState('');
    const [transferNumber, setTransferNumber] = useState('');

    // Delete functionality state variables
    const [showDeleteConversationAlert, setShowDeleteConversationAlert] = useState(false);
    const [showDeleteMessagesAlert, setShowDeleteMessagesAlert] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
    const [isMessageSelectMode, setIsMessageSelectMode] = useState(false);
    const [showSingleMessageDeleteAlert, setShowSingleMessageDeleteAlert] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<{ index: number; message: SMS } | null>(null);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);


    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; show: boolean } | null>(null);
    ///////////////////////sms favourite
    const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
    const [favoriteContacts, setFavoriteContacts] = useState<Set<string>>(new Set());
    const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);


    ///////////////dedup

    // Add these functions after loadContactPage function
const toggleContactFavorite = async (contact: Contact) => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);

    try {
        // ✅ FIXED: Always get the current user's number
        const myNumber = getMy10DigitNumber();

        console.log(`🔄 Toggling favorite for user ${myNumber}, contact ${contact.id}`);

        const response = await fetch('https://bkpmanual.bitnexdial.com/api/toggle-favorite-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myPhoneNumber: myNumber, // ✅ Current user's number
                contactNumber: contact.id // ✅ Contact to favorite
            })
        });

        const result = await response.json();

        if (result.success) {
            const contactId = normalizePhoneNumber(contact.id);

            console.log(`✅ Favorite toggled for ${myNumber}: ${contactId} is now ${result.isFavorite ? 'favorited' : 'unfavorited'}`);

            // ✅ Update local favorite contacts set
            setFavoriteContacts(prev => {
                const newFavorites = new Set(prev);
                if (result.isFavorite) {
                    newFavorites.add(contactId);
                } else {
                    newFavorites.delete(contactId);
                }
                console.log(`📱 Updated local favorites: ${Array.from(newFavorites).length} favorites`);
                return newFavorites;
            });

            // ✅ Update contact list with favorite status
            setContactList(prev => prev.map(c =>
                normalizePhoneNumber(c.id) === contactId
                    ? { ...c, isFavorite: result.isFavorite }
                    : c
            ).sort((a: Contact, b: Contact) => {
                // Sort favorites first
                if (a.isFavorite && !b.isFavorite) return -1;
                if (!a.isFavorite && b.isFavorite) return 1;

                // Then sort by unread status
                if (a.hasUnread && !b.hasUnread) return -1;
                if (!a.hasUnread && b.hasUnread) return 1;

                // Finally sort by last message date
                if (a.lastMessageDate && b.lastMessageDate) {
                    return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
                }

                if (a.lastMessageDate && !b.lastMessageDate) return -1;
                if (!a.lastMessageDate && b.lastMessageDate) return 1;

                return a.name.localeCompare(b.name);
            }));

            // ✅ Update selected contact if it's the same one
            if (selectedContact && normalizePhoneNumber(selectedContact.id) === contactId) {
                setSelectedContact(prev => prev ? { ...prev, isFavorite: result.isFavorite } : null);
            }

            // ✅ Show toast notification
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: result.isFavorite ? 'Chat pinned to your favorites' : 'Chat unpinned from your favorites',
                        type: 'success',
                        duration: 2000
                    }
                }));
            }

        } else {
            console.error('❌ Failed to toggle favorite:', result.error);
            // Show error toast
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: 'Failed to update favorites',
                        type: 'error',
                        duration: 3000
                    }
                }));
            }
        }
    } catch (error) {
        console.error('❌ Error toggling favorite:', error);
        // Show error toast
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: 'Network error while updating favorites',
                    type: 'error',
                    duration: 3000
                }
            }));
        }
    } finally {
        setIsTogglingFavorite(false);
    }
};

const loadFavoriteContacts = async () => {
    try {
        // ✅ FIXED: Get current user's number
        const myNumber = getMy10DigitNumber();

        console.log(`🔍 Loading favorites for user: ${myNumber}`);

        const response = await fetch(`https://bkpmanual.bitnexdial.com/api/favorite-chats?owner=${myNumber}`);
        const result = await response.json();

        if (result.success) {
            const favorites = new Set<string>(result.favorites.map((f: any) => normalizePhoneNumber(f.contact)));
            setFavoriteContacts(favorites);
            console.log(`✅ Loaded ${favorites.size} favorite contacts for user ${myNumber}:`, Array.from(favorites));
        } else {
            console.error('❌ Failed to load favorites:', result.error);
        }
    } catch (error) {
        console.error('❌ Error loading favorite contacts:', error);
    }
};
    // Contact list pagination state
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [hasMoreContacts, setHasMoreContacts] = useState(false);
    const [contactsCurrentPage, setContactsCurrentPage] = useState(0);
    const [totalContacts, setTotalContacts] = useState(0);
    const contactsPerPage = 20;
    const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [messagesOffset, setMessagesOffset] = useState(0);
    const messagesLimit = 20;
    const [isAutoLoading, setIsAutoLoading] = useState(false);
    const [scrollPosition, setScrollPosition] = useState(0);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const autoLoadTriggerRef = useRef<HTMLDivElement>(null);
    // Add infinite scroll ref and state
    const contactListRef = useRef<HTMLDivElement>(null);
    const [isNearBottom, setIsNearBottom] = useState(false);
    const [isFavorite, setIsFavorite] = useState<boolean>(false);
    // Add this state
const [isLoadingMessages, setIsLoadingMessages] = useState(false);

// Add infinite scroll for contact list
useEffect(() => {
    const contactListElement = contactListRef.current;
    if (!contactListElement) return;

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = contactListElement;
        const bottomThreshold = 100;

        const isNearBottom = scrollTop + clientHeight >= scrollHeight - bottomThreshold;

        if (isNearBottom && hasMoreContacts && !isLoadingContacts && contactList.length > 0) {
            console.log('Auto-loading more contacts');
            loadMoreContacts();
        }
    };

    let scrollTimer: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(handleScroll, 150);
    };

    contactListElement.addEventListener('scroll', debouncedHandleScroll);
    return () => {
        contactListElement.removeEventListener('scroll', debouncedHandleScroll);
        clearTimeout(scrollTimer);
    };
}, [hasMoreContacts, isLoadingContacts, contactList.length]);
// Update your useEffect that handles scrolling to bottom
useEffect(() => {
    // Only scroll to bottom for initial loads and new messages, NOT pagination
    if (chatRef.current && !isLoadingOlderMessages && messages.length > 0) {
        // Only auto-scroll if user is already near bottom or it's a new message
        const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
        
        if (isNearBottom || messages.length <= messagesLimit) {
            setTimeout(() => {
                if (chatRef.current) {
                    chatRef.current.scrollTop = chatRef.current.scrollHeight;
                }
            }, 100);
        }
    }
}, [selectedContact, messages.length]); // Changed dependency to messages.length


useEffect(() => {     
    const messagesContainer = chatRef.current;
    if (!messagesContainer || !selectedContact) return;

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        const topThreshold = 200; // Increased threshold for better UX

        // Only trigger when user is genuinely scrolling up, not during loading
        const isNearTop = scrollTop <= topThreshold;

        if (isNearTop && hasMoreMessages && !isLoadingOlderMessages) {
            console.log('🔄 Auto-loading older messages');
            loadMoreMessages();
        }
    };

    // Debounce scroll events to prevent excessive calls
    let scrollTimer: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(handleScroll, 100);
    };

    messagesContainer.addEventListener('scroll', debouncedHandleScroll);

    return () => {
        messagesContainer.removeEventListener('scroll', debouncedHandleScroll);
        clearTimeout(scrollTimer);
    };
}, [selectedContact, hasMoreMessages, isLoadingOlderMessages]);



// Function to invalidate caches when new messages arrive
const invalidateMessageCache = (contactId: string) => {
    const me = getMy10DigitNumber();
    const keysToRemove: string[] = [];
    
    messagesCacheTime.forEach((_, key) => {
        if (key.includes(`${me}-${contactId}`)) {
            keysToRemove.push(key);
        }
    });
    
    keysToRemove.forEach(key => {
        messagesCache.delete(key);
        messagesCacheTime.delete(key);
    });
    
    messagesCache.clear();
    messagesCacheTime.clear();
};
// Keep your existing loadMoreMessages function unchanged
// const loadMessages = async (me: string, them: string, offset: number, isInitial: boolean = false) => {
//     try {
//         if (!isInitial) setIsLoadingOlderMessages(true);

//         // Store scroll position for pagination
//         const messagesContainer = chatRef.current;
//         const previousScrollHeight = messagesContainer?.scrollHeight || 0;
//         const previousScrollTop = messagesContainer?.scrollTop || 0;

//         console.log(`📨 Loading messages - Me: ${me}, Them: ${them}, Offset: ${offset}, IsInitial: ${isInitial}`);

//         const response = await fetch('https://bkpmanual.bitnexdial.com/sms-history', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 number: me,
//                 contact: them,
//                 limit: messagesLimit,
//                 offset: offset
//             })
//         });

//         const result = await response.json();

//         // Handle response format
//         let messages, hasMore;

//         if (Array.isArray(result)) {
//             messages = result;
//             hasMore = messages.length === messagesLimit;
//         } else if (result.messages) {
//             messages = result.messages;
//             hasMore = result.pagination?.hasMore || false;
//         } else {
//             console.error('❌ Unexpected API response format:', result);
//             setHasMoreMessages(false);
//             return;
//         }

//         if (messages) {
//             // Process messages with direction
//             const messagesWithDirection = messages.map((m: SMS) => ({
//                 ...m,
//                 direction: (m.sender.replace(/\D/g, '').replace(/^1/, '') === me) ? 'outbound' : 'inbound'
//             }));

//             console.log(`📦 Loaded ${messagesWithDirection.length} messages for offset ${offset}`);

//             if (isInitial) {
//                 // For initial load, reverse to show newest first
//                 setMessages(messagesWithDirection.reverse());
//                 setMessagesOffset(messagesLimit);
                
//                 // Scroll to bottom only for initial load
//                 requestAnimationFrame(() => {
//                     setTimeout(() => {
//                         if (chatRef.current) {
//                             chatRef.current.scrollTop = chatRef.current.scrollHeight;
//                         }
//                     }, 50);
//                 });
//             } else {
//                 // For pagination, prepend older messages
//                 const olderMessages = messagesWithDirection.reverse();
//                 setMessages(prev => [...olderMessages, ...prev]);
//                 setMessagesOffset(prev => prev + messagesLimit);

//                 // Restore scroll position for pagination
//                 requestAnimationFrame(() => {
//                     requestAnimationFrame(() => {
//                         if (messagesContainer) {
//                             const newScrollHeight = messagesContainer.scrollHeight;
//                             const heightDifference = newScrollHeight - previousScrollHeight;
//                             messagesContainer.scrollTop = previousScrollTop + heightDifference;
//                         }
//                     });
//                 });
//             }

//             setHasMoreMessages(hasMore);
//             console.log(`📊 Pagination state - HasMore: ${hasMore}`);
//         } else {
//             console.error('❌ No messages found in API response:', result);
//             setHasMoreMessages(false);
//         }
//     } catch (error) {
//         console.error('❌ Error loading messages:', error);
//         setHasMoreMessages(false);
//     } finally {
//         if (!isInitial) setIsLoadingOlderMessages(false);
//     }
    // };
    
    const loadMessages = async (
        meRaw: string,
        themRaw: string,
        offset: number,
        isInitial: boolean = false,
        contactIdForStorage?: string
    ) => {
        // ==== Added: consistent normalization (non-breaking) ====
        const me = normalizePhoneNumber(meRaw);
        const them = normalizePhoneNumber(themRaw);

        // helper: keep only messages between me & them
        const isBetweenParticipants = (msg: SMS) => {
            const s = normalizePhoneNumber(msg.sender);
            const r = normalizePhoneNumber(msg.receiver);
            return (
                (s === me && r === them) ||
                (s === them && r === me)
            );
        };

        // helper: within-batch dedupe (≤5s, same body & participants)
        const dedupeBatch = (arr: SMS[]) => {
            const out: SMS[] = [];
            for (const m of arr) {
                const mT = new Date(m.tx_rx_datetime).getTime();
                const mS = normalizePhoneNumber(m.sender);
                const mR = normalizePhoneNumber(m.receiver);
                let dup = false;
                for (const x of out) {
                    if (
                        x.body === m.body &&
                        Math.abs(new Date(x.tx_rx_datetime).getTime() - mT) < 5000 &&
                        normalizePhoneNumber(x.sender) === mS &&
                        normalizePhoneNumber(x.receiver) === mR
                    ) {
                        dup = true;
                        break;
                    }
                }
                if (!dup) out.push(m);
            }
            return out;
        };

        // helper: cross-page dedupe key (stable, non-breaking)
        const crossKey = (m: SMS) => {
            const bucket5s = Math.floor(new Date(m.tx_rx_datetime).getTime() / 5000);
            const s = normalizePhoneNumber(m.sender);
            const r = normalizePhoneNumber(m.receiver);
            return `${s}->${r}|${m.body}|${bucket5s}`;
        };

        try {
            // ==== PRESERVED: loading flag ====
            if (!isInitial) setIsLoadingOlderMessages(true);

            // ==== PRESERVED: scroll bookkeeping ====
            const messagesContainer = chatRef.current;
            const prevScrollHeight = messagesContainer?.scrollHeight || 0;
            const prevScrollTop = messagesContainer?.scrollTop || 0;

            console.log(`📨 Loading messages - Me: ${me}, Them: ${them}, Offset: ${offset}, IsInitial: ${isInitial}`);

            // ==== PRESERVED: API and payload shape handling ====
            const response = await fetch('https://bkpmanual.bitnexdial.com/sms-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: me,
                    contact: them,
                    limit: messagesLimit,
                    offset
                })
            });
            const result = await response.json();

            let messages: SMS[] | undefined;
            let hasMore = false;

            if (Array.isArray(result)) {
                messages = result;
                hasMore = messages.length === messagesLimit;
            } else if (result?.messages) {
                messages = result.messages;
                hasMore = !!result.pagination?.hasMore;
            } else {
                console.error('❌ Unexpected API response format:', result);
                setHasMoreMessages(false);
                return;
            }

            if (!messages) {
                console.error('❌ No messages found in API response:', result);
                setHasMoreMessages(false);
                return;
            }

            // ==== Added: filter strictly to the two participants ====
            const filtered = messages.filter(isBetweenParticipants);

            // ==== Added: dedupe within this batch ====
            const batchUnique = dedupeBatch(filtered);

            // ==== PRESERVED (but with normalized sender): direction ====
            const withDirection = batchUnique.map((m) => {
                const sNorm = normalizePhoneNumber(m.sender);
                return { ...m, direction: sNorm === me ? 'outbound' : 'inbound' } as SMS;
            });

            console.log(`📦 Loaded ${withDirection.length} messages for offset ${offset} (after filter+dedupe)`);

            if (isInitial) {
                // ==== PRESERVED: reverse for newest-last UI on initial ====
                const initialOrdered = [...withDirection].reverse();

                // ==== PRESERVED: localStorage write (compatible key) ====
                try {
                    const key = (contactIdForStorage ?? selectedContact?.id ?? them) + '-stream';
                    localStorage.setItem(key, JSON.stringify({ DataCollection: initialOrdered }));
                } catch (e) {
                    console.warn('LocalStorage save failed:', e);
                }

                // ==== PRESERVED: set messages, offset, scroll to bottom ====
                setMessages(initialOrdered);
                setMessagesOffset(messagesLimit);

                requestAnimationFrame(() => {
                    setTimeout(() => {
                        if (chatRef.current) {
                            chatRef.current.scrollTop = chatRef.current.scrollHeight;
                        }
                    }, 50);
                });
            } else {
                // ==== PRESERVED: prepend older messages (reverse first) ====
                const olderOrdered = [...withDirection].reverse();

                // ==== Added: cross-page dedupe without changing ordering semantics ====
                setMessages((prev) => {
                    const merged = [...olderOrdered, ...prev];
                    const seen: Record<string, true> = {};
                    const final: SMS[] = [];
                    for (const m of merged) {
                        const k = crossKey(m);
                        if (!seen[k]) {
                            seen[k] = true;
                            final.push(m);
                        }
                    }
                    return final;
                });

                setMessagesOffset((prev) => prev + messagesLimit);

                // ==== PRESERVED: maintain scroll position ====
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        if (messagesContainer) {
                            const newScrollHeight = messagesContainer.scrollHeight;
                            const diff = newScrollHeight - prevScrollHeight;
                            messagesContainer.scrollTop = prevScrollTop + diff;
                        }
                    }, 50);
                });
            }

            // ==== PRESERVED: pagination flag ====
            setHasMoreMessages(hasMore);
            console.log(`📊 Pagination state - HasMore: ${hasMore}`);

        } catch (error) {
            console.error('❌ Error loading messages:', error);
            setHasMoreMessages(false);
        } finally {
            // ==== PRESERVED: loading flag reset ====
            if (!isInitial) setIsLoadingOlderMessages(false);
        }
    };

// const loadMoreMessages = () => {
//     if (!selectedContact || isLoadingOlderMessages || !hasMoreMessages) {
//         console.log('⚠️ Cannot load more messages:', {
//             selectedContact: !!selectedContact,
//             isLoading: isLoadingOlderMessages,
//             hasMore: hasMoreMessages
//         });
//         return;
//     }

//     const raw = localStorage.getItem('myPhoneNumber') || '';
//     const me = raw.replace(/\D/g, '').replace(/^1/, '');
//     const them = selectedContact.id;

//     console.log(`🔄 Loading more messages - Current offset: ${messagesOffset}`);
//     loadMessages(me, them, messagesOffset, false);
// };

// Keep your existing useEffect unchanged


    // Function to load contact pages
// Function to load contact pages
// Function to load contact pages

    
    
    
    const loadMoreMessages = () => {
        if (!selectedContact || isLoadingOlderMessages || !hasMoreMessages) {
            console.log('⚠️ Cannot load more messages:', {
                selectedContact: !!selectedContact,
                isLoading: isLoadingOlderMessages,
                hasMore: hasMoreMessages
            });
            return;
        }

        // ✅ Keep normalization consistent with loadMessages/useEffect
        const raw = localStorage.getItem('myPhoneNumber') || '';
        const me = normalizePhoneNumber(raw);
        const them = normalizePhoneNumber(selectedContact.id);

        console.log(`🔄 Loading more messages - Current offset: ${messagesOffset}`, { me, them });

        // Optional 5th arg keeps your localStorage keying consistent (harmless during pagination)
        loadMessages(me, them, messagesOffset, false, selectedContact.id);
    };
    
    
    
    
    
    const loadContactPage = async (userNumber: string, page: number, isFirstLoad: boolean = false, contactsData: Contact[] = []) => {
    if (isLoadingContacts) return;

    // Check cache first - FIXED LOGIC
    const cacheKey = `${userNumber}-${page}`;
    const cachedContacts = contactsCache.get(cacheKey);
    const cacheTime = contactsCacheTime.get(cacheKey) || 0;
    const now = Date.now();

    // Use cache if available and not expired - FIXED: removed !isFirstLoad condition
    if (cachedContacts && (now - cacheTime) < CACHE_DURATION) {
        console.log(`📋 Using cached contacts for page ${page + 1}`);
        
        if (isFirstLoad) {
            setContactList(cachedContacts);
        } else {
            setContactList(prev => {
                const existingIds = new Set(prev.map(c => c.id));
                const newContacts = cachedContacts.filter(c => !existingIds.has(c.id));
                return [...prev, ...newContacts];
            });
        }
        
        setContactsCurrentPage(page);
        setHasMoreContacts(cachedContacts.length === contactsPerPage); // Set pagination state
        return; // Exit early - no API call needed
    }

    // Continue with API call only if cache miss...
    setIsLoadingContacts(true);
    const offset = page * contactsPerPage;

    try {
        console.log(`🔥 Loading contacts page ${page + 1} (offset: ${offset})`);

        const response = await fetch('https://bkpmanual.bitnexdial.com/sms-latest-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: userNumber,
                limit: contactsPerPage,
                offset
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            console.error('❌ Error loading contacts:', result.error);
            return;
        }

        let conversations, total, hasMore;

        if (result.isPaginated) {
            conversations = result.conversations;
            total = result.total;
            hasMore = result.hasMore;
        } else {
            conversations = Array.isArray(result) ? result : [];
            total = conversations.length;
            hasMore = false;
        }

        console.log(`📦 Loaded ${conversations.length} contacts (page ${page + 1})`);

        if (conversations.length === 0 && isFirstLoad) {
            console.log("🔭 No conversations found");
            setContactList([]);
            setHasMoreContacts(false);
            setIsLoadingContacts(false);
            return;
        }

        const normalizedMe = normalizePhoneNumber(userNumber);
        
        // Create a Map for O(1) contact lookups
        const contactMap = new Map(
            contactsData.map(contact => [normalizePhoneNumber(contact.id), contact])
        );

        // Process contacts with Map lookup
        const processedContacts = conversations.map((row: any) => {
            const normalizedSender = normalizePhoneNumber(row.sender);
            const normalizedReceiver = normalizePhoneNumber(row.receiver);
            const normalizedOther = normalizedSender === normalizedMe ? normalizedReceiver : normalizedSender;

            const saved = contactMap.get(normalizedOther);

            return {
                id: normalizedOther,
                phone: formatPhone(normalizedOther),
                name: saved ? saved.name : formatPhone(normalizedOther),
                hasUnread: false,
                unreadCount: 0,
                lastMessage: row.body,
                lastMessageDate: row.tx_rx_datetime,
                lastMessageTime: new Date(row.tx_rx_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isFavorite: favoriteContacts.has(normalizedOther)
            };
        });

        // Remove duplicates using Set
        const seen = new Set<string>();
        const uniqueContacts = processedContacts.filter((contact: Contact) => {
            if (seen.has(contact.id)) return false;
            seen.add(contact.id);
            return true;
        });

        // Cache the results
        updateContactsCache(cacheKey, uniqueContacts);

        // Update favorites
        const favoritesFromData = new Set<string>();
        uniqueContacts.forEach((contact: Contact) => {
            if (contact.isFavorite) {
                favoritesFromData.add(contact.id);
            }
        });
        setFavoriteContacts(favoritesFromData);

        if (isFirstLoad) {
            setContactList(uniqueContacts);

            // Merge with persistent data if available
            const persistentContactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
            if (persistentContactList.length > 0) {
                const persistentMap = new Map<string, Contact>(
                    persistentContactList.map((pc: Contact) => [normalizePhoneNumber(pc.id), pc])
                );

                const mergedContacts = uniqueContacts.map((contact: Contact) => {
                    const persistentContact = persistentMap.get(normalizePhoneNumber(contact.id));
                    
                    if (persistentContact) {
                        return {
                            ...contact,
                            hasUnread: persistentContact.hasUnread || false,
                            unreadCount: persistentContact.unreadCount || 0,
                            lastMessage: persistentContact.lastMessage || contact.lastMessage,
                            lastMessageDate: persistentContact.lastMessageDate || contact.lastMessageDate,
                            lastMessageTime: persistentContact.lastMessageTime || contact.lastMessageTime,
                            isFavorite: contact.isFavorite
                        };
                    }
                    return contact;
                });
                setContactList(mergedContacts);
                console.log("📦 Merged contacts with persistent data");
            }
        } else {
            // For pagination, filter duplicates
            setContactList(prevContacts => {
                const existingIds = new Set(prevContacts.map((contact: Contact) => contact.id));
                const newContacts = uniqueContacts.filter((contact: Contact) => !existingIds.has(contact.id));

                console.log(`📦 Adding ${newContacts.length} new contacts (filtered ${uniqueContacts.length - newContacts.length} duplicates)`);

                return [...prevContacts, ...newContacts];
            });
        }

        setContactsCurrentPage(page);
        setHasMoreContacts(hasMore);
        setTotalContacts(total);

    } catch (error) {
        console.error('❌ Error loading contact page:', error);

        if (isFirstLoad) {
            const persistentContactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
            if (persistentContactList.length > 0) {
                console.log("📦 Loading from persistent contact list as fallback");
                setContactList(persistentContactList);
            }
        }
    } finally {
        setIsLoadingContacts(false);
    }
    if (isFirstLoad) {
    setHasLoadedContactsOnce(true);
    }
};


    // Function to load more contacts
const loadMoreContacts = () => {
    if (!hasMoreContacts || isLoadingContacts) {
        console.log('Cannot load more contacts:', {
            hasMore: hasMoreContacts,
            isLoading: isLoadingContacts
        });
        return;
    }

    const raw = localStorage.getItem('myPhoneNumber') || '';
    const nextPage = contactsCurrentPage + 1;

    console.log(`Loading more contacts - Next page: ${nextPage}`);
    loadContactPage(raw, nextPage, false, savedContacts);
};
    ////////////////////////////////////////
    useEffect(() => {
    // This will only run on the client side
    const raw = localStorage.getItem("myPhoneNumber") || "";
    setMyPhoneNumber(normalizePhoneNumber(raw));
    }, []);
    // Add this useEffect to listen for toast events
    useEffect(() => {
        const handleToast = (event: CustomEvent) => {
            const { message, type, duration = 3000 } = event.detail;
            setToast({ message, type, show: true });

            setTimeout(() => {
                setToast(null);
            }, duration);
        };

        window.addEventListener('showToast', handleToast as EventListener);

        return () => {
            window.removeEventListener('showToast', handleToast as EventListener);
        };
    }, []);


    useEffect(() => {
        if (selectedContact) {
            markAsRead();
        }
    }, [selectedContact]);

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [selectedContact, messages]); // updated 02-07-2025 Wednesday

    // Add these utility functions after formatDuration
    const getSessionState = (lineNumber: number): SessionState => {
        try {
            if (window.FindLineByNumber && typeof window.FindLineByNumber === 'function') {
                const lineObj = window.FindLineByNumber(lineNumber);
                if (lineObj && lineObj.SipSession) {
                    return {
                        isOnHold: lineObj.SipSession.isOnHold || false,
                        isMuted: lineObj.SipSession.data?.ismute || false,
                        isConnected: ['connecting', 'connected', 'confirmed', 'established', 'early'].includes(lineObj.SipSession.status),
                        lineNumber: lineNumber
                    };
                }
            }

            if (window.Lines && Array.isArray(window.Lines) && lineNumber < window.Lines.length) {
                const line = window.Lines[lineNumber];
                if (line && line.SipSession) {
                    return {
                        isOnHold: line.SipSession.isOnHold || false,
                        isMuted: line.SipSession.data?.ismute || false,
                        isConnected: ['connecting', 'connected', 'confirmed', 'established'].includes(line.SipSession.status),
                        lineNumber: lineNumber
                    };
                }
            }
        } catch (error) {
            console.error('Error getting session state:', error);
        }

        return {
            isOnHold: false,
            isMuted: false,
            isConnected: true,
            lineNumber: lineNumber
        };
    };

    const syncSessionState = () => {
        try {
            const lineNumber = getCurrentLineNumber();
            const sessionState = getSessionState(lineNumber);

            setCallControls(prev => ({
                ...prev,
                isOnHold: sessionState.isOnHold,
                isMuted: sessionState.isMuted
            }));

            console.log('Session state synced:', sessionState);
        } catch (error) {
            console.error('Error syncing session state:', error);
        }
    };

    const getCurrentLineNumber = (): number => {
        if (window.getActiveLineNum && typeof window.getActiveLineNum === "function") {
            try {
                const activeLineNum = window.getActiveLineNum();
                if (typeof activeLineNum === "number" && activeLineNum >= 0) {
                    return activeLineNum;
                }
            } catch (error) {
                console.warn('getActiveLineNum failed:', error);
            }
        }

        if (window.Lines && Array.isArray(window.Lines)) {
            for (let i = 0; i < window.Lines.length; i++) {
                const line = window.Lines[i];
                if (line && line.SipSession &&
                    ['connecting', 'connected', 'ringing', 'calling', 'progress', 'confirmed', 'established'].includes(line.SipSession.status)) {
                    return i;
                }
            }
        }

        return 1;
    };

    // Delete functionality functions
const handleDeleteConversation = async () => {
    if (!selectedContact) return;

    try {
        const myNumber = getMy10DigitNumber();
        const response = await fetch('https://bkpmanual.bitnexdial.com/api/delete-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myPhoneNumber: myNumber,
                targetNumber: selectedContact.id
            })
        });

        const result = await response.json();

        if (result.success) {
            const contactId = normalizePhoneNumber(selectedContact.id);
            
            // 1. Clear messages and remove from contact list
            setMessages([]);
            setContactList(prev => prev.filter(contact => 
                normalizePhoneNumber(contact.id) !== contactId
            ));
            setSelectedContact(null);

            // 2. Clear from persistent localStorage
            const persistentContactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
            const updatedPersistentList = persistentContactList.filter((contact: Contact) => 
                normalizePhoneNumber(contact.id) !== contactId
            );
            localStorage.setItem('persistentContactList', JSON.stringify(updatedPersistentList));

            // 3. Clear all related cache entries
            const keysToRemove: string[] = [];
            
            // Clear contacts cache
            contactsCache.forEach((_, key) => {
                if (key.includes(myNumber)) {
                    keysToRemove.push(key);
                }
            });
            
            keysToRemove.forEach(key => {
                contactsCache.delete(key);
                contactsCacheTime.delete(key);
            });

            // Clear messages cache for this contact
            messagesCache.forEach((_, key) => {
                if (key.includes(`${myNumber}-${contactId}`) || key.includes(`${contactId}-${myNumber}`)) {
                    messagesCache.delete(key);
                    messagesCacheTime.delete(key);
                }
            });

            // 4. Update localStorage cache
            saveToLocalStorage('contactsCache', contactsCache);
            saveToLocalStorage('contactsCacheTime', contactsCacheTime);
            saveToLocalStorage('messagesCache', messagesCache);
            saveToLocalStorage('messagesCacheTime', messagesCacheTime);

            // 5. Remove from favorites if it was favorited
            setFavoriteContacts(prev => {
                const newFavorites = new Set(prev);
                newFavorites.delete(contactId);
                return newFavorites;
            });

            // 6. Clear from hasLoadedMessagesFor set
            setHasLoadedMessagesFor(prev => {
                const newSet = new Set(prev);
                newSet.delete(contactId);
                return newSet;
            });

            console.log(`✅ Deleted conversation with ${selectedContact.name} and cleared all cache`);
            
            // 7. Show success message
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: 'Conversation deleted successfully',
                        type: 'success',
                        duration: 2000
                    }
                }));
            }
            
        } else {
            console.error('❌ Failed to delete conversation:', result.error);
            // Show error message
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: 'Failed to delete conversation',
                        type: 'error',
                        duration: 3000
                    }
                }));
            }
        }
    } catch (error) {
        console.error('❌ Error deleting conversation:', error);
        // Show error message
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: 'Network error while deleting conversation',
                    type: 'error',
                    duration: 3000
                }
            }));
        }
    }
    setShowDeleteConversationAlert(false);
};

    const handleSingleMessageDelete = async () => {
        if (!messageToDelete) return;

        try {
            // We need to get the actual message ID from the database
            // Since your SMS table should have an 'id' field, we need to track it
            const messageId = messageToDelete.message.id; // Assuming your SMS interface has an id field

            if (!messageId) {
                console.error('❌ No message ID available');
                return;
            }

            const response = await fetch('https://bkpmanual.bitnexdial.com/api/delete-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageIds: [messageId],
                    deleteType: "forMe"
                })
            });

            const result = await response.json();

            if (result.success) {
                // Remove the specific message from UI
                setMessages(prev => prev.filter((_, index) => index !== messageToDelete.index));
                console.log(`✅ Deleted message with ID: ${messageId}`);
            } else {
                console.error('❌ Failed to delete message:', result.error);
            }
        } catch (error) {
            console.error('❌ Error deleting message:', error);
        }

        setShowSingleMessageDeleteAlert(false);
        setMessageToDelete(null);
    };


// Add this useEffect to sync favorites with contact list
useEffect(() => {
    if (favoriteContacts.size > 0 && contactList.length > 0) {
        console.log('Syncing favorites with contact list');
        
        setContactList(prevContacts => 
            prevContacts.map(contact => ({
                ...contact,
                isFavorite: favoriteContacts.has(normalizePhoneNumber(contact.id))
            }))
        );
    }
}, [favoriteContacts]); // Only trigger when favoriteContacts changes






    // Add these state variables after your existing state declarations
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        messageIndex: number;
        message: SMS;
    } | null>(null);

    // Add this copy function
    const copyMessageText = (messageBody: string) => {
        // Strip HTML tags from the message body
        const textContent = messageBody.replace(/<[^>]*>/g, '');

        // Use the Clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textContent).then(() => {
                console.log('✅ Message copied to clipboard');
                // Optionally show a toast/notification
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('showToast', {
                        detail: {
                            message: 'Message copied to clipboard',
                            type: 'success',
                            duration: 2000
                        }
                    }));
                }
            }).catch(err => {
                console.error('❌ Failed to copy message:', err);
                fallbackCopyText(textContent);
            });
        } else {
            // Fallback for older browsers
            fallbackCopyText(textContent);
        }
    };

    // Fallback copy function for older browsers
    const fallbackCopyText = (text: string) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                console.log('✅ Message copied to clipboard (fallback)');
            } else {
                console.error('❌ Failed to copy message (fallback)');
            }
        } catch (err) {
            console.error('❌ Copy command failed:', err);
        }

        document.body.removeChild(textArea);
    };

    // Add this context menu handler
    const handleContextMenu = (e: React.MouseEvent, messageIndex: number, message: SMS) => {
        e.preventDefault();

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            messageIndex,
            message
        });
    };

    // Add this to close context menu
    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Handle context menu actions
    const handleContextMenuAction = (action: 'copy' | 'delete') => {
        if (!contextMenu) return;

        if (action === 'copy') {
            copyMessageText(contextMenu.message.body);
        } else if (action === 'delete') {
            setMessageToDelete({
                index: contextMenu.messageIndex,
                message: contextMenu.message
            });
            setShowSingleMessageDeleteAlert(true);
        }

        closeContextMenu();
    };

    // Add this useEffect to close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu) {
                closeContextMenu();
            }
        };

        if (contextMenu?.show) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('contextmenu', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('contextmenu', handleClickOutside);
        };
    }, [contextMenu]);

// Add this new useEffect for real-time message updates when viewing a conversation
// Replace the existing useEffect for real-time message updates with this enhanced version

useEffect(() => {
    const handleGlobalSMSUpdate = (event: CustomEvent) => {
        const { contactId, message, fromNumber, timestamp, mediaUrl } = event.detail;
        const myNumber = getMy10DigitNumber();

        console.log('📨 Global SMS received in text interface:', { contactId, fromNumber });

        // Add to current conversation if selected
        if (selectedContact && normalizePhoneNumber(selectedContact.id) === contactId) {
            const newMessage: SMS = {
                tx_rx_datetime: timestamp || new Date().toISOString(),
                sender: fromNumber,
                receiver: myNumber,
                body: message,
                direction: (normalizePhoneNumber(fromNumber) === normalizePhoneNumber(myNumber))
                    ? 'outbound'
                    : 'inbound',
                mediaUrl: mediaUrl || null
            };

            console.log('🔥 Adding new message to current conversation:', newMessage);

            setMessages(prevMessages => [...prevMessages, newMessage]);
            invalidateMessageCache(contactId);
            setNewMessageIndicator(true);

            setTimeout(() => {
                if (chatRef.current) {
                    chatRef.current.scrollTop = chatRef.current.scrollHeight;
                }
            }, 100);
        }

        // Update contact list - optimized with batch updates
        setContactList(prevContacts => {
            const isCurrentlySelected = selectedContact && 
                normalizePhoneNumber(selectedContact.id) === contactId;

            const updatedContacts = prevContacts.map((contact: Contact) => {
                if (normalizePhoneNumber(contact.id) !== contactId) return contact;

                const baseUpdate = {
                    lastMessage: message,
                    lastMessageDate: timestamp || new Date().toISOString(),
                    lastMessageTime: new Date(timestamp || Date.now()).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                };

                if (!isCurrentlySelected) {
                    return {
                        ...contact,
                        ...baseUpdate,
                        hasUnread: true,
                        unreadCount: (contact.unreadCount || 0) + 1
                    };
                } else {
                    return {
                        ...contact,
                        ...baseUpdate
                    };
                }
            });

            // Check if contact exists, if not add it
            const contactExists = updatedContacts.some((contact: Contact) =>
                normalizePhoneNumber(contact.id) === contactId
            );

            if (!contactExists) {
                const newContact: Contact = {
                    id: contactId,
                    phone: formatPhone(contactId),
                    name: formatPhone(contactId),
                    hasUnread: true,
                    unreadCount: 1,
                    lastMessage: message,
                    lastMessageDate: timestamp || new Date().toISOString(),
                    lastMessageTime: new Date(timestamp || Date.now()).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    isFavorite: false
                };

                console.log('🆕 Adding new contact for incoming SMS:', newContact);
                updatedContacts.unshift(newContact);
            }

            // Sort contacts efficiently
            const sortedContacts = updatedContacts.sort((a: Contact, b: Contact) => {
                // Sort favorites first
                if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
                // Then unread
                if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
                // Finally by date
                if (a.lastMessageDate && b.lastMessageDate) {
                    return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
                }
                if (a.lastMessageDate !== b.lastMessageDate) return a.lastMessageDate ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            // Persist updated list
            localStorage.setItem('persistentContactList', JSON.stringify(sortedContacts));

            return sortedContacts;
        });
    };

    window.addEventListener('globalSMSReceived', handleGlobalSMSUpdate as EventListener);

    return () => {
        window.removeEventListener('globalSMSReceived', handleGlobalSMSUpdate as EventListener);
    };
}, [selectedContact, getMy10DigitNumber]);


    const handleMessageLongPress = (messageIndex: number, message: SMS) => {
        setMessageToDelete({ index: messageIndex, message });
        setShowSingleMessageDeleteAlert(true);
    };

    const handleMessageClick = (messageIndex: number, message: SMS) => {
        // Only handle click if it's not a text selection and not a long press
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;
        
        if (!isLongPress && !hasSelection && !isDragging) {
            // Regular click - toggle selection if in select mode
            if (isMessageSelectMode) {
                toggleMessageSelection(messageIndex);
            }
        }
        setIsLongPress(false);
    };

const handleMouseDown = (e: React.MouseEvent, messageIndex: number, message: SMS) => {
    setIsLongPress(false);
    setIsDragging(false);
    setDragStartTime(Date.now());
    setMouseStartPos({ x: e.clientX, y: e.clientY });
    
    const timer = setTimeout(() => {
        if (!isDragging) {
            setIsLongPress(true);
            handleMessageLongPress(messageIndex, message);
        }
    }, 800);
    setLongPressTimer(timer);
};

const handleMouseMove = (e: React.MouseEvent) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - dragStartTime;
    const mouseDiff = Math.abs(e.clientX - mouseStartPos.x) + Math.abs(e.clientY - mouseStartPos.y);
    
    // If mouse moved more than 5 pixels OR it's been more than 100ms and mouse moved
    if (mouseDiff > 5 || (timeDiff > 100 && mouseDiff > 2)) {
        setIsDragging(true);
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    }
};

const handleMouseUp = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
    }
    // Don't reset dragging immediately, let the selection persist
    // Only reset after a longer delay if there's no selection
    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
            setIsDragging(false);
        }
    }, 200);
};

const handleTouchStart = (messageIndex: number, message: SMS) => {
    setIsLongPress(false);
    setIsDragging(false);
    
    const timer = setTimeout(() => {
        if (!isDragging) {
            setIsLongPress(true);
            handleMessageLongPress(messageIndex, message);
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }, 800);
    setLongPressTimer(timer);
};

const handleTouchMove = () => {
    setIsDragging(true);
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
    }
};

const handleTouchEnd = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
    }
    setTimeout(() => setIsDragging(false), 50);
};


    // Update the existing toggleMessageSelection function to work with actual message IDs
    const toggleMessageSelection = (messageIndex: number) => {
        const newSelected = new Set(selectedMessages);
        if (newSelected.has(messageIndex)) {
            newSelected.delete(messageIndex);
        } else {
            newSelected.add(messageIndex);
        }
        setSelectedMessages(newSelected);
    };

    const toggleMessageSelectMode = () => {
        setIsMessageSelectMode(!isMessageSelectMode);
        setSelectedMessages(new Set());
    };

    // Update the delete selected messages function
    const handleDeleteSelectedMessages = async () => {
        if (selectedMessages.size === 0) return;

        try {
            // Convert indices to actual message IDs if your messages have IDs
            // For now, using indices - you may need to modify this based on your message structure
            const messageIds = Array.from(selectedMessages);

            const response = await fetch('https://bkpmanual.bitnexdial.com/api/delete-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageIds,
                    deleteType: "forMe"
                })
            });

            const result = await response.json();

            if (result.success) {
                // Remove deleted messages from UI (sort indices in descending order to avoid index shifting issues)
                const sortedIndices = Array.from(selectedMessages).sort((a, b) => b - a);
                setMessages(prev => {
                    const newMessages = [...prev];
                    sortedIndices.forEach(index => {
                        newMessages.splice(index, 1);
                    });
                    return newMessages;
                });

                setSelectedMessages(new Set());
                setIsMessageSelectMode(false);

                console.log(`✅ Deleted ${result.deletedCount} messages`);
            } else {
                console.error('❌ Failed to delete messages:', result.error);
            }
        } catch (error) {
            console.error('❌ Error deleting messages:', error);
        }
        setShowDeleteMessagesAlert(false);
    };

    // Add after handleSendMessage function
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                // showAlertMessage('File size must be less than 10MB', 'error');
                return;
            }

            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
            if (!allowedTypes.includes(file.type)) {
                // showAlertMessage('Unsupported file type. Please select an image, PDF, or text file.', 'error');
                return;
            }

            setSelectedFile(file);
        }
    };


    // Utility function to check if a URL is an image
    // Utility function to check if a URL is an image
    const isImageUrl = (url: string): boolean => {
        if (!url || typeof url !== 'string') return false;

        // Remove query parameters for extension check
        const cleanUrl = url.split('?')[0].toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)$/i.test(cleanUrl);
    };

    // Utility function to check if a URL is a video
    const isVideoUrl = (url: string): boolean => {
        return /\.(mp4|webm|ogg|mov|avi|wmv)(\?.*)?$/i.test(url);
    };


    // Utility function to get file name from URL
    const getFileName = (url: string): string => {
        return url.split('/').pop()?.split('?')[0] || 'file';
    };

    // Component to render media content

 const MediaContent: React.FC<{ Data: any; message: any; isMine: boolean }> = ({ Data, message, isMine }) => {

    // Direct media URL from props
    let mediaUrl = Data?.mediaUrl || '';

    // Extract image tag src
    const imgTagMatch = message?.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const urlMatch = message?.match(/(https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|gif|webp))/i);

    let textContent = message;

    // Handle embedded <img src="">
    if (!mediaUrl && imgTagMatch) {
        mediaUrl = imgTagMatch[1];
        textContent = message.replace(imgTagMatch[0], '').trim();
    }

    // Handle direct image URL
    else if (!mediaUrl && urlMatch) {
        mediaUrl = urlMatch[1];
        textContent = message.replace(mediaUrl, '').trim();
    }

    return (
        <div className="space-y-2">
            {/* Render text if exists */}
            {textContent && textContent !== '<br>' && (
                <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: textContent }}
                />
            )}

            {/* Render image if available */}
            {mediaUrl && (
                <div className="mt-2">
                    <img
                        src={mediaUrl}
                        alt="Media"
                        className="max-w-xs max-h-60 rounded-lg shadow cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                            window.PreviewImage?.(
                                Object.assign(document.createElement('img'), { src: mediaUrl })
                            )
                        }
                        onError={(e) => {
                            const imgEl = e.target as HTMLImageElement;
                            imgEl.style.display = 'none';

                            const fileLink = document.createElement('a');
                            fileLink.href = mediaUrl;
                            fileLink.target = '_blank';
                            fileLink.className = 'text-blue-500 underline text-sm';
                            fileLink.textContent = `📁 ${mediaUrl.split('/').pop() || 'file'}`;
                            imgEl.parentNode?.appendChild(fileLink);
                        }}
                    />
                </div>
            )}
        </div>

    );
};









    // const handleSendFile = async () => {
    //     if (!selectedFile || !selectedContact) return;

    //     setIsUploading(true);
    //     setUploadProgress(0);

    //     try {
    //         const me10 = getMy10DigitNumber();
    //         const to = selectedContact.id;

    //         const formData = new FormData();
    //         formData.append('file', selectedFile);
    //         formData.append('sender', me10);
    //         formData.append('receiver', to);
    //         formData.append('body', messageText.trim() || '');

    //         // Upload with progress tracking
    //         const xhr = new XMLHttpRequest();

    //         xhr.upload.addEventListener('progress', (e) => {
    //             if (e.lengthComputable) {
    //                 const progress = Math.round((e.loaded / e.total) * 100);
    //                 setUploadProgress(progress);
    //             }
    //         });

    //         const uploadPromise = new Promise<any>((resolve, reject) => {
    //             xhr.onload = () => {
    //                 if (xhr.status === 200) {
    //                     try {
    //                         const response = JSON.parse(xhr.responseText);
    //                         resolve(response);
    //                     } catch (e) {
    //                         reject(new Error('Invalid response'));
    //                     }
    //                 } else {
    //                     reject(new Error(`Upload failed: ${xhr.status}`));
    //                 }
    //             };
    //             xhr.onerror = () => reject(new Error('Upload failed'));
    //         });

    //         xhr.open('POST', 'https://bkpmanual.bitnexdial.com/upload');
    //         xhr.send(formData);

    //         const response = await uploadPromise;

    //         if (response.success) {
    //             const fileUrl = `https://bkpmanual.bitnexdial.com${response.path}`;

    //             // Create optimistic UI message with proper formatting
    //             let messageBody = '';
    //             if (messageText.trim()) {
    //                 messageBody = messageText.trim() + '<br>';
    //             }

    //             // Add file/image content
    //             if (selectedFile.type.startsWith('image/')) {
    //                 messageBody += `<img class="previewImage" src="${fileUrl}" onclick="PreviewImage(this)">`;
    //             } else {
    //                 messageBody += `<a href="${fileUrl}" target="_blank">${selectedFile.name}</a>`;
    //             }

    //             const fileMessage = {
    //                 tx_rx_datetime: new Date().toISOString(),
    //                 sender: me10,
    //                 receiver: to,
    //                 body: messageBody,
    //                 direction: 'outbound'
    //             };

    //             setMessages(m => [...m, fileMessage]);

    //             // Also send via Twilio if it's an image
    //             if (selectedFile.type.startsWith('image/')) {
    //                 socketRef.current?.emit('send-sms', {
    //                     from: '+1' + me10,
    //                     to,
    //                     message: messageText.trim() || '',
    //                     mediaUrl: fileUrl
    //                 });
    //             }

    //             // Clear inputs
    //             setMessageText('');
    //             setSelectedFile(null);
    //             if (fileInputRef.current) {
    //                 fileInputRef.current.value = '';
    //             }
    //         } else {
    //             throw new Error('Upload failed');
    //         }

    //     } catch (error) {
    //         console.error('File upload error:', error);
    //     } finally {
    //         setIsUploading(false);
    //         setUploadProgress(0);
    //     }
    // };


const handleSendFile = async () => {
  if (!selectedFile || !selectedContact) return;

  setIsUploading(true);
  setUploadProgress(0);

  try {
    const me10 = getMy10DigitNumber();
    const to = selectedContact.id;
    const now = new Date().toISOString();

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('sender', me10);
    formData.append('receiver', to);

    const response: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) =>
        e.lengthComputable && setUploadProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () =>
        xhr.status === 200
          ? resolve(JSON.parse(xhr.responseText))
          : reject(new Error(`Upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', 'https://bkpmanual.bitnexdial.com/upload');
      xhr.send(formData);
    });

    if (!response.success) throw new Error('Upload failed');

    const fileUrl = `https://bkpmanual.bitnexdial.com${response.path}`;
    const fileBody = selectedFile.type.startsWith('image/')
      ? `<img class="previewImage" src="${fileUrl}" onclick="PreviewImage(this)">`
      : `<a href="${fileUrl}" target="_blank">${selectedFile.name}</a>`;

    setMessages((m) => [
      ...m,
      {
        tx_rx_datetime: now,
        sender: me10,
        receiver: to,
        body: fileBody,
        direction: 'outbound',
      },
      ...(messageText.trim()
        ? [{
            tx_rx_datetime: now,
            sender: me10,
            receiver: to,
            body: messageText.trim(),
            direction: 'outbound',
          }]
        : []),
    ]);

    if (selectedFile.type.startsWith('image/')) {
      socketRef.current?.emit('send-sms', {
        from: '+1' + me10,
        to,
        message: messageText.trim() || '',
        mediaUrl: fileUrl,
        alreadySaved: true,
      });
    }

    setMessageText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  } catch (err) {
    console.error('File upload error:', err);
  } finally {
    setIsUploading(false);
    setUploadProgress(0);
  }
};




    const removeSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Call state management
    const [callState, setCallState] = useState<CallState>({
        isActive: false,
        number: '',
        name: '',
        startTime: null,
        status: 'ended'
    });
    const [callDuration, setCallDuration] = useState(0);

    // Alert modal states
    const [showEndCallAlert, setShowEndCallAlert] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showPhoneSystemAlert, setShowPhoneSystemAlert] = useState(false);
    const [showContactSaveAlert, setShowContactSaveAlert] = useState(false);
    const [contactSaveMessage, setContactSaveMessage] = useState('');
    const [newMessageIndicator, setNewMessageIndicator] = useState(false);

    useEffect(() => {
        if (newMessageIndicator) {
            const timer = setTimeout(() => setNewMessageIndicator(false), 1000); //updated 02-07-2025 Wednesday
            return () => clearTimeout(timer);
        }
    }, [newMessageIndicator]);

    // ========================================


    const socketRef = useRef<Socket | null>(null);

useEffect(() => {
    const userNumber = localStorage.getItem("myPhoneNumber") || "";
    
    // FIRST: Check if we have valid cached contacts
    const cacheKey = `${userNumber}-0`;
    const cachedContacts = contactsCache.get(cacheKey);
    const cacheTime = contactsCacheTime.get(cacheKey) || 0;
    const now = Date.now();
    const isCacheValid = cachedContacts && (now - cacheTime) < CACHE_DURATION;

    console.log('Cache check result:', { 
        cacheKey,
        hasCachedContacts: !!cachedContacts, 
        contactsCount: cachedContacts?.length || 0,
        cacheAge: Math.round((now - cacheTime) / 1000),
        isCacheValid,
        willUseCache: isCacheValid
    });

    // Load favorites first, then handle contacts
    const initializeData = async () => {
        // Always load favorites first
        await loadFavoriteContacts();
        
        if (isCacheValid) {
            console.log("USING CACHE - No API calls");
            
            // Set contacts immediately from cache, but merge with favorites
            setContactList(prevContacts => {
                const updatedContacts = cachedContacts.map((contact: Contact) => ({
                    ...contact,
                    isFavorite: favoriteContacts.has(normalizePhoneNumber(contact.id))
                }));
                return updatedContacts;
            });
            
            setHasLoadedContactsOnce(true);
            setContactsCurrentPage(0);
            setHasMoreContacts(cachedContacts.length >= contactsPerPage);
            
            // Load saved contacts in background
            try {
                const response = await fetch(`https://bkpmanual.bitnexdial.com/api/get-contacts?owner=${userNumber.replace(/[^\d]/g, "")}`);
                const contactsData = await response.json();
                
                if (Array.isArray(contactsData)) {
                    const processedContactsData = contactsData.map((row: any, i: number) => ({
                        id: row.contact || `contact-${i}`,
                        phone: row.contact || "",
                        name: typeof row.name === 'string' && row.name.trim() !== ''
                            ? row.name
                            : row.contact,
                        type: row.type || "personal",
                        profileColor: "bg-blue-500",
                    }));
                    setSavedContacts(processedContactsData);
                }
            } catch (error) {
                setSavedContacts([]);
            }
        } else {
            console.log("CACHE MISS - Making API calls");
            
            // Load saved contacts first
            try {
                const response = await fetch(`https://bkpmanual.bitnexdial.com/api/get-contacts?owner=${userNumber.replace(/[^\d]/g, "")}`);
                const contactsData = await response.json();
                
                const processedContactsData = Array.isArray(contactsData)
                    ? contactsData.map((row: any, i: number) => ({
                        id: row.contact || `contact-${i}`,
                        phone: row.contact || "",
                        name: typeof row.name === 'string' && row.name.trim() !== ''
                            ? row.name
                            : row.contact,
                        type: row.type || "personal",
                        profileColor: "bg-blue-500",
                    }))
                    : [];

                setSavedContacts(processedContactsData);
                
                // Now load contact page with the saved contacts data
                loadContactPage(userNumber, 0, true, processedContactsData);
            } catch (error) {
                setSavedContacts([]);
                loadContactPage(userNumber, 0, true, []);
            }
        }
    };

    initializeData();
}, []);



    // Call duration timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callState.isActive && callState.startTime) {
            interval = setInterval(() => {
                const now = new Date();
                const duration = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
                setCallDuration(duration);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState.isActive, callState.startTime]);

    useEffect(() => {
        const checkCallState = () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                const activeLine = window.Lines.find(line =>
                    line && line.SipSession &&
                    ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress'].includes(
                        (line.SipSession.status || '').toLowerCase()
                    )
                );

                if (activeLine && callState.isActive) {
                    // Only update status for existing active calls
                    const newStatus = activeLine.SipSession.status === 'connected' ? 'connected' :
                        activeLine.SipSession.status === 'ringing' ? 'ringing' : 'dialing';

                    if (newStatus !== callState.status) {
                        console.log('📞 Call status changed to:', newStatus);
                        setCallState(prev => ({
                            ...prev,
                            status: newStatus
                        }));
                    }
                } else if (!activeLine && callState.isActive && callState.status !== 'dialing') {
                    // Only end call if it's not in dialing state (prevents premature ending)
                    console.log('📵 Call ended - No active lines found');
                    setCallState({
                        isActive: false,
                        number: '',
                        name: '',
                        startTime: null,
                        status: 'ended'
                    });
                    setCallDuration(0);
                }
            }
        };

        const interval = setInterval(checkCallState, 500); // Increased interval to 500ms
        return () => clearInterval(interval);
    }, [callState.isActive, callState.status]);
useEffect(() => {
    // Use the global socket if available
    if (typeof window !== 'undefined' && (window as any).globalSocket) {
        socketRef.current = (window as any).globalSocket;
    }
}, []);

    // Add this useEffect to set up the global PreviewImage function
    useEffect(() => {
        window.PreviewImage = (img: HTMLImageElement) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
            modal.onclick = () => modal.remove();

            const modalImg = document.createElement('img');
            modalImg.src = img.src;
            modalImg.className = 'max-w-full max-h-full rounded-lg shadow-2xl';
            modalImg.onclick = (e) => e.stopPropagation();

            modal.appendChild(modalImg);
            document.body.appendChild(modal);
        };

        return () => {
            // delete window.PreviewImage;
        };
    }, []);

    // 🎯 Handle URL parameter to auto-select contact
// Replace your URL parameter handling useEffect with this:

useEffect(() => {
    const toNumber = searchParams.get('to');

    if (toNumber && contactList.length > 0) {
        console.log('🔍 URL parameter - Looking for contact with number:', toNumber);

        // Normalize the target number
        const normalizedTarget = normalizePhoneNumber(toNumber);

        // Find existing contact
        const existingContact = contactList.find(contact => {
            const normalizedContactId = normalizePhoneNumber(contact.id);
            return normalizedContactId === normalizedTarget;
        });

        if (existingContact) {
            console.log('✅ Found existing contact from URL:', existingContact);
            setSelectedContact(existingContact);
        } else {
            console.log('📝 Creating new contact for URL parameter:', normalizedTarget);

            // Use getContactName to resolve name for new contact
            const resolvedName = getContactName(normalizedTarget);

            // Create new contact for this number
            const newContact: Contact = {
                id: normalizedTarget,
                phone: formatPhone(normalizedTarget),
                name: resolvedName,
                hasUnread: false,
                lastMessage: '',
                lastMessageDate: ''
            };

            // Add to contact list and select it
            setContactList(prev => [newContact, ...prev]);
            setSelectedContact(newContact);
        }
    }
}, [contactList, searchParams]); // ✅ Keep dependencies but don't include savedContacts

    // 💬 2️⃣ When I pick a contact, load just that conversation
useEffect(() => {
    if (!selectedContact) return;

    const raw = localStorage.getItem('myPhoneNumber') || '';
    const me = raw.replace(/\D/g, '').replace(/^1/, '');
    const them = selectedContact.id;

    // Track that we're loading messages for this contact
    setHasLoadedMessagesFor(prev => new Set([...prev, them]));

    // Reset pagination state
    setMessages([]);
    setMessagesOffset(0);
    setHasMoreMessages(true);

    // Load messages
    loadMessages(me, them, 0, true);
}, [selectedContact]);



const getContactName = (number: string) => {
    if (!number || !savedContacts || savedContacts.length === 0) {
        return formatPhone(number);
    }

    // Clean the input number - remove all non-digits
    const cleanedInput = number.replace(/[^\d]/g, "");

    // Create multiple possible formats to match against (same as working console version)
    const formats = [
        cleanedInput,
        cleanedInput.slice(-10), // last 10 digits
        cleanedInput.startsWith('1') ? cleanedInput.slice(1) : cleanedInput
    ];

    // Search through contacts with all possible formats
    for (const format of formats) {
        const match = savedContacts.find(contact => {
            // Get contact phone number and clean it
            const contactPhone = (contact.phone || contact.id || '').replace(/[^\d]/g, "");
            const contactLast10 = contactPhone.slice(-10);
            const formatLast10 = format.slice(-10);

            // Direct match
            if (contactPhone === format) {
                return true;
            }

            // Try matching last 10 digits (most common for US numbers)
            if (contactLast10 === formatLast10 && contactLast10.length === 10) {
                return true;
            }

            // Remove country code from input and try matching
            if (cleanedInput.length === 11 && cleanedInput.startsWith('1')) {
                const inputWithout1 = cleanedInput.slice(1);
                if (contactPhone === inputWithout1) {
                    return true;
                }
            }

            // Add country code to contact and try matching
            if (contactPhone.length === 10) {
                const contactWith1 = '1' + contactPhone;
                if (contactWith1 === cleanedInput) {
                    return true;
                }
            }

            return false;
        });

        if (match) {
            return match.name;
        }
    }

    return formatPhone(number);
};


const filteredContacts = useMemo(() => {
    const normalizedSearch = searchTerm.replace(/\D/g, '');
    const searchLower = searchTerm.toLowerCase();
    
    return contactList.filter(contact => {
        // Basic search filter - optimized with early returns
        if (searchTerm) {
            const nameMatch = contact.name.toLowerCase().includes(searchLower);
            const phoneMatch = normalizedSearch && contact.phone.replace(/\D/g, '').includes(normalizedSearch);
            
            if (!nameMatch && !phoneMatch) return false;
        }

        // Tab filter
        if (activeTab === 'favorites' && !contact.isFavorite) return false;

        return true;
    }).sort((a: Contact, b: Contact) => {
        // Enhanced sorting with favorites first
        if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
        }

        // Then by unread status
        if (a.hasUnread !== b.hasUnread) {
            return a.hasUnread ? -1 : 1;
        }

        // Finally by last message date
        if (a.lastMessageDate && b.lastMessageDate) {
            return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        }

        if (a.lastMessageDate !== b.lastMessageDate) {
            return a.lastMessageDate ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
    });
}, [contactList, searchTerm, activeTab]);




    const handleSendMessage = () => {
        if (!messageText.trim() || !selectedContact) return;

        // 1️⃣ build the "from" exactly as Twilio expects: +1XXXXXXXXXX
        const me10 = getMy10DigitNumber();
        const from = '+1' + me10;
        const to = selectedContact.id;

        console.log('🚀 emitting send-sms:', { from, to, message: messageText.trim() });
        socketRef.current?.emit('send-sms', {
            from,
            to,
            message: messageText.trim()
        });

        // 2️⃣ optimistic UI
        const newMessage = {
            tx_rx_datetime: new Date().toISOString(),
            sender: me10,
            receiver: to,
            body: messageText.trim(),
            direction: 'outbound' as const
        };

        setMessages(m => [...m, newMessage]);

        // ✅ Update contact list to ensure this contact appears with the latest message
        setContactList(prevContacts => {
            const updatedContacts = prevContacts.map((contact: Contact) => {
                if (normalizePhoneNumber(contact.id) === normalizePhoneNumber(selectedContact.id)) {
                    return {
                        ...contact,
                        lastMessage: messageText.trim(),
                        lastMessageDate: newMessage.tx_rx_datetime,
                        lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        // Ensure the contact name is preserved
                        name: getContactName(contact.id) || contact.name
                    };
                }
                return contact;
            });

            // If contact doesn't exist in list, add it
            const contactExists = updatedContacts.some((contact: Contact) =>
                normalizePhoneNumber(contact.id) === normalizePhoneNumber(selectedContact.id)
            );

            if (!contactExists) {
                const newContact: Contact = {
                    id: selectedContact.id,
                    phone: selectedContact.phone,
                    name: getContactName(selectedContact.id) || selectedContact.name,
                    hasUnread: false,
                    unreadCount: 0,
                    lastMessage: messageText.trim(),
                    lastMessageDate: newMessage.tx_rx_datetime,
                    lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isFavorite: selectedContact.isFavorite || false
                };
                updatedContacts.unshift(newContact);
            }

            // Persist the updated contact list
            localStorage.setItem('persistentContactList', JSON.stringify(updatedContacts));

            return updatedContacts.sort((a: Contact, b: Contact) => {
                // Sort favorites first
                if (a.isFavorite && !b.isFavorite) return -1;
                if (!a.isFavorite && b.isFavorite) return 1;

                // Then sort by unread status
                if (a.hasUnread && !b.hasUnread) return -1;
                if (!a.hasUnread && b.hasUnread) return 1;

                // Finally sort by last message date
                if (a.lastMessageDate && b.lastMessageDate) {
                    return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
                }

                if (a.lastMessageDate && !b.lastMessageDate) return -1;
                if (!a.lastMessageDate && b.lastMessageDate) return 1;

                return a.name.localeCompare(b.name);
            });
        });

        // 3️⃣ clear + animate
        setMessageText('');
        setMessageAnimation('animate-bounce');
        setTimeout(() => setMessageAnimation(''), 500);
    };


// Add this single line to your existing handleContactSelect (at the very end):
// Keep your handleContactSelect exactly as it was (NO URL updates):

const handleContactSelect = (contact: Contact) => {
    // Ensure we use the proper contact name
    const updatedContact = {
        ...contact,
        name: getContactName(contact.id) || contact.name
    };

    // Mark contact as read when selected
    setContactList(prev => {
        const updated = prev.map((c: Contact) =>
            normalizePhoneNumber(c.id) === normalizePhoneNumber(contact.id)
                ? { ...c, hasUnread: false, unreadCount: 0, name: updatedContact.name }
                : c
        );

        // Persist the updated contact list
        localStorage.setItem('persistentContactList', JSON.stringify(updated));

        return updated.sort((a: Contact, b: Contact) => {
            // Sort favorites first
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            // Then sort by unread status
            if (a.hasUnread && !b.hasUnread) return -1;
            if (!a.hasUnread && b.hasUnread) return 1;

            // Finally sort by last message date
            if (a.lastMessageDate && b.lastMessageDate) {
                return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
            }

            if (a.lastMessageDate && !b.lastMessageDate) return -1;
            if (!a.lastMessageDate && b.lastMessageDate) return 1;

            return a.name.localeCompare(b.name);
        });
    });

    setSelectedContact(updatedContact);

    // Update global unread count
    window.dispatchEvent(new CustomEvent('contactRead'));
};

// ✅ ONLY fix the URL parameter handling to work better:
useEffect(() => {
    const toNumber = searchParams.get('to');

    // ✅ Only run this when coming from external link with URL parameter
    if (toNumber && contactList.length > 0) {
        console.log('🔍 URL parameter detected:', toNumber);

        const normalizedTarget = normalizePhoneNumber(toNumber);

        // Find existing contact
        const existingContact = contactList.find(contact => {
            const normalizedContactId = normalizePhoneNumber(contact.id);
            return normalizedContactId === normalizedTarget;
        });

        if (existingContact) {
            console.log('✅ Auto-selecting contact from URL:', existingContact.name);
            setSelectedContact(existingContact);
        } else {
            // Create new contact for unknown number
            const resolvedName = getContactName(normalizedTarget);
            const newContact: Contact = {
                id: normalizedTarget,
                phone: formatPhone(normalizedTarget),
                name: resolvedName,
                hasUnread: false,
                lastMessage: '',
                lastMessageDate: ''
            };

            setContactList(prev => [newContact, ...prev]);
            setSelectedContact(newContact);
            console.log('📝 Created new contact from URL:', newContact.name);
        }

        // ✅ Clear the URL parameter after handling it (optional)
        // This prevents it from interfering with manual contact selection
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('to');
        window.history.replaceState({}, '', newUrl.toString());
    }
}, [contactList, searchParams]); // Keep dependencies

    // Handle call functionality
const isSelfCall = (dialedNumber: string, myNumber: string): boolean => {
    const normalizedDialed = normalizePhoneNumber(dialedNumber);
    const normalizedMy = normalizePhoneNumber(myNumber);

    return normalizedDialed === normalizedMy;
};

const handleCall = (phoneNumber: string) => {
    // Check if trying to call own number
    const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "";
    if (isSelfCall(phoneNumber, myPhoneNumber)) {
        // Show toast notification instead of making the call
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: 'You cannot call your own number',
                    type: 'error',
                    duration: 3000
                }
            }));
        }
        return;
    }

    const cleanedNumber = cleanPhoneNumber(phoneNumber);

    // ✅ CRITICAL FIX: Get the resolved contact name using our working function
    const resolvedContactName = getContactName(phoneNumber);

    console.log('📞 Initiating call to:', cleanedNumber);
    console.log('📞 Resolved contact name:', resolvedContactName);

    // Set call state immediately for UI feedback with resolved name
    setCallState({
        isActive: true,
        number: phoneNumber,
        name: resolvedContactName, // ✅ Use resolved name instead of getContactName(phoneNumber)
        startTime: new Date(),
        status: 'dialing'
    });

    // ✅ Dispatch global call start event with resolved name
    window.dispatchEvent(new CustomEvent('globalCallStart', {
        detail: {
            number: phoneNumber,
            name: resolvedContactName, // ✅ Pass resolved name
            direction: 'outbound'
        }
    }));

    // To Start the call
    if (window.DialByLine) {
        window.DialByLine('audio', null, cleanedNumber);
    } else {
        console.warn('⚠️ Dialer not ready - window.DialByLine not available');
        setCallState(prev => ({ ...prev, isActive: false, status: 'ended' }));
        setShowPhoneSystemAlert(true);
    }
};

    // Replace the simple immediateEndCall function with this comprehensive one
    const confirmEndCall = async () => {
        console.log('🔴 Attempting to end call...');
        let callEnded = false;

        try {
            // Method 1: Use GlobalPhoneManager if available
            if (window.GlobalPhoneManager?.getInstance) {
                try {
                    const phoneManager = window.GlobalPhoneManager.getInstance();
                    if (phoneManager.isInitialized()) {
                        await phoneManager.hangupAllCalls();
                        callEnded = true;
                        console.log('✅ Call ended via GlobalPhoneManager');
                    }
                } catch (error) {
                    console.warn('⚠️ GlobalPhoneManager method failed:', error);
                }
            }

            // Method 2: Find and end ALL active sessions using enhanced logic
            if (!callEnded && window.Lines?.length) {
                console.log('🔍 Checking all lines for active sessions...');

                window.Lines.forEach(async (line, i) => {
                    if (line?.SipSession) {
                        const status = (line.SipSession.status || '').toLowerCase();
                        console.log(`📋 Line ${i} status: ${status}`);

                        // Check for any active call states
                        if (['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress', 'early'].includes(status)) {
                            console.log(`🛑 Ending active session on line ${i}`);
                            try {
                                // Try multiple termination methods
                                if (typeof line.SipSession.terminate === 'function') {
                                    await line.SipSession.terminate();
                                    callEnded = true;
                                } else if (typeof line.SipSession.bye === 'function') {
                                    await line.SipSession.bye();
                                    callEnded = true;
                                } else if (typeof line.SipSession.cancel === 'function') {
                                    await line.SipSession.cancel();
                                    callEnded = true;
                                }

                                // Also try the legacy methods
                                window.cancelSession?.(i);
                                window.endSession?.(i);
                                callEnded = true;
                            } catch (error) {
                                console.error(`❌ Error ending session on line ${i}:`, error);
                            }
                        }
                    }
                });
            }

            // Method 3: Try getActiveLineNum as backup
            if (!callEnded && window.getActiveLineNum && typeof window.getActiveLineNum === "function") {
                try {
                    const activeLineNum = window.getActiveLineNum();
                    console.log('📞 Active line number:', activeLineNum);

                    if (typeof activeLineNum === "number" && activeLineNum >= 0 && window.Lines) {
                        const activeLine = window.Lines[activeLineNum];
                        if (activeLine && activeLine.SipSession) {
                            if (activeLine.SipSession.terminate) {
                                await activeLine.SipSession.terminate();
                            } else if (activeLine.SipSession.bye) {
                                await activeLine.SipSession.bye();
                            }
                            callEnded = true;
                        }

                        // Also try legacy methods as backup
                        if (window.cancelSession) {
                            window.cancelSession(activeLineNum);
                            callEnded = true;
                        }
                        if (window.endSession) {
                            window.endSession(activeLineNum);
                            callEnded = true;
                        }
                    }
                } catch (error) {
                    console.error('❌ Error with getActiveLineNum method:', error);
                }
            }

            // Method 4: Brute force - try ending all possible lines with better error handling
            if (!callEnded) {
                console.log('🔄 Brute force: Trying to end all lines 0-9');
                for (let i = 0; i <= 9; i++) {
                    try {
                        if (window.Lines && window.Lines[i] && window.Lines[i].SipSession) {
                            const session = window.Lines[i].SipSession;
                            if (session.terminate) await session.terminate();
                            else if (session.bye) await session.bye();
                            else if (session.cancel) await session.cancel();
                        }

                        if (window.cancelSession) window.cancelSession(i);
                        if (window.endSession) window.endSession(i);
                        callEnded = true;
                    } catch (error) {
                        // Ignore errors, just try next line
                    }
                }
            }

            // Method 5: Try global hangup functions
            if (!callEnded) {
                try {
                    if (window.HangupAll) {
                        window.HangupAll();
                        callEnded = true;
                    } else if (window.EndCall) {
                        window.EndCall();
                        callEnded = true;
                    } else if (window.HangUp) {
                        window.HangUp();
                        callEnded = true;
                    }
                } catch (error) {
                    console.error('❌ Error with global hangup functions:', error);
                }
            }

            console.log(callEnded ? '✅ Call termination attempted successfully' : '⚠️ Could not find active session to terminate');

        } catch (error) {
            console.error('❌ Error in confirmEndCall:', error);
        }

        // Always reset UI state after attempting to end the call
        setCallState({
            isActive: false,
            number: '',
            name: '',
            startTime: null,
            status: 'ended'
        });
        setCallDuration(0);

        if (!callEnded) {
            setShowPhoneSystemAlert(true);
        }
    };



    const handleEndCall = async () => {
        await confirmEndCall();
    };

    // Immediate end call without confirmation


    // Dialer functions
    const handleKeypadPress = (key: string) => {
        setDialedNumber(prev => prev + key);
    };

    const handleBackspace = () => {
        setDialedNumber(prev => prev.slice(0, -1));
    };

    const handleStartNewConversation = () => {
        if (!dialedNumber.trim()) return;

        // Clean and format the number
        const cleanedNumber = dialedNumber.replace(/\D/g, '').replace(/^1/, '');

        // Check if contact already exists
        const existingContact = contactList.find(contact =>
            contact.id.replace(/\D/g, '').replace(/^1/, '') === cleanedNumber
        );

        if (existingContact) {
            // Select existing contact
            setSelectedContact(existingContact);
        } else {
            // Create new contact
            const newContact: Contact = {
                id: cleanedNumber,
                phone: formatPhone(cleanedNumber),
                name: formatPhone(cleanedNumber),
                hasUnread: false,
                lastMessage: '',
                lastMessageDate: ''
            };

            // Add to contact list and select it
            setContactList(prev => [newContact, ...prev]);
            setSelectedContact(newContact);
        }

        // Close dialer and reset
        setShowDialer(false);
        setDialedNumber('');
    };

    // Delete selected contacts
    const handleDeleteSelectedContacts = () => {
        if (selectedContacts.size === 0) return;
        setShowDeleteAlert(true);
    };

    // Add this state variable
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
    const [showDeleteContactAlert, setShowDeleteContactAlert] = useState(false);

    // Add this handler function
const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
        const myNumber = getMy10DigitNumber();
        const response = await fetch('https://bkpmanual.bitnexdial.com/api/delete-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myPhoneNumber: myNumber,
                targetNumber: contactToDelete.id
            })
        });

        const result = await response.json();

        if (result.success) {
            const contactId = normalizePhoneNumber(contactToDelete.id);
            
            // Remove from contact list
            setContactList(prev => prev.filter(contact => 
                normalizePhoneNumber(contact.id) !== contactId
            ));

            // If this was the selected contact, clear it
            if (selectedContact && normalizePhoneNumber(selectedContact.id) === contactId) {
                setSelectedContact(null);
                setMessages([]);
            }

            // Clear from persistent localStorage
            const persistentContactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
            const updatedPersistentList = persistentContactList.filter((contact: Contact) => 
                normalizePhoneNumber(contact.id) !== contactId
            );
            localStorage.setItem('persistentContactList', JSON.stringify(updatedPersistentList));

            // Clear cache entries (same as above)
            const keysToRemove: string[] = [];
            contactsCache.forEach((_, key) => {
                if (key.includes(myNumber)) {
                    keysToRemove.push(key);
                }
            });
            keysToRemove.forEach(key => {
                contactsCache.delete(key);
                contactsCacheTime.delete(key);
            });

            // Clear messages cache
            messagesCache.forEach((_, key) => {
                if (key.includes(`${myNumber}-${contactId}`) || key.includes(`${contactId}-${myNumber}`)) {
                    messagesCache.delete(key);
                    messagesCacheTime.delete(key);
                }
            });

            // Update localStorage cache
            saveToLocalStorage('contactsCache', contactsCache);
            saveToLocalStorage('contactsCacheTime', contactsCacheTime);
            saveToLocalStorage('messagesCache', messagesCache);
            saveToLocalStorage('messagesCacheTime', messagesCacheTime);

            // Remove from favorites
            setFavoriteContacts(prev => {
                const newFavorites = new Set(prev);
                newFavorites.delete(contactId);
                return newFavorites;
            });

            console.log(`✅ Deleted conversation with ${contactToDelete.name}`);
        } else {
            console.error('❌ Failed to delete conversation:', result.error);
        }
    } catch (error) {
        console.error('❌ Error deleting conversation:', error);
    }

    setShowDeleteContactAlert(false);
    setContactToDelete(null);
};
    const handleTextMessage = (phoneNumber: string) => {
        // Since we're already in the text interface, we can just switch to that contact
        // Format phone number for text messaging (10 digits without formatting)
        const cleaned = phoneNumber.replace(/\D/g, '');
        const formattedNumber = cleaned.length === 11 && cleaned.startsWith('1')
            ? cleaned.slice(1)
            : cleaned.length === 10 ? cleaned : phoneNumber;

        console.log('💬 Opening text conversation with:', formattedNumber);

        // Find or create contact for this number
        const cleanedNumber = formattedNumber.replace(/\D/g, '').replace(/^1/, '');
        const existingContact = contactList.find(contact =>
            contact.id.replace(/\D/g, '').replace(/^1/, '') === cleanedNumber
        );

        if (existingContact) {
            setSelectedContact(existingContact);
        } else {
            // Create new contact
            const newContact: Contact = {
                id: cleanedNumber,
                phone: formatPhone(cleanedNumber),
                name: formatPhone(cleanedNumber),
                hasUnread: false,
                lastMessage: '',
                lastMessageDate: ''
            };
            setContactList(prev => [newContact, ...prev]);
            setSelectedContact(newContact);
        }
    };

    const confirmDeleteContacts = () => {
        // Remove selected contacts from the list
        setContactList(prev => prev.filter(contact => !selectedContacts.has(contact.id)));

        // If currently selected contact is being deleted, clear selection
        if (selectedContact && selectedContacts.has(selectedContact.id)) {
            setSelectedContact(null);
            setMessages([]);
        }

        // Clear selections and exit edit mode
        setSelectedContacts(new Set());
        setIsEditMode(false);
        setShowDeleteAlert(false);
    };

    // Toggle edit mode
    const toggleEditMode = () => {
        setIsEditMode(!isEditMode);
        setSelectedContacts(new Set());
    };

    const getImageUrlFromMessage = (messageBody: string): string | null => {
        if (!messageBody || typeof messageBody !== 'string') {
            return null;
        }

        // Check for HTML img tag
        const imgTagMatch = messageBody.match(/<img[^>]+src=["']([^"']*)["'][^>]*>/i);
        if (imgTagMatch) {
            return imgTagMatch[1];
        }

        // Check for direct image URLs
        const urlMatch = messageBody.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            const url = urlMatch[1];
            if (isImageUrl(url)) {
                return url;
            }
        }

        return null;
    };

    // 4. Setup global PreviewImage function (add this to your useEffect)
    useEffect(() => {
        console.log('🔧 Setting up global PreviewImage function');

        window.PreviewImage = (img: HTMLImageElement) => {
            console.log('🖼️ Global PreviewImage called for:', img.src);
            showImagePreview(img.src);
        };

        return () => {
            // Cleanup any existing modals
            const existingModal = document.getElementById('image-preview-modal');
            if (existingModal) {
                existingModal.remove();
            }
        };
    }, []);

    // 2. Image Preview Modal Function
    // Enhanced Image Preview Modal Function
    const showImagePreview = (imageUrl: string) => {
        console.log('👁️ Opening enhanced image preview for:', imageUrl);

        // Remove existing modal if any
        const existingModal = document.getElementById('image-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        backdrop-filter: blur(8px);
        animation: fadeIn 0.3s ease-out;
    `;

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: scale(0.8) translateY(20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .image-preview-container {
            animation: slideIn 0.4s ease-out;
        }
    `;
        document.head.appendChild(style);

        // Close handlers
        const closeModal = () => {
            modal.style.animation = 'fadeIn 0.2s ease-in reverse';
            setTimeout(() => {
                modal.remove();
                document.head.removeChild(style);
                document.removeEventListener('keydown', handleEscape);
            }, 200);
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        document.addEventListener('keydown', handleEscape);

        // Create image container
        const container = document.createElement('div');
        container.className = 'image-preview-container';
        container.style.cssText = `
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    `;

        // Create image
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        display: block;
        cursor: zoom-in;
    `;
        img.onclick = (e) => e.stopPropagation();

        // Loading indicator
        const loading = document.createElement('div');
        loading.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #666;
        font-size: 18px;
        font-weight: 500;
    `;
        loading.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 20px; height: 20px; border: 2px solid #ddd; border-top: 2px solid #3778D6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            Loading image...
        </div>
    `;

        // Add spin animation for loading
        const spinStyle = document.createElement('style');
        spinStyle.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
        document.head.appendChild(spinStyle);

        // Image load handlers
        img.onload = () => {
            loading.remove();
            document.head.removeChild(spinStyle);
        };

        img.onerror = () => {
            loading.innerHTML = `
            <div style="color: #ef4444; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                Failed to load image
            </div>
        `;
        };

        // Create top toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10;
    `;

        // Image info
        const imageInfo = document.createElement('div');
        imageInfo.style.cssText = `
        color: white;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
        imageInfo.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        Image Preview
    `;

        // Action buttons
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = `
        display: flex;
        gap: 8px;
    `;

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
    `;
        downloadBtn.style.cssText = `
        background: rgba(55, 120, 214, 0.9);
        color: white;
        border: none;
        border-radius: 8px;
        width: 40px;
        height: 40px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    `;
        downloadBtn.onmouseover = () => {
            downloadBtn.style.background = 'rgba(55, 120, 214, 1)';
            downloadBtn.style.transform = 'scale(1.1)';
        };
        downloadBtn.onmouseout = () => {
            downloadBtn.style.background = 'rgba(55, 120, 214, 0.9)';
            downloadBtn.style.transform = 'scale(1)';
        };
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            const filename = `image_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.jpg`;
            downloadImage(imageUrl, filename);
        };
        downloadBtn.title = 'Download image';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    `;
        closeBtn.style.cssText = `
        background: rgba(239, 68, 68, 0.9);
        color: white;
        border: none;
        border-radius: 8px;
        width: 40px;
        height: 40px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    `;
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(239, 68, 68, 1)';
            closeBtn.style.transform = 'scale(1.1)';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
            closeBtn.style.transform = 'scale(1)';
        };
        closeBtn.onclick = closeModal;
        closeBtn.title = 'Close preview';

        // Assemble toolbar
        actionButtons.appendChild(downloadBtn);
        actionButtons.appendChild(closeBtn);
        toolbar.appendChild(imageInfo);
        toolbar.appendChild(actionButtons);

        // Assemble modal
        container.appendChild(loading);
        container.appendChild(img);
        container.appendChild(toolbar);
        modal.appendChild(container);
        document.body.appendChild(modal);

        console.log('✅ Enhanced preview modal created');
    };
    // Enhanced download function
    const downloadImage = async (imageUrl: string, filename: string) => {
        try {
            console.log('📥 Downloading image:', imageUrl);

            // Create a temporary link element
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = filename;
            link.target = '_blank';

            // For cross-origin images, we need to fetch and create blob
            if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    link.href = blobUrl;

                    // Trigger download
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Clean up blob URL
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

                    console.log('✅ Image download initiated');
                    return;
                } catch (fetchError) {
                    console.warn('⚠️ Fetch failed, falling back to direct link:', fetchError);
                }
            }

            // Direct download for same-origin or fallback
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('✅ Image download initiated (direct)');
        } catch (error) {
            console.error('❌ Download failed:', error);
            // Fallback: open in new tab
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
        }
    };




    const getMessageImageData = useCallback((messageBody: string) => {
        const url = getImageUrlFromMessage(messageBody);
        return {
            imageUrl: url,
            hasImage: !!url
        };
    }, []);
    //Api Call to like a contact
    const onFavoriteClick = async (contact: any)  => {
        const myPhoneNumber = sessionStorage.getItem('senderPhone');
        const favoriteReceiver = contact.id;
        const res = await fetch('https://bkpmanual.bitnexdial.com/api/toggle-favorite-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myPhoneNumber,
                contactNumber: favoriteReceiver
            })
        });
        const data = await res.json();
        setIsFavorite(data.isFavorite);
    };

    // //API call for favorites List
    // const fetchFavoriteChats = async () => {
    //     const phone = sessionStorage.getItem('senderPhone');

    //     if (!phone) {
    //         console.error('Phone number not found in sessionStorage');
    //         return [];
    //     }

    //     try {
    //         const response = await fetch(`https://bkpmanual.bitnexdial.com/api/favorite-chats?owner=${encodeURIComponent(phone)}`);
    //         if (!response.ok) {
    //             throw new Error(`API Error: ${response.status}`);
    //         }
    //         const data = await response.json();
    //         return data;
    //     } catch (error) {
    //         console.error('Failed to fetch favorite chats:', error);
    //         return [];
    //     }
    // };


    return (
        <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 md:px-4">
            <div className="flex w-full h-[90vh] mx-auto shadow-2xl dark:shadow-gray-900/50 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 transform transition-all duration-500 hover:shadow-3xl dark:hover:shadow-gray-900/70">
                {/* Left Panel - Contact List */}
                  <div
                    className={`${
                        selectedContact ? 'hidden md:flex' : 'flex'
                    } w-full md:w-75 bg-gradient-to-b from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-800 dark:to-slate-700 h-full flex-col shadow-lg border-r border-gray-200 dark:border-slate-600 transform transition-all duration-300 hover:from-[#C8E6E4] hover:to-[#BAE2E0] dark:hover:from-slate-700 dark:hover:to-slate-600`}
                    >
                    {/* Header */}
                    <div className="p-3 bg-gradient-to-r from-[#D3E9E7] to-[#E0F0EE] dark:from-slate-800 dark:to-slate-700 transform transition-all duration-300 hover:from-[#E0F0EE] hover:to-[#EDF7F5] dark:hover:from-slate-700 dark:hover:to-slate-600">
                        <div className="flex py-4 items-center border-b-2 border-[#3778D6]/30 dark:border-blue-400/30 justify-between transition-all duration-300 hover:border-[#3778D6]/50 dark:hover:border-blue-400/50">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center transform transition-all duration-300 hover:scale-105 hover:text-[#3778D6] dark:hover:text-blue-400">
                                Text
                            </h2>
                            {/* SMS Counter Display */}
                            {/* Header section - remove edit mode buttons */}
                            <div className="flex items-center space-x-3">
                                {!counterLoading && (
                                    <div className="bg-white/30 dark:bg-slate-700/30 rounded-lg px-3 py-1 shadow-sm">
                                        <div className="flex items-center space-x-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-green-600 dark:text-green-400">📨</span>
                                                <span>{smsData.total}</span>
                                            </div>
                                            {smsData.mms > 0 && (
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-blue-600 dark:text-blue-400">🖼️</span>
                                                    <span>{smsData.mms}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowDialer(true)}
                                    className="text-[#607D8B] dark:text-slate-400 hover:text-[#3778D6] dark:hover:text-blue-400 transition-all duration-300 p-2 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/50 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95"
                                >
                                    <TbMessagePlus size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Search and Filter */}
                        <div className="mt-4 p-1 bg-white/30 dark:bg-slate-700/30 rounded-xl shadow-inner border border-white/50 dark:border-slate-600/50 transform transition-all duration-300 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:shadow-lg hover:scale-[1.02]">
                            <div className="flex justify-between items-center space-x-3">
                                <div className="flex-1 relative group">
                                    <span className="absolute left-3 top-[70%] transform -translate-y-1/2 text-[#929292] dark:text-gray-400 transition-all duration-300 group-hover:text-[#3778D6] dark:group-hover:text-blue-400 group-hover:scale-110" style={{ transform: 'scaleX(-1) translateY(-50%)' }}>
                                        <BiSearchAlt />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search Messages"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 text-sm border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg transform focus:scale-[1.02] hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                    />
                                </div>

                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={`px-3 py-2 text-sm font-bold rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border transform hover:scale-105 hover:-translate-y-1 active:scale-95 ${
                                            activeTab === 'all'
                                                ? 'text-[#3778D6] dark:text-blue-400 bg-white dark:bg-slate-600 border-[#3778D6]/20 dark:border-blue-400/20 hover:bg-gradient-to-r hover:from-white hover:to-blue-50 dark:hover:from-slate-600 dark:hover:to-blue-900/30'
                                                : 'text-gray-600 dark:text-gray-300 hover:text-[#3778D6] dark:hover:text-blue-400 bg-white/50 dark:bg-slate-600/50 hover:bg-white dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600 hover:border-[#3778D6]/30 dark:hover:border-blue-400/30'
                                        }`}
                                    >
                                        ALL
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('favorites')}
                                        className={`px-3 py-2 text-sm font-bold rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border transform hover:scale-105 hover:-translate-y-1 active:scale-95 relative ${
                                            activeTab === 'favorites'
                                                ? 'text-[#3778D6] dark:text-blue-400 bg-white dark:bg-slate-600 border-[#3778D6]/20 dark:border-blue-400/20 hover:bg-gradient-to-r hover:from-white hover:to-blue-50 dark:hover:from-slate-600 dark:hover:to-blue-900/30'
                                                : 'text-gray-600 dark:text-gray-300 hover:text-[#3778D6] dark:hover:text-blue-400 bg-white/50 dark:bg-slate-600/50 hover:bg-white dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600 hover:border-[#3778D6]/30 dark:hover:border-blue-400/30'
                                        }`}
                                    >
                                        ⭐ FAVORITES
                                        {favoriteContacts.size > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                                {favoriteContacts.size}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact List */}
                    {/* Contact List */}
                    <div
                        ref={contactListRef}
                        className="flex-1 overflow-auto p-2"
                    >

                        {activeTab === 'all' ? (

                                filteredContacts.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredContacts
                                        .sort((a, b) => {
                                            // Sort by unread status first (unread contacts at top)
                                            if (a.hasUnread && !b.hasUnread) return -1;
                                            if (!a.hasUnread && b.hasUnread) return 1;

                                            // Then sort by last message date (most recent first)
                                            if (a.lastMessageDate && b.lastMessageDate) {
                                                return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
                                            }

                                            if (a.lastMessageDate && !b.lastMessageDate) return -1;
                                            if (!a.lastMessageDate && b.lastMessageDate) return 1;

                                            return a.name.localeCompare(b.name);
                                        })
                                        .map((contact, index) => (
                                            <div
                                                key={contact.id}
                                                style={{ 
                                                    animationDelay: hasLoadedContactsOnce ? '0ms' : `${index * 100}ms` 
                                                }}
                                                className={`items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-2 hover:scale-[1.02] border group ${
                                                    hasLoadedContactsOnce ? '' : 'animate-slideInLeft'
                                                } ${selectedContact?.id === contact.id
                                                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50 scale-[1.02]'
                                                    : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:from-white hover:to-gray-50 dark:hover:from-slate-700 dark:hover:to-slate-600'
                                                }`}
                                            >
                                                <div className="flex">
                                                    {/* Your existing contact content - keep all the contact JSX exactly the same */}
                                                    <div
                                                        onClick={() => handleContactSelect(contact)}
                                                        className="flex items-center flex-1"
                                                    >
                                                        <div className={`w-3 h-3 rounded-full mr-4 shadow-sm transition-all duration-300 group-hover:scale-125 ${contact.hasUnread ? 'bg-gradient-to-br from-red-400 to-red-600 animate-pulse group-hover:animate-bounce' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-green-400 dark:group-hover:bg-green-500'
                                                            }`}></div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-3">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:shadow-lg">
                                                                    <span className="text-blue-600 dark:text-blue-300 text-lg transition-all duration-300 group-hover:scale-110">👤</span>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 transition-all duration-300 group-hover:text-[#3778D6] dark:group-hover:text-blue-400">
                                                                            {contact.name}
                                                                        </div>
                                                                        {/* Unread Badge */}
                                                                        {contact.hasUnread && contact.unreadCount && contact.unreadCount > 0 && (
                                                                            <div className="bg-red-500 dark:bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 animate-pulse shadow-lg">
                                                                                {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {contact.name !== contact.phone && (
                                                                        <div className="text-xs text-gray-600 dark:text-gray-400 font-medium transition-all duration-300 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                                                                            {contact.phone}
                                                                        </div>
                                                                    )}
                                                                    {/* Last Message Preview */}
                                                                    {contact.lastMessage && (
                                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            <div className="truncate max-w-[120px]">
                                                                                {contact.lastMessage.replace(/<[^>]*>/g, '')}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Delete Button for this contact */}
                                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                        {/* Star/Favorite Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleContactFavorite(contact);
                                                            }}
                                                            disabled={isTogglingFavorite}
                                                            className={`p-2 rounded-lg transition-all duration-300 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95 ${
                                                                contact.isFavorite
                                                                    ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                                                    : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400 bg-gray-50 dark:bg-slate-600/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                                                            } ${isTogglingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            title={contact.isFavorite ? 'Unpin chat' : 'Pin chat'}
                                                        >
                                                            {contact.isFavorite ? (
                                                                <PiStarFill size={16} />
                                                            ) : (
                                                                <PiStarThin size={16} />
                                                            )}
                                                        </button>

                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setContactToDelete(contact);
                                                                setShowDeleteContactAlert(true);
                                                            }}
                                                            className="p-2 rounded-lg text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95"
                                                            title={`Delete conversation with ${contact.name}`}
                                                        >
                                                            <MdDelete size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {contact.lastMessageTime && (
                                                    <div className="text-right text-gray-400 dark:text-gray-500 text-xs">
                                                        {contact.lastMessageTime}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                    {/* Loading indicator at bottom when fetching more */}
                                    {isLoadingContacts && contactList.length > 0 && (
                                        <div className="text-center py-4">
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">Loading more contacts...</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* End of contacts indicator */}
                                    {!hasMoreContacts && contactList.length > 0 && (
                                        <div className="text-center py-4">
                                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                                • All contacts loaded •
                                            </div>
                                        </div>
                                    )}

                                    {/* Loading indicator for initial load */}
                                    {isLoadingContacts && contactList.length === 0 && (
                                        <div className="text-center py-8">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Loading contacts...</span>
                                        </div>
                                    )}
                                </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <div className="mb-6 transform hover:scale-105 transition-all duration-300">
                                            <Image
                                                src="/No text image.png"
                                                alt="No text messages"
                                                width={130}
                                                height={130}
                                                className="mx-auto drop-shadow-xl"
                                            />
                                        </div>
                                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-xl p-4 shadow-lg border border-white/30 dark:border-slate-600/30">
                                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">No text messages yet</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">You haven't sent or received text messages yet</p>
                                        </div>
                                    </div>
                                )

                        ) : activeTab === 'favorites' ? (
                            // <p>Favorite Contacts</p>
                                // <FavoriteContactCard handleContactSelect={handleContactSelect} filteredContacts={filteredContacts}/>
                    <FavoriteContactCard
                        contacts={filteredContacts}
                        selectedContact={selectedContact}
                        onContactSelect={handleContactSelect}
                        onToggleFavorite={toggleContactFavorite}
                        onDeleteContact={(contact) => {
                            setContactToDelete(contact);
                            setShowDeleteContactAlert(true);
                        }}
                        isTogglingFavorite={isTogglingFavorite}
                    />
                        ) : null}





                    </div>


                </div>

                {/* Main Content Area */}
                    <div
                    className={`${
                        selectedContact ? 'flex' : 'hidden'
                    } md:flex flex-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex-col h-full shadow-inner`}
                    >

                    {selectedContact ? (
                        <>
                            {/* Header */}
                            <div className="p-3 md:p-6 border-b border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm transform transition-all duration-500 animate-slideDown">



                        {/* Responsive header row */}
                        {/* <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4"> */}
                      <div className="flex justify-between">


                        {/* Left: title + status + action icons (wrap on mobile) */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 min-w-0">

                            {/* Mobile-only Back to chats */}
                        <button
                        onClick={() => setSelectedContact(null)}
                        className="md:hidden mt-2 mb-2 inline-flex items-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                        aria-label="Back to chats"
                        type="button"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        </button>

                                        {/* Title (truncates on small screens) */}
                              {!isMessageSelectMode && (
                                    <h2 className="text-base md:text-xl font-bold text-gray-800 dark:text-gray-100 transition-all duration-300 hover:text-[#3778D6] dark:hover:text-blue-400 hover:scale-105 truncate max-w-[70vw] md:max-w-none">
                                        {selectedContact.name}
                                            </h2>
                                        )}

                           

                            {/* Selection mode indicator */}
                            {isMessageSelectMode && (
                            <div className="bg-blue-100 dark:bg-blue-900/30 px-2.5 md:px-3 py-0.5 md:py-1 rounded-full">
                                <span className="text-xs md:text-sm font-medium text-blue-800 dark:text-blue-200">
                                {selectedMessages.size} selected
                                </span>
                            </div>
                            )}

                                        {/* Favorite toggle */}
                                        {!isMessageSelectMode && (
                                            <button
                                                onClick={() => selectedContact && toggleContactFavorite(selectedContact)}
                                                disabled={!selectedContact || isTogglingFavorite}
                                                className={`text-xl md:text-2xl transition-all duration-300 p-2 md:p-2.5 rounded-lg shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95 ${selectedContact?.isFavorite
                                                        ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                                        : 'text-amber-400 dark:text-amber-300 hover:text-amber-500 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                                    } ${!selectedContact || isTogglingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                title={selectedContact?.isFavorite ? 'Unpin this chat' : 'Pin this chat'}
                                            >
                                                {selectedContact?.isFavorite ? <PiStarFill /> : <PiStarThin />}
                                            </button>
                                        )}
                            

                            {/* Contacts icon */}
                            <button className="hidden lg:block text-xl md:text-2xl text-[#3778D6] dark:text-blue-400 hover:text-[#2a5aa0] dark:hover:text-blue-300 transition-all duration-300 p-2 md:p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95">
                            <IoMdContacts />
                            </button>

                            {/* Online pill */}
                            {isOnline && (
                            <div className="hidden md:flex items-center space-x-2 bg-green-50 dark:bg-green-900/30 px-2.5 md:px-3 py-0.5 md:py-1 rounded-full animate-fadeIn">
                                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-xs md:text-[0.8rem] text-green-700 dark:text-green-300 font-medium">Online</span>
                            </div>
                            )}
                        </div>

                        {/* Right: action cluster (wraps on mobile) */}
                        <div className="flex flex-wrap items-center gap-1 md:gap-4">
                            {isMessageSelectMode ? (
                            <>
                                <button
                                onClick={() => {
                                    setSelectedMessages(new Set(messages.map((_, index) => index)));
                                }}
                                className="px-3 md:px-4 py-2 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                title="Select all messages"
                                >
                                <span className="text-xs md:text-sm font-medium">Select All</span>
                                </button>

                                <button
                                onClick={() => setShowDeleteMessagesAlert(true)}
                                disabled={selectedMessages.size === 0}
                                className={`px-3 md:px-4 py-2 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 ${
                                    selectedMessages.size > 0
                                    ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer hover:-translate-y-1'
                                    : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                }`}
                                title={`Delete ${selectedMessages.size} selected message${selectedMessages.size !== 1 ? 's' : ''}`}
                                >
                                <MdDelete size={18} className="md:!h-5 md:!w-5" />
                                </button>

                                <button
                                onClick={toggleMessageSelectMode}
                                className="px-3 md:px-4 py-2 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600"
                                title="Cancel selection"
                                >
                                <IoClose size={18} className="md:!h-5 md:!w-5" />
                                </button>
                            </>
                            ) : (
                            <>
                                <button
                                onClick={toggleMessageSelectMode}
                                className="px-3 md:px-4 py-2 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600"
                                title="Select messages"
                                >
                                <LiaEdit size={18} className="md:!h-5 md:!w-5" />
                                </button>

                                <button
                                onClick={() => handleCall(selectedContact.phone)}
                                disabled={callActive}
                                className="px-3 md:px-4 py-2 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 group
                                            text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300
                                            bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50
                                            cursor-pointer hover:-translate-y-1"
                                title={`Call ${selectedContact.phone}`}
                                >
                                <FiPhone size={18} className="group-hover:animate-pulse md:!h-5 md:!w-5" />
                                </button>
                            </>
                            )}

                            {/* <button
                            className="p-2 md:p-3 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 shadow-md hover:shadow-xl transition-all duration-300 transform active:scale-95 group"
                            onClick={() => setShowDeleteConversationAlert(true)}
                            title="Delete conversation"
                            >
                            <TbTrash size={18} className="group-hover:animate-bounce md:!h-5 md:!w-5" />
                            </button> */}
                        </div>
                     </div>
                 </div>


                            {/* Message Content  updated 02-07-2025 Wednesday|*/}
                            <div
                                id="chat-messages-container"
                                ref={chatRef}
                                className="flex-1 p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 overflow-y-auto animate-fadeIn"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                            {/* Add this before the messages container in your JSX */}
                            {/* Fixed: Remove nested button structure */}
                            {hasMoreMessages && messages.length > 0 && !isLoadingOlderMessages && (
                                <div className="text-center py-4 border-b border-gray-200 dark:border-slate-600">
                                    <button
                                        onClick={loadMoreMessages}
                                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center space-x-2 mx-auto"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                        </svg>
                                        <span>Load Older Messages</span>
                                    </button>
                                </div>
                            )}

                                <div className="mx-auto w-full">
                                    {/* Messages Container  updated 02-07-2025 Wednesday*/}
                                    <div className="space-y-6" style={{
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>

                                        {messages.map((msg, i) => {
                                            const normalizedSender = normalizePhoneNumber(msg.sender);
                                            const normalizedMyNumber = normalizePhoneNumber(getMy10DigitNumber());
                                            const isMine = normalizedSender === normalizedMyNumber; // Use normalized comparison

                                                // const isMine = msg.direction === 'outbound';
                                                const messageDate = new Date(msg.tx_rx_datetime);
                                                const prevMessage = i > 0 ? messages[i - 1] : null;
                                                const prevMessageDate = prevMessage ? new Date(prevMessage.tx_rx_datetime) : null;
                                                const showDateSeparator = !prevMessageDate || messageDate.toDateString() !== prevMessageDate.toDateString();
                                                const { imageUrl, hasImage } = getMessageImageData(msg.body);

                                                // Only animate new messages for contacts being loaded for the first time
                                                const shouldAnimate = i >= messages.length - messagesLimit && 
                                                                    !isLoadingOlderMessages && 
                                                                    !hasLoadedMessagesFor.has(selectedContact?.id || '');

                                                return (
                                                    <div key={`${msg.tx_rx_datetime}-${i}`}>
                                                        {showDateSeparator && (
                                                            <div className="text-center my-4">
                                                                <div className="inline-block bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-slate-600">
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                                        {messageDate.toLocaleDateString([], {
                                                                            weekday: 'short',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            year: messageDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Message with conditional animation */}
                                            <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2 ${
                                                i === messages.length - 1 && newMessageIndicator ? 'animate-bounce' : ''
                                            }`}>
                                      {/* Rest of your message JSX stays exactly the same */}
                                                            {isMessageSelectMode && (
                                                            <div className="flex items-center mr-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMessages.has(i)}
                                                                    onChange={() => toggleMessageSelection(i)}
                                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="max-w-xs lg:max-w-md group relative">
                                                        <div
                                                            className={`relative p-4 rounded-2xl shadow-lg border transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer select-text ${selectedMessages.has(i) ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''
                                                                } ${i === messages.length - 1 && newMessageIndicator ? 'ring-2 ring-blue-400 animate-pulse' : ''}
                                                            ${isMine
                                                                    ? 'bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white rounded-br-md border-blue-600 dark:border-blue-500 group-hover:from-blue-600 group-hover:to-blue-800 dark:group-hover:from-blue-500 dark:group-hover:to-blue-700'
                                                                    : 'bg-gradient-to-br from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-700 dark:to-slate-600 text-gray-800 dark:text-gray-100 rounded-bl-md border-gray-200 dark:border-slate-600 group-hover:from-[#C8E6E4] group-hover:to-[#BAE2E0] dark:group-hover:from-slate-600 dark:group-hover:to-slate-500'
                                                                }`}
                                                            onClick={() => handleMessageClick(i, msg)}
                                                            onMouseDown={(e) => handleMouseDown(e, i, msg)}
                                                            onMouseMove={handleMouseMove}
                                                            onMouseUp={handleMouseUp}
                                                            onMouseLeave={handleMouseUp}
                                                            onTouchStart={() => handleTouchStart(i, msg)}
                                                            onTouchMove={handleTouchMove}
                                                            onTouchEnd={handleTouchEnd}
                                                            onContextMenu={(e) => handleContextMenu(e, i, msg)}
                                                            style={{
                                                                userSelect: 'text',
                                                                WebkitUserSelect: 'text'
                                                            }}
                                                        >
                                                                {/* Message Content */}
                                                                <MediaContent Data={msg} message={msg.body} isMine={isMine} />

                                                                {/* Timestamp */}
                                                                <div className={`text-xs mt-2 opacity-70 transition-all duration-300 ${isMine ? 'text-blue-100 dark:text-blue-200 text-right flex items-center justify-end space-x-1' : 'text-gray-500 dark:text-gray-400 text-left'}`}>
                                                                    <span>{messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    {isMine && <span className="animate-pulse">✓✓</span>}
                                                                </div>


                                                                {/* For Inbound Images */}
                                                                {msg.mediaUrl && (
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                                                                        <div className="flex space-x-2">

                                                                            {/* View Button */}
                                                                            <a
                                                                                href={msg.mediaUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-gray-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                                                                title="View full size"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                            </a>

                                                                            {/* Download Button */}
                                                                            <a
                                                                                href={msg.mediaUrl}
                                                                                download={`image_${Date.now()}.jpg`}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-gray-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                                                                title="Download image"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                </svg>
                                                                            </a>

                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* For outbound Images */}
                                                                {hasImage && imageUrl && (
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                                                                        <div className="flex space-x-2">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    showImagePreview(imageUrl);
                                                                                }}
                                                                                className="bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-gray-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                                                                title="View full size"
                                                                                type="button"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    downloadImage(imageUrl, `image_${Date.now()}.jpg`);
                                                                                }}
                                                                                className="bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-gray-200 p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                                                                title="Download image"
                                                                                type="button"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Selection indicator */}
                                                                {selectedMessages.has(i) && (
                                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold z-20">
                                                                        ✓
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    </div>
                                </div>
                            </div>


                            {/* Message Input */}
                            <div className="p-6 border-t-2 border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 transform transition-all duration-500 animate-slideUp">
                                {/* File Upload Progress */}
                                {isUploading && (
                                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                                                    Uploading {selectedFile?.name}...
                                                </div>
                                                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                                                {uploadProgress}%
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Selected File Preview */}
                                {selectedFile && !isUploading && (
                                    <div className="mb-4 bg-gray-50 dark:bg-slate-700 rounded-xl p-4 border border-gray-200 dark:border-slate-600">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                    Selected: {selectedFile.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                </div>
                                            </div>
                                            <button
                                                onClick={removeSelectedFile}
                                                className="text-red-500 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200"
                                            >
                                                <IoClose size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center space-x-4">
                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf,.txt"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <div className="flex-1 relative group">
                                         {/* <EmojiSelector setter={setMessageText} /> */}
                                        <textarea
                                            placeholder="Type a message..."
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (selectedFile) {
                                                        handleSendFile();
                                                    } else {
                                                        handleSendMessage();
                                                    }
                                                }
                                            }}
                                            rows={1}
                                            style={{
                                                resize: 'none',
                                                minHeight: '56px',
                                                maxHeight: '120px',
                                                overflow: 'auto'
                                            }}
                                            className="w-full p-4 pl-12 pr-20 bg-white dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 rounded-2xl text-sm focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 shadow-lg hover:shadow-xl transition-all duration-300 transform group-hover:border-gray-400 dark:group-hover:border-slate-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                            disabled={isUploading}
                                        />
                                        {/* Left side emoji button */}
                                        <div className="absolute left-5 mt-[2px] top-1/2 transform -translate-y-1/2">
                                            <EmojiSelector setter={setMessageText} />
                                        </div>


                                        {/* Right side buttons */}
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-300 transform hover:scale-125 hover:rotate-12 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <FiPaperclip size={18} />
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 p-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-all duration-300 transform hover:scale-125 hover:-rotate-12 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <FiCamera size={18} />
                                            </button>
                                        </div>
                                    </div>




                                    <button
                                        onClick={selectedFile ? handleSendFile : handleSendMessage}
                                        disabled={(!messageText.trim() && !selectedFile) || isUploading}
                                        className={`p-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-2 hover:scale-110 active:scale-90 group ${(messageText.trim() || selectedFile) && !isUploading
                                            ? 'bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 hover:from-[#2a5aa0] hover:to-[#1e4080] dark:hover:from-blue-500 dark:hover:to-blue-700 text-white cursor-pointer hover:rotate-12'
                                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            } ${messageAnimation}`}
                                    >
                                        {isUploading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <IoSend size={20} className={`transition-all duration-300 ${(messageText.trim() || selectedFile) ? 'group-hover:animate-pulse' : ''}`} />
                                        )}
                                    </button>
                                </div>


                        {/* <EmojiSelector setter={setMessageText} /> */}



                            </div>
                        </>
                    ) : (
                        /* Placeholder Content */
                        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 py-8">
                        <div className="text-center w-full max-w-sm sm:max-w-md lg:max-w-lg">
                          <div className="mb-6 sm:mb-10 transform hover:scale-105 transition-all duration-300">
                            <Image
                              src="/text image.png"
                              alt="Text messaging illustration"
                              width={170}
                              height={170}
                              className="mx-auto w-32 sm:w-40 md:w-46 lg:w-46 h-auto drop-shadow-xl"
                            />
                          </div>
                          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-4 md:p-6 shadow-xl border border-gray-100 dark:border-slate-700">
                            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                              Text Conversation
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg md:text-sm leading-relaxed">
                              Select a contact from the list to start or continue a conversation.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                    )}
                </div>

                {/* Right Panel - Member Info */}
                {selectedContact && (
                    <div className="hidden lg:block w-80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-l-2 border-gray-200 dark:border-slate-600 h-full flex flex-col shadow-xl animate-slideInRight">
                        <div className="p-6 border-b-2 border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 transform transition-all duration-300 hover:from-gray-50 hover:to-white dark:hover:from-gray-800 dark:hover:to-gray-700">
                            <div className="flex items-center space-x-3 mb-6">
                                <span className="font-extrabold cursor-pointer text-[#3778D6] dark:text-blue-400 text-4xl p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 shadow-lg hover:shadow-xl transform hover:-translate-y-2 hover:scale-110 hover:rotate-12 transition-all duration-300 group">
                                    <TbArrowsExchange className="group-hover:animate-spin" />
                                </span>
                                <span className="text-gray-700 dark:text-gray-300 font-semibold text-lg transition-all duration-300 hover:text-[#3778D6] dark:hover:text-blue-400">Conversation Info</span>
                            </div>

                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2 transition-all duration-300 hover:scale-105">
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">Member(s)</span>
                                    <span className="bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 text-blue-700 dark:text-blue-200 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition-all duration-300 hover:shadow-md hover:scale-110 animate-pulse">2</span>
                                </div>
                                <div className='flex items-center space-x-2 transition-all duration-300 hover:scale-105'>
                                    <span className='text-[#3778D6] dark:text-blue-400 text-2xl p-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 transition-all duration-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:scale-110 hover:rotate-12'><IoMdContacts /></span>
                                    <span className="bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 text-blue-700 dark:text-blue-200 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition-all duration-300 hover:shadow-md hover:scale-110 animate-pulse">2</span>
                                </div>
                            </div>
                        </div>

                        {/* Member List */}
                        <div className="flex-1 p-6 space-y-4">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] group animate-slideInLeft">
                                <div className="flex items-center space-x-4">
                                    <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-green-600 rounded-full shadow-sm animate-pulse group-hover:animate-bounce"></div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 transition-all duration-300 group-hover:text-green-600 dark:group-hover:text-green-400">Me</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center space-x-1">
                                            <span>Online</span>
                                            <div className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-ping"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] group animate-slideInLeft" style={{ animationDelay: '200ms' }}>
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-600 dark:to-slate-500 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-110 group-hover:rotate-12">
                                        <span className="text-sm text-gray-600 dark:text-gray-300 transition-all duration-300 group-hover:scale-110">📞</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 transition-all duration-300 group-hover:text-[#3778D6] dark:group-hover:text-blue-400">{selectedContact.phone}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium transition-all duration-300 group-hover:text-gray-700 dark:group-hover:text-gray-300">{selectedContact.name}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Calling UI Overlay */}
            {/* Call Overlay Component */}

            {/* Dialer Modal */}
            {showDialer && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all duration-300 scale-95 animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">New Conversation</h3>
                            <button
                                onClick={() => {
                                    setShowDialer(false);
                                    setDialedNumber('');
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200"
                            >
                                <IoClose size={20} />
                            </button>
                        </div>

                        {/* Number Input */}
                        <div className="mb-6">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Enter phone number"
                                    value={dialedNumber}
                                    onChange={(e) => setDialedNumber(e.target.value)}
                                    className="w-full p-3 pr-10 text-center text-lg font-mono border-2 border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 shadow-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                />
                                {dialedNumber && (
                                    <button
                                        onClick={handleBackspace}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-all duration-200"
                                    >
                                        <MdBackspace size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[
                                { number: '1', letters: '' },
                                { number: '2', letters: 'ABC' },
                                { number: '3', letters: 'DEF' },
                                { number: '4', letters: 'GHI' },
                                { number: '5', letters: 'JKL' },
                                { number: '6', letters: 'MNO' },
                                { number: '7', letters: 'PQRS' },
                                { number: '8', letters: 'TUV' },
                                { number: '9', letters: 'WXYZ' },
                                { number: '*', letters: '' },
                                { number: '0', letters: '+' },
                                { number: '#', letters: '' },
                            ].map((key) => (
                                <button
                                    key={key.number}
                                    onClick={() => handleKeypadPress(key.number)}
                                    className="w-full h-14 bg-gradient-to-b from-white to-gray-50 dark:from-slate-600 dark:to-slate-700 hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-500 dark:hover:to-slate-600 rounded-xl flex flex-col items-center justify-center text-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-1 active:scale-95 border border-gray-200 dark:border-slate-500"
                                >
                                    <span className="text-xl text-gray-800 dark:text-gray-100">{key.number}</span>
                                    {key.letters && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            {key.letters}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={handleStartNewConversation}
                            disabled={!dialedNumber.trim()}
                            className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${dialedNumber.trim()
                                ? 'bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 hover:from-[#2a5aa0] hover:to-[#1e4080] dark:hover:from-blue-500 dark:hover:to-blue-700 text-white cursor-pointer'
                                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Start Conversation
                        </button>
                    </div>
                </div>
            )}


            {toast?.show && (
                <div className={`fixed top-4 right-4 z-[10001] px-4 py-2 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                    {toast.message}
                </div>
            )}
            {/* Alert Modals */}

            {/* Single Message Delete Confirmation */}
            <AlertModal
                isOpen={showSingleMessageDeleteAlert}
                onClose={() => {
                    setShowSingleMessageDeleteAlert(false);
                    setMessageToDelete(null);
                }}
                onConfirm={handleSingleMessageDelete}
                title="Delete Message"
                message="Are you sure you want to delete this message?"
                type="warning"
                confirmText="Delete Message"
                cancelText="Cancel"
                showCancel={true}
            />

            {/* Delete Conversation Confirmation */}
            <AlertModal
                isOpen={showDeleteConversationAlert}
                onClose={() => setShowDeleteConversationAlert(false)}
                onConfirm={handleDeleteConversation}
                title="Delete Conversation"
                message={`Are you sure you want to delete the entire conversation with ${selectedContact?.name}? This action cannot be undone.`}
                type="warning"
                confirmText="Delete Conversation"
                cancelText="Cancel"
                showCancel={true}
            />

            {/* Delete Messages Confirmation */}
            <AlertModal
                isOpen={showDeleteMessagesAlert}
                onClose={() => setShowDeleteMessagesAlert(false)}
                onConfirm={handleDeleteSelectedMessages}
                title="Delete Messages"
                message={`Are you sure you want to delete ${selectedMessages.size} selected message${selectedMessages.size !== 1 ? 's' : ''}?`}
                type="warning"
                confirmText="Delete Messages"
                cancelText="Cancel"
                showCancel={true}
            />

            {/* End Call Confirmation */}
            <AlertModal
                isOpen={showEndCallAlert}
                onClose={() => setShowEndCallAlert(false)}
                onConfirm={confirmEndCall}
                title="End Call"
                message="Are you sure you want to end this call?"
                type="warning"
                confirmText="End Call"
                cancelText="Continue"
                showCancel={true}
            />

            {/* Delete Contacts Confirmation */}
            <AlertModal
                isOpen={showDeleteAlert}
                onClose={() => setShowDeleteAlert(false)}
                onConfirm={confirmDeleteContacts}
                title="Delete Contacts"
                message={`Are you sure you want to delete ${selectedContacts.size} selected contact${selectedContacts.size !== 1 ? 's' : ''}?`}
                type="warning"
                confirmText="Delete"
                cancelText="Cancel"
                showCancel={true}
            />

            {/* Phone System Not Ready */}
            <AlertModal
                isOpen={showPhoneSystemAlert}
                onClose={() => setShowPhoneSystemAlert(false)}
                title="Phone System"
                message="Phone system not ready. Please wait a moment and try again."
                type="warning"
                confirmText="OK"
            />

            {/* Contact Save Result */}
            <AlertModal
                isOpen={showContactSaveAlert}
                onClose={() => setShowContactSaveAlert(false)}
                title="Contact"
                message={contactSaveMessage}
                type={contactSaveMessage.includes('successfully') ? 'success' : 'error'}
                confirmText="OK"
            />
            {/* Delete Contact Confirmation */}
            <AlertModal
                isOpen={showDeleteContactAlert}
                onClose={() => {
                    setShowDeleteContactAlert(false);
                    setContactToDelete(null);
                }}
                onConfirm={handleDeleteContact}
                title="Delete Conversation"
                message={`Are you sure you want to delete the conversation with ${contactToDelete?.name}? This will remove all messages.`}
                type="warning"
                confirmText="Delete Conversation"
                cancelText="Cancel"
                showCancel={true}
            />




            {/* Context Menu */}
            {contextMenu?.show && (
                <div
                    className="fixed z-[10000] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-600 py-2 min-w-[160px]"
                    style={{
                        left: `${Math.min(contextMenu.x, window.innerWidth - 180)}px`,
                        top: `${Math.min(contextMenu.y, window.innerHeight - 100)}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => handleContextMenuAction('copy')}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center space-x-2 transition-colors duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Text</span>
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-slate-600" />
                    <button
                        onClick={() => handleContextMenuAction('delete')}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center space-x-2 transition-colors duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Message</span>
                    </button>
                </div>
            )}



            {/* Audio Elements - Fixed for React 19 */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
                {[1, 2, 3, 4, 5].map(lineNum => (
                    <audio
                        key={`remote-line-${lineNum}`}
                        id={`line-${lineNum}-remoteAudio`}
                        autoPlay
                        playsInline
                        controls={false}
                        style={{ width: 1, height: 1 }}
                    />
                ))}
                {[1, 2, 3, 4, 5].map(lineNum => (
                    <audio
                        key={`local-line-${lineNum}`}
                        id={`line-${lineNum}-localAudio`}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        style={{ width: 1, height: 1 }}
                    />
                ))}
            </div>
        </div>
    );
}