import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HelloTickets teams data from user
const HELLOTICKETS_TEAMS = [
  { id: "1837", name: "AFC Ajax" },
  { id: "11969", name: "Benfica" },
  { id: "660", name: "SSC Napoli" },
  { id: "29382", name: "Qarabağ FK" },
  { id: "123", name: "Borussia Dortmund" },
  { id: "789", name: "Villarreal CF" },
  { id: "1836", name: "Chelsea FC" },
  { id: "272", name: "FC Barcelona" },
  { id: "444", name: "Manchester City FC" },
  { id: "105", name: "Bayer 04 Leverkusen" },
  { id: "520", name: "Newcastle United FC" },
  { id: "537", name: "Olympique de Marseille" },
  { id: "756", name: "Tottenham Hotspur FC" },
  { id: "584", name: "Paris Saint-Germain FC" },
  { id: "13149", name: "Sporting CP" },
  { id: "12177", name: "Club Brugge KV" },
  { id: "1835", name: "Arsenal FC" },
  { id: "273", name: "FC Bayern Munich" },
  { id: "18756", name: "PSV Eindhoven" },
  { id: "422", name: "Liverpool FC" },
  { id: "89", name: "Atletico de Madrid" },
  { id: "277", name: "FC Inter Milan" },
  { id: "28715", name: "SK Slavia Prague" },
  { id: "82", name: "Atalanta BC" },
  { id: "251", name: "Eintracht Frankfurt" },
  { id: "12244", name: "AS Monaco FC" },
  { id: "17993", name: "Galatasaray SK" },
  { id: "381", name: "Juventus FC" },
  { id: "598", name: "Real Madrid CF" },
  { id: "83", name: "Athletic Club" },
  { id: "28531", name: "Pafos FC" },
  { id: "12078", name: "FK Bodø/Glimt" },
  { id: "1860", name: "Union Saint-Gilloise" },
  { id: "29389", name: "Kairat Almaty" },
  { id: "16050", name: "Olympiacos FC" },
];

// Known mappings from HelloTickets name to our slug
const KNOWN_MAPPINGS = {
  "AFC Ajax": "ajax",
  Benfica: "benfica",
  "SSC Napoli": "napoli",
  "Qarabağ FK": "qarabag",
  "Borussia Dortmund": "borussia-dortmund",
  "Villarreal CF": "villarreal",
  "Chelsea FC": "chelsea",
  "FC Barcelona": "barcelona",
  "Manchester City FC": "manchester-city",
  "Bayer 04 Leverkusen": "bayer-leverkusen",
  "Newcastle United FC": "newcastle",
  "Olympique de Marseille": "marseille",
  "Tottenham Hotspur FC": "tottenham",
  "Paris Saint-Germain FC": "paris-saint-germain",
  "Sporting CP": "sporting-cp",
  "Club Brugge KV": "club-brugge-kv",
  "Arsenal FC": "arsenal",
  "FC Bayern Munich": "bayern-munich",
  "PSV Eindhoven": "psv-eindhoven",
  "Liverpool FC": "liverpool",
  "Atletico de Madrid": "atletico-madrid",
  "FC Inter Milan": "inter",
  "SK Slavia Prague": "slavia-praha",
  "Atalanta BC": "atalanta",
  "Eintracht Frankfurt": "eintracht-frankfurt",
  "AS Monaco FC": "monaco",
  "Galatasaray SK": "galatasaray",
  "Juventus FC": "juventus",
  "Real Madrid CF": "real-madrid",
  "Athletic Club": "athletic-bilbao",
  "Pafos FC": "pafos",
  "FK Bodø/Glimt": "bodoglimt",
  "Union Saint-Gilloise": "union-st-gilloise",
  "Kairat Almaty": "kairat-almaty",
  "Olympiacos FC": "olympiakos-piraeus",
};

// Normalize string for comparison
function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Find matching team by slug
function findMatchingTeam(htTeam, clTeams) {
  // First try known mapping - this is the most reliable method
  const knownSlug = KNOWN_MAPPINGS[htTeam.name];
  if (knownSlug) {
    const matched = clTeams.find((t) => t.slug === knownSlug);
    if (matched) {
      return matched;
    }
  }

  // If no known mapping, try to match by slug normalization
  const htName = normalizeString(htTeam.name);

  for (const clTeam of clTeams) {
    const clSlug = normalizeString(clTeam.slug);

    // Check if slug matches normalized name
    if (clSlug === htName) {
      return clTeam;
    }

    // Check if slug contains the normalized name or vice versa
    if (clSlug.includes(htName) || htName.includes(clSlug)) {
      return clTeam;
    }
  }

  return null;
}

function createHelloTicketsMapping() {
  try {
    // Load Champions League teams from JSON
    const clTeamsPath = path.join(
      __dirname,
      "../data/dataFromMongo/champions-league.json"
    );
    const clTeamsData = JSON.parse(fs.readFileSync(clTeamsPath, "utf8"));
    console.log(
      `📋 Loaded ${clTeamsData.length} teams from Champions League JSON`
    );

    // Load Bundesliga teams from JSON (for teams that might be there)
    const bundesligaTeamsPath = path.join(
      __dirname,
      "../data/dataFromMongo/bundesliga.json"
    );
    let bundesligaTeamsData = [];
    if (fs.existsSync(bundesligaTeamsPath)) {
      bundesligaTeamsData = JSON.parse(
        fs.readFileSync(bundesligaTeamsPath, "utf8")
      );
      console.log(
        `📋 Loaded ${bundesligaTeamsData.length} teams from Bundesliga JSON`
      );
    }
    console.log("");

    // Combine all teams for searching
    const allTeamsData = [...clTeamsData, ...bundesligaTeamsData];

    // Create mappings
    const mappings = [];
    const unmatched = [];

    for (const htTeam of HELLOTICKETS_TEAMS) {
      const matchedTeam = findMatchingTeam(htTeam, allTeamsData);

      if (matchedTeam) {
        mappings.push({
          id: matchedTeam._id,
          slug: matchedTeam.slug,
          name: matchedTeam.name,
          hellotickets_id: htTeam.id,
          hellotickets_name: htTeam.name,
        });
        console.log(
          `✅ Matched: ${htTeam.name} -> ${matchedTeam.name} (${matchedTeam.slug})`
        );
      } else {
        unmatched.push(htTeam);
        console.log(`⚠️  No match found for: ${htTeam.name}`);
      }
    }

    // Create output directory
    const outputDir = path.join(__dirname, "../data/hellotickets");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`\n📁 Created directory: ${outputDir}`);
    }

    // Save mapping file
    const outputPath = path.join(outputDir, "champions-league-mapping.json");
    fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2), "utf8");

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Matched: ${mappings.length} teams`);
    console.log(`   ⚠️  Unmatched: ${unmatched.length} teams`);
    console.log(`\n💾 Saved mapping to: ${outputPath}`);

    if (unmatched.length > 0) {
      console.log(`\n⚠️  Unmatched teams:`);
      unmatched.forEach((team) => {
        console.log(`   - ${team.name} (ID: ${team.id})`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createHelloTicketsMapping();
