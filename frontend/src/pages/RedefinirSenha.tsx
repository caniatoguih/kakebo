import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CircleCheckBig } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { FormFieldError } from '@/components/FormFieldError';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';

const resetPasswordSchema = z.object({
  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128),
  confirmarSenha: z.string(),
}).refine((data) => data.senha === data.confirmarSenha, {
  path: ['confirmarSenha'],
  message: 'As senhas não coincidem',
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const validTokenFormat = /^[a-f0-9]{64}$/i.test(token);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async ({ senha }: ResetPasswordForm) => {
    try {
      setErrorMessage('');
      const response = await authService.resetPassword(token, senha);
      setSuccessMessage(response.message);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Não foi possível redefinir a senha. Solicite um novo link.');
    }
  };

  return (
    <AuthLayout
      eyebrow="Segurança da conta"
      title="Crie uma nova senha"
      description="Escolha uma senha com pelo menos 8 caracteres para voltar ao seu Kakebo."
    >
      {successMessage ? (
        <>
          <CardContent className="sm:px-8">
            <div role="status" className="flex gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm">
              <CircleCheckBig className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div><p className="font-semibold">Senha atualizada</p><p className="mt-1 text-muted-foreground">{successMessage}</p></div>
            </div>
          </CardContent>
          <CardFooter className="sm:px-8 sm:pb-8">
            <Button asChild className="w-full" size="lg"><Link to="/login">Entrar no Kakebo</Link></Button>
          </CardFooter>
        </>
      ) : !validTokenFormat ? (
        <>
          <CardContent className="sm:px-8">
            <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">O link de recuperação está incompleto ou é inválido.</div>
          </CardContent>
          <CardFooter className="sm:px-8 sm:pb-8">
            <Button asChild className="w-full" size="lg"><Link to="/esqueci-senha">Solicitar novo link</Link></Button>
          </CardFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5 sm:px-8">
            {errorMessage && <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{errorMessage}</div>}
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput id="new-password" autoComplete="new-password" autoFocus aria-invalid={!!errors.senha} aria-describedby={errors.senha ? 'new-password-error' : undefined} {...register('senha')} />
              <FormFieldError id="new-password-error" message={errors.senha?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirme a nova senha</Label>
              <PasswordInput id="confirm-password" autoComplete="new-password" aria-invalid={!!errors.confirmarSenha} aria-describedby={errors.confirmarSenha ? 'confirm-password-error' : undefined} {...register('confirmarSenha')} />
              <FormFieldError id="confirm-password-error" message={errors.confirmarSenha?.message} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:px-8 sm:pb-8">
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Atualizando...' : 'Redefinir senha'}
            </Button>
            <Link to="/login" className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voltar para o login</Link>
          </CardFooter>
        </form>
      )}
    </AuthLayout>
  );
}
