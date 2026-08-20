import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormFieldError } from '@/components/FormFieldError';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const [errorMsg, setErrorMsg] = useState(() => {
    const expired = sessionStorage.getItem('kakebo:session-expired') === 'true';
    if (expired) sessionStorage.removeItem('kakebo:session-expired');
    return expired ? 'Sua sessão expirou. Entre novamente para continuar.' : '';
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setErrorMsg('');
      const res = await authService.login(data);
      login(res.usuario);
      navigate('/dashboard');
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || 'Erro ao realizar login.');
    }
  };

  return (
    <AuthLayout eyebrow="Seu caderno financeiro" title="Boas-vindas de volta" description="Acesse seu Kakebo para acompanhar, planejar e refletir sobre suas escolhas.">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 sm:px-8">
          {errorMsg && <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{errorMsg}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'login-email-error' : undefined} {...register('email')} />
            <FormFieldError id="login-email-error" message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="senha">Senha</Label>
              <Link to="/esqueci-senha" className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput id="senha" autoComplete="current-password" placeholder="••••••••" aria-invalid={!!errors.senha} aria-describedby={errors.senha ? 'login-password-error' : undefined} {...register('senha')} />
            <FormFieldError id="login-password-error" message={errors.senha?.message} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 sm:px-8 sm:pb-8">
          <Button type="submit" className="w-full text-base" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Não tem uma conta? <Link to="/cadastro" className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cadastre-se</Link>
          </div>
        </CardFooter>
      </form>
    </AuthLayout>
  );
}
