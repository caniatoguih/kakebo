import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormFieldError } from '@/components/FormFieldError';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';

const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function EsqueciSenha() {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async ({ email }: ForgotPasswordForm) => {
    try {
      setErrorMessage('');
      const response = await authService.forgotPassword(email);
      setSuccessMessage(response.message);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Não foi possível solicitar a recuperação agora. Tente novamente.');
    }
  };

  return (
    <AuthLayout
      eyebrow="Recuperação de acesso"
      title="Esqueceu sua senha?"
      description="Informe seu e-mail e enviaremos um link seguro para você criar uma nova senha."
    >
      {successMessage ? (
        <>
          <CardContent className="space-y-5 sm:px-8">
            <div role="status" className="flex gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Verifique sua caixa de entrada</p>
                <p className="mt-1 text-muted-foreground">{successMessage}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Confira também a pasta de spam. O link ficará disponível por 30 minutos.</p>
          </CardContent>
          <CardFooter className="sm:px-8 sm:pb-8">
            <Button asChild className="w-full" size="lg"><Link to="/login">Voltar para o login</Link></Button>
          </CardFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5 sm:px-8">
            {errorMessage && <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{errorMessage}</div>}
            <div className="space-y-2">
              <Label htmlFor="recovery-email">E-mail</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                autoFocus
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'recovery-email-error' : undefined}
                {...register('email')}
              />
              <FormFieldError id="recovery-email-error" message={errors.email?.message} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:px-8 sm:pb-8">
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
            <Link to="/login" className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voltar para o login</Link>
          </CardFooter>
        </form>
      )}
    </AuthLayout>
  );
}
