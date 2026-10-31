# Contracts

One file, `contracts/sponsored.py`. It is the only thing in this repository
that asks the network anything.

## contracts/sponsored.py

### Purpose

Escrow for one sponsored post, released only for what the post shows. The
sponsor opens a brief for one creator with one to five requirements in its own
words, the creator's site prefix, a publish-by time and a hold, and pays the
fee at once. The contract adds the disclosure as line 0. The creator submits
the post's address; the network fetches it on the live web and agrees which
lines it meets. A post that does not say it is sponsored is not paid; otherwise
each sponsor line met pays its share, held until the post has stayed up for
the hold.

### Consensus

Two kinds of round, each one `gl.vm.run_nondet_unsafe` block with all its work
inside the leader closure. Each validator closure is
`return _agrees(leaders_res, <the leader closure>)`: it refuses a leader that
raised or returned anything but a dict, runs the leader's work itself inside
`try/except` (its own failure is a disagreement), and compares the whole value
by exact equality.

**`submit`** (`_judge`). Inputs: the brief's lines (line 0 the disclosure, then
the sponsor's lines as written) and the post's address. Nothing else reaches
the round: no amount, no party, no clock. The leader closure:

1. `gl.nondet.web.get(url)` once; a failed fetch or a status outside 2xx raises
   `[TRANSIENT]`;
2. the body of that answer: its first 128,000 bytes as UTF-8 (a bad byte is the
   replacement character), the tags removed (and the text after a `script` or
   `style` tag) over at most 32,000 characters, the spacing collapsed, at most
   6,000 characters kept; empty raises `[TRANSIENT]`;
3. four askings in JSON mode, in this order:

| # | numbering | question |
|---|---|---|
| 1 | listed, 0 to n | MET |
| 2 | reversed, every line relabelled 0 to n | MET |
| 3 | listed | UNMET |
| 4 | reversed, relabelled | UNMET |

> MET: Which numbered REQUIREMENTS does the PAGE meet? Answer with the list of
> those numbers, for example [0, 2], or [] for none.

> UNMET: Which numbered REQUIREMENTS does the PAGE fail to meet, because it
> leaves them out, contradicts them, or is too vague to tell? Answer with the
> list of those numbers, or [] for none.

4. `{"mask": _combine_mask(...), "fp": first 16 hex of sha256(page)}`.

Each prompt is the header, the untrusted warning, the REQUIREMENTS block, the
PAGE block, the reading rules, the question and the answer shape, in that
order, and is at most about 9,500 characters. Both blocks are fenced (`<` and
`>` replaced, never deleted), capped (924 and 6,000 characters) and sit
between delimiter lines tagged with the start of their own sha256.

`_combine_mask` gives a mask, one `1` or `0` per line with line 0 first, when
both MET answers agree, both UNMET answers agree, and every line is in exactly
one of the two lists; anything else is `unclear`. An answer is read strictly:
an object whose only key is `answer` or a bare list, at most 400 characters
with at most one surrounding ``` fence removed, distinct whole numbers from 0
to n. `_clean_value` reads the agreed value back: a mask of n + 1 characters of
`0` and `1` with a 16-hex fingerprint, or unclear.

**`recheck`** (`_probe`). Input: the address the brief was settled on. One
`gl.nondet.web.get`, no model. 2xx is `{"up": "yes"}`, 404 or 410 is
`{"up": "gone"}`, and any other status or a failed fetch raises `[TRANSIENT]`.

### State

| map | key | holds |
|---|---|---|
| `brief_rows` | `B1`, `B2`, ... | `Brief`: parties, prefix, terms, status, both submissions and their readings, the settled mask, `held`, `owed`, `hold_until`, the money paid out, recheck counters |
| `line_rows` | `B1:1` ... `B1:5` | the sponsor's lines, as written; line 0 is the constant `DISCLOSURE` and is not stored |
| `credit_rows` | lowercase address | credit for submit fees |
| `index`, `counts` | `party:<address>` | each address's briefs, as numbered slots |

The storage dataclass holds scalars only. Totals (`held_total`, `taken_total`,
`credit_total`, `to_creators`, `to_sponsors`, `fees_to_sponsors`, `returned`)
and status counters live on the contract.

### States of a brief

```
offered --accept--> accepted --submit, a mask--> held --release--> released
   |                   |    \                      \--recheck, gone--> taken_down
   |                   |     \--submit, line 0 unmet--> hidden_ad
   |                   |      \--submit, nothing met--> nothing_met
   |                   |       \--submit, unclear--> accepted (once more)
   |--decline--> declined
   |--withdraw_brief--> withdrawn
   \--expire (offered or accepted, publish_by + 1 day)--> expired
```

`held` is the only state after the reading that still holds money.

### Methods

Writes: `open_brief` (payable), `withdraw_brief`, `decline`, `accept`,
`deposit` (payable), `withdraw`, `submit`, `recheck`, `release`, `expire`.
Views: `brief`, `briefs`, `briefs_of`, `credit`, `stats`, `rules`.

Five writes compare the sender with a party and refuse: the sponsor for
`withdraw_brief`; the creator for `decline`, `accept` and `submit`; anyone but
the creator named in it for `open_brief` (the sponsor may not name itself).
`deposit`, `withdraw`, `recheck`, `release` and `expire` refuse nobody by
sender. Each says "Open on purpose" in its docstring and is listed with its
reason in the static test: the money they move can only go where the brief
already says.

`open_brief` and `deposit` never raise and never reach the network. Every
refusal goes through `_refuse`, which sends the value back and answers
`{"ok": false}`.

`submit` checks everything before the round, and writes nothing before it:
the caller, the state, the address (plain https, at most 200 characters, below
the prefix), the window, the number of tries and the credit. A round that does
not settle leaves no trace and takes no fee. `recheck` does the same.

All value leaves through `_send`, from six places: `_refuse`, `withdraw`,
`submit` (the fee on unclear), `release`, `_close` (every exit to the sponsor)
and `_settle` (the rest at once). Every exit is O(1).

### Loops

Every loop is bounded by a named constant, and a static test lists each one:
the lines (`MAX_REQUIREMENTS` or `MAX_LINES`, in `_requirements_of`,
`open_brief`, `_numbered`, `_read_numbers`, `_from_reversed`, `_combine_mask`
and `_lines`), the signs of an address (`URL_SIGNS`), a fingerprint
(`FP_CHARS`), the tag walk (`MAX_RAW_PAGE`), the gone statuses in `rules`, and
every list page (`PAGE`, in `_page` and `briefs`; `briefs_of` walks one page).
There is no `while`. The requirements JSON is cut at 2,000 characters before it
is parsed, a fetched body at 128,000 bytes before it is decoded, and a model's
answer at 400 characters.

### Errors

| class | when | stored |
|---|---|---|
| `[EXPECTED]` | a rule of this contract, raised by a write that took no value | nothing |
| `[TRANSIENT]` | the post could not be fetched, answered outside 2xx (or, for a recheck, outside 2xx, 404 and 410), or read as nothing | nothing; no fee is taken |
| `[LLM_ERROR]` | a model call failed | nothing; no fee is taken |
| `{"ok": false}` | a refused `open_brief` or `deposit`; everything sent goes back | the refusal is counted |

### Limits

One to five sponsor lines, 10 to 150 characters each, all different from each
other and from the disclosure (case ignored), printable ASCII on one line,
sent as a JSON list of at most 2,000 characters. One check per line is the
published rule, not a check. Fee 0.1 to 50 GEN. `publish_by` 600 seconds to 90
days after the brief opens; submissions until a day after it. Hold 600 seconds
to 30 days. Two submissions at most, the second only after an unclear reading.
The submit fee is 0.01 GEN. A post prefix is at most 120 characters, a post
address at most 200. List views return at most 20 rows. See the README for the
plain-language list.
