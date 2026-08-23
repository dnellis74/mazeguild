import { Share_Tech_Mono } from "next/font/google";
import sampleParty from "@/data/sample-party.json";
import { GameClient } from "@/components/wizardry/GameClient";
import type { SrdCharacter } from "@/sim/types";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <div className={`${crt.className} h-dvh overflow-hidden`}>
      <GameClient party={sampleParty as SrdCharacter[]} />
    </div>
  );
}
