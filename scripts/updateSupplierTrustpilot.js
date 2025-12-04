import dotenv from "dotenv";
import mongoose from "mongoose";
import Supplier from "../src/models/Supplier.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to migrate all suppliers from trustpilotRating/trustpilotUrl to externalRating format
 * This script finds all suppliers with old trustpilot fields and converts them to the new externalRating format
 */

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "SCRIPT_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint(
      "info",
      "Successfully connected to MongoDB",
      "SCRIPT_002"
    );
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function findSuppliersToMigrate() {
  try {
    logWithCheckpoint(
      "info",
      "Finding suppliers with old trustpilot fields",
      "SCRIPT_003"
    );

    // Find all suppliers that have trustpilotRating or trustpilotUrl but don't have externalRating
    const suppliers = await Supplier.find({
      $and: [
        {
          $or: [
            { trustpilotRating: { $exists: true, $ne: null } },
            { trustpilotUrl: { $exists: true, $ne: null } },
          ],
        },
        {
          $or: [
            { externalRating: { $exists: false } },
            { externalRating: null },
          ],
        },
      ],
    }).lean();

    logWithCheckpoint(
      "info",
      `Found ${suppliers.length} suppliers to migrate`,
      "SCRIPT_004",
      { count: suppliers.length }
    );

    const suppliersToUpdate = suppliers
      .map((supplier) => {
        // Convert old trustpilot fields to new externalRating format
        const externalRating = {
          rating:
            supplier.trustpilotRating != null
              ? Number(supplier.trustpilotRating)
              : null,
          url: supplier.trustpilotUrl || null,
          provider: "trustpilot",
        };

        // Only include if we have at least rating or url
        if (externalRating.rating == null && !externalRating.url) {
          return null;
        }

        return {
          _id: supplier._id,
          name: supplier.name,
          slug: supplier.slug,
          currentRating: supplier.trustpilotRating || null,
          currentUrl: supplier.trustpilotUrl || null,
          updateData: {
            externalRating,
          },
        };
      })
      .filter(Boolean);

    logWithCheckpoint(
      "info",
      `Prepared ${suppliersToUpdate.length} suppliers for migration`,
      "SCRIPT_004",
      {
        total: suppliers.length,
        valid: suppliersToUpdate.length,
      }
    );

    return suppliersToUpdate;
  } catch (error) {
    logError(error, { operation: "findSuppliersToMigrate" });
    throw error;
  }
}

async function updateSuppliersExternalRating(suppliers) {
  try {
    logWithCheckpoint(
      "info",
      `Updating ${suppliers.length} suppliers with external rating data`,
      "SCRIPT_005"
    );

    const results = [];

    for (const supplier of suppliers) {
      try {
        const result = await Supplier.findByIdAndUpdate(
          supplier._id,
          {
            $set: {
              externalRating: supplier.updateData.externalRating,
            },
            // Remove old trustpilot fields if they exist
            $unset: {
              trustpilotRating: "",
              trustpilotUrl: "",
            },
          },
          { runValidators: true, new: true }
        );

        if (result) {
          results.push({
            success: true,
            supplier: {
              _id: result._id,
              name: result.name,
              slug: result.slug,
              externalRating: result.externalRating,
            },
          });

          logWithCheckpoint(
            "info",
            `Updated supplier: ${result.name}`,
            "SCRIPT_006",
            {
              supplierId: result._id,
              rating: result.externalRating?.rating,
              url: result.externalRating?.url,
              provider: result.externalRating?.provider,
            }
          );
        }
      } catch (error) {
        results.push({
          success: false,
          supplierId: supplier._id,
          error: error.message,
        });

        logError(error, {
          operation: "updateSupplierExternalRating",
          supplierId: supplier._id,
          supplierName: supplier.name,
        });
      }
    }

    return results;
  } catch (error) {
    logError(error, { operation: "updateSuppliersExternalRating" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Find suppliers that need migration
    const foundSuppliers = await findSuppliersToMigrate();

    if (foundSuppliers.length === 0) {
      logWithCheckpoint(
        "info",
        "No suppliers found that need migration",
        "SCRIPT_007"
      );
      console.log(
        "\n✅ No suppliers need migration. All suppliers are up to date."
      );
      return;
    }

    logWithCheckpoint(
      "info",
      `Found ${foundSuppliers.length} suppliers to migrate`,
      "SCRIPT_008",
      {
        suppliers: foundSuppliers.map((s) => ({
          name: s.name,
          slug: s.slug,
          currentRating: s.currentRating,
          currentUrl: s.currentUrl,
          newRating: s.updateData.externalRating.rating,
          provider: s.updateData.externalRating.provider,
        })),
      }
    );

    // Update suppliers
    const updateResults = await updateSuppliersExternalRating(foundSuppliers);

    // Display results
    const successful = updateResults.filter((r) => r.success);
    const failed = updateResults.filter((r) => !r.success);

    logWithCheckpoint(
      "info",
      "External rating data update completed",
      "SCRIPT_009",
      {
        successful: successful.length,
        failed: failed.length,
      }
    );

    console.log(
      "\n✅ Successfully migrated suppliers to external rating format:"
    );
    successful.forEach((result, index) => {
      const s = result.supplier;
      const rating = s.externalRating;
      console.log(`${index + 1}. ${s.name} (${s.slug})`);
      console.log(`   ID: ${s._id}`);
      console.log(`   Provider: ${rating?.provider || "N/A"}`);
      console.log(`   Rating: ${rating?.rating ?? "N/A"}`);
      console.log(`   URL: ${rating?.url || "N/A"}`);
    });

    if (failed.length > 0) {
      console.log("\n❌ Failed to update suppliers:");
      failed.forEach((result, index) => {
        console.log(`${index + 1}. Supplier ID: ${result.supplierId}`);
        console.log(`   Error: ${result.error}`);
      });
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successfully migrated: ${successful.length} suppliers`);
    if (failed.length > 0) {
      console.log(`   ❌ Failed: ${failed.length} suppliers`);
    }
    console.log(`   📝 Total processed: ${foundSuppliers.length} suppliers`);
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error updating suppliers:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_010");
  }
}

// Run the script
main();
