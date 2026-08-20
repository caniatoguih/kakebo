import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackHost } from './components/FeedbackHost';
import { PwaStatus } from './components/PwaStatus';
import { PaymentReminderNotifications } from './components/PaymentReminderNotifications';
import { KakeboSymbol } from './components/brand/KakeboSymbol';
import { Skeleton } from './components/ui/skeleton';

// Lazy loading components
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Transacoes = React.lazy(() => import('./pages/Transacoes').then(m => ({ default: m.Transacoes })));
const Planejamento = React.lazy(() => import('./pages/Planejamento').then(m => ({ default: m.Planejamento })));
const ConsumoCombustivel = React.lazy(() => import('./pages/ConsumoCombustivel').then(m => ({ default: m.ConsumoCombustivel })));
const PlanejamentoSalario = React.lazy(() => import('./pages/PlanejamentoSalario').then(m => ({ default: m.PlanejamentoSalario })));
const Contas = React.lazy(() => import('./pages/Contas').then(m => ({ default: m.Contas })));
const Categorias = React.lazy(() => import('./pages/Categorias').then(m => ({ default: m.Categorias })));
const FluxoContabil = React.lazy(() => import('./pages/FluxoContabil').then(m => ({ default: m.FluxoContabil })));
const Recorrencias = React.lazy(() => import('./pages/Recorrencias').then(m => ({ default: m.Recorrencias })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Cadastro = React.lazy(() => import('./pages/Cadastro').then(m => ({ default: m.Cadastro })));
const Notificacoes = React.lazy(() => import('./pages/Notificacoes').then(m => ({ default: m.Notificacoes })));
const EsqueciSenha = React.lazy(() => import('./pages/EsqueciSenha').then(m => ({ default: m.EsqueciSenha })));
const RedefinirSenha = React.lazy(() => import('./pages/RedefinirSenha').then(m => ({ default: m.RedefinirSenha })));

const queryClient = new QueryClient();

// Private Route Wrapper
function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Redirect if already logged in
function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

// Loading Fallback
const LoadingFallback = () => (
  <div className="flex min-h-screen bg-background p-4" aria-label="Carregando Kakebo">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-xl border bg-card p-6 shadow-card">
      <div className="flex items-center gap-3"><KakeboSymbol className="h-10 w-10" /><Skeleton className="h-6 w-32" /></div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}</div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <FeedbackHost />
            <PwaStatus />
            <PaymentReminderNotifications />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/cadastro" element={<Cadastro />} />
                  <Route path="/esqueci-senha" element={<EsqueciSenha />} />
                  <Route path="/redefinir-senha" element={<RedefinirSenha />} />
                </Route>

                {/* Private Routes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="transacoes" element={<Transacoes />} />
                    <Route path="planejamento" element={<Planejamento />} />
                    <Route path="planejamento/combustivel" element={<ConsumoCombustivel />} />
                    <Route path="planejamento/salario" element={<PlanejamentoSalario />} />
                    <Route path="fluxo-contabil" element={<FluxoContabil />} />
                    <Route path="contas" element={<Contas />} />
                    <Route path="categorias" element={<Categorias />} />
                    <Route path="recorrencias" element={<Recorrencias />} />
                    <Route path="notificacoes" element={<Notificacoes />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
