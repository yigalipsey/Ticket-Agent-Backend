import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * סקריפט לעדכון קבוצות פופולריות
 * מסמן קבוצות מפורסמות כ-isPopular: true
 */

// רשימת קבוצות פופולריות (לפי slug או שם)
const POPULAR_TEAMS = [
  // ליגה אנגלית
  "manchester-united",
  "manchester-city",
  "liverpool",
  "chelsea",
  "arsenal",
  "tottenham-hotspur",

  // ליגה ספרדית
  "real-madrid",
  "barcelona",
  "atletico-madrid",
  "sevilla",

  // ליגה איטלקית
  "juventus",
  "inter-milan",
  "ac-milan",
  "napoli",
  "roma",

  // ליגה גרמנית
  "bayern-munich",
  "borussia-dortmund",
  "rb-leipzig",

  // ליגה צרפתית
  "paris-saint-germain",
  "marseille",
  "lyon",

  // ליגות אחרות
  "ajax",
  "porto",
  "benfica",
];

async function updatePopularTeams() {
  try {
    console.log("🔌 מתחבר למסד הנתונים...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ התחברות הצליחה!");

    console.log("\n📊 מעדכן קבוצות פופולריות...");

    // 1. איפוס כל הקבוצות ל-isPopular: false
    console.log("\n1️⃣ מאפס את כל הקבוצות...");
    const resetResult = await Team.updateMany(
      {},
      { $set: { isPopular: false } }
    );
    console.log(`   ✅ אופסו ${resetResult.modifiedCount} קבוצות`);

    // 2. עדכון קבוצות פופולריות
    console.log("\n2️⃣ מעדכן קבוצות פופולריות...");
    let updatedCount = 0;
    let notFoundCount = 0;

    for (const teamSlug of POPULAR_TEAMS) {
      const team = await Team.findOne({ slug: teamSlug });

      if (team) {
        team.isPopular = true;
        await team.save();
        console.log(`   ✅ ${team.name_he || team.name_en} (${teamSlug})`);
        updatedCount++;
      } else {
        console.log(`   ⚠️  לא נמצא: ${teamSlug}`);
        notFoundCount++;
      }
    }

    // 3. סיכום
    console.log("\n📈 סיכום:");
    console.log(`   ✅ עודכנו: ${updatedCount} קבוצות`);
    console.log(`   ⚠️  לא נמצאו: ${notFoundCount} קבוצות`);

    // 4. הצגת קבוצות פופולריות
    console.log("\n🌟 קבוצות פופולריות:");
    const popularTeams = await Team.find({ isPopular: true })
      .select("name_en name_he slug")
      .lean();

    popularTeams.forEach((team, index) => {
      console.log(
        `   ${index + 1}. ${team.name_he || team.name_en} (${team.slug})`
      );
    });

    console.log("\n✅ הסקריפט הסתיים בהצלחה!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ שגיאה:", error);
    process.exit(1);
  }
}

// הרצת הסקריפט
updatePopularTeams();
