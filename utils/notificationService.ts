interface NotificationData {
    fromNumber: string;
    message: string;
    contactName?: string;
    timestamp: string;
    mediaUrl?: string
}

export class NotificationService {
    private static instance: NotificationService;
    private notificationSound: HTMLAudioElement | null = null;
    private hasPermission = false;

    private constructor() {
        this.initializeSound();
        this.requestPermission();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    private initializeSound() {
        try {
            this.createNotificationBeep();
        } catch (error) {
            console.warn('Could not initialize notification sound:', error);
        }
    }

    private createNotificationBeep() {
        // Create notification sound using Web Audio API (no external files needed)
        this.notificationSound = {
            play: () => {
                try {
                    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
                        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();

                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);

                        // Create pleasant notification sound
                        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

                        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.4);

                        console.log('🔊 Notification sound played');
                    } else {
                        console.warn('Web Audio API not supported');
                    }
                } catch (error) {
                    console.warn('Could not play notification sound:', error);
                }
            }
        } as HTMLAudioElement;
    }

    private async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.hasPermission = true;
            return true;
        }

        if (Notification.permission === 'denied') {
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.hasPermission = permission === 'granted';
            return this.hasPermission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    public async showSMSNotification(data: NotificationData): Promise<void> {
        this.playNotificationSound();

        if (this.hasPermission) {
            this.showBrowserNotification(data);
        }

        this.showInAppNotification(data);
    }

    private playNotificationSound(): void {
        try {
            if (this.notificationSound) {
                this.notificationSound.play();
            }
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    }

    private showBrowserNotification(data: NotificationData): void {
        try {
            const notification = new Notification(`New SMS from ${data.contactName || data.fromNumber}`, {
                body: data.message.replace(/<[^>]*>/g, '').substring(0, 100),
                icon: '/logo.png',
                badge: '/logo.png',
                tag: `sms-${data.fromNumber}`,
                requireInteraction: false,
                silent: false
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = `/text?to=${data.fromNumber}`;
                notification.close();
            };

            setTimeout(() => {
                notification.close();
            }, 5000);
        } catch (error) {
            console.error('Error showing browser notification:', error);
        }
    }

    private showInAppNotification(data: NotificationData): void {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 z-[10000] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-600 p-4 max-w-sm animate-slideInRight';

        notification.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                        </svg>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                        New message from ${data.contactName || data.fromNumber}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                        ${data.message.replace(/<[^>]*>/g, '').substring(0, 60)}${data.message.length > 60 ? '...' : ''}
                    </p>
                </div>
                <button class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        notification.onclick = () => {
            window.location.href = `/text`;
        };

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    public async requestPermissionWithPrompt(): Promise<boolean> {
        if (!('Notification' in window)) {
            alert('This browser does not support desktop notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        const userWantsNotifications = confirm(
            'Would you like to receive desktop notifications for new SMS messages?'
        );

        if (userWantsNotifications) {
            return await this.requestPermission();
        }

        return false;
    }
}