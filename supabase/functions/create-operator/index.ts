import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hierarquia de roles: cada role só pode criar roles abaixo de si.
// admin pode criar qualquer role, incluindo outro admin.
const CREATABLE_ROLES: Record<string, string[]> = {
  encarregado: ["operator"],
  supervisor:  ["operator", "encarregado"],
  manager:     ["operator", "encarregado", "supervisor"],
  admin:       ["operator", "encarregado", "supervisor", "manager", "admin"],
};

/** Gera senha temporária forte server-side (16 chars, inclui maiusc/minusc/digito/especial). */
function generateTempPassword(): string {
  const lower   = "abcdefghijkmnopqrstuvwxyz";
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits  = "23456789";
  const special = "!@#$%&*";
  const all     = lower + upper + digits + special;
  const bytes   = crypto.getRandomValues(new Uint8Array(16));
  const pick    = (set: string, byte: number) => set[byte % set.length];
  const chars   = [
    pick(lower,   bytes[0]),
    pick(upper,   bytes[1]),
    pick(digits,  bytes[2]),
    pick(special, bytes[3]),
  ];
  for (let i = 4; i < 16; i++) chars.push(pick(all, bytes[i]));
  const shuffle = crypto.getRandomValues(new Uint8Array(16));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Rate limit: max 10 criações por 10 minutos por caller.
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;

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

  const auth = await authenticate(req, ["admin", "manager", "supervisor", "encarregado"]);
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

  const supabase    = auth.data.serviceClient;
  const callerId    = auth.data.user.id;
  const callerRole  = auth.data.role;

  // Rate limit por caller (conta profiles criados por ele na janela)
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("created_by", callerId)
    .gte("created_at", since);

  if (rateErr) {
    return new Response(JSON.stringify({ error: "Servico temporariamente indisponivel." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ error: `Limite de ${RATE_LIMIT_MAX} criações por ${RATE_LIMIT_WINDOW / 60000} minutos atingido.` }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const name  = String(body.name  ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role  = String(body.role  ?? "operator");

    if (name.length < 2)          throw new Error("Nome inválido.");
    if (!EMAIL_REGEX.test(email)) throw new Error("E-mail inválido.");

    // FIX C-2: Verificar hierarquia de roles — caller só pode criar roles
    // iguais ou abaixo do seu. Sem isso, encarregado criaria admin.
    const allowed = CREATABLE_ROLES[callerRole] ?? [];
    if (!allowed.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Cargo '${role}' não pode ser criado por '${callerRole}'.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const password = generateTempPassword();

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name:              name,
        role,
        must_reset_password:    true,
        password_set_by_admin:  true,
      },
    });

    if (createErr || !created.user) {
      // FIX M-1: não expor mensagem interna do Supabase Auth
      const isEmailTaken = createErr?.message?.includes("already");
      throw new Error(isEmailTaken ? "E-mail já cadastrado." : "Falha ao criar usuário.");
    }

    const newUserId = created.user.id;

    const { error: profileErr } = await supabase.from("profiles").upsert({
      id:        newUserId,
      email,
      full_name: name,
      role,
      phone:     null,
      active:    true,
      created_by: callerId,
    });

    if (profileErr) {
      await supabase.auth.admin.deleteUser(newUserId);
      // FIX M-1: não expor schema do DB
      throw new Error("Falha ao salvar perfil do usuário.");
    }

    // FIX M-6: Registrar criação de usuário no audit log
    await supabase.from("audit_log").insert({
      user_id:       callerId,
      user_role:     callerRole,
      action:        "create_user",
      resource_type: "profiles",
      resource_id:   newUserId,
      metadata:      { target_role: role, target_email: email },
    }).then(({ error }) => {
      if (error) console.error("[create-operator] audit_log insert failed:", error.message);
    });

    return new Response(JSON.stringify({
      success:     true,
      id:          newUserId,
      tempPassword: password,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
