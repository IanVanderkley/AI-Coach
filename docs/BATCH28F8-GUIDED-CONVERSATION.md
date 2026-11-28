# Batch 28F.8 / 28G.1 — Training audit and guided conversation

Baseline: d65378f; 1,235 local tests and build passed before this patch. This is a source audit and isolated regression run, not a deployment or full browser security test.

## Training

- Generic training history is browser-local, shared with anyone using that browser, restricted to the nine catalog IDs, result and bounded assistance level. No account IDs, replay references, mine layouts, or personalized attempts are persisted. The 60-attempt limit and reset confirmation remain in effect. No changes to XP, Elo, Practice history, or ranked results.
- Whole visible snapshots are validated and exact component enumeration must complete with nonzero compatible layouts; conflicting rule proofs are rejected. Existing flags remain marks rather than evidence. Personalized exercises run on explicit request, check at most four candidate mistakes, and return at most three verified exercises. No new solver call in hints or grading.
- For an unnecessary-guess chord, require an uncertain covered neighbour, no proven mine among the opened neighbours, and a guaranteed-safe alternative outside the chord. Skip exact-safe and proven-mine chords rather than teaching them as uncertain choices. Personalized exercise titles use the replay's displayed move number while retaining raw stable IDs.
- Remember displayed hints and already exposed answers within the current training workspace, across retries and navigation. An incorrect classification answer explains the correct classification; subsequent attempts in the same workspace count as assisted. Persist the original bounded `hints` field (3 also means an answer was shown). Existing history is not rewritten. Refreshing or reopening the workspace can reset the transient exposure state: this is a practice indicator, not independent mastery evidence.

## Guided conversation (28G.1)

- Tailor the example questions to the selected verified move and offer a short explanation using only its recorded finding and approved next step. No new question-intent enum, endpoint, external provider call, hidden-board access, or database write.
- Format response coordinates as row/column names. Clear a draft when the move selection changes. Redirect explicit coordinate questions to replay's square inspection, and reject mismatched move references. Keep the existing question-length, unsupported probability/hypothetical, selected-moment and bounded 12-answer thread behavior. Free-text recognition remains limited keyword-based routing, not general conversational AI. Practice conversations retain existing tab-local persistence; Ranked conversations stay in review memory. No new conversation storage or account synchronization.

## Verification and limitations

11 new tests passed, 302 combined isolated tests passed (one legacy shared-analysis test file excluded because its dependencies are not present in the fixture). Core type checking at ES2017 and TSX syntax checks passed. The four modified source files were matched to the pushed GitHub blobs. Full local npm test, TypeScript, build and browser smoke checks are required. No remote writes or deployment.
