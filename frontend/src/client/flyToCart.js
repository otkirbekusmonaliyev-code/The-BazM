// "SAVATGA UCHIB BORISH" EFFEKTI.
//
// Taom qo'shilganda uning rasmi qatoridan uzilib, savat tugmasiga qarab
// yoy chizib uchadi va shu yerda "so'riladi". Mijoz nima qayerga ketganini
// KO'RADI — bu eng arzon va eng ta'sirli "wow".
//
// Nusxa `document.body` ga qo'yiladi va `position: fixed` bilan harakatlanadi,
// shuning uchun ro'yxatning `overflow` yoki `transform` qatlamlari uni
// kesib qo'ymaydi.

const DURATION = 620;

export function flyToCart(sourceEl, cartEl) {
  if (typeof window === 'undefined' || !sourceEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Element.prototype.animate !== 'function') return;

  // Rasmni topamiz (bo'lmasa — qatorning o'zi)
  const plate = sourceEl.querySelector('.dish-plate') || sourceEl;
  const from = plate.getBoundingClientRect();
  if (from.width === 0) return;

  // Savat tugmasi hali chiqmagan bo'lishi mumkin (birinchi taom) —
  // unda ekranning pastki o'rtasiga uchiramiz
  const to = cartEl
    ? cartEl.getBoundingClientRect()
    : {
        left: window.innerWidth / 2 - 26,
        top: window.innerHeight - 80,
        width: 52,
        height: 52,
      };

  const ghost = plate.cloneNode(true);
  ghost.classList.add('fly-ghost');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '9000',
    pointerEvents: 'none',
    borderRadius: '16px',
  });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  // Yoy: avval bir oz yuqoriga ko'tarilib, keyin savatga tushadi
  const lift = Math.min(120, Math.abs(dy) * 0.35 + 40);

  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.35 - lift}px) scale(0.7) rotate(-8deg)`,
        opacity: 0.95,
        offset: 0.5,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(6deg)`,
        opacity: 0.25,
      },
    ],
    { duration: DURATION, easing: 'cubic-bezier(0.5, 0, 0.35, 1)', fill: 'forwards' }
  );

  const cleanup = () => {
    ghost.remove();
    if (cartEl) {
      // Savat tugmasi "qabul qildim" deb bir seskanadi
      cartEl.classList.remove('caught');
      // Klassni qayta qo'shish uchun brauzerni bir kadr kutdiramiz
      void cartEl.offsetWidth;
      cartEl.classList.add('caught');
      setTimeout(() => cartEl.classList.remove('caught'), 400);
    }
  };

  animation.addEventListener('finish', cleanup);
  // Animatsiya biror sababga ko'ra tugamasa ham nusxa osilib qolmasin
  setTimeout(cleanup, DURATION + 400);
}
