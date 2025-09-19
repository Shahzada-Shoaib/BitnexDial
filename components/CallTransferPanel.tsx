import React, { useState, useEffect } from 'react';
import { TbTransfer, TbArrowRight, TbPhone, TbPhoneCall } from 'react-icons/tb';
import { MdCallReceived } from 'react-icons/md';

interface ActiveCall {
    lineNumber: number;
    callerNumber: string;
    callerName: string;
    duration: number;
    status: string;
}

interface CallTransferPanelProps {
    isVisible?: boolean;
    onClose?: () => void;
}

export default function CallTransferPanel({ isVisible = true, onClose }: CallTransferPanelProps) {
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [transferring, setTransferring] = useState(false);
    const [transferTarget, setTransferTarget] = useState('');
    const [transferMode, setTransferMode] = useState<'take' | 'blind' | 'attended'>('take');
    const [myExtension, setMyExtension] = useState('');

    useEffect(() => {
        // Get my extension
        const ext = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername") || '';
        setMyExtension(ext);

        // Check for active calls
        const checkActiveCall = () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                for (let i = 0; i < window.Lines.length; i++) {
                    const line = window.Lines[i];
                    if (line && line.SipSession && 
                        ['connecting', 'connected', 'confirmed', 'established'].includes(
                            (line.SipSession.status || '').toLowerCase()
                        )) {
                        
                        setActiveCall({
                            lineNumber: i + 1,
                            callerNumber: line.CallerIDNumber || 'Unknown',
                            callerName: line.CallerIDName || 'Unknown Caller',
                            duration: 0, // You can calculate this based on line.startTime
                            status: line.SipSession.status
                        });
                        return;
                    }
                }
            }
            setActiveCall(null);
        };

        const interval = setInterval(checkActiveCall, 1000);
        checkActiveCall(); // Initial check

        return () => clearInterval(interval);
    }, []);

    const handleTakeCall = async () => {
        if (!activeCall) return;
        
        setTransferring(true);
        try {
            if (window.takeActiveCall) {
                await window.takeActiveCall();
                console.log('✅ Successfully took the call');
                
                // Show success message
                setTimeout(() => {
                    setTransferring(false);
                    if (onClose) onClose();
                }, 1000);
            } else {
                throw new Error('Transfer function not available');
            }
        } catch (error: any) {
            console.error('❌ Failed to take call:', error);
            alert(`Failed to take call: ${error.message || 'Unknown error'}`);
            setTransferring(false);
        }
    };

    const handleBlindTransfer = async () => {
        if (!activeCall || !transferTarget.trim()) return;
        
        setTransferring(true);
        try {
            if (window.blindTransferCall) {
                await window.blindTransferCall(activeCall.lineNumber, transferTarget);
                console.log('✅ Blind transfer successful');
                
                setTimeout(() => {
                    setTransferring(false);
                    setTransferTarget('');
                    if (onClose) onClose();
                }, 1000);
            } else {
                throw new Error('Blind transfer function not available');
            }
        } catch (error: any) {
            console.error('❌ Blind transfer failed:', error);
            alert(`Transfer failed: ${error.message || 'Unknown error'}`);
            setTransferring(false);
        }
    };

    const handleAttendedTransfer = async () => {
        if (!activeCall || !transferTarget.trim()) return;
        
        setTransferring(true);
        try {
            if (window.attendedTransferCall) {
                const transferLine = await window.attendedTransferCall(activeCall.lineNumber, transferTarget);
                console.log(`✅ Attended transfer initiated on line ${transferLine}`);
                
                setTimeout(() => {
                    setTransferring(false);
                    setTransferTarget('');
                    if (onClose) onClose();
                }, 1000);
            } else {
                throw new Error('Attended transfer function not available');
            }
        } catch (error: any) {
            console.error('❌ Attended transfer failed:', error);
            alert(`Transfer failed: ${error.message || 'Unknown error'}`);
            setTransferring(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <TbTransfer className="text-blue-500 text-xl" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Call Transfer</h3>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* My Extension Info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>My Extension:</strong> {myExtension || 'Not configured'}
                </div>
            </div>

            {/* Active Call Info */}
            {activeCall ? (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-green-800 dark:text-green-200">Active Call Found</span>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                        <div><strong>Line:</strong> {activeCall.lineNumber}</div>
                        <div><strong>Caller:</strong> {activeCall.callerName}</div>
                        <div><strong>Number:</strong> {activeCall.callerNumber}</div>
                        <div><strong>Status:</strong> {activeCall.status}</div>
                    </div>
                </div>
            ) : (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="text-center text-gray-600 dark:text-gray-400">
                        <TbPhone className="mx-auto text-2xl mb-2 opacity-50" />
                        <p className="text-sm">No active calls found</p>
                    </div>
                </div>
            )}

            {/* Transfer Mode Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Transfer Mode
                </label>
                <div className="space-y-2">
                    <label className="flex items-center">
                        <input
                            type="radio"
                            name="transferMode"
                            value="take"
                            checked={transferMode === 'take'}
                            onChange={(e) => setTransferMode(e.target.value as any)}
                            className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Take Call to Me</span>
                    </label>
                    <label className="flex items-center">
                        <input
                            type="radio"
                            name="transferMode"
                            value="blind"
                            checked={transferMode === 'blind'}
                            onChange={(e) => setTransferMode(e.target.value as any)}
                            className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Blind Transfer</span>
                    </label>
                    <label className="flex items-center">
                        <input
                            type="radio"
                            name="transferMode"
                            value="attended"
                            checked={transferMode === 'attended'}
                            onChange={(e) => setTransferMode(e.target.value as any)}
                            className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Attended Transfer</span>
                    </label>
                </div>
            </div>

            {/* Transfer Target Input (for blind/attended) */}
            {(transferMode === 'blind' || transferMode === 'attended') && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Transfer To
                    </label>
                    <input
                        type="text"
                        value={transferTarget}
                        onChange={(e) => setTransferTarget(e.target.value)}
                        placeholder="Extension or phone number"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
                {transferMode === 'take' && (
                    <button
                        onClick={handleTakeCall}
                        disabled={!activeCall || transferring}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                            !activeCall || transferring
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                        }`}
                    >
                        {transferring ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Taking Call...</span>
                            </>
                        ) : (
                            <>
                                <MdCallReceived size={18} />
                                <span>Take Call to Me</span>
                            </>
                        )}
                    </button>
                )}

                {transferMode === 'blind' && (
                    <button
                        onClick={handleBlindTransfer}
                        disabled={!activeCall || !transferTarget.trim() || transferring}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                            !activeCall || !transferTarget.trim() || transferring
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                        }`}
                    >
                        {transferring ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Transferring...</span>
                            </>
                        ) : (
                            <>
                                <TbArrowRight size={18} />
                                <span>Blind Transfer</span>
                            </>
                        )}
                    </button>
                )}

                {transferMode === 'attended' && (
                    <button
                        onClick={handleAttendedTransfer}
                        disabled={!activeCall || !transferTarget.trim() || transferring}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                            !activeCall || !transferTarget.trim() || transferring
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                        }`}
                    >
                        {transferring ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Transferring...</span>
                            </>
                        ) : (
                            <>
                                <TbPhoneCall size={18} />
                                <span>Attended Transfer</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Help Text */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    {transferMode === 'take' && 'The active call will be transferred directly to your extension.'}
                    {transferMode === 'blind' && 'The call will be transferred immediately without consultation.'}
                    {transferMode === 'attended' && 'You will call the target first, then complete the transfer.'}
                </p>
            </div>
        </div>
    );
}