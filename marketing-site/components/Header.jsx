'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { t, altPath } from '@/lib/i18n';
import { waveSwitch } from '@/lib/wave';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

export default function Header({ lang, pathname = '/' }) {
  const c = t(lang);
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [scrolled, setScrolled] = useState(false);
  const busy = useRef(false); // to'lqin ketayotganda ikkinchi bosishni yutamiz

  const home = lang === 'ru' ? '/ru' : '/';
  const applyPath = lang === 'ru' ? '/ru/sorov' : '/sorov';

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bazm.theme');
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch (_) {
      /* localStorage yopiq bo'lsa — qorong'i rejimda qolamiz */
    }
  }, []);

  // Ildiz layout hamma marshrutlar uchun bitta bo'lgani sababli <html lang>
  // doim "uz" bo'lib qolardi. Skrin-riderlar va qidiruv tizimlari aynan shu
  // atributga qaraydi — shuning uchun uni til bilan birga yangilaymiz.
  useEffect(() => {
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
  }, [lang]);

  // Sahifa siljiganda shisha quyuqlashadi va panel bir oz "yig'iladi" —
  // tepada turganda esa deyarli ko'rinmas bo'lib, 3D fonni ochib beradi
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function runWave(originEl, apply, awaitRoute) {
    if (busy.current) return;
    busy.current = true;
    try {
      await waveSwitch(originEl, apply, awaitRoute);
    } finally {
      busy.current = false;
    }
  }

  function toggleTheme(e) {
    const next = theme === 'dark' ? 'light' : 'dark';
    runWave(e.currentTarget, () => {
      setTheme(next);
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('bazm.theme', next);
      } catch (_) {
        /* muhim emas */
      }
    });
  }

  function switchLang(e, target) {
    if (target === lang) return;
    // To'lqin tugagach navigatsiya qilamiz — shuning uchun brauzerning
    // odatiy havola xatti-harakatini to'xtatamiz
    e.preventDefault();
    const href = altPath(pathname, target);
    const origin = e.currentTarget;
    runWave(origin, () => router.push(href), true);
  }

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}`}>
      <div className="wrap header-inner">
        <Link href={home} className="logo">
          Bazm
        </Link>

        <nav className="nav-links">
          <Link href={`${home === '/' ? '' : home}/#qanday`}>{c.nav.how}</Link>
          <Link href={`${home === '/' ? '' : home}/#narxlar`}>{c.nav.pricing}</Link>
          <Link href={`${home === '/' ? '' : home}/#savollar`}>{c.nav.faq}</Link>
        </nav>

        <div className="header-actions">
          <div className="lang-switch">
            {/* Fonda suriladigan belgi — faol til ostida yumshoq siljiydi */}
            <span className={`lang-thumb${lang === 'ru' ? ' ru' : ''}`} aria-hidden="true" />
            <Link
              href={altPath(pathname, 'uz')}
              className={lang === 'uz' ? 'active' : ''}
              onClick={(e) => switchLang(e, 'uz')}
            >
              UZ
            </Link>
            <Link
              href={altPath(pathname, 'ru')}
              className={lang === 'ru' ? 'active' : ''}
              onClick={(e) => switchLang(e, 'ru')}
            >
              RU
            </Link>
          </div>

          <button
            type="button"
            className={`icon-square theme-btn${theme === 'light' ? ' is-light' : ''}`}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
          >
            <span className="theme-icon sun">☀</span>
            <span className="theme-icon moon">☾</span>
          </button>

          <a href={APP_URL} className="btn btn-ghost btn-sm" rel="nofollow">
            {c.nav.login}
          </a>

          <Link href={applyPath} className="btn btn-primary btn-sm">
            {c.nav.apply}
          </Link>
        </div>
      </div>
    </header>
  );
}
