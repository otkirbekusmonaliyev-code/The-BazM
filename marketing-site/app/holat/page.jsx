import Header from '@/components/Header';
import StatusCheck from '@/components/StatusCheck';
import { Footer } from '@/components/LandingPage';
import { t } from '@/lib/i18n';

const c = t('uz');

export const metadata = {
  title: `${c.status.title} — Bazm`,
  description: c.status.subtitle,
  alternates: { canonical: '/holat', languages: { uz: '/holat', ru: '/ru/holat' } },
  // Bu sahifa shaxsiy javob uchun — qidiruv tizimlariga kerak emas
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <Header lang="uz" pathname="/holat" />
      <main className="form-page">
        <div className="wrap" data-reveal>
          <StatusCheck lang="uz" />
        </div>
      </main>
      <Footer lang="uz" />
    </>
  );
}
