import './globals.css';
import './effects.css';
import './wave.css';
import './site.css';
import SceneCanvas from '@/components/SceneCanvas';
import SiteFx from '@/components/SiteFx';
import PageTransition from '@/components/PageTransition';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),
  title: 'Bazm — restoran va kafelar uchun QR menyu va buyurtma tizimi',
  description:
    'Mijozlaringiz stoldan turmasdan QR kod orqali buyurtma bersin. Oshxona buyurtmani darhol ko\'radi, ofitsiant qayerga borishini biladi.',
  icons: { icon: '/favicon.svg' },
};

export const viewport = {
  themeColor: '#12160f',
  width: 'device-width',
  initialScale: 1,
};

// Tungi/kunduzgi rejim tanlovi localStorage'da saqlanadi.
// Sahifa "miltillamasligi" uchun uni React yuklanishidan OLDIN,
// <head> ichidagi kichik skript qo'llaydi.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('bazm.theme');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="uz" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/* 3D sahna butun sayt fonida, matn ORTIDA turadi va hech qachon
            bosishga xalaqit bermaydi (pointer-events: none) */}
        <SceneCanvas />
        <div className="page">
          <PageTransition>{children}</PageTransition>
        </div>
        <SiteFx />
      </body>
    </html>
  );
}
