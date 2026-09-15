import type { Metadata } from "next";
import { CrtShell } from "@/components/shell/CrtShell";

export const metadata: Metadata = {
  title: "Welcome a Stranger · guildmaze",
  description: "Create a companion — race, childhood, and alignment.",
};

export default function CharacterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CrtShell>{children}</CrtShell>;
}
