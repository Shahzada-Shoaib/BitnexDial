/**
 * Phone Integration Utilities
 * File: src/phone/utils/PhoneIntegrationUtils.ts
 */

import { FreePBXPhoneSystem } from '../core/FreePBXPhoneSystem';
import { 
  FreePBXConfig, 
  CallSession, 
  PhoneSystemEvents, 
  PhoneEventCallback,
  CallOptions,
  DTMFOptions,
  PhoneStats,
  RegistrationState
} from '../core/types';

// ===== GLOBAL PHONE MANAGER =====

export class GlobalPhoneManager {
  private static instance: GlobalPhoneManager | null = null;
  private phoneSystem: FreePBXPhoneSystem | null = null;
  private config: FreePBXConfig | null = null;
  private isInitializing: boolean = false;

  private constructor() {}

  static getInstance(): GlobalPhoneManager {
    if (!GlobalPhoneManager.instance) {
      GlobalPhoneManager.instance = new GlobalPhoneManager();
    }
    return GlobalPhoneManager.instance;
  }

  async initialize(config: FreePBXConfig): Promise<void> {
    if (this.isInitializing) {
      throw new Error('Phone system is already initializing');
    }

    if (this.phoneSystem) {
      console.warn('Phone system already initialized');
      return;
    }

    this.isInitializing = true;
    
    try {
      this.config = { ...config };
      this.phoneSystem = new FreePBXPhoneSystem(this.config);
      await this.phoneSystem.initialize();
      
      console.log('Global phone manager initialized successfully');
    } catch (error) {
      this.phoneSystem = null;
      this.config = null;
      console.error('Failed to initialize global phone manager:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  getPhoneSystem(): FreePBXPhoneSystem {
    if (!this.phoneSystem) {
      throw new Error('Phone system not initialized. Call initialize() first.');
    }
    return this.phoneSystem;
  }

  isInitialized(): boolean {
    return this.phoneSystem !== null && this.phoneSystem.isPhoneReady();
  }

  async destroy(): Promise<void> {
    if (this.phoneSystem) {
      await this.phoneSystem.destroy();
      this.phoneSystem = null;
      this.config = null;
    }
  }

  // Delegate methods to phone system
  async makeCall(number: string, options?: CallOptions): Promise<string> {
    return this.getPhoneSystem().makeCall(number, options);
  }

  async answerCall(callId: string): Promise<void> {
    return this.getPhoneSystem().answerCall(callId);
  }

  async rejectCall(callId: string): Promise<void> {
    return this.getPhoneSystem().rejectCall(callId);
  }

  async hangupCall(callId: string): Promise<void> {
    return this.getPhoneSystem().hangupCall(callId);
  }

  async hangupAllCalls(): Promise<void> {
    return this.getPhoneSystem().hangupAllCalls();
  }

  async holdCall(callId: string): Promise<void> {
    return this.getPhoneSystem().holdCall(callId);
  }

  async unholdCall(callId: string): Promise<void> {
    return this.getPhoneSystem().unholdCall(callId);
  }

  async muteCall(callId: string): Promise<void> {
    return this.getPhoneSystem().muteCall(callId);
  }

  async unmuteCall(callId: string): Promise<void> {
    return this.getPhoneSystem().unmuteCall(callId);
  }

  async sendDTMF(callId: string, digit: string, options?: DTMFOptions): Promise<void> {
    return this.getPhoneSystem().sendDTMF(callId, digit, options);
  }

  getActiveCalls(): CallSession[] {
    return this.getPhoneSystem().getActiveCalls();
  }

  getCall(callId: string): CallSession | null {
    return this.getPhoneSystem().getCall(callId);
  }

  getActiveCallNumber(): string | null {
    return this.getPhoneSystem().getActiveCallNumber();
  }

  isPhoneReady(): boolean {
    return this.phoneSystem ? this.phoneSystem.isPhoneReady() : false;
  }

  getRegistrationState(): RegistrationState {
    return this.getPhoneSystem().getRegistrationState();
  }

  getStats(): PhoneStats {
    return this.getPhoneSystem().getStats();
  }

  on<T extends keyof PhoneSystemEvents>(
    event: T,
    callback: PhoneEventCallback<T>
  ): void {
    this.getPhoneSystem().on(event, callback);
  }

  off<T extends keyof PhoneSystemEvents>(
    event: T,
    callback: PhoneEventCallback<T>
  ): void {
    this.getPhoneSystem().off(event, callback);
  }
}

// ===== GLOBAL INSTANCE =====
const globalPhoneManager = GlobalPhoneManager.getInstance();

// ===== SIMPLE API FUNCTIONS (Backward Compatibility) =====

// Initialization
export async function initializePhone(config: FreePBXConfig): Promise<void> {
  return globalPhoneManager.initialize(config);
}

export async function initializePhoneWithConfig(
  sipUri: string,
  username: string,
  password: string,
  displayName?: string
): Promise<void> {
  const config: FreePBXConfig = {
    sipUri,
    username,
    password,
    displayName,
    debug: false,
    autoAnswer: false
  };
  
  return globalPhoneManager.initialize(config);
}

// Call management
export async function makeCall(number: string, options?: CallOptions): Promise<string> {
  return globalPhoneManager.makeCall(number, options);
}

export async function answerCall(callId: string): Promise<void> {
  return globalPhoneManager.answerCall(callId);
}

export async function rejectCall(callId: string): Promise<void> {
  return globalPhoneManager.rejectCall(callId);
}

export async function hangupCall(callId: string): Promise<void> {
  return globalPhoneManager.hangupCall(callId);
}

export async function hangupAllCalls(): Promise<void> {
  return globalPhoneManager.hangupAllCalls();
}

export async function holdCall(callId: string): Promise<void> {
  return globalPhoneManager.holdCall(callId);
}

export async function unholdCall(callId: string): Promise<void> {
  return globalPhoneManager.unholdCall(callId);
}

export async function muteCall(callId: string): Promise<void> {
  return globalPhoneManager.muteCall(callId);
}

export async function unmuteCall(callId: string): Promise<void> {
  return globalPhoneManager.unmuteCall(callId);
}

export async function sendDTMF(callId: string, digit: string, options?: DTMFOptions): Promise<void> {
  return globalPhoneManager.sendDTMF(callId, digit, options);
}

// State queries
export function getActiveCalls(): CallSession[] {
  return globalPhoneManager.getActiveCalls();
}

export function getActiveCallNumber(): string | null {
  return globalPhoneManager.getActiveCallNumber();
}

export function getCall(callId: string): CallSession | null {
  return globalPhoneManager.getCall(callId);
}

export function isPhoneReady(): boolean {
  return globalPhoneManager.isPhoneReady();
}

export function getRegistrationState(): RegistrationState {
  return globalPhoneManager.getRegistrationState();
}

export function getStats(): PhoneStats {
  return globalPhoneManager.getStats();
}

// Event management
export function onPhoneEvent<T extends keyof PhoneSystemEvents>(
  event: T,
  callback: PhoneEventCallback<T>
): void {
  globalPhoneManager.on(event, callback);
}

export function offPhoneEvent<T extends keyof PhoneSystemEvents>(
  event: T,
  callback: PhoneEventCallback<T>
): void {
  globalPhoneManager.off(event, callback);
}

// ===== BACKWARD COMPATIBILITY FUNCTIONS =====

// Legacy function names for compatibility with old phone.js
export async function DialByLine(number: string): Promise<string> {
  console.warn('DialByLine is deprecated. Use makeCall instead.');
  return makeCall(number);
}

export async function cancelSession(callId?: string): Promise<void> {
  console.warn('cancelSession is deprecated. Use hangupCall or hangupAllCalls instead.');
  if (callId) {
    return hangupCall(callId);
  } else {
    return hangupAllCalls();
  }
}

export async function endSession(callId?: string): Promise<void> {
  console.warn('endSession is deprecated. Use hangupCall or hangupAllCalls instead.');
  if (callId) {
    return hangupCall(callId);
  } else {
    return hangupAllCalls();
  }
}

export async function HangupAll(): Promise<void> {
  console.warn('HangupAll is deprecated. Use hangupAllCalls instead.');
  return hangupAllCalls();
}

export async function EndCall(callId: string): Promise<void> {
  console.warn('EndCall is deprecated. Use hangupCall instead.');
  return hangupCall(callId);
}

export async function HangUp(callId?: string): Promise<void> {
  console.warn('HangUp is deprecated. Use hangupCall or hangupAllCalls instead.');
  if (callId) {
    return hangupCall(callId);
  } else {
    return hangupAllCalls();
  }
}

// ===== UTILITY FUNCTIONS =====

export function formatPhoneNumber(number: string): string {
  // Remove all non-digit characters
  const cleaned = number.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  }
  
  return number; // Return original if can't format
}

export function validatePhoneNumber(number: string): boolean {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function parseSipUri(uri: string): { username: string; domain: string; port?: number } | null {
  const match = uri.match(/sip:([^@]+)@([^:]+)(?::(\d+))?/);
  if (!match) return null;
  
  return {
    username: match[1],
    domain: match[2],
    port: match[3] ? parseInt(match[3]) : undefined
  };
}

export function buildSipUri(username: string, domain: string, port?: number): string {
  const portSuffix = port ? `:${port}` : '';
  return `sip:${username}@${domain}${portSuffix}`;
}

export function formatCallDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}

export function getCallStateDisplayName(state: string): string {
  const stateNames: Record<string, string> = {
    'idle': 'Idle',
    'calling': 'Calling...',
    'incoming': 'Incoming Call',
    'early': 'Ringing',
    'connecting': 'Connecting...',
    'confirmed': 'In Call',
    'disconnected': 'Disconnected',
    'failed': 'Failed',
    'hold': 'On Hold'
  };
  
  return stateNames[state] || state;
}

// ===== EXPORT DEFAULT =====
export { globalPhoneManager as default };