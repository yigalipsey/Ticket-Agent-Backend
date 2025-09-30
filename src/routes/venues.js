import express from "express";
import VenueService from "../services/venue/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";

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

// GET /api/venues - Get all venues with pagination and filtering
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const result = await VenueService.query.getAllVenues(req.query);

    res.json({
      success: true,
      data: result.venues,
      pagination: result.pagination,
    });
  } catch (error) {
    logError(error, { route: "GET /api/venues", query: req.query });
    res.status(500).json({
      success: false,
      error: "Failed to fetch venues",
      message: error.message,
    });
  }
});

// GET /api/venues/:id - Get venue by ID
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid venue ID format",
      });
    }

    const venue = await VenueService.query.getVenueById(id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        error: "Venue not found",
      });
    }

    res.json({
      success: true,
      data: venue,
    });
  } catch (error) {
    logError(error, { route: "GET /api/venues/:id", id: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to fetch venue",
      message: error.message,
    });
  }
});

// POST /api/venues - Create new venue
router.post("/", authenticateToken, requireRole("agent"), rateLimit(10), async (req, res) => {
  try {
    const venueData = req.body;

    // Basic validation
    if (!venueData.name || !venueData.city) {
      return res.status(400).json({
        success: false,
        error: "Name and city are required",
      });
    }

    const venue = await VenueService.mutate.createVenue(venueData);

    res.status(201).json({
      success: true,
      data: venue,
    });
  } catch (error) {
    logError(error, { route: "POST /api/venues", body: req.body });
    res.status(500).json({
      success: false,
      error: "Failed to create venue",
      message: error.message,
    });
  }
});

// PUT /api/venues/:id - Update venue
router.put("/:id", authenticateToken, requireRole("agent"), rateLimit(20), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid venue ID format",
      });
    }

    const venue = await VenueService.mutate.updateVenue(id, updateData);

    if (!venue) {
      return res.status(404).json({
        success: false,
        error: "Venue not found",
      });
    }

    res.json({
      success: true,
      data: venue,
    });
  } catch (error) {
    logError(error, {
      route: "PUT /api/venues/:id",
      id: req.params.id,
      body: req.body,
    });
    res.status(500).json({
      success: false,
      error: "Failed to update venue",
      message: error.message,
    });
  }
});

export default router;
