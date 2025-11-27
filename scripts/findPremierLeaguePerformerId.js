import "dotenv/config";
import axios from "axios";

// API Configuration
const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";
const DISCOVERY_API_URL = "https://api-live.hellotickets.com/discovery/v1";

async function searchPremierLeague() {
  try {
    console.log("🔍 Searching for Premier League performer...\n");

    // Try discovery API
    console.log("📡 Trying Discovery API...");
    try {
      const { data } = await axios.get(`${DISCOVERY_API_URL}/performers`, {
        params: {
          name: "Premier League",
        },
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      console.log("✅ Discovery API Response:");
      console.log(JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.log("❌ Discovery API Error:", error.message);
      if (error.response) {
        console.log("Response status:", error.response.status);
        console.log("Response data:", JSON.stringify(error.response.data, null, 2));
      }
    }

    // Try regular API performers endpoint
    console.log("\n📡 Trying Regular API /performers endpoint...");
    try {
      let page = 1;
      let found = false;
      const searchTerms = ["Premier League", "premier league", "EPL", "English Premier League"];

      while (page <= 5 && !found) {
        const { data } = await axios.get(`${API_URL}/performers`, {
          params: {
            limit: 200,
            page: page,
          },
          headers: {
            Accept: "application/json",
            "X-Public-Key": API_KEY,
          },
        });

        if (data.performers) {
          const matches = data.performers.filter((p) => {
            const lowerName = p.name.toLowerCase();
            return searchTerms.some((term) => lowerName.includes(term.toLowerCase()));
          });

          if (matches.length > 0) {
            console.log("✅ Found matches in Regular API:");
            matches.forEach((m) => {
              console.log(`   ID: ${m.id}, Name: ${m.name}, Category: ${m.category_id}`);
            });
            found = true;
            return matches;
          }
        }

        page++;
      }

      if (!found) {
        console.log("❌ No Premier League performer found in first 5 pages");
      }
    } catch (error) {
      console.log("❌ Regular API Error:", error.message);
      if (error.response) {
        console.log("Response status:", error.response.status);
        console.log("Response data:", JSON.stringify(error.response.data, null, 2));
      }
    }

    // Check in performances of known Premier League teams
    console.log("\n📡 Checking performances of Arsenal (Premier League team)...");
    try {
      const ARSENAL_ID = "1835";
      const { data } = await axios.get(`${API_URL}/performances`, {
        params: {
          performer_id: ARSENAL_ID,
          category_id: 1,
          limit: 10,
          page: 1,
          is_sellable: true,
        },
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (data.performances && data.performances.length > 0) {
        console.log("📋 Checking performers in Arsenal matches:\n");
        const premierLeaguePerformers = new Set();

        data.performances.forEach((perf) => {
          if (perf.performers) {
            perf.performers.forEach((p) => {
              const lowerName = p.name.toLowerCase();
              if (
                lowerName.includes("premier league") ||
                lowerName.includes("premier") ||
                lowerName.includes("epl")
              ) {
                premierLeaguePerformers.add(`${p.id}:${p.name}`);
              }
            });
          }
        });

        if (premierLeaguePerformers.size > 0) {
          console.log("✅ Found Premier League performers in matches:");
          Array.from(premierLeaguePerformers).forEach((p) => {
            const [id, name] = p.split(":");
            console.log(`   ID: ${id}, Name: ${name}`);
          });
        } else {
          console.log("❌ No Premier League performer found in Arsenal matches");
          console.log("\n📋 All performers found in first match:");
          if (data.performances[0] && data.performances[0].performers) {
            data.performances[0].performers.forEach((p) => {
              console.log(`   ID: ${p.id}, Name: ${p.name}`);
            });
          }
        }
      }
    } catch (error) {
      console.log("❌ Error checking Arsenal performances:", error.message);
    }
  } catch (error) {
    console.error("❌ General error:", error.message);
  }
}

async function run() {
  console.log("=".repeat(60));
  console.log("🔍 Searching for Premier League Performer ID");
  console.log("=".repeat(60));
  console.log();

  await searchPremierLeague();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Search completed");
  console.log("=".repeat(60));
}

run().catch(console.error);




