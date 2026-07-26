import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth.js";
import { getERPDocument, saveERPDocument } from "../../../lib/server/data.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { const auth = await requireUser(); if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status }); const document = await getERPDocument(); return NextResponse.json(document); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const auth = await requireUser(body.permission || "all");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const saved = await saveERPDocument(body.state, body.version, auth.user.username);
    if (!saved) return NextResponse.json({ error: "The ERP was changed by another user. The latest data has been loaded; please repeat your action.", conflict: true }, { status: 409 });
    return NextResponse.json(saved);
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
