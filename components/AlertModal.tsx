'use client';

import { IoClose, IoCheckmarkCircle, IoWarningOutline, IoInformationCircle, IoCloseCircle } from "react-icons/io5";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

export default function AlertModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false
}: AlertModalProps) {
    if (!isOpen) return null;

    const getTypeConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <IoCheckmarkCircle className="text-green-500 text-4xl" />,
                    bgColor: 'from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30',
                    borderColor: 'border-green-200/30 dark:border-green-700/30',
                    buttonColor: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                };
            case 'error':
                return {
                    icon: <IoCloseCircle className="text-red-500 text-4xl" />,
                    bgColor: 'from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30',
                    borderColor: 'border-red-200/30 dark:border-red-700/30',
                    buttonColor: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                };
            case 'warning':
                return {
                    icon: <IoWarningOutline className="text-amber-500 text-4xl" />,
                    bgColor: 'from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30',
                    borderColor: 'border-amber-200/30 dark:border-amber-700/30',
                    buttonColor: 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                };
            case 'confirm':
                return {
                    icon: <IoInformationCircle className="text-blue-500 text-4xl" />,
                    bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30',
                    borderColor: 'border-blue-200/30 dark:border-blue-700/30',
                    buttonColor: 'from-[#3778D6] to-[#2a5aa0] hover:from-[#2a5aa0] hover:to-[#1e4080]'
                };
            default: // info
                return {
                    icon: <IoInformationCircle className="text-blue-500 text-4xl" />,
                    bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30',
                    borderColor: 'border-blue-200/30 dark:border-blue-700/30',
                    buttonColor: 'from-[#3778D6] to-[#2a5aa0] hover:from-[#2a5aa0] hover:to-[#1e4080]'
                };
        }
    };

    const config = getTypeConfig();

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-600/30 w-full max-w-md transform transition-all duration-500 animate-slideUp hover:shadow-3xl dark:hover:shadow-gray-900/70">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-200/50 dark:border-slate-600/50 bg-gradient-to-r from-[#D3E9E7]/30 to-[#E0F0EE]/30 dark:from-slate-700/30 dark:to-slate-600/30 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-white to-gray-100 dark:from-slate-600 dark:to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
                                {config.icon}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{title}</h3>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-110 active:scale-95"
                        >
                            <IoClose size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Message Display */}
                    <div className={`bg-gradient-to-r ${config.bgColor} rounded-2xl p-4 border ${config.borderColor}`}>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                                {config.icon}
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 pt-4 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-700 rounded-b-3xl border-t border-gray-200/50 dark:border-slate-600/50">
                    <div className={`flex gap-3 ${showCancel || type === 'confirm' ? '' : 'justify-center'}`}>
                        {(showCancel || type === 'confirm') && (
                            <button
                                className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700 text-gray-800 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 border border-gray-300 dark:border-slate-500 hover:from-gray-300 hover:to-gray-400 dark:hover:from-slate-500 dark:hover:to-slate-600"
                                onClick={onClose}
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            className={`${showCancel || type === 'confirm' ? 'flex-1' : 'px-8'} bg-gradient-to-r ${config.buttonColor} text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95`}
                            onClick={handleConfirm}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}