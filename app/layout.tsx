import type { Metadata } from "next";
import "./globals.css";

// Using the system font stack instead of next/font/google so the build
// doesn't depend on reaching fonts.googleapis.com — one less thing that can
// fail in a locked-down CI environment or offline dev setup. Swap in a real
// webfont later once the product has its own branding.

export const metadata: Metadata = {
  title: "WhatsApp Form Builder",
  description: "Drag-and-drop forms that deliver straight to WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
