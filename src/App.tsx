// src/App.tsx
import React from 'react';
import PhoneInterface from '../components/PhoneInterface';
import SwitchCallNotification from '../components/SwitchCallNotification';
import GlobalIncomingCallAlert from '@/components/IncomingCallAlert';

function App() {
    return (
        <div className="app">
            {/* Your existing app content */}
            <PhoneInterface />
            <GlobalIncomingCallAlert/>
            
            {/* Add the switch call notification overlay */}
            <SwitchCallNotification />
        </div>
    );
}

export default App;




