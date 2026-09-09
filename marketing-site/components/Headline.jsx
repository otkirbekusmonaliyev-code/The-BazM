// Sarlavhalardagi KALIT so'zlarni ajratib ko'rsatish.
//
// Tarjima matnida kalit qism ikki kvadrat qavs bilan belgilanadi:
//   "Mijozlaringiz [[stoldan turmasdan]] buyurtma bersin"
//
// Shu qism kattaroq, biroz qiyshaygan va boshqa uslubda chiziladi — natijada
// uzun sarlavhada ko'z darhol asosiy fikrga tushadi. Qolgan matn o'zgarmaydi.
//
// DIQQAT: bu server komponenti — matn HTML'ga to'liq chiqadi, ya'ni Google
// sarlavhani odatdagidek o'qiydi va indekslaydi.

// `variant`:
//   'outline' — ichi bo'sh, oltin kontur (hero uchun)
//   'lit'     — nur sochuvchi oltin (bo'lim sarlavhalari uchun)
//   'mark'    — ostidan oltin chiziq tortiladi
export default function Headline({ text, as: Tag = 'h1', variant = 'outline', className = '' }) {
  const parts = String(text || '').split(/\[\[(.+?)\]\]/g);

  return (
    <Tag className={`headline ${className}`}>
      {parts.map((part, i) =>
        // Toq indekslar — qavs ichidagi kalit qism
        i % 2 === 1 ? (
          <span key={i} className={`key key-${variant}`}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </Tag>
  );
}
