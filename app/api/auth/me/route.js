import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/server/auth.js";

export const dynamic = "force-dynamic";
export async function GET() { try { const user = await getCurrentUser(); return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 }); } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); } }
