import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

async function createColTourAgent() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to create Col Tour agent",
      "CREATE_AGENT_001"
    );

    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    logWithCheckpoint("info", "Connected to database", "CREATE_AGENT_002");

    // Check if agent already exists
    const existingAgent = await Agent.findOne({
      email: "coltour@coltour.co.il",
    });

    if (existingAgent) {
      logWithCheckpoint("warn", "Agent already exists", "CREATE_AGENT_003", {
        email: "coltour@coltour.co.il",
        agentId: existingAgent._id,
      });
      console.log("\n⚠️  הסוכן כבר קיים במערכת!");
      console.log(`שם: ${existingAgent.name}`);
      console.log(`מייל: ${existingAgent.email}`);
      console.log(
        `סוג: ${existingAgent.agentType === "agency" ? "סוכנות" : "סוכן עצמאי"}`
      );
      console.log(`חברה: ${existingAgent.companyName || "אין"}`);
      return existingAgent;
    }

    // Generate password hash - default password: "ColTour2025!"
    const defaultPassword = "ColTour2025!";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    logWithCheckpoint("info", "Creating new agent", "CREATE_AGENT_004", {
      email: "coltour@coltour.co.il",
      agentType: "agency",
    });

    // Create new agent
    const newAgent = new Agent({
      email: "coltour@coltour.co.il",
      passwordHash: passwordHash,
      name: "כל תור",
      companyName: "כל תור",
      agentType: "agency",
      isActive: true,
      whatsapp: "+972123456789", // ניתן לעדכן מאוחר יותר
    });

    await newAgent.save();

    logWithCheckpoint(
      "info",
      "Agent created successfully",
      "CREATE_AGENT_005",
      {
        agentId: newAgent._id,
        email: newAgent.email,
        name: newAgent.name,
        agentType: newAgent.agentType,
      }
    );

    console.log("\n✅ סוכן נוצר בהצלחה!");
    console.log("=".repeat(50));
    console.log(`שם: ${newAgent.name}`);
    console.log(`מייל: ${newAgent.email}`);
    console.log(
      `סוג: ${newAgent.agentType === "agency" ? "סוכנות" : "סוכן עצמאי"}`
    );
    console.log(`שם חברה: ${newAgent.companyName}`);
    console.log(`וואטסאפ: ${newAgent.whatsapp}`);
    console.log(`סיסמה זמנית: ${defaultPassword}`);
    console.log("=".repeat(50));
    console.log("\n⚠️  חשוב: יש לשנות את הסיסמה בהתחברות הראשונה!");

    return newAgent;
  } catch (error) {
    logError(error, { operation: "createColTourAgent" });
    console.error("\n❌ שגיאה ביצירת הסוכן:", error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    logWithCheckpoint("info", "Database connection closed", "CREATE_AGENT_006");
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.log("מתחיל ליצור סוכן 'כל תור'...\n");
      await createColTourAgent();
      console.log("\n✨ הסקריפט הסתיים בהצלחה!");
      process.exit(0);
    } catch (error) {
      console.error("\n💥 הסקריפט נכשל!");
      process.exit(1);
    }
  })();
}

export default createColTourAgent;
