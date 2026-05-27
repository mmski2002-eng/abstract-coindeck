import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import RazorKitStyles from "@/components/RazorKitStyles";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SuppressExtensionErrors } from "@/components/SuppressExtensionErrors";

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
  function isMetaMaskConnectNoise(value) {
    var text = "";
    if (value instanceof Error) {
      text = value.message + "\\n" + (value.stack || "");
    } else if (typeof value === "string") {
      text = value;
    } else if (value && typeof value === "object" && "message" in value) {
      text = String(value.message || "");
    }
    return text.indexOf("Failed to connect to MetaMask") !== -1 ||
      text.indexOf("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/") !== -1;
  }

  window.addEventListener("error", function (event) {
    if (isMetaMaskConnectNoise(event.error) || isMetaMaskConnectNoise(event.message) || isMetaMaskConnectNoise(event.filename)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    if (isMetaMaskConnectNoise(event.reason)) {
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
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${inter.variable} h-full antialiased`}
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
        <RazorKitStyles />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
