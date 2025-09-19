/**
 * Core Type Definitions for Phone System
 * File: src/phone/core/types.ts
 */

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

export interface CallQuality {
  rtt: number;
  packetLoss: number;
  jitter: number;
  audioLevel: number;
}

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

export type PhoneEventCallback<T extends keyof PhoneSystemEvents> = (
  data: PhoneSystemEvents[T]
) => void;

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