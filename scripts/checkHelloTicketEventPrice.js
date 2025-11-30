import "dotenv/config";
import axios from "axios";

const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

const EVENT_ID = process.argv[2] || "1379095";

async function checkEventPrice(eventId) {
  console.log(`\n🔍 Checking HelloTicket Event ID: ${eventId}\n`);

  // Try 1: Check if it's a performance ID (direct endpoint)
  try {
    console.log("📍 Trying as Performance ID (direct endpoint)...");
    const { data } = await axios.get(`${API_URL}/performances/${eventId}`, {
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });

    const performance = data.performance || data;
    
    console.log("✅ Found as Performance!");
    console.log("\n📊 Event Details:");
    console.log(`   Performance ID: ${performance.id}`);
    console.log(`   Event ID: ${performance.event_id || "N/A"}`);
    console.log(`   Name: ${performance.name || "N/A"}`);
    
    if (performance.start_date) {
      console.log(`   Date: ${performance.start_date.local_date || "N/A"} ${performance.start_date.local_time || ""}`);
    }
    
    if (performance.venue) {
      console.log(`   Venue: ${performance.venue.name || "N/A"}`);
    }
    
    if (performance.price_range) {
      console.log(`\n💰 Price Information:`);
      console.log(`   Min Price: ${performance.price_range.min_price || "N/A"} ${performance.price_range.currency || ""}`);
      console.log(`   Max Price: ${performance.price_range.max_price || "N/A"} ${performance.price_range.currency || ""}`);
      console.log(`   Currency: ${performance.price_range.currency || "N/A"}`);
    } else {
      console.log("\n💰 Price Information: Not available");
    }
    
    if (performance.url) {
      console.log(`\n🔗 URL: ${performance.url}`);
    }
    
    return performance;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log("❌ Not found as Performance ID (404)");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Try 2: Search through performances for matching event_id
  console.log("\n📍 Searching for event_id in performances...");
  try {
    let page = 1;
    let found = false;
    
    while (page <= 20 && !found) {
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
        const matchingPerf = data.performances.find(
          (p) => p.event_id?.toString() === eventId.toString()
        );
        
        if (matchingPerf) {
          found = true;
          console.log(`✅ Found on page ${page} with matching event_id!`);
          console.log("\n📊 Event Details:");
          console.log(`   Performance ID: ${matchingPerf.id}`);
          console.log(`   Event ID: ${matchingPerf.event_id}`);
          console.log(`   Name: ${matchingPerf.name || "N/A"}`);
          
          if (matchingPerf.start_date) {
            console.log(`   Date: ${matchingPerf.start_date.local_date || "N/A"} ${matchingPerf.start_date.local_time || ""}`);
          }
          
          if (matchingPerf.venue) {
            console.log(`   Venue: ${matchingPerf.venue.name || "N/A"}`);
          }
          
          if (matchingPerf.price_range) {
            console.log(`\n💰 Price Information:`);
            console.log(`   Min Price: ${matchingPerf.price_range.min_price || "N/A"} ${matchingPerf.price_range.currency || ""}`);
            console.log(`   Max Price: ${matchingPerf.price_range.max_price || "N/A"} ${matchingPerf.price_range.currency || ""}`);
            console.log(`   Currency: ${matchingPerf.price_range.currency || "N/A"}`);
          } else {
            console.log("\n💰 Price Information: Not available");
          }
          
          if (matchingPerf.url) {
            console.log(`\n🔗 URL: ${matchingPerf.url}`);
          }
          
          return matchingPerf;
        }
      }

      // Check if we've reached the end
      if (page * (data.per_page || 100) >= (data.total_count || 0)) {
        break;
      }

      page++;
    }
    
    if (!found) {
      console.log("❌ Not found as event_id in performances");
    }
  } catch (error) {
    console.log(`❌ Error searching: ${error.message}`);
  }

  console.log("\n❌ Event not found in HelloTicket API");
  return null;
}

// Run the check
checkEventPrice(EVENT_ID).then(() => {
  console.log("\n✅ Done!");
  process.exit(0);
}).catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});




