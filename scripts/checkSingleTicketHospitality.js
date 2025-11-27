import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if "Single ticket" can also be Hospitality/VIP
 */
async function checkSingleTicketHospitality() {
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

        // Keywords that suggest VIP/Hospitality
        const vipKeywords = ['hospitality', 'vip', 'lounge', 'club', 'box', 'suite', 'premium', 'dinner', 'buffet', 'drinks included', 'all-inclusive'];

        console.log('🔍 Checking "Single ticket" records for VIP keywords...\n');

        let suspiciousCount = 0;

        footballRecords.forEach(record => {
            const extraInfo = (record.extraInfo || '').toLowerCase();

            // Only check "Single ticket" types
            if (extraInfo.includes('ticket type: single ticket')) {
                const description = record.description.toLowerCase();

                // Check if description contains VIP keywords
                const foundKeywords = vipKeywords.filter(kw => description.includes(kw));

                if (foundKeywords.length > 0) {
                    suspiciousCount++;
                    console.log(`⚠️  Suspicious Record Found:`);
                    console.log(`   Name: ${record.name}`);
                    console.log(`   Keywords found: ${foundKeywords.join(', ')}`);
                    console.log(`   Description: ${record.description}`);
                    console.log(`   Price: ${record.price}`);
                    console.log('-----------------------------------');
                }
            }
        });

        if (suspiciousCount === 0) {
            console.log('✅ No "Single ticket" records found with VIP keywords.');
            console.log('   It seems safe to assume "Single ticket" = Standard.');
        } else {
            console.log(`⚠️  Found ${suspiciousCount} "Single ticket" records that might be VIP.`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSingleTicketHospitality();
