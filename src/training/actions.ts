import type { Catalog } from "./catalog";
import { skillById } from "./catalog";
import { assignAbilityScores } from "./abilities";
import { asFeatureList, featureLabel, hasSkill, prereqMet } from "./features";
import {
  cantripRoomForArchetype,
  cantripsForArchetype,
  cantripsRemaining,
  cantripAllowance,
  ownedCantrips,
  ownedSpells,
  spellAllowance,
  spellcastingRoomForArchetype,
  spellsForArchetype,
  spellsRemaining,
} from "./magic";
import { buildOriginPrompt } from "./origin";
import { jobProgress } from "./view";
import {
  isTownSquareBuilding,
  TOWN_SQUARE_AREA,
} from "./townSquare";
import {
  areaKey,
  buildingKey,
  ensureUnlocked,
  featureTiming,
  roomKey,
  unlockTiming,
} from "./world";
import type {
  ActionResult,
  ActiveJob,
  Character,
  TrainingAction,
  TrainingUi,
} from "./types";

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function favoredEnemyChoices(catalog: Catalog, ch: Character, rng: () => number) {
  const race = catalog.races.find((r) => r.id === ch.raceId);
  const entry = race ? catalog.favoredEnemy[race.name] : null;
  const fromRace: string[] = [];
  if (entry) {
    if (entry.enemy) fromRace.push(entry.enemy);
    if (entry.hunted && !fromRace.includes(entry.hunted)) fromRace.push(entry.hunted);
  }
  const picks = fromRace.slice(0, 2);
  const all = new Set<string>();
  for (const e of Object.values(catalog.favoredEnemy)) {
    if (e.enemy) all.add(e.enemy);
    if (e.hunted) all.add(e.hunted);
  }
  const pool = [...all].filter((x) => !picks.includes(x));
  shuffleInPlace(pool, rng);
  while (picks.length < 3 && pool.length) picks.push(pool.shift()!);
  return shuffleInPlace(picks, rng);
}

function startJob(
  catalog: Catalog,
  ch: Character,
  ui: TrainingUi,
  job: Omit<ActiveJob, "fills" | "fillMsSec" | "durationMs" | "startedAt"> & {
    fills?: number;
    fillMsSec?: number;
  },
): ActionResult {
  if (ch.activeJob) {
    return { character: ch, ui, toast: "Already at work." };
  }
  const timing =
    job.kind === "activity"
      ? featureTiming(catalog, {
          fills: job.fills,
          fillMsSec: job.fillMsSec,
        })
      : unlockTiming(catalog);
  const next: Character = {
    ...ch,
    activeJob: {
      ...job,
      fills: timing.fills,
      fillMsSec: timing.fillMsSec,
      durationMs: timing.durationMs,
      startedAt: Date.now(),
    },
  };
  return {
    character: next,
    ui: { ...ui, hubTab: "world" },
    jobRunning: true,
  };
}

function openCantripPicker(
  catalog: Catalog,
  ch: Character,
  ui: TrainingUi,
  archetype: string,
): ActionResult {
  const remaining = cantripsRemaining(catalog, ch, archetype);
  if (remaining <= 0) {
    return { character: ch, ui, toast: `No cantrip slots left for ${archetype}.` };
  }
  const ownedIds = new Set(ownedCantrips(ch, archetype).map((c) => String(c.id)));
  const options = cantripsForArchetype(catalog, archetype).filter(
    (c) => !ownedIds.has(String(c.id)),
  );
  if (!options.length) {
    return { character: ch, ui, toast: "No cantrips left to learn." };
  }
  return {
    character: ch,
    ui: {
      ...ui,
      hubTab: "world",
      pendingChoice: {
        type: "cantrip",
        archetype,
        remaining,
        allowance: cantripAllowance(catalog, ch, archetype),
        owned: ownedCantrips(ch, archetype).length,
        options,
      },
    },
  };
}

function openSpellPicker(
  catalog: Catalog,
  ch: Character,
  ui: TrainingUi,
  archetype: string,
): ActionResult {
  const remaining = spellsRemaining(catalog, ch, archetype);
  if (remaining <= 0) {
    return { character: ch, ui, toast: `No spell slots left for ${archetype}.` };
  }
  const ownedIds = new Set(ownedSpells(ch, archetype).map((s) => String(s.id)));
  const options = spellsForArchetype(catalog, archetype).filter(
    (s) => !ownedIds.has(String(s.id)),
  );
  if (!options.length) {
    return { character: ch, ui, toast: "No spells left to learn." };
  }
  return {
    character: ch,
    ui: {
      ...ui,
      hubTab: "world",
      pendingChoice: {
        type: "spell",
        archetype,
        remaining,
        allowance: spellAllowance(catalog, ch, archetype),
        owned: ownedSpells(ch, archetype).length,
        options,
      },
    },
  };
}

function maybeOpenMagicPicker(
  catalog: Catalog,
  ch: Character,
  ui: TrainingUi,
  archetype: string | undefined,
): ActionResult {
  if (!archetype) return { character: ch, ui };
  if (cantripsRemaining(catalog, ch, archetype) > 0) {
    const loc =
      cantripRoomForArchetype(catalog, archetype) ||
      spellcastingRoomForArchetype(catalog, archetype);
    const nextUi = loc
      ? {
          ...ui,
          worldArea: loc.area,
          worldBuilding: loc.building,
          worldRoom: loc.room,
          worldView: "activities" as const,
        }
      : ui;
    return openCantripPicker(catalog, ch, nextUi, archetype);
  }
  if (spellsRemaining(catalog, ch, archetype) > 0) {
    const loc =
      spellcastingRoomForArchetype(catalog, archetype) ||
      cantripRoomForArchetype(catalog, archetype);
    const nextUi = loc
      ? {
          ...ui,
          worldArea: loc.area,
          worldBuilding: loc.building,
          worldRoom: loc.room,
          worldView: "activities" as const,
        }
      : ui;
    return openSpellPicker(catalog, ch, nextUi, archetype);
  }
  return { character: ch, ui };
}

function completeJob(catalog: Catalog, ch: Character, ui: TrainingUi): ActionResult {
  const job = ch.activeJob;
  if (!job) return { character: ch, ui };
  let nextCh = { ...ch, activeJob: null as Character["activeJob"] };
  let nextUi = { ...ui };
  let toast: string | undefined;

  if (job.kind === "area" && job.area) {
    nextCh = {
      ...nextCh,
      unlocked: {
        ...nextCh.unlocked,
        areas: { ...nextCh.unlocked.areas, [areaKey(job.area)]: true },
      },
    };
    nextUi = {
      ...nextUi,
      worldView: "buildings",
      worldArea: job.area,
    };
    toast = `${job.area} open.`;
  } else if (job.kind === "building" && job.area && job.building) {
    nextCh = {
      ...nextCh,
      unlocked: {
        ...nextCh.unlocked,
        buildings: {
          ...nextCh.unlocked.buildings,
          [buildingKey(job.area, job.building)]: true,
        },
      },
    };
    nextUi = {
      ...nextUi,
      worldView: "rooms",
      worldBuilding: job.building,
    };
    toast = `${job.building} unlocked.`;
  } else if (job.kind === "room" && job.area && job.building && job.room) {
    nextCh = {
      ...nextCh,
      unlocked: {
        ...nextCh.unlocked,
        rooms: {
          ...nextCh.unlocked.rooms,
          [roomKey(job.area, job.building, job.room)]: true,
        },
      },
    };
    nextUi = {
      ...nextUi,
      worldView: "activities",
      worldRoom: job.room,
    };
    toast = `${job.room} unlocked.`;
  } else if (job.kind === "activity") {
    const skill = skillById(catalog, job.skillId) || null;
    if (
      skill &&
      nextCh.featurePoints > 0 &&
      skill.id &&
      !hasSkill(nextCh, skill.id) &&
      prereqMet(nextCh, skill)
    ) {
      nextCh = {
        ...nextCh,
        featurePoints: nextCh.featurePoints - 1,
        features: [
          ...nextCh.features,
          {
            id: skill.id,
            feature: asFeatureList(skill.feature),
            archetype: skill.archetype,
            detail: job.detail || skill.detail || null,
            description: skill.description || null,
            area: skill.area || job.area,
            building: skill.building || job.building,
            room: skill.room || job.room,
            activity: skill.activity || job.activity,
          },
        ],
      };
      const label = featureLabel(skill.feature);
      toast = job.detail ? `Learned ${label}: ${job.detail}.` : `Learned ${label}.`;
      if (nextCh.features.length >= 2) {
        const assigned = assignAbilityScores(catalog, nextCh);
        if (assigned.abilityScoresAssigned && !ch.abilityScoresAssigned) {
          nextCh = assigned;
          toast += " Ability scores set.";
        } else {
          nextCh = assigned;
        }
      }
      const magic = maybeOpenMagicPicker(catalog, nextCh, nextUi, skill.archetype);
      return { character: magic.character, ui: magic.ui, toast };
    }
  }

  return { character: nextCh, ui: nextUi, toast };
}

export function applyTrainingAction(
  catalog: Catalog,
  character: Character,
  ui: TrainingUi,
  action: TrainingAction,
  rng: () => number = Math.random,
): ActionResult {
  const ch = character;
  let nextUi = { ...ui };

  switch (action.type) {
    case "hub-tab": {
      if (ui.pendingChoice) return { character: ch, ui };
      return { character: ch, ui: { ...ui, hubTab: action.tab } };
    }
    case "cancel-choice":
      return { character: ch, ui: { ...ui, pendingChoice: null } };
    case "world-nav": {
      nextUi = { ...ui, worldView: action.view };
      if (action.view === "areas") {
        nextUi.worldArea = null;
        nextUi.worldBuilding = null;
        nextUi.worldRoom = null;
      }
      if (action.view === "buildings") {
        nextUi.worldBuilding = null;
        nextUi.worldRoom = null;
      }
      if (action.view === "rooms") nextUi.worldRoom = null;
      return { character: ch, ui: nextUi };
    }
    case "world-select-area": {
      if (ch.unlocked.areas[areaKey(action.area)]) {
        return {
          character: ch,
          ui: { ...ui, worldArea: action.area, worldView: "buildings" },
        };
      }
      return startJob(catalog, ch, ui, { kind: "area", area: action.area });
    }
    case "world-select-building": {
      if (!ui.worldArea) return { character: ch, ui, toast: "No area selected." };
      // Town Square is the roster / character-selection hub, not a skill building.
      if (
        ui.worldArea === TOWN_SQUARE_AREA &&
        isTownSquareBuilding(action.building)
      ) {
        return {
          character: ensureUnlocked(ch),
          ui,
          navigate: "/",
        };
      }
      const key = buildingKey(ui.worldArea, action.building);
      if (ch.unlocked.buildings[key]) {
        return {
          character: ch,
          ui: {
            ...ui,
            worldBuilding: action.building,
            worldView: "rooms",
          },
        };
      }
      return startJob(catalog, ch, ui, {
        kind: "building",
        area: ui.worldArea,
        building: action.building,
      });
    }
    case "world-select-room": {
      if (!ui.worldArea || !ui.worldBuilding) {
        return { character: ch, ui, toast: "No building selected." };
      }
      const key = roomKey(ui.worldArea, ui.worldBuilding, action.room);
      if (ch.unlocked.rooms[key]) {
        return {
          character: ch,
          ui: { ...ui, worldRoom: action.room, worldView: "activities" },
        };
      }
      return startJob(catalog, ch, ui, {
        kind: "room",
        area: ui.worldArea,
        building: ui.worldBuilding,
        room: action.room,
      });
    }
    case "world-select-activity": {
      if (ch.activeJob) return { character: ch, ui, toast: "Already at work." };
      if (ch.featurePoints <= 0) {
        return { character: ch, ui, toast: "No feature points left." };
      }
      const skill = skillById(catalog, action.skillId);
      if (!skill) return { character: ch, ui, toast: "Unknown skill." };
      if (hasSkill(ch, skill.id)) return { character: ch, ui, toast: "Already learned." };
      if (!prereqMet(ch, skill)) {
        return { character: ch, ui, toast: "Prerequisite not met." };
      }
      const timing = featureTiming(catalog, skill);
      const jobBase = {
        kind: "activity" as const,
        skillId: skill.id,
        area: ui.worldArea || skill.area,
        building: ui.worldBuilding || skill.building,
        room: ui.worldRoom || skill.room,
        activity: skill.activity,
        feature: skill.feature,
        archetype: skill.archetype,
        fills: timing.fills,
        fillMsSec: timing.fillMsSec,
      };
      if (skill.id === "f_15m9q5") {
        return {
          character: ch,
          ui: {
            ...ui,
            hubTab: "world",
            pendingChoice: {
              type: "favored-enemy",
              options: favoredEnemyChoices(catalog, ch, rng),
              job: jobBase,
            },
          },
        };
      }
      return startJob(catalog, ch, ui, jobBase);
    }
    case "confirm-favored-enemy": {
      const pending = ui.pendingChoice;
      if (!pending || pending.type !== "favored-enemy") return { character: ch, ui };
      if (!pending.options.includes(action.enemy)) {
        return { character: ch, ui, toast: "Invalid choice." };
      }
      return startJob(catalog, ch, { ...ui, pendingChoice: null }, {
        ...pending.job,
        detail: action.enemy,
      });
    }
    case "world-select-cantrip":
      if (ch.activeJob) return { character: ch, ui, toast: "Already at work." };
      return openCantripPicker(catalog, ch, ui, action.archetype);
    case "world-select-spell":
      if (ch.activeJob) return { character: ch, ui, toast: "Already at work." };
      return openSpellPicker(catalog, ch, ui, action.archetype);
    case "confirm-cantrip": {
      const pending = ui.pendingChoice;
      if (!pending || pending.type !== "cantrip") return { character: ch, ui };
      const cantrip = catalog.cantrips.find(
        (c) => String(c.id) === String(action.cantripId),
      );
      if (!cantrip || cantrip.archetype !== pending.archetype) {
        return { character: ch, ui, toast: "Invalid cantrip." };
      }
      if (ownedCantrips(ch, pending.archetype).some((c) => String(c.id) === String(cantrip.id))) {
        return { character: ch, ui, toast: "Already known." };
      }
      if (cantripsRemaining(catalog, ch, pending.archetype) <= 0) {
        return {
          character: ch,
          ui: { ...ui, pendingChoice: null },
          toast: "No cantrip slots left.",
        };
      }
      const nextCh: Character = {
        ...ch,
        cantrips: [
          ...(ch.cantrips || []),
          {
            id: cantrip.id,
            name: cantrip.name,
            archetype: cantrip.archetype,
            description: cantrip.description || "",
          },
        ],
      };
      if (cantripsRemaining(catalog, nextCh, pending.archetype) > 0) {
        return {
          ...openCantripPicker(catalog, nextCh, ui, pending.archetype),
          toast: `Learned ${cantrip.name}.`,
        };
      }
      if (spellsRemaining(catalog, nextCh, pending.archetype) > 0) {
        return {
          ...openSpellPicker(catalog, nextCh, ui, pending.archetype),
          toast: `Learned ${cantrip.name}.`,
        };
      }
      return {
        character: nextCh,
        ui: { ...ui, pendingChoice: null },
        toast: `Learned ${cantrip.name}.`,
      };
    }
    case "confirm-spell": {
      const pending = ui.pendingChoice;
      if (!pending || pending.type !== "spell") return { character: ch, ui };
      const spell = catalog.spells.find((s) => String(s.id) === String(action.spellId));
      if (!spell || spell.archetype !== pending.archetype) {
        return { character: ch, ui, toast: "Invalid spell." };
      }
      if (ownedSpells(ch, pending.archetype).some((s) => String(s.id) === String(spell.id))) {
        return { character: ch, ui, toast: "Already known." };
      }
      if (spellsRemaining(catalog, ch, pending.archetype) <= 0) {
        return {
          character: ch,
          ui: { ...ui, pendingChoice: null },
          toast: "No spell slots left.",
        };
      }
      const nextCh: Character = {
        ...ch,
        spells: [
          ...(ch.spells || []),
          {
            id: spell.id,
            name: spell.name,
            archetype: spell.archetype,
            level: spell.level || 1,
            description: spell.description || "",
          },
        ],
      };
      if (spellsRemaining(catalog, nextCh, pending.archetype) > 0) {
        return {
          ...openSpellPicker(catalog, nextCh, ui, pending.archetype),
          toast: `Learned ${spell.name}.`,
        };
      }
      return {
        character: nextCh,
        ui: { ...ui, pendingChoice: null },
        toast: `Learned ${spell.name}.`,
      };
    }
    case "tick-job": {
      const p = jobProgress(ch.activeJob);
      if (p?.done) return completeJob(catalog, ch, ui);
      return { character: ch, ui, jobRunning: !!ch.activeJob };
    }
    case "complete-job":
      return completeJob(catalog, ch, ui);
    case "save-origin-story":
      return {
        character: { ...ch, originStory: action.text },
        ui: { ...ui, originDraft: action.text },
        toast: "Origin story saved.",
      };
    case "reset-origin-prompt": {
      const prompt = buildOriginPrompt(catalog, ch);
      return {
        character: ch,
        ui: { ...ui, originDraft: prompt },
        toast: "Prompt refreshed.",
      };
    }
    default:
      return { character: ch, ui, toast: "Unknown action." };
  }
}
