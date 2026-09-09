import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Modal va "bottom sheet" — ikkalasi ham yopilishda teskari animatsiya
// o'ynatib, keyin DOM'dan chiqadi (shundan `leaving` holati kerak bo'ladi).

function useClosingAnimation(open, onClose, duration) {
  const [visible, setVisible] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setLeaving(false);
    } else if (visible) {
      setLeaving(true);
      const t = setTimeout(() => {
        setVisible(false);
        setLeaving(false);
      }, duration);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, visible, duration]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return { visible, leaving };
}

export function Modal({ open, onClose, children, className = '', closeOnOverlay = true }) {
  const { visible, leaving } = useClosingAnimation(open, onClose, 240);
  if (!visible) return null;

  return createPortal(
    <div
      className={`modal-overlay${leaving ? ' leaving' : ''}`}
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-box ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Sheet({ open, onClose, children, className = '' }) {
  const { visible, leaving } = useClosingAnimation(open, onClose, 290);
  if (!visible) return null;

  return createPortal(
    <div
      className={`sheet-overlay${leaving ? ' leaving' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`sheet-box ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}
