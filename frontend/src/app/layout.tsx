import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SuppressExtensionErrors } from "@/components/SuppressExtensionErrors";
import { sanitizePaletteData } from "@/lib/palette";

export const metadata: Metadata = {
  title: "HeavyEggs",
  description: "HeavyEggs dApp on Abstract with wallet connect",
  twitter: {
    site: "@MrHeavyEggs",
    creator: "@MrHeavyEggs",
    card: "summary_large_image",
  },
};

const suppressMetaMaskConnectNoise = `
(function () {
  function isNoise(value) {
    var text = "";
    if (value instanceof Error) {
      text = value.message + "\\n" + (value.stack || "");
    } else if (typeof value === "string") {
      text = value;
    } else if (value && typeof value === "object" && "message" in value) {
      text = String(value.message || "");
    }
    return text.indexOf("Failed to connect to MetaMask") !== -1 ||
      text.indexOf("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/") !== -1 ||
      (text.indexOf("Failed to fetch") !== -1 && (
        text.indexOf("loadProviderDetails") !== -1 ||
        text.indexOf("privy") !== -1 ||
        text.indexOf("auth.privy.io") !== -1
      ));
  }

  window.addEventListener("error", function (event) {
    if (isNoise(event.error) || isNoise(event.message) || isNoise(event.filename)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    if (isNoise(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
`;

const initThemeScript = `
(function () {
  try {
    var stored = localStorage.getItem("cd_theme");
    var theme = stored === "dark" || stored === "light" ? stored : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.cookie = "cd_theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
  } catch (e) {}
})();
`;

async function loadPaletteCSS(): Promise<string> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "palette.json"), "utf-8");
    const pal = sanitizePaletteData(JSON.parse(raw));
    const lv = Object.entries(pal.light ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(";");
    const dv = Object.entries(pal.dark ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(";");
    return (lv ? `:root{${lv}}` : "") + (dv ? `html[data-theme="dark"]{${dv}}` : "");
  } catch {
    return "";
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedTheme = cookieStore.get("cd_theme")?.value;
  const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "dark";
  const paletteCSS = await loadPaletteCSS();

  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-theme={initialTheme}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <head>
        <Script id="init-theme" strategy="beforeInteractive">
          {initThemeScript}
        </Script>
        <Script id="suppress-metamask-noise" strategy="beforeInteractive">
          {suppressMetaMaskConnectNoise}
        </Script>
        {paletteCSS && <style id="cd-palette" dangerouslySetInnerHTML={{ __html: paletteCSS }} />}
      </head>
      <body className="min-h-full flex flex-col font-body">
        <SuppressExtensionErrors />
        <Providers>
          <LanguageProvider>{children}</LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
