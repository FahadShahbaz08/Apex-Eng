import { NextResponse } from "next/server";
import { getDatabase } from "../../../lib/server/mongodb.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return NextResponse.json({ online: true, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ online: false, error: "Database connection unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
