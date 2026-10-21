/**
 * Shared formatting utilities — use these instead of reimplementing per-page.
 * Import via: import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/format";
 */

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats a raw digit string (from amount inputs) as "1.000.000". */
export function formatInputAmount(raw: string): string {
  if (!raw) return "";
  return Number(raw).toLocaleString("vi-VN");
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (DATE_ONLY_RE.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const normalized = HAS_TIMEZONE_RE.test(trimmed) ? trimmed : `${trimmed}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = parseApiDate(iso);
  if (!parsed) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = parseApiDate(iso);
  if (!parsed) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - (parseApiDate(iso) ?? new Date(iso)).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

/** Strip non-digit characters and leading zeros from a number input value */
export function parseAmountInput(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

// ─── Fund Health ────────────────────────────────────────────────────────────

export type FundHealth = "HEALTHY" | "LOW" | "CRITICAL";

/** Classify company/system fund balance into a health tier. */
export function getFundHealth(balance: number): FundHealth {
  if (balance >= 500_000_000) return "HEALTHY";
  if (balance >= 100_000_000) return "LOW";
  return "CRITICAL";
}

/** Tailwind badge classes for fund health (inline badge pattern). */
export function getFundHealthClass(health: FundHealth): string {
  switch (health) {
    case "HEALTHY": return "bg-emerald-100 border-emerald-200 text-emerald-700";
    case "LOW":     return "bg-amber-100 border-amber-200 text-amber-700";
    case "CRITICAL":return "bg-rose-100 border-rose-200 text-rose-700";
  }
}

/** Structured style object for fund health (card/panel pattern used by CFO dashboard). */
export function getFundHealthStyle(health: FundHealth): {
  label: string;
  tone: string;
  borderTone: string;
  bgTone: string;
} {
  switch (health) {
    case "HEALTHY":
      return { label: "HEALTHY", tone: "text-emerald-700", borderTone: "border-emerald-300", bgTone: "bg-emerald-50" };
    case "LOW":
      return { label: "LOW", tone: "text-amber-700", borderTone: "border-amber-300", bgTone: "bg-amber-50" };
    case "CRITICAL":
      return { label: "CRITICAL", tone: "text-rose-700", borderTone: "border-rose-300", bgTone: "bg-rose-50" };
  }
}

// ─── Budget Burn ─────────────────────────────────────────────────────────────

/** Tailwind progress-bar color for budget burn percentage (85 % = critical, 65 % = warning). */
export function getBurnClass(percent: number): string {
  if (percent >= 85) return "bg-rose-500";
  if (percent >= 65) return "bg-amber-500";
  return "bg-emerald-500";
}
