"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalPhoneManager } from '../utils/PhoneIntegrationUtils';
import { 
  CallSession, 
  PhoneSystemEvents, 
  RegistrationState,
  PhoneStats,
  FreePBXConfig
} from '../core/types';
import { formatCallDuration } from '../utils/PhoneIntegrationUtils';

// ===== MAIN PHONE INTEGRATION HOOK =====

export interface UsePhoneIntegrationOptions {
  autoConnect?: boolean;
  config?: FreePBXConfig;
  onCallIncoming?: (call: CallSession) => void;
  onCallEnded?: (call: CallSession, reason: string) => void;
  onError?: (error: string) => void;
}

export interface UsePhoneIntegrationReturn {
  // State
  isInitialized: boolean;
  isRegistered: boolean;
  registrationState: RegistrationState;
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  error: string | null;
  isLoading: boolean;

  // Actions
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

export const usePhoneIntegration = (
  options: UsePhoneIntegrationOptions = {}
): UsePhoneIntegrationReturn => {
  const { autoConnect = false, config, onCallIncoming, onCallEnded, onError } = options;
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationState, setRegistrationState] = useState<RegistrationState>(RegistrationState.UNREGISTERED);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const phoneManager = GlobalPhoneManager.getInstance();
  const eventListenersRef = useRef<Map<keyof PhoneSystemEvents, (...args: any[]) => void>>(new Map());

  // ===== ACTIONS =====

  const connect = useCallback(async (phoneConfig: FreePBXConfig): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await phoneManager.initialize(phoneConfig);
      setIsInitialized(true);
      setRegistrationState(phoneManager.getRegistrationState());
      setIsRegistered(phoneManager.getRegistrationState() === RegistrationState.REGISTERED);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await phoneManager.destroy();
      setIsInitialized(false);
      setIsRegistered(false);
      setRegistrationState(RegistrationState.UNREGISTERED);
      setActiveCalls([]);
      setCurrentCall(null);
      setError(null);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  }, []);

  const makeCall = useCallback(async (number: string): Promise<string> => {
    setError(null);
    try {
      const callId = await phoneManager.makeCall(number);
      updateCallState();
      return callId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Call failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const answerCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.answerCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Answer failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const rejectCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.rejectCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Reject failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const hangupCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.hangupCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Hangup failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const hangupAllCalls = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await phoneManager.hangupAllCalls();
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Hangup all failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const holdCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.holdCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Hold failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const unholdCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.unholdCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unhold failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const muteCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.muteCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mute failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const unmuteCall = useCallback(async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.unmuteCall(callId);
      updateCallState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unmute failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const sendDTMF = useCallback(async (callId: string, digit: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.sendDTMF(callId, digit);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'DTMF failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // ===== HELPER FUNCTIONS =====

  const updateCallState = useCallback((): void => {
    if (phoneManager.isInitialized()) {
      const calls = phoneManager.getActiveCalls();
      setActiveCalls(calls);
      setCurrentCall(calls.length > 0 ? calls[0] : null);
    }
  }, []);

  // ===== EFFECTS =====

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && config && !isInitialized) {
      connect(config);
    }
  }, [autoConnect, config, isInitialized, connect]);

  // Setup event listeners
  useEffect(() => {
    if (!phoneManager.isInitialized()) {
      return;
    }

    // Registration events
    const handleRegistrationSuccess = (data: PhoneSystemEvents['registration:success']) => {
      setRegistrationState(data.state);
      setIsRegistered(data.state === RegistrationState.REGISTERED);
    };

    const handleRegistrationFailed = (data: PhoneSystemEvents['registration:failed']) => {
      setRegistrationState(RegistrationState.FAILED);
      setIsRegistered(false);
      setError(data.error);
      onError?.(data.error);
    };

    // Call events
    const handleCallIncoming = (data: PhoneSystemEvents['call:incoming']) => {
      updateCallState();
      onCallIncoming?.(data.call);
    };

    const handleCallOutgoing = () => {
      updateCallState();
    };

    const handleCallAnswered = () => {
      updateCallState();
    };

    const handleCallEnded = (data: PhoneSystemEvents['call:ended']) => {
      updateCallState();
      onCallEnded?.(data.call, data.reason);
    };

    const handleCallHold = () => {
      updateCallState();
    };

    const handleCallUnhold = () => {
      updateCallState();
    };

    const handleCallMuted = () => {
      updateCallState();
    };

    const handleCallUnmuted = () => {
      updateCallState();
    };

    const handleError = (data: PhoneSystemEvents['error']) => {
      setError(data.error.message);
      onError?.(data.error.message);
    };

    // Register event listeners
    phoneManager.on('registration:success', handleRegistrationSuccess);
    phoneManager.on('registration:failed', handleRegistrationFailed);
    phoneManager.on('call:incoming', handleCallIncoming);
    phoneManager.on('call:outgoing', handleCallOutgoing);
    phoneManager.on('call:answered', handleCallAnswered);
    phoneManager.on('call:ended', handleCallEnded);
    phoneManager.on('call:hold', handleCallHold);
    phoneManager.on('call:unhold', handleCallUnhold);
    phoneManager.on('call:muted', handleCallMuted);
    phoneManager.on('call:unmuted', handleCallUnmuted);
    phoneManager.on('error', handleError);

    // Store references for cleanup
    eventListenersRef.current.set('registration:success', handleRegistrationSuccess);
    eventListenersRef.current.set('registration:failed', handleRegistrationFailed);
    eventListenersRef.current.set('call:incoming', handleCallIncoming);
    eventListenersRef.current.set('call:outgoing', handleCallOutgoing);
    eventListenersRef.current.set('call:answered', handleCallAnswered);
    eventListenersRef.current.set('call:ended', handleCallEnded);
    eventListenersRef.current.set('call:hold', handleCallHold);
    eventListenersRef.current.set('call:unhold', handleCallUnhold);
    eventListenersRef.current.set('call:muted', handleCallMuted);
    eventListenersRef.current.set('call:unmuted', handleCallUnmuted);
    eventListenersRef.current.set('error', handleError);

    return () => {
      // Cleanup event listeners
      eventListenersRef.current.forEach((listener, event) => {
        phoneManager.off(event as keyof PhoneSystemEvents, listener);
      });
      eventListenersRef.current.clear();
    };
  }, [phoneManager.isInitialized(), updateCallState, onCallIncoming, onCallEnded, onError]);

  return {
    // State
    isInitialized,
    isRegistered,
    registrationState,
    activeCalls,
    currentCall,
    error,
    isLoading,

    // Actions
    connect,
    disconnect,
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
    clearError
  };
};

// ===== CALL STATE MONITOR HOOK =====

export interface UseCallStateMonitorReturn {
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  hasIncomingCall: boolean;
  hasActiveCall: boolean;
  callCount: number;
}

export const useCallStateMonitor = (): UseCallStateMonitorReturn => {
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const phoneManager = GlobalPhoneManager.getInstance();

  useEffect(() => {
    const updateCalls = () => {
      if (phoneManager.isInitialized()) {
        setActiveCalls(phoneManager.getActiveCalls());
      }
    };

    if (phoneManager.isInitialized()) {
      // Initial update
      updateCalls();

      // Listen for call events
      const handleCallEvent = () => updateCalls();
      
      phoneManager.on('call:incoming', handleCallEvent);
      phoneManager.on('call:outgoing', handleCallEvent);
      phoneManager.on('call:answered', handleCallEvent);
      phoneManager.on('call:ended', handleCallEvent);
      phoneManager.on('call:hold', handleCallEvent);
      phoneManager.on('call:unhold', handleCallEvent);

      return () => {
        phoneManager.off('call:incoming', handleCallEvent);
        phoneManager.off('call:outgoing', handleCallEvent);
        phoneManager.off('call:answered', handleCallEvent);
        phoneManager.off('call:ended', handleCallEvent);
        phoneManager.off('call:hold', handleCallEvent);
        phoneManager.off('call:unhold', handleCallEvent);
      };
    }
  }, [phoneManager.isInitialized()]);

  const currentCall = activeCalls.length > 0 ? activeCalls[0] : null;
  const hasIncomingCall = activeCalls.some(call => call.state === 'incoming');
  const hasActiveCall = activeCalls.some(call => call.state === 'confirmed');

  return {
    activeCalls,
    currentCall,
    hasIncomingCall,
    hasActiveCall,
    callCount: activeCalls.length
  };
};

// ===== FORMATTED CALL DURATION HOOK =====

export interface UseFormattedCallDurationReturn {
  formattedDuration: string;
  durationMs: number;
  durationSeconds: number;
}

export const useFormattedCallDuration = (
  callId: string | null,
  updateInterval: number = 1000
): UseFormattedCallDurationReturn => {
  const [duration, setDuration] = useState(0);
  const phoneManager = GlobalPhoneManager.getInstance();

  useEffect(() => {
    if (!callId || !phoneManager.isInitialized()) {
      setDuration(0);
      return;
    }

    const updateDuration = () => {
      const call = phoneManager.getCall(callId);
      if (call && call.answerTime) {
        const now = new Date();
        setDuration(now.getTime() - call.answerTime.getTime());
      } else {
        setDuration(0);
      }
    };

    // Initial update
    updateDuration();

    // Set up interval
    const interval = setInterval(updateDuration, updateInterval);

    return () => clearInterval(interval);
  }, [callId, updateInterval, phoneManager.isInitialized()]);

  return {
    formattedDuration: formatCallDuration(duration),
    durationMs: duration,
    durationSeconds: Math.floor(duration / 1000)
  };
};

// ===== CALL STATS HOOK =====

export interface UseCallStatsReturn {
  stats: PhoneStats | null;
  isLoading: boolean;
  refresh: () => void;
}

export const useCallStats = (autoRefresh: boolean = true, refreshInterval: number = 5000): UseCallStatsReturn => {
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const phoneManager = GlobalPhoneManager.getInstance();

  const refresh = useCallback(() => {
    if (phoneManager.isInitialized()) {
      setIsLoading(true);
      try {
        const currentStats = phoneManager.getStats();
        setStats(currentStats);
      } catch (error) {
        console.error('Failed to get call stats:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [phoneManager.isInitialized()]);

  useEffect(() => {
    if (autoRefresh && phoneManager.isInitialized()) {
      refresh();

      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refresh, phoneManager.isInitialized()]);

  return {
    stats,
    isLoading,
    refresh
  };
};