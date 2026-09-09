import { Suspense } from 'react';
import Header from '@/components/Header';
import ApplyForm from '@/components/ApplyForm';
import { Footer } from '@/components/LandingPage';
import { getRegions } from '@/lib/api';
import { t } from '@/lib/i18n';

const c = t('uz');

export const metadata = {
  title: `${c.form.title} — Bazm`,
  description: c.form.subtitle,
  alternates: { canonical: '/sorov', languages: { uz: '/sorov', ru: '/ru/sorov' } },
};

export default async function Page() {
  const regions = await getRegions();

  return (
    <>
      <Header lang="uz" pathname="/sorov" />
      <main className="form-page">
        <div className="wrap" data-reveal>
          <Suspense fallback={null}>
            <ApplyForm lang="uz" regions={regions} />
          </Suspense>
        </div>
      </main>
      <Footer lang="uz" />
    </>
  );
}
