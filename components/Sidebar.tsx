'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useTransition, Suspense, useEffect, useCallback } from 'react';
import { BsTelephone } from "react-icons/bs";
import { BsChatText } from "react-icons/bs";
import { RiContactsLine } from "react-icons/ri";
import { IoSettingsOutline } from "react-icons/io5";
import { BiLogOut } from "react-icons/bi";
import { HiOutlineMicrophone } from "react-icons/hi2";
import Loader from './Loader';
import { useSMSCounter } from '../hooks/useSMSCounter';
import { useGlobalSocket } from '../hooks/useGlobalSocket';
import { NotificationService } from '../utils/notificationService';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactElement | string;
  href: string;
  preload?: boolean;
  onClick?: () => void;
  badge?: number;
}

interface SidebarProps {
  onCloseSidebar?: () => void; // <-- parent callback to close sidebar
}

export default function Sidebar({ onCloseSidebar }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { smsData } = useSMSCounter();
  const [isPending, startTransition] = useTransition();
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [recentSMSActivity, setRecentSMSActivity] = useState(false);

  useGlobalSocket();

  // Handle client-side only flags + mobile check
  useEffect(() => {
    setIsClient(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!isClient) return;

    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (error) {
      console.log('Notification sound not available');
    }
  }, [isClient]);

  // Notification permission handler
  const handleNotificationSettings = useCallback(async () => {
    if (!isClient) return;

    const notificationService = NotificationService.getInstance();

    if (Notification.permission === 'granted') {
      alert('Notifications are already enabled!');
    } else if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
    } else {
      await notificationService.requestPermissionWithPrompt();
    }
  }, [isClient]);

  // Global SMS notification indicator
  useEffect(() => {
    if (!isClient) return;

    const handleSMSNotification = () => {
      setRecentSMSActivity(true);
      playNotificationSound();
      setTimeout(() => setRecentSMSActivity(false), 2000);
    };

    window.addEventListener('globalSMSReceived', handleSMSNotification);
    return () => window.removeEventListener('globalSMSReceived', handleSMSNotification);
  }, [isClient, playNotificationSound]);

  // Main nav items
  const mainNavItems: NavItem[] = React.useMemo(() => [
    { id: 'phone', label: 'Phone', icon: <BsTelephone />, href: '/phone', preload: true },
    {
      id: 'text',
      label: 'Text',
      icon: <BsChatText />,
      href: '/text',
      preload: true,
      badge: smsData.unreadCount || 0
    },
    { id: 'contacts', label: 'Contacts', icon: <RiContactsLine />, href: '/contacts' },
    { id: 'recording', label: 'Recording', icon: <HiOutlineMicrophone />, href: '/recording' },
  ], [smsData.unreadCount]);

  // ---- UPDATED: close parent sidebar after navigation (mobile only) ----
  const handleNavigation = useCallback((href: string, itemId: string) => {
    if (pathname === href) {
      // Even if already on the same route, we still close the sidebar on mobile
      if (isMobile && onCloseSidebar) onCloseSidebar();
      return;
    }

    setLoadingRoute(itemId);

    startTransition(() => {
      router.push(href);

      // Close sidebar immediately on mobile once navigation is initiated
      if (isMobile && onCloseSidebar) onCloseSidebar();

      setTimeout(() => setLoadingRoute(null), 500);
    });
  }, [pathname, router, isMobile, onCloseSidebar]);

  const handleLogout = useCallback(async () => {
    if (!isClient) return;

    const senderPhone = localStorage.getItem("myPhoneNumber");
    try {
      await fetch("https://bkpmanual.bitnexdial.com/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderPhone })
      });

      // Clear storage
      const itemsToRemove = [
        "loggedIn", "role", "senderPhone", "fullName",
        "secureWebSocketServer", "webSocketPort", "webSocketPath",
        "domain", "sipUsername", "sipPassword", "myPhoneNumber"
      ];

      itemsToRemove.forEach(item => {
        sessionStorage.removeItem(item);
        localStorage.removeItem(item);
      });

      localStorage.clear();
      window.location.href = "/login.html";
    } catch (err) {
      console.error("Logout API failed:", err);
      alert("Logout failed. Please try again.");
    }
  }, [isClient]);

  const systemNavItems: NavItem[] = React.useMemo(() => [
    { id: 'settings', label: 'Settings', icon: <IoSettingsOutline />, href: '/settings' },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: '🔔',
      href: '#',
      onClick: handleNotificationSettings
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: <BiLogOut />,
      href: '#',
      onClick: handleLogout
    },
  ], [handleNotificationSettings, handleLogout]);

  // ---- UPDATED: ensure clicking items with onClick also closes sidebar on mobile ----
  const renderNavItem = useCallback((item: NavItem) => {
    const isActive = pathname === item.href && item.href !== '#';
    const isLoading = loadingRoute === item.id;

    return (
      <div key={item.id}>
        <div
          onClick={() => {
            if (item.onClick) {
              item.onClick();
              if (isMobile && onCloseSidebar) onCloseSidebar(); // close after custom actions
            } else {
              handleNavigation(item.href, item.id);
            }
          }}
          className={`relative group w-full cursor-pointer transition-all duration-300 ease-out
            ${isMobile
              ? 'flex items-center space-x-4 p-4 rounded-xl mx-2 my-1'
              : 'hidden md:flex flex-col items-center py-2.5 px-3'
            }
            ${isActive
              ? 'bg-white/20 shadow-lg backdrop-blur-sm'
              : 'hover:bg-white/10'
            }
            ${isLoading ? 'opacity-50' : ''}`}
        >
          {/* Active indicator - Desktop only */}
          {isActive && !isMobile && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full shadow-lg"></div>
          )}

          {/* Active indicator - Mobile */}
          {isActive && isMobile && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full shadow-lg"></div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/10 rounded-lg backdrop-blur-sm">
              <Loader size="small" color="white" />
            </div>
          )}

          {/* Icon container */}
          <div className={`relative transition-all duration-300
            ${isMobile ? 'p-2 rounded-lg' : 'mb-2 p-2 rounded-xl'}
            ${isActive ? 'text-white bg-white/20 shadow-md' : 'text-white/80 group-hover:text-white group-hover:bg-white/10'}
          `}>
            <div className={`${isMobile ? 'text-base' : 'text-sm'}`}>
              {typeof item.icon === 'string' ? (
                <span className="text-sm">{item.icon}</span>
              ) : (
                item.icon
              )}
            </div>

            {/* Badge for unread count */}
            {item.badge !== undefined && (
              <div
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border-2 border-white transition-all duration-300 ${
                  item.badge > 0
                    ? `bg-red-500 ${recentSMSActivity ? 'animate-bounce scale-125' : 'animate-pulse'}`
                    : 'bg-gray-400'
                }`}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </div>
            )}
          </div>

          {/* Label */}
          <span
            className={`font-medium transition-all duration-300
              ${isMobile ? 'text-base flex-1' : 'text-[11px] text-center leading-tight'}
              ${isActive ? 'text-white font-semibold' : 'text-white/80 group-hover:text-white'}
            `}
          >
            {item.label}
          </span>

          {/* Mobile arrow indicator */}
          {isMobile && isActive && (
            <div className="text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-gradient-to-r from-white/10 to-white/5 transition-opacity duration-300"></div>
        </div>

        {/* Preload critical routes on hover - only render on client */}
        {isClient && item.preload && (
          <link
            rel="prefetch"
            href={item.href}
            onMouseEnter={() => router.prefetch(item.href)}
          />
        )}
      </div>
    );
  }, [pathname, loadingRoute, isMobile, handleNavigation, recentSMSActivity, isClient, router, onCloseSidebar]);

  // ----------- Render trees (unchanged, except logic above) -----------

  if (!isClient) {
    return (
      <div className="w-20 flex flex-col h-screen mb-2 overflow-y-auto">
        <div className="flex flex-col rounded-t-2xl bg-gradient-to-b from-[#3778D6] to-[#2E5FBD] items-center py-6 shadow-lg border-b border-white/10">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
            <img src="/logo.png" alt="Company Logo" className="w-8 h-8" />
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-gradient-to-b from-[#2E5FBD] to-[#1E4080] shadow-lg border-y border-white/5" />
        <div className="flex rounded-b-2xl flex-col bg-gradient-to-b from-[#1E4080] to-[#0F2040] shadow-lg py-2" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-full bg-gradient-to-b from-[#3778D6] to-[#0F2040] flex flex-col">
        {/* Mobile Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Company Logo" className="w-8 h-8" />
            <span className="text-white font-bold text-lg">Bitnex Dial</span>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex-1 py-4 overflow-y-auto">
          <div className="space-y-1">
            {mainNavItems.map(renderNavItem)}
          </div>

          <div className="border-t border-white/10 mt-6 pt-4">
            <div className="space-y-1">
              {systemNavItems.map(renderNavItem)}
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-center text-white/60 text-xs">
            Bitnex Dial v1.0
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-20 flex flex-col h-screen mb-2 overflow-y-auto">
      {(isPending || loadingRoute) && (
        <>
          <div className="fixed inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-[10px] z-41 transition-all duration-300 ease-out" />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-8 py-6 shadow-2xl border border-white/20 dark:border-slate-600/20 transition-all duration-300 ease-out">
              <div className="flex flex-col items-center space-y-4">
                <Loader size="medium" color="#3778D6" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Loading {loadingRoute || 'page'}...
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Please wait a moment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TOP SECTION - Logo */}
      <div className="flex flex-col rounded-t-2xl bg-gradient-to-b from-[#3778D6] to-[#2E5FBD] items-center py-6 shadow-lg border-b border-white/10">
        <div className="relative group focus:outline-none">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 shadow-lg backdrop-blur-sm">
            <img src="/logo.png" alt="Company Logo" className="w-8 h-8 transition-all duration-300 group-hover:scale-110" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"></div>
        </div>
      </div>

      {/* MIDDLE SECTION - Main Navigation */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#2E5FBD] to-[#1E4080] shadow-lg border-y border-white/5">
        <div className="flex flex-col">
          {mainNavItems.map(renderNavItem)}
        </div>
      </div>

      {/* BOTTOM SECTION - System Navigation */}
      <div className="flex rounded-b-2xl flex-col bg-gradient-to-b from-[#1E4080] to-[#0F2040] shadow-lg py-2">
        <div className="flex flex-col">
          {systemNavItems.map(renderNavItem)}
        </div>
        <div className="mt-2 mx-4 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
      </div>
    </div>
  );
}
