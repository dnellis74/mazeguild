import type { Metadata } from "next";
import { Suspense } from "react";
import { CrtShell } from "@/components/shell/CrtShell";
import { QuestPageClient } from "./QuestPageClient";

export const metadata: Metadata = {
  title: "Quest · guildmaze",
  description: "Enter the maze with your selected companions.",
};

function MazeBoot() {
  return (
    <div className="crt flex min-h-[70dvh] items-center justify-center bg-ega-black font-mono text-ega-yellow">
      DESCENDING…
    </div>
  );
}

export default function QuestPage() {
  return (
    <CrtShell className="bg-ega-black text-ega-light-gray">
      <Suspense fallback={<MazeBoot />}>
        <QuestPageClient />
      </Suspense>
    </CrtShell>
  );
}
