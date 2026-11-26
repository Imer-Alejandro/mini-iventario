import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  return NextResponse.json({ user });
}
