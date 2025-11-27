import "dotenv/config";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import path from "path";

import { clearOffersCache } from "../src/services/offer/utils/cacheHelpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected");

  try {
    const cleared = clearOffersCache();
    console.log(`🧹 Cleared offers cache (entries cleared: ${cleared || 0})`);
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

