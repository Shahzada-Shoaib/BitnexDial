'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type CallStatusContextType = {
  callActive: boolean;
};

const CallStatusContext = createContext<CallStatusContextType>({
  callActive: false,
});

export const CallStatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [callActive, setCallActive] = useState(false);

  useEffect(() => {
    const checkCallStatus = () => {
      const active =
        window.Lines &&
        Array.isArray(window.Lines) &&
        window.Lines.some(
          (line) =>
            line?.SipSession &&
            ['connecting', 'connected', 'confirmed', 'established', 'ringing', 'calling'].includes(
              (line.SipSession.status || '').toLowerCase()
            )
        );

      setCallActive(!!active);
    };

    const interval = setInterval(checkCallStatus, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <CallStatusContext.Provider value={{ callActive }}>
      {children}
    </CallStatusContext.Provider>
  );
};

export const useCallStatus = () => useContext(CallStatusContext);
