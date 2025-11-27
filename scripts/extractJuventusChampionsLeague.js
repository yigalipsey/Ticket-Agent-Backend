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

async function extractJuventusChampionsLeague() {
  console.log("📖 Reading XML file...");
  const xmlContent = fs.readFileSync(XML_FILE, "utf-8");

  console.log("🔍 Parsing XML...");
  parseString(xmlContent, (err, result) => {
    if (err) {
      console.error("❌ Error parsing XML:", err);
      return;
    }

    const products = result.products.product || [];
    console.log(`📦 Found ${products.length} total products\n`);

    // Filter Juventus products
    const juventusProducts = products.filter((product) => {
      const homeTeam = product.home_team_name?.[0]?.toLowerCase() || "";
      const awayTeam = product.away_team_name?.[0]?.toLowerCase() || "";
      const brand = product.brand?.[0]?.toLowerCase() || "";
      const name = product.name?.[0]?.toLowerCase() || "";

      return (
        homeTeam.includes("juventus") ||
        awayTeam.includes("juventus") ||
        brand.includes("juventus") ||
        name.includes("juventus")
      );
    });

    console.log(`⚽ Found ${juventusProducts.length} Juventus products\n`);

    // Separate by league
    const championsLeague = [];
    const serieA = [];
    const other = [];

    juventusProducts.forEach((product) => {
      const subsubcategories =
        product.subsubcategories?.[0]?.toLowerCase() || "";
      const homeTeam = product.home_team_name?.[0]?.trim() || "";
      const awayTeam = product.away_team_name?.[0]?.trim() || "";
      const date = product.date_start?.[0]?.trim() || "";
      const price = parseFloat(product.price?.[0]) || 0;
      const name = product.name?.[0] || "";
      const productURL = product.productURL?.[0] || "";

      const match = {
        homeTeam,
        awayTeam,
        date,
        price,
        name,
        url: productURL,
        league: subsubcategories,
      };

      if (subsubcategories.includes("champions league")) {
        championsLeague.push(match);
      } else if (subsubcategories.includes("serie a")) {
        serieA.push(match);
      } else {
        other.push(match);
      }
    });

    console.log("=".repeat(80));
    console.log("CHAMPIONS LEAGUE MATCHES:");
    console.log("=".repeat(80));
    if (championsLeague.length === 0) {
      console.log("❌ No Champions League matches found for Juventus\n");
    } else {
      championsLeague.forEach((match, i) => {
        console.log(
          `${i + 1}. ${match.homeTeam} vs ${match.awayTeam} (${match.date}) - ${
            match.price
          } EUR`
        );
        console.log(`   Name: ${match.name}`);
        console.log(`   League: ${match.league}`);
        console.log("");
      });
    }

    console.log("=".repeat(80));
    console.log(`SERIE A MATCHES: ${serieA.length}`);
    console.log("=".repeat(80));
    if (serieA.length > 0) {
      // Group by match
      const matchesMap = new Map();
      serieA.forEach((match) => {
        const key = `${match.homeTeam}|${match.awayTeam}|${match.date}`;
        if (!matchesMap.has(key)) {
          matchesMap.set(key, {
            ...match,
            minPrice: match.price,
          });
        } else {
          const existing = matchesMap.get(key);
          if (match.price < existing.minPrice) {
            existing.minPrice = match.price;
          }
        }
      });

      Array.from(matchesMap.values())
        .slice(0, 10)
        .forEach((match, i) => {
          console.log(
            `${i + 1}. ${match.homeTeam} vs ${match.awayTeam} (${
              match.date
            }) - ${match.minPrice} EUR`
          );
        });
      if (matchesMap.size > 10) {
        console.log(`\n... and ${matchesMap.size - 10} more Serie A matches`);
      }
    }

    if (other.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log(`OTHER LEAGUES: ${other.length}`);
      console.log("=".repeat(80));
      other.forEach((match, i) => {
        console.log(
          `${i + 1}. ${match.homeTeam} vs ${match.awayTeam} (${match.date}) - ${
            match.league
          }`
        );
      });
    }
  });
}

extractJuventusChampionsLeague().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


