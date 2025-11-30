import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    // 1. Get all teams with P1 mapping but without shirtImageUrl
    const teams = await Team.find({
      "suppliersInfo.supplierRef": p1._id,
      "suppliersInfo.supplierTeamName": { $exists: true, $ne: null },
    }).lean();

    console.log(`Found ${teams.length} teams with P1 mapping\n`);

    const teamsWithoutImage = teams.filter((t) => {
      const p1Info = t.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );
      return (
        !p1Info?.shirtImageUrl || p1Info.shirtImageUrl.trim() === ""
      );
    });

    console.log(
      `Teams without shirtImageUrl: ${teamsWithoutImage.length}\n`
    );

    // 2. Read CSV and build mapping of team names to shirt images
    console.log("Reading CSV file...");
    const teamImageMap = new Map();

    await new Promise((resolve, reject) => {
      fs.createReadStream("data/p1-offers.csv")
        .pipe(csv())
        .on("data", (row) => {
          // Check home team
          if (row.home_team_name && row.home_shirt_image_link) {
            const teamName = row.home_team_name.trim();
            const imageUrl = row.home_shirt_image_link.trim();
            if (imageUrl && imageUrl.includes("http")) {
              if (!teamImageMap.has(teamName)) {
                teamImageMap.set(teamName, imageUrl);
              }
            }
          }

          // Check away team
          if (row.away_team_name && row.away_shirt_image_link) {
            const teamName = row.away_team_name.trim();
            const imageUrl = row.away_shirt_image_link.trim();
            if (imageUrl && imageUrl.includes("http")) {
              if (!teamImageMap.has(teamName)) {
                teamImageMap.set(teamName, imageUrl);
              }
            }
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(
      `Found ${teamImageMap.size} unique team-image mappings in CSV\n`
    );

    // 3. Update teams with shirt images
    console.log("=".repeat(80));
    console.log("Updating teams with shirt images...");
    console.log("=".repeat(80));

    let updated = 0;
    let notFound = 0;
    const notFoundTeams = [];

    for (const team of teamsWithoutImage) {
      const p1Info = team.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );

      if (!p1Info || !p1Info.supplierTeamName) {
        continue;
      }

      const p1TeamName = p1Info.supplierTeamName.trim();
      const imageUrl = teamImageMap.get(p1TeamName);

      if (!imageUrl) {
        notFound++;
        notFoundTeams.push({
          team: team.name_en,
          p1Name: p1TeamName,
        });
        continue;
      }

      // Update the team
      const teamDoc = await Team.findById(team._id);
      const supplierInfoIndex = teamDoc.suppliersInfo.findIndex(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );

      if (supplierInfoIndex >= 0) {
        if (!teamDoc.suppliersInfo[supplierInfoIndex].shirtImageUrl) {
          teamDoc.suppliersInfo[supplierInfoIndex].shirtImageUrl = imageUrl;
          await teamDoc.save();

          console.log(
            `✅ Updated: ${team.name_en} (P1: ${p1TeamName})`
          );
          console.log(`   Image: ${imageUrl}`);
          updated++;
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 Results");
    console.log("=".repeat(80));
    console.log(`Total teams without image: ${teamsWithoutImage.length}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Not found in CSV: ${notFound}`);

    if (notFoundTeams.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Teams not found in CSV:");
      console.log("=".repeat(80));
      notFoundTeams.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.team} (P1: ${item.p1Name})`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




