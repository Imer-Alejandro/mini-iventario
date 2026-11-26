import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSession,
  hashPassword,
  PERMISSIONS,
  setSessionCookie,
} from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
      return NextResponse.json(
        { error: "Ingresa un nombre, un correo válido y una contraseña de al menos 12 caracteres." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      if (await tx.user.count() > 0) throw new Error("La configuración inicial ya fue completada.");

      const permissions = [];
      for (const permission of PERMISSIONS) {
        permissions.push(await tx.permission.upsert({
          where: { code: permission.code },
          create: { code: permission.code, name: permission.name },
          update: { name: permission.name },
        }));
      }
      const role = await tx.role.create({
        data: {
          name: "Administrador",
          description: "Acceso completo al sistema",
          permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
        },
      });
      return tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          pinHash: passwordHash,
          roleId: role.id,
        },
      });
    });

    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo completar la configuración inicial.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
