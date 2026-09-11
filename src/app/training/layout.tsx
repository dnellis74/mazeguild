import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, Share_Tech_Mono } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm",
});

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
});

export const metadata: Metadata = {
  title: "Training · guildmaze",
  description: "Train your character, then take them into the maze.",
};

/**
 * Theme split:
 * - Sheet / World: paper ledger via `/css/character-creation.css` (`.training-page`, `.hub`)
 * - Quest: CRT flipped only under `.stage-quest` / `.app-quest` / `.quest-adventure`
 *   (QuestClient mounts GameClient there)
 */
export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${display.variable} ${body.variable} ${crt.variable} training-page`}
    >
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/character-creation.css" />
      {children}
    </div>
  );
}
