# Swell Season

An interactive global surf atlas comparing the seasonality of 50 iconic breaks across 28 countries and territories. The central heatmap recomputes 600 month scores for a shortboard or longboard, balancing board-to-wave fit, clean wind, consistency, tide flexibility, and crowd pressure. A linked world map and transparent per-spot breakdown make every score explorable.

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Verify

```bash
npm run build
npm test
npm run lint
```

## Research

The scoring model, research trail, assumptions, and source notes are documented in [RESEARCH.md](RESEARCH.md). Scores describe broad seasonal tendencies, not live conditions or a safety assessment. Always consult a current marine forecast and local experts before surfing.
