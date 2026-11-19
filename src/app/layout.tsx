import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Académico | Gestión Escolar",
  description: "Plataforma de gestión de calificaciones e insumos escolares",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
