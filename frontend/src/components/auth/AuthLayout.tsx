import type { ReactNode } from 'react';
import { BookOpenCheck, ChartNoAxesCombined, HeartHandshake } from 'lucide-react';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { KakeboLogo } from '@/components/brand/KakeboLogo';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';

const benefits = [
  { icon: ChartNoAxesCombined, text: 'Entenda para onde seu dinheiro está indo.' },
  { icon: BookOpenCheck, text: 'Planeje o mês de acordo com suas prioridades.' },
  { icon: HeartHandshake, text: 'Reflita sobre suas escolhas sem julgamentos.' },
];

type AuthLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ eyebrow, title, description, children }: AuthLayoutProps) {
  return <div className="relative min-h-svh bg-background p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)] lg:gap-6">
    <ThemeToggle className="absolute right-5 top-5 z-10 border border-border/70 bg-card/80 shadow-sm backdrop-blur sm:right-7 sm:top-7" />
    <section className="relative hidden min-h-[calc(100svh-3rem)] overflow-hidden rounded-xl border border-border/40 bg-brand-panel p-10 text-brand-panel-foreground lg:flex lg:flex-col xl:p-14" aria-label="Sobre o Kakebo">
      <BrandPattern className="pointer-events-none absolute -bottom-10 -right-8 h-80 w-[30rem] text-brand-panel-foreground opacity-10" />
      <div className="relative">
        <KakeboLogo variant="inverse" size="lg" className="max-w-52" />
      </div>

      <div className="relative my-auto max-w-xl py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-panel-foreground/70">Caderno consciente</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Entenda hoje.<br />Planeje amanhã.</h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-brand-panel-foreground/75 xl:text-lg">Mais do que acompanhar números, o Kakebo ajuda você a construir uma relação consciente com o seu dinheiro.</p>

        <ul className="mt-9 space-y-4">
          {benefits.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-sm font-medium text-brand-panel-foreground/90">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-panel-foreground/10"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span>{text}</span>
          </li>)}
        </ul>
      </div>

      <blockquote className="relative max-w-lg border-l-2 border-brand-panel-foreground/35 pl-4 font-display text-sm leading-relaxed text-brand-panel-foreground/70">
        “Pequenas escolhas conscientes transformam o caminho inteiro.”
      </blockquote>
    </section>

    <main className="flex min-h-[calc(100svh-2rem)] items-center justify-center py-4 sm:min-h-[calc(100svh-3rem)] lg:py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center lg:hidden">
          <KakeboLogo size="lg" className="max-w-48" />
        </div>
        <Card className="border-border/70">
          <CardHeader className="space-y-3 pb-6 text-center sm:px-8 sm:pt-8 lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            <CardDescription className="text-sm leading-relaxed sm:text-base">{description}</CardDescription>
          </CardHeader>
          {children}
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">Seus dados financeiros permanecem privados e protegidos.</p>
      </div>
    </main>
  </div>;
}
