import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// Affiliate parameters
const AFFILIATE_PARAMS = "?tap_a=141252-18675a&tap_s=8995852-00a564";

// File paths
const INPUT_FILE = path.resolve(__dirname, "../data/premier_league_matches_hellotickets.json");
const OUTPUT_FILE = path.resolve(__dirname, "../data/premier_league_matches_hellotickets.json");

// Cache for fetched performances to avoid duplicate API calls
const performanceCache = new Map();

async function fetchPerformanceById(performanceId) {
  // Check cache first
  if (performanceCache.has(performanceId)) {
    return performanceCache.get(performanceId);
  }

  try {
    // Try direct endpoint first
    const { data } = await axios.get(`${API_URL}/performances/${performanceId}`, {
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });

    const performance = data.performance || data;
    performanceCache.set(performanceId, performance);
    return performance;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`   ⚠️  Performance ${performanceId} not found (404)`);
      return null;
    }
    console.error(`   ❌ Error fetching performance ${performanceId}:`, error.message);
    return null;
  }
}

function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;
  
  // Check if URL already has query parameters
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS.substring(1)}`; // Remove leading ?
}

async function updateMatch(match, index, total) {
  const performanceId = match.htPerformanceId;
  
  if (!performanceId) {
    console.log(`   ⚠️  Match ${index + 1}/${total}: No htPerformanceId found`);
    return match;
  }

  console.log(`   📥 [${index + 1}/${total}] Fetching performance ${performanceId}...`);

  const performance = await fetchPerformanceById(performanceId);
  
  if (!performance) {
    return match;
  }

  // Update match with new data
  const updatedMatch = { ...match };

  // Ensure htPerformanceId is set
  updatedMatch.htPerformanceId = performanceId.toString();

  // Add affiliate link
  if (performance.url) {
    updatedMatch.helloTicketsUrl = performance.url;
    updatedMatch.helloTicketsAffiliateUrl = addAffiliateLink(performance.url);
  }

  // Update min_price
  if (performance.price_range?.min_price !== undefined) {
    updatedMatch.minPrice = performance.price_range.min_price;
    updatedMatch.maxPrice = performance.price_range.max_price;
    updatedMatch.currency = performance.price_range.currency;
  }

  // Add additional useful data
  if (performance.ticket_groups_count !== undefined) {
    updatedMatch.ticketGroupsCount = performance.ticket_groups_count;
  }

  if (performance.event_id) {
    updatedMatch.helloTicketsEventId = performance.event_id;
  }

  console.log(`   ✅ Updated: ${match.eventName} - Min Price: ${updatedMatch.minPrice || 'N/A'} ${updatedMatch.currency || ''}`);

  return updatedMatch;
}

async function updateAllMatches() {
  try {
    console.log("=".repeat(60));
    console.log("📥 Updating Premier League Matches");
    console.log("=".repeat(60));
    console.log();

    // Read existing file
    console.log("📖 Reading existing file...");
    const fileContent = fs.readFileSync(INPUT_FILE, "utf8");
    const data = JSON.parse(fileContent);

    console.log(`✅ Found ${data.matches.length} matches to update\n`);

    // Update each match
    const updatedMatches = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < data.matches.length; i++) {
      const match = data.matches[i];
      
      try {
        const updatedMatch = await updateMatch(match, i, data.matches.length);
        updatedMatches.push(updatedMatch);
        
        if (updatedMatch.minPrice !== undefined) {
          successCount++;
        } else {
          skippedCount++;
        }

        // Add small delay to avoid rate limiting
        if (i < data.matches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`   ❌ Error updating match ${i + 1}:`, error.message);
        updatedMatches.push(match); // Keep original match
        errorCount++;
      }
    }

    // Update data object
    data.matches = updatedMatches;
    data.updated_at = new Date().toISOString();
    data.affiliate_params = AFFILIATE_PARAMS;

    // Save updated file
    console.log("\n💾 Saving updated file...");
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf8");

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Update Summary:");
    console.log("=".repeat(60));
    console.log(`   Total matches: ${data.matches.length}`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ⚠️  Skipped (no data): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   💰 Matches with prices: ${updatedMatches.filter(m => m.minPrice).length}`);
    console.log(`   🔗 Matches with affiliate links: ${updatedMatches.filter(m => m.helloTicketsAffiliateUrl).length}`);
    console.log("\n✅ File saved to:", OUTPUT_FILE);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

updateAllMatches();




