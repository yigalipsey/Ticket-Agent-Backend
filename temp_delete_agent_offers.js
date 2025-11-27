import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "./src/config/database.js";
import Offer from "./src/models/Offer.js";
import Review from "./src/models/Review.js";
import Agent from "./src/models/Agent.js";
import OfferService from "./src/services/offer/index.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

const AGENT_ID = "69022c05e0683d43a2380d6a";

async function deleteAgentAndAllData() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to delete agent and all related data",
      "DELETE_AGENT_001",
      { agentId: AGENT_ID }
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "DELETE_AGENT_002"
    );

    // Check if agent exists (may have been deleted already)
    const agent = await Agent.findById(AGENT_ID).lean();
    if (agent) {
      console.log(`\n📋 Agent found: ${agent.name || agent.email}`);
    } else {
      console.log(`\n⚠️  Agent ${AGENT_ID} not found (may have been deleted already, but will continue to delete remaining offers)`);
    }

    // Step 1: Find and delete all offers for this agent
    // Search for both old format (agentId) and new format (ownerType + ownerId)
    // Use native MongoDB query to find legacy offers with agentId field
    const agentObjectId = new mongoose.Types.ObjectId(AGENT_ID);
    
    // First, try Mongoose query for new format
    const newFormatOffers = await Offer.find({
      ownerType: "Agent",
      ownerId: agentObjectId,
    }).lean();

    // Then, use native MongoDB collection to find legacy offers with agentId
    const offersCollection = mongoose.connection.db.collection("offers");
    const legacyOffers = await offersCollection
      .find({ agentId: agentObjectId })
      .toArray();

    // Combine both results
    const allOffers = [...newFormatOffers, ...legacyOffers];

    console.log(`\n📊 Found ${allOffers.length} offers for agent ${AGENT_ID}:`);
    console.log(`   - New format (ownerType + ownerId): ${newFormatOffers.length}`);
    console.log(`   - Legacy format (agentId): ${legacyOffers.length}`);

    let deletedOffersCount = 0;
    let offerErrors = 0;

    if (allOffers.length > 0) {
      console.log("\n📋 Offers to be deleted:");
      allOffers.forEach((offer, index) => {
        const offerId = offer._id?.toString() || offer._id;
        const fixtureId = offer.fixtureId?.toString() || offer.fixtureId;
        const price = offer.price;
        const currency = offer.currency || "N/A";
        console.log(
          `   ${index + 1}. Offer ID: ${offerId}, Fixture: ${fixtureId}, Price: ${price} ${currency}`
        );
      });

      console.log("\n🗑️  Starting offers deletion process...\n");

      for (let i = 0; i < allOffers.length; i++) {
        const offer = allOffers[i];
        const offerId = offer._id?.toString() || offer._id;
        try {
          logWithCheckpoint(
            "info",
            `Deleting offer ${i + 1}/${allOffers.length}`,
            "DELETE_AGENT_003",
            { offerId, fixtureId: offer.fixtureId }
          );

          // Try using the service first (for new format offers)
          try {
            await OfferService.mutate.deleteOffer(offerId);
          } catch (serviceError) {
            // If service fails (e.g., for legacy offers), delete directly from collection
            if (serviceError.message?.includes("not found") || serviceError.code === "OFFER_NOT_FOUND") {
              // Delete directly from MongoDB collection
              await offersCollection.deleteOne({ _id: new mongoose.Types.ObjectId(offerId) });
            } else {
              throw serviceError;
            }
          }
          
          deletedOffersCount++;
          console.log(
            `   ✅ [${i + 1}/${allOffers.length}] Deleted offer ${offerId}`
          );
        } catch (error) {
          offerErrors++;
          logError(error, {
            operation: "deleteAgentOffer",
            offerId,
            agentId: AGENT_ID,
          });
          console.error(
            `   ❌ [${i + 1}/${allOffers.length}] Failed to delete offer ${offerId}:`,
            error.message
          );
        }
      }
    } else {
      console.log("\n✅ No offers found to delete");
    }

    // Step 2: Find and delete all reviews for this agent
    const reviews = await Review.find({ agentId: AGENT_ID }).lean();

    console.log(`\n📊 Found ${reviews.length} reviews for agent ${AGENT_ID}`);

    let deletedReviewsCount = 0;
    let reviewErrors = 0;

    if (reviews.length > 0) {
      console.log("\n📋 Reviews to be deleted:");
      reviews.forEach((review, index) => {
        console.log(
          `   ${index + 1}. Review ID: ${review._id}, Rating: ${review.rating}, Reviewer: ${review.reviewerName}`
        );
      });

      console.log("\n🗑️  Starting reviews deletion process...\n");

      for (let i = 0; i < reviews.length; i++) {
        const review = reviews[i];
        try {
          logWithCheckpoint(
            "info",
            `Deleting review ${i + 1}/${reviews.length}`,
            "DELETE_AGENT_004",
            { reviewId: review._id }
          );

          await Review.findByIdAndDelete(review._id);
          deletedReviewsCount++;
          console.log(
            `   ✅ [${i + 1}/${reviews.length}] Deleted review ${review._id}`
          );
        } catch (error) {
          reviewErrors++;
          logError(error, {
            operation: "deleteAgentReview",
            reviewId: review._id,
            agentId: AGENT_ID,
          });
          console.error(
            `   ❌ [${i + 1}/${reviews.length}] Failed to delete review ${review._id}:`,
            error.message
          );
        }
      }
    } else {
      console.log("\n✅ No reviews found to delete");
    }

    // Step 3: Delete the agent itself (if it still exists)
    console.log("\n🗑️  Deleting agent...\n");

    let agentDeleted = false;
    if (agent) {
      try {
        logWithCheckpoint(
          "info",
          "Deleting agent",
          "DELETE_AGENT_005",
          { agentId: AGENT_ID }
        );

        await Agent.findByIdAndDelete(AGENT_ID);
        agentDeleted = true;
        console.log(`   ✅ Successfully deleted agent ${AGENT_ID}`);
      } catch (error) {
        logError(error, {
          operation: "deleteAgent",
          agentId: AGENT_ID,
        });
        console.error(`   ❌ Failed to delete agent ${AGENT_ID}:`, error.message);
      }
    } else {
      console.log(`   ℹ️  Agent already deleted (skipping)`);
      agentDeleted = true; // Already deleted
    }

    // Final Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Final Deletion Summary:");
    console.log(`   Offers found: ${allOffers.length}`);
    console.log(`   Offers deleted: ${deletedOffersCount}`);
    console.log(`   Offer errors: ${offerErrors}`);
    console.log(`   Reviews found: ${reviews.length}`);
    console.log(`   Reviews deleted: ${deletedReviewsCount}`);
    console.log(`   Review errors: ${reviewErrors}`);
    console.log(`   Agent deleted: ${agentDeleted ? "✅ Yes" : "❌ No"}`);
    console.log("=".repeat(50) + "\n");

    await databaseConnection.disconnect();
    logWithCheckpoint(
      "info",
      "Database disconnected",
      "DELETE_AGENT_006",
      {
        deletedOffersCount,
        offerErrors,
        deletedReviewsCount,
        reviewErrors,
        agentDeleted,
      }
    );
  } catch (error) {
    logError(error, {
      operation: "deleteAgentAndAllData",
      agentId: AGENT_ID,
    });
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
deleteAgentAndAllData();

