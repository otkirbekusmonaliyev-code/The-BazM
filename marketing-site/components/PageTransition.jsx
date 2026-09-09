'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isWaving, notifyRouteSettled } from '@/lib/wave';

// Sahifalar orasidagi silliq o'tish.
//
// Marshrut o'zgarganda `key` almashadi — React eski daraxtni tashlab, yangisini
// quradi va CSS animatsiyasi qaytadan ishga tushadi. Natijada `/` dan `/sorov`ga
// o'tish "sakrash" emas, yumshoq suzib o'tish bo'lib ko'rinadi.
//
// Bu komponent ildiz layout'da turadi va hech qachon uzilmaydi — shuning uchun
// aynan u til to'lqiniga "yangi sahifa tayyor" degan xabarni yetkazadi.

export default function PageTransition({ children }) {
  const pathname = usePathname();

  // Til to'lqini bilan kelgan sahifa o'zining kirish animatsiyasini
  // o'ynatmasligi kerak — aks holda avval to'lqin, keyin yana bir bor
  // "suzib chiqish" bo'lib, ikki karra harakat ko'rinardi.
  //
  // Qaror har bir manzil uchun BIR MARTA qabul qilinadi va eslab qolinadi:
  // keyingi render'da klass o'zgarib, animatsiya qaytadan boshlanib
  // ketmasligi kerak.
  const decided = useRef({});
  if (!(pathname in decided.current)) decided.current[pathname] = isWaving();

  useEffect(() => {
    notifyRouteSettled();
  }, [pathname]);

  return (
    <div key={pathname} className={`page-enter${decided.current[pathname] ? ' no-enter' : ''}`}>
      {children}
    </div>
  );
}
