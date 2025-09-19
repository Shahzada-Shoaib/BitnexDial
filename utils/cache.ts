export class BrowserCache {
    private static readonly CACHE_PREFIX = 'phoneapp_';
    private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

    static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
        try {
            const item = {
                data,
                timestamp: Date.now(),
                ttl,
            };
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(item));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    static get<T>(key: string): T | null {
        try {
            const cached = localStorage.getItem(this.CACHE_PREFIX + key);
            if (!cached) return null;

            const item = JSON.parse(cached);
            const now = Date.now();

            // Check if cache is expired
            if (now - item.timestamp > item.ttl) {
                this.remove(key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.warn('Failed to retrieve cached data:', error);
            return null;
        }
    }

    static remove(key: string): void {
        try {
            localStorage.removeItem(this.CACHE_PREFIX + key);
        } catch (error) {
            console.warn('Failed to remove cached data:', error);
        }
    }

    static clear(): void {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }

    static isExpired(key: string): boolean {
        try {
            const cached = localStorage.getItem(this.CACHE_PREFIX + key);
            if (!cached) return true;

            const item = JSON.parse(cached);
            const now = Date.now();
            return now - item.timestamp > item.ttl;
        } catch (error) {
            return true;
        }
    }
}