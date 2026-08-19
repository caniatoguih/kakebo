import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fuel, Gauge, PiggyBank, TrendingUp, FolderOpen, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categoriasService, type CategoriaData } from '@/services/categoriasService';
import { combustivelService, type FuelCalculationRequest, type FuelCalculationResult, type FuelForecastType, type FuelScenario } from '@/services/combustivelService';
import { mapasService, type LocationResult, type RouteResult } from '@/services/mapasService';
import { MapaTrajeto } from './MapaTrajeto';
import { veiculosUsuarioService, type UserVehicle } from '@/services/veiculosUsuarioService';
import { contasService, type ContaData } from '@/services/contasService';
import { FuelCalculationModeSelector, type FuelCalculationMode } from './FuelCalculationModeSelector';
import { FuelPriceSettings } from './FuelPriceSettings';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const defaults = { outboundDistanceKm: '9', returnDistanceKm: '9', extraDays: '0', tripDays: '', extraMarginPercent: '0', fuelEfficiencyKmPerLiter: '12', fuelPricePerLiter: '5.8', gasolinaPrice: '5.8', etanolPrice: '4.2', dieselPrice: '6.0', forecastType: 'orcamento' as FuelForecastType };
const parseDecimal = (value: string) => Number(value.trim().replace(',', '.'));
const requestedHouseNumber = (query: string) => query.match(/(?:^|[,\s])(\d{1,6})(?:$|[,\s])/i)?.[1];
const weekdayLabels = [{ value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' }];

function previewScenarioForMonth(scenario: FuelScenario, mes: number, ano: number) {
  const weekdays = scenario.weekdays ?? [];
  const daysInMonth = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const routineDays = weekdays.length
    ? Array.from({ length: daysInMonth }, (_, index) => (weekdays.includes(new Date(Date.UTC(ano, mes - 1, index + 1)).getUTCDay() || 7) ? 1 : 0)).reduce<number>((total, day) => total + day, 0)
    : scenario.days_per_week * scenario.weeks_per_month;
  const workingDays = routineDays + scenario.extra_days;
  const monthlyDistance = (scenario.outbound_distance_km + scenario.return_distance_km) * workingDays * (1 + scenario.extra_margin_percent / 100);
  const monthlyCost = monthlyDistance / scenario.fuel_efficiency_km_per_l * scenario.fuel_price_per_l;
  return { mes, ano, workingDays, monthlyCost, suggestedBudget: Math.ceil(monthlyCost / 10) * 10 };
}

export function CalculadoraCombustivel() {
  const [form, setForm] = useState(defaults);
  const [result, setResult] = useState<FuelCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [exportToBudget, setExportToBudget] = useState(false);
  const [subcategory, setSubcategory] = useState<string>();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [origin, setOrigin] = useState<LocationResult>();
  const [destination, setDestination] = useState<LocationResult>();
  const [originOptions, setOriginOptions] = useState<LocationResult[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<LocationResult[]>([]);
  const [outbound, setOutbound] = useState<RouteResult>();
  const [returnRoute, setReturnRoute] = useState<RouteResult>();
  const [vehicleId, setVehicleId] = useState<string>();
  const [routeType, setRouteType] = useState<'urbano' | 'rodoviario'>('urbano');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newVehicle, setNewVehicle] = useState({ nome: '', fuel_type: 'Gasolina', city: '', highway: '' });
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [applyScenarioId, setApplyScenarioId] = useState<string>();
  const [applyDestination, setApplyDestination] = useState<FuelForecastType>('orcamento');
  const [applySubcategory, setApplySubcategory] = useState<string>();
  const [applyAccount, setApplyAccount] = useState<string>();
  const [applyMonths, setApplyMonths] = useState(1);
  const [calculationMode, setCalculationMode] = useState<FuelCalculationMode>('rotina');
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery<CategoriaData[]>({ queryKey: ['categorias'], queryFn: categoriasService.listar });
  const { data: vehicles = [] } = useQuery<UserVehicle[]>({ queryKey: ['user-vehicles'], queryFn: veiculosUsuarioService.listar });
  const { data: scenarios = [] } = useQuery<FuelScenario[]>({ queryKey: ['fuel-scenarios'], queryFn: combustivelService.listar });
  const { data: savedFuelPrices = [] } = useQuery({ queryKey: ['fuel-prices'], queryFn: combustivelService.listarPrecos });
  const { data: accounts = [] } = useQuery<ContaData[]>({ queryKey: ['contas'], queryFn: contasService.listar });
  const subcategories = categories.flatMap((category) => category.subcategorias);
  const selectedFuelType = vehicles.find((vehicle) => vehicle.id === vehicleId)?.fuel_type ?? 'Gasolina';
  const priceForFuel = selectedFuelType === 'Etanol' ? form.etanolPrice : selectedFuelType === 'Diesel' ? form.dieselPrice : form.gasolinaPrice;
  useEffect(() => {
    if (!savedFuelPrices.length) return;
    setForm((current) => ({ ...current, ...Object.fromEntries(savedFuelPrices.map((price) => [price.fuel_type === 'Gasolina' ? 'gasolinaPrice' : price.fuel_type === 'Etanol' ? 'etanolPrice' : 'dieselPrice', String(price.price_per_l)])) }));
  }, [savedFuelPrices]);
  const saveFuelPrice = useMutation({ mutationFn: combustivelService.salvarPreco, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fuel-prices'] }) });
  const persistFuelPrices = () => {
    ([['Gasolina', form.gasolinaPrice], ['Etanol', form.etanolPrice], ['Diesel', form.dieselPrice]] as const).forEach(([fuel_type, value]) => {
      const price = parseDecimal(value);
      if (Number.isFinite(price) && price >= 0) saveFuelPrice.mutate({ fuel_type, price_per_l: price });
    });
  };
  const request = (): FuelCalculationRequest => ({
    outboundDistanceKm: parseDecimal(form.outboundDistanceKm), returnDistanceKm: parseDecimal(form.returnDistanceKm), daysPerWeek: 5, tripDays: calculationMode === 'viagem' ? parseDecimal(form.tripDays) : undefined,
    extraDays: parseDecimal(form.extraDays), extraMarginPercent: parseDecimal(form.extraMarginPercent),
    fuelEfficiencyKmPerLiter: parseDecimal(form.fuelEfficiencyKmPerLiter), fuelPricePerLiter: parseDecimal(priceForFuel), weekdays: calculationMode === 'rotina' ? weekdays : [], referenceMonth: mes, referenceYear: ano, forecastType: form.forecastType,
  });
  const calculation = useMutation({ mutationFn: combustivelService.calcular, onSuccess: setResult, onError: (err: any) => setError(err?.response?.data?.message ?? 'Não foi possível calcular o gasto.') });
  const save = useMutation({
    mutationFn: combustivelService.salvar,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orcamentos'] }); queryClient.invalidateQueries({ queryKey: ['fuel-scenarios'] }); window.dispatchEvent(new CustomEvent('kakebo:feedback', { detail: { message: 'Cenário salvo com sucesso.', type: 'success' } })); },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Não foi possível salvar o cenário.'),
  });
  const createVehicle = useMutation({ mutationFn: () => veiculosUsuarioService.criar({ nome: newVehicle.nome, fuel_type: newVehicle.fuel_type, city_efficiency_km_per_l: parseDecimal(newVehicle.city), highway_efficiency_km_per_l: parseDecimal(newVehicle.highway) }), onSuccess: (vehicle) => { queryClient.invalidateQueries({ queryKey: ['user-vehicles'] }); setVehicleId(vehicle.id); setForm((current) => ({ ...current, fuelEfficiencyKmPerLiter: String(vehicle.city_efficiency_km_per_l) })); setNewVehicle({ nome: '', fuel_type: 'Gasolina', city: '', highway: '' }); setShowNewVehicle(false); } });
  const removeScenario = useMutation({ mutationFn: combustivelService.excluir, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fuel-scenarios'] }) });
  const applyScenario = useMutation({ mutationFn: async ({ id, payload }: { id: string; payload: any }) => { const first = new Date(payload.ano, payload.mes - 1, 1); const applied = []; for (let index = 0; index < applyMonths; index += 1) { const date = new Date(first.getFullYear(), first.getMonth() + index, 1); applied.push(await combustivelService.aplicar(id, { ...payload, mes: date.getMonth() + 1, ano: date.getFullYear() })); } return applied; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orcamentos'] }); queryClient.invalidateQueries({ queryKey: ['fluxo-contabil'] }); setApplyScenarioId(undefined); window.dispatchEvent(new CustomEvent('kakebo:feedback', { detail: { message: 'Cenário aplicado nos meses selecionados com sucesso.', type: 'success' } })); }, onError: (err: any) => setError(err?.response?.data?.message ?? 'Não foi possível aplicar o cenário.') });
  const fields = useMemo(() => [
    ['tripDays', 'Dias da viagem (opcional)', '1'],
    ['gasolinaPrice', 'Gasolina (R$/L)', '0.01'], ['etanolPrice', 'Etanol (R$/L)', '0.01'], ['dieselPrice', 'Diesel (R$/L)', '0.01'],
    ['outboundDistanceKm', 'Distância de ida (km)', '0.1'], ['returnDistanceKm', 'Distância de volta (km)', '0.1'],
    ['extraDays', 'Dias presenciais extras', '1'], ['extraMarginPercent', 'Margem adicional (%)', '1'],
    ['fuelEfficiencyKmPerLiter', 'Consumo utilizado (km/L)', '0.1'], ['fuelPricePerLiter', 'Preço do combustível (R$/L)', '0.01'],
  ] as const, []);
  const activeApplicationScenario = scenarios.find((scenario) => scenario.id === applyScenarioId);
  const applicationPreview = useMemo(() => {
    if (!activeApplicationScenario) return [];
    return Array.from({ length: applyMonths }, (_, index) => {
      const date = new Date(Date.UTC(ano, mes - 1 + index, 1));
      return previewScenarioForMonth(activeApplicationScenario, date.getUTCMonth() + 1, date.getUTCFullYear());
    });
  }, [activeApplicationScenario, applyMonths, ano, mes]);
  const update = (key: keyof typeof defaults, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selectVehicle = (id: string) => { setVehicleId(id); const vehicle = vehicles.find((item) => item.id === id); if (vehicle) setForm((current) => ({ ...current, fuelEfficiencyKmPerLiter: String(routeType === 'urbano' ? vehicle.city_efficiency_km_per_l : vehicle.highway_efficiency_km_per_l) })); };
  const changeRouteType = (value: 'urbano' | 'rodoviario') => { setRouteType(value); const vehicle = vehicles.find((item) => item.id === vehicleId); if (vehicle) setForm((current) => ({ ...current, fuelEfficiencyKmPerLiter: String(value === 'urbano' ? vehicle.city_efficiency_km_per_l : vehicle.highway_efficiency_km_per_l) })); };
  const searchLocations = async () => {
    setError(null);
    try {
      const originItems = await mapasService.geocodificar(originQuery);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const destinationItems = await mapasService.geocodificar(destinationQuery);
      if (!originItems[0] || !destinationItems[0]) throw new Error('Não localizamos um dos endereços. Informe-o com mais detalhes.');
      setOriginOptions(originItems); setDestinationOptions(destinationItems); setOrigin(originItems[0]); setDestination(destinationItems[0]); setOutbound(undefined); setReturnRoute(undefined);
    } catch (searchError: any) { setError(searchError?.response?.data?.message ?? searchError?.message ?? 'Não foi possível buscar os endereços.'); }
  };
  const calculateRoutes = async () => {
    if (!origin || !destination) return;
    setError(null);
    try {
      const [outboundRoute, returnTrip] = await Promise.all([mapasService.calcularRota(origin, destination), mapasService.calcularRota(destination, origin)]);
      setOutbound(outboundRoute); setReturnRoute(returnTrip);
      setForm((current) => ({ ...current, outboundDistanceKm: outboundRoute.distanceKm.toFixed(2), returnDistanceKm: returnTrip.distanceKm.toFixed(2) }));
    } catch (routeError: any) { setError(routeError?.response?.data?.message ?? routeError?.message ?? 'Não foi possível calcular as rotas.'); }
  };
  const reopenScenario = (scenario: FuelScenario) => {
    const restored = { outboundDistanceKm: String(scenario.outbound_distance_km), returnDistanceKm: String(scenario.return_distance_km), extraDays: String(scenario.extra_days), tripDays: '', extraMarginPercent: String(scenario.extra_margin_percent), fuelEfficiencyKmPerLiter: String(scenario.fuel_efficiency_km_per_l), fuelPricePerLiter: String(scenario.fuel_price_per_l), gasolinaPrice: String(scenario.fuel_price_per_l), etanolPrice: defaults.etanolPrice, dieselPrice: defaults.dieselPrice, forecastType: 'orcamento' as FuelForecastType };
    setForm(restored); setWeekdays(scenario.weekdays?.length ? scenario.weekdays : []); setSaveName(scenario.nome ?? ''); setResult(null); setOutbound(undefined); setReturnRoute(undefined);
    if (scenario.origin_label && scenario.origin_lat !== null && scenario.origin_lng !== null) { setOrigin({ label: scenario.origin_label, latitude: scenario.origin_lat, longitude: scenario.origin_lng }); setOriginQuery(scenario.origin_label); }
    if (scenario.destination_label && scenario.destination_lat !== null && scenario.destination_lng !== null) { setDestination({ label: scenario.destination_label, latitude: scenario.destination_lat, longitude: scenario.destination_lng }); setDestinationQuery(scenario.destination_label); }
    calculation.mutate({ ...restored, tripDays: undefined, extraDays: Number(restored.extraDays), extraMarginPercent: Number(restored.extraMarginPercent), outboundDistanceKm: Number(restored.outboundDistanceKm), returnDistanceKm: Number(restored.returnDistanceKm), daysPerWeek: 5, weekdays: scenario.weekdays?.length ? scenario.weekdays : [], referenceMonth: mes, referenceYear: ano, fuelEfficiencyKmPerLiter: Number(restored.fuelEfficiencyKmPerLiter), fuelPricePerLiter: Number(restored.fuelPricePerLiter) });
  };

  return <Card className={`fuel-calculator fuel-calculator--${calculationMode} border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/80 dark:from-emerald-950/30 dark:via-slate-900 dark:to-amber-950/20`}>
    <style>{`.fuel-calculator [aria-label="Veículo e consumo"] { order: -4; } .fuel-calculator [aria-label="Cadastro de veículo"] { order: -3; } .fuel-calculator [aria-label="Período de provisionamento"] { order: 1; } .fuel-calculator [aria-label="Prévia da aplicação"] { order: 2; }`}</style>
    <CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Gauge className="h-5 w-5" /></div><div><CardTitle className="text-lg">Calculadora de combustível</CardTitle><p className="text-xs text-muted-foreground">Informe ida e volta separadamente; as rotas poderão ser preenchidas pelo mapa.</p></div></div></CardHeader>
    <CardContent className="flex flex-col gap-5"><form className="order-0 grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(null); calculation.mutate(request()); }}>
      {fields.filter(([key]) => key !== 'fuelPricePerLiter' && !['gasolinaPrice', 'etanolPrice', 'dieselPrice'].includes(key) && (calculationMode === 'viagem' ? key !== 'extraDays' : key !== 'tripDays')).sort(([a], [b]) => ['outboundDistanceKm', 'returnDistanceKm', 'extraDays', 'extraMarginPercent', 'fuelEfficiencyKmPerLiter'].indexOf(a) - ['outboundDistanceKm', 'returnDistanceKm', 'extraDays', 'extraMarginPercent', 'fuelEfficiencyKmPerLiter'].indexOf(b)).map(([key, label]) => <div className="space-y-2" key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type="text" inputMode="decimal" value={form[key]} onChange={(event) => update(key, event.target.value)} /></div>)}
      {calculationMode === 'rotina' && <div className="space-y-2 md:col-span-2"><Label>Dias de uso no mês de referência</Label><div className="flex flex-wrap gap-2">{weekdayLabels.map((day) => <label key={day.value} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm"><input type="checkbox" checked={weekdays.includes(day.value)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, day.value].sort() : current.filter((value) => value !== day.value))} />{day.label}</label>)}</div><p className="text-xs text-muted-foreground">O cálculo considera as ocorrências destes dias em {String(mes).padStart(2, '0')}/{ano}.</p></div>}
      <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={calculation.isPending}>{calculation.isPending ? 'Calculando...' : 'Calcular custo'}</Button></div>
    </form>
    <div className="order-[-5]"><FuelCalculationModeSelector value={calculationMode} onChange={setCalculationMode} /></div>
    <div className="order-[-2]"><FuelPriceSettings selectedFuelType={selectedFuelType} selectedPrice={priceForFuel} values={{ gasolinaPrice: form.gasolinaPrice, etanolPrice: form.etanolPrice, dieselPrice: form.dieselPrice }} onChange={update} onSave={persistFuelPrices} saving={saveFuelPrice.isPending} /></div>
    <section className="order-[-1] rounded-xl border bg-white/70 p-4" aria-label="Cadastro de veículo"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">Não encontrou seu veículo?</p><p className="text-xs text-muted-foreground">Cadastre o rendimento urbano e rodoviário para usá-lo nos cálculos.</p></div><Button type="button" variant="outline" onClick={() => setShowNewVehicle((current) => !current)}>{showNewVehicle ? 'Fechar cadastro' : 'Cadastrar novo veículo'}</Button></div>{showNewVehicle && <div className="mt-4 space-y-3 border-t pt-4"><div className="grid gap-3 md:grid-cols-4"><Input value={newVehicle.nome} onChange={(event) => setNewVehicle((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome do veículo" /><Select value={newVehicle.fuel_type} onValueChange={(fuel_type) => setNewVehicle((current) => ({ ...current, fuel_type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Gasolina', 'Etanol', 'Flex', 'Diesel', 'GNV', 'Eletrico', 'Hibrido'].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Input inputMode="decimal" value={newVehicle.city} onChange={(event) => setNewVehicle((current) => ({ ...current, city: event.target.value }))} placeholder="Urbano km/L" /><Input inputMode="decimal" value={newVehicle.highway} onChange={(event) => setNewVehicle((current) => ({ ...current, highway: event.target.value }))} placeholder="Estrada km/L" /></div><div className="flex justify-end"><Button type="button" disabled={createVehicle.isPending || newVehicle.nome.trim().length < 2 || !newVehicle.city || !newVehicle.highway} onClick={() => createVehicle.mutate()}>{createVehicle.isPending ? 'Cadastrando...' : 'Salvar veículo'}</Button></div></div>}</section>
    <section className="space-y-3 rounded-xl border bg-white/70 p-4" aria-label="Veículo e consumo"><div><p className="text-sm font-medium">Veículo e consumo</p><p className="text-xs text-muted-foreground">Selecione um veículo para usar o combustível e o rendimento cadastrados.</p></div><div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Veículo cadastrado</Label><Select value={vehicleId} onValueChange={selectVehicle}><SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger><SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.nome} · {vehicle.fuel_type}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tipo de trajeto</Label><Select value={routeType} onValueChange={(value) => changeRouteType(value as 'urbano' | 'rodoviario')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urbano">Urbano</SelectItem><SelectItem value="rodoviario">Rodoviário</SelectItem></SelectContent></Select></div></div></section>
    <div className="order-[-1] space-y-3 rounded-xl border bg-white/70 p-4" aria-label="Trajeto pelo mapa">
      <div><p className="text-sm font-medium">Trajeto pelo mapa</p><p className="text-xs text-muted-foreground">As rotas são calculadas separadamente para respeitar vias de mão única.</p></div>
      <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="origin">Origem</Label><Input id="origin" value={originQuery} onChange={(event) => setOriginQuery(event.target.value)} placeholder="Casa, rua e cidade" /></div><div className="space-y-2"><Label htmlFor="destination">Destino</Label><Input id="destination" value={destinationQuery} onChange={(event) => setDestinationQuery(event.target.value)} placeholder="Trabalho, rua e cidade" /></div></div>
      <div className="flex justify-end"><Button type="button" variant="outline" disabled={originQuery.trim().length < 3 || destinationQuery.trim().length < 3} onClick={searchLocations}>Buscar endereços</Button></div>
      {(originOptions.length > 0 || destinationOptions.length > 0) && <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Escolha a origem</Label><Select value={origin ? `${origin.latitude},${origin.longitude}` : undefined} onValueChange={(value) => { const location = originOptions.find((item) => `${item.latitude},${item.longitude}` === value); if (location) { setOrigin(location); setOutbound(undefined); setReturnRoute(undefined); } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{originOptions.map((item) => <SelectItem key={`${item.latitude},${item.longitude}`} value={`${item.latitude},${item.longitude}`}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Escolha o destino</Label><Select value={destination ? `${destination.latitude},${destination.longitude}` : undefined} onValueChange={(value) => { const location = destinationOptions.find((item) => `${item.latitude},${item.longitude}` === value); if (location) { setDestination(location); setOutbound(undefined); setReturnRoute(undefined); } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{destinationOptions.map((item) => <SelectItem key={`${item.latitude},${item.longitude}`} value={`${item.latitude},${item.longitude}`}>{item.label}</SelectItem>)}</SelectContent></Select></div></div>}
      {origin && requestedHouseNumber(originQuery) && origin.houseNumber !== requestedHouseNumber(originQuery) && <p className="text-xs text-amber-700">A busca não encontrou o número {requestedHouseNumber(originQuery)} para a origem; confirme se o ponto selecionado representa o endereço correto.</p>}
      {destination && requestedHouseNumber(destinationQuery) && destination.houseNumber !== requestedHouseNumber(destinationQuery) && <p className="text-xs text-amber-700">A busca não encontrou o número {requestedHouseNumber(destinationQuery)} para o destino; confirme se o ponto selecionado representa o endereço correto.</p>}
      {origin && destination && <div className="flex justify-end"><Button type="button" onClick={calculateRoutes}>Calcular rotas no mapa</Button></div>}
      {origin && destination && <><MapaTrajeto origin={origin} destination={destination} outbound={outbound} returnRoute={returnRoute} onOriginChange={(location) => { setOrigin({ ...location, houseNumber: requestedHouseNumber(originQuery) ?? null }); setOutbound(undefined); setReturnRoute(undefined); }} onDestinationChange={(location) => { setDestination({ ...location, houseNumber: requestedHouseNumber(destinationQuery) ?? null }); setOutbound(undefined); setReturnRoute(undefined); }} /><p className="text-xs text-muted-foreground">Arraste os marcadores até o ponto correto quando o endereço não estiver preciso; depois, calcule as rotas novamente.</p>{outbound && returnRoute && <p className="text-sm text-muted-foreground">Ida: {outbound.distanceKm.toFixed(2)} km · {outbound.durationMinutes.toFixed(0)} min &nbsp;|&nbsp; Volta: {returnRoute.distanceKm.toFixed(2)} km · {returnRoute.durationMinutes.toFixed(0)} min</p>}</>}
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {result && <><p className="text-sm font-medium">{calculationMode === 'viagem' ? `Custo estimado para ${result.workingDaysMonth} dia(s) de viagem` : `Custo estimado para ${String(mes).padStart(2, '0')}/${ano}`}</p><div className="grid gap-3 md:grid-cols-4">{[
      ['Mensal', currency.format(result.monthlyCost), PiggyBank], ['Reserva sugerida', currency.format(result.suggestedBudget), PiggyBank], ['Anual', currency.format(result.annualCost), TrendingUp], ['Consumo', `${result.monthlyLiters.toFixed(1)} L/mês`, Fuel],
    ].map(([label, value, Icon]: any) => <div className="rounded-xl border bg-white/70 p-3" key={label}><div className="flex gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>)}</div>
    <p className="text-sm text-muted-foreground">{result.dailyDistanceKm.toFixed(2)} km/dia · {result.workingDaysMonth.toFixed(2)} dias/mês · {result.monthlyDistanceKm.toFixed(0)} km/mês · {currency.format(result.costPerWorkingDay)}/dia</p>
    <div className="space-y-3 rounded-xl border bg-white/70 p-4"><div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="scenario-name">Nome do cenário</Label><Input id="scenario-name" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Combustível - Trabalho" /></div><div className="space-y-2"><Label>Subcategoria do orçamento</Label><Select value={subcategory} onValueChange={setSubcategory}><SelectTrigger><SelectValue placeholder="Selecione para enviar ao orçamento" /></SelectTrigger><SelectContent>{subcategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exportToBudget} onChange={(event) => setExportToBudget(event.target.checked)} />Adicionar a reserva sugerida ao orçamento</label>
    {exportToBudget && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Mês</Label><Input type="number" min="1" max="12" value={mes} onChange={(event) => setMes(Number(event.target.value))} /></div><div className="space-y-2"><Label>Ano</Label><Input type="number" min="2000" value={ano} onChange={(event) => setAno(Number(event.target.value))} /></div></div>}
    <div className="flex justify-end"><Button disabled={save.isPending || (exportToBudget && !subcategory)} onClick={() => save.mutate({ ...request(), nome: saveName || undefined, exportToBudget, subcategoria_id: subcategory, mes: exportToBudget ? mes : undefined, ano: exportToBudget ? ano : undefined, userVehicleId: vehicleId, fuelType: vehicles.find((vehicle) => vehicle.id === vehicleId)?.fuel_type, origin: origin ? { label: origin.label, latitude: origin.latitude, longitude: origin.longitude } : undefined, destination: destination ? { label: destination.label, latitude: destination.latitude, longitude: destination.longitude } : undefined, outboundDurationMinutes: outbound?.durationMinutes, returnDurationMinutes: returnRoute?.durationMinutes })}>{save.isPending ? 'Salvando...' : 'Salvar cenário'}</Button></div></div></>}
    {scenarios.length > 0 && <div className="space-y-2 rounded-xl border bg-white/70 p-4"><div className="flex items-center gap-2 text-sm font-medium"><FolderOpen className="h-4 w-4" />Cenários salvos</div><p className="text-xs text-muted-foreground">Aplique o mesmo cenário em vários meses. Cenários diferentes são somados no orçamento.</p>{scenarios.map((scenario) => <div className="space-y-3 rounded-lg border p-3" key={scenario.id}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{scenario.nome || 'Cenário sem nome'}</p><p className="text-xs text-muted-foreground">{scenario.origin_label && scenario.destination_label ? `${scenario.origin_label} → ${scenario.destination_label}` : `${scenario.outbound_distance_km + scenario.return_distance_km} km/dia`}</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => reopenScenario(scenario)}>Reabrir</Button><Button type="button" size="sm" onClick={() => { setApplyScenarioId(scenario.id); setApplyDestination('orcamento'); }}>Aplicar</Button><Button type="button" size="icon" variant="ghost" aria-label="Excluir cenário" disabled={removeScenario.isPending} onClick={() => removeScenario.mutate(scenario.id)}><Trash2 className="h-4 w-4" /></Button></div></div>{applyScenarioId === scenario.id && <div className="grid gap-3 md:grid-cols-5"><div className="space-y-1"><Label>Destino</Label><Select value={applyDestination} onValueChange={(value) => setApplyDestination(value as FuelForecastType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="orcamento">Orçamento</SelectItem><SelectItem value="fluxo-caixa">Fluxo de caixa</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Mês inicial</Label><Input type="number" min="1" max="12" value={mes} onChange={(event) => setMes(Number(event.target.value))} /></div><div className="space-y-1"><Label>Ano</Label><Input type="number" min="2000" value={ano} onChange={(event) => setAno(Number(event.target.value))} /></div><div className="space-y-1"><Label>{applyDestination === 'orcamento' ? 'Subcategoria' : 'Conta'}</Label>{applyDestination === 'orcamento' ? <Select value={applySubcategory} onValueChange={setApplySubcategory}><SelectTrigger><SelectValue placeholder="Subcategoria" /></SelectTrigger><SelectContent>{subcategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select> : <Select value={applyAccount} onValueChange={setApplyAccount}><SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger><SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select>}</div><div className="flex items-end"><Button className="w-full" disabled={applyScenario.isPending || (applyDestination === 'orcamento' ? !applySubcategory : !applyAccount)} onClick={() => applyScenario.mutate({ id: scenario.id, payload: { mes, ano, destino: applyDestination, subcategoria_id: applySubcategory, conta_id: applyAccount } })}>Confirmar aplicação</Button></div></div>}</div>)}</div>}
    {activeApplicationScenario && applicationPreview.length > 0 && <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label="Prévia da aplicação"><div className="mb-3"><p className="text-sm font-medium">Prévia dos lançamentos</p><p className="text-xs text-muted-foreground">Confira os valores antes de confirmar. No fluxo de caixa será lançado o valor sugerido.</p></div><div className="grid gap-3 md:grid-cols-3">{applicationPreview.map((item) => <div className="rounded-lg border bg-white/80 p-3" key={`${item.ano}-${item.mes}`}><p className="text-xs font-medium text-muted-foreground">{String(item.mes).padStart(2, '0')}/{item.ano} · {item.workingDays} dias</p><p className="mt-2 text-xs text-muted-foreground">Custo mensal: {currency.format(item.monthlyCost)}</p><p className="mt-1 text-base font-semibold text-emerald-700">A lançar: {currency.format(applyDestination === 'fluxo-caixa' ? item.suggestedBudget : item.suggestedBudget)}</p></div>)}</div></section>}
    <section className="rounded-xl border bg-white/70 p-4" aria-label="Período de provisionamento"><p className="text-sm font-medium">Provisionar cenários</p><p className="mb-3 text-xs text-muted-foreground">Defina quantos meses consecutivos serão criados quando confirmar a aplicação de um cenário.</p><div className="flex flex-wrap items-center gap-3"><Label htmlFor="apply-months-bottom">Quantidade de meses</Label><Input id="apply-months-bottom" className="w-24" type="number" min="1" max="60" value={applyMonths} onChange={(event) => setApplyMonths(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></div></section>
    </CardContent></Card>;
}
