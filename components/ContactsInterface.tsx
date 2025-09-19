// components/ContactsInterface.tsx - Fixed Version
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BiSearchAlt } from "react-icons/bi";
import { HiMiniPlus } from "react-icons/hi2";
import { FiPhone } from "react-icons/fi";
import { BsChatText } from "react-icons/bs";
import { IoClose } from "react-icons/io5";
import { MdDelete } from "react-icons/md";

// Import optimized hooks
import {useContacts, useAddContact, useUpdateContact, useDeleteContact, useBlockedContacts, useBlockContact} from '../hooks/useContacts';
import { useCallEventListener } from '../hooks/useCallEventListener';
import { usePrefetch } from '../hooks/usePrefetch';
import { useCallStatus } from '../app/context/callStatusContext';
import { Contact } from '../types';

export default function ContactsInterface() {
  const router = useRouter();
  const { callActive } = useCallStatus();

  // Data hooks - these handle all caching automatically
  const { 
    data: contacts = [], 
    isLoading: contactsLoading, 
    error: contactsError,
    refetch: refetchContacts 
  } = useContacts();

  const { data: blockedContacts = new Set<string>() } = useBlockedContacts();

  // Mutation hooks
  const addContactMutation = useAddContact();
  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();
  const blockContactMutation = useBlockContact();

  // Prefetch hooks for better UX
  const { prefetchCalls, prefetchVoicemails } = usePrefetch();

  // Listen for call events to refresh related data
  useCallEventListener();

  // Local UI state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'Personal'>('ALL');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showBlockAlert, setShowBlockAlert] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [contactToBlock, setContactToBlock] = useState<Contact | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    type: 'personal' as const
  });

  // Memoized filtered contacts for performance
  const filteredContacts = useMemo(() => {
    let filtered: Contact[] = contacts;

    if (activeTab === 'Personal') {
      filtered = filtered.filter((c: Contact) => c.type === 'personal');
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((contact: Contact) =>
        contact.name.toLowerCase().includes(searchLower) ||
        contact.phone.includes(searchTerm)
      );
    }

    return filtered;
  }, [contacts, activeTab, searchTerm]);

  // Memoized contact lookup function
  const getContactName = useMemo(() => {
    const contactMap = new Map<string, string>();
    
    contacts.forEach((contact: Contact) => {
      const cleanedPhone = contact.phone.replace(/[^\d]/g, "");
      // Create multiple formats for matching
      const formats = [
        cleanedPhone,
        cleanedPhone.startsWith('1') ? cleanedPhone.slice(1) : '1' + cleanedPhone,
        cleanedPhone.slice(-10),
        cleanedPhone.slice(-7)
      ];
      
      formats.forEach(format => {
        if (format.length >= 7) {
          contactMap.set(format, contact.name);
        }
      });
    });
    
    return (number: string) => {
      if (!number) return number;
      const cleanedInput = number.replace(/[^\d]/g, "");
      
      const possibleFormats = [
        cleanedInput,
        cleanedInput.startsWith('1') ? cleanedInput.slice(1) : '1' + cleanedInput,
        cleanedInput.slice(-10),
        cleanedInput.slice(-7)
      ];
      
      for (const format of possibleFormats) {
        if (contactMap.has(format)) {
          return contactMap.get(format)!;
        }
      }
      return number;
    };
  }, [contacts]);

//////////////dup dontact
const [validationErrors, setValidationErrors] = useState({
  name: '',
  phone: ''
});

const normalizePhoneForComparison = (phone: string): string => {
  return phone.replace(/\D/g, '').replace(/^1/, '');
};

const isContactNameExists = (name: string): boolean => {
  if (!name.trim()) return false;
  return contacts.some(contact => 
    contact.name.toLowerCase().trim() === name.toLowerCase().trim()
  );
};

const isPhoneNumberExists = (phone: string): boolean => {
  if (!phone) return false;
  const normalizedPhone = normalizePhoneForComparison(phone);
  return contacts.some(contact => {
    const normalizedExisting = normalizePhoneForComparison(contact.phone);
    return normalizedExisting === normalizedPhone;
  });
};

const getExistingContactByPhone = (phone: string): Contact | null => {
  if (!phone) return null;
  const normalizedPhone = normalizePhoneForComparison(phone);
  return contacts.find(contact => {
    const normalizedExisting = normalizePhoneForComparison(contact.phone);
    return normalizedExisting === normalizedPhone;
  }) || null;
};


  // Optimized handlers
const handleAddContact = useCallback(async () => {
  if (!newContact.name.trim() || !newContact.phone.trim()) return;

  // Clear previous errors
  setValidationErrors({ name: '', phone: '' });

  let hasErrors = false;
  const errors = { name: '', phone: '' };

  // Check for duplicate name (case-insensitive)
  if (isContactNameExists(newContact.name)) {
    errors.name = `A contact named "${newContact.name.trim()}" already exists.`;
    hasErrors = true;
  }

  // Check for duplicate phone number
  const existingContact = getExistingContactByPhone(newContact.phone);
  if (existingContact) {
    errors.phone = `This phone number is already saved as "${existingContact.name}".`;
    hasErrors = true;
  }

  if (hasErrors) {
    setValidationErrors(errors);
    return;
  }

  try {
    await addContactMutation.mutateAsync({
      name: newContact.name.trim(),
      phone: newContact.phone,
      type: newContact.type
    });
    
    setShowAddContact(false);
    setNewContact({ name: '', phone: '', type: 'personal' });
    setValidationErrors({ name: '', phone: '' }); // Clear errors on success
    
  } catch (error) {
    console.error('Failed to add contact:', error);
    // Show error in the modal instead of alert
    setValidationErrors({ 
      name: '', 
      phone: 'Failed to add contact. Please try again.' 
    });
  }
}, [newContact, addContactMutation, contacts]);

const [editValidationError, setEditValidationError] = useState('');

const handleEditContact = useCallback(async () => {
  if (!contactToEdit || !editContactName.trim()) return;

  // Clear previous error
  setEditValidationError('');

  // Check if the new name already exists (excluding current contact)
  const duplicateName = contacts.find(contact => 
    contact.id !== contactToEdit.id && 
    contact.name.toLowerCase().trim() === editContactName.toLowerCase().trim()
  );

  if (duplicateName) {
    setEditValidationError(`A contact named "${editContactName.trim()}" already exists.`);
    return;
  }

  try {
    await updateContactMutation.mutateAsync({
      ...contactToEdit,
      name: editContactName.trim()
    });
    
    setShowEditContact(false);
    setContactToEdit(null);
    setEditContactName('');
    setEditValidationError(''); // Clear error on success
    
    // Update selected contact if it was the one being edited
    if (selectedContact?.id === contactToEdit.id) {
      setSelectedContact(prev => prev ? { ...prev, name: editContactName.trim() } : null);
    }
  } catch (error) {
    console.error('Failed to update contact:', error);
    setEditValidationError('Failed to update contact. Please try again.');
  }
}, [contactToEdit, editContactName, updateContactMutation, selectedContact, contacts]);
  




const handleDeleteContact = useCallback(async () => {
    if (!contactToDelete) return;

    try {
      await deleteContactMutation.mutateAsync({
        contactId: contactToDelete.id,
        contact: contactToDelete
      });
      
      setShowDeleteAlert(false);
      setContactToDelete(null);
      
      // Clear selection if deleted contact was selected
      if (selectedContact?.id === contactToDelete.id) {
        setSelectedContact(null);
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  }, [contactToDelete, deleteContactMutation, selectedContact]);

  const handleBlockContact = useCallback(async () => {
    if (!contactToBlock) return;

    try {
      const cleanContactPhone = contactToBlock.phone.replace(/[^\d]/g, "");
      const isBlocked = blockedContacts.has(cleanContactPhone);
      
      await blockContactMutation.mutateAsync({
        contactNumber: cleanContactPhone,
        action: isBlocked ? 'unblock' : 'block'
      });
      
      setShowBlockAlert(false);
      setContactToBlock(null);
    } catch (error) {
      console.error('Failed to block/unblock contact:', error);
    }
  }, [contactToBlock, blockedContacts, blockContactMutation]);

  const handleCall = useCallback((phoneNumber: string) => {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = cleanedNumber.length === 10 ? `+1${cleanedNumber}` : `+${cleanedNumber}`;
    
    // Emit global call event
    window.dispatchEvent(new CustomEvent('globalCallStart', {
      detail: { number: phoneNumber, direction: 'outbound' }
    }));

    if (window.DialByLine) {
      window.DialByLine('audio', null, formattedNumber);
    } else {
      console.warn('Dialer not ready');
    }
  }, []);

  const handleTextMessage = useCallback((phoneNumber: string) => {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = cleanedNumber.length === 11 && cleanedNumber.startsWith('1') 
      ? cleanedNumber.slice(1) 
      : cleanedNumber;
    
    router.push(`/text?to=${encodeURIComponent(formattedNumber)}`);
  }, [router]);

  // Navigation prefetching
  const handleNavigation = useCallback((tab: string) => {
    switch (tab) {
      case 'calls':
        prefetchCalls();
        break;
      case 'voicemails':
        prefetchVoicemails();
        break;
    }
  }, [prefetchCalls, prefetchVoicemails]);

  // Loading state
  if (contactsLoading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 px-4">
        <div className="flex w-full h-[90vh] mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="w-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading contacts...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (contactsError) {
    return (
      <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 px-4">
        <div className="flex w-full h-[90vh] mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="w-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">⚠</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Failed to load contacts</p>
              <button
                onClick={() => refetchContacts()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full bg-gray-50 dark:bg-gray-900 px-2 md:px-4">
      <div className="flex w-full h-[90vh] mx-auto shadow-2xl rounded-xl md:rounded-3xl overflow-hidden bg-white dark:bg-gray-800">
        {/* Left Panel - Contact List */}
        <div className="w-full md:w-80 lg:w-96 bg-gradient-to-b from-[#D3E9E7] to-[#C5E5E3] dark:from-slate-800 dark:to-slate-700 h-full flex flex-col shadow-lg border-r border-gray-200 dark:border-slate-600">
          {/* Header */}
          <div className="p-3 md:p-4 bg-gradient-to-r from-[#D3E9E7] to-[#E0F0EE] dark:from-slate-800 dark:to-slate-700">
            <div className="flex py-3 md:py-4 items-center border-b-2 border-[#3778D6]/30 dark:border-blue-400/30 justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mr-2 pl-1.5 flex items-center">
                Contacts
              </h2>
              <button
                onClick={() => setShowAddContact(true)}
                className="text-[#607D8B] dark:text-slate-400 hover:text-[#3778D6] dark:hover:text-blue-400 transition-all duration-300 p-2 rounded-lg hover:bg-white/70 dark:hover:bg-slate-600/50 shadow-sm hover:shadow-lg transform hover:scale-110 active:scale-95"
              >
                <HiMiniPlus className="text-lg md:text-xl" />
              </button>
            </div>

            {/* Search */}
            <div className="mt-4 mb-1 p-0.5 bg-white/20 dark:bg-slate-700/20 rounded-2xl shadow-2xl border border-white/30 dark:border-slate-600/30">
              <div className="w-full flex">
                <label 
                  htmlFor="contact-search-input"
                  className="ml-3 self-center text-lg md:text-xl text-[#929292] dark:text-gray-400 transition-all duration-300 hover:text-[#3778D6] dark:hover:text-blue-400 hover:scale-110 cursor-pointer" 
                  style={{ transform: 'scaleX(-1)' }}
                >
                  <BiSearchAlt />
                </label>
                <input
                  id="contact-search-input"
                  type="text"
                  placeholder="Search contacts"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="py-2 px-3 text-sm border-0 rounded-xl focus:outline-none flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-10rem)] pb-44">
            {contactsLoading && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {filteredContacts.length === 0 && !contactsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center">
                <div className="bg-white/50 dark:bg-slate-700/50 rounded-xl p-4 md:p-6 shadow-lg border border-white/30 dark:border-slate-600/30">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">No contacts found</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Try adjusting your search terms</p>
                </div>
              </div>
            ) : (
              <div className="p-2">
                {filteredContacts.map((contact: Contact, index: number) => {
                  const isBlocked = blockedContacts.has(contact.phone.replace(/[^\d]/g, ""));
                  
                  return (
                    <div
                      key={contact.id}
                      className={`flex items-center p-3 md:p-4 mb-2 rounded-xl cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-1 hover:scale-[1.02] border group ${
                        selectedContact?.id === contact.id
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 border-blue-300 dark:border-blue-600'
                          : 'hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
                      }`}
                    >
                      {/* Contact Info */}
                      <div 
                        onClick={() => setSelectedContact(contact)}
                        className="flex items-center space-x-3 flex-1 min-w-0"
                      >
                        <div className={`w-8 h-8 md:w-10 md:h-10 ${contact.profileColor} rounded-full flex items-center justify-center shadow-lg flex-shrink-0`}>
                          <span className="text-white text-xs md:text-sm font-bold">
                            {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
                            {contact.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate">
                            {contact.phone}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1 md:space-x-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                        {/* Call Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCall(contact.phone);
                          }}
                          disabled={callActive}
                          className={`p-1.5 md:p-2 rounded-full transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-110 ${
                            !callActive
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <FiPhone size={12} className="md:w-3.5 md:h-3.5" />
                        </button>

                        {/* Text Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTextMessage(contact.phone);
                          }}
                          className="p-1.5 md:p-2 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-110"
                        >
                          <BsChatText size={12} className="md:w-3.5 md:h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToEdit(contact);
                            setEditContactName(contact.name);
                            setShowEditContact(true);
                          }}
                          className="p-1.5 md:p-2 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-110"
                        >
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToDelete(contact);
                            setShowDeleteAlert(true);
                          }}
                          className="p-1.5 md:p-2 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70 transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-110"
                        >
                          <MdDelete className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full">
          {selectedContact ? (
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
              <div className="max-w-2xl mx-auto text-center">
                <div className={`w-24 h-24 md:w-32 md:h-32 ${selectedContact.profileColor} rounded-2xl md:rounded-3xl mx-auto mb-6 md:mb-8 flex items-center justify-center shadow-2xl`}>
                  <span className="text-white text-2xl md:text-3xl font-bold">
                    {selectedContact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3 md:mb-4">
                  {selectedContact.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 md:mb-8 bg-gray-100 dark:bg-slate-700 px-3 md:px-4 py-2 rounded-full text-base md:text-lg">
                  {selectedContact.phone}
                </p>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 md:gap-4 mb-8 md:mb-10">
                  <button
                    onClick={() => handleCall(selectedContact.phone)}
                    disabled={callActive}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                      !callActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <FiPhone className="text-lg md:text-xl text-white" />
                  </button>

                  <button
                    onClick={() => handleTextMessage(selectedContact.phone)}
                    className="w-12 h-12 md:w-14 md:h-14 bg-blue-500 hover:bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300"
                  >
                    <BsChatText className="text-lg md:text-xl text-white" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
              <div className="text-center max-w-md">
                <div className="mb-6 md:mb-10">
                  <img src="/contact.png" alt="Contacts illustration" className="mx-auto max-w-full h-auto w-32 md:w-auto" />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-xl">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 md:mb-4">
                    Connect your contacts
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
                    Select a contact on the left for more details.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


{/* Add Contact Modal */}
{showAddContact && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add Contact</h3>
          <button
            onClick={() => {
              setShowAddContact(false);
              setNewContact({ name: '', phone: '', type: 'personal' });
              setValidationErrors({ name: '', phone: '' });
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <IoClose size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Name Input with Validation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Name
            </label>
            <input
              type="text"
              placeholder="Enter contact name"
              value={newContact.name}
              onChange={(e) => {
                setNewContact({ ...newContact, name: e.target.value });
                // Clear error when user starts typing
                if (validationErrors.name) {
                  setValidationErrors({ ...validationErrors, name: '' });
                }
              }}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all ${
                validationErrors.name
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={addContactMutation.isPending}
            />
            {validationErrors.name && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{validationErrors.name}</span>
                </p>
              </div>
            )}
          </div>
          
          {/* Phone Input with Validation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="Enter phone number"
              value={newContact.phone}
              onChange={(e) => {
                setNewContact({ ...newContact, phone: e.target.value });
                // Clear error when user starts typing
                if (validationErrors.phone) {
                  setValidationErrors({ ...validationErrors, phone: '' });
                }
              }}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all ${
                validationErrors.phone
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={addContactMutation.isPending}
            />
            {validationErrors.phone && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{validationErrors.phone}</span>
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setShowAddContact(false);
              setNewContact({ name: '', phone: '', type: 'personal' });
              setValidationErrors({ name: '', phone: '' });
            }}
            disabled={addContactMutation.isPending}
            className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddContact}
            disabled={
              addContactMutation.isPending || 
              !newContact.name.trim() || 
              !newContact.phone.trim()
            }
            className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {addContactMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Adding...</span>
              </>
            ) : (
              <span>Add Contact</span>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      {/* Edit Contact Modal */}
{showEditContact && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Contact</h3>
          <button
            onClick={() => {
              setShowEditContact(false);
              setContactToEdit(null);
              setEditContactName('');
              setEditValidationError('');
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <IoClose size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Name
            </label>
            <input
              type="text"
              placeholder="Contact name"
              value={editContactName}
              onChange={(e) => {
                setEditContactName(e.target.value);
                // Clear error when user starts typing
                if (editValidationError) {
                  setEditValidationError('');
                }
              }}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all ${
                editValidationError
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={updateContactMutation.isPending}
            />
            {editValidationError && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{editValidationError}</span>
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setShowEditContact(false);
              setContactToEdit(null);
              setEditContactName('');
              setEditValidationError('');
            }}
            disabled={updateContactMutation.isPending}
            className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEditContact}
            disabled={updateContactMutation.isPending || !editContactName.trim()}
            className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {updateContactMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Contact</span>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


{/* Delete Contact Modal */}
{showDeleteAlert && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Delete Contact</h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{contactToDelete?.name}</strong>? This action cannot be undone.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowDeleteAlert(false);
              setContactToDelete(null);
            }}
            disabled={deleteContactMutation.isPending}
            className="flex-1 py-2 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteContact}
            disabled={deleteContactMutation.isPending}
            className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {deleteContactMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete</span>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Block Contact Modal */}
{showBlockAlert && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md">
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          {blockedContacts.has(contactToBlock?.phone?.replace(/[^\d]/g, "") || "") ? 'Unblock' : 'Block'} Contact
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to {blockedContacts.has(contactToBlock?.phone?.replace(/[^\d]/g, "") || "") ? 'unblock' : 'block'} <strong>{contactToBlock?.name}</strong>?
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowBlockAlert(false);
              setContactToBlock(null);
            }}
            disabled={blockContactMutation.isPending}
            className="flex-1 py-2 px-4 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBlockContact}
            disabled={blockContactMutation.isPending}
            className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {blockContactMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{blockedContacts.has(contactToBlock?.phone?.replace(/[^\d]/g, "") || "") ? 'Unblocking...' : 'Blocking...'}</span>
              </>
            ) : (
              <span>{blockedContacts.has(contactToBlock?.phone?.replace(/[^\d]/g, "") || "") ? 'Unblock' : 'Block'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}