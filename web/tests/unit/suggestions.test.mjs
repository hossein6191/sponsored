// Every chip on the site fills its field with something the contract takes: lines it would store, fees,
// windows and deposits inside its limits, sites it accepts as a post prefix, and post addresses below
// them. A chip that could only be refused is a chip that wastes a signature.

import test from "node:test";
import assert from "node:assert/strict";

import { CREATOR_CHIPS, DEMO_LINES_CHIP, DEPOSIT_CHIPS, FEE_CHIPS, HOLD_CHIPS, LINE_CHIPS, PREFIX_CHIPS, PUBLISH_CHIPS, urlChips } from "../../lib/suggestions.ts";
import { MOCK_PREFIX } from "../../lib/chain-mock.ts";
import { tryAtto } from "../../lib/format.ts";
import { MAX_FEE, MAX_HOLD, MAX_LEAD, MAX_REQUIREMENT, MIN_FEE, MIN_HOLD, MIN_LEAD, MIN_REQUIREMENT, SUBMIT_FEE, addressText, postUrlProblem, prefixProblem, requirementsOf, textProblem } from "../../lib/rules.ts";

test("the line chips are lines the contract stores, alone and all together", () => {
  assert.equal(requirementsOf(JSON.stringify(DEMO_LINES_CHIP.value)).problem, "");
  for (const c of LINE_CHIPS) {
    assert.equal(textProblem(c.value, MIN_REQUIREMENT, MAX_REQUIREMENT, "requirement 1"), "", c.value);
    assert.equal(requirementsOf(JSON.stringify([c.value])).problem, "", c.value);
  }
  const distinct = [...new Set(LINE_CHIPS.map((c) => c.value))];
  assert.equal(requirementsOf(JSON.stringify(distinct.slice(0, 5))).problem, "", "any five of them together are five distinct lines");
});

test("the fee, window and deposit chips are inside the contract's limits", () => {
  for (const c of FEE_CHIPS) {
    const atto = tryAtto(c.value);
    assert.ok(atto !== null && atto >= MIN_FEE && atto <= MAX_FEE, `fee ${c.value}`);
  }
  // publish_by is placed from the browser's clock at the press; a minute or two passes before the
  // transaction's own clock reads it, so every chip leaves room on both sides.
  for (const c of PUBLISH_CHIPS) assert.ok(c.value >= MIN_LEAD + 600 && c.value <= MAX_LEAD - 86400, `publish within ${c.label}`);
  for (const c of HOLD_CHIPS) assert.ok(c.value >= MIN_HOLD && c.value <= MAX_HOLD, `hold ${c.label}`);
  for (const c of DEPOSIT_CHIPS) {
    const atto = tryAtto(c.value);
    assert.ok(atto !== null && atto > 0n && atto % SUBMIT_FEE === 0n, `deposit ${c.value} is a whole number of submissions`);
  }
});

test("the site and creator chips are a post prefix and an address the contract accepts", () => {
  for (const c of PREFIX_CHIPS) assert.equal(prefixProblem(c.value), "", c.value);
  assert.equal(prefixProblem(MOCK_PREFIX), "", "the demo build's demo site");
  for (const c of CREATOR_CHIPS) assert.equal(addressText(c.value), c.value.toLowerCase());
});

test("the post address chips sit below their brief's site", () => {
  for (const prefix of [MOCK_PREFIX, ...PREFIX_CHIPS.map((c) => c.value)]) {
    for (const demo of [true, false]) {
      const chips = urlChips(prefix, demo);
      assert.ok(chips.length >= 2);
      for (const c of chips) assert.equal(postUrlProblem(c.value, prefix, "B1"), "", c.value);
    }
  }
  assert.deepEqual(urlChips("", true), []);
});
