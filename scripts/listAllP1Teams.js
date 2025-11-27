import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract all unique football team names from P1 CSV
 */
async function extractAllP1Teams() {
    try {
        const csvPath = path.join(__dirname, '../data/p1-offers.csv');
        console.log(`📂 Reading CSV file: ${csvPath}`);

        const fileContent = fs.readFileSync(csvPath, 'utf-8');

        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        console.log(`✅ Found ${records.length} total records in CSV`);

        // Filter for football records
        const footballRecords = records.filter(record => {
            const categoryPath = (record.categoryPath || record.CategoryPath || '').toLowerCase();
            return categoryPath.includes('football');
        });

        console.log(`⚽ Found ${footballRecords.length} football records`);

        // Extract unique team names
        const teams = new Set();

        footballRecords.forEach(record => {
            if (record.home_team_name) teams.add(record.home_team_name.trim());
            if (record.away_team_name) teams.add(record.away_team_name.trim());

            // Also check brand if it looks like a team name
            if (record.brand && !record.brand.includes(' vs ')) {
                teams.add(record.brand.trim());
            }
        });

        // Sort alphabetically
        const sortedTeams = Array.from(teams).sort();

        console.log('\n📋 All Unique Football Teams in P1 CSV:');
        console.log('================================');

        sortedTeams.forEach(team => {
            if (team) console.log(team);
        });

        console.log('================================');
        console.log(`📊 Total unique teams: ${sortedTeams.length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

extractAllP1Teams();
