'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    defaultTitle: 'Success',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    defaultTitle: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    defaultTitle: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-sky-500/20',
    borderColor: 'border-sky-500/30',
    iconColor: 'text-sky-400',
    defaultTitle: 'Info',
  },
};

// Global toast state
let toastId = 0;
const toastListeners = new Set();
let toastState = [];

function emitToast(toast) {
  const id = ++toastId;
  const newToast = { ...toast, id, createdAt: Date.now() };
  toastState = [...toastState, newToast];
  toastListeners.forEach((listener) => listener(toastState));
  return id;
}

export function showToast({ type = 'info', title, message, duration = 4000 }) {
  return emitToast({ type, title, message, duration });
}

export function dismissToast(id) {
  toastState = toastState.filter((t) => t.id !== id);
  toastListeners.forEach((listener) => listener(toastState));
}

function ToastItem({ toast, onDismiss }) {
  const config = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
  const Icon = config.icon;

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={`w-full max-w-sm p-4 rounded-xl glass-strong border ${config.borderColor} shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={config.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm">{toast.title || config.defaultTitle}</div>
          {toast.message && <div className="text-white/40 text-xs mt-0.5">{toast.message}</div>}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-white/20 hover:text-white/60 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export default function ToastNotifications() {
  const [toasts, setToasts] = useState(toastState);

  useEffect(() => {
    toastListeners.add(setToasts);
    return () => {
      toastListeners.delete(setToasts);
    };
  }, []);

  const handleDismiss = useCallback((id) => {
    dismissToast(id);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={handleDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
