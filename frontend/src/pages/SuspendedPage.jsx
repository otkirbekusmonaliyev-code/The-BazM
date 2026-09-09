// Muassasa obunasi to'xtatilganda ko'rsatiladigan neytral ekran.
// Ataylab brendsiz (muassasa logotipisiz) — bu platforma darajasidagi xabar.

export default function SuspendedPage({ message }) {
  return (
    <div className="app-auth">
      <div className="auth-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <div className="auth-shell auth-shell-center">
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⏸</div>
          <h1 className="auth-title" style={{ fontSize: 21 }}>
            Xizmat vaqtincha to'xtatilgan
          </h1>
          <p className="auth-sub" style={{ marginBottom: 0 }}>
            {message || 'Iltimos, administratsiya bilan bog\'laning.'}
          </p>
        </div>
      </div>
    </div>
  );
}
