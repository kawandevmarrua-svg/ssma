import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export function PlaceholderPage({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Construction className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Em construção</CardTitle>
            <CardDescription>Será implementado em {phase}.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta seção faz parte do roadmap definido em <code>mudança.md</code>.
        </CardContent>
      </Card>
    </div>
  );
}
