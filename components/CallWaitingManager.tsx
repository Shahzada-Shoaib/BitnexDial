'use client';

import React, { useState, useEffect, useRef } from 'react';

interface CallWaitingManagerProps {
    onAcceptWaiting: (callId: string) => void;
    onRejectWaiting: (callId: string) => void;
    onSwitchCalls: (activeCallId: string, waitingCallId: string) => void;
}

export const CallWaitingManager: React.FC<CallWaitingManagerProps> = ({
    onAcceptWaiting,
    onRejectWaiting,
    onSwitchCalls
}) => {
    const [waitingCall, setWaitingCall] = useState<any>(null);
    const [showPopup, setShowPopup] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const handleCallWaitingEvent = (event: any) => {
            const incomingWaitingCall = event.detail;
            console.log('📞 CallWaitingManager received event:', incomingWaitingCall);
            setWaitingCall(incomingWaitingCall);
            setShowPopup(true);
            playCallWaitingTone();
        };

        window.addEventListener('incomingCallWaiting', handleCallWaitingEvent);

        return () => {
            window.removeEventListener('incomingCallWaiting', handleCallWaitingEvent);
        };
    }, []);

    const playCallWaitingTone = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('Could not play call waiting tone:', error);
        }
    };

    const handleAccept = () => {
        if (waitingCall) {
            onAcceptWaiting(waitingCall.id);
            setShowPopup(false);
            setWaitingCall(null);
        }
    };

    const handleReject = () => {
        if (waitingCall) {
            onRejectWaiting(waitingCall.id);
            setShowPopup(false);
            setWaitingCall(null);
        }
    };

    const handleSwitch = () => {
        if (waitingCall) {
            onSwitchCalls('current', waitingCall.id);
            setShowPopup(false);
            setWaitingCall(null);
        }
    };

    if (!showPopup || !waitingCall) return null;

    return (
        <div className="fixed top-4 right-4 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 z-50 min-w-80">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                    <span className="font-semibold text-gray-800">Call Waiting</span>
                </div>
                <button
                    onClick={() => setShowPopup(false)}
                    className="text-gray-400 hover:text-gray-600"
                >
                    ×
                </button>
            </div>

            <div className="mb-4">
                <p className="text-sm text-gray-600">Incoming call from:</p>
                <p className="font-semibold text-lg">{waitingCall.callerName || 'Unknown Caller'}</p>
                <p className="text-sm text-gray-500">{waitingCall.callerNumber || 'Unknown Number'}</p>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleAccept}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium"
                >
                    Accept
                </button>
                <button
                    onClick={handleReject}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium"
                >
                    Decline
                </button>
            </div>

            <audio ref={audioRef} preload="auto" />
        </div>
    );
};