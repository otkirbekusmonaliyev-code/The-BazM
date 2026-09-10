import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';

// BREND — mijoz ilovasining ko'rinishi (Pro tarifda).
//
// To'rt narsani almashtirish mumkin: logotip, urg'u rangi, fon ohangi va
// shriftlar. Hech biri ERKIN emas — hammasi serverdagi tayyor ro'yxatdan
// keladi. Erkin rang tanlagichda birinchi kun kimdir och sariq tanlaydi
// va "Savatga" tugmasi o'qilmay qoladi; erkin shriftda kirill yozuvi
// yo'q shrift tanlanadi va menyu buziladi. Bunda mijoz emas, biz aybdor
// bo'lamiz.
//
// Tanlov shu yerning O'ZIDA ko'rinadi — odam saqlashdan keyin emas,
// oldin natijani ko'radi.

export default function BrandPage({ api, restaurant, onSaved }) {
  const [opts, setOpts] = useState(null);
  const [sel, setSel] = useState({});
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewLight, setPreviewLight] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const canBrand = restaurant && restaurant.canBrand;

  useEffect(() => {
    if (!canBrand) return;
    api.get('/admin/brand-options').then(setOpts).catch(() => {});
  }, [api, canBrand]);

  useEffect(() => {
    if (!restaurant || !opts) return;
    setSel({
      brandColor: restaurant.brandColor || opts.defaults.color,
      brandSurface: restaurant.brandSurface || opts.defaults.surface,
      brandDisplayFont: restaurant.brandDisplayFont || opts.defaults.displayFont,
      brandBodyFont: restaurant.brandBodyFont || opts.defaults.bodyFont,
    });
    setLogoUrl(restaurant.logoUrl || '');
  }, [restaurant, opts]);

  const save = useCallback(
    async (patch) => {
      setSaving(true);
      try {
        await api.patch('/admin/branding', patch);
        toast.success('Saqlandi ✓');
        if (onSaved) onSaved();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    },
    [api, toast, onSaved]
  );

  function choose(field, key) {
    setSel((s) => ({ ...s, [field]: key }));
    save({ [field]: key });
  }

  async function uploadLogo(file) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.upload('/uploads/image', form);
      setLogoUrl(res.url);
      await save({ logoUrl: res.url });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ---- Pro emas ----
  if (restaurant && !canBrand) {
    return (
      <div className="dl-panel">
        <h2 className="dl-panel-title">Brend</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, maxWidth: 580 }}>
          Logotip, rang va shrift tanlash <b>Pro</b> tarifida mumkin. Hozirgi tarifingiz —{' '}
          <b>{restaurant.subscriptionPlan}</b>.
          <br />
          Pro'ga o'tsangiz, mijozlar ko'radigan menyu ilovasi butunlay sizning
          brendingizda ochiladi.
        </p>
      </div>
    );
  }

  if (!opts) {
    return (
      <div className="dl-panel">
        <h2 className="dl-panel-title">Brend</h2>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const color = opts.colors.find((c) => c.key === sel.brandColor) || opts.colors[0];
  const surface = opts.surfaces.find((s) => s.key === sel.brandSurface) || opts.surfaces[0];
  const display = opts.displayFonts.find((f) => f.key === sel.brandDisplayFont) || opts.displayFonts[0];
  const body = opts.bodyFonts.find((f) => f.key === sel.brandBodyFont) || opts.bodyFonts[0];

  const mode = previewLight ? 'light' : 'dark';
  const pv = {
    accent: color[mode],
    bg: surface[mode].bg,
    card: surface[mode].card,
    text: previewLight ? '#22271d' : '#f3efe4',
    muted: previewLight ? '#6d7263' : '#a3a897',
    onAccent: previewLight ? '#ffffff' : '#171c16',
    border: previewLight ? 'rgba(34,39,29,.1)' : 'rgba(243,239,228,.09)',
  };

  return (
    <div className="dl-panel brand-page">
      <h2 className="dl-panel-title">Brend</h2>
      <p className="brand-lead">
        Bu yerda tanlaganingiz mijozlar ko'radigan menyu ilovasida chiqadi — QR kod
        orqali ham, Telegram Mini App'da ham.
      </p>

      <div className="brand-grid">
        <div className="brand-controls">
          {/* ---- Logotip ---- */}
          <section className="brand-block">
            <h3>Logotip</h3>
            <div className="brand-logo-row">
              <div className="brand-logo-preview">
                {logoUrl ? <img src={logoUrl} alt="Logotip" /> : <span>Logo yo'q</span>}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => uploadLogo(e.target.files && e.target.files[0])}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={uploading}
                  onClick={() => fileRef.current && fileRef.current.click()}
                >
                  {uploading ? <span className="spinner" /> : logoUrl ? 'Almashtirish' : 'Yuklash'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 8 }}
                    disabled={saving}
                    onClick={() => {
                      setLogoUrl('');
                      save({ logoUrl: null });
                    }}
                  >
                    O'chirish
                  </button>
                )}
                <p className="brand-hint">Kvadrat, shaffof fonli PNG eng yaxshi chiqadi.</p>
              </div>
            </div>
          </section>

          {/* ---- Urg'u rangi ---- */}
          <section className="brand-block">
            <h3>Urg'u rangi</h3>
            <p className="brand-hint">Tugmalar, narxlar va faol bo'limlar shu rangda bo'ladi.</p>
            <div className="brand-colors">
              {opts.colors.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`brand-color${sel.brandColor === c.key ? ' selected' : ''}`}
                  onClick={() => choose('brandColor', c.key)}
                  disabled={saving}
                >
                  <span className="brand-swatch" style={{ background: c.dark }} />
                  <span className="brand-swatch" style={{ background: c.light }} />
                  <b>{c.name}</b>
                </button>
              ))}
            </div>
          </section>

          {/* ---- Fon ---- */}
          <section className="brand-block">
            <h3>Fon ohangi</h3>
            <p className="brand-hint">
              Yorqinlik o'zgarmaydi — faqat ohang. Shuning uchun matn har doim o'qiladi.
            </p>
            <div className="brand-colors">
              {opts.surfaces.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`brand-color${sel.brandSurface === s.key ? ' selected' : ''}`}
                  onClick={() => choose('brandSurface', s.key)}
                  disabled={saving}
                >
                  <span className="brand-swatch" style={{ background: s.dark.bg }} />
                  <span className="brand-swatch" style={{ background: s.light.bg }} />
                  <b>{s.name}</b>
                </button>
              ))}
            </div>
          </section>

          {/* ---- Shriftlar ---- */}
          <section className="brand-block">
            <h3>Sarlavha shrifti</h3>
            <p className="brand-hint">Taom nomlari va ekran sarlavhalari.</p>
            <div className="brand-fonts">
              {opts.displayFonts.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`brand-font${sel.brandDisplayFont === f.key ? ' selected' : ''}`}
                  onClick={() => choose('brandDisplayFont', f.key)}
                  disabled={saving}
                >
                  <b style={{ fontFamily: f.stack }}>Toshkent oshi</b>
                  <span>
                    {f.name} · {f.note}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="brand-block">
            <h3>Matn shrifti</h3>
            <p className="brand-hint">Tavsiflar, tugmalar va ro'yxatlar.</p>
            <div className="brand-fonts">
              {opts.bodyFonts.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`brand-font${sel.brandBodyFont === f.key ? ' selected' : ''}`}
                  onClick={() => choose('brandBodyFont', f.key)}
                  disabled={saving}
                >
                  <b style={{ fontFamily: f.stack, fontSize: 15 }}>
                    Devzira guruch, qo'y go'shti, sariq sabzi
                  </b>
                  <span>
                    {f.name} · {f.note}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ---- Jonli natija ---- */}
        <div className="brand-preview-wrap">
          <div className="brand-preview-bar">
            <span>Mijoz nimani ko'radi</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewLight((v) => !v)}>
              {previewLight ? '🌙 Tungi' : '☀️ Kunduzgi'}
            </button>
          </div>

          <div
            className="brand-preview"
            style={{ background: pv.bg, color: pv.text, borderColor: pv.border, fontFamily: body.stack }}
          >
            <div className="brand-preview-head" style={{ borderColor: pv.border }}>
              {logoUrl && <img src={logoUrl} alt="" />}
              <div>
                <b style={{ fontFamily: display.stack }}>{restaurant ? restaurant.name : 'Restoran'}</b>
                <span style={{ color: pv.muted }}>7-stol · Mehmon</span>
              </div>
            </div>

            <div className="brand-preview-pills">
              <span style={{ background: pv.accent, color: pv.onAccent }}>Issiq taomlar</span>
              <span style={{ background: pv.card, color: pv.muted }}>Salatlar</span>
            </div>

            {[
              { emoji: '🍚', name: 'Toshkent oshi', desc: 'Devzira guruch, qo\'y go\'shti', price: '55 000' },
              { emoji: '🥘', name: 'Qozon kabob', desc: 'Kartoshka va go\'sht qozonda', price: '68 000' },
            ].map((d) => (
              <div className="brand-preview-dish" key={d.name} style={{ borderColor: pv.border }}>
                <div className="brand-preview-plate" style={{ background: pv.accent }}>
                  {d.emoji}
                </div>
                <div className="grow">
                  <div style={{ fontFamily: display.stack, fontSize: 15.5 }}>{d.name}</div>
                  <div style={{ color: pv.muted, fontSize: 12, marginTop: 2 }}>{d.desc}</div>
                  <div style={{ color: pv.accent, fontWeight: 700, fontSize: 14, marginTop: 5 }}>
                    {d.price} so'm
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="brand-preview-btn"
              style={{ background: pv.accent, color: pv.onAccent, fontFamily: body.stack }}
              disabled
            >
              Savatga · 123 000 so'm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
