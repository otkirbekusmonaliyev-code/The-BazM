import Link from 'next/link';
import Header from './Header';
import Faq from './Faq';
import Headline from './Headline';
import LiveDemo from './LiveDemo';
import Calculator from './Calculator';
import { t } from '@/lib/i18n';
import { getPlans, getStats } from '@/lib/api';

// Ikkala tilda ham raqamlar bo'sh joy bilan ajratiladi (299 000),
// shuning uchun bitta lokal yetarli
function formatPrice(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export default async function LandingPage({ lang }) {
  const c = t(lang);
  const [plans, stats] = await Promise.all([getPlans(), getStats()]);
  const home = lang === 'ru' ? '/ru' : '';
  const applyPath = lang === 'ru' ? '/ru/sorov' : '/sorov';

  return (
    <>
      <Header lang={lang} pathname={lang === 'ru' ? '/ru' : '/'} />

      <main>
        {/* ---------- Hero ----------
            Fondagi 3D sahna layout'da, butun sahifa uchun bitta marta
            ulanadi — shuning uchun bu yerda faqat matn qoladi. */}
        <section className="hero">
          <div className="wrap">
            <div className="hero-inner">
              <span className="hero-badge" data-reveal>
                {c.hero.badge}
              </span>
              <Headline text={c.hero.title} as="h1" variant="outline" />
              <p data-reveal data-delay="2">
                {c.hero.subtitle}
              </p>
              <div className="hero-actions" data-reveal data-delay="3">
                <Link href={applyPath} className="btn btn-primary btn-lg">
                  <span>{c.hero.cta}</span>
                </Link>
                <Link href={`${home}/#qanday`} className="btn btn-ghost btn-lg">
                  <span>{c.hero.secondary}</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Pastga tushishga ishora — 3D hikoya scroll bilan ochilishini bildiradi */}
          <div className="scroll-hint" aria-hidden="true">
            <span className="scroll-hint-line" />
          </div>
        </section>

        {/* ---------- Nima uchun kerak ---------- */}
        <section className="section" id="nima-uchun">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.why.title} as="h2" variant="lit" />
            </div>
            <div className="why-grid">
              <div data-reveal>
                <p className="why-lead">{c.hero.subtitle}</p>
                <div className="why-outro glass">{c.why.outro}</div>
              </div>
              <ul className="why-list">
                {c.why.points.map((point, i) => (
                  <li key={point} data-reveal data-delay={i + 1}>
                    <span className="why-check">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Qanday ishlaydi ---------- */}
        <section className="section section-alt" id="qanday">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.how.title} as="h2" variant="lit" />
              <p>{c.how.subtitle}</p>
            </div>
            <div className="steps">
              {c.how.steps.map((step, i) => (
                <article className="step glass" key={step.title} data-reveal data-delay={i + 1} data-tilt>
                  <span className="step-num" aria-hidden="true" />
                  <div className="step-icon" aria-hidden="true">
                    {step.icon}
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Jonli demo ----------
            Mahsulotni tushuntirishning eng tez yo'li — uni bosib ko'rish */}
        <section className="section" id="demo">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.demo.title} as="h2" variant="lit" />
              <p>{c.demo.subtitle}</p>
            </div>
            <LiveDemo c={c.demo} />
            <p className="demo-note" data-reveal>
              {c.demo.note}
            </p>
          </div>
        </section>

        {/* ---------- Foyda kalkulyatori ---------- */}
        <section className="section section-alt" id="hisob">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.calc.title} as="h2" variant="lit" />
              <p>{c.calc.subtitle}</p>
            </div>
            <Calculator c={c.calc} applyPath={applyPath} ctaLabel={c.calc.cta} />
          </div>
        </section>

        {/* ---------- Narxlar ---------- */}
        <section className="section" id="narxlar">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.pricing.title} as="h2" variant="lit" />
              <p>{c.pricing.subtitle}</p>
            </div>
            <div className="plans">
              {plans.map((plan, i) => (
                <article
                  className={`plan glass${plan.popular ? ' popular' : ''}`}
                  key={plan.key}
                  data-reveal
                  data-delay={i + 1}
                  data-tilt
                >
                  {plan.popular && <span className="plan-tag">{c.pricing.popular}</span>}
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <b>{formatPrice(plan.price)}</b>
                    <span>so'm{c.pricing.month}</span>
                  </div>
                  <ul className="plan-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  {/* Tarif oldindan to'ldirilgan holda formaga olib o'tadi */}
                  <Link href={`${applyPath}?plan=${plan.key}`} className="btn btn-ghost btn-block">
                    <span>{c.pricing.cta}</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Ishonch bloki ---------- */}
        <section className="section section-alt trust">
          <div className="wrap" data-reveal>
            <div className="trust-number" data-count={Math.max(stats.restaurantCount, 1)}>
              0
            </div>
            <Headline text={c.trust.title} as="h2" variant="mark" className="trust-title" />
            <p>{c.trust.subtitle}</p>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section" id="savollar">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <Headline text={c.faq.title} as="h2" variant="lit" />
            </div>
            <Faq items={c.faq.items} />
          </div>
        </section>

        {/* ---------- Yakuniy chaqiruv ---------- */}
        <section className="section section-alt cta-final">
          <div className="wrap" data-reveal>
            <p className="cta-final-text serif">{c.why.outro}</p>
            <Link href={applyPath} className="btn btn-primary btn-lg">
              <span>{c.hero.cta}</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer lang={lang} />

      {/* Qidiruv tizimlari uchun tuzilgan ma'lumot (rich snippet) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Bazm',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: c.meta.description,
            offers: plans.map((p) => ({
              '@type': 'Offer',
              name: p.name,
              price: p.price,
              priceCurrency: 'UZS',
            })),
            mainEntity: c.faq.items.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </>
  );
}

export function Footer({ lang }) {
  const c = t(lang);
  const home = lang === 'ru' ? '/ru' : '';
  const applyPath = lang === 'ru' ? '/ru/sorov' : '/sorov';

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ marginBottom: 10 }}>
              Bazm
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: 320 }}>{c.footer.tagline}</p>
          </div>

          <div>
            <h4>{c.footer.product}</h4>
            <ul className="footer-links">
              <li>
                <Link href={`${home}/#qanday`}>{c.nav.how}</Link>
              </li>
              <li>
                <Link href={`${home}/#narxlar`}>{c.nav.pricing}</Link>
              </li>
              <li>
                <Link href={`${home}/#savollar`}>{c.nav.faq}</Link>
              </li>
              <li>
                <Link href={applyPath}>{c.nav.apply}</Link>
              </li>
              {/* So'rov yuborgan odam keyin ham qaytib javobni ko'ra olsin —
                  faqat muvaffaqiyat ekranidagi havola yetarli emas, u
                  sahifani yopgach yo'qoladi */}
              <li>
                <Link href={lang === 'ru' ? '/ru/holat' : '/holat'}>{c.status.title}</Link>
              </li>
              <li style={{ opacity: 0.55 }}>{c.footer.blogSoon}</li>
            </ul>
          </div>

          <div>
            <h4>{c.footer.contact}</h4>
            <ul className="footer-links">
              <li>
                <a href="tel:+998901234567">+998 90 123 45 67</a>
              </li>
              <li>
                <a href="mailto:salom@bazm.uz">salom@bazm.uz</a>
              </li>
              <li>
                <a href="https://t.me/bazm_uz" rel="nofollow noopener" target="_blank">
                  Telegram
                </a>
              </li>
              <li>
                <a href="https://instagram.com/bazm.uz" rel="nofollow noopener" target="_blank">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Bazm</span>
          <span>{c.footer.rights}</span>
        </div>
      </div>
    </footer>
  );
}
