import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

type PlanSupabaseClient = SupabaseClient<Database>;
export type PlanCode = "free" | "pro";

export function isPlanCode(plan: string): plan is PlanCode {
  return plan === "free" || plan === "pro";
}

export const planFeatureSchema = z.object({
  smart_plan: z.boolean(),
  adaptive_schedule: z.boolean(),
  advanced_quizzes: z.boolean(),
  detailed_statistics: z.boolean(),
  learning_goals: z.boolean(),
  reports_exports: z.boolean(),
});

export type PlanFeature = keyof z.infer<typeof planFeatureSchema>;
export type PlanFeaturePermissions = z.infer<typeof planFeatureSchema>;
export type PlanCatalogEntry = Pick<
  Tables<"plan_catalog">,
  | "plan"
  | "display_name"
  | "description"
  | "monthly_price_cents"
  | "annual_price_cents"
  | "currency"
  | "benefits"
  | "feature_permissions"
  | "pricing_note"
  | "display_order"
>;
export type PlanLimits = Pick<Tables<"plan_limits">, "max_subjects" | "max_flashcards" | "max_saved_exams">;
export type PlanAccess = {
  plan: PlanCode;
  catalog: PlanCatalogEntry;
  limits: PlanLimits;
  permissions: PlanFeaturePermissions;
};

export async function loadPlanAccessForPlan(
  supabase: PlanSupabaseClient,
  planValue: string,
): Promise<PlanAccess | null> {
  if (!isPlanCode(planValue)) return null;
  const plan = planValue;
  const [catalogResult, limitsResult] = await Promise.all([
    supabase
      .from("plan_catalog")
      .select("plan,display_name,description,monthly_price_cents,annual_price_cents,currency,benefits,feature_permissions,pricing_note,display_order")
      .eq("plan", plan)
      .maybeSingle(),
    supabase
      .from("plan_limits")
      .select("max_subjects,max_flashcards,max_saved_exams")
      .eq("plan", plan)
      .maybeSingle(),
  ]);

  if (catalogResult.error || limitsResult.error || !catalogResult.data || !limitsResult.data) return null;
  const permissions = planFeatureSchema.safeParse(catalogResult.data.feature_permissions);
  if (!permissions.success) return null;

  return {
    plan,
    catalog: catalogResult.data,
    limits: limitsResult.data,
    permissions: permissions.data,
  };
}

export async function loadUserPlanAccess(
  supabase: PlanSupabaseClient,
  userId: string,
): Promise<{ access: PlanAccess | null; error: boolean }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return { access: null, error: true };
  const access = await loadPlanAccessForPlan(supabase, profile.plan as PlanCode);
  return { access, error: !access };
}

export function hasPlanFeature(access: PlanAccess | null, feature: PlanFeature) {
  return access?.permissions[feature] === true;
}

export function formatPlanPrice(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
