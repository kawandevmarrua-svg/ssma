import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Origins permitidas. Defina ALLOWED_ORIGINS como CSV nas envs da function.
 * Ex: "https://painel.empresa.com,https://app.empresa.com"
 * Em desenvolvimento, inclua "http://localhost:3000".
 */
function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const BASE_CORS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Vary": "Origin",
};

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();

  // Se nenhuma origem foi configurada via env, libera geral. A funcao
  // ainda exige Authorization Bearer valido, entao CORS aqui nao protege
  // recursos — apenas evita que browsers bloqueiem chamadas legitimas.
  if (allowed.length === 0) {
    return { ...BASE_CORS, "Access-Control-Allow-Origin": origin || "*" };
  }

  if (origin && allowed.includes(origin)) {
    return { ...BASE_CORS, "Access-Control-Allow-Origin": origin };
  }

  // Origin nao permitida: nao devolvemos o header.
  // O browser bloqueia, e chamadas server-to-server sem origin (trigger SQL,
  // cron) ainda funcionam.
  return { ...BASE_CORS };
}

export interface AuthResult {
  user: { id: string; email?: string } | null;
  role: string;
  internal: boolean;
  serviceClient: SupabaseClient;
  userClient: SupabaseClient | null;
}

function decodeJwtPayload(token: string): { role?: string; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Valida JWT do header Authorization, busca o profile e retorna clients.
 *
 * Aceita 2 modos:
 *  - Usuario: JWT pertence a um auth.users; valida role contra `allowedRoles`.
 *  - Internal: JWT eh o service_role do projeto E o header `X-Internal-Secret`
 *    confere com `INTERNAL_FUNCTION_SECRET`. Usado por triggers SQL/pg_net e cron.
 */
export async function authenticate(req: Request, allowedRoles: string[]): Promise<
  | { ok: true; data: AuthResult }
  | { ok: false; status: number; error: string }
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return { ok: false, status: 500, error: "Server misconfigured" };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const claims = decodeJwtPayload(token);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Internal: chamada server-to-server (trigger SQL, cron, scheduler).
  if (claims?.role === "service_role") {
    const provided = req.headers.get("x-internal-secret") ?? "";
    if (!internalSecret || provided !== internalSecret) {
      return { ok: false, status: 403, error: "Internal secret required" };
    }
    return {
      ok: true,
      data: {
        user: null,
        role: "service_role",
        internal: true,
        serviceClient,
        userClient: null,
      },
    };
  }

  // Caminho usuario: valida JWT e role.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid token" };
  }

  const { data: profile, error: profileErr } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileErr || !profile) {
    return { ok: false, status: 403, error: "Profile not found" };
  }

  if (!allowedRoles.includes(profile.role)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return {
    ok: true,
    data: {
      user: { id: userData.user.id, email: userData.user.email },
      role: profile.role,
      internal: false,
      serviceClient,
      userClient,
    },
  };
}
