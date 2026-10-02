import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/login');
  };

  return (
    <div className="navbar">
      <Link
        to="/"
        className="brand"
        style={{
          display: 'flex',
          flexDirection: 'column',
          textDecoration: 'none',
          gap: '2px',
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
            fontSize: '1.45rem',
            fontWeight: '900',
            letterSpacing: '-0.75px',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            lineHeight: 1.1,
          }}
        >
          Lo<span style={{ color: '#38bdf8' }}>Key</span>
          <span style={{ fontSize: '1.1rem', transform: 'rotate(-20deg)', display: 'inline-block' }}>
            🔑
          </span>
        </span>
        <span
          style={{
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            fontSize: '0.7rem',
            fontWeight: '600',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          The key to your lost items
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
        <Link to="/">Browse</Link>
        {user ? (
          <>
            <Link to="/report">Report Item</Link>
            <Link to="/profile">Profile</Link>
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#e2e8f0',
                fontSize: '14.5px',
                fontWeight: '500',
                cursor: 'pointer',
                padding: 0,
                boxShadow: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#e2e8f0')}
            >
              Logout ({user.name})
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}