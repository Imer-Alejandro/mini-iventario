import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getCookieToken,
  hashPassword,
  hashSessionToken,
  requirePermission,
} from "@/server/services/auth.service";

const userSelection = {
  id: true,
  name: true,
  email: true,
  status: true,
  roleId: true,
  role: { select: { name: true } },
  createdAt: true,
} as const;

export async function GET(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ select: userSelection, orderBy: { createdAt: "desc" } }),
    prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ users, roles });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleId = typeof body.roleId === "string" ? body.roleId : "";
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !roleId) {
      return NextResponse.json(
        { error: "Completa nombre, correo, rol y una contraseña de al menos 12 caracteres." },
        { status: 400 },
      );
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return NextResponse.json({ error: "El rol seleccionado no existe." }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, pinHash: passwordHash, roleId },
      select: userSelection,
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "CREATE", entity: "USER", entityId: user.id, afterState: { email, role: role.name } },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo crear el usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const existing = id ? await prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    }) : null;
    if (!existing) return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });

    const name = typeof body.name === "string" ? body.name.trim() : existing.name;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : existing.email;
    const roleId = typeof body.roleId === "string" ? body.roleId : existing.roleId;
    const status = body.status === "INACTIVE" ? "INACTIVE" : body.status === "ACTIVE" ? "ACTIVE" : existing.status;
    const password = typeof body.password === "string" ? body.password : "";
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (password && password.length < 12)) {
      return NextResponse.json({ error: "El nombre, correo o contraseña no son válidos." }, { status: 400 });
    }
    if (id === auth.user.id && (roleId !== existing.roleId || status !== existing.status)) {
      return NextResponse.json({ error: "No puedes cambiar tu propio rol ni desactivar tu usuario." }, { status: 409 });
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return NextResponse.json({ error: "El rol seleccionado no existe." }, { status: 400 });
    const wasManager = existing.status === "ACTIVE" &&
      existing.role.permissions.some(({ permission }) => permission.code === "USUARIOS.GESTIONAR");
    const remainsManager = status === "ACTIVE" &&
      role.permissions.some(({ permission }) => permission.code === "USUARIOS.GESTIONAR");
    if (wasManager && !remainsManager) {
      const activeManagers = await prisma.user.count({
        where: {
          status: "ACTIVE",
          role: { permissions: { some: { permission: { code: "USUARIOS.GESTIONAR" } } } },
        },
      });
      if (activeManagers <= 1) {
        return NextResponse.json({ error: "Debe permanecer al menos un usuario activo con gestión de usuarios." }, { status: 409 });
      }
    }

    const newPasswordHash = password ? await hashPassword(password) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      if (newPasswordHash || status === "INACTIVE") {
        const currentToken = id === auth.user.id ? getCookieToken(request) : undefined;
        await tx.userSession.deleteMany({
          where: {
            userId: id,
            ...(currentToken ? { tokenHash: { not: hashSessionToken(currentToken) } } : {}),
          },
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          name,
          email,
          roleId,
          status,
          ...(newPasswordHash ? { passwordHash: newPasswordHash, pinHash: newPasswordHash } : {}),
        },
        select: userSelection,
      });
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "UPDATE", entity: "USER", entityId: id, afterState: { email, role: role.name, status } },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
