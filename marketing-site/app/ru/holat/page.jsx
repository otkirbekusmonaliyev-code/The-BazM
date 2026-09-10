import Header from '@/components/Header';
import StatusCheck from '@/components/StatusCheck';
import { Footer } from '@/components/LandingPage';
import { t } from '@/lib/i18n';

const c = t('ru');

export const metadata = {
  title: `${c.status.title} — Bazm`,
  description: c.status.subtitle,
  alternates: { canonical: '/ru/holat', languages: { uz: '/holat', ru: '/ru/holat' } },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <Header lang="ru" pathname="/ru/holat" />
      <main className="form-page">
        <div className="wrap" data-reveal>
          <StatusCheck lang="ru" />
        </div>
      </main>
      <Footer lang="ru" />
    </>
  );
}
