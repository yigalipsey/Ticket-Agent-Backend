
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract Premier League team shirt URLs from P1 CSV file
 * 
 * Usage: node scripts/extractTeamShirtUrls.js <path-to-csv-file>
 */

async function extractTeamShirtUrls(csvFilePath) {
    try {
        console.log('📂 Reading CSV file:', csvFilePath);

        // Read CSV file
        const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

        // Parse CSV
        const records = parse(fileContent, {
            columns: true, // Use first row as column names
            skip_empty_lines: true,
            trim: true,
        });

        console.log(`✅ Found ${records.length} total records in CSV`);

        // Filter for Premier League entries
        const premierLeagueRecords = records.filter(record => {
            const categoryPath = record.categoryPath || record.CategoryPath || '';
            return categoryPath.toLowerCase().includes('premier league');
        });

        console.log(`⚽ Found ${premierLeagueRecords.length} Premier League records`);

        // Extract team names and shirt URLs
        const teamShirtMap = {};

        premierLeagueRecords.forEach(record => {
            // Extract team name from 'brand' field (this is the home team)
            const teamName = record.brand || '';

            // Get shirt URL from home_shirt_image_link field
            const shirtUrl = record.home_shirt_image_link || '';

            // Only add if we have both team name and URL
            if (teamName && shirtUrl && !teamShirtMap[teamName]) {
                teamShirtMap[teamName] = shirtUrl;
            }
        });

        console.log('\n🎽 Extracted Team Shirt URLs:');
        console.log('================================\n');

        // Sort teams alphabetically
        const sortedTeams = Object.keys(teamShirtMap).sort();

        sortedTeams.forEach(team => {
            console.log(`${team}: ${teamShirtMap[team]}`);
        });

        console.log('\n================================');
        console.log(`📊 Total teams found: ${sortedTeams.length}`);

        // Save to JSON file
        const outputPath = path.join(__dirname, '../data/team-shirt-urls.json');
        const outputDir = path.dirname(outputPath);

        // Create data directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(teamShirtMap, null, 2), 'utf-8');
        console.log(`\n💾 Saved to: ${outputPath}`);

        // Also print as a ready-to-use object
        console.log('\n📋 Ready-to-use JavaScript object:');
        console.log('================================\n');
        console.log('const teamShirtUrls = ' + JSON.stringify(teamShirtMap, null, 2) + ';');

        return teamShirtMap;

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Main execution
const csvFilePath = process.argv[2];

if (!csvFilePath) {
    console.error('❌ Error: Please provide CSV file path');
    console.log('\nUsage: node scripts/extractTeamShirtUrls.js <path-to-csv-file>');
    console.log('Example: node scripts/extractTeamShirtUrls.js ./data/p1-offers.csv');
    process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ Error: File not found: ${csvFilePath}`);
    process.exit(1);
}

extractTeamShirtUrls(csvFilePath);
