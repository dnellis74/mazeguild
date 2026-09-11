import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "guildmaze",
  description: "Create your character, train, then enter the maze.",
};

/** Unreachable when middleware rewrites `/` to character-initialization.html. */
export default function HomePage() {
  return null;
}
