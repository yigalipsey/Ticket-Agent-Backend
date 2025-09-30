import Agent from "../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class AgentMutationService {
  // Create new agent
  async createAgent(agentData) {
    try {
      logWithCheckpoint("info", "Starting to create new agent", "AGENT_012", {
        agentData,
      });

      const agent = new Agent(agentData);
      const savedAgent = await agent.save();

      logWithCheckpoint("info", "Successfully created agent", "AGENT_013", {
        id: savedAgent._id,
      });

      return savedAgent;
    } catch (error) {
      logError(error, { operation: "createAgent", agentData });
      throw error;
    }
  }

  // Update agent
  async updateAgent(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update agent", "AGENT_014", {
        id,
        updateData,
      });

      const agent = await Agent.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).lean();

      if (!agent) {
        logWithCheckpoint("warn", "Agent not found for update", "AGENT_015", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated agent", "AGENT_016", {
        id,
      });
      return agent;
    } catch (error) {
      logError(error, { operation: "updateAgent", id, updateData });
      throw error;
    }
  }

  // Deactivate agent
  async deactivateAgent(id) {
    try {
      logWithCheckpoint("info", "Starting to deactivate agent", "AGENT_017", {
        id,
      });

      const agent = await Agent.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, runValidators: true }
      ).lean();

      if (!agent) {
        logWithCheckpoint(
          "warn",
          "Agent not found for deactivation",
          "AGENT_018",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint("info", "Successfully deactivated agent", "AGENT_019", {
        id,
      });
      return agent;
    } catch (error) {
      logError(error, { operation: "deactivateAgent", id });
      throw error;
    }
  }

  // Activate agent
  async activateAgent(id) {
    try {
      logWithCheckpoint("info", "Starting to activate agent", "AGENT_020", {
        id,
      });

      const agent = await Agent.findByIdAndUpdate(
        id,
        { isActive: true },
        { new: true, runValidators: true }
      ).lean();

      if (!agent) {
        logWithCheckpoint(
          "warn",
          "Agent not found for activation",
          "AGENT_021",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint("info", "Successfully activated agent", "AGENT_022", {
        id,
      });
      return agent;
    } catch (error) {
      logError(error, { operation: "activateAgent", id });
      throw error;
    }
  }
}

export default new AgentMutationService();
