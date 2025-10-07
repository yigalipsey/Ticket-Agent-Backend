import mongoose from "mongoose";
import dotenv from "dotenv";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

// Load environment variables
dotenv.config();

/**
 * סקריפט לעדכון 10 משחקים להיות חמים
 */
async function setHotFixtures() {
  try {
    console.log("🔥 [SetHotFixtures] Starting script...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ [SetHotFixtures] Connected to MongoDB");

    // שליפת 10 משחקים קרובים (לא חמים עדיין)
    const upcomingFixtures = await FootballEvent.find({
      isHot: { $ne: true }, // לא חמים
      date: { $gte: new Date() }, // עתידיים
    })
      .populate("league", "name")
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .sort({ date: 1 })
      .limit(10)
      .lean();

    console.log(
      `📋 [SetHotFixtures] Found ${upcomingFixtures.length} upcoming fixtures`
    );

    if (upcomingFixtures.length === 0) {
      console.log("⚠️ [SetHotFixtures] No upcoming fixtures found");
      return;
    }

    // הצגת המשחקים שנבחרו
    console.log("\n🎯 [SetHotFixtures] Selected fixtures to make hot:");
    upcomingFixtures.forEach((fixture, index) => {
      console.log(
        `${index + 1}. ${fixture.homeTeam?.name || "TBD"} vs ${
          fixture.awayTeam?.name || "TBD"
        }`
      );
      console.log(`   League: ${fixture.league?.name || "Unknown"}`);
      console.log(
        `   Date: ${new Date(fixture.date).toLocaleDateString("he-IL")}`
      );
      console.log(`   Slug: ${fixture.slug}`);
      console.log("");
    });

    // עדכון המשחקים להיות חמים
    const fixtureIds = upcomingFixtures.map((f) => f._id);

    const updateResult = await FootballEvent.updateMany(
      { _id: { $in: fixtureIds } },
      { $set: { isHot: true } }
    );

    console.log(
      `✅ [SetHotFixtures] Updated ${updateResult.modifiedCount} fixtures to hot status`
    );

    // אימות - שליפת המשחקים החמים החדשים
    const hotFixtures = await FootballEvent.find({
      _id: { $in: fixtureIds },
      isHot: true,
    })
      .populate("league", "name")
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .sort({ date: 1 })
      .lean();

    console.log("\n🔥 [SetHotFixtures] Hot fixtures after update:");
    hotFixtures.forEach((fixture, index) => {
      console.log(
        `${index + 1}. ${fixture.homeTeam?.name || "TBD"} vs ${
          fixture.awayTeam?.name || "TBD"
        }`
      );
      console.log(`   League: ${fixture.league?.name || "Unknown"}`);
      console.log(
        `   Date: ${new Date(fixture.date).toLocaleDateString("he-IL")}`
      );
      console.log(`   Hot: ${fixture.isHot ? "🔥" : "❌"}`);
    });

    console.log(`\n🎉 [SetHotFixtures] Script completed successfully!`);
    console.log(
      `📊 [SetHotFixtures] Total hot fixtures: ${hotFixtures.length}`
    );
  } catch (error) {
    console.error("❌ [SetHotFixtures] Error:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 [SetHotFixtures] Disconnected from MongoDB");
    process.exit(0);
  }
}

// הרצת הסקריפט
setHotFixtures();
