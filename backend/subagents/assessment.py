import re
from typing import Any, Optional

from backend.models.domain import CrisisState, Incident, LatLng, TraceEntry
from backend.models.enums import (
    IncidentSource,
    IncidentStatus,
    IncidentType,
    ResourceType,
    Tier,
    TriggerKind,
)
from backend.services.llm import LLMClient, LLMResult
from backend.services.scoring import priority_score, tier_for
from backend.subagents.base import SubAgent, SubAgentResult, TriggerContext

DEFAULT_REQUIRED: dict[IncidentType, dict[ResourceType, int]] = {
    IncidentType.medical: {ResourceType.ambulance: 1},
    IncidentType.fire: {ResourceType.fire_engine: 1},
    IncidentType.rescue: {ResourceType.rescue_team: 1},
    IncidentType.hazmat: {ResourceType.fire_engine: 1, ResourceType.ambulance: 1},
}

KNOWN_PLACES: dict[str, tuple[float, float, str]] = {
    "mg road metro": (12.9716, 77.5946, "MG Road Metro"),
    "mg road": (12.9716, 77.5946, "MG Road"),
    "shivajinagar depot": (12.9650, 77.6000, "Shivajinagar Depot"),
    "shivajinagar": (12.9650, 77.6000, "Shivajinagar"),
    "richmond circle flyover": (12.9610, 77.5970, "Richmond Circle Flyover"),
    "richmond circle": (12.9610, 77.5970, "Richmond Circle"),
    "brigade road": (12.9740, 77.6070, "Brigade Road"),
    "indiranagar": (12.9780, 77.6400, "Indiranagar"),
    "koramangala": (12.9350, 77.6200, "Koramangala"),
    "town hall": (12.9630, 77.5830, "Town Hall"),
    "victoria hospital": (12.9620, 77.5750, "Victoria Hospital"),
    "bowring hospital": (12.9810, 77.6050, "Bowring Hospital"),
}

NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
}

ASSESSMENT_SYSTEM_PROMPT = (
    "You are the Crisis Command Assessment Sub-Agent for emergency response coordination in Bengaluru.\n"
    "Extract structured incident parameters from the emergency report and output ONLY a JSON object matching this schema:\n"
    "{\n"
    '  "type": "medical" | "fire" | "rescue" | "hazmat",\n'
    '  "severity": integer from 1 to 5,\n'
    '  "people_affected": integer >= 0 or null,\n'
    '  "location_label": string or null,\n'
    '  "required": {"ambulance": int, "fire_engine": int, "rescue_team": int} or null,\n'
    '  "uncertain_fields": [string, ...],\n'
    '  "confidence": float between 0.0 and 1.0\n'
    "}\n\n"
    "CRITICAL SAFETY RULES:\n"
    "1. Never guess. If a value is not explicitly stated in the input text, put the field name in 'uncertain_fields' and return null for that field.\n"
    "2. Never invent or hallucinate a location or coordinates. If the location is vague or missing, set 'location_label' to null and add 'location' to 'uncertain_fields'.\n"
    "3. Severity must be between 1 (minor) and 5 (critical).\n"
)


def parse_free_text_rule_based(
    text: str,
    clock_min: int = 0,
    incident_id: str = "I_AUTO",
) -> tuple[Incident, list[str]]:
    """
    Parse a natural language emergency transmission using deterministic rules and keywords.
    Returns the constructed Incident and a list of rationale messages.
    """
    lower_text = text.lower()
    uncertain_fields: list[str] = []
    rules_applied: list[str] = []

    # 1. Emergency Type Extraction
    inc_type = IncidentType.medical
    if re.search(r"\b(hazmat|chemical|fumes|toxic|radiation|gas leak)\b", lower_text):
        inc_type = IncidentType.hazmat
        rules_applied.append("Type rule: matched hazmat/chemical keywords -> hazmat")
    elif re.search(r"\b(fire|smoke|flames|burning|blaze|explosion)\b", lower_text):
        inc_type = IncidentType.fire
        rules_applied.append("Type rule: matched fire/smoke keywords -> fire")
    elif re.search(r"\b(building collapse|bldng colapse|structure collapse|structural collapse|colapse|collapse|search and rescue|under rubble|ruble|buried|cave-in|rescuer)\b", lower_text):
        inc_type = IncidentType.rescue
        rules_applied.append("Type rule: matched structural collapse/rescue keywords -> rescue")
    elif re.search(r"\b(heart attack|chest pain|unconscious|collapsed|cardiac|medical|ambulance|patient|injured|injury|bleeding|sick)\b", lower_text):
        inc_type = IncidentType.medical
        rules_applied.append("Type rule: matched medical/cardiac/collapse keywords -> medical")
    elif re.search(r"\b(trapped|traped|rescue)\b", lower_text):
        inc_type = IncidentType.rescue
        rules_applied.append("Type rule: matched rescue keywords -> rescue")
    else:
        inc_type = IncidentType.medical
        uncertain_fields.append("type")
        rules_applied.append("Type rule: no clear type keywords matched, defaulted to medical (uncertain)")

    # 2. Severity Extraction
    severity = 3
    has_severity_cue = False

    critical_cues = ["explosion", "building collapse", "bldng colapse", "multiple casualties", "cardiac arrest"]
    high_cues = ["collapsed", "colapse", "trapped", "traped", "unconscious", "heart attack", "severe", "critical", "heavy smoke"]
    minor_cues = ["minor", "small", "stable", "contained", "conscious"]

    if any(re.search(rf"\b{re.escape(w)}\b", lower_text) for w in critical_cues):
        severity = 5
        has_severity_cue = True
        rules_applied.append("Severity rule: matched critical keywords -> severity 5")
    elif any(re.search(rf"\b{re.escape(w)}\b", lower_text) for w in high_cues):
        severity = 4
        has_severity_cue = True
        rules_applied.append("Severity rule: matched 'collapsed', 'trapped', or 'unconscious' -> raised severity to 4")
    elif any(re.search(rf"\b{re.escape(w)}\b", lower_text) for w in minor_cues):
        severity = 2
        has_severity_cue = True
        rules_applied.append("Severity rule: matched minor keywords -> lowered severity to 2")

    if not has_severity_cue:
        uncertain_fields.append("severity")
        rules_applied.append("Severity rule: no severity keywords found, defaulted to 3 (uncertain)")

    # 3. People Affected Extraction
    people_affected = 0
    has_people_cue = False

    digit_match = re.search(r"\b(\d+)\s*(?:people|persons|patients|casualties|victims|men|women|passengers|workers)?\b", lower_text)
    if digit_match:
        people_affected = int(digit_match.group(1))
        has_people_cue = True
        rules_applied.append(f"Casualties rule: extracted {people_affected} from numeric pattern")
    else:
        for word, val in NUMBER_WORDS.items():
            if re.search(rf"\b{word}\s+(?:people|persons|patients|casualties|victims|men|women|passengers)?\b", lower_text):
                people_affected = val
                has_people_cue = True
                rules_applied.append(f"Casualties rule: extracted {people_affected} from word '{word}'")
                break

    if not has_people_cue:
        if re.search(r"\b(man|woman|person|patient|someone)\b", lower_text):
            people_affected = 1
            has_people_cue = True
            rules_applied.append("Casualties rule: matched singular person reference -> 1 person")
        else:
            people_affected = 1
            uncertain_fields.append("people_affected")
            rules_applied.append("Casualties rule: no casualty count found, defaulted to 1 (uncertain)")

    # 4. Location Extraction & Vague Location Safety Check
    matched_place: Optional[tuple[float, float, str]] = None
    for place_name, coords in KNOWN_PLACES.items():
        if re.search(rf"\b{re.escape(place_name)}\b", lower_text):
            matched_place = coords
            break

    needs_confirmation = False
    if matched_place:
        lat, lng, label = matched_place
        location = LatLng(lat=lat, lng=lng, label=label)
        rules_applied.append(f"Location rule: verified place '{label}' -> ({lat}, {lng})")
    else:
        needs_confirmation = True
        uncertain_fields.append("location")
        prep_match = re.search(r"\b(?:near|at|around|opposite|behind|outside)\s+([a-zA-Z\s]+?)(?:,|\.|$)", lower_text)
        approx_label = f"Unverified: {prep_match.group(0).strip()}" if prep_match else "Unspecified location"
        location = LatLng(lat=12.9716, lng=77.5946, label=approx_label)
        rules_applied.append("Location rule: vague/unknown location -> needs_confirmation=True, uncertain_fields += location")

    # 5. Required Resources from Defaults
    required_resources = dict(DEFAULT_REQUIRED.get(inc_type, {ResourceType.ambulance: 1}))
    rules_applied.append(f"Requirement rule: assigned type defaults for {inc_type.value}: {required_resources}")

    # Build Incident
    incident = Incident(
        id=incident_id,
        type=inc_type,
        severity=severity,
        description=text.strip(),
        location=location,
        people_affected=people_affected,
        required=required_resources,
        status=IncidentStatus.assessed,
        reported_at_min=clock_min,
        uncertain_fields=uncertain_fields,
        needs_confirmation=needs_confirmation,
        source=IncidentSource.free_text,
    )

    # 6. Priority and Tier Calculation
    score = priority_score(incident, clock_min=clock_min)
    tier = tier_for(score)
    incident.priority = score
    incident.tier = tier
    rules_applied.append(f"Scoring rule: calculated priority={score}, tier={tier.value}")

    return incident, rules_applied


class AssessmentSubAgent:
    """
    Assessment Sub-Agent (P2).
    Evaluates new incidents using xAI Grok (with fallback to rule-based keyword extraction),
    computes deterministic priority & tier, enforces uncertainty flags, and sets needs_confirmation gate.
    """
    name: str = "assessment"

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client or LLMClient()

    def _validate_llm_json(self, data: Any) -> Optional[dict[str, Any]]:
        """Validate LLM output against domain boundaries. Return cleaned dict or None if invalid."""
        if not isinstance(data, dict):
            return None

        # Type validation
        raw_type = str(data.get("type", "")).lower()
        if raw_type not in (IncidentType.medical.value, IncidentType.fire.value, IncidentType.rescue.value, IncidentType.hazmat.value):
            return None

        # Severity validation (1 to 5)
        raw_sev = data.get("severity")
        if not isinstance(raw_sev, (int, float)) or int(raw_sev) < 1 or int(raw_sev) > 5:
            return None

        # People affected validation (if present, must be non-negative)
        raw_people = data.get("people_affected")
        if raw_people is not None and (not isinstance(raw_people, (int, float)) or int(raw_people) < 0):
            return None

        return data

    def run(self, state: CrisisState, ctx: TriggerContext) -> SubAgentResult:
        traces: list[TraceEntry] = []
        assessed_incidents: list[Incident] = []

        clock_min = state.clock_min

        # 1. Handle Free-Text Input
        free_text = ctx.payload.get("free_text")
        if free_text and isinstance(free_text, str):
            inc_id = ctx.payload.get("incident_id") or f"I{len(state.incidents) + 1}"

            # Attempt parsing via xAI Grok (if enabled and key present)
            llm_res = self.llm_client.complete_json(
                system=ASSESSMENT_SYSTEM_PROMPT,
                user=free_text,
                schema_hint='{"type": "medical", "severity": 4, "people_affected": 1, "location_label": null, "uncertain_fields": ["location"]}',
            )

            validated_data = self._validate_llm_json(llm_res.data) if llm_res.ok else None

            if llm_res.ok and validated_data:
                # LLM output is valid and accepted
                inc_type = IncidentType(validated_data["type"].lower())
                severity = int(validated_data["severity"])

                raw_people = validated_data.get("people_affected")
                uncertain_fields = list(validated_data.get("uncertain_fields") or [])

                if raw_people is None:
                    people_affected = 1
                    if "people_affected" not in uncertain_fields:
                        uncertain_fields.append("people_affected")
                else:
                    people_affected = int(raw_people)

                # Location handling: never invent location
                raw_loc_label = validated_data.get("location_label")
                needs_confirmation = False

                if not raw_loc_label or not str(raw_loc_label).strip():
                    needs_confirmation = True
                    if "location" not in uncertain_fields:
                        uncertain_fields.append("location")
                    location = LatLng(lat=12.9716, lng=77.5946, label="Unverified location")
                else:
                    norm_label = str(raw_loc_label).strip().lower()
                    if norm_label in KNOWN_PLACES:
                        lat, lng, label = KNOWN_PLACES[norm_label]
                        location = LatLng(lat=lat, lng=lng, label=label)
                    else:
                        # Vague or unrecognized place name -> trigger human confirmation gate
                        needs_confirmation = True
                        if "location" not in uncertain_fields:
                            uncertain_fields.append("location")
                        location = LatLng(lat=12.9716, lng=77.5946, label=str(raw_loc_label).strip())

                # Required resources
                req_from_llm = validated_data.get("required")
                if req_from_llm and isinstance(req_from_llm, dict):
                    required_resources = {}
                    for k, v in req_from_llm.items():
                        try:
                            required_resources[ResourceType(k)] = int(v)
                        except (ValueError, TypeError):
                            pass
                    if not required_resources:
                        required_resources = dict(DEFAULT_REQUIRED.get(inc_type, {ResourceType.ambulance: 1}))
                else:
                    required_resources = dict(DEFAULT_REQUIRED.get(inc_type, {ResourceType.ambulance: 1}))

                incident = Incident(
                    id=inc_id,
                    type=inc_type,
                    severity=severity,
                    description=free_text.strip(),
                    location=location,
                    people_affected=people_affected,
                    required=required_resources,
                    status=IncidentStatus.assessed,
                    reported_at_min=clock_min,
                    uncertain_fields=uncertain_fields,
                    needs_confirmation=needs_confirmation,
                    source=IncidentSource.free_text,
                )

                score = priority_score(incident, clock_min=clock_min)
                tier = tier_for(score)
                incident.priority = score
                incident.tier = tier

                assessed_incidents.append(incident)

                traces.append(
                    TraceEntry(
                        agent=self.name,
                        step="assess_free_text_llm",
                        detail=(
                            f"xAI Grok parsed free-text report {inc_id}: type={inc_type.value}, "
                            f"severity={severity}, uncertain={uncertain_fields}, "
                            f"needs_confirmation={needs_confirmation}, priority={score:.1f}"
                        ),
                        used_llm=True,
                        fallback_used=False,
                        at_min=clock_min,
                    )
                )

            else:
                # LLM disabled, error, timeout, or invalid JSON -> Deterministic Rule-Based Fallback
                fallback_reason = llm_res.error or "LLM response failed schema validation"
                incident, rules = parse_free_text_rule_based(
                    text=free_text,
                    clock_min=clock_min,
                    incident_id=inc_id,
                )
                assessed_incidents.append(incident)

                traces.append(
                    TraceEntry(
                        agent=self.name,
                        step="assess_free_text_rule_fallback",
                        detail=f"Rule-based fallback used ({fallback_reason}): " + "; ".join(rules),
                        used_llm=False,
                        fallback_used=True,
                        at_min=clock_min,
                    )
                )

            return SubAgentResult(
                payload={"incidents": assessed_incidents},
                traces=traces,
            )

        # 2. Handle Structured Incident(s) in Trigger Payload
        raw_incidents = []
        if "incident" in ctx.payload:
            raw_incidents.append(ctx.payload["incident"])
        elif "incidents" in ctx.payload:
            raw_incidents.extend(ctx.payload["incidents"])
        elif "incident_id" in ctx.payload:
            target_id = ctx.payload["incident_id"]
            existing = next((i for i in state.incidents if i.id == target_id), None)
            if existing:
                inc_copy = existing.model_copy()
                if "severity" in ctx.payload:
                    inc_copy.severity = int(ctx.payload["severity"])
                raw_incidents.append(inc_copy)
        elif ctx.kind == TriggerKind.time_advance:
            for inc in state.incidents:
                if inc.status != IncidentStatus.resolved:
                    raw_incidents.append(inc.model_copy())

        if not raw_incidents and not ctx.payload:
            raw_incidents = [inc.model_copy() for inc in state.incidents]

        for item in raw_incidents:
            if isinstance(item, dict):
                inc = Incident.model_validate(item)
            elif isinstance(item, Incident):
                inc = item.model_copy()
            else:
                continue

            if not inc.required:
                inc.required = dict(DEFAULT_REQUIRED.get(inc.type, {ResourceType.ambulance: 1}))

            if inc.status == IncidentStatus.new:
                inc.status = IncidentStatus.assessed

            score = priority_score(inc, clock_min=clock_min)
            tier = tier_for(score)
            inc.priority = score
            inc.tier = tier

            assessed_incidents.append(inc)

            traces.append(
                TraceEntry(
                    agent=self.name,
                    step="assess_structured_incident",
                    detail=(
                        f"Assessed {inc.id} ({inc.type.value}): priority={score:.1f}, "
                        f"tier={tier.value}, required={dict(inc.required)}, "
                        f"needs_confirmation={inc.needs_confirmation}"
                    ),
                    used_llm=False,
                    fallback_used=False,
                    at_min=clock_min,
                )
            )

        return SubAgentResult(
            payload={"incidents": assessed_incidents},
            traces=traces,
        )
