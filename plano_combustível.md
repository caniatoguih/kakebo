# Plano de Integração — Calculadora de Combustível com Mapa + AutoDataAPI

## 1. Objetivo

Adicionar à plataforma existente uma funcionalidade de planejamento de gasto mensal com combustível, integrando:

- definição de trajeto por mapa;
- cálculo separado das rotas de ida e volta;
- seleção do veículo;
- consulta de consumo médio por API;
- cálculo mensal e anual de combustível;
- persistência de cenário;
- envio do valor estimado para o fluxo de caixa/orçamento.

A melhoria deve ser construída como um módulo desacoplado para reduzir impacto sobre o restante da aplicação.

---

## 2. Visão geral da funcionalidade

Fluxo esperado:

```text
Usuário abre a calculadora
        ↓
Seleciona ou cadastra seu veículo
        ↓
Sistema consulta dados automotivos
        ↓
Sistema obtém consumo médio
        ↓
Usuário informa origem e destino
        ↓
Sistema geocodifica os endereços
        ↓
Calcula rota de ida
        ↓
Calcula rota de volta
        ↓
Exibe ambas no mapa
        ↓
Usuário informa rotina presencial
        ↓
Usuário informa preço do combustível
        ↓
Sistema calcula custo mensal/anual
        ↓
Usuário salva o cenário
        ↓
Usuário adiciona a previsão ao orçamento
```

---

# 3. Arquitetura proposta

## 3.1 Visão macro

```text
Frontend da plataforma
        │
        ├── Calculadora de combustível
        │
        ├── Componente de mapa
        │
        └── Seleção de veículo
        │
        ▼
Backend da plataforma
        │
        ├── FuelCalculatorService
        ├── RouteService
        ├── GeocodingService
        ├── VehicleCatalogService
        └── BudgetService
        │
        ├──────────────► AutoDataAPI
        │
        ├──────────────► Nominatim / provedor de geocoding
        │
        └──────────────► OSRM / provedor de rotas
```

O frontend não deve possuir credenciais de serviços externos.

---

# 4. Princípio de desacoplamento

A calculadora não deve saber qual API fornece os dados.

Criar interfaces internas.

## 4.1 Veículos

```typescript
interface VehicleProvider {
  searchVehicles(filters: VehicleSearchFilters): Promise<VehicleSummary[]>
  getVehicle(vehicleId: string): Promise<VehicleDetails>
}
```

Implementação inicial:

```text
AutoDataVehicleProvider
```

No futuro:

```text
OutroVehicleProvider
```

---

## 4.2 Rotas

```typescript
interface RouteProvider {
  calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    profile: RouteProfile
  ): Promise<RouteResult>
}
```

Implementação inicial:

```text
OSRMRouteProvider
```

Possíveis futuras:

```text
GoogleRoutesProvider
OpenRouteServiceProvider
MapboxRouteProvider
```

---

## 4.3 Geocodificação

```typescript
interface GeocodingProvider {
  search(query: string): Promise<LocationResult[]>
}
```

Implementação inicial:

```text
NominatimGeocodingProvider
```

---

# 5. Integração com AutoDataAPI

A AutoDataAPI será utilizada para preencher automaticamente os dados do veículo e obter o consumo médio de referência.

## 5.1 Credenciais

Configurar apenas no backend:

```env
AUTODATA_API_BASE_URL=...
AUTODATA_API_KEY=...
AUTODATA_API_SECRET=...
```

Nunca enviar o `API Secret` para o frontend.

---

## 5.2 Endpoint de busca de veículos

API externa:

```http
GET /catalog/vehicles
```

Filtros disponíveis que podem ser úteis:

```text
marca
modelo
categoria
combustivel
propulsao
transmissao
ano
ano_min
ano_max
page
page_size
```

---

# 6. Endpoint interno — pesquisar veículos

O frontend não chama diretamente a AutoDataAPI.

Criar:

```http
GET /api/vehicles
```

Exemplo:

```http
GET /api/vehicles?marca=Peugeot&modelo=206&ano=2008
```

Backend:

```text
Frontend
   ↓
GET /api/vehicles
   ↓
VehicleCatalogService
   ↓
AutoDataVehicleProvider
   ↓
AutoDataAPI
```

---

## 6.1 Resposta interna sugerida

Não repassar o payload externo inteiro para a interface.

Normalizar:

```json
{
  "items": [
    {
      "id": "uuid",
      "brand": "Peugeot",
      "model": "206",
      "version": "Sensation",
      "year": 2008,
      "engine": "1.4",
      "fuelType": "Flex",
      "transmission": "Manual"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 8
  }
}
```

---

# 7. Endpoint de detalhe do veículo

API externa:

```http
GET /catalog/vehicles/{vehicle_id}
```

Esse endpoint retorna:

```text
vehicle_id
veiculo
consumo
emissoes
```

---

## 7.1 Endpoint interno

```http
GET /api/vehicles/{vehicleId}
```

O backend consulta a AutoDataAPI e transforma o resultado para o modelo interno.

Resposta sugerida:

```json
{
  "id": "uuid",
  "brand": "Peugeot",
  "model": "206",
  "version": "Sensation",
  "year": 2008,
  "engine": "1.4",
  "fuelType": "Flex",

  "consumption": {
    "gasoline": {
      "cityKmL": 10.2,
      "highwayKmL": 13.4
    },
    "ethanol": {
      "cityKmL": 7.1,
      "highwayKmL": 9.2
    }
  }
}
```

Valores nulos devem ser aceitos.

---

# 8. Seleção de veículo na interface

Fluxo recomendado:

```text
Veículo

Marca
[ Peugeot ▼ ]

Modelo
[ 206 ▼ ]

Ano
[ 2008 ▼ ]

Versão
[ Sensation 1.4 Flex ▼ ]
```

Após selecionar a versão:

```text
Consumo informado pela AutoDataAPI

Gasolina
Cidade: 10,2 km/l
Estrada: 13,4 km/l

Etanol
Cidade: 7,1 km/l
Estrada: 9,2 km/l
```

---

# 9. Consumo utilizado no cálculo

O sistema deve distinguir:

```text
Consumo de referência
```

e:

```text
Consumo utilizado
```

Exemplo:

```text
Consumo de referência
10,2 km/l

Consumo utilizado
[ 10,2 ] km/l

☐ Informar consumo real manualmente
```

Isso permite que o usuário substitua o valor oficial caso conheça o consumo real do carro.

---

# 10. Tipo de utilização

Para o MVP:

```text
Tipo de trajeto

● Urbano
○ Rodoviário
○ Personalizado
```

## Urbano

Usar:

```text
consumo_cidade
```

## Rodoviário

Usar:

```text
consumo_estrada
```

## Personalizado

Usuário informa manualmente:

```text
km/l
```

---

# 11. Evolução — trajeto misto

Não precisa entrar no primeiro MVP.

Posteriormente:

```text
Urbano       70%
Rodoviário   30%
```

Não calcular uma média simples entre os consumos.

A fórmula correta é:

```text
litros =
    km_urbano / consumo_urbano
    +
    km_rodoviario / consumo_rodoviario
```

---

# 12. Mapa e trajeto

Stack inicial:

```text
Leaflet
+
OpenStreetMap/CARTO
+
Nominatim
+
OSRM
```

---

# 13. Geocodificação

Endpoint interno:

```http
GET /api/maps/geocode?q=...
```

O backend executa a busca no provedor configurado.

Resposta:

```json
{
  "items": [
    {
      "label": "Rua Exemplo, 100, Maringá - PR",
      "latitude": -23.42,
      "longitude": -51.93
    }
  ]
}
```

Sempre que houver mais de um resultado plausível, mostrar as opções ao usuário.

---

# 14. Rotas

Criar endpoint:

```http
POST /api/maps/routes
```

Request:

```json
{
  "origin": {
    "latitude": -23.42,
    "longitude": -51.93
  },
  "destination": {
    "latitude": -23.40,
    "longitude": -51.95
  },
  "profile": "car"
}
```

Resposta:

```json
{
  "distanceKm": 5.55,
  "durationMinutes": 10.06,
  "geometry": "...",
  "provider": "osrm"
}
```

---

# 15. Regra obrigatória — ida e volta independentes

Nunca calcular:

```text
distancia_dia = distancia_ida * 2
```

Fazer duas chamadas:

```text
Casa → Trabalho
```

e:

```text
Trabalho → Casa
```

porque:

- vias podem ser de mão única;
- acessos podem mudar;
- conversões podem ser diferentes;
- retornos podem aumentar a distância.

Exemplo:

```text
Ida
5,55 km

Volta
5,22 km

Total diário
10,77 km
```

---

# 16. Exibição no mapa

Mostrar:

- marcador A — origem;
- marcador B — destino;
- rota de ida;
- rota de volta.

Sugestão:

```text
Ida    → linha contínua
Volta  → linha tracejada
```

Marcadores devem ser SVG inline para evitar dependência dos assets padrão do Leaflet.

---

# 17. Dados da rotina

Campos:

```text
Dias presenciais por semana
Semanas consideradas no mês
Dias presenciais extras
Margem adicional
```

Padrões:

```text
dias = 5
semanas = 4,33
dias_extras = 0
margem = 0%
```

---

# 18. Preço do combustível

MVP:

```text
Preço por litro
R$ [ 6,20 ]
```

O usuário informa manualmente.

Futuramente:

- API de preços;
- preço médio salvo;
- histórico de abastecimento.

---

# 19. Fórmulas

## 19.1 Total diário

```text
km_dia =
    distancia_ida
    +
    distancia_volta
```

## 19.2 Dias presenciais

```text
dias_mes =
    dias_semana * semanas_mes
    +
    dias_extras
```

## 19.3 Quilometragem mensal

```text
km_trabalho =
    km_dia * dias_mes
```

## 19.4 Margem adicional

```text
km_mes =
    km_trabalho *
    (1 + margem_pct / 100)
```

## 19.5 Litros

```text
litros_mes =
    km_mes / consumo_km_l
```

## 19.6 Custo mensal

```text
custo_mes =
    litros_mes * preco_litro
```

## 19.7 Custo por dia presencial

```text
custo_dia =
    custo_mes / dias_mes
```

## 19.8 Custo por km

```text
custo_km =
    preco_litro / consumo_km_l
```

## 19.9 Custo anual

```text
custo_ano =
    custo_mes * 12
```

---

# 20. Orçamento sugerido

Para evitar valor excessivamente justo:

```text
orcamento_sugerido =
    próximo múltiplo de R$ 10
```

Exemplo:

```text
R$ 141,36
→
R$ 150,00
```

---

# 21. Estrutura da tela

```text
CALCULADORA DE COMBUSTÍVEL
─────────────────────────────────────

VEÍCULO

Marca
[ Peugeot ]

Modelo
[ 206 ]

Ano
[ 2008 ]

Versão
[ Sensation 1.4 ]

Combustível
[ Gasolina ]

Consumo de referência
10,2 km/l

Consumo utilizado
[ 10,2 ]


TRAJETO

Origem
[ Casa ]

Destino
[ Trabalho ]

[ Calcular rotas ]

┌──────────────────────────────────┐
│              MAPA                │
│                                  │
│ A ━━━━━━━━ ida ━━━━━━━━━━━━━ B   │
│ A ┄┄┄┄┄┄┄ volta ┄┄┄┄┄┄┄┄┄ B   │
└──────────────────────────────────┘

Ida             5,55 km
Volta           5,22 km
Total diário   10,77 km


ROTINA

Dias presenciais
[ 5 ]

Semanas/mês
[ 4,33 ]

Preço combustível
R$ [ 6,20 ]


RESULTADO

233 km / mês
22,8 litros / mês
R$ 6,53 / dia

Gasto mensal
R$ 141,36

Reserva sugerida
R$ 150,00

Estimativa anual
R$ 1.696,32

[ Salvar cenário ]

[ Adicionar ao orçamento ]
```

---

# 22. Persistência — veículo do usuário

Criar tabela:

```sql
CREATE TABLE usuario_veiculo (
    id                      BIGSERIAL PRIMARY KEY,
    usuario_id              BIGINT NOT NULL,

    provider                VARCHAR(30) NOT NULL DEFAULT 'autodata',
    external_vehicle_id     VARCHAR(100),

    marca                   VARCHAR(100),
    modelo                  VARCHAR(150),
    versao                  VARCHAR(200),
    ano                     INTEGER,
    motor                   VARCHAR(100),
    combustivel_tipo        VARCHAR(50),

    consumo_cidade_gasolina NUMERIC(6,2),
    consumo_estrada_gasolina NUMERIC(6,2),

    consumo_cidade_etanol   NUMERIC(6,2),
    consumo_estrada_etanol  NUMERIC(6,2),

    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

# 23. Persistência — cenário da calculadora

```sql
CREATE TABLE cenario_combustivel (
    id                     BIGSERIAL PRIMARY KEY,
    usuario_id             BIGINT NOT NULL,
    usuario_veiculo_id     BIGINT,

    nome                   VARCHAR(100) NOT NULL,

    origem_label           VARCHAR(255),
    origem_lat             NUMERIC(10,7),
    origem_lng             NUMERIC(10,7),

    destino_label          VARCHAR(255),
    destino_lat            NUMERIC(10,7),
    destino_lng            NUMERIC(10,7),

    distancia_ida_km       NUMERIC(8,2) NOT NULL,
    distancia_volta_km     NUMERIC(8,2) NOT NULL,

    duracao_ida_min        NUMERIC(8,2),
    duracao_volta_min      NUMERIC(8,2),

    consumo_referencia_kml NUMERIC(6,2),
    consumo_utilizado_kml  NUMERIC(6,2) NOT NULL,

    combustivel_tipo       VARCHAR(50),
    preco_litro            NUMERIC(8,2) NOT NULL,

    dias_semana            NUMERIC(4,2) NOT NULL,
    semanas_mes            NUMERIC(4,2) NOT NULL DEFAULT 4.33,
    dias_extras_mes        INTEGER NOT NULL DEFAULT 0,

    margem_extra_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,

    custo_mensal_estimado  NUMERIC(10,2),
    orcamento_sugerido     NUMERIC(10,2),

    ativo                  BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Adicionar foreign keys de acordo com as tabelas existentes da plataforma.

---

# 24. Cache da AutoDataAPI

A API possui quota mensal.

Não consultar o veículo novamente toda vez que a tela abrir.

Criar cache.

## Cache de busca

```text
vehicle-search:{hash_dos_filtros}
```

TTL sugerido:

```text
24 horas
```

## Cache do detalhe

```text
vehicle:{vehicle_id}
```

TTL sugerido:

```text
7 dias
```

Dados de catálogo automotivo não tendem a mudar em intervalos curtos.

---

# 25. Estratégia alternativa de cache

Também é possível persistir localmente veículos consultados.

Tabela opcional:

```text
vehicle_catalog_cache
```

Campos:

```text
provider
external_id
payload_json
cached_at
expires_at
```

Isso evita consumir quota para veículos já conhecidos.

---

# 26. Tratamento de falhas da AutoDataAPI

## Veículo não encontrado

Permitir:

```text
[ Informar veículo manualmente ]
```

## Consumo não disponível

Mostrar:

```text
A API não possui consumo de referência para este veículo.

Informe o consumo médio:
[      ] km/l
```

## API indisponível

Se o veículo já estiver salvo:

```text
usar último dado armazenado
```

Se não:

```text
permitir entrada manual
```

A calculadora nunca deve ficar totalmente inutilizável por falha da API.

---

# 27. Tratamento de quota

Possível resposta:

```http
429
```

Não repassar mensagem técnica para o usuário.

Backend:

```text
QUOTA_EXCEEDED
```

Frontend:

```text
Não foi possível consultar o catálogo de veículos neste momento.
Você ainda pode informar o consumo manualmente.
```

---

# 28. Segurança

Obrigatório:

- AutoData API Secret apenas no backend;
- variáveis de ambiente;
- nunca registrar Secret em logs;
- nunca enviar Secret para browser;
- timeout em requisições externas;
- retry controlado;
- rate limiting interno;
- validação dos filtros;
- sanitização dos parâmetros.

---

# 29. Privacidade do trajeto

Origem pode representar endereço residencial.

Recomendações:

- não registrar query completa em logs;
- não salvar endereço se usuário não salvar cenário;
- ao salvar, informar que o trajeto ficará armazenado;
- permitir nome amigável:

```text
Casa
Trabalho
```

- avaliar guardar somente coordenadas + descrição curta.

---

# 30. API interna consolidada

Sugestão de endpoints:

```text
GET  /api/vehicles
GET  /api/vehicles/{id}

GET  /api/user/vehicles
POST /api/user/vehicles
PUT  /api/user/vehicles/{id}
DELETE /api/user/vehicles/{id}

GET  /api/maps/geocode
POST /api/maps/routes

GET  /api/fuel-scenarios
GET  /api/fuel-scenarios/{id}
POST /api/fuel-scenarios
PUT  /api/fuel-scenarios/{id}
DELETE /api/fuel-scenarios/{id}

POST /api/fuel-scenarios/{id}/send-to-budget
```

---

# 31. Responsabilidades dos serviços

## VehicleCatalogService

```text
pesquisar veículos
obter detalhe
normalizar resposta
aplicar cache
tratar quota
```

## RouteService

```text
calcular ida
calcular volta
normalizar distância
normalizar duração
```

## FuelCalculatorService

```text
calcular km mensal
calcular litros
calcular custo
calcular orçamento sugerido
```

Esse serviço deve ser uma função pura sempre que possível.

## BudgetService

```text
criar previsão
atualizar previsão
relacionar cenário
```

---

# 32. Função principal da calculadora

Exemplo:

```typescript
calculateFuelCost({
  outboundDistanceKm,
  returnDistanceKm,

  daysPerWeek,
  weeksPerMonth,
  extraDays,

  consumptionKmL,
  fuelPrice,

  extraMarginPercent
})
```

Retorno:

```json
{
  "dailyDistanceKm": 10.77,
  "workingDaysMonth": 21.65,
  "monthlyDistanceKm": 233.17,
  "monthlyLiters": 22.86,
  "costPerKm": 0.61,
  "costPerWorkingDay": 6.53,
  "monthlyCost": 141.73,
  "suggestedBudget": 150,
  "annualCost": 1700.76
}
```

---

# 33. Integração com fluxo de caixa/orçamento

Criar ação:

```text
Adicionar ao orçamento
```

Enviar:

```json
{
  "category": "Transporte",
  "subcategory": "Combustível",
  "description": "Combustível - Trabalho",
  "amount": 150,
  "recurrence": "monthly",
  "type": "forecast",
  "source": "fuel-calculator"
}
```

Ajustar nomes conforme o modelo atual da plataforma.

---

# 34. Previsto x realizado

Importante manter separação:

```text
PREVISTO
R$ 150,00
```

versus:

```text
REALIZADO
R$ 137,45
```

Isso permitirá futuramente comparar:

```text
Planejado x Real
```

---

# 35. Estados da UI

## Inicial

```text
Selecione seu veículo e informe seu trajeto.
```

## Buscando veículo

```text
Consultando catálogo...
```

## Calculando rota

```text
Calculando rota de ida...
Calculando rota de volta...
```

## Calculando valores

Instantâneo no frontend.

## Erro externo

Sempre manter possibilidade de preenchimento manual.

---

# 36. Performance

Evitar:

```text
request a cada tecla digitada
```

Para busca:

- debounce;
- mínimo de 2 ou 3 caracteres;
- botão pesquisar ou autocomplete controlado;
- cache.

---

# 37. Logs

Registrar:

```text
provider
endpoint interno
tempo da chamada
status
cache hit/miss
request_id externo, se disponível
```

Não registrar:

```text
API Secret
endereço residencial completo
payload sensível sem necessidade
```

---

# 38. Observabilidade

Métricas úteis:

```text
vehicle_api_requests
vehicle_api_cache_hits
vehicle_api_errors

route_requests
route_errors

fuel_calculations
fuel_scenarios_saved
fuel_scenarios_sent_to_budget
```

---

# 39. Testes unitários

## Calculadora

- ida diferente de volta;
- zero dias;
- consumo zero;
- preço zero;
- margem;
- arredondamento;
- troca de combustível.

## VehicleCatalogService

- veículo encontrado;
- veículo sem consumo;
- campos nulos;
- timeout;
- 401/403;
- 429;
- resposta inválida.

## RouteService

- ida válida;
- volta válida;
- ida e volta diferentes;
- endereço sem rota;
- timeout.

---

# 40. Testes de integração

```text
Frontend
→ backend
→ AutoDataAPI
```

Testar:

- filtros;
- detalhe do veículo;
- normalização;
- cache.

Também:

```text
Frontend
→ geocode
→ route
→ calculation
```

---

# 41. Critérios de aceite do MVP

## Veículo

- [ ] Usuário pesquisa veículo.
- [ ] Usuário filtra por marca/modelo/ano.
- [ ] Usuário seleciona uma versão.
- [ ] Sistema consulta detalhe.
- [ ] Sistema obtém consumo quando disponível.
- [ ] Usuário pode alterar o consumo manualmente.
- [ ] Credenciais não ficam no frontend.

## Trajeto

- [ ] Usuário informa origem.
- [ ] Usuário informa destino.
- [ ] Sistema calcula ida.
- [ ] Sistema calcula volta separadamente.
- [ ] Sistema exibe ambas no mapa.
- [ ] Sistema mostra distância/duração por sentido.

## Cálculo

- [ ] Sistema calcula km/mês.
- [ ] Sistema calcula litros/mês.
- [ ] Sistema calcula custo/dia.
- [ ] Sistema calcula custo/mês.
- [ ] Sistema calcula custo/ano.
- [ ] Sistema sugere orçamento mensal.

## Persistência

- [ ] Usuário salva veículo.
- [ ] Usuário salva cenário.
- [ ] Cenário pode ser reaberto.
- [ ] Valor pode ser enviado para orçamento.

---

# 42. Fases de implementação

## Fase 1 — Serviços

Criar:

```text
VehicleCatalogService
AutoDataVehicleProvider
RouteService
OSRMRouteProvider
GeocodingService
FuelCalculatorService
```

---

## Fase 2 — API interna

Implementar:

```text
/api/vehicles
/api/vehicles/:id
/api/maps/geocode
/api/maps/routes
```

---

## Fase 3 — Frontend

Implementar:

```text
seleção do veículo
consumo automático
mapa
ida + volta
rotina
preço
resultados
```

---

## Fase 4 — Persistência

```text
usuario_veiculo
cenario_combustivel
```

---

## Fase 5 — Orçamento

Criar integração:

```text
cenario
→
previsão mensal
```

---

# 43. Ordem recomendada de desenvolvimento

```text
1. VehicleCatalogService
        ↓
2. Endpoint /api/vehicles
        ↓
3. Endpoint /api/vehicles/:id
        ↓
4. Seleção de veículo no frontend
        ↓
5. consumo automático
        ↓
6. integrar mapa existente
        ↓
7. rota ida
        ↓
8. rota volta
        ↓
9. FuelCalculatorService
        ↓
10. tela de resultado
        ↓
11. salvar veículo
        ↓
12. salvar cenário
        ↓
13. enviar para orçamento
```

---

# 44. O que não deve entrar no primeiro MVP

Deixar para versões futuras:

- preço automático de combustível;
- trânsito em tempo real;
- rotas alternativas;
- GPS;
- histórico de abastecimentos;
- consumo real automático;
- calendário de feriados;
- férias;
- home office por data;
- cálculo detalhado de manutenção;
- pedágios;
- estacionamento;
- custo de depreciação.

---

# 45. Evoluções futuras

## Histórico de abastecimento

Usuário informa:

```text
odômetro
litros
valor
```

Sistema calcula:

```text
consumo real
```

e permite trocar:

```text
Consumo AutoData
10,2 km/l

Consumo real
9,4 km/l
```

---

## Custo total do veículo

Futuramente incluir:

```text
combustível
manutenção
seguro
IPVA
licenciamento
estacionamento
pedágio
```

permitindo calcular:

```text
Custo mensal real do carro
```

---

# 46. Decisões técnicas principais

Para o MVP:

```text
AutoDataAPI
→ catálogo e consumo
```

```text
Leaflet
→ mapa
```

```text
Nominatim
→ geocodificação
```

```text
OSRM
→ ida e volta
```

```text
PostgreSQL
→ persistência
```

```text
Backend existente
→ proxy e proteção das APIs
```

---

# 47. Resultado esperado do MVP

Ao final, o usuário deverá conseguir:

> selecionar seu veículo, obter automaticamente seu consumo médio, definir no mapa o trajeto casa ↔ trabalho, calcular rotas diferentes de ida e volta e transformar essas informações em uma previsão mensal de combustível integrada ao orçamento da plataforma.

