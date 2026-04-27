import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { operator_id, period } = await req.json();

    // Se nao informar period, usa mes atual
    const targetPeriod =
      period || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Se informar operator_id, calcula so para ele; senao, para todos ativos
    let operatorIds: string[] = [];

    if (operator_id) {
      operatorIds = [operator_id];
    } else {
      const { data: operators } = await supabase
        .from("operators")
        .select("id")
        .eq("active", true);
      operatorIds = (operators || []).map((o: { id: string }) => o.id);
    }

    const results = [];
    const periodStart = `${targetPeriod}-01`;
    const nextMonth = new Date(periodStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const periodEnd = nextMonth.toISOString().split("T")[0];

    for (const opId of operatorIds) {
      // Checklists do periodo
      const { count: checklistsDone } = await supabase
        .from("checklists")
        .select("*", { count: "exact", head: true })
        .eq("operator_id", opId)
        .gte("date", periodStart)
        .lt("date", periodEnd);

      // Calcular dias uteis no mes (excluindo sabados e domingos)
      const monthDate = new Date(periodStart);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      let businessDays = 0;
      for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month, d).getDay();
        if (day !== 0 && day !== 6) businessDays++;
      }
      const checklistsTotal = businessDays;

      // Inspecoes comportamentais recebidas
      const { count: inspectionsDone } = await supabase
        .from("behavioral_inspections")
        .select("*", { count: "exact", head: true })
        .eq("operator_id", opId)
        .gte("date", periodStart)
        .lt("date", periodEnd);

      const inspectionsTotal = inspectionsDone || 0;

      // Desvios
      const { data: deviations } = await supabase
        .from("behavioral_deviations")
        .select("risk_level, inspection_id")
        .in(
          "inspection_id",
          (
            await supabase
              .from("behavioral_inspections")
              .select("id")
              .eq("operator_id", opId)
              .gte("date", periodStart)
              .lt("date", periodEnd)
          ).data?.map((i: { id: string }) => i.id) || []
        );

      const deviationsCount = deviations?.length || 0;
      const criticalDeviations =
        deviations?.filter(
          (d: { risk_level: string }) =>
            d.risk_level === "critical" || d.risk_level === "high"
        ).length || 0;

      // Atividades e tempo medio de operacao
      const { data: activities } = await supabase
        .from("activities")
        .select("start_time, end_time")
        .eq("operator_id", opId)
        .gte("date", periodStart)
        .lt("date", periodEnd)
        .not("end_time", "is", null);

      let totalMinutes = 0;
      let completedActivities = 0;
      for (const act of activities || []) {
        if (act.start_time && act.end_time) {
          const diff =
            new Date(act.end_time).getTime() -
            new Date(act.start_time).getTime();
          totalMinutes += diff / 60000;
          completedActivities++;
        }
      }
      const avgOperationMinutes =
        completedActivities > 0
          ? Math.round(totalMinutes / completedActivities)
          : 0;

      // Intervencoes (NC em itens impeditivos)
      const { count: interventionsCount } = await supabase
        .from("checklist_responses")
        .select(
          "*, checklist_template_items!inner(is_blocking), checklists!inner(operator_id)",
          { count: "exact", head: true }
        )
        .eq("status", "NC")
        .eq("checklist_template_items.is_blocking", true)
        .eq("checklists.operator_id", opId);

      // Calcular indice de produtividade
      const checklistRate =
        checklistsTotal > 0
          ? ((checklistsDone || 0) / checklistsTotal) * 100
          : 0;
      const productivityIndex = Math.min(checklistRate, 100);

      // Calcular score final (0-100)
      // Peso: checklists 40%, sem desvios criticos 30%, produtividade 20%, inspecoes ok 10%
      const checklistScore = Math.min(
        ((checklistsDone || 0) / checklistsTotal) * 40,
        40
      );
      const deviationScore = criticalDeviations === 0 ? 30 : Math.max(0, 30 - criticalDeviations * 10);
      const productivityScore = (productivityIndex / 100) * 20;
      // Inspecoes: se nao teve nenhum desvio critico nas inspecoes, pontuacao maxima
      // Se teve desvios, desconta proporcionalmente
      const inspectionScore =
        inspectionsTotal > 0
          ? Math.max(0, 10 - (criticalDeviations * 3))
          : 5; // Sem inspecao = pontuacao neutra

      const score = Math.round(
        (checklistScore + deviationScore + productivityScore + inspectionScore) *
          100
      ) / 100;

      // Upsert no operator_scores
      const { error } = await supabase.from("operator_scores").upsert(
        {
          operator_id: opId,
          period: targetPeriod,
          checklists_total: checklistsTotal,
          checklists_done: checklistsDone || 0,
          inspections_total: inspectionsTotal,
          inspections_done: inspectionsDone || 0,
          deviations_count: deviationsCount,
          critical_deviations: criticalDeviations,
          productivity_index: productivityIndex,
          avg_operation_minutes: avgOperationMinutes,
          interventions_count: interventionsCount || 0,
          score,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "operator_id,period" }
      );

      results.push({
        operator_id: opId,
        score,
        error: error?.message || null,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
