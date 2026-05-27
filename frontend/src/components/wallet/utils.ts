export function parseU8Vec(raw: unknown): number[] {
  if (Array.isArray(raw)) return (raw as (string | number)[]).map(Number);
  if (typeof raw === "string") {
    const h = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (!h) return [];
    const out: number[] = [];
    for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
    return out;
  }
  return [];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}
