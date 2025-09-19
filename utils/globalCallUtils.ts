// utils/globalCallUtils.ts
'use client';

// Global call event utilities
export const GlobalCallEvents = {
    // Start a new call
    startCall: (number: string, direction: 'inbound' | 'outbound' = 'outbound') => {
        window.dispatchEvent(new CustomEvent('globalCallStart', {
            detail: { number, direction }
        }));
    },

    // Update call state
    updateCallState: (status: string, number?: string, direction?: 'inbound' | 'outbound') => {
        window.dispatchEvent(new CustomEvent('globalCallStateChange', {
            detail: { status, number, direction }
        }));
    },

    // End the current call
    endCall: () => {
        window.dispatchEvent(new CustomEvent('globalCallEnd'));
    },

    // Incoming call
    incomingCall: (number: string) => {
        window.dispatchEvent(new CustomEvent('globalIncomingCall', {
            detail: { number, direction: 'inbound' }
        }));
    }
};

// Hook to use global call events
export const useGlobalCallEvents = () => {
    return GlobalCallEvents;
};

// Enhanced DialByLine wrapper that automatically triggers global events
export const makeGlobalCall = (number: string) => {
    // Clean the phone number
    const cleanedNumber = number.replace(/\D/g, '');
    const formattedNumber = cleanedNumber.length === 10 ? `+1${cleanedNumber}` :
        cleanedNumber.length === 11 && cleanedNumber.startsWith('1') ? `+${cleanedNumber}` :
            cleanedNumber;

    console.log('📞 Making global call to:', formattedNumber);

    // Trigger global call start event
    GlobalCallEvents.startCall(number, 'outbound');

    // Make the actual call
    if (window.DialByLine && typeof window.DialByLine === 'function') {
        window.DialByLine('audio', null, formattedNumber);
        return true;
    } else {
        console.warn('⚠️ Dialer not ready - window.DialByLine not available');
        // End the global call since dialer failed
        GlobalCallEvents.endCall();
        return false;
    }
};

// Enhanced end call function
export const endGlobalCall = async () => {
    console.log('🔴 Ending global call...');

    let callEnded = false;

    try {
        // Method 1: Try window.EndCall
        if (window.EndCall && typeof window.EndCall === 'function') {
            await window.EndCall();
            callEnded = true;
        }

        // Method 2: Try HangupAll
        if (!callEnded && window.HangupAll && typeof window.HangupAll === 'function') {
            await window.HangupAll();
            callEnded = true;
        }

        // Method 3: Manual line termination
        if (!callEnded && window.Lines && Array.isArray(window.Lines)) {
            window.Lines.forEach((line: any, idx: number) => {
                if (line && line.SipSession) {
                    const status = (line.SipSession.status || '').toLowerCase();
                    if (['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress'].includes(status)) {
                        try {
                            if (line.SipSession.terminate) {
                                line.SipSession.terminate();
                                callEnded = true;
                            }
                            if (line.SipSession.bye) {
                                line.SipSession.bye();
                                callEnded = true;
                            }
                        } catch (error) {
                            console.error(`Error ending session on line ${idx}:`, error);
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Error ending global call:', error);
    }

    // Always trigger global call end event
    GlobalCallEvents.endCall();

    return callEnded;
};