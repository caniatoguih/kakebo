import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormFieldError } from '@/components/FormFieldError';
import { Label } from '@/components/ui/label';
import { notify } from '@/components/FeedbackHost';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';

const cadastroSchema = z.object({
  nome: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export function Cadastro() {
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  });

  const onSubmit = async (data: CadastroForm) => {
    try {
      setErrorMsg('');
      await authService.register(data);
      notify('Cadastro realizado com sucesso! Faça seu login.', 'success');
      navigate('/login');
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || 'Erro ao realizar cadastro.');
    }
  };

  return (
    <AuthLayout eyebrow="Comece sua jornada" title="Crie seu Kakebo" description="Organize suas finanças com clareza e transforme planejamento em um hábito consciente.">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 sm:px-8">
          {errorMsg && <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{errorMsg}</div>}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" autoComplete="name" placeholder="Seu nome completo" aria-invalid={!!errors.nome} aria-describedby={errors.nome ? 'register-name-error' : undefined} {...register('nome')} />
            <FormFieldError id="register-name-error" message={errors.nome?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'register-email-error' : undefined} {...register('email')} />
            <FormFieldError id="register-email-error" message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <PasswordInput id="senha" autoComplete="new-password" placeholder="Crie uma senha forte" aria-invalid={!!errors.senha} aria-describedby={errors.senha ? 'register-password-error' : undefined} {...register('senha')} />
            <FormFieldError id="register-password-error" message={errors.senha?.message} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 sm:px-8 sm:pb-8">
          <Button type="submit" className="w-full text-base" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Cadastrando...' : 'Criar Conta'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Já tem uma conta? <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fazer Login</Link>
          </div>
        </CardFooter>
      </form>
    </AuthLayout>
  );
}
