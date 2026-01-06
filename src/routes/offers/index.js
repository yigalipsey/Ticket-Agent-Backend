import express from "express";
import { logRequest } from "../../utils/logger.js";

// Query routes
import getOffersByFixtureIdRoute from "./queries/getOffersByFixtureId.js";
import getOffersByFixtureSlugRoute from "./queries/getOffersByFixtureSlug.js";
import getOffersByFixtureIdStreamRoute from "./queries/getOffersByFixtureIdStream.js";
import getOffersByFixtureSlugStreamRoute from "./queries/getOffersByFixtureSlugStream.js";
import getOffersByAgentRoute from "./queries/getOffersByAgent.js";

// Mutation routes
import createOfferRoute from "./mutations/createOffer.js";
import updateOfferRoute from "./mutations/updateOffer.js";
import deleteOfferRoute from "./mutations/deleteOffer.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime, "ROUTE_MW");
  });

  next();
});
// ========================================
// Query Routes (GET)
// ========================================
// IMPORTANT: Stream routes must come first to avoid being captured by slug parameters
router.use(getOffersByFixtureSlugStreamRoute);
router.use(getOffersByFixtureIdStreamRoute);
router.use(getOffersByFixtureSlugRoute);
router.use(getOffersByFixtureIdRoute);
router.use(getOffersByAgentRoute);

// ========================================
// Mutation Routes (POST, PUT, PATCH, DELETE)
// ========================================
router.use(createOfferRoute);
router.use(updateOfferRoute);
router.use(deleteOfferRoute);

export default router;
