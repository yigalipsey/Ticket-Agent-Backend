import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

async function updateFixtureSlugs() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Updating fixture slugs with league prefixes...");

    // Get all fixtures with populated data
    const fixtures = await FootballEvent.find({})
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .populate("league", "name slug");

    let updatedCount = 0;

    for (const fixture of fixtures) {
      try {
        // Get league slug
        const leagueSlug = fixture.league.slug || "unknown";
        
        // Create new slug with league prefix
        const newSlug = `${leagueSlug}-${fixture.homeTeam.slug}-vs-${fixture.awayTeam.slug}-${fixture.roundNumber}`;

        // Update the fixture
        await FootballEvent.updateOne(
          { _id: fixture._id },
          { slug: newSlug }
        );

        console.log(`✅ Updated: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name} → ${newSlug}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to update fixture ${fixture._id}:`, error.message);
      }
    }

    console.log(`🎉 Successfully updated ${updatedCount} fixture slugs`);

    // Show updated fixtures
    const updatedFixtures = await FootballEvent.find({})
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .populate("league", "name")
      .sort({ date: 1 });

    console.log("\n📋 Updated Fixture Slugs:");
    updatedFixtures.forEach((fixture) => {
      console.log(`  - ${fixture.slug} (${fixture.homeTeam.name} vs ${fixture.awayTeam.name})`);
    });

  } catch (error) {
    console.error("❌ Error updating fixture slugs:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the update
updateFixtureSlugs();
