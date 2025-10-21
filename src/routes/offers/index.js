import express from "express";
import { logRequest } from "../../utils/logger.js";

// Query routes
import getOffersByFixtureIdRoute from "./queries/getOffersByFixtureId.js";

// Mutation routes
import createOfferRoute from "./mutations/createOffer.js";
import deleteOfferRoute from "./mutations/deleteOffer.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// ========================================
// Query Routes (GET)
// ========================================
router.use(getOffersByFixtureIdRoute);

// ========================================
// Mutation Routes (POST, PUT, PATCH, DELETE)
// ========================================
router.use(createOfferRoute);
router.use(deleteOfferRoute);

export default router;
