import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { alert_id, type, operator_id } = body;

    if (!type) {
      throw new Error("Parametro 'type' obrigatorio: 'blocking_nc' | 'behavioral_inspection' | 'critical_deviation' | 'custom'");
    }

    let pushTokens: string[] = [];
    let pushPayload: PushPayload = { title: "", body: "" };

    switch (type) {
      case "blocking_nc": {
        // Notificar gestores e admins sobre item impeditivo NC
        const { data: managers } = await supabase
          .from("profiles")
          .select("push_token")
          .in("role", ["admin", "manager"])
          .not("push_token", "is", null);

        pushTokens = (managers || [])
          .map((m: { push_token: string | null }) => m.push_token)
          .filter(Boolean) as string[];

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
        // Notificar o operador que foi inspecionado

        if (operator_id) {
          const { data: operator } = await supabase
            .from("operators")
            .select("auth_user_id")
            .eq("id", operator_id)
            .single();

          if (operator?.auth_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("push_token")
              .eq("id", operator.auth_user_id)
              .single();

            if (profile?.push_token) {
              pushTokens = [profile.push_token];
            }
          }
        }

        pushPayload = {
          title: "Inspecao Comportamental",
          body: "Uma inspecao comportamental foi registrada para voce. Verifique seus alertas.",
          data: { screen: "alerts" },
        };
        break;
      }

      case "critical_deviation": {
        // Notificar toda equipe SSMA + gestores
        const { data: ssmAndManagers } = await supabase
          .from("profiles")
          .select("push_token")
          .in("role", ["admin", "manager"])
          .not("push_token", "is", null);

        pushTokens = (ssmAndManagers || [])
          .map((m: { push_token: string | null }) => m.push_token)
          .filter(Boolean) as string[];

        pushPayload = {
          title: "Desvio Critico Identificado",
          body: "Um desvio critico foi identificado em inspecao comportamental. Acao imediata necessaria.",
          data: { screen: "alerts" },
        };
        break;
      }

      case "custom": {
        // Enviar push customizado baseado em um safety_alert existente
        if (!alert_id) {
          throw new Error("alert_id obrigatorio para tipo 'custom'");
        }

        const { data: alert } = await supabase
          .from("safety_alerts")
          .select("title, message, operator_id")
          .eq("id", alert_id)
          .single();

        if (!alert) throw new Error("Alerta nao encontrado");

        if (alert.operator_id) {
          // Push para operador especifico
          const { data: operator } = await supabase
            .from("operators")
            .select("auth_user_id")
            .eq("id", alert.operator_id)
            .single();

          if (operator?.auth_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("push_token")
              .eq("id", operator.auth_user_id)
              .single();

            if (profile?.push_token) {
              pushTokens = [profile.push_token];
            }
          }
        } else {
          // Broadcast: push para todos os operadores ativos
          const { data: operatorProfiles } = await supabase
            .from("profiles")
            .select("push_token")
            .eq("role", "operator")
            .not("push_token", "is", null);

          pushTokens = (operatorProfiles || [])
            .map((m: { push_token: string | null }) => m.push_token)
            .filter(Boolean) as string[];
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
