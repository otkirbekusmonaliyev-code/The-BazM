import LandingPage from '@/components/LandingPage';
import { t } from '@/lib/i18n';

const c = t('uz');

export const metadata = {
  title: c.meta.title,
  description: c.meta.description,
  keywords: c.meta.keywords,
  alternates: { canonical: '/', languages: { uz: '/', ru: '/ru' } },
  openGraph: {
    title: c.meta.title,
    description: c.meta.description,
    locale: 'uz_UZ',
    type: 'website',
  },
};

export default function Page() {
  return <LandingPage lang="uz" />;
}
