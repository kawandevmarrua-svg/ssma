import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_CARGOS = new Set([
  "Tecnico de seguranca",
  "Engenheiro de seguranca",
  "Coordenador de seguranca",
  "Analista de SSMA",
  "Supervisor de operacoes",
]);

/** Gera senha temporaria forte server-side (16 chars, inclui maiusc/minusc/digito/especial). */
function generateTempPassword(): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = lower + upper + digits + special;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Garante ao menos 1 de cada categoria nos primeiros 4 chars
  const pick = (set: string, byte: number) => set[byte % set.length];
  const chars = [
    pick(lower, bytes[0]),
    pick(upper, bytes[1]),
    pick(digits, bytes[2]),
    pick(special, bytes[3]),
  ];
  for (let i = 4; i < 16; i++) chars.push(pick(all, bytes[i]));
  // Embaralha com Fisher-Yates usando bytes extras de entropia
  const shuffle = crypto.getRandomValues(new Uint8Array(16));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Rate limit: max N criacoes por janela de M minutos por caller.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await authenticate(req, ["admin", "manager"]);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!auth.data.user) {
    return new Response(JSON.stringify({ error: "User context required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = auth.data.serviceClient;
  const callerId = auth.data.user.id;

  // Rate limit por caller (conta operators criados por ele na janela).
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("operators")
    .select("id", { count: "exact", head: true })
    .eq("created_by", callerId)
    .gte("created_at", since);

  if (rateErr) {
    return new Response(
      JSON.stringify({ error: "Falha ao consultar rate limit." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({
        error: `Limite de ${RATE_LIMIT_MAX} criacoes por ${
          RATE_LIMIT_WINDOW_MS / 60000
        } minutos atingido. Tente novamente mais tarde.`,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const cargo = String(body.cargo ?? "");

    if (name.length < 2) throw new Error("Nome invalido.");
    if (!EMAIL_REGEX.test(email)) throw new Error("E-mail invalido.");
    if (!ALLOWED_CARGOS.has(cargo)) throw new Error("Cargo invalido.");

    // Senha gerada server-side — nunca trafega no request body.
    const password = generateTempPassword();

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        must_reset_password: true,
        password_set_by_admin: true,
      },
    });

    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuario.");
    }

    const newUserId = created.user.id;

    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: newUserId,
      email,
      full_name: name,
      role: "operator",
    });

    if (profileErr) {
      await supabase.auth.admin.deleteUser(newUserId);
      throw new Error(profileErr.message);
    }

    const { error: opErr } = await supabase.from("operators").insert({
      name,
      email,
      role: cargo,
      created_by: callerId,
      auth_user_id: newUserId,
      active: true,
    });

    if (opErr) {
      await supabase.from("profiles").delete().eq("id", newUserId);
      await supabase.auth.admin.deleteUser(newUserId);
      throw new Error(opErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      id: newUserId,
      tempPassword: password,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
