import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Three.js ~700 KB — uni faqat shu sahifa ochilganda yuklaymiz,
// mijozning Mini App'i uni umuman yuklab olmasin
const NetworkBanner = lazy(() => import('../components/three/NetworkBanner'));
import { money, SUBSCRIPTION_LABELS, dateOnly } from '../lib/format';

export default function DashboardPage({ api }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Qatorni bosganda o'sha muassasa o'z bo'limida ochiladi
  const open = (r) =>
    navigate(`/super-admin/${r.businessType === 'cafe' ? 'cafes' : 'restaurants'}?open=${r.id}`);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, list] = await Promise.all([
          api.get('/super-admin/stats'),
          api.get('/super-admin/restaurants'),
        ]);
        if (!alive) return;
        setStats(s);
        setRecent(list.slice(0, 6));
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  if (error) return <div className="form-error">{error}</div>;
  if (!stats) {
    return (
      <div className="loading-screen" style={{ minHeight: 300 }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <>
      {/* 3D banner: har bir nuqta — bitta restoran, ranglar obuna holatiga qarab */}
      <div className="bazm-banner">
        <Suspense fallback={<div className="three-banner three-fallback" style={{ height: 140 }} />}>
          <NetworkBanner nodes={stats.nodes} height={140} />
        </Suspense>
        <div className="bazm-banner-overlay">
          <h2>Platforma tarmog'i</h2>
          <p>
            {stats.byType.restaurant} restoran · {stats.byType.cafe} kafe ·{' '}
            {stats.byStatus.active} faol · {stats.byStatus.trial} sinovda
          </p>
        </div>
      </div>

      <div className="bazm-kpi-grid">
        <div className="bazm-kpi">
          <div className="bazm-kpi-label">Jami muassasa</div>
          <div className="bazm-kpi-value">{stats.totalRestaurants}</div>
          <div className="bazm-kpi-hint">
            <Link to="/super-admin/restaurants" style={{ color: 'var(--amber)' }}>
              {stats.byType.restaurant} restoran
            </Link>{' '}
            ·{' '}
            <Link to="/super-admin/cafes" style={{ color: 'var(--amber)' }}>
              {stats.byType.cafe} kafe
            </Link>
          </div>
        </div>
        <div className="bazm-kpi">
          <div className="bazm-kpi-label">Faol obuna</div>
          <div className="bazm-kpi-value" style={{ color: 'var(--green)' }}>
            {stats.byStatus.active}
          </div>
          <div className="bazm-kpi-hint">{stats.byStatus.trial} ta sinov muddatida</div>
        </div>
        <div className="bazm-kpi">
          <div className="bazm-kpi-label">Oylik daromad (MRR)</div>
          <div className="bazm-kpi-value" style={{ color: 'var(--amber)' }}>
            {money(stats.mrr)}
          </div>
          <div className="bazm-kpi-hint">Faqat faol obunalardan</div>
        </div>
        <div className="bazm-kpi">
          <div className="bazm-kpi-label">Kutayotgan ariza</div>
          <div className="bazm-kpi-value" style={{ color: stats.pendingApplications ? 'var(--amber)' : undefined }}>
            {stats.pendingApplications}
          </div>
          <div className="bazm-kpi-hint">
            <Link to="/super-admin/applications" style={{ color: 'var(--amber)' }}>
              Ko'rib chiqish →
            </Link>
          </div>
        </div>
      </div>

      <div className="bazm-panel">
        <div className="bazm-panel-head">
          <h2>Oxirgi qo'shilganlar</h2>
          <Link to="/super-admin/restaurants" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
            Barchasi
          </Link>
        </div>
        <div className="bazm-table-wrap">
          <table className="bazm-table">
            <thead>
              <tr>
                <th>Muassasa</th>
                <th>Turi</th>
                <th>Slug</th>
                <th>Tarif</th>
                <th>Holat</th>
                <th>Qo'shilgan</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} onClick={() => open(r)}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.businessType === 'cafe' ? 'Kafe' : 'Restoran'}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{r.slug}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.subscriptionPlan}</td>
                  <td>
                    <span className={`status-badge ${r.subscriptionStatus}`}>
                      {SUBSCRIPTION_LABELS[r.subscriptionStatus]}
                    </span>
                  </td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{dateOnly(r.createdAt)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="bazm-empty">Hali muassasa qo'shilmagan</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
