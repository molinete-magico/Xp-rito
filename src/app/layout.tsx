import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

/**
 * Três famílias, três funções, sem sobreposição:
 *  - Newsreader  → nomes, títulos, corpo das publicações (leitura longa)
 *  - Archivo     → interface: navegação, botões, formulários, rótulos
 *  - IBM Plex Mono → dados: @handles, contadores, carimbos, timestamps
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  axes: ["opsz"],
});

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  icons: {
    icon: [
      { url: "/LogoXpitrito.png", media: "(prefers-color-scheme: light)" },
      { url: "/LogoXpitrito2.png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: ["/LogoXpitrito.png", "/LogoXpitrito2.png"],
    apple: "/LogoXpitrito2.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#131311" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/LogoXpitrito.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/LogoXpitrito2.png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/LogoXpitrito2.png" />
        <script
          // Aplica o tema antes da primeira pintura para não piscar branco.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vertice-tema');var d=t?t==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${newsreader.variable} ${archivo.variable} ${plexMono.variable} min-h-dvh bg-bg text-ink antialiased`}
      >
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-bg"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
