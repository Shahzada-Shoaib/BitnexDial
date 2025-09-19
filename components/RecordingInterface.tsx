'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BiSearchAlt } from "react-icons/bi";
import { BsTelephone } from "react-icons/bs";
import { TbDotsVertical } from "react-icons/tb";
import { IoMdContacts } from "react-icons/io";
import { FiPlay, FiPause, FiDownload, FiPhone } from "react-icons/fi";
import { TbArrowsExchange } from "react-icons/tb";
import { IoClose } from "react-icons/io5";
import { BsChatText } from "react-icons/bs";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { MdGraphicEq } from "react-icons/md";
import AlertModal from './AlertModal';
import { FiMic, FiMicOff } from "react-icons/fi";
import { BsPlay, BsPause, BsKeyboard, BsStopCircle, BsRecordCircle, BsThreeDotsVertical, BsPerson, BsPersonPlus } from "react-icons/bs";
import { MdVolumeOff, MdVolumeUp } from "react-icons/md";
import { TbTransfer, TbUsers } from "react-icons/tb";
import { useCallStatus } from '../app/context/callStatusContext';
import { useRecordings } from '../hooks/useRecordings';
import { CallRecording } from '../types';



// Global window interface for dialer functions
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
        [key: string]: any;
    }
}

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

//updated 02-07-2025 Wednesday


// Call state interface
interface CallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connected' | 'ended';
}

function extractDigits(str: string): string {
    const match = str.match(/\d{7,}/);
    return match ? match[0] : '';
}

export default function RecordingInterface() {
    const [searchTerm, setSearchTerm] = useState('');
    const [contacts, setContacts] = useState<{ contact: string, name: string, type: string }[]>([]);
    const router = useRouter();
    const { callActive } = useCallStatus();

    // Audio player state for recording
    const [selectedRecording, setSelectedRecording] = useState<CallRecording | null>(null);
    const recordingsPerPage = 10;    const [currentPlayingRecording, setCurrentPlayingRecording] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);


    // Add these new state variables after your existing useState declarations:
    //updated 02-07-2025 Wednesday start
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecordings, setTotalRecordings] = useState(0);
    const [selectedDirection, setSelectedDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [dateRange, setDateRange] = useState({
        from: '',
        to: ''
    });
    const [hasMoreRecordings, setHasMoreRecordings] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);




    const handleDownloadRecording = (recording: CallRecording) => {
        if (!recording.audio_url) {
            console.warn('No audio URL available for download');
            return;
        }

        try {
            // Create the full download URL
            const downloadUrl = `https://bkpmanual.bitnexdial.com${recording.audio_url}`;

            // Create a temporary link element
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = recording.filename || `recording-${recording.id}.wav`;
            link.target = '_blank';

            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`📥 Started download: ${recording.filename}`);
        } catch (error) {
            console.error('Failed to download recording:', error);
        }
    };

const { 
  data: recordings = [], 
  isLoading: isLoadingRecordings, 
  error: recordingsError,
  refetch: refetchRecordings 
} = useRecordings({
  direction: selectedDirection,
  searchTerm,
  dateRange,
  page: currentPage,
  limit: recordingsPerPage
});
    // Add these helper functions:
const handleDirectionFilter = (direction: 'all' | 'inbound' | 'outbound') => {
  setSelectedDirection(direction);
  setCurrentPage(1);
};

const handleDateRangeChange = (from: string, to: string) => {
  setDateRange({ from, to });
  setCurrentPage(1);
};

const clearFilters = () => {
  setSelectedDirection('all');
  setDateRange({ from: '', to: '' });
  setSearchTerm('');
  setCurrentPage(1);
};



    // Replace your filteredRecordings logic with:

    // Replace your filteredRecordings logic with:

    // Add these components for the UI:
    //////////////////////////// updated 02-07-2025 Wednesday end
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
    const [showPhoneSystemAlert, setShowPhoneSystemAlert] = useState(false);


    const getContactName = (number: string) => {
        const cleaned = number.replace(/[^\d]/g, "");
        const match = contacts.find(c =>
            c.contact.replace(/[^\d]/g, "") === cleaned
        );
        return match ? match.name : number;
    };

    // Replace getPrimaryPhoneNumber with this: updated 02-07-2025 Wednesday start 
    const getPrimaryPhoneNumber = (recording: CallRecording): string => {
        return recording.other_party || recording.caller || 'Unknown';
    };

    // Update the selection handler:
    const handleRecordingSelect = (recording: CallRecording) => {
        setSelectedRecording(recording);

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            setCurrentPlayingRecording(null);
            setIsPlaying(false);
        }
    };

    // Update the play handler:
    const handlePlayRecording = (recording: CallRecording) => {
        console.info('Playing recording:', recording);
        if (!recording.audio_url) return;  

        const audioUrl = `https://bkpmanual.bitnexdial.com${recording.audio_url}`;

        // If this recording is already playing, pause it
        if (currentPlayingRecording === recording.id && isPlaying) {
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
        setCurrentPlayingRecording(recording.id);

        audio.addEventListener('loadedmetadata', () => {
            setAudioDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
            setAudioCurrentTime(audio.currentTime);
            setAudioProgress((audio.currentTime / audio.duration) * 100);
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentPlayingRecording(null);
            setAudioProgress(0);
            setAudioCurrentTime(0);
        });

        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            setIsPlaying(false);
            setCurrentPlayingRecording(null);
        });

        audio.play()
            .then(() => {
                setIsPlaying(true);
            })
            .catch(error => {
                console.error('Failed to play audio:', error);
                setIsPlaying(false);
                setCurrentPlayingRecording(null);
            });
    };



    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callState.isActive && callState.startTime) {
            interval = setInterval(() => {
                const now = new Date();
                const duration = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
                setCallDuration(duration);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState.isActive, callState.startTime]);



    // Function to clean and format phone number for dialing
    const cleanPhoneNumber = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');

        if (cleaned.length === 10) {
            return `+1${cleaned}`;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned}`;
        } else if (!phoneNumber.startsWith('+')) {
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

    // Handle call functionality
    // Replace handleCall in RecordingInterface.tsx with this:
    const handleCall = (phoneNumber: string) => {
        const cleanedNumber = cleanPhoneNumber(phoneNumber);
        console.log('📞 Initiating call to:', cleanedNumber);

        // Dispatch to GlobalCallManager instead of local state
        window.dispatchEvent(new CustomEvent('globalCallStart', {
            detail: { number: phoneNumber, direction: 'outbound' }
        }));

        if (window.DialByLine) {
            window.DialByLine('audio', null, cleanedNumber);
        } else {
            console.warn('⚠️ Dialer not ready');
            // You can show a toast notification here instead
            alert('Phone system not ready. Please wait a moment and try again.');
        }
    };

    // Handle text message navigation
    const handleTextMessage = (phoneNumber: string) => {
        // Format phone number for text messaging (10 digits without formatting)
        const cleaned = phoneNumber.replace(/\D/g, '');
        const formattedNumber = cleaned.length === 11 && cleaned.startsWith('1')
            ? cleaned.slice(1)
            : cleaned.length === 10 ? cleaned : phoneNumber;

        console.log('💬 Opening text conversation with:', formattedNumber);
        router.push(`/text?to=${encodeURIComponent(formattedNumber)}`);
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




    // Call Controls State (add to existing useState declarations)
    const [callControls, setCallControls] = useState({
        isMuted: false,
        isOnHold: false,
        isRecording: false,
        showKeypad: false,
        showMoreOptions: false,
        showTransfer: false,
        showConference: false,
        volume: 50,
        conferenceParticipants: [] as string[],
    });

    const [dialpadNumber, setDialpadNumber] = useState('');




    // ===== 2. ADD THESE HELPER FUNCTIONS =====

    // Get the active SIP line number for the current call
    function getCurrentLineNumber(): number {
        if (window.getActiveLineNum && typeof window.getActiveLineNum === 'function') {
            return window.getActiveLineNum();
        }
        if (window.Lines && Array.isArray(window.Lines)) {
            const lineObj = window.Lines.findIndex(line =>
                line && line.SipSession &&
                ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress'].includes(
                    (line.SipSession.status || '').toLowerCase()
                )
            );
            return lineObj >= 0 ? lineObj : -1;
        }
        return -1;
    }

    // Get the current session state (mute/hold, etc) from the real SIP session
    function getSessionState(lineNumber: number) {
        const session = window.Lines?.[lineNumber]?.SipSession;
        return {
            isMuted: session?.isMuted || false,
            isOnHold: session?.isOnHold || false
        };
    }



    // Sync the React callControls state with the actual session state
    function syncSessionState(setCallControls: any) {
        const lineNumber = getCurrentLineNumber();
        if (lineNumber < 0) return;
        const state = getSessionState(lineNumber);
        setCallControls((prev: any) => ({
            ...prev,
            isMuted: state.isMuted,
            isOnHold: state.isOnHold
        }));
    }

    // Play DTMF tones for UI feedback
    function playDTMFTone(digit: string) {
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
        } catch { }
    }



    // Add these missing variables and fix the logic before your return statement: updated 02-07-2025 Wednesday start

    // Fix the filtered recordings logic - remove client-side direction filtering since API handles it
    const filteredRecordings = recordings.filter(recording => {
        const phoneNumber = getPrimaryPhoneNumber(recording);
        const contactName = getContactName(extractDigits(phoneNumber));

        // Only filter by search term, not direction (API handles direction)
        if (searchTerm.trim()) {
            return phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contactName.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });

    // Calculate pagination based on current filtered results
    const totalPages = Math.ceil(filteredRecordings.length / recordingsPerPage);
    const paginatedRecordings = filteredRecordings.slice(
        (currentPage - 1) * recordingsPerPage,
        currentPage * recordingsPerPage
    );

    return (
        <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 px-2 md:px-4">
            <div className="flex w-full h-[90vh] mx-auto shadow-2xl dark:shadow-gray-900/50 rounded-xl md:rounded-3xl overflow-hidden bg-white dark:bg-gray-800 transform transition-all duration-500 hover:shadow-3xl dark:hover:shadow-gray-900/70">

                {/* Left Panel - Recording List */}
                <div className="w-full md:w-80 lg:w-96 bg-gradient-to-b from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-800 dark:to-slate-700 h-full flex flex-col shadow-lg border-r border-gray-200 dark:border-slate-600 transform transition-all duration-300 hover:from-[#C8E6E4] hover:to-[#BAE2E0] dark:hover:from-slate-700 dark:hover:to-slate-600">

                    {/* Header */}
                    <div className="p-3 md:p-4 bg-gradient-to-r from-[#D3E9E7] to-[#E0F0EE] dark:from-slate-800 dark:to-slate-700 transform transition-all duration-300 hover:from-[#E0F0EE] hover:to-[#EDF7F5] dark:hover:from-slate-700 dark:hover:to-slate-600">
                        <div className="flex py-3 md:py-4 items-center border-b-2 border-[#3778D6]/30 dark:border-blue-400/30 justify-between transition-all duration-300 hover:border-[#3778D6]/50 dark:hover:border-blue-400/50">
                            <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mr-2 pl-1.5 flex items-center transform transition-all duration-300 hover:scale-105 hover:text-[#3778D6] dark:hover:text-blue-400">
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 rounded-xl mr-3 flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110 hover:shadow-xl">
                                    <HiOutlineMicrophone className="text-white text-lg md:text-xl" />
                                </div>
                                Recordings
                            </h2>
                        </div>

                        {/* Search and Filters */}
                        <div className="mt-3 md:mt-4 space-y-3">
                            {/* Search Bar */}
                            <div className="p-1 bg-white/30 dark:bg-slate-700/30 rounded-xl shadow-inner border border-white/50 dark:border-slate-600/50 transform transition-all duration-300 hover:bg-white/40 dark:hover:bg-slate-700/40 hover:shadow-lg hover:scale-[1.02]">
                                <div className="w-full flex">
                                    <span className="ml-3 self-center text-lg md:text-xl text-[#929292] dark:text-gray-400 transition-all duration-300 hover:text-[#3778D6] dark:hover:text-blue-400 hover:scale-110" style={{ transform: 'scaleX(-1)' }}>
                                        <BiSearchAlt />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search recordings"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="p-2 text-xs md:text-sm border-2 border-gray-200 dark:border-slate-600 rounded-md focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#3778D6]/20 dark:focus:ring-blue-400/20 transition-all duration-300 flex-1 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            {/* Direction Filter */}
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleDirectionFilter('all')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${selectedDirection === 'all'
                                        ? 'bg-[#3778D6] text-white shadow-md'
                                        : 'bg-white/50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => handleDirectionFilter('inbound')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${selectedDirection === 'inbound'
                                        ? 'bg-green-500 text-white shadow-md'
                                        : 'bg-white/50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
                                        }`}
                                >
                                    INBOUND
                                </button>
                                <button
                                    onClick={() => handleDirectionFilter('outbound')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${selectedDirection === 'outbound'
                                        ? 'bg-blue-500 text-white shadow-md'
                                        : 'bg-white/50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
                                        }`}
                                >
                                    OUTBOUND
                                </button>
                            </div>

                            {/* Date Range Filter */}
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={dateRange.from}
                                    onChange={(e) => handleDateRangeChange(e.target.value, dateRange.to)}
                                    className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400"
                                    placeholder="From date"
                                />
                                <input
                                    type="date"
                                    value={dateRange.to}
                                    onChange={(e) => handleDateRangeChange(dateRange.from, e.target.value)}
                                    className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400"
                                    placeholder="To date"
                                />
                            </div>

                            {/* Clear Filters */}
                            {(selectedDirection !== 'all' || dateRange.from || dateRange.to || searchTerm) && (
                                <button
                                    onClick={clearFilters}
                                    className="w-full px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200"
                                >
                                    Clear All Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recording List */}
                    <div className="flex-1 overflow-y-auto recordings-scroll-container">
                        {/* Recording Header Summary */}
                        {!isLoadingRecordings && recordings.length > 0 && (
                            <div className="mx-2 mt-2 p-3 md:p-4 bg-gradient-to-br from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl shadow-lg border border-[#3778D6]/20 dark:border-blue-400/20">
                                <div className="text-center">
                                    <div className="flex items-center justify-center space-x-2 mb-3">
                                        <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] rounded-xl flex items-center justify-center shadow-lg">
                                            <MdGraphicEq className="text-white text-sm md:text-lg" />
                                        </div>
                                        <div className="text-xs md:text-sm font-bold text-[#3778D6] dark:text-blue-400">
                                            {selectedDirection !== 'all' || dateRange.from || dateRange.to || searchTerm ? 'Filtered Results' : 'Recording Summary'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 md:gap-3 text-xs">
                                        <div className="flex flex-col items-center space-y-1 md:space-y-2">
                                            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] rounded-full flex items-center justify-center shadow-lg">
                                                <span className="text-white text-xs md:text-sm font-bold">{recordings.length}</span>
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-300 font-semibold text-xs">Total</span>
                                        </div>
                                        <div className="flex flex-col items-center space-y-1 md:space-y-2">
                                            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                                                <span className="text-white text-xs md:text-sm font-bold">{recordings.filter(r => r.direction === 'inbound').length}</span>
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-300 font-semibold text-xs">IN</span>
                                        </div>
                                        <div className="flex flex-col items-center space-y-1 md:space-y-2">
                                            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                                                <span className="text-white text-xs md:text-sm font-bold">{recordings.filter(r => r.direction === 'outbound').length}</span>
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-300 font-semibold text-xs">Out</span>
                                        </div>
                                    </div>
                                    {(selectedDirection !== 'all' || dateRange.from || dateRange.to || searchTerm) && (
                                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                            Showing {recordings.length} recordings
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {recordingsError ? (
    <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-white/60 dark:bg-slate-700/60 rounded-2xl p-8 shadow-xl">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-red-500 text-2xl">⚠</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Failed to Load Recordings</h3>
                <button
                    onClick={() => refetchRecordings()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    </div>
) : isLoadingRecordings ? (

                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                <div className="bg-white/60 dark:bg-slate-700/60 rounded-2xl p-6 md:p-8 shadow-xl border border-white/50 dark:border-slate-600/50 backdrop-blur-sm">
                                    <div className="flex flex-col items-center space-y-4">
                                        <div className="relative">
                                            <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-[#D3E9E7] dark:border-slate-600 rounded-full"></div>
                                            <div className="absolute top-0 left-0 w-12 h-12 md:w-16 md:h-16 border-4 border-[#3778D6] border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Loading Recordings</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we fetch your call recordings...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : recordings.length === 0 ? (
                            /* Empty State */
                            <div className="flex flex-col items-center justify-center py-12 md:py-16 px-4">
                                <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20 dark:border-slate-600/30 max-w-sm w-full text-center">
                                    <div className="mb-4 md:mb-6">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-700 dark:to-slate-600 rounded-2xl md:rounded-3xl mx-auto flex items-center justify-center shadow-lg">
                                            <MdGraphicEq className="text-3xl md:text-4xl text-[#3778D6] dark:text-blue-400" />
                                        </div>
                                    </div>
                                    <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">No Recordings</h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                        {searchTerm || selectedDirection !== 'all' || dateRange.from || dateRange.to
                                            ? 'No recordings match your current filters. Try adjusting your search criteria.'
                                            : 'You don\'t have any call recordings yet. When calls are recorded, they will appear here.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="px-2 space-y-2 md:space-y-3 pb-4">
                                {recordings.map((recording: CallRecording, index: number) => (
                                    <div
                                        key={`${recording.id || recording.filename || index}-${index}`}
                                        onClick={() => handleRecordingSelect(recording)}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                        className={`flex items-center p-3 md:p-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border relative animate-slideInLeft group ${selectedRecording?.id === recording.id
                                            ? 'bg-gradient-to-r from-[#D3E9E7] to-[#C5E5E3] dark:from-blue-900/40 dark:to-blue-800/40 border-2 border-[#3778D6] dark:border-blue-400 shadow-blue-300/60 dark:shadow-blue-800/60 scale-[1.02]'
                                            : recording.direction === 'inbound'
                                                ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/50 dark:to-green-800/50 border-green-300 dark:border-green-600 shadow-green-200/50 dark:shadow-green-800/50 hover:scale-[1.01]'
                                                : 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50 hover:scale-[1.01]'
                                            }`}
                                    >
                                        <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                                            <div className={`text-xl md:text-2xl p-2 rounded-lg shadow-sm transition-all duration-300 ${recording.direction === 'inbound'
                                                ? 'bg-green-100 dark:bg-green-900/50'
                                                : 'bg-blue-100 dark:bg-blue-900/50'
                                                }`}>
                                                <div className={`transition-all duration-300 ${recording.direction === 'inbound'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                    <MdGraphicEq />
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    <div className={`font-semibold text-sm text-gray-800 dark:text-gray-200 truncate transition-all duration-300 ${selectedRecording?.id === recording.id ? 'text-[#3778D6] dark:text-blue-400 font-bold' : ''}`}>
                                                        {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(recording)))}
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-white text-xs font-bold rounded-full shadow-sm flex-shrink-0 transition-all duration-300 ${recording.direction === 'inbound' ? 'bg-green-500' : 'bg-blue-500'} ${selectedRecording?.id === recording.id ? 'animate-bounce scale-110' : ''}`}>
                                                        {recording.direction === 'inbound' ? 'IN' : 'OUT'}
                                                    </span>
                                                    {/* Selected checkmark */}
                                                    {selectedRecording?.id === recording.id && (
                                                        <div className="w-5 h-5 bg-[#3778D6] dark:bg-blue-400 rounded-full flex items-center justify-center animate-fadeIn">
                                                            <span className="text-white text-xs font-bold">✓</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                {(() => {
                                                    if (!recording.created_time) return 'Unknown date';
                                                    
                                                    const recordingDate = new Date(recording.created_time * 1000);
                                                    const today = new Date();
                                                    
                                                    // Check if it's today (same date)
                                                    if (recordingDate.toDateString() === today.toDateString()) {
                                                    return 'Today';
                                                    }
                                                    
                                                    // Check if it's yesterday
                                                    const yesterday = new Date();
                                                    yesterday.setDate(yesterday.getDate() - 1);
                                                    if (recordingDate.toDateString() === yesterday.toDateString()) {
                                                    return 'Yesterday';
                                                    }
                                                    
                                                    // Otherwise show month and day
                                                    return recordingDate.toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                    });
                                                })()}
                                                </div>


                                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                                    {Math.round(recording.file_size / 1024)}KB
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center space-x-1 md:space-x-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 flex-shrink-0">
                                                <button
                                                    disabled={callActive}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const phoneNumber = getPrimaryPhoneNumber(recording);
                                                        if (phoneNumber && phoneNumber !== 'Unknown') {
                                                            handleCall(extractDigits(phoneNumber));
                                                        }
                                                    }}
                                                    className="p-1.5 md:p-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 transition-all duration-200"
                                                >
                                                    <BsTelephone size={12} className="md:w-3.5 md:h-3.5" />
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const phoneNumber = getPrimaryPhoneNumber(recording);
                                                        if (phoneNumber && phoneNumber !== 'Unknown') {
                                                            handleTextMessage(extractDigits(phoneNumber));
                                                        }
                                                    }}
                                                    className="p-1.5 md:p-2 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition-all duration-200"
                                                >
                                                    <BsChatText size={12} className="md:w-3.5 md:h-3.5" />
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePlayRecording(recording);
                                                    }}
                                                    disabled={!recording.audio_url}
                                                    className={`p-1.5 md:p-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-110 ${recording.audio_url
                                                        ? currentPlayingRecording === recording.id && isPlaying
                                                            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70'
                                                            : 'bg-[#D3E9E7] dark:bg-blue-900/50 text-[#3778D6] dark:text-blue-400 hover:bg-[#C5E5E3] dark:hover:bg-blue-900/70'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                        }`}
                                                    title={!recording.audio_url ? 'No audio available' : currentPlayingRecording === recording.id && isPlaying ? 'Pause' : 'Play'}
                                                >
                                                    {currentPlayingRecording === recording.id && isPlaying ? <FiPause size={12} className="md:w-3.5 md:h-3.5" /> : <FiPlay size={12} className="md:w-3.5 md:h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Load More Button */}
                                {hasMoreRecordings && (
                                    <div className="p-4 flex justify-center">
                                        <button
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            disabled={isLoadingMore}
                                            className={`px-6 py-2 rounded-lg transition-all duration-200 ${isLoadingMore
                                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                : 'bg-[#3778D6] hover:bg-[#2a5aa0] text-white shadow-md hover:shadow-lg'
                                                }`}
                                        >
                                            {isLoadingMore ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Loading...</span>
                                                </div>
                                            ) : (
                                                'Load More'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                        {/* Right Panel */}
                <div className="hidden md:flex items-center justify-center h-full w-full bg-gray-50 dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-600">
                    <div className="text-center p-6">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 text-blue-600 rounded-full">
                        {/* Microphone Icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 4v8m0 0v4m0-4h4m-4 0H8"
                            />
                        </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                        No Recording Selected
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose a recording from the left to get started
                        </p>
                    </div>
                </div>


                

                


                {/* Middle Panel - Audio Player (only show when recording is selected) */}
                {selectedRecording && (
                    <div className="flex-1 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 h-full flex flex-col animate-slideInRight">
                        {/* Audio Player Header */}
                        <div className="p-6 border-b-2 border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 animate-fadeInDown">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 animate-slideInLeft">Audio Player</h3>
                                <button
                                    onClick={() => setSelectedRecording(null)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-400 transition-all duration-200 hover:rotate-90"
                                >
                                    <IoClose size={20} />
                                </button>
                            </div>

                            <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 animate-fadeIn">
                                {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(selectedRecording)))}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 animate-fadeIn" style={{ animationDelay: '100ms' }}>
                                {selectedRecording.created_time
                                    ? new Date(selectedRecording.created_time * 1000).toLocaleString()
                                    : 'Unknown date'}
                            </div>
                        </div>

                        {/* Audio Controls */}
                        <div className="flex-1 flex flex-col justify-center items-center p-8">
                            {selectedRecording.audio_url ? (
                                <div className="w-full max-w-md space-y-6">
                                    {/* Play/Pause Button */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => handlePlayRecording(selectedRecording)}
                                            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 ${currentPlayingRecording === selectedRecording.id && isPlaying
                                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                                : 'bg-[#3778D6] hover:bg-[#2a5aa0] text-white'
                                                }`}
                                        >
                                            {currentPlayingRecording === selectedRecording.id && isPlaying ?
                                                <FiPause size={32} /> :
                                                <FiPlay size={32} />
                                            }
                                        </button>
                                    </div>

                                    {/* Progress Bar */}
                                    {currentPlayingRecording === selectedRecording.id && (
                                        <div className="space-y-2">
                                            <div
                                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
                                                onClick={handleAudioSeek}
                                            >
                                                <div
                                                    className="h-full bg-[#3778D6] rounded-full transition-all duration-100"
                                                    style={{ width: `${audioProgress}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                                <span>{formatTime(audioCurrentTime)}</span>
                                                <span>{formatTime(audioDuration)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Additional Controls */}
                                    <div className="flex justify-center space-x-4">
                                        <button
                                            onClick={() => {
                                                const phoneNumber = getPrimaryPhoneNumber(selectedRecording);
                                                if (phoneNumber && phoneNumber !== 'Unknown') {
                                                    handleCall(extractDigits(phoneNumber));
                                                }
                                            }}
                                            disabled={callState.isActive || callActive}
                                            className={`px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2 ${!callState.isActive
                                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <BsTelephone size={16} />
                                            <span>Call Back</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                const phoneNumber = getPrimaryPhoneNumber(selectedRecording);
                                                if (phoneNumber && phoneNumber !== 'Unknown') {
                                                    handleTextMessage(extractDigits(phoneNumber));
                                                }
                                            }}
                                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
                                        >
                                            <BsChatText size={16} />
                                            <span>Message</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                                        <MdGraphicEq className="text-2xl text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400">No audio available for this recording</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Right Panel - Additional Info (only show when recording is selected) */}
                {selectedRecording && (
                    <div className="w-80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-l-2 border-gray-200 dark:border-slate-600 h-full flex flex-col shadow-xl animate-slideInRight" style={{ animationDelay: '200ms' }}>
                        <div className="p-6 border-b-2 border-gray-200 dark:border-slate-600 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 animate-fadeInDown" style={{ animationDelay: '300ms' }}>
                            <div className="flex items-center space-x-3 mb-6">
                                <span className="font-extrabold cursor-pointer text-[#3778D6] dark:text-blue-400 text-4xl p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 animate-bounceIn">
                                    <TbArrowsExchange />
                                </span>
                                <span className="text-gray-700 dark:text-gray-300 font-semibold text-lg animate-slideInLeft" style={{ animationDelay: '400ms' }}>Recording Info</span>
                            </div>
                        </div>

                        <div className="flex-1 p-6 space-y-6">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Phone Number</h4>
                                <p className="text-lg font-mono bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                    {formatPhoneNumber(extractDigits(getPrimaryPhoneNumber(selectedRecording)))}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Direction</h4>
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded-full ${selectedRecording.direction === 'inbound' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                    <p className="text-lg bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-gray-900 dark:text-gray-100 capitalize">
                                        {selectedRecording.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Date & Time</h4>
                                <p className="text-lg bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                {(() => {
                                    if (!selectedRecording.created_time) return 'Unknown';
                                    
                                    // Parse the date from filename to get the actual recording time
                                    const filename = selectedRecording.filename || '';
                                    const dateMatch = filename.match(/(\d{8})-(\d{6})/); // Extract YYYYMMDD-HHMMSS
                                    
                                    if (dateMatch) {
                                    const [, dateStr, timeStr] = dateMatch;
                                    const year = dateStr.substring(0, 4);
                                    const month = dateStr.substring(4, 6);
                                    const day = dateStr.substring(6, 8);
                                    const hour = timeStr.substring(0, 2);
                                    const minute = timeStr.substring(2, 4);
                                    const second = timeStr.substring(4, 6);
                                    
                                    // Create date object in Pakistan timezone (no conversion needed)
                                    const recordingDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                                    
                                    return recordingDate.toLocaleString('en-PK', {
                                        timeZone: 'Asia/Karachi',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: true
                                    });
                                    }
                                    
                                    // Fallback to created_time but force Pakistan timezone
                                    const date = new Date(selectedRecording.created_time * 1000);
                                    return date.toLocaleString('en-PK', {
                                    timeZone: 'Asia/Karachi',
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                    });
                                })()}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">File Size</h4>
                                <p className="text-lg font-mono bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-gray-900 dark:text-gray-100">
                                    {Math.round(selectedRecording.file_size / 1024)}KB
                                </p>
                            </div>



                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-gray-100 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Quick Actions</h4>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <button
                                        onClick={() => {
                                            const phoneNumber = getPrimaryPhoneNumber(selectedRecording);
                                            if (phoneNumber && phoneNumber !== 'Unknown') {
                                                handleCall(extractDigits(phoneNumber));
                                            }
                                        }}
                                        disabled={callState.isActive || callActive}
                                        className={`flex-1 py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-1 ${!callState.isActive
                                            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white cursor-pointer'
                                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <BsTelephone size={16} />
                                        <span className="text-xs font-medium">Call</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            const phoneNumber = getPrimaryPhoneNumber(selectedRecording);
                                            if (phoneNumber && phoneNumber !== 'Unknown') {
                                                handleTextMessage(extractDigits(phoneNumber));
                                            }
                                        }}
                                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-1"
                                    >
                                        <BsChatText size={16} />
                                        <span className="text-xs font-medium">Text</span>
                                    </button>

                                    <button
                                        onClick={() => handleDownloadRecording(selectedRecording)}
                                        disabled={!selectedRecording.audio_url}
                                        className={`flex-1 py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex flex-col items-center justify-center space-y-1 ${selectedRecording.audio_url
                                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white cursor-pointer'
                                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            }`}
                                        title={!selectedRecording.audio_url ? 'No audio available for download' : 'Download recording'}
                                    >
                                        <FiDownload size={16} />
                                        <span className="text-xs font-medium">Download</span>
                                    </button>
                                </div>

                                {/* Alternative: Full-width download button */}
                                <button
                                    onClick={() => handleDownloadRecording(selectedRecording)}
                                    disabled={!selectedRecording.audio_url}
                                    className={`w-full py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-2 ${selectedRecording.audio_url
                                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white cursor-pointer'
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        }`}
                                    title={!selectedRecording.audio_url ? 'No audio available for download' : 'Download recording file'}
                                >
                                    <FiDownload size={18} />
                                    <span className="font-medium">Download Recording</span>
                                    {selectedRecording.file_size && (
                                        <span className="text-sm opacity-75">
                                            ({Math.round(selectedRecording.file_size / 1024)}KB)
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Alert Modals */}
                <AlertModal
                    isOpen={showEndCallAlert}
                    onClose={() => setShowEndCallAlert(false)}
                    title="End Call"
                    message="Are you sure you want to end this call?"
                    type="warning"
                    confirmText="End Call"
                    cancelText="Continue"
                    showCancel={true}
                />

                <AlertModal
                    isOpen={showPhoneSystemAlert}
                    onClose={() => setShowPhoneSystemAlert(false)}
                    title="Phone System"
                    message="Phone system not ready. Please wait a moment and try again."
                    type="warning"
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
            </div>
        </div>
    );
}
