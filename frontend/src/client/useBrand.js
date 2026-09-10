// MUASSASA BRENDINI QO'LLASH.
//
// Dizayn butunlay CSS o'zgaruvchilariga qurilgan, shuning uchun brendni
// qo'llash uchun bir nechta o'zgaruvchini almashtirish kifoya — alohida
// CSS yozish kerak emas.
//
// DIQQAT — QAYERGA YOZILADI. O'zgaruvchilarni `:root` ga yozish
// ISHLAMAYDI: `client.css` da ular aynan `.app-client` selektorida e'lon
// qilingan, ya'ni `:root` dagi qiymatdan ustun turadi. Birinchi urinishda
// shu sababli hech narsa o'zgarmadi — qiymat to'g'ri yozilardi, lekin
// yaqinroq e'lon uni bosib ketardi. Endi qiymat ilovaning O'Z elementiga
// yoziladi.
//
// `--gold` va `--amber` ikkalasi ham almashtiriladi: ular tarixan bir xil
// rangni bildiradi va turli ekranlarda ikkalasi ham ishlatiladi. Bittasi
// qolib ketsa, ilovaning yarmi eski rangda qolardi.
//
// Rang va fon KUNDUZGI/TUNGI rejim uchun alohida keladi: bitta qiymat
// ikkala fonda ham yaxshi o'qilmaydi. Rejim almashsa — brend ham almashadi.
//
// Hamma qiymat serverdan TEKSHIRILGAN holda keladi (`utils/brand.js`
// ro'yxatlaridan), ya'ni bu yerga ixtiyoriy qiymat hech qachon tushmaydi.

import { useEffect, useRef } from 'react';
import { useTheme } from '../lib/theme';

// Almashtiriladigan o'zgaruvchilar. Tozalashda ham aynan shular olinadi —
// ro'yxat bitta joyda tursin.
const VARS = [
  '--gold',
  '--amber',
  '--bg',
  '--card',
  '--card-2',
  '--panel',
  '--panel-2',
  '--font-display',
  '--font-body',
];

export default function useBrand(brand) {
  const { theme } = useTheme();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const clear = () => VARS.forEach((v) => el.style.removeProperty(v));
    if (!brand) {
      clear();
      return undefined;
    }

    const light = theme === 'light';
    const set = (name, value) => {
      if (value) el.style.setProperty(name, value);
    };

    // 1) Urg'u rangi
    if (brand.color) {
      const accent = light ? brand.color.light : brand.color.dark;
      set('--gold', accent);
      set('--amber', accent);
    }

    // 2) Fon ohangi. Yorqinlik o'zgarmaydi — faqat rang tusi, shuning
    //    uchun matn kontrasti hech qachon buzilmaydi.
    if (brand.surface) {
      const s = light ? brand.surface.light : brand.surface.dark;
      if (s) {
        set('--bg', s.bg);
        set('--card', s.card);
        set('--card-2', s.card2);
        // Panel ranglari kartochka bilan bir xil yuradi
        set('--panel', s.card);
        set('--panel-2', s.card2);
      }
    }

    // 3) Shriftlar — rejimga bog'liq emas
    if (brand.displayFont) set('--font-display', brand.displayFont.stack);
    if (brand.bodyFont) set('--font-body', brand.bodyFont.stack);

    return clear;
  }, [brand, theme]);

  return ref;
}
