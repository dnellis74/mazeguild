import type { Catalog } from "./catalog";
import { alignmentById, raceById, skillById } from "./catalog";
import {
  formatAbilityMod,
  pointBuyStartingScore,
} from "./abilities";
import {
  asFeatureList,
  featureLabel,
  hasSkill,
  prereqMet,
} from "./features";
import {
  cantripRoomForArchetype,
  hasFullSpellcasting,
  openCantripSlots,
  openSpellSlots,
  spellcastingRoomForArchetype,
} from "./magic";
import { originStoryText } from "./origin";
import {
  areaKey,
  buildingKey,
  buildWorld,
  featureTiming,
  roomKey,
  unlockTiming,
} from "./world";
import type { Character, TrainingUi } from "./types";
import { ABILITY_ORDER } from "./types";

export type TrainingView = {
  header: {
    title: string;
    featurePoints: number;
    raceName: string;
    alignmentName: string;
  };
  pending: TrainingUi["pendingChoice"];
  tab: TrainingUi["hubTab"];
  sheet: SheetView | null;
  world: WorldView | null;
  quest: { message: string; cta?: { action: string; label: string } } | null;
  job: JobView | null;
  unlockNote: string;
};

export type SheetView = {
  identity: { value: string; sub: string };
  featurePoints: number;
  abilities: { ab: string; score: number; mod: string }[];
  abilitiesNote: string;
  definingExperience: { scenario: string; reaction: string } | null;
  features: { name: string; detail?: string }[];
  archetypes: string[];
  cantrips: { name: string; from: string }[];
  spells: { name: string; from: string }[];
  originStory: { text: string; hint: string };
};

export type WorldCard = {
  action: string;
  title: string;
  sub: string;
  status: string;
  disabled?: boolean;
  unlocked?: boolean;
  active?: boolean;
  data: Record<string, string | number>;
};

export type WorldView = {
  crumb: { label: string; action?: string; view?: string }[];
  cards: WorldCard[];
  emptyNote?: string;
};

export type JobView = {
  label: string;
  title: string;
  fills: number;
  filled: number;
  partial: number;
  remainingSec: number;
  fillNote: string;
  done: boolean;
};

function formatDuration(spec: { fills: number; fillMsSec: number }) {
  const secs = spec.fills * spec.fillMsSec;
  const label = Number.isInteger(secs)
    ? String(secs)
    : String(Math.round(secs * 10) / 10);
  return label + "s";
}

function formatFillNote(spec: { fills: number; fillMsSec: number }) {
  const tick = Number.isInteger(spec.fillMsSec)
    ? String(spec.fillMsSec)
    : String(Math.round(spec.fillMsSec * 10) / 10);
  return `${spec.fills} fills of ${tick}s`;
}

export function jobProgress(job: Character["activeJob"]): JobView | null {
  if (!job) return null;
  const durationMs = job.durationMs;
  const fills = job.fills;
  const elapsed = Date.now() - job.startedAt;
  const pct = Math.min(1, elapsed / durationMs);
  const exact = pct * fills;
  const filled = Math.floor(exact);
  const partial = filled >= fills ? 0 : Math.min(1, exact - filled);
  const title =
    job.kind === "activity"
      ? job.detail
        ? `${job.activity} · ${job.detail}`
        : job.activity || ""
      : job.kind === "room"
        ? job.room || ""
        : job.kind === "building"
          ? job.building || ""
          : job.area || "";
  const label =
    job.kind === "activity"
      ? "Participating"
      : job.kind === "room"
        ? "Exploring room"
        : job.kind === "building"
          ? "Surveying building"
          : "Scouting area";
  return {
    label,
    title,
    fills,
    filled: Math.min(fills, filled),
    partial,
    remainingSec: Math.ceil(Math.max(0, durationMs - elapsed) / 1000),
    fillNote: formatFillNote({ fills: job.fills, fillMsSec: job.fillMsSec }),
    done: elapsed >= durationMs,
  };
}

function buildSheetView(catalog: Catalog, ch: Character, ui: TrainingUi): SheetView {
  const race = raceById(catalog, ch.raceId);
  const align = alignmentById(catalog, ch.alignment.alignmentId);
  const scores = ch.abilityScores;
  const start = pointBuyStartingScore(catalog);
  return {
    identity: {
      value: `${align?.name || "?"} ${race?.name || "?"}`,
      sub: `${ch.subrace ? ch.subrace.label + " · " : ""}No class — features come from the World.`,
    },
    featurePoints: ch.featurePoints,
    abilities: ABILITY_ORDER.map((ab) => {
      const score = scores?.[ab] ?? start;
      return {
        ab,
        score,
        mod: ch.abilityScoresAssigned ? formatAbilityMod(score) : "—",
      };
    }),
    abilitiesNote: ch.abilityScoresAssigned
      ? "Bought to archetype minimums, leftover points spent at random, then racial bonuses."
      : "Scores lock in after your second feature — archetype minimums first, then leftover points, then race.",
    definingExperience: ch.alignment.definingExperience
      ? {
          scenario: ch.alignment.definingExperience.scenario || "",
          reaction: ch.alignment.definingExperience.label || "",
        }
      : null,
    features: (ch.features || []).flatMap((f) => {
      const skill = skillById(catalog, f.id);
      const detail = f.detail || skill?.detail || undefined;
      return asFeatureList(f.feature).map((name, i) => ({
        name,
        detail: detail && i === 0 ? String(detail) : undefined,
      }));
    }),
    archetypes: (ch.features || []).map((f) => {
      const skill = skillById(catalog, f.id);
      const detail = f.detail || skill?.detail;
      const parts = [f.archetype, featureLabel(f.feature), f.activity].filter(Boolean);
      if (detail) parts.push(String(detail));
      return parts.join(" · ");
    }),
    cantrips: (ch.cantrips || []).map((c) => ({
      name: c.name,
      from: `${c.archetype}${c.description ? ` · ${c.description}` : ""}`,
    })),
    spells: (ch.spells || []).map((s) => ({
      name: s.name,
      from: `${s.archetype} · 1st-level${s.description ? ` · ${s.description}` : ""}`,
    })),
    originStory: {
      text: originStoryText(catalog, ch, ui.originDraft),
      hint: "Paste the prompt into an AI, write your own, or leave it. Save when you're happy.",
    },
  };
}

function buildWorldView(catalog: Catalog, ch: Character, ui: TrainingUi): WorldView {
  const world = buildWorld(catalog);
  const job = ch.activeJob;
  const unlock = unlockTiming(catalog);
  const crumb: WorldView["crumb"] = [];
  const cards: WorldCard[] = [];

  if (ui.worldView === "areas") {
    crumb.push({ label: "Areas of the realm" });
    for (const area of world) {
      const unlocked = !!ch.unlocked.areas[areaKey(area.name)];
      const working = job?.kind === "area" && job.area === area.name;
      cards.push({
        action: "world-select-area",
        title: area.name,
        sub: `${area.buildings.length} building${area.buildings.length === 1 ? "" : "s"}`,
        status: working
          ? "Scouting…"
          : unlocked
            ? "Unlocked"
            : `Locked · ${formatDuration(unlock)} to open`,
        unlocked,
        active: !!working,
        disabled: !!(job && !working),
        data: { area: area.name },
      });
    }
  } else if (ui.worldView === "buildings") {
    crumb.push({ label: "Areas", action: "world-nav", view: "areas" });
    crumb.push({ label: ui.worldArea || "" });
    const area = world.find((a) => a.name === ui.worldArea);
    for (const b of area?.buildings || []) {
      const key = buildingKey(ui.worldArea!, b.name);
      const unlocked = !!ch.unlocked.buildings[key];
      const working =
        job?.kind === "building" &&
        job.area === ui.worldArea &&
        job.building === b.name;
      cards.push({
        action: "world-select-building",
        title: b.name,
        sub: `${b.rooms.length} room${b.rooms.length === 1 ? "" : "s"}`,
        status: working
          ? "Surveying…"
          : unlocked
            ? "Unlocked"
            : `Locked · ${formatDuration(unlock)} to open`,
        unlocked,
        active: !!working,
        disabled: !!(job && !working),
        data: { building: b.name },
      });
    }
  } else if (ui.worldView === "rooms") {
    crumb.push({ label: "Areas", action: "world-nav", view: "areas" });
    crumb.push({ label: ui.worldArea || "", action: "world-nav", view: "buildings" });
    crumb.push({ label: ui.worldBuilding || "" });
    const area = world.find((a) => a.name === ui.worldArea);
    const building = area?.buildings.find((b) => b.name === ui.worldBuilding);
    for (const r of building?.rooms || []) {
      const key = roomKey(ui.worldArea!, ui.worldBuilding!, r.name);
      const unlocked = !!ch.unlocked.rooms[key];
      const working =
        job?.kind === "room" &&
        job.room === r.name &&
        job.building === ui.worldBuilding;
      const nAct = r.activities.filter((act) => {
        const skill = skillById(catalog, act.id);
        return skill ? prereqMet(ch, skill) : false;
      }).length;
      cards.push({
        action: "world-select-room",
        title: r.name,
        sub: `${nAct} activit${nAct === 1 ? "y" : "ies"}`,
        status: working
          ? "Exploring…"
          : unlocked
            ? "Unlocked"
            : `Locked · ${formatDuration(unlock)} to open`,
        unlocked,
        active: !!working,
        disabled: !!(job && !working),
        data: { room: r.name },
      });
    }
  } else {
    crumb.push({ label: "Areas", action: "world-nav", view: "areas" });
    crumb.push({ label: ui.worldArea || "", action: "world-nav", view: "buildings" });
    crumb.push({
      label: ui.worldBuilding || "",
      action: "world-nav",
      view: "rooms",
    });
    crumb.push({ label: ui.worldRoom || "" });
    const area = world.find((a) => a.name === ui.worldArea);
    const building = area?.buildings.find((b) => b.name === ui.worldBuilding);
    const room = building?.rooms.find((r) => r.name === ui.worldRoom);
    const acts = (room?.activities || []).filter((act) => {
      const skill = skillById(catalog, act.id);
      return skill ? prereqMet(ch, skill) : false;
    });
    for (const act of acts) {
      const owned = hasSkill(ch, act.id);
      const working = job?.kind === "activity" && job.skillId === act.id;
      const timing = featureTiming(catalog, act);
      cards.push({
        action: "world-select-activity",
        title: act.activity,
        sub: `Earns ${featureLabel(act.feature)} · ${act.archetype} · 1 point · ${formatDuration(timing)}${act.description ? `\n${act.description}` : ""}`,
        status: owned
          ? "Earned"
          : working
            ? "Participating…"
            : ch.featurePoints <= 0
              ? "No points left"
              : `${formatDuration(timing)} to complete`,
        unlocked: owned,
        active: !!working,
        disabled: !!(owned || (job && !working) || (ch.featurePoints <= 0 && !working)),
        data: {
          skillId: act.id,
          fills: timing.fills,
          fillMsSec: timing.fillMsSec,
        },
      });
    }
    for (const slot of openCantripSlots(catalog, ch)) {
      const loc = cantripRoomForArchetype(catalog, slot.archetype);
      if (
        !loc ||
        loc.area !== ui.worldArea ||
        loc.building !== ui.worldBuilding ||
        loc.room !== ui.worldRoom
      ) {
        continue;
      }
      cards.push({
        action: "world-select-cantrip",
        title: `Learn a ${slot.archetype} cantrip`,
        sub: `${slot.owned} of ${slot.allowance} known · ${slot.remaining} open`,
        status: hasFullSpellcasting(ch, slot.archetype)
          ? "Full spellcasting allotment"
          : "First half of cantrips",
        disabled: !!job,
        data: { archetype: slot.archetype },
      });
    }
    for (const slot of openSpellSlots(catalog, ch)) {
      const loc = spellcastingRoomForArchetype(catalog, slot.archetype);
      if (
        !loc ||
        loc.area !== ui.worldArea ||
        loc.building !== ui.worldBuilding ||
        loc.room !== ui.worldRoom
      ) {
        continue;
      }
      cards.push({
        action: "world-select-spell",
        title: `Learn a ${slot.archetype} spell`,
        sub: `${slot.owned} of ${slot.allowance} known · ${slot.remaining} open`,
        status: "1st-level spells",
        disabled: !!job,
        data: { archetype: slot.archetype },
      });
    }
  }

  return {
    crumb,
    cards,
    emptyNote:
      cards.length === 0
        ? "Nothing open here yet. Earn a prerequisite feature elsewhere first."
        : undefined,
  };
}

export function buildTrainingView(
  catalog: Catalog,
  ch: Character,
  ui: TrainingUi,
): TrainingView {
  const race = raceById(catalog, ch.raceId);
  const align = alignmentById(catalog, ch.alignment.alignmentId);
  const unlock = unlockTiming(catalog);
  const feature = featureTiming(catalog, null);
  const header = {
    title: `${align?.name || "?"} ${race?.name || "?"}`,
    featurePoints: ch.featurePoints,
    raceName: race?.name || "",
    alignmentName: align?.name || "",
  };
  const job = jobProgress(ch.activeJob);
  const unlockNote = `${formatFillNote(unlock)} unlock each place. Features take ${formatFillNote(feature)} (from skills data). Each feature costs one point.`;

  if (ui.pendingChoice) {
    return {
      header,
      pending: ui.pendingChoice,
      tab: ui.hubTab,
      sheet: null,
      world: null,
      quest: null,
      job,
      unlockNote,
    };
  }

  return {
    header,
    pending: null,
    tab: ui.hubTab,
    sheet: ui.hubTab === "sheet" ? buildSheetView(catalog, ch, ui) : null,
    world: ui.hubTab === "world" ? buildWorldView(catalog, ch, ui) : null,
    quest:
      ui.hubTab === "quest"
        ? {
            message:
              "The tavern door is open. Bring your record downstairs — you'll already be hired, then pick three more companions for the maze.",
            cta: { action: "enter-tavern", label: "Enter the tavern" },
          }
        : null,
    job,
    unlockNote,
  };
}
