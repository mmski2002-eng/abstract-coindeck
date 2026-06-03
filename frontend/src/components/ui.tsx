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
        "chip-sticker",
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
  variant?: "primary" | "secondary" | "outline" | "ghost" | "brand" | "destructive";
}) {
  const variants: Record<string, string> = {
    primary: "btn-sticker-primary",
    secondary: "btn-sticker-secondary",
    outline: "btn-sticker-outline",
    ghost: "btn-sticker-ghost",
    brand: "btn-sticker-primary",
    destructive: "btn-sticker-destructive",
  };
  return (
    <button className={cn(variants[variant], "px-4 py-2", className)} {...props}>
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
        "card-sticker p-6",
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
        className="absolute inset-0"
        style={{ background: "var(--overlay-backdrop)" }}
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("relative z-10 w-full max-w-3xl overflow-hidden motion-safe:animate-[modalIn_140ms_ease-out]", dialogClassName)}
        style={{
          border: "2.5px solid var(--outline)",
          borderRadius: "var(--radius-md)",
          background: "var(--modal-bg)",
          color: "var(--panel-text)",
          boxShadow: "var(--shadow-sticker)",
          ...dialogStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "2.5px solid var(--outline)", background: "var(--modal-header-bg)" }}
        >
          <div className="text-sm font-black uppercase tracking-[0.14em]" style={{ color: "var(--panel-text)" }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="btn-sticker-outline grid h-9 w-9 place-items-center p-0 text-base leading-none"
            aria-label={closeButtonAriaLabel}
          >
            <span aria-hidden>×</span>
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
