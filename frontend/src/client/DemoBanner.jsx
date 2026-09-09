// NAMUNA BELGISI.
//
// Odam bu ilovani ko'rib turib, uni haqiqiy restoran menyusi deb o'ylab
// qolmasligi kerak — aks holda "buyurtma berdim, taom kelmadi" degan
// tushunmovchilik chiqadi. Shu sababli belgi:
//
//   - har doim ko'rinadi (ekran bilan birga aylanmaydi),
//   - lekin bosilganda kichrayadi, chunki menyuni to'sib turishi ham
//     mumkin emas — odam aynan menyuni ko'rgani kelgan.

import { useState } from 'react';

export default function DemoBanner() {
  const [small, setSmall] = useState(false);

  return (
    <button
      type="button"
      className={`c-demo-badge${small ? ' small' : ''}`}
      onClick={() => setSmall((v) => !v)}
      aria-label="Bu namuna menyu"
    >
      <span className="c-demo-dot" aria-hidden="true" />
      {small ? (
        <span className="c-demo-short">DEMO</span>
      ) : (
        <span className="c-demo-full">
          <b>Namuna menyu</b>
          <span>Haqiqiy buyurtma ketmaydi — bu shunchaki ko'rgazma</span>
        </span>
      )}
    </button>
  );
}
