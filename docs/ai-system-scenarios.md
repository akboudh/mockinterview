# AI System Scenarios

This document explains how the mock interview system behaves in real situations using concrete examples. It covers both happy paths and failure cases, and it keeps the language simple on purpose.

## Happy Path 1: Returning Student, Behavioral Interview, Resume-Based Personalization

### Example
A student named Akshat logs in, already has a saved resume, and wants to practice for a `Product Manager Intern` behavioral interview.

### What happens step by step
1. Akshat logs in.
   The app reads the session cookie, finds the matching local auth session, and loads Akshat’s user record from SQLite.

2. Akshat opens the setup page.
   The system loads long-term memory and checks whether prior context exists.
   It also loads the saved resume text tied to Akshat’s account.

3. Akshat picks:
   - Target role: `Product Manager Intern`
   - Mode: `Behavioral`
   - Personalization: `On`
   - Self-critique: `On`

4. Akshat clicks `Launch Interview`.
   The app sends a request to `POST /start_session`.
   The backend creates a new session, stores session metadata, attaches the saved resume text, and builds a personalization summary.

5. The memory layer recalls prior context.
   It may pull things like:
   - repeated weakness: weak STAR structure
   - prior role history: PM interviews
   - resume themes: stakeholder communication, analytics, prioritization

6. The interview runtime starts.
   The runtime creates the initial agent state:
   - current phase: `interview_setup`
   - turn count: `0`
   - no current question yet

7. The frontend asks for the first question through `POST /ask_question`.
   Because there is no previous answer yet, the runtime goes down the first-turn path.
   It skips answer analysis and asks the Speaker stage to generate an opening question.

8. The system chooses a role-aware opening question.
   Example output:
   `Tell me about a time you had to influence a decision without direct authority.`

9. Akshat answers.
   The answer is saved as a student message.
   Short-term memory is updated with the latest transcript context.

10. The system evaluates the answer.
    `POST /evaluate_response` runs the evaluator.
    It scores:
    - clarity
    - structure
    - relevance
    - soft skills
    It also extracts STAR fields and writes an evaluation record.

11. The analyzer reviews the answer quality.
    If the answer is strong enough, the orchestrator decides not to stay trapped in follow-up mode.
    Instead of asking another tiny clarification, it may move to a fresh situational question.

12. The next question is generated.
    Example:
    `Now imagine your engineering team disagrees with your roadmap priority. How would you handle that conversation?`

13. At the end of the session, the results page is built.
    The student sees:
    - session summary
    - rubric scores
    - STAR breakdown
    - growth tips
    - optional evaluator self-critique

### Final output the student sees
- a personalized behavioral interview
- questions that reflect prior history and resume context
- structured feedback that is easy to act on

## Happy Path 2: Technical Interview With Strong Answer Evaluation

### Example
A student wants a `Software Engineer Intern` technical interview and gives a solid answer about API design tradeoffs.

### What happens step by step
1. The student starts a session in `Technical` mode.

2. The first question is generated.
   Example:
   `Design a simple API for a task management app. What endpoints would you include first, and why?`

3. The student answers with a clear structure:
   - explains core resources
   - talks about CRUD endpoints
   - mentions pagination and auth later

4. The evaluator scores the answer.
   Example result:
   - clarity: `4`
   - structure: `4`
   - relevance: `5`
   - soft skills: `3`

5. The analyzer notices the answer is solid, but there is still room to probe tradeoffs.
   It marks the answer as `solid` and suggests a follow-up target like `tradeoff thinking`.

6. The orchestrator decides to ask one deeper question instead of switching immediately.
   Example:
   `If you had to choose between shipping quickly and building more robust authentication upfront, how would you decide?`

7. The student answers again.
   This answer is saved, evaluated, and folded into the final session summary.

### Final output the student sees
- a technical conversation that feels connected
- deeper follow-up only where it makes sense
- feedback that explains where the answer was strong and where it was still shallow

## Happy Path 3: Flagged Session With Mentor Review

### Example
A student answer triggers a safety rule because it contains wording that looks hostile or inappropriate.

### What happens step by step
1. The student submits an answer.

2. The guardrail layer scans the text.
   It checks for patterns related to:
   - bias
   - toxicity
   - disallowed content
   - demoralizing tone

3. A finding is created.
   The backend stores:
   - a flag record
   - a memory event
   - updated runtime state showing the session is flagged

4. The student flow stays calm.
   The app does not throw a scary system error.
   It either continues safely or uses a safer fallback response.

5. The mentor dashboard updates.
   The flagged session now appears in the queue with:
   - session id
   - role
   - mode
   - reason for flag

6. A mentor opens the flagged session.
   The mentor can inspect:
   - transcript
   - evaluation output
   - flag reason

7. The mentor chooses a response.
   They can:
   - mark it reviewed
   - leave supplemental feedback
   - take over the session

### Final output
- student experience remains stable
- mentor gets enough context to act
- the event is preserved for later review

## Failure Scenario 1: Scanned Resume PDF Still Cannot Be Used

### Example
A student uploads a scanned resume PDF from their phone. It looks fine to a human, but it is basically just an image inside a PDF.

### What happens step by step
1. The student uploads the file on the setup page.

2. The frontend sends it to `POST /resume/parse`.

3. The backend tries normal PDF text extraction.
   It does not find real text because the file has no selectable text layer.

4. The parser returns almost nothing.
   At this point, the system does not switch to OCR because OCR is not implemented yet.

5. The resume cannot be saved as useful profile context.
   That means the interview engine loses one of the main personalization inputs for that student.

6. The student can still continue, but the session becomes less personalized than intended.

### Where the gap is
- the system can parse text PDFs
- it cannot yet handle image-only or scanned resumes
- there is no OCR fallback

### Final output
- the session still runs
- resume-based personalization is lost for that upload
- the student has to manually upload a different file or continue without resume context

## Failure Scenario 2: Mentor Takeover Is Live On One App Instance, But Not Durable Across Multiple Instances

### Example
A student is mid-interview on the live page. A mentor opens the dashboard and clicks `Take over session`.

### What happens step by step
1. The mentor submits the takeover action.

2. The backend writes the takeover event to the database.
   It also updates the session status and runtime state.

3. The student is still sitting on the interview page.

4. The student page is subscribed to the Server-Sent Events stream for that session.

5. If the student and mentor are connected to the same app process, the takeover event is pushed into the open browser promptly and the interview UI locks down.

6. If the app is deployed across multiple isolated instances without a shared pub/sub layer, the in-memory event bus does not bridge those processes. In that case, the takeover is still persisted, but a connected browser on another instance may not receive the live event immediately.

### Where the gap is
- mentor takeover exists in the backend
- the app does have a realtime SSE channel
- the remaining limitation is cross-instance delivery because the current event bus is process-local

### Final output
- the mentor action is saved
- the system state changes
- the live student experience is immediate on a single instance, but not yet guaranteed across multiple app instances

## Failure Scenario 3: Memory Can Miss the Right Prior Context

### Example
A returning student says, `Ask me about that crop-science project from last semester where I improved the yield model.`

### What happens step by step
1. The system tries to recall prior context for the student.

2. The memory layer checks stored transcript history, summaries, and skill signals in SQLite.

3. The recall works mostly through structured fields and keyword matching, not true embedding-based semantic search.

4. If the older session used different wording like:
   - `maize yield prediction`
   - `Bayer data pipeline`
   - `weather feature engineering`
   then the recall may not strongly connect that to the student’s newer phrasing.

5. The system may pull only partial context or miss the best prior session entirely.

6. The next question is still generated, but it may sound more generic than the student expects.

### Where the gap is
- memory is persisted and layered
- recall is not yet a real vector-store semantic retrieval system
- the system can remember a lot, but it cannot always find the best match intelligently

### Final output
- prior history exists in the database
- the system still may not retrieve the most relevant prior experience cleanly
- personalization can feel weaker than the stored data suggests

## Failure Scenario 4: Model Outage Causes a Noticeable Quality Drop

### Example
The app is configured to use a live model, but the provider starts returning quota or upstream errors during an interview.

### What happens step by step
1. The student submits an answer.

2. The backend calls the model for the next question and for evaluation.

3. The provider returns an error.
   Example:
   - quota exceeded
   - invalid model access
   - temporary upstream outage

4. The adapter catches the failure and switches to deterministic fallback logic.

5. The session continues, but the tone and quality can change noticeably.
   Instead of a nuanced role-aware follow-up, the student may get a safer question-bank prompt and a more rigid fallback evaluation.

6. The app survives, but the “AI coach” experience is clearly weaker than intended.

### Where the gap is
- fallback keeps the product usable
- it does not match the quality of a working live model
- the system handles the outage, but not invisibly

### Final output
- the interview does not crash
- the experience degrades in a way the user may notice
- this is a resilience win, but still a real capability gap

## Failure Scenario 5: Self-Critique Does Not Fully Close the Loop Yet

### Example
The evaluator repeatedly says a student needs to quantify impact better, but future sessions still do not adapt as sharply as they should.

### What happens step by step
1. The student completes a session.

2. The evaluator produces the normal scorecard plus a self-critique note.
   Example:
   `The answer would be stronger with clearer metrics and a sharper Result section.`

3. That note is stored with the evaluation output.

4. In later sessions, the system does use long-term memory and weak-skill tracking.
   So some personalization is happening.

5. But there is not yet a dedicated closed-loop strategy that says:
   - because this self-critique appeared three times,
   - the next session should explicitly pressure-test quantified impact,
   - and the question plan should change in a targeted way

6. So the self-critique is helpful as feedback, but not yet fully operationalized as a planning signal.

### Where the gap is
- self-critique exists
- memory exists
- the bridge from self-critique to future interview strategy is still only partial

### Final output
- the student sees the insight
- some weak-skill personalization still happens
- the full “AI learns from its own coaching pattern” loop is not finished yet

## Why These Scenarios Matter
These examples show that the project is not just generating questions. It is:
- storing context
- making decisions based on that context
- evaluating answers
- handling bad inputs and model failures
- exposing where the current architecture is still incomplete
- showing the difference between a working MVP and a fully mature production system

That is the part that makes it feel like an actual AI system instead of a static interview form.
