import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Qisqa muddatli xabarlar ("Ofitsiant chaqirildi ✓", "Internet aloqasi yo'q").
// 2.2 soniya ko'rinadi, keyin pastga suzib g'oyib bo'ladi.

const ToastContext = createContext({ show: () => {} });

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 250);
  }, []);

  const show = useCallback(
    (message, type = 'info', duration = 2200) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, message, type }]);
      const timer = setTimeout(() => {
        remove(id);
        timers.current.delete(id);
      }, duration);
      timers.current.set(id, timer);
      return id;
    },
    [remove]
  );

  const api = {
    show,
    success: (m, d) => show(m, 'success', d),
    error: (m, d) => show(m, 'error', d || 3200),
    info: (m, d) => show(m, 'info', d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}${t.leaving ? ' leaving' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
