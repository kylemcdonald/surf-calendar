# Swell Season scoring model — research and build notes

Last reviewed: August 17, 2026

## What changed

The first atlas assigned each spot-month a single editorial 1–5 trip-planning rating. That was useful for scanning, but it hid the tradeoffs and could not answer a basic quiver question: “good for which board?”

The current model keeps the source-calibrated seasonal windows for all 50 breaks, but treats those windows as inputs rather than final ratings. It generates 600 monthly condition profiles and scores each one independently for a shortboard or longboard. The UI exposes every input and its contribution.

## Research trail

The model began with the physical literature rather than surf-guide star ratings:

- Scarfe, Healy, and Rennie’s review of surfing science identifies breaking wave height, peel angle, breaking intensity, and section length as the essential descriptors of a surfing wave. Those ideas became the model’s **wave-size** and **wave-character** inputs. [University of Waikato research record](https://researchcommons.waikato.ac.nz/items/c4d218a5-4af7-40b3-aaac-9294c8a1554a)
- The Met Office explains why nearshore surf depends on wave height, period, direction, beach slope, and wind relative to the shore. It also notes that 10-second-plus swell is generally more powerful than short-period chop, and that strong onshore or cross-shore wind roughens the surface. Those ideas became **swell period**, **wind alignment**, **wind speed**, and **clean-wind likelihood**. [Met Office beach forecast guide](https://weather.metoffice.gov.uk/guides/coast-and-sea/beach-and-tide-times)
- ERA5’s wave model resolves spectra by frequency and direction, and its monthly means show why a climatology can describe broad seasonal tendencies. ERA5 is also too coarse to reproduce a reef pass, headland wind shadow, or changing sandbar by itself. It informed the variable set and the decision to label outputs as modeled typicals—not the individual values in this atlas. [ECMWF ERA5 documentation](https://confluence.ecmwf.int/pages/viewpage.action?pageId=669811810)
- Board design changes which waves are useful. Longboards favor smaller, slower, rolling waves and struggle in steep barrels; shortboards require more push and fit steeper takeoffs and high-performance sections. Those observations became separate board-fit curves for size, period, and breaking character. [Boardcave longboard guide](https://www.boardcave.com/surf-school/how-to-surf-longboard), [Boardcave shortboard guide](https://www.boardcave.com/surf-school/how-to-surf-shortboard)
- Crowding is not wave physics, but it materially changes ride opportunity, conflict, risk, and satisfaction. It stays in the score at a limited 10% weight so an empty mediocre wave does not outrank a great busy one. [Usher and Gómez, “Managing Stoke”](https://www.js.sagamorepub.com/index.php/jpra/article/view/7596)

The spot-by-spot season windows and descriptions remain calibrated against the 39 regional references in `app/surf-data.ts`: official tourism sources where available, plus specialist spot guides for locations that lack a suitable public authority source.

## Monthly profile

Every spot-month has these modeled characteristics:

1. **Typical surfable face height (ft).** A midpoint for the useful windows in that month, not offshore significant wave height and not the largest set.
2. **Typical swell period (seconds).** A power proxy used together with face height.
3. **Breaking character.** One of slow/rolling, open face, fast/performance, steep/hollow, or heavy/specialist. This is the tractable stand-in for peel speed and breaking intensity when a global atlas cannot resolve local bathymetry.
4. **Clean-wind likelihood.** Estimated percentage of mornings with light, offshore, or usable cross-offshore flow. The card also shows typical morning wind speed and a plain-language offshore/onshore alignment.
5. **Consistency.** Estimated share of days with at least one surfable window; it is not the share of the entire day that is good.
6. **Tide flexibility.** A 1–5 measure of how much of the tide cycle commonly works.
7. **Crowd pressure.** A 1–5 seasonal session-pressure estimate, where 5 is packed.

Weather comfort, water temperature, access, and hazards remain in the written profile but do not enter the quality score. A warm day does not improve a wave, and a dangerous wave should never receive a mathematical “bonus” for consequence. The score is not a safety or skill recommendation.

## Rubric

The score starts as 100 weighted points:

| Factor | Weight | Calculation |
| --- | ---: | --- |
| Board + wave fit | 40 | 45% face-height fit + 20% period fit + 35% breaking-character fit |
| Clean wind | 20 | Monthly clean-morning likelihood |
| Consistency | 20 | Monthly surfable-day likelihood |
| Tide flexibility | 10 | Five-step tolerance scale |
| Crowd pressure | 10 | Inverse of the five-step crowd scale |

The weighted total maps linearly onto 1.0–5.0 and is rounded to one decimal. The score cells use five color bands, while the number preserves the smaller differences.

The two board curves deliberately cross:

- A longboard receives its strongest size fit around 1.5–3.5 ft and its strongest character fit on rolling or open-faced waves.
- A standard shortboard receives its strongest size fit around 4–7 ft and its strongest character fit on fast, performance, or hollow waves.
- XL waves fall off for both toggles because a normal shortboard is not a big-wave gun. The model does not pretend that choosing “shortboard” makes Jaws or Nazaré ordinary equipment territory.

## How the 600 profiles are produced

Each spot has a compact physical/session profile in `app/surf-model.ts`: off-season and prime face height, prime swell period, breaking character, peak consistency, wind-climate family, local wind-shelter adjustment, tide flexibility, and base crowd pressure.

For each month:

1. The spot’s 12-month source-calibrated seasonality index interpolates face height, period, and consistency between off-season and prime values.
2. One of 17 broad morning-wind climatology families supplies wind speed and clean-wind likelihood; a small spot-level adjustment represents known shelter or exposure.
3. Crowd pressure rises modestly in the spot’s better swell window.
4. The board curve evaluates the same physical month profile—only the board/wave fit changes between toggles.
5. The five weighted contributions are summed and converted to the displayed 1–5 score.

This approach makes the assumptions inspectable and keeps all 600 profiles internally consistent. It is more honest than attaching false precision from a coarse offshore grid to a precise reef or sandbar.

## Known limits and next research steps

- These are broad planning estimates, not measured per-break normals and not forecasts.
- Wind direction is shoreline-relative and summarized for mornings; actual land breezes, fronts, trades, and headland shelter vary within a day.
- Face height is especially uncertain at canyon-amplified, rare-event, and highly refractive breaks.
- Crowd pressure is editorial and changes with weekends, holidays, contests, access rules, and publicity.
- Sandbars, reef condition, and tide response change over time.
- The next defensible data upgrade would combine a multi-decade offshore hindcast (height, period, and direction), a shoreline/optimal-swell bearing for every break, hourly wind vectors, tide windows, and locally validated transfer functions. That requires observation or hindcast records at finer resolution than this repository currently carries.

Always use a current marine forecast, check local conditions, and seek local guidance before entering the water.
