import { Share_Tech_Mono } from "next/font/google";
import { GameClient } from "@/components/wizardry/GameClient";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <div className={`${crt.className} h-dvh overflow-hidden`}>
      <GameClient />
    </div>
  );
}
