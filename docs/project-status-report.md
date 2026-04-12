# Project Status Report

## Project Goal
Build an intelligent mock interview platform for career-ready students that can conduct adaptive interviews for internships and job preparation, remember prior interactions, evaluate answers with structured rubrics, and provide safe, supportive coaching with mentor oversight when needed.

## Key Objectives
- Support Behavioral, Technical, and Case interview modes
- Include situational and follow-up questioning inside the live interview flow
- Adapt questions in real time based on responses, target role, and prior history
- Use LangChain-style orchestration for agent behavior and memory flow
- Store short-term, episodic, and long-term memory for personalization
- Evaluate answers using clarity, structure, relevance, soft skills, and STAR
- Generate actionable, role-specific feedback and optional evaluator self-critique
- Apply guardrails so the interaction remains ethical, constructive, and psychologically safe
- Support mentor review, supplemental feedback, and takeover actions
- Deliver a polished web experience plus submission-ready APIs and project artifacts

## What Is Currently Working
- Full web flow is built: landing page, setup, live interview, results, history, insights, mentor dashboard, and flagged-session detail
- The conversational orchestrator is working through a config-driven runtime with Analyzer, Orchestrator, and Speaker stages
- Three modes are supported: Behavioral, Technical, and Case
- REST-first orchestration is working through `/start_session`, `/ask_question`, and `/evaluate_response`
- Layered memory is implemented with short-term, episodic, and long-term storage using local SQLite
- Personalization is active through prior sessions, weak-skill tracking, historical context, and saved resume context
- Structured evaluation is working with STAR breakdown, role-aware summary, growth tips, and optional evaluator self-critique
- Guardrail checks are active for biased, toxic, disallowed, hostile, or demoralizing content
- Mentor workflows are working through flag review, transcript inspection, supplemental feedback, takeover actions, and SSE-based live updates
- Local login is working with hashed passwords and cookie-based sessions
- Resume upload and parsing are working for PDF, text, markdown, and HTML resumes, and the saved resume is tied to the logged-in user
- Rich-text resume conversion for `.doc`, `.docx`, and `.rtf` is currently macOS-only because it relies on `textutil`
- Supporting deliverables are present: OpenAPI spec, schema docs, rubric YAML, guardrail policy, sample cURL client, synthetic-data script, evaluation notebook, and dashboard Dockerfile

## What I Am Actively Working On
- Operational hardening around Node LTS usage, clean production builds, and repeatable smoke validation
- Cross-platform resume parsing beyond the current PDF/text/HTML plus macOS `textutil` path
- Confidence-based adaptation and how evaluator self-critique should influence future interview difficulty and flow
- Multi-instance realtime durability beyond the current in-process SSE event bus
- Keeping the final documentation and demo story aligned with the actual implementation

## What I Plan To Complete For Final Submission
- Final UI and interaction polish across all main pages
- Stronger documentation and cleaner submission-ready artifacts
- Final validation of orchestration, persistence, evaluation quality, and mentor workflows
- Clear explanation of what is fully implemented now versus what remains a stretch goal
- Final summary of each major module:
- Conversational Orchestrator
- Memory and Personalization Layer
- Evaluation and Feedback Engine
- Guardrails and HITL Dashboard

## How The Project Has Been Built So Far
The project was built as a Next.js application with a modular service layer for orchestration, memory, evaluation, guardrails, mentor workflows, and auth. The interview engine was refactored into a config-driven agent structure with Analyzer, Orchestrator, and Speaker stages so the dialogue flow is easier to control and extend. Local JSON storage was replaced with SQLite for more reliable persistence, and live-model support was added through a provider adapter so the system can run with OpenAI, Gemini, or deterministic fallback logic. The current system is REST-first for the main interview flow, with Server-Sent Events used for mentor and guardrail supervision updates.

## Challenges Encountered
- Balancing a real agent-style architecture with MVP simplicity
- Migrating from file-based storage to SQLite without breaking seeded flows
- Handling provider-specific issues across Gemini and OpenAI
- Keeping PDF parsing stable across dev and production builds while being honest about non-portable rich-text conversion paths
- Avoiding stale auth/navigation state in the App Router while adding local login
- Deciding which parts of the brief should be fully implemented now and which should be honestly presented as future work
- Keeping the adaptive interview flow realistic instead of repetitive follow-up chaining

## What Worked Well
- A config-driven runtime made the interview flow easier to reason about and extend
- Separating the system into orchestration, memory, evaluation, and guardrail modules made debugging easier
- Deterministic fallbacks kept the app usable even when model access or quota failed
- SQLite was an effective local persistence step before moving to a hosted database
- Repeated API smoke tests and incremental validation helped catch real integration issues early
- Building the deliverables alongside the app kept the implementation aligned with the project brief

## Honest Status Against The Full Brief
- The core product experience is implemented and demoable
- The LangChain-style orchestration, layered memory model, evaluation flow, guardrails, and mentor review workflows are all represented in the current build
- The submission artifacts for the four student/module areas are mostly present in one integrated repo
- The biggest remaining gaps are confidence-based adaptation, OCR for scanned/image-only resumes, and multi-instance realtime durability beyond the current in-process SSE bus
