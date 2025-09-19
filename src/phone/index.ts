/**
 * Phone System Main Export File
 * File: src/phone/index.ts
 * 
 * This file exports everything you need from the phone system
 * Import from here for clean, organized imports
 */

// ===== CORE EXPORTS =====
export { FreePBXPhoneSystem } from './core/FreePBXPhoneSystem';
export * from './core/types';
export * from './core/constants';

// ===== INTEGRATION UTILITIES =====
export { GlobalPhoneManager } from './utils/PhoneIntegrationUtils';

// ===== REACT COMPONENTS =====
export { 
  PhoneProvider, 
  PhoneLogin, 
  PhoneStatus 
} from './components/PhoneProvider';

// ===== REACT HOOKS =====
export { usePhone } from './components/PhoneProvider';
export { 
  usePhoneIntegration,
  useCallStateMonitor,
  useFormattedCallDuration,
  useCallStats
} from './hooks/usePhoneIntegration';

// ===== SIMPLE API FUNCTIONS =====
// These provide backward compatibility with old phone.js
export {
  // Initialization
  initializePhone,
  initializePhoneWithConfig,
  
  // Call management
  makeCall,
  answerCall,
  rejectCall,
  hangupCall,
  hangupAllCalls,
  holdCall,
  unholdCall,
  muteCall,
  unmuteCall,
  sendDTMF,
  
  // State queries
  getActiveCalls,
  getActiveCallNumber,
  getCall,
  isPhoneReady,
  getRegistrationState,
  getStats,
  
  // Event management
  onPhoneEvent,
  offPhoneEvent,
  
  // Backward compatibility functions
  DialByLine,
  cancelSession,
  endSession,
  HangupAll,
  EndCall,
  HangUp,
  
  // Utility functions
  formatPhoneNumber,
  validatePhoneNumber,
  parseSipUri,
  buildSipUri,
  formatCallDuration,
  getCallStateDisplayName
} from './utils/PhoneIntegrationUtils';

// ===== TYPE DEFINITIONS =====
export type {
  FreePBXConfig,
  CallSession,
  PhoneSystemEvents,
  CallState,
  RegistrationState,
  PhoneStats,
  CallOptions,
  DTMFOptions,
  PhoneEventCallback,
  MediaDevices,
  AudioSettings,
  CallQuality,
  TurnServer,
  AudioCodec
} from './core/types';

// ===== DEFAULT EXPORT =====
export { GlobalPhoneManager as default } from './utils/PhoneIntegrationUtils';