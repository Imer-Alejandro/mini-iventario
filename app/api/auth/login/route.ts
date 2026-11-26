import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
} from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== "ACTIVE" || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    await prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN", entity: "USER", entityId: user.id },
    });
    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
