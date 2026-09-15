import { Share_Tech_Mono } from "next/font/google";
import type { ReactNode } from "react";

const crt = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
});

/** Shared EGA shell: Share Tech Mono + character-creation.css. */
export function CrtShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${crt.variable} ${crt.className} training-page${className ? ` ${className}` : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/character-creation.css" />
      {children}
    </div>
  );
}
