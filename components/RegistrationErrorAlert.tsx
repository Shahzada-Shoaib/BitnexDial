import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiX, FiLogOut, FiPhone, FiRefreshCw } from 'react-icons/fi';

// Type definitions
type ErrorType = 'maxContacts' | 'notRegistered' | 'connectionFailed' | 'registrationFailed';

interface ErrorState {
    show: boolean;
    type: ErrorType | null;
    message: string;
    details: string;
    blockDialer?: boolean;
    canClose?: boolean;
}

interface CustomEvent {
    detail?: {
        error?: string;
        statusCode?: number;
        reason?: string;
        action?: string;
        showImmediately?: boolean;
        blockDialer?: boolean;
    };
}

declare global {
    interface Window {
        isRegistered?: boolean;
        registrationState?: string;
        dialerBlocked?: boolean;
        stopSipConnection?: () => void;
        startSipConnection?: () => void;
        DialByLine?: (type: 'audio' | 'video', buddy: any, number: string, CallerID?: string, extraHeaders?: string[]) => void;
    }
}

// Error Alert Component for Max Contacts and Registration Issues
const RegistrationErrorAlert: React.FC = () => {
    const [errorState, setErrorState] = useState<ErrorState>({
        show: false,
        type: null,
        message: '',
        details: '',
        blockDialer: false,
        canClose: true
    });

    useEffect(() => {
        // Check registration state on component mount
        const checkInitialRegistration = () => {
            if (window.registrationState === 'Max Contacts Reached' || window.dialerBlocked) {
                console.log('🚫 Max contacts detected on mount - showing error immediately');
                setErrorState({
                    show: true,
                    type: 'maxContacts',
                    message: 'Maximum Device Limit Reached',
                    details: 'You cannot use the dialer because the maximum number of devices are already logged in. Please logout from another device or use the options below.',
                    blockDialer: true,
                    canClose: false
                });
            }
        };

        // Check immediately and after a short delay
        checkInitialRegistration();
        const initialCheckTimeout = setTimeout(checkInitialRegistration, 1000);

        // Listen for max contacts error
        const handleMaxContacts = (event: Event) => {
            const customEvent = event as unknown as CustomEvent;
            console.log('🚫 Max contacts event received:', customEvent.detail);
            
            const blockDialer = customEvent.detail?.blockDialer || false;
            const showImmediately = customEvent.detail?.showImmediately || false;
            
            setErrorState({
                show: true,
                type: 'maxContacts',
                message: 'Maximum Device Limit Reached',
                details: customEvent.detail?.error || 'You cannot use the dialer because the maximum number of devices are already logged in. Please logout from another device.',
                blockDialer: blockDialer,
                canClose: !blockDialer // Can't close if dialer is blocked
            });

            // If we should block the dialer, set the global flag
            if (blockDialer) {
                window.dialerBlocked = true;
            }
        };

        // Listen for registration failures
        const handleRegistrationFailed = (event: Event) => {
            const customEvent = event as unknown as CustomEvent;
            console.log('❌ Registration failed event:', customEvent.detail);
            
            // Check if it's a 403 error (max contacts)
            if (customEvent.detail?.statusCode === 403 || customEvent.detail?.reason?.includes('403')) {
                setErrorState({
                    show: true,
                    type: 'maxContacts',
                    message: 'Maximum Device Limit Reached',
                    details: 'You cannot use the dialer. The maximum number of devices are already logged in with this extension.',
                    blockDialer: true,
                    canClose: false
                });
                window.dialerBlocked = true;
            } else {
            //     setTimeout(() => {
            //     setErrorState({
            //         show: true,
            //         type: 'registrationFailed',
            //         message: 'Check your internet connection and try again.',
            //         details: customEvent.detail?.reason || 'Unable to register with the phone system. Please check your credentials.',
            //         blockDialer: false,
            //         canClose: true
            //     });
            // }, 3000); // 2 sec delay
            null;
            }
        };

        // Listen for not registered errors when making calls
        const handleCallError = (event: ErrorEvent) => {
            console.error('📞 Call error:', event);
            
            // Check if error is due to not being registered
            if (event.message?.includes('Not registered')) {
                if (!window.isRegistered) {
                    // Check if it's due to max contacts
                    if (window.registrationState === 'Max Contacts Reached' || window.dialerBlocked) {
                        setErrorState({
                            show: true,
                            type: 'maxContacts',
                            message: 'Dialer Blocked',
                            details: 'You cannot make calls because the maximum device limit has been reached.',
                            blockDialer: true,
                            canClose: false
                        });
                    } else {
                        setErrorState({
                            show: true,
                            type: 'notRegistered',
                            message: 'Phone System Not Ready',
                            details: 'Unable to make calls. The phone system is not registered.',
                            blockDialer: false,
                            canClose: true
                        });
                    }
                }
            }
        };

        // Add event listeners
        window.addEventListener('sipMaxContactsReached', handleMaxContacts);
        window.addEventListener('sipAuthenticationFailed', handleRegistrationFailed);
        window.addEventListener('sipConnectionFailed', handleRegistrationFailed);
        window.addEventListener('error', handleCallError);

        // Store original DialByLine function
        const originalDialByLine = window.DialByLine;
        
        // Override DialByLine to intercept errors
        if (originalDialByLine) {
            window.DialByLine = async function(...args: Parameters<typeof originalDialByLine>) {
                // Check if dialer is blocked
                if (window.dialerBlocked) {
                    setErrorState({
                        show: true,
                        type: 'maxContacts',
                        message: 'Dialer Blocked',
                        details: 'You cannot make calls because the maximum device limit has been reached. Please logout from another device.',
                        blockDialer: true,
                        canClose: false
                    });
                    throw new Error('Dialer blocked - max contacts reached');
                }
                
                try {
                    if (!window.isRegistered) {
                        // Check the reason for not being registered
                        if (window.registrationState === 'Max Contacts Reached') {
                            setErrorState({
                                show: true,
                                type: 'maxContacts',
                                message: 'Cannot Make Call',
                                details: 'Maximum device limit reached. Please logout from another device.',
                                blockDialer: true,
                                canClose: false
                            });
                            throw new Error('Max contacts reached');
                        } else {
                            setErrorState({
                                show: true,
                                type: 'notRegistered',
                                message: 'Cannot Make Call',
                                details: 'Connect failed. Please Check your internet',
                                blockDialer: false,
                                canClose: true
                            });
                            throw new Error('Not registered');
                        }
                    }
                    return originalDialByLine.apply(window, args);
                } catch (error: unknown) {
                    console.error('DialByLine error:', error);
                    throw error;
                }
            };
        }

        // Cleanup
        return () => {
            clearTimeout(initialCheckTimeout);
            window.removeEventListener('sipMaxContactsReached', handleMaxContacts);
            window.removeEventListener('sipAuthenticationFailed', handleRegistrationFailed);
            window.removeEventListener('sipConnectionFailed', handleRegistrationFailed);
            window.removeEventListener('error', handleCallError);
            
            // Restore original DialByLine
            if (originalDialByLine) {
                window.DialByLine = originalDialByLine;
            }
        };
    }, []);

    const handleClose = () => {
        // Only allow closing if the dialer isn't blocked
        if (errorState.canClose) {
            setErrorState(prev => ({ ...prev, show: false }));
        }
    };

    const handleLogout = () => {
        // Clear the blocked state
        window.dialerBlocked = false;
        
        // Logout from this device
        if (window.stopSipConnection) {
            window.stopSipConnection();
        }
        // Clear stored credentials
        localStorage.removeItem('SipUsername');
        localStorage.removeItem('SipPassword');
        localStorage.removeItem('sipUsername');
        localStorage.removeItem('sipPassword');
        
        // Redirect to login.html
        window.location.href = '/login.html';
    };

    const handleRefresh = () => {
        // Clear the blocked state and refresh
        window.dialerBlocked = false;
        window.location.reload();
    };

    const handleRetry = () => {
        setErrorState(prev => ({ ...prev, show: false }));
        // Try to reconnect
        if (window.startSipConnection) {
            window.startSipConnection();
        }
    };

    if (!errorState.show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all animate-slideUp">
                {/* Header */}
                <div className={`p-6 rounded-t-2xl ${
                    errorState.blockDialer 
                        ? 'bg-gradient-to-r from-red-600 to-red-700' 
                        : errorState.type === 'maxContacts'
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        // : 'bg-gradient-to-r from-orange-500 to-orange-600'
                        : 'bg-gradient-to-b from-[#3778D6] to-[#2E5FBD]'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <FiAlertCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">
                                    {errorState.message}
                                </h3>
                                <p className="text-white/80 text-sm mt-1">
                                    {errorState.blockDialer ? 'Dialer Access Blocked' : 'Registration Error'}
                                </p>
                            </div>
                        </div>
                        {errorState.canClose && (
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <FiX className="w-5 h-5 text-white" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {errorState.blockDialer && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                            <p className="text-red-800 dark:text-red-300 font-semibold text-center">
                                ⚠️ Dialer functionality is disabled
                            </p>
                        </div>
                    )}

                    <div className="mb-6">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                            {errorState.details}
                        </p>
                    </div>

                    {errorState.type === 'maxContacts' && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                Your options:
                            </h4>
                            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
                                <li className="flex items-start">
                                    <span className="mr-2">1.</span>
                                    <span>Logout from this device and login on a different device</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2">2.</span>
                                    <span>Logout from another device where you're currently logged in</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2">3.</span>
                                    <span>Contact your administrator to increase the device limit</span>
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* Registration Status */}
                    <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Registration Status:
                        </span>
                        <span className={`text-sm font-bold ${
                            window.isRegistered 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                        }`}>
                            {window.registrationState === 'Max Contacts Reached' 
                                ? 'Max Devices Reached' 
                                : window.isRegistered 
                                ? 'Registered' 
                                : 'Not Registered'}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        {errorState.blockDialer ? (
                            <>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <FiLogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
                                
                                <button
                                    onClick={handleRefresh}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <FiRefreshCw className="w-4 h-4" />
                                    <span>Refresh</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {errorState.type === 'maxContacts' && (
                                    <button
                                        onClick={handleLogout}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                    >
                                        <FiLogOut className="w-4 h-4" />
                                        <span>Logout This Device</span>
                                    </button>
                                )}
                                
                                <button
                                    onClick={handleRetry}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <FiPhone className="w-4 h-4" />
                                    <span>Retry Connection</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationErrorAlert;