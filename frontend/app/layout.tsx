// /app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "@/app/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CloudBlocks — Cloud IDE",
    template: "%s — CloudBlocks",
  },
  description:
    "Instant cloud development environments. Write, run, and deploy code in seconds.",
  metadataBase: new URL("https://cloudblocks.dev"),
  openGraph: {
    title: "CloudBlocks - Cloud IDE",
    description: "Instant cloud development environments.",
    siteName: "CloudBlocks",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeScript = `
    (() => {
      try {
        const stored = localStorage.getItem("cb-theme");
        const theme = stored === "light" || stored === "dark" ? stored : "dark";
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
        document.documentElement.style.colorScheme = theme;
      } catch {
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      }
    })();
  `;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className="font-sans antialiased"
      >
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
