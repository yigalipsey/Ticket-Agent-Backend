import express from 'express';
import eventService from '../services/eventService.js';
import { logRequest, logError } from '../utils/logger.js';
import { authenticateToken, requireRole, rateLimit } from '../middleware/auth.js';

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });
  
  next();
});

// GET /api/events - Get all events with pagination and filtering
router.get('/', rateLimit(100), async (req, res) => {
  try {
    const result = await eventService.getAllEvents(req.query);
    
    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    logError(error, { route: 'GET /api/events', query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      message: error.message
    });
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }
    
    const event = await eventService.getEventById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logError(error, { route: 'GET /api/events/:id', id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event',
      message: error.message
    });
  }
});

// POST /api/events - Create new event
router.post('/', authenticateToken, requireRole("agent"), rateLimit(10), async (req, res) => {
  try {
    const eventData = req.body;
    
    // Basic validation
    if (!eventData.title || !eventData.date) {
      return res.status(400).json({
        success: false,
        error: 'Title and date are required'
      });
    }
    
    // Validate date
    const eventDate = new Date(eventData.date);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }
    
    const event = await eventService.createEvent(eventData);
    
    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    logError(error, { route: 'POST /api/events', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
      message: error.message
    });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', authenticateToken, requireRole("agent"), rateLimit(20), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }
    
    const event = await eventService.updateEvent(id, updateData);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logError(error, { route: 'PUT /api/events/:id', id: req.params.id, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
      message: error.message
    });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', authenticateToken, requireRole("agent"), rateLimit(10), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event ID format'
      });
    }
    
    const event = await eventService.deleteEvent(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logError(error, { route: 'DELETE /api/events/:id', id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      message: error.message
    });
  }
});

export default router;
