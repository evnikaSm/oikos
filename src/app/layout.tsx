import type { Metadata, Viewport } from "next";
import { ThemeManager } from "@/components/theme-settings";
import { themeInitScript } from "@/lib/theme";
import InstallApp from "@/components/install-app";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oikos",
  description: "Oikos is a mobile-first shared household management app for groceries and cleaning rotation.",
  applicationName: "Oikos",
  appleWebApp: { capable: true, title: "Oikos", statusBarStyle: "default" },
  icons: {
    icon: "/icons/oikos.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f1e3d3",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><ThemeManager /><InstallApp />{children}</body>
    </html>
  );
}
