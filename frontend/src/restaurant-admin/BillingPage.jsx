import { money } from '../lib/format';

// TO'LOV SAHIFASI.
//
// Bu sahifa xizmat TO'XTATILGANDA HAM ochiq bo'lishi shart — aks holda
// qarzi bor muassasa to'lash uchun ham kira olmasdi: xizmat yopiq,
// chunki to'lanmagan; to'lab bo'lmaydi, chunki xizmat yopiq.
// (Server tomonida shu yo'l `tenantResolver` da alohida o'tkaziladi.)
//
// QISMAN TO'LOV ochiq ko'rsatiladi: odam "100 000 yubordim, qayerda u?"
// deb qolmasligi kerak — tushgan pul ham, qolgan qarz ham ro'yxatda turadi.

const dateStr = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const METHODS = {
  manual: 'Qo‘lda tasdiqlangan',
  credit: 'Oldingi ortiqcha to‘lov',
  payme: 'Payme',
  click: 'Click',
};

export default function BillingPage({ billing }) {
  if (!billing) {
    return (
      <div className="dl-panel">
        <h2 className="dl-panel-title">To'lov</h2>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const { state, invoice, plan, monthlyFee, dueDate, daysLeft, graceDaysLeft, creditBalance } =
    billing;
  const remaining = invoice ? invoice.remaining : monthlyFee;
  const paid = invoice ? invoice.paid : 0;
  const total = invoice ? invoice.amount : monthlyFee;
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="dl-panel bill-page">
      <h2 className="dl-panel-title">To'lov</h2>

      {state === 'suspended' && (
        <div className="bill-alert stop">
          <b>Xizmat to'xtatildi.</b> Mijozlar menyusi va xodimlar paneli yopiq.
          To'lov to'liq tushishi bilan darhol qayta ochiladi.
        </div>
      )}
      {state === 'overdue' && (
        <div className="bill-alert danger">
          <b>Muddat o'tdi.</b>{' '}
          {graceDaysLeft > 0
            ? `Yana ${graceDaysLeft} kun ishlaydi, keyin xizmat to'xtaydi.`
            : 'Xizmat bugun-erta to\'xtaydi.'}
        </div>
      )}

      {/* ---- Hisob ---- */}
      <div className="bill-card">
        <div className="bill-row">
          <span>Tarif</span>
          <b style={{ textTransform: 'capitalize' }}>{plan}</b>
        </div>
        <div className="bill-row">
          <span>Oylik to'lov</span>
          <b>{money(monthlyFee)}</b>
        </div>
        <div className="bill-row">
          <span>To'lov muddati</span>
          <b>
            {dateStr(dueDate)}
            {daysLeft !== null && daysLeft >= 0 && (
              <span className="bill-muted"> · {daysLeft === 0 ? 'bugun' : `${daysLeft} kun qoldi`}</span>
            )}
          </b>
        </div>
        {invoice && (
          <div className="bill-row">
            <span>Hisob raqami</span>
            <b className="mono">{invoice.number}</b>
          </div>
        )}
        {creditBalance > 0 && (
          <div className="bill-row">
            <span>Oldingi ortiqcha</span>
            <b>{money(creditBalance)}</b>
          </div>
        )}
      </div>

      {/* ---- Qancha to'langan ---- */}
      {invoice && (
        <div className="bill-progress-block">
          <div className="bill-progress">
            <div className="bill-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="bill-progress-legend">
            <span>
              To'landi: <b>{money(paid)}</b>
            </span>
            <span className={remaining > 0 ? 'owed' : ''}>
              {remaining > 0 ? (
                <>
                  Qoldi: <b>{money(remaining)}</b>
                </>
              ) : (
                <b>To'liq to'langan ✓</b>
              )}
            </span>
          </div>
          {paid > 0 && remaining > 0 && (
            <p className="bill-note">
              Qisman to'lov hisobni yopmaydi — xizmat qolgan{' '}
              <b>{money(remaining)}</b> tushgach yana bir oyga ochiladi. Tushgan pul
              yo'qolmaydi.
            </p>
          )}
        </div>
      )}

      {/* ---- Qanday to'lash ---- */}
      <div className="bill-how">
        <h3>Qanday to'lash</h3>
        <p>
          Hozircha to'lov <b>karta orqali o'tkazma</b> bilan qabul qilinadi. Pul
          o'tkazgach biz uni tasdiqlaymiz va xizmat darhol ochiladi — odatda bu bir
          necha daqiqa oladi.
        </p>
        <div className="bill-contact">
          <a href="tel:+998901234567" className="btn btn-primary btn-sm">
            📞 +998 90 123 45 67
          </a>
          <a href="https://t.me/bazm_support" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            Telegram orqali yozish
          </a>
        </div>
        <p className="bill-soon">Tez orada: Payme va Click orqali to'g'ridan-to'g'ri to'lov.</p>
      </div>

      {/* ---- Tushgan to'lovlar ---- */}
      {invoice && invoice.payments.length > 0 && (
        <div className="bill-history">
          <h3>Shu hisobga tushgan to'lovlar</h3>
          {invoice.payments.map((p) => (
            <div className="bill-payment" key={p.id}>
              <b>{money(p.amount)}</b>
              <span>{METHODS[p.method] || p.method}</span>
              <span className="bill-muted">{dateStr(p.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
