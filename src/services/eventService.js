import Event from '../models/Event.js';
import { logWithCheckpoint, logError } from '../utils/logger.js';

class EventService {
  // Get all events with pagination and filtering
  async getAllEvents(query = {}) {
    try {
      logWithCheckpoint('info', 'Starting to fetch all events', 'EVENT_001', { query });
      
      const {
        page = 1,
        limit = 20,
        status,
        type,
        dateFrom,
        dateTo,
        sortBy = 'date',
        sortOrder = 'asc'
      } = query;

      // Build filter object
      const filter = {};
      
      if (status) {
        filter.status = status;
        logWithCheckpoint('debug', 'Added status filter', 'EVENT_002', { status });
      }
      
      if (type) {
        filter.type = type;
        logWithCheckpoint('debug', 'Added type filter', 'EVENT_003', { type });
      }
      
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
        logWithCheckpoint('debug', 'Added date range filter', 'EVENT_004', { dateFrom, dateTo });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint('info', 'Executing database query', 'EVENT_005', { 
        filter, 
        sort, 
        skip, 
        limit 
      });

      const [events, total] = await Promise.all([
        Event.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Event.countDocuments(filter)
      ]);

      logWithCheckpoint('info', 'Successfully fetched events', 'EVENT_006', { 
        count: events.length, 
        total 
      });

      return {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logError(error, { operation: 'getAllEvents', query });
      throw error;
    }
  }

  // Get event by ID
  async getEventById(id) {
    try {
      logWithCheckpoint('info', 'Starting to fetch event by ID', 'EVENT_007', { id });
      
      const event = await Event.findById(id).lean();
      
      if (!event) {
        logWithCheckpoint('warn', 'Event not found', 'EVENT_008', { id });
        return null;
      }

      logWithCheckpoint('info', 'Successfully fetched event', 'EVENT_009', { id });
      return event;
    } catch (error) {
      logError(error, { operation: 'getEventById', id });
      throw error;
    }
  }

  // Create new event
  async createEvent(eventData) {
    try {
      logWithCheckpoint('info', 'Starting to create new event', 'EVENT_010', { eventData });
      
      const event = new Event(eventData);
      const savedEvent = await event.save();
      
      logWithCheckpoint('info', 'Successfully created event', 'EVENT_011', { 
        id: savedEvent._id 
      });
      
      return savedEvent;
    } catch (error) {
      logError(error, { operation: 'createEvent', eventData });
      throw error;
    }
  }

  // Update event
  async updateEvent(id, updateData) {
    try {
      logWithCheckpoint('info', 'Starting to update event', 'EVENT_012', { id, updateData });
      
      const event = await Event.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();
      
      if (!event) {
        logWithCheckpoint('warn', 'Event not found for update', 'EVENT_013', { id });
        return null;
      }

      logWithCheckpoint('info', 'Successfully updated event', 'EVENT_014', { id });
      return event;
    } catch (error) {
      logError(error, { operation: 'updateEvent', id, updateData });
      throw error;
    }
  }

  // Delete event
  async deleteEvent(id) {
    try {
      logWithCheckpoint('info', 'Starting to delete event', 'EVENT_015', { id });
      
      const event = await Event.findByIdAndDelete(id).lean();
      
      if (!event) {
        logWithCheckpoint('warn', 'Event not found for deletion', 'EVENT_016', { id });
        return null;
      }

      logWithCheckpoint('info', 'Successfully deleted event', 'EVENT_017', { id });
      return event;
    } catch (error) {
      logError(error, { operation: 'deleteEvent', id });
      throw error;
    }
  }

  // Find event by external ID
  async findEventByExternalId(provider, externalId) {
    try {
      logWithCheckpoint('info', 'Starting to find event by external ID', 'EVENT_018', { 
        provider, 
        externalId 
      });
      
      const filter = {};
      filter[`externalIds.${provider}`] = externalId;
      
      const event = await Event.findOne(filter).lean();
      
      logWithCheckpoint('info', 'Completed external ID lookup', 'EVENT_019', { 
        provider, 
        externalId, 
        found: !!event 
      });
      
      return event;
    } catch (error) {
      logError(error, { operation: 'findEventByExternalId', provider, externalId });
      throw error;
    }
  }
}

export default new EventService();
