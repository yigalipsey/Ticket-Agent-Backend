import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the CSV file
const csvFilePath = path.join(__dirname, "../data/p1-offers.csv");
const outputDir = path.join(__dirname, "../data/p1");
const outputFilePath = path.join(outputDir, "premier_league_matches.json");

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

// Filter Premier League matches
const premierLeagueMatches = records.filter((record) => {
  const categoryPath = (record.categoryPath || "").toLowerCase();
  return (
    categoryPath.includes("premier league") ||
    categoryPath.includes("premier league 2025-2026")
  );
});

console.log(`Premier League records: ${premierLeagueMatches.length}`);

// Group by match and find minimum price
const matchMap = new Map();

premierLeagueMatches.forEach((record) => {
  const homeTeam = record.home_team_name || "";
  const awayTeam = record.away_team_name || "";
  const dateStart = record.date_start || "";
  const price = parseFloat(record.price) || 0;
  const priceTicketHotel = parseFloat(record.price_ticket_hotel) || 0;

  // Create a unique key for each match
  const matchKey = `${homeTeam}|${awayTeam}|${dateStart}`;

  // Use price_ticket_hotel if available, otherwise use price
  const effectivePrice = priceTicketHotel > 0 ? priceTicketHotel : price;

  if (!matchMap.has(matchKey)) {
    matchMap.set(matchKey, {
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

// Convert map to array and sort by date
const matches = Array.from(matchMap.values()).sort((a, b) => {
  return new Date(a.date_start) - new Date(b.date_start);
});

console.log(`Unique Premier League matches: ${matches.length}`);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write to JSON file
const output = {
  total_matches: matches.length,
  generated_at: new Date().toISOString(),
  matches: matches,
};

fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2), "utf-8");

console.log(`\nOutput written to: ${outputFilePath}`);
console.log(`Total matches: ${matches.length}`);
console.log(
  `Price range: £${Math.min(...matches.map((m) => m.min_price)).toFixed(
    2
  )} - £${Math.max(...matches.map((m) => m.min_price)).toFixed(2)}`
);


