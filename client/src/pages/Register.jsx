import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    mobileNumber: '',
    userType: 'Student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const allowedDomain = '@mgits.ac.in'; // Ensure this matches your college domain

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(''); // Clear error on user typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = form.email.toLowerCase().trim();
    const isSpecialAdminEmail = cleanEmail === 'saiharida2004@gmail.com';

    // Client-side domain check allowing admin email or campus domain
    if (!cleanEmail.endsWith(allowedDomain) && !isSpecialAdminEmail) {
      setError(`Only campus email addresses are permitted.`);
      return;
    }

    if (!/^[0-9]{10}$/.test(form.mobileNumber.trim())) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      await register(form);
      navigate('/');
    } catch (err) {
      // Safely check for Axios error response, thrown Error, or default fallback
      const message =
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please check your credentials and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Register with campus email</h2>
        {error && <p className="error" style={{ color: 'red', marginBottom: 12 }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Name"
            required
          />

          <label>Campus Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            minLength={6}
            required
          />

          <label>I am a</label>
          <select name="userType" value={form.userType} onChange={handleChange} required>
            <option value="Student">Student</option>
            <option value="Faculty">Faculty</option>
            <option value="Staff">Staff</option>
          </select>

          <label>Mobile Number</label>
          <input
            type="tel"
            name="mobileNumber"
            value={form.mobileNumber}
            onChange={handleChange}
            placeholder="10-digit mobile number"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: 12, fontSize: 14 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}