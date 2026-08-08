import { api } from './api';

export interface LoginData {
  email: string;
  senha: string;
}

export interface RegisterData {
  nome: string;
  email: string;
  senha: string;
}

export interface AuthUser { id: string; nome: string; email: string }
export interface LoginResponse { usuario: AuthUser }

export const authService = {
  login: async (data: LoginData): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', { email: data.email, senha: data.senha });
    return response.data;
  },
  register: async (data: RegisterData): Promise<{ usuario: AuthUser }> => {
    const response = await api.post('/auth/register', { nome: data.nome, email: data.email, senha: data.senha });
    return response.data;
  },
  me: async (): Promise<AuthUser> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  logout: async (): Promise<void> => { await api.post('/auth/logout'); },
};
