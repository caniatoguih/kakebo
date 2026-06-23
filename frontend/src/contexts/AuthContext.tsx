import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/services/api';
import { authService } from '@/services/authService';

export interface UserData {
  id: string;
  nome: string;
  email: string;
}

interface AuthContextType {
  token: string | null;
  usuario: UserData | null;
  login: (token: string, usuario: UserData) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('@kakebo:token'));
  const [usuario, setUsuario] = useState<UserData | null>(() => {
    const stored = localStorage.getItem('@kakebo:usuario');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('@kakebo:token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('@kakebo:token');
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if (usuario) {
      localStorage.setItem('@kakebo:usuario', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('@kakebo:usuario');
    }
  }, [usuario]);

  const login = (newToken: string, newUsuario: UserData) => {
    setToken(newToken);
    setUsuario(newUsuario);
  };

  const logout = () => {
    setToken(null);
    setUsuario(null);
  };

  useEffect(() => {
    if (token && !usuario) {
      authService.me()
        .then(u => setUsuario(u))
        .catch(err => {
          console.error('Erro ao buscar perfil do usuário:', err);
          logout();
        });
    }
  }, [token, usuario]);

  return (
    <AuthContext.Provider value={{ token, usuario, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
