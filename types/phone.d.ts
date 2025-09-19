/**
 * Phone System Type Declarations
 * File: types/phone.d.ts
 */

// ===== CORE INTERFACES =====

export interface FreePBXConfig {
  sipUri: string;
  username: string;
  password: string;
  displayName?: string;
  realm?: string;
  registrar?: string;
  proxy?: string;
  stunServers?: string[];
  turnServers?: TurnServer[];
  debug?: boolean;
  autoAnswer?: boolean;
  codecs?: AudioCodec[];
}

export interface TurnServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface AudioCodec {
  name: string;
  clockRate: number;
  priority: number;
}

export interface CallSession {
  id: string;
  remoteNumber: string;
  localNumber: string;
  direction: 'inbound' | 'outbound';
  state: CallState;
  startTime: Date;
  answerTime?: Date;
  endTime?: Date;
  duration: number;
  isOnHold: boolean;
  isMuted: boolean;
  isRecording: boolean;
  callQuality?: CallQuality;
}

export interface CallQuality {
  rtt: number;
  packetLoss: number;
  jitter: number;
  audioLevel: number;
}

export interface PhoneStats {
  totalCalls: number;
  activeCalls: number;
  callsToday: number;
  averageCallDuration: number;
  callQualityAverage: number;
  registrationUptime: number;
}

export interface DTMFOptions {
  duration?: number;
  gap?: number;
}

export interface CallOptions {
  audioOnly?: boolean;
  autoAnswer?: boolean;
  recordCall?: boolean;
  customHeaders?: Record<string, string>;
}

export interface MediaDevices {
  audioInput: MediaDeviceInfo[];
  audioOutput: MediaDeviceInfo[];
}

export interface AudioSettings {
  inputDeviceId?: string;
  outputDeviceId?: string;
  inputVolume: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

// ===== ENUMS =====

export enum CallState {
  IDLE = 'idle',
  CALLING = 'calling',
  INCOMING = 'incoming',
  EARLY = 'early',
  CONNECTING = 'connecting',
  CONFIRMED = 'confirmed',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  HOLD = 'hold'
}

export enum RegistrationState {
  UNREGISTERED = 'unregistered',
  REGISTERING = 'registering',
  REGISTERED = 'registered',
  FAILED = 'failed'
}

// ===== EVENT TYPES =====

export interface PhoneSystemEvents {
  'registration:success': { state: RegistrationState };
  'registration:failed': { error: string };
  'call:incoming': { call: CallSession };
  'call:outgoing': { call: CallSession };
  'call:answered': { call: CallSession };
  'call:ended': { call: CallSession; reason: string };
  'call:hold': { call: CallSession };
  'call:unhold': { call: CallSession };
  'call:muted': { call: CallSession };
  'call:unmuted': { call: CallSession };
  'call:dtmf': { call: CallSession; digit: string };
  'call:quality': { call: CallSession; quality: CallQuality };
  'error': { error: Error; context: string };
}

export type PhoneEventCallback<T extends keyof PhoneSystemEvents> = (
  data: PhoneSystemEvents[T]
) => void;

// ===== HOOK TYPES =====

export interface UsePhoneIntegrationOptions {
  autoConnect?: boolean;
  config?: FreePBXConfig;
  onCallIncoming?: (call: CallSession) => void;
  onCallEnded?: (call: CallSession, reason: string) => void;
  onError?: (error: string) => void;
}

export interface UsePhoneIntegrationReturn {
  isInitialized: boolean;
  isRegistered: boolean;
  registrationState: RegistrationState;
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  error: string | null;
  isLoading: boolean;
  connect: (config: FreePBXConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  makeCall: (number: string) => Promise<string>;
  answerCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  hangupCall: (callId: string) => Promise<void>;
  hangupAllCalls: () => Promise<void>;
  holdCall: (callId: string) => Promise<void>;
  unholdCall: (callId: string) => Promise<void>;
  muteCall: (callId: string) => Promise<void>;
  unmuteCall: (callId: string) => Promise<void>;
  sendDTMF: (callId: string, digit: string) => Promise<void>;
  clearError: () => void;
}

export interface UseCallStateMonitorReturn {
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  hasIncomingCall: boolean;
  hasActiveCall: boolean;
  callCount: number;
}

export interface UseFormattedCallDurationReturn {
  formattedDuration: string;
  durationMs: number;
  durationSeconds: number;
}

export interface UseCallStatsReturn {
  stats: PhoneStats | null;
  isLoading: boolean;
  refresh: () => void;
}

// ===== COMPONENT TYPES =====

export interface PhoneContextValue {
  isInitialized: boolean;
  isRegistered: boolean;
  registrationState: RegistrationState;
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  stats: PhoneStats | null;
  error: string | null;
  isLoading: boolean;
  initializePhone: (config: FreePBXConfig) => Promise<void>;
  makeCall: (number: string) => Promise<string>;
  answerCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  hangupCall: (callId: string) => Promise<void>;
  hangupAllCalls: () => Promise<void>;
  holdCall: (callId: string) => Promise<void>;
  unholdCall: (callId: string) => Promise<void>;
  muteCall: (callId: string) => Promise<void>;
  unmuteCall: (callId: string) => Promise<void>;
  sendDTMF: (callId: string, digit: string) => Promise<void>;
  clearError: () => void;
}

export interface PhoneProviderProps {
  children: React.ReactNode;
  autoInitialize?: boolean;
  config?: FreePBXConfig;
}

export interface PhoneLoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface PhoneStatusProps {
  showCalls?: boolean;
  showStats?: boolean;
  className?: string;
}

// ===== CLASS DECLARATIONS =====

export declare class FreePBXPhoneSystem {
  constructor(config: FreePBXConfig);
  initialize(): Promise<void>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  makeCall(number: string, options?: CallOptions): Promise<string>;
  answerCall(callId: string): Promise<void>;
  rejectCall(callId: string): Promise<void>;
  hangupCall(callId: string): Promise<void>;
  hangupAllCalls(): Promise<void>;
  holdCall(callId: string): Promise<void>;
  unholdCall(callId: string): Promise<void>;
  muteCall(callId: string): Promise<void>;
  unmuteCall(callId: string): Promise<void>;
  sendDTMF(callId: string, digit: string, options?: DTMFOptions): Promise<void>;
  getActiveCalls(): CallSession[];
  getCall(callId: string): CallSession | null;
  getActiveCallNumber(): string | null;
  isPhoneReady(): boolean;
  isRegistered(): boolean;
  getRegistrationState(): RegistrationState;
  getStats(): PhoneStats;
  on<T extends keyof PhoneSystemEvents>(event: T, callback: PhoneEventCallback<T>): void;
  off<T extends keyof PhoneSystemEvents>(event: T, callback: PhoneEventCallback<T>): void;
  destroy(): Promise<void>;
  getMediaDevices(): Promise<MediaDevices>;
  setAudioSettings(settings: Partial<AudioSettings>): Promise<void>;
  testMicrophone(): Promise<boolean>;
  testSpeaker(): Promise<boolean>;
}

export declare class GlobalPhoneManager {
  static getInstance(): GlobalPhoneManager;
  initialize(config: FreePBXConfig): Promise<void>;
  getPhoneSystem(): FreePBXPhoneSystem;
  isInitialized(): boolean;
  destroy(): Promise<void>;
  makeCall(number: string, options?: CallOptions): Promise<string>;
  answerCall(callId: string): Promise<void>;
  rejectCall(callId: string): Promise<void>;
  hangupCall(callId: string): Promise<void>;
  hangupAllCalls(): Promise<void>;
  holdCall(callId: string): Promise<void>;
  unholdCall(callId: string): Promise<void>;
  muteCall(callId: string): Promise<void>;
  unmuteCall(callId: string): Promise<void>;
  sendDTMF(callId: string, digit: string, options?: DTMFOptions): Promise<void>;
  getActiveCalls(): CallSession[];
  getCall(callId: string): CallSession | null;
  getActiveCallNumber(): string | null;
  isPhoneReady(): boolean;
  getRegistrationState(): RegistrationState;
  getStats(): PhoneStats;
  on<T extends keyof PhoneSystemEvents>(event: T, callback: PhoneEventCallback<T>): void;
  off<T extends keyof PhoneSystemEvents>(event: T, callback: PhoneEventCallback<T>): void;
}

// ===== FUNCTION DECLARATIONS =====

// Initialization
export declare function initializePhone(config: FreePBXConfig): Promise<void>;
export declare function initializePhoneWithConfig(
  sipUri: string,
  username: string,
  password: string,
  displayName?: string
): Promise<void>;

// Call management
export declare function makeCall(number: string, options?: CallOptions): Promise<string>;
export declare function answerCall(callId: string): Promise<void>;
export declare function rejectCall(callId: string): Promise<void>;
export declare function hangupCall(callId: string): Promise<void>;
export declare function hangupAllCalls(): Promise<void>;
export declare function holdCall(callId: string): Promise<void>;
export declare function unholdCall(callId: string): Promise<void>;
export declare function muteCall(callId: string): Promise<void>;
export declare function unmuteCall(callId: string): Promise<void>;
export declare function sendDTMF(callId: string, digit: string, options?: DTMFOptions): Promise<void>;

// State queries
export declare function getActiveCalls(): CallSession[];
export declare function getActiveCallNumber(): string | null;
export declare function getCall(callId: string): CallSession | null;
export declare function isPhoneReady(): boolean;
export declare function getRegistrationState(): RegistrationState;
export declare function getStats(): PhoneStats;

// Event management
export declare function onPhoneEvent<T extends keyof PhoneSystemEvents>(
  event: T,
  callback: PhoneEventCallback<T>
): void;
export declare function offPhoneEvent<T extends keyof PhoneSystemEvents>(
  event: T,
  callback: PhoneEventCallback<T>
): void;

// Backward compatibility functions
export declare function DialByLine(number: string): Promise<string>;
export declare function cancelSession(callId?: string): Promise<void>;
export declare function endSession(callId?: string): Promise<void>;
export declare function HangupAll(): Promise<void>;
export declare function EndCall(callId: string): Promise<void>;
export declare function HangUp(callId?: string): Promise<void>;

// Utility functions
export declare function formatPhoneNumber(number: string): string;
export declare function validatePhoneNumber(number: string): boolean;
export declare function parseSipUri(uri: string): { username: string; domain: string; port?: number } | null;
export declare function buildSipUri(username: string, domain: string, port?: number): string;
export declare function formatCallDuration(durationMs: number): string;
export declare function getCallStateDisplayName(state: string): string;

// ===== REACT HOOKS =====

export declare function usePhone(): PhoneContextValue;
export declare function usePhoneIntegration(options?: UsePhoneIntegrationOptions): UsePhoneIntegrationReturn;
export declare function useCallStateMonitor(): UseCallStateMonitorReturn;
export declare function useFormattedCallDuration(callId: string | null, updateInterval?: number): UseFormattedCallDurationReturn;
export declare function useCallStats(autoRefresh?: boolean, refreshInterval?: number): UseCallStatsReturn;

// ===== REACT COMPONENTS =====

export declare const PhoneProvider: React.FC<PhoneProviderProps>;
export declare const PhoneLogin: React.FC<PhoneLoginProps>;
export declare const PhoneStatus: React.FC<PhoneStatusProps>;

// ===== DEFAULT EXPORT =====

declare const _default: GlobalPhoneManager;
export default _default;