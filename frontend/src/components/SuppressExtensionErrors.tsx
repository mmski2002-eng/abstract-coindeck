"use client";

import { useEffect } from "react";

function isMetaMaskConnectNoise(value: unknown): boolean {
  const text = value instanceof Error
    ? `${value.message}\n${value.stack ?? ""}`
    : typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as { message?: unknown }).message ?? "")
        : "";

  return text.includes("Failed to connect to MetaMask") ||
    text.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/");
}

export function SuppressExtensionErrors() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isMetaMaskConnectNoise(event.error) || isMetaMaskConnectNoise(event.message) || isMetaMaskConnectNoise(event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isMetaMaskConnectNoise(event.reason)) {
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
