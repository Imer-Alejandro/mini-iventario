import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS, requirePermission } from "@/server/services/auth.service";

const validPermissionCodes = new Set<string>(PERMISSIONS.map(({ code }) => code));

function readPermissions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((code) => typeof code !== "string" || !validPermissionCodes.has(code))) {
    return null;
  }
  return [...new Set(value)];
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;

  const roles = await prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    roles: roles.map(({ permissions: links, _count, ...role }) => ({
      ...role,
      permissions: links.map(({ permission }) => permission.code),
      userCount: _count.users,
    })),
    permissions: PERMISSIONS,
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const permissions = readPermissions(body.permissions);
    if (name.length < 2 || !permissions) {
      return NextResponse.json({ error: "Indica un nombre de rol y permisos válidos." }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        permissions: {
          create: permissions.map((code) => ({ permission: { connect: { code } } })),
        },
      },
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "CREATE", entity: "ROLE", entityId: role.id, afterState: { name, permissions } },
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo crear el rol.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "USUARIOS.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const permissions = readPermissions(body.permissions);
    if (!id || name.length < 2 || !permissions) {
      return NextResponse.json({ error: "Indica un rol y permisos válidos." }, { status: 400 });
    }

    const role = await prisma.role.findUnique({
      where: { id },
      include: { users: { where: { status: "ACTIVE" } }, permissions: { include: { permission: true } } },
    });
    if (!role) return NextResponse.json({ error: "No se encontró el rol." }, { status: 404 });
    const hadManagement = role.permissions.some(({ permission }) => permission.code === "USUARIOS.GESTIONAR");
    if (hadManagement && !permissions.includes("USUARIOS.GESTIONAR") && role.users.length > 0) {
      return NextResponse.json(
        { error: "No puedes quitar la gestión de usuarios de un rol que tiene usuarios activos." },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name,
          description: typeof body.description === "string" ? body.description.trim() || null : null,
        },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length > 0) {
        const permissionRecords = await tx.permission.findMany({ where: { code: { in: permissions } } });
        await tx.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({ roleId: id, permissionId: permission.id })),
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id },
        include: { permissions: { include: { permission: true } } },
      });
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "UPDATE", entity: "ROLE", entityId: id, afterState: { name, permissions } },
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      permissions: updated.permissions.map(({ permission }) => permission.code),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el rol.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
