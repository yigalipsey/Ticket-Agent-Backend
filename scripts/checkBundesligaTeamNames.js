import "dotenv/config";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // Find Bundesliga league
    const bundesliga = await League.findOne({ slug: "bundesliga" });
    if (!bundesliga) {
      throw new Error("Bundesliga league not found");
    }
    console.log(`✅ Found league: ${bundesliga.name} (${bundesliga._id})\n`);

    // Get all Bundesliga teams
    const teams = await Team.find({ leagueIds: bundesliga._id })
      .sort({ name: 1 })
      .lean();

    console.log(`📊 Found ${teams.length} Bundesliga teams\n`);
    console.log("=".repeat(80));
    console.log("📋 Current Names → Proposed Hebrew Names");
    console.log("=".repeat(80));
    console.log("");

    // Mapping of English names to Hebrew names
    const nameTranslations = {
      "Bayern Munich": "באיירן מינכן",
      "Bayer Leverkusen": "באייר לברקוזן",
      "Borussia Dortmund": "בורוסיה דורטמונד",
      "Borussia Mönchengladbach": "בורוסיה מנשנגלדבך",
      "Eintracht Frankfurt": "איינטרכט פרנקפורט",
      "FC Augsburg": "אוגסבורג",
      "FC Heidenheim": "היידנהיים",
      "FC Köln": "קלן",
      "FC St. Pauli": "סנט פאולי",
      "FC Union Berlin": "אוניון ברלין",
      "FSV Mainz 05": "מיינץ",
      "Hamburger SV": "המבורג",
      "RB Leipzig": "RB לייפציג",
      "SC Freiburg": "פרייבורג",
      "SV Werder Bremen": "ורדר ברמן",
      "TSG 1899 Hoffenheim": "הופנהיים",
      "VfB Stuttgart": "שטוטגרט",
      "VfL Wolfsburg": "וולפסבורג",
      "Bayern München": "באיירן מינכן",
      "Bayer 04 Leverkusen": "באייר לברקוזן",
      "Borussia M'gladbach": "בורוסיה מנשנגלדבך",
      "1. FC Köln": "קלן",
      "1. FC Union Berlin": "אוניון ברלין",
      "1. FSV Mainz 05": "מיינץ",
      "TSG Hoffenheim": "הופנהיים",
    };

    const updates = [];

    for (const team of teams) {
      const currentName = team.name || ""; // The 'name' field (Hebrew)
      const currentNameEn = team.name_en || "";
      
      // Try to find Hebrew translation from English name
      let proposedName = nameTranslations[currentNameEn] || nameTranslations[currentName];
      
      // If still not found, use current name
      if (!proposedName) {
        proposedName = currentName || currentNameEn;
      }

      updates.push({
        teamId: team._id.toString(),
        slug: team.slug,
        currentName: currentName,
        currentNameEn: currentNameEn,
        currentNameHe: currentNameHe,
        proposedName: proposedName,
        needsUpdate: currentName !== proposedName,
      });

      const status = currentName === proposedName ? "✓" : "→";
      console.log(
        `${status} ${(currentName || currentNameEn).padEnd(30)} → ${proposedName}`
      );
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total teams: ${teams.length}`);
    console.log(
      `   Teams needing update: ${updates.filter((u) => u.needsUpdate).length}`
    );
    console.log(
      `   Teams already updated: ${updates.filter((u) => !u.needsUpdate).length}`
    );

    // Show what will be updated
    const teamsToUpdate = updates.filter((u) => u.needsUpdate);
    if (teamsToUpdate.length > 0) {
      console.log("\n📝 Teams that will be updated:");
      for (const update of teamsToUpdate) {
        console.log(
          `   ${update.slug}: "${update.currentName || update.currentNameEn}" → "${update.proposedName}"`
        );
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n⚠️  This is a preview. No changes have been made yet.");
    
    // Apply updates if UPDATE=true
    if (process.env.UPDATE === "true") {
      console.log("\n🔄 Applying updates...\n");
      let updatedCount = 0;
      
      for (const update of teamsToUpdate) {
        try {
          await Team.findByIdAndUpdate(update.teamId, {
            $set: { name: update.proposedName },
          });
          updatedCount++;
          console.log(`✅ Updated ${update.slug}: "${update.proposedName}"`);
        } catch (error) {
          console.error(`❌ Error updating ${update.slug}:`, error.message);
        }
      }
      
      console.log(`\n✅ Successfully updated ${updatedCount} teams`);
    } else {
      console.log("   Set UPDATE=true environment variable to apply changes.");
      console.log("   Example: UPDATE=true node scripts/checkBundesligaTeamNames.js\n");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

