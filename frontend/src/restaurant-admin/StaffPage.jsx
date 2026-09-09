import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import { dateOnly, initials } from '../lib/format';

// XODIMLAR — rollar bo'yicha alohida bo'limlar.
//
// Avval hammasi bitta uzun ro'yxatda edi va "kim oshpaz, kim ofitsiant"
// degan savolga javob berish uchun ko'z bilan qidirishga to'g'ri kelardi.
// Endi har bir rol o'z bo'limida: ichkariga kirilganda faqat o'sha roldagi
// odamlar ko'rinadi va "qo'shish" tugmasi ham o'sha rolni yaratadi —
// rol tanlash bosqichi umuman yo'qoladi.

const ROLES = [
  {
    key: 'admin',
    icon: '🛡',
    title: 'Administratorlar',
    one: 'Administrator',
    add: '+ Administrator qo‘shish',
    about: 'Menyu, stollar, xodimlar va hisobotlarni boshqaradi.',
    namePlaceholder: 'Aziza Rahimova',
  },
  {
    key: 'kitchen',
    icon: '👨‍🍳',
    title: 'Oshpazlar',
    one: 'Oshpaz',
    add: '+ Oshpaz qo‘shish',
    about: 'Oshxona ekranida buyurtmalarni ko‘radi va tayyorlaydi.',
    namePlaceholder: 'Aziz Karimov',
  },
  {
    key: 'waiter',
    icon: '🧑‍🍽',
    title: 'Ofitsiantlar',
    one: 'Ofitsiant',
    add: '+ Ofitsiant qo‘shish',
    about: 'Tayyor buyurtmalarni stolga yetkazadi.',
    namePlaceholder: 'Malika Yusupova',
  },
];

export default function StaffPage({ api }) {
  const [staff, setStaff] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('admin');
  const [inviteRole, setInviteRole] = useState(null);
  const [createdInvite, setCreatedInvite] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [list, pending] = await Promise.all([api.get('/staff'), api.get('/staff/invites')]);
      setStaff(list);
      setInvites(pending);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Har bir rolda nechta odam va nechta kutilayotgan taklif borligi
  const counts = useMemo(() => {
    const map = {};
    ROLES.forEach((r) => {
      map[r.key] = {
        staff: staff.filter((u) => u.role === r.key).length,
        invites: invites.filter((i) => i.role === r.key).length,
      };
    });
    return map;
  }, [staff, invites]);

  const current = ROLES.find((r) => r.key === role);
  const people = staff.filter((u) => u.role === role);
  const pending = invites.filter((i) => i.role === role);

  async function toggleActive(user) {
    try {
      await api.patch(`/staff/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'Xodim o\'chirildi' : 'Xodim faollashtirildi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function revokeInvite(invite) {
    try {
      await api.del(`/staff/invites/${invite.id}`);
      toast.info('Taklif bekor qilindi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function copy(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Havola nusxalandi'))
      .catch(() => toast.error('Nusxalab bo\'lmadi'));
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Xodimlar</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {staff.length} kishi
            {invites.length > 0 ? ` · ${invites.length} ta taklif kutilmoqda` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setInviteRole(current)}>
          {current.add}
        </button>
      </div>

      {/* Rollar — har biri alohida bo'lim */}
      <div className="role-tabs">
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`role-tab${role === r.key ? ' active' : ''}`}
            onClick={() => setRole(r.key)}
          >
            <span className="role-tab-icon" aria-hidden="true">{r.icon}</span>
            <span className="grow">
              <b>{r.title}</b>
              <small>
                {counts[r.key].staff} kishi
                {counts[r.key].invites > 0 ? ` · ${counts[r.key].invites} taklif` : ''}
              </small>
            </span>
          </button>
        ))}
      </div>

      <div className="dl-panel" key={role}>
        <div className="dl-panel-head">
          <h2>
            <span style={{ marginRight: 8 }} aria-hidden="true">{current.icon}</span>
            {current.title}
          </h2>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
            {current.about}
          </span>
        </div>

        {loading && (
          <div className="dl-list-empty">
            <span className="spinner" /> Yuklanmoqda…
          </div>
        )}

        {/* Kutilayotgan takliflar shu rolning tepasida turadi */}
        {pending.map((i) => (
          <div className="dl-staff-row pending" key={i.id}>
            <div className="dl-avatar">{initials(i.fullName)}</div>
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {i.fullName}
                <span className="invite-chip">taklif yuborilgan</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                <span className="mono">{i.phone}</span> · {dateOnly(i.expiresAt)} gacha amal qiladi
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(i.inviteLink)}>
              Havolani nusxalash
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ color: 'var(--red)' }}
              title="Taklifni bekor qilish"
              onClick={() => revokeInvite(i)}
            >
              ✕
            </button>
          </div>
        ))}

        {people.map((u) => (
          <div className="dl-staff-row" key={u.id}>
            <div className="dl-avatar">{initials(u.fullName)}</div>
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 14, opacity: u.isActive ? 1 : 0.5 }}>
                {u.fullName}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                <span className="mono">{u.phone}</span>
                {u.createdAt ? ` · ${dateOnly(u.createdAt)} dan beri` : ''}
              </div>
            </div>
            <span
              className={`dl-presence${u.isActive ? ' online' : ''}`}
              title={u.isActive ? 'Faol' : 'O\'chirilgan'}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
              {u.isActive ? 'O\'chirish' : 'Faollashtirish'}
            </button>
          </div>
        ))}

        {!loading && people.length === 0 && pending.length === 0 && (
          <div className="dl-list-empty">
            Bu bo‘limda hali hech kim yo‘q.
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteRole(current)}>
                {current.add}
              </button>
            </div>
          </div>
        )}
      </div>

      <InviteModal
        api={api}
        role={inviteRole}
        onClose={() => setInviteRole(null)}
        onCreated={(data) => {
          setInviteRole(null);
          setCreatedInvite(data);
          load();
        }}
      />

      <Modal open={!!createdInvite} onClose={() => setCreatedInvite(null)} className="bazm-modal">
        {createdInvite && (
          <>
            <div className="modal-head">
              <h2>Taklif tayyor</h2>
              <button type="button" className="icon-btn" onClick={() => setCreatedInvite(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-note">
                Bu havolani xodimga yuboring. U ochib, o‘zi parol o‘rnatadi va hisobi faollashadi.
                Parol aynan <b>{createdInvite.phone || 'taklifdagi'}</b> raqamga bog‘lanadi.
                Havola 3 kun amal qiladi.
              </div>
              <div className="credentials-box" style={{ wordBreak: 'break-all' }}>
                {createdInvite.inviteLink}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => copy(createdInvite.inviteLink)}>
                Nusxalash
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setCreatedInvite(null)}>
                Tayyor
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

// Rol bu yerda TANLANMAYDI — qaysi bo'limdan chaqirilgan bo'lsa, o'sha
// rol bilan ochiladi. Shuning uchun formada faqat ism va telefon qoladi.
function InviteModal({ api, role, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', phone: '+998' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setForm({ fullName: '', phone: '+998' });
      setError('');
    }
  }, [role]);

  async function submit(e) {
    e.preventDefault();
    if (!isValidPhone(form.phone)) {
      setError('Telefon raqamini 9 xonali qilib kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/staff/invite', {
        fullName: form.fullName.trim(),
        phone: form.phone,
        role: role.key,
      });
      onCreated({ ...data, phone: form.phone });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!role} onClose={onClose} className="bazm-modal">
      {role && (
        <form onSubmit={submit}>
          <div className="modal-head">
            <h2>
              <span style={{ marginRight: 8 }} aria-hidden="true">{role.icon}</span>
              Yangi {role.one.toLowerCase()}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="form-note">
              {role.about} Taklif havolasi yaratiladi — xodim uni ochib o‘zi parol qo‘yadi.
            </div>

            <div className="field">
              <label>To‘liq ismi *</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder={role.namePlaceholder}
                required
                minLength={2}
                autoFocus
              />
            </div>

            <div className="field">
              <label>Telefon raqami *</label>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
                required
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Taklif yaratish'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
