'use client';

import React, { useState, useEffect } from 'react';
import { IoCall, IoClose } from 'react-icons/io5';
import { BsChatText } from 'react-icons/bs';

interface WaitingCallData {
    id: string;
    callerNumber: string;
    callerName: string;
    lineNumber: number;
    timestamp: number;
}

export default function WaitingCallPopup() {
    const [waitingCall, setWaitingCall] = useState<WaitingCallData | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleCallWaiting = (event: any) => {
            const waitingCallData = event.detail;
            setWaitingCall(waitingCallData);
            setIsVisible(true);

            // Play call waiting tone
            playCallWaitingTone();
        };

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

        window.addEventListener('incomingCallWaiting', handleCallWaiting);

        return () => {
            window.removeEventListener('incomingCallWaiting', handleCallWaiting);
        };
    }, []);

    const handleAccept = () => {
        if (!waitingCall) return;
        if (window.callWaitingManager) {
            window.callWaitingManager.acceptWaitingCall(waitingCall.id);
        }

        // Dispatch event to parent for call state update
        window.dispatchEvent(new CustomEvent('callWaitingAccepted', {
            detail: waitingCall
        }));

        setIsVisible(false);
        setWaitingCall(null);
    };

    const handleDecline = () => {
        if (!waitingCall) return;
        if (window.callWaitingManager) {
            window.callWaitingManager.rejectWaitingCall(waitingCall.id);
        }

        setIsVisible(false);
        setWaitingCall(null);
    };

    const handleSwitch = () => {
        if (!waitingCall) return;
        if (window.callWaitingManager) {
            window.callWaitingManager.switchCalls(waitingCall.id);
        }

        // Dispatch event to parent for call state update
        window.dispatchEvent(new CustomEvent('callWaitingAccepted', {
            detail: waitingCall
        }));

        setIsVisible(false);
        setWaitingCall(null);
    };

    const handleTransitionToMainCall = () => {
        // Accept the waiting call and switch to main interface
        handleAccept();
    };

    if (!isVisible || !waitingCall) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm">
            <div
                className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/90 dark:to-blue-800/90 rounded-2xl shadow-2xl border-2 border-blue-400 dark:border-blue-600 backdrop-blur-sm animate-slideInRight cursor-pointer"
                onClick={handleTransitionToMainCall}
            >
                {/* Header */}
                <div className="p-4 border-b border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
                            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                📞 Call Waiting
                            </h4>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDecline();
                            }}
                            className="text-blue-400 hover:text-blue-600 text-lg font-bold p-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all duration-200"
                        >
                            <IoClose size={16} />
                        </button>
                    </div>
                </div>

                {/* Caller Info */}
                <div className="p-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-lg font-bold">
                                {(waitingCall.callerName || 'U').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-blue-800 dark:text-blue-200 truncate">
                                {waitingCall.callerName || 'Unknown Caller'}
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                                {waitingCall.callerNumber || 'Unknown Number'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAccept();
                            }}
                            className="py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Accept
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDecline();
                            }}
                            className="py-2 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Decline
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSwitch();
                            }}
                            className="py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Switch
                        </button>
                    </div>

                    {/* Click to expand hint */}
                    <div className="mt-3 text-center">
                        <p className="text-xs text-blue-600 dark:text-blue-400 opacity-75">
                            Click to answer and switch to main call interface
                        </p>
                    </div>
                </div>

                {/* Pulse animation ring */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-32 h-32 border-2 border-blue-400/30 rounded-full animate-ping"></div>
                        <div className="absolute inset-2 border-2 border-blue-500/20 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}