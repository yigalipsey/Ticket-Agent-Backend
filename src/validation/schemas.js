import Joi from "joi";

// Common validation schemas
export const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

// User validation schemas
export const userCreateSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  passwordHash: Joi.string().min(6).optional(),
  agentId: objectIdSchema.optional(),
  role: Joi.string().valid("user", "agent", "admin", "super-admin").default("user"),
  isActive: Joi.boolean().default(true),
});

export const userUpdateSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
  passwordHash: Joi.string().min(6).optional(),
  agentId: objectIdSchema.optional(),
  role: Joi.string().valid("user", "agent", "admin", "super-admin").optional(),
  isActive: Joi.boolean().optional(),
});

export const userLoginSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(6).required(),
});

export const userRegisterSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(6).required(),
  agentId: objectIdSchema.optional(),
  role: Joi.string().valid("user", "agent", "admin", "super-admin").default("user"),
});

// Agent validation schemas
export const agentCreateSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  name: Joi.string().min(2).max(100).optional(),
  isActive: Joi.boolean().default(true),
});

export const agentUpdateSchema = Joi.object({
  whatsapp: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
  name: Joi.string().min(2).max(100).optional(),
  isActive: Joi.boolean().optional(),
});

// Team validation schemas
export const teamCreateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(10).required(),
  country: Joi.string().min(2).max(50).required(),
  logoUrl: Joi.string().uri().optional(),
  venueId: objectIdSchema,
  teamId: Joi.number().integer().positive().required(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().required(),
  }).required(),
});

export const teamUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  code: Joi.string().min(2).max(10).optional(),
  country: Joi.string().min(2).max(50).optional(),
  logoUrl: Joi.string().uri().optional(),
  venueId: objectIdSchema.optional(),
  teamId: Joi.number().integer().positive().optional(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().optional(),
  }).optional(),
});

// Venue validation schemas
export const venueCreateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  city: Joi.string().min(2).max(50).required(),
  country: Joi.string().min(2).max(50).default("England"),
  capacity: Joi.number().integer().min(1).default(50000),
  venueId: Joi.number().integer().positive().required(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().required(),
  }).required(),
});

export const venueUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  city: Joi.string().min(2).max(50).optional(),
  country: Joi.string().min(2).max(50).optional(),
  capacity: Joi.number().integer().min(1).optional(),
  venueId: Joi.number().integer().positive().optional(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().optional(),
  }).optional(),
});

// League validation schemas
export const leagueCreateSchema = Joi.object({
  leagueId: Joi.number().integer().positive().required(),
  name: Joi.string().min(2).max(100).required(),
  country: Joi.string().min(2).max(50).required(),
  logoUrl: Joi.string().uri().optional(),
  type: Joi.string().valid("League", "Cup").default("League"),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().required(),
  }).required(),
});

export const leagueUpdateSchema = Joi.object({
  leagueId: Joi.number().integer().positive().optional(),
  name: Joi.string().min(2).max(100).optional(),
  country: Joi.string().min(2).max(50).optional(),
  logoUrl: Joi.string().uri().optional(),
  type: Joi.string().valid("League", "Cup").optional(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().optional(),
  }).optional(),
});

// Football Event validation schemas
export const footballEventCreateSchema = Joi.object({
  fixtureId: Joi.number().integer().positive().required(),
  date: Joi.date().required(),
  status: Joi.string().min(2).max(20).required(),
  league: objectIdSchema,
  homeTeam: objectIdSchema,
  awayTeam: objectIdSchema,
  venue: objectIdSchema,
  round: Joi.string().min(2).max(50).required(),
  roundNumber: Joi.number().integer().min(1).default(1),
  tags: Joi.array().items(Joi.string()).default([]),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().required(),
  }).required(),
});

export const footballEventUpdateSchema = Joi.object({
  fixtureId: Joi.number().integer().positive().optional(),
  date: Joi.date().optional(),
  status: Joi.string().min(2).max(20).optional(),
  league: objectIdSchema.optional(),
  homeTeam: objectIdSchema.optional(),
  awayTeam: objectIdSchema.optional(),
  venue: objectIdSchema.optional(),
  round: Joi.string().min(2).max(50).optional(),
  roundNumber: Joi.number().integer().min(1).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  externalIds: Joi.object({
    apiFootball: Joi.number().integer().positive().optional(),
  }).optional(),
});

// Offer validation schemas
export const offerCreateSchema = Joi.object({
  fixtureId: objectIdSchema,
  agentId: objectIdSchema,
  price: Joi.number().positive().required(),
  currency: Joi.string().valid("EUR", "USD", "ILS").default("EUR"),
  description: Joi.string().max(500).optional(),
  source: Joi.string().valid("supplier", "affiliate", "direct").default("direct"),
  metadata: Joi.object({
    seatCategory: Joi.string().optional(),
    seatSection: Joi.string().optional(),
    seatRow: Joi.string().optional(),
    seatNumber: Joi.string().optional(),
    notes: Joi.string().optional(),
  }).optional(),
  externalIds: Joi.object({
    supplier: Joi.string().optional(),
  }).optional(),
});

export const offerUpdateSchema = Joi.object({
  price: Joi.number().positive().optional(),
  currency: Joi.string().valid("EUR", "USD", "ILS").optional(),
  description: Joi.string().max(500).optional(),
  source: Joi.string().valid("supplier", "affiliate", "direct").optional(),
  isAvailable: Joi.boolean().optional(),
  metadata: Joi.object({
    seatCategory: Joi.string().optional(),
    seatSection: Joi.string().optional(),
    seatRow: Joi.string().optional(),
    seatNumber: Joi.string().optional(),
    notes: Joi.string().optional(),
  }).optional(),
  externalIds: Joi.object({
    supplier: Joi.string().optional(),
  }).optional(),
});

// Event validation schemas
export const eventCreateSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  date: Joi.date().required(),
  type: Joi.string().min(2).max(50).required(),
  status: Joi.string().min(2).max(20).default("scheduled"),
  externalIds: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number())).optional(),
});

export const eventUpdateSchema = Joi.object({
  title: Joi.string().min(2).max(200).optional(),
  date: Joi.date().optional(),
  type: Joi.string().min(2).max(50).optional(),
  status: Joi.string().min(2).max(20).optional(),
  externalIds: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number())).optional(),
});
