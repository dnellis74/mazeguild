import type { Catalog } from "./catalog";
import { alignmentById, raceById, skillById } from "./catalog";
import {
  ABILITY_FULL_NAME,
  ABILITY_ORDER,
  type Character,
} from "./types";
import { asFeatureList, featureLabel } from "./features";
import { formatAbilityMod } from "./abilities";

function fillTemplate(template: string, vars: Record<string, string | number>) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : "",
  );
}

function abilityScoreNotables(
  scores: Record<string, number>,
  noteTpl: Record<string, string>,
): string[] {
  const entries = ABILITY_ORDER.map((ab) => ({
    ab,
    name: ABILITY_FULL_NAME[ab],
    score: Number(scores[ab]),
  }));
  const vals = entries.map((e) => e.score);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const highCut = Math.max(15, Math.ceil(avg + 3));
  const lowCut = Math.min(9, Math.floor(avg - 3));
  const notes: string[] = [];
  for (const e of entries) {
    if (e.score >= highCut) {
      notes.push(
        fillTemplate(noteTpl.notablyHigh || "{name} is notably high ({score})", e),
      );
    } else if (e.score <= lowCut) {
      notes.push(
        fillTemplate(noteTpl.notablyLow || "{name} is notably low ({score})", e),
      );
    }
  }
  if (!notes.length) {
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    if (max - min >= 5) {
      for (const e of entries) {
        if (e.score === max) {
          notes.push(
            fillTemplate(
              noteTpl.strongest || "{name} stands out as strongest ({score})",
              e,
            ),
          );
        }
        if (e.score === min) {
          notes.push(
            fillTemplate(
              noteTpl.weakest || "{name} stands out as weakest ({score})",
              e,
            ),
          );
        }
      }
    }
  }
  return notes;
}

export function buildOriginPrompt(catalog: Catalog, ch: Character): string {
  const tpl = catalog.backstoryPrompt || ({} as Catalog["backstoryPrompt"]);
  const labels = (tpl.labels || {}) as Record<string, string>;
  const race = raceById(catalog, ch.raceId);
  const align = alignmentById(catalog, ch.alignment.alignmentId);
  const raceLabel =
    ch.subrace && ch.subrace.label
      ? `${ch.subrace.label} (${race?.name || ch.raceId})`
      : race?.name || ch.raceId;

  const lines: string[] = [
    tpl.intro || "Write a short paragraph giving origin story for this fantasy character.",
    "",
    `${labels.race || "Race"}: ${raceLabel}`,
    `${labels.alignment || "Alignment"}: ${align?.name || ch.alignment.alignmentId}`,
  ];

  const exp = ch.alignment?.definingExperience;
  if (exp && (exp.scenario || exp.label)) {
    lines.push(
      `${labels.definingExperience || "Defining experience"}: ${exp.scenario || ""}`,
    );
    if (exp.label) {
      lines.push(`${labels.reaction || "How they reacted"}: ${exp.label}`);
    }
  }

  if (ch.features?.length) {
    const feats = ch.features.flatMap((f) => {
      const skill = skillById(catalog, f.id);
      const detail = f.detail || skill?.detail;
      return asFeatureList(f.feature).map((name, i) =>
        detail && i === 0 ? `${name} (${detail})` : name,
      );
    });
    lines.push(`${labels.features || "Features earned"}: ${feats.join("; ")}`);
    const archLines = ch.features.map((f) => {
      const skill = skillById(catalog, f.id);
      const detail = f.detail || skill?.detail;
      const skillLabel = featureLabel(f.feature) + (detail ? ` (${detail})` : "");
      return `${f.archetype} · ${skillLabel}${f.activity ? ` · ${f.activity}` : ""}`;
    });
    lines.push(
      `${labels.archetypes || "Archetypes drawn from"}: ${archLines.join("; ")}`,
    );
  }

  if (ch.cantrips?.length) {
    lines.push(
      `${labels.cantrips || "Cantrips learned"}: ${ch.cantrips
        .map((c) => (c.archetype ? `${c.name} (${c.archetype})` : c.name))
        .join("; ")}`,
    );
  }
  if (ch.spells?.length) {
    lines.push(
      `${labels.spells || "Spells learned"}: ${ch.spells
        .map((s) => (s.archetype ? `${s.name} (${s.archetype})` : s.name))
        .join("; ")}`,
    );
  }

  if (ch.abilityScores && ch.abilityScoresAssigned) {
    const notes = (tpl.abilityNotes || {}) as Record<string, string>;
    const notables = abilityScoreNotables(ch.abilityScores, notes);
    if (notables.length) {
      lines.push(
        fillTemplate(
          notes.highOrLow || "Notable ability scores: {notables}.",
          { notables: notables.join("; ") },
        ),
      );
    } else if (notes.even) {
      lines.push(notes.even);
    }
  }

  if (tpl.outro) lines.push("", tpl.outro);
  return lines.join("\n");
}

export function originStoryText(
  catalog: Catalog,
  ch: Character,
  originDraft?: string | null,
): string {
  if (originDraft != null) return originDraft;
  if (ch.originStory != null && ch.originStory !== "") return ch.originStory;
  return buildOriginPrompt(catalog, ch);
}

export { formatAbilityMod };
