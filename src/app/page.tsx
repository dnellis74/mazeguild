import type { Metadata } from "next";
import { CrtShell } from "@/components/shell/CrtShell";
import { TownSquareClient } from "@/components/town/TownSquareClient";
import { getCatalog } from "@/training/catalog";

export const metadata: Metadata = {
  title: "Town Square · guildmaze",
  description: "Gather companions, train, and quest into the maze.",
};

export default function HomePage() {
  const catalog = getCatalog();
  const races: Record<string, string> = {};
  const alignments: Record<string, string> = {};
  for (const r of catalog.races) races[r.id] = r.name;
  for (const a of catalog.alignments) alignments[a.id] = a.name;

  return (
    <CrtShell>
      <TownSquareClient labels={{ races, alignments }} />
    </CrtShell>
  );
}
