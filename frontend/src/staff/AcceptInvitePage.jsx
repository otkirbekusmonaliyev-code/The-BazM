import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { request } from '../lib/api';
import { ROLE_LABELS } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';
import { toLocalDigits } from '../components/PhoneInput';

// Admin yuborgan taklif havolasi shu sahifaga olib keladi.
//
// Sahifa avval taklif KIMGA berilganini ko'rsatadi (ism, telefon, rol) —
// xodim qaysi hisobni faollashtirayotganini va keyin qaysi raqam bilan
// kirishini aniq bilishi kerak. Keyin u faqat parol o'rnatadi: qolgan
// ma'lumot taklifning o'zida saqlangan.

export default function AcceptInvitePage() {
  const { slug, token } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Taklif tafsilotlarini oldindan olamiz: yaroqsiz havolani parol
  // kiritilgandan keyin emas, DARHOL aytamiz
  useEffect(() => {
    let alive = true;
    request(`/auth/accept-invite/${token}`, { slug })
      .then((data) => alive && setInvite(data))
      .catch((err) => {
        if (!alive) return;
        setLoadError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [slug, token]);

  function fail(message) {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 420);
  }

  async function submit(e) {
    e.preventDefault();
    if (password.length < 6) return fail('Parol kamida 6 belgidan iborat bo\'lsin');
    if (password !== repeat) return fail('Parollar mos kelmadi');

    setLoading(true);
    setError('');
    try {
      const result = await request(`/auth/accept-invite/${token}`, {
        method: 'POST',
        slug,
        body: { password },
      });
      setDone(true);
      // Login sahifasiga raqamni ham olib o'tamiz — xodim uni yodlab
      // o'tirmasin, forma o'zi to'ldirilgan holda ochilsin
      const phone = (result && result.user && result.user.phone) || (invite && invite.phone) || '';
      setTimeout(
        () => navigate(`/?phone=${toLocalDigits(phone)}`, { replace: true }),
        1800
      );
    } catch (err) {
      fail(err.message);
    } finally {
      setLoading(false);
    }
    return undefined;
  }

  return (
    <div className="app-auth">
      <div className="auth-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
        <span className="aurora-blob a3" />
      </div>
      <div className="auth-shell auth-shell-center">
        <div style={{ position: 'fixed', top: 18, right: 18 }}>
          <ThemeToggle />
        </div>

        {loadError ? (
          <div className="auth-card glass" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>⛔</div>
            <div className="auth-title" style={{ fontSize: 20 }}>
              Havola ishlamaydi
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>
              {loadError}
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 20 }}
              onClick={() => navigate('/')}
            >
              Kirish sahifasiga
            </button>
          </div>
        ) : done ? (
          <div className="auth-card glass" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
            <div className="auth-title" style={{ fontSize: 20 }}>
              Hisobingiz tayyor
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
              Endi <b style={{ color: 'var(--text)' }}>{invite ? invite.phone : ''}</b> raqami va
              o'rnatgan parolingiz bilan kirasiz.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 14 }}>
              Kirish sahifasiga o'tkazilmoqda…
            </p>
          </div>
        ) : !invite ? (
          <div className="auth-card glass" style={{ textAlign: 'center', padding: 46 }}>
            <span className="spinner spinner-lg" />
          </div>
        ) : (
          <form className={`auth-card glass${shake ? ' shake' : ''}`} onSubmit={submit}>
            <div className="auth-title">Xush kelibsiz</div>
            <div className="auth-sub">PAROL O'RNATING</div>

            {/* Taklif kimga berilgani — xodim buni tasdiqlab, keyin parol qo'yadi */}
            <div className="form-note" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {invite.fullName}
              </div>
              <div style={{ marginTop: 6, fontSize: 13.5 }}>
                <span className="mono">{invite.phone}</span> · {ROLE_LABELS[invite.role]}
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
                Kirish uchun ana shu raqamdan foydalanasiz.
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="field">
              <label htmlFor="inv-pass">Yangi parol</label>
              <input
                id="inv-pass"
                type="password"
                autoComplete="new-password"
                placeholder="kamida 6 belgi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="inv-rep">Parolni takrorlang</label>
              <input
                id="inv-rep"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: 6 }}
            >
              {loading ? <span className="spinner" /> : 'Hisobni faollashtirish'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
