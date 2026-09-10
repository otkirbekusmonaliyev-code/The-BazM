import { Link } from 'react-router-dom';
import { money } from '../lib/format';

// TO'LOV ESLATMASI.
//
// Muddatga besh kun qolganda paydo bo'ladi va HAR KUNI ko'rinib turadi.
// Yopib qo'yish tugmasi ATAYLAB YO'Q: "keyin ko'raman" deb yopilgan
// eslatma to'lovni kechiktirishning eng oson yo'li, va oxirida
// muassasaning zali yopilib qoladi. Banner faqat to'langanda yo'qoladi.
//
// Muddat o'tgach ohang o'zgaradi va necha kun muhlat qolgani aytiladi —
// odam "yana qancha vaqtim bor?" degan savolga javob topishi kerak.

const dateStr = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export default function BillingBanner({ billing, base }) {
  if (!billing) return null;
  const { state, daysLeft, graceDaysLeft, invoice, dueDate } = billing;
  if (state === 'ok') return null;

  const remaining = invoice ? invoice.remaining : billing.monthlyFee;
  const partly = invoice && invoice.paid > 0 && invoice.remaining > 0;

  let tone = 'warn';
  let text;

  if (state === 'suspended') {
    tone = 'stop';
    text = (
      <>
        <b>Xizmat to'xtatildi.</b> To'lov qilinmagani uchun menyu va xodimlar
        paneli yopildi. To'lasangiz darhol qayta ochiladi.
      </>
    );
  } else if (state === 'overdue') {
    tone = 'danger';
    text = (
      <>
        <b>To'lov muddati o'tdi</b> ({dateStr(dueDate)}).{' '}
        {graceDaysLeft > 0 ? (
          <>
            Yana <b>{graceDaysLeft} kun</b> ishlaydi, keyin xizmat to'xtaydi.
          </>
        ) : (
          <>Xizmat bugun-erta to'xtaydi.</>
        )}
      </>
    );
  } else {
    text = (
      <>
        Oylik to'lovga <b>{daysLeft === 0 ? 'bugun' : `${daysLeft} kun`}</b> qoldi
        {daysLeft === 0 ? '' : ` (${dateStr(dueDate)})`}.
      </>
    );
  }

  return (
    <div className={`bill-banner ${tone}`}>
      <span className="bill-banner-icon" aria-hidden="true">
        {state === 'suspended' ? '⛔' : state === 'overdue' ? '⚠️' : '🗓'}
      </span>
      <div className="grow">
        <div>{text}</div>
        <div className="bill-banner-sum">
          To'lanishi kerak: <b>{money(remaining)}</b>
          {partly && (
            <span className="bill-banner-part">
              {' '}· {money(invoice.paid)} tushdi, qolgani {money(invoice.remaining)}
            </span>
          )}
        </div>
      </div>
      <Link to={`${base}/billing`} className="btn btn-primary btn-sm">
        To'lash
      </Link>
    </div>
  );
}
