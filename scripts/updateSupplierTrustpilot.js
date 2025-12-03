import dotenv from "dotenv";
import mongoose from "mongoose";
import Supplier from "../src/models/Supplier.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update Trustpilot rating and URL for suppliers
 */

// Supplier data to update
const supplierUpdates = [
  {
    id: "692476c8b4f389968e1f00f5",
    trustpilotUrl: "https://www.trustpilot.com/review/hellotickets.com",
    trustpilotRating: 4.2,
  },
  {
    id: "691f13ba34f1aabcacf68b18",
    trustpilotUrl: "https://www.trustpilot.com/review/p1travel.com",
    trustpilotRating: 4.6,
  },
  {
    id: "692c5e80270da1b2ea057dd9",
    trustpilotUrl: "https://www.trustpilot.com/review/www.sportsevents365.com",
    trustpilotRating: 4,
  },
];

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

async function findSuppliersByIds() {
  try {
    logWithCheckpoint(
      "info",
      "Finding suppliers by MongoDB IDs",
      "SCRIPT_003"
    );

    const foundSuppliers = [];

    for (const update of supplierUpdates) {
      const supplier = await Supplier.findById(update.id).lean();

      if (supplier) {
        foundSuppliers.push({
          _id: supplier._id,
          name: supplier.name,
          slug: supplier.slug,
          currentRating: supplier.trustpilotRating || null,
          currentUrl: supplier.trustpilotUrl || null,
          updateData: {
            trustpilotUrl: update.trustpilotUrl,
            trustpilotRating: update.trustpilotRating,
          },
        });
        logWithCheckpoint(
          "info",
          `Found supplier: ${supplier.name} (${supplier.slug})`,
          "SCRIPT_004",
          { supplierId: supplier._id }
        );
      } else {
        logWithCheckpoint(
          "warn",
          `Supplier not found with ID: ${update.id}`,
          "SCRIPT_004"
        );
      }
    }

    return foundSuppliers;
  } catch (error) {
    logError(error, { operation: "findSuppliersByIds" });
    throw error;
  }
}

async function updateSuppliersTrustpilot(suppliers) {
  try {
    logWithCheckpoint(
      "info",
      `Updating ${suppliers.length} suppliers with Trustpilot data`,
      "SCRIPT_005"
    );

    const results = [];

    for (const supplier of suppliers) {
      try {
        const result = await Supplier.findByIdAndUpdate(
          supplier._id,
          {
            $set: {
              trustpilotUrl: supplier.updateData.trustpilotUrl,
              trustpilotRating: supplier.updateData.trustpilotRating,
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
              trustpilotRating: result.trustpilotRating,
              trustpilotUrl: result.trustpilotUrl,
            },
          });

          logWithCheckpoint(
            "info",
            `Updated supplier: ${result.name}`,
            "SCRIPT_006",
            {
              supplierId: result._id,
              rating: result.trustpilotRating,
              url: result.trustpilotUrl,
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
          operation: "updateSupplierTrustpilot",
          supplierId: supplier._id,
          supplierName: supplier.name,
        });
      }
    }

    return results;
  } catch (error) {
    logError(error, { operation: "updateSuppliersTrustpilot" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Find suppliers by IDs
    const foundSuppliers = await findSuppliersByIds();

    if (foundSuppliers.length === 0) {
      logWithCheckpoint(
        "warn",
        "No suppliers found with the provided IDs",
        "SCRIPT_007"
      );
      return;
    }

    if (foundSuppliers.length < supplierUpdates.length) {
      logWithCheckpoint(
        "warn",
        `Only found ${foundSuppliers.length} out of ${supplierUpdates.length} suppliers`,
        "SCRIPT_008",
        {
          found: foundSuppliers.length,
          expected: supplierUpdates.length,
        }
      );
    }

    logWithCheckpoint(
      "info",
      `Found ${foundSuppliers.length} suppliers to update`,
      "SCRIPT_008",
      {
        suppliers: foundSuppliers.map((s) => ({
          name: s.name,
          slug: s.slug,
          currentRating: s.currentRating,
          newRating: s.updateData.trustpilotRating,
        })),
      }
    );

    // Update suppliers
    const updateResults = await updateSuppliersTrustpilot(foundSuppliers);

    // Display results
    const successful = updateResults.filter((r) => r.success);
    const failed = updateResults.filter((r) => !r.success);

    logWithCheckpoint(
      "info",
      "Trustpilot data update completed",
      "SCRIPT_009",
      {
        successful: successful.length,
        failed: failed.length,
      }
    );

    console.log("\n✅ Successfully updated suppliers with Trustpilot data:");
    successful.forEach((result, index) => {
      const s = result.supplier;
      console.log(
        `${index + 1}. ${s.name} (${s.slug})`
      );
      console.log(`   ID: ${s._id}`);
      console.log(`   Trustpilot Rating: ${s.trustpilotRating}`);
      console.log(`   Trustpilot URL: ${s.trustpilotUrl}`);
    });

    if (failed.length > 0) {
      console.log("\n❌ Failed to update suppliers:");
      failed.forEach((result, index) => {
        console.log(
          `${index + 1}. Supplier ID: ${result.supplierId}`
        );
        console.log(`   Error: ${result.error}`);
      });
    }

    console.log(`\nTotal: ${successful.length} suppliers updated successfully`);
    if (failed.length > 0) {
      console.log(`Failed: ${failed.length} suppliers`);
    }
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

