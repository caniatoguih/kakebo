import { Request, Response } from 'express';
import { ExternalServiceError, NominatimGeocodingProvider, OsrmRouteProvider } from '../services/MapService';

export class MapaController {
  private readonly geocoding = new NominatimGeocodingProvider();
  private readonly routes = new OsrmRouteProvider();
  geocode = async (req: Request, res: Response) => {
    try { return res.json({ items: await this.geocoding.search(req.query.q as string) }); }
    catch (error) { return res.status(error instanceof ExternalServiceError ? error.status : 500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar endereço.' }); }
  };
  route = async (req: Request, res: Response) => {
    try { return res.json(await this.routes.calculateRoute(req.body.origin, req.body.destination)); }
    catch (error) { return res.status(error instanceof ExternalServiceError ? error.status : 500).json({ message: error instanceof Error ? error.message : 'Erro ao calcular rota.' }); }
  };
}
