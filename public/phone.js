/**
 * Simplified Phone.js - Complete Clean SIP Phone System
 * Version: 4.1 - Stable, error-free version (Fixed preWarmMediaStream issue)
 */
///////////////////////conference
// Fix for missing RefreshLineActivity function

function RefreshLineActivity(lineNum) {
    try {

        // Update line display if element exists
        const lineElement = document.querySelector(`[data-line="${lineNum}"]`);
        if (lineElement) {
            // Add any line-specific UI updates here
            lineElement.classList.add('line-active');
        }

        // Dispatch event for React components to pick up
        window.dispatchEvent(new CustomEvent('lineActivityRefresh', {
            detail: { lineNumber: lineNum }
        }));

    } catch (error) {
        // Silent fail - this is just a UI enhancement
        console.log(`Note: RefreshLineActivity for line ${lineNum} - ${error.message}`);
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.RefreshLineActivity = RefreshLineActivity;
}

// Also fix the updateLineScroll function to be more robust
function updateLineScroll(lineNum) {
    try {
        // Try to call RefreshLineActivity if it exists
        if (typeof RefreshLineActivity === 'function') {
            RefreshLineActivity(lineNum);
        } else if (typeof window.RefreshLineActivity === 'function') {
            window.RefreshLineActivity(lineNum);
        }

        // Scroll to bottom of call details if element exists
        const element = document.getElementById(`line-${lineNum}-CallDetails`);
        if (element) {
            element.scrollTop = element.scrollHeight;
        }

    } catch (error) {
        // Silent fail - this is just a UI enhancement
        console.log(`Note: updateLineScroll for line ${lineNum} completed with minor issue`);
    }
}

// Update the global function
if (typeof window !== 'undefined') {
    window.updateLineScroll = updateLineScroll;
}

//////////////no extractor
// ===== ENHANCED CALLER NUMBER EXTRACTION =====
function extractCallerNumber(sipSession, direction = 'inbound') {
    let callerNumber = 'Unknown';
    
    try {        
        // Method 1: Check line object data first (most reliable)
        if (sipSession.data && sipSession.data.callerNumber) {
            callerNumber = sipSession.data.callerNumber;
            return callerNumber;
        }
        
        // Method 2: Extract from SIP headers
        if (sipSession.request) {
            // For incoming calls, get from 'From' header
            if (direction === 'inbound' && sipSession.request.from) {
                const fromHeader = sipSession.request.from.toString();
                
                // Try to extract number from SIP URI
                const numberMatch = fromHeader.match(/sip:([^@;]+)@/);
                if (numberMatch && numberMatch[1]) {
                    callerNumber = numberMatch[1];
                }
            }
            
            // For outgoing calls, get from 'To' header
            if (direction === 'outbound' && sipSession.request.to) {
                const toHeader = sipSession.request.to.toString();
                
                const numberMatch = toHeader.match(/sip:([^@;]+)@/);
                if (numberMatch && numberMatch[1]) {
                    callerNumber = numberMatch[1];
                }
            }
        }
        
        // Method 3: Try remoteIdentity (SIP.js specific)
        if (callerNumber === 'Unknown' && sipSession.remoteIdentity) {
            if (sipSession.remoteIdentity.uri && sipSession.remoteIdentity.uri.user) {
                callerNumber = sipSession.remoteIdentity.uri.user;
            }
        }
        
        // Method 4: Try alternative headers
        if (callerNumber === 'Unknown' && sipSession.request) {
            // Check P-Asserted-Identity header
            const assertedId = sipSession.request.getHeader('P-Asserted-Identity');
            if (assertedId) {
                const numberMatch = assertedId.match(/sip:([^@;]+)@/);
                if (numberMatch && numberMatch[1]) {
                    callerNumber = numberMatch[1];
                }
            }
            
            // Check Remote-Party-ID header
            if (callerNumber === 'Unknown') {
                const remotePartyId = sipSession.request.getHeader('Remote-Party-ID');
                if (remotePartyId) {
                    const numberMatch = remotePartyId.match(/sip:([^@;]+)@/);
                    if (numberMatch && numberMatch[1]) {
                        callerNumber = numberMatch[1];
                    }
                }
            }
        }
        
        // Clean and format the number
        if (callerNumber !== 'Unknown') {
            // Remove any non-digit characters except +
            callerNumber = callerNumber.replace(/[^\d+]/g, '');
            
            // Format as needed
            if (callerNumber.length === 10) {
                callerNumber = '+1' + callerNumber;
            } else if (callerNumber.length === 11 && callerNumber.startsWith('1')) {
                callerNumber = '+' + callerNumber;
            }            
        }
        
    } catch (error) {
        console.error('❌ Error extracting caller number:', error);
    }
    
    return callerNumber;
}

/////////////////////
// ===== PERMANENT AUDIO MIXING FIX =====
// Add this to your phone.js file for automatic audio mixing in all conferences

// Audio mixing function (same as the working console version)
function setupConferenceAudioMixing(hostLineNumber, participantLineNumber) {
    try {
        // Get the peer connections
        const hostLine = window.Lines[hostLineNumber - 1];
        const participantLine = window.Lines[participantLineNumber - 1];

        const hostPC = hostLine?.SipSession?.sessionDescriptionHandler?.peerConnection;
        const participantPC = participantLine?.SipSession?.sessionDescriptionHandler?.peerConnection;

        if (!hostPC || !participantPC) {
            console.warn('⚠️ Missing peer connections for audio mixing');
            return false;
        }


        // Configure audio elements
        const hostAudio = document.getElementById(`line-${hostLineNumber}-remoteAudio`);
        const participantAudio = document.getElementById(`line-${participantLineNumber}-remoteAudio`);

        if (hostAudio && participantAudio) {
            hostAudio.volume = 1.0;
            participantAudio.volume = 1.0;
            hostAudio.muted = false;
            participantAudio.muted = false;
        }

        // Set up Web Audio API mixing
        if (window.AudioContext || window.webkitAudioContext) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Resume context if suspended
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('🎵 Audio context resumed');
                });
            }

            // Create mixer nodes
            const destination = audioContext.createMediaStreamDestination();
            const hostGain = audioContext.createGain();
            const participantGain = audioContext.createGain();

            // Set appropriate gain levels
            hostGain.gain.value = 0.8;
            participantGain.gain.value = 0.8;

            // Get audio receivers
            const hostReceivers = hostPC.getReceivers();
            const participantReceivers = participantPC.getReceivers();


            // Connect host audio
            hostReceivers.forEach(receiver => {
                if (receiver.track && receiver.track.kind === 'audio') {
                    try {
                        const hostSource = audioContext.createMediaStreamSource(new MediaStream([receiver.track]));
                        hostSource.connect(hostGain);
                        hostGain.connect(destination);
                    } catch (e) {
                        console.warn('⚠️ Could not connect host audio:', e);
                    }
                }
            });

            // Connect participant audio
            participantReceivers.forEach(receiver => {
                if (receiver.track && receiver.track.kind === 'audio') {
                    try {
                        const participantSource = audioContext.createMediaStreamSource(new MediaStream([receiver.track]));
                        participantSource.connect(participantGain);
                        participantGain.connect(destination);
                    } catch (e) {
                        console.warn('⚠️ Could not connect participant audio:', e);
                    }
                }
            });

            // Create and apply mixed stream
            const mixedStream = destination.stream;

            // Clean up any existing conference audio
            document.querySelectorAll('[id^="conference-mixed-audio"]').forEach(el => el.remove());

            // Create new mixed audio element
            const mixedAudio = document.createElement('audio');
            mixedAudio.srcObject = mixedStream;
            mixedAudio.autoplay = true;
            mixedAudio.volume = 0.9;
            mixedAudio.style.display = 'none';
            mixedAudio.id = `conference-mixed-audio-${Date.now()}`;
            document.body.appendChild(mixedAudio);


            // Store references for cleanup
            if (!window.conferenceAudioRefs) {
                window.conferenceAudioRefs = [];
            }
            window.conferenceAudioRefs.push({
                audioContext: audioContext,
                mixedAudio: mixedAudio,
                hostLine: hostLineNumber,
                participantLine: participantLineNumber
            });

            return true;

        } else {
            console.warn('⚠️ Web Audio API not available');
            return false;
        }

    } catch (error) {
        console.error('❌ Conference audio mixing failed:', error);
        return false;
    }
}

// Enhanced conference function with automatic audio mixing
if (typeof window !== 'undefined') {
    // Store the original function
    const originalStartSimpleConference = window.startSimpleConference;

    if (originalStartSimpleConference) {
        window.startSimpleConference = async function (participantNumber) {
            try {

                // Call the original conference function
                const result = await originalStartSimpleConference(participantNumber);

                // Wait a moment for the conference to stabilize
                setTimeout(() => {
                    // Find the conference lines
                    let hostLine = null, participantLine = null;

                    window.Lines.forEach((line, i) => {
                        if (line?.isInConference) {
                            if (line.conferenceParticipants?.length > 0) {
                                hostLine = i + 1;
                            } else {
                                participantLine = i + 1;
                            }
                        }
                    });

                    if (hostLine && participantLine) {
                        setupConferenceAudioMixing(hostLine, participantLine);
                    } else {
                        console.warn('⚠️ Could not find conference lines for automatic audio mixing');
                    }

                }, 2500); // Wait 2.5 seconds for audio to stabilize

                return result;

            } catch (error) {
                console.error('❌ Enhanced conference with audio mixing failed:', error);
                throw error;
            }
        };

    }

    // Enhanced conference end function with proper cleanup
    const originalEndSimpleConference = window.endSimpleConference;

    if (originalEndSimpleConference) {
        window.endSimpleConference = async function (conferenceId) {
            try {
                // Clean up audio mixing first
                if (window.conferenceAudioRefs && window.conferenceAudioRefs.length > 0) {
                    window.conferenceAudioRefs.forEach(ref => {
                        try {
                            // Remove mixed audio element
                            if (ref.mixedAudio) {
                                ref.mixedAudio.pause();
                                ref.mixedAudio.srcObject = null;
                                ref.mixedAudio.remove();
                            }

                            // Note: Don't close audioContext as it might be used elsewhere

                        } catch (e) {
                            console.warn('⚠️ Audio cleanup warning:', e);
                        }
                    });

                    window.conferenceAudioRefs = [];
                }

                // Call original end function
                const result = await originalEndSimpleConference(conferenceId);

                return result;

            } catch (error) {
                console.error('❌ Enhanced conference end failed:', error);
                throw error;
            }
        };

    }
}

// Manual audio mixing function for testing
window.setupManualConferenceAudio = function () {
    let hostLine = null, participantLine = null;

    window.Lines.forEach((line, i) => {
        if (line?.isInConference) {
            if (line.conferenceParticipants?.length > 0) {
                hostLine = i + 1;
            } else {
                participantLine = i + 1;
            }
        }
    });

    if (hostLine && participantLine) {
        return setupConferenceAudioMixing(hostLine, participantLine);
    } else {
        console.error('❌ No conference found for manual audio setup');
        return false;
    }
};

////////////////////////////////////////////////////////////////////////
// This ensures the phone system is ALWAYS ready before any calls are made
function initializePhoneSystemMultipleTriggers() {
    // Trigger 1: Immediate
    if (document.readyState === 'complete') {
        setTimeout(() => {
            if (window.modernPhoneSystem && !window.modernPhoneSystem.initialized) {
                window.modernPhoneSystem.initialize().catch(console.error);
            }
        }, 100);
    }

    // Trigger 2: DOM Content Loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.modernPhoneSystem && !window.modernPhoneSystem.initialized) {
                    window.modernPhoneSystem.initialize().catch(console.error);
                }
            }, 100);
        });
    }

    // Trigger 3: Window Load
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.modernPhoneSystem && !window.modernPhoneSystem.initialized) {
                window.modernPhoneSystem.initialize().catch(console.error);
            }
        }, 200);
    });

    // Trigger 4: Delayed fallback
    setTimeout(() => {
        if (window.modernPhoneSystem && !window.modernPhoneSystem.initialized) {
            window.modernPhoneSystem.initialize().catch(console.error);
        }
    }, 2000);
}

// Start multiple initialization triggers
initializePhoneSystemMultipleTriggers();
class PhoneSystemManager {
    constructor() {
        this.isInitialized = false;
        this.isInitializing = false;
        this.initPromise = null;
        this.callQueue = [];
        this.maxRetries = 10;
        this.retryDelay = 500;

        // Start initialization immediately
        this.ensureInitialized();

        // Set up periodic health checks
        this.startHealthCheck();
    }

    async ensureInitialized() {
        if (this.isInitialized) {
            return true;
        }

        if (this.isInitializing) {
            return this.initPromise;
        }

        this.isInitializing = true;

        this.initPromise = this.performInitialization();

        try {
            await this.initPromise;
            this.isInitialized = true;
            this.isInitializing = false;

            // Process any queued calls
            this.processCallQueue();

            return true;
        } catch (error) {
            console.error('❌ Phone system initialization failed:', error);
            this.isInitializing = false;
            throw error;
        }
    }

    async performInitialization() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Wait for phone system to exist
        await this.waitForPhoneSystem();

        // Wait for phone system to be initialized
        await this.waitForPhoneSystemInitialization();

        // Verify call manager is ready
        await this.waitForCallManager();

        // Final verification
        await this.verifySystemReady();
    }

    async waitForPhoneSystem() {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            if (window.modernPhoneSystem) {
                return;
            }

            await this.delay(this.retryDelay);
            attempts++;
        }
        throw new Error('Phone system object not found after maximum retries');
    }

    async waitForPhoneSystemInitialization() {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            if (window.modernPhoneSystem?.initialized) {

                // Also ensure window.phoneSystem is set
                if (!window.phoneSystem) {
                    window.phoneSystem = window.modernPhoneSystem;
                }
                return;
            }

            // Try to initialize if not already done
            if (window.modernPhoneSystem && !window.modernPhoneSystem.initialized) {
                try {
                    console.log('🔄 Attempting to initialize phone system...');
                    await window.modernPhoneSystem.initialize();
                } catch (error) {
                    console.warn('⚠️ Initialization attempt failed:', error);
                }
            }

            await this.delay(this.retryDelay);
            attempts++;
        }
        throw new Error('Phone system not initialized after maximum retries');
    }

    async waitForCallManager() {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            const phoneSystem = window.phoneSystem || window.modernPhoneSystem;

            if (phoneSystem?.callManager) {
                return;
            }

            await this.delay(this.retryDelay);
            attempts++;
        }
        throw new Error('Call manager not ready after maximum retries');
    }

    async verifySystemReady() {
        const phoneSystem = window.phoneSystem || window.modernPhoneSystem;

        if (!phoneSystem) {
            throw new Error('Phone system not available');
        }

        if (!phoneSystem.callManager) {
            throw new Error('Call manager not available');
        }

        if (typeof phoneSystem.callManager.makeSimpleCall !== 'function') {
            throw new Error('makeSimpleCall function not available');
        }

    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Queue calls if system isn't ready yet
    queueCall(number, options = {}) {
        return new Promise((resolve, reject) => {
            this.callQueue.push({
                number,
                options,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // Try to process queue (in case system becomes ready)
            this.processCallQueue();
        });
    }

    async processCallQueue() {
        if (!this.isInitialized || this.callQueue.length === 0) {
            return;
        }


        const queue = [...this.callQueue];
        this.callQueue = [];

        for (const call of queue) {
            try {
                // Check if call is too old (older than 30 seconds)
                if (Date.now() - call.timestamp > 30000) {
                    call.reject(new Error('Call timeout - took too long to initialize'));
                    continue;
                }

                const result = await this.makeCall(call.number, call.options);
                call.resolve(result);
            } catch (error) {
                call.reject(error);
            }
        }
    }

    async makeCall(number, options = {}) {
        // Ensure system is ready
        await this.ensureInitialized();

        const phoneSystem = window.phoneSystem || window.modernPhoneSystem;

        if (!phoneSystem?.callManager?.makeSimpleCall) {
            throw new Error('Phone system or call manager not ready');
        }

        return await phoneSystem.callManager.makeSimpleCall(number, options);
    }

    // Health check to ensure system stays ready
    startHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 10000); // Check every 10 seconds
    }

    performHealthCheck() {
        const phoneSystem = window.phoneSystem || window.modernPhoneSystem;

        if (!phoneSystem || !phoneSystem.callManager) {
            console.warn('⚠️ Phone system health check failed - reinitializing...');
            this.isInitialized = false;
            this.ensureInitialized().catch(console.error);
        }
    }

    // Get system status
    getStatus() {
        const phoneSystem = window.phoneSystem || window.modernPhoneSystem;

        return {
            isInitialized: this.isInitialized,
            isInitializing: this.isInitializing,
            hasPhoneSystem: !!phoneSystem,
            hasCallManager: !!phoneSystem?.callManager,
            queuedCalls: this.callQueue.length,
            systemInitialized: phoneSystem?.initialized || false
        };
    }
}

// 🛡️ CREATE GLOBAL BULLETPROOF PHONE MANAGER
window.phoneManager = new PhoneSystemManager();
// ===== CALL WAITING MANAGER - ADD THIS BEFORE FixedConferenceManager =====
class CallWaitingManager {
    constructor() {
        this.waitingCalls = [];
        this.activeCallTracker = new Map();
    }

    hasActiveCalls() {
        if (!window.Lines || !Array.isArray(window.Lines)) return false;
        return window.Lines.some(line => {
            if (!line || !line.SipSession) return false;
            const state = line.SipSession.state;
            const status = (line.SipSession.status || '').toLowerCase();
            return state === 'Established' || status === 'connected';
        });
    }

    handleIncomingCallDuringActive(callerNumber, callerName, lineNumber) {

        const waitingCall = {
            id: `waiting_${Date.now()}_${lineNumber}`,
            callerNumber,
            callerName,
            lineNumber,
            timestamp: Date.now()
        };

        this.waitingCalls.push(waitingCall);

        // Just dispatch event to React - no popup creation here
        window.dispatchEvent(new CustomEvent('incomingCallWaiting', {
            detail: waitingCall
        }));

    }

    acceptWaitingCall(waitingCallId) {
        const waitingCall = this.waitingCalls.find(call => call.id === waitingCallId);
        if (!waitingCall) return false;


        // Hold current call
        this.holdCurrentCall();

        // Answer the waiting call
        if (window.answerCall) {
            window.answerCall(waitingCall.lineNumber);
        }

        this.removeWaitingCall(waitingCallId);
        return true;
    }

    rejectWaitingCall(waitingCallId) {
        const waitingCall = this.waitingCalls.find(call => call.id === waitingCallId);
        if (!waitingCall) return false;


        if (window.rejectCall) {
            window.rejectCall(waitingCall.lineNumber);
        }

        this.removeWaitingCall(waitingCallId);
        return true;
    }

    switchCalls(waitingCallId) {
        const waitingCall = this.waitingCalls.find(call => call.id === waitingCallId);
        if (!waitingCall) return false;


        // Hold current call
        this.holdCurrentCall();

        // Answer waiting call
        if (window.answerCall) {
            window.answerCall(waitingCall.lineNumber);
        }

        this.removeWaitingCall(waitingCallId);
        return true;
    }

    holdCurrentCall() {
        const activeLineNumber = this.findActiveLineNumber();
        if (activeLineNumber && window.holdCall) {
            window.holdCall(activeLineNumber);
        }
    }

    findActiveLineNumber() {
        if (!window.Lines || !Array.isArray(window.Lines)) return null;
        for (let i = 0; i < window.Lines.length; i++) {
            const line = window.Lines[i];
            if (line?.SipSession?.state === 'Established') {
                return i + 1;
            }
        }
        return null;
    }

    removeWaitingCall(waitingCallId) {
        this.waitingCalls = this.waitingCalls.filter(call => call.id !== waitingCallId);
    }

    getCurrentWaitingCall() {
        return this.waitingCalls.length > 0 ? this.waitingCalls[0] : null;
    }
}

// Initialize the call waiting manager
window.callWaitingManager = new CallWaitingManager();
// ===== END REPLACEMENT =====

// Initialize the call waiting manager
window.callWaitingManager = new CallWaitingManager();
////////////////////////////////////////////////////////////
class FixedConferenceManager {
    constructor() {
        this.conferences = new Map();
        this.conferenceRooms = [
            { extension: '6001', name: 'Conference Room 1', maxParticipants: 10, inUse: false },
            { extension: '6002', name: 'Conference Room 2', maxParticipants: 10, inUse: false },
            { extension: '6003', name: 'Conference Room 3', maxParticipants: 10, inUse: false },
            { extension: '6004', name: 'Conference Room 4', maxParticipants: 10, inUse: false },
            { extension: '6005', name: 'Conference Room 5', maxParticipants: 10, inUse: false }
        ];
        this.activeConferences = new Map();
        this.simpleConferenceCounter = 0;

    }

    // ===== SIMPLIFIED 3-WAY CONFERENCE =====
    // This is the main method for starting a 3-way conference
    async startSimple3WayConference(participantNumber) {
        try {
            // Find the active call line
            const activeLineNumber = this.findActiveLine();
            if (!activeLineNumber) {
                throw new Error('No active call found to add to conference');
            }

            console.log(`📞 Found active call on line ${activeLineNumber}`);
            const activeLineObj = window.Lines[activeLineNumber - 1];

            if (!activeLineObj?.SipSession || activeLineObj.SipSession.state !== 'Established') {
                throw new Error('Active call is not in established state');
            }

            // Step 1: Put the current call on hold
            console.log('⏸️ Putting current call on hold...');
            if (window.phoneSystem?.holdCall) {
                await window.phoneSystem.holdCall(activeLineNumber);
                console.log('✅ Current call placed on hold');
            }

            // Step 2: Make a new call to the participant
            const participantLineNumber = await this.makeCallToParticipant(participantNumber);

            if (!participantLineNumber) {
                // If participant call failed, resume the original call
                if (window.phoneSystem?.unholdCall) {
                    await window.phoneSystem.unholdCall(activeLineNumber);
                }
                throw new Error('Failed to call participant');
            }

            console.log(`✅ Participant call established on line ${participantLineNumber}`);

            // Step 3: Wait for participant to answer, then merge
            await this.waitForParticipantAndMerge(activeLineNumber, participantLineNumber, participantNumber);

            return {
                conferenceId: `simple_conf_${Date.now()}`,
                hostLine: activeLineNumber,
                participantLine: participantLineNumber,
                participantNumber: participantNumber
            };

        } catch (error) {
            console.error('❌ Failed to start 3-way conference:', error);
            throw error;
        }
    }

    // Find active line more reliably
    findActiveLine() {
        if (!window.Lines || !Array.isArray(window.Lines)) {
            console.warn('❌ No Lines array found');
            return null;
        }

        for (let i = 0; i < window.Lines.length; i++) {
            const line = window.Lines[i];
            if (line?.SipSession) {
                const state = line.SipSession.state;
                const status = line.SipSession.status;

                console.log(`🔍 Line ${i + 1} - State: ${state}, Status: ${status}`);

                // Check for established connections
                if (state === 'Established' ||
                    (status && ['connected', 'established', 'confirmed'].includes(status.toLowerCase()))) {
                    console.log(`✅ Found active line: ${i + 1}`);
                    return i + 1; // Return 1-based line number
                }
            }
        }

        console.warn('❌ No active line found');
        return null;
    }

    // Make call to participant
    async makeCallToParticipant(participantNumber) {
        return new Promise((resolve, reject) => {
            try {
                // Clean the number
                const cleanNumber = participantNumber.replace(/[^\d]/g, '');
                const formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`;


                // Use the existing makeCall function
                if (window.phoneSystem?.makeCall) {
                    window.phoneSystem.makeCall(formattedNumber, {
                        conferenceParticipant: true
                    }).then((lineNumber) => {
                        if (lineNumber) {
                            resolve(lineNumber);
                        } else {
                            reject(new Error('Failed to get line number for participant call'));
                        }
                    }).catch((error) => {
                        console.error('❌ makeCall failed:', error);
                        reject(error);
                    });
                } else if (window.DialByLine) {
                    // Fallback to DialByLine
                    try {
                        window.DialByLine('audio', null, formattedNumber);

                        // Wait a moment then find the new line
                        setTimeout(() => {
                            const newLineNumber = this.findNewestLine();
                            if (newLineNumber) {
                                resolve(newLineNumber);
                            } else {
                                reject(new Error('Could not find participant line after DialByLine'));
                            }
                        }, 1000);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error('No call function available'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Find the newest/most recent line (for DialByLine fallback)
    findNewestLine() {
        if (!window.Lines || !Array.isArray(window.Lines)) return null;

        for (let i = window.Lines.length - 1; i >= 0; i--) {
            const line = window.Lines[i];
            if (line?.SipSession &&
                ['Initial', 'Establishing', 'Established'].includes(line.SipSession.state)) {
                return i + 1;
            }
        }
        return null;
    }

    // Wait for participant to answer and then merge the calls
    async waitForParticipantAndMerge(hostLineNumber, participantLineNumber, participantNumber) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 60; // 30 seconds timeout

            const checkParticipantStatus = () => {
                attempts++;

                if (attempts > maxAttempts) {
                    console.warn('⏰ Timeout waiting for participant to answer');
                    reject(new Error('Timeout waiting for participant to answer'));
                    return;
                }

                const participantLine = window.Lines[participantLineNumber - 1];

                if (!participantLine?.SipSession) {
                    console.warn('❌ Participant line lost');
                    reject(new Error('Participant line lost'));
                    return;
                }

                const state = participantLine.SipSession.state;
                const status = participantLine.SipSession.status;


                if (state === 'Established' ||
                    (status && ['connected', 'established', 'confirmed'].includes(status.toLowerCase()))) {

                    this.performSimpleMerge(hostLineNumber, participantLineNumber)
                        .then(() => {
                            resolve();
                        })
                        .catch((error) => {
                            console.error('❌ Merge failed:', error);
                            reject(error);
                        });

                } else if (state === 'Terminated') {
                    console.warn('❌ Participant call was terminated');
                    reject(new Error('Participant declined the call'));

                } else {
                    // Still connecting, check again
                    setTimeout(checkParticipantStatus, 500);
                }
            };

            // Start checking
            setTimeout(checkParticipantStatus, 1000);
        });
    }

    // Perform the actual merge (simple version)
    async performSimpleMerge(hostLineNumber, participantLineNumber) {
        try {

            // Step 1: Resume the host call
            if (window.phoneSystem?.unholdCall) {
                await window.phoneSystem.unholdCall(hostLineNumber);
            }

            // Step 2: Mark both lines as in conference
            const hostLine = window.Lines[hostLineNumber - 1];
            const participantLine = window.Lines[participantLineNumber - 1];

            if (hostLine) {
                hostLine.isInConference = true;
                hostLine.conferenceParticipants = [participantLineNumber];
            }

            if (participantLine) {
                participantLine.isInConference = true;
                participantLine.conferenceHost = hostLineNumber;
            }

            // Step 3: Try to use browser's built-in audio mixing
            // This is a simplified approach that relies on the browser/WebRTC to handle mixing

            // Get audio elements for both lines
            const hostAudio = document.getElementById(`line-${hostLineNumber}-remoteAudio`);
            const participantAudio = document.getElementById(`line-${participantLineNumber}-remoteAudio`);

            if (hostAudio && participantAudio) {
                // Set both audio elements to play simultaneously
                hostAudio.volume = 0.8;
                participantAudio.volume = 0.8;

            }

            // Step 4: Dispatch conference events
            window.dispatchEvent(new CustomEvent('conferenceStarted', {
                detail: {
                    conferenceId: `simple_conf_${Date.now()}`,
                    hostLine: hostLineNumber,
                    participantLine: participantLineNumber,
                    type: 'simple_3way'
                }
            }));

            return true;

        } catch (error) {
            console.error('❌ Simple merge failed:', error);
            throw error;
        }
    }

    // End conference
    async endSimpleConference(hostLineNumber) {
        try {

            const hostLine = window.Lines[hostLineNumber - 1];
            if (!hostLine) return;

            const participantLines = hostLine.conferenceParticipants || [];

            // End participant calls
            for (const participantLineNumber of participantLines) {
                if (window.phoneSystem?.endCall) {
                    await window.phoneSystem.endCall(participantLineNumber);
                }
            }

            // Clean up conference markers
            if (hostLine) {
                hostLine.isInConference = false;
                hostLine.conferenceParticipants = [];
            }

            // Dispatch event
            window.dispatchEvent(new CustomEvent('conferenceEnded', {
                detail: {
                    hostLine: hostLineNumber,
                    type: 'simple_3way'
                }
            }));

            return true;

        } catch (error) {
            console.error('❌ Failed to end simple conference:', error);
            throw error;
        }
    }

    // Check if line is in conference
    isLineInConference(lineNumber) {
        const line = window.Lines[lineNumber - 1];
        return line?.isInConference === true;
    }

    // Get conference info for a line
    getSimpleConferenceInfo(lineNumber) {
        const line = window.Lines[lineNumber - 1];
        if (!line?.isInConference) return null;

        return {
            lineNumber: lineNumber,
            isHost: !!line.conferenceParticipants,
            participants: line.conferenceParticipants || [],
            hostLine: line.conferenceHost || lineNumber
        };
    }

    // ===== LEGACY COMPATIBILITY METHODS =====
    // These methods provide compatibility with existing code

    async createAutoConference(participantNumber, hostLineNumber = null) {
        return await this.startSimple3WayConference(participantNumber);
    }

    async addParticipantToConference(conferenceId, participantNumber) {
        // For simple 3-way, we don't support adding more participants
        throw new Error('Simple 3-way conference only supports one additional participant');
    }

    findAvailableConferenceRoom() {
        // Return a fake room for compatibility
        return { extension: 'simple', name: 'Simple 3-Way', maxParticipants: 3, inUse: false };
    }

    getAvailableRoomsCount() {
        return 1; // Always available for simple 3-way
    }

    getAllActiveConferences() {
        const conferences = [];

        if (window.Lines && Array.isArray(window.Lines)) {
            window.Lines.forEach((line, index) => {
                if (line?.isInConference && line.conferenceParticipants) {
                    conferences.push({
                        id: `simple_conf_line_${index + 1}`,
                        hostLine: index + 1,
                        participants: line.conferenceParticipants,
                        type: 'simple_3way'
                    });
                }
            });
        }

        return conferences;
    }
}

/////////////transfer dialer
async function signalCallRelease(extension) {
    try {

        // Method 1: Enhanced localStorage signaling with multiple keys
        const releaseSignal = {
            action: 'RELEASE_CALL_NOW',
            extension: extension,
            deviceId: window.callSwitchingManager?.myDeviceId || 'unknown',
            timestamp: Date.now(),
            urgent: true,
            forceTerminate: true
        };

        // Use multiple localStorage keys to ensure delivery
        const signalKeys = [
            'callReleaseSignal',
            'urgentCallRelease',
            'forceEndCall',
            `endCall_${extension}`,
            'emergencyHangup'
        ];

        signalKeys.forEach(key => {
            localStorage.setItem(key, JSON.stringify(releaseSignal));
        });


        // Method 2: Use BroadcastChannel API for same-origin communication
        try {
            const channel = new BroadcastChannel('phone-call-control');
            channel.postMessage({
                type: 'FORCE_END_CALLS',
                extension: extension,
                timestamp: Date.now()
            });
            channel.close();
        } catch (error) {
            console.warn('⚠️ BroadcastChannel not supported:', error);
        }

        // Method 3: Fixed SIP MESSAGE (remove the buggy send call)
        if (window.sipUserAgent?.userAgent && window.SIP) {
            try {
                const messageUri = `sip:${extension}@${window.SipDomain}`;
                const targetURI = SIP.UserAgent.makeURI(messageUri);

                if (targetURI) {
                    // Use the correct SIP.js MESSAGE method
                    const messageRequest = window.sipUserAgent.userAgent.message(targetURI, 'FORCE_END_CALL_FOR_SWITCH', {
                        contentType: 'text/plain',
                        extraHeaders: ['X-Call-Control: force-end']
                    });

                }
            } catch (error) {
                console.warn('⚠️ SIP MESSAGE failed (non-critical):', error);
            }
        }

        // Method 4: Trigger custom event that other tabs can listen to
        window.dispatchEvent(new CustomEvent('forceEndCallsForSwitch', {
            detail: { extension, timestamp: Date.now() }
        }));

        // Method 5: Use postMessage to communicate with other windows/frames
        try {
            // Send to parent window if in iframe
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'FORCE_END_CALLS',
                    extension: extension
                }, '*');
            }

            // Send to opener window if popup
            if (window.opener) {
                window.opener.postMessage({
                    type: 'FORCE_END_CALLS',
                    extension: extension
                }, '*');
            }
        } catch (error) {
            console.warn('⚠️ postMessage failed:', error);
        }

        // Method 6: Set up enhanced listener for incoming signals
        setupEnhancedReleaseListener();
    } catch (error) {
        console.warn('⚠️ Error in enhanced call release signaling:', error);
    }
}
function setupEnhancedReleaseListener() {
    // Storage event listener (existing)
    window.addEventListener('storage', handleEnhancedReleaseSignal);

    // BroadcastChannel listener
    try {
        const channel = new BroadcastChannel('phone-call-control');
        channel.addEventListener('message', (event) => {
            if (event.data.type === 'FORCE_END_CALLS') {
                forceEndAllCallsImmediately();
            }
        });
    } catch (error) {
        console.warn('⚠️ BroadcastChannel listener setup failed:', error);
    }

    // Custom event listener
    window.addEventListener('forceEndCallsForSwitch', (event) => {
        console.log('📡 Received custom event end call signal');
        forceEndAllCallsImmediately();
    });

    // postMessage listener
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FORCE_END_CALLS') {
            forceEndAllCallsImmediately();
        }
    });

}
function handleEnhancedReleaseSignalSafe(event) {
    const releaseKeys = [
        'callReleaseSignal',
        'urgentCallRelease',
        'forceEndCall',
        'emergencyHangup'
    ];

    if (releaseKeys.includes(event.key) && event.newValue) {
        try {
            const signal = JSON.parse(event.newValue);
            const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");

            if (signal.extension === myExtension || signal.forceTerminate) {
                console.log('🚫 Release signal received but cleanup disabled to prevent reconnection');

                // Clear signals but don't clean up
                releaseKeys.forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (error) {
            console.warn('⚠️ Error handling release signal:', error);
        }
    }
}
// Aggressive function to immediately end ALL calls
function forceEndAllCallsImmediately() {

    if (!window.Lines || !Array.isArray(window.Lines)) {
        console.log('❌ No Lines array found');
        return;
    }

    let callsEnded = 0;

    window.Lines.forEach((line, index) => {
        if (line && line.SipSession) {
            const lineNumber = index + 1;

            try {
                // Try multiple termination methods
                if (line.SipSession.state !== 'Terminated') {
                    // Method 1: Standard terminate
                    if (typeof line.SipSession.terminate === 'function') {
                        line.SipSession.terminate();
                        callsEnded++;
                    }

                    // Method 2: BYE if established
                    if (typeof line.SipSession.bye === 'function') {
                        line.SipSession.bye();
                    }

                    // Method 3: Cancel if not established
                    if (typeof line.SipSession.cancel === 'function') {
                        line.SipSession.cancel();
                    }

                    // Method 4: Direct cleanup
                    if (window.clearLine) {
                        setTimeout(() => {
                            window.clearLine(index);
                        }, 500);
                    }
                }


            } catch (error) {
                console.error(`❌ Error ending call on line ${lineNumber}:`, error);
            }
        }
    });


    // Also try global hangup functions
    const hangupFunctions = [
        'HangupAll',
        'EndCall',
        'HangUp',
        'TerminateCall',
        'DisconnectCall',
        'HangupCall'
    ];

    hangupFunctions.forEach(funcName => {
        if (window[funcName] && typeof window[funcName] === 'function') {
            try {
                window[funcName]();
            } catch (error) {
                console.warn(`⚠️ ${funcName}() failed:`, error);
            }
        }
    });
}

















//////////////////////conference

class ConnectionManager {
    constructor() {
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 0; // ✅ Disable reconnection attempts
        this.baseReconnectDelay = 1000;
        this.maxReconnectDelay = 30000;

    }

    getReconnectDelay() {
        return 0; // ✅ No delays needed since we don't reconnect
    }

    startNetworkMonitoring() {
        // ✅ MINIMAL network monitoring - no auto-actions
        window.addEventListener('online', () => {
            console.log('✅ Network online - manual restart available');
        });

        window.addEventListener('offline', () => {
            console.log('❌ Network offline - connections may be affected');
        });
    }

    handleOnline() {
        // ✅ REMOVED: Auto-restart logic
        console.log('✅ Network online - no automatic action taken');
    }

    handleOffline() {
        console.log('❌ Network offline - no automatic action taken');
    }

    // ✅ REMOVED: All heartbeat methods
    startHeartbeat(userAgent) {
        console.log('🚫 Heartbeat disabled');
    }

    stopHeartbeat() {
        console.log('🚫 No heartbeat to stop');
    }

    // ✅ REMOVED: Failure handling that caused restarts
    handleHeartbeatFailure() {
        console.log('🚫 Heartbeat failure handling disabled');
    }

    cleanup() {
        console.log('🧹 Connection manager cleanup (minimal)');
    }
}

// 5️⃣ DISABLE forceRestartSip function to prevent external restarts
window.forceRestartSip = function () {
    console.log('🚫 SIP restart disabled to prevent session interference');
    console.log('📞 To manually restart, use: window.stopSipConnection() then window.startSipConnection()');
};

// 6️⃣ DISABLE any other restart triggers
window.restartSip = function () {
    console.log('🚫 SIP restart disabled');
};


class MediaManager {
    constructor() {
        this.audioContext = null;
    }

    getBasicConstraints() {
        const deviceIds = {
            input: localStorage.getItem("AudioSrcId") || "default",
            output: localStorage.getItem("AudioOutputId") || "default"
        };
        return {
            audio: {
                deviceId: deviceIds.input !== "default" ? { exact: deviceIds.input } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: { ideal: 48000 },
                channelCount: { ideal: 1 }
            },
            video: false
        };
    }

    // ✅ ADDED: Simple media pre-warming without complex stream handling
    async preWarmMediaStream() {
        try {
            console.log('🎵 Pre-warming media stream...');
            const stream = await navigator.mediaDevices.getUserMedia(this.getBasicConstraints());
            // Just stop the tracks immediately - we only needed permission
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Media stream pre-warmed successfully');
            return true;
        } catch (error) {
            console.warn('⚠️ Media pre-warming failed:', error);
            return false;
        }
    }

    cleanup() {
        if (this.audioContext?.state === 'running') { this.audioContext.close(); }
        this.audioContext = null;
    }
}

class SimplifiedSipUserAgent {
    constructor() {
        this.userAgent = null;
        this.registerer = null;
        this.connectionManager = new ConnectionManager();
        this.mediaManager = new MediaManager();
        this.stunServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ];
        this.registrationRetryCount = 0;
        this.maxRegistrationRetries = 5;
    }

    async initialize() {
        try {
            const validation = window.validateSipConfiguration();
            if (!validation.isValid) {
                throw new Error(`Missing configuration: ${Object.keys(validation.missing).filter(k => validation.missing[k]).join(', ')}`);
            }

            // ✅ FIXED: Call preWarmMediaStream (now exists)
            await this.mediaManager.preWarmMediaStream();

            const userAgentOptions = this.createBasicUserAgentOptions();
            this.userAgent = new SIP.UserAgent(userAgentOptions);
            this.connectionManager.startNetworkMonitoring();
            await this.userAgent.start();
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize SIP User Agent:', error);
            throw error;
        }
    }

    createBasicUserAgentOptions() {
        const config = window.validateSipConfiguration().config;
        return {
            uri: SIP.UserAgent.makeURI(`sip:${config.username}@${config.domain}`),
            transportOptions: {
                server: config.webSocketUri, connectionTimeout: 30, maxReconnectionAttempts: 99,
                reconnectionTimeout: 3, reconnectionDelay: 3, keepAliveInterval: 30, keepAliveDebounce: 10,
                wsServers: [config.webSocketUri], traceSip: false, hackWssInTransport: true, hackIpInContact: true,
            },
            authorizationUsername: config.username,
            authorizationPassword: window.SipPassword,
            sessionDescriptionHandlerFactoryOptions: {
                constraints: this.mediaManager.getBasicConstraints(),
                peerConnectionOptions: {
                    rtcConfiguration: {
                        iceServers: this.stunServers, iceTransportPolicy: 'all',
                        bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require'
                    }
                }
            },
            delegate: {
                onConnect: () => this.handleConnect(),
                onDisconnect: (error) => this.handleDisconnect(error),
                onInvite: (invitation) => this.handleInvite(invitation)
            },
            noAnswerTimeout: 60, userAgentString: 'SimplifiedPhone/4.1',
            allowLegacyNotifications: false, logLevel: 'error'
        };
    }

    async handleConnect() {
        console.log('✅ WebSocket connected');
        window.registrationState = 'Connected';
        window.updateRegistrationStatus();
        this.connectionManager.startHeartbeat(this.userAgent);
        this.connectionManager.reconnectAttempts = 0;
        this.registrationRetryCount = 0;
        await this.startBasicRegistration();
    }

    async handleDisconnect(error) {
        console.log('❌ WebSocket disconnected:', error);
        window.registrationState = 'Disconnected';
        window.isRegistered = false;
        window.updateRegistrationStatus();
        this.connectionManager.stopHeartbeat();
        if (this.connectionManager.reconnectAttempts < this.connectionManager.maxReconnectAttempts) {
            const delay = this.connectionManager.getReconnectDelay();
            console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.connectionManager.reconnectAttempts + 1})`);
            this.connectionManager.reconnectAttempts++;
            setTimeout(async () => {
                try {
                    if (this.userAgent?.state === 'Stopped') { await this.userAgent.start(); }
                    else { await this.userAgent.reconnect(); }
                } catch (reconnectError) {
                    console.error('❌ Reconnection failed:', reconnectError);
                    this.handleDisconnect(reconnectError);
                }
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            window.dispatchEvent(new CustomEvent('sipConnectionFailed', { detail: { reason: 'Max reconnection attempts reached' } }));
        }
    }

    async startBasicRegistration() {
        try {
            this.registerer = new SIP.Registerer(this.userAgent, { expires: 600, refreshFrequency: 80, registrationRetryInterval: 30 });
            this.registerer.stateChange.addListener((newState) => {
                switch (newState) {
                    case SIP.RegistererState.Registered: this.handleRegistrationSuccess(); break;
                    case SIP.RegistererState.Unregistered: this.handleRegistrationFailure(); break;
                }
            });
            await this.registerer.register({ requestDelegate: { onReject: (response) => this.handleRegistrationReject(response) } });
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.handleRegistrationFailure();
        }
    }

    handleRegistrationSuccess() {
        window.registrationState = 'Registered';
        window.isRegistered = true;
        window.updateRegistrationStatus();
        this.registrationRetryCount = 0;
        localStorage.setItem('lastSuccessfulRegistration', new Date().toISOString());
    }

    async handleRegistrationFailure() {
        window.registrationState = 'Failed';
        window.isRegistered = false;
        window.updateRegistrationStatus();
        if (this.registrationRetryCount < this.maxRegistrationRetries) {
            this.registrationRetryCount++;
            const delay = this.connectionManager.getReconnectDelay();
            setTimeout(() => { this.startBasicRegistration(); }, delay);
        }
    }

handleRegistrationReject(response) {
    const statusCode = response.message.statusCode;
    const reasonPhrase = response.message.reasonPhrase;
    
    console.error('❌ Registration rejected:', statusCode, reasonPhrase);
    
    switch (statusCode) {
        case 401:
        case 407:
            console.error('🔐 Authentication failed - check credentials');
            window.dispatchEvent(new CustomEvent('sipAuthenticationFailed', {
                detail: {
                    statusCode: statusCode,
                    reason: reasonPhrase,
                    error: 'Invalid credentials'
                }
            }));
            break;
            
        case 403:
            // This is typically max contacts reached
            console.error('🚫 Forbidden - Maximum contacts/devices reached');
            window.isRegistered = false;
            window.registrationState = 'Max Contacts Reached';
            window.updateRegistrationStatus();
            
            // Dispatch specific event for max contacts - this will trigger the modal immediately
            window.dispatchEvent(new CustomEvent('sipMaxContactsReached', {
                detail: {
                    statusCode: statusCode,
                    reason: reasonPhrase,
                    error: 'Maximum simultaneous logins reached. You cannot use the dialer until you logout from another device.',
                    showImmediately: true,
                    blockDialer: true
                }
            }));
            
            // Block all dialer functions
            window.dialerBlocked = true;
            
            // Don't attempt to retry registration
            this.registrationRetryCount = this.maxRegistrationRetries;
            break;
            
        case 408:
            console.warn('⏱️ Registration timeout - retrying');
            this.handleRegistrationFailure();
            break;
            
        case 503:
            console.error('🔧 Service Unavailable - Server may be overloaded');
            window.dispatchEvent(new CustomEvent('sipConnectionFailed', {
                detail: {
                    statusCode: statusCode,
                    reason: 'Service temporarily unavailable'
                }
            }));
            this.handleRegistrationFailure();
            break;
            
        default:
            console.error(`📞 Registration failed with status: ${statusCode}`);
            window.dispatchEvent(new CustomEvent('sipConnectionFailed', {
                detail: {
                    statusCode: statusCode,
                    reason: reasonPhrase
                }
            }));
            this.handleRegistrationFailure();
    }
}

    async handleInvite(invitation) {
        window.handleIncomingCall(invitation);
    }
    async handleDisconnect(error) {
        console.log('❌ WebSocket disconnected:', error);
        window.registrationState = 'Disconnected';
        window.isRegistered = false;
        window.updateRegistrationStatus();

        // 🛡️ REMOVED: Auto-reconnection logic that was causing issues

        // Only dispatch event, don't auto-reconnect
        window.dispatchEvent(new CustomEvent('sipConnectionFailed', {
            detail: { reason: 'Connection lost', error: error?.message || 'Unknown error' }
        }));
    }
    cleanup() {
        this.connectionManager.cleanup();
        this.mediaManager.cleanup();
        if (this.registerer) { this.registerer.unregister().catch(console.error); }
        if (this.userAgent) { this.userAgent.stop().catch(console.error); }
    }
}

class FreePBXCompatibleSipUserAgent extends SimplifiedSipUserAgent {
    constructor() {
        super();
        // Don't use unique device IDs for PJSIP - use same extension
        this.deviceId = this.generateSessionId(); // For internal tracking only
    }

    generateSessionId() {
        // Internal session ID for this browser instance (not sent to server)
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    createBasicUserAgentOptions() {
        const config = window.validateSipConfiguration().config;

        // ✅ CRITICAL: Use the SAME extension number for all devices
        // Do NOT append device ID to the contact URI
        const standardContact = `sip:${config.username}@${config.domain}`;

        return {
            uri: SIP.UserAgent.makeURI(standardContact),
            transportOptions: {
                server: config.webSocketUri,
                connectionTimeout: 30,
                maxReconnectionAttempts: 99,
                reconnectionTimeout: 3,
                reconnectionDelay: 3,
                keepAliveInterval: 30,
                keepAliveDebounce: 10,
                wsServers: [config.webSocketUri],
                traceSip: false,
                hackWssInTransport: true,
                hackIpInContact: true,
            },
            authorizationUsername: config.username,
            authorizationPassword: window.SipPassword,

            // ✅ Standard contact - no device ID appended
            // This allows FreePBX PJSIP to handle forking properly

            sessionDescriptionHandlerFactoryOptions: {
                constraints: this.mediaManager.getBasicConstraints(),
                peerConnectionOptions: {
                    rtcConfiguration: {
                        iceServers: this.stunServers,
                        iceTransportPolicy: 'all',
                        bundlePolicy: 'max-bundle',
                        rtcpMuxPolicy: 'require'
                    }
                }
            },
            delegate: {
                onConnect: () => this.handleConnect(),
                onDisconnect: (error) => this.handleDisconnect(error),
                onInvite: (invitation) => this.handleInvite(invitation)
            },
            noAnswerTimeout: 60,
            userAgentString: `SimplifiedPhone/4.1-FreePBX`,
            allowLegacyNotifications: false,
            logLevel: 'error'
        };
    }

    async startBasicRegistration() {
        try {
            // ✅ Standard PJSIP headers - no custom device headers
            const extraHeaders = [
                `User-Agent: SimplifiedPhone/4.1-WebRTC`,
                `X-Client-Type: WebRTC`
            ];

            this.registerer = new SIP.Registerer(this.userAgent, {
                expires: 300, // Standard expiry
                refreshFrequency: 80,
                registrationRetryInterval: 30,
                extraHeaders: extraHeaders
            });

            this.registerer.stateChange.addListener((newState) => {
                switch (newState) {
                    case SIP.RegistererState.Registered:
                        this.handleRegistrationSuccess();
                        break;
                    case SIP.RegistererState.Unregistered:
                        this.handleRegistrationFailure();
                        break;
                }
            });

            await this.registerer.register({
                requestDelegate: {
                    onReject: (response) => this.handleRegistrationReject(response)
                }
            });

        } catch (error) {
            console.error('❌ FreePBX PJSIP registration error:', error);
            this.handleRegistrationFailure();
        }
    }

    handleRegistrationSuccess() {
        window.registrationState = 'Registered';
        window.isRegistered = true;
        window.updateRegistrationStatus();
        this.registrationRetryCount = 0;
        localStorage.setItem('lastSuccessfulRegistration', new Date().toISOString());

        // Log session info for debugging
    }
}

// Add this to your phone.js file after the registration handler

// Global dialer blocking function
window.blockDialerFunctions = function() {
    console.log('🚫 Blocking all dialer functions due to max contacts');
    
    // Set global flag
    window.dialerBlocked = true;
    
    // Override all critical dialer functions to show error
    const blockedFunctions = [
        'DialByLine',
        'makeCall',
        'answerCall',
        'transferCall',
        'holdCall',
        'unholdCall',
        'muteCall',
        'unmuteCall',
        'sendDTMF',
        'startInstantConference',
        'addConferenceParticipant'
    ];
    
    blockedFunctions.forEach(funcName => {
        const original = window[funcName];
        if (original && typeof original === 'function') {
            window[funcName + '_original'] = original;
            window[funcName] = function(...args) {
                console.error(`🚫 ${funcName} blocked - max contacts reached`);
                
                // Dispatch event to show modal
                window.dispatchEvent(new CustomEvent('sipMaxContactsReached', {
                    detail: {
                        error: 'This function is blocked because the maximum device limit has been reached.',
                        action: funcName,
                        blockDialer: true
                    }
                }));
                
                throw new Error('Dialer blocked - maximum device limit reached');
            };
        }
    });
    
    // Disable UI elements
    setTimeout(() => {
        // Disable all call buttons
        document.querySelectorAll('button').forEach(button => {
            if (button.textContent?.includes('Call') || 
                button.title?.includes('Call') ||
                button.className?.includes('call')) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                button.title = 'Dialer blocked - max devices reached';
            }
        });
        
        // Disable keypad buttons
        document.querySelectorAll('[class*="keypad"]').forEach(element => {
            if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
                element.disabled = true;
                element.style.opacity = '0.5';
            }
        });
        
        // Disable input fields for dialing
        document.querySelectorAll('input[type="text"], input[type="tel"]').forEach(input => {
            if (input.placeholder?.toLowerCase().includes('number') || 
                input.placeholder?.toLowerCase().includes('dial')) {
                input.disabled = true;
                input.placeholder = 'Dialer blocked - max devices reached';
                input.style.opacity = '0.5';
            }
        });
    }, 1000);
};

// Unblock dialer functions (for logout/refresh)
window.unblockDialerFunctions = function() {
    console.log('✅ Unblocking dialer functions');
    
    window.dialerBlocked = false;
    
    // Restore original functions
    const blockedFunctions = [
        'DialByLine',
        'makeCall',
        'answerCall',
        'transferCall',
        'holdCall',
        'unholdCall',
        'muteCall',
        'unmuteCall',
        'sendDTMF',
        'startInstantConference',
        'addConferenceParticipant'
    ];
    
    blockedFunctions.forEach(funcName => {
        const original = window[funcName + '_original'];
        if (original) {
            window[funcName] = original;
            delete window[funcName + '_original'];
        }
    });
    
    // Re-enable UI elements
    document.querySelectorAll('button:disabled').forEach(button => {
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
        button.title = '';
    });
    
    document.querySelectorAll('input:disabled').forEach(input => {
        input.disabled = false;
        input.style.opacity = '';
        if (input.placeholder?.includes('blocked')) {
            input.placeholder = 'Enter Number';
        }
    });
};

// Enhanced registration check on startup
window.checkRegistrationOnStartup = function() {
    // Wait a bit for registration to complete
    setTimeout(() => {
        if (window.registrationState === 'Max Contacts Reached' || 
            window.registrationState === 'Failed' && !window.isRegistered) {
            
            console.log('🚫 Registration failed on startup - checking for max contacts');
            
            // Check if it's specifically max contacts
            if (window.registrationState === 'Max Contacts Reached') {
                // Block the dialer immediately
                window.blockDialerFunctions();
                
                // Dispatch event to show modal
                window.dispatchEvent(new CustomEvent('sipMaxContactsReached', {
                    detail: {
                        error: 'Maximum device limit reached. You cannot use the dialer until you logout from another device.',
                        showImmediately: true,
                        blockDialer: true
                    }
                }));
            }
        }
    }, 2000); // Wait 2 seconds after page load
};

// Call this on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.checkRegistrationOnStartup);
} else {
    window.checkRegistrationOnStartup();
}

class SimplifiedCallManager {
    constructor() { this.callHistory = this.loadCallHistory(); }

async makeSimpleCall(number, options = {}) {
    try {
        // Check registration status first
        if (!window.isRegistered) {
            const registrationState = window.registrationState || 'Unknown';
            
            // Check if it's max contacts issue
            if (registrationState === 'Max Contacts Reached') {
                const error = new Error('Maximum device limit reached. Please logout from another device.');
                error.code = 'MAX_CONTACTS';
                
                // Dispatch event for UI notification
                window.dispatchEvent(new CustomEvent('sipMaxContactsReached', {
                    detail: {
                        error: 'Cannot make calls - maximum device limit reached',
                        action: 'makeCall'
                    }
                }));
                
                throw error;
            }
            
            // Generic not registered error
            const error = new Error('Not registered with phone system');
            error.code = 'NOT_REGISTERED';
            throw error;
        }
        
        const lineNumber = options.lineNumber || this.findAvailableLine();
        if (!lineNumber) {
            throw new Error('No available lines');
        }
        
        const inviter = await this.createSimpleInviter(number, lineNumber, options);
        this.addToCallHistory({
            number,
            direction: 'outbound',
            timestamp: new Date().toISOString(),
            lineNumber
        });
        
        return lineNumber;
        
    } catch (error) {
        console.error('❌ Call failed:', error);
        
        // Provide user-friendly error messages
        if (error.code === 'MAX_CONTACTS') {
            // This will be caught by the UI
            alert('Maximum Device Limit Reached\n\nYou have reached the maximum number of simultaneous logins allowed for your extension.\n\nPlease logout from another device to continue.');
        } else if (error.code === 'NOT_REGISTERED') {
            alert('Phone System Not Ready\n\nThe phone system is not registered. Please wait a moment or refresh the page.\n\nIf this persists, you may have reached the maximum device limit.');
        }
        
        throw error;
    }
}


    findAvailableLine() {
        const lines = window.Lines || [];
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].SipSession && !lines[i].IsSelected) { return i + 1; }
        }
        return null;
    }
    setupSimpleLine(lineIndex, session, number, direction) {
        const lineNumber = lineIndex + 1;
        
        // ✅ ENHANCED CALLER INFORMATION EXTRACTION
        let callerNumber = number || 'unknown';
        let callerName = number || 'Unknown';
        
        
        if (direction === 'inbound') {
            // For incoming calls, extract the real caller info from multiple sources
            
            // Method 1: Check session request headers
            if (session.request && session.request.from) {
                try {
                    const fromHeader = session.request.from.toString();
                    
                    // Extract number from SIP URI
                    const numberMatch = fromHeader.match(/sip:([^@;]+)@/);
                    if (numberMatch && numberMatch[1]) {
                        callerNumber = numberMatch[1];
                        console.log('✅ Extracted caller number:', callerNumber);
                    }
                    
                    // Extract display name
                    const nameMatch = fromHeader.match(/"([^"]+)"/);
                    if (nameMatch && nameMatch[1]) {
                        callerName = nameMatch[1];
                        console.log('✅ Extracted caller name:', callerName);
                    } else {
                        callerName = callerNumber;
                    }
                } catch (error) {
                    console.warn('⚠️ Error parsing From header:', error);
                    callerNumber = number || 'unknown';
                    callerName = callerNumber;
                }
            }
            
            // Method 2: Check if session has remoteIdentity
            if (session.remoteIdentity) {
                if (session.remoteIdentity.uri && session.remoteIdentity.uri.user) {
                    const remoteNumber = session.remoteIdentity.uri.user;
                    if (remoteNumber && remoteNumber !== 'unknown') {
                        callerNumber = remoteNumber;
                        console.log('✅ Got caller number from remoteIdentity:', callerNumber);
                    }
                }
                
                if (session.remoteIdentity.displayName) {
                    callerName = session.remoteIdentity.displayName;
                    console.log('✅ Got caller name from remoteIdentity:', callerName);
                }
            }
            
            // Method 3: Check localStorage for recent call info
            try {
                const recentCallInfo = localStorage.getItem('lastIncomingCallInfo');
                if (recentCallInfo) {
                    const callInfo = JSON.parse(recentCallInfo);
                    const timeDiff = Date.now() - (callInfo.timestamp || 0);
                    
                    // If the call info is very recent (within last 30 seconds)
                    if (timeDiff < 30000 && callInfo.callerNumber && callInfo.callerNumber !== 'unknown') {
                        callerNumber = callInfo.callerNumber;
                        callerName = callInfo.callerName || callerNumber;
                        console.log('✅ Got caller info from recent localStorage:', { callerNumber, callerName });
                    }
                }
            } catch (storageError) {
                console.warn('⚠️ Error reading localStorage for caller info:', storageError);
            }
            
            console.log('📞 Final incoming call info:', { callerNumber, callerName });
        } else {
            // For outgoing calls, the number parameter is the target
            callerNumber = number || 'unknown';
            callerName = number || 'Unknown';
            console.log('📞 Outgoing call to:', { callerNumber, callerName });
        }
        
        // Format phone numbers
        if (callerNumber && callerNumber !== 'unknown') {
            callerNumber = callerNumber.replace(/[^\d+]/g, '');
            if (callerNumber.length === 10) {
                callerNumber = '+1' + callerNumber;
            } else if (callerNumber.length === 11 && callerNumber.startsWith('1')) {
                callerNumber = '+' + callerNumber;
            }
        }
        
        const lineObj = {
            LineNumber: lineNumber, 
            SipSession: session, 
            CallerIDNumber: callerNumber,  // Store the extracted caller number
            CallerIDName: callerName,      // Store the caller name
            IsSelected: true, 
            direction: direction, 
            startTime: null, 
            endTime: null, 
            callTimer: null,
            isOnHold: false, 
            isMuted: false, 
            callId: `${Date.now()}-${lineNumber}`,
            originalCallerNumber: callerNumber,  // Store backup copy
            extractedCallerInfo: {  // Store extraction metadata
                callerNumber: callerNumber,
                callerName: callerName,
                direction: direction,
                extractedAt: new Date().toISOString(),
                extractionMethod: direction === 'inbound' ? 'headers' : 'parameter'
            }
        };
        
        window.Lines[lineIndex] = lineObj;
        
        // ✅ ENHANCED SESSION DATA STORAGE WITH MULTIPLE BACKUPS
        session.data = { 
            line: lineNumber, 
            callerNumber: callerNumber,  // Primary storage
            callerName: callerName,
            direction: direction, 
            callstart: new Date().toISOString(), 
            callId: lineObj.callId,
            originalCallerNumber: callerNumber,  // Backup
            lineObject: {  // Another backup in session data
                CallerIDNumber: callerNumber,
                CallerIDName: callerName,
                direction: direction
            }
        };
        
        console.log(`✅ Line ${lineNumber} setup complete with enhanced caller info:`, {
            CallerIDNumber: lineObj.CallerIDNumber,
            CallerIDName: lineObj.CallerIDName,
            direction: lineObj.direction,
            sessionData: session.data
        });
        
        return lineObj;
    }
    async createSimpleInviter(number, lineNumber, options) {
        const userAgent = window.sipUserAgent?.userAgent;
        if (!userAgent) throw new Error('User agent not initialized');
        const targetURI = SIP.UserAgent.makeURI(`sip:${number.replace(/#/g, "%23")}@${window.SipDomain}`);
        if (!targetURI) throw new Error('Invalid target URI');
        const inviterOptions = {
            earlyMedia: true, inviteWithoutSdp: false,
            sessionDescriptionHandlerOptions: {
                constraints: window.sipUserAgent.mediaManager.getBasicConstraints(),
                hold: options.startOnHold || false
            },
            extraHeaders: ['X-Client-Version: SimplifiedPhone/4.1']
        };
        if (options.customHeaders) { inviterOptions.extraHeaders.push(...options.customHeaders); }
        const inviter = new SIP.Inviter(userAgent, targetURI, inviterOptions);
        const lineIndex = lineNumber - 1;
        const lineObj = this.setupSimpleLine(lineIndex, inviter, number, 'outbound');
        this.setupSimpleSessionHandlers(inviter, lineObj);
        await this.sendInvitationWithRetry(inviter, lineObj);
        return inviter;
    }


    setupSimpleSessionHandlers(session, lineObj) {
        if (session.stateChange?.addListener) {
            session.stateChange.addListener((newState) => {
                console.log(`📞 Session ${lineObj.callId} state changed: ${newState}`);

                // Update session status immediately
                if (lineObj.SipSession) {
                    lineObj.SipSession.status = newState.toLowerCase();
                }

                let status = '';
                switch (newState) {
                    case "Establishing":
                        status = 'connecting';
                        this.updateCallStatus(lineObj.LineNumber, 'Connecting...');
                        break;
                    case "Established":
                        status = 'connected';
                        this.handleSessionEstablished(lineObj);

                        // ✅ NEW: Broadcast session establishment to close other popups
                        window.dispatchEvent(new CustomEvent('sipSessionStateChange', {
                            detail: { session: session, newState: 'Established', lineNumber: lineObj.LineNumber }
                        }));
                        break;
                    case "Terminated":
                        status = 'ended';
                        this.handleSessionTerminated(lineObj);
                        break;
                    default:
                        status = (newState || '').toLowerCase();
                }
                if (lineObj.SipSession) lineObj.SipSession.status = status;
            });
        }

        // Rest of the session handlers remain the same...
        session.delegate = {
            onBye: (request) => {
                this.updateCallStatus(lineObj.LineNumber, 'Call Ended');
                this.cleanupSession(lineObj);
                window.dispatchEvent(new Event('globalCallEnd'));

                try {
                    if (request && typeof request.accept === 'function') {
                        request.accept();
                    }
                } catch (error) {
                    console.warn('BYE accept error:', error);
                }
            },
            onCancel: (request) => {
                this.updateCallStatus(lineObj.LineNumber, 'Call Cancelled');
                if (window.closeGlobalIncomingCall) {
                    window.closeGlobalIncomingCall('cancelled');
                }
                this.cleanupSession(lineObj);
                window.dispatchEvent(new Event('globalCallEnd'));

            },
            onSessionDescriptionHandler: (sdh) => this.handleSimpleSDH(lineObj, sdh)
        };
    }

    async sendInvitationWithRetry(inviter, lineObj, retries = 3) {
        const requestOptions = {
            requestDelegate: {
                onTrying: () => this.updateCallStatus(lineObj.LineNumber, 'Calling...'),
                onProgress: (response) => {
                    const status = response.message.statusCode;
                    if (status === 180) { this.updateCallStatus(lineObj.LineNumber, 'Ringing...'); }
                    else if (status === 183) { this.updateCallStatus(lineObj.LineNumber, 'Session Progress'); }
                },
                onAccept: (response) => { console.log(`✅ Call accepted on line ${lineObj.LineNumber}`); },
                onReject: (response) => {
                    const status = response.message.statusCode;
                    const reason = response.message.reasonPhrase;
                    this.updateCallStatus(lineObj.LineNumber, `Call ${reason}`);
                    this.cleanupSession(lineObj);
                },
                onCancel: () => {
                    this.updateCallStatus(lineObj.LineNumber, 'Call Cancelled');
                    this.cleanupSession(lineObj);
                }
            }
        };
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await inviter.invite(requestOptions);
                return;
            } catch (error) {
                console.error(`❌ Invitation attempt ${attempt + 1} failed:`, error);
                if (attempt < retries - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else { throw error; }
            }
        }
    }

    handleSimpleSDH(lineObj, sdh) {
        if (sdh?.peerConnection) {
            const pc = sdh.peerConnection;
            pc.ontrack = async (event) => {
                if (event.streams?.[0]) {
                    const stream = event.streams[0];
                    const remoteAudio = document.getElementById(`line-${lineObj.LineNumber}-remoteAudio`) || this.createAudioElement(lineObj.LineNumber);
                    remoteAudio.srcObject = stream;
                    remoteAudio.autoplay = true;
                    const outputId = localStorage.getItem("AudioOutputId");
                    if (outputId && outputId !== "default" && remoteAudio.setSinkId) {
                        try { await remoteAudio.setSinkId(outputId); }
                        catch (error) { console.warn('⚠️ Failed to set audio output device:', error); }
                    }
                }
            };
            pc.oniceconnectionstatechange = () => { console.log(`🧊 ICE state for line ${lineObj.LineNumber}: ${pc.iceConnectionState}`); };
        }
    }

    createAudioElement(lineNumber) {
        const audio = document.createElement('audio');
        audio.id = `line-${lineNumber}-remoteAudio`;
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        return audio;
    }

    handleSessionEstablished(lineObj) {
        console.log(`✅ Call established on line ${lineObj.LineNumber}`);
        lineObj.startTime = new Date();
        this.startCallTimer(lineObj);
        this.updateCallStatus(lineObj.LineNumber, 'Connected');
        if (lineObj.direction === 'inbound' && window.closeGlobalIncomingCall) {
            window.closeGlobalIncomingCall('answered');
        }

        // ✅ NEW: Broadcast that call was answered (for other devices to show transfer notification)
        if (lineObj.direction === 'inbound') {
            window.dispatchEvent(new CustomEvent('callAnsweredElsewhere', {
                detail: {
                    callerNumber: lineObj.CallerIDNumber,
                    callerName: lineObj.CallerIDName || lineObj.CallerIDNumber,
                    timestamp: Date.now(),
                    lineNumber: lineObj.LineNumber
                }
            }));
        }

        window.dispatchEvent(new CustomEvent('callEstablished', {
            detail: { lineNumber: lineObj.LineNumber, callId: lineObj.callId }
        }));
    }

handleSessionTerminated(lineObj) {
    console.log(`📞 Call terminated on line ${lineObj.LineNumber}`);
    lineObj.endTime = Date.now();
    this.updateCallStatus(lineObj.LineNumber, 'Call Ended');
    
    // ✅ ENHANCED CALL RECORD SAVING WITH BETTER CALLER DETECTION
    console.log('💾 Attempting to save call record with enhanced caller detection...');
    
    try {
        const myPhoneNumber = localStorage.getItem("myPhoneNumber") || localStorage.getItem("senderPhone") || "";
        const myExtension = myPhoneNumber.replace(/[^\d]/g, '').replace(/^1/, '');
        
        // ✅ MULTIPLE METHODS TO GET CALLER NUMBER
        let callerNumber = 'unknown';
        let callerName = 'Unknown Caller';
        let direction = 'outbound';
        
        // Method 1: Check lineObj data first
        if (lineObj.CallerIDNumber && lineObj.CallerIDNumber !== 'unknown') {
            callerNumber = lineObj.CallerIDNumber;
            callerName = lineObj.CallerIDName || callerNumber;
            direction = lineObj.direction || 'inbound';
            console.log('✅ Got caller info from lineObj:', { callerNumber, callerName, direction });
        }
        
        // Method 2: Check session data
        else if (lineObj.SipSession?.data?.callerNumber && lineObj.SipSession.data.callerNumber !== 'unknown') {
            callerNumber = lineObj.SipSession.data.callerNumber;
            callerName = lineObj.SipSession.data.callerName || callerNumber;
            direction = lineObj.SipSession.data.direction || 'inbound';
            console.log('✅ Got caller info from session data:', { callerNumber, callerName, direction });
        }
        
        // Method 3: Try to extract from SIP session headers
        else if (lineObj.SipSession?.request) {
            try {
                if (lineObj.SipSession.request.from) {
                    const fromHeader = lineObj.SipSession.request.from.toString();
                    console.log('📞 Parsing From header for caller info:', fromHeader);
                    
                    // Extract number from SIP URI
                    const numberMatch = fromHeader.match(/sip:([^@;]+)@/);
                    if (numberMatch && numberMatch[1] && numberMatch[1] !== 'unknown') {
                        callerNumber = numberMatch[1];
                        direction = 'inbound';
                        
                        // Extract display name if available
                        const nameMatch = fromHeader.match(/"([^"]+)"/);
                        if (nameMatch && nameMatch[1]) {
                            callerName = nameMatch[1];
                        } else {
                            callerName = callerNumber;
                        }
                        
                        console.log('✅ Extracted from SIP headers:', { callerNumber, callerName, direction });
                    }
                }
            } catch (headerError) {
                console.warn('⚠️ Error parsing SIP headers:', headerError);
            }
        }
        
        // Method 4: Check if we can get info from global events
        if (callerNumber === 'unknown') {
            // Check recent localStorage for call info
            try {
                const recentCallInfo = localStorage.getItem('lastIncomingCallInfo');
                if (recentCallInfo) {
                    const callInfo = JSON.parse(recentCallInfo);
                    const timeDiff = Date.now() - (callInfo.timestamp || 0);
                    
                    // If the call info is recent (within last 5 minutes)
                    if (timeDiff < 300000) {
                        callerNumber = callInfo.callerNumber || 'unknown';
                        callerName = callInfo.callerName || callerNumber;
                        direction = callInfo.direction || 'inbound';
                        console.log('✅ Got caller info from recent localStorage:', { callerNumber, callerName, direction });
                    }
                }
            } catch (storageError) {
                console.warn('⚠️ Error reading localStorage call info:', storageError);
            }
        }
        
        // Format numbers properly
        let caller, callee;
        if (direction === 'inbound') {
            caller = callerNumber;
            callee = myPhoneNumber;
        } else {
            caller = myPhoneNumber;
            callee = callerNumber;
        }
        
        // Clean and format phone numbers
        if (caller && caller !== 'unknown') {
            caller = caller.replace(/[^\d+]/g, '');
            if (caller.length === 10) caller = '+1' + caller;
            else if (caller.length === 11 && caller.startsWith('1')) caller = '+' + caller;
        }
        
        if (callee && callee !== 'unknown') {
            callee = callee.replace(/[^\d+]/g, '');
            if (callee.length === 10) callee = '+1' + callee;
            else if (callee.length === 11 && callee.startsWith('1')) callee = '+' + callee;
        }
        
        const callRecord = {
            caller: caller || 'unknown',
            callee: callee || 'unknown',
            direction: direction,
            start_time: lineObj.SipSession?.data?.callstart ? 
                new Date(lineObj.SipSession.data.callstart).toISOString().slice(0, 19).replace('T', ' ') : 
                new Date().toISOString().slice(0, 19).replace('T', ' '),
            answer_time: lineObj.startTime ? 
                new Date(lineObj.startTime).toISOString().slice(0, 19).replace('T', ' ') : null,
            end_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
            duration: lineObj.startTime ? Math.floor((Date.now() - lineObj.startTime.getTime()) / 1000) : 0,
            ring_time: 0,
            terminated_by: 'caller',
            reason_code: 200,
            reason_text: 'Normal',
            session_id: lineObj.callId || `call_${Date.now()}`,
            with_video: 0
        };
        
        console.log('📞 Enhanced call record to save:', callRecord);
        
        // Only save if we have at least a valid caller or callee
        if (callRecord.caller !== 'unknown' || callRecord.callee !== 'unknown') {
            fetch("https://bkpmanual.bitnexdial.com:3000/api/save-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(callRecord)
            })
            .then(res => res.json())
            .then(response => {
                console.log('✅ Call record saved successfully:', response);
            })
            .catch(error => {
                console.error('❌ Failed to save call record:', error);
            });
        } else {
            console.warn('⚠️ Skipping call record save - no valid caller/callee information');
        }
        
    } catch (error) {
        console.error('❌ Error in enhanced call record saving:', error);
    }
    
    this.cleanupSession(lineObj);
    window.dispatchEvent(new Event('globalCallEnd'));

    window.dispatchEvent(new CustomEvent('callTerminated', {
        detail: {
            lineNumber: lineObj.LineNumber, 
            callId: lineObj.callId,
            duration: lineObj.startTime ? (lineObj.endTime - lineObj.startTime.getTime()) / 1000 : 0
        }
    }));
}

    updateCallStatus(lineNumber, status) {
        window.updateCallStatus?.(lineNumber, status);
        const lineObj = window.Lines?.[lineNumber - 1];
        if (lineObj) { lineObj.status = status; }
    }

    startCallTimer(lineObj) {
        if (!lineObj.startTime || lineObj.callTimer) return;
        const updateTimer = () => {
            const duration = Math.floor((new Date() - lineObj.startTime) / 1000);
            const formatted = this.formatDuration(duration);
            const timerElement = document.getElementById(`line-${lineObj.LineNumber}-timer`);
            if (timerElement) {
                timerElement.textContent = formatted;
                timerElement.style.display = 'block';
            }
            window.dispatchEvent(new CustomEvent('callTimerUpdate', { detail: { lineNumber: lineObj.LineNumber, duration, formatted } }));
        };
        updateTimer();
        lineObj.callTimer = setInterval(updateTimer, 1000);
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) { return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
        else { return `${mins}:${secs.toString().padStart(2, '0')}`; }
    }

    cleanupSession(lineObj) {
        try {
            console.log(`🧹 Enhanced cleanup for line ${lineObj.LineNumber}`);

            // Stop call timer
            if (lineObj.callTimer) {
                clearInterval(lineObj.callTimer);
                lineObj.callTimer = null;
                console.log(`⏱️ Timer cleared for line ${lineObj.LineNumber}`);
            }

            // Remove audio elements
            const audioElement = document.getElementById(`line-${lineObj.LineNumber}-remoteAudio`);
            if (audioElement) {
                audioElement.srcObject = null;
                audioElement.remove();
                console.log(`🎵 Audio element removed for line ${lineObj.LineNumber}`);
            }
            if (window.Lines && window.Lines[lineObj.LineNumber - 1]) {
                window.Lines[lineObj.LineNumber - 1].SipSession = null;
                window.Lines[lineObj.LineNumber - 1].status = 'terminated';
            }
            // Close peer connection if exists
            if (lineObj.SipSession?.sessionDescriptionHandler?.peerConnection) {
                const pc = lineObj.SipSession.sessionDescriptionHandler.peerConnection;
                if (pc.connectionState !== 'closed') {
                    pc.close();
                    console.log(`🔌 Peer connection closed for line ${lineObj.LineNumber}`);
                }
            }

            // Clear the line using the global function
            window.clearLine?.(lineObj.LineNumber - 1);

            console.log(`✅ Cleanup completed for line ${lineObj.LineNumber}`);

        } catch (error) {
            console.error(`❌ Error during enhanced cleanup for line ${lineObj.LineNumber}:`, error);
        }
    }

    loadCallHistory() {
        try {
            const history = localStorage.getItem('callHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('❌ Failed to load call history:', error);
            return [];
        }
    }

    addToCallHistory(call) {
        this.callHistory.unshift({ ...call, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` });
        if (this.callHistory.length > 100) { this.callHistory = this.callHistory.slice(0, 100); }
        try { localStorage.setItem('callHistory', JSON.stringify(this.callHistory)); }
        catch (error) { console.error('❌ Failed to save call history:', error); }
    }
}
window.checkMaxContactsStatus = function() {
    const state = window.registrationState || 'Unknown';
    const isRegistered = window.isRegistered || false;
    
    console.log('📞 Registration Status:', {
        state: state,
        isRegistered: isRegistered,
        isMaxContacts: state === 'Max Contacts Reached'
    });
    
    return {
        isMaxContacts: state === 'Max Contacts Reached',
        isRegistered: isRegistered,
        state: state
    };
};


class SimplifiedPhoneSystemWithAutoConference {
    constructor() {
        this.conferenceManager = new FixedConferenceManager();

        this.sipUserAgent = null;
        this.callManager = null;
        this.initialized = false;
        this.config = null;
    }
    ///////////////////////////////
    async transferCallToMe(sourceLineNumber, targetExtension = null) {
        try {
            console.log(`🔄 Transferring call from line ${sourceLineNumber} to me`);

            // Get my extension from localStorage
            const myExtension = targetExtension || localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
            if (!myExtension) {
                throw new Error('Cannot determine my extension number');
            }

            // Find the active line with a call
            const sourceLineObj = window.Lines?.[sourceLineNumber - 1];
            if (!sourceLineObj?.SipSession) {
                throw new Error(`No active session on line ${sourceLineNumber}`);
            }

            console.log(`📞➡️ Transferring call to extension: ${myExtension}`);

            // Use SIP REFER to transfer the call
            const targetURI = SIP.UserAgent.makeURI(`sip:${myExtension}@${window.SipDomain}`);
            if (!targetURI) {
                throw new Error('Invalid target extension');
            }

            // Perform the transfer
            await sourceLineObj.SipSession.refer(targetURI);
            console.log(`✅ Call transferred successfully to ${myExtension}`);

            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('callTransferred', {
                detail: {
                    fromLine: sourceLineNumber,
                    toExtension: myExtension,
                    type: 'direct'
                }
            }));

            return true;
        } catch (error) {
            console.error(`❌ Failed to transfer call:`, error);
            throw error;
        }
    }


    //////////////conference
    async startInstantConference(participantNumber) {
        try {
            console.log(`🚀 Starting instant conference with ${participantNumber}`);

            if (!window.isRegistered) {
                throw new Error('Not registered to SIP server');
            }

            // Validate participant number
            if (!participantNumber || participantNumber.trim() === '') {
                throw new Error('Please enter a valid participant number');
            }

            const cleanNumber = participantNumber.replace(/[^\d]/g, '');
            if (cleanNumber.length < 7) {
                throw new Error('Please enter a valid phone number');
            }

            // Check if conference rooms are available
            const availableRooms = this.conferenceManager.getAvailableRoomsCount();
            if (availableRooms === 0) {
                throw new Error('No conference rooms available. Please try again later.');
            }

            // Create and start conference
            const conferenceId = await this.conferenceManager.createAutoConference(participantNumber);

            console.log(`✅ Instant conference started: ${conferenceId}`);
            return conferenceId;

        } catch (error) {
            console.error('❌ Failed to start instant conference:', error);
            throw error;
        }
    }

    // Add participant to existing conference
    async addParticipant(lineNumber, participantNumber) {
        try {
            console.log(`👥 Starting conference with participant ${participantNumber} from line ${lineNumber}`);

            // Use the enhanced conference manager to start an instant conference
            const conferenceId = await this.conferenceManager.createAutoConference(participantNumber, lineNumber);

            console.log(`✅ Conference started: ${conferenceId}`);
            return conferenceId;

        } catch (error) {
            console.error(`❌ Failed to add participant:`, error);
            throw error;
        }
    }

    // End active conference
    async endActiveConference(conferenceId) {
        return this.conferenceManager.endConference(conferenceId);
    }

    // Get conference info
    getConferenceInfo(conferenceId) {
        return this.conferenceManager.getConferenceStatus(conferenceId);
    }
    /////////////conference

    async initialize() {
        try {
            console.log('🚀 Initializing Simplified Phone System v4.1...');
            this.checkBrowserCompatibility();
            this.sipUserAgent = new SimplifiedSipUserAgent();
            this.callManager = new SimplifiedCallManager();
            await this.loadConfiguration();
            this.initializeLines();
            this.setupGlobalAPI();

            // ✅ REMOVED: startPreWarmingProcess call that was causing the second error

            if (this.config?.isValid) {
                setTimeout(() => this.startConnection(), 1000);
            } else {
                console.warn('⚠️ SIP configuration incomplete');
                this.showConfigurationHelp();
            }
            this.initialized = true;
            window.dispatchEvent(new Event('phoneSystemReady'));
        } catch (error) {
            console.error('❌ Failed to initialize phone system:', error);
            throw error;
        }
    }

    checkBrowserCompatibility() {
        const required = {
            'WebRTC': !!window.RTCPeerConnection, 'Web Audio': !!window.AudioContext || !!window.webkitAudioContext,
            'Media Devices': !!navigator.mediaDevices?.getUserMedia, 'WebSocket': !!window.WebSocket, 'Promises': !!window.Promise
        };
        const missing = Object.entries(required).filter(([, supported]) => !supported).map(([feature]) => feature);
        if (missing.length > 0) { throw new Error(`Browser missing required features: ${missing.join(', ')}`); }
    }

    async loadConfiguration() {
        window.refreshConfiguration?.();
        this.config = window.validateSipConfiguration?.();
        if (this.config?.isValid) {
            console.log('✅ Configuration loaded:', {
                domain: this.config.config.domain, username: this.config.config.username, server: this.config.config.webSocketUri
            }
        );
        }
    }

    initializeLines() {
        const lineCount = 6;
        window.Lines = [];
        for (let i = 0; i < lineCount; i++) {
            window.Lines[i] = {
                LineNumber: i + 1, IsSelected: false, SipSession: null, CallerIDNumber: null, CallerIDName: null,
                direction: null, startTime: null, endTime: null, callTimer: null, isOnHold: false, isMuted: false, status: 'Idle',
                conferenceParticipants: [] // Add this line
            };
        }
    }

    setupGlobalAPI() {
        window.phoneSystem = this;
        window.startSipConnection = () => this.startConnection();
        window.stopSipConnection = () => this.stopConnection();
        window.makeCall = async function (number, options = {}) {
            return await window.phoneManager.makeCall(number, options);
        };
        window.isPhoneSystemReady = function () {
            return window.phoneManager.isInitialized;
        };
        window.getPhoneSystemStatus = function () {
            return window.phoneManager.getStatus();
        };

        window.forcePhoneSystemReInit = async function () {
            console.log('🔄 Force reinitializing phone system...');
            window.phoneManager.isInitialized = false;
            window.phoneManager.isInitializing = false;

            try {
                await window.phoneManager.ensureInitialized();
                return true;
            } catch (error) {
                console.error('❌ Force reinitialization failed:', error);
                return false;
            }
        };


        window.answerCall = (lineNumber) => this.answerCall(lineNumber);
        window.rejectCall = (lineNumber) => this.rejectCall(lineNumber);
        window.endCall = (lineNumber) => this.endCall(lineNumber);
        window.holdCall = (lineNumber) => this.holdCall(lineNumber);
        window.unholdCall = (lineNumber) => this.unholdCall(lineNumber);
        window.muteCall = (lineNumber) => this.muteCall(lineNumber);
        window.unmuteCall = (lineNumber) => this.unmuteCall(lineNumber);
        window.transferCall = (lineNumber, target) => this.transferCall(lineNumber, target);
        window.sendDTMF = (lineNumber, tones) => this.sendDTMF(lineNumber, tones);
        window.getSipStatus = () => this.getStatus();
        window.getLineStatus = (lineNumber) => this.getLineStatus(lineNumber);
        window.updateCallStatus = (lineNumber, status) => this.updateCallStatus(lineNumber, status);
        window.clearLine = (lineIndex) => this.clearLine(lineIndex);
        window.DialByLine = (type, lineNumber, number) => this.makeCall(number, { lineNumber });
        window.AnswerAudioCall = (lineNumber) => this.answerCall(lineNumber);
        window.RejectCall = (lineNumber) => this.rejectCall(lineNumber);
        window.cancelSession = (lineNumber) => this.endCall(lineNumber);
        window.endSession = (lineNumber) => this.endCall(lineNumber);
        // Conference functions
        window.AddParticipant = (lineNumber, participantNumber) => this.addParticipant(lineNumber, participantNumber);
        window.MergeConference = (hostLine, participantLine) => this.mergeConference(hostLine, participantLine);
        window.RemoveParticipant = (hostLine, participantLine) => this.removeParticipant(hostLine, participantLine);
        window.GetConferenceInfo = (lineNumber) => this.getConferenceInfo(lineNumber);
        window.createConference = (hostLine, participantLine) => this.conferenceManager.createConference(hostLine, participantLine);
        window.endConference = (confId) => this.conferenceManager.endConference(confId);
        window.isInConference = (lineNum) => this.conferenceManager.isInConference(lineNum);
        window.startInstantConference = (participantNumber) => this.startInstantConference(participantNumber);
        window.addConferenceParticipant = (confId, number) => this.addParticipantToActiveConference(confId, number);
        window.endActiveConference = (confId) => this.endActiveConference(confId);
        window.getConferenceInfo = (confId) => this.getConferenceInfo(confId);
        window.getActiveConferences = () => this.conferenceManager.getAllActiveConferences();
        window.getAvailableRooms = () => this.conferenceManager.getAvailableRoomsCount();


        // ===== MISSING LINES API SETUP =====
        window.Lines = window.Lines || [];

        window.getActiveLineNum = () => {
            if (window.Lines && Array.isArray(window.Lines)) {
                for (let i = 0; i < window.Lines.length; i++) {
                    const line = window.Lines[i];
                    if (line && line.SipSession) {
                        // Check session state more carefully
                        const sessionState = line.SipSession.state;
                        const sessionStatus = line.SipSession.status;

                        console.log(`🔍 Line ${i} check: state=${sessionState}, status=${sessionStatus}`);

                        // Only consider truly active sessions
                        if (sessionState && sessionState !== 'Terminated' && sessionState !== 'Terminating') {
                            console.log(`✅ Found active session on line ${i}`);
                            return i;
                        }
                    }
                }
            }
            console.log(`❌ No active sessions found`);
            return -1;
        };

        window.FindLineByNumber = (lineNumber) => {
            if (window.Lines && Array.isArray(window.Lines) && lineNumber >= 0 && lineNumber < window.Lines.length) {
                return window.Lines[lineNumber];
            }
            return null;
        };

        // ===== INCOMING CALL POPUP SETUP =====
        // This is what was missing! Your IncomingCallAlert component expects these functions
        // window.showGlobalIncomingCall = null; // Will be set by IncomingCallAlert component
        // window.closeGlobalIncomingCall = null; // Will be set by IncomingCallAlert component
        //window._currentIncomingSession = null;

        //updated 02-07-2025 Wednesday comment all three

    }

    async startConnection() {
        try {
            console.log('🚀 Starting SIP connection...');
            await window.detectAudioDevices?.();
            await this.sipUserAgent.initialize();
            window.sipUserAgent = this.sipUserAgent;
            window.userAgent = this.sipUserAgent.userAgent;
            return true;
        } catch (error) {
            console.log('🚀 Failed to start SIP connection...');
            console.error('❌ Failed to start connection:', error);
            window.dispatchEvent(new CustomEvent('sipConnectionError', { detail: { error: error.message } }));
            return false;
        }
    }

      
    

    async stopConnection() {
        try {
            console.log('🛑 Stopping SIP connection...');
            for (let i = 0; i < window.Lines.length; i++) {
                if (window.Lines[i].SipSession) { await this.endCall(i + 1); }
            }
            this.sipUserAgent?.cleanup();
            window.registrationState = 'Stopped';
            window.isRegistered = false;
            window.updateRegistrationStatus?.();
            console.log('✅ SIP connection stopped');
            return true;
        } catch (error) {
            console.error('❌ Error stopping connection:', error);
            return false;
        }
    }

    async makeCall(number, options = {}) { return this.callManager.makeSimpleCall(number, options); }

    async answerCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) { throw new Error(`No incoming call on line ${lineNumber}`); }
            const acceptOptions = { sessionDescriptionHandlerOptions: { constraints: this.sipUserAgent.mediaManager.getBasicConstraints() } };
            await lineObj.SipSession.accept(acceptOptions);
            console.log(`✅ Call answered on line ${lineNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to answer call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async rejectCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) { throw new Error(`No incoming call on line ${lineNumber}`); }
            await lineObj.SipSession.reject({ statusCode: 486, reasonPhrase: 'Busy Here' });
            console.log(`✅ Call rejected on line ${lineNumber}`);
            this.callManager.cleanupSession(lineObj);
            return true;
        } catch (error) {
            console.error(`❌ Failed to reject call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async endCall(lineNumber) {
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
                this.callManager.cleanupSession(lineObj);
                return true;
            }

            // End the session based on its current state
            try {
                if (currentState === 'Initial' && typeof session.cancel === 'function') {
                    console.log(`🚫 Cancelling initial session on line ${lineNumber}`);
                    await session.cancel();
                } else if (typeof session.terminate === 'function') {
                    console.log(`🛑 Terminating session on line ${lineNumber}`);
                    await session.terminate();
                } else if (typeof session.bye === 'function') {
                    console.log(`👋 Sending BYE on line ${lineNumber}`);
                    await session.bye();
                } else if (typeof session.reject === 'function') {
                    console.log(`❌ Rejecting session on line ${lineNumber}`);
                    await session.reject();
                } else {
                    console.warn(`⚠️ No termination method available for line ${lineNumber}`);
                }
            } catch (sessionError) {
                console.warn(`⚠️ Session termination error on line ${lineNumber}:`, sessionError);
                // Continue with cleanup even if termination failed
            }

            // Always clean up after attempting termination
            this.callManager.cleanupSession(lineObj);

            console.log(`✅ Call ended successfully on line ${lineNumber}`);
            return true;

        } catch (error) {
            console.error(`❌ Failed to end call on line ${lineNumber}:`, error);

            // Force cleanup even if there was an error
            const lineObj = window.Lines?.[lineNumber - 1];
            if (lineObj) {
                this.callManager.cleanupSession(lineObj);
            }

            return false;
        }
    }

    async holdCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active call on line ${lineNumber}`);
            }

            // Try different hold methods based on SIP.js version
            if (lineObj.SipSession.sessionDescriptionHandler?.hold) {
                await lineObj.SipSession.sessionDescriptionHandler.hold();
            } else if (lineObj.SipSession.hold) {
                await lineObj.SipSession.hold();
            } else {
                // Use re-invite method
                const options = { sessionDescriptionHandlerOptions: { hold: true } };
                await lineObj.SipSession.invite(options);
            }

            lineObj.isOnHold = true;
            console.log(`⏸️ Call held on line ${lineNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to hold call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async unholdCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active call on line ${lineNumber}`);
            }

            console.log(`▶️ Attempting to unhold call on line ${lineNumber}`);

            // Try different unhold methods based on SIP.js version and availability
            let success = false;

            // Method 1: Use sessionDescriptionHandler.unhold()
            if (lineObj.SipSession.sessionDescriptionHandler?.unhold) {
                try {
                    await lineObj.SipSession.sessionDescriptionHandler.unhold();
                    success = true;
                    console.log('✅ Unhold successful via sessionDescriptionHandler.unhold()');
                } catch (error) {
                    console.warn('⚠️ sessionDescriptionHandler.unhold() failed:', error);
                }
            }

            // Method 2: Use re-invite without hold flag
            if (!success && lineObj.SipSession.invite) {
                try {
                    const options = {
                        sessionDescriptionHandlerOptions: {
                            constraints: this.sipUserAgent.mediaManager.getBasicConstraints(),
                            hold: false
                        }
                    };
                    await lineObj.SipSession.invite(options);
                    success = true;
                    console.log('✅ Unhold successful via re-invite');
                } catch (error) {
                    console.warn('⚠️ Re-invite unhold failed:', error);
                }
            }

            // Method 3: Direct peer connection manipulation
            if (!success && lineObj.SipSession.sessionDescriptionHandler?.peerConnection) {
                try {
                    const pc = lineObj.SipSession.sessionDescriptionHandler.peerConnection;
                    const localStreams = pc.getLocalStreams ? pc.getLocalStreams() : [];

                    if (localStreams.length > 0) {
                        // Re-enable audio tracks
                        localStreams.forEach(stream => {
                            stream.getAudioTracks().forEach(track => {
                                track.enabled = true;
                            });
                        });
                    }

                    // Create new offer without hold
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: false
                    });

                    await pc.setLocalDescription(offer);
                    success = true;
                    console.log('✅ Unhold successful via direct peer connection');
                } catch (error) {
                    console.warn('⚠️ Direct peer connection unhold failed:', error);
                }
            }

            if (success) {
                lineObj.isOnHold = false;
                console.log(`✅ Call successfully unheld on line ${lineNumber}`);

                // Update UI if function exists
                if (window.updateLineScroll) {
                    window.updateLineScroll(lineNumber);
                }

                // Dispatch event for UI updates
                window.dispatchEvent(new CustomEvent('callUnheld', {
                    detail: { lineNumber: lineNumber }
                }));

                return true;
            } else {
                throw new Error('All unhold methods failed');
            }

        } catch (error) {
            console.error(`❌ Failed to unhold call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async muteCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession?.sessionDescriptionHandler?.peerConnection) {
                throw new Error(`No active call on line ${lineNumber}`);
            }
            const pc = lineObj.SipSession.sessionDescriptionHandler.peerConnection;
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track?.kind === 'audio') {
                    sender.track.enabled = false;
                }
            });
            lineObj.isMuted = true;
            console.log(`🔇 Call muted on line ${lineNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to mute call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async unmuteCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession?.sessionDescriptionHandler?.peerConnection) {
                throw new Error(`No active call on line ${lineNumber}`);
            }
            const pc = lineObj.SipSession.sessionDescriptionHandler.peerConnection;
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track?.kind === 'audio') {
                    sender.track.enabled = true;
                }
            });
            lineObj.isMuted = false;
            console.log(`🔊 Call unmuted on line ${lineNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to unmute call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async transferCall(lineNumber, targetNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active call on line ${lineNumber}`);
            }
            const targetURI = SIP.UserAgent.makeURI(`sip:${targetNumber}@${window.SipDomain}`);
            if (!targetURI) {
                throw new Error('Invalid transfer target');
            }
            await lineObj.SipSession.refer(targetURI);
            console.log(`📞➡️ Call transferred from line ${lineNumber} to ${targetNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to transfer call:`, error);
            return false;
        }
    }


    // updated 02-07-2025 Wednesday start
    async sendDTMF(lineNumber, tones) {
        try {
            console.log(`📞 PhoneSystem.sendDTMF called: line=${lineNumber}, tones=${tones}`);

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                console.error(`❌ No active session on line ${lineNumber}`);
                return false;
            }

            const session = lineObj.SipSession;
            console.log(`📞 Session state: ${session.state}, status: ${session.status || 'undefined'}`);

            // Check if session is in a state that supports DTMF
            if (!['Established', 'Confirmed'].includes(session.state)) {
                console.error(`❌ Session not in correct state for DTMF: ${session.state}`);
                return false;
            }

            let dtmfSent = false;

            // Method 1: Try sessionDescriptionHandler.sendDtmf (SIP.js standard)
            if (session.sessionDescriptionHandler?.sendDtmf &&
                typeof session.sessionDescriptionHandler.sendDtmf === 'function') {
                try {
                    console.log(`📞 Trying sessionDescriptionHandler.sendDtmf("${tones}")`);
                    session.sessionDescriptionHandler.sendDtmf(tones, {
                        duration: 100,
                        interToneGap: 50
                    });
                    console.log(`✅ DTMF sent via sessionDescriptionHandler.sendDtmf: ${tones}`);
                    dtmfSent = true;
                } catch (error) {
                    console.warn(`⚠️ sessionDescriptionHandler.sendDtmf failed:`, error);
                }
            }

            // Method 2: Try session.sendDTMF
            if (!dtmfSent && session.sendDTMF && typeof session.sendDTMF === 'function') {
                try {
                    console.log(`📞 Trying session.sendDTMF("${tones}")`);
                    session.sendDTMF(tones);
                    console.log(`✅ DTMF sent via session.sendDTMF: ${tones}`);
                    dtmfSent = true;
                } catch (error) {
                    console.warn(`⚠️ session.sendDTMF failed:`, error);
                }
            }

            // Method 3: Try session.dtmf
            if (!dtmfSent && session.dtmf && typeof session.dtmf === 'function') {
                try {
                    console.log(`📞 Trying session.dtmf("${tones}")`);
                    session.dtmf(tones);
                    console.log(`✅ DTMF sent via session.dtmf: ${tones}`);
                    dtmfSent = true;
                } catch (error) {
                    console.warn(`⚠️ session.dtmf failed:`, error);
                }
            }

            // Method 4: Try WebRTC RTCDTMFSender (direct WebRTC approach)
            if (!dtmfSent && session.sessionDescriptionHandler?.peerConnection) {
                try {
                    console.log(`📞 Trying WebRTC RTCDTMFSender approach`);
                    const pc = session.sessionDescriptionHandler.peerConnection;
                    const senders = pc.getSenders();

                    for (const sender of senders) {
                        if (sender.track && sender.track.kind === 'audio' && sender.dtmf) {
                            console.log(`📞 Found audio sender with DTMF capability`);
                            sender.dtmf.insertDTMF(tones, 100, 50); // duration: 100ms, gap: 50ms
                            console.log(`✅ DTMF sent via WebRTC RTCDTMFSender: ${tones}`);
                            dtmfSent = true;
                            break;
                        }
                    }

                    if (!dtmfSent) {
                        console.warn(`⚠️ No audio sender with DTMF capability found`);
                    }
                } catch (error) {
                    console.warn(`⚠️ WebRTC RTCDTMFSender failed:`, error);
                }
            }

            // Method 5: Try SIP INFO method as fallback
            if (!dtmfSent && session.info && typeof session.info === 'function') {
                try {
                    console.log(`📞 Trying SIP INFO method for DTMF`);
                    for (const digit of tones) {
                        await session.info({
                            headers: {
                                'Content-Type': 'application/dtmf-relay'
                            },
                            body: `Signal=${digit}\r\nDuration=100\r\n`
                        });
                    }
                    console.log(`✅ DTMF sent via SIP INFO: ${tones}`);
                    dtmfSent = true;
                } catch (error) {
                    console.warn(`⚠️ SIP INFO method failed:`, error);
                }
            }

            if (!dtmfSent) {
                console.error('❌ All DTMF methods failed - DTMF not supported on this session');
                return false;
            }

            return true;

        } catch (error) {
            console.error('❌ DTMF send failed:', error); //updated 02-07-2025 Wednesday
            return false;
        }
    }
    // updated 02-07-2025 Wednesdayend end





    async addParticipant(lineNumber, participantNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active session on line ${lineNumber}`);
            }

            console.log(`👥 Adding participant ${participantNumber} to conference on line ${lineNumber}`);

            // Clean the participant number
            const cleanNumber = participantNumber.replace(/[^\d]/g, '');
            const formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`;

            // Create a new call to the participant - DON'T start on hold
            const participantLine = await this.makeCall(formattedNumber, {
                startOnHold: false, // ✅ This is key - don't start on hold
                customHeaders: [`X-Conference-Host: line-${lineNumber}`]
            });

            if (participantLine) {
                // Store conference relationship
                if (!lineObj.conferenceParticipants) {
                    lineObj.conferenceParticipants = [];
                }
                lineObj.conferenceParticipants.push({
                    number: participantNumber,
                    lineNumber: participantLine,
                    status: 'connecting'
                });

                console.log(`✅ Participant ${participantNumber} added on line ${participantLine}`);

                // Wait for the call to be established, then merge
                setTimeout(async () => {
                    try {
                        await this.mergeConference(lineNumber, participantLine);
                    } catch (error) {
                        console.error('❌ Auto-merge failed:', error);
                    }
                }, 3000);

                return participantLine;
            }

            throw new Error('Failed to create participant call');
        } catch (error) {
            console.error(`❌ Failed to add participant:`, error);
            throw error;
        }
    }

    async mergeConference(hostLineNumber, participantLineNumber) {
        try {
            const hostLine = window.Lines?.[hostLineNumber - 1];
            const participantLine = window.Lines?.[participantLineNumber - 1];

            if (!hostLine?.SipSession || !participantLine?.SipSession) {
                throw new Error('Both lines must have active sessions');
            }

            console.log(`🔗 Merging conference: host line ${hostLineNumber} with participant line ${participantLineNumber}`);

            // Ensure both calls are connected
            if (hostLine.SipSession.state !== 'Established' || participantLine.SipSession.state !== 'Established') {
                console.warn('⚠️ One or both calls are not established yet, waiting...');
                await this.waitForCallsToBeEstablished([hostLine, participantLine]);
            }

            // Just unhold both lines - let SIP handle the rest naturally
            if (hostLine.isOnHold) {
                await this.unholdCall(hostLineNumber);
                console.log(`✅ Unhold host line ${hostLineNumber}`);
            }

            if (participantLine.isOnHold) {
                await this.unholdCall(participantLineNumber);
                console.log(`✅ Unhold participant line ${participantLineNumber}`);
            }

            // Create simple conference tracking
            const conferenceId = await this.conferenceManager.createConference(hostLineNumber, participantLineNumber);

            // Update conference status
            const participant = hostLine.conferenceParticipants?.find(p => p.lineNumber === participantLineNumber);
            if (participant) {
                participant.status = 'connected';
                participant.conferenceId = conferenceId;
            }

            console.log(`✅ Conference merged successfully: ${conferenceId}`);

            window.dispatchEvent(new CustomEvent('conferenceMerged', {
                detail: {
                    hostLine: hostLineNumber,
                    participantLine: participantLineNumber,
                    conferenceId: conferenceId
                }
            }));

            return conferenceId;

        } catch (error) {
            console.error(`❌ Failed to merge conference:`, error);
            throw error;
        }
    }

    async removeParticipant(hostLineNumber, participantLineNumber) {
        try {
            console.log(`👋 Removing participant from line ${participantLineNumber}`);

            // End the participant's call
            await this.endCall(participantLineNumber);

            // Remove from host's participant list
            const hostLine = window.Lines?.[hostLineNumber - 1];
            if (hostLine?.conferenceParticipants) {
                hostLine.conferenceParticipants = hostLine.conferenceParticipants.filter(
                    p => p.lineNumber !== participantLineNumber
                );
            }

            console.log(`✅ Participant removed from conference`);

            window.dispatchEvent(new CustomEvent('participantRemoved', {
                detail: { hostLine: hostLineNumber, participantLine: participantLineNumber }
            }));

            return true;
        } catch (error) {
            console.error(`❌ Failed to remove participant:`, error);
            throw error;
        }
    }

    getConferenceInfo(lineNumber) {
        const lineObj = window.Lines?.[lineNumber - 1];
        if (!lineObj) return null;

        return {
            lineNumber: lineNumber,
            isHost: !!lineObj.conferenceParticipants,
            participants: lineObj.conferenceParticipants || [],
            participantCount: lineObj.conferenceParticipants?.length || 0
        };
    }

    getStatus() {
        return {
            initialized: this.initialized,
            isRegistered: window.isRegistered || false,
            registrationState: window.registrationState || 'Unknown',
            userAgent: !!this.sipUserAgent?.userAgent,
            hasAudioDevice: window.hasAudioDevice || false,
            activeLines: window.Lines?.filter(line => line.SipSession).length || 0,
            configuration: this.config
        };
    }

    getLineStatus(lineNumber) {
        const lineObj = window.Lines?.[lineNumber - 1];
        if (!lineObj) return null;
        return {
            lineNumber: lineObj.LineNumber,
            isActive: !!lineObj.SipSession,
            status: lineObj.status || 'Idle',
            callerNumber: lineObj.CallerIDNumber,
            callerName: lineObj.CallerIDName,
            direction: lineObj.direction,
            startTime: lineObj.startTime,
            isOnHold: lineObj.isOnHold,
            isMuted: lineObj.isMuted,
            sessionState: lineObj.SipSession?.state
        };
    }

    updateCallStatus(lineNumber, status) {
        const statusElement = document.getElementById(`line-${lineNumber}-msg`);
        if (statusElement) {
            statusElement.textContent = status;
        }
        const lineObj = window.Lines?.[lineNumber - 1];
        if (lineObj) {
            lineObj.status = status;
        }
        window.dispatchEvent(new CustomEvent('callStatusChanged', {
            detail: { lineNumber, status }
        }));
    }

    clearLine(lineIndex) {
        if (lineIndex >= 0 && lineIndex < window.Lines.length) {
            const lineNumber = lineIndex + 1;
            window.Lines[lineIndex] = {
                LineNumber: lineNumber,
                IsSelected: false,
                SipSession: null,
                CallerIDNumber: null,
                CallerIDName: null,
                direction: null,
                startTime: null,
                endTime: null,
                callTimer: null,
                isOnHold: false,
                isMuted: false,
                status: 'Idle'
            };
            console.log(`🧹 Cleared line ${lineNumber}`);
        }
    }

    showConfigurationHelp() {
        console.log('📋 SIP Configuration Required:');
        console.log('Missing:', this.config?.missing);
        console.log('\nTo configure, use:');
        console.log('window.setupSipConfiguration({');
        console.log('  senderPhone: "+1234567890",');
        console.log('  domain: "your.sip.domain",');
        console.log('  sipUsername: "username",');
        console.log('  sipPassword: "password",');
        console.log('  secureWebSocketServer: "wss.server.com",');
        console.log('  webSocketPort: "8089",');
        console.log('  webSocketPath: "/ws"');
        console.log('});');
        console.log('\nOr use quick test: window.setupQuickTest()');
    }
}

window.activeCallMetrics = new Map(); // Track call metrics by line number

function storeCallMetrics(lineNumber, metrics) {
    window.activeCallMetrics.set(lineNumber, {
        ...metrics,
        timestamp: Date.now()
    });
}

function getCallMetrics(lineNumber) {
    const metrics = window.activeCallMetrics.get(lineNumber);
    return metrics || {};
}

function clearCallMetrics(lineNumber) {
    window.activeCallMetrics.delete(lineNumber);
}

// Make these functions globally available
window.storeCallMetrics = storeCallMetrics;
window.getCallMetrics = getCallMetrics;
window.clearCallMetrics = clearCallMetrics;

// ===== ENHANCED GLOBAL FUNCTION FOR REACT COMPONENTS =====
window.getEnhancedCallMetrics = function(lineNumber) {
    const lineObj = window.Lines?.[lineNumber - 1];
    const storedMetrics = getCallMetrics(lineNumber);
    
    return {
        lineNumber: lineNumber,
        callerNumber: storedMetrics?.callerNumber || lineObj?.CallerIDNumber || 'unknown',
        callerName: storedMetrics?.callerName || lineObj?.CallerIDName || 'Unknown',
        direction: storedMetrics?.direction || lineObj?.direction || 'unknown',
        startTime: storedMetrics?.startTime || (lineObj?.startTime ? lineObj.startTime.toISOString() : null),
        callId: storedMetrics?.callId || lineObj?.callId || null
    };
};

// ===== INTERCEPT GLOBAL CALL END EVENTS =====
window.addEventListener('globalCallEnd', function() {
    
    // Find any active lines with stored metrics
    if (window.Lines && Array.isArray(window.Lines)) {
        window.Lines.forEach((line, index) => {
            if (line && line.SipSession && window.activeCallMetrics.has(index + 1)) {
                const metrics = getCallMetrics(index + 1);
                
                // Dispatch enhanced call end event with metrics
                window.dispatchEvent(new CustomEvent('callEndWithMetrics', {
                    detail: {
                        lineNumber: index + 1,
                        callerNumber: metrics.callerNumber,
                        callerName: metrics.callerName,
                        direction: metrics.direction,
                        startTime: metrics.startTime,
                        endTime: new Date().toISOString()
                    }
                }));
                
                // Clean up metrics after event
                clearCallMetrics(index + 1);
            }
        });
    }
});



class FreePBXCompatiblePhoneSystem extends SimplifiedPhoneSystemWithAutoConference {
    constructor() {
        super();
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        this.callCoordination = new Map(); // Track calls for coordination
    }

    async initialize() {
        try {
            this.checkBrowserCompatibility();

            // ✅ Use FreePBX compatible SIP user agent
            this.sipUserAgent = new FreePBXCompatibleSipUserAgent();
            this.callManager = new SimplifiedCallManager();

            await this.loadConfiguration();
            this.initializeLines();
            this.setupGlobalAPI();
            this.setupLocalCallCoordination();

            if (this.config?.isValid) {
                setTimeout(() => this.startConnection(), 1000);
            } else {
                console.warn('⚠️ SIP configuration incomplete');
                this.showConfigurationHelp();
            }

            this.initialized = true;
            window.dispatchEvent(new Event('phoneSystemReady'));
        } catch (error) {
            console.error('❌ Failed to initialize FreePBX compatible phone system:', error);
            throw error;
        }
    }

    setupLocalCallCoordination() {
        // Setup local storage based coordination for same-browser tabs
        window.addEventListener('storage', (event) => {
            // Only handle essential events, ignore cleanup signals
            if (event.key === 'sipConnectionState') {
                // Don't trigger any reconnection logic
            }
        });

        // Setup message channel for same-tab coordination
        this.setupBroadcastChannel();
    }

    setupBroadcastChannel() {
        try {
            this.broadcastChannel = new BroadcastChannel('phone_coordination');
            this.broadcastChannel.onmessage = (event) => {
                this.handleCallCoordinationEvent(event.data);
            };
        } catch (error) {
            console.warn('⚠️ BroadcastChannel not supported, using localStorage only');
        }
    }

    handleCallCoordinationEvent(data) {
        const { action, callId, sessionId, timestamp } = data;

        // Ignore events from this session
        if (sessionId === this.sessionId) return;

        switch (action) {
            case 'call_answered':
                this.handleCallAnsweredElsewhere(callId);
                break;
            case 'call_rejected':
            case 'call_ended':
                this.handleCallEndedElsewhere(callId);
                break;
        }
    }

    broadcastCallEvent(action, callId) {
        const event = {
            action,
            callId,
            sessionId: this.sessionId,
            timestamp: Date.now()
        };

        // Broadcast via BroadcastChannel (same origin, any tab)
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(event);
        }

        // Broadcast via localStorage (cross-tab communication)
        localStorage.setItem('call_coordination', JSON.stringify(event));

        // Clear after broadcast
        setTimeout(() => {
            localStorage.removeItem('call_coordination');
        }, 1000);
    }

async handleIncomingCall(invitation) {
    try {

        const callId = invitation.request.headers['Call-ID'][0].value;
        
        // ✅ ENHANCED: Extract caller number properly
        let callerNumber = 'unknown';
        let callerName = 'Unknown Caller';
        
        // Method 1: From 'From' header URI
        if (invitation.request && invitation.request.from && invitation.request.from.uri) {
            callerNumber = invitation.request.from.uri.user || 'unknown';
            callerName = invitation.request.from.displayName || callerNumber;
        }
        
        // Method 2: Parse from header string if URI method failed
        if (callerNumber === 'unknown' && invitation.request && invitation.request.from) {
            try {
                const fromHeader = invitation.request.from.toString();
                const numberMatch = fromHeader.match(/sip:([^@;]+)@/);
                if (numberMatch && numberMatch[1]) {
                    callerNumber = numberMatch[1];
                }
                
                const nameMatch = fromHeader.match(/"([^"]+)"/);
                if (nameMatch && nameMatch[1]) {
                    callerName = nameMatch[1];
                }
            } catch (parseError) {
                console.warn('⚠️ Error parsing From header:', parseError);
            }
        }
        
        // Format the caller number
        if (callerNumber !== 'unknown') {
            callerNumber = callerNumber.replace(/[^\d+]/g, '');
            if (callerNumber.length === 10) {
                callerNumber = '+1' + callerNumber;
            } else if (callerNumber.length === 11 && callerNumber.startsWith('1')) {
                callerNumber = '+' + callerNumber;
            }
        }


        // ✅ CHECK FOR ACTIVE CALLS - This is the key addition
        const hasActiveCalls = window.callWaitingManager.hasActiveCalls();

        if (hasActiveCalls) {

            // Find available line for waiting call
            let lineIndex = this.findAvailableLine();
            if (lineIndex === null) {
                console.warn("⚠️ No available lines for waiting call");
                lineIndex = 0;
            }
            const lineNumber = lineIndex + 1;

            // Handle as call waiting instead of normal incoming call
            window.callWaitingManager.handleIncomingCallDuringActive(callerNumber, callerName, lineNumber);

            // Still set up the session but don't show main incoming call UI
            const lineObj = this.callManager.setupSimpleLine(lineIndex, invitation, callerNumber, 'inbound');
            lineObj.CallerIDName = callerName;
            lineObj.callId = callId;

            // ✅ STORE CALL METRICS IMMEDIATELY
            storeCallMetrics(lineNumber, {
                callerNumber: callerNumber,
                callerName: callerName,
                callId: callId,
                direction: 'inbound',
                startTime: new Date().toISOString(),
                lineNumber: lineNumber
            });

            this.callManager.setupSimpleSessionHandlers(invitation, lineObj);
            return; // Don't continue with normal incoming call flow
        }

        // Normal incoming call handling when no active calls

        // Store this call for coordination
        this.callCoordination.set(callId, {
            invitation,
            sessionId: this.sessionId,
            status: 'ringing',
            timestamp: Date.now(),
            callerNumber: callerNumber,
            callerName: callerName
        });

        let lineIndex = this.findAvailableLine();
        if (lineIndex === null) {
            console.warn("⚠️ No available lines");
            lineIndex = 0;
            this.clearLine(0);
        }

        const lineNumber = lineIndex + 1;
        const lineObj = this.callManager.setupSimpleLine(lineIndex, invitation, callerNumber, 'inbound');
        lineObj.CallerIDName = callerName;
        lineObj.callId = callId;
        lineObj.sessionId = this.sessionId;

        // ✅ STORE CALL METRICS IMMEDIATELY FOR NORMAL CALLS TOO
        storeCallMetrics(lineNumber, {
            callerNumber: callerNumber,
            callerName: callerName,
            callId: callId,
            direction: 'inbound',
            startTime: new Date().toISOString(),
            lineNumber: lineNumber
        });

        this.callManager.setupSimpleSessionHandlers(invitation, lineObj);

        // Setup auto-coordination cleanup if call is answered elsewhere
        this.setupAutoCleanup(callId, lineObj);

        if (window.showGlobalIncomingCall) {
            window.showGlobalIncomingCall(callerNumber, callerName, lineNumber);
        }

        window._currentIncomingSession = invitation;

        window.dispatchEvent(new CustomEvent('incomingCall', {
            detail: {
                callerNumber,
                callerName,
                lineNumber,
                callId,
                sessionId: this.sessionId
            }
        }));

    } catch (error) {
        console.error("❌ Error handling FreePBX incoming call:", error);
        if (invitation?.reject) {
            invitation.reject({ statusCode: 500, reasonPhrase: "Internal Server Error" });
        }
    }
}

    setupAutoCleanup(callId, lineObj) {
        // Auto-cleanup if call answered elsewhere within 30 seconds
        const cleanupTimer = setTimeout(() => {
            const call = this.callCoordination.get(callId);
            if (call && call.status === 'ringing') {
                this.handleCallAnsweredElsewhere(callId);
            }
        }, 30000);

        lineObj._cleanupTimer = cleanupTimer;
    }

    async answerCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No incoming call on line ${lineNumber}`);
            }

            const callId = lineObj.callId;

            // Update local coordination
            const call = this.callCoordination.get(callId);
            if (call) {
                call.status = 'answered';
                call.answeredBy = this.sessionId;
            }

            // Broadcast that we're answering this call
            this.broadcastCallEvent('call_answered', callId);

            // Clear cleanup timer
            if (lineObj._cleanupTimer) {
                clearTimeout(lineObj._cleanupTimer);
                lineObj._cleanupTimer = null;
            }

            // Answer the call normally
            const acceptOptions = {
                sessionDescriptionHandlerOptions: {
                    constraints: this.sipUserAgent.mediaManager.getBasicConstraints()
                }
            };

            await lineObj.SipSession.accept(acceptOptions);

            return true;
        } catch (error) {
            console.error(`❌ Failed to answer call on line ${lineNumber}:`, error);
            return false;
        }
    }

    async rejectCall(lineNumber) {
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No incoming call on line ${lineNumber}`);
            }

            const callId = lineObj.callId;

            // Broadcast that we're rejecting this call
            this.broadcastCallEvent('call_rejected', callId);

            await lineObj.SipSession.reject({ statusCode: 486, reasonPhrase: 'Busy Here' });

            this.callManager.cleanupSession(lineObj);
            this.callCoordination.delete(callId);

            return true;
        } catch (error) {
            console.error(`❌ Failed to reject call on line ${lineNumber}:`, error);
            return false;
        }
    }

    handleCallAnsweredElsewhere(callId) {
        // Find and cleanup any local sessions for this call
        window.Lines?.forEach((line, index) => {
            if (line.callId === callId && line.SipSession && line.sessionId !== this.sessionId) {

                // Clear cleanup timer
                if (line._cleanupTimer) {
                    clearTimeout(line._cleanupTimer);
                    line._cleanupTimer = null;
                }

                // Don't reject - just cleanup locally (call was answered elsewhere)
                this.callManager.cleanupSession(line);

                // Close incoming call UI
                if (window.closeGlobalIncomingCall) {
                    window.closeGlobalIncomingCall('answered_elsewhere');
                }
            }
        });

        this.callCoordination.delete(callId);
    }

    handleCallEndedElsewhere(callId) {
        this.handleCallAnsweredElsewhere(callId);
    }

    findAvailableLine() {
        const lines = window.Lines || [];
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].SipSession && !lines[i].IsSelected) {
                return i;
            }
        }
        return null;
    }

    cleanup() {
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
        super.cleanup();
    }
}

// Enhanced Transfer Manager Class
class EnhancedTransferManager {
    constructor() {
        this.activeTransfers = new Map();
        this.transferCounter = 0;
    }

    // Start Transfer Session
    startTransferSession(lineNumber) {
        try {

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active session on line ${lineNumber}`);
            }

            // Put call on hold first
            window.phoneSystem.holdCall(lineNumber);

            // Mark transfer as active
            lineObj.transferMode = true;
            lineObj.transferTarget = '';


            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('transferSessionStarted', {
                detail: { lineNumber }
            }));

            return true;
        } catch (error) {
            console.error(`❌ Failed to start transfer session:`, error);
            return false;
        }
    }

    // Cancel Transfer Session
    cancelTransferSession(lineNumber) {
        try {

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj) {
                throw new Error(`Line ${lineNumber} not found`);
            }

            // Clean up any child session
            if (lineObj.childSession) {
                if (lineObj.childSession.state !== 'Terminated') {
                    lineObj.childSession.terminate().catch(console.error);
                }
                lineObj.childSession = null;
            }

            // Resume the original call
            window.phoneSystem.unholdCall(lineNumber);

            // Clear transfer mode
            lineObj.transferMode = false;
            lineObj.transferTarget = '';


            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('transferSessionCancelled', {
                detail: { lineNumber }
            }));

            return true;
        } catch (error) {
            console.error(`❌ Failed to cancel transfer session:`, error);
            return false;
        }
    }

    // Blind Transfer
async blindTransfer(lineNumber, targetNumber) {
    try {
        console.log(`📞➡️ Blind transfer from line ${lineNumber} to ${targetNumber}`);

        // Clean and validate target number
        let cleanTarget = targetNumber.toString().trim();
        
        // Only remove non-digits if it's not a valid number format
        if (!/^\+?[\d\s\-\(\)]+$/.test(cleanTarget)) {
            cleanTarget = cleanTarget.replace(/[^\d]/g, '');
        } else {
            // Keep the original format for proper numbers
            cleanTarget = cleanTarget.replace(/[\s\-\(\)]/g, '');
        }
        
        console.log(`🔍 Original: "${targetNumber}" -> Cleaned: "${cleanTarget}"`);
        
        if (cleanTarget.length < 7) {
            throw new Error(`Invalid target number: "${cleanTarget}" (length: ${cleanTarget.length})`);
        }

        const lineObj = window.Lines?.[lineNumber - 1];
        if (!lineObj?.SipSession) {
            throw new Error(`No active session on line ${lineNumber}`);
        }

        const session = lineObj.SipSession;

        // ✅ CRITICAL FIX: Make sure the call is NOT on hold before transfer
        if (lineObj.isOnHold) {
            console.log('📞 Call is on hold, resuming before transfer...');
            await window.phoneSystem.unholdCall(lineNumber);
            // Wait a moment for the unhold to complete
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // ✅ CRITICAL FIX: Verify session state before transfer
        console.log(`📞 Session state: ${session.state}, Status: ${session.status}`);
        
        // Only proceed if session is in correct state
        if (!['Established', 'Confirmed'].includes(session.state)) {
            throw new Error(`Cannot transfer call in state: ${session.state}. Call must be established.`);
        }

        // Create transfer record
        if (!session.data.transfer) session.data.transfer = [];
        const transferId = session.data.transfer.length;

        session.data.transfer.push({
            type: "Blind",
            to: cleanTarget,
            transferTime: new Date().toISOString(),
            disposition: "refer",
            dispositionTime: new Date().toISOString(),
            accept: {
                complete: null,
                eventTime: null,
                disposition: ""
            }
        });

        // Prepare target URI
        const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${window.SipDomain}`);
        if (!targetURI) {
            throw new Error('Invalid target URI');
        }

        console.log(`🎯 Target URI: sip:${cleanTarget}@${window.SipDomain}`);

        // ✅ ENHANCED: Set up transfer options with better error handling
        const transferOptions = {
            requestDelegate: {
                onAccept: (sip) => {
                    console.log(`✅ Blind transfer accepted to ${cleanTarget}`);

                    // Mark session data
                    session.data.terminateby = "us";
                    session.data.reasonCode = 202;
                    session.data.reasonText = "Transfer";

                    // Update transfer record
                    session.data.transfer[transferId].accept.complete = true;
                    session.data.transfer[transferId].accept.disposition = sip.message.reasonPhrase;
                    session.data.transfer[transferId].accept.eventTime = new Date().toISOString();

                    // Dispatch success event
                    window.dispatchEvent(new CustomEvent('callTransferred', {
                        detail: {
                            fromLine: lineNumber,
                            toNumber: cleanTarget,
                            type: 'blind',
                            success: true
                        }
                    }));

                    // ✅ FIXED: Proper session cleanup without immediate termination
                    setTimeout(() => {
                        // Clean up line object
                        if (lineObj) {
                            lineObj.SipSession = null;
                            lineObj.CallerIDNumber = '';
                            lineObj.CallerIDName = '';
                            lineObj.isActive = false;
                            lineObj.isInUse = false;
                            lineObj.isOnHold = false;
                            lineObj.transferMode = false;
                        }
                        
                        // The session will terminate itself after successful transfer
                        console.log(`📞 Call successfully transferred to ${cleanTarget}`);
                    }, 1000);
                },
                onReject: (sip) => {
                    console.warn(`❌ Blind transfer to ${cleanTarget} rejected:`, sip.message.reasonPhrase);

                    // Update transfer record
                    session.data.transfer[transferId].accept.complete = false;
                    session.data.transfer[transferId].accept.disposition = sip.message.reasonPhrase;
                    session.data.transfer[transferId].accept.eventTime = new Date().toISOString();

                    // Dispatch failure event
                    window.dispatchEvent(new CustomEvent('callTransferFailed', {
                        detail: {
                            fromLine: lineNumber,
                            toNumber: cleanTarget,
                            type: 'blind',
                            reason: sip.message.reasonPhrase
                        }
                    }));

                    // ✅ FIXED: Don't try to unhold if transfer was rejected
                    console.log(`📞 Transfer rejected, keeping call active on line ${lineNumber}`);
                }
            }
        };

        // ✅ CRITICAL: Execute the transfer
        console.log(`📞 Executing REFER to ${cleanTarget}...`);
        await session.refer(targetURI, transferOptions);

        console.log(`✅ Blind transfer REFER sent successfully to ${cleanTarget}`);
        return true;

    } catch (error) {
        console.error(`❌ Blind transfer failed:`, error);
        
        // ✅ ENHANCED: Better error recovery
        try {
            const lineObj = window.Lines?.[lineNumber - 1];
            if (lineObj && lineObj.isOnHold) {
                // If transfer failed and call is on hold, resume it
                await window.phoneSystem.unholdCall(lineNumber);
            }
        } catch (recoveryError) {
            console.warn('⚠️ Error in transfer recovery:', recoveryError);
        }
        
        throw error;
    }
}



    // Attended Transfer - Step 1: Call the target
    async attendedTransferCall(lineNumber, targetNumber) {
        try {

            // Clean target number
            const cleanTarget = targetNumber.replace(/[^\d]/g, '');
            if (cleanTarget.length < 7) {
                throw new Error('Invalid target number');
            }

            const lineObj = window.Lines?.[lineNumber - 1];
            if (!lineObj?.SipSession) {
                throw new Error(`No active session on line ${lineNumber}`);
            }

            const session = lineObj.SipSession;

            // Put original call on hold
            await window.phoneSystem.holdCall(lineNumber);

            // Create transfer record
            if (!session.data.transfer) session.data.transfer = [];
            const transferId = session.data.transfer.length;

            session.data.transfer.push({
                type: "Attended",
                to: cleanTarget,
                transferTime: new Date().toISOString(),
                disposition: "invite",
                dispositionTime: new Date().toISOString(),
                accept: {
                    complete: null,
                    eventTime: null,
                    disposition: ""
                }
            });

            // Create new call to transfer target
            const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${window.SipDomain}`);
            if (!targetURI) {
                throw new Error('Invalid target URI');
            }

            // Set up SDP options for the consultation call
            const spdOptions = {
                earlyMedia: true,
                sessionDescriptionHandlerOptions: {
                    constraints: window.sipUserAgent.mediaManager.getBasicConstraints()
                },
                extraHeaders: [
                    'X-Transfer-Consultation: true',
                    `X-Original-Line: ${lineNumber}`
                ]
            };

            // Create the consultation call
            const consultationSession = new SIP.Inviter(window.sipUserAgent.userAgent, targetURI, spdOptions);
            consultationSession.data = {
                isConsultation: true,
                originalLineNumber: lineNumber,
                transferId: transferId
            };

            // Store child session reference
            session.childSession = consultationSession;
            lineObj.childSession = consultationSession;

            // Set up consultation session handlers
            this.setupConsultationSessionHandlers(consultationSession, lineNumber, transferId, cleanTarget);

            // Start the consultation call
            await consultationSession.invite();


            // Dispatch event
            window.dispatchEvent(new CustomEvent('attendedTransferStarted', {
                detail: {
                    fromLine: lineNumber,
                    toNumber: cleanTarget,
                    consultationSession: consultationSession
                }
            }));

            return consultationSession;

        } catch (error) {
            console.error(`❌ Attended transfer failed:`, error);
            // Resume original call on failure
            window.phoneSystem.unholdCall(lineNumber);
            throw error;
        }
    }

    // Setup handlers for consultation session
    setupConsultationSessionHandlers(consultationSession, originalLineNumber, transferId, targetNumber) {
        const originalLineObj = window.Lines?.[originalLineNumber - 1];
        const originalSession = originalLineObj?.SipSession;

        if (consultationSession.stateChange?.addListener) {
            consultationSession.stateChange.addListener((newState) => {

                switch (newState) {
                    case 'Established':

                        // Update transfer record
                        if (originalSession?.data?.transfer?.[transferId]) {
                            originalSession.data.transfer[transferId].disposition = "accepted";
                            originalSession.data.transfer[transferId].dispositionTime = new Date().toISOString();
                        }

                        // Dispatch event for UI to show transfer completion options
                        window.dispatchEvent(new CustomEvent('consultationEstablished', {
                            detail: {
                                originalLine: originalLineNumber,
                                consultationSession: consultationSession,
                                targetNumber: targetNumber
                            }
                        }));
                        break;

                    case 'Terminated':

                        // Clean up references
                        if (originalLineObj) {
                            originalLineObj.childSession = null;
                        }
                        if (originalSession) {
                            originalSession.childSession = null;
                        }

                        // Resume original call
                        const waitForReinviteComplete = async (session, timeout = 5000) => {
                            const start = Date.now();
                            while (Date.now() - start < timeout) {
                                if (!session._isReinviting) {
                                    return;
                                }
                                await new Promise(r => setTimeout(r, 200));
                            }
                            console.warn("⚠️ Timeout waiting for reinvite to complete");
                        };

                        this.cleanupConsultation = async function(originalLineNumber) {
                            const originalLineObj = window.Lines?.[originalLineNumber - 1];
                            const originalSession = originalLineObj?.SipSession;

                            if (originalLineObj) {
                                originalLineObj.childSession = null;
                                originalLineObj.transferMode = false;
                            }

                            // Wait for any re-INVITE to complete before unhold
                            if (originalSession) {
                                await waitForReinviteComplete(originalSession);
                            }

                            // Resume original call
                            window.phoneSystem.unholdCall(originalLineNumber);
                        };

                        // Dispatch event
                        window.dispatchEvent(new CustomEvent('consultationTerminated', {
                            detail: {
                                originalLine: originalLineNumber,
                                targetNumber: targetNumber
                            }
                        }));
                        break;
                }
            });
        }

        // Set up session delegate
        consultationSession.delegate = {
            onBye: () => {
                this.cleanupConsultation(originalLineNumber);
            }
        };
    }

    // Complete Attended Transfer
    async completeAttendedTransfer(originalLineNumber) {
        try {

            const originalLineObj = window.Lines?.[originalLineNumber - 1];
            const originalSession = originalLineObj?.SipSession;
            const consultationSession = originalLineObj?.childSession;

            if (!originalSession || !consultationSession) {
                throw new Error('Missing original session or consultation session');
            }

            // Create transfer options with Replaces header
            const transferOptions = {
                requestDelegate: {
                    onAccept: (sip) => {

                        // Update transfer record
                        const transferId = originalSession.data.transfer?.length - 1;
                        if (transferId >= 0 && originalSession.data.transfer[transferId]) {
                            originalSession.data.transfer[transferId].accept.complete = true;
                            originalSession.data.transfer[transferId].accept.disposition = sip.message.reasonPhrase;
                            originalSession.data.transfer[transferId].accept.eventTime = new Date().toISOString();
                        }

                        // Mark session for termination
                        originalSession.data.terminateby = "us";
                        originalSession.data.reasonCode = 202;
                        originalSession.data.reasonText = "Attended Transfer";

                        // Dispatch success event
                        window.dispatchEvent(new CustomEvent('attendedTransferCompleted', {
                            detail: {
                                originalLine: originalLineNumber,
                                success: true
                            }
                        }));

                        // End the original session
                        originalSession.bye().catch(console.error);
                        window.phoneSystem.callManager.cleanupSession(originalLineObj);
                    },
                    onReject: (sip) => {
                        console.warn("❌ Attended transfer rejected:", sip.message.reasonPhrase);

                        // Update transfer record
                        const transferId = originalSession.data.transfer?.length - 1;
                        if (transferId >= 0 && originalSession.data.transfer[transferId]) {
                            originalSession.data.transfer[transferId].accept.complete = false;
                            originalSession.data.transfer[transferId].accept.disposition = sip.message.reasonPhrase;
                            originalSession.data.transfer[transferId].accept.eventTime = new Date().toISOString();
                        }

                        // Dispatch failure event
                        window.dispatchEvent(new CustomEvent('attendedTransferFailed', {
                            detail: {
                                originalLine: originalLineNumber,
                                reason: sip.message.reasonPhrase
                            }
                        }));

                        // Keep both sessions active
                    }
                }
            };

            // Execute the transfer using REFER with the consultation session
            await originalSession.refer(consultationSession, transferOptions);
            consultationSession.bye?.().catch(console.error);

            return true;

        } catch (error) {
            console.error(`❌ Failed to complete attended transfer:`, error);
            throw error;
        }
    }

    // Cancel attended transfer and end consultation
    async cancelAttendedTransfer(originalLineNumber) {
        try {

            const originalLineObj = window.Lines?.[originalLineNumber - 1];
            const consultationSession = originalLineObj?.childSession;

            if (consultationSession && consultationSession.state !== 'Terminated') {
                if (consultationSession.state === 'Initial' || consultationSession.state === 'Establishing') {
                    await consultationSession.cancel();
                } else {
                    await consultationSession.bye();
                }
            }


            this.cleanupConsultation(originalLineNumber);

            return true;

        } catch (error) {
            console.error(`❌ Failed to cancel attended transfer:`, error);
            throw error;
        }
    }

    // Cleanup consultation session
    cleanupConsultation(originalLineNumber) {
        const originalLineObj = window.Lines?.[originalLineNumber - 1];

        if (originalLineObj) {
            originalLineObj.childSession = null;
            originalLineObj.transferMode = false;
        }

        // Resume original call
const waitForReinviteComplete = async (session, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (!session._isReinviting) {
            return;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.warn("⚠️ Timeout waiting for reinvite to complete");
};

this.cleanupConsultation = async function(originalLineNumber) {
    const originalLineObj = window.Lines?.[originalLineNumber - 1];
    const originalSession = originalLineObj?.SipSession;

    if (originalLineObj) {
        originalLineObj.childSession = null;
        originalLineObj.transferMode = false;
    }

    // Wait for any re-INVITE to complete before unhold
    if (originalSession) {
        await waitForReinviteComplete(originalSession);
    }

    // Resume original call
    window.phoneSystem.unholdCall(originalLineNumber);
};
    }

    // Quick Find Buddy function (converted from original)
    quickFindBuddy(searchValue) {
        if (!searchValue) return [];

        // This would integrate with your buddy system
        // For now, return empty array as placeholder
        const results = [];

        // You can implement buddy search logic here
        // based on your existing buddy system

        return results;
    }
}
///////////////////////switch device
class CallSwitchingManager {
    constructor() {
        this.switchRequests = new Map();
        this.activeCallMonitor = null;
        this.myDeviceId = this.generateDeviceId();
        this.setupCallMonitoring();
    }

    generateDeviceId() {
        // Create unique device ID based on browser/location
        const userAgent = navigator.userAgent;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `device_${btoa(userAgent).substr(0, 10)}_${random}_${timestamp}`;
    }

    setupCallMonitoring() {
        // Monitor for active calls on other devices with same credentials
        this.activeCallMonitor = setInterval(() => {
            this.checkForSwitchableCall();
        }, 3000); // Check every 3 seconds
    }

    checkForSwitchableCall() {
        // Check if there's an active call on another device that we can switch to
        const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
        if (!myExtension) return;

        // Look for calls that are active on other devices but not on this device
        const hasLocalActiveCall = this.hasActiveCallOnThisDevice();

        if (!hasLocalActiveCall) {
            // Check if there might be a call active elsewhere
            this.checkForExternalActiveCall();
        }
    }

    // Fixed: Add the missing broadcastSwitchAvailability method
    checkForExternalActiveCall() {
        try {
            // Check localStorage for call switch requests from other devices
            const callSwitchData = localStorage.getItem('activeCallOnOtherDevice');
            if (callSwitchData) {
                const data = JSON.parse(callSwitchData);
                const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");

                // Check if this call is for my extension and is recent (within last 30 seconds)
                if (data.extension === myExtension &&
                    data.timestamp > Date.now() - 30000) {

                    // The UI component will pick this up and show the notification
                    return;
                }
            }

            // Also check if we can detect calls via other methods
            this.detectCallsViaAlternativeMethods();

        } catch (error) {
            console.warn('⚠️ Error checking for external active calls:', error);
        }
    }

    detectCallsViaAlternativeMethods() {
        // Alternative method: Try to detect if there are active calls
        // This could involve checking with the SIP server, WebSocket messages, etc.

        const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
        if (!myExtension) return;

        // For now, we'll use a simple localStorage-based approach
        // In a real implementation, you might use WebSocket, Server-Sent Events, or API polling

        try {
            // Check if there's a general "call active" indicator
            const activeCallIndicator = localStorage.getItem(`activeCall_${myExtension}`);
            if (activeCallIndicator) {
                const callData = JSON.parse(activeCallIndicator);

                // If the call is recent and not on this device
                if (callData.timestamp > Date.now() - 60000 &&
                    callData.deviceId !== this.myDeviceId) {


                    // Create a switch opportunity
                    this.createSwitchOpportunity(callData);
                }
            }
        } catch (error) {
            console.warn('⚠️ Error in alternative call detection:', error);
        }
    }

    createSwitchOpportunity(callData) {
        const switchData = {
            extension: callData.extension || localStorage.getItem("SipUsername"),
            callerNumber: callData.callerNumber || 'Unknown',
            callerName: callData.callerName || 'Unknown Caller',
            startTime: callData.startTime || Date.now(),
            deviceName: callData.deviceName || 'Other Device',
            timestamp: Date.now()
        };

        localStorage.setItem('activeCallOnOtherDevice', JSON.stringify(switchData));
    }

    hasActiveCallOnThisDevice() {
        if (!window.Lines || !Array.isArray(window.Lines)) return false;

        return window.Lines.some(line =>
            line && line.SipSession &&
            ['connecting', 'connected', 'confirmed', 'established'].includes(
                (line.SipSession.status || '').toLowerCase()
            )
        );
    }

    // Main method: Switch active call from another device to this device
    async switchCallToThisDevice() {
        try {

            const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
            if (!myExtension) {
                throw new Error('Extension not configured on this device');
            }

            // Clear any existing switch data first
            localStorage.removeItem('activeCallOnOtherDevice');

            // Method 1: Try to pickup any active call for my extension
            const pickupResult = await this.performCallPickup(myExtension);
            if (pickupResult) {
                return true;
            }

            // Method 2: Try to create a new call to "take over"
            const takeoverResult = await this.performCallTakeover(myExtension);
            if (takeoverResult) {
                return true;
            }

            throw new Error('No switchable call found or pickup failed');

        } catch (error) {
            console.error('❌ Failed to switch call:', error);
            throw error;
        }
    }

    // Enhanced SIP Call Pickup
    async performCallPickup(extension) {
        try {

            if (!window.sipUserAgent?.userAgent) {
                console.warn('⚠️ SIP user agent not available');
                return false;
            }

            // FreePBX specific pickup codes and methods
            const freePBXPickupMethods = [
                // Method 1: Standard FreePBX pickup codes
                { uri: `sip:*8${extension}@${window.SipDomain}`, name: 'Directed Pickup (*8)' },
                { uri: `sip:**@${window.SipDomain}`, name: 'Group Pickup (**)' },
                { uri: `sip:*8@${window.SipDomain}`, name: 'General Pickup (*8)' },

                // Method 2: Call the extension directly (for transfer scenario)
                { uri: `sip:${extension}@${window.SipDomain}`, name: 'Direct Call', isDirect: true },

                // Method 3: Park and retrieve (if park is configured)
                { uri: `sip:*70@${window.SipDomain}`, name: 'Park Retrieve' },
            ];

            for (const method of freePBXPickupMethods) {
                try {

                    const result = await this.attemptFreePBXPickup(method, extension);
                    if (result) {
                        return true;
                    }

                } catch (error) {
                    console.warn(`⚠️ ${method.name} failed:`, error.message);
                    continue;
                }
            }

            // Method 4: Try to handle as incoming call scenario
            const incomingResult = await this.handleAsIncomingCall(extension);
            if (incomingResult) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ FreePBX call pickup failed:', error);
            return false;
        }
    }

    async attemptFreePBXPickup(method, extension) {
        return new Promise(async (resolve) => {
            try {
                const targetURI = SIP.UserAgent.makeURI(method.uri);
                if (!targetURI) {
                    resolve(false);
                    return;
                }

                const inviterOptions = {
                    earlyMedia: true,
                    sessionDescriptionHandlerOptions: {
                        constraints: window.sipUserAgent.mediaManager.getBasicConstraints()
                    },
                    extraHeaders: [
                        'Call-Info: answer-after=0',
                        'X-Pickup-Extension: ' + extension,
                        'X-FreePBX-Pickup: true',
                        'User-Agent: FreePBX-Switch/1.0'
                    ]
                };

                // For direct calls, add specific headers
                if (method.isDirect) {
                    inviterOptions.extraHeaders.push(
                        'X-Call-Purpose: switch-device',
                        'P-Asserted-Identity: <sip:' + extension + '@' + window.SipDomain + '>'
                    );
                }

                const inviter = new SIP.Inviter(window.sipUserAgent.userAgent, targetURI, inviterOptions);

                // Setup call on available line
                const availableLineNumber = this.findAvailableLine();
                if (!availableLineNumber) {
                    resolve(false);
                    return;
                }

                const lineIndex = availableLineNumber - 1;
                const lineObj = this.setupFreePBXSwitchLine(lineIndex, inviter, extension, method.name);

                let timeoutId;
                let resolved = false;

                // Set up success/failure detection
                const handleEstablished = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                };

                const handleTerminated = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        this.cleanupSwitchedCall(lineObj);
                        resolve(false);
                    }
                };

                // Set up state listeners
                if (inviter.stateChange?.addListener) {
                    inviter.stateChange.addListener((newState) => {

                        if (newState === 'Established') {
                            handleEstablished();
                        } else if (newState === 'Terminated') {
                            handleTerminated();
                        }
                    });
                }

                // Timeout after 5 seconds
                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        if (inviter.state !== 'Terminated') {
                            inviter.cancel().catch(() => { });
                        }
                        this.cleanupSwitchedCall(lineObj);
                        resolve(false);
                    }
                }, 5000);

                // Start the pickup attempt
                await inviter.invite();

            } catch (error) {
                console.warn(`❌ Error in FreePBX pickup attempt:`, error);
                resolve(false);
            }
        });
    }

    // Alternative: Try to takeover by creating a new call
    async performCallTakeover(extension) {
        try {

            // Check if there's information about the call we're trying to take
            const callSwitchData = localStorage.getItem('activeCallOnOtherDevice');
            if (!callSwitchData) {
                return false;
            }

            const callData = JSON.parse(callSwitchData);

            // Try to call the same number that's currently in a call
            if (callData.callerNumber && callData.callerNumber !== 'Unknown') {

                // Use the existing makeCall functionality
                if (window.phoneSystem && window.phoneSystem.makeCall) {
                    const lineNumber = await window.phoneSystem.makeCall(callData.callerNumber, {
                        takeoverCall: true,
                        originalExtension: extension
                    });

                    // if (lineNumber) {
                    //     console.log(`✅ Takeover call initiated on line ${lineNumber}`);
                    //     return true;
                    // }
                }
            }

            return false;
        } catch (error) {
            console.error('❌ Call takeover failed:', error);
            return false;
        }
    }
    setupFreePBXSwitchLine(lineIndex, session, extension, methodName) {
        const lineNumber = lineIndex + 1;
        const lineObj = {
            LineNumber: lineNumber,
            SipSession: session,
            CallerIDNumber: `Switch-${extension}`,
            CallerIDName: `FreePBX Switch (${methodName})`,
            IsSelected: true,
            direction: 'freepbx-switch',
            startTime: new Date(),
            endTime: null,
            callTimer: null,
            isOnHold: false,
            isMuted: false,
            callId: `freepbx-switch-${Date.now()}-${lineNumber}`,
            switchedCall: true,
            freepbxMethod: methodName
        };

        window.Lines[lineIndex] = lineObj;
        session.data = {
            line: lineNumber,
            callerNumber: extension,
            direction: 'freepbx-switch',
            callstart: new Date().toISOString(),
            callId: lineObj.callId,
            switchedCall: true,
            freepbxMethod: methodName
        };

        return lineObj;
    }
    // Setup line for switched call
    setupCallSwitchLine(lineIndex, session, extension) {
        const lineNumber = lineIndex + 1;
        const lineObj = {
            LineNumber: lineNumber,
            SipSession: session,
            CallerIDNumber: 'Switched Call',
            CallerIDName: `Switch from Ext ${extension}`,
            IsSelected: true,
            direction: 'switched',
            startTime: new Date(),
            endTime: null,
            callTimer: null,
            isOnHold: false,
            isMuted: false,
            callId: `switch-${Date.now()}-${lineNumber}`,
            switchedCall: true
        };

        window.Lines[lineIndex] = lineObj;
        session.data = {
            line: lineNumber,
            callerNumber: extension,
            direction: 'switched',
            callstart: new Date().toISOString(),
            callId: lineObj.callId,
            switchedCall: true
        };

        // Setup session handlers
        this.setupSwitchSessionHandlers(session, lineObj);

        return lineObj;
    }

    setupSwitchSessionHandlers(session, lineObj) {
        if (session.stateChange?.addListener) {
            session.stateChange.addListener((newState) => {

                switch (newState) {
                    case "Established":
                        lineObj.startTime = new Date();
                        if (window.updateCallStatus) {
                            window.updateCallStatus(lineObj.LineNumber, 'Call Switched - Connected');
                        }

                        // Clear the switch data
                        localStorage.removeItem('activeCallOnOtherDevice');

                        // Dispatch switch success event
                        window.dispatchEvent(new CustomEvent('callSwitched', {
                            detail: {
                                lineNumber: lineObj.LineNumber,
                                switchedFrom: 'other-device',
                                success: true
                            }
                        }));
                        break;

                    case "Terminated":
                        if (window.updateCallStatus) {
                            window.updateCallStatus(lineObj.LineNumber, 'Call Ended');
                        }
                        this.cleanupSwitchedCall(lineObj);
                        break;
                }
            });
        }

        // Standard session delegate
        session.delegate = {
            onBye: (request) => {
                this.cleanupSwitchedCall(lineObj);
                window.dispatchEvent(new Event('globalCallEnd'));

                try { if (request?.accept) request.accept(); } catch (e) { }
            }
        };
    }

    findAvailableLine() {
        const lines = window.Lines || [];
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].SipSession && !lines[i].IsSelected) {
                return i + 1;
            }
        }
        return null;
    }

    cleanupSwitchedCall(lineObj) {
        try {
            if (lineObj.callTimer) {
                clearInterval(lineObj.callTimer);
                lineObj.callTimer = null;
            }

            const audioElement = document.getElementById(`line-${lineObj.LineNumber}-remoteAudio`);
            if (audioElement) {
                audioElement.srcObject = null;
                audioElement.remove();
            }

            if (window.clearLine) {
                window.clearLine(lineObj.LineNumber - 1);
            }
        } catch (error) {
            console.error('❌ Error cleaning up switched call:', error);
        }
    }

    // Check if there's a call that can be switched
    canSwitchCall() {
        const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
        if (!myExtension) return false;

        // Check if we have an active call locally
        const hasLocalCall = this.hasActiveCallOnThisDevice();

        // If no local call, check if there's a switchable call available
        if (!hasLocalCall) {
            try {
                const callSwitchData = localStorage.getItem('activeCallOnOtherDevice');
                if (callSwitchData) {
                    const data = JSON.parse(callSwitchData);
                    // Check if the call is for my extension and is recent
                    return data.extension === myExtension && data.timestamp > Date.now() - 30000;
                }
            } catch (error) {
                console.warn('⚠️ Error checking switch availability:', error);
            }
        }

        return false;
    }

    cleanup() {
        if (this.activeCallMonitor) {
            clearInterval(this.activeCallMonitor);
            this.activeCallMonitor = null;
        }

        // Clear any switch data
        try {
            localStorage.removeItem('activeCallOnOtherDevice');
            localStorage.removeItem('callSwitchRequest');
            localStorage.removeItem('callSwitchResponse');
        } catch (error) {
            console.warn('⚠️ Error during cleanup:', error);
        }
    }
}
// Initialize transfer manager
window.transferManager = new EnhancedTransferManager();

// Add transfer methods to the phone system
if (window.phoneSystem) {
    // Start transfer session
    window.phoneSystem.startTransferSession = (lineNumber) => {
        return window.transferManager.startTransferSession(lineNumber);
    };

    // Cancel transfer session
    window.phoneSystem.cancelTransferSession = (lineNumber) => {
        return window.transferManager.cancelTransferSession(lineNumber);
    };

    // Blind transfer (enhanced version)
    window.phoneSystem.blindTransfer = async (lineNumber, targetNumber) => {
        return await window.transferManager.blindTransfer(lineNumber, targetNumber);
    };

    // Attended transfer start
    window.phoneSystem.attendedTransferCall = async (lineNumber, targetNumber) => {
        return await window.transferManager.attendedTransferCall(lineNumber, targetNumber);
    };

    // Complete attended transfer
    window.phoneSystem.completeAttendedTransfer = async (lineNumber) => {
        return await window.transferManager.completeAttendedTransfer(lineNumber);
    };

    // Cancel attended transfer
    window.phoneSystem.cancelAttendedTransfer = async (lineNumber) => {
        return await window.transferManager.cancelAttendedTransfer(lineNumber);
    };
}

// ===== GLOBAL TRANSFER API =====

// Global functions for UI integration
window.StartTransferSession = (lineNumber) => {
    return window.transferManager.startTransferSession(lineNumber);
};

window.CancelTransferSession = (lineNumber) => {
    return window.transferManager.cancelTransferSession(lineNumber);
};

window.BlindTransfer = async (lineNumber, targetNumber) => {
    return await window.transferManager.blindTransfer(lineNumber, targetNumber);
};

window.AttendedTransfer = async (lineNumber, targetNumber) => {
    return await window.transferManager.attendedTransferCall(lineNumber, targetNumber);
};

window.CompleteAttendedTransfer = async (lineNumber) => {
    return await window.transferManager.completeAttendedTransfer(lineNumber);
};

window.CancelAttendedTransfer = async (lineNumber) => {
    return await window.transferManager.cancelAttendedTransfer(lineNumber);
};

// Transfer key handler (converted from original)
window.transferOnkeydown = (event, obj, lineNum) => {
    const keycode = event.keyCode || event.which;
    if (keycode === 13) { // Enter key
        event.preventDefault();
        if (event.ctrlKey) {
            AttendedTransfer(lineNum, obj.value);
        } else {
            BlindTransfer(lineNum, obj.value);
        }
        return false;
    }
};

// Quick find buddy function
window.QuickFindBuddy = (obj) => {
    return window.transferManager.quickFindBuddy(obj.value);
};













// Initialize the call switching manager - ONLY IF NOT ALREADY INITIALIZED
if (!window.callSwitchingManager) {
    window.callSwitchingManager = new CallSwitchingManager();
}

// Global API functions
window.switchCallToThisDevice = () => {
    if (!window.callSwitchingManager) {
        console.error('❌ CallSwitchingManager not initialized');
        return Promise.reject('CallSwitchingManager not available');
    }
    return window.callSwitchingManager.switchCallToThisDevice();
};

window.canSwitchCall = () => {
    if (!window.callSwitchingManager) return false;
    return window.callSwitchingManager.canSwitchCall();
};

// Testing function
window.testCallSwitch = (callerNumber = '+1234567890', callerName = 'Test Caller') => {
    const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
    if (!myExtension) {
        console.error('❌ Extension not configured');
        return;
    }

    const callData = {
        extension: myExtension,
        callerNumber: callerNumber,
        callerName: callerName,
        startTime: Date.now(),
        deviceName: 'Other Device (Test)',
        timestamp: Date.now()
    };

    localStorage.setItem('activeCallOnOtherDevice', JSON.stringify(callData));
    console.log('📱 Switch notification should appear shortly...');
};

// Monitor for calls that can be switched
window.addEventListener('beforeunload', () => {
    if (window.callSwitchingManager) {
        window.callSwitchingManager.cleanup();
    }
});

window.callSwitchingManager = new CallSwitchingManager();

// Global API functions
window.switchCallToThisDevice = () => {
    return window.callSwitchingManager.switchCallToThisDevice();
};

window.canSwitchCall = () => {
    return window.callSwitchingManager.canSwitchCall();
};

// Monitor for calls that can be switched
window.addEventListener('beforeunload', () => {
    window.callSwitchingManager?.cleanup();
});

///////////////////////switch device


window.modernPhoneSystem = new FreePBXCompatiblePhoneSystem();
// Fix for handleIncomingCall error - Replace the problematic window.handleIncomingCall function

window.handleIncomingCall = function (invitation) {
    try {
        
        // Delegate to the actual implementation in the phone system
        if (window.modernPhoneSystem && typeof window.modernPhoneSystem.handleIncomingCall === 'function') {
            return window.modernPhoneSystem.handleIncomingCall(invitation);
        } else {
            console.warn("⚠️ Modern phone system not available for incoming call");
            
            // Basic fallback handling
            const callId = invitation.request?.headers?.['Call-ID']?.[0]?.value || 'unknown';
            
            // Try to extract basic caller info
            let callerNumber = 'unknown';
            let callerName = 'Unknown Caller';
            
            if (invitation.request && invitation.request.from) {
                try {
                    if (invitation.request.from.uri && invitation.request.from.uri.user) {
                        callerNumber = invitation.request.from.uri.user;
                    }
                    if (invitation.request.from.displayName) {
                        callerName = invitation.request.from.displayName;
                    }
                } catch (parseError) {
                    console.warn('⚠️ Error parsing caller info:', parseError);
                }
            }
            
            // Store basic call info
            try {
                const callInfo = {
                    callerNumber: callerNumber,
                    callerName: callerName,
                    direction: 'inbound',
                    timestamp: Date.now(),
                    callId: callId
                };
                
                localStorage.setItem('lastIncomingCallInfo', JSON.stringify(callInfo));
            } catch (storageError) {
                console.warn('⚠️ Error storing call information:', storageError);
            }
            
            // Basic line setup if needed
            let lineIndex = 0;
            if (window.Lines && Array.isArray(window.Lines)) {
                for (let i = 0; i < window.Lines.length; i++) {
                    if (!window.Lines[i].SipSession) {
                        lineIndex = i;
                        break;
                    }
                }
            }
            
            const lineNumber = lineIndex + 1;
            
            // Set up basic line object
            if (window.Lines && window.Lines[lineIndex]) {
                window.Lines[lineIndex] = {
                    ...window.Lines[lineIndex],
                    SipSession: invitation,
                    CallerIDNumber: callerNumber,
                    CallerIDName: callerName,
                    direction: 'inbound',
                    callId: callId,
                    IsSelected: true
                };
            }
            
            // Show incoming call UI if available
            if (window.showGlobalIncomingCall) {
                window.showGlobalIncomingCall(callerNumber, callerName, lineNumber);
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('incomingCall', {
                detail: {
                    callerNumber,
                    callerName,
                    lineNumber,
                    callId
                }
            }));
            
        }
        
    } catch (error) {
        console.error("❌ Error in global incoming call handler:", error);
        
        // Try to reject the invitation to prevent hanging
        try {
            if (invitation && typeof invitation.reject === 'function') {
                invitation.reject({ statusCode: 500, reasonPhrase: "Internal Server Error" });
            }
        } catch (rejectError) {
            console.error("❌ Error rejecting invitation:", rejectError);
        }
    }
};

///////////////mac user detection and block




















// Quick Fix Option: Just remove the problematic code block
// Find this section around line 4992 in your phone.js and remove it:

/*
// ✅ STORE CALLER INFORMATION FOR LATER RETRIEVAL
try {
    const callInfo = {
        callerNumber: callerNumber,  // <-- ERROR: not defined in this scope
        callerName: callerName,      // <-- ERROR: not defined in this scope
        direction: 'inbound',
        timestamp: Date.now(),
        callId: callId,              // <-- ERROR: not defined in this scope
        sessionId: this.sessionId   // <-- ERROR: not defined in this scope
    };
    
    // Store in localStorage for later retrieval
    localStorage.setItem('lastIncomingCallInfo', JSON.stringify(callInfo));
    
    // Also store with call ID as key for specific lookup
    localStorage.setItem(`callInfo_${callId}`, JSON.stringify(callInfo));
    
    console.log('📦 Stored caller information for later retrieval:', callInfo);
    
    // Clean up old call info entries (keep only last 10)
    const keys = Object.keys(localStorage).filter(key => key.startsWith('callInfo_'));
    if (keys.length > 10) {
        keys.slice(0, keys.length - 10).forEach(key => {
            localStorage.removeItem(key);
        });
    }
} catch (storageError) {
    console.warn('⚠️ Error storing call information:', storageError);
}
*/

// SIMPLE FIX: Replace the entire window.handleIncomingCall function with this:

window.handleIncomingCall = function (invitation) {
    try {
        
        // Delegate to the actual implementation in the phone system
        if (window.modernPhoneSystem && typeof window.modernPhoneSystem.handleIncomingCall === 'function') {
            return window.modernPhoneSystem.handleIncomingCall(invitation);
        } else {
            console.warn("⚠️ Modern phone system not available for incoming call");
            
            // Basic fallback handling
            const callId = invitation.request?.headers?.['Call-ID']?.[0]?.value || 'unknown';
            
            // Try to extract basic caller info
            let callerNumber = 'unknown';
            let callerName = 'Unknown Caller';
            
            if (invitation.request && invitation.request.from) {
                try {
                    if (invitation.request.from.uri && invitation.request.from.uri.user) {
                        callerNumber = invitation.request.from.uri.user;
                    }
                    if (invitation.request.from.displayName) {
                        callerName = invitation.request.from.displayName;
                    }
                } catch (parseError) {
                    console.warn('⚠️ Error parsing caller info:', parseError);
                }
            }
            
            // Store basic call info
            try {
                const callInfo = {
                    callerNumber: callerNumber,
                    callerName: callerName,
                    direction: 'inbound',
                    timestamp: Date.now(),
                    callId: callId
                };
                
                localStorage.setItem('lastIncomingCallInfo', JSON.stringify(callInfo));
            } catch (storageError) {
                console.warn('⚠️ Error storing call information:', storageError);
            }
            
            // Basic line setup if needed
            let lineIndex = 0;
            if (window.Lines && Array.isArray(window.Lines)) {
                for (let i = 0; i < window.Lines.length; i++) {
                    if (!window.Lines[i].SipSession) {
                        lineIndex = i;
                        break;
                    }
                }
            }
            
            const lineNumber = lineIndex + 1;
            
            // Set up basic line object
            if (window.Lines && window.Lines[lineIndex]) {
                window.Lines[lineIndex] = {
                    ...window.Lines[lineIndex],
                    SipSession: invitation,
                    CallerIDNumber: callerNumber,
                    CallerIDName: callerName,
                    direction: 'inbound',
                    callId: callId,
                    IsSelected: true
                };
            }
            
            // Show incoming call UI if available
            if (window.showGlobalIncomingCall) {
                window.showGlobalIncomingCall(callerNumber, callerName, lineNumber);
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('incomingCall', {
                detail: {
                    callerNumber,
                    callerName,
                    lineNumber,
                    callId
                }
            }));
            
        }
        
    } catch (error) {
        console.error("❌ Error in global incoming call handler:", error);
        
        // Try to reject the invitation to prevent hanging
        try {
            if (invitation && typeof invitation.reject === 'function') {
                invitation.reject({ statusCode: 500, reasonPhrase: "Internal Server Error" });
            }
        } catch (rejectError) {
            console.error("❌ Error rejecting invitation:", rejectError);
        }
    }
};



window.updateRegistrationStatus = function () {
    window.sipRegistrationState = window.registrationState;
    window.sipIsRegistered = window.isRegistered;
    window.dispatchEvent(new CustomEvent('sipRegistrationChange', {
        detail: {
            state: window.registrationState,
            isRegistered: window.isRegistered
        }
    }));
    const statusElement = document.getElementById('sip-status');
    if (statusElement) {
        statusElement.textContent = window.registrationState;
        statusElement.className = window.isRegistered ? 'registered' : 'unregistered';
    }
};

window.detectAudioDevices = async function () {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.warn("⚠️ Media devices enumeration not supported");
            return false;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        window.hasAudioDevice = audioInputs.length > 0;
        window.audioDevices = audioInputs;
        if (window.hasAudioDevice) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                console.warn('⚠️ Audio permissions denied:', error);
            }
        }
        return window.hasAudioDevice;
    } catch (error) {
        console.error("❌ Error detecting audio devices:", error);
        window.hasAudioDevice = false;
        return false;
    }
};

window.refreshConfiguration = function () {
    const getItem = (key, fallback = "") => {
        return localStorage.getItem(key) || localStorage.getItem(fallback) || sessionStorage.getItem(key) || sessionStorage.getItem(fallback) || "";
    };
    window.myPhoneNumber = getItem("myPhoneNumber", "senderPhone");
    window.profileUserID = getItem("profileUserID", "userId");
    window.profileName = getItem("profileName", "fullName");
    window.wssServer = getItem("wssServer", "secureWebSocketServer");
    window.WebSocketPort = getItem("WebSocketPort", "webSocketPort") || "8089";
    window.ServerPath = getItem("ServerPath", "webSocketPath") || "/ws";
    window.SipDomain = getItem("SipDomain", "domain");
    window.SipUsername = getItem("SipUsername", "sipUsername");
    window.SipPassword = getItem("SipPassword", "sipPassword");
};

window.validateSipConfiguration = function () {
    const webSocketUri = window.wssServer && window.WebSocketPort ? `wss://${window.wssServer}:${window.WebSocketPort}${window.ServerPath}` : null;
    const isValid = !!(webSocketUri && window.SipDomain && window.SipUsername && window.SipPassword);
    return {
        isValid,
        missing: {
            webSocketUri: !webSocketUri,
            domain: !window.SipDomain,
            username: !window.SipUsername,
            password: !window.SipPassword
        },
        config: {
            webSocketUri,
            domain: window.SipDomain,
            username: window.SipUsername,
            hasPassword: !!window.SipPassword
        }
    };
};
window.addEventListener('error', (event) => {
    console.log('🐛 JavaScript error caught, but no automatic restart triggered');
});

window.addEventListener('unhandledrejection', (event) => {
    console.log('🐛 Unhandled promise rejection, but no automatic restart triggered');
});
window.SimplifiedSipUserAgent = SimplifiedSipUserAgent;
window.ConnectionManager = ConnectionManager;

// ===== CALL WAITING API FUNCTIONS - ADD BEFORE setupSipConfiguration =====

// Global functions for call waiting
window.acceptWaitingCall = function (waitingCallId) {
    if (window.callWaitingManager) {
        return window.callWaitingManager.acceptWaitingCall(waitingCallId);
    }
    console.error('❌ Call waiting manager not available');
    return false;
};

window.rejectWaitingCall = function (waitingCallId) {
    if (window.callWaitingManager) {
        return window.callWaitingManager.rejectWaitingCall(waitingCallId);
    }
    console.error('❌ Call waiting manager not available');
    return false;
};

window.switchCalls = function (waitingCallId) {
    if (window.callWaitingManager) {
        return window.callWaitingManager.switchCalls(waitingCallId);
    }
    console.error('❌ Call waiting manager not available');
    return false;
};

window.hasActiveCalls = function () {
    if (window.callWaitingManager) {
        return window.callWaitingManager.hasActiveCalls();
    }
    return false;
};

window.setupSipConfiguration = function (config) {
    const configMap = {
        'myPhoneNumber': config.senderPhone || config.myPhoneNumber || '',
        'profileUserID': config.userId || config.profileUserID || '',
        'profileName': config.fullName || config.profileName || '',
        'wssServer': config.secureWebSocketServer || config.wssServer || '',
        'WebSocketPort': config.webSocketPort || config.WebSocketPort || '8089',
        'ServerPath': config.webSocketPath || config.ServerPath || '/ws',
        'SipDomain': config.domain || config.SipDomain || '',
        'SipUsername': config.sipUsername || config.SipUsername || '',
        'SipPassword': config.sipPassword || config.SipPassword || ''
    };
    Object.entries(configMap).forEach(([key, value]) => {
        if (value) {
            localStorage.setItem(key, value);
        }
    });
    window.refreshConfiguration();
    console.log("✅ SIP configuration complete");
    return true;
};

window.clearSipConfiguration = function () {
    const configKeys = [
        'myPhoneNumber', 'profileUserID', 'profileName', 'wssServer',
        'WebSocketPort', 'ServerPath', 'SipDomain', 'SipUsername', 'SipPassword'
    ];
    configKeys.forEach(key => localStorage.removeItem(key));
};



///////DTMF  updated 02-07-2025 Wednesday start
window.sendDTMF = async function (lineNumber, digit) {

    try {
        // Validate inputs
        if (!digit || typeof digit !== 'string') {
            console.warn(`❌ Invalid digit: ${digit}`);
            return false;
        }

        if (typeof lineNumber !== 'number' || lineNumber < 0) {
            console.warn(`❌ Invalid line number: ${lineNumber}`);
            return false;
        }

        // Use the enhanced phoneSystem method
        if (window.phoneSystem && typeof window.phoneSystem.sendDTMF === 'function') {
            const result = await window.phoneSystem.sendDTMF(lineNumber, digit);
            return result;
        }

        // Fallback to direct session access if phoneSystem not available
        const lines = window.Lines;
        if (!lines || !Array.isArray(lines)) {
            console.warn(`❌ No Lines array found`);
            return false;
        }

        // Try both 1-based and 0-based indexing
        let session = null;
        let foundMethod = '';

        if (lines[lineNumber - 1]?.SipSession) {
            session = lines[lineNumber - 1].SipSession;
            foundMethod = `Lines[${lineNumber - 1}] (1-based)`;
        } else if (lines[lineNumber]?.SipSession) {
            session = lines[lineNumber].SipSession;
            foundMethod = `Lines[${lineNumber}] (0-based)`;
        }

        if (!session) {
            console.warn(`❌ No session found for line ${lineNumber}`);
            return false;
        }


        // Try WebRTC RTCDTMFSender first (most reliable)
        if (session.sessionDescriptionHandler?.peerConnection) {
            try {
                const pc = session.sessionDescriptionHandler.peerConnection;
                const senders = pc.getSenders();

                for (const sender of senders) {
                    if (sender.track && sender.track.kind === 'audio' && sender.dtmf) {
                        sender.dtmf.insertDTMF(digit, 100, 50);
                        return true;
                    }
                }
            } catch (error) {
                console.warn('⚠️ WebRTC DTMF failed:', error);
            }
        }

        // Try SIP.js methods
        if (session.sessionDescriptionHandler?.sendDtmf) {
            try {
                session.sessionDescriptionHandler.sendDtmf(digit, { duration: 100, interToneGap: 50 });
                return true;
            } catch (error) {
                console.warn('⚠️ SIP.js DTMF failed:', error);
            }
        }

        console.error('❌ All DTMF methods failed');
        return false;

    } catch (error) {
        console.error('❌ Error in enhanced sendDTMF:', error);
        return false;
    }
};///updated 02-07-2025 Wednesday end




// LEGACY: Allow UI to call legacy DialByLine(number)
window.DialByLine = async function (type, buddy, number, CallerID, extraHeaders) {
    // Validation
    if (!number || typeof number !== "string" || number.trim() === "") {
        alert("Please enter a valid number to dial.");
        return;
    }

    try {

        // Use the bulletproof phone manager
        const lineNumber = await window.phoneManager.makeCall(number);

        return lineNumber;

    } catch (error) {
        console.error('❌ Call failed:', error);

        // More user-friendly error messages
        if (error.message.includes('timeout')) {
            alert("Call failed: System is taking too long to initialize. Please try again.");
        } else if (error.message.includes('not ready')) {
            alert("Call failed: Phone system is starting up. Please wait a moment and try again.");
        } else {
            alert(`Call failed: ${error.message}`);
        }

        throw error;
    }
};

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.modernPhoneSystem.initialize().catch(console.error);
        });
    } else {
        setTimeout(() => {
            window.modernPhoneSystem.initialize().catch(console.error);
        }, 100);
    }
    window.addEventListener('beforeunload', () => {
        window.modernPhoneSystem?.stopConnection().catch(console.error);
    });
}
//////////////////////transfer to me
function setupEnhancedTransferAPI() {
    // Direct transfer methods
    window.transferCallToMe = async (lineNumber, targetExtension) => {
        try {
            const myExtension = targetExtension || localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
            if (!myExtension) {
                throw new Error('My extension is not configured. Please check your SIP settings.');
            }


            const sourceLineObj = window.Lines?.[lineNumber - 1];
            if (!sourceLineObj?.SipSession) {
                throw new Error(`No active session found on line ${lineNumber}`);
            }

            // Check session state
            const sessionState = sourceLineObj.SipSession.state;
            if (!['Established', 'Confirmed'].includes(sessionState)) {
                throw new Error(`Cannot transfer call in state: ${sessionState}. Call must be established.`);
            }

            const targetURI = SIP.UserAgent.makeURI(`sip:${myExtension}@${window.SipDomain}`);
            if (!targetURI) {
                throw new Error(`Invalid target extension: ${myExtension}`);
            }

            // Perform the transfer using SIP REFER
            await sourceLineObj.SipSession.refer(targetURI, {
                requestDelegate: {
                    onAccept: () => {
                    },
                    onReject: (response) => {
                        console.error('❌ Transfer request rejected:', response.message.statusCode, response.message.reasonPhrase);
                        throw new Error(`Transfer rejected: ${response.message.reasonPhrase}`);
                    }
                }
            });


            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('callTransferred', {
                detail: {
                    fromLine: lineNumber,
                    toExtension: myExtension,
                    type: 'direct',
                    timestamp: new Date().toISOString()
                }
            }));

            return true;
        } catch (error) {
            console.error(`❌ Failed to transfer call:`, error);
            throw error;
        }
    };

    // Take any active call on the system
    window.takeActiveCall = async () => {
        try {
            // Find any active call on any line
            let activeLineNumber = null;
            if (window.Lines && Array.isArray(window.Lines)) {
                for (let i = 0; i < window.Lines.length; i++) {
                    const line = window.Lines[i];
                    if (line && line.SipSession) {
                        const status = (line.SipSession.status || '').toLowerCase();
                        const state = line.SipSession.state;

                        // Check for various active states
                        if (['connecting', 'connected', 'confirmed', 'established'].includes(status) ||
                            ['Established', 'Confirmed'].includes(state)) {
                            activeLineNumber = i + 1; // Convert to 1-based
                            break;
                        }
                    }
                }
            }

            if (!activeLineNumber) {
                // Check if there are any SIP sessions at all
                const allSessions = window.Lines?.filter(line => line?.SipSession) || [];
                if (allSessions.length === 0) {
                    throw new Error('No active calls found on any line');
                } else {
                    console.log('Found sessions but none are active:', allSessions.map(s => ({
                        line: s.LineNumber,
                        status: s.SipSession?.status,
                        state: s.SipSession?.state
                    })));
                    throw new Error('No transferable calls found (calls must be established)');
                }
            }

            return await window.transferCallToMe(activeLineNumber);

        } catch (error) {
            console.error('❌ Failed to take active call:', error);
            throw error;
        }
    };

    window.blindTransferCall = (lineNumber, targetNumber) =>
        window.phoneSystem.blindTransferCall(lineNumber, targetNumber);

    window.attendedTransferCall = (lineNumber, targetNumber) =>
        window.phoneSystem.attendedTransferCall(lineNumber, targetNumber);

    window.transferActiveCallToExtension = (targetExtension) =>
        window.phoneSystem.transferActiveCallToExtension(targetExtension);

    // Convenience method for B to take A's call
    window.takeActiveCall = () => {
        const myExtension = localStorage.getItem("SipUsername") || localStorage.getItem("sipUsername");
        if (!myExtension) {
            console.error('❌ Cannot determine my extension');
            return Promise.reject('Extension not configured');
        }
        return window.phoneSystem.transferActiveCallToExtension(myExtension);
    };

}

function setupRingCentralStyleAPI() {
    // Initialize call switching
    if (!window.callSwitchingManager) {
        window.callSwitchingManager = new CallSwitchingManager();
    }

    // Global switch function
    window.switchCallToThisDevice = async () => {
        return await window.callSwitchingManager.switchCallToThisDevice();
    };

    // Check if call can be switched
    window.canSwitchCall = () => {
        if (!window.callSwitchingManager) return false;
        return window.callSwitchingManager.canSwitchCall();
    };

    // Simulate call on other device (for testing)
    window.simulateOtherDeviceCall = (callerNumber, callerName) => {
        const myExtension = localStorage.getItem("SipUsername");
        if (!myExtension) return;

        const callData = {
            extension: myExtension,
            callerNumber: callerNumber || '+1234567890',
            callerName: callerName || 'Test Caller',
            startTime: Date.now(),
            deviceName: 'Other Device',
            timestamp: Date.now()
        };

        localStorage.setItem('activeCallOnOtherDevice', JSON.stringify(callData));
    };

    // Listen for actual incoming calls to detect multi-device scenario
    window.addEventListener('incomingCall', (event) => {
        const { callerNumber, callerName } = event.detail;

        // Set a flag that this call could be answered on another device
        setTimeout(() => {
            // If call wasn't answered locally, assume it might be on another device
            const hasLocalCall = window.callSwitchingManager?.hasActiveCallOnThisDevice();
            if (!hasLocalCall) {
                window.simulateOtherDeviceCall(callerNumber, callerName);
            }
        }, 5000); // Wait 5 seconds after incoming call
    });

}
////////////////////////SMS Section
function initializeSocketListeners() {
    if (!window.socket) return;

    socket.on("new_sms", handleIncomingSMS);
    socket.on("typing", handleTyping);
    socket.on("seen", handleSeen);
}

function handleIncomingSMS({ from, body, time, mediaUrl }) {
    console.log("📥 [INCOMING SMS]", { from, body, mediaUrl, time });
    // Existing message handling logic here...
    // Don't duplicate your current handleSMS block.
}

function handleTyping({ from }) {
    const cleanFrom = from.replace(/[^\d]/g, '').replace(/^1/, '');
    const buddy = FindBuddyByPhoneNumber(cleanFrom);
    if (!buddy) return;
    const typingId = `contact-${buddy.identity}-Typing`;
    if (!document.getElementById(typingId)) {
        const el = document.createElement("div");
        el.id = typingId;
        el.className = "typing-indicator";
        el.textContent = "Typing...";
        el.style.color = "#888";
        el.style.margin = "5px 10px";
        $(`#contact-${buddy.identity}-ChatHistory`).append(el);
    }
    $(`#${typingId}`).show();
    setTimeout(() => $(`#${typingId}`).fadeOut(), 3000);
}

function handleSeen({ messageId }) {
    const buddy = selectedBuddy || null;
    if (buddy) {
        const buddyObj = FindBuddyByIdentity(buddy);
        MarkDisplayReceipt(buddyObj, messageId, true);
    }
}

let reconnectInterval = null
let connectionHealthCheck = null
function connectSocket(retry = 0) {
    if (retry > 10) {
        console.error("❌ Max WebSocket reconnection attempts reached");
        return;
    }

    if (window.socket && window.socket.connected) {
        console.log("🔁 WebSocket already connected");
        return;
    }

    // Add to your socket initialization in phone.js
    if (window.socket) {
        window.socket.on('transfer-call-request', (data) => {
            const { callerNumber, targetDevice } = data;

            // Find active call and initiate transfer
            if (window.Lines && Array.isArray(window.Lines)) {
                const activeLine = window.Lines.find(line =>
                    line.SipSession &&
                    line.CallerIDNumber === callerNumber &&
                    ['connected', 'established'].includes(line.SipSession.status)
                );

                if (activeLine && window.TransferCall) {
                    window.TransferCall(activeLine.LineNumber, targetDevice);
                }
            }
        });
    }





    window.socket = io("https://bkpmanual.bitnexdial.com:3000", {
        transports: ["websocket"],
        secure: true,
        reconnection: false // We'll handle it manually
    });


    socket.on("connect", () => {

        if (reconnectInterval) clearInterval(reconnectInterval);
        if (connectionHealthCheck) clearInterval(connectionHealthCheck);

        // Only attach listeners once
        if (!socket._listenersAttached) {
            initializeSocketListeners();
            socket._listenersAttached = true;
        }

        // Health check every 15 seconds
        connectionHealthCheck = setInterval(() => {
            if (!socket.connected) {
                console.warn("🔄 Socket seems disconnected, reconnecting...");
                connectSocket();
            }
        }, 15000);
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ WebSocket disconnected:", reason);
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                connectSocket(retry + 1);
            }, 5000);
        }
    });

    socket.on("connect_error", (err) => {
        console.error("❌ WebSocket error:", err.message);
    });
}

connectSocket();
setupEnhancedTransferAPI();
setupRingCentralStyleAPI();


socket.on("new_sms", ({ from, body, time, mediaUrl }) => {

    const cleanFrom = from.replace(/[^\d]/g, '').replace(/^1/, '');
    const buddy = FindBuddyByPhoneNumber(cleanFrom);

    const safeTime = new Date(time);
    const timeStr = isNaN(safeTime) ? new Date().toISOString() : safeTime.toISOString();

    const formattedText = ReformatMessage(body || "");
    const imageTag = mediaUrl ? `<br><img class="previewImage" src="${mediaUrl}" onclick="PreviewImage(this)">` : "";
    const finalMessage = formattedText + imageTag;

    const handleSMS = (buddyObj) => {
        const streamKey = buddyObj.identity + "-stream";
        const stream = JSON.parse(localStorage.getItem(streamKey)) || InitialiseStream(buddyObj.identity);

        stream.DataCollection.push({
            ItemId: uID(),
            ItemType: "MSG",
            ItemDate: timeStr,
            SrcUserId: buddyObj.identity,
            Src: `"${buddyObj.CallerIDName}"`,
            DstUserId: profileUserID,
            Dst: "",
            MessageData: finalMessage
        });

        stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
        localStorage.setItem(streamKey, JSON.stringify(stream));

        RefreshStream(buddyObj);
        updateScroll(buddyObj.identity);
        UpdateBuddyActivity(buddyObj.identity);
        ActivateStream(buddyObj, finalMessage);
    };

    if (!buddy) {
        // Auto-create buddy
        const newId = uID();
        const now = utcDateNow();

        const newBuddyData = {
            Type: "extension",
            LastActivity: now,
            ExtensionNumber: cleanFrom,
            MobileNumber: cleanFrom,
            uID: newId,
            DisplayName: cleanFrom,
            missed: 0,
        };

        let buddyList = JSON.parse(localDB.getItem(profileUserID + "-Buddies")) || InitUserBuddies();
        buddyList.DataCollection.push(newBuddyData);
        buddyList.TotalRows = buddyList.DataCollection.length;
        localDB.setItem(profileUserID + "-Buddies", JSON.stringify(buddyList));

        const buddyObj = new Buddy("extension", newId, cleanFrom, cleanFrom, "", "", "", now, "", "", null, false, false);
        AddBuddy(buddyObj, true, false, false, false);

        setTimeout(() => {
            const retryBuddy = FindBuddyByPhoneNumber(cleanFrom);
            if (retryBuddy) handleSMS(retryBuddy);
        }, 500);
    } else {
        handleSMS(buddy);
    }
});

window.FetchedSMSBuddies = new Set();

function FetchSMSHistory(buddyObj) {
    const myPhone = localStorage.getItem("myPhoneNumber");
    if (!buddyObj || !myPhone) return;

    const targetNumber = (buddyObj.MobileNumber || buddyObj.ExtNo || buddyObj.ContactNumber1 || "").replace(/[^\d]/g, "");
    const senderNumber = myPhone.replace(/[^\d]/g, "");

    fetch("https://bkpmanual.bitnexdial.com:3000/sms-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            number: senderNumber,
            contact: targetNumber
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data)) {
                console.warn("❌ Unexpected SMS history response:", data);
                return;
            }

            let stream = JSON.parse(localStorage.getItem(buddyObj.identity + "-stream"));
            if (!stream || !Array.isArray(stream.DataCollection)) {
                stream = InitialiseStream(buddyObj.identity);
            }

            const seenKeys = new Set(stream.DataCollection.map(x => x.ItemDate + x.MessageData));
            const buddyNumber = targetNumber;

            data.forEach(msg => {
                const isOutbound = msg.sender.replace(/[^\d]/g, "").endsWith(senderNumber);
                const direction = isOutbound ? "outbound" : "inbound";

                const remoteNumber = (isOutbound ? msg.receiver : msg.sender).replace(/[^\d]/g, "").replace(/^1/, "");

                if (!buddyNumber.endsWith(remoteNumber)) return;

                const uniqueKey = msg.tx_rx_datetime + msg.body;
                if (seenKeys.has(uniqueKey)) return;

                const messageId = uID();
                stream.DataCollection.push({
                    ItemId: messageId,
                    ItemType: "MSG",
                    ItemDate: msg.tx_rx_datetime,
                    SrcUserId: isOutbound ? profileUserID : buddyObj.identity,
                    Src: isOutbound ? `"${profileName}"` : `"${buddyObj.CallerIDName}"`,
                    DstUserId: isOutbound ? buddyObj.identity : profileUserID,
                    Dst: "",
                    MessageData: msg.body,
                    Direction: direction
                });

                RefreshStream(buddyObj);
                updateScroll(buddyObj.identity);
            });

            stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
            localStorage.setItem(buddyObj.identity + "-stream", JSON.stringify(stream));

            UpdateBuddyActivity(buddyObj.identity);
            RefreshStream(buddyObj);

            if (data.length > 0) {
                const lastMsg = data[data.length - 1];
                ActivateStream(buddyObj, lastMsg.body);
            }
        })
        .catch(err => {
            console.error("❌ Failed to fetch SMS history:", err);
        });
}

// Continue with the rest of the SMS and utility functions...


if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.modernPhoneSystem;
}
////////////////////////SMS Section
function initializeSocketListeners() {
    if (!window.socket) return;

    socket.on("new_sms", handleIncomingSMS);
    socket.on("typing", handleTyping);
    socket.on("seen", handleSeen);
}

function handleIncomingSMS({ from, body, time, mediaUrl }) {
    console.log("📥 [INCOMING SMS]", { from, body, mediaUrl, time });
    // Existing message handling logic here...
    // Don't duplicate your current handleSMS block.
}

function handleTyping({ from }) {
    const cleanFrom = from.replace(/[^\d]/g, '').replace(/^1/, '');
    const buddy = FindBuddyByPhoneNumber(cleanFrom);
    if (!buddy) return;
    const typingId = `contact-${buddy.identity}-Typing`;
    if (!document.getElementById(typingId)) {
        const el = document.createElement("div");
        el.id = typingId;
        el.className = "typing-indicator";
        el.textContent = "Typing...";
        el.style.color = "#888";
        el.style.margin = "5px 10px";
        $(`#contact-${buddy.identity}-ChatHistory`).append(el);
    }
    $(`#${typingId}`).show();
    setTimeout(() => $(`#${typingId}`).fadeOut(), 3000);
}

function handleSeen({ messageId }) {
    const buddy = selectedBuddy || null;
    if (buddy) {
        const buddyObj = FindBuddyByIdentity(buddy);
        MarkDisplayReceipt(buddyObj, messageId, true);
    }
}

function connectSocket(retry = 0) {
    if (retry > 10) {
        console.error("❌ Max WebSocket reconnection attempts reached");
        return;
    }

    if (window.socket && window.socket.connected) {
        console.log("🔁 WebSocket already connected");
        return;
    }

    window.socket = io("https://bkpmanual.bitnexdial.com:3000", {
        transports: ["websocket"],
        secure: true,
        reconnection: false // We'll handle it manually
    });


    socket.on("connect", () => {

        if (reconnectInterval) clearInterval(reconnectInterval);
        if (connectionHealthCheck) clearInterval(connectionHealthCheck);

        // Only attach listeners once
        if (!socket._listenersAttached) {
            initializeSocketListeners();
            socket._listenersAttached = true;
        }

        // Health check every 15 seconds
        connectionHealthCheck = setInterval(() => {
            if (!socket.connected) {
                console.warn("🔄 Socket seems disconnected, reconnecting...");
                connectSocket();
            }
        }, 15000);
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ WebSocket disconnected:", reason);
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                connectSocket(retry + 1);
            }, 5000);
        }
    });

    socket.on("connect_error", (err) => {
        console.error("❌ WebSocket error:", err.message);
    });
}

connectSocket();





socket.on("new_sms", ({ from, body, time, mediaUrl }) => {
    const cleanFrom = from.replace(/[^\d]/g, '').replace(/^1/, '');
    const buddy = FindBuddyByPhoneNumber(cleanFrom);

    const safeTime = new Date(time);
    const timeStr = isNaN(safeTime) ? new Date().toISOString() : safeTime.toISOString();

    const formattedText = ReformatMessage(body || "");
    const imageTag = mediaUrl ? `<br><img class="previewImage" src="${mediaUrl}" onclick="PreviewImage(this)">` : "";
    const finalMessage = formattedText + imageTag;



    const handleSMS = (buddyObj) => {
        const streamKey = buddyObj.identity + "-stream";
        const stream = JSON.parse(localStorage.getItem(streamKey)) || InitialiseStream(buddyObj.identity);

        stream.DataCollection.push({
            ItemId: uID(),
            ItemType: "MSG",
            ItemDate: timeStr,
            SrcUserId: buddyObj.identity,
            Src: `"${buddyObj.CallerIDName}"`,
            DstUserId: profileUserID,
            Dst: "",
            MessageData: finalMessage
        });

        stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
        localStorage.setItem(streamKey, JSON.stringify(stream));

        RefreshStream(buddyObj);
        updateScroll(buddyObj.identity);
        UpdateBuddyActivity(buddyObj.identity);
        ActivateStream(buddyObj, finalMessage);
    };

    if (!buddy) {
        // Auto-create buddy
        const newId = uID();
        const now = utcDateNow();

        const newBuddyData = {
            Type: "extension",
            LastActivity: now,
            ExtensionNumber: cleanFrom,
            MobileNumber: cleanFrom,
            uID: newId,
            DisplayName: cleanFrom,
            missed: 0,
        };

        let buddyList = JSON.parse(localDB.getItem(profileUserID + "-Buddies")) || InitUserBuddies();
        buddyList.DataCollection.push(newBuddyData);
        buddyList.TotalRows = buddyList.DataCollection.length;
        localDB.setItem(profileUserID + "-Buddies", JSON.stringify(buddyList));

        const buddyObj = new Buddy("extension", newId, cleanFrom, cleanFrom, "", "", "", now, "", "", null, false, false);
        AddBuddy(buddyObj, true, false, false, false);

        setTimeout(() => {
            const retryBuddy = FindBuddyByPhoneNumber(cleanFrom);
            if (retryBuddy) handleSMS(retryBuddy);
        }, 500);
    } else {
        handleSMS(buddy);
    }
});



window.FetchedSMSBuddies = new Set();


function FetchSMSHistory(buddyObj) {
    const myPhone = localStorage.getItem("myPhoneNumber");
    if (!buddyObj || !myPhone) return;

    const targetNumber = (buddyObj.MobileNumber || buddyObj.ExtNo || buddyObj.ContactNumber1 || "").replace(/[^\d]/g, "");
    const senderNumber = myPhone.replace(/[^\d]/g, "");

    fetch("https://bkpmanual.bitnexdial.com:3000/sms-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            number: senderNumber,
            contact: targetNumber
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data)) {
                console.warn("❌ Unexpected SMS history response:", data);
                return;
            }

            let stream = JSON.parse(localStorage.getItem(buddyObj.identity + "-stream"));
            if (!stream || !Array.isArray(stream.DataCollection)) {
                stream = InitialiseStream(buddyObj.identity);
            }

            const seenKeys = new Set(stream.DataCollection.map(x => x.ItemDate + x.MessageData));
            const buddyNumber = targetNumber;

            data.forEach(msg => {
                const isOutbound = msg.sender.replace(/[^\d]/g, "").endsWith(senderNumber);
                const direction = isOutbound ? "outbound" : "inbound";

                const remoteNumber = (isOutbound ? msg.receiver : msg.sender).replace(/[^\d]/g, "").replace(/^1/, "");

                if (!buddyNumber.endsWith(remoteNumber)) return;

                const uniqueKey = msg.tx_rx_datetime + msg.body;
                if (seenKeys.has(uniqueKey)) return;

                const messageId = uID();
                stream.DataCollection.push({
                    ItemId: messageId,
                    ItemType: "MSG",
                    ItemDate: msg.tx_rx_datetime,
                    SrcUserId: isOutbound ? profileUserID : buddyObj.identity,
                    Src: isOutbound ? `"${profileName}"` : `"${buddyObj.CallerIDName}"`,
                    DstUserId: isOutbound ? buddyObj.identity : profileUserID,
                    Dst: "",
                    MessageData: msg.body,
                    Direction: direction
                });

                RefreshStream(buddyObj);
                updateScroll(buddyObj.identity);
            });

            stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
            localStorage.setItem(buddyObj.identity + "-stream", JSON.stringify(stream));

            UpdateBuddyActivity(buddyObj.identity);
            RefreshStream(buddyObj);

            if (data.length > 0) {
                const lastMsg = data[data.length - 1];
                ActivateStream(buddyObj, lastMsg.body);
            }
        })
        .catch(err => {
            console.error("❌ Failed to fetch SMS history:", err);
        });
}



function FetchCallHistoryOnLogin(done) {
    const myPhone = localStorage.getItem("myPhoneNumber")?.replace(/[^\d]/g, '').replace(/^1/, '');
    if (!myPhone) {
        if (done) done();
        return;
    }

    fetch("https://bkpmanual.bitnexdial.com:3000/api/call-history?number=" + myPhone)
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data)) {
                console.warn("❌ Unexpected call history response:", data);
                if (done) done();
                return;
            }


            data.forEach(cdr => {
                const buddyNum = cdr.callee === myPhone ? cdr.caller : cdr.callee;
                const cleanNum = buddyNum.replace(/[^\d]/g, '').replace(/^1/, '');
                let buddy = FindBuddyByPhoneNumber(cleanNum);

                if (!buddy) {
                    const newId = uID();
                    const now = utcDateNow();
                    let buddyList = JSON.parse(localStorage.getItem(profileUserID + "-Buddies")) || InitUserBuddies();
                    const alreadyExists = buddyList.DataCollection.some(b => {
                        const existing = (b.MobileNumber || b.ExtNo || "").replace(/[^\d]/g, '').replace(/^1/, '');
                        return existing === cleanNum;
                    });

                    if (!alreadyExists) {
                        const buddyData = {
                            Type: "extension",
                            LastActivity: now,
                            ExtensionNumber: cleanNum,
                            MobileNumber: cleanNum,
                            ContactNumber1: "",
                            ContactNumber2: "",
                            uID: newId,
                            cID: null,
                            gID: null,
                            jid: null,
                            DisplayName: cleanNum,
                            Description: "",
                            Email: "",
                            MemberCount: 0,
                            EnableDuringDnd: false,
                            Subscribe: false,
                            missed: 0
                        };

                        buddyList.DataCollection.push(buddyData);
                        buddyList.TotalRows = buddyList.DataCollection.length;
                        localStorage.setItem(profileUserID + "-Buddies", JSON.stringify(buddyList));

                        const buddyObj = new Buddy("extension", newId, cleanNum, cleanNum, "", "", "", now, "", "", null, false, false);
                        AddBuddy(buddyObj, true, false, false, false);
                        buddy = buddyObj;
                    } else {
                        return;
                    }
                }

                let stream = JSON.parse(localStorage.getItem(buddy.identity + "-stream")) || InitialiseStream(buddy.identity);
                const existingCdrKeys = new Set(
                    stream.DataCollection.filter(x => x.ItemType === "CDR").map(x => `${x.SessionId}-${x.CallEnd}`)
                );

                const cdrKey = `${cdr.session_id}-${cdr.end_time}`;
                if (existingCdrKeys.has(cdrKey)) {
                    console.log("⏭️ Skipping duplicate call record:", cdrKey);
                    return;
                }

                const isOutbound = cdr.caller.endsWith(myPhone);

                const callItem = {
                    CdrId: cdr.session_id || uID(),
                    ItemType: "CDR",
                    ItemDate: moment.utc(cdr.start_time).format("YYYY-MM-DD HH:mm:ss UTC"),
                    CallAnswer: cdr.answer_time ? moment.utc(cdr.answer_time).format("YYYY-MM-DD HH:mm:ss UTC") : null,
                    CallEnd: cdr.end_time ? moment.utc(cdr.end_time).format("YYYY-MM-DD HH:mm:ss UTC") : null,

                    SrcUserId: isOutbound ? profileUserID : buddy.identity,
                    DstUserId: isOutbound ? buddy.identity : profileUserID,
                    Src: isOutbound ? `"${profileName}"` : `"${buddy.CallerIDName}"`,
                    Dst: isOutbound ? `"${buddy.CallerIDName}"` : `"${profileName}"`,

                    RingTime: cdr.ring_time || 0,
                    Billsec: cdr.duration || 0,
                    Missed: (cdr.duration === 0),
                    TotalDuration: cdr.duration || 0,
                    ReasonCode: cdr.reason_code || "",
                    ReasonText: cdr.reason_text || "",
                    WithVideo: cdr.with_video || 0,
                    SessionId: cdr.session_id || "",
                    CallDirection: cdr.direction,
                    Terminate: cdr.terminated_by,
                    MessageData: null,
                    Tags: [],
                    Transfers: [],
                    Mutes: [],
                    Holds: [],
                    Recordings: [],
                    ConfCalls: [],
                    ConfbridgeEvents: [],
                    QOS: []
                };


                stream.DataCollection.push(callItem);
                stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
                localStorage.setItem(buddy.identity + "-stream", JSON.stringify(stream));
            });

            if (done) done(); // ✅ Call the callback after everything finishes
        })
        .catch(err => {
            console.error("❌ Call history error:", err);
            if (done) done(); // ✅ Still call the callback even if failed
        });
}

function FindBuddyByPhoneNumber(number) {

    const allBuddies = JSON.parse(localDB.getItem(profileUserID + "-Buddies"));
    if (!allBuddies) {
        console.warn("🚫 No buddy list found in localDB for user:", profileUserID);
        return null;
    }

    const clean = (num) => num.replace(/[^\d]/g, "").replace(/^1/, "");
    const target = clean(number);

    for (let buddy of allBuddies.DataCollection) {
        const buddyNum = clean(buddy.MobileNumber || buddy.ExtensionNumber || buddy.ContactNumber1);

        if (buddyNum.endsWith(target)) {
            return FindBuddyByIdentity(buddy.uID);
        }
    }

    console.warn("❌ No match found for number:", number);
    return null;
}

const messageOffsetMap = {};
const isLoadingMap = {};
// ✅ Define the function somewhere safe (e.g., after all top-level variable declarations)
function InitCallAndSMSHistory() {
    const senderPhone = localStorage.getItem("myPhoneNumber");
    if (!senderPhone || typeof profileUserID === "undefined") {
        setTimeout(InitCallAndSMSHistory, 200);
        return;
    }

    if (window.callSmsHistoryLoaded) return;
    window.callSmsHistoryLoaded = true;

    $("#HistoryLoader").show();

    // ✅ Always register socket for real-time SMS receiving
    const cleanSender = senderPhone.replace(/[^\d]/g, '');
    socket.emit("register", cleanSender);

    const callPromise = new Promise(resolve => FetchCallHistoryOnLogin(resolve));
    const smsPromise = sessionStorage.getItem("smsHistoryLoaded") === "yes"
        ? Promise.resolve()
        : new Promise(resolve => {
            FetchSMSHistoryOnLogin(() => {
                sessionStorage.setItem("smsHistoryLoaded", "yes");
                resolve();
            });
        });

    Promise.all([callPromise, smsPromise]).then(() => {
        $("#HistoryLoader").fadeOut();
    });
}

//user login ping 
// Start pinging every 60 seconds to keep session active
function startSessionPing() {
    const senderPhone = localStorage.getItem("myPhoneNumber");
    if (!senderPhone) return;

    setInterval(() => {
        fetch("https://bkpmanual.bitnexdial.com:3000/api/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderPhone })
        }).catch((e) => console.warn("Ping failed:", e));
    }, 60000); // every 1 min
}

// Call this after successful login
startSessionPing();


///////////////sms counter
function UpdateMySMSCounter() {
    const myNumber = localStorage.getItem("myPhoneNumber");
    if (!myNumber) return;

    const ts = Date.now(); // ⏱️ Cache buster
    fetch(`https://bkpmanual.bitnexdial.com:3000/api/sms-counter-user?number=${myNumber}&_=${ts}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
    })
        .then(res => res.json())
        .then(data => {
            const sms = data.sms || 0;
            const mms = data.mms || 0;


            $("#UserSMSCounter").html(`
      📨 <b>SMS Sent:</b> ${sms}<br>
      🖼️ <b>Images Sent:</b> ${mms}
    `);
        })
        .catch(err => console.error("❌ Failed to load SMS/MMS counter", err));

}

setInterval(() => {
    const senderPhone = localStorage.getItem("senderPhone");
    if (!senderPhone) return;

    fetch("https://bkpmanual.bitnexdial.com:3000/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderPhone })
    });
}, 60000); // every 60 seconds




function FetchSMSHistoryOnLogin(done) {
    const sender = localStorage.getItem("myPhoneNumber")?.trim();
    const validPhonePattern = /^\+1\d{10}$/;

    if (!validPhonePattern.test(sender)) {
        console.warn("❌ Invalid sender phone number:", sender);
        if (done) done();
        return;
    }

    const cleanSender = sender.replace(/[^\d]/g, '');

    fetch("https://bkpmanual.bitnexdial.com:3000/sms-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: cleanSender })
    })
        .then(res => res.json())
        .then(messages => {
            if (!Array.isArray(messages)) {
                console.warn("❌ Invalid SMS history response");
                if (done) done();
                return;
            }

            const deduped = new Set();

            messages.forEach(msg => {
                const otherParty = msg.sender.replace(/[^\d]/g, "") === cleanSender ? msg.receiver : msg.sender;
                const cleanOther = otherParty.replace(/[^\d]/g, "").replace(/^1/, "");

                let buddy = window.FindBuddyByPhoneNumber(cleanOther);
                if (!buddy) {
                    const newId = uID(), now = utcDateNow();
                    const newBuddyData = {
                        Type: "extension", LastActivity: now, ExtensionNumber: cleanOther,
                        MobileNumber: cleanOther, uID: newId, DisplayName: cleanOther,
                        ContactNumber1: "", ContactNumber2: "", cID: null, gID: null,
                        jid: null, Description: "", Email: "", MemberCount: 0,
                        EnableDuringDnd: false, Subscribe: false, missed: 0
                    };

                    let buddyList = JSON.parse(localDB.getItem(profileUserID + "-Buddies")) || InitUserBuddies();
                    buddyList.DataCollection.push(newBuddyData);
                    buddyList.TotalRows = buddyList.DataCollection.length;
                    localDB.setItem(profileUserID + "-Buddies", JSON.stringify(buddyList));

                    buddy = new Buddy("extension", newId, cleanOther, cleanOther, "", "", "", now, "", "", null, false, false);
                    AddBuddy(buddy, true, false, false, false);
                }

                const streamKey = buddy.identity + "-stream";
                let stream = JSON.parse(localStorage.getItem(streamKey)) || InitialiseStream(buddy.identity);

                const uniqueKey = msg.tx_rx_datetime + msg.body;
                if (deduped.has(uniqueKey)) return;
                deduped.add(uniqueKey);

                const isOutbound = msg.sender.replace(/[^\d]/g, "") === cleanSender;
                stream.DataCollection.push({
                    ItemId: uID(),
                    ItemType: "MSG",
                    ItemDate: msg.tx_rx_datetime,
                    SrcUserId: isOutbound ? profileUserID : buddy.identity,
                    Src: isOutbound ? `"${profileName}"` : `"${buddy.CallerIDName}"`,
                    DstUserId: isOutbound ? buddy.identity : profileUserID,
                    Dst: "",
                    MessageData: msg.body,
                    Direction: isOutbound ? "outbound" : "inbound"
                });

                stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
                localStorage.setItem(streamKey, JSON.stringify(stream));
                RefreshStream(buddy);
                UpdateBuddyActivity(buddy.identity);
            });

            if (done) done();
        })
        .catch(err => {
            console.error("❌ Failed to load SMS history:", err);
            if (done) done();
        });
}







function SendUnifiedMessage(buddy, { text = "", imageDataUrl = "" } = {}) {
    if (!userAgent || !userAgent.isRegistered()) return;

    const buddyObj = FindBuddyByIdentity(buddy);
    if (!buddyObj) return;

    const receiver = buddyObj.MobileNumber || buddyObj.ExtNo;
    const sender = localStorage.getItem("myPhoneNumber");
    const streamKey = buddy + "-stream";
    let stream = JSON.parse(localStorage.getItem(streamKey)) || InitialiseStream(buddy);
    const DateTime = moment.utc().format("YYYY-MM-DD HH:mm:ss UTC");
    const messageId = uID();

    const finalizeSend = (mediaUrl) => {
        const formattedText = ReformatMessage(text || "");
        const imageTag = mediaUrl ? `<br><img class="previewImage" src="${mediaUrl}" onclick="PreviewImage(this)">` : "";
        const finalMessage = formattedText + imageTag;

        stream.DataCollection.push({
            ItemId: messageId,
            ItemType: "MSG",
            ItemDate: DateTime,
            SrcUserId: profileUserID,
            Src: `"${profileName}"`,
            DstUserId: buddyObj.identity,
            Dst: "",
            MessageData: finalMessage
        });

        stream.TotalRows = stream.DataCollection.length;
        localStorage.setItem(streamKey, JSON.stringify(stream));

        socket.emit("send-sms", {
            from: sender,
            to: receiver,
            message: text || "",
            mediaUrl: mediaUrl || undefined
        });

        socket.once("sms-sent", (data) => {
            if (data.success) MarkMessageSent(buddyObj, messageId, true);
            else MarkMessageNotSent(buddyObj, messageId, true);
            UpdateMySMSCounter();
        });

        RefreshStream(buddyObj);
        updateScroll(buddy);
        UpdateBuddyActivity(buddy);

        if (imageDataUrl) ImageEditor_Cancel(buddy);
        $("#contact-" + buddy + "-ChatMessage").val("").focus();
    };

    if (imageDataUrl) {
        const blob = dataURItoBlob(imageDataUrl);
        const fileName = Date.now() + "-" + Math.floor(Math.random() * 1000000) + ".png";

        const formData = new FormData();
        formData.append("file", blob, fileName);
        formData.append("sender", sender);
        formData.append("receiver", receiver);

        fetch("https://bkpmanual.bitnexdial.com:3000/upload", {
            method: "POST",
            body: formData
        })
            .then(res => res.json())
            .then(result => {
                const mediaUrl = result.path.startsWith("http") ? result.path : `https://bkpmanual.bitnexdial.com${result.path}`;
                finalizeSend(mediaUrl);
            })
            .catch(err => {
                console.error("❌ Upload failed:", err);
            });
    } else {
        finalizeSend("");
    }
}


function setupScrollForBuddy(buddyId) {
    const chatBox = document.getElementById(`contact-${buddyId}-ChatHistory`);
    if (!chatBox) return;

    // Remove existing scroll handler if any
    if (chatBox._scrollHandler) {
        chatBox.removeEventListener("scroll", chatBox._scrollHandler);
    }

    let debounceTimer = null;

    const scrollHandler = function () {
        if (debounceTimer || isLoadingMap[buddyId]) return;

        if (chatBox.scrollTop === 0) {
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
            }, 800); // block multiple triggers for 800ms

            isLoadingMap[buddyId] = true;

            const currentOffset = messageOffsetMap[buddyId] || 0;
            const nextOffset = currentOffset + 50;

            loadMoreMessages(buddyId, nextOffset).then(() => {
                messageOffsetMap[buddyId] = nextOffset;
                isLoadingMap[buddyId] = false;
            }).catch(() => {
                console.warn("⚠️ Failed to load more messages.");
                isLoadingMap[buddyId] = false;
            });
        }
    };

    chatBox._scrollHandler = scrollHandler;
    chatBox.addEventListener("scroll", scrollHandler);
} function prependMessagesToStream(buddyId, messages) {
    const chatBox = document.getElementById(`contact-${buddyId}-ChatHistory`);
    if (!chatBox || messages.length === 0) return;

    const buddyObj = FindBuddyByIdentity(buddyId);
    if (!buddyObj) return;

    const senderNumber = (localStorage.getItem("myPhoneNumber") || "").replace(/[^\d]/g, "");
    const buddyNumber = (buddyObj.MobileNumber || buddyObj.ExtNo || buddyObj.ContactNumber1 || "").replace(/[^\d]/g, "");

    const streamKey = buddyId + "-stream";
    let stream = JSON.parse(localStorage.getItem(streamKey));
    if (!stream || !Array.isArray(stream.DataCollection)) {
        stream = InitialiseStream(buddyId);
    }

    // 1️⃣ Record anchor element for scroll restore
    const anchor = chatBox.querySelector("[data-msgid]");
    const anchorId = anchor?.getAttribute("data-msgid");
    const anchorOffset = anchor?.getBoundingClientRect().top || 0;

    messages.sort((a, b) => new Date(a.tx_rx_datetime) - new Date(b.tx_rx_datetime));

    messages.forEach(msg => {
        const cleanSender = (msg.sender || "").replace(/[^\d]/g, "");
        const isOutbound = cleanSender.endsWith(senderNumber);
        const remoteNumber = (isOutbound ? msg.receiver : msg.sender).replace(/[^\d]/g, "").replace(/^1/, "");

        if (!buddyNumber.endsWith(remoteNumber)) return;

        const item = {
            ItemId: uID(),
            ItemType: "MSG",
            ItemDate: msg.tx_rx_datetime,
            SrcUserId: isOutbound ? profileUserID : buddyObj.identity,
            Src: isOutbound ? `"${profileName}"` : `"${buddyObj.CallerIDName}"`,
            DstUserId: isOutbound ? buddyObj.identity : profileUserID,
            Dst: "",
            MessageData: msg.body
        };

        stream.DataCollection.push(item);
    });

    stream._skipTrim = true;
    stream.DataCollection.sort((a, b) => new Date(a.ItemDate) - new Date(b.ItemDate));
    localStorage.setItem(streamKey, JSON.stringify(stream));

    // 2️⃣ Re-render with RefreshStream
    RefreshStream(buddyObj);

    // 3️⃣ Scroll back to anchor message after refresh
    if (anchorId) {
        const restored = chatBox.querySelector(`[data-msgid="${anchorId}"]`);
        if (restored) {
            const newOffset = restored.getBoundingClientRect().top;
            const scrollAdjustment = newOffset - anchorOffset;
            chatBox.scrollTop += scrollAdjustment;
        }
    }

    UpdateBuddyActivity(buddyId);
}







function loadMoreMessages(buddyId, offset = 0) {
    const myPhone = (localStorage.getItem("myPhoneNumber") || "").replace(/[^\d]/g, "");
    const buddyObj = FindBuddyByIdentity(buddyId);
    const contact = (buddyObj?.MobileNumber || buddyObj?.ExtNo || buddyObj?.ContactNumber1 || "").replace(/[^\d]/g, "");

    if (!myPhone || !contact) {
        console.warn("⚠️ Missing phone number or contact for", buddyId);
        return Promise.reject("Missing phone/contact");
    }

    const payload = {
        number: myPhone,
        contact: contact,
        limit: 50,
        offset: offset
    };


    return fetch("https://bkpmanual.bitnexdial.com:3000/sms-history-paginated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} - ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {

            // ✅ Stop future fetches if fewer than 50
            if (data.length < 50) {
                isLoadingMap[buddyId] = true; // Lock it
            }

            prependMessagesToStream(buddyId, data);
        })

        .catch(err => {
            console.error("❌ Error in loadMoreMessages:", err);
            throw err;
        });
}



function InitialiseStream(buddy) {
    var template = { TotalRows: 0, DataCollection: [] }
    localDB.setItem(buddy + "-stream", JSON.stringify(template));
    return JSON.parse(localDB.getItem(buddy + "-stream"));
}
// Emit 'typing' when user types into chat box
$(document).on("input", "textarea.chatMessage", function () {
    const sender = localStorage.getItem("myPhoneNumber");
    const buddyId = $(this).attr("id").split("-")[1]; // e.g. contact-123-ChatMessage
    const buddyObj = FindBuddyByIdentity(buddyId);
    if (!sender || !buddyObj) return;

    const recipient = buddyObj.MobileNumber || buddyObj.ExtNo;
    if (recipient) {
        socket.emit("typing", { from: sender, to: recipient });
    }
});



function SendChatMessage(buddy) {
    const input = $("#contact-" + buddy + "-ChatMessage");
    const message = $.trim(input.val());

    if (!userAgent || !userAgent.isRegistered()) return;
    if (!message) {
        Alert(lang.alert_empty_text_message, lang.no_message);
        return;
    }

    SendUnifiedMessage(buddy, {
        text: message
    });

    input.val("").focus();
    $("#contact-" + buddy + "-dictate-message").hide();
    $("#contact-" + buddy + "-emoji-menu").hide();

    const buddyObj = FindBuddyByIdentity(buddy);
    if (buddyObj && buddyObj.recognition) {
        buddyObj.recognition.abort();
        buddyObj.recognition = null;
    }
}

function MarkMessageSent(buddyObj, messageId, refresh) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream != null || currentStream.DataCollection != null) {
        $.each(currentStream.DataCollection, function (i, item) {
            if (item.ItemType == "MSG" && item.ItemId == messageId) {
                // Found
                item.Sent = true;
                return false;
            }
        });
        localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));

        if (refresh) RefreshStream(buddyObj);
    }
}
function MarkMessageNotSent(buddyObj, messageId, refresh) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream != null || currentStream.DataCollection != null) {
        $.each(currentStream.DataCollection, function (i, item) {
            if (item.ItemType == "MSG" && item.ItemId == messageId) {
                // Found
                item.Sent = false;
                return false;
            }
        });
        localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));

        if (refresh) RefreshStream(buddyObj);
    }
}
function MarkDeliveryReceipt(buddyObj, messageId, refresh) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream != null || currentStream.DataCollection != null) {
        $.each(currentStream.DataCollection, function (i, item) {
            if (item.ItemType == "MSG" && item.ItemId == messageId) {
                // Found
                item.Delivered = { state: true, eventTime: utcDateNow() };
                return false;
            }
        });
        localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));

        if (refresh) RefreshStream(buddyObj);
    }
}
function MarkDisplayReceipt(buddyObj, messageId, refresh) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream != null || currentStream.DataCollection != null) {
        $.each(currentStream.DataCollection, function (i, item) {
            if (item.ItemType == "MSG" && item.ItemId == messageId) {
                // Found
                item.Displayed = { state: true, eventTime: utcDateNow() };
                return false;
            }
        });
        localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));

        if (refresh) RefreshStream(buddyObj);
    }
}
function MarkMessageRead(buddyObj, messageId) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream != null || currentStream.DataCollection != null) {
        $.each(currentStream.DataCollection, function (i, item) {
            if (item.ItemType == "MSG" && item.ItemId == messageId) {
                // Found
                item.Read = { state: true, eventTime: utcDateNow() };
                // return false; /// Mark all messages matching that id to avoid 
                // duplicate id issue
            }
        });
        localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));
    }
}

function ReceiveOutOfDialogMessage(message) {
    var callerID = message.request.from.displayName;
    var did = message.request.from.uri.normal.user;

    // Out of dialog Message Receiver
    var messageType = (message.request.headers["Content-Type"].length >= 1) ? message.request.headers["Content-Type"][0].parsed : "Unknown";
    // Text Messages
    if (messageType.indexOf("text/plain") > -1) {
        // Plain Text Messages SIP SIMPLE

        if (did.length > DidLength) {
            // Contacts cannot receive Test Messages, because they cannot reply
            // This may change with FAX, Email, WhatsApp etc
            console.warn("DID length greater then extensions length")
            return;
        }

        var CurrentCalls = countSessions("0");

        var buddyObj = FindBuddyByDid(did);
        // Make new contact of its not there
        if (buddyObj == null) {
            var json = JSON.parse(localDB.getItem(profileUserID + "-Buddies"));
            if (json == null) json = InitUserBuddies();

            // Add Extension
            var id = uID();
            var dateNow = utcDateNow();
            json.DataCollection.push({
                Type: "extension",
                LastActivity: dateNow,
                ExtensionNumber: did,
                MobileNumber: "",
                ContactNumber1: "",
                ContactNumber2: "",
                uID: id,
                cID: null,
                gID: null,
                jid: null,
                DisplayName: callerID,
                Description: "",
                Email: "",
                MemberCount: 0,
                EnableDuringDnd: false,
                Subscribe: false
            });
            buddyObj = new Buddy("extension", id, callerID, did, "", "", "", dateNow, "", "", jid, false, false);

            // Add memory object
            AddBuddy(buddyObj, true, (CurrentCalls == 0), false, tue);

            // Update Size: 
            json.TotalRows = json.DataCollection.length;

            // Save To DB
            localDB.setItem(profileUserID + "-Buddies", JSON.stringify(json));
        }

        var originalMessage = message.request.body;
        var messageId = uID();
        var DateTime = utcDateNow();

        message.accept();

        AddMessageToStream(buddyObj, messageId, "MSG", originalMessage, DateTime)
        UpdateBuddyActivity(buddyObj.identity);
        RefreshStream(buddyObj);
        ActivateStream(buddyObj, originalMessage);
    }
    // Message Summary
    else if (messageType.indexOf("application/simple-message-summary") > -1) {
        console.warn("This message-summary is unsolicited (out-of-dialog). Consider using the SUBSCRIBE method.")
        VoicemailNotify(message);
    }
    else {
        console.warn("Unknown Out Of Dialog Message Type: ", messageType);
        message.reject();
    }
    // Custom Web hook
    if (typeof web_hook_on_message !== 'undefined') web_hook_on_message(message);
}
function AddMessageToStream(buddyObj, messageId, type, message, DateTime) {
    var currentStream = JSON.parse(localDB.getItem(buddyObj.identity + "-stream"));
    if (currentStream == null) currentStream = InitialiseStream(buddyObj.identity);

    // Add New Message
    var newMessageJson = {
        ItemId: messageId,
        ItemType: type,
        ItemDate: DateTime,
        SrcUserId: buddyObj.identity,
        Src: "\"" + buddyObj.CallerIDName + "\"",
        DstUserId: profileUserID,
        Dst: "",
        MessageData: message
    }

    currentStream.DataCollection.push(newMessageJson);
    currentStream.TotalRows = currentStream.DataCollection.length;
    localDB.setItem(buddyObj.identity + "-stream", JSON.stringify(currentStream));

    // Data Cleanup
    if (MaxDataStoreDays && MaxDataStoreDays > 0) {
        RemoveBuddyMessageStream(FindBuddyByIdentity(buddy), MaxDataStoreDays);
    }
}
function ActivateStream(buddyObj, message) {
    // Handle Stream Not visible
    // =========================
    var streamVisible = $("#stream-" + buddyObj.identity).is(":visible");
    if (!streamVisible) {
        // Add or Increase the Badge
        IncreaseMissedBadge(buddyObj.identity);
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                var imageUrl = getPicture(buddyObj.identity);
                var noticeOptions = { body: message.substring(0, 250), icon: imageUrl }
                var inComingChatNotification = new Notification(lang.message_from + " : " + buddyObj.CallerIDName, noticeOptions);
                inComingChatNotification.onclick = function (event) {
                    // Show Message
                    SelectBuddy(buddyObj.identity);
                }
            }
        }
        // Play Alert
        var ringer = new Audio(audioBlobs.Alert.blob);
        ringer.preload = "auto";
        ringer.loop = false;
        ringer.oncanplaythrough = function (e) {
            if (typeof ringer.sinkId !== 'undefined' && getRingerOutputID() != "default") {
                ringer.setSinkId(getRingerOutputID()).then(function () {
                    console.log("Set sinkId to:", getRingerOutputID());
                }).catch(function (e) {
                    console.warn("Failed not apply setSinkId.", e);
                });
            }
            // If there has been no interaction with the page at all... this page will not work
            ringer.play().then(function () {
                // Audio Is Playing
            }).catch(function (e) {
                console.warn("Unable to play audio file.", e);
            });
        }
        // message.data.ringerObj = ringer;
    } else {
        // Message window is active.
    }
}
function AddCallMessage(buddy, session) {

    var currentStream = JSON.parse(localDB.getItem(buddy + "-stream"));
    if (currentStream == null) currentStream = InitialiseStream(buddy);

    var CallEnd = moment.utc(); // Take Now as the Hangup Time
    var callDuration = 0;
    var totalDuration = 0;
    var ringTime = 0;

    var CallStart = moment.utc(session.data.callstart.replace(" UTC", "")); // Actual start (both inbound and outbound)
    var CallAnswer = null; // On Accept when inbound, Remote Side when Outbound
    if (session.data.startTime) {
        // The time when WE answered the call (May be null - no answer)
        // or
        // The time when THEY answered the call (May be null - no answer)
        CallAnswer = moment.utc(session.data.startTime);  // Local Time gets converted to UTC 

        callDuration = moment.duration(CallEnd.diff(CallAnswer));
        ringTime = moment.duration(CallAnswer.diff(CallStart));
    }
    else {
        // There was no start time, but on inbound/outbound calls, this would indicate the ring time
        ringTime = moment.duration(CallEnd.diff(CallStart));
    }
    totalDuration = moment.duration(CallEnd.diff(CallStart));

    var srcId = "";
    var srcCallerID = "";
    var dstId = ""
    var dstCallerID = "";
    if (session.data.calldirection == "inbound") {
        srcId = buddy;
        dstId = profileUserID;
        srcCallerID = session.remoteIdentity.displayName;
        dstCallerID = profileName;
    } else if (session.data.calldirection == "outbound") {
        srcId = profileUserID;
        dstId = buddy;
        srcCallerID = myPhoneNumber;
        dstCallerID = session.data.dst;
    }

    var callDirection = session.data.calldirection;
    var withVideo = session.data.withvideo;
    var sessionId = session.id;
    var hangupBy = session.data.terminateby;

    var newMessageJson = {
        CdrId: uID(),
        ItemType: "CDR",
        ItemDate: CallStart.format("YYYY-MM-DD HH:mm:ss UTC"),
        CallAnswer: (CallAnswer) ? CallAnswer.format("YYYY-MM-DD HH:mm:ss UTC") : null,
        CallEnd: CallEnd.format("YYYY-MM-DD HH:mm:ss UTC"),
        SrcUserId: srcId,
        Src: srcCallerID,
        DstUserId: dstId,
        Dst: dstCallerID,
        RingTime: (ringTime != 0) ? ringTime.asSeconds() : 0,
        Billsec: (callDuration != 0) ? callDuration.asSeconds() : 0,
        TotalDuration: (totalDuration != 0) ? totalDuration.asSeconds() : 0,
        ReasonCode: session.data.reasonCode,
        ReasonText: session.data.reasonText,
        WithVideo: withVideo,
        SessionId: sessionId,
        CallDirection: callDirection,
        Terminate: hangupBy,
        // CRM
        MessageData: (() => {
            if (
                callDirection === "inbound" &&
                (
                    session.data.earlyReject ||
                    (session.data.terminateby === "them" && !session.data.startTime && session.data.reasonCode === 0)
                )
            ) {
                return `<span style="color:red;">📞 Missed Call</span>`;
            }
            if (callDirection === "inbound") {
                return `<span style="color:green;">📞 Incoming Call</span>`;
            }
            return `<span>📞 Outgoing Call</span>`;
        })(),


        Tags: [],
        //Reporting
        Transfers: (session.data.transfer) ? session.data.transfer : [],
        Mutes: (session.data.mute) ? session.data.mute : [],
        Holds: (session.data.hold) ? session.data.hold : [],
        Recordings: (session.data.recordings) ? session.data.recordings : [],
        ConfCalls: (session.data.confcalls) ? session.data.confcalls : [],
        ConfbridgeEvents: (session.data.ConfbridgeEvents) ? session.data.ConfbridgeEvents : [],
        QOS: []
    }

    try {
        const payload = {
            caller: srcCallerID.replace(/[^\d]/g, '').replace(/^1/, ''),
            callee: dstCallerID.replace(/[^\d]/g, '').replace(/^1/, ''),
            direction: callDirection,
            start_time: CallStart.format("YYYY-MM-DD HH:mm:ss"),
            answer_time: CallAnswer ? CallAnswer.format("YYYY-MM-DD HH:mm:ss") : null,
            end_time: CallEnd.format("YYYY-MM-DD HH:mm:ss"),
            duration: Math.floor(totalDuration.asSeconds()),
            ring_time: Math.floor(ringTime.asSeconds()),
            terminated_by: hangupBy,
            reason_code: session.data.reasonCode || null,
            reason_text: session.data.reasonText || null,
            session_id: sessionId,
            with_video: withVideo ? 1 : 0
        };

        fetch("https://bkpmanual.bitnexdial.com:3000/api/save-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    console.log("📞✅ Call record stored in MySQL");
                } else {
                    console.warn("📞❌ Failed to store call record");
                }
            })
            .catch(err => console.error("📞❌ Error saving call record:", err));
    } catch (err) {
        console.error("📞❌ Crash in call record saving:", err);
    }


    currentStream.DataCollection.push(newMessageJson);
    currentStream.TotalRows = currentStream.DataCollection.length;
    localDB.setItem(buddy + "-stream", JSON.stringify(currentStream));

    UpdateBuddyActivity(buddy);

    // Data Cleanup
    if (MaxDataStoreDays && MaxDataStoreDays > 0) {
        RemoveBuddyMessageStream(FindBuddyByIdentity(buddy), MaxDataStoreDays);
    }

}




function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// IMG SMS////////////////////////////////////////////////////
function SendImageDataMessage(buddy, ImgDataUrl) {
    if (userAgent == null) return;
    if (!userAgent.isRegistered()) return;

    const sender = localStorage.getItem("myPhoneNumber");
    const buddyObj = FindBuddyByIdentity(buddy);
    const receiver = buddyObj?.MobileNumber || buddyObj?.ExtNo;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const mimeType = ImgDataUrl.split(";")[0].split(":")[1]; // For base64

    if (!allowedTypes.includes(mimeType)) {
        alert("❌ Unsupported file type. Please upload JPEG, PNG, or GIF images.");
        return;
    }

    const blob = dataURItoBlob(ImgDataUrl);
    let extension = "";

    if (blob.type.includes("png")) extension = "png";
    else if (blob.type.includes("jpeg")) extension = "jpg";
    else if (blob.type.includes("jpg")) extension = "jpg";
    else if (blob.type.includes("gif")) extension = "gif";
    else {
        alert("❌ This image type is not supported. Please upload JPG, PNG, or GIF only.");
        return;
    }

    const fileName = Date.now() + "-" + Math.floor(Math.random() * 1000000) + "." + extension;

    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("sender", sender);
    formData.append("receiver", receiver);

    fetch("https://bkpmanual.bitnexdial.com:3000/upload", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .then(result => {
            const fileUrl = result.path || ImgDataUrl;
            const DateTime = moment.utc().format("YYYY-MM-DD HH:mm:ss UTC");
            const formattedMessage = '<IMG class=previewImage onClick="PreviewImage(this)" src="' + fileUrl + '">';
            const messageString = "<table class=ourChatMessage cellspacing=0 cellpadding=0><tr><td style=\"width: 80px\">"
                + "<div class=messageDate>" + DateTime + "</div>"
                + "</td><td>"
                + "<div class=ourChatMessageText>" + formattedMessage + "</div>"
                + "</td></tr></table>";
        })
        .catch(err => {
            console.error("❌ Upload failed:", err);
        });

    ImageEditor_Cancel(buddy);
}



// SEND FILES/////////////////////////////////////////////////
function SendFileDataMessage(buddy, FileDataUrl, fileName, fileSize) {
    if (userAgent == null || !userAgent.isRegistered()) return;

    const fileID = uID();
    const buddyObj = FindBuddyByIdentity(buddy);
    const receiver = buddyObj?.MobileNumber || buddyObj?.ExtNo;
    const sender = localStorage.getItem("myPhoneNumber") || "";

    // ✅ Allowed MIME types (Twilio supported)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const mimeType = FileDataUrl.split(";")[0].split(":")[1];

    if (!allowedTypes.includes(mimeType)) {
        alert("❌ Unsupported file type. Please upload JPG, PNG, or GIF.");
        return;
    }

    const formData = new FormData();
    formData.append("file", dataURItoBlob(FileDataUrl), fileName);
    formData.append("sender", sender);
    formData.append("receiver", receiver);

    // Upload
    $.ajax({
        type: 'POST',
        url: 'https://bkpmanual.bitnexdial.com:3000/upload',
        data: formData,
        contentType: false,
        processData: false,
        xhr: function () {
            const myXhr = $.ajaxSettings.xhr();
            if (myXhr.upload) {
                myXhr.upload.addEventListener('progress', function (event) {
                    const percent = (event.loaded / event.total) * 100;
                    $("#FileProgress-Bar-" + fileID).css("width", percent + "%");
                }, false);
            }
            return myXhr;
        },
        success: function (response) {
            $("#FileUpload-" + fileID).html("Sent");
            $("#FileProgress-" + fileID).hide();
            $("#FileProgress-Bar-" + fileID).css("width", "0%");

            let fileUrl = response.path;

            // ✅ Fix: Prepend domain if relative path
            if (!fileUrl.startsWith("http")) {
                fileUrl = "https://bkpmanual.bitnexdial.com" + fileUrl;
            }


            socket.emit("send-sms", {
                from: sender,
                to: receiver,
                message: "",
                mediaUrl: fileUrl
            });

            socket.once("sms-sent", (data) => {
                if (data.success) {
                    UpdateMySMSCounter();
                } else {
                    console.error("❌ Twilio message failed to send:", data.error);
                }
            });
        },



        error: function (xhr, status, err) {
            console.error("❌ Upload failed:", err);
            $("#FileUpload-" + fileID).html("Failed (" + xhr.status + ")");
            $("#FileProgress-" + fileID).hide();
            $("#FileProgress-Bar-" + fileID).css("width", "100%");
        }
    });

    // Show in chat
    const DateTime = utcDateNow();
    const isImage = allowedTypes.includes(mimeType);
    let fileIcon = '<i class="fa fa-file"></i>';
    if (mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/gif") {
        fileIcon = '<i class="fa fa-file-image-o"></i>';
    }

    let formattedMessage = `<div><span id="FileUpload-${fileID}">Sending</span>: ${fileIcon} ${fileName}</div>`;
    formattedMessage += `<div id="FileProgress-${fileID}" class="progressBarContainer"><div id="FileProgress-Bar-${fileID}" class="progressBarTrack"></div></div>`;
    if (isImage) {
        formattedMessage += `<div><img class="previewImage" onclick="PreviewImage(this)" src="${FileDataUrl}"></div>`;
    }

    const messageString = `<table class=ourChatMessage cellspacing=0 cellpadding=0><tr><td style="width: 80px">
        <div class=messageDate>${DateTime}</div>
        </td><td>
        <div class=ourChatMessageText>${formattedMessage}</div>
        </td></tr></table>`;

    ImageEditor_Cancel(buddy);
}
function updateLineScroll(lineNum) {
    RefreshLineActivity(lineNum);

    var element = $("#line-" + lineNum + "-CallDetails").get(0);
    if (element) element.scrollTop = element.scrollHeight;
}


function updateScroll(buddy) {
    var history = $("#contact-" + buddy + "-ChatHistory");
    try {
        if (history.children().length > 0) history.children().last().get(0).scrollIntoView(false);
        history.get(0).scrollTop = history.get(0).scrollHeight;
    } catch (e) { }
}
function PreviewImage(obj) {
    OpenWindow(obj.src, "Preview Image", 600, 800, false, true); //no close, no resize
}






// Missed Item Notification
// ========================
function IncreaseMissedBadge(buddy) {
    var buddyObj = FindBuddyByIdentity(buddy);
    if (buddyObj == null) return;

    // Up the Missed Count
    // ===================
    buddyObj.missed += 1;

    // Take Out
    var json = JSON.parse(localDB.getItem(profileUserID + "-Buddies"));
    if (json != null) {
        $.each(json.DataCollection, function (i, item) {
            if (item.uID == buddy || item.cID == buddy || item.gID == buddy) {
                item.missed = item.missed + 1;
                return false;
            }
        });
        // Put Back
        localDB.setItem(profileUserID + "-Buddies", JSON.stringify(json));
    }
    const streamVisible = $("#stream-" + buddyObj.identity).is(":visible");
    if (streamVisible) {
        ClearMissedBadge(buddyObj.identity);
        return; // No need to increase missed count
    }


    // Update Badge
    // ============
    $("#contact-" + buddy + "-missed").text(buddyObj.missed);
    $("#contact-" + buddy + "-missed").show();

    // Custom Web hook
    if (typeof web_hook_on_missed_notify !== 'undefined') web_hook_on_missed_notify(buddyObj.missed);

}

function UpdateBuddyActivity(buddy, lastAct) {
    var buddyObj = FindBuddyByIdentity(buddy);
    if (buddyObj == null) return;

    // Update Last Activity Time
    // =========================
    if (lastAct) {
        buddyObj.lastActivity = lastAct;
    }
    else {
        var timeStamp = utcDateNow();
        buddyObj.lastActivity = timeStamp;
    }

    // Take Out
    var json = JSON.parse(localDB.getItem(profileUserID + "-Buddies"));
    if (json != null) {
        $.each(json.DataCollection, function (i, item) {
            if (item.uID == buddy || item.cID == buddy || item.gID == buddy) {
                item.LastActivity = timeStamp;
                return false;
            }
        });
        // Put Back
        localDB.setItem(profileUserID + "-Buddies", JSON.stringify(json));
    }

    // List Update
    // ===========
    UpdateBuddyList();
}

function ClearMissedBadge(buddy) {
    var buddyObj = FindBuddyByIdentity(buddy);
    if (buddyObj == null) return;

    buddyObj.missed = 0;

    // Take Out
    var json = JSON.parse(localDB.getItem(profileUserID + "-Buddies"));
    if (json != null) {
        $.each(json.DataCollection, function (i, item) {
            if (item.uID == buddy || item.cID == buddy || item.gID == buddy) {
                item.missed = 0;
                return false;
            }
        });
        // Put Back
        localDB.setItem(profileUserID + "-Buddies", JSON.stringify(json));
    }

    $("#contact-" + buddy + "-missed").text(buddyObj.missed);
    $("#contact-" + buddy + "-missed").hide(400);

    if (typeof web_hook_on_missed_notify !== 'undefined') web_hook_on_missed_notify(buddyObj.missed);
}
///////////////////////SMS Section
window.FixedConferenceManager = FixedConferenceManager;


/////////////////////////////////////////
function fixConferenceSystem() {

    // Store reference to original function
    const originalCreateAutoConference = window.phoneSystem?.conferenceManager?.createAutoConference;

    // Create working simple conference function
    async function workingSimpleConference(participantNumber) {
        try {
            console.log(`🚀 FIXED: Starting simple 3-way with ${participantNumber}`);

            // Find active line that's not in conference
            let activeLineNumber = null;
            for (let i = 0; i < window.Lines.length; i++) {
                const line = window.Lines[i];
                if (line?.SipSession?.state === 'Established' && !line.isInConference) {
                    activeLineNumber = i + 1;
                    break;
                }
            }

            if (!activeLineNumber) {
                throw new Error('No available active call found. Make sure you have a connected call first.');
            }

            console.log(`✅ Found active call on line ${activeLineNumber}`);

            // Put current call on hold
            console.log('⏸️ Putting current call on hold...');
            if (window.phoneSystem?.holdCall) {
                await window.phoneSystem.holdCall(activeLineNumber);
                console.log('✅ Call placed on hold');
            }

            // Make call to participant
            console.log(`📞 Calling participant: ${participantNumber}`);

            // Format number
            let cleanNumber = participantNumber.replace(/[^\d]/g, '');
            if (cleanNumber.length === 10) {
                cleanNumber = `+1${cleanNumber}`;
            }

            const participantLine = await window.phoneSystem.makeCall(cleanNumber);
            console.log(`✅ Participant call started on line ${participantLine}`);

            // Wait for participant to answer
            let attempts = 0;
            const maxAttempts = 60; // 30 seconds

            const waitForAnswer = () => {
                return new Promise((resolve) => {
                    const checkAnswer = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            resolve(false);
                            return;
                        }

                        const pLine = window.Lines[participantLine - 1];
                        if (pLine?.SipSession?.state === 'Established') {
                            resolve(true);
                        } else if (pLine?.SipSession?.state === 'Terminated') {
                            resolve(false);
                        } else {
                            setTimeout(checkAnswer, 500);
                        }
                    };
                    setTimeout(checkAnswer, 1000);
                });
            };

            const answered = await waitForAnswer();

            if (!answered) {
                console.warn('❌ Participant did not answer');
                // End participant call and resume original
                if (window.phoneSystem?.endCall) {
                    await window.phoneSystem.endCall(participantLine);
                }
                if (window.phoneSystem?.unholdCall) {
                    await window.phoneSystem.unholdCall(activeLineNumber);
                }
                throw new Error('Participant did not answer the call');
            }

            console.log('✅ Participant answered!');

            // Resume original call
            console.log('▶️ Resuming original call...');
            if (window.phoneSystem?.unholdCall) {
                await window.phoneSystem.unholdCall(activeLineNumber);
                console.log('✅ Original call resumed');
            }

            // Mark both lines as in conference
            const hostLine = window.Lines[activeLineNumber - 1];
            const participantLineObj = window.Lines[participantLine - 1];

            if (hostLine) {
                hostLine.isInConference = true;
                hostLine.conferenceParticipants = [participantLine];
            }

            if (participantLineObj) {
                participantLineObj.isInConference = true;
                participantLineObj.conferenceHost = activeLineNumber;
            }

            console.log('🎉 Simple 3-way conference created successfully!');

            // Dispatch event
            window.dispatchEvent(new CustomEvent('conferenceStarted', {
                detail: {
                    conferenceId: `simple_${Date.now()}`,
                    hostLine: activeLineNumber,
                    participantLine: participantLine,
                    type: 'simple_3way'
                }
            }));

            return `simple_${Date.now()}`;

        } catch (error) {
            console.error('❌ Simple conference failed:', error);
            throw error;
        }
    }

    // Override the problematic functions
    if (window.phoneSystem?.conferenceManager) {
        window.phoneSystem.conferenceManager.createAutoConference = workingSimpleConference;
    }

    // Add global functions
    window.startSimpleConference = workingSimpleConference;
    window.startInstantConference = workingSimpleConference;
// ===== GLOBAL CALL STATE TRACKING =====
    window.activeCallMetrics = new Map(); // Track call metrics by line number

    function storeCallMetrics(lineNumber, metrics) {
        window.activeCallMetrics.set(lineNumber, {
            ...metrics,
            timestamp: Date.now()
        });
    }

function getCallMetrics(lineNumber) {
    const metrics = window.activeCallMetrics.get(lineNumber);
    return metrics || {};
}

function clearCallMetrics(lineNumber) {
    window.activeCallMetrics.delete(lineNumber);
}
    window.endSimpleConference = async (conferenceId) => {

        // Find conference lines
        const conferenceLines = [];
        window.Lines.forEach((line, index) => {
            if (line?.isInConference) {
                conferenceLines.push(index + 1);
            }
        });

        // End all conference lines except the first one (keep host call)
        for (let i = 1; i < conferenceLines.length; i++) {
            const lineNumber = conferenceLines[i];
            if (window.phoneSystem?.endCall) {
                await window.phoneSystem.endCall(lineNumber);
            }
        }

        // Clean up conference markers
        window.Lines.forEach(line => {
            if (line?.isInConference) {
                line.isInConference = false;
                line.conferenceParticipants = [];
                line.conferenceHost = null;
            }
        });

    };

    window.isLineInConference = (lineNumber) => {
        const line = window.Lines[lineNumber - 1];
        return line?.isInConference === true;
    };

    window.getSimpleConferenceInfo = (lineNumber) => {
        const line = window.Lines[lineNumber - 1];
        if (!line?.isInConference) return null;

        return {
            lineNumber: lineNumber,
            isHost: !!line.conferenceParticipants,
            participants: line.conferenceParticipants || [],
            hostLine: line.conferenceHost || lineNumber
        };
    };

}

// Apply the fix
if (typeof window !== 'undefined') {
    // Apply immediately if phone system is ready
    if (window.phoneSystem) {
        fixConferenceSystem();
    }

    // Also apply when phone system becomes ready
    window.addEventListener('phoneSystemReady', fixConferenceSystem);

    // Apply after a delay to ensure everything is loaded
    setTimeout(fixConferenceSystem, 2000);
}
// ===== INTERCEPT GLOBAL CALL END EVENTS =====
window.addEventListener('globalCallEnd', function() {
    
    // Find any active lines with stored metrics
    window.Lines.forEach((line, index) => {
        if (line && line.SipSession && window.activeCallMetrics.has(index + 1)) {
            const metrics = getCallMetrics(index + 1);
            
            // Dispatch enhanced call end event with metrics
            window.dispatchEvent(new CustomEvent('callEndWithMetrics', {
                detail: {
                    lineNumber: index + 1,
                    callerNumber: metrics.callerNumber,
                    callerName: metrics.callerName,
                    direction: metrics.direction,
                    startTime: metrics.startTime,
                    endTime: new Date().toISOString()
                }
            }));
        }
    });
});

// ===== ENHANCED GLOBAL FUNCTION FOR REACT COMPONENTS =====
window.getEnhancedCallMetrics = function(lineNumber) {
    const lineObj = window.Lines?.[lineNumber - 1];
    const storedMetrics = getCallMetrics(lineNumber);
    
    return {
        lineNumber: lineNumber,
        callerNumber: storedMetrics?.callerNumber || lineObj?.CallerIDNumber || 'unknown',
        callerName: storedMetrics?.callerName || lineObj?.CallerIDName || 'Unknown',
        direction: storedMetrics?.direction || lineObj?.direction || 'unknown',
        startTime: storedMetrics?.startTime || (lineObj?.startTime ? lineObj.startTime.toISOString() : null),
        callId: storedMetrics?.callId || lineObj?.callId || null
    };
};

////////////////////////////////////////
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.modernPhoneSystem;
}