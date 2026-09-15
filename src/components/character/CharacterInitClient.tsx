"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { loadRoster, upsertRosterEntry } from "@/lib/rosterStorage";
import { ACTIVE_ARCHETYPES } from "@/training/catalog";
import type { CharacterInitData } from "@/training/characterInitData";
import {
  alignmentQuestionsFor,
  definingExperienceFromQuiz,
  resolveAlignmentFromQuiz,
  type AlignQuizAnswer,
  type DefiningExperience,
  type ResolvedAlignment,
} from "@/training/definingExperience";
import {
  computeRaceTotals,
  computeSuggestion,
  type RaceQuizAnswer,
} from "@/training/raceQuiz";
import type { Character } from "@/training/types";

/** Debug: show quiz option weights under each answer. */
const DEBUG_SHOW_WEIGHTS = true;

type Screen =
  | "entry"
  | "quiz"
  | "pick"
  | "confirm"
  | "subrace"
  | "racial"
  | "align-entry"
  | "align-quiz"
  | "align-pick"
  | "align-confirm";

type RaceRecord = CharacterInitData["races"][number];
type AlignmentRecord = CharacterInitData["alignments"][number];

type SubracePick = { subraceId: string; label: string } | null;
type RacialPick = {
  prompt: string;
  optionId: string;
  label: string;
} | null;

type Draft = {
  raceId: string | null;
  tookQuiz: boolean;
  suggestedId: string | null;
  quizAnswers: RaceQuizAnswer[];
  subrace: SubracePick;
  racialChoice: RacialPick;
  alignment: {
    tookQuiz: boolean;
    answers: AlignQuizAnswer[];
    resolved: ResolvedAlignment | null;
    alignmentId: string | null;
    definingExperience: DefiningExperience | null;
  };
};

type Ui = {
  screen: Screen;
  quizStep: number;
  alignStep: number;
  expandedId: string | null;
};

const INITIAL_DRAFT: Draft = {
  raceId: null,
  tookQuiz: false,
  suggestedId: null,
  quizAnswers: [],
  subrace: null,
  racialChoice: null,
  alignment: {
    tookQuiz: false,
    answers: [],
    resolved: null,
    alignmentId: null,
    definingExperience: null,
  },
};

const INITIAL_UI: Ui = {
  screen: "entry",
  quizStep: 0,
  alignStep: 0,
  expandedId: null,
};

function formatSigned(n: number): string {
  const v = Number(n) || 0;
  return (v > 0 ? "+" : "") + v;
}

function formatRaceWeights(
  w: Record<string, number | undefined> | undefined,
): string {
  if (!w || typeof w !== "object") return "";
  return Object.entries(w)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([k, v]) => `${k} ${formatSigned(v)}`)
    .join(" · ");
}

function formatAlignWeights(o: {
  law?: number;
  good?: number;
  track?: string;
}): string {
  const parts: string[] = [];
  if (o.law != null) parts.push(`law ${formatSigned(o.law)}`);
  if (o.good != null) parts.push(`good ${formatSigned(o.good)}`);
  if (o.track) parts.push(`track ${o.track}`);
  return parts.join(" · ");
}

function pickRandom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function TownSquareCrumb() {
  return (
    <div className="world-crumb" aria-label="Location">
      <span>Town Gate</span>
      {" / "}
      <span>Walled City</span>
      {" / "}
      <Link href="/">Town Square</Link>
      {" / "}
      <span>Welcome a Stranger</span>
    </div>
  );
}

function WeightLine({ text }: { text: string }) {
  if (!DEBUG_SHOW_WEIGHTS || !text) return null;
  return <span className="option-weights">{text}</span>;
}

export function CharacterInitClient({ init }: { init: CharacterInitData }) {
  const router = useRouter();
  const { races, raceQuestions, alignments } = init;

  const [ui, setUi] = useState<Ui>(INITIAL_UI);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const raceById = useCallback(
    (id: string | null | undefined): RaceRecord | undefined =>
      races.find((r) => r.id === id),
    [races],
  );

  const alignmentById = useCallback(
    (id: string | null | undefined): AlignmentRecord | undefined =>
      alignments.find((a) => a.id === id),
    [alignments],
  );

  const raceIds = races.map((r) => r.id);

  const goAlignEntry = () => {
    setUi((u) => ({ ...u, screen: "align-entry" }));
  };

  const createRandomArchetype = async () => {
    if (busy) return;
    setBusy(true);
    const roster = loadRoster();
    const race = pickRandom(races);
    const align = pickRandom(alignments);
    const archetype = pickRandom(ACTIVE_ARCHETYPES);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId: race.id,
          alignmentId: align.id,
          archetype,
          taken: roster.map((e) => e.name).filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        character?: Character;
        error?: string;
      };
      if (!res.ok || !data.character) {
        throw new Error(data.error || "Could not generate character");
      }
      upsertRosterEntry(data.character);
      router.push("/");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Random create failed");
      setBusy(false);
    }
  };

  const finishCompanion = async () => {
    if (busy || !draft.raceId || !draft.alignment.alignmentId) return;
    setBusy(true);
    const roster = loadRoster();
    try {
      const res = await fetch("/api/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId: draft.raceId,
          alignmentId: draft.alignment.alignmentId,
          subrace: draft.subrace || null,
          definingExperience: draft.alignment.definingExperience || null,
          taken: roster.map((e) => e.name).filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        companion?: Character;
        error?: string;
      };
      if (!res.ok || !data.companion) {
        throw new Error(data.error || "Could not create companion");
      }
      upsertRosterEntry(data.companion);
      router.push("/");
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : "Could not create companion",
      );
      setBusy(false);
    }
  };

  const confirmAlignment = async (alignmentId: string) => {
    setDraft((d) => ({
      ...d,
      alignment: { ...d.alignment, alignmentId },
    }));

    if (draft.alignment.tookQuiz) {
      setUi((u) => ({ ...u, screen: "align-confirm" }));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/defining-experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alignmentId,
          raceId: draft.raceId,
        }),
      });
      const data = (await res.json()) as {
        definingExperience?: DefiningExperience | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not pick defining experience");
      }
      setDraft((d) => ({
        ...d,
        alignment: {
          ...d.alignment,
          alignmentId,
          definingExperience: data.definingExperience ?? null,
        },
      }));
    } catch (err) {
      console.warn("Defining experience pick failed.", err);
      setDraft((d) => ({
        ...d,
        alignment: {
          ...d.alignment,
          alignmentId,
          definingExperience: null,
        },
      }));
      showToast(
        err instanceof Error ? err.message : "Defining experience failed",
      );
    } finally {
      setBusy(false);
      setUi((u) => ({ ...u, screen: "align-confirm" }));
    }
  };

  const onBack = () => {
    const { screen, quizStep, alignStep } = ui;
    if (screen === "quiz") {
      if (quizStep > 0) setUi((u) => ({ ...u, quizStep: u.quizStep - 1 }));
      else setUi((u) => ({ ...u, screen: "entry" }));
    } else if (screen === "pick") {
      setUi((u) => ({ ...u, screen: "entry" }));
    } else if (screen === "racial") {
      const r = raceById(draft.raceId);
      setUi((u) => ({
        ...u,
        screen: r && "subraces" in r && r.subraces ? "subrace" : "confirm",
      }));
    } else if (screen === "subrace") {
      setUi((u) => ({ ...u, screen: "confirm" }));
    } else if (screen === "align-quiz") {
      if (alignStep > 0) setUi((u) => ({ ...u, alignStep: u.alignStep - 1 }));
      else setUi((u) => ({ ...u, screen: "align-entry" }));
    } else if (screen === "align-pick") {
      setUi((u) => ({ ...u, screen: "align-entry", expandedId: null }));
    }
  };

  let screenBody: ReactNode = null;

  if (ui.screen === "entry") {
    screenBody = (
      <div className="screen entry">
        <p className="kicker">Character creation</p>
        <h1>Tell us who you are.</h1>
        <p className="lede">
          Answer a few questions, or go straight to the list. Nothing is final
          until you confirm it.
        </p>
        <div className="choice-list">
          <button
            type="button"
            className="choice-card"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                tookQuiz: true,
                quizAnswers: [],
                suggestedId: null,
              }));
              setUi((u) => ({ ...u, screen: "quiz", quizStep: 0 }));
            }}
          >
            <span className="choice-title">Answer a few questions</span>
            <span className="choice-sub">
              A handful of instinct calls. We&apos;ll suggest a race, you still
              choose.
            </span>
          </button>
          <button
            type="button"
            className="choice-card"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                tookQuiz: false,
                quizAnswers: [],
                suggestedId: null,
              }));
              setUi((u) => ({ ...u, screen: "pick", expandedId: null }));
            }}
          >
            <span className="choice-title">Choose your race</span>
            <span className="choice-sub">Skip ahead to the full list.</span>
          </button>
          <button
            type="button"
            className="choice-card"
            disabled={busy}
            onClick={() => void createRandomArchetype()}
          >
            <span className="choice-title">Random archetype</span>
            <span className="choice-sub">
              Instant companion — random race, alignment, and class with starter
              features.
            </span>
          </button>
          <button type="button" className="choice-card is-locked" disabled>
            <span className="choice-title">Describe your character</span>
            <span className="choice-sub">Free text intake. Not open yet.</span>
          </button>
        </div>
      </div>
    );
  } else if (ui.screen === "quiz") {
    const step = ui.quizStep;
    const q = raceQuestions[step]!;
    const answered = draft.quizAnswers[step];
    const chosen = answered ? answered.optionIndex : null;
    screenBody = (
      <div className="screen quiz">
        <div className="topbar">
          <button type="button" className="back" onClick={onBack}>
            &#8249; Back
          </button>
          <span className="progress">
            {step + 1} of {raceQuestions.length}
          </span>
        </div>
        <h2>{q.text}</h2>
        <div className="option-list">
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              className={`option ${chosen === i ? "chosen" : ""}`}
              onClick={() => {
                const nextAnswers = [...draft.quizAnswers];
                nextAnswers[step] = {
                  question: q.text,
                  optionIndex: i,
                  optionLabel: o.label,
                };
                if (step < raceQuestions.length - 1) {
                  setDraft((d) => ({ ...d, quizAnswers: nextAnswers }));
                  setUi((u) => ({ ...u, quizStep: u.quizStep + 1 }));
                } else {
                  const suggestedId = computeSuggestion(
                    raceIds,
                    raceQuestions,
                    nextAnswers,
                  );
                  setDraft((d) => ({
                    ...d,
                    quizAnswers: nextAnswers,
                    suggestedId,
                  }));
                  setUi((u) => ({
                    ...u,
                    screen: "pick",
                    expandedId: null,
                  }));
                }
              }}
            >
              <span className="option-main">{o.label}</span>
              <WeightLine text={formatRaceWeights(o.w)} />
            </button>
          ))}
        </div>
        <div className="ticks">
          {raceQuestions.map((_, i) => (
            <span
              key={i}
              className={`tick ${i <= step ? "filled" : ""}`}
            />
          ))}
        </div>
      </div>
    );
  } else if (ui.screen === "pick") {
    const suggestedId = draft.suggestedId;
    const suggestedName = suggestedId
      ? raceById(suggestedId)?.name
      : null;
    const totals = computeRaceTotals(
      raceIds,
      raceQuestions,
      draft.quizAnswers,
    );
    screenBody = (
      <div className="screen pick">
        <div className="topbar">
          <button type="button" className="back" onClick={onBack}>
            &#8249; Back
          </button>
          <span className="progress">Choose your race</span>
        </div>
        {suggestedName ? (
          <p className="suggestion">
            Based on your answers: <strong>{suggestedName}</strong>. Still your
            call.
          </p>
        ) : null}
        <div className="race-list">
          {races.map((r) => {
            const open = ui.expandedId === r.id;
            const total = totals[r.id] || 0;
            return (
              <div
                key={r.id}
                className={`race-row ${open ? "is-open" : ""}`}
              >
                <button
                  type="button"
                  className="race-head"
                  onClick={() =>
                    setUi((u) => ({
                      ...u,
                      expandedId: u.expandedId === r.id ? null : r.id,
                    }))
                  }
                >
                  <span className="race-name-wrap">
                    <span className="race-name">{r.name}</span>
                    {DEBUG_SHOW_WEIGHTS && total !== 0 ? (
                      <span className="option-weights">
                        {formatSigned(total)}
                      </span>
                    ) : null}
                  </span>
                  {suggestedId === r.id ? (
                    <span className="tag">Suggested</span>
                  ) : null}
                  <span className="chev">{open ? "−" : "+"}</span>
                </button>
                <div className="race-body">
                  <div className="race-body-inner">
                    <p>{r.flavor}</p>
                    <button
                      type="button"
                      className="confirm-btn"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          raceId: r.id,
                          subrace: null,
                          racialChoice: null,
                        }));
                        setUi((u) => ({ ...u, screen: "confirm" }));
                      }}
                    >
                      Choose {r.name}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (ui.screen === "confirm") {
    const r = raceById(draft.raceId);
    if (!r) {
      screenBody = (
        <div className="screen">
          <p className="lede">Race missing — go back and choose again.</p>
        </div>
      );
    } else {
      screenBody = (
        <div className="screen confirm">
          <div className="seal-wrap">
            <div className="seal">Enlisted</div>
          </div>
          <p className="kicker">Race confirmed</p>
          <h1>{r.name}</h1>
          <p className="lede">{r.flavor}</p>
          <p className="note">
            Whatever this choice leans you toward on Defense, Attack, Divine, or
            Arcane will show up at the training ground, once there are points to
            spend.
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              onClick={() => setUi((u) => ({ ...u, screen: "pick" }))}
            >
              Change race
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                const hasSub =
                  "subraces" in r &&
                  Array.isArray(r.subraces) &&
                  r.subraces.length > 0;
                setUi((u) => ({
                  ...u,
                  screen: hasSub ? "subrace" : "racial",
                }));
              }}
            >
              Continue
            </button>
          </div>
        </div>
      );
    }
  } else if (ui.screen === "subrace") {
    const r = raceById(draft.raceId);
    const subraces =
      r && "subraces" in r && Array.isArray(r.subraces) ? r.subraces : [];
    const picked = draft.subrace;
    const anyUnsourced = subraces.some((s) => !s.sourced);
    screenBody = (
      <div className="screen racial">
        <div className="topbar">
          <button type="button" className="back" onClick={onBack}>
            &#8249; Back
          </button>
          <span className="progress">{r?.name}</span>
        </div>
        <h2>
          What kind of {r?.name.toLowerCase()} were you raised as?
        </h2>
        <div className="option-list">
          {subraces.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option ${
                picked && picked.subraceId === s.id ? "chosen" : ""
              }`}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  subrace: { subraceId: s.id, label: s.label },
                }))
              }
            >
              <span className="option-main">
                {s.label}
                {!s.sourced ? (
                  <span className="unsourced-mark"> *</span>
                ) : null}
              </span>
              <span className="option-blurb">{s.blurb}</span>
            </button>
          ))}
        </div>
        {anyUnsourced ? (
          <p className="mechanic-note">
            * invented for this build, not from the SRD.
          </p>
        ) : null}
        <div className="confirm-actions">
          <button
            type="button"
            className="primary"
            disabled={!picked}
            onClick={() => setUi((u) => ({ ...u, screen: "racial" }))}
          >
            Continue
          </button>
        </div>
      </div>
    );
  } else if (ui.screen === "racial") {
    const r = raceById(draft.raceId);
    const d = r?.racialDetail;
    if (!r || !d) {
      screenBody = (
        <div className="screen">
          <p className="lede">Racial detail missing.</p>
          <button type="button" className="primary" onClick={goAlignEntry}>
            Continue
          </button>
        </div>
      );
    } else if (d.type === "reveal") {
      screenBody = (
        <div className="screen racial">
          <div className="topbar">
            <button type="button" className="back" onClick={onBack}>
              &#8249; Back
            </button>
            <span className="progress">{r.name}</span>
          </div>
          <h2>{d.prompt}</h2>
          <p className="lede">{"text" in d ? d.text : null}</p>
          <p className="mechanic-note">{d.mechanicNote}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="primary"
              onClick={goAlignEntry}
            >
              Continue
            </button>
          </div>
        </div>
      );
    } else {
      const options = "options" in d && Array.isArray(d.options) ? d.options : [];
      const picked = draft.racialChoice;
      screenBody = (
        <div className="screen racial">
          <div className="topbar">
            <button type="button" className="back" onClick={onBack}>
              &#8249; Back
            </button>
            <span className="progress">{r.name}</span>
          </div>
          <h2>{d.prompt}</h2>
          <div className="option-list">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`option ${
                  picked && picked.optionId === o.id ? "chosen" : ""
                }`}
                onClick={() =>
                  setDraft((d0) => ({
                    ...d0,
                    racialChoice: {
                      prompt: d.prompt,
                      optionId: o.id,
                      label: o.label,
                    },
                  }))
                }
              >
                <span className="option-main">{o.label}</span>
                <span className="option-blurb">{o.blurb}</span>
              </button>
            ))}
          </div>
          <p className="mechanic-note">{d.mechanicNote}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="primary"
              disabled={!picked}
              onClick={goAlignEntry}
            >
              Continue
            </button>
          </div>
        </div>
      );
    }
  } else if (ui.screen === "align-entry") {
    screenBody = (
      <div className="screen entry">
        <p className="kicker">What you grew up into</p>
        <h1>Some of it was decided before you had a say.</h1>
        <p className="lede">
          Six things that happened to you as a child, and what you did about
          them. Or skip ahead and say plainly who you turned out to be.
        </p>
        <div className="choice-list">
          <button
            type="button"
            className="choice-card"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                alignment: {
                  ...d.alignment,
                  tookQuiz: true,
                  answers: [],
                  resolved: null,
                },
              }));
              setUi((u) => ({ ...u, screen: "align-quiz", alignStep: 0 }));
            }}
          >
            <span className="choice-title">Walk through your childhood</span>
            <span className="choice-sub">
              Six scenes. One becomes the thing you&apos;re still carrying.
            </span>
          </button>
          <button
            type="button"
            className="choice-card"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                alignment: {
                  ...d.alignment,
                  tookQuiz: false,
                  answers: [],
                  resolved: null,
                  definingExperience: null,
                },
              }));
              setUi((u) => ({
                ...u,
                screen: "align-pick",
                expandedId: null,
              }));
            }}
          >
            <span className="choice-title">Choose your alignment</span>
            <span className="choice-sub">Straight to the nine.</span>
          </button>
        </div>
      </div>
    );
  } else if (ui.screen === "align-quiz") {
    const questions = alignmentQuestionsFor(draft.raceId);
    const step = ui.alignStep;
    const q = questions[step]!;
    const answered = draft.alignment.answers[step];
    screenBody = (
      <div className="screen quiz">
        <div className="topbar">
          <button type="button" className="back" onClick={onBack}>
            &#8249; Back
          </button>
          <span className="progress">
            {step + 1} of {questions.length}
          </span>
        </div>
        <h2>{q.text}</h2>
        <div className="option-list">
          {q.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`option ${
                answered && answered.optionId === o.id ? "chosen" : ""
              }`}
              onClick={() => {
                const nextAnswers = [...draft.alignment.answers];
                nextAnswers[step] = {
                  questionId: q.id,
                  optionId: o.id,
                  label: o.label,
                };
                if (step < questions.length - 1) {
                  setDraft((d) => ({
                    ...d,
                    alignment: { ...d.alignment, answers: nextAnswers },
                  }));
                  setUi((u) => ({ ...u, alignStep: u.alignStep + 1 }));
                } else {
                  const resolved = resolveAlignmentFromQuiz(
                    draft.raceId,
                    nextAnswers,
                  );
                  const exp = definingExperienceFromQuiz(
                    draft.raceId,
                    nextAnswers,
                  );
                  setDraft((d) => ({
                    ...d,
                    alignment: {
                      ...d.alignment,
                      answers: nextAnswers,
                      resolved,
                      definingExperience: exp,
                    },
                  }));
                  setUi((u) => ({
                    ...u,
                    screen: "align-pick",
                    expandedId: resolved.alignmentId,
                  }));
                }
              }}
            >
              <span className="option-main">{o.label}</span>
              <WeightLine text={formatAlignWeights(o)} />
            </button>
          ))}
        </div>
        <div className="ticks">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`tick ${i <= step ? "filled" : ""}`}
            />
          ))}
        </div>
      </div>
    );
  } else if (ui.screen === "align-pick") {
    const resolved = draft.alignment.resolved;
    const suggestedId = resolved ? resolved.alignmentId : null;
    const open = ui.expandedId ? alignmentById(ui.expandedId) : null;
    screenBody = (
      <div className="screen pick">
        <div className="topbar">
          <button type="button" className="back" onClick={onBack}>
            &#8249; Back
          </button>
          <span className="progress">Choose your alignment</span>
        </div>
        {suggestedId ? (
          <p className="suggestion">
            Where your childhood put you:{" "}
            <strong>{alignmentById(suggestedId)?.name}</strong>. Still your
            call.
          </p>
        ) : null}
        <div className="align-grid">
          {alignments.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`align-cell ${
                suggestedId === a.id ? "is-suggested" : ""
              } ${ui.expandedId === a.id ? "is-open" : ""}`}
              onClick={() =>
                setUi((u) => ({
                  ...u,
                  expandedId: u.expandedId === a.id ? null : a.id,
                }))
              }
            >
              <span className="align-name">{a.name}</span>
            </button>
          ))}
        </div>
        {open ? (
          <div className="align-detail">
            <p>{open.flavor}</p>
            <button
              type="button"
              className="confirm-btn"
              disabled={busy}
              onClick={() => void confirmAlignment(open.id)}
            >
              Choose {open.name}
            </button>
          </div>
        ) : (
          <p className="mechanic-note">Tap any of the nine to read it.</p>
        )}
      </div>
    );
  } else if (ui.screen === "align-confirm") {
    const a = alignmentById(draft.alignment.alignmentId);
    const exp = draft.alignment.definingExperience;
    const r = raceById(draft.raceId);
    screenBody = (
      <div className="screen confirm">
        <p className="kicker">Who you turned out to be</p>
        <h1>
          {a?.name} {r?.name}
        </h1>
        <p className="lede">{a?.flavor}</p>
        {exp ? (
          <>
            <div className="experience">
              <p className="experience-scene">{exp.scenario}</p>
              <p className="experience-answer">{exp.label}</p>
            </div>
            <p className="mechanic-note">
              That one stayed with you. It follows you into training.
            </p>
          </>
        ) : null}
        <div className="confirm-actions">
          <button
            type="button"
            onClick={() =>
              setUi((u) => ({
                ...u,
                expandedId: draft.alignment.alignmentId,
                screen: "align-pick",
              }))
            }
          >
            Change
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void finishCompanion()}
          >
            Enter the town square
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="app">
        <div className="hub">
          <div className="hub-body">
            <TownSquareCrumb />
            {screenBody}
          </div>
        </div>
        <div className={`toast${toast ? " show" : ""}`}>
          {toast ?? ""}
        </div>
      </div>
    </div>
  );
}
