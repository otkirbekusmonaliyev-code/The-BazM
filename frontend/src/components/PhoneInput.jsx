// O'zbekiston telefon raqami uchun maydon.
//
// `+998` DOIM maydonning ichida, o'zgartirib bo'lmaydigan qism sifatida
// turadi — foydalanuvchi faqat 9 ta raqamni kiritadi. Bu ikki muammoni
// yechadi: birinchidan, kimdir "+998" ni tushirib qoldirib login qila
// olmay qolmaydi; ikkinchidan, bazada raqamlar bir xil ko'rinishda saqlanadi.
//
// Tashqariga har doim to'liq raqam beriladi: "+998901234567"

import { forwardRef } from 'react';

const PREFIX = '+998';

// To'liq raqamdan faqat mahalliy 9 ta raqamni ajratib olish
export function toLocalDigits(full) {
  const digits = String(full || '').replace(/\D/g, '');
  return (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
}

// Mahalliy raqamdan to'liq xalqaro ko'rinish
export function toFullPhone(local) {
  const digits = String(local || '').replace(/\D/g, '').slice(0, 9);
  return digits ? PREFIX + digits : '';
}

export function isValidPhone(full) {
  return toLocalDigits(full).length === 9;
}

// "901234567" -> "90 123 45 67" (o'qishga qulay bo'lishi uchun)
function pretty(local) {
  const d = local;
  let out = d.slice(0, 2);
  if (d.length > 2) out += ` ${d.slice(2, 5)}`;
  if (d.length > 5) out += ` ${d.slice(5, 7)}`;
  if (d.length > 7) out += ` ${d.slice(7, 9)}`;
  return out;
}

// `forwardRef` — kirish sahifasi ish joyi tanlangach fokusni shu maydonga
// ko'chiradi, buning uchun ichidagi <input>ga murojaat qila olishi kerak
const PhoneInput = forwardRef(function PhoneInput(
  {
    value,
    onChange,
    id,
    autoComplete = 'tel',
    required = false,
    autoFocus = false,
    disabled = false,
  },
  ref
) {
  const local = toLocalDigits(value);

  return (
    <div className="phone-field">
      <span className="phone-prefix" aria-hidden="true">
        {PREFIX}
      </span>
      <input
        ref={ref}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder="90 123 45 67"
        value={pretty(local)}
        onChange={(e) => onChange(toFullPhone(e.target.value))}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Telefon raqami"
      />
    </div>
  );
});

export default PhoneInput;
