/**
 * Phone System Constants
 * File: src/phone/core/constants.ts
 */

export const PHONE_EVENTS = {
  REGISTRATION_SUCCESS: 'registration:success',
  REGISTRATION_FAILED: 'registration:failed',
  CALL_INCOMING: 'call:incoming',
  CALL_OUTGOING: 'call:outgoing',
  CALL_ANSWERED: 'call:answered',
  CALL_ENDED: 'call:ended',
  CALL_HOLD: 'call:hold',
  CALL_UNHOLD: 'call:unhold',
  CALL_MUTED: 'call:muted',
  CALL_UNMUTED: 'call:unmuted',
  CALL_DTMF: 'call:dtmf',
  CALL_QUALITY: 'call:quality',
  ERROR: 'error'
} as const;

export const DEFAULT_CONFIG = {
  DEBUG: false,
  AUTO_ANSWER: false,
  REGISTRATION_TIMEOUT: 30000,
  CALL_TIMEOUT: 60000,
  DTMF_DURATION: 100,
  DTMF_GAP: 50,
  QUALITY_CHECK_INTERVAL: 5000,
  MAX_CALL_DURATION: 14400000, // 4 hours
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 5
} as const;

export const AUDIO_CODECS = {
  PCMU: { name: 'PCMU', clockRate: 8000, priority: 128 },
  PCMA: { name: 'PCMA', clockRate: 8000, priority: 127 },
  G729: { name: 'G729', clockRate: 8000, priority: 126 },
  G722: { name: 'G722', clockRate: 16000, priority: 125 },
  OPUS: { name: 'opus', clockRate: 48000, priority: 124 }
} as const;

export const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302'
] as const;

export const CALL_STATES = {
  IDLE: 'idle',
  CALLING: 'calling',
  INCOMING: 'incoming',
  EARLY: 'early',
  CONNECTING: 'connecting',
  CONFIRMED: 'confirmed',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  HOLD: 'hold'
} as const;

export const REGISTRATION_STATES = {
  UNREGISTERED: 'unregistered',
  REGISTERING: 'registering',
  REGISTERED: 'registered',
  FAILED: 'failed'
} as const;

export const ERROR_CODES = {
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  CALL_FAILED: 'CALL_FAILED',
  MEDIA_FAILED: 'MEDIA_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
  DEVICE_ERROR: 'DEVICE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;

export const DTMF_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'] as const;

export const DEFAULT_AUDIO_SETTINGS = {
  INPUT_VOLUME: 80,
  OUTPUT_VOLUME: 80,
  ECHO_CANCELLATION: true,
  NOISE_SUPPRESSION: true,
  AUTO_GAIN_CONTROL: true
} as const;