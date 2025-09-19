import { useState, useEffect } from 'react';

interface SMSCounterData {
    total: number;
    sms: number;
    mms: number;
    unreadCount: number;
}

export function useSMSCounter() {
    const [smsData, setSmsData] = useState<SMSCounterData>({
        total: 0,
        sms: 0,
        mms: 0,
        unreadCount: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchSMSCounter = async () => {
        try {
            const myPhoneNumber = localStorage.getItem("myPhoneNumber");
            if (!myPhoneNumber) return;

            const response = await fetch(`https://bkpmanual.bitnexdial.com/api/sms-counter-user?number=${encodeURIComponent(myPhoneNumber)}`);
            const data = await response.json();
            
            setSmsData(prev => ({
                ...prev,
                total: data.total || 0,
                sms: data.sms || 0,
                mms: data.mms || 0
            }));
        } catch (error) {
            console.error('Failed to fetch SMS counter:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateUnreadCount = () => {
        // Count unread messages from persistent contact list
        const persistentContactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
        const unreadCount = persistentContactList.reduce((total: number, contact: any) => {
            return total + (contact.unreadCount || 0);
        }, 0);
        
        console.log('📊 Updated unread count:', unreadCount);
        setSmsData(prev => ({ ...prev, unreadCount }));
    };

    const markAsRead = () => {
        setSmsData(prev => ({ ...prev, unreadCount: 0 }));
    };

useEffect(() => {
    fetchSMSCounter();
    updateUnreadCount();

    let updateTimeout: NodeJS.Timeout;
    let lastProcessedEvent = '';
    
    // Debounced update function
    const debouncedUpdate = () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            updateUnreadCount();
        }, 500); // Increased debounce time
    };

    // Listen for global SMS events with duplicate prevention
    const handleGlobalSMSReceived = (event: CustomEvent) => {
        const eventId = `${event.detail.messageId}-${event.detail.timestamp}`;
        
        if (lastProcessedEvent === eventId) {
            console.log('📱 SMS counter: duplicate event detected, skipping');
            return;
        }
        
        lastProcessedEvent = eventId;
        console.log('📱 SMS counter: processing new event');
        
        debouncedUpdate();
        
        // Also update total count
        setSmsData(prev => ({
            ...prev,
            total: prev.total + 1,
            sms: prev.sms + 1
        }));
    };

    // Listen for contact read events
    const handleContactRead = () => {
        debouncedUpdate();
    };

    window.addEventListener('globalSMSReceived', handleGlobalSMSReceived as EventListener);
    window.addEventListener('contactRead', handleContactRead);

    return () => {
        clearTimeout(updateTimeout);
        window.removeEventListener('globalSMSReceived', handleGlobalSMSReceived as EventListener);
        window.removeEventListener('contactRead', handleContactRead);
    };
}, []);

    return { smsData, isLoading, markAsRead, updateUnreadCount };
}