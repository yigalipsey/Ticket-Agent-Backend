import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Agent from "../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class AgentAuthService {
  /**
   * Login agent with email and password
   */
  async login(email, password) {
    try {
      logWithCheckpoint(
        "info",
        "Starting agent login process",
        "AGENT_AUTH_001",
        { email }
      );

      // Find agent by email
      const agent = await Agent.findOne({ email }).lean();

      if (!agent) {
        logWithCheckpoint(
          "warn",
          "Agent not found by email",
          "AGENT_AUTH_002",
          { email }
        );
        throw new Error("AGENT_NOT_FOUND");
      }

      if (!agent.isActive) {
        logWithCheckpoint(
          "warn",
          "Agent account is deactivated",
          "AGENT_AUTH_003",
          { email, agentId: agent._id }
        );
        throw new Error("AGENT_ACCOUNT_DEACTIVATED");
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        agent.passwordHash
      );

      if (!isValidPassword) {
        logWithCheckpoint(
          "warn",
          "Invalid password for agent",
          "AGENT_AUTH_004",
          { email, agentId: agent._id }
        );
        throw new Error("AGENT_INVALID_CREDENTIALS");
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          agentId: agent._id,
          email: agent.email,
          whatsapp: agent.whatsapp,
          tokenVersion: agent.tokenVersion,
          role: "agent",
        },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "24h" }
      );

      // Update last login
      await Agent.findByIdAndUpdate(agent._id, {
        lastLoginAt: new Date(),
      });

      logWithCheckpoint("info", "Agent login successful", "AGENT_AUTH_005", {
        agentId: agent._id,
        email: agent.email,
        whatsapp: agent.whatsapp,
      });

      return {
        token,
        agent: {
          _id: agent._id,
          email: agent.email,
          whatsapp: agent.whatsapp,
          name: agent.name,
          isActive: agent.isActive,
          agentType: agent.agentType,
          companyName: agent.companyName,
          lastLoginAt: new Date(),
        },
      };
    } catch (error) {
      if (error.message.startsWith("AGENT_")) {
        throw error;
      }
      logError(error, { operation: "agentLogin", email });
      throw new Error("AGENT_LOGIN_ERROR");
    }
  }

  /**
   * Verify agent token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback-secret"
      );

      // Check if agent still exists and is active
      const agent = await Agent.findById(decoded.agentId).lean();

      if (!agent || !agent.isActive) {
        throw new Error("AGENT_NOT_FOUND_OR_INACTIVE");
      }

      // Check token version
      if (agent.tokenVersion !== decoded.tokenVersion) {
        throw new Error("AGENT_TOKEN_VERSION_MISMATCH");
      }

      return {
        agentId: agent._id,
        email: agent.email,
        whatsapp: agent.whatsapp,
        role: "agent",
      };
    } catch (error) {
      logError(error, { operation: "verifyAgentToken" });
      throw new Error("AGENT_TOKEN_INVALID");
    }
  }

  /**
   * Increment token version to invalidate all tokens
   */
  async incrementTokenVersion(agentId) {
    try {
      await Agent.findByIdAndUpdate(agentId, {
        $inc: { tokenVersion: 1 },
      });

      logWithCheckpoint(
        "info",
        "Agent token version incremented",
        "AGENT_AUTH_006",
        { agentId }
      );
    } catch (error) {
      logError(error, { operation: "incrementAgentTokenVersion", agentId });
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  async getAgentById(agentId) {
    try {
      const agent = await Agent.findById(agentId).lean();

      if (!agent) {
        throw new Error("AGENT_NOT_FOUND");
      }

      return {
        _id: agent._id,
        email: agent.email,
        whatsapp: agent.whatsapp,
        name: agent.name,
        isActive: agent.isActive,
        agentType: agent.agentType,
        companyName: agent.companyName,
        lastLoginAt: agent.lastLoginAt,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      };
    } catch (error) {
      if (error.message === "AGENT_NOT_FOUND") {
        throw error;
      }
      logError(error, { operation: "getAgentById", agentId });
      throw new Error("AGENT_FETCH_ERROR");
    }
  }
}

export default new AgentAuthService();
