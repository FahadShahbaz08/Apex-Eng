import { NextResponse } from "next/server";
import { authenticate, createSession } from "../../../../lib/server/auth.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const user = await authenticate(username, password);
    if (!user) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    await createSession(user);
    return NextResponse.json({ user: { id: String(user._id), username: user.username, name: user.name, role: user.role, permissions: user.permissions || [] } });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
