import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the CSV file
const csvFilePath = path.join(__dirname, "../data/p1-offers.csv");
const outputDir = path.join(__dirname, "../data/p1");
const outputFilePath = path.join(outputDir, "all_football_matches.json");

console.log("Reading CSV file...");
const csvContent = fs.readFileSync(csvFilePath, "utf-8");

// Parse CSV
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  trim: true,
});

console.log(`Total records: ${records.length}`);

// Filter football matches (excluding Premier League)
const footballMatches = records.filter((record) => {
  const categoryPath = (record.categoryPath || "").toLowerCase();
  const isFootball = categoryPath.includes("football");
  const isPremierLeague = categoryPath.includes("premier league");
  return isFootball && !isPremierLeague;
});

console.log(
  `Football matches (excluding Premier League): ${footballMatches.length}`
);

// Group by match and find minimum price
const matchMap = new Map();

footballMatches.forEach((record) => {
  const homeTeam = record.home_team_name || "";
  const awayTeam = record.away_team_name || "";
  const dateStart = record.date_start || "";
  const categoryPath = record.categoryPath || "";
  const price = parseFloat(record.price) || 0;
  const priceTicketHotel = parseFloat(record.price_ticket_hotel) || 0;

  // Extract league name from categoryPath
  // Format: "event tickets > football > [league] > [team]"
  const pathParts = categoryPath.split(">").map((p) => p.trim());
  const leagueName = pathParts.length >= 3 ? pathParts[2] : "Unknown";

  // Create a unique key for each match
  const matchKey = `${leagueName}|${homeTeam}|${awayTeam}|${dateStart}`;

  // Use price_ticket_hotel if available, otherwise use price
  const effectivePrice = priceTicketHotel > 0 ? priceTicketHotel : price;

  if (!matchMap.has(matchKey)) {
    matchMap.set(matchKey, {
      league: leagueName,
      home_team_name: homeTeam,
      away_team_name: awayTeam,
      date_start: dateStart,
      date_string_local_time: record.date_string_local_time || "",
      venue_name: record.venue_name || "",
      venue_city: record.venue_city || "",
      country: record.country || "",
      min_price: effectivePrice,
      min_price_offer: {
        id: record.id || "",
        name: record.name || "",
        price: price,
        price_ticket_hotel: priceTicketHotel,
        productURL: record.productURL || "",
        description: record.description || "",
        seating_plan: record.extraInfo
          ? extractSeatingPlan(record.extraInfo)
          : "",
        home_shirt_image_link: record.home_shirt_image_link || "",
        away_shirt_image_link: record.away_shirt_image_link || "",
      },
    });
  } else {
    const existingMatch = matchMap.get(matchKey);
    if (effectivePrice < existingMatch.min_price && effectivePrice > 0) {
      existingMatch.min_price = effectivePrice;
      existingMatch.min_price_offer = {
        id: record.id || "",
        name: record.name || "",
        price: price,
        price_ticket_hotel: priceTicketHotel,
        productURL: record.productURL || "",
        description: record.description || "",
        seating_plan: record.extraInfo
          ? extractSeatingPlan(record.extraInfo)
          : "",
        home_shirt_image_link: record.home_shirt_image_link || "",
        away_shirt_image_link: record.away_shirt_image_link || "",
      };
    }
  }
});

// Helper function to extract seating plan from extraInfo
function extractSeatingPlan(extraInfo) {
  const seatingPlanMatch = extraInfo.match(/Seating plan:\s*([^|]+)/i);
  return seatingPlanMatch ? seatingPlanMatch[1].trim() : "";
}

// Convert map to array and sort by league, then by date
const matches = Array.from(matchMap.values()).sort((a, b) => {
  if (a.league !== b.league) {
    return a.league.localeCompare(b.league);
  }
  return new Date(a.date_start) - new Date(b.date_start);
});

console.log(`Unique football matches: ${matches.length}`);

// Group by league for summary
const leaguesMap = new Map();
matches.forEach((match) => {
  if (!leaguesMap.has(match.league)) {
    leaguesMap.set(match.league, []);
  }
  leaguesMap.get(match.league).push(match);
});

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write to JSON file
const output = {
  total_matches: matches.length,
  total_leagues: leaguesMap.size,
  generated_at: new Date().toISOString(),
  leagues_summary: Array.from(leaguesMap.entries()).map(
    ([league, leagueMatches]) => ({
      league: league,
      match_count: leagueMatches.length,
      price_range: {
        min: Math.min(...leagueMatches.map((m) => m.min_price)),
        max: Math.max(...leagueMatches.map((m) => m.min_price)),
      },
    })
  ),
  matches: matches,
};

fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nOutput written to: ${outputFilePath}`);
console.log(`\n📊 Summary by League:`);
console.log("=".repeat(60));
leaguesMap.forEach((leagueMatches, league) => {
  const minPrice = Math.min(...leagueMatches.map((m) => m.min_price));
  const maxPrice = Math.max(...leagueMatches.map((m) => m.min_price));
  console.log(
    `${league}: ${leagueMatches.length} matches (€${minPrice.toFixed(
      2
    )} - €${maxPrice.toFixed(2)})`
  );
});
console.log(`\nTotal matches: ${matches.length}`);
console.log(`Total leagues: ${leaguesMap.size}`);



