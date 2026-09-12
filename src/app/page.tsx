import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";
import { TownSquareClient } from "@/components/town/TownSquareClient";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
});

export const metadata: Metadata = {
  title: "Town Square · guildmaze",
  description: "Gather companions, train, and quest into the maze.",
};

export default function HomePage() {
  return (
    <div className={`${crt.variable} ${crt.className} training-page`}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/character-creation.css" />
      <TownSquareClient />
    </div>
  );
}
