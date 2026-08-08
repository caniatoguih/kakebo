import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormFieldError } from '@/components/FormFieldError';
import { Label } from '@/components/ui/label';
import { notify } from '@/components/FeedbackHost';

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
    <div className="flex h-screen w-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center tracking-tight">Criar Conta</CardTitle>
          <CardDescription className="text-center">Junte-se ao Kakebo para controlar suas finanças</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {errorMsg && <div role="alert" className="p-3 bg-destructive/15 text-destructive text-sm rounded-md font-medium">{errorMsg}</div>}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder="Seu nome completo" aria-invalid={!!errors.nome} aria-describedby={errors.nome ? 'register-name-error' : undefined} {...register('nome')} />
              <FormFieldError id="register-name-error" message={errors.nome?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'register-email-error' : undefined} {...register('email')} />
              <FormFieldError id="register-email-error" message={errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" placeholder="Crie uma senha forte" aria-invalid={!!errors.senha} aria-describedby={errors.senha ? 'register-password-error' : undefined} {...register('senha')} />
              <FormFieldError id="register-password-error" message={errors.senha?.message} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-base py-6" disabled={isSubmitting}>
              {isSubmitting ? 'Cadastrando...' : 'Criar Conta'}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta? <Link to="/login" className="text-primary font-medium hover:underline">Fazer Login</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
