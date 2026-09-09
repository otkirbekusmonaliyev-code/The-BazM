import LandingPage from '@/components/LandingPage';
import { t } from '@/lib/i18n';

const c = t('ru');

export const metadata = {
  title: c.meta.title,
  description: c.meta.description,
  keywords: c.meta.keywords,
  alternates: { canonical: '/ru', languages: { uz: '/', ru: '/ru' } },
  openGraph: {
    title: c.meta.title,
    description: c.meta.description,
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function Page() {
  return <LandingPage lang="ru" />;
}
