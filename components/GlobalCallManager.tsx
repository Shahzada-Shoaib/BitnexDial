// components/GlobalCallManager.tsx
'use client';

import React, { useState, useEffect } from 'react';
import CallOverlay from './CallOverlay';

// Global call state interface
// Fixed GlobalCallManager.tsx - Add these interfaces at the top after the imports

// Add this interface definition at the top of GlobalCallManager.tsx
interface Contact {
    id: string;
    phone: string;
    name: string;
    type: 'personal';
    profileColor?: string;
}

// Global call state interface
interface GlobalCallState {
    isActive: boolean;
    number: string;
    name: string;
    startTime: Date | null;
    status: 'dialing' | 'ringing' | 'connected' | 'ended' | 'connecting' | 'incoming';
    direction?: 'inbound' | 'outbound';
}

// Add window type declarations - REPLACE the existing declare global block with this:
declare global {
    interface Window {
        minimizedCallData?: any;
        handleRestoreMinimizedCall?: () => void;
        handleEndMinimizedCall?: () => void;
        
        // Contact-related global variables
        contactsData?: Contact[];
        cachedContacts?: any[];
        debugContactLookup?: (testNumber?: string) => void;
        debugRecentCalls?: () => void;
        
        // Phone system properties
        Lines?: any[];
        getActiveLineNum?: () => number;
        phoneSystem?: any;
        
        [key: string]: any;
    }
}

// Global call manager to persist across all pages
export default function GlobalCallManager() {
    // Core state
    const [callState, setCallState] = useState<GlobalCallState>({
        isActive: false,
        number: '',
        name: '',
        startTime: null,
        status: 'ended'
    });
    const [callDuration, setCallDuration] = useState(0);

    // Call tracking state
    const [heldLineNumbers, setHeldLineNumbers] = useState<Set<number>>(new Set());
    const [currentActiveLineNumber, setCurrentActiveLineNumber] = useState<number | null>(null);
    const [callEndEventDispatched, setCallEndEventDispatched] = useState(false);

    // Minimized call state
    const [minimizedCall, setMinimizedCall] = useState<{
        number: string;
        name: string;
        duration: number;
        lineNumber: number;
        status: 'held';
        startTime: Date;
    } | null>(null);

    // Function to get contact name from localStorage or contacts API
        // Resume specific held call
    const resumeSpecificHeldCall = async (lineNumber: number) => {

        try {
            const arrayIndex = lineNumber - 1;
            const line = window.Lines?.[arrayIndex];

            if (line?.SipSession) {
                if (window.phoneSystem?.unholdCall) {
                    await window.phoneSystem.unholdCall(lineNumber);
                } else if (line.SipSession.unhold) {
                    await line.SipSession.unhold();
                }


                const resumedCallState = {
                    isActive: true,
                    number: line.CallerIDNumber || 'Unknown',
                    name: line.CallerIDName || line.CallerIDNumber || 'Unknown',
                    status: 'connected' as const,
                    direction: (line.direction || 'outbound') as 'inbound' | 'outbound',
                    startTime: minimizedCall?.startTime || new Date()
                };

                setCallState(resumedCallState);
                setCallDuration(minimizedCall ? Math.floor((new Date().getTime() - minimizedCall.startTime.getTime()) / 1000) : 0);
                setCurrentActiveLineNumber(lineNumber);
                setMinimizedCall(null);
                setHeldLineNumbers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(lineNumber);
                    return newSet;
                });
            }
        } catch (error) {
            console.error('❌ Failed to resume call:', error);
        }
    };
    const [contactsData, setContactsData] = useState<{ name: string; phone: string }[]>([]);
// REPLACE the contacts loading useEffect in GlobalCallManager.tsx with this:

useEffect(() => {
    const userNumber = localStorage.getItem("myPhoneNumber") || "";
    fetch(`https://bkpmanual.bitnexdial.com/api/get-contacts?owner=${userNumber.replace(/[^\d]/g, "")}`)
        .then(res => res.json())
        .then(data => {
            const processedContacts = Array.isArray(data)
                ? data.map((row) => ({
                    name: typeof row.name === 'string' && row.name.trim() !== '' ? row.name : row.contact,
                    phone: row.contact || "",
                }))
                : [];
                
            setContactsData(processedContacts);
            
            // ✅ MAKE CONTACTS GLOBALLY AVAILABLE FROM GLOBAL CALL MANAGER TOO
            if (!window.contactsData) {
                const globalContacts: Contact[] = processedContacts.map(c => ({
                    id: c.phone,
                    phone: c.phone,
                    name: c.name,
                    type: 'personal' as const, // ✅ Fix: Use 'as const' for literal type
                    profileColor: "bg-blue-500",
                }));
                window.contactsData = globalContacts;
            }
            
            if (!window.cachedContacts) {
                window.cachedContacts = data;
            }
            
            
            // Dispatch event to notify that contacts are available
            window.dispatchEvent(new CustomEvent('globalContactsLoaded', {
                detail: { contacts: processedContacts, rawContacts: data }
            }));
        })
        .catch(err => {
            console.error('❌ GlobalCallManager: Failed to load contacts:', err);
        });
}, []);
////////////contact name on popup
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


const getContactName = (number: string) => {
    // For consistency, use the same logic as inbound calls
    return getContactNameForInbound(number);
};




const getContactNameForInbound = (number: string) => {
    console.log('📞 INBOUND CALL: Looking up contact name for:', number);
    
    if (!number || !contactsData || contactsData.length === 0) {
        console.log('❌ INBOUND: No number or contacts data available');
        return formatPhoneNumber(number) || number;
    }
    
    // Clean the input number - remove all non-digits
    let cleanedInput = number.replace(/[^\d]/g, "");
    console.log('🧹 INBOUND: Cleaned input number:', cleanedInput);
    
    // For inbound calls, the number might come with +1 prefix, so handle that
    if (cleanedInput.startsWith('1') && cleanedInput.length === 11) {
        cleanedInput = cleanedInput.slice(1); // Remove the leading 1
        console.log('🧹 INBOUND: Removed leading 1, now:', cleanedInput);
    }
    
    // Create multiple possible formats to match against
    const possibleFormats = [
        cleanedInput,                                    // 1234567890
        '1' + cleanedInput,                             // 11234567890
        cleanedInput.slice(-10),                        // Last 10 digits
        cleanedInput.slice(-7),                         // Last 7 digits
    ];
    
    console.log('🔍 INBOUND: Possible formats to search:', possibleFormats);
    console.log('📞 INBOUND: Available contacts:', contactsData.map(c => ({ name: c.name, phone: c.phone })));
    
    // Search through contacts with all possible formats
    for (const format of possibleFormats) {
        const match = contactsData.find(contact => {
            const contactPhone = contact.phone.replace(/[^\d]/g, "");
            
            console.log(`🔍 INBOUND: Comparing format "${format}" with contact phone "${contactPhone}"`);
            
            // Direct match
            if (contactPhone === format) {
                console.log('✅ INBOUND: Direct match found:', contact.name, 'for format:', format);
                return true;
            }
            
            // Try matching last 10 digits (most common case)
            const contactLast10 = contactPhone.slice(-10);
            const formatLast10 = format.slice(-10);
            
            if (contactLast10 === formatLast10 && contactLast10.length === 10) {
                console.log('✅ INBOUND: Last 10 digits match found:', contact.name, 'for format:', format);
                return true;
            }
            
            // Try matching without country codes
            if (contactPhone.length === 11 && contactPhone.startsWith('1')) {
                const contactWithout1 = contactPhone.slice(1);
                if (contactWithout1 === format) {
                    console.log('✅ INBOUND: Match found without country code:', contact.name);
                    return true;
                }
            }
            
            return false;
        });
        
        if (match) {
            console.log('🎯 INBOUND: Final match found:', match.name, 'for number:', number);
            return match.name;
        }
    }
    
    console.log('❌ INBOUND: No contact match found for:', number, 'returning formatted number');
    return formatPhoneNumber(number) || number;
};


    // Call duration timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callState.isActive && callState.startTime) {
            interval = setInterval(() => {
                const now = new Date();
                const duration = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
                setCallDuration(duration);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState.isActive, callState.startTime]);

    // Listen for global call events
    useEffect(() => {
const handleCallStart = (event: CustomEvent) => {
    const { number, direction = 'outbound', name } = event.detail; // ✅ Extract name from event
    console.log('📞 Global call started:', { number, direction, name });

    setCallState({
        isActive: true,
        number,
        name: name || getContactName(number), // ✅ Use passed name or fallback to lookup
        startTime: new Date(),
        status: 'dialing',
        direction
    });
};

        const handleCallStateChange = (event: CustomEvent) => {
            const { status, number, direction } = event.detail;
            console.log('📞 Global call state changed:', { status, number, direction });

            setCallState(prev => ({
                ...prev,
                status,
                ...(number && { number, name: getContactName(number) }),
                ...(direction && { direction })
            }));
        };

        const handleCallEnd = () => {
            setCallState({
                isActive: false,
                number: '',
                name: '',
                startTime: null,
                status: 'ended'
            });
            setCallDuration(0);
        };

    const handleIncomingCall = (event: CustomEvent) => {
        const { number } = event.detail;
        console.log('📞 INCOMING CALL EVENT received for number:', number);
        
        // ✅ CRITICAL FIX: Use the enhanced inbound contact name lookup
        const resolvedName = getContactNameForInbound(number);
        console.log('📞 INCOMING CALL: Resolved name:', resolvedName);

        // ✅ DISPATCH TO GLOBAL INCOMING CALL ALERT WITH RESOLVED NAME
        if (window.showGlobalIncomingCall) {
            console.log('📞 INCOMING: Calling showGlobalIncomingCall with resolved name:', resolvedName);
            window.showGlobalIncomingCall(number, resolvedName);
        } else {
            console.warn('❌ INCOMING: showGlobalIncomingCall not available');
        }

        setCallState({
            isActive: true,
            number,
            name: resolvedName, // ✅ Use the properly resolved name
            startTime: new Date(),
            status: 'incoming',
            direction: 'inbound'
        });
        
        console.log('📞 INCOMING CALL: CallState updated with name:', resolvedName);
    };


        window.addEventListener('globalCallStart', handleCallStart as EventListener);
        window.addEventListener('globalCallStateChange', handleCallStateChange as EventListener);
        window.addEventListener('globalCallEnd', handleCallEnd);
        window.addEventListener('globalIncomingCall', handleIncomingCall as EventListener);

        return () => {
            window.removeEventListener('globalCallStart', handleCallStart as EventListener);
            window.removeEventListener('globalCallStateChange', handleCallStateChange as EventListener);
            window.removeEventListener('globalCallEnd', handleCallEnd);
            window.removeEventListener('globalIncomingCall', handleIncomingCall as EventListener);
        };
    }, []);

    // Track hold events from phone.js
    useEffect(() => {
        const handleCallHold = (lineNumber: number) => {
            setHeldLineNumbers(prev => new Set(prev).add(lineNumber));
        };

        // Listen for specific phone.js patterns in console
        const originalConsoleLog = console.log;
        console.log = function (...args) {
            const message = args.join(' ');

            // Track when calls go on hold
            if (message.includes('⏸️ Put line') && message.includes('on hold')) {
                const lineMatch = message.match(/line (\d+)/);
                if (lineMatch) {
                    const lineNumber = parseInt(lineMatch[1]);
                    handleCallHold(lineNumber);
                }
            }

            // Track when calls are held
            if (message.includes('⏸️ Call held on line')) {
                const lineMatch = message.match(/line (\d+)/);
                if (lineMatch) {
                    const lineNumber = parseInt(lineMatch[1]);
                    handleCallHold(lineNumber);
                }
            }

            // Track when new calls become active
            if (message.includes('✅ Call established on line')) {
                const lineMatch = message.match(/line (\d+)/);
                if (lineMatch) {
                    const lineNumber = parseInt(lineMatch[1]);
                    setCurrentActiveLineNumber(lineNumber);
                    originalConsoleLog(`📱 ACTIVE TRACKER: Line ${lineNumber} is now active`);
                }
            }

            // originalConsoleLog.apply(console, args);
        };

        return () => {
            console.log = originalConsoleLog;
        };
    }, []);

    // Handle call waiting acceptance
    useEffect(() => {
        const handleCallWaitingAccepted = (event: any) => {

            const waitingCallData = event.detail;
            if (!waitingCallData) return;

            // If there's an active call, minimize it
            if (callState.isActive) {
                setMinimizedCall({
                    number: callState.number,
                    name: callState.name,
                    duration: callDuration,
                    lineNumber: currentActiveLineNumber || 1,
                    status: 'held',
                    startTime: callState.startTime || new Date()
                });
            }

            // Set new call as active
            const newCallState = {
                isActive: true,
                number: waitingCallData.callerNumber,
                name: waitingCallData.callerName || waitingCallData.callerNumber,
                status: 'connected' as const,
                direction: 'inbound' as const,
                startTime: new Date()
            };

            setCallState(newCallState);
            setCallDuration(0);
            setCurrentActiveLineNumber(waitingCallData.lineNumber || 2);
        };

        window.addEventListener('callWaitingAccepted', handleCallWaitingAccepted);
        return () => {
            window.removeEventListener('callWaitingAccepted', handleCallWaitingAccepted);
        };
    }, [callState, callDuration, currentActiveLineNumber]);

    // Monitor phone.js call state
    // Enhanced call state monitoring with ICE disconnection detection
    //Old
    // useEffect(() => {
    //     const checkCallState = () => {
    //         if (window.Lines && Array.isArray(window.Lines)) {
    //             const activeLine = window.Lines.find(line =>
    //                 line && line.SipSession &&
    //                 ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress'].includes(
    //                     (line.SipSession.status || '').toLowerCase()
    //                 ) && !line.SipSession.isOnHold
    //             );

    //             // Check for ICE disconnections on active calls - THIS IS THE KEY FIX
    //             if (callState.isActive) {
    //                 let callTerminated = false;

    //                 window.Lines.forEach((line, index) => {
    //                     if (line?.SipSession?.sessionDescriptionHandler?.peerConnection) {
    //                         const pc = line.SipSession.sessionDescriptionHandler.peerConnection;
    //                         const iceState = pc.iceConnectionState;

    //                         // If ICE disconnects during an active call, terminate it
    //                         if ((iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') &&
    //                             callState.status === 'connected') {
    //                             callTerminated = true;
    //                         }
    //                     }
    //                 });

    //                 if (callTerminated) {

    //                     // CLEANUP THE ACTUAL SIP SESSION
    //                     window.Lines.forEach((line, index) => {
    //                         if (line?.SipSession) {
    //                             try {
    //                                 const session = line.SipSession;

    //                                 // Terminate the session if not already terminated
    //                                 if (session.state !== 'Terminated' && session.state !== 'Terminating') {
    //                                     if (session.terminate) {
    //                                         session.terminate().catch((e: any) => console.warn('Session terminate error:', e));
    //                                     } else if (session.bye) {
    //                                         session.bye().catch((e: any) => console.warn('Session bye error:', e));
    //                                     }
    //                                 }


    //                             } catch (error) {
    //                                 console.error(`❌ Error cleaning up line ${index + 1}:`, error);
    //                             }
    //                         }
    //                     });

    //                     // DON'T dispatch globalCallEnd here - let the session termination handle it naturally
    //                     // DON'T update callState here - let the normal flow handle it

    //                     return;
    //                 }
    //             }

    //             // Rest of your existing logic stays the same...
    //             if (activeLine && callState.isActive) {
    //                 const newStatus = activeLine.SipSession.status === 'connected' ? 'connected' :
    //                     activeLine.SipSession.status === 'ringing' ? 'ringing' : 'dialing';

    //                 if (newStatus !== callState.status) {
    //                     setCallState(prev => ({ ...prev, status: newStatus }));
    //                 }
    //             } else if (!activeLine && callState.isActive && callState.status !== 'dialing') {
    //                 const heldCalls = window.Lines.filter(line =>
    //                     line?.SipSession?.status === 'established' && line.SipSession.isOnHold
    //                 );

    //                 if (heldCalls.length > 0) {
    //                 } else {

    //                     // Dispatch global call end event
    //                     window.dispatchEvent(new CustomEvent('globalCallEnd'));

    //                     setCallState({
    //                         isActive: false,
    //                         number: '',
    //                         name: '',
    //                         startTime: null,
    //                         status: 'ended'
    //                     });
    //                     setCallDuration(0);
    //                 }
    //             }
    //         }
    //     };

    //     const interval = setInterval(checkCallState, 500);
    //     return () => clearInterval(interval);
    // }, [callState.isActive, callState.status]);

    //Merged one 
    useEffect(() => {
        const checkCallState = () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                const activeLine = window.Lines.find(line =>
                    line && line.SipSession &&
                    ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling', 'progress'].includes(
                        (line.SipSession.status || '').toLowerCase()
                    ) && !line.SipSession.isOnHold
                );

                // Check for terminated sessions that should end the call
                const hasTerminatedSessions = window.Lines.some(line =>
                    line && line.SipSession &&
                    ['Terminated', 'Terminating'].includes(line.SipSession.state)
                );

                // If we have an active call in UI but no active sessions, end the call
                if (callState.isActive && !activeLine) {
                    const anyActiveSessions = window.Lines.some(line =>
                        line && line.SipSession &&
                        !['Terminated', 'Terminating'].includes(line.SipSession.state)
                    );

                    if (!anyActiveSessions) {
                        console.log('🔍 No active sessions found, ending call in UI');
                        setCallState({
                            isActive: false,
                            number: '',
                            name: '',
                            startTime: null,
                            status: 'ended'
                        });
                        setCallDuration(0);
                        setCurrentActiveLineNumber(null);

                        // Dispatch global call end event
                        window.dispatchEvent(new Event('globalCallEnd'));
                    }
                }

                // Rest of your existing logic...
                if (activeLine && callState.isActive) {
                    const newStatus = activeLine.SipSession.status === 'connected' ? 'connected' :
                        activeLine.SipSession.status === 'ringing' ? 'ringing' : 'dialing';

                    if (newStatus !== callState.status) {
                        setCallState(prev => ({ ...prev, status: newStatus }));
                    }
                }
            }
        };

        const interval = setInterval(checkCallState, 500);
        return () => clearInterval(interval);
    }, [callState.isActive, callState.status]);

    // Call switching functions
    const handleRestoreMinimizedCall = async () => {
        if (!minimizedCall) return;


        try {
            // Put current active call on hold
            if (currentActiveLineNumber !== null && window.phoneSystem?.holdCall) {
                await window.phoneSystem.holdCall(currentActiveLineNumber);
            }

            // Store current call as minimized
            const currentCallForMinimize = {
                number: callState.number,
                name: callState.name,
                duration: callDuration,
                lineNumber: currentActiveLineNumber || 1,
                status: 'held' as const,
                startTime: callState.startTime || new Date()
            };

            // Resume the minimized call
            if (window.phoneSystem?.unholdCall) {
                await window.phoneSystem.unholdCall(minimizedCall.lineNumber);
            }

            // Update UI to show resumed call
            setCallState({
                isActive: true,
                number: minimizedCall.number,
                name: minimizedCall.name,
                status: 'connected',
                direction: 'inbound',
                startTime: minimizedCall.startTime
            });
            setCallDuration(Math.floor((new Date().getTime() - minimizedCall.startTime.getTime()) / 1000));
            setCurrentActiveLineNumber(minimizedCall.lineNumber);
            setMinimizedCall(currentCallForMinimize);

        } catch (error) {
            console.error('❌ Failed to switch calls:', error);
        }
    };

    const handleEndMinimizedCall = async () => {
        if (!minimizedCall) return;


        try {
            const arrayIndex = minimizedCall.lineNumber - 1;
            const line = window.Lines?.[arrayIndex];

            if (line?.SipSession) {
                if (line.SipSession.terminate) {
                    await line.SipSession.terminate();
                } else if (line.SipSession.bye) {
                    await line.SipSession.bye();
                }
            }

            setMinimizedCall(null);
            setHeldLineNumbers(prev => {
                const newSet = new Set(prev);
                newSet.delete(minimizedCall.lineNumber);
                return newSet;
            });

        } catch (error) {
            console.error('❌ Failed to end minimized call:', error);
        }
    };

    // Make functions available to MinimizedCall component
    useEffect(() => {
        window.handleRestoreMinimizedCall = handleRestoreMinimizedCall;
        window.handleEndMinimizedCall = handleEndMinimizedCall;
        window.minimizedCallData = minimizedCall;

        return () => {
            delete window.handleRestoreMinimizedCall;
            delete window.handleEndMinimizedCall;
            delete window.minimizedCallData;
        };
    }, [minimizedCall, callState, callDuration, currentActiveLineNumber]);

    // Smart end call logic
    // Smart end call logic with intelligent call detection
    // Smart end call logic - end active call but keep held calls on hold

    //Old Code
    // const handleEndCall = async () => {
    //     console.log('📊 Current active line:', currentActiveLineNumber);

    //     // If there's a current active call, just end that specific call
    //     if (currentActiveLineNumber !== null) {
    //         console.log(`🎯 Ending only the active call on line ${currentActiveLineNumber}`);

    //         try {
    //             // End only the active call
    //             await endCallWithProperStateHandling(currentActiveLineNumber);

    //             // Update UI to show "no active call" state
    //             setCallState({
    //                 isActive: false,
    //                 number: '',
    //                 name: '',
    //                 startTime: null,
    //                 status: 'ended'
    //             });
    //             setCallDuration(0);
    //             setCurrentActiveLineNumber(null);

    //             // Keep held calls in held state - don't resume them
    //             console.log(`✅ Active call ended. Held calls remain on hold: ${Array.from(heldLineNumbers)}`);

    //             return; // Don't end held calls

    //         } catch (error) {
    //             console.error('❌ Error ending active call:', error);
    //         }
    //     }

    //     // If no specific active call, end all calls
    //     console.log('🔍 No specific active call - ending all calls');

    //     const activeLinesWithCalls = findActiveLinesWithCalls();

    //     if (activeLinesWithCalls.length === 0) {
    //         console.log('✅ No active calls found');
    //         setCallState({
    //             isActive: false,
    //             number: '',
    //             name: '',
    //             startTime: null,
    //             status: 'ended'
    //         });
    //         setCallDuration(0);
    //         setHeldLineNumbers(new Set());
    //         setCurrentActiveLineNumber(null);
    //         setMinimizedCall(null);
    //         return;
    //     }

    //     // End all calls
    //     for (const lineNumber of activeLinesWithCalls) {
    //         await endCallWithProperStateHandling(lineNumber);
    //     }

    //     // Clear all state
    //     setCallState({
    //         isActive: false,
    //         number: '',
    //         name: '',
    //         startTime: null,
    //         status: 'ended'
    //     });
    //     setCallDuration(0);
    //     setHeldLineNumbers(new Set());
    //     setCurrentActiveLineNumber(null);
    //     setMinimizedCall(null);

    //     console.log('✅ All calls ended');
    // };

    //Merged
    const handleEndCall = async () => {
        console.log('🔴 GlobalCallManager: handleEndCall called');

        try {
            // Find and terminate all active sessions
            const activeLines = findAllActiveLines();

            if (activeLines.length === 0) {
                console.log('ℹ️ No active lines found to terminate');
                setCallState({
                    isActive: false,
                    number: '',
                    name: '',
                    startTime: null,
                    status: 'ended'
                });
                setCallDuration(0);
                return;
            }

            console.log(`🎯 Found ${activeLines.length} active lines to terminate`);

            // Terminate all active sessions
            for (const lineNumber of activeLines) {
                try {
                    await terminateLineSession(lineNumber);
                } catch (error) {
                    console.error(`❌ Failed to terminate line ${lineNumber}:`, error);
                }
            }

            // Update state
            setCallState({
                isActive: false,
                number: '',
                name: '',
                startTime: null,
                status: 'ended'
            });
            setCallDuration(0);
            setCurrentActiveLineNumber(null);
            setHeldLineNumbers(new Set());
            setMinimizedCall(null);

            console.log('✅ All calls terminated successfully');

        } catch (error) {
            console.error('❌ Error in GlobalCallManager handleEndCall:', error);

            // Force state cleanup
            setCallState({
                isActive: false,
                number: '',
                name: '',
                startTime: null,
                status: 'ended'
            });
            setCallDuration(0);
        }
    };

    const findAllActiveLines = () => {
        const activeLines: number[] = [];

        if (!window.Lines || !Array.isArray(window.Lines)) {
            return activeLines;
        }

        window.Lines.forEach((line: any, index: number) => {
            if (line && line.SipSession) {
                const state = line.SipSession.state;
                const status = line.SipSession.status;

                // Consider any non-terminated session as active
                if (state !== 'Terminated' && state !== 'Terminating') {
                    activeLines.push(index + 1); // Convert to 1-based
                }
            }
        });

        return activeLines;
    };

    const terminateLineSession = async (lineNumber: number) => {
        try {
            console.log(`🛑 Terminating session on line ${lineNumber}`);

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj || !lineObj.SipSession) {
                console.log(`ℹ️ No session to terminate on line ${lineNumber}`);
                return;
            }

            const session = lineObj.SipSession;
            const state = session.state;

            // Use phoneSystem.endCall if available (most reliable)
            if (window.phoneSystem && typeof window.phoneSystem.endCall === 'function') {
                console.log(`📞 Using phoneSystem.endCall for line ${lineNumber}`);
                await window.phoneSystem.endCall(lineNumber);
                return;
            }

            // Fallback to direct session methods
            console.log(`📞 Using direct session termination for line ${lineNumber} (state: ${state})`);

            switch (state) {
                case 'Initial':
                case 'Establishing':
                    if (typeof session.cancel === 'function') {
                        await session.cancel();
                    } else if (typeof session.terminate === 'function') {
                        await session.terminate();
                    }
                    break;

                case 'Established':
                case 'Confirmed':
                    if (typeof session.bye === 'function') {
                        await session.bye();
                    } else if (typeof session.terminate === 'function') {
                        await session.terminate();
                    }
                    break;

                default:
                    if (typeof session.terminate === 'function') {
                        await session.terminate();
                    } else if (typeof session.bye === 'function') {
                        await session.bye();
                    }
            }

            console.log(`✅ Successfully terminated line ${lineNumber}`);

        } catch (error) {
            console.error(`❌ Error terminating line ${lineNumber}:`, error);
            throw error;
        }
    };



    // ADD THIS NEW SMART DETECTION FUNCTION
    const findActiveLinesWithCalls = (): number[] => {
        const activeLinesWithCalls: number[] = [];

        if (!window.Lines || !Array.isArray(window.Lines)) {
            console.log('📝 No Lines array found');
            return activeLinesWithCalls;
        }

        console.log('🔍 Scanning lines for active calls...');

        window.Lines.forEach((line, index) => {
            const lineNumber = index + 1;

            if (line && line.SipSession) {
                const sessionState = line.SipSession.state;
                const sessionStatus = line.SipSession.status;

                console.log(`📞 Line ${lineNumber}: state=${sessionState}, status=${sessionStatus}`);

                // Check if this line has an active session that needs termination
                if (sessionState !== 'Terminated' && sessionState !== 'Terminating') {
                    console.log(`✅ Line ${lineNumber} has active call - adding to termination list`);
                    activeLinesWithCalls.push(lineNumber);
                } else {
                    console.log(`⏭️ Line ${lineNumber} already terminated - skipping`);
                }
            } else {
                console.log(`⏭️ Line ${lineNumber} has no session - skipping`);
            }
        });

        return activeLinesWithCalls;
    };

    // Keep your existing endCallWithProperStateHandling function as is
    const endCallWithProperStateHandling = async (lineNumber: number) => {
        try {
            console.log(`🔴 Attempting to end call on line ${lineNumber}`);

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj) {
                console.warn(`❌ Line ${lineNumber} does not exist`);
                return true;
            }

            if (!lineObj.SipSession) {
                console.warn(`❌ No active call on line ${lineNumber}`);
                return true;
            }

            const session = lineObj.SipSession;
            const currentState = session.state;

            console.log(`📞 Session state on line ${lineNumber}: ${currentState}`);

            // If already terminated, just clean up
            if (currentState === 'Terminated' || currentState === 'Terminating') {
                console.log(`✅ Session already terminated on line ${lineNumber}, cleaning up`);
                return true;
            }

            // Use appropriate method based on session state
            try {
                if (currentState === 'Initial' || currentState === 'Establishing') {
                    console.log(`🚫 Cancelling session in ${currentState} state on line ${lineNumber}`);
                    if (typeof session.cancel === 'function') {
                        await session.cancel();
                    } else {
                        console.warn(`⚠️ Cancel method not available, trying terminate`);
                        if (typeof session.terminate === 'function') {
                            await session.terminate();
                        }
                    }
                } else if (currentState === 'Established' || currentState === 'Confirmed') {
                    console.log(`👋 Ending established session on line ${lineNumber}`);
                    if (typeof session.bye === 'function') {
                        await session.bye();
                    } else if (typeof session.terminate === 'function') {
                        await session.terminate();
                    }
                } else {
                    console.log(`🛑 Using terminate for state ${currentState} on line ${lineNumber}`);
                    if (typeof session.terminate === 'function') {
                        await session.terminate();
                    }
                }
            } catch (sessionError) {
                console.warn(`⚠️ Session termination error on line ${lineNumber}:`, sessionError);
                // Continue with cleanup even if termination failed
            }

            console.log(`✅ Call ended successfully on line ${lineNumber}`);
            return true;

        } catch (error) {
            console.error(`❌ Error ending line ${lineNumber}:`, error);
            return false;
        }
    };

    const handleTextMessage = (phoneNumber: string) => {
        const formattedNumber = phoneNumber.replace(/[^\d]/g, '');
        const cleanNumber = formattedNumber.length === 11 && formattedNumber.startsWith('1')
            ? formattedNumber.slice(1)
            : formattedNumber;

        window.location.href = `/text?to=${encodeURIComponent(cleanNumber)}`;
    };

    // Only render if there's an active call
    if (!callState.isActive) {
        return null;
    }

    return (
        <CallOverlay
            callState={callState}
            callDuration={callDuration}
            onEndCall={handleEndCall}
            onTextMessage={handleTextMessage}
            getContactName={getContactName}
        />
    );
}