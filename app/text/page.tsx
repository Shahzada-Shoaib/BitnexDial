'use client';

import { Suspense } from 'react';
import TextInterface from '../../components/TextInterface';

// Loading component for Suspense fallback
function TextInterfaceLoading() {
    return (
        <div className="flex items-center justify-center w-full h-[90vh] bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading messages...</p>
            </div>
        </div>
    );
}

export default function TextPage() {
    return (
        <Suspense fallback={<TextInterfaceLoading />}>
            <TextInterface />
        </Suspense>
    );
}