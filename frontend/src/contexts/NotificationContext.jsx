import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addNotification = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newNotification = { id, type, title, message };

    setNotifications((prev) => [...prev, newNotification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [removeNotification]);

  const notify = {
    success: (message, title = 'Success') => addNotification({ type: 'success', title, message }),
    error: (message, title = 'Error') => addNotification({ type: 'error', title, message }),
    warning: (message, title = 'Warning') => addNotification({ type: 'warning', title, message }),
    info: (message, title = 'Notice') => addNotification({ type: 'info', title, message }),
  };

  return (
    <NotificationContext.Provider value={{ notify, addNotification, removeNotification }}>
      {children}
      {/* Toast Notification Container */}
      <aside
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {notifications.map((toast) => {
          const config = {
            success: {
              border: 'border-emerald-500 bg-white text-emerald-950',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
              accent: 'bg-emerald-500',
            },
            error: {
              border: 'border-red-500 bg-white text-red-950',
              icon: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
              accent: 'bg-red-500',
            },
            warning: {
              border: 'border-amber-500 bg-white text-amber-950',
              icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
              accent: 'bg-amber-500',
            },
            info: {
              border: 'border-blue-500 bg-white text-slate-900',
              icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
              accent: 'bg-blue-500',
            },
          }[toast.type] || {
            border: 'border-gray-400 bg-white text-gray-900',
            icon: <Info className="w-5 h-5 text-gray-600 flex-shrink-0" />,
            accent: 'bg-gray-400',
          };

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all transform animate-slide-up ${config.border}`}
            >
              {config.icon}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-sm font-semibold tracking-tight">{toast.title}</h4>
                )}
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeNotification(toast.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md focus-visible:ring-1 focus-visible:ring-gray-400"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </aside>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
