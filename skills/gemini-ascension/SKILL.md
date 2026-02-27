---
name: gemini-ascension
description: The Master Skill for Gemini CLI's self-improvement, environmental optimization, and AI service development. Use when tasked with upgrading capabilities, managing workspace infrastructure, or building complex AI tooling systems.
---

# Gemini Ascension

## Overview
Gemini Ascension is a meta-skill designed to orchestrate the continuous improvement of the Gemini CLI agent. It provides workflows for environmental auditing, capability expansion through new skills, and the systematic development of an AI Toolset Web Service.

## Core Workflows

### 1. Environmental Optimization
Use this workflow to ensure the host environment is peak-performance ready.
- **Audit**: Check versions of Node, Python, Git, and other runtimes.
- **Path Verification**: Ensure critical tools are in the PATH.
- **Cleanup**: Manage logs and temporary files to prevent context bloat.

### 2. Capability Expansion (The Upgrade Loop)
Use this workflow to add new procedural knowledge.
- **Identify Gaps**: Analyze user requests that were difficult or required repetitive boilerplate.
- **Skill Creation**: Use `skill-creator` to bundle new workflows.
- **Validation**: Run "Self-Tests" to ensure new skills are functioning as expected.

### 3. AI Service Development
The ultimate goal is to build a service for other agents.
- **Architecture**: Define API contracts and tool definitions.
- **Implementation**: Build modular toolsets (summarizers, refactorers, etc.).
- **Deployment**: Setup the local web service environment.

## Resources
- `references/architecture.md`: Current system architecture and toolset map.
- `scripts/summarize_logs.cjs`: Utility to condense session history.
- `scripts/verify_tools.cjs`: Script to check health of external runtimes.
