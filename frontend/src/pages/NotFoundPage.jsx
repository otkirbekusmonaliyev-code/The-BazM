import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="app-auth">
      <div className="auth-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <div className="auth-shell auth-shell-center">
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <div className="auth-title" style={{ fontSize: 44, letterSpacing: '0.1em' }}>
            404
          </div>
          <p className="auth-sub" style={{ marginBottom: 22 }}>
            Bunday sahifa yo'q. Ehtimol havola eskirgan.
          </p>
          <Link to="/" className="btn btn-primary btn-block btn-lg">
            Kirish sahifasiga
          </Link>
        </div>
      </div>
    </div>
  );
}
