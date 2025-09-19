// components/Loader.tsx
'use client';

import React from 'react';

interface LoaderProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    className?: string;
    message?: string;
}

export default function Loader({
    size = 'medium',
    color = 'rgb(81, 228, 220)',
    className = '',
    message
}: LoaderProps) {
    const getSizeClasses = () => {
        switch (size) {
            case 'small':
                return 'w-9 h-9'; // 36px
            case 'large':
                return 'w-24 h-24'; // 96px
            default:
                return 'w-18 h-18'; // 72px
        }
    };

    const getBoxSize = () => {
        switch (size) {
            case 'small':
                return 'w-2.5 h-2.5 mr-1'; // 10px boxes with 4px margin
            case 'large':
                return 'w-7 h-7 mr-2'; // 28px boxes with 8px margin
            default:
                return 'w-5 h-5 mr-1.5'; // 20px boxes with 6px margin
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div className={`banter-loader relative ${getSizeClasses()}`} style={{ '--loader-color': color } as React.CSSProperties}>
                {[...Array(9)].map((_, index) => (
                    <div
                        key={index}
                        className={`banter-loader__box float-left relative ${getBoxSize()}`}
                        style={{
                            marginBottom: (index + 1) % 3 === 0 ? '0.375rem' : '0', // 6px for every 3rd item
                            marginRight: (index + 1) % 3 === 0 ? '0' : undefined,
                        }}
                    >
                        <div
                            className="absolute inset-0 w-full h-full rounded-md transform rotate-45 opacity-70"
                            style={{ backgroundColor: color }}
                        />
                    </div>
                ))}
            </div>
            {message && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 animate-pulse">
                    {message}
                </p>
            )}

            <style jsx>{`
                .banter-loader__box:nth-child(3n) {
                    margin-right: 0;
                }

                .banter-loader__box:last-child {
                    margin-bottom: 0;
                }

                .banter-loader__box:nth-child(1) > div,
                .banter-loader__box:nth-child(4) > div {
                    margin-left: ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'};
                }

                .banter-loader__box:nth-child(3) > div {
                    margin-top: ${size === 'small' ? '26px' : size === 'large' ? '70px' : '52px'};
                }

                @keyframes moveBox-1 {
                    9.0909090909% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    18.1818181818% { transform: translate(0px, 0); }
                    27.2727272727% { transform: translate(0px, 0); }
                    36.3636363636% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    45.4545454545% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    54.5454545455% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    63.6363636364% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    72.7272727273% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0px); }
                    81.8181818182% { transform: translate(0px, 0px); }
                    90.9090909091% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0px); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-2 {
                    9.0909090909% { transform: translate(0, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    27.2727272727% { transform: translate(0px, 0); }
                    36.3636363636% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    45.4545454545% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    54.5454545455% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    63.6363636364% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    72.7272727273% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    81.8181818182% { transform: translate(0px, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    90.9090909091% { transform: translate(0px, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-3 {
                    9.0909090909% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    27.2727272727% { transform: translate(0px, 0); }
                    36.3636363636% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    45.4545454545% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    54.5454545455% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    63.6363636364% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    72.7272727273% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    81.8181818182% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    90.9090909091% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-4 {
                    9.0909090909% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    27.2727272727% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    36.3636363636% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    45.4545454545% { transform: translate(0px, 0px); }
                    54.5454545455% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    63.6363636364% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    72.7272727273% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    81.8181818182% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    90.9090909091% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0px); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-5 {
                    9.0909090909% { transform: translate(0, 0); }
                    18.1818181818% { transform: translate(0, 0); }
                    27.2727272727% { transform: translate(0, 0); }
                    36.3636363636% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    45.4545454545% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    54.5454545455% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    63.6363636364% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    72.7272727273% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    81.8181818182% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    90.9090909091% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-6 {
                    9.0909090909% { transform: translate(0, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    27.2727272727% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    36.3636363636% { transform: translate(0px, 0); }
                    45.4545454545% { transform: translate(0px, 0); }
                    54.5454545455% { transform: translate(0px, 0); }
                    63.6363636364% { transform: translate(0px, 0); }
                    72.7272727273% { transform: translate(0px, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    81.8181818182% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, ${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}); }
                    90.9090909091% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0px); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-7 {
                    9.0909090909% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    27.2727272727% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0); }
                    36.3636363636% { transform: translate(0px, 0); }
                    45.4545454545% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    54.5454545455% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    63.6363636364% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    72.7272727273% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    81.8181818182% { transform: translate(0px, 0px); }
                    90.9090909091% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0px); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-8 {
                    9.0909090909% { transform: translate(0, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    27.2727272727% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    36.3636363636% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    45.4545454545% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    54.5454545455% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    63.6363636364% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    72.7272727273% { transform: translate(0px, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    81.8181818182% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, ${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}); }
                    90.9090909091% { transform: translate(${size === 'small' ? '13px' : size === 'large' ? '35px' : '26px'}, 0px); }
                    100% { transform: translate(0px, 0px); }
                }

                @keyframes moveBox-9 {
                    9.0909090909% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    18.1818181818% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    27.2727272727% { transform: translate(0px, 0); }
                    36.3636363636% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    45.4545454545% { transform: translate(0px, 0); }
                    54.5454545455% { transform: translate(0px, 0); }
                    63.6363636364% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    72.7272727273% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    81.8181818182% { transform: translate(${size === 'small' ? '-26px' : size === 'large' ? '-70px' : '-52px'}, 0); }
                    90.9090909091% { transform: translate(${size === 'small' ? '-13px' : size === 'large' ? '-35px' : '-26px'}, 0); }
                    100% { transform: translate(0px, 0); }
                }

                .banter-loader__box:nth-child(1) {
                    animation: moveBox-1 4s infinite;
                }

                .banter-loader__box:nth-child(2) {
                    animation: moveBox-2 4s infinite;
                }

                .banter-loader__box:nth-child(3) {
                    animation: moveBox-3 4s infinite;
                }

                .banter-loader__box:nth-child(4) {
                    animation: moveBox-4 4s infinite;
                }

                .banter-loader__box:nth-child(5) {
                    animation: moveBox-5 4s infinite;
                }

                .banter-loader__box:nth-child(6) {
                    animation: moveBox-6 4s infinite;
                }

                .banter-loader__box:nth-child(7) {
                    animation: moveBox-7 4s infinite;
                }

                .banter-loader__box:nth-child(8) {
                    animation: moveBox-8 4s infinite;
                }

                .banter-loader__box:nth-child(9) {
                    animation: moveBox-9 4s infinite;
                }
            `}</style>
        </div>
    );
}