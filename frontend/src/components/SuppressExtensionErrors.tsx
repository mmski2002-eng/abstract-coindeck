"use client";

import { useEffect } from "react";

function isNoise(value: unknown): boolean {
  const text = value instanceof Error
    ? `${value.message}\n${value.stack ?? ""}`
    : typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as { message?: unknown }).message ?? "")
        : "";

  return (
    text.includes("Failed to connect to MetaMask") ||
    text.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/") ||
    // AGW/Privy connector eagerly fetches provider details on init; non-critical in dev
    (text.includes("Failed to fetch") && text.includes("loadProviderDetails")) ||
    (text.includes("Failed to fetch") && text.includes("privy")) ||
    (text.includes("Failed to fetch") && text.includes("auth.privy.io"))
  );
}

export function SuppressExtensionErrors() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isNoise(event.error) || isNoise(event.message) || isNoise(event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isNoise(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
