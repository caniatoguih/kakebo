import { cn } from '@/lib/utils';

export function BrandPattern({ className }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 240 140" className={cn('text-primary', className)} fill="none">
    <path d="M26 132c8-49 38-80 91-103M77 93c-20-2-35-12-44-30 22-4 40 3 54 20M110 58c-2-20 6-37 24-50 7 21 2 40-14 56M138 115c18-32 43-54 75-67M171 86c-2-17 5-31 20-42 6 18 2 33-11 47M155 101c-15 0-27-7-36-20 17-5 31 0 42 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
