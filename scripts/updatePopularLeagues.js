import mongoose from "mongoose";
import League from "../src/models/League.js";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";

async function updatePopularLeagues() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Update Premier League and La Liga to be popular
    const popularLeagues = [
      { slug: "epl", name: "Premier League" },
      { slug: "laliga", name: "La Liga" }
    ];

    console.log("📝 Updating leagues to be popular...");
    
    for (const league of popularLeagues) {
      const result = await League.updateOne(
        { slug: league.slug },
        { $set: { isPopular: true } }
      );
      
      if (result.matchedCount === 0) {
        console.log(`⚠️  League not found: ${league.name} (${league.slug})`);
      } else {
        console.log(`✅ Updated ${league.name} (${league.slug}) to be popular`);
      }
    }

    // Verify the updates
    console.log("\n📊 Verifying updates...");
    const popularLeaguesList = await League.find({ isPopular: true }).select("name slug isPopular");
    
    console.log("Popular leagues in database:");
    popularLeaguesList.forEach(league => {
      console.log(`  - ${league.name} (${league.slug}): ${league.isPopular}`);
    });

    console.log("\n✅ Popular leagues update completed successfully!");

  } catch (error) {
    console.error("❌ Error updating popular leagues:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
updatePopularLeagues();
