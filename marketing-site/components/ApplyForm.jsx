'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';
import { BROWSER_API } from '@/lib/api';

// "Qo'shilish so'rovi" formasi.
// Viloyat/shahar ro'yxati serverdan (props orqali) keladi — shahar tanlovi
// viloyat tanlanmaguncha faolsiz turadi.

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', pro: 'Pro' };

// Telefon maydonida "+998" doimiy, o'zgartirib bo'lmaydigan qism sifatida
// turadi — foydalanuvchi faqat 9 ta raqamni kiritadi
const localDigits = (full) => {
  const d = String(full || '').replace(/\D/g, '');
  return (d.startsWith('998') ? d.slice(3) : d).slice(0, 9);
};

const prettyPhone = (local) => {
  let out = local.slice(0, 2);
  if (local.length > 2) out += ` ${local.slice(2, 5)}`;
  if (local.length > 5) out += ` ${local.slice(5, 7)}`;
  if (local.length > 7) out += ` ${local.slice(7, 9)}`;
  return out;
};

export default function ApplyForm({ lang, regions }) {
  const c = t(lang);
  const params = useSearchParams();

  const [form, setForm] = useState({
    region: '',
    city: '',
    businessType: 'restaurant',
    name: '',
    phone: '+998',
    email: '',
    plan: 'basic',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Narxlar jadvalidagi tugmadan kelingan bo'lsa — tarif oldindan tanlanadi
  useEffect(() => {
    const plan = params.get('plan');
    if (plan && PLAN_NAMES[plan]) setForm((f) => ({ ...f, plan }));
  }, [params]);

  const cities = useMemo(() => {
    const region = regions.find((r) => r.name === form.region);
    return region ? region.cities : [];
  }, [regions, form.region]);

  const set = (key) => (e) => {
    const { value } = e.target;
    // Viloyat almashsa — eski shahar tanlovi kuchini yo'qotadi
    setForm((f) => (key === 'region' ? { ...f, region: value, city: '' } : { ...f, [key]: value }));
  };

  async function submit(e) {
    e.preventDefault();
    if (localDigits(form.phone).length !== 9) {
      setError(lang === 'ru' ? 'Введите 9 цифр номера' : 'Telefon raqamini 9 xonali qilib kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BROWSER_API}/api/public/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          businessType: form.businessType,
          phone: form.phone,
          email: form.email.trim() || undefined,
          region: form.region,
          city: form.city,
          description: form.description.trim() || undefined,
          plan: form.plan,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || `Xatolik (${res.status})`);
      setDone(true);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? lang === 'ru'
            ? 'Нет связи с сервером. Попробуйте ещё раз.'
            : 'Server bilan aloqa yo\'q. Qayta urinib ko\'ring.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="form-card">
        <div className="form-success">
          <div className="form-success-mark">✓</div>
          <h2>{c.form.successTitle}</h2>
          <p>{c.form.successText}</p>

          {/* Odam formani yuborgach "endi nima bo'ladi?" degan savol bilan
              qoladi. Javob QAYERDAN kelishini aynan shu yerda aytamiz —
              tugmalar yonida, ko'rinadigan joyda. */}
          <p className="form-success-where">{c.form.successWhere}</p>

          <div className="form-success-actions">
            <Link href={lang === 'ru' ? '/ru/holat' : '/holat'} className="btn btn-primary">
              <span>{c.form.successCheck}</span>
            </Link>
            <Link href={lang === 'ru' ? '/ru' : '/'} className="btn btn-ghost">
              {c.form.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h1>{c.form.title}</h1>
      <p>{c.form.subtitle}</p>

      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label htmlFor="country">{c.form.country}</label>
        <input id="country" value={lang === 'ru' ? 'Узбекистан' : 'O\'zbekiston'} disabled readOnly />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="region">{c.form.region} *</label>
          <select id="region" value={form.region} onChange={set('region')} required>
            <option value="">{c.form.regionPlaceholder}</option>
            {regions.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="city">{c.form.city} *</label>
          <select id="city" value={form.city} onChange={set('city')} required disabled={!form.region}>
            <option value="">{form.region ? c.form.city : c.form.cityPlaceholder}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>{c.form.businessType} *</label>
        <div className="radio-row">
          {['restaurant', 'cafe'].map((type) => (
            <label
              key={type}
              className={`radio-card${form.businessType === type ? ' active' : ''}`}
            >
              <input
                type="radio"
                name="businessType"
                value={type}
                checked={form.businessType === type}
                onChange={set('businessType')}
              />
              {type === 'restaurant' ? c.form.restaurant : c.form.cafe}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="name">{c.form.name} *</label>
        <input
          id="name"
          value={form.name}
          onChange={set('name')}
          placeholder={c.form.namePlaceholder}
          required
          minLength={2}
          maxLength={80}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="phone">{c.form.phone} *</label>
          <div className="phone-field">
            <span className="phone-prefix" aria-hidden="true">
              +998
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={prettyPhone(localDigits(form.phone))}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: `+998${localDigits(e.target.value)}` }))
              }
              placeholder="90 123 45 67"
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">{c.form.email}</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} placeholder="salom@restoran.uz" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="plan">{c.form.plan}</label>
        <select id="plan" value={form.plan} onChange={set('plan')}>
          {Object.entries(PLAN_NAMES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="description">{c.form.note}</label>
        <textarea
          id="description"
          value={form.description}
          onChange={set('description')}
          placeholder={c.form.notePlaceholder}
          maxLength={1000}
        />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" /> {c.form.submitting}
          </>
        ) : (
          c.form.submit
        )}
      </button>
    </form>
  );
}
