import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "mini_inventario_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export const PERMISSIONS = [
  { code: "DASHBOARD.LEER", name: "Ver panel principal", group: "Inicio" },
  { code: "VENTAS.LEER", name: "Ver ventas", group: "Ventas" },
  { code: "VENTAS.CREAR", name: "Registrar ventas", group: "Ventas" },
  { code: "VENTAS.ANULAR", name: "Anular ventas", group: "Ventas" },
  { code: "INVENTARIO.LEER", name: "Ver inventario", group: "Inventario" },
  { code: "INVENTARIO.GESTIONAR", name: "Editar inventario", group: "Inventario" },
  { code: "CLIENTES.LEER", name: "Ver clientes", group: "Clientes y crédito" },
  { code: "CLIENTES.GESTIONAR", name: "Editar clientes", group: "Clientes y crédito" },
  { code: "CREDITO.COBRAR", name: "Registrar abonos", group: "Clientes y crédito" },
  { code: "CREDITO.EXCEDER_LIMITE", name: "Autorizar crédito sobre el límite", group: "Clientes y crédito" },
  { code: "PROVEEDORES.LEER", name: "Ver proveedores y cuentas por pagar", group: "Proveedores" },
  { code: "PROVEEDORES.GESTIONAR", name: "Gestionar proveedores y registrar deuda", group: "Proveedores" },
  { code: "PROVEEDORES.PAGAR", name: "Registrar pagos a proveedores", group: "Proveedores" },
  { code: "CAJA.LEER", name: "Ver caja", group: "Caja" },
  { code: "CAJA.OPERAR", name: "Operar caja", group: "Caja" },
  { code: "CAJA.AUTORIZAR_RETIROS", name: "Autorizar retiros mayores a RD$ 1,000", group: "Caja" },
  { code: "REPORTES.LEER", name: "Ver reportes", group: "Reportes" },
  { code: "AUDITORIA.LEER", name: "Ver auditoría", group: "Auditoría" },
  { code: "USUARIOS.GESTIONAR", name: "Gestionar usuarios y roles", group: "Administración" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: PermissionCode[];
}

export type AuthorizationResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

function getCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.userSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.userSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    },
  });
  return token;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    permissions: session.user.role.permissions.map(({ permission }) => permission.code as PermissionCode),
  };
}

export async function requirePermission(
  request: Request,
  permission: PermissionCode,
): Promise<AuthorizationResult> {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TEST_AUTH_TOKEN &&
    request.headers.get("x-test-auth") === process.env.TEST_AUTH_TOKEN
  ) {
    return {
      ok: true,
      user: {
        id: "test-user",
        name: "Usuario de prueba",
        email: "test@example.com",
        roleId: "test-role",
        roleName: "Pruebas",
        permissions: PERMISSIONS.map(({ code }) => code),
      },
    };
  }
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  }
  if (!user.permissions.includes(permission)) {
    return { ok: false, response: NextResponse.json({ error: "No tienes permiso para realizar esta acción." }, { status: 403 }) };
  }
  return { ok: true, user };
}

export function getCookieToken(request: Request): string | undefined {
  return getCookie(request, SESSION_COOKIE);
}
