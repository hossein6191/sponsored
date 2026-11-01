import { PillLink } from "@/components/button";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-[560px] p-6 text-center">
      <p className="kicker text-tomato-ink">404</p>
      <h1 className="mt-2 text-[34px]">Nothing posted here</h1>
      <p className="mt-2 text-ink-2">This address is not a page of the site. Briefs live at /brief/B1, /brief/B2 and so on.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <PillLink href="/">Home</PillLink>
        <PillLink href="/ledger" variant="ghost">
          Every brief
        </PillLink>
      </div>
    </div>
  );
}
