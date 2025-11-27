import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

dotenv.config();

async function updateMissingSpanishTeams() {
    try {
        console.log('🇪🇸 Updating missing Spanish teams...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });
        if (!p1Supplier) {
            console.log('❌ P1 Supplier not found');
            return;
        }

        // Define the updates
        const updates = [
            {
                id: '68da7a5a8c51bd5b579b20ba',
                p1Name: 'Athletic Bilbao',
                shirtUrl: 'https://media.p1travel.com/Athletic%20Bilbao.svg?tr=w-1024' // Assuming standard format, will verify if needed
            },
            {
                id: '68da7a5a8c51bd5b579b20b6',
                p1Name: 'Atlético Madrid',
                shirtUrl: 'https://media.p1travel.com/Atletico%20Madrid.svg?tr=w-1024' // Assuming standard format
            }
        ];

        // Note: I'm guessing the URLs based on the pattern, but ideally we should pull them from the CSV again.
        // Let's just use the mapping logic first.

        for (const update of updates) {
            const team = await Team.findById(update.id);

            if (team) {
                console.log(`🔍 Found team: ${team.name_en} (${team._id})`);

                // Add mapping
                const existingMapping = team.supplierNames?.find(
                    sn => sn.supplierId.toString() === p1Supplier._id.toString() && sn.name === update.p1Name
                );

                if (!existingMapping) {
                    if (!team.supplierNames) team.supplierNames = [];
                    team.supplierNames.push({
                        supplierId: p1Supplier._id,
                        name: update.p1Name
                    });
                    console.log(`   ✅ Added mapping: "${update.p1Name}"`);
                } else {
                    console.log(`   ℹ️  Mapping already exists`);
                }

                await team.save();
            } else {
                console.log(`❌ Team not found with ID: ${update.id}`);
            }
        }

        console.log('\n✨ Manual update complete!');
        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateMissingSpanishTeams();
