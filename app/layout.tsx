import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tufi e o Enigma dos Números",
  description: "Uma aventura matemática para o 6º ano. Explore, aprenda e descubra.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
