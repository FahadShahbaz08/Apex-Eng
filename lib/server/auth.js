import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { getDatabase } from "./mongodb.js";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "apex_erp_session";
const SESSION_SECONDS = 60 * 60 * 12;

const sessionSecret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "apex-development-secret-change-me";
const encode = (value) => Buffer.from(value).toString("base64url");

export async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return { salt, passwordHash: Buffer.from(derived).toString("hex") };
}

export async function verifyPassword(password, user) {
  const derived = Buffer.from(await scrypt(password, user.salt, 64));
  const stored = Buffer.from(user.passwordHash, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

function sign(payload) {
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [body, signature] = token.split(".");
    const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
    const a = Buffer.from(signature); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

export async function ensureDefaultAdmin() {
  const db = await getDatabase();
  const users = db.collection("users");
  await users.createIndex({ username: 1 }, { unique: true });
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const existing = await users.findOne({ username });
  if (existing) return existing;
  const password = process.env.ADMIN_PASSWORD || "admin";
  const credentials = await hashPassword(password);
  const admin = { username, name: "Administrator", role: "Administrator", permissions: ["all"], active: true, ...credentials, createdAt: new Date(), createdBy: "system" };
  const result = await users.insertOne(admin);
  return { ...admin, _id: result.insertedId };
}

export async function authenticate(usernameInput, password) {
  const db = await getDatabase();
  await ensureDefaultAdmin();
  const username = String(usernameInput || "").trim().toLowerCase();
  let user = await db.collection("users").findOne({ username, active: { $ne: false } });
  if (!user) return null;
  let valid = await verifyPassword(String(password || ""), user);
  const envAdmin = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD || "admin";
  if (!valid && username === envAdmin && password === envPassword) {
    const credentials = await hashPassword(envPassword);
    await db.collection("users").updateOne({ _id: user._id }, { $set: credentials });
    user = { ...user, ...credentials }; valid = true;
  }
  return valid ? user : null;
}

export async function createSession(user) {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const token = sign({ userId: String(user._id), exp: expires });
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const store = await cookies();
  const payload = verifyToken(store.get(COOKIE_NAME)?.value || "");
  if (!payload || !ObjectId.isValid(payload.userId)) return null;
  const db = await getDatabase();
  const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId), active: { $ne: false } });
  if (!user) return null;
  return { id: String(user._id), username: user.username, name: user.name, role: user.role, permissions: user.permissions || [] };
}

export async function requireUser(permission = null) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  if (permission && !user.permissions.includes("all") && !user.permissions.includes(permission)) return { error: "You do not have permission for this action.", status: 403 };
  return { user };
}
