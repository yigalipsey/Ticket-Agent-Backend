import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get performance ID from command line argument
const PERFORMANCE_ID = process.argv[2];

if (!PERFORMANCE_ID) {
  console.error("❌ Please provide a performance ID");
  console.log("Usage: node scripts/fetchSingleMatch.js <performance_id>");
  process.exit(1);
}

// Output path
const OUTPUT_PATH = path.resolve(
  __dirname,
  `../data/match_${PERFORMANCE_ID}_hellotickets.json`
);

async function fetchPerformance() {
  try {
    console.log(
      `\n🔍 Fetching performance ${PERFORMANCE_ID} from Hello Tickets...\n`
    );

    // Try to get the performance from performances endpoint
    // We'll search through pages to find it, or try a direct endpoint if available
    let page = 1;
    let found = false;
    let performance = null;

    // First, try to search in performances endpoint
    while (page <= 10 && !found) {
      const { data } = await axios.get(`${API_URL}/performances`, {
        params: {
          limit: 100,
          page: page,
          is_sellable: true,
        },
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (data.performances) {
        performance = data.performances.find(
          (p) => p.id.toString() === PERFORMANCE_ID.toString()
        );
        if (performance) {
          found = true;
          console.log(`✅ Found performance on page ${page}`);
          break;
        }
      }

      // Check if we've reached the end
      if (page * data.per_page >= data.total_count) {
        break;
      }

      page++;
    }

    if (!found) {
      // Try to get it by searching with a specific performer
      // Or try a direct endpoint if it exists
      console.log(
        "⚠️  Performance not found in first pages, trying alternative methods..."
      );

      // Try to search by checking if there's a direct endpoint
      // Some APIs have /performances/{id} endpoint
      try {
        const { data: directData } = await axios.get(
          `${API_URL}/performances/${PERFORMANCE_ID}`,
          {
            headers: {
              Accept: "application/json",
              "X-Public-Key": API_KEY,
            },
          }
        );
        // Handle nested response structure
        performance = directData.performance || directData;
        found = true;
        console.log("✅ Found via direct endpoint");
      } catch (directError) {
        if (directError.response?.status === 404) {
          console.log("❌ Direct endpoint not available (404)");
        } else {
          console.log("❌ Direct endpoint error:", directError.message);
        }
      }
    }

    if (!found || !performance) {
      throw new Error(`Performance ${PERFORMANCE_ID} not found`);
    }

    return performance;
  } catch (error) {
    console.error(
      `❌ Error fetching performance ${PERFORMANCE_ID}:`,
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function saveToFile(performance) {
  // Handle nested structure if exists
  const actualPerformance = performance.performance || performance;

  const data = {
    performance_id: PERFORMANCE_ID,
    fetched_at: new Date().toISOString(),
    performance: actualPerformance,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✅ Saved performance to: ${OUTPUT_PATH}`);

  // Print summary
  console.log("\n📊 Performance Summary:");
  console.log(`   ID: ${actualPerformance.id}`);
  console.log(`   Name: ${actualPerformance.name}`);
  if (actualPerformance.start_date) {
    console.log(
      `   Date: ${actualPerformance.start_date.local_date} ${actualPerformance.start_date.local_time}`
    );
  }
  if (actualPerformance.venue) {
    console.log(`   Venue: ${actualPerformance.venue.name}`);
  }
  if (actualPerformance.performers) {
    console.log(
      `   Teams: ${actualPerformance.performers
        .map((p) => p.name)
        .join(" vs ")}`
    );
  }
  if (actualPerformance.price_range) {
    console.log(
      `   Price: ${actualPerformance.price_range.min_price} - ${actualPerformance.price_range.max_price} ${actualPerformance.price_range.currency}`
    );
  }

  return actualPerformance;
}

async function run() {
  try {
    console.log("=".repeat(60));
    console.log(`📥 Fetching match ${PERFORMANCE_ID} from Hello Tickets`);
    console.log("=".repeat(60));

    const performance = await fetchPerformance();

    const actualPerformance = await saveToFile(performance);

    // Also print the full JSON
    console.log("\n" + "=".repeat(60));
    console.log("📄 Full JSON:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(actualPerformance, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("✅ Done!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    process.exit(1);
  }
}

run();
