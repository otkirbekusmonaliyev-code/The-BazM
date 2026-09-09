// TAOM RASMI.
//
// Rasm bo'lsa — o'shani ko'rsatamiz. Bo'lmasa "rasm yo'q" degan bo'sh
// kulrang to'rtburchak emas, ATAYLAB CHIZILGAN likobcha ko'rsatiladi:
// taom nomining bosh harfi, oltin halqa va taomga qarab tanlangan ohang.
//
// Sababi oddiy: menyuning yarmida rasm bo'lmasligi normal holat, lekin
// shu sababli sahifa "buzuq" ko'rinmasligi kerak. Har bir taom uchun ohang
// nomidan hisoblanadi — ya'ni bir xil taom har doim bir xil chiqadi.

const TONES = [
  { from: '#c6a05c', to: '#8a6420' }, // oltin
  { from: '#a85a3a', to: '#6d3520' }, // g'isht
  { from: '#6fbf73', to: '#2f6b3a' }, // zaytun
  { from: '#c98a4b', to: '#8a5320' }, // qovurilgan
  { from: '#b56576', to: '#6d3547' }, // olcha
  { from: '#7a9cc6', to: '#3b5a80' }, // muzli
];

function toneOf(text) {
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) sum += text.charCodeAt(i);
  return TONES[sum % TONES.length];
}

export default function DishPlate({ item, size = 'md', className = '' }) {
  const cls = `dish-plate dish-plate-${size} ${className}`.trim();

  if (item.imageUrl) {
    return (
      <div className={cls}>
        <img src={item.imageUrl} alt={item.name} loading="lazy" />
        <span className="dish-plate-sheen" aria-hidden="true" />
      </div>
    );
  }

  const tone = toneOf(item.name || '');
  const letter = (item.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className={`${cls} is-empty`}
      style={{ '--tone-from': tone.from, '--tone-to': tone.to }}
      aria-hidden="true"
    >
      <span className="dish-plate-ring" />
      <span className="dish-plate-letter">{letter}</span>
      <span className="dish-plate-sheen" />
    </div>
  );
}
