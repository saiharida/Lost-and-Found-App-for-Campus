import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { setAuthUser } = useAuth(); // Assuming your AuthContext exposes a way to set the user or we handle token storage
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Calls your backend adminLogin route
      const res = await api.post('/auth/admin-login', form);
      
      // Save user & token to localStorage and AuthContext state
      localStorage.setItem('lf_user', JSON.stringify(res.data));
      window.location.href = '/admin'; // Hard redirect to clear state and enter admin panel
    } catch (err) {
      setError(err.response?.data?.message || 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', borderTop: '4px solid #dc2626' }}>
        <h2 style={{ color: '#dc2626' }}>🔒 Campus Admin Portal</h2>
        <p style={{ fontSize: '13px', color: 'var(--board-muted)', marginBottom: '20px' }}>
          Restricted access. Authorized personnel only.
        </p>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Admin Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label style={{ marginTop: '10px' }}>Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: '16px', background: '#dc2626', color: '#fff' }}
          >
            {loading ? 'Verifying Admin Credentials...' : 'Admin Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}