import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oikos",
  description: "Oikos is a mobile-first shared household management app for groceries and cleaning rotation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
