import nodemailer from 'nodemailer';

type PasswordResetEmail = {
  recipient: string;
  recipientName: string;
  token: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel de ambiente ${name} nao configurada.`);
  return value;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function passwordResetUrl(token: string): string {
  const appUrl = new URL(requiredEnv('APP_URL'));
  if (!['http:', 'https:'].includes(appUrl.protocol)) {
    throw new Error('APP_URL deve usar HTTP ou HTTPS.');
  }
  const resetUrl = new URL('/redefinir-senha', appUrl);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

export async function sendPasswordResetEmail({ recipient, recipientName, token }: PasswordResetEmail): Promise<void> {
  const port = Number(requiredEnv('SMTP_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT deve ser uma porta valida.');
  }

  const transporter = nodemailer.createTransport({
    host: requiredEnv('SMTP_HOST'),
    port,
    secure: parseBoolean(process.env.SMTP_SECURE),
    requireTLS: !parseBoolean(process.env.SMTP_SECURE),
    auth: {
      user: requiredEnv('SMTP_USER'),
      pass: requiredEnv('SMTP_PASSWORD'),
    },
  });

  const resetUrl = passwordResetUrl(token);
  const safeName = escapeHtml(recipientName);

  await transporter.sendMail({
    from: requiredEnv('EMAIL_FROM'),
    to: recipient,
    subject: 'Redefina sua senha do Kakebo',
    text: [
      `Ola, ${recipientName}.`,
      '',
      'Recebemos uma solicitacao para redefinir sua senha do Kakebo.',
      `Acesse este link em ate 30 minutos: ${resetUrl}`,
      '',
      'Se voce nao fez essa solicitacao, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Redefina sua senha</h1>
        <p>Ola, ${safeName}.</p>
        <p>Recebemos uma solicitacao para redefinir sua senha do Kakebo.</p>
        <p style="margin: 28px 0;">
          <a href="${escapeHtml(resetUrl)}" style="background: #315c4c; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 700;">Criar nova senha</a>
        </p>
        <p>Este link expira em 30 minutos e so pode ser utilizado uma vez.</p>
        <p style="color: #6b7280; font-size: 14px;">Se voce nao fez essa solicitacao, ignore este e-mail.</p>
      </div>
    `,
  });
}
