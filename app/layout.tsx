import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NoFlashScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Trackr",
  description: "Internal task tracker for teams",
  manifest: "/manifest.webmanifest",
  applicationName: "Trackr",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trackr",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#13151a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body className="min-h-[100dvh] bg-background text-foreground">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
