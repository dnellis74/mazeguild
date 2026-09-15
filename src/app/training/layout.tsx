import type { Metadata } from "next";
import { CrtShell } from "@/components/shell/CrtShell";

export const metadata: Metadata = {
  title: "Training · guildmaze",
  description: "Train your character, then take them into the maze.",
};

/**
 * Theme: CRT amber to match town / character. Sheet and World use
 * character-creation.css via CrtShell. Quest lives at `/quest` with its own page.
 */
export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CrtShell>{children}</CrtShell>;
}
