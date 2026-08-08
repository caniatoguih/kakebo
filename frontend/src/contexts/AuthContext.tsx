import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '@/services/authService';

export interface UserData { id: string; nome: string; email: string }

interface AuthContextType {
  usuario: UserData | null;
  login: (usuario: UserData) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.me().then(setUsuario).catch(() => setUsuario(null)).finally(() => setIsLoading(false));
    const unauthorized = () => setUsuario(null);
    window.addEventListener('kakebo:unauthorized', unauthorized);
    return () => window.removeEventListener('kakebo:unauthorized', unauthorized);
  }, []);

  const logout = async () => {
    try { await authService.logout(); } finally { setUsuario(null); }
  };

  return (
    <AuthContext.Provider value={{
      usuario,
      login: setUsuario,
      logout,
      isAuthenticated: Boolean(usuario),
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
