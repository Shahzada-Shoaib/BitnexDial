/**
 * FreePBX Phone System Implementation
 * File: src/phone/core/FreePBXPhoneSystem.ts
 */

import { 
  FreePBXConfig, 
  CallSession, 
  PhoneSystemEvents, 
  CallState, 
  RegistrationState,
  PhoneEventCallback,
  CallOptions,
  DTMFOptions,
  PhoneStats,
  MediaDevices,
  AudioSettings
} from './types';
import { 
  PHONE_EVENTS, 
  DEFAULT_CONFIG, 
  AUDIO_CODECS, 
  DEFAULT_STUN_SERVERS,
  ERROR_CODES 
} from './constants';

declare global {
  interface Window {
    PJSIP: any;
  }
}

export class FreePBXPhoneSystem {
  private config: FreePBXConfig;
  private pjsipEndpoint: any;
  private account: any;
  private activeCalls: Map<string, CallSession> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private registrationState: RegistrationState = RegistrationState.UNREGISTERED;
  private isInitialized: boolean = false;
  private reconnectAttempts: number = 0;
  private statsInterval: NodeJS.Timeout | null = null;
  private qualityCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: FreePBXConfig) {
    this.config = { ...config };
    this.initializeEventListeners();
  }

  // ===== INITIALIZATION =====
  
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.warn('Phone system already initialized');
        return;
      }

      await this.loadPJSIP();
      await this.initializePJSIP();
      await this.createAccount();
      
      this.isInitialized = true;
      this.startStatsCollection();
      
      console.log('FreePBX Phone System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize phone system:', error);
      this.emit('error', { error: error as Error, context: 'initialization' });
      throw error;
    }
  }

  private async loadPJSIP(): Promise<void> {
    if (typeof window.PJSIP !== 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/pjsip/pjsip.js'; // Adjust path as needed
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PJSIP library'));
      document.head.appendChild(script);
    });
  }

  private async initializePJSIP(): Promise<void> {
    const epConfig = {
      ua_config: {
        no_tcp: false,
        nameserver: [],
        stun_server: this.config.stunServers || DEFAULT_STUN_SERVERS,
        turn_server: this.config.turnServers || []
      },
      log_config: {
        msg_logging: this.config.debug || false,
        level: this.config.debug ? 5 : 2,
        console_level: this.config.debug ? 5 : 2
      }
    };

    this.pjsipEndpoint = new window.PJSIP.Endpoint();
    
    try {
      await new Promise((resolve, reject) => {
        this.pjsipEndpoint.libCreate(epConfig, (status: number) => {
          if (status === 0) {
            resolve(status);
          } else {
            reject(new Error(`PJSIP initialization failed with status: ${status}`));
          }
        });
      });

      await new Promise((resolve, reject) => {
        this.pjsipEndpoint.libStart((status: number) => {
          if (status === 0) {
            resolve(status);
          } else {
            reject(new Error(`PJSIP start failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`PJSIP initialization failed: ${error}`);
    }
  }

  private async createAccount(): Promise<void> {
    const accountConfig = {
      id_uri: `sip:${this.config.username}@${this.config.realm || this.extractDomain(this.config.sipUri)}`,
      reg_uri: this.config.registrar || this.config.sipUri,
      cred_info: [{
        realm: this.config.realm || this.extractDomain(this.config.sipUri),
        scheme: 'digest',
        username: this.config.username,
        data: this.config.password,
        data_type: 0
      }],
      proxy: this.config.proxy ? [this.config.proxy] : []
    };

    try {
      this.account = await new Promise((resolve, reject) => {
        this.pjsipEndpoint.accountCreate(accountConfig, (status: number, account: any) => {
          if (status === 0) {
            resolve(account);
          } else {
            reject(new Error(`Account creation failed with status: ${status}`));
          }
        });
      });

      this.setupAccountCallbacks();
      await this.register();
    } catch (error) {
      throw new Error(`Account creation failed: ${error}`);
    }
  }

  // ===== REGISTRATION =====

  async register(): Promise<void> {
    if (!this.account) {
      throw new Error('Account not initialized');
    }

    this.registrationState = RegistrationState.REGISTERING;
    
    try {
      await new Promise((resolve, reject) => {
        this.account.setRegistration(true, (status: number) => {
          if (status === 0) {
            this.registrationState = RegistrationState.REGISTERED;
            this.reconnectAttempts = 0;
            this.emit('registration:success', { state: this.registrationState });
            resolve(status);
          } else {
            this.registrationState = RegistrationState.FAILED;
            const error = `Registration failed with status: ${status}`;
            this.emit('registration:failed', { error });
            reject(new Error(error));
          }
        });
      });
    } catch (error) {
      this.handleRegistrationFailure(error as Error);
      throw error;
    }
  }

  async unregister(): Promise<void> {
    if (!this.account) {
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        this.account.setRegistration(false, (status: number) => {
          this.registrationState = RegistrationState.UNREGISTERED;
          if (status === 0) {
            resolve(status);
          } else {
            reject(new Error(`Unregistration failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('Unregistration failed:', error);
    }
  }

  // ===== CALL MANAGEMENT =====

  async makeCall(number: string, options: CallOptions = {}): Promise<string> {
    if (!this.isRegistered()) {
      throw new Error('Phone not registered');
    }

    const callId = this.generateCallId();
    const sipUri = this.formatSipUri(number);
    
    const callSession: CallSession = {
      id: callId,
      remoteNumber: number,
      localNumber: this.config.username,
      direction: 'outbound',
      state: CallState.CALLING,
      startTime: new Date(),
      duration: 0,
      isOnHold: false,
      isMuted: false,
      isRecording: options.recordCall || false
    };

    try {
      const call = await new Promise((resolve, reject) => {
        this.account.makeCall(sipUri, {
          vid_cnt: 0, // Audio only
          aud_cnt: 1
        }, (status: number, callObj: any) => {
          if (status === 0) {
            resolve(callObj);
          } else {
            reject(new Error(`Call failed with status: ${status}`));
          }
        });
      });

      this.activeCalls.set(callId, callSession);
      this.setupCallCallbacks(call, callSession);
      this.emit('call:outgoing', { call: callSession });
      
      return callId;
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'make_call' });
      throw error;
    }
  }

  async answerCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call not found');
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      await new Promise((resolve, reject) => {
        call.answer(200, 'OK', (status: number) => {
          if (status === 0) {
            callSession.state = CallState.CONFIRMED;
            callSession.answerTime = new Date();
            this.emit('call:answered', { call: callSession });
            resolve(status);
          } else {
            reject(new Error(`Answer failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'answer_call' });
      throw error;
    }
  }

  async rejectCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call not found');
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      await new Promise((resolve, reject) => {
        call.hangup(486, 'Busy Here', (status: number) => {
          if (status === 0) {
            this.endCall(callId, 'rejected');
            resolve(status);
          } else {
            reject(new Error(`Reject failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'reject_call' });
      throw error;
    }
  }

  async hangupCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call not found');
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (call) {
        await new Promise((resolve, reject) => {
          call.hangup(200, 'OK', (status: number) => {
            if (status === 0) {
              resolve(status);
            } else {
              reject(new Error(`Hangup failed with status: ${status}`));
            }
          });
        });
      }
      
      this.endCall(callId, 'hangup');
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'hangup_call' });
      throw error;
    }
  }

  async hangupAllCalls(): Promise<void> {
    const promises = Array.from(this.activeCalls.keys()).map(callId => 
      this.hangupCall(callId).catch(error => 
        console.error(`Failed to hangup call ${callId}:`, error)
      )
    );
    
    await Promise.all(promises);
  }

  // ===== CALL CONTROL =====

  async holdCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.isOnHold) {
      return;
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      await new Promise((resolve, reject) => {
        call.setHold((status: number) => {
          if (status === 0) {
            callSession.isOnHold = true;
            callSession.state = CallState.HOLD;
            this.emit('call:hold', { call: callSession });
            resolve(status);
          } else {
            reject(new Error(`Hold failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'hold_call' });
      throw error;
    }
  }

  async unholdCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isOnHold) {
      return;
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      await new Promise((resolve, reject) => {
        call.reinvite((status: number) => {
          if (status === 0) {
            callSession.isOnHold = false;
            callSession.state = CallState.CONFIRMED;
            this.emit('call:unhold', { call: callSession });
            resolve(status);
          } else {
            reject(new Error(`Unhold failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'unhold_call' });
      throw error;
    }
  }

  async muteCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.isMuted) {
      return;
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      call.setMicrophoneMute(true);
      callSession.isMuted = true;
      this.emit('call:muted', { call: callSession });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'mute_call' });
      throw error;
    }
  }

  async unmuteCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isMuted) {
      return;
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      call.setMicrophoneMute(false);
      callSession.isMuted = false;
      this.emit('call:unmuted', { call: callSession });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'unmute_call' });
      throw error;
    }
  }

  async sendDTMF(callId: string, digit: string, options: DTMFOptions = {}): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error('Call not found');
    }

    try {
      const call = this.findPJSIPCall(callId);
      if (!call) {
        throw new Error('PJSIP call object not found');
      }

      const duration = options.duration || DEFAULT_CONFIG.DTMF_DURATION;
      
      await new Promise((resolve, reject) => {
        call.dialDtmf(digit, duration, (status: number) => {
          if (status === 0) {
            this.emit('call:dtmf', { call: callSession, digit });
            resolve(status);
          } else {
            reject(new Error(`DTMF failed with status: ${status}`));
          }
        });
      });
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'send_dtmf' });
      throw error;
    }
  }

  // ===== STATE QUERIES =====

  getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  getCall(callId: string): CallSession | null {
    return this.activeCalls.get(callId) || null;
  }

  getActiveCallNumber(): string | null {
    const activeCalls = this.getActiveCalls();
    return activeCalls.length > 0 ? activeCalls[0].remoteNumber : null;
  }

  isPhoneReady(): boolean {
    return this.isInitialized && this.isRegistered();
  }

  isRegistered(): boolean {
    return this.registrationState === RegistrationState.REGISTERED;
  }

  getRegistrationState(): RegistrationState {
    return this.registrationState;
  }

  getStats(): PhoneStats {
    const activeCalls = this.getActiveCalls();
    const totalDuration = activeCalls.reduce((sum, call) => sum + call.duration, 0);
    
    return {
      totalCalls: this.activeCalls.size,
      activeCalls: activeCalls.length,
      callsToday: activeCalls.filter(call => 
        call.startTime.toDateString() === new Date().toDateString()
      ).length,
      averageCallDuration: activeCalls.length > 0 ? totalDuration / activeCalls.length : 0,
      callQualityAverage: 0, // TODO: Implement call quality tracking
      registrationUptime: this.isRegistered() ? Date.now() - this.account?.registrationTime || 0 : 0
    };
  }

  // ===== EVENT MANAGEMENT =====

  on<T extends keyof PhoneSystemEvents>(
    event: T,
    callback: PhoneEventCallback<T>
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off<T extends keyof PhoneSystemEvents>(
    event: T,
    callback: PhoneEventCallback<T>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit<T extends keyof PhoneSystemEvents>(
    event: T,
    data: PhoneSystemEvents[T]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ===== CLEANUP =====

  async destroy(): Promise<void> {
    try {
      // Stop intervals
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }
      
      if (this.qualityCheckInterval) {
        clearInterval(this.qualityCheckInterval);
        this.qualityCheckInterval = null;
      }

      // Hangup all calls
      await this.hangupAllCalls();

      // Unregister
      await this.unregister();

      // Destroy PJSIP
      if (this.pjsipEndpoint) {
        this.pjsipEndpoint.libDestroy();
      }

      // Clear event listeners
      this.eventListeners.clear();
      
      this.isInitialized = false;
      console.log('Phone system destroyed');
    } catch (error) {
      console.error('Error during destruction:', error);
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private initializeEventListeners(): void {
    Object.values(PHONE_EVENTS).forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  private setupAccountCallbacks(): void {
    if (!this.account) return;

    this.account.onIncomingCall = (call: any) => {
      const callId = this.generateCallId();
      const remoteNumber = this.extractNumberFromUri(call.remote_uri);
      
      const callSession: CallSession = {
        id: callId,
        remoteNumber,
        localNumber: this.config.username,
        direction: 'inbound',
        state: CallState.INCOMING,
        startTime: new Date(),
        duration: 0,
        isOnHold: false,
        isMuted: false,
        isRecording: false
      };

      this.activeCalls.set(callId, callSession);
      this.setupCallCallbacks(call, callSession);
      this.emit('call:incoming', { call: callSession });

      if (this.config.autoAnswer) {
        setTimeout(() => this.answerCall(callId), 1000);
      }
    };
  }

  private setupCallCallbacks(call: any, callSession: CallSession): void {
    call.onCallState = (state: any) => {
      switch (state.state) {
        case 'CONFIRMED':
          callSession.state = CallState.CONFIRMED;
          if (!callSession.answerTime) {
            callSession.answerTime = new Date();
          }
          break;
        case 'DISCONNECTED':
          this.endCall(callSession.id, 'disconnected');
          break;
      }
    };

    call.onCallMediaState = (state: any) => {
      // Handle media state changes
    };
  }

  private endCall(callId: string, reason: string): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    callSession.state = CallState.DISCONNECTED;
    callSession.endTime = new Date();
    callSession.duration = callSession.endTime.getTime() - callSession.startTime.getTime();

    this.activeCalls.delete(callId);
    this.emit('call:ended', { call: callSession, reason });
  }

  private findPJSIPCall(callId: string): any {
    // This would need to be implemented based on PJSIP's call tracking
    // For now, return null - in real implementation, you'd track PJSIP call objects
    return null;
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractDomain(sipUri: string): string {
    const match = sipUri.match(/sip:.*@(.+)/);
    return match ? match[1].split(':')[0] : '';
  }

  private formatSipUri(number: string): string {
    if (number.startsWith('sip:')) {
      return number;
    }
    const domain = this.extractDomain(this.config.sipUri);
    return `sip:${number}@${domain}`;
  }

  private extractNumberFromUri(uri: string): string {
    const match = uri.match(/sip:([^@]+)@/);
    return match ? match[1] : uri;
  }

  private handleRegistrationFailure(error: Error): void {
    console.error('Registration failed:', error);
    
    if (this.reconnectAttempts < DEFAULT_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${DEFAULT_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        this.register().catch(err => {
          console.error('Reconnection attempt failed:', err);
        });
      }, DEFAULT_CONFIG.RECONNECT_DELAY);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', { 
        error: new Error('Registration failed after maximum retry attempts'), 
        context: 'registration' 
      });
    }
  }

  private startStatsCollection(): void {
    this.statsInterval = setInterval(() => {
      this.updateCallDurations();
    }, 1000);

    this.qualityCheckInterval = setInterval(() => {
      this.checkCallQuality();
    }, DEFAULT_CONFIG.QUALITY_CHECK_INTERVAL);
  }

  private updateCallDurations(): void {
    const now = new Date();
    this.activeCalls.forEach(call => {
      if (call.answerTime) {
        call.duration = now.getTime() - call.answerTime.getTime();
      }
    });
  }

  private checkCallQuality(): void {
    // Implement call quality monitoring
    // This would involve checking RTP statistics, packet loss, jitter, etc.
    this.activeCalls.forEach(call => {
      // Mock quality data for now
      if (call.state === CallState.CONFIRMED) {
        const quality = {
          rtt: Math.random() * 100,
          packetLoss: Math.random() * 5,
          jitter: Math.random() * 10,
          audioLevel: 70 + Math.random() * 20
        };
        
        call.callQuality = quality;
        this.emit('call:quality', { call, quality });
      }
    });
  }

  // ===== MEDIA DEVICE MANAGEMENT =====

  async getMediaDevices(): Promise<MediaDevices> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        audioInput: devices.filter(device => device.kind === 'audioinput'),
        audioOutput: devices.filter(device => device.kind === 'audiooutput')
      };
    } catch (error) {
      console.error('Failed to get media devices:', error);
      throw new Error('Media device enumeration failed');
    }
  }

  async setAudioSettings(settings: Partial<AudioSettings>): Promise<void> {
    try {
      // Implement audio settings configuration
      // This would involve configuring PJSIP audio parameters
      console.log('Audio settings updated:', settings);
    } catch (error) {
      console.error('Failed to set audio settings:', error);
      throw error;
    }
  }

  async testMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone test failed:', error);
      return false;
    }
  }

  async testSpeaker(): Promise<boolean> {
    try {
      // Play a test tone or audio file
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      gainNode.gain.value = 0.1;
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Speaker test failed:', error);
      return false;
    }
  }
}