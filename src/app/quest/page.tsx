import type { Metadata } from "next";
import { Suspense } from "react";
import { Share_Tech_Mono } from "next/font/google";
import { QuestRunClient } from "@/components/town/QuestRunClient";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
});

export const metadata: Metadata = {
  title: "Quest · guildmaze",
  description: "Enter the maze with your selected companions.",
};

export default function QuestPage() {
  return (
    <div className={`${crt.variable} ${crt.className} training-page`}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/character-creation.css" />
      <Suspense
        fallback={
          <div className="stage">
            <div className="app">
              <div className="screen">
                <p className="lede">Gathering the party…</p>
              </div>
            </div>
          </div>
        }
      >
        <QuestRunClient />
      </Suspense>
    </div>
  );
}
