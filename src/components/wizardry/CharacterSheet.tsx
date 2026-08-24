import type { ReactNode } from "react";
import type { SrdCharacter } from "@/sim/types";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <section className="space-y-1">
      <h3 className="border-b border-amber-900/70 pb-0.5 text-[10px] tracking-[0.2em] text-amber-500">
        {title}
      </h3>
      <div className="text-amber-200/90">{children}</div>
    </section>
  );
}

function list(items: string[] | undefined): string | null {
  if (!items || items.length === 0) return null;
  return items.join(", ");
}

export function CharacterSheet({ character }: { character: SrdCharacter }) {
  const name = character.name?.trim() || `${character.race} ${character.class}`;
  const abilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
  const gear = [
    ...(character.equipment?.from_class ?? []),
    ...(character.equipment?.from_background ?? []),
  ];
  const spells = character.spellcasting;
  const spellBits = [
    ...(spells?.cantrips_known ?? []).map((s) => `${s} (cantrip)`),
    ...(spells?.spells_known ?? []),
    ...(spells?.spells_prepared ?? []),
    ...(spells?.spells_prepared_today ?? []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden font-mono text-xs uppercase tracking-wide text-amber-300">
      <header className="shrink-0 border border-amber-700/70 bg-black/60 px-3 py-2">
        <h2 className="text-base tracking-widest text-amber-100 sm:text-lg">
          {name}
        </h2>
        <p className="text-amber-500">
          {[character.subrace || character.race, character.class, "Level 1"]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-amber-600/90">
          {[character.background, character.alignment].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain border border-amber-800/60 bg-black/60 p-3 leading-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {abilities.map((abil) => {
            const block = character.ability_scores[abil];
            return (
              <div
                key={abil}
                className="border border-amber-900/70 px-1 py-1.5 text-center"
              >
                <div className="text-[10px] text-amber-500">{abil}</div>
                <div className="text-amber-100 tabular-nums">
                  {block?.score ?? "—"}
                </div>
                <div className="text-amber-600 tabular-nums">
                  {block?.modifier ?? ""}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <div>
            <span className="text-amber-500">HP </span>
            <span className="tabular-nums text-amber-100">
              {character.hit_points.value}
            </span>
            {character.hit_points.hit_die ? (
              <span className="text-amber-600">
                {" "}
                ({character.hit_points.hit_die})
              </span>
            ) : null}
          </div>
          <div>
            <span className="text-amber-500">AC </span>
            <span className="tabular-nums text-amber-100">
              {character.armor_class.value}
            </span>
          </div>
          <div>
            <span className="text-amber-500">Speed </span>
            <span className="text-amber-100">{character.speed ?? "—"}</span>
          </div>
          <div>
            <span className="text-amber-500">Prof </span>
            <span className="tabular-nums text-amber-100">
              {String(character.proficiency_bonus)}
            </span>
          </div>
        </div>

        {character.armor_class.calculation ? (
          <p className="normal-case tracking-normal text-amber-600">
            {character.armor_class.calculation}
          </p>
        ) : null}

        <Section title="Saving Throws">
          {character.saving_throws ? (
            <p className="tabular-nums">
              {abilities
                .map((a) => `${a} ${character.saving_throws?.[a] ?? "+0"}`)
                .join("  ")}
            </p>
          ) : (
            list(character.saving_throw_proficiencies)
          )}
        </Section>

        <Section title="Skills">{list(character.skill_proficiencies)}</Section>
        <Section title="Languages">{list(character.languages)}</Section>
        <Section title="Weapons">{list(character.weapon_proficiencies)}</Section>
        <Section title="Armor">{list(character.armor_proficiencies)}</Section>
        <Section title="Tools">{list(character.tool_proficiencies)}</Section>

        <Section title="Racial Traits">
          {character.racial_traits && character.racial_traits.length > 0 ? (
            <ul className="list-none space-y-1 normal-case tracking-normal">
              {character.racial_traits.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Class Features">
          {character.class_features_level_1 &&
          character.class_features_level_1.length > 0 ? (
            <ul className="list-none space-y-1 normal-case tracking-normal">
              {character.class_features_level_1.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </Section>

        {spells ? (
          <Section title="Spellcasting">
            <div className="space-y-1 normal-case tracking-normal">
              <p>
                {[
                  spells.ability ? `Ability ${spells.ability}` : null,
                  spells.spell_save_dc != null
                    ? `DC ${spells.spell_save_dc}`
                    : null,
                  spells.spell_attack_bonus
                    ? `Attack ${spells.spell_attack_bonus}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {spellBits.length > 0 ? <p>{spellBits.join(", ")}</p> : null}
            </div>
          </Section>
        ) : null}

        <Section title="Equipment">
          {gear.length > 0 ? (
            <p className="normal-case tracking-normal">{gear.join(", ")}</p>
          ) : null}
        </Section>

        {character.background_feature ? (
          <Section title={character.background_feature.name}>
            <p className="normal-case tracking-normal text-amber-400/90">
              {character.background_feature.text}
            </p>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
