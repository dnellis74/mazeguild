"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getRosterEntry,
  upsertRosterEntry,
} from "@/lib/rosterStorage";
import { jobProgress } from "@/training/view";
import type {
  JobView,
  SheetView,
  TrainingView,
  WorldView,
} from "@/training/view";
import type { Character, TrainingAction, TrainingUi } from "@/training/types";

function defaultUi(tab: "sheet" | "world" = "sheet"): TrainingUi {
  return {
    hubTab: tab,
    worldView: "areas",
    worldArea: null,
    worldBuilding: null,
    worldRoom: null,
    pendingChoice: null,
    originDraft: null,
  };
}

export function TrainingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const characterId = params.get("id") || "";
  const initialTab =
    params.get("tab") === "world" ? ("world" as const) : ("sheet" as const);

  const [entryId, setEntryId] = useState(characterId);
  const [displayName, setDisplayName] = useState("Companion");
  const [character, setCharacter] = useState<Character | null>(null);
  const [ui, setUi] = useState<TrainingUi>(() => defaultUi(initialTab));
  const [view, setView] = useState<TrainingView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [originDraft, setOriginDraft] = useState("");

  const persist = useCallback(
    (ch: Character) => {
      if (!entryId) return;
      upsertRosterEntry({
        id: entryId,
        displayName,
        character: ch,
      });
    },
    [entryId, displayName],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const apiView = useCallback(
    async (ch: Character, nextUi: TrainingUi) => {
      const res = await fetch("/api/training/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: ch, ui: nextUi }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirect) {
          router.replace(data.redirect);
          return null;
        }
        throw new Error(data.error || "View failed");
      }
      setCharacter(data.character);
      setUi(data.ui);
      setView(data.view);
      persist(data.character);
      if (data.view?.sheet?.originStory?.text != null && nextUi.hubTab === "sheet") {
        setOriginDraft(data.ui.originDraft ?? data.view.sheet.originStory.text);
      }
      return data;
    },
    [persist, router],
  );

  const apiAction = useCallback(
    async (action: TrainingAction) => {
      if (!character) return;
      const res = await fetch("/api/training/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character, ui, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirect) {
          router.replace(data.redirect);
          return;
        }
        throw new Error(data.error || "Action failed");
      }
      if (data.navigate) {
        const href = String(data.navigate).replaceAll(
          "{id}",
          encodeURIComponent(entryId),
        );
        if (href.endsWith(".html") || href.includes(".html?")) {
          window.location.href = href;
          return;
        }
        router.push(href);
        return;
      }
      setCharacter(data.character);
      setUi(data.ui);
      setView(data.view);
      persist(data.character);
      if (data.toast) showToast(data.toast);
      if (data.view?.sheet?.originStory && data.ui.hubTab === "sheet") {
        setOriginDraft(data.ui.originDraft ?? data.view.sheet.originStory.text);
      }
    },
    [character, ui, persist, router, showToast, entryId],
  );

  useEffect(() => {
    if (!characterId) {
      router.replace("/");
      return;
    }
    try {
      const entry = getRosterEntry(characterId);
      if (!entry) {
        router.replace("/");
        return;
      }
      setEntryId(entry.id);
      setDisplayName(entry.displayName);
      setCharacter(entry.character);
      const bootUi = defaultUi(initialTab);
      void apiView(entry.character, bootUi).catch((err) => {
        setBootError(String(err?.message || err));
      });
    } catch (err) {
      setBootError(String(err instanceof Error ? err.message : err));
    }
    // boot once per id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  useEffect(() => {
    if (!character?.activeJob) return;
    const id = window.setInterval(() => {
      const job = character.activeJob;
      if (!job) return;
      const progress = jobProgress(job);
      if (progress?.done) {
        window.clearInterval(id);
        void apiAction({ type: "complete-job" }).catch((err) =>
          showToast(String(err?.message || err)),
        );
        return;
      }
      if (progress) {
        setView((v) => (v ? { ...v, job: progress } : v));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [character?.activeJob, apiAction, showToast]);

  const backToSquare = () => router.push("/");

  if (bootError) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <p className="lede">Could not load training.</p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                color: "var(--ink-soft)",
              }}
            >
              {bootError}
            </pre>
            <p className="mechanic-note">
              <button type="button" onClick={backToSquare}>
                Town Square
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!view || !character) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <p className="lede">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const liveJob =
    character.activeJob && view.tab === "world"
      ? jobProgress(character.activeJob)
      : view.job;

  return (
    <div className="stage">
      <div className="app">
        <div className="hub">
          <div className="hub-header">
            <p className="kicker">{displayName}</p>
            <h1>{view.header.title}</h1>
            <p className="hub-meta">
              {view.header.featurePoints} feature point
              {view.header.featurePoints === 1 ? "" : "s"} left ·{" "}
              <button
                type="button"
                onClick={backToSquare}
                style={{ textDecoration: "underline", color: "var(--ink-soft)" }}
              >
                Town Square
              </button>
            </p>
          </div>

          <div className="hub-tabs" role="tablist">
            {(
              [
                ["sheet", "Sheet"],
                ["world", "World"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`hub-tab ${view.tab === tab ? "is-active" : ""}`}
                onClick={() =>
                  void apiAction({ type: "hub-tab", tab }).catch((e) =>
                    showToast(String(e.message || e)),
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hub-body">
            {view.pending ? (
              <PendingPanel
                pending={view.pending}
                onAction={(a) =>
                  void apiAction(a).catch((e) => showToast(String(e.message || e)))
                }
              />
            ) : view.tab === "sheet" && view.sheet ? (
              <SheetPanel
                sheet={view.sheet}
                originDraft={originDraft}
                onOriginChange={setOriginDraft}
                onSave={() =>
                  void apiAction({
                    type: "save-origin-story",
                    text: originDraft,
                  }).catch((e) => showToast(String(e.message || e)))
                }
                onReset={() =>
                  void apiAction({ type: "reset-origin-prompt" }).catch((e) =>
                    showToast(String(e.message || e)),
                  )
                }
              />
            ) : view.tab === "world" && view.world ? (
              <WorldPanel
                world={view.world}
                unlockNote={view.unlockNote}
                job={liveJob}
                onAction={(a) =>
                  void apiAction(a).catch((e) => showToast(String(e.message || e)))
                }
              />
            ) : null}
          </div>
        </div>
        {toast ? <div className="toast show">{toast}</div> : <div className="toast" />}
      </div>
    </div>
  );
}

function PendingPanel({
  pending,
  onAction,
}: {
  pending: NonNullable<TrainingView["pending"]>;
  onAction: (a: TrainingAction) => void;
}) {
  if (pending.type === "favored-enemy") {
    return (
      <div className="feature-choice">
        <button type="button" className="back" onClick={() => onAction({ type: "cancel-choice" })}>
          ← Back
        </button>
        <p className="kicker">Favored Enemy</p>
        <h2>Choose your quarry</h2>
        <p className="lede" style={{ marginTop: 8 }}>
          Three quarries offer themselves.
        </p>
        <div className="choice-list">
          {pending.options.map((enemy) => (
            <button
              key={enemy}
              type="button"
              className="choice-card"
              onClick={() => onAction({ type: "confirm-favored-enemy", enemy })}
            >
              <span className="choice-title">{enemy}</span>
              <span className="choice-sub">Study this as your favored enemy</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const kind = pending.type;
  return (
    <div className="feature-choice">
      <button type="button" className="back" onClick={() => onAction({ type: "cancel-choice" })}>
        ← Back
      </button>
      <p className="kicker">
        {pending.archetype} {kind === "cantrip" ? "cantrips" : "1st-level spells"}
      </p>
      <h2>Choose a {kind}</h2>
      <p className="lede" style={{ marginTop: 8 }}>
        {pending.owned} of {pending.allowance} known · pick {pending.remaining} more.
      </p>
      <div className="choice-list">
        {pending.options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            className="choice-card"
            onClick={() =>
              onAction(
                kind === "cantrip"
                  ? { type: "confirm-cantrip", cantripId: o.id }
                  : { type: "confirm-spell", spellId: o.id },
              )
            }
          >
            <span className="choice-title">{o.name}</span>
            <span className="choice-sub">{o.description || ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SheetPanel({
  sheet,
  originDraft,
  onOriginChange,
  onSave,
  onReset,
}: {
  sheet: SheetView;
  originDraft: string;
  onOriginChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="sheet-block">
        <div className="sheet-label">Identity</div>
        <div className="sheet-value">{sheet.identity.value}</div>
        <div className="sheet-sub">{sheet.identity.sub}</div>
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Feature points</div>
        <div className="points-pill">
          <strong>{sheet.featurePoints}</strong> of 2 remaining
        </div>
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Abilities</div>
        <div className="ability-grid">
          {sheet.abilities.map((a) => (
            <div key={a.ab} className="ability-cell">
              <div className="ab">{a.ab}</div>
              <div className="sc">{a.score}</div>
              <div className="mod">{a.mod}</div>
            </div>
          ))}
        </div>
        <p className="mechanic-note" style={{ marginTop: 10 }}>
          {sheet.abilitiesNote}
        </p>
      </div>
      {sheet.definingExperience ? (
        <div className="sheet-block">
          <div className="sheet-label">Defining experience</div>
          <div className="sheet-value">{sheet.definingExperience.scenario}</div>
          <div className="sheet-sub">{sheet.definingExperience.reaction}</div>
        </div>
      ) : null}
      <div className="sheet-block">
        <div className="sheet-label">Features</div>
        {sheet.features.length ? (
          <div className="feature-list">
            {sheet.features.map((f, i) => (
              <div key={`${f.name}-${i}`} className="feature-card">
                <div className="name">
                  {f.name}
                  {f.detail ? `: ${f.detail}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">No features yet. Spend time in the World to earn them.</p>
        )}
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Archetypes drawn from</div>
        {sheet.archetypes.length ? (
          <div className="archetype-summary">
            <div className="from">
              {sheet.archetypes.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-note">
            Archetypes appear from the features you earn — up to two draws.
          </p>
        )}
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Cantrips</div>
        {sheet.cantrips.length ? (
          <div className="feature-list">
            {sheet.cantrips.map((c) => (
              <div key={c.name} className="feature-card">
                <div className="name">{c.name}</div>
                <div className="from">{c.from}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            Cantrips appear once an archetype grants them — half now, the rest with full
            spellcasting.
          </p>
        )}
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Spells</div>
        {sheet.spells.length ? (
          <div className="feature-list">
            {sheet.spells.map((s) => (
              <div key={s.name} className="feature-card">
                <div className="name">{s.name}</div>
                <div className="from">{s.from}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            1st-level spells unlock when you learn spellcasting or pact magic.
          </p>
        )}
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Origin story</div>
        <p className="mechanic-note" style={{ marginTop: 0, marginBottom: 10 }}>
          {sheet.originStory.hint}
        </p>
        <textarea
          className="origin-story"
          rows={8}
          value={originDraft}
          onChange={(e) => onOriginChange(e.target.value)}
        />
        <div className="origin-actions">
          <button type="button" className="primary" onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onReset}>
            Reset to prompt
          </button>
        </div>
      </div>
    </>
  );
}

function WorldPanel({
  world,
  unlockNote,
  job,
  onAction,
}: {
  world: WorldView;
  unlockNote: string;
  job: JobView | null;
  onAction: (a: TrainingAction) => void;
}) {
  return (
    <>
      <div className="world-crumb">
        {world.crumb.map((c, i) => (
          <span key={`${c.label}-${i}`}>
            {i ? " / " : ""}
            {c.action ? (
              <button
                type="button"
                onClick={() =>
                  onAction({
                    type: "world-nav",
                    view: (c.view || "areas") as TrainingUi["worldView"],
                  })
                }
              >
                {c.label}
              </button>
            ) : (
              c.label
            )}
          </span>
        ))}
      </div>
      <div className="world-grid">
        {world.cards.length ? (
          world.cards.map((card, i) => (
            <button
              key={`${card.title}-${i}`}
              type="button"
              className={`world-card ${card.unlocked ? "is-unlocked" : ""} ${card.active ? "is-active" : ""}`}
              disabled={card.disabled}
              onClick={() => onAction(cardToAction(card))}
            >
              <span className="wc-title">{card.title}</span>
              <span className="wc-sub" style={{ whiteSpace: "pre-line" }}>
                {card.sub}
              </span>
              <span className="wc-status">{card.status}</span>
            </button>
          ))
        ) : (
          <p className="empty-note">{world.emptyNote || "Nothing here."}</p>
        )}
      </div>
      {job ? <JobPanel job={job} /> : null}
      <p className="mechanic-note">{unlockNote}</p>
    </>
  );
}

function cardToAction(card: WorldView["cards"][number]): TrainingAction {
  const d = card.data || {};
  switch (card.action) {
    case "world-select-area":
      return { type: "world-select-area", area: String(d.area) };
    case "world-select-building":
      return { type: "world-select-building", building: String(d.building) };
    case "world-select-room":
      return { type: "world-select-room", room: String(d.room) };
    case "world-select-activity":
      return { type: "world-select-activity", skillId: String(d.skillId) };
    case "world-select-portal":
      return { type: "world-select-portal", portalId: String(d.portalId) };
    case "world-select-cantrip":
      return { type: "world-select-cantrip", archetype: String(d.archetype) };
    case "world-select-spell":
      return { type: "world-select-spell", archetype: String(d.archetype) };
    case "world-nav":
      return {
        type: "world-nav",
        view: String(d.view || "areas") as TrainingUi["worldView"],
      };
    default:
      return { type: "world-nav", view: "areas" };
  }
}

function JobPanel({ job }: { job: JobView }) {
  return (
    <div className="job-panel">
      <div className="job-label">{job.label}</div>
      <div className="job-title">{job.title}</div>
      <div className="ticks-bar">
        {Array.from({ length: job.fills }, (_, i) => {
          if (i < job.filled) return <span key={i} className="seg filled" />;
          if (i === job.filled && job.partial > 0) {
            return (
              <span
                key={i}
                className="seg partial"
                style={{ ["--pct" as string]: `${Math.round(job.partial * 100)}%` }}
              />
            );
          }
          return <span key={i} className="seg" />;
        })}
      </div>
      <div className="job-eta">
        {job.remainingSec}s remaining · {job.fillNote}
      </div>
    </div>
  );
}
