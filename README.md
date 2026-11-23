# vice-heat
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dakam1232/vice-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dakam1232/vice-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Vice Heat is an original open-world crime game that runs entirely in a desktop browser. Explore a procedural sun-soaked coastal city on foot or behind the wheel, carjack traffic, outrun a five-star police pursuit, and take on three jobs: a car delivery, a checkpoint race and a high-heat escape. Everything you see and hear is generated at runtime — geometry, facades, traffic, pedestrians, minimap and WebAudio sound — with three.js vendored locally so the game plays offline.

The game includes a wanted system with chasing cruisers and a busted meter, fists and a pistol, health and weapon pickups, autosave plus manual save/load, a title screen, pause, busted and wasted screens, and a live HUD with a canvas minimap. It is all hand-written JavaScript ES modules under `game/`, with no build step and no external requests.

## Run it

```
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Click **CLICK TO PLAY**, use WASD to move, Shift to run, E to enter or exit cars, F or mouse click to attack, M to mute, K/L to save and load, and Esc or P to pause. The deterministic screenshot scenes are available at `?shot=start`, `?shot=play`, `?shot=drive` and `?shot=chase` (optionally with `&seed=1`).

<sub>Entered on [make.fun](https://make.fun/?ref=xtb2sk9v&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
