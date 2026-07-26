import { createEmptyERP, migrateERP, SCHEMA_VERSION } from "../schema.js";
import { getDatabase } from "./mongodb.js";

export async function getERPDocument() {
  const db = await getDatabase();
  const collection = db.collection("erp_instances");
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { _id: "main" },
    { $setOnInsert: { schemaVersion: SCHEMA_VERSION, version: 1, state: createEmptyERP(), createdAt: now, updatedAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  const migrated = migrateERP(result.state);
  if (result.schemaVersion !== SCHEMA_VERSION) {
    await collection.updateOne({ _id: "main" }, { $set: { schemaVersion: SCHEMA_VERSION, state: migrated, updatedAt: now } });
  }
  return { state: migrated, version: result.version || 1 };
}

export async function saveERPDocument(nextState, expectedVersion, actor) {
  const db = await getDatabase();
  const collection = db.collection("erp_instances");
  const state = migrateERP(nextState);
  state.users = [];
  const result = await collection.findOneAndUpdate(
    { _id: "main", version: Number(expectedVersion) },
    { $set: { state, schemaVersion: SCHEMA_VERSION, updatedAt: new Date(), updatedBy: actor }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return { state: migrateERP(result.state), version: result.version };
}
