import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import Agent from "../src/models/Agent.js";

// Load environment variables
dotenv.config();

async function createTestAgent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ email: "test@test.com" });
    if (existingAgent) {
      console.log("⚠️  Agent with email 'test@test.com' already exists");
      console.log("Agent ID:", existingAgent._id.toString());
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const password = "test123";
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create agent
    const agent = new Agent({
      email: "test@test.com",
      passwordHash,
      name: "test agent",
      agentType: "individual",
      isActive: true,
    });

    const savedAgent = await agent.save();

    console.log("✅ Test agent created successfully!");
    console.log("Agent ID:", savedAgent._id.toString());
    console.log("Email:", savedAgent.email);
    console.log("Password:", password);
    console.log("Name:", savedAgent.name);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error creating test agent:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createTestAgent();
