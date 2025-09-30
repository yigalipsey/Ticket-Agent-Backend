import Agent from "../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class AgentQueryService {
  // Get all agents with pagination and filtering
  async getAllAgents(query = {}) {
    try {
      logWithCheckpoint("info", "Starting to fetch all agents", "AGENT_001", {
        query,
      });

      const {
        page = 1,
        limit = 20,
        isActive,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = query;

      // Build filter object
      const filter = {};

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
        logWithCheckpoint("debug", "Added isActive filter", "AGENT_002", {
          isActive: filter.isActive,
        });
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { whatsapp: { $regex: search, $options: "i" } },
        ];
        logWithCheckpoint("debug", "Added search filter", "AGENT_003", {
          search,
        });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint("info", "Executing database query", "AGENT_004", {
        filter,
        sort,
        skip,
        limit,
      });

      const [agents, total] = await Promise.all([
        Agent.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
        Agent.countDocuments(filter),
      ]);

      logWithCheckpoint("info", "Successfully fetched agents", "AGENT_005", {
        count: agents.length,
        total,
      });

      return {
        agents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError(error, { operation: "getAllAgents", query });
      throw error;
    }
  }

  // Get agent by ID
  async getAgentById(id) {
    try {
      logWithCheckpoint("info", "Starting to fetch agent by ID", "AGENT_006", {
        id,
      });

      const agent = await Agent.findById(id).lean();

      if (!agent) {
        logWithCheckpoint("warn", "Agent not found", "AGENT_007", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched agent", "AGENT_008", {
        id,
      });
      return agent;
    } catch (error) {
      logError(error, { operation: "getAgentById", id });
      throw error;
    }
  }

  // Get agent by WhatsApp number
  async getAgentByWhatsApp(whatsapp) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch agent by WhatsApp",
        "AGENT_009",
        {
          whatsapp,
        }
      );

      const agent = await Agent.findOne({ whatsapp }).lean();

      if (!agent) {
        logWithCheckpoint("warn", "Agent not found by WhatsApp", "AGENT_010", {
          whatsapp,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched agent by WhatsApp",
        "AGENT_011",
        {
          whatsapp,
        }
      );
      return agent;
    } catch (error) {
      logError(error, { operation: "getAgentByWhatsApp", whatsapp });
      throw error;
    }
  }

  // Get active agents only
  async getActiveAgents() {
    try {
      logWithCheckpoint("info", "Starting to fetch active agents", "AGENT_023");

      const agents = await Agent.find({ isActive: true })
        .sort({ name: 1 })
        .lean();

      logWithCheckpoint(
        "info",
        "Successfully fetched active agents",
        "AGENT_024",
        {
          count: agents.length,
        }
      );

      return agents;
    } catch (error) {
      logError(error, { operation: "getActiveAgents" });
      throw error;
    }
  }
}

export default new AgentQueryService();
