import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function sendExpoPush(tokens: string[], payload: PushPayload) {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  return response.json();
}

async function tokensForRoles(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  roles: string[],
): Promise<string[]> {
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id")
    .in("role", roles);

  const ids = (profiles ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) return [];

  const { data: tokens } = await serviceClient
    .from("user_push_tokens")
    .select("push_token")
    .in("user_id", ids)
    .not("push_token", "is", null);

  return (tokens ?? [])
    .map((t: { push_token: string | null }) => t.push_token)
    .filter((t: string | null): t is string => !!t);
}

async function tokenForOperator(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  operatorId: string,
): Promise<string[]> {
  const { data: operator } = await serviceClient
    .from("operators")
    .select("auth_user_id")
    .eq("id", operatorId)
    .single();

  if (!operator?.auth_user_id) return [];

  const { data: tok } = await serviceClient
    .from("user_push_tokens")
    .select("push_token")
    .eq("user_id", operator.auth_user_id)
    .maybeSingle();

  return tok?.push_token ? [tok.push_token] : [];
}

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

  // Aceita admins/managers + chamadas internas (trigger SQL).
  const auth = await authenticate(req, ["admin", "manager"]);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = auth.data.serviceClient;

  try {
    const body = await req.json();
    const { alert_id, type, operator_id } = body;

    if (!type) {
      throw new Error(
        "Parametro 'type' obrigatorio: 'blocking_nc' | 'behavioral_inspection' | 'critical_deviation' | 'custom'",
      );
    }

    let pushTokens: string[] = [];
    let pushPayload: PushPayload = { title: "", body: "" };

    switch (type) {
      case "blocking_nc": {
        pushTokens = await tokensForRoles(supabase, ["admin", "manager"]);

        if (alert_id) {
          const { data: alert } = await supabase
            .from("safety_alerts")
            .select("title, message")
            .eq("id", alert_id)
            .single();

          pushPayload = {
            title: alert?.title || "Item Impeditivo NC",
            body: alert?.message || "Um item impeditivo foi marcado como Nao Conforme.",
            data: { screen: "alerts", alert_id },
          };
        } else {
          pushPayload = {
            title: "Item Impeditivo NC",
            body: "Um operador marcou Nao Conforme em item impeditivo. Equipamento nao liberado.",
            data: { screen: "alerts" },
          };
        }
        break;
      }

      case "behavioral_inspection": {
        if (operator_id) {
          pushTokens = await tokenForOperator(supabase, operator_id);
        }
        pushPayload = {
          title: "Inspecao Comportamental",
          body: "Uma inspecao comportamental foi registrada para voce. Verifique seus alertas.",
          data: { screen: "alerts" },
        };
        break;
      }

      case "critical_deviation": {
        pushTokens = await tokensForRoles(supabase, ["admin", "manager"]);
        pushPayload = {
          title: "Desvio Critico Identificado",
          body: "Um desvio critico foi identificado em inspecao comportamental. Acao imediata necessaria.",
          data: { screen: "alerts" },
        };
        break;
      }

      case "custom": {
        if (!alert_id) throw new Error("alert_id obrigatorio para tipo 'custom'");

        const { data: alert } = await supabase
          .from("safety_alerts")
          .select("title, message, operator_id")
          .eq("id", alert_id)
          .single();

        if (!alert) throw new Error("Alerta nao encontrado");

        if (alert.operator_id) {
          pushTokens = await tokenForOperator(supabase, alert.operator_id);
        } else {
          pushTokens = await tokensForRoles(supabase, ["operator"]);
        }

        pushPayload = {
          title: alert.title,
          body: alert.message,
          data: { screen: "alerts", alert_id },
        };
        break;
      }

      default:
        throw new Error(`Tipo invalido: ${type}`);
    }

    const pushResult = await sendExpoPush(pushTokens, pushPayload);

    return new Response(
      JSON.stringify({
        success: true,
        tokens_count: pushTokens.length,
        push_result: pushResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
