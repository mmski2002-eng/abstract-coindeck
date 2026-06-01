"use client";

import { useEffect, useState } from "react";
import { PALETTE_ACTION } from "@/lib/adminAuth";

type VarDef = { name: string; label: string; hex: boolean };
type Group = { label: string; vars: VarDef[] };

const GROUPS: Group[] = [
  { label: "Шапка", vars: [
    { name: "--header-bg",        label: "Фон шапки",                hex: false },
    { name: "--header-border",    label: "Нижняя линия",             hex: false },
    { name: "--header-muted",     label: "Серый текст",              hex: false },
    { name: "--ticker-bg",          label: "Бегущая строка — фон полосы",    hex: false },
    { name: "--ticker-pill-bg",     label: "Бегущая строка — фон блоков",    hex: true  },
    { name: "--ticker-pill-border", label: "Бегущая строка — обводка",       hex: false },
    { name: "--ticker-symbol",      label: "Бегущая строка — цвет шрифта",   hex: false },
    { name: "--header-btn-bg",        label: "Фон кнопок (неактивные)",   hex: true  },
    { name: "--header-btn-active-bg", label: "Фон активной кнопки",       hex: true  },
    { name: "--header-btn-color",     label: "Цвет иконок / текста кнопок", hex: true },
    { name: "--ink",                  label: "Рамка кнопок и тени (глобальный цвет чернил)", hex: true },
  ]},
  { label: "Кнопки фильтров (Roster, Marketplace, шапка)", vars: [
    { name: "--header-btn-bg",              label: "Фон неактивной кнопки",                 hex: true  },
    { name: "--header-btn-active-bg",       label: "Фон активной кнопки",                   hex: true  },
    { name: "--header-btn-color",           label: "Цвет шрифта / иконок",                  hex: true  },
    { name: "--filter-btn-hover-bg",        label: "Фон при наведении",                     hex: false },
    { name: "--filter-btn-shadow-size",     label: "Размер тени неактивной (напр. 2px)",    hex: false },
    { name: "--filter-btn-shadow-size-active", label: "Размер тени активной (напр. 4px)",   hex: false },
  ]},
  { label: "Фон страницы", vars: [
    { name: "--background", label: "Основной фон",   hex: true },
    { name: "--foreground", label: "Основной текст", hex: true },
  ]},
  { label: "Кнопки действий (только <Button> из ui.tsx)", vars: [
    { name: "--button-primary-bg",     label: "Primary — фон (редко используется)",      hex: true  },
    { name: "--button-primary-hover",  label: "Primary — hover",                         hex: true  },
    { name: "--button-primary-text",   label: "Primary — текст",                         hex: true  },
    { name: "--button-secondary-bg",   label: "Secondary — фон (Отмена, Назад, закрыть)",hex: true  },
    { name: "--button-secondary-text", label: "Secondary — текст",                       hex: true  },
    { name: "--button-ghost-text",     label: "Ghost — текст",                           hex: true  },
  ]},
  { label: "Основные блоки (--card)", vars: [
    { name: "--card",        label: "Фон блоков — вкладки, секции, AdminTab", hex: false },
    { name: "--card-2",      label: "Фон блоков (альт.)", hex: true  },
  ]},
  { label: "Внутренние панели (--panel-bg)", vars: [
    { name: "--panel-bg",         label: "Фон — модалки, списки, вложенные блоки", hex: true  },
    { name: "--panel-border",     label: "Рамка панели",                            hex: false },
    { name: "--panel-text",       label: "Основной текст в панели",                 hex: true  },
    { name: "--panel-text-muted", label: "Приглушённый текст (подписи, хинты)",     hex: false },
    { name: "--my-lots-bg",       label: "Фон блока «Мои лоты»",                   hex: true  },
    { name: "--surface",          label: "Полупрозрачная поверхность",              hex: false },
    { name: "--surface-2",        label: "Поверхность (вариант 2)",                 hex: false },
  ]},
  { label: "Акцентные цвета", vars: [
    { name: "--brand",     label: "Бирюза — ссылки, иконки, подсветки", hex: true },
    { name: "--brand-2",   label: "Светлая бирюза",                     hex: true },
    { name: "--mint",      label: "Зелёный — фон кнопок-«наклеек»",     hex: true },
    { name: "--mint-deep", label: "Тёмный зелёный — hover наклеек",     hex: true },
    { name: "--lime-pop",  label: "Неон-зелёный — акцент тёмной темы",  hex: true },
  ]},
  { label: "Тени", vars: [
    { name: "--shadow-sticker-color", label: "Цвет тени sticker-кнопок",  hex: true  },
    { name: "--shadow-sticker",       label: "Полная тень (смещение + цвет, расширенно)", hex: false },
    { name: "--shadow-sticker-sm",    label: "Полная тень маленькая (расширенно)",         hex: false },
  ]},
  { label: "Рамки и поля ввода", vars: [
    { name: "--border",       label: "Основная рамка блоков",     hex: false },
    { name: "--soft-border",  label: "Тонкая / мягкая рамка",     hex: false },
    { name: "--input-bg",     label: "Фон поля ввода",            hex: false },
    { name: "--input-border", label: "Рамка поля ввода",          hex: false },
    { name: "--input-text",   label: "Текст в поле ввода",        hex: true  },
  ]},
  { label: "Модалки", vars: [
    { name: "--modal-bg",         label: "Фон модального окна",          hex: true  },
    { name: "--overlay-backdrop", label: "Затемнение под модалкой",      hex: false },
    { name: "--floating-bg",      label: "Плавающий элемент — фон",      hex: false },
    { name: "--floating-text",    label: "Плавающий элемент — текст",    hex: true  },
  ]},
  { label: "Чернила и бумага (базовые)", vars: [
    { name: "--ink",     label: "Чернила — тени кнопок, обводки, тёмный текст", hex: true },
    { name: "--ink-2",   label: "Чернила-2 — вторичный тёмный текст",           hex: true },
    { name: "--ink-3",   label: "Чернила-3 — очень приглушённый цвет",          hex: true },
    { name: "--paper",   label: "Бумага — бежевый фон (карточки light-темы)",   hex: true },
    { name: "--paper-3", label: "Бумага-3 — белый / почти белый фон",           hex: true },
    { name: "--sunken",  label: "Углублённый — фон неактивных зон",             hex: true },
  ]},
];

type ThemeVars = Record<string, string>;
type PaletteData = { light: ThemeVars; dark: ThemeVars };
type ThemeKey = "light" | "dark";

type Props = {
  lang: string;
  buildAdminAuth: (action: string, payload: unknown) => Promise<Record<string, unknown>>;
  setAdminError: (v: string) => void;
  setAdminOk: (v: string) => void;
};

function injectStyle(palette: PaletteData) {
  document.getElementById("cd-palette-live")?.remove();
  const el = document.createElement("style");
  el.id = "cd-palette-live";
  const fmt = (entries: [string, string][]) =>
    entries.filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(";");
  const lv = fmt(Object.entries(palette.light));
  const dv = fmt(Object.entries(palette.dark));
  // :root:root и html:root[data-theme="dark"] имеют более высокую специфичность чем globals.css
  el.textContent = (lv ? `:root:root{${lv}}` : "") + (dv ? `html:root[data-theme="dark"]{${dv}}` : "");
  document.body.appendChild(el);
}

function Swatch({ display, hex, onChange }: { display: string; hex: boolean; onChange: (v: string) => void }) {
  return (
    <div className="relative shrink-0" style={{ width: 20, height: 20 }}>
      <div
        style={{
          width: 20, height: 20, borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.15)",
          background: display || "transparent",
        }}
      />
      {hex && (
        <input
          type="color"
          value={display.startsWith("#") ? display : "#000000"}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: 20, height: 20 }}
        />
      )}
    </div>
  );
}

function VarCell({
  v, override, defaultVal, onChange, onClear,
}: {
  v: VarDef; override: string; defaultVal: string;
  onChange: (val: string) => void; onClear: () => void;
}) {
  const isCustom = Boolean(override);
  const display = override || defaultVal;
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Swatch display={display} hex={v.hex} onChange={onChange} />
      <input
        type="text"
        value={override}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (!override && defaultVal) onChange(defaultVal); }}
        placeholder={defaultVal || v.name}
        className="w-36 min-w-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-pink-500/40"
        style={{ fontSize: "9px", color: isCustom ? "var(--panel-text)" : "var(--panel-text-muted)" }}
      />
      {isCustom && (
        <button
          onClick={onClear}
          className="shrink-0 text-[10px] text-zinc-600 hover:text-red-400 transition leading-none"
          title="Сбросить"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function readCSSDefaults(): PaletteData {
  const el = document.documentElement;
  const saved = el.dataset.theme ?? "light";
  const read = (theme: ThemeKey): ThemeVars => {
    el.setAttribute("data-theme", theme);
    const cs = getComputedStyle(el);
    const out: ThemeVars = {};
    for (const g of GROUPS) for (const v of g.vars) out[v.name] = cs.getPropertyValue(v.name).trim();
    return out;
  };
  const light = read("light");
  const dark = read("dark");
  el.setAttribute("data-theme", saved);
  return { light, dark };
}

export function PaletteSettingsBlock({ lang, buildAdminAuth, setAdminError, setAdminOk }: Props) {
  const [palette, setPalette] = useState<PaletteData>({ light: {}, dark: {} });
  const [defaults, setDefaults] = useState<PaletteData>({ light: {}, dark: {} });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDefaults(readCSSDefaults());
    fetch("/api/admin/palette")
      .then(r => r.json() as Promise<PaletteData>)
      .then(data => {
        const p: PaletteData = { light: data.light ?? {}, dark: data.dark ?? {} };
        setPalette(p);
        injectStyle(p);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) injectStyle(palette);
  }, [palette, loaded]);

  function setVar(theme: ThemeKey, name: string, value: string) {
    setPalette(prev => ({ ...prev, [theme]: { ...prev[theme], [name]: value } }));
  }

  function clearVar(theme: ThemeKey, name: string) {
    setPalette(prev => {
      const next = { ...prev[theme] };
      delete next[name];
      return { ...prev, [theme]: next };
    });
  }

  async function save() {
    setSaving(true);
    setAdminError("");
    try {
      const payload = { light: palette.light, dark: palette.dark };
      const auth = await buildAdminAuth(PALETTE_ACTION, payload);
      const res = await fetch("/api/admin/palette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, auth }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setAdminOk(lang === "ru" ? "Палитра сохранена" : "Palette saved");
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setAdminError("");
    try {
      const payload = { light: {}, dark: {} };
      const auth = await buildAdminAuth(PALETTE_ACTION, payload);
      const res = await fetch("/api/admin/palette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, auth }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPalette({ light: {}, dark: {} });
      document.getElementById("cd-palette-live")?.remove();
      document.getElementById("cd-palette")?.remove();
      requestAnimationFrame(() => setDefaults(readCSSDefaults()));
      setAdminOk(lang === "ru" ? "Палитра сброшена" : "Palette reset");
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function exportCSS() {
    const fmt = (vars: ThemeVars) =>
      Object.entries(vars).filter(([, v]) => v).map(([k, v]) => `  ${k}: ${v};`).join("\n");
    const lv = fmt(palette.light);
    const dv = fmt(palette.dark);
    const css = [
      lv ? `:root {\n${lv}\n}` : "",
      dv ? `html[data-theme="dark"] {\n${dv}\n}` : "",
    ].filter(Boolean).join("\n\n") || "/* no overrides */";
    navigator.clipboard.writeText(css).then(() =>
      setAdminOk(lang === "ru" ? "CSS скопирован" : "CSS copied")
    );
  }

  function toggleGroup(label: string) {
    setOpen(prev => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  }

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-pink-500/20 p-4" style={{ background: "var(--card)" }}>
        <div className="text-xs" style={{ color: "var(--panel-text-muted)" }}>…</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-500/20 p-4 space-y-4" style={{ background: "var(--card)" }}>
      <div className="text-xs font-semibold text-pink-300/90">
        🎨 {lang === "ru" ? "Настройки палитры" : "Palette settings"}
      </div>

      <div className="space-y-1.5">
        {GROUPS.map(g => {
          const isOpen = open.has(g.label);
          const customCount =
            g.vars.filter(v => palette.light[v.name] || palette.dark[v.name]).length;
          return (
            <div key={g.label} className="rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => toggleGroup(g.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-white/[0.03] transition text-left"
                style={{ color: "var(--panel-text)" }}
              >
                <span>
                  {g.label}
                  {customCount > 0 && (
                    <span className="ml-2 text-[9px] font-bold text-pink-400">{customCount} custom</span>
                  )}
                </span>
                <span className="text-[10px] text-zinc-600">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-white/5 px-3 py-2 space-y-1.5">
                  {/* Column headers */}
                  <div className="grid items-center gap-2" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)" }}>
                    <span />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">☀️ Light</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">🌙 Dark</span>
                  </div>

                  {g.vars.map(v => (
                    <div
                      key={v.name}
                      className="grid gap-2"
                      style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}
                    >
                      <label
                        className="text-[10px] leading-tight break-words cursor-default pt-0.5"
                        style={{ color: (palette.light[v.name] || palette.dark[v.name]) ? "var(--mint)" : "var(--panel-text-muted)" }}
                        title={v.name}
                      >
                        {v.label}
                      </label>

                      <VarCell
                        v={v}
                        override={palette.light[v.name] ?? ""}
                        defaultVal={defaults.light[v.name] ?? ""}
                        onChange={val => setVar("light", v.name, val)}
                        onClear={() => clearVar("light", v.name)}
                      />

                      <VarCell
                        v={v}
                        override={palette.dark[v.name] ?? ""}
                        defaultVal={defaults.dark[v.name] ?? ""}
                        onChange={val => setVar("dark", v.name, val)}
                        onClear={() => clearVar("dark", v.name)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-pink-700/80 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700 disabled:opacity-40 transition"
        >
          {saving ? "…" : (lang === "ru" ? "💾 Сохранить" : "💾 Save")}
        </button>
        <button
          onClick={exportCSS}
          className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 transition"
        >
          {lang === "ru" ? "📋 Экспорт CSS" : "📋 Export CSS"}
        </button>
        <button
          onClick={reset}
          disabled={saving}
          className="rounded-xl bg-red-900/40 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-900/60 disabled:opacity-40 transition"
        >
          {saving ? "…" : (lang === "ru" ? "↺ Сбросить" : "↺ Reset")}
        </button>
      </div>

      <div className="text-[10px]" style={{ color: "var(--panel-text-muted)" }}>
        {lang === "ru"
          ? "Квадрат = текущий цвет, клик открывает пикер (hex). Изменения видны сразу. Сохранить → на сервер для всех."
          : "Square = current color, click to open picker (hex). Changes apply live. Save → server for all users."}
      </div>
    </div>
  );
}
