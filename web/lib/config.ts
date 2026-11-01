// Site settings in one place: the contract address, the name and the line, the public repository and
// the commit the demo posts are pinned to.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset. It is filled in
// once the contract is deployed; while both are empty every page says the contract is not deployed
// yet, and the whole site still works with NEXT_PUBLIC_MOCK=1.
export const DEMO_CONTRACT: string = "0xa8e1A29e1C79aa7610f0583c769EA21f9317f556";

/**
 * The commit of the public repository whose posts/ the demo creator submits, as raw.githubusercontent.com
 * serves them, so every validator fetches the same bytes. Filled in once the repository is pushed;
 * NEXT_PUBLIC_POSTS_COMMIT overrides it. While both are empty the demo creator neither accepts nor posts.
 */
export const POSTS_COMMIT: string = "237b0e8a6645f3819fd5c12f317c686b8ce3f61a";

export const SITE_NAME = "Sponsored";
export const SITE_TAGLINE = "Paid for what the post actually shows.";
export const SITE_LINE =
  "A sponsored post paid only for what it shows: validators read the creator's post on the live web against the sponsor's brief, a post that hides that it is an ad is not paid, and each line met pays its share of the fee.";

/**
 * The public source repository. No account name is written into the repository: NEXT_PUBLIC_REPO_URL
 * names it, and on Vercel the repository the site was built from names it by itself (its system
 * variables NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER and _SLUG). While neither names one, the footer's Source
 * link is hidden and the demo creator cannot build the pinned addresses of its posts.
 */
const builtFrom =
  process.env.NEXT_PUBLIC_VERCEL_GIT_PROVIDER === "github" && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER}/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG}`
    : "";
export const REPO_URL: string = process.env.NEXT_PUBLIC_REPO_URL || builtFrom || "";

/** The contract in use: the deploy's environment first, then the committed address. */
export const contractAddress = (): string => process.env.NEXT_PUBLIC_CONTRACT || DEMO_CONTRACT || "";

/** The commit the demo posts are pinned to: 40 lowercase hex characters, or "". */
export const postsCommit = (): string => {
  const c = (process.env.NEXT_PUBLIC_POSTS_COMMIT || POSTS_COMMIT || "").trim();
  return /^[0-9a-f]{40}$/.test(c) ? c : "";
};

/** The demo creator's address when the site's server cannot name it (no key); NEXT_PUBLIC_DEMO_CREATOR overrides "". */
export const demoCreatorFallback = (): string => {
  const a = (process.env.NEXT_PUBLIC_DEMO_CREATOR || "").trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) ? a : "";
};
