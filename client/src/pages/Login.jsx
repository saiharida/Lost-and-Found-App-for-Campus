import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // <--- Added state for toggling visibility

  // Show suspension notice if redirected here
  useEffect(() => {
    const notice = sessionStorage.getItem('lf_notice');
    if (notice) {
      setError(notice);
      sessionStorage.removeItem('lf_notice');
    }
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      try {
        await login(form.email, form.password);
        const storedUser = JSON.parse(localStorage.getItem('lf_user'));
        if (storedUser?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
        return;
      } catch (regularLoginErr) {
        const adminRes = await api.post('/auth/admin-login', form);
        localStorage.setItem('lf_user', JSON.stringify(adminRes.data));
        window.location.href = '/admin';
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Secure Login</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Campus Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <label style={{ margin: 0 }}>Password</label>
            <Link
              to="/forgot-password"
              style={{ fontSize: '12px', color: '#047857', textDecoration: 'none', fontWeight: '600' }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Password Input Wrapper with Eye Icon */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: '100%', paddingRight: '40px' }} // Make room for the button inside
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                color: '#64748b',
                boxShadow: 'none',
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        <p style={{ marginTop: 12, fontSize: 14 }}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}