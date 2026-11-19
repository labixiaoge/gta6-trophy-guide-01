# Leonida Trophy Guide — GTA VI

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/labixiaoge/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/labixiaoge/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

## What this is

An offline guide and tracker for all 55 PlayStation 5 trophies of Grand Theft Auto VI (1 platinum, 2 gold, 6 silver, 46 bronze). Every trophy appears with its official name, description and grade, plus a guide written for this page in our own words, steps to follow, a practical tip, and a Sources line naming where each fact comes from.

The game released on 19 November 2026 and the author has not played it. The guides are therefore built only from the official descriptions and the PSN progress targets: where a specific place or step is not pinned down by a source, the guide says so plainly instead of inventing a walkthrough. A cited guide beats an uncited one, however detailed — so each trophy carries its sources beside it.

What the app does:

- **Checklist** — tick trophies off; progress is saved in the browser (localStorage). Export it as JSON or as a plain-text checklist, import it back from JSON, or copy a one-line progress summary to share.
- **Filters and sorting** — by kind (story, mission, activity, collectible, combat & crime, exploration, partner, money & property), by grade, by earned/unearned, by missable only, and by text search across names, descriptions, guides and steps. Sort by list order, easiest first, quickest first, or name.
- **Difficulty and time** — every trophy carries a difficulty rating (1–5 stars, the author's own judgement) and an estimated time in hours, so the next trophy to chase is easy to pick.
- **By phase** — the same 55 trophies grouped by the roadmap's seven phases, so the order to earn them in is visible at a glance.
- **Stats** — a dashboard with counts by grade and by kind, the hours left on the unearned trophies, and a platinum readiness figure.
- **Spoiler setting** — hides the names, descriptions and guides of story trophies until they are earned. On by default.
- **Roadmap to the platinum** — seven phases in order: story, stranger strands, activities, collectibles and exploration, crime and partner, money and property, then the 100% cleanup and the platinum. Each phase shows its trophies, its hours and its own progress. Reach it from the button above the list, or directly at `#roadmap`.
- **Missables** — the trophies whose descriptions set a condition that can fail on an attempt (an undetected robbery, a back-to-back chain, a single use of Combat Focus), each with a note on how to set the attempt up; everything else is listed as safe to leave for later, with the warning that mission replay has not yet been confirmed in-game. Reach it from the button above the list, or directly at `#missables`.
- **Progress header** — X/55 earned, counts by grade, and a platinum progress bar.
- **Detail pane** — click any trophy for its full guide, steps, tip, PSN target, missable note and sources.

The look is our own: a light paper design with a coral accent and serif display headings. No Rockstar Games logo or official artwork anywhere.

## How to run offline

No build step, no network. Serve `app/` with any static server:

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. Turn the network off and it still works — every file the app loads lives under `app/`, and the only request it makes at run time is a relative fetch of `app/data/trophies.json`.

## How to hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That checks the trophy data (55 trophies, each with a name and a guide), checks the scorer's size caps, copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library (`vendor/makefun-frontend.ts`, unchanged from the kit).

## Sources

- Names, descriptions and grades: the official PlayStation 5 trophy list as published on Exophase — exophase.com, Grand Theft Auto VI PSN trophies.
- PSN progress targets (for example 42 Shooting Range challenges, 14 drone race locations, 52 areas of Leonida): PSNProfiles — psnprofiles.com, trophies 43531.
- Difficulty ratings and time estimates are the author's own judgement, not official figures.
- Every guide on this page is written in our own words from those two sources; where a place or step is not pinned down by a source, the guide says so.

## License

MIT — see `LICENSE`.
