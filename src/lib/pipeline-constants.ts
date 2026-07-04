// ── Tipos de cliente ─────────────────────────────────────────
export type ClientType = "comprador" | "negocio";

// ── Pipeline de Ventas (compradores) ─────────────────────────
export const SALES_STAGES = [
  { key: "prospecto", label: "Prospecto", icon: "UserPlus", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "calificacion", label: "Calificación", icon: "CheckCircle", color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "contacto_inicial", label: "Contacto Inicial", icon: "Phone", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "propuesta", label: "Propuesta", icon: "FileText", color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "negociacion", label: "Negociación", icon: "Handshake", color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "cierre", label: "Cierre", icon: "CheckCircle2", color: "text-green-500", bg: "bg-green-50", border: "border-green-200" },
] as const;

// ── Pipeline de Reclutamiento (negocio) ──────────────────────
export const RECRUITMENT_STAGES = [
  { key: "prospecto", label: "Prospecto", icon: "UserPlus", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "demo_invitacion", label: "Demo / Invitación", icon: "Presentation", color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "seguimiento_post_demo", label: "Seguimiento Post-Demo", icon: "Phone", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "presentacion_negocio", label: "Presentación del Negocio", icon: "Briefcase", color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "decision", label: "Decisión", icon: "HelpCircle", color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "inscripcion", label: "Inscripción", icon: "CheckCircle2", color: "text-green-500", bg: "bg-green-50", border: "border-green-200" },
] as const;

// ── Unificar ambos pipelines ─────────────────────────────────
export type SalesStage = typeof SALES_STAGES[number]["key"];
export type RecruitmentStage = typeof RECRUITMENT_STAGES[number]["key"];

export function getStagesForType(clientType: ClientType) {
  return clientType === "negocio" ? RECRUITMENT_STAGES : SALES_STAGES;
}

// ── Sub-calificaciones para "Calificación" (ventas) ──────────
export const QUALIFICATION_OPTIONS = [
  { key: "interesado", label: "Interesado", color: "text-blue-600", bg: "bg-blue-50" },
  { key: "calificado", label: "Calificado", color: "text-green-600", bg: "bg-green-50" },
  { key: "no_calificado", label: "No Calificado", color: "text-red-500", bg: "bg-red-50" },
  { key: "en_espera", label: "En Espera", color: "text-yellow-600", bg: "bg-yellow-50" },
] as const;

export type QualificationLevel = typeof QUALIFICATION_OPTIONS[number]["key"];

// ── Resultados de cierre (ventas) ────────────────────────────
export const CLOSURE_RESULTS = [
  { key: "ganado", label: "Ganado", color: "text-green-600", bg: "bg-green-50" },
  { key: "perdido", label: "Perdido", color: "text-red-500", bg: "bg-red-50" },
  { key: "pospuesto", label: "Pospuesto", color: "text-yellow-600", bg: "bg-yellow-50" },
] as const;

export type ClosureResult = typeof CLOSURE_RESULTS[number]["key"];

// ── Resultados de inscripción (reclutamiento) ────────────────
export const ENROLLMENT_RESULTS = [
  { key: "inscrito", label: "Inscrito", color: "text-green-600", bg: "bg-green-50" },
  { key: "rechazado", label: "Rechazado", color: "text-red-500", bg: "bg-red-50" },
  { key: "pendiente", label: "Pendiente", color: "text-yellow-600", bg: "bg-yellow-50" },
] as const;

export type EnrollmentResult = typeof ENROLLMENT_RESULTS[number]["key"];

// ── Mapeo de stages antiguos → nuevos (para migración) ───────
export const STAGE_MIGRATION_MAP: Record<string, string> = {
  lead: "prospecto",
  contacted: "calificacion",
  quote: "propuesta",
  first_purchase: "cierre",
  post_sale: "cierre",
  active: "cierre",
  repurchase: "cierre",
  vip: "cierre",
  inactive: "cierre",
};

// ── Días máximos sin movimiento antes de alertar ─────────────
export const STAGNATION_THRESHOLD_DAYS = 7;

// ── Helpers ──────────────────────────────────────────────────
export function getStageByKey(key: string, clientType: ClientType = "comprador") {
  const stages = getStagesForType(clientType);
  return stages.find(s => s.key === key);
}

export function getQualificationByKey(key: string) {
  return QUALIFICATION_OPTIONS.find(q => q.key === key);
}

export function getClosureByKey(key: string) {
  return CLOSURE_RESULTS.find(c => c.key === key);
}

export function getEnrollmentByKey(key: string) {
  return ENROLLMENT_RESULTS.find(e => e.key === key);
}
