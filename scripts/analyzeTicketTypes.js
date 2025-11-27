import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyze ticket descriptions to identify Standard vs VIP
 */
async function analyzeTicketTypes() {
    try {
        const csvPath = path.join(__dirname, '../data/p1-offers.csv');
        console.log(`📂 Reading CSV file: ${csvPath}`);

        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        // Filter for football records
        const footballRecords = records.filter(record => {
            const categoryPath = (record.categoryPath || record.CategoryPath || '').toLowerCase();
            return categoryPath.includes('football');
        });

        console.log(`⚽ Found ${footballRecords.length} football records\n`);

        console.log('🔍 Sample Descriptions and Extra Info:\n');

        // Display first 20 records to see patterns
        footballRecords.slice(0, 20).forEach((record, index) => {
            console.log(`--- Record ${index + 1} ---`);
            console.log(`Name: ${record.name}`);
            console.log(`Description: ${record.description}`);
            console.log(`Extra Info: ${record.extraInfo}`);
            console.log(`Price: ${record.price}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeTicketTypes();
