import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "guildmaze",
  description:
    "Deterministic automated party dungeon crawler — dungeon layer prototype",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "guildmaze",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050301",
  colorScheme: "dark",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-dvh overflow-hidden">
      <body className="h-dvh overflow-hidden bg-black text-amber-300 antialiased">
        {children}
      </body>
    </html>
  );
}
