import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sisyphus | Autonomous Trading Agent",
  description: "Advanced AI trading agent on Tempo blockchain. Swap, limit orders, scheduled payments, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";
  return (
    <html lang="en">
      <head>
        {/* Avoid light->dark flash: set initial theme before first paint. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var t = localStorage.getItem("sisyphus_theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.sisyphusTheme = t;
  } catch (e) {}
})();`.trim(),
          }}
        />
        {/* Silence browser console in production (prevents leaking debug output in public demos). */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    if (!${isProd ? "true" : "false"}) return;
    var noop = function () {};
    var c = (typeof console !== "undefined" && console) ? console : null;
    if (!c) return;
    var methods = [
      "log",
      "info",
      "debug",
      "warn",
      "error",
      "trace",
      "group",
      "groupCollapsed",
      "groupEnd"
    ];
    for (var i = 0; i < methods.length; i++) {
      var m = methods[i];
      if (typeof c[m] === "function") c[m] = noop;
    }
  } catch (e) {}
})();`.trim(),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
