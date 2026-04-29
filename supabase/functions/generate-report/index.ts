import { authenticate, buildCorsHeaders } from "../_shared/auth.ts";

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

  const auth = await authenticate(req, ["admin", "manager", "encarregado"]);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = auth.data.serviceClient;

  // Cap absoluto para evitar DoS / exfiltracao em massa.
  const MAX_LIMIT = 1000;
  const DEFAULT_LIMIT = 200;

  try {
    const { type, operator_id, date_from, date_to, limit } = await req.json();

    if (!type) {
      throw new Error(
        "Parametro 'type' obrigatorio: 'checklist' | 'inspection' | 'activity' | 'operator_summary'",
      );
    }

    const requestedLimit = Number.isFinite(Number(limit)) ? Number(limit) : DEFAULT_LIMIT;
    const effectiveLimit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);

    let reportData: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      type,
      date_from,
      date_to,
      limit: effectiveLimit,
    };

    const filters = {
      dateFrom: date_from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
      dateTo: date_to || new Date().toISOString().split("T")[0],
    };

    switch (type) {
      case "checklist": {
        let query = supabase
          .from("checklists")
          .select(`
            *,
            profiles!checklists_operator_id_fkey(full_name),
            equipment_types(name),
            checklist_responses(
              status,
              notes,
              checklist_template_items(description, is_blocking, section)
            )
          `)
          .gte("date", filters.dateFrom)
          .lte("date", filters.dateTo)
          .order("date", { ascending: false })
          .limit(effectiveLimit);

        if (operator_id) query = query.eq("operator_id", operator_id);

        const { data, error } = await query;
        if (error) throw error;

        const summary = {
          total: data?.length || 0,
          released: data?.filter((c: { result: string }) => c.result === "released").length || 0,
          not_released: data?.filter((c: { result: string }) => c.result === "not_released").length || 0,
        };

        reportData = { ...reportData, summary, checklists: data };
        break;
      }

      case "inspection": {
        let query = supabase
          .from("behavioral_inspections")
          .select(`
            *,
            profiles!behavioral_inspections_operator_id_fkey(full_name),
            observer:profiles!behavioral_inspections_observer_id_fkey(full_name),
            behavioral_inspection_items(category, description, status),
            behavioral_deviations(description, risk_level, immediate_action, status)
          `)
          .gte("date", filters.dateFrom)
          .lte("date", filters.dateTo)
          .order("date", { ascending: false })
          .limit(effectiveLimit);

        if (operator_id) query = query.eq("operator_id", operator_id);

        const { data, error } = await query;
        if (error) throw error;

        const summary = {
          total: data?.length || 0,
          safe: data?.filter((i: { overall_classification: string }) => i.overall_classification === "safe").length || 0,
          attention: data?.filter((i: { overall_classification: string }) => i.overall_classification === "attention").length || 0,
          critical: data?.filter((i: { overall_classification: string }) => i.overall_classification === "critical").length || 0,
          total_deviations: data?.reduce(
            (sum: number, i: { behavioral_deviations: unknown[] }) =>
              sum + (i.behavioral_deviations?.length || 0),
            0,
          ) || 0,
        };

        reportData = { ...reportData, summary, inspections: data };
        break;
      }

      case "activity": {
        let query = supabase
          .from("activities")
          .select("*, profiles!activities_operator_id_fkey(full_name)")
          .gte("date", filters.dateFrom)
          .lte("date", filters.dateTo)
          .order("date", { ascending: false })
          .limit(effectiveLimit);

        if (operator_id) query = query.eq("operator_id", operator_id);

        const { data, error } = await query;
        if (error) throw error;

        const completedActivities = data?.filter(
          (a: { end_time: string | null }) => a.end_time !== null,
        ) || [];
        let totalMinutes = 0;
        for (const act of completedActivities) {
          if (act.start_time && act.end_time) {
            totalMinutes +=
              (new Date(act.end_time).getTime() - new Date(act.start_time).getTime()) / 60000;
          }
        }

        const summary = {
          total: data?.length || 0,
          completed: completedActivities.length,
          with_interference: data?.filter(
            (a: { had_interference: boolean }) => a.had_interference,
          ).length || 0,
          avg_duration_minutes:
            completedActivities.length > 0
              ? Math.round(totalMinutes / completedActivities.length)
              : 0,
        };

        reportData = { ...reportData, summary, activities: data };
        break;
      }

      case "operator_summary": {
        if (!operator_id) {
          throw new Error("operator_id obrigatorio para relatorio operator_summary");
        }

        const period = filters.dateFrom.slice(0, 7);

        const { data: score } = await supabase
          .from("operator_scores")
          .select("*")
          .eq("operator_id", operator_id)
          .eq("period", period)
          .single();

        const { data: operator } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", operator_id)
          .single();

        const { data: recentChecklists } = await supabase
          .from("checklists")
          .select("id, date, result, equipment_types(name)")
          .eq("operator_id", operator_id)
          .gte("date", filters.dateFrom)
          .lte("date", filters.dateTo)
          .order("date", { ascending: false })
          .limit(10);

        const { data: recentInspections } = await supabase
          .from("behavioral_inspections")
          .select("id, date, overall_classification, profiles!behavioral_inspections_observer_id_fkey(full_name)")
          .eq("operator_id", operator_id)
          .gte("date", filters.dateFrom)
          .lte("date", filters.dateTo)
          .order("date", { ascending: false })
          .limit(10);

        reportData = {
          ...reportData,
          operator,
          score,
          recent_checklists: recentChecklists,
          recent_inspections: recentInspections,
        };
        break;
      }

      default:
        throw new Error(`Tipo de relatorio invalido: ${type}`);
    }

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
