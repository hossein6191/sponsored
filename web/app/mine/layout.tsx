import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My briefs",
  description: "The briefs you sponsor and the briefs you create, each with what it waits for and where its money is.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
