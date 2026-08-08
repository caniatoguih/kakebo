type Props = { id: string; message?: string };

export function FormFieldError({ id, message }: Props) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs font-medium text-destructive">{message}</p>;
}
