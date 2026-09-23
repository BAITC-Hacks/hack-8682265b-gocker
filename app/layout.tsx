import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";


export const metadata: Metadata = {
  title: "Money Graph",
  description: "Money Graph: Financial Crime Detection Powered by AI",
  icons: {
    icon: [
      { url: "/bw_logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/bw_logo.svg",
    apple: "/bw_logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" href="/bw_logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Google+Sans+Text:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
