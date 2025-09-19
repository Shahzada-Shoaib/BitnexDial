// SwitchCallNotification.tsx - RingCentral-style notification

import React, { useState, useEffect } from 'react';
import { MdPhoneAndroid, MdSwapHoriz, MdClose } from 'react-icons/md';
import { BsPhone } from 'react-icons/bs';

interface SwitchableCall {
    extension: string;
    callerNumber: string;
    callerName: string;
    duration: number;
    deviceName: string;
}

export default function SwitchCallNotification() {
    const [switchableCall, setSwitchableCall] = useState<SwitchableCall | null>(null);
    const [switching, setSwitching] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [myExtension, setMyExtension] = useState('');

    useEffect(() => {
        // Get my extension
        const ext = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername") || '';
        setMyExtension(ext);

        // Check for switchable calls
        const checkSwitchableCall = () => {
            if (!ext) return;

            // Check if there's an active call on another device
            const hasLocalCall = window.callSwitchingManager?.hasActiveCallOnThisDevice();
            
            if (!hasLocalCall) {
                // Simulate detecting call on another device
                // In real implementation, this would check via WebSocket, shared storage, etc.
                const callSwitchRequest = localStorage.getItem('activeCallOnOtherDevice');
                if (callSwitchRequest) {
                    try {
                        const callData = JSON.parse(callSwitchRequest);
                        if (callData.extension === ext && callData.timestamp > Date.now() - 30000) {
                            setSwitchableCall({
                                extension: ext,
                                callerNumber: callData.callerNumber || 'Unknown',
                                callerName: callData.callerName || 'Unknown Caller',
                                duration: Math.floor((Date.now() - callData.startTime) / 1000),
                                deviceName: callData.deviceName || 'Other Device'
                            });
                            setShowNotification(true);
                            return;
                        }
                    } catch (e) {
                        // Invalid data, ignore
                    }
                }
            }
            
            // Also check if we can switch using the call switching manager
            if (window.canSwitchCall && window.canSwitchCall()) {
                // Show notification for potential switchable call
                setSwitchableCall({
                    extension: ext,
                    callerNumber: 'Active Call',
                    callerName: 'Call in Progress',
                    duration: 0,
                    deviceName: 'Other Device'
                });
                setShowNotification(true);
            } else {
                setShowNotification(false);
                setSwitchableCall(null);
            }
        };

        const interval = setInterval(checkSwitchableCall, 2000);
        checkSwitchableCall(); // Initial check

        return () => clearInterval(interval);
    }, []);

    const handleSwitchCall = async () => {
        if (!switchableCall || switching) return;
        
        setSwitching(true);
        try {
            if (window.switchCallToThisDevice) {
                await window.switchCallToThisDevice();
                console.log('✅ Call switched successfully');
                
                // Hide notification
                setShowNotification(false);
                setSwitchableCall(null);
                
                // Clear the switch request
                localStorage.removeItem('activeCallOnOtherDevice');
                
                // Show success message briefly
                setTimeout(() => {
                    alert('Call switched to this device successfully!');
                }, 500);
                
            } else {
                throw new Error('Switch function not available');
            }
        } catch (error: any) {
            console.error('❌ Failed to switch call:', error);
            alert(`Failed to switch call: ${error.message || 'Unknown error'}`);
        } finally {
            setSwitching(false);
        }
    };

    const handleDismiss = () => {
        setShowNotification(false);
        setSwitchableCall(null);
        localStorage.removeItem('activeCallOnOtherDevice');
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!showNotification || !switchableCall) return null;

    return (
        <>
            {/* Overlay backdrop */}
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"></div>
            
            {/* Notification card */}
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-600 p-6 max-w-md w-full mx-4 animate-slideDown">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <BsPhone className="text-white text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                Active Call Available
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Extension {myExtension}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDismiss}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    >
                        <MdClose size={20} />
                    </button>
                </div>

                {/* Call info */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-lg font-bold">
                                {switchableCall.callerName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                {switchableCall.callerName}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                {switchableCall.callerNumber}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                On {switchableCall.deviceName}
                            </div>
                            {switchableCall.duration > 0 && (
                                <div className="text-lg font-mono text-green-600 dark:text-green-400">
                                    {formatDuration(switchableCall.duration)}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Call in progress on another device</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handleSwitchCall}
                        disabled={switching}
                        className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                            switching
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                        }`}
                    >
                        {switching ? (
                            <>
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                <span>Switching Call...</span>
                            </>
                        ) : (
                            <>
                                <MdPhoneAndroid size={20} />
                                <span>Switch to This Device</span>
                                <MdSwapHoriz size={18} />
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleDismiss}
                        className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all duration-200"
                    >
                        Keep on Other Device
                    </button>
                </div>

                {/* Info text */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        The call will be transferred to this device. The other device will be disconnected.
                    </p>
                </div>
            </div>
        </>
    );
}

// Add this CSS for the slide animation
const styles = `
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

.animate-slideDown {
    animation: slideDown 0.3s ease-out;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Helper component for integration into main app
export function useSwitchCallDetection() {
    const [canSwitch, setCanSwitch] = useState(false);

    useEffect(() => {
        const checkSwitchability = () => {
            if (window.canSwitchCall) {
                setCanSwitch(window.canSwitchCall());
            }
        };

        const interval = setInterval(checkSwitchability, 2000);
        checkSwitchability();

        return () => clearInterval(interval);
    }, []);

    return { canSwitch };
}

// Simulate call notification for testing
export function simulateCallOnOtherDevice(callerNumber: string, callerName: string) {
    const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
    if (!myExtension) return;

    const callData = {
        extension: myExtension,
        callerNumber,
        callerName,
        startTime: Date.now(),
        deviceName: 'Desktop App',
        timestamp: Date.now()
    };

    localStorage.setItem('activeCallOnOtherDevice', JSON.stringify(callData));
    console.log('📱 Simulated call on other device:', callData);
}

// Export for testing
