/**
 * Modern SIP Phone System for FreePBX/PJSIP
 * Production-grade TypeScript implementation
 * Compatible with React and vanilla JS
 */


import { 
  UserAgent, 
  Inviter, 
  Invitation,
  SessionState,
  RegistererState,
  Registerer,
  UserAgentOptions,
  InviterOptions,
  SessionDescriptionHandler,
  SessionDescriptionHandlerOptions
   
} from 'sip.js';

// ===== TYPE DEFINITIONS =====
export interface FreePBXConfig {
  server: string;           // e.g., "bkpmanual.bitnexdial.com" 
  port: number;            // e.g., 4443
  path: string;            // e.g., "/ws"
  domain: string;          // e.g., "bkpmanual.bitnexdial.com"
  username: string;        // SIP username from admin system
  password: string;        // SIP password from admin system
  displayName: string;     // Full name from admin system
  userAgent?: string;
}

export interface CallSession {
  id: string;
  lineNumber: number;
  status: 'idle' | 'dialing' | 'ringing' | 'connecting' | 'connected' | 'holding' | 'ended' | 'failed';
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  remoteName?: string;
  startTime?: Date;
  answerTime?: Date;
  endTime?: Date;
  duration: number;
  isOnHold: boolean;
  isMuted: boolean;
  sipSession?: any;
  audioElement?: HTMLAudioElement;
  timerInterval?: any;
}

export interface PhoneSystemEvents {
  onRegistrationStateChanged: (state: 'registered' | 'unregistered' | 'registering' | 'failed', reason?: string) => void;
  onCallStateChanged: (call: CallSession) => void;
  onIncomingCall: (call: CallSession) => void;
  onCallEstablished: (call: CallSession) => void;
  onCallEnded: (callId: string, reason?: string) => void;
  onError: (error: Error, context?: string) => void;
  onAudioDevicesChanged: (devices: MediaDeviceInfo[]) => void;
}

export interface AudioDevices {
  input: MediaDeviceInfo[];
  output: MediaDeviceInfo[];
  currentInput?: string;
  currentOutput?: string;
}

// ===== MAIN PHONE SYSTEM CLASS =====
export class FreePBXPhoneSystem {
  private userAgent?: UserAgent;
  private registerer?: Registerer;
  private config: FreePBXConfig;
  private events: Partial<PhoneSystemEvents> = {};
  private activeCalls = new Map<string, CallSession>();
  private lineCounter = 0;
  private registrationState: 'registered' | 'unregistered' | 'registering' | 'failed' = 'unregistered';
  private audioDevices: AudioDevices = { input: [], output: [] };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: FreePBXConfig) {
    this.config = {
      userAgent: 'FreePBX-WebPhone/2.0',
      ...config
    };
    
    // Auto-detect audio devices
    this.detectAudioDevices();
    
    // Monitor device changes
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.detectAudioDevices();
      });
    }
  }

  // ===== EVENT MANAGEMENT =====
  public on<K extends keyof PhoneSystemEvents>(event: K, callback: PhoneSystemEvents[K]): void {
    this.events[event] = callback;
  }

  public off<K extends keyof PhoneSystemEvents>(event: K): void {
    delete this.events[event];
  }

  private emit<K extends keyof PhoneSystemEvents>(
    event: K, 
    ...args: Parameters<PhoneSystemEvents[K]>
  ): void {
    const callback = this.events[event];
    if (callback) {
      try {
        // @ts-ignore
        callback(...args);
      } catch (error) {
        console.error(`Error in ${event} callback:`, error);
      }
    }
  }

  // ===== AUTHENTICATION WITH ADMIN SYSTEM =====
  public static async loginAndGetConfig(email: string, password: string): Promise<FreePBXConfig> {
    try {
      const response = await fetch('https://bkpmanual.bitnexdial.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const user = data.user;
      return {
        server: user.secureWebSocketServer,
        port: parseInt(user.webSocketPort),
        path: user.webSocketPath,
        domain: user.domain,
        username: user.sipUsername,
        password: user.sipPassword,
        displayName: user.fullName
      };
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  // ===== INITIALIZATION =====
  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing FreePBX Phone System...');
      
      // Request microphone permission early
      await this.requestMediaPermissions();
      
      // Create and configure UserAgent
      await this.createUserAgent();
      
      // Start the UserAgent
      await this.startUserAgent();
      
      // Register with FreePBX
      await this.register();
      
      // Start health monitoring
      this.startHealthCheck();
      
    } catch (error) {
      console.error('❌ Failed to initialize phone system:', error);
      this.emit('onError', error as Error, 'initialization');
      throw error;
    }
  }

  private async requestMediaPermissions(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop tracks immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('❌ Media permission denied:', error);
      throw new Error('Microphone permission is required for calling');
    }
  }

  private async createUserAgent(): Promise<void> {
    const uri = `sip:${this.config.username}@${this.config.domain}`;
    const serverUrl = `wss://${this.config.server}:${this.config.port}${this.config.path}`;

const options: UserAgentOptions = {
  uri: UserAgent.makeURI(uri)!,
  transportOptions: {
    server: serverUrl,
    connectionTimeout: 30,
    keepAliveInterval: 30,
    traceSip: true
  },
  authorizationUsername: this.config.username,
  authorizationPassword: this.config.password,
  displayName: this.config.displayName,
  userAgentString: this.config.userAgent!,
  delegate: {
    onInvite: this.handleIncomingCall.bind(this),
    onMessage: this.handleMessage.bind(this)
  },
  sessionDescriptionHandlerFactoryOptions: {
    iceGatheringTimeout: 10000,
    peerConnectionConfiguration: {
      bundlePolicy: 'balanced',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.freepbx.org:3478' }
      ]
    }
  }
};


    this.userAgent = new UserAgent(options);
    
    // Setup transport event handlers
    this.userAgent.transport.onConnect = () => {
      this.reconnectAttempts = 0;
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = undefined;
      }
    };

    this.userAgent.transport.onDisconnect = (error) => {
      console.warn('❌ Disconnected from FreePBX:', error?.message);
      this.handleDisconnection();
    };

    this.userAgent.transport.onMessage = (message) => {
      // Optional: Log SIP messages for debugging
     
    };
  }

  private async startUserAgent(): Promise<void> {
    if (!this.userAgent) {
      throw new Error('UserAgent not created');
    }

    try {
      await this.userAgent.start();
    } catch (error) {
      console.error('❌ Failed to start UserAgent:', error);
      throw error;
    }
  }

  private async register(): Promise<void> {
    if (!this.userAgent) {
      throw new Error('UserAgent not available');
    }

    // Create registerer if not exists
    if (!this.registerer) {
      this.registerer = new Registerer(this.userAgent, {
        expires: 300, // 5 minutes
        refreshFrequency: 75 // Refresh at 75% of expires
      });

      // Setup registration state handlers
      this.registerer.stateChange.addListener((newState) => {        
        switch (newState) {
          case RegistererState.Registered:
            this.registrationState = 'registered';
            this.emit('onRegistrationStateChanged', 'registered');
            break;
            
          case RegistererState.Unregistered:
            this.registrationState = 'unregistered';
            this.emit('onRegistrationStateChanged', 'unregistered');
            this.attemptReregistration();
            break;
            
          case RegistererState.Terminated:
            this.registrationState = 'failed';
            this.emit('onRegistrationStateChanged', 'failed', 'Registration terminated');
            console.error('🚫 Registration terminated');
            this.handleRegistrationFailure();
            break;
        }
      });
    }

    try {
      this.registrationState = 'registering';
      this.emit('onRegistrationStateChanged', 'registering');
      await this.registerer.register();
    } catch (error) {
      console.error('❌ Registration failed:', error);
      this.registrationState = 'failed';
      this.emit('onRegistrationStateChanged', 'failed', (error as Error).message);
      throw error;
    }
  }

  // ===== CALL MANAGEMENT =====
  public async makeCall(number: string, audioOnly: boolean = true): Promise<string> {
    if (!this.userAgent || this.registrationState !== 'registered') {
      throw new Error('Phone system not ready. Please ensure you are registered.');
    }

    // Clean and validate number
    const cleanNumber = this.cleanPhoneNumber(number);
    if (!cleanNumber) {
      throw new Error('Invalid phone number');
    }

    try {
      // Get microphone stream
      const mediaStream = await this.getMediaStream(audioOnly);
      
      // Create call session
      const callId = this.generateCallId();
      const lineNumber = ++this.lineCounter;
      
      const callSession: CallSession = {
        id: callId,
        lineNumber,
        status: 'dialing',
        direction: 'outbound',
        remoteNumber: cleanNumber,
        startTime: new Date(),
        duration: 0,
        isOnHold: false,
        isMuted: false
      };

      // Create SIP URI
      const targetUri = `sip:${cleanNumber}@${this.config.domain}`;
      const uri = UserAgent.makeURI(targetUri);
      
      if (!uri) {
        throw new Error('Invalid SIP URI');
      }

      // Configure session options
      const inviterOptions: InviterOptions = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: {
              deviceId: this.audioDevices.currentInput || 'default',
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: !audioOnly
          }
        }
      };

      // Create inviter (outbound session)
      const inviter = new Inviter(this.userAgent, uri, inviterOptions);
      callSession.sipSession = inviter;

      // Setup session event handlers
      this.setupSessionHandlers(callSession);

      // Store the call
      this.activeCalls.set(callId, callSession);
      
      // Emit initial call state
      this.emit('onCallStateChanged', callSession);

      // Make the call
      await inviter.invite({
        requestDelegate: {
          onTrying: () => {
            callSession.status = 'dialing';
            this.emit('onCallStateChanged', callSession);
          },
          onProgress: () => {
            callSession.status = 'ringing';
            this.emit('onCallStateChanged', callSession);
          },
          onAccept: () => {
            callSession.status = 'connected';
            callSession.answerTime = new Date();
            this.emit('onCallStateChanged', callSession);
            this.emit('onCallEstablished', callSession);
            this.startCallTimer(callSession);
          },
          onReject: (response) => {
            const reason = response?.message?.reasonPhrase || 'Call rejected';
            this.handleCallEnd(callSession, reason);
          }
        }
      });

      return callId;
      
    } catch (error) {
      console.error('❌ Failed to make call:', error);
      this.emit('onError', error as Error, 'makeCall');
      throw error;
    }
  }

  public async answerCall(callId: string, audioOnly: boolean = true): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.direction !== 'inbound') {
      throw new Error('Invalid call session for answering');
    }

    try {
      const mediaStream = await this.getMediaStream(audioOnly);
      
      const sessionDescriptionHandlerOptions = {
        constraints: {
          audio: {
            deviceId: this.audioDevices.currentInput || 'default',
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: !audioOnly
        }
      };

      await callSession.sipSession.accept({ sessionDescriptionHandlerOptions });
      
      callSession.status = 'connected';
      callSession.answerTime = new Date();
      
      this.emit('onCallStateChanged', callSession);
      this.emit('onCallEstablished', callSession);
      this.startCallTimer(callSession);

    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      this.emit('onError', error as Error, 'answerCall');
      throw error;
    }
  }

  public async rejectCall(callId: string, reason?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call session not found');
    }

    try {
      if (callSession.direction === 'inbound' && callSession.sipSession.state !== SessionState.Established) {
        await callSession.sipSession.reject({
          statusCode: 486,
          reasonPhrase: reason || 'Busy Here'
        });
      } else {
        await this.hangupCall(callId);
      }
            
    } catch (error) {
      console.error('❌ Failed to reject call:', error);
      this.emit('onError', error as Error, 'rejectCall');
      throw error;
    }
  }

  public async hangupCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call session not found');
    }

    try {
      if (callSession.sipSession.state === SessionState.Established) {
        await callSession.sipSession.bye();
      } else {
        callSession.sipSession.cancel();
      }
      
      this.handleCallEnd(callSession, 'User hangup');
      
    } catch (error) {
      console.error('❌ Failed to hangup call:', error);
      this.emit('onError', error as Error, 'hangupCall');
    }
  }

  public async holdCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.status !== 'connected') {
      throw new Error('Cannot hold call - invalid state');
    }

    try {
      const sessionDescriptionHandlerOptions = {
        hold: true
      };

      await callSession.sipSession.invite({
        sessionDescriptionHandlerOptions
      });

      callSession.isOnHold = true;
      callSession.status = 'holding';
      this.emit('onCallStateChanged', callSession);
            
    } catch (error) {
      console.error('❌ Failed to hold call:', error);
      this.emit('onError', error as Error, 'holdCall');
      throw error;
    }
  }

  public async unholdCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isOnHold) {
      throw new Error('Cannot unhold call - not on hold');
    }

    try {
      const sessionDescriptionHandlerOptions = {
        hold: false
      };

      await callSession.sipSession.invite({
        sessionDescriptionHandlerOptions
      });

      callSession.isOnHold = false;
      callSession.status = 'connected';
      this.emit('onCallStateChanged', callSession);
      
      
    } catch (error) {
      console.error('❌ Failed to unhold call:', error);
      this.emit('onError', error as Error, 'unholdCall');
      throw error;
    }
  }

  public async muteCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.status !== 'connected') {
      throw new Error('Cannot mute call - invalid state');
    }

    try {
      const pc = callSession.sipSession.sessionDescriptionHandler?.peerConnection;
      if (pc) {
        pc.getSenders().forEach((sender: RTCRtpSender) => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = false;
          }
        });
      }

      callSession.isMuted = true;
      this.emit('onCallStateChanged', callSession);
      
      
    } catch (error) {
      console.error('❌ Failed to mute call:', error);
      this.emit('onError', error as Error, 'muteCall');
      throw error;
    }
  }

  public async unmuteCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isMuted) {
      throw new Error('Cannot unmute call - not muted');
    }

    try {
      const pc = callSession.sipSession.sessionDescriptionHandler?.peerConnection;
      if (pc) {
          pc.getSenders().forEach((sender: RTCRtpSender) => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = true;
          }
        });
      }

      callSession.isMuted = false;
      this.emit('onCallStateChanged', callSession);
      
      
    } catch (error) {
      console.error('❌ Failed to unmute call:', error);
      this.emit('onError', error as Error, 'unmuteCall');
      throw error;
    }
  }

  public sendDTMF(callId: string, tone: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.status !== 'connected') {
      throw new Error('Cannot send DTMF - call not connected');
    }

    try {
      const dtmfSender = callSession.sipSession.sessionDescriptionHandler?.peerConnection
        ?.getSenders()
        ?.find((sender: any) => sender.dtmf);

      if (dtmfSender && dtmfSender.dtmf) {
        dtmfSender.dtmf.insertDTMF(tone, 100, 70);
      } else {
        throw new Error('DTMF not supported');
      }
      
    } catch (error) {
      console.error('❌ Failed to send DTMF:', error);
      this.emit('onError', error as Error, 'sendDTMF');
      throw error;
    }
  }

  // ===== AUDIO DEVICE MANAGEMENT =====
  public async getAudioDevices(): Promise<AudioDevices> {
    return this.audioDevices;
  }

  public async setAudioInputDevice(deviceId: string): Promise<void> {
    try {
      // Test the device by requesting a stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      stream.getTracks().forEach(track => track.stop());
      
      this.audioDevices.currentInput = deviceId;
      localStorage.setItem('preferredAudioInput', deviceId);
            
    } catch (error) {
      console.error('❌ Failed to set audio input device:', error);
      throw error;
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<void> {
    try {
      // Test if device exists (we can't test audio output directly)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const device = devices.find(d => d.deviceId === deviceId && d.kind === 'audiooutput');
      
      if (!device) {
        throw new Error('Audio output device not found');
      }
      
      this.audioDevices.currentOutput = deviceId;
      localStorage.setItem('preferredAudioOutput', deviceId);
      
      // Update all active call audio elements
      this.activeCalls.forEach(call => {
        if (call.audioElement && (call.audioElement as any).setSinkId) {
          (call.audioElement as any).setSinkId(deviceId).catch((error: any) => {
            console.warn('Failed to set audio output for call:', error);
          });
        }
      });
            
    } catch (error) {
      console.error('❌ Failed to set audio output device:', error);
      throw error;
    }
  }

  private async detectAudioDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.audioDevices.input = devices.filter(device => device.kind === 'audioinput');
      this.audioDevices.output = devices.filter(device => device.kind === 'audiooutput');
      
      // Set preferred devices from localStorage
      if (!this.audioDevices.currentInput) {
        this.audioDevices.currentInput = localStorage.getItem('preferredAudioInput') || 'default';
      }
      if (!this.audioDevices.currentOutput) {
        this.audioDevices.currentOutput = localStorage.getItem('preferredAudioOutput') || 'default';
      }
      
      this.emit('onAudioDevicesChanged', [...this.audioDevices.input, ...this.audioDevices.output]);
      
    } catch (error) {
      console.error('❌ Failed to detect audio devices:', error);
    }
  }

  // ===== CALL STATE MANAGEMENT =====
  public getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  public getCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId);
  }

  public getRegistrationState(): string {
    return this.registrationState;
  }

  // ===== PRIVATE HELPER METHODS =====
  private handleIncomingCall(invitation: Invitation): void {    
    const callId = this.generateCallId();
    const lineNumber = ++this.lineCounter;
    const remoteNumber = invitation.remoteIdentity.uri.user || 'Unknown';
    const remoteName = invitation.remoteIdentity.displayName || remoteNumber;
    
    const callSession: CallSession = {
      id: callId,
      lineNumber,
      status: 'ringing',
      direction: 'inbound',
      remoteNumber,
      remoteName,
      startTime: new Date(),
      duration: 0,
      isOnHold: false,
      isMuted: false,
      sipSession: invitation
    };
    
    // Setup session handlers
    this.setupSessionHandlers(callSession);
    
    // Store the call
    this.activeCalls.set(callId, callSession);
    
    // Emit events
    this.emit('onCallStateChanged', callSession);
    this.emit('onIncomingCall', callSession);
  }

  private handleMessage(message: any): void {
    console.log('💬 Received SIP message:', message);
    // Handle SIP MESSAGE requests if needed
  }

  private setupSessionHandlers(callSession: CallSession): void {
    const session = callSession.sipSession;
    
    session.delegate = {
      onBye: (bye: any) => {
        this.handleCallEnd(callSession, 'Remote hangup');
      },
      onRefer: (refer: any) => {
        console.log('🔄 Call transfer request received');
        // Handle call transfer if needed
      },
      onInfo: (info: any) => {
        console.log('ℹ️ Session info received');
        // Handle INFO messages if needed
      }
    };

    session.stateChange.addListener((newState: SessionState) => {
      
      switch (newState) {
        case SessionState.Establishing:
          callSession.status = 'connecting';
          break;
        case SessionState.Established:
          callSession.status = 'connected';
          callSession.answerTime = new Date();
          this.handleSessionEstablished(callSession);
          break;
        case SessionState.Terminated:
          this.handleCallEnd(callSession, 'Session terminated');
          break;
      }
      
      this.emit('onCallStateChanged', callSession);
    });
  }

  private handleSessionEstablished(callSession: CallSession): void {
    
    // Setup audio
    this.setupSessionAudio(callSession);
    
    // Start call timer
    this.startCallTimer(callSession);
    
    // Emit event
    this.emit('onCallEstablished', callSession);
  }

  private setupSessionAudio(callSession: CallSession): void {
    const session = callSession.sipSession;
    const pc = session.sessionDescriptionHandler?.peerConnection;
    
    if (!pc) {
      console.warn('No peer connection available for audio setup');
      return;
    }

    // Create audio element for remote audio
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    (audioElement as any).playsInline = true;
    audioElement.style.display = 'none';
    document.body.appendChild(audioElement);
    
    callSession.audioElement = audioElement;

    // Setup remote audio stream
    const remoteStream = new MediaStream();
    pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
      if (receiver.track && receiver.track.kind === 'audio') {
        remoteStream.addTrack(receiver.track);
      }
    });

    if (remoteStream.getAudioTracks().length > 0) {
      audioElement.srcObject = remoteStream;
      
      // Set audio output device
      if (this.audioDevices.currentOutput && (audioElement as any).setSinkId) {
        (audioElement as any).setSinkId(this.audioDevices.currentOutput)
          .catch((error: any) => console.warn('Failed to set audio output:', error));
      }
    }

  }

  private startCallTimer(callSession: CallSession): void {
    if (callSession.timerInterval) {
      clearInterval(callSession.timerInterval);
    }

    callSession.timerInterval = setInterval(() => {
      if (callSession.answerTime) {
        callSession.duration = Math.floor((Date.now() - callSession.answerTime.getTime()) / 1000);
        this.emit('onCallStateChanged', callSession);
      }
    }, 1000);
  }

  private handleCallEnd(callSession: CallSession, reason: string = 'Call ended'): void {
    // Stop timer if running
    if ((callSession as any).timerInterval) {
      clearInterval((callSession as any).timerInterval);
      (callSession as any).timerInterval = undefined;
    }

    // Stop and remove audio element
    if (callSession.audioElement) {
      callSession.audioElement.pause();
      callSession.audioElement.srcObject = null;
      if (callSession.audioElement.parentNode) {
        callSession.audioElement.parentNode.removeChild(callSession.audioElement);
      }
      callSession.audioElement = undefined;
    }

    callSession.status = 'ended';
    callSession.endTime = new Date();
    callSession.duration = callSession.answerTime
      ? Math.floor((callSession.endTime.getTime() - callSession.answerTime.getTime()) / 1000)
      : 0;

    // Emit event and remove from map
    this.emit('onCallStateChanged', callSession);
    this.emit('onCallEnded', callSession.id, reason);
    this.activeCalls.delete(callSession.id);

  }

  private cleanPhoneNumber(number: string): string | null {
    // Simple E.164 cleaning, customize as needed
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length < 7) return null;
    return cleaned;
  }

  private generateCallId(): string {
    // Simple unique ID generator (timestamp + random)
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  private async getMediaStream(audioOnly: boolean = true): Promise<MediaStream> {
    // Always get audio, optionally video (future proof)
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.audioDevices.currentInput || undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: !audioOnly ? { facingMode: "user" } : false
    });
  }

  // Re-register if dropped
  private attemptReregistration(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('⚠️ Max reconnect attempts reached. Giving up.');
      return;
    }
    this.reconnectAttempts++;
    console.log(`🔁 Attempting to re-register (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => {
      this.register().catch((e) => {
        console.warn('Failed to re-register:', e);
        this.attemptReregistration();
      });
    }, 3000 * this.reconnectAttempts);
  }

  private handleDisconnection(): void {
    // Clear intervals and mark as unregistered
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.registrationState = 'unregistered';
    this.emit('onRegistrationStateChanged', 'unregistered', 'Transport lost');
    this.attemptReregistration();
  }

  private handleRegistrationFailure(): void {
    // Try to re-register or notify app
    this.attemptReregistration();
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(() => {
      // Could ping SIP server or check transport, etc.
      if (!this.userAgent || !this.userAgent.transport.isConnected()) {
        console.warn('🚨 WebSocket disconnected. Attempting re-registration.');
        this.handleDisconnection();
      }
    }, 20000);
  }

  // Clean up all resources, stop everything
  public async destroy(): Promise<void> {
    // End all active calls
    for (const call of this.activeCalls.values()) {
      try {
        await this.hangupCall(call.id);
      } catch { /* ignore */ }
    }
    this.activeCalls.clear();

    if (this.registerer) {
      try { await this.registerer.unregister(); } catch { }
      this.registerer = undefined;
    }
    if (this.userAgent) {
      try { await this.userAgent.stop(); } catch { }
      this.userAgent = undefined;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    this.registrationState = 'unregistered';
    this.emit('onRegistrationStateChanged', 'unregistered');
    console.log('🛑 Phone system destroyed.');
  }
}
