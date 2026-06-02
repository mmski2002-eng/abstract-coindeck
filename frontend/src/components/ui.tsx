import * as React from "react";
import { createPortal } from "react-dom";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-[var(--panel-text)] backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "brand";
}) {
  const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover)] ring-1 ring-black/10",
    secondary:
      "bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)] ring-1 ring-black/10 backdrop-blur",
    ghost: "bg-[var(--button-ghost-bg)] text-[var(--button-ghost-text)] hover:bg-[var(--button-ghost-hover)] ring-1 ring-black/10",
    brand:
      "bg-[var(--mint)] text-[var(--ink)] shadow-sm ring-1 ring-black/5 hover:brightness-105 active:brightness-95",
  };
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_0_rgba(255,255,255,0.7),0_10px_30px_rgba(22,24,29,0.06)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  closeButtonAriaLabel = "Close modal",
  dialogClassName,
  dialogStyle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeButtonAriaLabel?: string;
  dialogClassName?: string;
  dialogStyle?: React.CSSProperties;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // TODO: Implement focus trap for the modal
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "var(--overlay-backdrop)" }}
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border ring-1 ring-black/5 backdrop-blur-xl motion-safe:animate-[modalIn_140ms_ease-out]", dialogClassName)}
        style={{ borderColor: "var(--panel-border)", background: "var(--modal-bg)", color: "var(--panel-text)", boxShadow: "var(--modal-shadow)", ...dialogStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--panel-border)", background: "var(--modal-header-bg)" }}>
          <div className="text-sm font-semibold tracking-tight" style={{ color: "var(--panel-text)" }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-black/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            style={{ background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)" }}
            aria-label={closeButtonAriaLabel}
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="max-h-[78vh] overflow-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// tailwind v4 doesn't auto-generate keyframes; use a tiny CSS-in-JS fallback via style tag.
// Keep it local to this module to avoid global CSS churn.
export function ModalKeyframes() {
  return (
    <style>{`
      @keyframes modalIn {
        from { opacity: 0; transform: translateY(8px) scale(.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  );
}
