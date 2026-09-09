import { useEffect, useState } from 'react';
import { request } from '../lib/api';
import { ThemeToggle } from '../lib/theme';
import { useToast } from '../components/Toast';

// Ekran 1 — kirish.
//   QR orqali kelgan bo'lsa: faqat ism so'raladi
//   Bot orqali kelgan bo'lsa: avval bo'sh stol tanlanadi, keyin ism

export default function WelcomeScreen({ mode, slug, placeName, session, onStart, onContinue }) {
  const [name, setName] = useState('');
  const [tables, setTables] = useState(null);
  const [tableId, setTableId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bazm.clientName');
      if (stored) setName(stored);
    } catch (_) {
      /* localStorage yopiq */
    }
  }, []);

  useEffect(() => {
    if (mode !== 'picker' || session) return;
    request('/client/tables/available', { slug })
      .then(setTables)
      .catch((err) => setError(err.message));
  }, [mode, slug, session]);

  async function submit(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (mode === 'picker' && !tableId) {
      setError('Avval stolni tanlang');
      return;
    }

    setLoading(true);
    setError('');
    try {
      localStorage.setItem('bazm.clientName', clean);
    } catch (_) {
      /* muhim emas */
    }
    try {
      await onStart(clean, tableId);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        toast.error('Bu stol band bo\'lib qoldi, boshqasini tanlang');
        setTableId(null);
        request('/client/tables/available', { slug }).then(setTables).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }

  // Sessiya allaqachon bor (masalan bot tokeni bilan kelgan) — davom etamiz
  if (session) {
    return (
      <div className="c-screen">
        <div className="c-welcome">
          <div className="c-welcome-mark">Xush kelibsiz</div>
          <div className="c-welcome-sub">{session.clientName}</div>
          {session.table && session.table.tableNumber ? (
            <div className="c-table-badge">{session.table.tableNumber}-stol</div>
          ) : null}
          <button type="button" className="c-btn" onClick={onContinue}>
            Menyuni ochish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="c-screen">
      <div style={{ position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0))', right: 14, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <form className="c-welcome" onSubmit={submit}>
        <div className="c-welcome-mark">Xush kelibsiz</div>
        <div className="c-welcome-sub">{placeName || slug}</div>

        {error && <div className="c-error-box" style={{ margin: '0 0 16px' }}>{error}</div>}

        {mode === 'picker' && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>
              Qaysi stolga o'tirasiz?
            </div>
            {tables === null && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <span className="spinner spinner-lg" />
              </div>
            )}
            {tables && tables.length === 0 && (
              <div className="c-error-box" style={{ margin: 0 }}>
                Afsuski hozir bo'sh stol yo'q. Ofitsiantga murojaat qiling.
              </div>
            )}
            {tables && tables.length > 0 && (
              <div className="c-tables-grid">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`c-table-btn${tableId === t.id ? ' selected' : ''}`}
                    onClick={() => {
                      setTableId(t.id);
                      setError('');
                    }}
                  >
                    <b>{t.tableNumber}</b>
                    <span>stol</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>Ismingiz</div>
        <input
          className="c-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masalan: Dilnoza"
          maxLength={60}
          required
        />

        <button type="submit" className="c-btn" style={{ marginTop: 16 }} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Kirish'}
        </button>

        <p style={{ marginTop: 18, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Ismingiz faqat buyurtmangizni ajratish uchun kerak — ofitsiant sizni
          shu nom bilan chaqiradi.
        </p>
      </form>
    </div>
  );
}
