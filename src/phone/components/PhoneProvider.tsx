"use client";


import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GlobalPhoneManager } from '../utils/PhoneIntegrationUtils';
import { 
  FreePBXConfig, 
  CallSession, 
  PhoneSystemEvents,
  RegistrationState,
  PhoneStats,
  CallState
} from '../core/types';

// ===== CONTEXT TYPES =====

interface PhoneContextValue {
  // State
  isInitialized: boolean;
  isRegistered: boolean;
  registrationState: RegistrationState;
  activeCalls: CallSession[];
  currentCall: CallSession | null;
  stats: PhoneStats | null;
  error: string | null;
  isLoading: boolean;

  // Actions
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

// ===== CONTEXT CREATION =====

const PhoneContext = createContext<PhoneContextValue | null>(null);

// ===== PHONE PROVIDER COMPONENT =====

interface PhoneProviderProps {
  children: ReactNode;
  autoInitialize?: boolean;
  config?: FreePBXConfig;
}

export const PhoneProvider: React.FC<PhoneProviderProps> = ({ 
  children, 
  autoInitialize = false, 
  config 
}) => {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationState, setRegistrationState] = useState<RegistrationState>(RegistrationState.UNREGISTERED);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const phoneManager = GlobalPhoneManager.getInstance();

  // ===== INITIALIZATION =====

  const initializePhone = async (phoneConfig: FreePBXConfig): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await phoneManager.initialize(phoneConfig);
      setIsInitialized(true);
      setRegistrationState(phoneManager.getRegistrationState());
      setIsRegistered(phoneManager.getRegistrationState() === RegistrationState.REGISTERED);
      
      // Update stats
      if (phoneManager.isInitialized()) {
        setStats(phoneManager.getStats());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize phone';
      setError(errorMessage);
      console.error('Phone initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== CALL ACTIONS =====

  const makeCall = async (number: string): Promise<string> => {
    setError(null);
    try {
      const callId = await phoneManager.makeCall(number);
      updateActiveCalls();
      return callId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make call';
      setError(errorMessage);
      throw err;
    }
  };

  const answerCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.answerCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to answer call';
      setError(errorMessage);
      throw err;
    }
  };

  const rejectCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.rejectCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject call';
      setError(errorMessage);
      throw err;
    }
  };

  const hangupCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.hangupCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to hangup call';
      setError(errorMessage);
      throw err;
    }
  };

  const hangupAllCalls = async (): Promise<void> => {
    setError(null);
    try {
      await phoneManager.hangupAllCalls();
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to hangup all calls';
      setError(errorMessage);
      throw err;
    }
  };

  const holdCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.holdCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to hold call';
      setError(errorMessage);
      throw err;
    }
  };

  const unholdCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.unholdCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unhold call';
      setError(errorMessage);
      throw err;
    }
  };

  const muteCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.muteCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mute call';
      setError(errorMessage);
      throw err;
    }
  };

  const unmuteCall = async (callId: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.unmuteCall(callId);
      updateActiveCalls();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unmute call';
      setError(errorMessage);
      throw err;
    }
  };

  const sendDTMF = async (callId: string, digit: string): Promise<void> => {
    setError(null);
    try {
      await phoneManager.sendDTMF(callId, digit);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send DTMF';
      setError(errorMessage);
      throw err;
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  // ===== HELPER FUNCTIONS =====

  const updateActiveCalls = (): void => {
    if (phoneManager.isInitialized()) {
      const calls = phoneManager.getActiveCalls();
      setActiveCalls(calls);
      setCurrentCall(calls.length > 0 ? calls[0] : null);
      setStats(phoneManager.getStats());
    }
  };

  // ===== EFFECTS =====

  useEffect(() => {
    // Auto-initialize if config provided
    if (autoInitialize && config && !isInitialized) {
      initializePhone(config);
    }
  }, [autoInitialize, config, isInitialized]);

  useEffect(() => {
    if (!phoneManager.isInitialized()) {
      return;
    }

    // Event listeners
    const handleRegistrationSuccess = (data: PhoneSystemEvents['registration:success']) => {
      setRegistrationState(data.state);
      setIsRegistered(data.state === RegistrationState.REGISTERED);
      setError(null);
    };

    const handleRegistrationFailed = (data: PhoneSystemEvents['registration:failed']) => {
      setRegistrationState(RegistrationState.FAILED);
      setIsRegistered(false);
      setError(data.error);
    };

    const handleCallIncoming = (data: PhoneSystemEvents['call:incoming']) => {
      updateActiveCalls();
    };

    const handleCallOutgoing = (data: PhoneSystemEvents['call:outgoing']) => {
      updateActiveCalls();
    };

    const handleCallAnswered = (data: PhoneSystemEvents['call:answered']) => {
      updateActiveCalls();
    };

    const handleCallEnded = (data: PhoneSystemEvents['call:ended']) => {
      updateActiveCalls();
    };

    const handleCallHold = (data: PhoneSystemEvents['call:hold']) => {
      updateActiveCalls();
    };

    const handleCallUnhold = (data: PhoneSystemEvents['call:unhold']) => {
      updateActiveCalls();
    };

    const handleCallMuted = (data: PhoneSystemEvents['call:muted']) => {
      updateActiveCalls();
    };

    const handleCallUnmuted = (data: PhoneSystemEvents['call:unmuted']) => {
      updateActiveCalls();
    };

    const handleError = (data: PhoneSystemEvents['error']) => {
      setError(data.error.message);
      console.error('Phone system error:', data.error, 'Context:', data.context);
    };

    // Subscribe to events
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

    // Cleanup
    return () => {
      phoneManager.off('registration:success', handleRegistrationSuccess);
      phoneManager.off('registration:failed', handleRegistrationFailed);
      phoneManager.off('call:incoming', handleCallIncoming);
      phoneManager.off('call:outgoing', handleCallOutgoing);
      phoneManager.off('call:answered', handleCallAnswered);
      phoneManager.off('call:ended', handleCallEnded);
      phoneManager.off('call:hold', handleCallHold);
      phoneManager.off('call:unhold', handleCallUnhold);
      phoneManager.off('call:muted', handleCallMuted);
      phoneManager.off('call:unmuted', handleCallUnmuted);
      phoneManager.off('error', handleError);
    };
  }, [phoneManager.isInitialized()]);

  // Regular stats update
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      if (phoneManager.isInitialized()) {
        setStats(phoneManager.getStats());
        updateActiveCalls();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  // ===== CONTEXT VALUE =====

  const contextValue: PhoneContextValue = {
    // State
    isInitialized,
    isRegistered,
    registrationState,
    activeCalls,
    currentCall,
    stats,
    error,
    isLoading,

    // Actions
    initializePhone,
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

  return (
    <PhoneContext.Provider value={contextValue}>
      {children}
    </PhoneContext.Provider>
  );
};


// ===== PHONE HOOK =====

export const usePhone = (): PhoneContextValue => {
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhone must be used within a PhoneProvider');
  }
  return context;
};

// ===== PHONE LOGIN COMPONENT =====

interface PhoneLoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const PhoneLogin: React.FC<PhoneLoginProps> = ({ 
  onSuccess, 
  onError, 
  className = '' 
}) => {
  const { initializePhone, isLoading, error, isInitialized } = usePhone();
  
  const [formData, setFormData] = useState({
    sipUri: '',
    username: '',
    password: '',
    displayName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const config: FreePBXConfig = {
        sipUri: formData.sipUri,
        username: formData.username,
        password: formData.password,
        displayName: formData.displayName || formData.username,
        debug: false,
        autoAnswer: false
      };

      await initializePhone(config);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      onError?.(errorMessage);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (isInitialized) {
    return (
      <div className={`phone-login-success ${className}`}>
        <div className="text-green-600 text-center">
          ✓ Phone system connected successfully
        </div>
      </div>
    );
  }

  return (
    <div className={`phone-login ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold text-center mb-4">Phone Login</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SIP URI
          </label>
          <input
            type="text"
            name="sipUri"
            value={formData.sipUri}
            onChange={handleInputChange}
            placeholder="sip:username@domain.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Your SIP username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Your SIP password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name (Optional)
          </label>
          <input
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleInputChange}
            placeholder="Your display name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
};

// ===== PHONE STATUS COMPONENT =====

interface PhoneStatusProps {
  showCalls?: boolean;
  showStats?: boolean;
  className?: string;
}

export const PhoneStatus: React.FC<PhoneStatusProps> = ({ 
  showCalls = true, 
  showStats = false, 
  className = '' 
}) => {
  const { 
    isInitialized, 
    isRegistered, 
    registrationState, 
    activeCalls, 
    currentCall, 
    stats,
    hangupCall,
    holdCall,
    unholdCall,
    muteCall,
    unmuteCall
  } = usePhone();

  const getStatusColor = () => {
    if (!isInitialized) return 'text-gray-500';
    if (!isRegistered) return 'text-red-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (!isInitialized) return 'Not Connected';
    switch (registrationState) {
      case RegistrationState.REGISTERED:
        return 'Connected';
      case RegistrationState.REGISTERING:
        return 'Connecting...';
      case RegistrationState.FAILED:
        return 'Connection Failed';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className={`phone-status ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center space-x-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${
          isRegistered ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <span className={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Active Calls */}
      {showCalls && activeCalls.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Active Calls</h3>
          <div className="space-y-2">
            {activeCalls.map((call) => (
              <div key={call.id} className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{call.remoteNumber}</div>
                    <div className="text-sm text-gray-600">
                      {call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} • {call.state}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {call.state === CallState.CONFIRMED && (
                      <>
                        <button
                          onClick={() => call.isOnHold ? unholdCall(call.id) : holdCall(call.id)}
                          className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          {call.isOnHold ? 'Unhold' : 'Hold'}
                        </button>
                        <button
                          onClick={() => call.isMuted ? unmuteCall(call.id) : muteCall(call.id)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          {call.isMuted ? 'Unmute' : 'Mute'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => hangupCall(call.id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Hangup
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      {showStats && stats && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Statistics</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Calls: {stats.totalCalls}</div>
            <div>Active: {stats.activeCalls}</div>
            <div>Today: {stats.callsToday}</div>
            <div>Avg Duration: {Math.round(stats.averageCallDuration / 1000)}s</div>
          </div>
        </div>
      )}
    </div>
  );
};