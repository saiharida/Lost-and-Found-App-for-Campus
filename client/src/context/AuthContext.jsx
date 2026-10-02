import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('lf_user');
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.error('Failed to parse lf_user from storage:', err);
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(false);

  const persist = (data) => {
    if (data) {
      localStorage.setItem('lf_user', JSON.stringify(data));
    } else {
      localStorage.removeItem('lf_user');
    }
    setUser(data);
  };

  const register = async ({ name, email, password, mobileNumber, userType }) => {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
      mobileNumber,
      userType,
    });
    persist(data);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data);
    return data;
  };

  const logout = () => {
    persist(null);
  };

  // Merges updated profile fields into the stored user
  const updateUser = (patch) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      localStorage.setItem('lf_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,       // Expose setUser so direct state updates don't throw undefined errors
        updateUser,
        register,
        login,
        logout,
        authLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};