import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HelloTickets Bundesliga teams data (from bayern_munich_all_matches.json)
const HELLO_TICKETS_BUNDESLIGA_DATA = [
  { id: "273", name: "FC Bayern Munich" }, // Bayern Munich
  { id: "105", name: "Bayer 04 Leverkusen" },
  { id: "123", name: "Borussia Dortmund" },
  { id: "124", name: "Borussia Mönchengladbach" },
  { id: "251", name: "Eintracht Frankfurt" },
  { id: "271", name: "FC Augsburg" },
  { id: "276", name: "FC Heidenheim" },
  { id: "278", name: "FC Köln" },
  { id: "1863", name: "FC St. Pauli" },
  { id: "280", name: "FC Union Berlin" },
  { id: "294", name: "FSV Mainz 05" },
  { id: "28697", name: "Hamburger SV" },
  { id: "593", name: "RB Leipzig" },
  { id: "630", name: "SC Freiburg" },
  { id: "676", name: "SV Werder Bremen" },
  { id: "763", name: "TSG 1899 Hoffenheim" },
  { id: "786", name: "VfB Stuttgart" },
  { id: "788", name: "VfL Wolfsburg" },
];

// Mapping from DB team names to HelloTickets names
const DB_TO_HT_MAP = {
  "Bayern Munich": "FC Bayern Munich",
  "Bayern München": "FC Bayern Munich",
  "Bayer Leverkusen": "Bayer 04 Leverkusen",
  "Borussia Dortmund": "Borussia Dortmund",
  "Borussia Mönchengladbach": "Borussia Mönchengladbach",
  "Eintracht Frankfurt": "Eintracht Frankfurt",
  "FC Augsburg": "FC Augsburg",
  "FC Heidenheim": "FC Heidenheim",
  "1. FC Heidenheim": "FC Heidenheim",
  "FC Köln": "FC Köln",
  "1. FC Köln": "FC Köln",
  "1.FC Köln": "FC Köln",
  "FC St. Pauli": "FC St. Pauli",
  "FC Union Berlin": "FC Union Berlin",
  "1. FC Union Berlin": "FC Union Berlin",
  "Union Berlin": "FC Union Berlin",
  "FSV Mainz 05": "FSV Mainz 05",
  "Mainz": "FSV Mainz 05",
  "Hamburger SV": "Hamburger SV",
  "Hamburg": "Hamburger SV",
  "RB Leipzig": "RB Leipzig",
  "Leipzig": "RB Leipzig",
  "SC Freiburg": "SC Freiburg",
  "Freiburg": "SC Freiburg",
  "SV Werder Bremen": "SV Werder Bremen",
  "Werder Bremen": "SV Werder Bremen",
  "TSG 1899 Hoffenheim": "TSG 1899 Hoffenheim",
  "1899 Hoffenheim": "TSG 1899 Hoffenheim",
  "Hoffenheim": "TSG 1899 Hoffenheim",
  "VfB Stuttgart": "VfB Stuttgart",
  "Stuttgart": "VfB Stuttgart",
  "VfL Wolfsburg": "VfL Wolfsburg",
  "Wolfsburg": "VfL Wolfsburg",
};

async function updateBundesligaHelloTickets() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("Hello Tickets supplier not found!");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // Find Bundesliga league
    const bundesliga = await League.findOne({ slug: "bundesliga" });
    if (!bundesliga) {
      throw new Error("Bundesliga league not found!");
    }
    console.log(`✅ Found league: ${bundesliga.name} (${bundesliga._id})\n`);

    const teams = await Team.find({ leagueIds: bundesliga._id });
    console.log(`📋 Processing ${teams.length} Bundesliga teams...\n`);

    let updatedCount = 0;
    const notFound = [];
    const results = [];

    for (const team of teams) {
      const dbName = team.name_en || team.name;
      const dbSlug = team.slug;

      let targetHtName = DB_TO_HT_MAP[dbName];

      if (!targetHtName) {
        // Try direct match
        const directMatch = HELLO_TICKETS_BUNDESLIGA_DATA.find(
          (d) => d.name === dbName
        );
        if (directMatch) targetHtName = directMatch.name;
      }

      if (!targetHtName) {
        console.log(`⚠️  Skipping ${dbName} (${dbSlug}) - No mapping found`);
        notFound.push({ name: dbName, slug: dbSlug });
        results.push({
          slug: dbSlug,
          name: dbName,
          htId: null,
          htName: null,
          status: "❌ Not found",
        });
        continue;
      }

      const htData = HELLO_TICKETS_BUNDESLIGA_DATA.find(
        (d) => d.name === targetHtName
      );

      if (!htData) {
        console.log(
          `⚠️  Skipping ${dbName} - Mapped to ${targetHtName} but data missing`
        );
        notFound.push({ name: dbName, slug: dbSlug });
        results.push({
          slug: dbSlug,
          name: dbName,
          htId: null,
          htName: null,
          status: "❌ Data missing",
        });
        continue;
      }

      // Update team
      let suppliersInfo = team.suppliersInfo || [];
      suppliersInfo = suppliersInfo.filter(
        (s) => s.supplierRef.toString() !== supplier._id.toString()
      );

      suppliersInfo.push({
        supplierRef: supplier._id,
        supplierTeamName: htData.name,
        supplierExternalId: htData.id,
      });

      team.suppliersInfo = suppliersInfo;
      await team.save();

      console.log(
        `✅ Updated ${dbName} (${dbSlug}) -> ${htData.name} (ID: ${htData.id})`
      );
      updatedCount++;
      results.push({
        slug: dbSlug,
        name: dbName,
        htId: htData.id,
        htName: htData.name,
        status: "✅ Updated",
      });
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("📊 SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Bundesliga teams in DB: ${teams.length}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`❌ Not found: ${notFound.length}\n`);

    if (notFound.length > 0) {
      console.log("Teams not found in Hello Tickets data:");
      notFound.forEach((item) =>
        console.log(`  - ${item.name} (${item.slug})`)
      );
    }

    // Save results to JSON file
    const outputPath = path.resolve(
      __dirname,
      "../data/dataFromMongo/bundesliga.json"
    );

    // Read existing file
    let existingData = [];
    if (fs.existsSync(outputPath)) {
      existingData = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    }

    // Update each team with HelloTickets info
    const updatedData = existingData.map((team) => {
      const result = results.find((r) => r.slug === team.slug);
      if (result && result.htId) {
        return {
          ...team,
          hellotickets_id: result.htId,
          hellotickets_name: result.htName,
        };
      }
      return team;
    });

    // Save updated file
    fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2), "utf8");
    console.log(`\n✅ Updated ${outputPath} with HelloTickets IDs`);

    // Display table
    console.log("\n📋 Update results:\n");
    console.table(
      results.map((r) => ({
        Team: r.name,
        Slug: r.slug,
        "HT ID": r.htId || "N/A",
        "HT Name": r.htName || "N/A",
        Status: r.status,
      }))
    );
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

updateBundesligaHelloTickets();

