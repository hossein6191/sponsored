# Sponsored

A sponsored post paid only for what it actually shows: validators read the
creator's post on the live web against the sponsor's brief, a post that hides
that it is an ad is not paid, and each requirement met pays its share of the
fee.

## The problem

A brand pays a creator to write about a product. The brief says what the post
must do: name the product, link to the shop, mention the colour. The fee is
paid up front or on a screenshot, and either way the brand pays for a post
nobody checked against the brief. The creator who forgot the link is paid the
same as the one who did everything asked. And the one thing the law and the
reader both care about, that the post says it is an ad, is the thing a brand
has the least reason to check: a post that hides the sponsorship often reads
better.

What both sides actually have is a short list and a page on the web. Whether
the page does what each line asks, and whether it says plainly that it is
sponsored, is a question about meaning, and the answer decides money. An
agency answers it with a person who works for one side. A plain smart contract
can hold the fee, but it can neither fetch the page nor read it.

## What it is

The sponsor **opens a brief** for one creator and sends the fee with it, 0.1
to 50 GEN, which the contract holds:

- the creator's address;
- the creator's own site, as one `https://` prefix of at most 120 characters
  ending in `/`: the post must sit below it;
- one to five requirements in the sponsor's own words, 10 to 150 characters
  each, one check per line ("Mentions the Tidewell 20 L dry bag by name");
- `publish_by`, at least ten minutes and at most 90 days away;
- `hold_seconds`, ten minutes to 30 days: how long the post must stay up
  before it is paid.

The contract always adds its own **line 0**, word for word:

> Clearly says that the post is sponsored, an ad or paid for

The creator **accepts** before `publish_by`, or **declines**; a brief nobody
accepted can always be **withdrawn** by the sponsor.

The creator publishes the post and **submits** its address, until a day after
`publish_by`. A submission costs 0.01 GEN from credit the creator
**deposited** beforehand. Every validator fetches the post itself and agrees
on a mask, one character per line, line 0 first: `1101` means the post
disclosed, named the bag and mentioned the colour, but did not link. The money
moves in the same transaction:

- **Line 0 unmet: a hidden ad.** Nothing is owed. The whole fee goes back to
  the sponsor and the brief closes.
- **Otherwise** the creator is owed `fee * sponsor lines met // sponsor
  lines`. The rest goes back to the sponsor at once, and the owed part is
  **held** until the post has stayed up for `hold_seconds`. A disclosed post
  that meets none of the sponsor's lines is owed nothing, and the brief closes
  with the whole fee back.
- **Unclear** (the two numberings or the two framings disagree, or an answer
  is unreadable): nothing moves from the escrow, the 0.01 GEN fee goes to the
  sponsor, and the creator may submit once more.
- When the validators cannot agree with each other, or the post could not be
  fetched, there is no reading at all. Nothing is stored and nothing is
  charged.

While the owed part is held, **anyone may recheck** the post: every validator
fetches the same address again, and asks no model. A 404 or 410, agreed, means
the post was taken down, and the held part goes back to the sponsor. A 2xx
means it is still up, and nothing changes. After the hold, **anyone may
release** the held part to the creator. A brief that has no clear reading a
day after `publish_by` can be **expired** by anyone, and the fee goes back to
the sponsor.

## How consensus is used

One kind of judged round, `submit`, inside one
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` block. Every validator
fetches the post itself with one `gl.nondet.web.get`, checks the status of
that answer (anything outside 2xx stores nothing), and judges the body of that
same answer: the tags are removed (and the text after a `script` or `style`
tag), the spacing of at most 32,000 characters is collapsed, at most 6,000
characters are kept, and the first 16 hex characters of their sha256 are the
page's fingerprint. Then it asks four askings over two fenced blocks: the
numbered REQUIREMENTS and the PAGE.

### The four askings

| # | numbering | question |
|---|---|---|
| 1 | listed, 0 to n | MET |
| 2 | reversed, every line relabelled 0 to n | MET |
| 3 | listed | UNMET |
| 4 | reversed, relabelled | UNMET |

> **MET:** Which numbered REQUIREMENTS does the PAGE meet? Answer with the
> list of those numbers, for example [0, 2], or [] for none.

> **UNMET:** Which numbered REQUIREMENTS does the PAGE fail to meet, because
> it leaves them out, contradicts them, or is too vague to tell? Answer with
> the list of those numbers, or [] for none.

Reversed, the line numbered `k` holds the line listed at `n - k`, and the
contract maps the answer back. Every line is relabelled, the disclosure
included: it is line 0 in one numbering and line `n` in the other, so a model
that trusts whatever comes first, or reads positions instead of words, splits
its own answers. The prompt never names the disclosure by its number. The
rules the model is given say that a requirement is met only when the page
plainly does it, that a link counts only when its address is written out in
the text (the tags, and every hidden link target with them, were removed),
that a hint is not enough, and that what the page says about another product
does not meet a requirement about this one.

### How the answers combine

The stored value is `{"mask": "<one character per line>", "fp": "<hex16>"}`
when both MET answers agree, both UNMET answers agree, and every line is in
exactly one of the two lists. Anything else, an unreadable answer included, is
`{"mask": "unclear", "fp": "<hex16>"}`. An answer is read strictly: the whole
reply must be `{"answer": [...]}` or a bare list, distinct whole numbers from 0
to n, nothing searched for inside prose.

Every validator does the leader's whole work itself, inside `try/except` so
its own failure is a disagreement, and compares the whole value by exact
equality. A page that reads differently for two validators has two
fingerprints, so it gets no consensus and stores nothing. A leader that raised
is never agreed with.

### The recheck

`recheck` is a second, smaller round: one fetch of the address the brief was
settled on, no model, the value `{"up": "yes"}` or `{"up": "gone"}`. 2xx is
yes, 404 or 410 is gone, and any other status or a failed fetch stores
nothing.

## Why GenLayer

The evidence is a page on somebody else's server, and it is the creator's own
page. No oracle publishes "does this blog post say it is sponsored"; no
contract on a plain chain can fetch it; and a single server that fetched it
for the contract would be the one party both sides have to trust. Here every
validator fetches the page itself, at the moment of the transaction, and reads
it in words; the agreement is on what the page says, not on what someone
reported it says. The second half is the same: whether the post is still up
during the hold is read from the live web, by every validator, again.

## Who may do what

| method | who | when |
|---|---|---|
| `open_brief` | anyone; the sender is the sponsor and pays the fee | any time; the creator is another address |
| `withdraw_brief` | the sponsor | while the brief is not accepted |
| `decline` | the creator | while the brief is not accepted |
| `accept` | the creator | before `publish_by` |
| `deposit` / `withdraw` | anyone, its own credit | any time |
| `submit` | the creator | after accepting, until `publish_by` + 1 day; once, and once more only after an unclear reading |
| `recheck` | anyone | while the owed part is held, before the hold ends |
| `release` | anyone | from the end of the hold |
| `expire` | anyone | from `publish_by` + 1 day, while no clear reading was made |

A post address must be plain `https`, at most 200 characters, below the
brief's prefix; anything else is refused before anything is fetched.

## The money

| event | to the creator | to the sponsor |
|---|---|---|
| `open_brief` | | pays the fee into escrow |
| `withdraw_brief`, `decline` | | the whole fee |
| `submit`, line 0 unmet (hidden ad) | nothing | the whole fee |
| `submit`, a mask with `m` of `n` sponsor lines met | `fee * m // n`, held | the rest, at once |
| `submit`, disclosed but no sponsor line met | nothing | the whole fee |
| `submit`, unclear | | the 0.01 GEN submit fee, from the creator's credit |
| `recheck`, gone | nothing | the held part |
| `recheck`, still up | | |
| `release` | the held part | |
| `expire` | | the whole fee |
| a refused `open_brief` or `deposit` | everything sent comes back in the same transaction | |

A clear reading leaves the 0.01 GEN submit fee in the creator's credit, which
the creator can withdraw at any time. The contract holds exactly the escrow of
offered, accepted and held briefs plus every credit.

## The demonstration

`posts/` is the fictional food-and-outdoors blog **Harbour Eats**, writing
about the fictional **Tidewell 20 L dry bag**. The sponsor's three lines are
"Mentions the Tidewell 20 L dry bag by name", "Links to
tidewell.example/bags" and "Mentions that the bag comes in orange".

| post | what it does | mask | outcome |
|---|---|---|---|
| `full.html` | discloses, names the bag, writes out the link, mentions orange | `1111` | the whole fee held, then paid |
| `no-disclosure.html` | the same post without the disclosure | `0111` | a hidden ad: the whole fee back |
| `no-link.html` | discloses, names the bag, mentions orange, no link | `1101` | two thirds held, a third back at once |
| `wrong-product.html` | discloses, but is about the Tidewell 10 L bag in grey | `1000` | nothing met: the whole fee back |

Each page is plain HTML with no script, style or image, so it reads the same
for every validator.

## The limits, stated plainly

- **The page must read the same for every validator.** A page that changes
  from one fetch to the next, or by who asks, gets no consensus and stores
  nothing.
- **Text is read, not images, video or styling.** A disclosure that is only in
  an image does not count. A link counts only when its address is written out
  in the text. Words hidden with CSS still read as written: the network reads
  the text of the page, not how it is drawn.
- **The creator controls the page.** A recheck reads only the status: a post
  edited while its pay is held, even to remove the disclosure, still counts as
  up as long as it answers 2xx, and a post edited or removed after its pay is
  released is not caught at all. A host that answers 404 during an outage
  while the pay is held costs the creator that pay.
- **One check per line.** A line that asks for two things is met only when the
  page does both, and honest readers may split on it. The contract cannot
  count the asks in a sponsor's sentence, so this is a rule the sponsor is
  told, not one the door enforces.
- **Publication time is not proven.** The contract knows when the post was
  submitted and read, not when it first went up.
- **The model can be wrong.** Two framings in two numberings catch a model
  that is inconsistent; they do not catch one that is consistently wrong.

## What is in this repository

```
contracts/sponsored.py          the contract
posts/                          the demo posts on Harbour Eats
tests/test_pure.py              the offline suite, including both rounds with a world per node
tests/MUTATIONS.md              every defence removed in turn, and the test that caught it
tests/on_chain/smoke.mjs        a throwaway-account run against Studio
tools/mutate.py                 the generator that writes MUTATIONS.md and refuses to if anything survives
docs/CONTRACTS.md               purpose, consensus, state, methods, loops, errors and limits
docs/DECISIONS.md               why each rule is the way it is, and what is verified and what is not
```

## Running it

```
pip install -r requirements-dev.txt
pytest tests/ -q                              # no network, no Studio
genvm-lint check contracts/sponsored.py
python tools/mutate.py                        # rewrites tests/MUTATIONS.md; exits 1 if a mutant survives
```

On this repository as it stands, `pytest tests/ -q` gives **125 passed** in
about a second. `genvm-lint check` (genvm-linter 0.11.0) prints
`Lint passed (3 checks)` and reports 16 methods, 6 view and 10 write.
`python tools/mutate.py` removes or inverts **252 defences** one at a
time, and **none survives**.

The on-chain run uses three throwaway keys it generates itself (SPONSOR,
CREATOR, STRANGER) and funds them from the Studio faucet. It never touches
anybody's own wallet. The validators read the posts from GitHub at one commit,
so push the repository first and pass that commit:

```
npm ci
COMMIT=<40-character sha> node tests/on_chain/smoke.mjs        # about forty minutes
COMMIT=<sha> RESUME=1 node tests/on_chain/smoke.mjs            # continue from the saved state
```

`REPO=<owner>/<name>` names the GitHub repository when the git remote does
not. The script fetches the posts itself before it deploys anything and stops
if they are not at that commit. It opens three briefs at 0.9 GEN each with a
600-second hold; the creator accepts all three; `full.html` reads `1111` and
its fee is held, `no-disclosure.html` reads as a hidden ad and its fee goes
back, `no-link.html` reads `1101` and two thirds are held. A stranger rechecks
the third post and finds it still up; on the chain's own clock both holds end
and a stranger releases both. Along the way a stranger is refused an
acceptance and a submission, the sponsor is refused naming itself as the
creator and has its fee back in the same transaction, an address outside the
prefix is refused before anything is fetched, and an early release and a late
recheck are refused. It then reads the deployed code back and compares it
with `contracts/sponsored.py` byte for byte, checks the views, takes the credit
back, and checks that the contract holds nothing and every account ended where
the money table says. It prints a PASS or FAIL line for every check,
`N passed, M failed`, and the contract address.

## Network

GenLayer Studio, chain 61999, RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`. The contract pins the runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` in its first
line.

## Evidence

The on-chain run is recorded here once it has run.

## Licence

MIT; see `LICENSE`.
