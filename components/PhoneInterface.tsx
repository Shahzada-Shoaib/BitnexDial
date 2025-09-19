'use client';
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BiSearchAlt } from "react-icons/bi";
import { BsTelephone, BsTelephoneFill } from "react-icons/bs";
import { MdOutlineCallReceived, MdOutlineCallMade, MdOutlineCallMissed } from "react-icons/md";
import { TbDotsVertical } from "react-icons/tb";
import { PiStarThin, PiStarFill } from "react-icons/pi";
import { IoMdContacts } from "react-icons/io";
import { FiPlay, FiPause, FiDownload, FiPhone } from "react-icons/fi";
import { TbArrowsExchange } from "react-icons/tb";
import { MdBackspace } from "react-icons/md";
import { TbMessage2 } from "react-icons/tb";
import { IoClose } from "react-icons/io5";
import { BsChatText } from "react-icons/bs";
import AlertModal from './AlertModal';
import { useSwitchCallDetection } from './SwitchCallNotification';
import CallOverlay from './CallOverlay';
import RegistrationErrorAlert from './RegistrationErrorAlert';
import { useCallStatus } from '../app/context/callStatusContext';
import PhoneInput from 'react-phone-input-2';



const formatPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return 'Unknown Number';
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length > 6) {
        const areaCode = cleaned.slice(0, 3);
        const exchange = cleaned.slice(3, 6);
        const number = cleaned.slice(6);
        return `(${areaCode}) ${exchange}-${number}`;
    }
    return phoneNumber;
};

declare global {
    interface Window {
        // Enhanced Transfer Functions from phone.js
        transferCallToMe?: (sourceLineNumber: number, targetExtension?: string) => Promise<boolean>;
        takeActiveCall?: () => Promise<boolean>;
        BlindTransfer?: (lineNumber: number, targetNumber: string) => Promise<boolean>;
        AttendedTransfer?: (lineNumber: number, targetNumber: string) => Promise<any>;
        CompleteAttendedTransfer?: (lineNumber: number) => Promise<boolean>;
        CancelAttendedTransfer?: (lineNumber: number) => Promise<boolean>;

        // Enhanced Conference Functions from phone.js
        startInstantConference?: (participantNumber: string) => Promise<string>;
        addConferenceParticipant?: (conferenceId: string, participantNumber: string) => Promise<number>;
        endActiveConference?: (conferenceId: string) => Promise<void>;
        getConferenceInfo?: (conferenceId: string) => any;
        getActiveConferences?: () => any[];
        getAvailableRooms?: () => number;
        AddParticipant?: (lineNumber: number, participantNumber: string) => Promise<number>;
        MergeConference?: (hostLine: number, participantLine: number) => Promise<string>;
        RemoveParticipant?: (hostLine: number, participantLine: number) => Promise<boolean>;
        GetConferenceInfo?: (lineNumber: number) => any;
        createConference?: (hostLine: number, participantLine: number) => Promise<string>;
        endConference?: (conferenceId: string) => Promise<void>;
        isInConference?: (lineNumber: number) => boolean;

        // Transfer Manager Functions
        StartTransferSession?: (lineNumber: number) => boolean;
        CancelTransferSession?: (lineNumber: number) => boolean;

        // Existing functions...
        DialByLine?: (type: 'audio' | 'video', buddy: any, number: string, CallerID?: string, extraHeaders?: string[]) => void;
        ReceiveCall?: (session: any) => void;
        AnswerAudioCall?: (lineNumber: number) => void;
        RejectCall?: (lineNumber: number) => void;
        cancelSession?: (lineNumber: number) => void;
        endSession?: (lineNumber: number) => void;
        getActiveLineNum?: () => number;
        Lines?: any[];

        // Call control functions
        MuteCall?: (lineNumber: number) => void;
        UnmuteCall?: (lineNumber: number) => void;
        HoldCall?: (lineNumber: number) => void;
        UnholdCall?: (lineNumber: number) => void;
        sendDTMF?: (lineNumber: number, digit: string) => void;
        TransferCall?: (lineNumber: number, targetNumber: string) => void;

        // Phone system
        phoneSystem?: any;

        // Audio context for DTMF
        AudioContext?: any;
        webkitAudioContext?: any;

        [key: string]: any;
    }
}
interface CallRecord {
    id: string;
    number: string;
    name: string;
    type: 'missed' | 'incoming' | 'outgoing';
    time: string;
    date: string;
    duration?: string;
    hasVoicemail?: boolean;
    transcript?: string;
    isFavorite?: boolean;
}




interface TransferState {
    isTransferring: boolean;
    transferType: 'blind' | 'attended' | null;
    originalLineNumber: number | null;
    consultationLineNumber: number | null;
    transferTarget: string;
    transferStatus: 'idle' | 'initiating' | 'consulting' | 'ready' | 'completing' | 'completed' | 'failed';
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

// Call state interface - Updated to match ContactsInterface
interface CallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connected' | 'ended' | 'connecting' | 'incoming';
    direction?: 'inbound' | 'outbound';
}
function extractDigits(str: string): string {
    const match = str.match(/\d{7,}/);
    return match ? match[0] : '';
}


export default function PhoneInterface() {
    const [myPhoneNumber, setMyPhoneNumber] = useState("");
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
    const [selectedVoicemail, setSelectedVoicemail] = useState<Voicemail | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'calls' | 'keypad' | 'voicemail' | null | ''>('keypad');
    const [isPlaying, setIsPlaying] = useState(false);
    const [dialedNumber, setDialedNumber] = useState('');
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const router = useRouter()
    const [showTransferPanel, setShowTransferPanel] = useState(false);
    const [transferTarget, setTransferTarget] = useState('');
    const getPrimaryPhoneNumber = (vm: Voicemail): string => {
        return vm.callerid || vm.caller || 'Unknown';
    };

    const [showAddContact, setShowAddContact] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', phone: '', type: 'personal' });
    const [savingContact, setSavingContact] = useState(false);
    const [contacts, setContacts] = useState<{ contact: string, name: string, type: string }[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeCallFilter, setActiveCallFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');
    const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
    const [isLoadingVoicemail, setIsLoadingVoicemail] = useState(false);
    // const [showEndCallAlert, setShowEndCallAlert] = useState(false);
    const [callDuration, setCallDuration] = useState(0);


    // Audio player state for voicemail
    const [currentPlayingVoicemail, setCurrentPlayingVoicemail] = useState<string | null>(null);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // const [hasSeenCallSession, setHasSeenCallSession] = useState(false);

    // Alert modal states
    const [showPhoneSystemAlert, setShowPhoneSystemAlert] = useState(false);
    const [showContactSaveAlert, setShowContactSaveAlert] = useState(false);
    const [contactSaveMessage, setContactSaveMessage] = useState('');
    ///////////////transfer
    ////////////////delete all call logs
    const [totalCallCount, setTotalCallCount] = useState(0); // Track total calls for user
    const [isSelectingAll, setIsSelectingAll] = useState(false); // Loading state for select all
    const [allCallIds, setAllCallIds] = useState<Set<string>>(new Set());
    /////////////////////////////

    const [transferState, setTransferState] = useState<TransferState>({
        isTransferring: false,
        transferType: null,
        originalLineNumber: null,
        consultationLineNumber: null,
        transferTarget: '',
        transferStatus: 'idle'
    });

    //////////////////////dup contact save
    // Add these helper functions with proper TypeScript annotations
    // Replace the existing helper functions with these typed versions

    // Check if contact name already exists
    const isContactNameExists = (name: string): boolean => {
        if (!name.trim()) return false;
        return contacts.some(contact =>
            contact.name.toLowerCase().trim() === name.toLowerCase().trim()
        );
    };

    // Check if phone number already exists
    const isPhoneNumberExists = (phone: string): boolean => {
        if (!phone) return false;
        const normalizePhone = (p: string): string => p.replace(/\D/g, '').replace(/^1/, '');
        const normalizedPhone = normalizePhone(phone);
        return contacts.some(contact => {
            const normalizedExisting = normalizePhone(contact.contact);
            return normalizedExisting === normalizedPhone;
        });
    };

    // Get existing contact by phone number
    const getExistingContactByPhone = (phone: string): { contact: string, name: string, type: string } | null => {
        if (!phone) return null;
        const normalizePhone = (p: string): string => p.replace(/\D/g, '').replace(/^1/, '');
        const normalizedPhone = normalizePhone(phone);
        return contacts.find(contact => {
            const normalizedExisting = normalizePhone(contact.contact);
            return normalizedExisting === normalizedPhone;
        }) || null;
    };

    //////////////////////call history pagination
    const [isLoadingCalls, setIsLoadingCalls] = useState(false);
    const [callsPage, setCallsPage] = useState(1);
    const [hasMoreCalls, setHasMoreCalls] = useState(true);
    const [showMenu, setShowMenu] = useState(false);

    // Auto-refresh calls every 30 seconds when on calls tab
    // Auto-refresh calls every 30 seconds when on calls tab


    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { callActive } = useCallStatus();




    //loading UI
    const [isPhoneSystemLoading, setIsPhoneSystemLoading] = useState(true);
    const [phoneSystemStatus, setPhoneSystemStatus] = useState('Initializing...');
    const [registrationProgress, setRegistrationProgress] = useState(0);


    ///////////keypad tone 
    const playDTMFTone = (digit: string) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            const dtmfTones: { [key: string]: [number, number] } = {
                '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
                '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
                '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
                '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
            };

            const frequencies = dtmfTones[digit];
            if (frequencies) {
                oscillator1.frequency.setValueAtTime(frequencies[0], audioContext.currentTime);
                oscillator2.frequency.setValueAtTime(frequencies[1], audioContext.currentTime);

                oscillator1.connect(gainNode);
                oscillator2.connect(gainNode);
                gainNode.connect(audioContext.destination);

                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

                oscillator1.start();
                oscillator2.start();

                oscillator1.stop(audioContext.currentTime + 0.1);
                oscillator2.stop(audioContext.currentTime + 0.1);

                setTimeout(() => audioContext.close(), 200);
            }
        } catch (error) {
            console.warn('Could not play DTMF tone:', error);
        }
    };

    ////////////////call logs delete
    // Add these new state variables after your existing ones
    const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteType, setDeleteType] = useState<'single' | 'multiple'>('single');
    const [callToDelete, setCallToDelete] = useState<CallRecord | null>(null);
    const [isDeletingCalls, setIsDeletingCalls] = useState(false);
    const [showCallMenu, setShowCallMenu] = useState<string | null>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Check if the click is outside any call menu dropdown
            if (!target.closest('[data-call-menu]')) {
                setShowCallMenu(null);
            }

            // Keep the existing dropdown-container handler for the other menu
            if (!target.closest(".dropdown-container")) {
                setShowMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside); // Use mousedown instead of click
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    // Add these functions before your return statement

    const toggleCallSelection = (callId: string) => {
        const newSelected = new Set(selectedCallIds);
        if (newSelected.has(callId)) {
            newSelected.delete(callId);
        } else {
            newSelected.add(callId);
        }
        setSelectedCallIds(newSelected);

        // Exit selection mode if no items selected
        if (newSelected.size === 0) {
            setIsSelectionMode(false);
        }
    };

    const enterSelectionMode = (callId: string) => {
        setIsSelectionMode(true);
        setSelectedCallIds(new Set([callId]));
    };

    const exitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedCallIds(new Set());
    };

    // REPLACE your current selectAllCalls function with this corrected version:

    const selectAllCalls = async () => {
        setIsSelectingAll(true);
        try {
            // Get all call IDs for the user (not just filtered calls)
            const allIds = await getAllCallIds();
            console.log(`📋 Received ${allIds.length} call IDs from backend`);

            if (allIds.length === 0) {
                alert("No calls found to select.");
                return;
            }

            setAllCallIds(new Set(allIds));
            setSelectedCallIds(new Set(allIds)); // This now contains ALL call IDs
            console.log(`✅ Selected all ${allIds.length} calls`);

            // Update the UI to show all are selected
            if (allIds.length > calls.length) {
                console.log(`📝 Note: ${allIds.length} total calls selected, but only ${calls.length} visible in current view`);
            }
        } catch (error) {
            console.error("❌ Failed to select all calls:", error);
            alert("Failed to select all calls. Please try again.");
        } finally {
            setIsSelectingAll(false);
        }
    };

    const handleSingleCallDelete = (call: CallRecord) => {
        setCallToDelete(call);
        setDeleteType('single');
        setShowDeleteConfirm(true);
    };

    const handleBulkCallDelete = () => {
        if (selectedCallIds.size === 0) {
            alert("No calls selected for deletion.");
            return;
        }
        setDeleteType('multiple');
        setShowDeleteConfirm(true);
    };

    const confirmDeleteCalls = async () => {
        if (!callToDelete && selectedCallIds.size === 0) return;

        setIsDeletingCalls(true);
        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "";
        const cleanMyPhone = myPhoneNumber.replace(/[^\d]/g, "").replace(/^1/, "");

        try {
            if (deleteType === 'single' && callToDelete) {
                // Delete single call (existing logic)
                const response = await fetch(`https://bkpmanual.bitnexdial.com/api/call-history/${callToDelete.id}?myPhoneNumber=${cleanMyPhone}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    setCalls(prev => prev.filter(call => call.id !== callToDelete.id));
                    setSelectedCall(selectedCall?.id === callToDelete.id ? null : selectedCall);
                    // Update total count
                    setTotalCallCount(prev => Math.max(0, prev - 1));
                    console.log('Call deleted successfully:', result);
                } else {
                    const error = await response.json();
                    console.error('Delete failed:', error);
                    alert(error.error || 'Failed to delete call');
                }
            } else if (deleteType === 'multiple' && selectedCallIds.size > 0) {
                // Delete multiple calls
                const response = await fetch('https://bkpmanual.bitnexdial.com/api/call-history/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callIds: Array.from(selectedCallIds),
                        myPhoneNumber: cleanMyPhone
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    const deletedCount = result.deletedCount || 0;

                    // Remove deleted calls from current view
                    setCalls(prev => prev.filter(call => !selectedCallIds.has(call.id)));

                    // Update total count
                    setTotalCallCount(prev => Math.max(0, prev - deletedCount));

                    if (selectedCall && selectedCallIds.has(selectedCall.id)) {
                        setSelectedCall(null);
                    }
                    exitSelectionMode();

                    // Show success message with count
                    alert(`Successfully deleted ${deletedCount} call records.`);

                    // Refresh the call list to show updated data
                    loadCallHistory(1, false);

                    console.log('Calls deleted successfully:', result);
                } else {
                    const error = await response.json();
                    console.error('Bulk delete failed:', error);
                    alert(error.error || 'Failed to delete calls');
                }
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Network error occurred while deleting');
        } finally {
            setIsDeletingCalls(false);
            setShowDeleteConfirm(false);
            setCallToDelete(null);
        }
    };



    // Add this useEffect after your existing useEffects (around line 200):

    useEffect(() => {
        let statusCheckInterval: NodeJS.Timeout;

        const checkPhoneSystemStatus = () => {
            // Check if phone system is ready
            const isSystemReady = window.phoneSystem && window.phoneSystem.initialized;
            const isRegistered = window.isRegistered;
            const registrationState = window.registrationState || 'Unknown';

            console.log('📞 Phone System Status Check:', {
                isSystemReady,
                isRegistered,
                registrationState,
                hasDialerFunction: !!window.DialByLine
            });

            if (isSystemReady && isRegistered) {
                setIsPhoneSystemLoading(false);
                setPhoneSystemStatus('Ready');
                setRegistrationProgress(100);

                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                }
            } else if (registrationState === 'Failed' || registrationState === 'Max Contacts Reached') {
                setIsPhoneSystemLoading(false);
                setPhoneSystemStatus(registrationState);
                setRegistrationProgress(0);

                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                }
            } else {
                // Still loading/initializing
                if (registrationState === 'Connected') {
                    setPhoneSystemStatus('Registering...');
                    setRegistrationProgress(75);
                } else if (registrationState === 'Connecting') {
                    setPhoneSystemStatus('Connecting...');
                    setRegistrationProgress(50);
                } else if (isSystemReady) {
                    setPhoneSystemStatus('Starting connection...');
                    setRegistrationProgress(25);
                } else {
                    setPhoneSystemStatus('Initializing phone system...');
                    setRegistrationProgress(10);
                }
            }
        };

        // Initial check
        checkPhoneSystemStatus();

        // Start periodic checking
        statusCheckInterval = setInterval(checkPhoneSystemStatus, 500);

        // Listen for specific phone system events
        const handlePhoneSystemReady = () => {
            console.log('📞 Phone system ready event received');
            setRegistrationProgress(50);
            setPhoneSystemStatus('Connecting...');
        };

        const handleRegistrationChange = (event: any) => {
            console.log('📞 Registration change:', event.detail);
            const { state, isRegistered } = event.detail;

            if (isRegistered) {
                setIsPhoneSystemLoading(false);
                setPhoneSystemStatus('Ready');
                setRegistrationProgress(100);
            } else if (state === 'Failed') {
                setIsPhoneSystemLoading(false);
                setPhoneSystemStatus('Registration Failed');
                setRegistrationProgress(0);
            } else if (state === 'Max Contacts Reached') {
                setIsPhoneSystemLoading(false);
                setPhoneSystemStatus('Maximum Devices Reached');
                setRegistrationProgress(0);
            }
        };

        window.addEventListener('phoneSystemReady', handlePhoneSystemReady);
        window.addEventListener('sipRegistrationChange', handleRegistrationChange);

        // Cleanup
        return () => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            window.removeEventListener('phoneSystemReady', handlePhoneSystemReady);
            window.removeEventListener('sipRegistrationChange', handleRegistrationChange);
        };
    }, []);




    //     //To prevent from too many triggers of call button in keypad
    // const [callActive, setCallActive] = useState(false);


    //     //To prevent from too many triggers of call button in keypad
    // useEffect(() => {
    //     const checkCallStatus = () => {
    //         const active =
    //             window.Lines &&
    //             Array.isArray(window.Lines) &&
    //             window.Lines.some(line =>
    //                 line &&
    //                 line.SipSession &&
    //                 ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling'].includes(
    //                     (line.SipSession.status || '').toLowerCase()
    //                 )
    //             );

    //         setCallActive(!!active);
    //     };

    //     // Check periodically (e.g. every 500ms)
    //     const interval = setInterval(checkCallStatus, 500);

    //     return () => clearInterval(interval);
    // }, []);




    // Debounced call history refresh function



    const debouncedRefreshCallHistory = useCallback(() => {
        // Clear any existing timeout
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }

        // Set a new timeout for debounced refresh
        refreshTimeoutRef.current = setTimeout(() => {
            if (activeTab === 'calls' && !isRefreshing) {
                console.log('🔄 Auto-refreshing call history after call completion...');
                setIsRefreshing(true);
                loadCallHistory(1, false).finally(() => {
                    setIsRefreshing(false);
                });
            }
        }, 2000); // 2-second debounce delay
    }, [activeTab, isRefreshing]);

    const historyOnCall = () => {
        setRefreshKey(prev => prev + 1); // will trigger useEffect every time
        debouncedRefreshCallHistory();
    };

    // 
    // useEffect(() => {
    //     if (activeTab !== 'calls') return;

    //     const interval = setInterval(() => {
    //         console.log('🔄 Auto-refreshing call history for latest calls...');

    //         const page = 1;
    //         const append = false;
    //         const limit = 50;
    //         const offset = (page - 1) * limit;

    //         const refreshCalls = async () => {
    //             const myPhone =
    //                 localStorage.getItem("myPhoneNumber")?.replace(/[^\d]/g, "").replace(/^1/, "") || "";
    //             if (!myPhone) return;

    //             try {
    //                 const response = await fetch(
    //                     `https://bkpmanual.bitnexdial.com/api/call-history?extension=${myPhone}&limit=${limit}&offset=${offset}`
    //                 );
    //                 const result = await response.json();

    //                 const callData = result.data || result;

    //                 const mapped: CallRecord[] = callData.map((cdr: any, index: number) => {
    //                     const isOutbound = cdr.direction === "outbound";
    //                     const buddyNum = isOutbound ? cdr.callee : cdr.caller;
    //                     const dt = new Date(cdr.start_time);

    //                     const uniqueId = cdr.session_id
    //                         ? `${cdr.session_id}-${cdr.start_time}-${offset + index}`
    //                         : `call-${Date.now()}-${offset + index}-${Math.random()
    //                             .toString(36)
    //                             .substr(2, 9)}`;

    //                     return {
    //                         id: uniqueId,
    //                         number: buddyNum,
    //                         name: buddyNum,
    //                         type:
    //                             cdr.duration === 0
    //                                 ? "missed"
    //                                 : isOutbound
    //                                     ? "outgoing"
    //                                     : "incoming",
    //                         date: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    //                         time: dt.toLocaleTimeString(undefined, {
    //                             hour: "numeric",
    //                             minute: "2-digit",
    //                         }),
    //                         duration: cdr.duration ? `${cdr.duration}s` : undefined,
    //                     };
    //                 });

    //                 if (append) {
    //                     setCalls(prev => [...prev, ...mapped]);
    //                 } else {
    //                     setCalls(mapped);
    //                 }

    //                 setHasMoreCalls(callData.length === limit);
    //                 setCallsPage(page);
    //             } catch (error) {
    //                 console.error("❌ Failed to refresh calls:", error);
    //             }
    //         };

    //         refreshCalls();
    //     }, 5000);

    //     return () => clearInterval(interval);
    // }, [activeTab]);



    //////////////////////////
    //////////////loading phone sys   


    const [dialerReady, setDialerReady] = useState(false);

    useEffect(() => {
        function checkDialer() {
            setDialerReady(!!(window.DialByLine && typeof window.DialByLine === "function"));
        }

        checkDialer();

        // Listen for when phone.js globals become available
        const interval = setInterval(checkDialer, 250);
        return () => clearInterval(interval);
    }, []);


    //////////////////////   




    const { canSwitch } = useSwitchCallDetection();



    const isContactSaved = (number: string | undefined): boolean => {
        if (!number) return false;
        const cleaned = number.replace(/\D/g, "");
        return contacts.some(
            c => c.contact.replace(/\D/g, "") === cleaned
        );
    };

    const handleCopyNumber = (number: string, idx: number) => {
        navigator.clipboard.writeText(number);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 1200);
    };

    const handleCopyMyNumber = () => {
        if (myPhoneNumber) {
            navigator.clipboard.writeText(myPhoneNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
    };




    useEffect(() => {
        const handleCallTransferred = (event: any) => {
            const { fromLine, toExtension, type } = event.detail;
            console.log(`📞 Call transferred from line ${fromLine} to ${toExtension} (${type})`);

            // Show success message
            alert(`Call successfully transferred to extension ${toExtension}`);

            // Close transfer panel
            setShowTransferPanel(false);
        };

        window.addEventListener('callTransferred', handleCallTransferred);

        return () => {
            window.removeEventListener('callTransferred', handleCallTransferred);
        };
    }, []);



    const getContactName = (number: string) => {
        const cleaned = number.replace(/[^\d]/g, "");
        const match = contacts.find(c =>
            c.contact.replace(/[^\d]/g, "") === cleaned
        );
        return match ? match.name : number;
    };


    useEffect(() => {
        if (activeTab === "voicemail") {
            const myExtension = localStorage.getItem("sipUsername") || "";
            setIsLoadingVoicemail(true);
            fetch(`https://bkpmanual.bitnexdial.com/api/voicemails?mailbox=${myExtension}`)
                .then(res => res.json())
                .then(list => {
                    setVoicemails((list || []) as Voicemail[]);
                })
                .catch((error: any) => {
                    console.error('Failed to load voicemails:', error);
                    setVoicemails([]);
                })
                .finally(() => setIsLoadingVoicemail(false));
        }
    }, [activeTab]);






    /////////call history pageination
    const loadCallHistory = async (page = 1, append = false) => {
        if (isLoadingCalls) return;

        setIsLoadingCalls(true);
        try {
            const raw = localStorage.getItem("myPhoneNumber") || "";
            const myPhone = raw.replace(/[^\d]/g, "").replace(/^1/, "");

            if (!myPhone) {
                console.warn("⚠️ No phone number found in localStorage");
                return;
            }

            const limit = 50;
            const offset = (page - 1) * limit;

            console.log(`📞 Loading call history - Page: ${page}, Offset: ${offset}, Phone: ${myPhone}`);

            const response = await fetch(
                `https://bkpmanual.bitnexdial.com/api/call-history?extension=${myPhone}&limit=${limit}&offset=${offset}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const callData = result.data || result;

            // Update total count
            setTotalCallCount(result.total || callData.length);

            if (!Array.isArray(callData)) {
                console.warn("⚠️ Invalid call data format received:", callData);
                return;
            }

            const mapped: CallRecord[] = callData.map((cdr: any, index: number) => {
                const isOutbound = cdr.direction === "outbound";
                const buddyNum = isOutbound ? cdr.callee : cdr.caller;
                const dt = new Date(cdr.start_time);

                const uniqueId = cdr.id.toString();

                return {
                    id: uniqueId,
                    number: buddyNum || 'Unknown',
                    name: buddyNum || 'Unknown',
                    type: cdr.duration === 0 ? "missed" :
                        isOutbound ? "outgoing" : "incoming",
                    date: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                    time: dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                    duration: cdr.duration ? `${cdr.duration}s` : undefined,
                };
            });

            console.log(`📞 Loaded ${mapped.length} call records`);

            if (append) {
                setCalls(prev => {
                    const existingIds = new Set(prev.map(call => call.id));
                    const newCalls = mapped.filter(call => !existingIds.has(call.id));
                    return [...prev, ...newCalls];
                });
            } else {
                setCalls(mapped);
                setCallsPage(1);
            }

            setHasMoreCalls(callData.length === limit);
            if (append) {
                setCallsPage(page);
            }

        } catch (err) {
            console.error("❌ Failed to load call history:", err);
            if (err instanceof Error) {
                console.error("Error details:", err.message);
            }
        } finally {
            setIsLoadingCalls(false);
        }
    };

    // New function to get all call IDs for the user
    const getAllCallIds = async (): Promise<string[]> => {
        try {
            const raw = localStorage.getItem("myPhoneNumber") || "";
            const myPhone = raw.replace(/[^\d]/g, "").replace(/^1/, "");

            if (!myPhone) return [];

            // Get all call IDs (no limit, just IDs)
            const response = await fetch(
                `https://bkpmanual.bitnexdial.com/api/call-history/all-ids?extension=${myPhone}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.callIds || [];
        } catch (error) {
            console.error("❌ Failed to get all call IDs:", error);
            return [];
        }
    };


    // useEffect(() => {
    //     if (activeTab === 'calls') {
    //         setCallsPage(1);
    //         setHasMoreCalls(true);
    //         loadCallHistory(1, false); // Start fresh when switching to calls tab
    //     }
    //     loadContacts();
    // }, [activeTab, handleCallFromHistory]);
    //////////////////////////////////
    useEffect(() => {
        let num = localStorage.getItem("myPhoneNumber") || "";
        num = num.replace(/\D/g, "");
        if (num.length === 11 && num.startsWith("1")) num = num.slice(1);

        if (num.length === 10) {
            setMyPhoneNumber(`(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`);
        } else {
            setMyPhoneNumber(num);
        }
    }, []);




    const loadContacts = async () => {
        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "";
        if (!myPhoneNumber) return;
        const res = await fetch(`https://bkpmanual.bitnexdial.com/api/get-contacts?owner=${myPhoneNumber.replace(/[^\d]/g, "")}`);
        if (res.ok) setContacts(await res.json());
    };

    const filteredCalls = calls.filter(call => {

        // Used contact name if available, otherwise fallback to number
        const contactName = getContactName(call.number);

        const matchesSearch =
            contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            call.number?.includes(searchTerm);


        if (!matchesSearch) return false;

        switch (activeCallFilter) {
            case 'missed':
                return call.type === 'missed';
            case 'incoming':
                return call.type === 'incoming';
            case 'outgoing':
                return call.type === 'outgoing';
            case 'all':
            default:
                return true;
        }
    });


    // const filteredCalls = calls.filter((call) => {
    //   // Use contact name if available, otherwise fallback to number
    //   const contactName = getContactName(call.number);

    //   const matchesSearch =
    //     contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    //     call.number?.includes(searchTerm);

    //   const matchesFilter =
    //     activeCallFilter === "all" ||
    //     (activeCallFilter === "missed" && call.type?.toLowerCase() === "missed") ||
    //     (activeCallFilter === "incoming" && call.type?.toLowerCase() === "incoming") ||
    //     (activeCallFilter === "outgoing" && call.type?.toLowerCase() === "outgoing");

    //   return matchesSearch && matchesFilter;
    // });



    const getCallIcon = (type: string) => {
        switch (type) {
            case 'missed':
                return <MdOutlineCallMissed className="text-red-500" />;
            case 'incoming':
                return <MdOutlineCallReceived className="text-green-500" />;
            case 'outgoing':
                return <MdOutlineCallMade className="text-blue-500" />;
            default:
                return <BsTelephone className="text-gray-500" />;
        }
    };

    const handleKeypadPress = (key: string) => {
        // Play beep sound
        playDTMFTone(key);

        // Auto-format the number as it's typed
        setDialedNumber(prev => {
            const newValue = prev + key;
            return formatPhoneNumberInput(newValue);
        });
    };

    const formatPhoneNumberInput = (value: string) => {
        // Remove all non-digit characters
        const digits = value.replace(/\D/g, '');

        // Format based on length
        if (digits.length <= 3) {
            return digits;
        } else if (digits.length <= 6) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        } else if (digits.length <= 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        } else {
            // For longer numbers, just return the digits
            return digits;
        }
    };
    const handleBackspace = () => {
        setDialedNumber(prev => prev.slice(0, -1));
    };

    // Add this helper function to check global call state
    const isCallActive = () => {
        return window.Lines && Array.isArray(window.Lines) &&
            window.Lines.some(line =>
                line && line.SipSession &&
                ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling'].includes(
                    (line.SipSession.status || '').toLowerCase()
                )
            );
    };







    const cleanPhoneNumber = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');

        if (cleaned.length === 10) {
            return `+1${cleaned}`;
        }
        else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned}`;
        }
        else if (!phoneNumber.startsWith('+')) {
            return `+${cleaned}`;
        }

        return cleaned;
    };

    const formatPhoneForText = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');

        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return cleaned.slice(1);
        }

        return cleaned.length === 10 ? cleaned : phoneNumber;
    };

    const normalizePhoneNumber = (phoneNumber: string): string => {
        if (!phoneNumber) return '';

        // Remove all non-digit characters
        const digitsOnly = phoneNumber.replace(/\D/g, '');

        // Handle different cases:
        // - If 11 digits starting with 1: remove the 1 (US country code)
        // - If 10 digits: use as is
        // - Otherwise: return as is (for international numbers)
        if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            return digitsOnly.slice(1); // Remove leading 1
        } else if (digitsOnly.length === 10) {
            return digitsOnly;
        } else {
            return digitsOnly;
        }
    };

    // Replace the legacy handleCall function with this global version
    const isSelfCall = (dialedNumber: string, myNumber: string): boolean => {
        const normalizedDialed = normalizePhoneNumber(dialedNumber);
        const normalizedMy = normalizePhoneNumber(myNumber);

        return normalizedDialed === normalizedMy;
    };

    // REPLACE the handleCall function in PhoneInterface.tsx with this version:

    const handleCall = () => {
        if (!dialedNumber) return;

        // Check if trying to call own number
        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "";
        if (isSelfCall(dialedNumber, myPhoneNumber)) {
            // Show alert instead of making the call
            setContactSaveMessage("You cannot call your own number.");
            setShowContactSaveAlert(true);
            return;
        }

        const cleanedNumber = cleanPhoneNumber(dialedNumber);

        // ===== DISPATCH TO GLOBAL CALL MANAGER =====
        window.dispatchEvent(new CustomEvent('globalCallStart', {
            detail: { number: dialedNumber, direction: 'outbound' }
        }));
        // ===== END GLOBAL DISPATCH =====

        if (window.DialByLine && typeof window.DialByLine === "function") {
            window.DialByLine('audio', null, cleanedNumber);
        } else {
            console.warn('⚠️ Dialer not ready Refresh the Page');
            setShowPhoneSystemAlert(true);
        }
    };


    const handleCallFromHistory = (phoneNumber: string) => {
        // Check if trying to call own number
        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "";
        if (isSelfCall(phoneNumber, myPhoneNumber)) {
            // Show alert instead of making the call
            setContactSaveMessage("You cannot call your own number.");
            setShowContactSaveAlert(true);
            return;
        }

        const cleanedNumber = cleanPhoneNumber(phoneNumber);
        setDialedNumber(phoneNumber);

        // ===== DISPATCH TO GLOBAL CALL MANAGER =====
        window.dispatchEvent(new CustomEvent('globalCallStart', {
            detail: { number: phoneNumber, direction: 'outbound' }
        }));
        // ===== END GLOBAL DISPATCH =====

        if (window.DialByLine) {
            window.DialByLine('audio', null, cleanedNumber);
        } else {
            console.warn('⚠️ DialByLine function not available');
            setShowPhoneSystemAlert(true);
            setDialedNumber('');
        }
    };




    // const dialCallFromLog = () =>{
    //     // Step 1: Clear the activeTab
    //     setActiveTab('keypad');
    //     setTimeout(() => {
    //         setActiveTab('calls');
    //     }, 1000); // Delay ensures React processes the change
    // };

    // Event listeners for call completion to trigger automatic refresh
    useEffect(() => {
        const handleCallEnd = (event: any) => {
            console.log('📞 Call ended event detected:', event.detail);
            // Trigger debounced refresh after call ends
            debouncedRefreshCallHistory();
        };

        const handleCallTerminated = (event: any) => {
            console.log('📞 Call terminated event detected:', event.detail);
            // Trigger debounced refresh after call terminates
            debouncedRefreshCallHistory();
        };

        const handleCallEndWithMetrics = (event: any) => {
            console.log('📞 Call end with metrics event detected:', event.detail);
            // Trigger debounced refresh after call ends with metrics
            debouncedRefreshCallHistory();
        };

        // Add event listeners for call completion events
        window.addEventListener('globalCallEnd', handleCallEnd);
        window.addEventListener('callTerminated', handleCallTerminated);
        window.addEventListener('callEndWithMetrics', handleCallEndWithMetrics);

        // Cleanup event listeners on component unmount
        return () => {
            window.removeEventListener('globalCallEnd', handleCallEnd);
            window.removeEventListener('callTerminated', handleCallTerminated);
            window.removeEventListener('callEndWithMetrics', handleCallEndWithMetrics);

            // Clear any pending refresh timeout
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [debouncedRefreshCallHistory]);

    useEffect(() => {
        if (activeTab === 'calls') {
            setCallsPage(1);
            setHasMoreCalls(true);
            loadCallHistory(1, false); // Start fresh when switching to calls tab
        }
        loadContacts();
    }, [activeTab]);




    const handleTextMessage = (phoneNumber: string) => {
        const formattedNumber = formatPhoneForText(phoneNumber);
        router.push(`/text?to=${encodeURIComponent(formattedNumber)}`);
    };



    const handleLongPressStart = (key: string) => {
        if (key === '0') {
            const timer = setTimeout(() => {
                setDialedNumber(prev => prev + '+');
                setIsLongPressing(true);
            }, 500);
            setLongPressTimer(timer);
        }
    };

    const handleLongPressEnd = (key: string) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }

        if (!isLongPressing && key === '0') {
            handleKeypadPress('0');
        }
        setIsLongPressing(false);
    };

    const handleMouseLeave = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
        setIsLongPressing(false);
    };

    // Voicemail player functions
    const handleVoicemailSelect = (voicemail: Voicemail) => {
        setSelectedVoicemail(voicemail);
        setSelectedCall(null); // Clear call selection when voicemail is selected

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            setCurrentPlayingVoicemail(null);
            setIsPlaying(false);
        }
    };

    const handlePlayVoicemail = (voicemail: Voicemail) => {
        if (!voicemail.audio_url) return;

        const audioUrl = `https://bkpmanual.bitnexdial.com${voicemail.audio_url}`;

        // If this voicemail is already playing, pause it
        if (currentPlayingVoicemail === voicemail.id && isPlaying) {
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
            return;
        }

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
        }

        // Create new audio element
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        setCurrentPlayingVoicemail(voicemail.id || '');

        audio.addEventListener('loadedmetadata', () => {
            setAudioDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
            setAudioCurrentTime(audio.currentTime);
            setAudioProgress((audio.currentTime / audio.duration) * 100);
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentPlayingVoicemail(null);
            setAudioProgress(0);
            setAudioCurrentTime(0);
        });

        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            setIsPlaying(false);
            setCurrentPlayingVoicemail(null);
        });

        audio.play()
            .then(() => {
                setIsPlaying(true);
            })
            .catch(error => {
                console.error('Failed to play audio:', error);
                setIsPlaying(false);
                setCurrentPlayingVoicemail(null);
            });
    };

    const handleAudioSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const clickPercent = (clickX / width) * 100;
        const newTime = (clickPercent / 100) * audioDuration;

        audioRef.current.currentTime = newTime;
        setAudioCurrentTime(newTime);
        setAudioProgress(clickPercent);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const [phoneSystemReady, setPhoneSystemReady] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [cursorPosition, setCursorPosition] = useState(0);

    // useEffect(() => {
    //     const checkStatus = () => {
    //         setPhoneSystemReady(window.isPhoneSystemReady());
    //     };

    //     const interval = setInterval(checkStatus, 1000);
    //     checkStatus(); // Initial check

    //     return () => clearInterval(interval);
    // }, []);

    const dialCallFromLog = () => {
        //    location.reload();
        setActiveTab(''); // temporarily invalid
        setTimeout(() => setActiveTab('calls'), 500); // re-set to same value
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest(".dropdown-container")) {
                setShowMenu(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);


    return (
        <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 px-2 sm:px-4">
            <RegistrationErrorAlert />
            <div className="flex flex-col lg:flex-row w-full h-[89vh] mx-auto shadow-2xl dark:shadow-gray-900/50 rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-gray-800">
                {/* Left Panel - Navigation and Call History */}
                <div className="w-full lg:w-80 bg-gradient-to-b from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-800 dark:to-slate-700 h-full lg:h-full flex flex-col shadow-lg border-r-0 lg:border-r border-b lg:border-b-0 border-gray-200 dark:border-slate-600">
                    {/* Header */}
                    <div className="p-4 sm:p-6 bg-gradient-to-r from-[#D3E9E7] to-[#E0F0EE] dark:from-slate-800 dark:to-slate-700">
                        <div className="flex pb-1 items-center border-b-2 border-[#3778D6]/30 dark:border-blue-400/30 justify-between">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                                Phone
                            </h2>
                        </div>
                        {isPhoneSystemLoading && (
                            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm w-full mx-4">
                                    <div className="text-center">
                                        {/* Progress circle only */}
                                        <div className="relative mb-6">
                                            <div className="w-20 h-20 mx-auto">
                                                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                                                    <circle
                                                        cx="40"
                                                        cy="40"
                                                        r="36"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="none"
                                                        className="text-gray-200 dark:text-gray-700"
                                                    />
                                                    <circle
                                                        cx="40"
                                                        cy="40"
                                                        r="36"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="none"
                                                        strokeDasharray={`${2 * Math.PI * 36}`}
                                                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - registrationProgress / 100)}`}
                                                        className="text-[#3778D6] transition-all duration-500 ease-out"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>

                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                            Setting Up Dialer
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                                            {phoneSystemStatus}
                                        </p>

                                        {/* Status Details */}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                                            <div className={`flex items-center justify-center space-x-2 ${registrationProgress >= 25 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                <span className={`w-2 h-2 rounded-full ${registrationProgress >= 25 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                <span>Phone system initialized</span>
                                            </div>
                                            <div className={`flex items-center justify-center space-x-2 ${registrationProgress >= 50 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                <span className={`w-2 h-2 rounded-full ${registrationProgress >= 50 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                <span>Server connection established</span>
                                            </div>
                                            <div className={`flex items-center justify-center space-x-2 ${registrationProgress >= 75 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                <span className={`w-2 h-2 rounded-full ${registrationProgress >= 75 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                <span>Registering with server</span>
                                            </div>
                                            <div className={`flex items-center justify-center space-x-2 ${registrationProgress >= 100 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                <span className={`w-2 h-2 rounded-full ${registrationProgress >= 100 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                <span>Dialer ready for use</span>
                                            </div>
                                        </div>

                                        {/* Error state */}
                                        {(phoneSystemStatus.includes('Failed') || phoneSystemStatus.includes('Maximum')) && (
                                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                                                <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                                                    {phoneSystemStatus === 'Maximum Devices Reached'
                                                        ? 'Please log out from another device to continue.'
                                                        : 'Please refresh the page or check your connection.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Tabs */}
                        <div className="flex justify-between mt-3 sm:mt-4 gap-1 sm:gap-0">
                            {[
                                { id: 'keypad', label: 'Keypad' },
                                { id: 'calls', label: 'Calls' },
                                { id: 'voicemail', label: 'Voicemail' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        // Clear selected call/voicemail when switching tabs
                                        if (tab.id === 'keypad') {
                                            setSelectedCall(null);
                                            setSelectedVoicemail(null);
                                        } else if (tab.id === 'calls') {
                                            setSelectedVoicemail(null);
                                        } else if (tab.id === 'voicemail') {
                                            setSelectedCall(null);
                                        }
                                    }}
                                    className={`px-1 mx-1 sm:px-2 py-1 text-xs sm:text-sm font-semibold rounded-lg flex-1 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-600 text-[#3778D6] dark:text-blue-400 border-2 border-[#3778D6] dark:border-blue-400 shadow-lg'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-[#3778D6] dark:hover:text-blue-400 bg-white/50 dark:bg-slate-600/50 hover:bg-white dark:hover:bg-slate-600 border-2 border-transparent'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search and Filter - Only show for calls tab */}
                        {activeTab === 'calls' && (
                            <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
                                <div className="p-1 bg-white/30 dark:bg-slate-700/30 rounded-lg sm:rounded-xl shadow-inner border border-white/50 dark:border-slate-600/50 transform transition-all duration-300 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:shadow-lg hover:scale-[1.02]">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                        <div className="flex-1 relative group">
                                            <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 transform text-[#929292] dark:text-gray-400 transition-all duration-300 group-hover:text-[#3778D6] dark:group-hover:text-blue-400 group-hover:scale-110" >
                                                <BiSearchAlt className="text-sm sm:text-base" />
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Search Calls"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg transform focus:scale-[1.02] hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                            />
                                        </div>
                                    </div>
                                </div>


                                 {/* Filter Tabs */}
                                 <div className="grid grid-cols-4 gap-1">
                                    {[
                                        { id: 'all', label: 'ALL', count: calls.length },
                                        { id: 'missed', label: 'MISSED', count: calls.filter(c => c.type === 'missed').length },
                                        { id: 'incoming', label: 'INCOMING', count: calls.filter(c => c.type === 'incoming').length },
                                        { id: 'outgoing', label: 'OUTGOING', count: calls.filter(c => c.type === 'outgoing').length },
                                    ].map((filter) => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setActiveCallFilter(filter.id as any)}
                                            className={`px-1 py-1 text-[11px] font-bold rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border-2 transform hover:scale-105 hover:-translate-y-1 active:scale-95 flex flex-col items-center space-y-1 ${activeCallFilter === filter.id
                                                ? 'bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 text-white border-[#3778D6] dark:border-blue-400 shadow-lg scale-105'
                                                : 'text-gray-600 dark:text-gray-300 hover:text-[#3778D6] dark:hover:text-blue-400 bg-white/50 dark:bg-slate-600/50 hover:bg-white dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600 hover:border-[#3778D6]/30 dark:hover:border-blue-400/30'
                                                }`}
                                        >
                                            <span>{filter.label}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${activeCallFilter === filter.id
                                                ? 'bg-white/20 text-white'
                                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                                                }`}>
                                                {filter.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                
                            </div>

                            
                        )}
                    </div>

                    {/* Content - Show keypad when keypad tab is active, call list when calls tab is active */}
                    <div className="flex-1 overflow-y-auto">
                    {activeTab === 'keypad' && (
                      /* Keypad in sidebar */
                        <div className="mt-10  p-5 bg-white/20 dark:bg-slate-700/20 rounded-2xl m-3 shadow-lg border border-white/30 dark:border-slate-600/30">
                            <div className="mb-3">
                                <div
                                    className="text-center mb-4 md:mb-1 p-2.5 bg-white/50 dark:bg-slate-600/50 rounded-lg shadow-inner cursor-pointer select-all"
                                    title="Click to copy your number"
                                    onClick={handleCopyMyNumber}
                                >
                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                                        My Caller ID: {myPhoneNumber || "Unknown"}
                                    </span>
                                    {copied && (
                                        <span className="ml-2 text-green-600 dark:text-green-400 font-semibold text-xs animate-fadeIn">
                                            Copied!
                                        </span>
                                    )}
                                </div>

                                <div className="relative mb-16 md:mb-0">
                                    <input
                                        ref={inputRef}
                                        type="tel"
                                        placeholder="Enter Number"
                                        value={dialedNumber}
                                        onChange={(e) => {
                                            // Only allow numbers, +, -, (, ), and spaces
                                            const value = e.target.value.replace(/[^0-9+\-\(\)\s]/g, '');
                                            setDialedNumber(value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && dialedNumber && !isCallActive()) {
                                                e.preventDefault();
                                                handleCall();
                                            }
                                        }}
                                        className="w-full p-2.5 pr-10 text-center text-lg font-mono border-2 border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 shadow-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-5 justify-items-center">
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
                                        onClick={() => key.number !== '0' && handleKeypadPress(key.number)}
                                        onMouseDown={() => handleLongPressStart(key.number)}
                                        onMouseUp={() => handleLongPressEnd(key.number)}
                                        onMouseLeave={handleMouseLeave}
                                        onTouchStart={() => handleLongPressStart(key.number)}
                                        onTouchEnd={() => handleLongPressEnd(key.number)}
                                        className={`w-11 h-11 p-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-600 dark:to-slate-700 hover:from-gray-50 hover:to-gray-100 dark:hover:from-slate-500 dark:hover:to-slate-600 rounded-2xl flex flex-col items-center justify-center text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95 border border-gray-200 dark:border-slate-500 ${key.number === '0' ? 'relative' : ''
                                            }`}
                                        title={key.number === '0' ? 'Hold for +' : ''}
                                    >
                                        <span className="text-xl text-gray-800 dark:text-gray-100">{key.number}</span>
                                        {key.letters && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                {key.number === '0' ? '+' : key.letters}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-center justify-items-center">
                                                        <button
                                                            onClick={() => {
                                                                if (dialedNumber) {
                                                                    handleTextMessage(dialedNumber);
                                                                }
                                                            }}
                                                            disabled={!dialedNumber}
                                                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border-2
                                                                                ${dialedNumber
                                                                    ? 'bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 cursor-pointer border-blue-500 dark:border-blue-400'
                                                                    : 'bg-gray-200 dark:bg-gray-600 cursor-not-allowed border-gray-300 dark:border-gray-600'
                                                                }`}
                                                            title={dialedNumber ? `Text ${dialedNumber}` : 'Enter a number first'}
                                                        >
                                                            <TbMessage2 className="text-white text-lg" />
                                                        </button>
                                                        <button
                                                            onClick={handleCall}
                                                            disabled={!dialedNumber || isCallActive() || callActive}
                                                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-2 ${dialedNumber && !isCallActive()
                                                                ? 'bg-gradient-to-b from-green-400 to-green-600 dark:from-green-500 dark:to-green-700 hover:from-green-500 hover:to-green-700 dark:hover:from-green-400 dark:hover:to-green-600 cursor-pointer border-green-500 dark:border-green-400'
                                                                : 'bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 cursor-not-allowed border-gray-400 dark:border-gray-600'
                                                                }`}
                                                            title={!dialedNumber ? 'Enter a number first' : isCallActive() ? 'Call in progress' : `Call ${dialedNumber}`}
                                                        >
                                                            <BsTelephoneFill className="text-white text-xl" />
                                                        </button>
                            
                                                        <button
                                                            onClick={handleCall}
                                                            className="w-12 h-12 bg-gradient-to-b from-red-400 to-red-600 dark:from-red-500 dark:to-red-700 hover:from-red-500 hover:to-red-700 dark:hover:from-red-400 dark:hover:to-red-600 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border border-red-500 dark:border-red-400"
                                                            title="Backspace"
                                                        >
                                                            <MdBackspace className="text-white text-lg" />
                                                        </button>
                            </div>
                        </div>
                    )}
                        {activeTab === 'calls' && (
                            <>
                                {/* Main container with proper flex layout */}
                                <div className="flex flex-col h-full">
                                    {/* Sticky Call Summary - positioned outside the scrollable area */}
                                    {/* {calls.length > 0 && (
                                        <div className="sticky top-0 z-20 mx-2 mt-2 mb-0 p-3 bg-white/90 dark:bg-slate-700/90 rounded-xl shadow-sm border border-white/50 dark:border-slate-600/50 backdrop-blur-md">
                                            <div className="text-center">
                                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Call Summary</div>
                                                <div className="grid grid-cols-4 gap-2 text-xs">
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">{calls.length}</span>
                                                        </div>
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">Total</span>
                                                    </div>
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <div className="w-6 h-6 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">{calls.filter(c => c.type === 'missed').length}</span>
                                                        </div>
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">Missed</span>
                                                    </div>
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">{calls.filter(c => c.type === 'incoming').length}</span>
                                                        </div>
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">In</span>
                                                    </div>
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">{calls.filter(c => c.type === 'outgoing').length}</span>
                                                        </div>
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">Out</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )} */}

                                    {/* Scrollable content area */}
                                    <div
                                        className="flex-1 overflow-y-auto px-2 space-y-2"
                                        style={{
                                            msOverflowStyle: 'none',
                                            scrollbarWidth: 'none',
                                            paddingTop: calls.length > 0 ? '8px' : '0' // Add padding only when summary exists
                                        }}
                                        onScroll={(e) => {
                                            const target = e.currentTarget;
                                            const { scrollTop, scrollHeight, clientHeight } = target;
                                            // Load more when scrolled to bottom
                                            if (scrollTop + clientHeight >= scrollHeight - 10 && hasMoreCalls && !isLoadingCalls) {
                                                loadCallHistory(callsPage + 1, true);
                                            }
                                        }}
                                    >
                                        {/* Selection Mode Header */}
                                        {isSelectionMode && (
                                            <div className="mx-2 p-3 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 rounded-xl shadow-lg border border-purple-200 dark:border-purple-700">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <button
                                                            onClick={exitSelectionMode}
                                                            className="p-1 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                                                        >
                                                            <IoClose size={16} />
                                                        </button>
                                                        <span className="text-sm font-bold text-purple-800 dark:text-purple-200">
                                                            {selectedCallIds.size} selected
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={selectAllCalls}
                                                            disabled={selectedCallIds.size === filteredCalls.length}
                                                            className="px-3 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-600 transition-all duration-200 disabled:opacity-50"
                                                        >
                                                            Select All
                                                        </button>

                                                        <button
                                                            onClick={handleBulkCallDelete}
                                                            disabled={selectedCallIds.size === 0}
                                                            className="px-3 py-1 text-xs font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Removed problematic overlay - using click outside handler instead */}

                                        {/* Call List */}
                                        {filteredCalls.length > 0 ? (
                                            filteredCalls.map((call, index) => {
                                                const uniqueKey = `${call.id || 'unknown'}-${call.number.replace(/\D/g, '')}-${call.time}-${call.date}-${index}`;
                                                const isSelected = selectedCallIds.has(call.id);

                                                return (
                                                    <div
                                                        key={uniqueKey}
                                                        className={`flex items-center rounded-xl cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg border ${selectedCall?.id === call.id
                                                            ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50'
                                                            : isSelected
                                                                ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50 border-purple-300 dark:border-purple-600'
                                                                : showCallMenu !== null && showCallMenu !== call.id
                                                                    ? 'bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 pointer-events-none opacity-50'
                                                                    : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                                            }`}
                                                        style={{
                                                            pointerEvents: showCallMenu !== null && showCallMenu !== call.id ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        {/* Selection Checkbox */}
                                                        {isSelectionMode && (
                                                            <div className="pl-4 pr-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleCallSelection(call.id)}
                                                                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    disabled={showCallMenu !== null}
                                                                />
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`flex items-center space-x-4 flex-1 ${isSelectionMode ? 'pl-0' : 'pl-4'} pr-4 py-4`}
                                                            onClick={() => {
                                                                if (showCallMenu !== null) return;
                                                                if (isSelectionMode) {
                                                                    toggleCallSelection(call.id);
                                                                } else {
                                                                    setSelectedCall(call);
                                                                }
                                                            }}
                                                            style={{
                                                                pointerEvents: showCallMenu !== null ? 'none' : 'auto'
                                                            }}
                                                        >
                                                            {/* Call Type Icon */}
                                                            <div className={`text-2xl p-2 rounded-lg shadow-sm ${call.type === 'missed' ? 'bg-red-100 dark:bg-red-900/50' :
                                                                call.type === 'incoming' ? 'bg-green-100 dark:bg-green-900/50' :
                                                                    'bg-blue-100 dark:bg-blue-900/50'
                                                                }`}>
                                                                {getCallIcon(call.type)}
                                                            </div>

                                                            {/* Call Details */}
                                                            <div className="flex-1">
                                                                <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                                                    {getContactName(call.number)}
                                                                </div>
                                                                <div
                                                                    className="text-xs text-gray-600 dark:text-gray-400 font-medium cursor-pointer hover:text-blue-600 transition-all"
                                                                    onClick={(e) => {
                                                                        if (showCallMenu !== null) return;
                                                                        e.stopPropagation();
                                                                        handleCopyNumber(call.number, index);
                                                                    }}
                                                                    title="Click to copy"
                                                                    style={{
                                                                        userSelect: "all",
                                                                        pointerEvents: showCallMenu !== null ? 'none' : 'auto'
                                                                    }}
                                                                >
                                                                    {call.number}
                                                                    {copiedIndex === index && (
                                                                        <span className="ml-2 text-green-600 dark:text-green-400 font-semibold text-xs animate-fadeIn">
                                                                            Copied!
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center space-x-2">
                                                                    <span>{call.time}</span>
                                                                    {call.duration && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-green-600 dark:text-green-400 font-medium">{call.duration}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Action buttons */}
                                                            {!isSelectionMode && (
                                                                <div className="flex items-center space-x-1">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            if (showCallMenu !== null) return;
                                                                            e.stopPropagation();
                                                                            handleCallFromHistory(call.number);
                                                                        }}
                                                                        disabled={isCallActive() || showCallMenu !== null}
                                                                        className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${!isCallActive() && showCallMenu === null
                                                                            ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70 cursor-pointer'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                                            }`}
                                                                        title={isCallActive() ? 'Call in progress' : showCallMenu !== null ? 'Close menu first' : `Call ${call.number}`}
                                                                        style={{
                                                                            pointerEvents: showCallMenu !== null && showCallMenu !== call.id ? 'none' : 'auto'
                                                                        }}
                                                                    >
                                                                        <BsTelephone size={14} />
                                                                    </button>

                                                                    <button
                                                                        onClick={(e) => {
                                                                            if (showCallMenu !== null) return;
                                                                            e.stopPropagation();
                                                                            handleTextMessage(call.number);
                                                                        }}
                                                                        disabled={showCallMenu !== null}
                                                                        className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${showCallMenu === null
                                                                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/70'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                                            }`}
                                                                        title={showCallMenu !== null ? 'Close menu first' : `Text ${call.number}`}
                                                                        style={{
                                                                            pointerEvents: showCallMenu !== null && showCallMenu !== call.id ? 'none' : 'auto'
                                                                        }}
                                                                    >
                                                                        <BsChatText size={14} />
                                                                    </button>

                                                                    {/* Three Dots Menu */}
                                                                    {/* <div className="relative" data-call-menu style={{ zIndex: 9999, pointerEvents: 'auto' }}> */}
                                                                    <div className="relative" data-call-menu style={{ zIndex: 40, pointerEvents: 'auto' }}>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowCallMenu(showCallMenu === call.id ? null : call.id);
                                                                            }}
                                                                            className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${showCallMenu === call.id
                                                                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                                                }`}
                                                                            title="More options"
                                                                            data-call-menu
                                                                        >
                                                                            <TbDotsVertical size={14} />
                                                                        </button>

                                                                        {showCallMenu === call.id && (
                                                                            <div
                                                                                className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                                                                                data-call-menu
                                                                                style={{
                                                                                    zIndex: 45,
                                                                                    backgroundColor: '#ffffff',
                                                                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.15)',
                                                                                    pointerEvents: 'auto'
                                                                                }}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSingleCallDelete(call);
                                                                                        setShowCallMenu(null);
                                                                                    }}
                                                                                    className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                                                                                    data-call-menu
                                                                                    style={{ backgroundColor: '#ffffff' }}
                                                                                >
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                    </svg>
                                                                                    <span className="text-sm font-medium">Delete</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        enterSelectionMode(call.id);
                                                                                        setShowCallMenu(null);
                                                                                    }}
                                                                                    className="w-full px-4 py-3 text-left text-purple-600 hover:bg-purple-50 transition-colors flex items-center space-x-2"
                                                                                    data-call-menu
                                                                                    style={{ backgroundColor: '#ffffff' }}
                                                                                >
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                    </svg>
                                                                                    <span className="text-sm font-medium">Select</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSelectedCall(call);
                                                                                        setNewContact({ ...newContact, phone: call.number });
                                                                                        setShowAddContact(true);
                                                                                        setShowCallMenu(null);
                                                                                    }}
                                                                                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                                                                    data-call-menu
                                                                                    style={{ backgroundColor: '#ffffff' }}
                                                                                >
                                                                                    <IoMdContacts size={16} />
                                                                                    <span className="text-sm font-medium">Add Contact</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {call.hasVoicemail && (
                                                                        <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-300 dark:to-blue-500 rounded-full shadow-lg animate-pulse"></div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : !isLoadingCalls && calls.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                                <div className="bg-white/50 dark:bg-slate-700/50 rounded-xl p-6 shadow-lg border border-white/30 dark:border-slate-600/30">
                                                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">No calls found</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Try adjusting your search terms</p>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Loading indicator */}
                                        {(isLoadingCalls || isRefreshing) && (
                                            <div className="flex justify-center py-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-6 h-6 border-2 border-[#3778D6] border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {isRefreshing ? 'Refreshing calls...' : 'Loading calls...'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* End indicator */}
                                        {!hasMoreCalls && calls.length > 0 && (
                                            <div className="text-center py-4 text-xs text-gray-500">
                                                No more calls to load
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>

                        )}

                        {activeTab === 'voicemail' && (
                            <div className="space-y-3">
                                {/* Voicemail Header Summary */}
                                {voicemails.length > 0 && (
                                    <div className="mx-2 mt-2 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl shadow-lg border border-purple-200/50 dark:border-purple-700/30">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center space-x-2 mb-3">
                                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                                    <span className="text-white text-lg">📬</span>
                                                </div>
                                                <div className="text-sm font-bold text-purple-800 dark:text-purple-200">Voicemail Summary</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 text-xs">
                                                <div className="flex flex-col items-center space-y-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                                                        <span className="text-white text-sm font-bold">{voicemails.length}</span>
                                                    </div>
                                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Total</span>
                                                </div>
                                                <div className="flex flex-col items-center space-y-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                        <span className="text-white text-sm font-bold">{voicemails.filter(vm => vm.read === "0").length}</span>
                                                    </div>
                                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Unread</span>
                                                </div>
                                                <div className="flex flex-col items-center space-y-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                                                        <span className="text-white text-sm font-bold">{voicemails.filter(vm => vm.read === "1").length}</span>
                                                    </div>
                                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Read</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State */}
                                {isLoadingVoicemail ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <div className="bg-white/60 dark:bg-slate-700/60 rounded-2xl p-8 shadow-xl border border-white/50 dark:border-slate-600/50 backdrop-blur-sm">
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="relative">
                                                    <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-700 rounded-full"></div>
                                                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Loading Voicemails</h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we fetch your messages...</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : voicemails.length === 0 ? (
                                    /* Empty State */
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-slate-600/30 max-w-sm w-full text-center">
                                            <div className="mb-6">
                                                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 rounded-3xl mx-auto flex items-center justify-center shadow-lg">
                                                    <span className="text-4xl">📭</span>
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">No Voicemails</h3>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                                You don't have any voicemail messages yet. When someone leaves you a message, it will appear here.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Voicemail List */
                                    <div className="px-2 space-y-3">
                                        {voicemails.map((vm, index) => (
                                            // <div
                                            //     key={vm.id || index}
                                            //     onClick={() => handleVoicemailSelect(vm)}
                                            //     className={`border-8 flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border ${selectedVoicemail?.id === vm.id
                                            //         ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50 border-purple-300 dark:border-purple-600 shadow-purple-200/50 dark:shadow-purple-800/50'
                                            //         : vm.read === "0"
                                            //             ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50'
                                            //             : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                            //         }`}
                                            // >
                                            //     {vm.read === "0" && (
                                            //         <div className="absolute top-3 right-3 w-3 h-3 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-lg animate-pulse ring-2 ring-white dark:ring-slate-800"></div>
                                            //     )}

                                            //     <div className="flex items-center space-x-4 flex-1">
                                            //         <div className={`text-2xl p-2 rounded-lg shadow-sm ${vm.read === "0"
                                            //             ? 'bg-purple-100 dark:bg-purple-900/50'
                                            //             : 'bg-gray-100 dark:bg-gray-700'
                                            //             }`}>
                                            //             <div className={`${vm.read === "0"
                                            //                 ? 'text-purple-600 dark:text-purple-400'
                                            //                 : 'text-gray-500 dark:text-gray-400'
                                            //                 }`}>
                                            //                 📬
                                            //             </div>
                                            //         </div>

                                            //         <div className="flex-1">
                                            //             <div className="flex items-center space-x-2">
                                            //                 <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                            //                     {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(vm)))}
                                            //                 </div>
                                            //                 {vm.read === "0" && (
                                            //                     <span className="px-2 py-0.5 bg-gradient-to-r from-red-400 to-red-500 text-white text-xs font-bold rounded-full shadow-sm animate-pulse">
                                            //                         NEW
                                            //                     </span>
                                            //                 )}
                                            //             </div>

                                            //             <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                            //                 {vm.origtime && Number(vm.origtime) > 1000000000
                                            //                     ? new Date(Number(vm.origtime) * 1000).toLocaleDateString(undefined, {
                                            //                         weekday: 'short',
                                            //                         month: 'short',
                                            //                         day: 'numeric'
                                            //                     })
                                            //                     : 'Unknown date'}
                                            //             </div>
                                            //         </div>

                                            //         <div className="flex items-center space-x-2">
                                            //             <button
                                            //                 onClick={(e) => {
                                            //                     e.stopPropagation();
                                            //                     const phoneNumber = getPrimaryPhoneNumber(vm);
                                            //                     if (phoneNumber && phoneNumber !== 'Unknown') {
                                            //                         handleCallFromHistory(extractDigits(phoneNumber));
                                            //                     }
                                            //                 }}
                                            //                 disabled={isCallActive() || !getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'}
                                            //                 className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-110 ${!isCallActive() && getPrimaryPhoneNumber(vm) && getPrimaryPhoneNumber(vm) !== 'Unknown'
                                            //                     ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70 cursor-pointer'
                                            //                     : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                            //                     }`}
                                            //                 title={isCallActive() ? 'Call in progress' : !getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown' ? 'No number available' : `Call ${formatPhoneNumber(getPrimaryPhoneNumber(vm))}`}
                                            //             >
                                            //                 <BsTelephone size={14} />
                                            //             </button>

                                            //             <button
                                            //                 onClick={(e) => {
                                            //                     e.stopPropagation();
                                            //                     const phoneNumber = getPrimaryPhoneNumber(vm);
                                            //                     if (phoneNumber && phoneNumber !== 'Unknown') {
                                            //                         handleTextMessage(extractDigits(phoneNumber));
                                            //                     }
                                            //                 }}
                                            //                 disabled={!getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'}
                                            //                 className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-110 ${getPrimaryPhoneNumber(vm) && getPrimaryPhoneNumber(vm) !== 'Unknown'
                                            //                     ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/70 cursor-pointer'
                                            //                     : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                            //                     }`}
                                            //                 title={!getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown' ? 'No number available' : `Text ${formatPhoneNumber(getPrimaryPhoneNumber(vm))}`}
                                            //             >
                                            //                 <BsChatText size={14} />
                                            //             </button>

                                            //             <button
                                            //                 onClick={(e) => {
                                            //                     e.stopPropagation();
                                            //                     handlePlayVoicemail(vm);
                                            //                 }}
                                            //                 disabled={!vm.audio_url}
                                            //                 className={`p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-110 ${vm.audio_url
                                            //                     ? currentPlayingVoicemail === vm.id && isPlaying
                                            //                         ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70'
                                            //                         : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/70'
                                            //                     : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                            //                     }`}
                                            //                 title={!vm.audio_url ? 'No audio available' : currentPlayingVoicemail === vm.id && isPlaying ? 'Pause' : 'Play'}
                                            //             >
                                            //                 {currentPlayingVoicemail === vm.id && isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
                                            //             </button>
                                            //         </div>
                                            //     </div>
                                            // </div>

<div
  key={vm.id || index}
  onClick={() => handleVoicemailSelect(vm)}
  className={`relative border-2 sm:border-8 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border ${
    selectedVoicemail?.id === vm.id
      ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50 border-purple-300 dark:border-purple-600 shadow-purple-200/50 dark:shadow-purple-800/50'
      : vm.read === "0"
        ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50'
        : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
  }`}
>
  {vm.read === "0" && (
    <div className="absolute top-2 right-2 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-lg animate-pulse ring-2 ring-white dark:ring-slate-800" />
  )}

  {/* LEFT: image/icon */}
  <div className="shrink-0">
    <div className={`h-10 w-10 sm:h-12 sm:w-12 grid place-items-center rounded-lg shadow-sm ${
      vm.read === "0" ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-700'
    }`}>
      <div className={`${vm.read === "0" ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} text-xl sm:text-2xl`}>
        📬
      </div>
    </div>
  </div>

  {/* RIGHT: number + date + actions */}
  <div className="flex-1 min-w-0">
    {/* Top row: number + NEW + date (date aligned to the right) */}
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex items-center gap-2">
        <div className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">
          {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(vm)))}
        </div>
        {vm.read === "0" && (
          <span className="px-2 py-0.5 bg-gradient-to-r from-red-400 to-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full shadow-sm animate-pulse">
            NEW
          </span>
        )}
      </div>

      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {vm.origtime && Number(vm.origtime) > 1000000000
          ? new Date(Number(vm.origtime) * 1000).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
          : 'Unknown date'}
      </div>
    </div>

    {/* Bottom row: action icons */}
    <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">
      <button
        onClick={(e) => {
          e.stopPropagation();
          const phoneNumber = getPrimaryPhoneNumber(vm);
          if (phoneNumber && phoneNumber !== 'Unknown') {
            handleCallFromHistory(extractDigits(phoneNumber));
          }
        }}
        disabled={isCallActive() || !getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'}
        className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${
          !isCallActive() && getPrimaryPhoneNumber(vm) && getPrimaryPhoneNumber(vm) !== 'Unknown'
            ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`}
        title={
          isCallActive()
            ? 'Call in progress'
            : !getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'
              ? 'No number available'
              : `Call ${formatPhoneNumber(getPrimaryPhoneNumber(vm))}`
        }
      >
        <BsTelephone size={12} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          const phoneNumber = getPrimaryPhoneNumber(vm);
          if (phoneNumber && phoneNumber !== 'Unknown') {
            handleTextMessage(extractDigits(phoneNumber));
          }
        }}
        disabled={!getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'}
        className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${
          getPrimaryPhoneNumber(vm) && getPrimaryPhoneNumber(vm) !== 'Unknown'
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`}
        title={
          !getPrimaryPhoneNumber(vm) || getPrimaryPhoneNumber(vm) === 'Unknown'
            ? 'No number available'
            : `Text ${formatPhoneNumber(getPrimaryPhoneNumber(vm))}`
        }
      >
        <BsChatText size={12} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePlayVoicemail(vm);
        }}
        disabled={!vm.audio_url}
        className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md ${
          vm.audio_url
            ? currentPlayingVoicemail === vm.id && isPlaying
              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
              : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`}
        title={!vm.audio_url ? 'No audio available' : currentPlayingVoicemail === vm.id && isPlaying ? 'Pause' : 'Play'}
      >
        {currentPlayingVoicemail === vm.id && isPlaying ? <FiPause size={12} /> : <FiPlay size={12} />}
      </button>
    </div>
  </div>
</div>



                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Main Content Area */}
                <div className="hidden md:flex flex-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full lg:h-full shadow-inner">
                    {selectedCall ? (
                        <>
                            {/* Call Details Header */}
                            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{getContactName(selectedCall?.number)}</h2>
                                        <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">({selectedCall?.number.replace(/[()]/g, '')})</span>
                                        <div className="flex space-x-2">
                                            {/* <button className="text-xl sm:text-2xl text-amber-400 dark:text-amber-300 hover:text-amber-500 dark:hover:text-amber-200 transition-colors p-1 sm:p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 shadow-sm">
                                                {selectedCall?.isFavorite ? <PiStarFill /> : <PiStarThin />}
                                            </button> */}
                                            <button className="text-xl sm:text-2xl text-[#3778D6] dark:text-blue-400 hover:text-[#2a5aa0] dark:hover:text-blue-300 transition-colors p-1 sm:p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-sm">
                                                <IoMdContacts />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 sm:space-x-4">
                                        <button
                                            onClick={() => handleCallFromHistory(selectedCall.number)}
                                            disabled={isCallActive()}
                                            className={`p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${!isCallActive()
                                                ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 cursor-pointer'
                                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                                }`}
                                            title={isCallActive() ? 'Call in progress' : `Call ${selectedCall.number}`}
                                        >
                                            <BsTelephone size={16} className="sm:hidden" />
                                            <BsTelephone size={20} className="hidden sm:block" />
                                        </button>
                                        <button
                                            onClick={() => handleTextMessage(selectedCall.number)}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                                            title={`Text ${selectedCall.number}`}
                                        >
                                            <BsChatText size={16} className="sm:hidden" />
                                            <BsChatText size={20} className="hidden sm:block" />
                                        </button>
                                        {/* <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5">
                                            <TbDotsVertical size={20} />
                                        </button> */}

                                        <div className="relative dropdown-container">
                                            <button
                                                onClick={() => setShowMenu(!showMenu)}
                                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                                            >
                                                <TbDotsVertical size={16} className="sm:hidden" />
                                                <TbDotsVertical size={20} className="hidden sm:block" />
                                            </button>

                                            {showMenu && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden z-50">
                                                    <button
                                                        onClick={() => {
                                                            // Use selectedCall instead of call since we're in the call details section
                                                            if (selectedCall) {
                                                                setNewContact({ ...newContact, phone: selectedCall.number });
                                                            }
                                                            setShowAddContact(true);
                                                            setShowMenu(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        💾 Save Contact
                                                    </button>
                                                    {/* <button
                                                        onClick={() => {
                                                            setShowAddContact(true); // This can stay the same for edit
                                                            setShowMenu(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        ✏️ Edit Contact
                                                    </button> */}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* Call Details Content */}
                            <div className="flex-1 p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 overflow-y-auto animate-fadeIn">
                                <div className="max-w-4xl mx-auto text-center">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] dark:from-[#4a90e2] dark:to-[#3778D6] rounded-2xl sm:rounded-3xl mx-auto mb-4 sm:mb-6 flex items-center justify-center shadow-2xl ring-2 sm:ring-4 ring-white dark:ring-slate-700 transform hover:scale-105 transition-all duration-300">
                                        <span className="text-white text-xl sm:text-3xl font-bold">
                                            {selectedCall.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </span>
                                    </div>

                                    <h3 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3 drop-shadow-sm">{getContactName(selectedCall?.number)}</h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 bg-gray-100 dark:bg-slate-700 px-3 sm:px-4 py-2 rounded-full text-sm sm:text-lg shadow-inner">{selectedCall?.number}</p>

                                    <div className="flex justify-center space-x-3 sm:space-x-6 mb-6 sm:mb-10">
                                        <button
                                            className="group w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl border border-gray-200 dark:border-slate-600 transition-all duration-300 transform hover:-translate-y-1"
                                            title="Save as Contact"
                                            onClick={() => setShowAddContact(true)}
                                        >
                                            <IoMdContacts className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-300" />
                                        </button>


                                        <button
                                            onClick={() => handleCallFromHistory(selectedCall.number)}
                                            disabled={isCallActive()}
                                            className={`group w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 ${!isCallActive()
                                                ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                                                : 'bg-gray-400 cursor-not-allowed'
                                                }`}
                                            title={isCallActive() ? 'Call in progress' : `Call ${selectedCall.number}`}
                                        >
                                            <FiPhone className={`text-lg sm:text-xl text-white ${!isCallActive ? 'group-hover:animate-pulse' : ''}`} />
                                        </button>

                                        <button
                                            onClick={() => handleTextMessage(selectedCall.number)}
                                            className="group w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 hover:bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
                                            <BsChatText className="text-lg sm:text-xl text-white group-hover:animate-pulse" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : selectedVoicemail ? (
                        <>
                            {/* Voicemail Player Header */}
                            <div className="p-6 border-b border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => setSelectedVoicemail(null)}
                                            className="text-gray-600 dark:text-gray-400 hover:text-[#3778D6] dark:hover:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200"
                                        >
                                            <IoClose size={20} />
                                        </button>
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Voicemail from {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(selectedVoicemail)))}</h2>
                                        {selectedVoicemail.read === "0" && (
                                            <span className="px-3 py-1 bg-gradient-to-r from-red-400 to-red-500 text-white text-xs font-bold rounded-full shadow-sm animate-pulse">
                                                NEW
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => {
                                                const phoneNumber = getPrimaryPhoneNumber(selectedVoicemail);
                                                if (phoneNumber && phoneNumber !== 'Unknown') {
                                                    handleCallFromHistory(extractDigits(phoneNumber));
                                                }
                                            }}
                                            disabled={isCallActive() || !getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown'}
                                            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${!isCallActive() && getPrimaryPhoneNumber(selectedVoicemail) && getPrimaryPhoneNumber(selectedVoicemail) !== 'Unknown'
                                                ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 cursor-pointer'
                                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                                }`}
                                            title={isCallActive() ? 'Call in progress' : !getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown' ? 'No number available' : `Call back`}
                                        >
                                            <BsTelephone size={20} />
                                        </button>

                                        <button
                                            onClick={() => {
                                                const phoneNumber = getPrimaryPhoneNumber(selectedVoicemail);
                                                if (phoneNumber && phoneNumber !== 'Unknown') {
                                                    handleTextMessage(extractDigits(phoneNumber));
                                                }
                                            }}
                                            disabled={!getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown'}
                                            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${getPrimaryPhoneNumber(selectedVoicemail) && getPrimaryPhoneNumber(selectedVoicemail) !== 'Unknown'
                                                ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer'
                                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                                }`}
                                            title={!getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown' ? 'No number available' : `Send message`}
                                        >
                                            <BsChatText size={20} />
                                        </button>

                                        <a
                                            href={selectedVoicemail.audio_url ? `https://bkpmanual.bitnexdial.com${selectedVoicemail.audio_url}` : '#'}
                                            download={selectedVoicemail.audio_url ? `voicemail_${getPrimaryPhoneNumber(selectedVoicemail).replace(/\D/g, '')}_${selectedVoicemail.origtime || Date.now()}.wav` : undefined}
                                            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${selectedVoicemail.audio_url
                                                ? 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 cursor-pointer'
                                                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed pointer-events-none'
                                                }`}
                                            title={selectedVoicemail.audio_url ? 'Download voicemail' : 'No audio available'}
                                        >
                                            <FiDownload size={20} />
                                        </a>



                                    </div>
                                </div>
                            </div>

                            {/* Voicemail Player Content */}
                            <div className="flex-1 p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 overflow-y-auto animate-fadeIn">
                                <div className="max-w-4xl mx-auto">
                                    {/* Voicemail Info Card */}
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 mb-8">
                                        <div className="flex items-center space-x-6 mb-6">
                                            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                                <span className="text-white text-2xl">📬</span>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                                    Voicemail from {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(selectedVoicemail)))}
                                                </h3>
                                                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                                    <span>📅 {selectedVoicemail.origtime && Number(selectedVoicemail.origtime) > 1000000000
                                                        ? new Date(Number(selectedVoicemail.origtime) * 1000).toLocaleDateString(undefined, {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })
                                                        : 'Unknown date'}</span>
                                                    <span>⏰ {selectedVoicemail.origtime && Number(selectedVoicemail.origtime) > 1000000000
                                                        ? new Date(Number(selectedVoicemail.origtime) * 1000).toLocaleTimeString()
                                                        : 'Unknown time'}</span>
                                                    {selectedVoicemail.duration && (
                                                        <span>⏱️ {selectedVoicemail.duration}s</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audio Player */}
                                        {selectedVoicemail.audio_url ? (
                                            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6">
                                                <div className="flex items-center space-x-4 mb-4">
                                                    <button
                                                        onClick={() => handlePlayVoicemail(selectedVoicemail)}
                                                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 transform hover:scale-110 ${currentPlayingVoicemail === selectedVoicemail.id && isPlaying
                                                            ? 'bg-red-500 hover:bg-red-600'
                                                            : 'bg-purple-500 hover:bg-purple-600'
                                                            }`}
                                                    >
                                                        {currentPlayingVoicemail === selectedVoicemail.id && isPlaying ?
                                                            <FiPause className="text-white text-xl" /> :
                                                            <FiPlay className="text-white text-xl ml-1" />
                                                        }
                                                    </button>

                                                    <div className="flex-1">
                                                        <div
                                                            className="w-full bg-gray-300 dark:bg-slate-600 h-2 rounded-full cursor-pointer relative overflow-hidden"
                                                            onClick={handleAudioSeek}
                                                        >
                                                            <div
                                                                className="bg-purple-500 h-full rounded-full transition-all duration-100"
                                                                style={{ width: `${audioProgress}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            <span>{formatTime(audioCurrentTime)}</span>
                                                            <span>{formatTime(audioDuration)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-center">
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        {currentPlayingVoicemail === selectedVoicemail.id && isPlaying
                                                            ? '🎵 Playing voicemail...'
                                                            : '🎵 Click play to listen to this voicemail'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6 text-center">
                                                <p className="text-gray-600 dark:text-gray-400">No audio file available for this voicemail.</p>
                                            </div>
                                        )}
                                    </div>


                                </div>
                            </div>
                        </>
                    ) : (
                        /* Default State */
                        <div className=" hidden flex-1 md:flex items-center justify-center p-8">
                            <div className="text-center max-w-md">
                                <div className="mb-10 transform hover:scale-105 transition-all duration-300">
                                    <img src="/contact.png" alt="Phone illustration" className="mx-auto max-w-[40%] h-auto drop-shadow-xl" />
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-slate-700">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                                        {activeTab === 'keypad' && 'Ready to Make a Call'}
                                        {activeTab === 'calls' && 'Call Details'}
                                        {activeTab === 'voicemail' && 'Voicemail Center'}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-md leading-relaxed">
                                        {activeTab === 'keypad' && 'Use the keypad on the left to dial and make calls.'}
                                        {activeTab === 'calls' && 'Select a call from the list to view detailed information.'}
                                        {activeTab === 'voicemail' && 'Select a voicemail to listen and view details.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel - Additional Info */}
                {(selectedCall || selectedVoicemail) && (
                    <div className="w-full lg:w-80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-l-0 lg:border-l-2 border-t lg:border-t-0 border-gray-200 dark:border-slate-600 h-full flex flex-col shadow-xl">
                        <div className="p-4 sm:p-6 border-b-2 border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                            <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                                <span className="font-extrabold cursor-pointer text-[#3778D6] dark:text-blue-400 text-2xl sm:text-4xl p-1 sm:p-2 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/30 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
                                    <TbArrowsExchange />
                                </span>
                                <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm sm:text-lg">
                                    {selectedVoicemail ? 'Voicemail Info' : 'Call Information'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                            {selectedVoicemail ? (
                                <>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Caller Number</h4>
                                        <p className="text-sm sm:text-lg font-mono bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                            {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(selectedVoicemail)))}
                                        </p>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Date & Time</h4>
                                        <p className="text-sm sm:text-lg bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                            {selectedVoicemail.origtime && Number(selectedVoicemail.origtime) > 1000000000
                                                ? new Date(Number(selectedVoicemail.origtime) * 1000).toLocaleString()
                                                : 'Unknown'}
                                        </p>
                                    </div>

                                    {selectedVoicemail.duration && (
                                        <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                            <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Duration</h4>
                                            <p className="text-sm sm:text-lg font-mono bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                                {selectedVoicemail.duration}s
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Status</h4>
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${selectedVoicemail.read === "0" ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></span>
                                            <p className="text-sm sm:text-lg text-gray-900 dark:text-gray-100">
                                                {selectedVoicemail.read === "0" ? 'Unread' : 'Read'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Quick Actions</h4>
                                        <div className="space-y-2 sm:space-y-3">
                                            <button
                                                onClick={() => {
                                                    const phoneNumber = getPrimaryPhoneNumber(selectedVoicemail);
                                                    if (phoneNumber && phoneNumber !== 'Unknown') {
                                                        handleCallFromHistory(extractDigits(phoneNumber));
                                                    }
                                                }}
                                                disabled={isCallActive() || !getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown'}
                                                className={`w-full py-2 sm:py-2 px-3 sm:px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-1 sm:space-x-2 ${!isCallActive() && getPrimaryPhoneNumber(selectedVoicemail) && getPrimaryPhoneNumber(selectedVoicemail) !== 'Unknown'
                                                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                <BsTelephone size={14} className="sm:hidden" />
                                                <BsTelephone size={16} className="hidden sm:block" />
                                                <span className="text-xs sm:text-sm font-medium">Call Back</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const phoneNumber = getPrimaryPhoneNumber(selectedVoicemail);
                                                    if (phoneNumber && phoneNumber !== 'Unknown') {
                                                        handleTextMessage(extractDigits(phoneNumber));
                                                    }
                                                }}
                                                disabled={!getPrimaryPhoneNumber(selectedVoicemail) || getPrimaryPhoneNumber(selectedVoicemail) === 'Unknown'}
                                                className={`w-full py-2 sm:py-2 px-3 sm:px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-1 sm:space-x-2 ${getPrimaryPhoneNumber(selectedVoicemail) && getPrimaryPhoneNumber(selectedVoicemail) !== 'Unknown'
                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                <BsChatText size={14} className="sm:hidden" />
                                                <BsChatText size={16} className="hidden sm:block" />
                                                <span className="text-xs sm:text-sm font-medium">Message</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : selectedCall ? (
                                <>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Phone Number</h4>
                                        <p className="text-sm sm:text-lg font-mono bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">{selectedCall?.number}</p>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Call Type</h4>
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${selectedCall?.type === 'missed' ? 'bg-red-400' :
                                                selectedCall?.type === 'incoming' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                                            <p className="text-sm sm:text-lg capitalize font-medium text-gray-900 dark:text-gray-100">{selectedCall?.type}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Date & Time</h4>
                                        <p className="text-sm sm:text-lg bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">{selectedCall?.date} - {selectedCall?.time}</p>
                                    </div>

                                    {selectedCall?.duration && (
                                        <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                            <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Duration</h4>
                                            <p className="text-sm sm:text-lg font-mono bg-gray-50 dark:bg-slate-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-900 dark:text-gray-100">{selectedCall.duration}</p>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Quick Actions</h4>
                                        <div className="flex space-x-2 sm:space-x-3">
                                            <button
                                                onClick={() => handleCallFromHistory(selectedCall.number)}
                                                disabled={isCallActive()}
                                                className={`flex-1 py-2 px-3 sm:px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-1 sm:space-x-2 ${!isCallActive
                                                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    }`}
                                                title={isCallActive() ? 'Call in progress' : `Call ${selectedCall.number}`}
                                            >
                                                <BsTelephone size={14} className="sm:hidden" />
                                                <BsTelephone size={16} className="hidden sm:block" />
                                                <span className="text-xs sm:text-sm font-medium">Call</span>
                                            </button>
                                            <button
                                                onClick={() => handleTextMessage(selectedCall.number)}
                                                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-3 sm:px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-1 sm:space-x-2"
                                                title={`Text ${selectedCall.number}`}
                                            >
                                                <TbMessage2 size={14} className="sm:hidden" />
                                                <TbMessage2 size={16} className="hidden sm:block" />
                                                <span className="text-xs sm:text-sm font-medium">Text</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>











            {showAddContact && (selectedCall || isCallActive()) && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex justify-center items-center z-50 p-2 sm:p-4 animate-fadeIn">
                    <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 dark:border-slate-600/30 w-full max-w-md transform transition-all duration-500 animate-slideUp hover:shadow-3xl dark:hover:shadow-gray-900/70">
                        {/* Header */}
                        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-200/50 dark:border-slate-600/50 bg-gradient-to-r from-[#D3E9E7]/30 to-[#E0F0EE]/30 dark:from-slate-700/30 dark:to-slate-600/30 rounded-t-2xl sm:rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                                        <IoMdContacts className="text-white text-lg sm:text-xl" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Save Contact</h3>
                                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Add this number to your contacts</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddContact(false)}
                                    disabled={savingContact}
                                    className="p-1 sm:p-2 rounded-lg sm:rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-110 active:scale-95"
                                >
                                    <IoClose size={16} className="sm:hidden" />
                                    <IoClose size={20} className="hidden sm:block" />
                                </button>
                            </div>
                        </div>

                        {/* Form Content */}
                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                            {/* Contact Preview */}
                            <div className="bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-blue-200/30 dark:border-blue-700/30">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                                        <span className="text-white text-sm sm:text-lg font-bold">
                                            {(newContact.name || "")
                                                .split(' ')
                                                .map(n => n[0])
                                                .join('')
                                                .toUpperCase()
                                                .slice(0, 2) || "📞"}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">
                                            {getContactName(selectedCall?.number ?? "")}
                                            {/* {selectedCall?.number} */}
                                            {/* {newContact.name || "New Contact"} */}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-mono">
                                            {newContact.phone}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="space-y-3 sm:space-y-4">
                                {/* Name Input */}
                                <div className="group">
                                    <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 sm:mb-2 uppercase tracking-wide">
                                        Contact Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={`w-full p-3 sm:p-4 pl-10 sm:pl-12 bg-white dark:bg-slate-700 border-2 rounded-lg sm:rounded-xl text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg group-hover:border-gray-300 dark:group-hover:border-slate-500 ${newContact.name.trim() && isContactNameExists(newContact.name)
                                                    ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-2 focus:ring-red-500/20 dark:focus:ring-red-400/20'
                                                    : 'border-gray-200 dark:border-slate-600 focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20'
                                                }`}
                                            placeholder="Enter contact name"
                                            value={newContact.name}
                                            onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                            disabled={savingContact}
                                        />
                                        <div className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                                            <span className="text-sm sm:text-lg">👤</span>
                                        </div>
                                        {newContact.name.trim() && isContactNameExists(newContact.name) && (
                                            <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-red-500">
                                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    {newContact.name.trim() && isContactNameExists(newContact.name) && (
                                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span>A contact with this name already exists</span>
                                        </p>
                                    )}
                                </div>


                                {/* Phone Input */}
                                <div className="group">
                                    <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 sm:mb-2 uppercase tracking-wide">
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <PhoneInput
                                            country={'us'}
                                            value={selectedCall?.number}
                                            onChange={(phone) => setNewContact({ ...newContact, phone })}
                                            disabled={true}
                                            enableSearch={true}
                                            onlyCountries={['us']}
                                            disableCountryCode={false}
                                            disableDropdown={true}
                                            inputClass="w-full p-3 sm:p-4 pl-10 sm:pl-12 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-lg sm:rounded-xl text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg group-hover:border-gray-300 dark:group-hover:border-slate-500 font-mono"
                                        />
                                        <div className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                                            <span className="text-sm sm:text-lg">📞</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ADD THE WARNING SECTION HERE */}
                                {selectedCall && (() => {
                                    const existingContact = getExistingContactByPhone(selectedCall.number);
                                    return existingContact ? (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg sm:rounded-xl p-3 sm:p-4">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <div>
                                                    <p className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                                        This number is already saved as "{existingContact.name}"
                                                    </p>
                                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                                        You can update the existing contact instead of creating a new one.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}



                                {/* Type Selection */}
                                <div className="group">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                        Contact Type
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full p-4 pl-12 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg group-hover:border-gray-300 dark:group-hover:border-slate-500 appearance-none cursor-pointer"
                                            value={newContact.type}
                                            onChange={e => setNewContact({ ...newContact, type: e.target.value })}
                                            disabled={savingContact}
                                        >
                                            <option value="personal">👤 Personal</option>
                                        </select>
                                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                                            <span className="text-lg">🏷️</span>
                                        </div>
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-4 sm:p-6 pt-3 sm:pt-4 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-700 rounded-b-2xl sm:rounded-b-3xl border-t border-gray-200/50 dark:border-slate-600/50">
                            <div className="flex gap-2 sm:gap-3">
                                <button
                                    className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700 text-gray-800 dark:text-gray-200 py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 border border-gray-300 dark:border-slate-500 hover:from-gray-300 hover:to-gray-400 dark:hover:from-slate-500 dark:hover:to-slate-600"
                                    onClick={() => setShowAddContact(false)}
                                    disabled={savingContact}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="flex-1 bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 hover:from-[#2a5aa0] hover:to-[#1e4080] dark:hover:from-blue-500 dark:hover:to-blue-700 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg flex items-center justify-center space-x-1 sm:space-x-2"
                                    disabled={savingContact || newContact.name.trim() === ''}
                                    onClick={async () => {
                                        // Validation checks
                                        if (!newContact.name.trim()) {
                                            setContactSaveMessage("Please enter a contact name.");
                                            setShowContactSaveAlert(true);
                                            return;
                                        }

                                        setSavingContact(true);
                                        const myPhoneNumber = localStorage.getItem('myPhoneNumber') || '';

                                        // Use the contact from either selectedCall or callState
                                        const contactToSave = selectedCall ? {
                                            phone: selectedCall.number,
                                            name: newContact.name.trim() || selectedCall.name
                                        } : {
                                            phone: dialedNumber,
                                            name: newContact.name.trim() || formatPhoneNumber(dialedNumber)
                                        };

                                        // Normalize phone number for comparison
                                        const normalizePhoneForComparison = (phone: string): string => {
                                            return phone.replace(/\D/g, '').replace(/^1/, '');
                                        };

                                        const normalizedNewPhone = normalizePhoneForComparison(contactToSave.phone);

                                        // Check for duplicate name (case-insensitive)
                                        const duplicateName = contacts.find(contact =>
                                            contact.name.toLowerCase().trim() === contactToSave.name.toLowerCase()
                                        );

                                        if (duplicateName) {
                                            setSavingContact(false);
                                            setContactSaveMessage(`A contact named "${duplicateName.name}" already exists.`);
                                            setShowContactSaveAlert(true);
                                            return;
                                        }

                                        // Check for duplicate phone number
                                        const duplicatePhone = contacts.find(contact => {
                                            const normalizedExistingPhone = normalizePhoneForComparison(contact.contact);
                                            return normalizedExistingPhone === normalizedNewPhone;
                                        });

                                        if (duplicatePhone) {
                                            setSavingContact(false);
                                            setContactSaveMessage(`This phone number is already saved as "${duplicatePhone.name}".`);
                                            setShowContactSaveAlert(true);
                                            return;
                                        }

                                        try {
                                            const res = await fetch('https://bkpmanual.bitnexdial.com/api/save-contact', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    myPhoneNumber,
                                                    contactNumber: contactToSave.phone,
                                                    name: contactToSave.name,
                                                    type: newContact.type
                                                })
                                            });

                                            const data = await res.json();
                                            setSavingContact(false);

                                            if (data.success) {
                                                setShowAddContact(false);
                                                setNewContact({ name: '', phone: '', type: 'personal' });
                                                loadContacts();
                                                setContactSaveMessage("Contact saved successfully!");
                                                setShowContactSaveAlert(true);
                                            } else {
                                                setContactSaveMessage(data.error || "Failed to add contact");
                                                setShowContactSaveAlert(true);
                                            }
                                        } catch (error) {
                                            setSavingContact(false);
                                            setContactSaveMessage("Network error occurred while saving contact");
                                            setShowContactSaveAlert(true);
                                        }
                                    }}
                                >
                                    {savingContact ? (
                                        <>
                                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-sm sm:text-base">Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <IoMdContacts className="text-sm sm:text-lg" />
                                            <span className="text-sm sm:text-base">Save Contact</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}










            {/* Alert Modals */}


            <AlertModal
                isOpen={showPhoneSystemAlert}
                onClose={() => setShowPhoneSystemAlert(false)}
                title="Phone System"
                message="Phone system not ready. Please wait a moment and try again."
                type="warning"
                confirmText="OK"
            />

            <AlertModal
                isOpen={showContactSaveAlert}
                onClose={() => setShowContactSaveAlert(false)}
                title="Contact"
                message={contactSaveMessage}
                type={contactSaveMessage.includes('successfully') ? 'success' : 'error'}
                confirmText="OK"
            />

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
            {/* Delete Confirmation Modal - Add before closing main div */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
                        <div className="p-6">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                    Delete Call{deleteType === 'multiple' ? 's' : ''}?
                                </h3>

                                <p className="text-gray-600 dark:text-gray-400">
                                    {deleteType === 'single'
                                        ? `Are you sure you want to delete the call with ${getContactName(callToDelete?.number || '')}? This action cannot be undone.`
                                        : `Are you sure you want to delete ${selectedCallIds.size} selected call${selectedCallIds.size > 1 ? 's' : ''}? This action cannot be undone.`
                                    }
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setCallToDelete(null);
                                    }}
                                    disabled={isDeletingCalls}
                                    className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={confirmDeleteCalls}
                                    disabled={isDeletingCalls}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {isDeletingCalls ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <span>Delete</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
