import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { SUBSCRIPTION_LABELS } from '../lib/format';

// ⌘K / Ctrl+K bilan ochiladigan tezkor qidiruv.
// Ro'yxat kichik bo'lgani uchun debounce ishlatilmaydi — har harfda filtrlanadi.

export default function CommandPalette({ open, onClose, places, onPick }) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 20);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places.slice(0, 12);
    return places
      .filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, places]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[highlight]) {
      e.preventDefault();
      onPick(results[highlight]);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="bazm-palette">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Muassasa nomi yoki slug…"
        aria-label="Muassasa qidirish"
      />
      <div className="bazm-palette-list">
        {results.map((r, i) => (
          <button
            key={r.id}
            type="button"
            className={`bazm-palette-item${i === highlight ? ' highlight' : ''}`}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => onPick(r)}
          >
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
              {r.slug}
            </span>
            <span className={`status-badge ${r.subscriptionStatus}`} style={{ marginLeft: 'auto' }}>
              {SUBSCRIPTION_LABELS[r.subscriptionStatus]}
            </span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="bazm-empty" style={{ padding: 28 }}>
            Hech narsa topilmadi
          </div>
        )}
      </div>
    </Modal>
  );
}
