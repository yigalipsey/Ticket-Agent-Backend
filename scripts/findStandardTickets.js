import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find examples of potentially STANDARD tickets (non-VIP)
 */
async function findStandardTickets() {
    try {
        const csvPath = path.join(__dirname, '../data/p1-offers.csv');
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

        console.log(`⚽ Found ${footballRecords.length} football records`);

        // Keywords that suggest VIP/Hospitality
        const vipKeywords = ['hospitality', 'vip', 'lounge', 'club', 'box', 'suite', 'premium', 'padded', 'dinner', 'buffet', 'drinks'];

        // Filter for records that DO NOT contain VIP keywords
        const standardCandidates = footballRecords.filter(record => {
            const text = (record.description + ' ' + record.extraInfo + ' ' + record.name).toLowerCase();
            return !vipKeywords.some(keyword => text.includes(keyword));
        });

        console.log(`🎫 Found ${standardCandidates.length} potential STANDARD tickets (no VIP keywords)\n`);

        // Display samples
        standardCandidates.slice(0, 10).forEach((record, index) => {
            console.log(`--- Standard Candidate ${index + 1} ---`);
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

findStandardTickets();
