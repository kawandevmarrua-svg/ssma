import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// FIX C-3: Hierarquia de deleção — quem pode deletar quem.
// Ninguém pode deletar alguém de role igual ou superior.
const DELETABLE_ROLES: Record<string, string[]> = {
  encarregado: ["operator", "pending"],
  supervisor:  ["operator", "encarregado", "pending"],
  manager:     ["operator", "encarregado", "supervisor", "pending"],
  // admin pode deletar qualquer role exceto outro admin (proteção contra
  // auto-exclusão acidental de último admin; admin-admin requer Supabase console)
  admin:       ["operator", "encarregado", "supervisor", "manager", "pending"],
};

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

  const supabase   = auth.data.serviceClient;
  const callerId   = auth.data.user.id;
  const callerRole = auth.data.role;

  try {
    const body   = await req.json();
    const userId = String(body.user_id ?? "").trim();

    if (!userId) {
      throw new Error("user_id é obrigatório.");
    }

    if (!UUID_REGEX.test(userId)) {
      throw new Error("user_id deve ser um UUID válido.");
    }

    // Impede auto-deleção
    if (userId === callerId) {
      return new Response(
        JSON.stringify({ error: "Não é possível deletar sua própria conta." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // FIX C-3: Buscar role da vítima antes de deletar
    const { data: targetProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      return new Response(
        JSON.stringify({ error: "Não foi possível verificar o usuário." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verificar se o caller tem permissão para deletar o role da vítima
    const allowed = DELETABLE_ROLES[callerRole] ?? [];
    if (!allowed.includes(targetProfile.role)) {
      return new Response(
        JSON.stringify({ error: `Sem permissão para deletar usuário com cargo '${targetProfile.role}'.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao remover o usuário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // FIX M-6: Audit log da deleção
    await supabase.from("audit_log").insert({
      user_id:       callerId,
      user_role:     callerRole,
      action:        "delete_user",
      resource_type: "profiles",
      resource_id:   userId,
      metadata:      { target_role: targetProfile.role, target_email: targetProfile.email },
    }).then(({ error }) => {
      if (error) console.error("[delete-auth-user] audit_log insert failed:", error.message);
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
