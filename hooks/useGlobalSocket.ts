import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { NotificationService } from '../utils/notificationService';

export function useGlobalSocket() {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Prevent multiple socket instances
        if (typeof window !== 'undefined' && (window as any).globalSocketInitialized) {
            return;
        }

        
        const socket = io("https://bkpmanual.bitnexdial.com:3000");
        socketRef.current = socket;
        
        // Mark as initialized
        if (typeof window !== 'undefined') {
            (window as any).globalSocket = socket;
            (window as any).globalSocketInitialized = true;
        }

        const me = localStorage.getItem("myPhoneNumber")?.replace(/\D/g, '').replace(/^1/, '') || '';
        if (me.length === 10) {
            socket.emit("register", me);
        }

        // Single SMS listener with duplicate prevention
socket.on("new_sms", (msgData: any) => {   
    const fromNumber = msgData.from?.replace(/\D/g, '').replace(/^1/, '') || '';
    const toNumber = msgData.to?.replace(/\D/g, '').replace(/^1/, '') || '';
    const myNumber = me;

    // Only process incoming messages
    if (fromNumber !== myNumber) {
        
        // Create more specific unique message ID
        const messageId = `${fromNumber}-${toNumber}-${msgData.time}-${(msgData.body || '').substring(0, 20).replace(/\s/g, '')}`;
        
        // Check for duplicates with more robust detection
        const processedMessages = JSON.parse(localStorage.getItem('processedMessages') || '[]');
        
        // Also check recent processing (last 5 seconds) to prevent rapid duplicates
        const recentProcessing = sessionStorage.getItem('recentMessageProcessing') || '';
        const now = Date.now();
        
        if (processedMessages.includes(messageId)) {
            console.log('📨 DUPLICATE message detected (localStorage), skipping:', messageId);
            return;
        }
        
        if (recentProcessing === messageId) {
            console.log('📨 DUPLICATE message detected (recent processing), skipping:', messageId);
            return;
        }

        // Mark as recently processing
        sessionStorage.setItem('recentMessageProcessing', messageId);
        setTimeout(() => {
            if (sessionStorage.getItem('recentMessageProcessing') === messageId) {
                sessionStorage.removeItem('recentMessageProcessing');
            }
        }, 5000);

        // Mark as processed
        processedMessages.push(messageId);
        if (processedMessages.length > 50) {
            processedMessages.splice(0, processedMessages.length - 50);
        }
        localStorage.setItem('processedMessages', JSON.stringify(processedMessages));


        const messageObj = {
            tx_rx_datetime: msgData.time || new Date().toISOString(),
            sender: fromNumber,
            receiver: toNumber,
            body: msgData.body || msgData.message || '',
            direction: 'inbound',
            mediaUrl: msgData.mediaUrl || null
        };

        // Store message in conversation stream
        const contactId = fromNumber;
        const streamKey = `${contactId}-stream`;
        const existingStream = JSON.parse(localStorage.getItem(streamKey) || '{"DataCollection":[]}');
        existingStream.DataCollection = existingStream.DataCollection || [];
        existingStream.DataCollection.push(messageObj);
        localStorage.setItem(streamKey, JSON.stringify(existingStream));

        // Update contact list - ONLY ONCE
        const contactList = JSON.parse(localStorage.getItem('persistentContactList') || '[]');
        
        const savedContacts = JSON.parse(localStorage.getItem('savedContacts') || '[]');
        const savedContact = savedContacts.find((c: any) => 
            c.phone?.replace(/\D/g, '') === fromNumber
        );
        const contactName = savedContact?.name || `(${fromNumber.slice(0, 3)}) ${fromNumber.slice(3, 6)}-${fromNumber.slice(6)}`;

        let contactFound = false;
        const updatedContactList = contactList.map((contact: any) => {
            const normalizedContactId = contact.id?.replace(/\D/g, '').replace(/^1/, '') || '';
            if (normalizedContactId === contactId) {
                contactFound = true;
                return {
                    ...contact,
                    hasUnread: true,
                    unreadCount: (contact.unreadCount || 0) + 1,
                    lastMessage: messageObj.body.replace(/<[^>]*>/g, ''),
                    lastMessageDate: messageObj.tx_rx_datetime,
                    lastMessageTime: new Date(messageObj.tx_rx_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            }
            return contact;
        });

        // Add new contact if not found
        if (!contactFound) {
            const newContact = {
                id: contactId,
                phone: `(${contactId.slice(0, 3)}) ${contactId.slice(3, 6)}-${contactId.slice(6)}`,
                name: contactName,
                hasUnread: true,
                unreadCount: 1,
                lastMessage: messageObj.body.replace(/<[^>]*>/g, ''),
                lastMessageDate: messageObj.tx_rx_datetime,
                lastMessageTime: new Date(messageObj.tx_rx_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            updatedContactList.unshift(newContact);
        }

        // Sort and save
        const sortedContacts = updatedContactList.sort((a: any, b: any) => {
            if (a.hasUnread && !b.hasUnread) return -1;
            if (!a.hasUnread && b.hasUnread) return 1;
            if (a.lastMessageDate && b.lastMessageDate) {
                return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
            }
            return 0;
        });

        localStorage.setItem('persistentContactList', JSON.stringify(sortedContacts));

        // Show notification (only once)
        const notificationService = NotificationService.getInstance();
        notificationService.showSMSNotification({
            fromNumber,
            message: messageObj.body,
            contactName,
            timestamp: messageObj.tx_rx_datetime,
            mediaUrl: messageObj?.mediaUrl
        });

        // Trigger UI updates (only once) - but prevent rapid duplicate events
        const eventKey = `globalSMSReceived-${messageId}`;
        if (!sessionStorage.getItem(eventKey)) {
            sessionStorage.setItem(eventKey, 'triggered');
            setTimeout(() => sessionStorage.removeItem(eventKey), 2000);
            
            window.dispatchEvent(new CustomEvent('globalSMSReceived', { 
                detail: { 
                    contactId, 
                    message: messageObj.body, 
                    fromNumber,
                    contactName,
                    timestamp: messageObj.tx_rx_datetime,
                    messageId,
                    mediaUrl: messageObj?.mediaUrl 
                } 
            }));
        }

    }
});

        return () => {
            if (typeof window !== 'undefined') {
                (window as any).globalSocketInitialized = false;
            }
        };
    }, []);

    return socketRef.current;
}