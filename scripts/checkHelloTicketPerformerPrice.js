import "dotenv/config";
import axios from "axios";

const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";
const SANDBOX_API_URL = "https://sandbox-discovery-api.hellotickets.com/v1";

const PERFORMER_ID = process.argv[2] || "1379095";

async function checkPerformerPrice(performerId) {
  console.log(`\n🔍 Checking HelloTicket Performer ID: ${performerId}\n`);

  // Step 1: Get performer details
  // Try live API first
  try {
    console.log("📍 Step 1: Fetching performer details from live API...");
    const { data: performerData } = await axios.get(`${API_URL}/performers/${performerId}`, {
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });

    const performer = performerData.performer || performerData;
    console.log("✅ Performer found!");
    console.log("\n📊 Performer Details:");
    console.log(`   ID: ${performer.id}`);
    console.log(`   Name: ${performer.name || "N/A"}`);
    console.log(`   Category ID: ${performer.category_id || "N/A"}`);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log("❌ Performer not found (404)");
      return null;
    }
    console.log(`❌ Error fetching performer: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }

  // Step 2: Get all performances for this performer
  console.log("\n📍 Step 2: Fetching performances for this performer...");
  let allPerformances = [];
  let page = 1;
  let totalPages = 1;

  try {
    do {
      const { data } = await axios.get(`${API_URL}/performances`, {
        params: {
          performer_id: performerId,
          page: page,
          limit: 100,
          is_sellable: true,
        },
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        console.log(`   ✅ Found ${data.total_count || 0} total performances`);
        totalPages = Math.ceil((data.total_count || 0) / (data.per_page || 100));
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
        console.log(`   📄 Fetched page ${page}/${totalPages} (${allPerformances.length} performances so far)`);
      }

      page++;
    } while (page <= totalPages && page <= 50); // Limit to 50 pages for safety

    console.log(`\n✅ Total performances found: ${allPerformances.length}`);

    if (allPerformances.length === 0) {
      console.log("\n⚠️  No performances found for this performer");
      return null;
    }

    // Step 3: Display price information for all performances
    console.log("\n" + "=".repeat(80));
    console.log("💰 PRICE INFORMATION FOR ALL PERFORMANCES:");
    console.log("=".repeat(80));

    const performancesWithPrices = allPerformances.filter(p => p.price_range);
    const performancesWithoutPrices = allPerformances.filter(p => !p.price_range);

    if (performancesWithPrices.length > 0) {
      console.log(`\n📊 ${performancesWithPrices.length} performances with prices:\n`);
      
      performancesWithPrices
        .sort((a, b) => {
          const dateA = new Date(a.start_date?.date_time || 0);
          const dateB = new Date(b.start_date?.date_time || 0);
          return dateA - dateB;
        })
        .forEach((perf, index) => {
          console.log(`${index + 1}. ${perf.name || "N/A"}`);
          if (perf.start_date) {
            console.log(`   📅 Date: ${perf.start_date.local_date || "N/A"} ${perf.start_date.local_time || ""}`);
          }
          if (perf.venue) {
            console.log(`   🏟️  Venue: ${perf.venue.name || "N/A"}`);
          }
          if (perf.price_range) {
            console.log(`   💰 Price: ${perf.price_range.min_price || "N/A"} - ${perf.price_range.max_price || "N/A"} ${perf.price_range.currency || ""}`);
          }
          if (perf.url) {
            console.log(`   🔗 URL: ${perf.url}`);
          }
          console.log(`   Performance ID: ${perf.id}`);
          if (perf.event_id) {
            console.log(`   Event ID: ${perf.event_id}`);
          }
          console.log("");
        });

      // Summary of prices
      const prices = performancesWithPrices
        .map(p => p.price_range?.min_price)
        .filter(p => p !== undefined && p !== null);
      
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const currency = performancesWithPrices[0]?.price_range?.currency || "";
        console.log("=".repeat(80));
        console.log(`📈 PRICE SUMMARY:`);
        console.log(`   Lowest price: ${minPrice} ${currency}`);
        console.log(`   Highest price: ${maxPrice} ${currency}`);
        console.log(`   Performances with prices: ${performancesWithPrices.length}`);
        console.log("=".repeat(80));
      }
    }

    if (performancesWithoutPrices.length > 0) {
      console.log(`\n⚠️  ${performancesWithoutPrices.length} performances without price information`);
    }

    return allPerformances;

  } catch (error) {
    console.log(`❌ Error fetching performances: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Run the check
checkPerformerPrice(PERFORMER_ID).then(() => {
  console.log("\n✅ Done!");
  process.exit(0);
}).catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});

