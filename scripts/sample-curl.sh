#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
PASSWORD="${PASSWORD:-strong-password-123}"
EMAIL="${EMAIL:-student.$(date +%s).$RANDOM@example.com}"
DISPLAY_NAME="${DISPLAY_NAME:-Demo Student}"

cleanup() {
  rm -f "$COOKIE_JAR"
}

trap cleanup EXIT

echo "Creating authenticated demo user..."
SIGNUP_JSON=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"display_name\": \"$DISPLAY_NAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$SIGNUP_JSON"

echo
echo "Starting session..."
SESSION_JSON=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/start_session" \
  -H "Content-Type: application/json" \
  -d '{
    "target_role": "Software Engineer Intern",
    "mode": "technical",
    "focus_area": "system design",
    "confidence_self_rating": 3,
    "personalization_enabled": true,
    "self_critique_enabled": true,
    "notes": "Demo flow from sample curl script.",
    "resume_text": "Built a campus app used by 2,000 students.\nOwned backend APIs and observability dashboards."
  }')

echo "$SESSION_JSON"

SESSION_ID=$(printf "%s" "$SESSION_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["session_id"])')
CURRENT_PHASE=$(printf "%s" "$SESSION_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["current_phase"])')
RECALLED_CONTEXT_SUMMARY=$(printf "%s" "$SESSION_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("recalled_context_summary") or "")')

echo
echo "Recalling explicit orchestrator context..."
RECALL_JSON=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/memory/recall_context" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"query_type\": \"mixed\",
    \"query_text\": \"Software Engineer Intern system design\"
  }")

echo "$RECALL_JSON"

ASK_PAYLOAD=$(python3 - "$SESSION_ID" "$CURRENT_PHASE" "$RECALLED_CONTEXT_SUMMARY" "$RECALL_JSON" <<'PY'
import json
import sys

session_id, current_phase, recalled_context_summary, recall_json = sys.argv[1:]
recall = json.loads(recall_json)

payload = {
    "session_id": session_id,
    "latest_answer": None,
    "context": {
        "mode": "technical",
        "target_role": "Software Engineer Intern",
        "focus_area": "system design",
        "personalization_enabled": True,
        "self_critique_enabled": True,
        "resume_text": "Built a campus app used by 2,000 students.\nOwned backend APIs and observability dashboards.",
        "recalled_context_summary": recalled_context_summary or None,
        "session_status": "initialized",
        "transcript": [],
        "current_phase": current_phase,
        "turn_count": 0,
        "redirect_count": 0,
        "turn_type": "first_turn",
        "conversation_summary": recalled_context_summary or None,
        "weak_skills": recall.get("weak_skills", []),
        "recalled_context_items": recall.get("context_items", []),
        "flagged": False,
        "mentor_takeover_active": False,
    }
}

print(json.dumps(payload))
PY
)

echo
echo "Requesting first question with explicit stateless context..."
QUESTION_JSON=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/ask_question" \
  -H "Content-Type: application/json" \
  -d "$ASK_PAYLOAD")

echo "$QUESTION_JSON"
QUESTION_TEXT=$(printf "%s" "$QUESTION_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["question_text"])')

EVALUATION_PAYLOAD=$(python3 - "$SESSION_ID" "$QUESTION_TEXT" <<'PY'
import json
import sys

session_id, question_text = sys.argv[1], sys.argv[2]

print(json.dumps({
    "session_id": session_id,
    "question_text": question_text,
    "answer_text": "I would begin by clarifying requirements, traffic, and reliability needs. Then I would define the API surface, explain storage choices, and call out tradeoffs around caching, consistency, and observability.",
    "target_role": "Software Engineer Intern",
    "mode": "technical",
    "self_critique_enabled": True
}))
PY
)

echo
echo "Evaluating response..."
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE_URL/evaluate_response" \
  -H "Content-Type: application/json" \
  -d "$EVALUATION_PAYLOAD"

echo
echo "Fetching summary..."
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/session/$SESSION_ID/summary"
