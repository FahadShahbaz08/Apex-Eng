import { NextResponse } from "next/server";
import { getDatabase } from "../../../lib/server/mongodb.js";
import { hashPassword, requireUser } from "../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser("all"); if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const db = await getDatabase();
    const users = await db.collection("users").find({}, { projection: { passwordHash: 0, salt: 0 } }).sort({ name: 1 }).toArray();
    return NextResponse.json({ users: users.map(u => ({ ...u, id: String(u._id), _id: undefined })) });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const auth = await requireUser("all"); if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    if (!username || !body.name || String(body.password || "").length < 6) return NextResponse.json({ error: "Name, username and a password of at least 6 characters are required." }, { status: 400 });
    const db = await getDatabase();
    const credentials = await hashPassword(body.password);
    const user = { username, name: body.name, role: body.role || "Viewer", permissions: Array.isArray(body.permissions) ? body.permissions : ["view"], department: body.department || "", active: true, ...credentials, createdAt: new Date(), createdBy: auth.user.username };
    try { const result = await db.collection("users").insertOne(user); return NextResponse.json({ user: { id: String(result.insertedId), username, name: user.name, role: user.role, permissions: user.permissions, department: user.department, active: true } }, { status: 201 }); }
    catch (error) { if (error.code === 11000) return NextResponse.json({ error: "This username already exists." }, { status: 409 }); throw error; }
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
