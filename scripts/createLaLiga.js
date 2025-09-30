import mongoose from "mongoose";
import dotenv from "dotenv";
import League from "../src/models/League.js";

dotenv.config();

const LA_LIGA_ID = 140;

async function createLaLiga() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Creating La Liga...");

    // Check if La Liga already exists
    const existingLeague = await League.findOne({
      "externalIds.apiFootball": LA_LIGA_ID,
    });

    if (existingLeague) {
      console.log("⚠️  La Liga already exists:", existingLeague.name);
      return;
    }

    // Create La Liga
    const laLiga = new League({
      leagueId: LA_LIGA_ID,
      name: "La Liga",
      slug: "laliga",
      country: "Spain",
      logoUrl: "https://media.api-sports.io/football/leagues/140.png",
      type: "League",
      externalIds: { apiFootball: LA_LIGA_ID },
    });

    await laLiga.save();
    console.log("✅ Created La Liga:", laLiga.name);

    // Show all leagues
    const allLeagues = await League.find({});
    console.log("\n📊 All leagues in database:");
    allLeagues.forEach((league) => {
      console.log(`  - ${league.name} (${league.slug}) - ${league.country}`);
    });

  } catch (error) {
    console.error("❌ Error creating La Liga:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createLaLiga();
