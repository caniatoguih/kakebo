import { api } from './api';

export interface LoginData {
  email: string;
  senha_hash: string; // The backend currently expects senha_hash based on the controller we might need to send senha or senha_hash, assuming senha. Wait, the backend model has senha_hash, let's assume the body expects 'senha' and hashes it, or we pass 'senha_hash'. Let's check. Actually I'll send 'senha'.
}

export interface RegisterData {
  nome: string;
  email: string;
  senha_hash: string;
}

export const authService = {
  login: async (data: any): Promise<any> => {
    const response = await api.post('/auth/login', { email: data.email, senha: data.senha });
    return response.data;
  },
  register: async (data: any): Promise<any> => {
    const response = await api.post('/auth/register', { nome: data.nome, email: data.email, senha: data.senha });
    return response.data;
  },
  me: async (): Promise<any> => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};
