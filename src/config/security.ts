const MINIMUM_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < MINIMUM_JWT_SECRET_LENGTH || secret === 'secret') {
    throw new Error(`JWT_SECRET deve possuir pelo menos ${MINIMUM_JWT_SECRET_LENGTH} caracteres.`);
  }

  return secret;
}
