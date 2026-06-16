# Evaluation: PR #40 "Auto orient analog components"

Upstream: https://github.com/nturley/netlistsvg/pull/40 (kasbah, 2018, WIP)

## What the PR proposes

Analog skins ship vertical **and** horizontal variants of a component
(`r_v`/`r_h`, `c_v`/`c_h`, `l_v`/`l_h`, `d_led_v`/`d_led_h`). Today the netlist
author chooses the orientation **by hand**. PR #40 chooses it automatically:

1. find all `r` / `c` / `d_led` cells,
2. brute-force every vertical/horizontal combination (`2^N`),
3. lay each out with ELK and count wire **bend points**,
4. render the combination with the fewest bends.

## Does the idea have real value?

**Yes — orientation strongly affects analog schematic readability.** Measured on
this repo's examples (analog skin, bend points ignoring straight runs):

| Example                | all-horizontal | all-vertical | Auto (min-bends) |
|------------------------|---------------:|-------------:|-----------------:|
| `resistor_divider`     | 8 bends        | 2 bends      | **2** (= vertical) |
| `common_emitter_full`  | 27 bends       | 10 bends     | **10** (= vertical) |

So picking orientation well gives **~3× fewer bends** and a more compact result.
Automating that choice is a legitimately useful goal — it removes per-component
`_v`/`_h` hand-tuning.

## Does the PR's *implementation* deliver that value?

**Partially, and with two real limitations confirmed by the data:**

1. **The bend metric just rediscovers "all vertical."** On both examples the
   `2^N` search picks the all-vertical layout — the same thing a designer gets by
   defaulting every part to `_v`. This matches the PR author's own note:
   *"Everything just seems to favor complete vertical orientation so far."* The
   metric doesn't yet surface useful mixed-orientation layouts.
2. **Brute force does not scale.** It is `2^N` full ELK layouts. `charlie_plex`
   has 9 orientable parts → 512 layouts; real boards have dozens of parts.

**Verdict:** valuable *direction*, not production-ready. The payoff depends on a
better objective (e.g. favor straight signal paths / fewer crossings, not just
bend count) and a non-exponential search. As-is it mostly reproduces the manual
"default to vertical" convention.

## How to inspect it (demo)

This branch adds an **Orientation** control to the demo
(`As authored` / `All vertical` / `All horizontal` / `Auto — fewest bends`) plus a
live metric readout (bends, size, parts, and for Auto the best-of-N range).

Things to try:
- **`common emitter (mis-oriented) — try Auto`**: authored all-horizontal (27
  bends, messy). Switch to `Auto` and it is rescued to 10 bends (clean vertical) —
  the clearest demonstration of the feature's value: *same input, fixed
  automatically*.
- **`resistor divider` / `common emitter`** (authored vertical): `Auto`,
  `All vertical` and `As authored` all look identical, because the bend-optimum is
  all-vertical. Only `All horizontal` differs (worse). This is the limitation in
  one picture — Auto adds nothing over "default to vertical" here.
- **`charlieplex`** (9 parts): exceeds the 2^6 brute-force cap, so `Auto` falls
  back to all-vertical. Compare with `All horizontal` to see orientation matters.

Notes on this demonstration (an enhancement over the raw PR):
- It is **demo-only** — the core library is untouched, so a fragile/exponential
  algorithm is not committed to the renderer.
- `Auto` uses bends as the primary metric with **graph area as a tiebreaker**
  (a small refinement over the PR, which used bends alone).
- `Auto` is capped at `2^6 = 64` layouts; larger nets fall back to all-vertical
  with a notice (demonstrating the scalability limit honestly).
- The demo also fixes skin selection so analog examples render with the analog
  skin.
