import { api } from './api';

export interface UserVehicle { id: string; nome: string; marca: string | null; modelo: string | null; ano: number | null; fuel_type: string; city_efficiency_km_per_l: number; highway_efficiency_km_per_l: number; }
export interface UserVehicleInput { nome: string; marca?: string; modelo?: string; ano?: number; fuel_type: string; city_efficiency_km_per_l: number; highway_efficiency_km_per_l: number; }
export const veiculosUsuarioService = {
  listar: async (): Promise<UserVehicle[]> => (await api.get('/user/vehicles')).data,
  criar: async (payload: UserVehicleInput): Promise<UserVehicle> => (await api.post('/user/vehicles', payload)).data,
};
