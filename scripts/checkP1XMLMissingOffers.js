import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import { parseString } from "xml2js";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const XML_FILE = "data/p1/36e68b7b500770cf7b8b7379ce094fca.xml_331398.tmp";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    console.log("Reading XML file...");
    const xmlData = fs.readFileSync(XML_FILE, "utf-8");

    console.log("Parsing XML...");
    const parsedXml = await new Promise((resolve, reject) => {
      parseString(xmlData, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Extract events from XML
    console.log("Extracting events from XML...");
    const events = [];
    
    // Navigate through XML structure to find events
    function extractEvents(node, path = []) {
      if (!node || typeof node !== "object") return;
      
      if (Array.isArray(node)) {
        node.forEach((item) => extractEvents(item, path));
        return;
      }

      // Look for event-like structures
      if (node.event) {
        extractEvents(node.event, [...path, "event"]);
      }
      if (node.events) {
        extractEvents(node.events, [...path, "events"]);
      }
      if (node.item) {
        extractEvents(node.item, [...path, "item"]);
      }
      if (node.items) {
        extractEvents(node.items, [...path, "items"]);
      }

      // Check if this looks like an event with football data
      if (
        node.name &&
        (node.category || node.league || node.homeTeam || node.awayTeam)
      ) {
        const eventName = Array.isArray(node.name) ? node.name[0] : node.name;
        const category = Array.isArray(node.category)
          ? node.category[0]
          : node.category;
        const league = Array.isArray(node.league)
          ? node.league[0]
          : node.league;
        const homeTeam = Array.isArray(node.homeTeam)
          ? node.homeTeam[0]
          : node.homeTeam;
        const awayTeam = Array.isArray(node.awayTeam)
          ? node.awayTeam[0]
          : node.awayTeam;
        const date = Array.isArray(node.date) ? node.date[0] : node.date;
        const url = Array.isArray(node.url) ? node.url[0] : node.url;

        if (
          eventName &&
          (eventName.toLowerCase().includes("vs") ||
            eventName.toLowerCase().includes("v ") ||
            homeTeam ||
            awayTeam)
        ) {
          events.push({
            name: eventName,
            category: category || "",
            league: league || "",
            homeTeam: homeTeam || "",
            awayTeam: awayTeam || "",
            date: date || "",
            url: url || "",
            raw: node,
          });
        }
      }

      // Recursively search all properties
      Object.keys(node).forEach((key) => {
        if (key !== "event" && key !== "events" && key !== "item" && key !== "items") {
          extractEvents(node[key], [...path, key]);
        }
      });
    }

    extractEvents(parsedXml);

    console.log(`Found ${events.length} potential events in XML\n`);

    // Filter for football events and group by league
    const footballEvents = events.filter((e) => {
      const name = (e.name || "").toLowerCase();
      const category = (e.category || "").toLowerCase();
      const league = (e.league || "").toLowerCase();
      return (
        category.includes("football") ||
        league.includes("premier") ||
        league.includes("bundesliga") ||
        league.includes("serie") ||
        league.includes("liga") ||
        league.includes("champions") ||
        league.includes("league") ||
        name.includes("vs") ||
        e.homeTeam ||
        e.awayTeam
      );
    });

    console.log(`Found ${footballEvents.length} football events\n`);

    // Get all existing P1 offers
    const existingOffers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate("fixtureId", "slug homeTeam awayTeam date league")
      .lean();

    console.log(`Found ${existingOffers.length} existing P1 offers\n`);

    // Get all leagues
    const leagues = await League.find({}).lean();
    const leagueMap = new Map();
    leagues.forEach((l) => {
      leagueMap.set(l._id.toString(), l);
    });

    // Group missing events by league
    const missingByLeague = new Map();

    // For now, let's just show what we found
    console.log("=".repeat(80));
    console.log("Sample events from XML:");
    console.log("=".repeat(80));
    footballEvents.slice(0, 20).forEach((e, idx) => {
      console.log(`\n${idx + 1}. ${e.name}`);
      if (e.category) console.log(`   Category: ${e.category}`);
      if (e.league) console.log(`   League: ${e.league}`);
      if (e.homeTeam) console.log(`   Home: ${e.homeTeam}`);
      if (e.awayTeam) console.log(`   Away: ${e.awayTeam}`);
      if (e.date) console.log(`   Date: ${e.date}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("Note: Full analysis requires matching XML events with DB fixtures");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Error:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




