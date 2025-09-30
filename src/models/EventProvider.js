import mongoose from 'mongoose';

const eventProviderSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['viagogo', 'seatpick', 'stubhub', 'ticketmaster', 'other']
  },
  externalEventId: {
    type: String,
    required: true
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
eventProviderSchema.index({ eventId: 1, provider: 1 }, { unique: true });
eventProviderSchema.index({ provider: 1 });
eventProviderSchema.index({ lastSyncedAt: 1 });
eventProviderSchema.index({ isActive: 1 });

const EventProvider = mongoose.model('EventProvider', eventProviderSchema);

export default EventProvider;
