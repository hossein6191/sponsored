# Decisions

Why each rule of `contracts/sponsored.py` is the way it is, and what is
verified and what is not.

## 1. The question is fixed before the money moves

**The requirements are written once, when the brief opens, in the sponsor's
words.** The creator accepts a list it can read, and neither side can reword it
after the post is out. The contract numbers the list itself, and every line is
one line of printable ASCII, so a requirement cannot add a numbered line of its
own. The same line twice, or a line that repeats the disclosure, is refused:
two equal lines would give the model two numbers for one thing.

**The disclosure is the contract's, not the sponsor's.** Line 0 is always
"Clearly says that the post is sponsored, an ad or paid for", word for word.
A sponsor cannot leave it out, soften it or reword it, and every brief on the
contract asks the same thing about it. It gates the money rather than earning
a share: a post that hides that it is an ad is owed nothing, however well it
does the rest, because that is the one requirement a sponsor has a reason not
to enforce.

**A post is paid on what it shows, not on a score.** The stored value is a
closed vector, one `0` or `1` per line, and the share follows from it by
integer arithmetic. There is no "mostly linked" for the network to agree on.

**One check per line.** Each line is one question to the model: does the page
do this? "Names the bag and links to the shop" holds two, and honest readers
can split on a page that does one of them. The demonstration, the tests and
the README use one check per line, and `rules()` publishes the rule. The
contract cannot count the asks in a sponsor's sentence, so this is a rule the
sponsor is told, not one the door enforces.

## 2. Two framings in two numberings, one block

**Every validator reads the page itself.** The post is fetched inside the
consensus block, by each node, once. The status of that answer is checked and
the body of that same answer is judged: a second request could meet another
server. A status outside 2xx, a failed fetch or a page that reads as nothing
is a failed read: nothing is stored and nothing is charged.

**The fingerprint is part of the value.** The stored value carries the first
16 hex characters of the sha256 of the text judged, so a page that reads
differently for two validators, by time or by who asks, gets no consensus.

**MET and UNMET, each in two numberings.** One framing alone lets a model that
leans towards "yes" pay for a post that does nothing. One numbering alone lets
a model that reads positions instead of words agree with itself. The four
askings give each line two chances to be read inconsistently, and any
inconsistency lands in the value: unclear, never a tolerance in the comparison.

**Every line is relabelled, the disclosure included.** Reversed, the line
numbered `k` holds the line listed at `n - k`. The disclosure is line 0 in one
numbering and line `n` in the other, and the prompt never names it by number,
so a model that trusts whatever comes first, or treats "line 0" as special,
splits its own answers. The tests include such a reader and show it caught on
a post that hides the sponsorship.

**Nothing met is a mask, not unclear.** `0000` is a hidden ad and `1000` is a
disclosed post about something else. Both are clear answers with a clear
outcome: the whole fee back to the sponsor.

## 3. An unclear reading is not a free re-roll

**It costs the fee, and there is only one more try.** A submission takes 0.01
GEN from credit the creator deposited earlier, so the round is never paid out
of a payable call. On a clear reading the fee stays in the creator's credit. On
an unclear one it goes to the sponsor. Two submissions is the hard limit; a
second unclear reading leaves the brief to expire, with the fee back to the
sponsor. A clear reading is final: the creator cannot submit again for a
better mask. A failed fetch or model call is not a reading, and costs nothing.

**A recheck is an observation, not a judgment.** It asks no model. It may be
asked any number of times while the pay is held, by anyone, because a post that
is up stays up whoever asks; it only moves money when every validator agrees
the post answers 404 or 410. Capping it would give the creator a cap to fill.

## 4. The money is already there, and leaves through named exits

**The whole fee is paid when the brief opens.** `open_brief` takes the fee or
refunds everything in the same transaction, without raising and without
reaching the network. From then on the contract holds exactly the escrow of
offered, accepted and held briefs plus every credit. The random journeys check
this after every step.

**The sponsor's part goes back at once.** On a mask the sponsor has the unmet
share back in the same transaction; only the creator's share waits for the
hold. `_close` is the single exit to the sponsor for whatever a brief still
holds, and `release` the single exit to the creator. Every exit is O(1).

**The hold protects the sponsor from a post put up and taken down.** The
owed part waits `hold_seconds` after the reading, and anyone may look again in
that time. After it, anyone may release the pay, so the creator never depends
on the sponsor to be paid.

## 5. Every party has a way out

| refused | the way out |
|---|---|
| a sponsor sent a fee out of bounds | send 0.1 to 50 GEN |
| a creator who never accepts | `withdraw_brief`, at any time while it stands, or `expire` |
| a creator who accepted and never posts | `expire`, a day after `publish_by` |
| a submission without credit | `deposit`, then submit |
| a post outside the prefix | submit the post below it; nothing was fetched or charged |
| a reading that was unclear | submit once more |
| a release before the hold ends | the refusal says when it ends |
| credit left over | `withdraw` |

Each is walked as a journey in `TestRoutesOut`.

## What is verified, and what is not

Verified offline: every rule and refusal above, at each boundary (`publish_by`,
the last second of the submission window, the end of the hold, the credit
exactly equal to the fee, every bound of the door); all sixteen masks over the
demo brief and their exact split with an odd fee; one and five sponsor lines;
the hidden ad, the post that meets nothing, the unclear reading, the
re-submission and two unclear readings; the reversed numbering mapped back; a
positional reader and a first-line reader landing on `unclear`; replies in
prose, with extra keys, past 400 characters or fenced twice being unreadable;
a failed fetch, a non-2xx status, an empty page, a failed model call, a page
that reads differently for the validators and a dishonest leader each storing
nothing; a recheck finding the post up, gone with 404 and with 410, and every
other answer storing nothing; release and expiry; the brief view through every
state; money invariants after every step of forty seeded random journeys that
must reach every status and every outcome; static rules over the parsed source
(sender gates, the payable doors, loops, the prompt boundary, the closures, the
comparison, no float, every JSON read, every transfer); and the mutants in
`tests/MUTATIONS.md`, none surviving.

Not verified offline: how real models on Studio read the demo posts. The
scripted reader in the tests is a stand-in. The on-chain run is the evidence
for that, and its record goes in the README once it has run.
