import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Lora, Titan_One } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SuppressExtensionErrors } from "@/components/SuppressExtensionErrors";

const titanOne = Titan_One({
  variable: "--font-titan-one",
  subsets: ["latin"],
  weight: ["400"],
});

const lora = Lora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CoinDeck",
  description: "CoinDeck dApp on Abstract with wallet connect",
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
    var theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.cookie = "cd_theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedTheme = cookieStore.get("cd_theme")?.value;
  const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";

  return (
    <html
      lang="en"
      className={`${lora.variable} ${inter.variable} ${titanOne.variable} h-full antialiased`}
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
