"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "@/app/components/Navbar";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

const routePermissions: Array<[string, string]> = [
  ["/usuarios", "USUARIOS.GESTIONAR"],
  ["/inventario", "INVENTARIO.LEER"],
  ["/clientes", "CLIENTES.LEER"],
  ["/proveedores", "PROVEEDORES.LEER"],
  ["/reportes", "REPORTES.LEER"],
  ["/auditoria", "AUDITORIA.LEER"],
  ["/ventas", "VENTAS.LEER"],
  ["/caja", "CAJA.LEER"],
];

function getLandingPage(user: SessionUser): string {
  if (user.permissions.includes("DASHBOARD.LEER")) return "/";
  return routePermissions.find(([, permission]) => user.permissions.includes(permission))?.[0] ?? "/login";
}

function getRequiredPermission(pathname: string): string {
  if (pathname === "/") return "DASHBOARD.LEER";
  return routePermissions.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "DASHBOARD.LEER";
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/login" || pathname === "/setup";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [readyPath, setReadyPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.ok) {
          const { user: currentUser } = await response.json() as { user: SessionUser };
          if (!active) return;
          setUser(currentUser);
          if (isPublicRoute) {
            router.replace(getLandingPage(currentUser));
            return;
          }
          if (!currentUser.permissions.includes(getRequiredPermission(pathname))) {
            router.replace(getLandingPage(currentUser));
            return;
          }
          setReadyPath(pathname);
          return;
        }

        if (!active) return;
        setUser(null);
        if (!isPublicRoute) {
          const statusResponse = await fetch("/api/auth/status", { cache: "no-store" });
          const status = await statusResponse.json() as { needsSetup: boolean };
          if (active) router.replace(status.needsSetup ? "/setup" : "/login");
          return;
        }
        setReadyPath(pathname);
      } catch {
        if (active && isPublicRoute) setReadyPath(pathname);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [isPublicRoute, pathname, router]);

  if (isPublicRoute) return readyPath === pathname ? children : <AuthLoading />;
  if (readyPath !== pathname || !user) return <AuthLoading />;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="min-h-screen flex-1 lg:pl-64">{children}</main>
    </div>
  );
}

function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        Verificando acceso…
      </div>
    </main>
  );
}
