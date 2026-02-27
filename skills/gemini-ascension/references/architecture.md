# Gemini CLI Architecture Reference

## Core Components
- **Runtime**: Node.js v22.17.0
- **Primary Shell**: PowerShell (win32)
- **Workspace Root**: `C:\Users\fogen\.gemini`
- **Config Storage**: JSON files (`settings.json`, `projects.json`, `state.json`)
- **Policies**: `policies/auto-saved.toml` (Permissive for development tools)

## Available Toolsets
- **File System**: `list_directory`, `read_file`, `write_file`, `replace`, `glob`, `grep_search`.
- **System**: `run_shell_command` (Elevated permissions granted).
- **External**: `web_fetch`, `google_web_search`.
- **Sub-Agents**: `codebase_investigator`, `cli_help`.

## Capabilities
- **Scripting**: Python 3.13, Node.js v22.
- **VCS**: Git 2.48.
- **Package Management**: NPM.

## Self-Improvement Path
1. **Metadata Mastery**: Optimize `GEMINI.md` and project-level configs.
2. **Modular Expansion**: Use Skills to compartmentalize complex logic.
3. **Service Layer**: Transition from a CLI tool to an API-driven service provider.
