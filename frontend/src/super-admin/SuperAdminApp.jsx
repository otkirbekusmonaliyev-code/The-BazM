import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { createClient } from '../lib/api';
import { superAuth, lastSession } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';
import DashboardPage from './DashboardPage';
import PlacesPage from './PlacesPage';
import ApplicationsPage from './ApplicationsPage';
import CommandPalette from './CommandPalette';

// Platforma egasi paneli.
//
// Bu yerda alohida login yo'q — butun platformada bitta kirish sahifasi bor
// (`/`). Sessiya bo'lmasa, foydalanuvchi o'sha yerga qaytariladi.

export default function SuperAdminApp() {
  const [session] = useState(() => superAuth.get());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    superAuth.clear();
    lastSession.clear();
    navigate('/', { replace: true });
  }, [navigate]);

  const api = useMemo(
    () =>
      createClient({
        getToken: () => session && session.token,
        onUnauthorized: logout,
      }),
    [session, logout]
  );

  useEffect(() => {
    if (!session) navigate('/', { replace: true });
  }, [session, navigate]);

  // ⌘K / Ctrl+K — tezkor qidiruv
  useEffect(() => {
    if (!session) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);

  const refreshSidebar = useCallback(async () => {
    if (!session) return;
    try {
      const [list, apps] = await Promise.all([
        api.get('/super-admin/restaurants'),
        api.get('/super-admin/applications?status=pending'),
      ]);
      setPlaces(list);
      setPendingCount(apps.length);
    } catch (_) {
      /* login sahifasiga o'tayotgan bo'lishimiz mumkin */
    }
  }, [api, session]);

  useEffect(() => {
    refreshSidebar();
  }, [refreshSidebar]);

  if (!session) return null;

  const restaurantCount = places.filter((p) => p.businessType !== 'cafe').length;
  const cafeCount = places.filter((p) => p.businessType === 'cafe').length;

  return (
    <div className="app-bazm app-surface">
      <div className="surface-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <div className="bazm-shell">
        <aside className="bazm-side glass-panel">
          <div className="bazm-brand">BAZM</div>

          <NavLink to="/super-admin" end className={({ isActive }) => `bazm-nav-link${isActive ? ' active' : ''}`}>
            <span>◈</span> Boshqaruv
          </NavLink>
          <NavLink
            to="/super-admin/restaurants"
            className={({ isActive }) => `bazm-nav-link${isActive ? ' active' : ''}`}
          >
            <span>🍽</span> Restoranlar
            {restaurantCount > 0 && <span className="bazm-nav-badge">{restaurantCount}</span>}
          </NavLink>
          <NavLink to="/super-admin/cafes" className={({ isActive }) => `bazm-nav-link${isActive ? ' active' : ''}`}>
            <span>☕</span> Kafelar
            {cafeCount > 0 && <span className="bazm-nav-badge">{cafeCount}</span>}
          </NavLink>
          <NavLink
            to="/super-admin/applications"
            className={({ isActive }) => `bazm-nav-link${isActive ? ' active' : ''}`}
          >
            <span>✉</span> Arizalar
            {pendingCount > 0 && <span className="bazm-nav-badge">{pendingCount}</span>}
          </NavLink>

          <div className="bazm-side-foot">
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{session.admin.fullName}</div>
            <div className="mono" style={{ marginTop: 2 }}>{session.admin.phone}</div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={logout}>
              Chiqish
            </button>
          </div>
        </aside>

        <main className="bazm-main">
          <header className="bazm-topbar glass-bar">
            <button type="button" className="bazm-search-btn" onClick={() => setPaletteOpen(true)}>
              <span>⌕</span>
              <span>Muassasa qidirish…</span>
              <span className="bazm-kbd">Ctrl K</span>
            </button>

            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <button
                type="button"
                className="bazm-bell"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="Bildirishnomalar"
              >
                🔔
                {pendingCount > 0 && <span className="bazm-bell-dot">{pendingCount}</span>}
              </button>
              {bellOpen && (
                <div className="bazm-dropdown glass-panel">
                  {pendingCount > 0 ? (
                    <button
                      type="button"
                      className="bazm-dropdown-item"
                      onClick={() => {
                        setBellOpen(false);
                        navigate('/super-admin/applications');
                      }}
                    >
                      <b>{pendingCount} ta yangi ariza</b>
                      <div style={{ color: 'var(--muted)', marginTop: 3 }}>Ko'rib chiqishni kutmoqda</div>
                    </button>
                  ) : (
                    <div className="bazm-dropdown-item" style={{ color: 'var(--muted)' }}>
                      Yangi bildirishnoma yo'q
                    </div>
                  )}
                </div>
              )}
            </div>
            <ThemeToggle />
          </header>

          <div className="bazm-content">
            <Routes>
              <Route path="/" element={<DashboardPage api={api} />} />
              <Route
                path="restaurants"
                element={<PlacesPage api={api} type="restaurant" onChanged={refreshSidebar} />}
              />
              <Route
                path="cafes"
                element={<PlacesPage api={api} type="cafe" onChanged={refreshSidebar} />}
              />
              <Route path="applications" element={<ApplicationsPage api={api} onChanged={refreshSidebar} />} />
            </Routes>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        places={places}
        onPick={(p) => {
          setPaletteOpen(false);
          const section = p.businessType === 'cafe' ? 'cafes' : 'restaurants';
          navigate(`/super-admin/${section}?open=${p.id}`);
        }}
      />
    </div>
  );
}
