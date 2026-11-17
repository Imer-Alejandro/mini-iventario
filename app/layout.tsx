import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "./components/Navbar";

export const metadata: Metadata = {
  title: "Korta Business — Sistema de Gestión para Carnicería",
  description: "POS, pesaje decimal exacto, arqueos de caja diarios, control de crédito e inventario.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full relative overflow-x-hidden">
        {/* Capa de Orbes de Luz Ambiental para el efecto Glassmorfismo Real */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          {/* Orbe Esmeralda Korta */}
          <div className="absolute -top-24 -left-24 w-[30rem] h-[30rem] rounded-full bg-emerald-400/18 blur-3xl animate-float-slow" />
          {/* Orbe Ámbar Dorado */}
          <div className="absolute top-12 right-0 w-[26rem] h-[26rem] rounded-full bg-amber-300/15 blur-3xl animate-float-reverse" />
          {/* Orbe Cian/Azul Korta */}
          <div className="absolute top-1/2 left-1/3 w-[32rem] h-[32rem] rounded-full bg-sky-400/12 blur-3xl animate-float-slow" />
          {/* Orbe Rosa Melocotón */}
          <div className="absolute -bottom-20 right-10 w-96 h-96 rounded-full bg-rose-300/15 blur-3xl animate-float-reverse" />
        </div>

        {/* Layout principal */}
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <main className="min-h-screen flex-1 lg:pl-64">{children}</main>
        </div>
      </body>
    </html>
  );
}
