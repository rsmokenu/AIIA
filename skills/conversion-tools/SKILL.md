name: conversion-tools
description: High-performance file conversion utility for AIIA agents. Use when agents need to convert between formats like PDF, DOCX, CSV, and images via the conversiontools.io MCP gateway.

# Conversion Tools Skill

This skill provides an interface to the Conversion Tools MCP server at `https://mcp.conversiontools.io/mcp`.

## Workflows

### 1. File Conversion
When a mission requires document transformation:
- Identify source file and target format.
- Use the MCP tools to upload, convert, and download the resulting file.
- Report completion back to the AIIA Backbone.

## Configuration
- **MCP Endpoint**: `https://mcp.conversiontools.io/mcp`
- **Agent Integration**: Standard AIIA agents with `file_system` capability can leverage this skill.
