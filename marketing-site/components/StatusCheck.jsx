'use client';

// SO'ROV HOLATI — ariza egasining o'zi ko'radi.
//
// Avval javob faqat qo'ng'iroq yoki xat orqali yetardi va odam kutishdan
// boshqa ish qila olmasdi. Endi shu yerga kirib o'zi ko'radi.
//
// NEGA GOOGLE. Tasdiqlangan javob ichida kirish PAROLI bo'ladi, ya'ni uni
// istalgan odamga ko'rsatib bo'lmaydi. Telefon raqami yetarli emas — uni
// bilish oson. Google esa pochtaning haqiqatan shu odamniki ekanini
// isbotlaydi.
//
// Google skripti FAQAT shu sahifada yuklanadi (bosh sahifada emas): u
// sahifani sekinlashtirmasligi va kerak bo'lmaganda umuman kelmasligi kerak.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BROWSER_API } from '@/lib/api';
import { t } from '@/lib/i18n';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('server'));
    if (window.google && window.google.accounts) return resolve(window.google);

    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return undefined;
    }

    const el = document.createElement('script');
    el.src = GSI_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve(window.google);
    el.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(el);
    return undefined;
  });
}

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export default function StatusCheck({ lang = 'uz' }) {
  const c = t(lang);
  const s = c.status;

  const [clientId, setClientId] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const buttonRef = useRef(null);

  // Mijoz ID'si backend'dan olinadi — u yagona manba, saytda takrorlanmaydi
  useEffect(() => {
    let alive = true;
    fetch(`${BROWSER_API}/api/public/config`)
      .then((r) => r.json())
      .then((cfg) => {
        if (!alive) return;
        setClientId(cfg.googleClientId || null);
        setConfigLoaded(true);
      })
      .catch(() => alive && setConfigLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const check = useCallback(
    async (credential) => {
      setChecking(true);
      setError('');
      try {
        const res = await fetch(`${BROWSER_API}/api/public/application-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || s.failed);
          return;
        }
        setResult(data);
      } catch (_) {
        setError(s.failed);
      } finally {
        setChecking(false);
      }
    },
    [s.failed]
  );

  // Google tugmasini chizamiz
  useEffect(() => {
    if (!clientId || result) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => check(response.credential),
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: lang === 'ru' ? 'ru' : 'uz',
          width: 280,
        });
      })
      .catch(() => {
        if (!cancelled) setError(s.failed);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, result, check, lang, s.failed]);

  function signOut() {
    try {
      if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
    } catch (_) {
      /* muhim emas */
    }
    setResult(null);
    setError('');
  }

  const home = lang === 'ru' ? '/ru' : '/';
  const apply = lang === 'ru' ? '/ru/sorov' : '/sorov';

  // ---------- Javob ----------
  if (result) {
    return (
      <div className="form-card status-card">
        {result.state === 'approved' && <Approved c={c} s={s} result={result} lang={lang} />}
        {result.state === 'rejected' && (
          <>
            <div className="status-mark rejected">✕</div>
            <h1>{s.rejectedTitle}</h1>
            <p>{s.rejectedText}</p>
            {result.note && (
              <p className="status-note">
                <b>{s.rejectedNote}</b> {result.note}
              </p>
            )}
            <div className="status-actions">
              <Link href={apply} className="btn btn-primary">
                <span>{c.form.title}</span>
              </Link>
              <Link href={home} className="btn btn-ghost">
                {c.form.back}
              </Link>
            </div>
          </>
        )}
        {result.state === 'pending' && (
          <>
            <div className="status-mark pending">⏳</div>
            <h1>{s.pendingTitle}</h1>
            <p>{s.pendingText}</p>
            {result.submittedAt && (
              <p className="status-meta">
                {s.sentAt}: {fmtDate(result.submittedAt)}
              </p>
            )}
            <div className="status-actions">
              <Link href={home} className="btn btn-ghost">
                {c.form.back}
              </Link>
            </div>
          </>
        )}
        {result.state === 'not_found' && (
          <>
            <div className="status-mark pending">🔍</div>
            <h1>{s.notFoundTitle}</h1>
            <p>{s.notFoundText}</p>
            <p className="status-meta">{result.email}</p>
            <div className="status-actions">
              <Link href={apply} className="btn btn-primary">
                <span>{c.form.title}</span>
              </Link>
            </div>
          </>
        )}

        <button type="button" className="btn btn-ghost btn-sm status-signout" onClick={signOut}>
          {s.signOut}
        </button>
      </div>
    );
  }

  // ---------- Kirish ----------
  return (
    <div className="form-card status-card">
      <h1>{s.title}</h1>
      <p>{s.subtitle}</p>

      {error && <div className="form-error">{error}</div>}

      {configLoaded && !clientId && <div className="form-error">{s.notConfigured}</div>}

      {clientId && (
        <>
          <div className="status-gsi" ref={buttonRef} aria-busy={checking} />
          {checking && <p className="status-meta">{s.signingIn}</p>}
          <p className="status-why">{s.why}</p>
        </>
      )}

      <div className="status-actions">
        <Link href={home} className="btn btn-ghost">
          {c.form.back}
        </Link>
      </div>
    </div>
  );
}

function Approved({ c, s, result, lang }) {
  const appUrl = result.appUrl || '';
  return (
    <>
      <div className="status-mark approved">✓</div>
      <h1>{s.approvedTitle}</h1>
      <p>{s.approvedText}</p>

      <div className="status-creds">
        <div>
          <span>{s.fieldPlace}</span>
          <b>{result.placeName}</b>
        </div>
        {appUrl && (
          <div>
            <span>{s.fieldUrl}</span>
            <b>{appUrl}</b>
          </div>
        )}
        <div>
          <span>{s.fieldPhone}</span>
          <b>{result.phone}</b>
        </div>
        <div>
          <span>{s.fieldPassword}</span>
          {result.password ? <b className="mono">{result.password}</b> : <b>••••••••</b>}
        </div>
      </div>

      <p className={result.password ? 'status-note warn' : 'status-note'}>
        {result.password ? s.passwordOnce : s.passwordGone}
      </p>

      <div className="status-actions">
        {appUrl && (
          <a href={appUrl} className="btn btn-primary" target="_blank" rel="noreferrer">
            <span>{s.openApp}</span>
          </a>
        )}
        <Link href={lang === 'ru' ? '/ru' : '/'} className="btn btn-ghost">
          {c.form.back}
        </Link>
      </div>
    </>
  );
}
