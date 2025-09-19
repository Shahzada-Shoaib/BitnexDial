import { useState, useCallback } from 'react';

interface OptimizedImageProps {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
}

export function OptimizedImage({ src, alt, className, placeholder }: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const handleLoad = useCallback(() => {
        setIsLoaded(true);
    }, []);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    if (hasError) {
        return (
            <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
                <span className="text-gray-400 text-sm">Failed to load</span>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {!isLoaded && placeholder && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={handleLoad}
                onError={handleError}
                className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                loading="lazy"
            />
        </div>
    );
}
