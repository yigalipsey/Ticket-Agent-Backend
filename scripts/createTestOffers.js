import mongoose from "mongoose";
import { config } from "dotenv";
import FootballEvent from "../src/models/FootballEvent.js";
import Offer from "../src/models/Offer.js";
import Agent from "../src/models/Agent.js";
import Team from "../src/models/Team.js";

config();

async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

async function createTestOffers() {
  await connectToDatabase();

  try {
    console.log("🚀 Creating test offers...");

    // Get Real Madrid fixtures
    const realMadrid = await Team.findOne({ slug: "real-madrid" }).lean();
    const fixtures = await FootballEvent.find({
      $or: [{ homeTeam: realMadrid._id }, { awayTeam: realMadrid._id }],
    })
      .limit(3)
      .lean();
    console.log(`📊 Found ${fixtures.length} fixtures`);

    // Get or create a test agent
    let agent = await Agent.findOne({});
    if (!agent) {
      agent = await Agent.create({
        name: "Test Agent",
        email: "test@example.com",
        phone: "+1234567890",
        isActive: true,
      });
      console.log("✅ Created test agent");
    }

    // Create offers for each fixture
    for (const fixture of fixtures) {
      const offers = [
        {
          fixtureId: fixture._id,
          agentId: agent._id,
          price: Math.floor(Math.random() * 200) + 50, // Random price between 50-250
          currency: "EUR",
          isAvailable: true,
          description: "Premium seats",
          source: "direct",
        },
        {
          fixtureId: fixture._id,
          agentId: agent._id,
          price: Math.floor(Math.random() * 100) + 30, // Random price between 30-130
          currency: "EUR",
          isAvailable: true,
          description: "Standard seats",
          source: "direct",
        },
      ];

      await Offer.insertMany(offers);
      console.log(`✅ Created offers for fixture: ${fixture.slug}`);
    }

    console.log("\n🎉 Test offers created successfully!");
  } catch (error) {
    console.error("❌ Error creating test offers:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

createTestOffers();
