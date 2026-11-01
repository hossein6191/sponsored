import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For creators",
  description: "Accept or decline briefs made to you, submit your post's address, and keep credit for submit fees.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
