const ledgerRoot = "/accountant/ledger";

export function safeLedgerReturnTo(value: string | null, fallback = `${ledgerRoot}?tab=wallet&page=1`): string {
  if (!value || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return fallback;
  if (value !== ledgerRoot && !value.startsWith(`${ledgerRoot}/`) && !value.startsWith(`${ledgerRoot}?`)) return fallback;
  return value;
}

export function withLedgerReturnTo(target: string, returnTo: string): string {
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function ledgerReturnLabel(returnTo: string): string {
  const url = new URL(returnTo, "http://localhost");
  if (/^\/accountant\/ledger\/journals\/\d+$/.test(url.pathname)) return "Bút toán trước";
  if (/^\/accountant\/ledger\/\d+$/.test(url.pathname)) return "Giao dịch ví trước";
  if (url.searchParams.get("tab") === "advances") return "Tạm ứng cần quyết toán";
  if (url.searchParams.get("tab") === "journal") return "Sổ cái kế toán";
  return "Giao dịch ví";
}
