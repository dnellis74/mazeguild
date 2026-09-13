import { abilityMod, applyHeal } from "./rules";
import { d, type Rng } from "./rng";
import type { Combatant, LogEvent } from "./types";

/**
 * Short rest after a won encounter.
 *
 * - Living PCs auto-spend Hit Dice until full HP or out of dice
 *   (each die: 1d(hitDie) + CON mod, minimum 0).
 * - Second Wind refreshes for those who have it.
 * - Warlock pact slots refresh (other spell slots do not — long rest / town).
 * - Rage uses and Lay on Hands do not refresh here.
 *
 * Mutates party in place; appends one `short_rest` log event.
 */
export function applyShortRest(
  rng: Rng,
  party: Combatant[],
  log: LogEvent[],
): void {
  const heals: Extract<LogEvent, { event: "short_rest" }>["heals"] = [];
  const secondWindRestored: string[] = [];
  const warlockSlotsRestored: string[] = [];

  for (const c of party) {
    if (c.kind !== "pc" || !c.alive) continue;

    let healed = 0;
    let spent = 0;
    while (c.hp < c.maxHp && c.hitDiceRemaining > 0) {
      c.hitDiceRemaining -= 1;
      spent += 1;
      const roll = d(rng, Math.max(1, c.hitDieSides));
      const amount = Math.max(0, roll + abilityMod(c.abilities.CON));
      if (amount > 0) {
        const before = c.hp;
        applyHeal(c, amount);
        healed += c.hp - before;
      }
    }
    if (spent > 0 || healed > 0) {
      heals.push({
        name: c.name,
        amount: healed,
        hpAfter: c.hp,
        hitDiceSpent: spent,
        hitDiceRemaining: c.hitDiceRemaining,
      });
    }

    if (c.secondWindLevel > 0) {
      c.secondWindAvailable = true;
      secondWindRestored.push(c.name);
    }

    if (c.archetype === "Warlock") {
      c.spellSlots = 1;
      warlockSlotsRestored.push(c.name);
    }
  }

  log.push({
    event: "short_rest",
    heals,
    secondWindRestored,
    warlockSlotsRestored,
  });
}
