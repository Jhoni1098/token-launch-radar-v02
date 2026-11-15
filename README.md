# token-launch-radar-v02 — Momentum Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Jhoni1098/token-launch-radar-v02/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Jhoni1098/token-launch-radar-v02/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Momentum Radar ranks the 198 pre-token protocols DefiLlama tracks by where the money is moving, not by how big they already are. The model (momentum-1) prices each protocol as TVL × its category's median market-cap/TVL ratio — winsorized and shrunk to the global ratio — then lets the seven-day TVL change compound (clamped to −40%..+100%, raised to the third power), with a hot bonus of 1.15x for a week of +10% or better, a fresh bonus of 1.10x for a protocol under a year old with no token, and a size adjustment that discounts the giants and lifts the small so a fast-growing protocol can outrank a giant standing still. The dashboard is a dark trading-terminal page with a hottest-movers strip, growth bars on every row, a hot-only filter, and a momentum-timed seven-step farm plan for every protocol.

## Run it

```sh
node main.ts --input snapshot.json --output out
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=nd0791d4&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
