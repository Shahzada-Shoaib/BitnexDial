'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiMic, FiMicOff } from "react-icons/fi";
import { BsPlay, BsPause, BsKeyboard, BsStopCircle, BsRecordCircle, BsThreeDotsVertical, BsPerson, BsPersonPlus, BsChatText } from "react-icons/bs";
import { MdVolumeOff, MdVolumeUp } from "react-icons/md";
import { TbTransfer, TbUsers, TbPhoneCall } from "react-icons/tb";
import { FiPhoneForwarded } from "react-icons/fi";
import AlertModal from './AlertModal';

// Call state interface
interface CallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connected' | 'ended' | 'connecting' | 'incoming';
    direction?: 'inbound' | 'outbound';
}

// Enhanced Transfer state interface
interface TransferState {
    isTransferring: boolean;
    transferType: 'blind' | 'attended' | null;
    originalLineNumber: number | null;
    consultationLineNumber: number | null;
    transferTarget: string;
    transferStatus: 'idle' | 'initiating' | 'consulting' | 'ready' | 'completing' | 'completed' | 'failed';
}

interface CallOverlayProps {
    callState: CallState;
    callDuration: number;
    onEndCall: () => void;
    onTextMessage: (number: string) => void;
    getContactName: (number: string) => string;
}
// ===== 1. PROFESSIONAL SUCCESS MODAL COMPONENT =====
interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
}

export default function CallOverlay({
    callState,
    callDuration,
    onEndCall,
    onTextMessage,
    getContactName
}: CallOverlayProps) {
    // Call controls state
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

    // Enhanced Transfer state
    const [transferState, setTransferState] = useState<TransferState>({
        isTransferring: false,
        transferType: null,
        originalLineNumber: null,
        consultationLineNumber: null,
        transferTarget: '',
        transferStatus: 'idle'
    });

    // Add these state variables
    const [callStartTime, setCallStartTime] = useState<Date | null>(null);
    const [callAnswerTime, setCallAnswerTime] = useState<Date | null>(null);
    const [ringStartTime, setRingStartTime] = useState<Date | null>(null);
    const [sessionId] = useState<string>(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

    const saveCallRecord = async (callData: {
        caller: string;
        callee: string;
        direction: 'inbound' | 'outbound';
        start_time: string;
        answer_time?: string;
        end_time?: string;
        duration?: number;
        ring_time?: number;
        terminated_by?: string;
        reason_code?: string;
        reason_text?: string;
        session_id?: string;
        with_video?: boolean;
    }) => {
        console.log('🔄 Attempting to save call record:', {
            caller: callData.caller,
            callee: callData.callee,
            direction: callData.direction,
            duration: callData.duration,
            start_time: callData.start_time,
            answer_time: callData.answer_time,
            end_time: callData.end_time
        });

        try {
            const response = await fetch('https://bkpmanual.bitnexdial.com/api/save-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(callData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            if (result.success) {
                return result;
            } else {
                console.error('❌ API returned failure:', result.error || 'Unknown error');
                throw new Error(result.error || 'Failed to save call record');
            }
        } catch (error: unknown) {
            console.error('❌ Network/Parse Error saving call record:', error);

            if (error instanceof Error) {
                console.error('❌ Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                throw error;
            } else {
                const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
                throw new Error(errorMessage);
            }
        }
    };

    const [dialpadNumber, setDialpadNumber] = useState('');
    const [transferNumber, setTransferNumber] = useState('');
    const [conferenceNumber, setConferenceNumber] = useState('');
    const [showEndCallAlert, setShowEndCallAlert] = useState(false);
    const [showTransferPanel, setShowTransferPanel] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Dragging state
    const [pos, setPos] = useState({ x: 32, y: 64 });
    const [dragging, setDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // ---------- NEW: one-at-a-time panel helper (no var names changed) ----------
    const openExclusive = (panel: 'keypad' | 'more' | 'transfer' | 'conference' | null) => {
        setCallControls(prev => ({
            ...prev,
            showKeypad: panel === 'keypad',
            showMoreOptions: panel === 'more',
            showConference: panel === 'conference'
        }));
        setShowTransferPanel(panel === 'transfer');
    };

    // Helper functions
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    useEffect(() => {
        console.info("callState", callState);
    });

    // ===== ENHANCED TRANSFER FUNCTIONS =====

    const startBlindTransfer = async () => {
        console.clear();
        console.log('🚨🚨🚨 BLIND TRANSFER STARTING 🚨🚨🚨');
        console.log('🔍 transferNumber:', transferNumber);
        console.log('🔍 transferNumber type:', typeof transferNumber);
        console.log('🔍 transferNumber length:', transferNumber?.length);

        alert(`Debug: Starting blind transfer to "${transferNumber}"`);

        if (!transferNumber || !transferNumber.trim()) {
            alert('Please enter a transfer target');
            return;
        }

        try {
            const lineNumber = getCurrentLineNumber();
            console.log('🔍 Line number:', lineNumber);

            if (lineNumber < 0) {
                throw new Error('No active call found');
            }

            console.log('🔍 Calling BlindTransfer...');
            console.log('🔍 window.BlindTransfer exists:', typeof window.BlindTransfer);

            if (window.BlindTransfer && typeof window.BlindTransfer === 'function') {
                console.log('🔍 About to call BlindTransfer with:', lineNumber + 1, transferNumber);

                const result = await window.BlindTransfer(lineNumber + 1, transferNumber);

                console.log('🔍 BlindTransfer result:', result);

                setTransferState(prev => ({
                    ...prev,
                    isTransferring: true,
                    transferType: 'blind',
                    transferStatus: 'completing'
                }));

                alert('Call transferred successfully!');

                // Reset transfer state
                setTransferNumber('');
                setShowTransferPanel(false);
                setTransferState(prev => ({
                    ...prev,
                    isTransferring: false,
                    transferType: null,
                    transferStatus: 'completed'
                }));
            } else {
                console.error('❌ BlindTransfer not found:', typeof window.BlindTransfer);
                throw new Error('Blind transfer function not available');
            }
        } catch (error: any) {
            console.error('❌ TRANSFER ERROR:', error);
            console.error('❌ Error stack:', error.stack);
            alert(`Transfer failed: ${error.message || 'Unknown error'}`);
            setTransferState(prev => ({
                ...prev,
                isTransferring: false,
                transferStatus: 'failed'
            }));
        }
    };

    const startAttendedTransfer = async () => {
        if (!transferNumber.trim()) {
            alert('Please enter a transfer target');
            return;
        }

        try {
            const lineNumber = getCurrentLineNumber();
            if (lineNumber < 0) {
                throw new Error('No active call found');
            }

            setTransferState(prev => ({
                ...prev,
                isTransferring: true,
                transferType: 'attended',
                transferStatus: 'initiating',
                originalLineNumber: lineNumber + 1,
                transferTarget: transferNumber
            }));

            if (window.AttendedTransfer && typeof window.AttendedTransfer === 'function') {
                const consultationSession = await window.AttendedTransfer(lineNumber + 1, transferNumber);

                if (consultationSession) {
                    setTransferState(prev => ({
                        ...prev,
                        transferStatus: 'consulting',
                        consultationLineNumber: consultationSession.data?.line || null
                    }));

                    setTimeout(() => {
                        setTransferState(prev => ({
                            ...prev,
                            transferStatus: 'ready'
                        }));
                    }, 3000);
                } else {
                    throw new Error('Failed to start consultation call');
                }
            } else {
                throw new Error('Attended transfer function not available');
            }
        } catch (error: any) {
            alert(`Transfer failed: ${error.message || 'Unknown error'}`);
            setTransferState(prev => ({
                ...prev,
                isTransferring: false,
                transferStatus: 'failed'
            }));
        }
    };

    const handleSuccessModalClose = () => {
        console.log('🎉 Success modal closing - now resetting transfer state');

        setShowSuccessModal(false);

        setTimeout(() => {
            setTransferNumber('');
            setShowTransferPanel(false);
            setTransferState({
                isTransferring: false,
                transferType: null,
                originalLineNumber: null,
                consultationLineNumber: null,
                transferTarget: '',
                transferStatus: 'idle'
            });
            console.log('✅ Transfer state completely reset');
        }, 500);
    };

    const completeAttendedTransfer = async () => {
        try {
            if (!transferState.originalLineNumber) {
                throw new Error('No original line number found');
            }

            setTransferState(prev => ({
                ...prev,
                transferStatus: 'completing'
            }));

            if (window.CompleteAttendedTransfer && typeof window.CompleteAttendedTransfer === 'function') {
                await window.CompleteAttendedTransfer(transferState.originalLineNumber);

                setTransferState(prev => ({
                    ...prev,
                    transferStatus: 'completed',
                    isTransferring: false
                }));

                setSuccessMessage({
                    title: 'Transfer Completed Successfully!',
                    message: `Call has been successfully transferred to ${transferState.transferTarget}. The transfer is now complete.`
                });
                setShowSuccessModal(true);

                setTimeout(() => {
                    setTransferNumber('');
                    setShowTransferPanel(false);
                    setTransferState({
                        isTransferring: false,
                        transferType: null,
                        originalLineNumber: null,
                        consultationLineNumber: null,
                        transferTarget: '',
                        transferStatus: 'idle'
                    });
                }, 20000);

            } else {
                throw new Error('Complete attended transfer function not available');
            }
        } catch (error: any) {
            alert(`Transfer completion failed: ${error.message || 'Unknown error'}`);
            setTransferState(prev => ({
                ...prev,
                transferStatus: 'failed'
            }));
        }
    };

    const cancelAttendedTransfer = async () => {
        console.log('🔄 UI: Canceling attended transfer');

        try {
            if (transferState.originalLineNumber && window.CancelAttendedTransfer && typeof window.CancelAttendedTransfer === 'function') {
                await window.CancelAttendedTransfer(transferState.originalLineNumber);
                console.log('✅ UI: Transfer cancelled successfully');
            } else {
                console.log('🚨 UI: Using emergency cancel');
                if (transferState.originalLineNumber && window.emergencyTransferCancel) {
                    window.emergencyTransferCancel(transferState.originalLineNumber);
                }
            }
        } catch (error: any) {
            console.error('❌ UI: Failed to cancel attended transfer:', error);

            console.log('🚨 UI: Using emergency cancel fallback');
            if (transferState.originalLineNumber && window.emergencyTransferCancel) {
                window.emergencyTransferCancel(transferState.originalLineNumber);
            }
        } finally {
            setTransferState({
                isTransferring: false,
                transferType: null,
                originalLineNumber: null,
                consultationLineNumber: null,
                transferTarget: '',
                transferStatus: 'idle'
            });
            setTransferNumber('');
            setShowTransferPanel(false);

            console.log('✅ UI: Transfer state completely reset');
        }
    };

    // ===== ENHANCED CONFERENCE FUNCTIONS =====

    const startSimpleConference = async () => {
        if (!conferenceNumber.trim()) {
            alert('Please enter a participant number');
            return;
        }

        try {
            if (window.fixedConferenceManager && typeof window.fixedConferenceManager.startSimple3WayConference === 'function') {
                const conferenceInfo = await window.fixedConferenceManager.startSimple3WayConference(conferenceNumber);

                setCallControls(prev => ({
                    ...prev,
                    conferenceParticipants: [conferenceNumber],
                    showConference: false
                }));

                setConferenceNumber('');
                alert(`3-way conference started with ${conferenceNumber}!`);
            } else if (window.startSimpleConference && typeof window.startSimpleConference === 'function') {
                const conferenceInfo = await window.startSimpleConference(conferenceNumber);

                setCallControls(prev => ({
                    ...prev,
                    conferenceParticipants: [conferenceNumber],
                    showConference: false
                }));

                setConferenceNumber('');
                alert(`3-way conference started with ${conferenceNumber}!`);

            } else if (window.startInstantConference && typeof window.startInstantConference === 'function') {
                const conferenceId = await window.startInstantConference(conferenceNumber);

                setCallControls(prev => ({
                    ...prev,
                    conferenceParticipants: [conferenceNumber],
                    showConference: false
                }));

                setConferenceNumber('');
                alert(`Conference started: ${conferenceId}`);

            } else {
                throw new Error('No conference function available');
            }

        } catch (error: any) {
            console.error('❌ Conference failed:', error);
            alert(`Conference failed: ${error.message || 'Unknown error'}`);
        }
    };

    const debugAllFunctions = () => {
        console.log('- window.fixedConferenceManager:', !!window.fixedConferenceManager);
        if (window.fixedConferenceManager) {
            console.log('- startSimple3WayConference:', typeof window.fixedConferenceManager.startSimple3WayConference);
            console.log('- findActiveLine:', typeof window.fixedConferenceManager.findActiveLine);
            console.log('- isLineInConference:', typeof window.fixedConferenceManager.isLineInConference);
        }

        if (window.Lines?.length) {
            console.log('📋 Active Lines:');
            window.Lines.forEach((line: any, i: number) => {
                if (line?.SipSession) {
                    console.log(`  Line ${i + 1}:`, {
                        state: line.SipSession.state,
                        status: line.SipSession.status,
                        callerID: line.CallerIDNumber,
                        isInConference: line.isInConference
                    });
                }
            });
        }

        if (window.fixedConferenceManager) {
            try {
                const activeLine = window.fixedConferenceManager.findActiveLine();
                const conferenceInfo = window.fixedConferenceManager.getAllActiveConferences();
            } catch (error) {
                console.warn('⚠️ Error testing fixed conference manager:', error);
            }
        }
    };

    const addParticipantToConference = async () => {
        if (!conferenceNumber.trim()) {
            alert('Please enter a participant number');
            return;
        }

        try {
            const lineNumber = getCurrentLineNumber();
            if (lineNumber < 0) {
                throw new Error('No active call found');
            }

            if (window.AddParticipant && typeof window.AddParticipant === 'function') {
                const participantLine = await window.AddParticipant(lineNumber + 1, conferenceNumber);

                if (participantLine) {
                    setCallControls(prev => ({
                        ...prev,
                        conferenceParticipants: [...prev.conferenceParticipants, conferenceNumber],
                        showConference: false
                    }));
                    setConferenceNumber('');
                    alert('Participant added to conference!');

                    setTimeout(() => {
                        if (window.MergeConference && typeof window.MergeConference === 'function') {
                            window.MergeConference(lineNumber + 1, participantLine)
                                .then(() => console.log('✅ Conference merged automatically'))
                                .catch((err: unknown) => console.error('Failed to merge conference:', err));
                        }
                    }, 3000);
                } else {
                    throw new Error('Failed to add participant');
                }
            } else {
                throw new Error('Add participant function not available');
            }
        } catch (error: any) {
            console.error('❌ Failed to add conference participant:', error);
            alert(`Failed to add participant: ${error.message || 'Unknown error'}`);
        }
    };

    const getConferenceInfo = () => {
        try {
            if (window.getActiveConferences && typeof window.getActiveConferences === 'function') {
                const activeConferences = window.getActiveConferences();
                return activeConferences && activeConferences.length > 0 ? activeConferences[0] : null;
            }
            return null;
        } catch (error) {
            console.error('❌ Failed to get conference info:', error);
            return null;
        }
    };

    const isInConference = () => {
        const conferenceInfo = getConferenceInfo();
        return conferenceInfo && conferenceInfo.participantCount > 0;
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
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
                oscillator1.start();
                oscillator2.start();
                oscillator1.stop(audioContext.currentTime + 0.08);
                oscillator2.stop(audioContext.currentTime + 0.08);
                setTimeout(() => audioContext.close(), 180);
            }
        } catch { }
    };

    const toggleMute = async () => {
        const targetMuteState = !callControls.isMuted;
        let muteSuccess = false;

        try {
            const activeLineIndex = getCurrentLineNumber();

            if (activeLineIndex >= 0) {
                if (targetMuteState) {
                    if (window.phoneSystem?.muteCall) {
                        const result = await window.phoneSystem.muteCall(activeLineIndex + 1);
                        muteSuccess = !!result;
                    }
                } else {
                    if (window.phoneSystem?.unmuteCall) {
                        const result = await window.phoneSystem.unmuteCall(activeLineIndex + 1);
                        muteSuccess = !!result;
                    }
                }
            }

            if (muteSuccess) {
                setCallControls(prev => ({ ...prev, isMuted: targetMuteState }));
            }
        } catch (error) {
            console.error('❌ Mute operation failed:', error);
        }
    };

    const toggleHold = async () => {
        const targetHoldState = !callControls.isOnHold;
        let holdSuccess = false;

        try {
            const activeLineIndex = getCurrentLineNumber();

            if (activeLineIndex >= 0) {
                if (targetHoldState) {
                    if (window.phoneSystem?.holdCall) {
                        const result = await window.phoneSystem.holdCall(activeLineIndex + 1);
                        holdSuccess = !!result;
                    }
                } else {
                    if (window.phoneSystem?.unholdCall) {
                        const result = await window.phoneSystem.unholdCall(activeLineIndex + 1);
                        holdSuccess = !!result;
                    }
                }
            }

            if (holdSuccess) {
                setCallControls(prev => ({ ...prev, isOnHold: targetHoldState }));
            }
        } catch (error) {
            console.error('❌ Hold operation failed:', error);
        }
    };

    const sendDTMF = (digit: string) => {
        const connectedStates = ['connected', 'established', 'confirmed'];
        const isCallConnected = callState.isActive && connectedStates.includes(callState.status.toLowerCase());

        if (!isCallConnected && !callState.isActive) {
            console.warn('🔢 DTMF blocked: call not active');
            return;
        }

        setDialpadNumber(prev => prev + digit);

        const activeLineIndex = getCurrentLineNumber();

        if (activeLineIndex >= 0) {
            if (window.sendDTMF && typeof window.sendDTMF === 'function') {
                window.sendDTMF(activeLineIndex + 1, digit);
            }
        }

        setTimeout(() => playDTMFTone(digit), 50);
    };

    // ---------- UPDATED: toggles use openExclusive for mutual exclusivity ----------
    const toggleKeypad = () => openExclusive(callControls.showKeypad ? null : 'keypad');
    const toggleMoreOptions = () => openExclusive(callControls.showMoreOptions ? null : 'more');
    const toggleConference = () => openExclusive(callControls.showConference ? null : 'conference');

    const toggleRecording = () => {
        if (callState.status !== 'connected') return;
        setCallControls(prev => ({ ...prev, isRecording: !prev.isRecording }));
    };

    const addParticipant = () => {
        openExclusive('conference');
    };

    const adjustVolume = (volume: number) => {
        setCallControls(prev => ({ ...prev, volume }));
        setTimeout(() => {
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach((audio: any) => {
                if (audio.srcObject) audio.volume = volume / 100;
            });
        }, 50);
    };

    //Merged one
    const handleEndCall = async () => {
        console.log('🔴 CallOverlay: handleEndCall called');

        try {
            if (callState.isActive && (callStartTime || callAnswerTime)) {
                await saveCallRecordOnEnd();
            }

            await terminateAllActiveSessions();

            window.dispatchEvent(new Event('globalCallEnd'));

            onEndCall();

        } catch (error) {
            console.error('❌ Error in handleEndCall:', error);
            onEndCall();
        }
    };

    //Merge
    const confirmEndCall = async () => {
        console.log('✅ Call termination confirmed by user');

        try {
            if (callState.isActive && (callStartTime || callAnswerTime)) {
                const now = new Date();
                const startTime = callStartTime || new Date(Date.now() - callDuration * 1000);
                const answerTime = callAnswerTime;
                const ringTime = answerTime && ringStartTime ?
                    Math.floor((answerTime.getTime() - ringStartTime.getTime()) / 1000) : 0;

                const myPhoneNumber = localStorage.getItem("myPhoneNumber") || "unknown";

                const callDataToSave = {
                    caller: callState.direction === 'outbound' ? myPhoneNumber : callState.number,
                    callee: callState.direction === 'outbound' ? callState.number : myPhoneNumber,
                    direction: callState.direction || 'outbound',
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
                    await saveCallRecord(callDataToSave);
                } catch (saveError) {
                    console.error('❌ Failed to save call record:', saveError);
                }
            }

            if (transferState.isTransferring) {
                console.log('🔄 Cancelling active transfer before ending call...');
                await cancelAttendedTransfer();
            }

            await terminateAllActiveSessions();

            setShowEndCallAlert(false);

            window.dispatchEvent(new Event('globalCallEnd'));

            onEndCall();

            console.log('✅ Call successfully terminated');

        } catch (error) {
            console.error('❌ Error in confirmEndCall:', error);

            setShowEndCallAlert(false);
            onEndCall();
        }
    };

    const terminateAllActiveSessions = async () => {
        try {
            console.log('🔍 Looking for active sessions to terminate...');

            if (!window.Lines || !Array.isArray(window.Lines)) {
                console.warn('⚠️ No Lines array found');
                return;
            }

            const sessionsToTerminate: Array<{
                lineNumber: number;
                session: any;
                state: string;
                status: string;
            }> = [];

            window.Lines.forEach((line: any, index: number) => {
                if (line && line.SipSession) {
                    const session = line.SipSession;
                    const state = session.state || 'Unknown';
                    const status = session.status || 'Unknown';

                    console.log(`📞 Line ${index + 1}: state=${state}, status=${status}`);

                    if (state !== 'Terminated' && state !== 'Terminating') {
                        sessionsToTerminate.push({
                            lineNumber: index + 1,
                            session: session,
                            state: state,
                            status: status
                        });
                    }
                }
            });

            console.log(`🎯 Found ${sessionsToTerminate.length} sessions to terminate`);

            if (sessionsToTerminate.length === 0) {
                console.log('ℹ️ No active sessions to terminate');
                return;
            }

            const terminationPromises = sessionsToTerminate.map(async (sessionInfo) => {
                return Promise.race([
                    terminateSession(sessionInfo),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Termination timeout')), 5000)
                    )
                ]).catch((error) => {
                    console.error(`❌ Failed to terminate session on line ${sessionInfo.lineNumber}:`, error);
                });
            });

            await Promise.allSettled(terminationPromises);

            setTimeout(() => {
                console.log('🧹 Final cleanup of all lines...');
                if (window.Lines && Array.isArray(window.Lines)) {
                    window.Lines.forEach((line: any, index: number) => {
                        if (line && line.SipSession) {
                            console.log(`🔨 Force cleaning line ${index + 1}`);
                            line.SipSession = null;
                            line.IsSelected = false;
                            line.status = 'terminated';

                            if (window.clearLine && typeof window.clearLine === 'function') {
                                window.clearLine(index);
                            }
                        }
                    });
                }
            }, 1000);

        } catch (error) {
            console.error('❌ Error in terminateAllActiveSessions:', error);
        }
    };

    const terminateSession = async (sessionInfo: {
        lineNumber: number;
        session: any;
        state: string;
        status: string;
    }) => {
        const { lineNumber, session, state } = sessionInfo;

        try {
            console.log(`🛑 Terminating session on line ${lineNumber} (state: ${state})`);

            switch (state) {
                case 'Initial':
                case 'Establishing':
                    if (typeof session.cancel === 'function') {
                        console.log(`🚫 Cancelling ${state} session on line ${lineNumber}`);
                        await session.cancel();
                    } else if (typeof session.terminate === 'function') {
                        console.log(`🛑 Terminating ${state} session on line ${lineNumber}`);
                        await session.terminate();
                    } else {
                        console.warn(`⚠️ No cancel/terminate method available for ${state} session`);
                    }
                    break;

                case 'Established':
                case 'Confirmed':
                    if (typeof session.bye === 'function') {
                        console.log(`👋 Sending BYE for established session on line ${lineNumber}`);
                        await session.bye();
                    } else if (typeof session.terminate === 'function') {
                        console.log(`🛑 Terminating established session on line ${lineNumber}`);
                        await session.terminate();
                    } else {
                        console.warn(`⚠️ No bye/terminate method available for established session`);
                    }
                    break;

                case 'Terminating':
                case 'Terminated':
                    console.log(`ℹ️ Session on line ${lineNumber} already ${state.toLowerCase()}`);
                    break;

                default:
                    console.log(`⚠️ Unknown state ${state}, trying safest termination method`);
                    if (typeof session.cancel === 'function') {
                        console.log(`🚫 Using cancel for unknown state on line ${lineNumber}`);
                        await session.cancel();
                    } else if (typeof session.terminate === 'function') {
                        console.log(`🛑 Using terminate for unknown state on line ${lineNumber}`);
                        await session.terminate();
                    } else if (typeof session.bye === 'function') {
                        console.log(`👋 Using bye for unknown state on line ${lineNumber}`);
                        await session.bye();
                    }
            }

            if (window.clearLine && typeof window.clearLine === 'function') {
                setTimeout(() => {
                    window.clearLine(lineNumber - 1);
                    console.log(`🧹 Cleaned up line ${lineNumber}`);
                }, 100);
            }

            console.log(`✅ Successfully terminated session on line ${lineNumber}`);

        } catch (error) {
            console.error(`❌ Error terminating session on line ${lineNumber}:`, error);

            try {
                console.log(`🔨 Attempting force termination for line ${lineNumber}`);

                if (session && typeof session.terminate === 'function') {
                    await session.terminate().catch(() => {
                        console.log(`⚠️ Force terminate also failed, using manual cleanup`);
                    });
                }

                if (window.Lines && window.Lines[lineNumber - 1]) {
                    window.Lines[lineNumber - 1].SipSession = null;
                    window.Lines[lineNumber - 1].IsSelected = false;
                    window.Lines[lineNumber - 1].status = 'terminated';
                    console.log(`🔨 Force cleared line ${lineNumber} object`);
                }

                if (window.clearLine && typeof window.clearLine === 'function') {
                    window.clearLine(lineNumber - 1);
                }

            } catch (forceError) {
                console.error(`❌ Force cleanup also failed for line ${lineNumber}:`, forceError);
            }
        }
    };

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
            callStateDirection: callState.direction,
            callStateNumber: callState.number
        });

        const callDataToSave = {
            caller: callState.direction === 'outbound' ? myPhoneNumber : myPhoneNumber,
            callee: callState.direction === 'outbound' ? callState.number : callState.number,
            direction: callState.direction || 'outbound',
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
            await saveCallRecord(callDataToSave);
            setCallStartTime(null);
            setCallAnswerTime(null);
            setRingStartTime(null);
        } catch (saveError) {
            console.error('❌ Failed to save call record on end:', saveError);
        }
    };

    // Enhanced useEffect for call state tracking with better logging
    useEffect(() => {
        const initializeCallWaiting = () => {
            console.log('✅ CallOverlay fully initialized and ready for call waiting events');
        };

        const initTimeout = setTimeout(initializeCallWaiting, 100);

        const handleConferenceStarted = (event: any) => {
            const { conferenceId, roomExtension } = event.detail;
            alert(`Conference started in room ${roomExtension}`);
        };

        const handleConferenceEnded = (event: any) => {
            const { conferenceId, roomExtension } = event.detail;
            setCallControls(prev => ({
                ...prev,
                conferenceParticipants: []
            }));
        };

        const handleConferenceMerged = (event: any) => {
            const { hostLine, participantLine, conferenceId } = event.detail;
            alert('Participants successfully merged into conference!');
        };

        const handleParticipantRemoved = (event: any) => {
            const { hostLine, participantLine } = event.detail;
            setCallControls(prev => ({
                ...prev,
                conferenceParticipants: prev.conferenceParticipants.filter((_, index) => index !== participantLine - 1)
            }));
        };

        const handleConsultationEstablished = (event: any) => {
            const { originalLine, consultationSession, targetNumber } = event.detail;

            setTransferState(prev => ({
                ...prev,
                transferStatus: 'ready',
                consultationLineNumber: consultationSession?.data?.line || null
            }));
        };

        const handleConsultationTerminated = (event: any) => {
            setTransferState({
                isTransferring: false,
                transferType: null,
                originalLineNumber: null,
                consultationLineNumber: null,
                transferTarget: '',
                transferStatus: 'idle'
            });
        };

        const handleTransferCompleted = (event: any) => {
            setTransferState({
                isTransferring: false,
                transferType: null,
                originalLineNumber: null,
                consultationLineNumber: null,
                transferTarget: '',
                transferStatus: 'completed'
            });
            setShowTransferPanel(false);
        };

        window.addEventListener('conferenceStarted', handleConferenceStarted);
        window.addEventListener('conferenceEnded', handleConferenceEnded);
        window.addEventListener('conferenceMerged', handleConferenceMerged);
        window.addEventListener('participantRemoved', handleParticipantRemoved);
        window.addEventListener('consultationEstablished', handleConsultationEstablished);
        window.addEventListener('consultationTerminated', handleConsultationTerminated);
        window.addEventListener('attendedTransferCompleted', handleTransferCompleted);

        return () => {
            clearTimeout(initTimeout);
            window.removeEventListener('conferenceStarted', handleConferenceStarted);
            window.removeEventListener('conferenceEnded', handleConferenceEnded);
            window.removeEventListener('conferenceMerged', handleConferenceMerged);
            window.removeEventListener('participantRemoved', handleParticipantRemoved);
            window.removeEventListener('consultationEstablished', handleConsultationEstablished);
            window.removeEventListener('consultationTerminated', handleConsultationTerminated);
            window.removeEventListener('attendedTransferCompleted', handleTransferCompleted);
        };
    }, []);

    // Dragging functionality
    const onMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        dragOffset.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        };
        document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
        if (dragging) {
            setPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y,
            });
        }
    };

    const onMouseUp = () => {
        setDragging(false);
        document.body.style.userSelect = '';
    };

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            return () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
        }
    }, [dragging]);

    // Render minimized chip if minimized
    if (isMinimized && callState.isActive) {
        return (
            <div
                className="fixed bottom-4 left-4 z-50 flex items-center space-x-2 cursor-pointer select-none bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl rounded-full px-3 py-1.5"
                onClick={() => setIsMinimized(false)}
                title="Restore call window"
            >
                <span className="bg-white/20 p-0.5 rounded-full text-white font-bold mr-1.5">📞</span>
                <span className="text-white font-semibold text-sm">
                    {callState.name || callState.number}
                </span>
                <span className="ml-1.5 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded">
                    {formatDuration(callDuration)}
                </span>
            </div>
        );
    }

    // Don't render if call is not active
    if (!callState.isActive) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: pos.y,
                left: pos.x,
                zIndex: 9999,
                width: 320,                // ↓ smaller width
                maxWidth: '88vw',
                height: '72vh',            // ↓ smaller height
                overflowY: 'auto',
            }}
            className="transform transition-all duration-500 animate-slideUp overflow-y-auto"
        >
            {/* Container */}
            <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-600/30">

                {/* Header */}
                <div
                    className="flex items-center justify-between cursor-move select-none bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] px-4 py-1 rounded-t-2xl"
                    onMouseDown={onMouseDown}
                    style={{ cursor: 'move' }}
                >
                    <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-white text-[11px] font-bold">📞</span>
                        </div>
                        <div>
                            <span className="text-white font-semibold text-[12px]">
                                {getContactName(callState.number)}
                            </span>
                            {callState.status === 'connected' && (
                                <div className="text-white/70 text-[10px] font-mono">
                                    {formatDuration(callDuration)}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        className="p-0.5 rounded-full bg-yellow-400 hover:bg-yellow-500 text-white shadow-lg transition-all duration-200"
                        title="Minimize"
                        onClick={() => setIsMinimized(true)}
                    >
                        <span style={{ fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>—</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-3">
                    {/* Status */}
                    <div className="text-center mb-4">
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 rounded-full shadow-lg mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${transferState.isTransferring ? 'bg-purple-500 animate-pulse' :
                                callState.status === 'connected' ? 'bg-green-500 animate-pulse' :
                                    callState.status === 'ringing' ? 'bg-yellow-500 animate-bounce' :
                                        callState.status === 'incoming' ? 'bg-blue-500 animate-pulse' :
                                            callState.status === 'connecting' ? 'bg-blue-500 animate-pulse' :
                                                'bg-blue-500 animate-bounce'
                                }`}></div>
                            <span className="text-[12px] font-semibold text-blue-800 dark:text-blue-200 capitalize">
                                {transferState.isTransferring ? `Transfer ${transferState.transferStatus}...` :
                                    callState.status === 'dialing' ? 'Calling...' :
                                        callState.status === 'connecting' ? 'Connecting...' :
                                            callState.status === 'ringing' ? 'Ringing...' :
                                                callState.status === 'incoming' ? 'Incoming Call...' :
                                                    callState.status === 'connected' ? 'Connected' : 'Unknown'}
                            </span>
                        </div>

                        {/* Conference Panel */}
                        {callControls.showConference && !transferState.isTransferring && (
                            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-3 border border-green-200 dark:border-green-600 mt-2">
                                <h4 className="text-[12px] font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center space-x-1.5">
                                    <TbUsers size={14} />
                                    <span>Start 3-Way Conference</span>
                                </h4>

                                {isInConference() ? (
                                    <div className="mb-2.5 p-2.5 bg-green-100 dark:bg-green-900/50 rounded-md border border-green-200 dark:border-green-700">
                                        <div className="text-[12px] font-semibold text-green-800 dark:text-green-200 mb-1.5">
                                            🎉 Conference Active
                                        </div>
                                        <div className="text-[11px] text-green-700 dark:text-green-300">
                                            Participants: {callControls.conferenceParticipants.length + 1}
                                        </div>
                                        {callControls.conferenceParticipants.map((participant, idx) => (
                                            <div key={idx} className="text-[11px] text-green-700 dark:text-green-300 mt-0.5">
                                                📞 {participant}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[11px] font-medium text-green-700 dark:text-green-300 mb-1.5">
                                                Add participant to call:
                                            </label>
                                            <input
                                                type="text"
                                                value={conferenceNumber}
                                                onChange={(e) => setConferenceNumber(e.target.value)}
                                                className="w-full p-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-green-500"
                                                placeholder="Enter phone number"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={startSimpleConference}
                                                disabled={!conferenceNumber.trim()}
                                                className="py-2 px-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-semibold transition-all duration-200 flex items-center justify-center space-x-1.5 shadow-md hover:shadow-lg"
                                            >
                                                <TbUsers size={14} />
                                                <span className="text-[12px]">Start 3-Way</span>
                                            </button>
                                            <button
                                                onClick={() => openExclusive(null)}
                                                className="py-2 px-3 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-gray-300 rounded-md font-semibold transition-all duration-200 text-[12px]"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        <div className="pt-1.5 border-t border-green-200 dark:border-green-700">
                                            <button
                                                onClick={debugAllFunctions}
                                                className="w-full py-1.5 px-3 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md text-[11px] font-medium transition-all duration-200"
                                            >
                                                🔍 Debug Conference System
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transfer Status */}
                        {transferState.isTransferring && (
                            <div className="mb-2.5 p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
                                <div className="text-[12px] font-semibold text-purple-800 dark:text-purple-200 mb-1">
                                    {transferState.transferType === 'blind' ? '🔄 Blind Transfer' : '🤝 Attended Transfer'}
                                </div>
                                <div className="text-[11px] text-purple-700 dark:text-purple-300">
                                    {transferState.transferStatus === 'initiating' && 'Initiating transfer...'}
                                    {transferState.transferStatus === 'consulting' && 'Consultation call in progress...'}
                                    {transferState.transferStatus === 'ready' && 'Ready to complete transfer'}
                                    {transferState.transferStatus === 'completing' && 'Completing transfer...'}
                                </div>
                                {transferState.transferTarget && (
                                    <div className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                                        To: {transferState.transferTarget}
                                    </div>
                                )}
                            </div>
                        )}

                        {callState.direction && (
                            <div className="text-[11px] text-gray-600 dark:text-gray-400 mb-1">
                                {callState.direction === 'outbound' ? '📞 Outgoing Call' : '📱 Incoming Call'}
                            </div>
                        )}

                        {callState.status === 'connected' && !transferState.isTransferring && (
                            <div className="text-xl font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-md shadow-inner mb-2">
                                {formatDuration(callDuration)}
                            </div>
                        )}

                        <div className="flex justify-center space-x-2 mb-2">
                            {callControls.isOnHold && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-semibold rounded-full">
                                    ON HOLD
                                </span>
                            )}
                            {callControls.isMuted && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-semibold rounded-full">
                                    MUTED
                                </span>
                            )}
                            {callControls.isRecording && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-semibold rounded-full animate-pulse">
                                    🔴 RECORDING
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] dark:from-[#4a90e2] dark:to-[#3778D6] rounded-full mx-auto mb-2 flex items-center justify-center shadow-xl ring-2 ring-white dark:ring-slate-700">
                            <span className="text-white text-xl font-bold">
                                {callState.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                        </div>
                        <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-1">
                            {getContactName(callState.number)}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-[12px] font-mono bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {callState.number}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                            {/* Mute */}
                            <button
                                onClick={toggleMute}
                                disabled={transferState.isTransferring}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl ${callControls.isMuted ? 'bg-red-500 hover:bg-red-600 text-white' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    } ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={callControls.isMuted ? 'Unmute' : 'Mute'}
                            >
                                {callControls.isMuted ? <FiMicOff size={16} /> : <FiMic size={16} />}
                            </button>

                            {/* Hold */}
                            <button
                                onClick={toggleHold}
                                disabled={transferState.isTransferring}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl ${callControls.isOnHold ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    } ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={callControls.isOnHold ? 'Resume' : 'Hold'}
                            >
                                {callControls.isOnHold ? <BsPlay size={16} /> : <BsPause size={16} />}
                            </button>

                            {/* Keypad */}
                            <button
                                onClick={toggleKeypad}
                                disabled={transferState.isTransferring}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl ${callControls.showKeypad ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    } ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Keypad"
                            >
                                <BsKeyboard size={16} />
                            </button>

                            {/* Transfer */}
                            <button
                                onClick={() => openExclusive(showTransferPanel ? null : 'transfer')}
                                className={`w-full h-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl ${(showTransferPanel || transferState.isTransferring) ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                title="Transfer"
                            >
                                <TbTransfer size={16} />
                            </button>
                        </div>

                        {/* Transfer Panel */}
                        {showTransferPanel && (
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-3 border border-purple-200 dark:border-purple-600">
                                <h4 className="text-[12px] font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center space-x-1.5">
                                    <TbTransfer size={14} />
                                    <span>Transfer Options</span>
                                </h4>

                                {!transferState.isTransferring ? (
                                    <div className="flex justify-center items-center min-h-[200px]">
                                        <div className="w-full space-y-3 bg-white dark:bg-slate-800 p-3 rounded-md shadow">
                                            <div>
                                                <label className="block text-[11px] font-medium text-purple-700 dark:text-purple-300 mb-1">
                                                    Transfer to Number/Extension:
                                                </label>
                                                <input
                                                    type="text"
                                                    value={transferNumber}
                                                    onChange={(e) => setTransferNumber(e.target.value)}
                                                    className="w-full p-2 border border-purple-300 dark:border-purple-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Enter number or extension"
                                                />
                                            </div>

                                            <div className="flex justify-center">
                                                <button
                                                    onClick={startAttendedTransfer}
                                                    disabled={!transferNumber.trim()}
                                                    className="py-2 px-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-semibold transition-all duration-200 flex items-center space-x-1.5 shadow-md hover:shadow-lg"
                                                >
                                                    <TbPhoneCall size={14} />
                                                    <span className="text-[12px]">Transfer</span>
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => openExclusive(null)}
                                                className="w-full px-3 py-1.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-gray-300 rounded-md font-semibold transition-all duration-200 text-[12px]"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="text-center">
                                            <div className="inline-flex items-center space-x-1.5 mb-1.5">
                                                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse"></div>
                                                <span className="text-[12px] font-medium text-purple-800 dark:text-purple-200">
                                                    {transferState.transferType === 'blind' ? 'Blind Transfer' : 'Attended Transfer'}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-purple-600 dark:text-purple-400 mb-1">
                                                To: {transferState.transferTarget}
                                            </div>
                                            <div className="text-[11px] text-purple-600 dark:text-purple-400">
                                                Status: {transferState.transferStatus}
                                            </div>
                                        </div>

                                        {transferState.transferType === 'attended' && transferState.transferStatus === 'ready' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={completeAttendedTransfer}
                                                    className="py-1.5 px-3 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold transition-all duration-200 flex items-center justify-center space-x-1.5 shadow-md hover:shadow-lg"
                                                >
                                                    <span>✓</span>
                                                    <span className="text-[12px]">Complete</span>
                                                </button>

                                                <button
                                                    onClick={cancelAttendedTransfer}
                                                    className="py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition-all duration-200 flex items-center justify-center space-x-1.5 shadow-md hover:shadow-lg"
                                                >
                                                    <span>✕</span>
                                                    <span className="text-[12px]">Cancel</span>
                                                </button>
                                            </div>
                                        )}

                                        {(transferState.transferStatus === 'initiating' || transferState.transferStatus === 'consulting') && (
                                            <button
                                                onClick={cancelAttendedTransfer}
                                                className="w-full py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition-all duration-200 text-[12px]"
                                            >
                                                Cancel Transfer
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Secondary Controls */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={toggleRecording}
                                disabled={transferState.isTransferring}
                                className={`w-full h-9 rounded-md flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg ${callControls.isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    } ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={callControls.isRecording ? 'Stop Recording' : 'Start Recording'}
                            >
                                {callControls.isRecording ? <BsStopCircle size={14} /> : <BsRecordCircle size={14} />}
                            </button>

                            <button
                                onClick={addParticipant}
                                disabled={transferState.isTransferring}
                                className={`w-full h-9 rounded-md flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''
                                    } ${isInConference() ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'}`}
                                title={isInConference() ? "Add to Conference" : "Start Conference"}
                            >
                                {isInConference() ? <BsPersonPlus size={14} /> : <TbUsers size={14} />}
                            </button>

                            <button
                                onClick={toggleMoreOptions}
                                disabled={transferState.isTransferring}
                                className={`w-full h-9 rounded-md flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg ${callControls.showMoreOptions ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                    'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                                    } ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="More Options"
                            >
                                <BsThreeDotsVertical size={14} />
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="px-1.5">
                            <div className="flex items-center space-x-2">
                                <MdVolumeOff className="text-gray-500" size={14} />
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={callControls.volume}
                                        onChange={(e) => adjustVolume(Number(e.target.value))}
                                        disabled={transferState.isTransferring}
                                        className={`w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider ${transferState.isTransferring ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                    />
                                </div>
                                <MdVolumeUp className="text-gray-500" size={14} />
                                <span className="text-[11px] text-gray-500 min-w-[3ch]">{callControls.volume}</span>
                            </div>
                        </div>

                        {/* Keypad */}
                        {callControls.showKeypad && !transferState.isTransferring && (
                            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        value={dialpadNumber}
                                        onChange={e => setDialpadNumber(e.target.value)}
                                        className="w-full p-1.5 text-center text-[16px] font-mono border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        placeholder="Enter digits"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
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
                                            className="h-9 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md flex flex-col items-center justify-center text-[13px] font-semibold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 border border-gray-200 dark:border-slate-600"
                                        >
                                            <span className="text-gray-800 dark:text-gray-100 leading-none">{key.number}</span>
                                            {key.letters && (
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    {key.letters}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* More Options */}
                        {callControls.showMoreOptions && !transferState.isTransferring && (
                            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                                <h4 className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 mb-2">More Options</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onTextMessage(callState.number)}
                                        className="flex items-center space-x-1.5 p-2.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md transition-all duration-200"
                                    >
                                        <BsChatText size={14} />
                                        <span className="text-[12px] font-medium">Message</span>
                                    </button>
                                    <button
                                        className="flex items-center space-x-1.5 p-2.5 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md transition-all duration-200"
                                    >
                                        <BsPerson size={14} />
                                        <span className="text-[12px] font-medium">Contact</span>
                                    </button>
                                    <button
                                        className="flex items-center space-x-1.5 p-2.5 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-md transition-all duration-200"
                                    >
                                        <FiPhoneForwarded size={14} />
                                        <span className="text-[12px] font-medium">Forward</span>
                                    </button>
                                    <button
                                        className="flex items-center space-x-1.5 p-2.5 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md transition-all duration-200"
                                    >
                                        <TbUsers size={14} />
                                        <span className="text-[12px] font-medium">Conference</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* End Call */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleEndCall}
                                className="w-13 h-13 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 group"
                                title="End Call"
                                style={{ width: 52, height: 52 }} // explicit smaller size
                            >
                                <span className="text-white text-xl font-bold group-hover:animate-pulse">✕</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alert Modal */}
            <AlertModal
                isOpen={showEndCallAlert}
                onClose={() => setShowEndCallAlert(false)}
                onConfirm={confirmEndCall}
                title="End Call"
                message={transferState.isTransferring ? "This will cancel the current transfer and end the call. Are you sure?" : "Are you sure you want to end this call?"}
                type="warning"
                confirmText="End Call"
                cancelText="Continue"
                showCancel={true}
            />

        </div>
    );
}
