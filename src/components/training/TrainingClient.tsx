"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlaceArt } from "@/components/training/PlaceArt";
import { fetchJsonOnce } from "@/lib/fetchOnce";
import {
  getRosterEntry,
  loadRoster,
  removeRosterEntry,
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

function defaultUi(opts?: {
  tab?: "sheet" | "world";
  area?: string | null;
}): TrainingUi {
  const tab = opts?.tab ?? "world";
  const area = opts?.area?.trim() || null;
  if (tab === "world" && area) {
    return {
      hubTab: "world",
      worldView: "buildings",
      worldArea: area,
      worldBuilding: null,
      worldRoom: null,
      pendingChoice: null,
      originDraft: null,
    };
  }
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
  const areaParam = params.get("area");
  const initialTab =
    params.get("tab") === "sheet" ? ("sheet" as const) : ("world" as const);

  const [entryId, setEntryId] = useState(characterId);
  const [character, setCharacter] = useState<Character | null>(null);
  const [ui, setUi] = useState<TrainingUi>(() =>
    defaultUi({ tab: initialTab, area: areaParam }),
  );
  const [view, setView] = useState<TrainingView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [originDraft, setOriginDraft] = useState("");
  /** Sheet opened from world keeps world nav; direct sheet entry returns to Town Square. */
  const [sheetReturn, setSheetReturn] = useState<"world" | "town">(
    initialTab === "sheet" ? "town" : "world",
  );
  const [nameRolling, setNameRolling] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const persist = useCallback(
    (ch: Character) => {
      if (!ch.id) return;
      upsertRosterEntry(ch);
    },
    [],
  );

  const saveName = useCallback(
    (raw: string) => {
      if (!character) return;
      const next = raw.trim() || character.name || "Companion";
      const updated = { ...character, name: next };
      setCharacter(updated);
      persist(updated);
    },
    [character, persist],
  );

  /** Persist as the user types so a refresh/HMR remount cannot drop an unblurred edit. */
  const onNameChange = useCallback(
    (raw: string) => {
      if (!character) return;
      const updated = { ...character, name: raw };
      setCharacter(updated);
      if (raw.trim()) persist({ ...updated, name: raw.trim() });
    },
    [character, persist],
  );

  const rollName = useCallback(async () => {
    if (!character || nameRolling) return;
    setNameRolling(true);
    try {
      const taken = loadRoster()
        .filter((e) => e.id !== character.id)
        .map((e) => e.name);
      const { ok, data } = await fetchJsonOnce<{ name?: string; error?: string }>(
        "/api/names",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raceId: character.raceId, taken }),
        },
      );
      if (!ok || !data?.name) {
        throw new Error(data.error || "Could not roll a name");
      }
      const next = String(data.name);
      const updated = { ...character, name: next };
      setCharacter(updated);
      persist(updated);
    } catch (err) {
      showToast(String(err instanceof Error ? err.message : err));
    } finally {
      setNameRolling(false);
    }
  }, [character, nameRolling, showToast, persist]);

  const apiView = useCallback(
    async (ch: Character, nextUi: TrainingUi) => {
      const { ok, data } = await fetchJsonOnce<{
        character: Character;
        ui: TrainingUi;
        view: TrainingView;
        redirect?: string;
        error?: string;
      }>("/api/training/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: ch, ui: nextUi }),
      });
      if (!ok) {
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
    async (action: TrainingAction, opts?: { character?: Character }) => {
      const ch = opts?.character ?? character;
      if (!ch) return;
      const { ok, data } = await fetchJsonOnce<{
        character: Character;
        ui: TrainingUi;
        view: TrainingView;
        redirect?: string;
        navigate?: string;
        toast?: string;
        error?: string;
      }>("/api/training/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: ch, ui, action }),
      });
      if (!ok) {
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
      setCharacter(entry);
      setSheetReturn(initialTab === "sheet" ? "town" : "world");
      const bootUi = defaultUi({ tab: initialTab, area: areaParam });
      void apiView(entry, bootUi).catch((err) => {
        setBootError(String(err?.message || err));
      });
    } catch (err) {
      setBootError(String(err instanceof Error ? err.message : err));
    }
    // boot once per id / entry point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, areaParam, initialTab]);

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

  const openSheet = () => {
    setSheetReturn("world");
    void apiAction({ type: "hub-tab", tab: "sheet" }).catch((e) =>
      showToast(String(e.message || e)),
    );
  };

  const returnFromSheet = () => {
    if (!character) {
      if (sheetReturn === "town") backToSquare();
      return;
    }
    const next: Character = {
      ...character,
      name: character.name.trim() || "Companion",
      originStory: originDraft,
    };
    setCharacter(next);
    persist(next);
    if (sheetReturn === "town") {
      backToSquare();
      return;
    }
    void apiAction({ type: "hub-tab", tab: "world" }, { character: next }).catch(
      (e) => showToast(String(e.message || e)),
    );
  };

  const dismissCompanion = () => {
    if (!character) return;
    const label = character.name.trim() || "this companion";
    const ok = window.confirm(
      `Dismiss ${label}? They leave the square for good. This cannot be undone.`,
    );
    if (!ok) return;
    removeRosterEntry(character.id);
    backToSquare();
  };

  const downloadCompanionJson = () => {
    if (!character) return;
    const payload: Character = {
      ...character,
      name: character.name.trim() || "Companion",
      originStory: originDraft,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const slug =
      payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "companion";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const onWorld = view.tab === "world";
  const onSheet = view.tab === "sheet";

  return (
    <div className="stage">
      <div className="app">
        <div className="hub">
          <div className="hub-header">
            <p className="kicker">{view.header.title}</p>
            {onSheet ? (
              <div className="name-field">
                <input
                  className="name-field-input"
                  value={character.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={(e) => saveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="Character name"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="name-field-die"
                  onClick={() => void rollName()}
                  disabled={nameRolling}
                  aria-label="Roll a race-appropriate name"
                  title="Roll a new name"
                >
                  <DieIcon />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="name-field-link"
                onClick={openSheet}
              >
                {character.name}
              </button>
            )}
            <p className="hub-meta">
              {view.header.featurePoints} feature point
              {view.header.featurePoints === 1 ? "" : "s"} left ·{" "}
              {onSheet ? (
                <button
                  type="button"
                  onClick={returnFromSheet}
                  style={{ textDecoration: "underline", color: "var(--ink-soft)" }}
                >
                  Return
                </button>
              ) : (
                <button
                  type="button"
                  onClick={backToSquare}
                  style={{ textDecoration: "underline", color: "var(--ink-soft)" }}
                >
                  Town Square
                </button>
              )}
            </p>
          </div>

          <div className="hub-body">
            {view.pending ? (
              <PendingPanel
                pending={view.pending}
                onAction={(a) =>
                  void apiAction(a).catch((e) => showToast(String(e.message || e)))
                }
              />
            ) : onSheet && view.sheet ? (
              <SheetPanel
                sheet={view.sheet}
                originDraft={originDraft}
                onOriginChange={setOriginDraft}
                onReset={() =>
                  void apiAction({ type: "reset-origin-prompt" }).catch((e) =>
                    showToast(String(e.message || e)),
                  )
                }
                onDismiss={dismissCompanion}
                onDownload={downloadCompanionJson}
              />
            ) : onWorld && view.world ? (
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
  onReset,
  onDismiss,
  onDownload,
}: {
  sheet: SheetView;
  originDraft: string;
  onOriginChange: (v: string) => void;
  onReset: () => void;
  onDismiss: () => void;
  onDownload: () => void;
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
          <strong>{sheet.featurePoints}</strong> remaining
        </div>
      </div>
      <div className="sheet-block">
        <div className="sheet-label">Experience</div>
        <div className="sheet-value">{sheet.xp.toLocaleString()} XP</div>
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
        <div className="sheet-label">Equipment</div>
        {sheet.equipment.length ? (
          <div className="feature-list">
            {sheet.equipment.map((e, i) => (
              <div key={`${e.slot}-${e.name}-${i}`} className="feature-card">
                <div className="name">{e.name}</div>
                <div className="from">
                  {e.slot}
                  {e.detail ? ` · ${e.detail}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            Gear is fitted when you earn your first feature — empty slots fill
            from your primary archetype.
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
          <button type="button" onClick={onReset}>
            Reset to prompt
          </button>
        </div>
      </div>
      <div className="sheet-block sheet-block-dismiss">
        <div className="sheet-companion-actions">
          <button type="button" className="download-companion" onClick={onDownload}>
            Download JSON
          </button>
          <button type="button" className="dismiss-companion" onClick={onDismiss}>
            Dismiss companion
          </button>
        </div>
        <p className="mechanic-note" style={{ marginTop: 10 }}>
          Download saves a full companion snapshot. Dismiss removes them from the
          square permanently.
        </p>
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
  const dockProgress = world.level === "activities";
  const here = world.crumb[world.crumb.length - 1]?.label;
  return (
    <div className={`world-panel${dockProgress ? " world-panel--dock" : ""}`}>
      <div className="world-panel-main">
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
        <PlaceArt name={here} className="place-art-here" />
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
        <p className="mechanic-note">{unlockNote}</p>
        {!dockProgress && job ? <JobPanel job={job} /> : null}
      </div>
      {dockProgress ? <JobPanel job={job} /> : null}
    </div>
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

function DieIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="8.2" cy="8.2" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="15.8" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

const IDLE_JOB_FILLS = 6;

function JobPanel({ job }: { job: JobView | null }) {
  const fills = job?.fills ?? IDLE_JOB_FILLS;
  return (
    <div className={`job-panel${job ? "" : " job-panel--idle"}`}>
      <div className="job-label">{job ? job.label : "At rest"}</div>
      <div className="job-title">{job ? job.title : "Choose an activity"}</div>
      <div className="ticks-bar">
        {Array.from({ length: fills }, (_, i) => {
          if (!job) return <span key={i} className="seg" />;
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
        {job ? `${job.remainingSec}s remaining · ${job.fillNote}` : "Idle"}
      </div>
    </div>
  );
}
