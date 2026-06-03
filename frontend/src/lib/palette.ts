export type ThemeVars = Record<string, string>;
export type PaletteData = { light: ThemeVars; dark: ThemeVars };

const PALETTE_VAR_ALLOWLIST = new Set([
  "--header-bg",
  "--header-border",
  "--header-muted",
  "--ticker-bg",
  "--ticker-pill-bg",
  "--ticker-pill-border",
  "--ticker-symbol",
  "--header-btn-bg",
  "--header-btn-active-bg",
  "--header-btn-color",
  "--filter-btn-hover-bg",
  "--filter-btn-shadow-size",
  "--filter-btn-shadow-size-active",
  "--button-primary-bg",
  "--button-primary-hover",
  "--button-primary-text",
  "--button-secondary-bg",
  "--button-secondary-hover",
  "--button-secondary-text",
  "--button-ghost-text",
  "--card",
  "--card-2",
  "--panel-bg",
  "--panel-border",
  "--panel-text",
  "--panel-text-muted",
  "--my-lots-bg",
  "--surface",
  "--surface-2",
  "--border",
  "--soft-border",
  "--input-bg",
  "--input-border",
  "--input-text",
  "--modal-bg",
  "--overlay-backdrop",
  "--floating-bg",
  "--floating-text",
]);

function sanitizeThemeVars(vars: unknown): ThemeVars {
  if (!vars || typeof vars !== "object") return {};

  const out: ThemeVars = {};
  for (const [name, value] of Object.entries(vars as ThemeVars)) {
    if (!PALETTE_VAR_ALLOWLIST.has(name)) continue;
    if (typeof value !== "string") continue;

    const normalized = value.trim();
    if (normalized) out[name] = normalized;
  }

  return out;
}

export function sanitizePaletteData(data: unknown): PaletteData {
  const source = data && typeof data === "object" ? data as Partial<PaletteData> : {};
  return {
    light: sanitizeThemeVars(source.light),
    dark: sanitizeThemeVars(source.dark),
  };
}
