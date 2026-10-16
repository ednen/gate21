# Arcforge Pinball

A roguelike pinball game in a single HTML file, inspired by Balatro. Reach each level's target score, draft upgrades between levels, build family synergies and defeat six bosses across a 30-level run, then keep going in endless mode.

**Play:** https://ednen.github.io/multiverse-pinball/

## Controls

| | Keyboard | Touch |
|---|---|---|
| Left flipper | `Z`, `←` or `Left Shift` | tap the left half of the screen |
| Right flipper | `/`, `→` or `Right Shift` | tap the right half of the screen |
| Launch | hold `Space`, release | hold anywhere while the ball waits in the lane, release (during multiball: hold the middle of the screen) |
| Pause | `P` | ❚❚ button |
| Menus (rewards, shop) | arrows to move, `Space` to pick, `R` to reroll | tap |

## Features

- **Physics:** custom 2D pinball physics with a ramp, a tunnel, orbits, drop targets, a quantum pit and a green warp lane.
- **Scoring:** Balatro-style. Every hit scores *base × (1 + Bonus) × Mult*.
- **ARC:** spell ARC on the Arc Core for extra Mult and a ball save.
- **Cards:** 167 cards across 12 families: Thunder, Web, Aethertech, Titan, Arcane, Magnetism, Explosive, Quantum, Infernal, Voidsteel, Speed and Illusion. Owning 3 or 5 cards of one family unlocks its synergies, and a full family awakens its legendary.
- **Synergies:** 49 family and hybrid synergies.
- **Evolutions:** four machine evolutions rebuild the table.
- **Bosses:** six bosses with telegraphed attacks, and artifacts to claim from each:
  - The Trickster
  - The Architect
  - The Polarity King
  - The Tyrant
  - The Void Emperor
  - The Sovereign
- **Between levels:** the Curator's Vault shop, reward and shop rerolls, one level retry per run, and a Codex that remembers your discoveries.

## Run locally

Download `index.html` and open it in any browser. There's no build step and there are no dependencies.
