'use client';

import { useEffect } from 'react';

// Saytdagi barcha "jonli" effektlar bitta joyda. Hammasi HODISA
// DELEGATSIYASI yoki kuzatuvchilar orqali ishlaydi — ya'ni markup'ga
// tegmasdan, kelajakda qo'shiladigan elementlarga ham o'z-o'zidan tegishli.
//
//   1) Tugmalar — magnit, yorug'lik, bosilganda to'lqin
//   2) Kursor nuri — sichqoncha ortidan yuradigan yumshoq oltin shu'la
//   3) Kartochkalar egilishi — [data-tilt] elementlar kursorga qarab 3D buriladi
//   4) Ochilish — [data-reveal] elementlar ko'rinishga kirganda suzib chiqadi
//   5) Raqam sanog'i — [data-count] noldan yakuniy songacha aylanadi
//   6) Scroll indikatori — tepadagi ingichka oltin chiziq
//   7) Kirish pardasi — birinchi ochilishda bir marta

const MAGNET = 6; // px
const TILT = 7; // daraja

export default function SiteFx() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches; // sensorli ekran
    const cleanups = [];

    // ---------- 1) Tugmalar ----------
    const onPointerMove = (e) => {
      const btn = e.target.closest && e.target.closest('.btn');
      if (btn) {
        const r = btn.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        btn.style.setProperty('--mx', `${px * 100}%`);
        btn.style.setProperty('--my', `${py * 100}%`);
        if (!reduceMotion && !coarse) {
          btn.style.setProperty('--tx', `${(px - 0.5) * MAGNET * 2}px`);
          btn.style.setProperty('--ty', `${(py - 0.5) * MAGNET}px`);
        }
      }

      // ---------- 3) Kartochkalar egilishi ----------
      const tilt = e.target.closest && e.target.closest('[data-tilt]');
      if (tilt && !reduceMotion && !coarse) {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        tilt.style.setProperty('--rx', `${(0.5 - py) * TILT}deg`);
        tilt.style.setProperty('--ry', `${(px - 0.5) * TILT}deg`);
        tilt.style.setProperty('--gx', `${px * 100}%`);
        tilt.style.setProperty('--gy', `${py * 100}%`);
        tilt.classList.add('tilting');
      }
    };

    const onPointerOut = (e) => {
      const reset = (el, props) => {
        if (!el) return;
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;
        props.forEach((k) => el.style.setProperty(k, '0deg'));
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
        el.classList.remove('tilting');
      };
      reset(e.target.closest && e.target.closest('.btn'), []);
      reset(e.target.closest && e.target.closest('[data-tilt]'), ['--rx', '--ry']);
    };

    const onPointerDown = (e) => {
      const btn = e.target.closest && e.target.closest('.btn');
      if (!btn || reduceMotion) return;
      const r = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      const size = Math.max(r.width, r.height) * 2.2;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - r.left - size / 2}px`;
      ripple.style.top = `${e.clientY - r.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 620);
    };

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    cleanups.push(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', onPointerDown);
    });

    // ---------- 2) Kursor nuri ----------
    if (!reduceMotion && !coarse) {
      const glow = document.createElement('div');
      glow.className = 'cursor-glow';
      document.body.appendChild(glow);

      const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2, tx: 0, ty: 0 };
      pos.tx = pos.x;
      pos.ty = pos.y;

      const track = (e) => {
        pos.tx = e.clientX;
        pos.ty = e.clientY;
      };
      window.addEventListener('pointermove', track, { passive: true });

      let raf = 0;
      const follow = () => {
        raf = requestAnimationFrame(follow);
        // Ortda qolib yuradi — shundan "og'ir" va yumshoq his paydo bo'ladi
        pos.x += (pos.tx - pos.x) * 0.12;
        pos.y += (pos.ty - pos.y) * 0.12;
        glow.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      };
      follow();

      cleanups.push(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', track);
        glow.remove();
      });
    }

    // ---------- 6) Scroll indikatori ----------
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);

    let progressRaf = 0;
    const updateProgress = () => {
      progressRaf = requestAnimationFrame(updateProgress);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };
    updateProgress();
    cleanups.push(() => {
      cancelAnimationFrame(progressRaf);
      progress.remove();
    });

    // ---------- 5) Raqam sanog'i ----------
    const runCounter = (el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      if (reduceMotion) {
        el.textContent = String(target);
        return;
      }
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutExpo — tez boshlanib, oxirida sekinlashadi
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // ---------- 4) Ochilish ----------
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('revealed');
          if (entry.target.dataset.count) runCounter(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.06 }
    );

    const observeAll = () => {
      document.querySelectorAll('[data-reveal]:not(.revealed), [data-count]:not(.revealed)').forEach((el) => {
        if (reduceMotion) {
          el.classList.add('revealed');
          if (el.dataset.count) el.textContent = el.dataset.count;
        } else {
          observer.observe(el);
        }
      });
    };
    observeAll();

    const mutation = new MutationObserver(observeAll);
    mutation.observe(document.body, { childList: true, subtree: true });
    cleanups.push(() => {
      observer.disconnect();
      mutation.disconnect();
    });

    // ---------- 7) Kirish pardasi ----------
    // Faqat birinchi ochilishda: sessiya davomida qayta ko'rsatilmaydi
    try {
      if (!reduceMotion && !sessionStorage.getItem('bazm.entered')) {
        sessionStorage.setItem('bazm.entered', '1');
        const curtain = document.createElement('div');
        curtain.className = 'curtain';
        curtain.innerHTML = '<span class="curtain-mark">Bazm</span>';
        document.body.appendChild(curtain);
        requestAnimationFrame(() => curtain.classList.add('lifting'));
        setTimeout(() => curtain.remove(), 1700);
      }
    } catch (_) {
      /* sessionStorage yopiq bo'lsa — parda shunchaki ko'rsatilmaydi */
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
