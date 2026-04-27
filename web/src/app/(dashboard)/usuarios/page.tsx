import { createClient } from '@/lib/supabase/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserForm } from './user-form';

export const dynamic = 'force-dynamic';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
  created_at: string;
}

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, cargo, ativo, created_at')
    .order('created_at', { ascending: false });

  const usuarios = (data ?? []) as Usuario[];
  const tableMissing =
    !!error &&
    (error.code === 'PGRST205' ||
      /schema cache/i.test(error.message) ||
      /usuarios/i.test(error.message));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro de usuários do sistema web e seus cargos.
          </p>
        </div>
        <UserForm />
      </div>

      {tableMissing && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Tabela <code>usuarios</code> não encontrada
            </CardTitle>
            <CardDescription>
              Crie a tabela no Supabase antes de cadastrar usuários. Abra o SQL Editor e execute o
              script abaixo:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
{`create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  cargo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create policy "usuarios_select_authenticated"
  on public.usuarios for select
  to authenticated using (true);

create policy "usuarios_insert_authenticated"
  on public.usuarios for insert
  to authenticated with check (true);`}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários cadastrados</CardTitle>
          <CardDescription>
            {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !tableMissing ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar a lista de usuários. Tente novamente em instantes.
            </p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">E-mail</th>
                    <th className="py-2 pr-4 font-medium">Cargo</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{u.nome}</td>
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">{u.cargo}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' +
                            (u.ativo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600')
                          }
                        >
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
