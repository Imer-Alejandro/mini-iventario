import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const needsSetup = (await prisma.user.count()) === 0;
  return NextResponse.json({ needsSetup });
}
