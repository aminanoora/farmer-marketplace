"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import ToastContainer from "@/components/ui/toast";
import type { ToastMessage, ToastType } from "@/components/ui/toast";

interface NotificationContextType {
  showNotification: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
  showSuccess: () => {},
  showError: () => {},
  showInfo: () => {},
  showWarning: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showNotification = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      const id = "toast-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => showNotification(message, "success"),
    [showNotification]
  );
  const showError = useCallback(
    (message: string) => showNotification(message, "error"),
    [showNotification]
  );
  const showInfo = useCallback(
    (message: string) => showNotification(message, "info"),
    [showNotification]
  );
  const showWarning = useCallback(
    (message: string) => showNotification(message, "warning"),
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{ showNotification, showSuccess, showError, showInfo, showWarning }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
