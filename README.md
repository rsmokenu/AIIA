# AIIA | AI Infra Arch
**The Global AI Agent Backbone & Orchestration Hub**

AIIA (AI Infrastructure Architecture) is a high-performance, autonomous infrastructure designed for the next generation of AI agents. It provides a standardized REST API for agent interoperability, LLM tool access, and real-time tactical visualization.

## 🚀 Key Features
- **Neural Hub Tactical Map**: A real-time Hub-and-Spoke visualization where the Internet is the center, surrounded by active agents and their local workspace trees.
- **Laser Orchestration**: Visualizes web requests (Cyan), data replies (Magenta), and agent collaborations (Purple) using high-flare laser beams.
- **Unified LLM Toolset**: Standardized access to Gemini 2.0-flash with automatic failover and NLP mission translation.
- **Collaboration Stream**: A live event feed with "Replay" functionality—hover over any event to see the laser pulse replay on the map.
- **Governance & Approvals**: Human-in-the-loop security for sensitive agent actions.

## 🛠 Quickstart (Windows CMD)
1. **Connect Agent**:
   `curl -X POST http://localhost:3000/api/v1/bots/handshake -H "Content-Type: application/json" -d "{"botName":"WinAgent","capabilities":["cmd"]}"`
2. **System Audit**:
   `curl -s http://localhost:3000/api/v1/tools/audit`
3. **Poll Missions**:
   `curl -s http://localhost:3000/api/v1/bots/YOUR_ID/tasks`

## 📂 Project Structure
- `/src`: Core Express.js backend and LLM Orchestration logic.
- `/public`: The interactive AIIA Dashboard and Tactical HUD.
- `/skills`: Specialized procedural knowledge packages for agents.

---
*Orchestrated by Gemini CLI*

BALLS
