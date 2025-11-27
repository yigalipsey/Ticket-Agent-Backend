import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * List offers for West Ham vs Arsenal to verify Standard vs Hospitality
 */
async function listWestHamArsenalOffers() {
    try {
        const csvPath = path.join(__dirname, '../data/p1-offers.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        // Filter for West Ham vs Arsenal
        const matchOffers = records.filter(record =>
            record.name === 'West Ham United vs Arsenal'
        );

        console.log(`⚽ Found ${matchOffers.length} offers for West Ham United vs Arsenal\n`);

        console.log('🎟️  STANDARD TICKETS (Single ticket):');
        console.log('------------------------------------------------');
        matchOffers
            .filter(r => r.extraInfo.includes('Ticket type: Single ticket'))
            .forEach(r => {
                console.log(`• ${r.price} EUR - ${getSeatingPlan(r.extraInfo)}`);
                // console.log(`  Desc: ${r.description.substring(0, 60)}...`);
            });

        console.log('\n🏆 HOSPITALITY TICKETS (Hospitality ticket):');
        console.log('------------------------------------------------');
        matchOffers
            .filter(r => r.extraInfo.includes('Ticket type: Hospitality ticket'))
            .forEach(r => {
                console.log(`• ${r.price} EUR - ${getSeatingPlan(r.extraInfo)}`);
                // console.log(`  Desc: ${r.description.substring(0, 60)}...`);
            });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

function getSeatingPlan(extraInfo) {
    const match = extraInfo.match(/Seating plan:\s*([^|]+)/);
    return match ? match[1].trim() : 'Unknown Seat';
}

listWestHamArsenalOffers();
