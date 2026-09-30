# Crisis Command: Multi-Agent Emergency Response

**Team Neural Ninjas** | **Gateways 2026 Hackathon** | **Domain 4: Crisis Command**

## Problem
During major crises, several incidents develop simultaneously while response resources are strictly limited. Control-room staff need a live operational picture, dynamic priority reassessment, and a clear understanding of the trade-offs when resources are reallocated.

## Solution
Crisis Command is a multi-agent decision-support workflow that:
1. Turns incoming emergency information into structured incident data (severity, urgency, location, resource needs).
2. Continuously tracks available response units (ambulances, fire engines, rescue teams) and travel conditions.
3. Uses a deterministic **Allocation Engine** to generate feasible plans and simulate alternative scenarios (`What-If Simulator`), comparing response time, coverage, and resource utilization.
4. Alerts human coordinators to high-impact reallocations via an **Approval Gate** (Human-in-the-loop).

## Architecture
The system employs a decentralized sub-agent architecture orchestrated by a central engine:
- **Assessment Agent**: Parses incoming free-text incident reports using xAI Grok or deterministic fallbacks.
- **Allocation Agent**: Deterministically matches available resources to incident priorities, calculating real-time ETAs.
- **Logistics Agent**: Computes haversine distances and real-time travel parameters.
- **Impact Detector**: Monitors the active plan to detect if a resource failure invalidates current dispatch assignments.
- **What-If Simulator**: Clones the crisis state to evaluate counterfactual events before committing to high-impact changes.
- **Explainer Agent**: Generates human-readable audit trails and explanations for every decision made by the system.

## Team Neural Ninjas
- **Namratha Nataraj** (Team Lead, Product/Strategy) - P2: LLM Integration & Assessment
- **Vishal M** (AI and Multi-Agent Systems) - P4: Logistics, Demo Scenario & Frontend
- **Tuhin Paul** (Backend and Simulation) - P1: Orchestrator, Engine & API
- **Shreesha Joshi** (Frontend and UX) - P3: Allocation, Impact Detection & What-If

## Running the Application
### Backend (FastAPI + LangGraph)
```bash
python -m venv .venv
# On Windows: .venv\Scripts\Activate.ps1
# On Unix: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.main:app --reload --port 8000
```

### Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
pytest backend/tests -q
```

*Note: For the purpose of the hackathon demo, the application uses an in-memory SimulationEngine and is designed to run seamlessly even without an active LLM API key (`LLM_ENABLED=false`).*
