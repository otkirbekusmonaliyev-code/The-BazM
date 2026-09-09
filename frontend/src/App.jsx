import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import SuperAdminApp from './super-admin/SuperAdminApp';
import AdminApp from './restaurant-admin/AdminApp';
import KitchenApp from './kitchen/KitchenApp';
import WaiterApp from './waiter/WaiterApp';
import ClientApp from './client/ClientApp';
import AcceptInvitePage from './staff/AcceptInvitePage';

// Marshrutlar:
//   /                          — YAGONA kirish sahifasi (barcha rollar uchun)
//   /super-admin/*             — platforma egasi paneli
//   /t/:slug/:qrToken          — mijoz, QR skanerlab kirgan
//   /m/:slug                   — mijoz, bot orqali (stol tanlash)
//   /:slug/accept-invite/:tok  — xodim taklifi, parol o'rnatish
//   /:slug/admin | kitchen | waiter — xodim panellari
//
// DIQQAT: /:slug ixtiyoriy so'z bo'lgani uchun u ENG OXIRIDA turishi shart,
// aks holda "/super-admin" ham slug deb qabul qilinardi.

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* Eski havolalar ishlashda davom etsin */}
      <Route path="/login" element={<Navigate to="/" replace />} />

      <Route path="/super-admin/*" element={<SuperAdminApp />} />

      <Route path="/t/:slug/:qrToken" element={<ClientApp mode="qr" />} />
      <Route path="/m/:slug" element={<ClientApp mode="picker" />} />

      <Route path="/:slug/accept-invite/:token" element={<AcceptInvitePage />} />
      <Route path="/:slug/admin/*" element={<AdminApp />} />
      <Route path="/:slug/kitchen" element={<KitchenApp />} />
      <Route path="/:slug/waiter" element={<WaiterApp />} />
      <Route path="/:slug/login" element={<Navigate to="/" replace />} />
      <Route path="/:slug" element={<Navigate to="/" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
