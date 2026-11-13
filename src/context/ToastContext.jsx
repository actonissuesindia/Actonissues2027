import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: 'bi-check-circle-fill',
  error: 'bi-x-circle-fill',
  info: 'bi-info-circle-fill'
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, opts = {}) => {
    const { type = 'success', duration = 3000 } = typeof opts === 'string' ? { type: opts } : opts;
    const id = ++idCounter;
    setToasts(list => [...list, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <button key={t.id} type="button" className={`toast-item toast-${t.type}`} onClick={() => dismiss(t.id)}>
            <i className={`bi ${ICONS[t.type] || ICONS.info}`}></i>
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Returns a function: toast('message') or toast('message', { type: 'error', duration: 4000 }).
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
