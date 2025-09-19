'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IoCall, IoClose } from 'react-icons/io5';
import { BsChatText } from 'react-icons/bs';
import { useRouter } from 'next/navigation';
import {
    BsPause, BsPlay, BsTelephone, BsVolumeUp, BsVolumeMute,
    BsRecordCircle, BsStopCircle, BsPerson, BsPersonPlus, BsThreeDotsVertical,
    BsKeyboard, BsMicMute, BsMic
} from 'react-icons/bs';
import {
    MdPersonAdd, MdVolumeUp, MdVolumeOff, MdKeyboard,
    MdMoreVert, MdPause, MdPlayArrow, MdTransferWithinAStation
} from 'react-icons/md';

import { FiPhoneForwarded, FiUsers, FiMic, FiMicOff } from 'react-icons/fi';

interface IncomingCall {
    id: string;
    callerNumber: string;
    callerName: string;
    timestamp: Date;
    lineNumber?: number;
    onTextMessage?: (number: string) => void;
    getContactName?: (number: string) => string;
}

import { TbTransfer, TbUsers, TbArrowRight } from 'react-icons/tb';
type CallState = 'incoming' | 'connecting' | 'connected' | 'ended';

interface CallControls {
    isOnHold: boolean;
    isMuted: boolean;
    isRecording: boolean;
    volume: number;
    showKeypad: boolean;
    showTransfer: boolean;
    showMoreOptions: boolean;
}

interface SessionState {
    isOnHold: boolean;
    isMuted: boolean;
    isConnected: boolean;
    lineNumber?: number;
}

declare global {
    interface Window {
        DialByLine?: (
            type: 'audio' | 'video',
            buddy: any,
            number: string,
            CallerID?: string,
            extraHeaders?: string[]
        ) => void;
        ReceiveCall?: (session: any) => void;
        AnswerAudioCall?: (lineNumber: number) => void;
        RejectCall?: (lineNumber: number) => void;
        cancelSession?: (lineNumber: number) => void;
        endSession?: (lineNumber: number) => void;
        getActiveLineNum?: () => number;
        Lines?: any[];
        testIncomingCall?: (number?: string, name?: string) => void;
        _currentIncomingSession?: any;
        _originalReceiveCall?: any;
        newLineNumber?: number;
        showGlobalIncomingCall?: (callerNumber: string, callerName: string, lineNumber?: number) => void;
        closeGlobalIncomingCall?: (reason?: string) => void;
        HangupAll?: () => void;
        EndCall?: () => void;
        HangUp?: () => void;
        StopSession?: (lineNum: number) => void;
        TerminateCall?: () => void;
        DisconnectCall?: () => void;
        HangupCall?: () => void;

        // Call control functions
        MuteCall?: (lineNumber: number) => void;
        UnmuteCall?: (lineNumber: number) => void;
        HoldCall?: (lineNumber: number) => void;
        UnholdCall?: (lineNumber: number) => void;
        StartRecording?: (lineNumber: number) => void;
        StopRecording?: (lineNumber: number) => void;
        sendDTMF?: (lineNum: number, digit: string) => void;
        TransferCall?: (lineNumber: number, targetNumber: string) => void;
        AddParticipant?: (lineNumber: number, participantNumber: string) => Promise<number>;
        SetVolume?: (lineNumber: number, volume: number) => void;

        // Additional phone.js functions
        holdSession?: (lineNumber: number) => void;
        unholdSession?: (lineNumber: number) => void;
        MuteSession?: (lineNumber: number) => void;
        UnmuteSession?: (lineNumber: number) => void;
        FindLineByNumber?: (lineNumber: number) => any;
        updateLineScroll?: (lineNum: number) => void;
        
        // Contact lookup functions - use consistent types
        workingContactLookup?: (number: string) => string;
        originalShowGlobalIncomingCall?: (callerNumber: string, callerName: string, lineNumber?: number) => void;
        incomingCallAlertContacts?: Array<{name: string, phone: string}>;
        
        [key: string]: any;
    }
}

export default function GlobalIncomingCallAlert() {
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [callState, setCallState] = useState<CallState>('incoming');
    const [callDuration, setCallDuration] = useState(0);
    const [hasActiveCall, setHasActiveCall] = useState(false);
    const [showCallWaiting, setShowCallWaiting] = useState(false);
    const [countdown, setCountdown] = useState(30);
    const [endReason, setEndReason] = useState<string | null>(null);
    const [isCallWaitingMode, setIsCallWaitingMode] = useState(false);
    const [waitingCallData, setWaitingCallData] = useState<IncomingCall | null>(null);
    // Notification states
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);

    const [callStartTime, setCallStartTime] = useState<Date | null>(null);
    const [callAnswerTime, setCallAnswerTime] = useState<Date | null>(null);
    const [ringStartTime, setRingStartTime] = useState<Date | null>(null);
    const [sessionId] = useState<string>(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    const sessionListenersRef = useRef<WeakMap<any, any>>(new WeakMap());
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    // Add these state variables to your IncomingCallAlert component
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
    const [transferNumber, setTransferNumber] = useState('');
    const [conferenceNumber, setConferenceNumber] = useState('');
    const [transferTarget, setTransferTarget] = useState('');
    const [showTransferPanel, setShowTransferPanel] = useState(false);
/////////////////contact name popup
// Add this right after the imports, before any interfaces
// Global contact lookup that works exactly like the console version
const setupGlobalContactLookup = () => {
    // Only run on client side
    if (typeof window === 'undefined') {
        return;
    }
    
    // Ensure this runs when contacts are available
    const checkAndSetup = () => {
        // Use the correct contact data source to match GlobalCallManager
        const contacts = window.incomingCallAlertContacts || window.contactsData || [];
        
        if (contacts.length === 0) {
            // If no contacts yet, try again in 500ms
            setTimeout(checkAndSetup, 500);
            return;
        }
        
        console.log('📋 Setting up global contact lookup with', contacts.length, 'contacts');
        
        // Create the exact same working lookup function from console
        const workingContactLookup = (number: string) => {
            if (!number || !contacts || contacts.length === 0) {
                return number;
            }
            
            const cleanedInput = number.replace(/[^\d]/g, "");
            const formats = [
                cleanedInput,
                cleanedInput.slice(-10), // last 10 digits
                cleanedInput.startsWith('1') ? cleanedInput.slice(1) : cleanedInput
            ];
            
            for (const format of formats) {
                const match = contacts.find((contact: any) => {
                    // Handle the contact data structure properly
                    const contactPhone = (contact.phone || '').replace(/[^\d]/g, "");
                    const contactLast10 = contactPhone.slice(-10);
                    const formatLast10 = format.slice(-10);
                    
                    if (contactPhone === format || 
                        (contactLast10 === formatLast10 && contactLast10.length === 10)) {
                        return true;
                    }
                    return false;
                });
                
                if (match) {
                    // Return the name property from the contact
                    return match.name || number;
                }
            }
            
            return number;
        };
        
        // Store the working function globally
        window.workingContactLookup = workingContactLookup;
        
        // Override showGlobalIncomingCall exactly like console
        if (window.showGlobalIncomingCall && !window.originalShowGlobalIncomingCall) {
            window.originalShowGlobalIncomingCall = window.showGlobalIncomingCall;
            
            window.showGlobalIncomingCall = (callerNumber: string, callerName: string, lineNumber?: number) => {
                const resolvedName = workingContactLookup(callerNumber);
                console.log('🚨 OVERRIDE: Resolved name:', resolvedName);
                return window.originalShowGlobalIncomingCall!(callerNumber, resolvedName, lineNumber);
            };
            
            console.log('✅ Global contact lookup override installed');
        }
    };
    
    // Start checking immediately and then periodically
    checkAndSetup();
    
    // Also listen for contact load events
    window.addEventListener('globalContactsLoaded', checkAndSetup);
    window.addEventListener('contactsLoaded', checkAndSetup);
};

// Add this useEffect inside the component
useEffect(() => {
    // Set up global contact lookup on client side only
    setupGlobalContactLookup();
}, []);
//////////////////////////////////
    // Add the saveCallRecord function
    // const saveCallRecord = async (callData: {
    //     caller: string;
    //     callee: string;
    //     direction: 'inbound' | 'outbound';
    //     start_time: string;
    //     answer_time?: string;
    //     end_time?: string;
    //     duration?: number;
    //     ring_time?: number;
    //     terminated_by?: string;
    //     reason_code?: string;
    //     reason_text?: string;
    //     session_id?: string;
    //     with_video?: boolean;
    // }) => {
    //     console.log('🔄 Attempting to save call record:', {
    //         caller: callData.caller,
    //         callee: callData.callee,
    //         direction: callData.direction,
    //         duration: callData.duration,
    //         start_time: callData.start_time,
    //         answer_time: callData.answer_time,
    //         end_time: callData.end_time
    //     });

        

    //     // added conditional on calling the API
    //     if (callData.caller !== 'unknown' && callData.callee !== 'unknown' && callData.duration === 0 ) {
    //         try {
    //             const response = await fetch('https://bkpmanual.bitnexdial.com/api/save-call', {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                     'Accept': 'application/json'
    //                 },
    //                 body: JSON.stringify(callData)
    //             });

    //             if (!response.ok) {
    //                 const errorText = await response.text();
    //                 console.error('❌ HTTP Error:', response.status, errorText);
    //                 throw new Error(`HTTP ${response.status}: ${errorText}`);
    //             }

    //             const result = await response.json();

    //             if (result.success) {
    //                 return result;
    //             } else {
    //                 throw new Error(result.error || 'Failed to save call record');
    //             }
    //         } catch (error: unknown) {
    //             console.error('❌ Network/Parse Error saving call record:', error);

    //             if (error instanceof Error) {
    //                 console.error('❌ Error details:', {
    //                     name: error.name,
    //                     message: error.message,
    //                     stack: error.stack
    //                 });
    //                 throw error;
    //             } else {
    //                 const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
    //                 console.error('❌ Non-Error thrown:', errorMessage);
    //                 throw new Error(errorMessage);
    //             }
    //         }
    //     } else {
    //         console.warn('⚠️ Skipping API call — caller or callee is "unknown"');
    //     };

    // };

    // Add the saveCallRecordOnEnd function
    const saveCallRecordOnEnd = async () => {
        
        if (!callStartTime && !callAnswerTime) {
            console.log('⚠️ No call timing data available, skipping save');
            return;
        }

        const now = new Date();
        const startTime = callStartTime || new Date(Date.now() - callDuration * 1000);
        const answerTime = callAnswerTime;
        const ringTime = answerTime && ringStartTime ?
            Math.floor((answerTime.getTime() - ringStartTime.getTime()) / 1000) : 0;

        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "unknown";

        console.log('📊 Saving call record on end with metrics:', {
            callDuration,
            startTime: startTime.toISOString(),
            answerTime: answerTime?.toISOString(),
            ringTime,
            myPhoneNumber,
            callerNumber: incomingCall?.callerNumber
        });

        const callDataToSave = {
            caller: incomingCall?.callerNumber || "unknown",
            callee: myPhoneNumber,
            direction: 'inbound' as const,
            start_time: startTime.toISOString().slice(0, 19).replace('T', ' '),
            answer_time: answerTime?.toISOString().slice(0, 19).replace('T', ' '),
            end_time: now.toISOString().slice(0, 19).replace('T', ' '),
            duration: callDuration,
            ring_time: ringTime,
            terminated_by: 'caller',
            reason_code: '16',
            reason_text: 'Normal call clearing',
            session_id: sessionId,
            with_video: false
        };

        try {
            // await saveCallRecord(callDataToSave);
            // Reset timing states after successful save
            setCallStartTime(null);
            setCallAnswerTime(null);
            setRingStartTime(null);
        } catch (saveError) {
            console.error('❌ Failed to save call record on end:', saveError);
        }
    };











    // Notification Permission and Setup
    useEffect(() => {
        const requestNotificationPermission = async () => {
            if (!('Notification' in window)) {
                console.warn('❌ This browser does not support notifications');
                return;
            }

            // If already granted, just update state
            if (Notification.permission === 'granted') {
                setNotificationPermission('granted');
                return;
            }

            // If denied, don't request again
            if (Notification.permission === 'denied') {
                setNotificationPermission('denied');
                return;
            }

            // Request permission
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);

                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                } else if (permission === 'denied') {
                    console.warn('❌ Notification permission denied');
                }
            } catch (error) {
                console.error('❌ Error requesting notification permission:', error);
            }
        };

        // Initial permission check and request
        requestNotificationPermission();
    }, []);

    // Notification functions
    const showPushNotification = (callerName: string, callerNumber: string) => {
        // Check browser support
        if (!('Notification' in window)) {
            console.warn('❌ Cannot show notification: browser not supported');
            return;
        }

        // Check permission
        if (Notification.permission !== 'granted') {
            console.warn('❌ Cannot show notification: permission not granted');

            // Try to request permission again
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    setNotificationPermission('granted');
                    showPushNotification(callerName, callerNumber);
                }
            });
            return;
        }

        // Close any existing notification
        if (currentNotification) {
            currentNotification.close();
        }

        const notificationTitle = 'Incoming Call';
        const notificationOptions = {
            body: `${callerName || 'Unknown Caller'}\n${callerNumber || 'Unknown Number'}`,
            icon: '/phone-icon.png',
            badge: '/phone-badge.png',
            tag: 'incoming-call',
            requireInteraction: true,
            silent: false,
            data: {
                callerNumber,
                callerName,
                timestamp: Date.now()
            }
        };

        try {
            const notification = new Notification(notificationTitle, notificationOptions);
            setCurrentNotification(notification);

            // Handle notification click (brings app to foreground)
            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();

                // Try to bring tab to front
                if (document.hidden) {
                    window.focus();
                }

                // Also try parent window focus for iframe scenarios
                if (window.parent && window.parent !== window) {
                    window.parent.focus();
                }

                notification.close();
                setCurrentNotification(null);
            };

            // Handle notification close
            notification.onclose = () => {
                setCurrentNotification(null);
            };

            // Handle notification errors
            notification.onerror = (error) => {
                console.error('❌ Notification error:', error);
                setCurrentNotification(null);
            };

            // Handle vibration separately (mobile devices)
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }

            // Auto-close notification after 30 seconds if not interacted with
            setTimeout(() => {
                if (notification === currentNotification) {
                    notification.close();
                    setCurrentNotification(null);
                }
            }, 30000);

        } catch (error) {
            console.error('❌ Failed to create notification:', error);

            // Try a simpler notification as fallback
            try {
                const simpleNotification = new Notification(`Incoming Call from ${callerName}`);
                setCurrentNotification(simpleNotification);
            } catch (fallbackError) {
                console.error('❌ Fallback notification also failed:', fallbackError);
            }
        }
    };

    const closePushNotification = () => {
        if (currentNotification) {
            currentNotification.close();
            setCurrentNotification(null);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    ////////////////////////////////////////////////ongoing call transfer
    // Add to the state declarations at the top
    const [activeCallOnOtherDevice, setActiveCallOnOtherDevice] = useState<{
        callerNumber: string;
        callerName: string;
        answeredAt: Date;
    } | null>(null);

    // Add this to the useEffect that sets up global functions
    useEffect(() => {
        // Listen for calls answered on other devices
        const handleCallAnsweredElsewhere = (event: any) => {
            const { callerNumber, callerName, timestamp } = event.detail || {};

            if (callerNumber && callerName && !isVisible) {
                setActiveCallOnOtherDevice({
                    callerNumber,
                    callerName,
                    answeredAt: new Date(timestamp || Date.now())
                });

                // Auto-hide after 30 seconds
                setTimeout(() => {
                    setActiveCallOnOtherDevice(null);
                }, 30000);
            }
        };

        const handleCallEstablished = (event: any) => {
            if (isVisible) {
                setCallState('connected');
                setCallStartTime(new Date());
                setCallDuration(0);
            }
        };

        window.addEventListener('callAnsweredElsewhere', handleCallAnsweredElsewhere);
        window.addEventListener('callEstablished', handleCallEstablished);

        return () => {
            window.removeEventListener('callAnsweredElsewhere', handleCallAnsweredElsewhere);
            window.removeEventListener('callEstablished', handleCallEstablished);
        };
    }, [isVisible]);

    const transferCallToMe = async () => {
        if (!activeCallOnOtherDevice) return;

        try {
            console.log('🔄 Requesting call transfer to this device');

            if (window.socket && window.socket.emit) {
                const myPhone = localStorage.getItem("myPhoneNumber");
                window.socket.emit('transfer-call-to-device', {
                    from: myPhone,
                    callerNumber: activeCallOnOtherDevice.callerNumber,
                    targetDevice: myPhone
                });
            }

            setActiveCallOnOtherDevice(null);

            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: 'Transfer request sent',
                        type: 'success',
                        duration: 3000
                    }
                }));
            }

        } catch (error) {
            console.error('❌ Failed to transfer call:', error);
        }
    };

    ////////////////////////////multi to single call
    useEffect(() => {
        // Enhanced session state monitoring for multi-instance handling
        const handleSessionStateChange = (event: any) => {
            // ... existing code ...
        };

        window.addEventListener('sipSessionStateChange', handleSessionStateChange);

        // Set up global functions ONCE
        window.showGlobalIncomingCall = (callerNumber: string, callerName: string, lineNumber?: number) => {        

            // CHECK FOR ACTIVE CALLS FIRST
            const activeCallExists = window.Lines?.some(line => {
                if (!line || !line.SipSession) return false;
                const state = line.SipSession.state;
                const status = (line.SipSession.status || '').toLowerCase();
                return state === 'Established' || status === 'connected';
            });

            if (activeCallExists) {
                setHasActiveCall(true);
                setShowCallWaiting(true);
                setShowCallWaiting(true);
                setHasActiveCall(true);
                // Set the incoming call data for waiting call
                setIncomingCall({
                    id: Date.now().toString(),
                    callerNumber: callerNumber || 'Unknown Number',
                    callerName: callerName || 'Unknown Caller',
                    timestamp: new Date(),
                    lineNumber: lineNumber
                });

                // DON'T show the main incoming call UI
                setIsVisible(false);
                return;
            }

            // Normal incoming call flow when no active calls
            // Normal incoming call flow when no active calls
            setHasActiveCall(false);
            setShowCallWaiting(false);

            // Show push notification
            showPushNotification(callerName || 'Unknown Caller', callerNumber || 'Unknown Number');

            setIncomingCall({
                id: Date.now().toString(),
                callerNumber: callerNumber || 'Unknown Number',
                callerName: callerName || 'Unknown Caller',
                timestamp: new Date(),
                lineNumber: lineNumber
            });
            setIsVisible(true);
            setCallState('incoming');
            setCountdown(30);

            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }

            countdownIntervalRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        handleReject();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        window.closeGlobalIncomingCall = (reason?: string) => {
            // ... your existing closeGlobalIncomingCall code ...
        };

        return () => {
            window.removeEventListener('sipSessionStateChange', handleSessionStateChange);
            delete window.showGlobalIncomingCall;
            delete window.closeGlobalIncomingCall;
        };
    }, []);

    const resetState = () => {
        setCallState('incoming');
        setCallDuration(0);
        setCallStartTime(null);
        setCallAnswerTime(null);
        setRingStartTime(null);
        setCountdown(30);
        setDialpadNumber('');
        setTransferNumber('');
        setEndReason(null);
        setCallControls({
            isMuted: false,
            isOnHold: false,
            isRecording: false,
            showKeypad: false,
            showMoreOptions: false,
            showTransfer: false,
            showConference: false,
            volume: 50,
            conferenceParticipants: [],
        });

        // Close any active notifications
        closePushNotification();

        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        if (window._currentIncomingSession) {
            window._currentIncomingSession = null;
        }
    };

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
            isConnected: false,
            lineNumber: lineNumber
        };
    };

    useEffect(() => {
        const handleCallEstablished = (event: any) => {
            // Use functional state update to avoid dependency on isVisible
            setIsVisible(prevVisible => {
                if (prevVisible) {
                    setCallState('connected');
                    setCallStartTime(new Date());
                    setCallDuration(0);
                }
                return prevVisible;
            });
        };

        window.addEventListener('callEstablished', handleCallEstablished);

        return () => {
            window.removeEventListener('callEstablished', handleCallEstablished);
        };
    }, []);

    // Ringtone management
    useEffect(() => {
        if (!ringtoneRef.current) {
            ringtoneRef.current = new Audio('/ringtone.mp3');
            ringtoneRef.current.loop = true;
            ringtoneRef.current.volume = 0.7;
        }

        const ringtone = ringtoneRef.current;

        if (callState === 'incoming' && isVisible) {
            ringtone.play().catch(error => {
                console.warn('Could not play ringtone:', error);
            });
        } else {
            ringtone.pause();
            ringtone.currentTime = 0;
        }

        return () => {
            if (ringtone) {
                ringtone.pause();
                ringtone.currentTime = 0;
            }
        };
    }, [callState, isVisible]);

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

    // ===== SAFE CALL CONTROL FUNCTIONS =====

    const safeMuteSession = (lineNumber: number) => {
        try {
            if (window.FindLineByNumber && typeof window.FindLineByNumber === 'function') {
                const lineObj = window.FindLineByNumber(lineNumber);
                if (lineObj == null || lineObj.SipSession == null) {
                    console.warn('Line or SipSession not found for line:', lineNumber);
                    return false;
                }

                const session = lineObj.SipSession;
                const pc = session.sessionDescriptionHandler.peerConnection;

                pc.getSenders().forEach(function (RTCRtpSender: any) {
                    if (RTCRtpSender.track && RTCRtpSender.track.kind == "audio") {
                        if (RTCRtpSender.track.IsMixedTrack == true) {
                            if (session.data.AudioSourceTrack && session.data.AudioSourceTrack.kind == "audio") {
                                console.log("Muting Mixed Audio Track : " + session.data.AudioSourceTrack.label);
                                session.data.AudioSourceTrack.enabled = false;
                            }
                        }
                        console.log("Muting Audio Track : " + RTCRtpSender.track.label);
                        RTCRtpSender.track.enabled = false;
                    }
                });

                if (!session.data.mute) session.data.mute = [];
                session.data.mute.push({ event: "mute", eventTime: new Date().toISOString() });
                session.data.ismute = true;

                console.log('✅ Direct mute successful');
                return true;
            }
        } catch (error) {
            console.error('❌ Direct mute failed:', error);
        }
        return false;
    };

    const safeUnmuteSession = (lineNumber: number) => {
        try {
            if (window.FindLineByNumber && typeof window.FindLineByNumber === 'function') {
                const lineObj = window.FindLineByNumber(lineNumber);
                if (lineObj == null || lineObj.SipSession == null) {
                    console.warn('Line or SipSession not found for line:', lineNumber);
                    return false;
                }

                const session = lineObj.SipSession;
                const pc = session.sessionDescriptionHandler.peerConnection;

                pc.getSenders().forEach(function (RTCRtpSender: any) {
                    if (RTCRtpSender.track && RTCRtpSender.track.kind == "audio") {
                        if (RTCRtpSender.track.IsMixedTrack == true) {
                            if (session.data.AudioSourceTrack && session.data.AudioSourceTrack.kind == "audio") {
                                console.log("Unmuting Mixed Audio Track : " + session.data.AudioSourceTrack.label);
                                session.data.AudioSourceTrack.enabled = true;
                            }
                        }
                        console.log("Unmuting Audio Track : " + RTCRtpSender.track.label);
                        RTCRtpSender.track.enabled = true;
                    }
                });

                if (!session.data.mute) session.data.mute = [];
                session.data.mute.push({ event: "unmute", eventTime: new Date().toISOString() });
                session.data.ismute = false;

                console.log('✅ Direct unmute successful');
                return true;
            }
        } catch (error) {
            console.error('❌ Direct unmute failed:', error);
        }
        return false;
    };

    const safeHoldSession = (lineNumber: number) => {
        try {
            if (window.FindLineByNumber && typeof window.FindLineByNumber === 'function') {
                const lineObj = window.FindLineByNumber(lineNumber);
                if (lineObj == null || lineObj.SipSession == null) {
                    console.warn('Line or SipSession not found for line:', lineNumber);
                    return false;
                }

                const session = lineObj.SipSession;
                if (session.isOnHold == true) {
                    return true;
                }

                session.isOnHold = true;

                const sessionDescriptionHandlerOptions = session.sessionDescriptionHandlerOptionsReInvite;
                sessionDescriptionHandlerOptions.hold = true;
                session.sessionDescriptionHandlerOptionsReInvite = sessionDescriptionHandlerOptions;

                const options = {
                    requestDelegate: {
                        onAccept: function () {
                            if (session && session.sessionDescriptionHandler && session.sessionDescriptionHandler.peerConnection) {
                                const pc = session.sessionDescriptionHandler.peerConnection;
                                pc.getReceivers().forEach(function (RTCRtpReceiver: any) {
                                    if (RTCRtpReceiver.track) RTCRtpReceiver.track.enabled = false;
                                });
                                pc.getSenders().forEach(function (RTCRtpSender: any) {
                                    if (RTCRtpSender.track && RTCRtpSender.track.kind == "audio") {
                                        if (RTCRtpSender.track.IsMixedTrack == true) {
                                            if (session.data.AudioSourceTrack && session.data.AudioSourceTrack.kind == "audio") {
                                                console.log("Muting Mixed Audio Track : " + session.data.AudioSourceTrack.label);
                                                session.data.AudioSourceTrack.enabled = false;
                                            }
                                        }
                                        console.log("Muting Audio Track : " + RTCRtpSender.track.label);
                                        RTCRtpSender.track.enabled = false;
                                    }
                                    else if (RTCRtpSender.track && RTCRtpSender.track.kind == "video") {
                                        RTCRtpSender.track.enabled = false;
                                    }
                                });
                            }
                            session.isOnHold = true;
                            console.log("Call is on hold:", lineNumber);

                            if (!session.data.hold) session.data.hold = [];
                            session.data.hold.push({ event: "hold", eventTime: new Date().toISOString() });
                        },
                        onReject: function () {
                            session.isOnHold = false;
                            console.warn("Failed to put the call on hold:", lineNumber);
                        }
                    }
                };

                session.invite(options).catch(function (error: any) {
                    session.isOnHold = false;
                    console.warn("Error attempting to put the call on hold:", error);
                });

                return true;
            }
        } catch (error) {
            console.error('❌ Direct hold failed:', error);
        }
        return false;
    };

    const safeUnholdSession = (lineNumber: number) => {
        try {
            if (window.FindLineByNumber && typeof window.FindLineByNumber === 'function') {
                const lineObj = window.FindLineByNumber(lineNumber);
                if (lineObj == null || lineObj.SipSession == null) {
                    console.warn('Line or SipSession not found for line:', lineNumber);
                    return false;
                }

                const session = lineObj.SipSession;
                if (session.isOnHold == false) {
                    return true;
                }

                session.isOnHold = false;

                const sessionDescriptionHandlerOptions = session.sessionDescriptionHandlerOptionsReInvite;
                sessionDescriptionHandlerOptions.hold = false;
                session.sessionDescriptionHandlerOptionsReInvite = sessionDescriptionHandlerOptions;

                const options = {
                    requestDelegate: {
                        onAccept: function () {
                            if (session && session.sessionDescriptionHandler && session.sessionDescriptionHandler.peerConnection) {
                                const pc = session.sessionDescriptionHandler.peerConnection;
                                pc.getReceivers().forEach(function (RTCRtpReceiver: any) {
                                    if (RTCRtpReceiver.track) RTCRtpReceiver.track.enabled = true;
                                });
                                pc.getSenders().forEach(function (RTCRtpSender: any) {
                                    if (RTCRtpSender.track && RTCRtpSender.track.kind == "audio") {
                                        if (RTCRtpSender.track.IsMixedTrack == true) {
                                            if (session.data.AudioSourceTrack && session.data.AudioSourceTrack.kind == "audio") {
                                                console.log("Unmuting Mixed Audio Track : " + session.data.AudioSourceTrack.label);
                                                session.data.AudioSourceTrack.enabled = true;
                                            }
                                        }
                                        console.log("Unmuting Audio Track : " + RTCRtpSender.track.label);
                                        RTCRtpSender.track.enabled = true;
                                    }
                                    else if (RTCRtpSender.track && RTCRtpSender.track.kind == "video") {
                                        RTCRtpSender.track.enabled = true;
                                    }
                                });
                            }
                            session.isOnHold = false;

                            if (!session.data.hold) session.data.hold = [];
                            session.data.hold.push({ event: "unhold", eventTime: new Date().toISOString() });
                        },
                        onReject: function () {
                            session.isOnHold = true;
                            console.warn("Failed to take the call off hold", lineNumber);
                        }
                    }
                };

                session.invite(options).catch(function (error: any) {
                    session.isOnHold = true;
                    console.warn("Error attempting to take to call off hold", error);
                });

                return true;
            }
        } catch (error) {
            console.error('❌ Direct unhold failed:', error);
        }
        return false;
    };

    // ===== CALL CONTROL FUNCTIONS =====

    const blindTransferCall = async () => {
        if (!transferTarget.trim()) {
            alert('Please enter a transfer target');
            return;
        }

        try {
            const lineNumber = getCurrentLineNumber();
            if (lineNumber < 0) {
                throw new Error('No active call found');
            }

            if (!window.blindTransferCall) {
                throw new Error('Transfer function not available');
            }

            await window.blindTransferCall(lineNumber + 1, transferTarget);
            alert('Call transferred successfully!');
            setTransferTarget('');
            setShowTransferPanel(false);
        } catch (error: any) {
            console.error('❌ Blind transfer failed:', error);
            alert(`Transfer failed: ${error.message || 'Unknown error'}`);
        }
    };

    const getCurrentLineNumber = (): number => {
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
    };

    const toggleMute = () => {
        if (callState !== 'connected') return;

        const lineNumber = getCurrentLineNumber();
        const sessionState = getSessionState(lineNumber);
        const actualMuteState = sessionState.isMuted;


        try {
            if (actualMuteState) {
                if (safeUnmuteSession(lineNumber)) {
                    setCallControls(prev => ({ ...prev, isMuted: false }));
                    console.log('✅ Call unmuted successfully');
                } else {
                    console.warn('⚠️ Failed to unmute call');
                    syncSessionState();
                }
            } else {
                if (safeMuteSession(lineNumber)) {
                    setCallControls(prev => ({ ...prev, isMuted: true }));
                    console.log('✅ Call muted successfully');
                } else {
                    console.warn('⚠️ Failed to mute call');
                    syncSessionState();
                }
            }
        } catch (error) {
            console.error('❌ Failed to toggle mute:', error);
            syncSessionState();
        }
    };

    const toggleHold = () => {
        if (callState !== 'connected') return;

        const lineNumber = getCurrentLineNumber();
        const sessionState = getSessionState(lineNumber);
        const actualHoldState = sessionState.isOnHold;


        try {
            if (actualHoldState) {
                if (safeUnholdSession(lineNumber)) {
                    setCallControls(prev => ({ ...prev, isOnHold: false }));
                    console.log('✅ Call resumed successfully');
                } else {
                    console.warn('⚠️ Failed to resume call');
                    syncSessionState();
                }
            } else {
                if (safeHoldSession(lineNumber)) {
                    setCallControls(prev => ({ ...prev, isOnHold: true }));
                    console.log('✅ Call held successfully');
                } else {
                    console.warn('⚠️ Failed to hold call');
                    syncSessionState();
                }
            }
        } catch (error) {
            console.error('❌ Failed to toggle hold:', error);
            syncSessionState();
        }
    };

    const toggleRecording = () => {
        if (callState !== 'connected') return;

        console.log(`🔴 ${callControls.isRecording ? 'Stopping' : 'Starting'} recording`);

        try {
            setCallControls(prev => ({ ...prev, isRecording: !prev.isRecording }));
            console.log(`✅ Recording state toggled to: ${!callControls.isRecording}`);
        } catch (error) {
            console.error('❌ Failed to toggle recording:', error);
            setCallControls(prev => ({ ...prev, isRecording: prev.isRecording }));
        }
    };

    const sendDTMF = (digit: string) => {

        const connectedStates = ['connected', 'established', 'confirmed'];
        const isCallConnected = callState === 'connected';

        if (!isCallConnected) {
            console.warn(`🔢 [DTMF] DTMF blocked: call not in connected state. Current state: ${callState}`);
            return;
        }

        setDialpadNumber(prev => prev + digit);

        let activeLineIndex = -1;
        if (window.getActiveLineNum && typeof window.getActiveLineNum === 'function') {
            activeLineIndex = window.getActiveLineNum();
        }

        if (activeLineIndex >= 0 && window.sendDTMF) {
            window.sendDTMF(activeLineIndex + 1, digit);
        }

        playDTMFTone(digit);
    };

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
        } catch { }
    };

    const toggleKeypad = () => setCallControls(prev => ({ ...prev, showKeypad: !prev.showKeypad }));
    const toggleMoreOptions = () => setCallControls(prev => ({ ...prev, showMoreOptions: !prev.showMoreOptions }));
    const toggleTransfer = () => setCallControls(prev => ({ ...prev, showTransfer: !prev.showTransfer }));
    const toggleConference = () => setCallControls(prev => ({ ...prev, showConference: !prev.showConference }));

    const adjustVolume = (volume: number) => {

        try {
            setCallControls(prev => ({ ...prev, volume }));

            setTimeout(() => {
                const audioElements = document.querySelectorAll('audio');
                audioElements.forEach((audio) => {
                    if (audio.srcObject) {
                        audio.volume = volume / 100;
                    }
                });
            }, 50);


        } catch (error) {
            console.error('❌ Failed to adjust volume:', error);
        }
    };

    const initiateTransfer = () => {
        if (!transferNumber.trim() || callState !== 'connected') return;


        try {
            alert(`Transfer to ${transferNumber} would be initiated here`);
            setCallControls(prev => ({ ...prev, showTransfer: false }));
            setTransferNumber('');

        } catch (error) {
            console.error('❌ Failed to process transfer:', error);
        }
    };

    const addParticipant = () => {

        try {
            alert('Add participant feature would open contact picker here');

        } catch (error) {
            console.error('❌ Failed to process add participant:', error);
        }
    };

    const handleTextMessage = (number: string) => {
        const formattedNumber = number.replace(/\D/g, '');
        router.push(`/text?to=${encodeURIComponent(formattedNumber)}`);
    };

    /////////////////////////////////////////
    // Update this in IncomingCallAlert.tsx
    // Update this in IncomingCallAlert.tsx
    // Update this in IncomingCallAlert.tsx
    // Fix this in IncomingCallAlert.tsx
    useEffect(() => {
        const handleGlobalCallEnd = () => {

            // Use functional update to get current state without dependency
            setCallState(currentState => {
                console.log('📱 Current call state:', currentState);

                if (currentState !== 'ended') {
                    console.log('📱 Setting state to ended and showing popup');
                    closePushNotification();
                    setEndReason('terminated');

                    // Then close after 2 seconds
                    setTimeout(() => {
                        console.log('📱 Now closing UI after showing ended state');
                        setIsVisible(false);
                        setIncomingCall(null);
                        resetState();
                    }, 2000);

                    return 'ended';  // Return new state
                }

                console.log('📱 Already in ended state, not updating');
                return currentState;  // Return current state unchanged
            });
        };

        window.addEventListener('globalCallEnd', handleGlobalCallEnd);

        return () => {
            window.removeEventListener('globalCallEnd', handleGlobalCallEnd);
        };
    }, [isVisible]); // REMOVED callState from dependency array - THIS FIXES THE LOOP
    ///////////////////////////////////

    // ===== EFFECTS FOR STATE SYNCHRONIZATION =====

    useEffect(() => {
        if (callState === 'connected') {
            syncSessionState();

            const syncInterval = setInterval(() => {
                syncSessionState();
            }, 2000);

            return () => clearInterval(syncInterval);
        }
    }, [callState]);

    // ===== SETUP GLOBAL FUNCTIONS AND EVENT HANDLERS =====

    useEffect(() => {
        window.closeGlobalIncomingCall = (reason?: string) => {

            // Close push notification
            closePushNotification();

            if (reason === 'terminated' || reason === 'ended' || reason === 'cancelled') {
                setEndReason(reason);
                setCallState('ended');
                setTimeout(() => {
                    setIsVisible(false);
                    setIncomingCall(null);
                    resetState();
                }, 2000);
            }
        };

        return () => {
            delete window.closeGlobalIncomingCall;
        };
    }, []);



    // Handle call duration timer when connected
    useEffect(() => {
        if (callState === 'connected' && callStartTime && !durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else if (callState !== 'connected' && durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
        };
    }, [callState, callStartTime]);

    // SIP State management with enhanced error handling
    useEffect(() => {
        if (!isVisible) return;

        const checkTransport = () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                return true;
            }
            return false;
        };

        if (checkTransport() && window.Lines && Array.isArray(window.Lines)) {
            window.Lines.forEach((line) => {
                if (!line?.SipSession) return;
                if (sessionListenersRef.current.has(line.SipSession)) return;

                const handler = (newState: any) => {

                    const stateStr = String(newState).toLowerCase();
                    const stateNum = Number(newState);

                    if (stateStr === "confirmed" || stateStr === "established" || stateNum === 3 || stateNum === 4) {
                        closePushNotification(); // Close notification when call is established
                        setCallState("connected");
                        if (!callStartTime) {
                            setCallStartTime(new Date());
                            setCallDuration(0);
                        }
                        if (countdownIntervalRef.current) {
                            clearInterval(countdownIntervalRef.current);
                            countdownIntervalRef.current = null;
                        }
                    }
                    else if (stateStr === "terminated" || stateNum === 5) {
                        closePushNotification(); // Close notification when call is terminated

                        if (callState === 'incoming') {
                            console.log('📞 Call terminated while incoming - answered elsewhere');

                            if (typeof window !== 'undefined' && window.dispatchEvent) {
                                window.dispatchEvent(new CustomEvent('showToast', {
                                    detail: {
                                        message: 'Call answered on another device',
                                        type: 'info',
                                        duration: 3000
                                    }
                                }));
                            }

                            setEndReason('answered_elsewhere');
                            setCallState('ended');
                            setTimeout(() => {
                                setIsVisible(false);
                                setIncomingCall(null);
                                resetState();
                            }, 2500);
                        } else {
                            console.log('❌ Call terminated - updating React state');
                            setCallState('ended');
                        }
                    }
                    else if (stateStr === "connecting" || stateStr === "establishing" || stateNum === 2) {
                        console.log('🔄 Call connecting - updating React state');
                        setCallState("connecting");
                    }
                };

                if (line.SipSession.stateChange && typeof line.SipSession.stateChange.addListener === 'function') {
                    line.SipSession.stateChange.addListener(handler);
                    sessionListenersRef.current.set(line.SipSession, handler);

                    const currentState = line.SipSession.state;
                    console.log('📞 Current session state on setup:', currentState);
                    if (currentState) {
                        handler(currentState);
                    }
                }
            });
        }

        return () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                window.Lines.forEach((line) => {
                    if (!line?.SipSession) return;
                    const handler = sessionListenersRef.current.get(line.SipSession);
                    if (handler && line.SipSession.stateChange && typeof line.SipSession.stateChange.removeListener === 'function') {
                        line.SipSession.stateChange.removeListener(handler);
                        sessionListenersRef.current.delete(line.SipSession);
                    }
                });
            }
        };
    }, [isVisible, callStartTime, callState]);

    // ===== CALL ANSWER/REJECT FUNCTIONS =====

    function handleReject(event?: React.MouseEvent<HTMLButtonElement>): void {

        // Close push notification immediately
        closePushNotification();

        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }

        let rejected = false;

        const session = window._currentIncomingSession;
        if (session && typeof session.reject === "function") {
            try {
                session.reject();
                rejected = true;
            } catch (error) {
                console.error('❌ session.reject() failed:', error);
            }
        }

        if (!rejected && incomingCall?.lineNumber && window.RejectCall) {
            try {
                window.RejectCall(incomingCall.lineNumber);
                rejected = true;
            } catch (error) {
                console.error(`❌ RejectCall(${incomingCall.lineNumber}) failed:`, error);
            }
        }

        if (!rejected && window.RejectCall) {
            for (let lineNum = 1; lineNum <= 2; lineNum++) {
                try {
                    console.log(`🎯 Trying RejectCall(${lineNum})`);
                    window.RejectCall(lineNum);
                    rejected = true;
                    break;
                } catch (error) {
                    console.error(`❌ RejectCall(${lineNum}) failed:`, error);
                }
            }
        }

        if (rejected) {
            console.log('✅ Rejected via RejectCall');
        } else {
            console.warn('⚠️ All reject methods failed, closing UI anyway');
        }

        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        setIsVisible(false);
        setIncomingCall(null);
        resetState();

    }

    function handleAnswer(event?: React.MouseEvent<HTMLButtonElement>): void {

        // Close push notification immediately
        closePushNotification();

        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        const session = window._currentIncomingSession;
        if (session && session.state === 'Terminated') {
            setEndReason('answered_elsewhere');
            setCallState('ended');
            setTimeout(() => {
                setIsVisible(false);
                setIncomingCall(null);
                resetState();
            }, 1500);
            return;
        }

        setCallState("connecting");

        let answered = false;

        if (session && typeof session.accept === "function") {
            try {
                if (session.state !== 'Terminated') {
                    session.accept();
                    answered = true;

                    const checkStateInterval = setInterval(() => {
                        const currentState = session.state;

                        if (currentState === 'Established' || currentState === 'Confirmed') {
                            console.log('✅ Session is established, updating UI to connected');
                            setCallState("connected");
                            if (!callStartTime) {
                                setCallStartTime(new Date());
                                setCallDuration(0);
                            }
                            clearInterval(checkStateInterval);
                        } else if (currentState === 'Terminated') {
                            console.log('❌ Session terminated during answer attempt');
                            setEndReason('answered_elsewhere');
                            setCallState('ended');
                            clearInterval(checkStateInterval);
                            setTimeout(() => {
                                setIsVisible(false);
                                setIncomingCall(null);
                                resetState();
                            }, 1500);
                        }
                    }, 500);

                    setTimeout(() => {
                        clearInterval(checkStateInterval);
                    }, 10000);
                } else {
                    console.log('🚫 Session is terminated, cannot accept');
                    setEndReason('answered_elsewhere');
                    setCallState('ended');
                    setTimeout(() => {
                        setIsVisible(false);
                        setIncomingCall(null);
                        resetState();
                    }, 1500);
                    return;
                }

            } catch (error: unknown) {
                console.error('❌ session.accept() failed:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('Terminated')) {
                    setEndReason('answered_elsewhere');
                    setCallState('ended');
                    setTimeout(() => {
                        setIsVisible(false);
                        setIncomingCall(null);
                        resetState();
                    }, 1500);
                    return;
                }
            }
        }

        if (!answered && window.AnswerAudioCall) {
            const lineNumber = incomingCall?.lineNumber || 1;
            try {
                window.AnswerAudioCall(lineNumber);
                answered = true;
            } catch (error) {
                console.error(`❌ AnswerAudioCall(${lineNumber}) failed:`, error);
            }
        }

        if (answered) {

            setTimeout(() => {
                if (callState === 'connecting') {
                    setCallState("connected");
                    if (!callStartTime) {
                        setCallStartTime(new Date());
                        setCallDuration(0);
                    }
                }
            }, 3000);
        } else {
            console.error('❌ Failed to answer call with all methods');
            setTimeout(() => {
                setCallState("connected");
                setCallStartTime(new Date());
                setCallDuration(0);
            }, 1500);
        }
        window.dispatchEvent(new CustomEvent('globalCallStart', {
            detail: {
                number: incomingCall?.callerNumber,
                direction: 'inbound'
            }
        }));
        setIsVisible(false);

    }


    // Update the useEffect for call state tracking
    useEffect(() => {
        console.log('🔄 Call state changed:', {
            status: callState,
            hasCallStartTime: !!callStartTime,
            hasCallAnswerTime: !!callAnswerTime,
            isVisible: isVisible
        });

        if (callState === 'incoming' && !callStartTime) {
            const newStartTime = new Date();
            setCallStartTime(newStartTime);
            setRingStartTime(newStartTime);
            console.log('📞 Call start time set:', newStartTime.toISOString());
        } else if (callState === 'connected' && !callAnswerTime) {
            const newAnswerTime = new Date();
            setCallAnswerTime(newAnswerTime);
            console.log('✅ Call answer time set:', newAnswerTime.toISOString());
        }

        // Save call record when call ends
        if (callState === 'ended' && (callStartTime || callAnswerTime)) {
            console.log('🔚 Call ended detected, saving call record...');
            saveCallRecordOnEnd();
        }
    }, [callState, callStartTime, callAnswerTime]);


    function handleEndCall() {

        // Save call record BEFORE ending the call
        if ((callStartTime || callAnswerTime) && callState === 'connected') {
            saveCallRecordOnEnd();
        }

        // Close push notification
        closePushNotification();

        if (incomingCall?.lineNumber && window.endSession) {
            try {
                window.endSession(incomingCall.lineNumber);
            } catch (error) {
                console.error('Failed to end session:', error);
            }
        }

        setEndReason('manual');
        setCallState("ended");
        setTimeout(() => {
            setIsVisible(false);
            setIncomingCall(null);
            resetState();
        }, 1500);
    }
    const getEndMessage = () => {
        switch (endReason) {
            case 'terminated':
                return 'Call ended by remote party';
            case 'cancelled':
                return 'Call was cancelled';
            case 'manual':
                return 'Call ended';
            case 'answered_elsewhere':
                return 'Call answered on another device';
            default:
                return callDuration > 0 ? 'Call completed' : 'Call was terminated';
        }
    };

    if (!isVisible || !incomingCall) {
        if (activeCallOnOtherDevice) {
            return (
                <div className="fixed top-4 right-4 z-[9998] max-w-sm">

                </div>
            );
        }
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
            style={{ backdropFilter: 'blur(12px)' }}
        >
            <style jsx>{`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .slider::-webkit-slider-track {
                    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 ${callControls.volume}%, #d1d5db ${callControls.volume}%, #d1d5db 100%);
                }
            `}</style>

            {/* Notification Permission Banner */}
            {notificationPermission === 'denied' && (
                <div className="fixed top-4 left-4 right-4 z-[10000] bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
                    <p className="text-sm font-medium">
                        📱 Notifications are disabled. Enable them in your browser settings for call alerts.
                        <button
                            onClick={() => window.open('chrome://settings/content/notifications', '_blank')}
                            className="ml-2 underline hover:no-underline"
                        >
                            Open Settings
                        </button>
                    </p>
                </div>
            )}

            {notificationPermission === 'default' && (
                <div className="fixed top-4 left-4 right-4 z-[10000] bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
                    <p className="text-sm font-medium">
                        📱 Click "Allow" to enable call notifications
                        <button
                            onClick={() => {
                                Notification.requestPermission().then(permission => {
                                    setNotificationPermission(permission);
                                });
                            }}
                            className="ml-2 bg-white text-blue-500 px-2 py-1 rounded text-xs font-semibold hover:bg-gray-100"
                        >
                            Enable Now
                        </button>
                    </p>
                </div>
            )}

            <div className={`bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-600/30 p-6 mx-4 transform transition-all duration-500 ${callState === 'connected' ? 'max-w-lg w-full' : 'max-w-md w-full'
                }`}>

                {/* Header with Call State */}
                
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${callState === 'incoming' ? 'bg-orange-500 animate-pulse' :
                            callState === 'connecting' ? 'bg-yellow-500 animate-bounce' :
                                callState === 'connected' ? 'bg-green-500' :
                                    'bg-red-500'
                            }`}>
                            <IoCall className="text-white text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {callState === 'incoming' && 'Incoming Call'}
                                {callState === 'connecting' && 'Connecting...'}
                                {callState === 'connected' && 'Connected'}
                                {callState === 'ended' && 'Call Ended'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {callState === 'incoming' && `${countdown}s remaining`}
                                {callState === 'connecting' && 'Please wait...'}
                                {callState === 'connected' && formatDuration(callDuration)}
                                {callState === 'ended' && 'Call finished'}
                            </p>
                        </div>
                    </div>

                    {callState === 'incoming' && (
                        <button
                            onClick={() => { setIsVisible(false); setIncomingCall(null); resetState(); }}
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                        >
                            <IoClose size={20} />
                        </button>
                    )}
                </div>

                {/* Caller Info */}
                <div className="text-center mb-8">
                    <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center shadow-2xl ring-4 ring-white dark:ring-slate-700 ${callState === 'incoming' ? 'bg-gradient-to-br from-orange-400 to-orange-600 animate-pulse' :
                        callState === 'connecting' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            callState === 'connected' ? 'bg-gradient-to-br from-green-400 to-green-600' :
                                'bg-gradient-to-br from-red-400 to-red-600'
                        }`}>
                        <span className="text-white text-2xl font-bold">
                            {(incomingCall?.callerName || 'U').charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {incomingCall?.callerName || 'Unknown Caller'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 font-mono text-lg bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-lg inline-block">
                        {incomingCall?.callerNumber || 'Unknown Number'}
                    </p>
                </div>

                {/* Action Buttons - Different for each state */}
                {callState === 'incoming' && (
                    <div className="space-y-4">
                        <div className="flex justify-center space-x-6">
                            <button
                                onClick={handleReject}
                                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95"
                                title="Reject Call"
                            >
                                <IoClose size={28} />
                            </button>
                            <button
                                onClick={handleAnswer}
                                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95"
                                title="Answer Call"
                            >
                                <IoCall size={28} />
                            </button>
                        </div>
                    </div>
                )}

                {callState === 'connecting' && (
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <button
                            onClick={handleReject}
                            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 mx-auto"
                            title="Cancel"
                        >
                            <IoClose size={28} />
                        </button>
                    </div>
                )}

                {callState === 'connected' && (
                    <div className="space-y-6">
                        {/* Call Duration */}
                        <div className="text-center">
                            <div className="text-3xl font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-lg shadow-inner mb-4">
                                {formatDuration(callDuration)}
                            </div>

                            {/* Call Status Indicators */}
                            <div className="flex justify-center space-x-3 mb-4">
                                {callControls.isOnHold && (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                        ON HOLD
                                    </span>
                                )}
                                {callControls.isMuted && (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                                        MUTED
                                    </span>
                                )}
                                {callControls.isRecording && (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full animate-pulse">
                                        🔴 RECORDING
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Primary Call Controls */}
                        <div className="grid grid-cols-4 gap-3">
                            <button
                                onClick={toggleMute}
                                className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${callControls.isMuted
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title={callControls.isMuted ? 'Unmute' : 'Mute'}
                            >
                                {callControls.isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
                            </button>

                            <button
                                onClick={toggleHold}
                                className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${callControls.isOnHold
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title={callControls.isOnHold ? 'Resume' : 'Hold'}
                            >
                                {callControls.isOnHold ? <BsPlay size={20} /> : <BsPause size={20} />}
                            </button>

                            <button
                                onClick={toggleKeypad}
                                className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${callControls.showKeypad
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title="Keypad"
                            >
                                <BsKeyboard size={20} />
                            </button>

                            <button
                                onClick={toggleMoreOptions}
                                className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${callControls.showMoreOptions
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title="More Options"
                            >
                                <BsThreeDotsVertical size={20} />
                            </button>
                        </div>

                        {/* Secondary Controls */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={toggleTransfer}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${callControls.showTransfer
                                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title="Transfer Call"
                            >
                                <TbTransfer size={16} />
                            </button>

                            <button
                                onClick={toggleRecording}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${callControls.isRecording
                                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title={callControls.isRecording ? 'Stop Recording' : 'Start Recording'}
                            >
                                {callControls.isRecording ? <BsStopCircle size={16} /> : <BsRecordCircle size={16} />}
                            </button>

                            <button
                                onClick={addParticipant}
                                className="w-full h-10 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                                title="Add Participant"
                            >
                                <BsPersonPlus size={16} />
                            </button>
                        </div>

                        {/* Volume Control */}
                        <div className="px-2">
                            <div className="flex items-center space-x-3">
                                <MdVolumeOff className="text-gray-500" size={16} />
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={callControls.volume}
                                        onChange={(e) => adjustVolume(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>
                                <MdVolumeUp className="text-gray-500" size={16} />
                                <span className="text-xs text-gray-500 min-w-[3ch]">{callControls.volume}</span>
                            </div>
                        </div>

                        {/* Keypad Overlay */}
                        {callControls.showKeypad && (
                            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-600">
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        value={dialpadNumber}
                                        onChange={(e) => setDialpadNumber(e.target.value)}
                                        className="w-full p-2 text-center text-lg font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        placeholder="Enter digits"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
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
                                            onClick={() => sendDTMF(key.number)}
                                            className="h-10 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg flex flex-col items-center justify-center text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 border border-gray-200 dark:border-slate-600"
                                        >
                                            <span className="text-gray-800 dark:text-gray-100">{key.number}</span>
                                            {key.letters && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {key.letters}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Transfer Overlay */}
                        {callControls.showTransfer && (
                            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-600">
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Transfer Call</h4>
                                <div className="space-y-3">
                                    <input
                                        type="tel"
                                        value={transferNumber}
                                        onChange={(e) => setTransferNumber(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono"
                                        placeholder="Enter transfer number"
                                    />
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={initiateTransfer}
                                            disabled={!transferNumber.trim()}
                                            className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            Transfer
                                        </button>
                                        <button
                                            onClick={() => setCallControls(prev => ({ ...prev, showTransfer: false }))}
                                            className="px-4 py-2 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-all duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* More Options Overlay */}
                        {callControls.showMoreOptions && (
                            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-600">
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">More Options</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleTextMessage(incomingCall?.callerNumber || '')}
                                        className="flex items-center space-x-2 p-3 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition-all duration-200"
                                    >
                                        <BsChatText size={16} />
                                        <span className="text-sm font-medium">Message</span>
                                    </button>
                                    <button
                                        onClick={toggleConference}
                                        className="flex items-center space-x-2 p-3 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg transition-all duration-200"
                                    >
                                        <BsPerson size={16} />
                                        <span className="text-sm font-medium">Contact</span>
                                    </button>
                                    <button
                                        onClick={() => alert('Feature coming soon!')}
                                        className="flex items-center space-x-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-lg transition-all duration-200"
                                    >
                                        <FiPhoneForwarded size={16} />
                                        <span className="text-sm font-medium">Forward</span>
                                    </button>
                                    <button
                                        onClick={toggleConference}
                                        className="flex items-center space-x-2 p-3 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg transition-all duration-200"
                                    >
                                        <TbUsers size={16} />
                                        <span className="text-sm font-medium">Conference</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* End Call Button */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleEndCall}
                                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 group"
                                title="End Call"
                            >
                                <span className="text-white text-2xl font-bold group-hover:animate-pulse">✕</span>
                            </button>
                        </div>
                    </div>
                )}

                {callState === 'ended' && (
                    <div className="text-center space-y-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white mx-auto shadow-lg ${endReason === 'answered_elsewhere' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-pulse'
                            }`}>
                            <span className="text-3xl">
                                {endReason === 'answered_elsewhere' ? '📱' : '📵'}
                            </span>
                        </div>
                        <div>
                            <p className={`text-xl font-bold mb-2 ${endReason === 'answered_elsewhere'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                {endReason === 'answered_elsewhere' ? 'Call Transferred' : 'Call Ended'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {getEndMessage()}
                            </p>
                            {endReason === 'answered_elsewhere' && (
                                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                                    You can continue the call on your other device
                                </p>
                            )}
                            {callDuration > 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-500">
                                    Duration: {formatDuration(callDuration)}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                            <span>Closing automatically...</span>
                        </div>
                    </div>
                )}

                {/* Countdown Progress Bar for Incoming Calls */}
                {callState === 'incoming' && (
                    <div className="mt-6">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
                            ></div>
                        </div>
                        <div className="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Auto-reject in {countdown}s
                        </div>
                    </div>
                )}

                {/* Ring Animation for Incoming Calls */}
                {callState === 'incoming' && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div className="w-80 h-80 border-4 border-orange-400/30 rounded-full animate-ping"></div>
                            <div className="absolute inset-4 border-4 border-orange-500/20 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                            <div className="absolute inset-8 border-4 border-orange-600/10 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                        </div>
                    </div>
                )}
            </div>
            {/* ===== END OF BLOCK ===== */}
        </div>
    );
}