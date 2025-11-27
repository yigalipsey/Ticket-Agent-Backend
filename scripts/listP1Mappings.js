import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

dotenv.config();

async function listP1Mappings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });
        if (!p1Supplier) {
            console.log('P1 Supplier not found');
            return;
        }

        const teams = await Team.find({
            'supplierNames.supplierId': p1Supplier._id
        }).sort({ name_en: 1 });

        console.log('\n📋 Teams with P1 Mappings:\n');
        console.log('   DB Name'.padEnd(20) + ' | ' + 'P1 Name');
        console.log('   ' + '-'.repeat(19) + ' | ' + '-'.repeat(20));

        teams.forEach(team => {
            const p1Name = team.supplierNames.find(
                sn => sn.supplierId.toString() === p1Supplier._id.toString()
            ).name;

            console.log(`   ${(team.name_en || team.name).padEnd(19)} | ${p1Name}`);
        });

        console.log(`\n✅ Total: ${teams.length} teams`);

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

listP1Mappings();
