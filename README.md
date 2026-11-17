# neon-coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Wangzinan62/neon-coast/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Wangzinan62/neon-coast/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Coast** is an original top-down 2D open-world crime game that runs in a desktop browser from plain static files — ES modules and Canvas 2D, no libraries, no build step, no network requests, and every piece of art drawn in code. You play Jett Rivera, a small-time driver trying to make a name in a neon coastal city at dusk: six avenues by five streets of shops, palms and traffic, a park, and a beach with an animated sea and a pier. Named places anchor the map — St. Lucia General hospital, the NCPD Harbor Precinct, the Neon Spray garage, and your safehouse.

Roam the city on foot or steal any car you can reach. Crimes committed in view raise a 0–5 star wanted level: police cars pour in, officers chase you down, and if they pin you, you are busted. Between the heat, a four-mission story unfolds through phone dialogues with Maya Solano, Dex Marlowe and Vince Calloway — deliveries, a marked car to lift, a hideout run under pressure, and a finale across the map. Progress (cash, missions, position) is saved in localStorage, so the title screen offers Continue where you left off.

## Features

- A full city block grid with traffic AI, parked cars and strolling pedestrians who flee danger
- Driving with several car types, collisions and damage — plus car stealing anywhere, anytime
- A 0–5 star wanted system: police chases, roadblocks of pressure, busts, wanted decay when you break line of sight, and a spray garage that clears your stars for cash
- Pistol combat with mouse aim, reloads, muzzle flash and police who shoot back at high wanted levels
- A four-mission story with phone-style dialogues, map markers, cash rewards and retry on failure
- HUD with health, cash, wanted stars, ammo and a live minimap (roads, mission blip, police blips)
- Title screen, pause, hospital respawns, and a localStorage save with Continue
- Tiny synthesized sound effects (WebAudio, no audio files), mutable with M

## Controls

- **WASD / arrow keys** — move (and drive)
- **Shift** — run
- **E** — enter / exit car
- **Mouse** — aim
- **Click** — shoot
- **R** — reload
- **Esc / P** — pause
- **M** — mute

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. `serve.ts` and `main.ts` are Node 22 programs with no dependencies: `serve.ts` is just a tiny static file server for local play, while `main.ts` is the entry program the bounty grader runs — it copies `game/` and `screenshots/` out and writes the dossier. The game itself is the static files under `game/` and works from any static file server, completely offline.

All names, characters, art, story and code in this project are original. Nothing here comes from Rockstar Games or GTA.

<sub>Entered on [make.fun](https://make.fun/?ref=7n4st51n&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
