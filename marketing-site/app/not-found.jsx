import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <div className="serif" style={{ fontSize: 64, color: 'var(--gold)' }}>404</div>
        <p style={{ color: 'var(--muted)', margin: '10px 0 24px' }}>Bunday sahifa topilmadi</p>
        <Link href="/" className="btn btn-primary">
          Bosh sahifaga
        </Link>
      </div>
    </main>
  );
}
