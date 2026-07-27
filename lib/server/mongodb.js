import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "apex_engineering_erp";

if (!uri) {
  console.warn("MONGODB_URI is not configured. Server data routes will remain unavailable until it is set.");
}

const globalCache = globalThis;

export async function getDatabase() {
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (!globalCache.__apexMongoPromise) {
    const client = new MongoClient(uri, {
      appName: "ApexEngineeringERP",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    globalCache.__apexMongoPromise = client.connect().catch(error => {
      globalCache.__apexMongoPromise = null;
      throw error;
    });
  }
  const client = await globalCache.__apexMongoPromise;
  return client.db(databaseName);
}
