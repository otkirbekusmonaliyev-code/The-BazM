import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import PlaceDrawer from './PlaceDrawer';
import { dateOnly, money, SUBSCRIPTION_LABELS, PLAN_LABELS } from '../lib/format';

// Muassasalar ro'yxati. Bitta komponent ikki bo'limga xizmat qiladi:
// `type="restaurant"` — Restoranlar, `type="cafe"` — Kafelar.
// Mantiq ikkalasida ham bir xil, faqat filtr va matnlar farq qiladi.

const FILTERS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'active', label: 'Faol' },
  { key: 'trial', label: 'Sinov' },
  { key: 'suspended', label: "To'xtatilgan" },
];

const COPY = {
  restaurant: {
    title: 'Restoranlar',
    create: '+ Yangi restoran',
    createTitle: 'Yangi restoran',
    empty: 'Bu filtrga mos restoran yo\'q',
    namePlaceholder: 'Delish',
    icon: '🍽',
  },
  cafe: {
    title: 'Kafelar',
    create: '+ Yangi kafe',
    createTitle: 'Yangi kafe',
    empty: 'Bu filtrga mos kafe yo\'q',
    namePlaceholder: 'Bon Appetit',
    icon: '☕',
  },
};

export default function PlacesPage({ api, type, onChanged }) {
  const c = COPY[type];
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get(`/super-admin/restaurants?type=${type}`));
    } finally {
      setLoading(false);
    }
  }, [api, type]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.subscriptionStatus === filter);

  return (
    <>
      <div className="bazm-panel glass-panel">
        <div className="bazm-panel-head">
          <h2>
            <span style={{ marginRight: 8 }}>{c.icon}</span>
            {c.title}
          </h2>
          <div className="bazm-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`bazm-chip${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span style={{ marginLeft: 6, opacity: 0.75 }}>
                    {rows.filter((r) => r.subscriptionStatus === f.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setCreateOpen(true)}
          >
            {c.create}
          </button>
        </div>

        <div className="bazm-table-wrap">
          <table className="bazm-table">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Slug</th>
                <th>Tarif</th>
                <th>Oylik</th>
                <th>Holat</th>
                <th>Qo'shilgan</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={flashId === r.id ? 'flash-new' : ''}
                  onClick={() => setParams({ open: r.id }, { replace: true })}
                >
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{r.slug}</td>
                  <td>{PLAN_LABELS[r.subscriptionPlan]}</td>
                  <td className="mono">{money(r.monthlyFee)}</td>
                  <td>
                    <span className={`status-badge ${r.subscriptionStatus}`}>
                      {SUBSCRIPTION_LABELS[r.subscriptionStatus]}
                    </span>
                  </td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{dateOnly(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="bazm-empty">
            <span className="spinner" /> Yuklanmoqda…
          </div>
        )}
        {!loading && visible.length === 0 && <div className="bazm-empty">{c.empty}</div>}
      </div>

      <CreatePlaceModal
        api={api}
        type={type}
        copy={c}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (place) => {
          await load();
          onChanged();
          setFlashId(place.id);
          setTimeout(() => setFlashId(null), 1200);
        }}
      />

      {openId && (
        <PlaceDrawer
          api={api}
          restaurantId={openId}
          onClose={() => setParams({}, { replace: true })}
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function CreatePlaceModal({ api, type, copy, open, onClose, onCreated }) {
  const empty = { name: '', slug: '', plan: 'basic', adminName: '', adminPhone: '+998', adminPassword: '' };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError('');
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!isValidPhone(form.adminPhone)) {
      setError('Admin telefon raqamini 9 xonali qilib kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        plan: form.plan,
        businessType: type,
        adminPhone: form.adminPhone,
      };
      if (form.slug.trim()) body.slug = form.slug.trim();
      if (form.adminName.trim()) body.adminName = form.adminName.trim();
      if (form.adminPassword.trim()) body.adminPassword = form.adminPassword.trim();

      const data = await api.post('/super-admin/restaurants', body);
      setResult(data);
      await onCreated(data.restaurant);
      toast.success('Muassasa ishga tushirildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="bazm-modal glass-panel">
      {result ? (
        <>
          <div className="modal-head">
            <h2>Tayyor</h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-note">
              Bu ma'lumotlarni egasiga bering — parol boshqa hech qayerda ko'rsatilmaydi.
            </div>
            <div className="credentials-box">
              <div>Nomi: {result.restaurant.name}</div>
              <div>Manzil: {window.location.origin}</div>
              {result.adminCredentials && (
                <>
                  <div>Telefon: {result.adminCredentials.phone}</div>
                  <div>Parol: {result.adminCredentials.password}</div>
                </>
              )}
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Tushunarli
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="modal-head">
            <h2>{copy.createTitle}</h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="field">
              <label>Nomi *</label>
              <input value={form.name} onChange={set('name')} placeholder={copy.namePlaceholder} required minLength={2} />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Slug (ixtiyoriy)</label>
                <input value={form.slug} onChange={set('slug')} placeholder="avtomatik" />
              </div>
              <div className="field">
                <label>Tarif</label>
                <select value={form.plan} onChange={set('plan')}>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Admin ismi</label>
              <input value={form.adminName} onChange={set('adminName')} placeholder="Muassasa egasi" />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Admin telefoni *</label>
                <PhoneInput
                  value={form.adminPhone}
                  onChange={(adminPhone) => setForm((f) => ({ ...f, adminPhone }))}
                  required
                />
              </div>
              <div className="field">
                <label>Parol (ixtiyoriy)</label>
                <input value={form.adminPassword} onChange={set('adminPassword')} placeholder="avtomatik" />
              </div>
            </div>

            <div className="form-note">
              Yaratilgach avtomatik ravishda alohida PostgreSQL bazasi ochiladi va barcha
              jadvallar quriladi. Bu bir necha soniya olishi mumkin.
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Yaratish'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
