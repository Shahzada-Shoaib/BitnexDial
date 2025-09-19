'use client';

import React, { useState, useEffect } from 'react';
import { BsTelephone, BsMicMute, BsVolumeMute } from 'react-icons/bs';
import { IoCall, IoClose } from 'react-icons/io5';

interface MinimizedCallData {
    number: string;
    name: string;
    duration: number;
    lineNumber: number;
    status: 'held';
    startTime: Date;
}

export default function MinimizedCall() {
    const [minimizedCall, setMinimizedCallLocal] = useState<MinimizedCallData | null>(null);

    useEffect(() => {
        const checkMinimizedCall = () => {
            const windowData = (window as any).minimizedCallData;
            if (windowData !== minimizedCall) {
                setMinimizedCallLocal(windowData);
            }
        };

        const interval = setInterval(checkMinimizedCall, 500);
        return () => clearInterval(interval);
    }, [minimizedCall]);

    const handleRestore = () => {
        if ((window as any).handleRestoreMinimizedCall) {
            (window as any).handleRestoreMinimizedCall();
        }
    };

    const handleEndCall = () => {
        if ((window as any).handleEndMinimizedCall) {
            (window as any).handleEndMinimizedCall();
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!minimizedCall) return null;

    return (
        <div
            className="fixed bottom-4 left-4 z-[9998] max-w-xs"
            onMouseEnter={() => { }}
            onMouseLeave={() => { }}
        >
            <div
                className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-yellow-400 dark:border-yellow-500 transition-all duration-300 cursor-pointer hover:scale-105"
                onClick={handleRestore}
            >
                {/* Header */}
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            ON HOLD
                        </span>
                    </div>

                    {/* End call button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEndCall();
                        }}
                        className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 transform hover:scale-110"
                        title="End Call"
                    >
                        <IoClose size={12} />
                    </button>
                </div>

                {/* Call Info */}
                <div className="px-3 pb-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white text-sm font-bold">
                                {(minimizedCall.name || 'U').charAt(0).toUpperCase()}
                            </span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">
                                {minimizedCall.name || 'Unknown Caller'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                {minimizedCall.number || 'Unknown Number'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                {formatDuration(minimizedCall.duration)}
                            </p>
                        </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRestore();
                            }}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Resume Call
                        </button>
                    </div>
                </div>

                {/* Status indicator */}
                <div className="h-1 w-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-b-xl"></div>
            </div>

            {/* Click hint */}
            <div className="text-center mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to resume call
                </p>
            </div>
        </div>
    );
}