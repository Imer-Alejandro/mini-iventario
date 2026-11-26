import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  clearSessionCookie,
  getCookieToken,
  hashSessionToken,
} from "@/server/services/auth.service";

export async function POST(request: Request) {
  const token = getCookieToken(request);
  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
