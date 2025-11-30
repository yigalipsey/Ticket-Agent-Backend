import fs from "fs";
import { parseString } from "xml2js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XML_FILE = path.join(
  __dirname,
  "../data/p1/36e68b7b500770cf7b8b7379ce094fca.xml_331398.tmp"
);
const OUTPUT_FILE = path.join(
  __dirname,
  "../data/p1/bundesliga_matches_from_xml.json"
);

async function extractBundesligaMatches() {
  console.log("📖 Reading XML file...");
  const xmlContent = fs.readFileSync(XML_FILE, "utf-8");

  console.log("🔍 Parsing XML...");
  parseString(xmlContent, (err, result) => {
    if (err) {
      console.error("❌ Error parsing XML:", err);
      return;
    }

    const products = result.products.product || [];
    console.log(`📦 Found ${products.length} total products`);

    // Filter Bundesliga products
    const bundesligaProducts = products.filter((product) => {
      const subsubcategories =
        product.subsubcategories && product.subsubcategories[0];
      return (
        subsubcategories &&
        (subsubcategories.toLowerCase().includes("bundesliga") ||
          subsubcategories.toLowerCase().includes("german"))
      );
    });

    console.log(`⚽ Found ${bundesligaProducts.length} Bundesliga products\n`);

    // Group by match (homeTeam vs awayTeam + date)
    const matchesMap = new Map();

    bundesligaProducts.forEach((product) => {
      try {
        // Extract match info - use dedicated fields first
        const homeTeam = product.home_team_name?.[0]?.trim() || "";
        const awayTeam = product.away_team_name?.[0]?.trim() || "";
        const date = product.date_start?.[0]?.trim() || "";
        const price = parseFloat(product.price?.[0]) || 0;
        const productURL = product.productURL?.[0]?.trim() || "";
        const name = product.name?.[0] || "";
        const subsubcategories = product.subsubcategories?.[0] || "";

        // If teams not in dedicated fields, try to extract from name
        let finalHomeTeam = homeTeam;
        let finalAwayTeam = awayTeam;

        if (!finalHomeTeam || !finalAwayTeam) {
          // Pattern: "Team A vs Team B" or "Team A v Team B"
          const vsMatch = name.match(/(.+?)\s+(?:vs|v\.?)\s+(.+?)(?:\s*–|$)/i);
          if (vsMatch) {
            finalHomeTeam = vsMatch[1].trim();
            finalAwayTeam = vsMatch[2].trim();
          }
        }

        if (!finalHomeTeam || !finalAwayTeam || !date || price === 0) {
          return; // Skip invalid entries
        }

        // Create unique key for match
        const key = `${finalHomeTeam}|${finalAwayTeam}|${date}`;

        if (!matchesMap.has(key)) {
          matchesMap.set(key, {
            homeTeam: finalHomeTeam,
            awayTeam: finalAwayTeam,
            date,
            minPrice: price,
            url: productURL,
            productName: name,
            league: subsubcategories,
          });
        } else {
          // Update if price is lower
          const existing = matchesMap.get(key);
          if (price < existing.minPrice) {
            existing.minPrice = price;
            existing.url = productURL;
            existing.productName = name;
          }
        }
      } catch (error) {
        console.error("Error processing product:", error);
      }
    });

    const matches = Array.from(matchesMap.values()).sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });

    console.log(`✅ Found ${matches.length} unique Bundesliga matches\n`);

    // Save to JSON
    const output = {
      totalMatches: matches.length,
      matches: matches,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);

    // Show sample
    console.log("\n📋 Sample matches:");
    matches.slice(0, 15).forEach((match, i) => {
      console.log(
        `${i + 1}. ${match.homeTeam} vs ${match.awayTeam} (${match.date}) - ${
          match.minPrice
        } EUR`
      );
    });
    if (matches.length > 15) {
      console.log(`\n... and ${matches.length - 15} more matches`);
    }
  });
}

extractBundesligaMatches().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



