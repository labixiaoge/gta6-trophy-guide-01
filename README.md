# Leonida Trophy Guide — GTA VI

[![make.fun competition: gta6-trophy-guide-01](https://make.fun/badge/competition/gta6-trophy-guide-01)](https://make.fun/c/gta6-trophy-guide-01)
[![make.fun rank](https://make.fun/badge/rank/gta6-trophy-guide-01)](https://make.fun/c/gta6-trophy-guide-01)
[![make.fun reward: $250](https://make.fun/badge/reward/gta6-trophy-guide-01)](https://make.fun/c/gta6-trophy-guide-01)

Owner: [labixiaoge](https://make.fun/c/gta6-trophy-guide-01)

## About

An offline guide and tracker for all 55 PlayStation 5 trophies of Grand Theft Auto VI (1 platinum, 2 gold, 6 silver, 46 bronze). Every trophy is shown with its official name, description and grade, plus a guide written for this page in our own words, a roadmap to the platinum, and a missable flag built from the official descriptions.

The game released on 19 November 2026 and the author has not played it. The guides are therefore built only from the official descriptions and the PSN progress targets: where a specific place or step is not pinned down by a source, the guide says so plainly instead of inventing a walkthrough. A cited guide beats an uncited one, however detailed — so each trophy carries a Sources line naming where its facts come from.

What the app does:

- **Checklist** — tick trophies off; progress is saved in the browser (localStorage), with Export progress (JSON download) and Import progress (file input that only accepts names from the official 55).
- **Filters** — by kind (story, mission, activity, collectible, combat & crime, exploration, partner, money & property), by grade, by earned/unearned, and by text search.
- **Spoiler setting** — hides the names, descriptions and guides of story trophies until they are earned. On by default.
- **Roadmap to the platinum** — seven phases in order: story, stranger strands, activities, collectibles and exploration, crime and partner, money and property, then the 100% cleanup and the platinum.
- **Missables** — the trophies whose descriptions set a condition that can fail on an attempt (an undetected robbery, a back-to-back chain, a single use of Combat Focus), each with a note on how to set the attempt up; everything else is listed as safe to leave for later, with the warning that mission replay has not yet been confirmed in-game.
- **Progress header** — X/55 earned, counts by grade, and a platinum progress bar.
- **Detail pane** — click any trophy for its full guide, PSN target, missable note and sources.

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

That copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library (`vendor/makefun-frontend.ts`, unchanged from the kit).

## Sources

- Names, descriptions and grades: the official PlayStation 5 trophy list as published on Exophase — exophase.com, Grand Theft Auto VI PSN trophies.
- PSN progress targets (for example 42 Shooting Range challenges, 14 drone race locations, 52 areas of Leonida): PSNProfiles — psnprofiles.com, trophies 43531.
- Every guide on this page is written in our own words from those two sources; where a place or step is not pinned down by a source, the guide says so.

## License

MIT — see `LICENSE`.
