import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { elapsed } from '../lib/format';

// STOLLAR.
//
// Har bir stol yaratilganda unga darhol o'z QR kodi beriladi (server tomonda,
// `qrToken`). Bu yerda o'sha kodni ko'rish, PNG yoki SVG qilib YUKLAB OLISH,
// hammasini bitta varaqda chop etish va zarur bo'lsa qaytadan yaratish mumkin.
//
// QR endpoint'i himoyalangan (Authorization header kerak), shuning uchun
// oddiy <a download> ishlamaydi — fayl blob orqali olinadi va shundan keyin
// yuklab olish boshlanadi.

export default function TablesPage({ api, slug, liveTick }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrTable, setQrTable] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setTables(await api.get('/tables/admin'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    load();
  }, [load, liveTick]);

  async function release(table) {
    try {
      await api.patch(`/tables/admin/${table.id}/release`);
      toast.success(`${table.tableNumber}-stol bo'shatildi`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(table) {
    if (!window.confirm(`${table.tableNumber}-stol o'chirilsinmi?`)) return;
    try {
      await api.del(`/tables/admin/${table.id}`);
      toast.success('O\'chirildi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Barcha QR kodlarni bitta chop etiladigan varaqda ochish.
  // Rasmlar serverdan data URL ko'rinishida keladi — yangi oynada
  // qayta autentifikatsiya qilish muammosi bo'lmaydi.
  async function printAll() {
    setPrinting(true);
    try {
      const codes = await api.get('/tables/admin/qr-codes');
      if (codes.length === 0) {
        toast.info('Hali stol yo\'q');
        return;
      }

      const win = window.open('', '_blank');
      if (!win) {
        toast.error('Brauzer yangi oynani bloklab qo\'ydi');
        return;
      }

      const cards = codes
        .map(
          (c) => `
        <figure>
          <img src="${c.dataUrl}" alt="${c.tableNumber}-stol QR kodi" />
          <figcaption><b>${c.tableNumber}</b><span>stol</span></figcaption>
        </figure>`
        )
        .join('');

      win.document.write(`<!doctype html>
<html lang="uz"><head><meta charset="utf-8" />
<title>${slug} — stol QR kodlari</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px; font-family: system-ui, sans-serif; background: #fff; color: #111; }
  h1 { font-size: 17px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  figure { margin: 0; padding: 12px; border: 1px dashed #bbb; border-radius: 12px; text-align: center; break-inside: avoid; }
  figure img { width: 100%; height: auto; display: block; }
  figcaption { margin-top: 6px; }
  figcaption b { display: block; font-size: 26px; line-height: 1; }
  figcaption span { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #666; }
  @media print { body { padding: 0; } h1 { display: none; } .grid { gap: 10px; } }
</style></head>
<body>
  <h1>${slug} — stol QR kodlari (${codes.length} ta)</h1>
  <div class="grid">${cards}</div>
  <script>window.onload = function () { window.print(); };<\/script>
</body></html>`);
      win.document.close();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPrinting(false);
    }
  }

  const occupied = tables.filter((t) => t.isOccupied).length;

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Stollar</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {tables.length} ta stol · {occupied} tasi band · har birida o‘z QR kodi
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {tables.length > 0 && (
            <button type="button" className="btn btn-ghost" disabled={printing} onClick={printAll}>
              {printing ? <span className="spinner" /> : '🖨  Barcha QR kodlar'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Stol qo‘shish
          </button>
        </div>
      </div>

      {loading && (
        <div className="dl-list-empty">
          <span className="spinner" /> Yuklanmoqda…
        </div>
      )}

      {!loading && tables.length === 0 && (
        <div className="dl-panel">
          <div className="dl-list-empty">
            Hali stol qo‘shilmagan. "Stol qo‘shish" tugmasi orqali bir vaqtning o‘zida
            bir nechta stol yaratishingiz mumkin — har biriga avtomatik QR kod beriladi.
          </div>
        </div>
      )}

      <div className="dl-tables-grid">
        {tables.map((t) => (
          <div key={t.id} className={`dl-table-card${t.isOccupied ? ' occupied' : ''}`}>
            <span className="table-qr-dot" title="QR kodi bor" aria-hidden="true">▦</span>
            <b>{t.tableNumber}</b>
            <small>
              {t.isOccupied
                ? t.occupiedAt
                  ? `Band · ${elapsed(t.occupiedAt)}`
                  : 'Band'
                : 'Bo\'sh'}
            </small>
            {t.activeOrders.length > 0 && (
              <small style={{ color: 'var(--gold)' }}>{t.activeOrders.length} ta buyurtma</small>
            )}
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQrTable(t)}>
                QR kod
              </button>
              {t.isOccupied && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => release(t)}>
                  Bo‘shatish
                </button>
              )}
              {!t.isOccupied && t.activeOrders.length === 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red)' }}
                  onClick={() => remove(t)}
                >
                  O‘chirish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AddTablesModal
        api={api}
        open={addOpen}
        existing={tables}
        onClose={() => setAddOpen(false)}
        onDone={() => {
          setAddOpen(false);
          load();
        }}
      />

      <QrModal
        api={api}
        table={qrTable}
        onClose={() => setQrTable(null)}
        onRegenerated={() => {
          setQrTable(null);
          load();
        }}
      />
    </>
  );
}

// ---------- QR oynasi: ko'rish, yuklab olish, qayta yaratish ----------

function QrModal({ api, table, onClose, onRegenerated }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!table) {
      setUrl(null);
      setError('');
      setConfirming(false);
      return undefined;
    }
    let objectUrl = null;
    let alive = true;
    setUrl(null);
    setError('');
    api
      .blob(`/tables/admin/${table.id}/qr-code`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, table]);

  // Himoyalangan endpointdan faylni olib, brauzerga yuklatamiz
  async function download(format) {
    setBusy(format);
    try {
      const blob = await api.blob(
        `/tables/admin/${table.id}/qr-code?download=1&format=${format}&size=1000`
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `stol-${table.tableNumber}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Brauzer faylni o'qib bo'lguncha biroz kutamiz
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      toast.success('Yuklab olindi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  async function regenerate() {
    setBusy('new');
    try {
      await api.post(`/tables/admin/${table.id}/qr-code/regenerate`);
      toast.success('Yangi QR kod yaratildi — eskisi endi ishlamaydi');
      onRegenerated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <Modal open={!!table} onClose={onClose} className="bazm-modal">
      {table && (
        <>
          <div className="modal-head">
            <h2>{table.tableNumber}-stol QR kodi</h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body" style={{ textAlign: 'center' }}>
            {error && <div className="form-error">{error}</div>}

            <div className="qr-preview">
              {url ? (
                <img src={url} alt={`${table.tableNumber}-stol QR kodi`} />
              ) : (
                <span className="spinner spinner-lg" style={{ color: '#111' }} />
              )}
            </div>

            <div className="qr-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!url || !!busy}
                onClick={() => download('png')}
              >
                {busy === 'png' ? <span className="spinner" /> : '⬇  PNG yuklab olish'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!url || !!busy}
                onClick={() => download('svg')}
              >
                {busy === 'svg' ? <span className="spinner" /> : '⬇  SVG (bosma uchun)'}
              </button>
            </div>

            <div className="qr-link">{table.qrUrl}</div>

            <p style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6, textAlign: 'left' }}>
              Bu kodni chop etib stol ustiga qo‘ying. Mijoz skanerlaganda to‘g‘ridan-to‘g‘ri
              shu stolning menyusi ochiladi. Katta bosma uchun SVG ni tanlang — u istalgan
              o‘lchamda aniq chiqadi.
            </p>
          </div>

          <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
            {confirming ? (
              <div className="inline-confirm">
                <span>Eski kod ishlamay qoladi. Davom etamizmi?</span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={!!busy}
                  onClick={regenerate}
                >
                  Ha
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                  Yo‘q
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--red)' }}
                onClick={() => setConfirming(true)}
              >
                Kodni yangilash
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Yopish
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function AddTablesModal({ api, open, existing, onClose, onDone }) {
  const nextNumber = existing.length ? Math.max(...existing.map((t) => t.tableNumber)) + 1 : 1;
  const [from, setFrom] = useState(nextNumber);
  const [to, setTo] = useState(nextNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setFrom(nextNumber);
      setTo(nextNumber);
      setError('');
    }
  }, [open, nextNumber]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/tables/admin/bulk', { from: Number(from), to: Number(to) });
      toast.success(
        result.created > 0
          ? `${result.created} ta stol qo'shildi — har biriga QR kod yaratildi`
          : 'Yangi stol qo\'shilmadi (raqamlar band edi)'
      );
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="bazm-modal">
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>Stol qo‘shish</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-note">
            Oraliq ko‘rsating — masalan 1 dan 20 gacha. Mavjud raqamlar o‘tkazib yuboriladi.
            Har bir yangi stol uchun QR kod avtomatik yaratiladi va darhol yuklab olsa bo‘ladi.
          </div>
          <div className="field-row">
            <div className="field">
              <label>Dan</label>
              <input type="number" min="1" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="field">
              <label>Gacha</label>
              <input type="number" min="1" value={to} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Qo\'shish'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
