'use client';

import { useState } from 'react';

// Savol-javob akkordeoni. Barcha matn HTML'da SERVER tomonidan
// chiqariladi (faqat balandligi CSS bilan yopiladi) — shu bilan
// Google javoblarni ham to'liq indekslaydi.

export default function Faq({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <div className={`faq-item${open === i ? ' open' : ''}`} key={item.q}>
          <button
            type="button"
            className="faq-q"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
          >
            {item.q}
            <span className="faq-sign" aria-hidden="true">
              +
            </span>
          </button>
          <div className="faq-a">{item.a}</div>
        </div>
      ))}
    </div>
  );
}
