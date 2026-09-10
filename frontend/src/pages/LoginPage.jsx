import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { request, ApiError } from '../lib/api';
import { storeLogin, lastSession, hasSessionFor, allowedNext, ROLE_LABELS } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';
import PhoneInput, { isValidPhone, toFullPhone } from '../components/PhoneInput';
import SuspendedPage from './SuspendedPage';

// Three.js ~700 KB — kirish sahifasi ochilishini kechiktirmasin
const LoginScene = lazy(() => import('../components/three/LoginScene'));

// BUTUN PLATFORMA UCHUN YAGONA KIRISH SAHIFASI.
//
// Chap tomonda ish joyi tanlanadi: avval turi (restoran/kafe), so'ng nom
// bo'yicha qidiruv. O'ng tomonda telefon va parol.
//
// Ish joyi tanlanmasa ham kirish mumkin — server raqamdan kelib chiqib o'zi
// topadi. Bu yo'l platforma egasiga (uning ish joyi yo'q) va taklif
// havolasidan endigina qaytgan xodimga kerak.

const TYPES = [
  { key: 'restaurant', label: 'Restoran', icon: '🍽' },
  { key: 'cafe', label: 'Kafe', icon: '☕' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [query] = useSearchParams();

  // Taklifni endigina faollashtirgan xodim ?phone=... bilan keladi
  const invitedPhone = query.get('phone');

  const [type, setType] = useState('restaurant');
  const [term, setTerm] = useState('');
  const [places, setPlaces] = useState([]);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState(null);

  const [phone, setPhone] = useState(() => (invitedPhone ? toFullPhone(invitedPhone) : '+998'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(null);
  // "Davom etish" taklifi ortida HAQIQIY sessiya bo'lishi shart. Avval
  // tekshirilmasdi va chiqib ketgan odamga ham taklif ko'rinardi: uni
  // bosgan odam panelga o'tib, darhol shu yerga qaytarilardi — tashqaridan
  // qaraganda tugamaydigan halqa.
  const [previous, setPrevious] = useState(() => {
    if (invitedPhone) return null;
    const info = lastSession.get();
    return info && hasSessionFor(info) ? info : null;
  });

  // Kirish muvaffaqiyatli bo'lgach sahifa yumshoq "uchib" ketadi
  const [leaving, setLeaving] = useState(false);

  const phoneRef = useRef(null);

  useEffect(() => {
    document.title = 'Bazm — kirish';
  }, []);

  // ---- Qidiruv ----
  //
  // Har harfda so'rov yubormaymiz: odam yozib bo'lguncha kutamiz.
  // Har bir so'rovning o'z raqami bor — sekin kelgan eski javob yangisini
  // bosib ketmasligi kerak (klassik "poyga" xatosi).
  const runId = useRef(0);

  const search = useCallback(async (nextType, nextTerm) => {
    const id = (runId.current += 1);
    setSearching(true);
    try {
      const params = new URLSearchParams({ type: nextType });
      if (nextTerm.trim()) params.set('q', nextTerm.trim());
      const found = await request(`/public/places?${params.toString()}`);
      if (runId.current === id) setPlaces(found);
    } catch (_) {
      if (runId.current === id) setPlaces([]);
    } finally {
      if (runId.current === id) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(type, term), term ? 260 : 0);
    return () => clearTimeout(timer);
  }, [type, term, search]);

  function fail(message) {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 420);
  }

  function choose(next) {
    setPlace(next);
    setError('');
    // Tanlangach darhol keyingi qadamga — odam qayerga yozishini qidirmasin
    setTimeout(() => phoneRef.current && phoneRef.current.focus(), 260);
  }

  async function submit(e) {
    e.preventDefault();
    if (!isValidPhone(phone)) return fail('Telefon raqamini 9 xonali qilib kiriting');
    if (!password) return fail('Parolni kiriting');

    setLoading(true);
    setError('');
    try {
      const body = { phone, password };
      if (place) body.slug = place.slug;
      const data = await request('/login', { method: 'POST', body });
      const home = storeLogin(data);

      // Odam shu yerga sessiyasi tugagani uchun tushgan bo'lishi mumkin.
      // Unda `?next=` da qayerda turgani saqlangan — o'sha bo'limga
      // qaytaramiz, panelning boshiga emas.
      const slug = data.restaurant && data.restaurant.slug;
      const back = allowedNext(query.get('next'), data.role, slug);

      setLeaving(true);
      setTimeout(() => navigate(back || home, { replace: true }), 420);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.data &&
        err.data.error === 'SUBSCRIPTION_SUSPENDED'
      ) {
        setSuspended(err.data.message);
        return;
      }
      fail(err.message);
    } finally {
      setLoading(false);
    }
    return undefined;
  }

  if (suspended) return <SuspendedPage message={suspended} />;

  const typeLabel = TYPES.find((t) => t.key === type).label.toLowerCase();

  return (
    <div className="app-auth">
      {/* Fondagi 3D sahna — matn ORTIDA, bosishga xalaqit bermaydi */}
      <div className="auth-scene-host" aria-hidden="true">
        <Suspense fallback={null}>
          <LoginScene />
        </Suspense>
      </div>

      <div className="auth-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
        <span className="aurora-blob a3" />
      </div>

      <div className="auth-shell">
        <div className="auth-topbar">
          <span className="auth-mark">Bazm</span>
          <ThemeToggle />
        </div>

        <div className={`auth-split${leaving ? ' leaving' : ''}`}>
          {/* ---------- CHAP: ish joyini tanlash ---------- */}
          <section className="auth-card glass auth-picker">
            <h2 className="auth-side-title">Ish joyingiz</h2>
            <p className="auth-side-sub">Avval turini tanlang, so‘ng nomini yozing</p>

            <div className="type-switch" role="tablist" aria-label="Muassasa turi">
              <span className={`type-thumb${type === 'cafe' ? ' right' : ''}`} aria-hidden="true" />
              {TYPES.map((tp) => (
                <button
                  key={tp.key}
                  type="button"
                  role="tab"
                  aria-selected={type === tp.key}
                  className={`type-option${type === tp.key ? ' active' : ''}`}
                  onClick={() => {
                    setType(tp.key);
                    setPlace(null);
                  }}
                >
                  <span aria-hidden="true">{tp.icon}</span> {tp.label}
                </button>
              ))}
            </div>

            <div className="auth-search">
              <span className="auth-search-icon" aria-hidden="true">⌕</span>
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={`${TYPES.find((t) => t.key === type).label} nomi…`}
                aria-label="Muassasa nomi bo‘yicha qidirish"
              />
              {searching && <span className="spinner auth-search-spin" />}
            </div>

            <div className="place-list">
              {places.map((p, i) => (
                <button
                  key={p.slug}
                  type="button"
                  className={`place-row${place && place.slug === p.slug ? ' selected' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                  onClick={() => choose(p)}
                >
                  <span className="place-badge" aria-hidden="true">
                    {p.businessType === 'cafe' ? '☕' : '🍽'}
                  </span>
                  <span className="grow">
                    <b>{p.name}</b>
                    <small className="mono">{p.slug}</small>
                  </span>
                  <span className="place-tick" aria-hidden="true">✓</span>
                </button>
              ))}

              {!searching && places.length === 0 && (
                <div className="place-empty">
                  {term
                    ? `“${term}” bo‘yicha ${typeLabel} topilmadi`
                    : `Hali ${typeLabel} qo‘shilmagan`}
                </div>
              )}
            </div>
          </section>

          {/* ---------- O'NG: kirish ---------- */}
          <form className={`auth-card glass auth-form${shake ? ' shake' : ''}`} onSubmit={submit}>
            <h1 className="auth-title">Xush kelibsiz</h1>
            <p className="auth-sub">
              {place
                ? 'Ish joyingizdagi telefon raqamingiz va parolingizni kiriting'
                : 'Telefon raqamingiz va parolingizni kiriting'}
            </p>

            {place && (
              <div className="chosen-place">
                <span className="place-badge" aria-hidden="true">
                  {place.businessType === 'cafe' ? '☕' : '🍽'}
                </span>
                <span className="grow">
                  <b>{place.name}</b>
                  <small>{place.businessType === 'cafe' ? 'Kafe' : 'Restoran'} xodimi sifatida</small>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPlace(null)}
                  aria-label="Boshqa muassasa tanlash"
                >
                  ✕
                </button>
              </div>
            )}

            {previous && !place && (
              <div className="auth-previous">
                <div className="auth-previous-body">
                  <b>{previous.name}</b>
                  <span>
                    {ROLE_LABELS[previous.role]}
                    {previous.place ? ` · ${previous.place}` : ''}
                  </span>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      // Sessiyasi tugagan odam shu yerga `?next=` bilan
                      // tushgan bo'lishi mumkin — o'sha bo'limga qaytaramiz
                      const back = allowedNext(
                        query.get('next'),
                        previous.role,
                        String(previous.path).split('/')[1]
                      );
                      navigate(back || previous.path, { replace: true });
                    }}
                  >
                    Davom etish
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPrevious(null)}>
                    Boshqa hisob
                  </button>
                </div>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="field">
              <label htmlFor="lg-phone">Telefon raqami</label>
              <PhoneInput
                id="lg-phone"
                ref={phoneRef}
                autoComplete="username"
                value={phone}
                onChange={setPhone}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="lg-pass">Parol</label>
              <input
                id="lg-pass"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : <span>Kirish</span>}
            </button>

            <p className="auth-note">
              {place
                ? 'Rolingizga qarab (admin, oshpaz, ofitsiant) kerakli panel o‘zi ochiladi.'
                : 'Ish joyini tanlamasangiz ham bo‘ladi — tizim raqamingizdan kelib chiqib o‘zi topadi.'}
            </p>
          </form>
        </div>

        <div className="auth-foot">Mijozmisiz? Stoldagi QR kodni skanerlang.</div>
      </div>
    </div>
  );
}
