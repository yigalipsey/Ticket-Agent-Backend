import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

dotenv.config();

/**
 * Add supplier-specific team names mapping
 * This allows us to map how different suppliers call the same team
 */
async function addSupplierTeamNames() {
    try {
        console.log('🔄 Adding supplier team names mapping...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get P1 supplier
        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });

        if (!p1Supplier) {
            console.log('❌ P1 Travel supplier not found. Please run: npm run create-p1-supplier');
            await mongoose.disconnect();
            return;
        }

        console.log(`✅ Found P1 supplier: ${p1Supplier._id}\n`);

        // Mapping of our team names to P1's team names
        const teamMappings = [
            { ourName: 'Tottenham', p1Name: 'Tottenham Hotspur' },
            { ourName: 'West Ham', p1Name: 'West Ham United' },
            { ourName: 'Aston Villa', p1Name: 'Aston Villa FC' },
            { ourName: 'Bournemouth', p1Name: 'Bournemouth FC' },
            { ourName: 'Fulham', p1Name: 'Fulham FC' },
            { ourName: 'Burnley', p1Name: 'Burnley FC' },
        ];

        let updatedCount = 0;
        let notFoundCount = 0;

        for (const mapping of teamMappings) {
            console.log(`🔍 Looking for team: ${mapping.ourName}`);

            // Find team by name (Hebrew or English)
            const team = await Team.findOne({
                $or: [
                    { name_en: new RegExp(`^${mapping.ourName}`, 'i') },
                    { name: new RegExp(`^${mapping.ourName}`, 'i') }
                ]
            });

            if (team) {
                // Check if P1 name already exists
                const existingP1Name = team.supplierNames?.find(
                    sn => sn.supplierId.toString() === p1Supplier._id.toString()
                );

                if (existingP1Name) {
                    console.log(`   ⚠️  P1 name already exists: ${existingP1Name.name}`);
                } else {
                    // Add P1 supplier name
                    if (!team.supplierNames) {
                        team.supplierNames = [];
                    }

                    team.supplierNames.push({
                        supplierId: p1Supplier._id,
                        name: mapping.p1Name
                    });

                    await team.save();
                    console.log(`   ✅ Added P1 name: "${mapping.p1Name}" for ${team.name_en || team.name}`);
                    updatedCount++;
                }
            } else {
                console.log(`   ❌ Team not found: ${mapping.ourName}`);
                notFoundCount++;
            }
            console.log('');
        }

        console.log('================================');
        console.log('📊 Summary:');
        console.log('================================');
        console.log(`✅ Teams updated: ${updatedCount}`);
        console.log(`❌ Teams not found: ${notFoundCount}`);
        console.log('\n✨ Done!\n');

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

addSupplierTeamNames();
