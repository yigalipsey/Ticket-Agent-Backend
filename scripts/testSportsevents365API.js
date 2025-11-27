import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sportsevents365 API Configuration
const SPORTSEVENTS365_API_KEY = process.env.SPORTSEVENTS365_API_KEY;
const SPORTSEVENTS365_HTTP_USERNAME = process.env.SPORTSEVENTS365_HTTP_USERNAME;
const SPORTSEVENTS365_HTTP_PASSWORD = process.env.SPORTSEVENTS365_HTTP_PASSWORD;
const SPORTSEVENTS365_BASE_URL =
  process.env.SPORTSEVENTS365_BASE_URL || "https://api-v2.sportsevents365.com";

// Validate environment variables
if (!SPORTSEVENTS365_API_KEY) {
  console.error("❌ SPORTSEVENTS365_API_KEY not found in environment variables");
  process.exit(1);
}

if (!SPORTSEVENTS365_HTTP_USERNAME || !SPORTSEVENTS365_HTTP_PASSWORD) {
  console.warn(
    "⚠️  HTTP Username/Password not set. Some endpoints may require Basic Auth."
  );
}

// Create axios client with authentication
const apiClient = axios.create({
  baseURL: SPORTSEVENTS365_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Try different authentication methods
// Method 1: API Key in various header formats
if (SPORTSEVENTS365_API_KEY) {
  // Try multiple common API key header formats
  apiClient.defaults.headers.common["X-API-Key"] = SPORTSEVENTS365_API_KEY;
  apiClient.defaults.headers.common["API-Key"] = SPORTSEVENTS365_API_KEY;
  apiClient.defaults.headers.common["apikey"] = SPORTSEVENTS365_API_KEY;
  apiClient.defaults.headers.common["x-api-key"] = SPORTSEVENTS365_API_KEY;
}

// Method 2: Basic Auth (REQUIRED according to API docs)
// The API requires:
// 1. Basic Authentication with username:password
// 2. API Key as query parameter (apiKey=...)
// 
// According to docs: "Use Basic Authentication with your username and password"
// AND "You will also need to provide apiKey for each request"

if (SPORTSEVENTS365_HTTP_USERNAME && SPORTSEVENTS365_HTTP_PASSWORD) {
  // Use provided username and password
  const authString = Buffer.from(
    `${SPORTSEVENTS365_HTTP_USERNAME}:${SPORTSEVENTS365_HTTP_PASSWORD}`
  ).toString("base64");
  apiClient.defaults.headers.common["Authorization"] = `Basic ${authString}`;
  console.log("🔐 Using Basic Auth with provided username and password");
} else if (SPORTSEVENTS365_HTTP_PASSWORD) {
  // If only password provided, try API Key as username (common pattern)
  const authString = Buffer.from(
    `${SPORTSEVENTS365_API_KEY}:${SPORTSEVENTS365_HTTP_PASSWORD}`
  ).toString("base64");
  apiClient.defaults.headers.common["Authorization"] = `Basic ${authString}`;
  console.log("🔐 Using Basic Auth with API Key as username (trying...)");
} else {
  console.error("❌ ERROR: HTTP Password is required for Basic Authentication!");
  console.error("   Please set SPORTSEVENTS365_HTTP_PASSWORD in .env file");
  process.exit(1);
}

// Output directory for API responses
const OUTPUT_DIR = path.join(__dirname, "../data/sportsevents365");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Save API response to file
 */
function saveResponse(filename, data) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`💾 Saved response to: ${filePath}`);
}

/**
 * Test API endpoint
 */
async function testEndpoint(name, endpoint, method = "GET", data = null) {
  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🔍 Testing: ${name}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`📋 Method: ${method}`);
    console.log(`🔐 Auth: ${apiClient.defaults.headers.common["Authorization"] ? "Basic Auth" : "API Key Headers"}`);
    console.log(`${"=".repeat(80)}\n`);

    let response;
    if (method === "GET") {
      response = await apiClient.get(endpoint);
    } else if (method === "POST") {
      response = await apiClient.post(endpoint, data);
    }

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response Headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`📊 Response Data Structure:`, {
      type: typeof response.data,
      isArray: Array.isArray(response.data),
      keys: response.data && typeof response.data === "object" ? Object.keys(response.data) : "N/A",
      dataLength: Array.isArray(response.data) ? response.data.length : "N/A",
    });

    // Save full response
    const filename = `${name.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_")}_response.json`;
    saveResponse(filename, {
      endpoint,
      method,
      status: response.status,
      headers: response.headers,
      data: response.data,
    });

    // Print sample data (first 3 items if array, or first level if object)
    if (Array.isArray(response.data)) {
      console.log(`\n📝 Sample Data (first 3 items):`);
      console.log(JSON.stringify(response.data.slice(0, 3), null, 2));
    } else if (response.data && typeof response.data === "object") {
      console.log(`\n📝 Response Data Preview:`);
      const preview = {};
      for (const key of Object.keys(response.data).slice(0, 5)) {
        preview[key] =
          Array.isArray(response.data[key])
            ? `[Array with ${response.data[key].length} items]`
            : typeof response.data[key] === "object"
            ? `[Object with ${Object.keys(response.data[key]).length} keys]`
            : response.data[key];
      }
      console.log(JSON.stringify(preview, null, 2));
    } else {
      console.log(`\n📝 Response Data:`, response.data);
    }

    return response.data;
  } catch (error) {
    console.error(`\n❌ Error testing ${name}:`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
      console.error(`   Response Data:`, JSON.stringify(error.response.data, null, 2));
      console.error(`   Response Headers:`, JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      console.error(`   Request made but no response received`);
      console.error(`   Request:`, error.request);
    } else {
      console.error(`   Error:`, error.message);
    }

    // Save error response
    const filename = `${name.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_")}_error.json`;
    saveResponse(filename, {
      endpoint,
      method,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      },
    });

    return null;
  }
}

/**
 * Main function to test various API endpoints
 */
async function main() {
  console.log("🚀 Starting Sportsevents365 API Testing");
  console.log(`📡 Base URL: ${SPORTSEVENTS365_BASE_URL}`);
  console.log(`🔑 API Key: ${SPORTSEVENTS365_API_KEY ? "✅ Set" : "❌ Missing"}`);
  console.log(
    `🔐 HTTP Auth: ${
      SPORTSEVENTS365_HTTP_USERNAME && SPORTSEVENTS365_HTTP_PASSWORD
        ? "✅ Set"
        : "⚠️  Not Set"
    }`
  );

  // Test specific endpoints based on API documentation
  // Note: All endpoints require apiKey as query parameter
  const endpointsToTest = [
    // Premier League (ID: 9) - Main request (what user asked for)
    { 
      name: "Premier League Tournament", 
      endpoint: `/tournaments/9?apiKey=${SPORTSEVENTS365_API_KEY}`, 
      method: "GET" 
    },
    
    // Alternative: Get tournaments by event type (Football)
    { 
      name: "Football Tournaments", 
      endpoint: `/tournaments?eventTypeId=1000&apiKey=${SPORTSEVENTS365_API_KEY}`, 
      method: "GET" 
    },
    
    // Event Types
    { 
      name: "Event Types", 
      endpoint: `/event-types?apiKey=${SPORTSEVENTS365_API_KEY}`, 
      method: "GET" 
    },
    
    // Football Event Type (ID: 1000)
    { 
      name: "Football Event Type", 
      endpoint: `/event-types/1000?apiKey=${SPORTSEVENTS365_API_KEY}`, 
      method: "GET" 
    },
    
    // Top Football Tournaments
    { 
      name: "Top Football Tournaments", 
      endpoint: `/tournaments/top/football?apiKey=${SPORTSEVENTS365_API_KEY}`, 
      method: "GET" 
    },
  ];

  const results = {};

  for (const test of endpointsToTest) {
    const result = await testEndpoint(test.name, test.endpoint, test.method);
    results[test.name] = result ? "✅ Success" : "❌ Failed";
    
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 Test Summary");
  console.log(`${"=".repeat(80)}\n`);
  for (const [name, status] of Object.entries(results)) {
    console.log(`${status} ${name}`);
  }

  console.log(`\n💾 All responses saved to: ${OUTPUT_DIR}`);
  console.log(`\n✅ Testing complete!`);
}

// Run the tests
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

