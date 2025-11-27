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
const PERFORMERS_CSV_PATH = path.resolve(__dirname, "../data/performers_sports.csv");

async function searchInCSV() {
  console.log("🔍 Searching in CSV file...\n");
  
  const csvContent = fs.readFileSync(PERFORMERS_CSV_PATH, "utf8");
  const lines = csvContent.trim().split("\n");
  
  const matches = [];
  
  // Search for variations of La Liga
  const searchTerms = ["La Liga", "la liga", "Liga", "Primera División", "Primera Division"];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const match = line.match(/^(\d+),"([^"]*(?:""[^"]*)*)",(\d+),/);
    if (match) {
      const id = match[1];
      const name = match[2].replace(/""/g, '"');
      
      // Check if name contains any search term
      const lowerName = name.toLowerCase();
      for (const term of searchTerms) {
        if (lowerName.includes(term.toLowerCase())) {
          matches.push({ id, name });
          break;
        }
      }
    }
  }
  
  if (matches.length > 0) {
    console.log("✅ Found matches in CSV:");
    matches.forEach(m => {
      console.log(`   ID: ${m.id}, Name: ${m.name}`);
    });
  } else {
    console.log("❌ No matches found in CSV");
  }
  
  return matches;
}

async function searchInAPI() {
  console.log("\n🔍 Searching in Hello Tickets API...\n");
  
  try {
    // Search for performers with "Liga" in the name
    let page = 1;
    let allPerformers = [];
    let hasMore = true;
    
    while (hasMore) {
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
        allPerformers = allPerformers.concat(data.performers);
      }
      
      hasMore = page * data.per_page < data.total_count;
      page++;
      
      if (page > 10) break; // Limit to first 10 pages for now
    }
    
    // Filter for La Liga related performers
    const searchTerms = ["la liga", "liga", "primera división", "primera division", "spain", "spanish"];
    const matches = allPerformers.filter(p => {
      const lowerName = p.name.toLowerCase();
      return searchTerms.some(term => lowerName.includes(term));
    });
    
    if (matches.length > 0) {
      console.log("✅ Found matches in API:");
      matches.forEach(m => {
        console.log(`   ID: ${m.id}, Name: ${m.name}, Category: ${m.category_id}`);
      });
    } else {
      console.log("❌ No matches found in API");
    }
    
    return matches;
  } catch (error) {
    console.error("❌ Error searching API:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    return [];
  }
}

async function checkPerformances() {
  console.log("\n🔍 Checking performances for Real Madrid to see La Liga performer...\n");
  
  try {
    // Real Madrid performer ID
    const REAL_MADRID_ID = "598";
    
    const { data } = await axios.get(`${API_URL}/performances`, {
      params: {
        performer_id: REAL_MADRID_ID,
        category_id: 1, // Sports
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
      console.log("📋 Checking performers in Real Madrid matches:\n");
      
      const laLigaPerformers = new Set();
      
      data.performances.forEach((perf, idx) => {
        if (perf.performers) {
          perf.performers.forEach(p => {
            const lowerName = p.name.toLowerCase();
            if (lowerName.includes("la liga") || lowerName.includes("liga")) {
              laLigaPerformers.add(`${p.id}:${p.name}`);
            }
          });
        }
      });
      
      if (laLigaPerformers.size > 0) {
        console.log("✅ Found La Liga performers in matches:");
        Array.from(laLigaPerformers).forEach(p => {
          const [id, name] = p.split(':');
          console.log(`   ID: ${id}, Name: ${name}`);
        });
      } else {
        console.log("❌ No La Liga performer found in Real Madrid matches");
        console.log("\n📋 All performers found in first match:");
        if (data.performances[0] && data.performances[0].performers) {
          data.performances[0].performers.forEach(p => {
            console.log(`   ID: ${p.id}, Name: ${p.name}`);
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error checking performances:", error.message);
  }
}

async function run() {
  console.log("🔍 Searching for La Liga performer ID in Hello Tickets\n");
  console.log("=" .repeat(60) + "\n");
  
  // 1. Search in CSV
  const csvMatches = await searchInCSV();
  
  // 2. Search in API
  const apiMatches = await searchInAPI();
  
  // 3. Check performances
  await checkPerformances();
  
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`   CSV matches: ${csvMatches.length}`);
  console.log(`   API matches: ${apiMatches.length}`);
  
  if (csvMatches.length === 0 && apiMatches.length === 0) {
    console.log("\n💡 Tip: La Liga might not have a dedicated performer ID.");
    console.log("   It might appear as a performer in individual match performances.");
  }
}

run().catch(console.error);




