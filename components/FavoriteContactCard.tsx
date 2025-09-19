import React, { useState, useEffect, useMemo } from 'react';
import { PiStarFill, PiStarThin } from 'react-icons/pi';
import { MdDelete } from 'react-icons/md';
import Image from 'next/image';

interface Contact {
    id: string;
    name: string;
    phone: string;
    hasUnread?: boolean;
    unreadCount?: number;
    lastMessage?: string;
    lastMessageTime?: string;
    lastMessageDate?: string;
    isFavorite?: boolean;
}

interface FavoriteContactCardProps {
    contacts: Contact[];
    selectedContact: Contact | null;
    onContactSelect: (contact: Contact) => void;
    onToggleFavorite: (contact: Contact) => void;
    onDeleteContact: (contact: Contact) => void;
    isTogglingFavorite: boolean;
}

const FavoriteContactCard: React.FC<FavoriteContactCardProps> = ({
    contacts,
    selectedContact,
    onContactSelect,
    onToggleFavorite,
    onDeleteContact,
    isTogglingFavorite
}) => {
    // Use useMemo to ensure favoriteContacts updates when contacts prop changes
    const favoriteContacts = useMemo(() => {
        console.log('📋 Filtering favorite contacts, total contacts:', contacts.length);
        const filtered = contacts.filter(contact => contact.isFavorite);
        console.log('⭐ Found favorite contacts:', filtered.length);
        return filtered;
    }, [contacts]); // This will recalculate whenever contacts array changes

    // Add useEffect to debug when contacts change
    useEffect(() => {
        console.log('🔄 FavoriteContactCard: contacts prop updated', {
            totalContacts: contacts.length,
            favoriteCount: contacts.filter(c => c.isFavorite).length,
            contactsWithUnread: contacts.filter(c => c.hasUnread).length
        });
    }, [contacts]);

    // Memoize sorted favorite contacts to avoid unnecessary re-renders
    const sortedFavoriteContacts = useMemo(() => {
        return favoriteContacts.sort((a, b) => {
            // Sort by unread status first (unread contacts at top)
            if (a.hasUnread && !b.hasUnread) return -1;
            if (!a.hasUnread && b.hasUnread) return 1;

            // Then sort by last message date (most recent first)
            if (a.lastMessageDate && b.lastMessageDate) {
                return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
            }

            if (a.lastMessageDate && !b.lastMessageDate) return -1;
            if (!a.lastMessageDate && b.lastMessageDate) return 1;

            return a.name.localeCompare(b.name);
        });
    }, [favoriteContacts]);

    if (favoriteContacts.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 transform hover:scale-105 transition-all duration-300">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 rounded-full flex items-center justify-center shadow-xl">
                        <PiStarFill className="text-yellow-500 dark:text-yellow-400 text-6xl animate-pulse" />
                    </div>
                </div>
                <div className="bg-white/50 dark:bg-slate-700/50 rounded-xl p-4 shadow-lg border border-white/30 dark:border-slate-600/30">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">No favorite chats yet</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pin your important conversations by clicking the star button</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sortedFavoriteContacts.map((contact, index) => (
                <div
                    key={`${contact.id}-${contact.lastMessageDate || 'no-date'}`} // Add unique key to force re-render
                    style={{ animationDelay: `${index * 100}ms` }}
                    className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-2 hover:scale-[1.02] border animate-slideInLeft group ${selectedContact?.id === contact.id
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600 shadow-blue-200/50 dark:shadow-blue-800/50 scale-[1.02]'
                        : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:from-white hover:to-gray-50 dark:hover:from-slate-700 dark:hover:to-slate-600'
                        }`}
                >
                    {/* Contact main content */}
                    <div
                        onClick={() => onContactSelect(contact)}
                        className="flex items-center flex-1"
                    >
                        <div className={`w-3 h-3 rounded-full mr-4 shadow-sm transition-all duration-300 group-hover:scale-125 ${contact.hasUnread ? 'bg-gradient-to-br from-red-400 to-red-600 animate-pulse group-hover:animate-bounce' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-green-400 dark:group-hover:bg-green-500'
                            }`}></div>
                        <div className="flex-1">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:shadow-lg relative">
                                    <span className="text-yellow-600 dark:text-yellow-300 text-lg transition-all duration-300 group-hover:scale-110">👤</span>
                                    {/* Favorite star indicator */}
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 dark:bg-yellow-400 rounded-full flex items-center justify-center">
                                        <PiStarFill className="text-white text-xs" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 transition-all duration-300 group-hover:text-[#3778D6] dark:group-hover:text-blue-400">
                                            {contact.name}
                                        </div>
                                        {/* Unread Badge */}
                                        {contact.hasUnread && contact.unreadCount && contact.unreadCount > 0 && (
                                            <div className="bg-red-500 dark:bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 animate-pulse shadow-lg">
                                                {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                    {contact.name !== contact.phone && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 font-medium transition-all duration-300 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                                            {contact.phone}
                                        </div>
                                    )}
                                    {/* Last Message Preview */}
                                    {contact.lastMessage && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            <div className="truncate max-w-[150px]">
                                                {contact.lastMessage.replace(/<[^>]*>/g, '')}
                                            </div>
                                            {contact.lastMessageTime && (
                                                <div className="text-right text-gray-400 dark:text-gray-500 text-xs mt-1">
                                                    {contact.lastMessageTime}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        {/* Star/Favorite Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(contact);
                            }}
                            disabled={isTogglingFavorite}
                            className={`p-2 rounded-lg transition-all duration-300 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95 ${
                                contact.isFavorite
                                    ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                    : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400 bg-gray-50 dark:bg-slate-600/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                            } ${isTogglingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={contact.isFavorite ? 'Unpin chat' : 'Pin chat'}
                        >
                            {contact.isFavorite ? (
                                <PiStarFill size={16} />
                            ) : (
                                <PiStarThin size={16} />
                            )}
                        </button>

                        {/* Delete Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteContact(contact);
                            }}
                            className="p-2 rounded-lg text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95"
                            title={`Delete conversation with ${contact.name}`}
                        >
                            <MdDelete size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FavoriteContactCard;