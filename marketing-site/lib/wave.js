'use client';

// TIL VA MAVZU ALMASHUVIDAGI "TO'LQIN"
//
// Tugma bosilganda undan to'lqin chiqadi va butun sayt bo'ylab tarqaladi.
// To'lqin qayerga yetib borsa, o'sha joy yangi holatga (ruscha matn yoki
// kunduzgi rang) o'tadi — to'lqin fronti oltin nur bo'lib ko'rinadi, uning
// ortidagi qism xiralikdan aniqlikka chiqadi.
//
// Ikki yo'l bilan ishlaydi:
//
//   1) View Transitions API (Chrome, Edge, Safari 18+) — brauzer eski va
//      yangi holatning suratini oladi, biz esa YANGI suratni aylana shaklida
//      ochib boramiz. Bu haqiqiy "to'lqin ortidan yangilanish": aylana ichi
//      allaqachon yangi, tashqarisi hali eski. To'lqin fronti `drop-shadow`
//      bilan chiziladi — u kesilgan shaklning chekkasini aniq kuzatadi.
//
//      DIQQAT: o'tish davomida brauzer HAQIQIY DOM'ni chizmaydi, faqat
//      suratlarni ko'rsatadi. Shuning uchun bu yo'lda oddiy <div> halqa
//      ko'rinmaydi — to'lqin aynan surat filtri orqali beriladi.
//
//   2) Boshqa brauzerlarda (Firefox) — shisha parda o'sha aylana bo'ylab
//      yoyiladi, tagida almashuv bo'ladi va parda tarqab ketadi. Bu yerda
//      DOM muzlamaydi, shuning uchun ko'rinadigan halqa ham chiziladi.

const SWEEP = 780; // to'lqinning ekranni kesib o'tish vaqti, ms
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

let waving = false;

// To'lqin ketayotganini bilish kerak: yangi sahifa o'zining kirish
// animatsiyasini qayta o'ynatmasin, aks holda ikki marta "suzib" chiqadi
export function isWaving() {
  return waving;
}

// Marshrut almashuvini kutish. `PageTransition` yangi sahifa chizilgach
// `notifyRouteSettled()` chaqiradi — to'lqin shu paytgacha kutib turadi.
let routeWaiters = [];

export function notifyRouteSettled() {
  if (routeWaiters.length === 0) return;
  const waiting = routeWaiters;
  routeWaiters = [];
  waiting.forEach((resolve) => resolve());
}

function waitForRoute(timeout = 1200) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let notified = false;
    const onSettled = () => {
      if (notified) return;
      notified = true;
      // Bir kadr kutamiz — yangi matn chizilib bo'lsin, keyin to'lqin ketsin.
      // Lekin `requestAnimationFrame` fonga tushgan oynada UMUMAN ishlamaydi,
      // shuning uchun uni ham vaqt chegarasi bilan qo'llab-quvvatlaymiz —
      // aks holda almashuv shu yerda abadiy kutib qolardi.
      requestAnimationFrame(() => requestAnimationFrame(done));
      setTimeout(done, 150);
    };

    routeWaiters.push(onSettled);
    // Tarmoq sekin bo'lsa ham sayt muzlab qolmasin
    setTimeout(done, timeout);
  });
}

function originOf(el) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  // Oyna o'lchamini ikki manbadan olamiz va kattasini tanlaymiz: ayrim
  // muhitlarda `innerWidth` noto'g'ri (yoki 0) bo'lib chiqadi va to'lqin
  // ekranning yarmida to'xtab qolardi
  const w = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);

  // Eng uzoq burchakgacha bo'lgan masofa — to'lqin shu radiusda to'xtaydi,
  // ya'ni aynan butun sahifani qamrab oladi
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  return { x, y, radius: radius * 1.02 };
}

// Animatsiyani KUTAMIZ, lekin cheksiz emas.
//
// Brauzer fonga tushsa (boshqa ilovaga o'tilsa) animatsiya vaqti to'xtaydi
// va `finished` hech qachon bajarilmasligi mumkin. Shunda til yoki mavzu
// almashmay, sayt "osilib" qolardi. Shuning uchun har doim vaqt chegarasi
// bo'ladi: animatsiya tugasa — darhol, tugamasa — chegara bo'yicha davom.
function settle(animation, limit) {
  return Promise.race([
    animation.finished.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, limit)),
  ]);
}

// Ko'rinadigan to'lqin fronti: ikkita halqa, ikkinchisi bir oz kechikib
// chiqadi — shundan "to'lqin" hissi paydo bo'ladi.
// Faqat zaxira yo'lda ishlatiladi (View Transitions paytida DOM muzlaydi).
function drawRipple({ x, y, radius }) {
  const layer = document.createElement('div');
  layer.className = 'wave-rings';
  document.body.appendChild(layer);

  [0, 110].forEach((delay, i) => {
    const ring = document.createElement('span');
    ring.className = 'wave-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    layer.appendChild(ring);
    ring.animate(
      [
        { width: '0px', height: '0px', opacity: i === 0 ? 0.9 : 0.45 },
        { width: `${radius * 2}px`, height: `${radius * 2}px`, opacity: 0 },
      ],
      { duration: SWEEP + 220, delay, easing: EASE, fill: 'forwards' }
    );
  });

  setTimeout(() => layer.remove(), SWEEP + 500);
}

// Zaxira yo'l: shisha parda aylana bo'ylab yoyiladi, tagida almashuv ketadi
async function veilSweep({ x, y, radius }, run) {
  const veil = document.createElement('div');
  veil.className = 'wave-veil';
  document.body.appendChild(veil);

  const grow = veil.animate(
    [
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
    ],
    { duration: SWEEP * 0.6, easing: EASE, fill: 'forwards' }
  );

  await settle(grow, SWEEP * 0.6 + 200);

  await run();

  const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: SWEEP * 0.55,
    easing: 'ease-out',
    fill: 'forwards',
  });
  await settle(fade, SWEEP * 0.55 + 200);
  veil.remove();
}

/**
 * To'lqin bilan almashtirish.
 *
 * @param {HTMLElement} originEl  To'lqin chiqadigan tugma
 * @param {() => void | Promise<void>} apply  Almashuvning o'zi
 * @param {boolean} [awaitRoute]  Marshrut o'zgarsa — yangi sahifani kutamiz
 */
export async function waveSwitch(originEl, apply, awaitRoute = false) {
  if (typeof window === 'undefined' || !originEl) {
    await apply();
    return;
  }

  const origin = originOf(originEl);

  waving = true;
  const run = async () => {
    await apply();
    if (awaitRoute) await waitForRoute();
  };

  try {
    // Harakat kamaytirilgan bo'lsa — hech qanday effektsiz, darhol
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await run();
      return;
    }

    const root = document.documentElement;

    if (typeof document.startViewTransition !== 'function') {
      drawRipple(origin);
      await veilSweep(origin, run);
      return;
    }

    root.classList.add('wave-vt');

    // Almashuv HAR QANDAY holatda bir marta bajarilishi kerak — brauzer
    // o'tishni boshlamasa ham til yoki mavzu o'zgarmay qolmasin
    let applyPromise = null;
    const applyOnce = () => {
      if (!applyPromise) applyPromise = run();
      return applyPromise;
    };

    const transition = document.startViewTransition(applyOnce);

    // XAVFSIZLIK TO'RI. `startViewTransition` faqat sahifa chizilayotgan
    // bo'lsagina ishlaydi: fonga tushgan yoki chizilmayotgan oynada uning
    // qayta chaqiruvi umuman ishga tushmaydi va sahifa muzlab qolardi.
    // Belgilangan vaqtda boshlanmasa — o'tishni bekor qilamiz va almashuvni
    // oddiy yo'l bilan o'tkazamiz.
    const started = await Promise.race([
      transition.ready.then(
        () => true,
        () => false
      ),
      new Promise((resolve) => setTimeout(() => resolve(null), 450)),
    ]);

    if (started === null) {
      try {
        transition.skipTransition();
      } catch (_) {
        /* brauzer bekor qilishni qo'llab-quvvatlamasa ham davom etamiz */
      }
      await applyOnce();
      root.classList.remove('wave-vt');
      return;
    }

    try {
      // Yangi holat aylana bo'ylab ochiladi. `drop-shadow` kesilgan
      // shaklning chekkasini kuzatadi — ya'ni aylana o'sib borgan sari
      // oltin nur ham u bilan birga tarqaladi. `blur` esa to'lqin
      // ortidagi qismni xiralikdan aniqlikka olib chiqadi.
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${origin.radius}px at ${origin.x}px ${origin.y}px)`,
          ],
          filter: [
            'blur(16px) drop-shadow(0 0 36px rgba(198, 160, 92, 0.95))',
            'blur(6px) drop-shadow(0 0 30px rgba(198, 160, 92, 0.7))',
            'blur(0px) drop-shadow(0 0 24px rgba(198, 160, 92, 0))',
          ],
        },
        {
          duration: SWEEP,
          easing: EASE,
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } catch (_) {
      /* brauzer o'tishni bekor qilgan bo'lsa — sahifa baribir yangilangan */
    }

    await Promise.race([
      transition.finished.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, SWEEP + 400)),
    ]);
    root.classList.remove('wave-vt');
  } finally {
    waving = false;
  }
}
