import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const ALLOWED_CARGOS = new Set([
  "Tecnico de seguranca",
  "Engenheiro de seguranca",
  "Coordenador de seguranca",
  "Analista de SSMA",
  "Supervisor de operacoes",
]);

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
    const password = String(body.password ?? "");
    const cargo = String(body.cargo ?? "");

    if (name.length < 2) throw new Error("Nome invalido.");
    if (!EMAIL_REGEX.test(email)) throw new Error("E-mail invalido.");
    if (!STRONG_PASSWORD.test(password)) {
      throw new Error("Senha deve ter min. 10 chars com maiuscula, minuscula e numero.");
    }
    if (!ALLOWED_CARGOS.has(cargo)) throw new Error("Cargo invalido.");

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
      await supabase.auth.admin.deleteUser(newUserId);
      throw new Error(opErr.message);
    }

    return new Response(JSON.stringify({ success: true, id: newUserId }), {
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
