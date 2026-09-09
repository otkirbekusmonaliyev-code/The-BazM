const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/ru`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/sorov`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/ru/sorov`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
