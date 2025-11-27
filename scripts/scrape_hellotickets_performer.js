import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scrape HelloTickets performer page to get all matches
 * @param {number} performerId - The performer ID (e.g., 1835 for Arsenal)
 * @param {string} performerSlug - The URL slug (e.g., 'arsenal-fc-tickets')
 */
async function scrapePerformerMatches(performerId, performerSlug) {
    try {
        const url = `https://www.hellotickets.com/${performerSlug}/p-${performerId}`;
        console.log(`🔍 Scraping: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const $ = cheerio.load(response.data);
        const matches = [];

        // Look for match links in the page
        // HelloTickets uses URLs like: /team1-vs-team2-tickets/m-XXXX
        $('a[href*="/m-"]').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();

            // Extract match ID from URL
            const matchIdMatch = href.match(/\/m-(\d+)/);
            if (matchIdMatch) {
                const matchId = matchIdMatch[1];

                // Try to extract match name from the URL slug
                const slugMatch = href.match(/\/([^/]+)\/m-\d+/);
                const matchSlug = slugMatch ? slugMatch[1] : '';

                matches.push({
                    matchId,
                    matchSlug,
                    url: href.startsWith('http') ? href : `https://www.hellotickets.com${href}`,
                    linkText: text
                });
            }
        });

        // Remove duplicates based on matchId
        const uniqueMatches = Array.from(
            new Map(matches.map(m => [m.matchId, m])).values()
        );

        console.log(`\n✅ Found ${uniqueMatches.length} unique matches for performer ${performerId}`);

        // Save to file
        const outputPath = path.resolve(__dirname, `../data/hellotickets_performer_${performerId}_matches.json`);
        const dataDir = path.dirname(outputPath);

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const result = {
            performerId,
            performerSlug,
            scrapedAt: new Date().toISOString(),
            totalMatches: uniqueMatches.length,
            matches: uniqueMatches
        };

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`💾 Saved to: ${outputPath}`);

        // Print first 10 matches
        console.log('\n📋 First 10 matches:');
        uniqueMatches.slice(0, 10).forEach((match, idx) => {
            console.log(`${idx + 1}. [${match.matchId}] ${match.matchSlug}`);
            console.log(`   ${match.url}`);
        });

        return result;

    } catch (error) {
        console.error('❌ Error scraping:', error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
        }
        throw error;
    }
}

// Get performer ID and slug from command line arguments
const performerId = process.argv[2] || '1835';
const performerSlug = process.argv[3] || 'arsenal-fc-tickets';

scrapePerformerMatches(performerId, performerSlug);
