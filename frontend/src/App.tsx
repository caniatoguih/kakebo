import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy loading components
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Transacoes = React.lazy(() => import('./pages/Transacoes').then(m => ({ default: m.Transacoes })));
const Planejamento = React.lazy(() => import('./pages/Planejamento').then(m => ({ default: m.Planejamento })));
const Contas = React.lazy(() => import('./pages/Contas').then(m => ({ default: m.Contas })));
const Categorias = React.lazy(() => import('./pages/Categorias').then(m => ({ default: m.Categorias })));
const FluxoContabil = React.lazy(() => import('./pages/FluxoContabil').then(m => ({ default: m.FluxoContabil })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Cadastro = React.lazy(() => import('./pages/Cadastro').then(m => ({ default: m.Cadastro })));

const queryClient = new QueryClient();

// Private Route Wrapper
function PrivateRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Redirect if already logged in
function PublicRoute() {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

// Loading Fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/cadastro" element={<Cadastro />} />
                </Route>

                {/* Private Routes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="transacoes" element={<Transacoes />} />
                    <Route path="planejamento" element={<Planejamento />} />
                    <Route path="fluxo-contabil" element={<FluxoContabil />} />
                    <Route path="contas" element={<Contas />} />
                    <Route path="categorias" element={<Categorias />} />
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
