import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
});

export const metadata: Metadata = {
  title: "Welcome a Stranger · guildmaze",
  description: "Create a companion — race, childhood, and alignment.",
};

export default function CharacterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${crt.variable} ${crt.className} training-page`}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/character-creation.css" />
      {children}
    </div>
  );
}
