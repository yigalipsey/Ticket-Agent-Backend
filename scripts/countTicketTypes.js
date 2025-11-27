import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Count ticket types in P1 CSV
 */
async function countTicketTypes() {
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

        console.log(`⚽ Total Football Records: ${footballRecords.length}\n`);

        let hospitalityCount = 0;
        let singleTicketCount = 0;
        let otherCount = 0;
        const otherTypes = new Set();

        footballRecords.forEach(record => {
            const extraInfo = (record.extraInfo || '').toLowerCase();

            if (extraInfo.includes('ticket type: hospitality ticket')) {
                hospitalityCount++;
            } else if (extraInfo.includes('ticket type: single ticket')) {
                singleTicketCount++;
            } else {
                otherCount++;
                // Try to extract ticket type if possible
                const match = extraInfo.match(/ticket type:\s*([^|]+)/i);
                if (match) {
                    otherTypes.add(match[1].trim());
                }
            }
        });

        console.log('📊 Ticket Type Distribution:');
        console.log('================================');
        console.log(`🏆 Hospitality Tickets (VIP): ${hospitalityCount} (${Math.round(hospitalityCount / footballRecords.length * 100)}%)`);
        console.log(`🎟️  Single Tickets (Standard): ${singleTicketCount} (${Math.round(singleTicketCount / footballRecords.length * 100)}%)`);
        console.log(`❓ Other/Unknown: ${otherCount} (${Math.round(otherCount / footballRecords.length * 100)}%)`);

        if (otherTypes.size > 0) {
            console.log('\nOther Ticket Types Found:');
            otherTypes.forEach(type => console.log(`- ${type}`));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

countTicketTypes();
