import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Maker",
  description: "Create teams, vote for the best one, in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
