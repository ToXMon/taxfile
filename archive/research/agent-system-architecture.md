# Agent Zero Company Operating System — Architecture Overview

## Overview
A 17-agent hierarchical system designed to run entire companies or software products from marketing to development, top to bottom. Built on Agent Zero's native subordinate profile system.

## Directory Structure
```
/a0/usr/agents/
├── executive-producer/     # TOP — Orchestrates all departments
├── studio-coach/           # Coordination coach for multi-agent tasks
├── ai-engineer/            # ML/LLM/AI integration
├── backend-architect/      # APIs, databases, system design
├── devops-automator/       # CI/CD, containers, cloud infra
├── test-engineer/          # QA, test automation, TDD
├── product-manager/        # Requirements, roadmap, prioritization
├── workflow-optimizer/     # Process optimization, automation
├── project-shipper/        # Release coordination, GTM execution
├── brand-guardian/         # Visual identity, brand guidelines
├── ui-designer/            # Interface design, component systems
├── ux-researcher/          # User research, usability testing
├── content-strategist/     # ICP, personas, content roadmaps
├── social-media-manager/   # Multi-platform social strategy
├── growth-hacker/          # Growth loops, experimentation
├── seo-optimizer/          # SEO, ASO, keyword research
└── support-responder/      # Customer support, knowledge base
```

Each agent folder contains:
- `agent.yaml` — Title, description, routing context
- `prompts/agent.system.main.role.md` — 500-3000 word role prompt

## Hierarchy & Delegation Flow

```
User (CEO)
  └── Agent Zero (agent0) — You are here
        ├── executive-producer — Cross-department orchestration
        │     ├── ai-engineer
        │     ├── backend-architect
        │     ├── devops-automator
        │     ├── test-engineer
        │     ├── product-manager
        │     ├── ui-designer
        │     ├── ux-researcher
        │     ├── content-strategist
        │     ├── social-media-manager
        │     ├── growth-hacker
        │     ├── seo-optimizer
        │     ├── support-responder
        │     └── project-shipper
        ├── studio-coach — Multi-agent coordination
        └── workflow-optimizer — Process optimization
```

## Department Map

| Department | Agents | Primary Function |
|---|---|---|
| **Executive** | executive-producer, studio-coach | Orchestration, coordination, strategy |
| **Engineering** | ai-engineer, backend-architect, devops-automator, test-engineer | Build, test, deploy software |
| **Product** | product-manager, workflow-optimizer, project-shipper | Plan, optimize, ship |
| **Design** | brand-guardian, ui-designer, ux-researcher | Brand, interface, experience |
| **Marketing** | content-strategist, social-media-manager, growth-hacker, seo-optimizer | Strategy, social, growth, search |
| **Support** | support-responder | Customer success, documentation |

## Key Frameworks Integrated

- **LEVEL UP ICP Framework** (content-strategist) — B2B 13-section + B2C 10-section Ideal Customer Profiles
- **Content Multiplication Model** — Pillar-to-derivative content mapping
- **Full-Funnel Content Mapping** — TOFU/MOFU/BOFU stage alignment
- **OKR Cascade Architecture** (executive-producer) — Company → Department → Sprint → Task
- **Theory of Constraints** (workflow-optimizer) — Bottleneck detection and elevation
- **AARRR Pirate Metrics** (growth-hacker) — Acquisition, Activation, Retention, Revenue, Referral
- **ICE Prioritization** (growth-hacker) — Impact × Confidence × Ease scoring
- **RICE Framework** (product-manager) — Reach × Impact × Confidence × Effort
- **Crisis Management Protocol** (studio-coach) — 6-step structured response

## Usage Patterns

### Pattern 1: Full Company Orchestration
User → Agent0 → executive-producer → (delegates to all departments)

### Pattern 2: Department-Level Task
User → Agent0 → specific agent (e.g., backend-architect)

### Pattern 3: Multi-Agent Coordination
User → Agent0 → studio-coach → (coordinates 3-5 specialists)

### Pattern 4: Process Improvement
User → Agent0 → workflow-optimizer → (analyzes and optimizes workflows)

## Source Attribution
- Agent definitions: Contains Studio agents specification
- Marketing frameworks: Katy — Prompt Led Marketing Prompts (NY Tech Week 2025)
- Profile system: Agent Zero framework `/a0/agents/` structure

## Maintenance Notes
- All files in `/a0/usr/agents/` survive framework updates
- To modify an agent: edit its `agent.yaml` (routing) or `prompts/agent.system.main.role.md` (behavior)
- To add new agents: create new folder following the same structure

## Skills Library

Custom skills in `/a0/usr/skills/` provide expert knowledge that agent0 loads and passes to relevant subordinates.

| Skill | Words | Triggers | Primary Agent | Purpose |
|-------|-------|----------|---------------|---------|
| **shadcn-ui** | 728 | shadcn, component library, UI components, design system | ui-designer | Project-aware shadcn component usage, theming (OKLCH/HSL), composition rules |
| **interface-craft** | 822 | animation, transitions, dials, sliders, critique, polish | ui-designer | Storyboard Animation (spring presets, stagger), DialKit (live controls), Design Critique (4-dimension review) |
| **akash-deploy** | 650 + 5 rules | Akash, decentralized cloud, AKT, SDL | devops-automator | Akash Network SDL authoring, CLI commands, GPU workloads, persistent storage |

### Skill → Agent Mapping
- **ui-designer** receives knowledge from: `shadcn-ui` + `interface-craft`
- **devops-automator** receives knowledge from: `akash-deploy`
- **executive-producer** can trigger any skill via delegation

### Skills vs Agents distinction
- **Agents** (17): Autonomous specialists with full role prompts, called via `call_subordinate`
- **Skills** (3): Knowledge packs loaded by agent0, injected into task context for relevant agents
- Skills do NOT auto-inject into subordinates — agent0 loads them and includes relevant knowledge in delegation messages

### Akash Deploy Rules Files
```
/a0/usr/skills/akash-deploy/rules/
├── deploy/cli/common-commands.md
├── sdl/schema-overview.md
├── sdl/validation-rules.md
├── sdl/examples/web-app.md
└── terminology.md
```

## Maintenance Notes
- All files in `/a0/usr/agents/` survive framework updates
- All files in `/a0/usr/skills/` survive framework updates
- To modify an agent: edit its `agent.yaml` (routing) or `prompts/agent.system.main.role.md` (behavior)
- To modify a skill: edit its `SKILL.md` (instructions) or add files to its subdirectories
- To add new agents: create folder in `/a0/usr/agents/` following the same structure
- To add new skills: create folder in `/a0/usr/skills/` with `SKILL.md` following the format
- Profiles appear automatically in Agent0's call_subordinate profile dropdown
- Skills appear automatically in Agent0's skills list
