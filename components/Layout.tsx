// components/Layout.tsx - Updated with Global Call Manager
"use client";

import Sidebar from './Sidebar';
import GlobalCallManager from './GlobalCallManager'; // Add this import
import { LuUserRound } from "react-icons/lu";
import { Analytics } from "@vercel/analytics/next";
import React, { useState, useEffect } from "react"; 
import WaitingCallPopup from './WaitingCallPopup';
import MinimizedCall from './MinimizedCall';
import { NotificationService } from '../utils/notificationService';
import { useGlobalSocket } from '../hooks/useGlobalSocket';

interface LayoutProps {
    children: React.ReactNode;
    showTasksPanel?: boolean;
    
}
export default function Layout({ children, showTasksPanel = true }: LayoutProps) {
    useGlobalSocket();

    const [companyName, setCompanyName] = useState("BitNexDial");
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);
useEffect(() => {
    const requestNotificationPermission = async () => {
        const notificationService = NotificationService.getInstance();
        
        setTimeout(async () => {
            if (Notification.permission === 'default') {
                await notificationService.requestPermissionWithPrompt();
            }
        }, 3000);
    };

    requestNotificationPermission();
}, []);
    // Add this useEffect to handle client-side only logic
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient && typeof window !== "undefined") {
            const name = localStorage.getItem("companyName");
            if (name && name.trim() !== "") setCompanyName(name);
        }
    }, [isClient]);

    // Check for mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Parent function to close sidebar
const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };
  

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-teal-50/10 dark:from-gray-900 dark:via-slate-900/90 dark:to-gray-800/80">
            <Analytics />

            {/* Global Call Manager - This will persist across all pages */}
            <GlobalCallManager />
            <WaitingCallPopup />
            <MinimizedCall />

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-600 px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        <div className="w-5 h-5 flex flex-col justify-center items-center">
                            <span className={`bg-white block h-0.5 w-5 rounded-sm transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-1' : '-translate-y-1'}`}></span>
                            <span className={`bg-white block h-0.5 w-5 rounded-sm transition-all duration-300 ${sidebarOpen ? 'opacity-0' : 'opacity-100'}`}></span>
                            <span className={`bg-white block h-0.5 w-5 rounded-sm transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-1' : 'translate-y-1'}`}></span>
                        </div>
                    </button>

                    {/* Company Name */}
                    <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-md">
                            <LuUserRound className="text-teal-600 dark:text-teal-400 text-xs" />
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                            {companyName}
                        </span>
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                        <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center shadow-md border border-gray-200 dark:border-slate-600">
                            <span className="text-[#3778D6] dark:text-blue-400 font-bold text-xs">SD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block">
                <div className="absolute top-2 left-2 z-30">
                    <div className="group relative">
                        <div className="bg-gradient-to-r from-[#D3E9E7] to-[#E1F0EE] dark:from-slate-800 dark:to-slate-700 rounded-2xl px-4 py-2.5 shadow-lg border border-white/30 dark:border-slate-600/30 group-hover:shadow-xl dark:group-hover:shadow-slate-900/50 transition-all duration-300 backdrop-blur-sm">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-md dark:shadow-slate-900/30">
                                    <LuUserRound className="text-teal-600 dark:text-teal-400 text-sm" />
                                </div>
                                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm group-hover:text-[#3778D6] dark:group-hover:text-blue-400 transition-colors duration-300">
                                    {companyName}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute top-2 right-2 z-30">
                    <div className="group relative">
                        <div className="bg-gradient-to-r from-[#D3E9E7] to-[#C1E0DD] dark:from-slate-800 dark:to-slate-700 rounded-2xl px-3 py-2.5 shadow-lg border border-white/30 dark:border-slate-600/30 group-hover:shadow-xl dark:group-hover:shadow-slate-900/50 transition-all duration-300 backdrop-blur-sm">
                            <div className="flex items-center space-x-3">
                                <div className="hidden sm:flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Online</span>
                                </div>
                                <div className="relative">
                                    <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-md dark:shadow-slate-900/30 border border-gray-200 dark:border-slate-600">
                                        <span className="text-[#3778D6] dark:text-blue-400 font-bold text-sm">SD</span>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full border border-white dark:border-slate-700"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-41 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Layout Container */}
            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} ${isMobile ? 'pt-16' : ''}`}>
                {/* Sidebar */}
                <div className={`
                    ${isMobile
                        ? `fixed top-16 left-0 bottom-0 w-64 transform transition-transform duration-300 ease-in-out z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
                        : 'relative w-20 mx-4 flex-shrink-0'
                    }
                `}>
                    <div className={`
                        ${isMobile
                            ? 'h-full overflow-y-auto'
                            : 'flex flex-col h-[90vh] self-center mt-20'
                        }
                    `}>
                        {/* <Sidebar /> */}
                        <Sidebar onCloseSidebar={handleCloseSidebar} />

                    </div>
                </div>

                {/* Main Content */}
                <div className={`
                    flex-1 
                    ${isMobile
                        ? 'min-h-[calc(100vh-4rem)] overflow-y-auto px-4 pb-4'
                        : 'h-[90vh] self-center mt-20'
                    }
                `}>
                    <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none">
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: 'radial-gradient(circle at 2px 2px, #3778D6 1px, transparent 0)',
                                backgroundSize: '24px 24px'
                            }}
                        />
                    </div>

                    <div className={`relative ${isMobile ? 'min-h-full' : 'h-full'}`}>
                        {children}
                    </div>
                </div>

            </div>

            {/* Mobile Tasks Panel Toggle */}
            {showTasksPanel && isMobile && (
                <div className="fixed bottom-4 right-4 z-40">
                    <button
                        className="w-12 h-12 bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
                        onClick={() => {/* Mobile tasks panel modal */ }}
                    >
                        <span className="text-lg">📋</span>
                    </button>
                </div>
            )}

            {/* Ambient effects */}
            <div className="fixed inset-0 pointer-events-none z-0 dark:block hidden">
                <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-teal-500/10 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 left-4 w-20 h-20 bg-gradient-to-tr from-teal-500/10 to-blue-500/10 rounded-full blur-xl"></div>
            </div>

            <div className="fixed inset-0 pointer-events-none z-0 dark:hidden block">
                <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-blue-200/20 to-teal-200/20 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 left-4 w-20 h-20 bg-gradient-to-tr from-teal-200/20 to-blue-200/20 rounded-full blur-xl"></div>
            </div>
        </div>
    );
}