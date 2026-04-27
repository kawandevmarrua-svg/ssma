import dynamic from 'next/dynamic';

const AcompanhamentoClient = dynamic(() => import('./AcompanhamentoClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[80vh] items-center justify-center text-sm text-muted-foreground">
      Carregando mapa...
    </div>
  ),
});

export default function AcompanhamentoPage() {
  return <AcompanhamentoClient />;
}
