# Problem statement (condensed from the Round 1 Ideation and Architecture Document)

Team Neural Ninjas, Gateways 2026, Domain 4: Crisis Command, the Multi-Agent Emergency Response and Resource Coordination Agent.

## Problem
Several incidents develop at once while response resources are limited. A reasonable decision becomes unsuitable when a higher-severity incident appears, a resource becomes unavailable, or travel conditions change. Control-room staff need a current picture, reassessed priorities, and an understanding of what a plan change costs.

## Solution
A decision-support workflow that:
1. Turns incoming incident information into structured severity, urgency, location, type and resource needs.
2. Checks available teams and vehicles and travel constraints.
3. Generates feasible plans and can simulate alternatives, comparing response time, resource usage, coverage and unresolved risk.
4. When conditions change, repeats the assessment and shows what changed, why, and which decisions need human approval.

## Round 1 architecture (as submitted)
Incident Assessment Agent, Crisis State Manager, Resource Agent, Logistics Agent, Priority Engine, Response Planner, Scenario Simulator, Command Agent. The crisis state is the shared source of truth. AI assists assessment and reasoning; deterministic rules and simulation enforce constraints.

## Edge cases the demo must handle
- New high-severity incident: reassess, recalculate affected assignments, generate alternatives.
- Resource becomes unavailable: update state, find conflicting assignments, simulate replacements before approval.
- Conflicting or incomplete information: mark uncertain fields, do not invent critical values, flag for human confirmation.
- Route or travel change: refresh logistics constraints, recalculate affected plans.
- High-impact reallocation: show consequences and require human approval before commit.
- Plan fails in simulation: reject it and search for another feasible allocation.

## Originality claims to preserve
State-aware planning, alternative plans instead of one opaque answer, counterfactual simulation before high-impact decisions, explicit human approval, measurable comparison (response time, coverage, utilization, unresolved incidents), deterministic demo events.

## Round 1 team (from the document)
Namratha Nataraj (Team Lead, Product/Strategy), Vishal M (AI and Multi-Agent Systems), Tuhin Paul (Backend and Simulation), Shreesha Joshi (Frontend and UX). Mapping to P1 to P4 is not decided; see `OPEN_ITEMS.md`.
