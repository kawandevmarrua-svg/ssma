import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-semibold">404</h2>
      <p className="text-sm text-muted-foreground">Página não encontrada.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Voltar ao painel
      </Link>
    </div>
  );
}
