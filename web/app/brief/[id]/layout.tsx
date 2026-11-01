// The route's own browser title, from the URL alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^B?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Brief B${m[1]}` : "Brief",
    description: "One brief: its lines lit by the agreed reading, the post in a phone frame, the held pay and where every GEN went.",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
