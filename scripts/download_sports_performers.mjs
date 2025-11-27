import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

dotenv.config();

const API_URL = 'https://api-live.hellotickets.com/v1';
const API_KEY = 'pub-6a76dc10-12e5-466e-83d5-35b745c485a2'; // public key

const CSV_HEADER = 'id,name,category_id,created_at,updated_at\n';
const OUTPUT_PATH = path.resolve('backend/data/performers_sports.csv');

async function fetchPage(page = 1, limit = 200) {
    const { data } = await axios.get(`${API_URL}/performers`, {
        params: { limit, page },
        headers: {
            Accept: 'application/json',
            'X-Public-Key': API_KEY,
        },
    });
    return data;
}

async function downloadAll() {
    const first = await fetchPage(1);
    const total = first.total_count;
    const perPage = first.per_page;
    const pages = Math.ceil(total / perPage);

    // write header (overwrite if exists)
    fs.writeFileSync(OUTPUT_PATH, CSV_HEADER);

    const appendRows = (items) => {
        const lines = items
            .filter(p => p.category_id === 1)
            .map(p => `${p.id},"${p.name.replace(/"/g, '""')}",${p.category_id},${p.created_at},${p.updated_at}`)
            .join('\n') + '\n';
        fs.appendFileSync(OUTPUT_PATH, lines);
    };

    appendRows(first.performers);
    for (let p = 2; p <= pages; p++) {
        const pageData = await fetchPage(p);
        appendRows(pageData.performers);
        console.log(`Fetched page ${p}/${pages}`);
    }
    console.log(`All sports performers saved to ${OUTPUT_PATH}`);
}

downloadAll().catch(err => {
    console.error('Error downloading performers:', err.message);
    process.exit(1);
});
