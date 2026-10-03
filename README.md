# solar-death-time

**Live demo:** https://arrudagates.github.io/solar-death-time/

A timestamp format that counts **negative milliseconds down to the death of the Sun**.

```
SDT = -(milliseconds until 5,000,000,000-01-01T00:00:00.000Z)
```

- **Zero point:** 1 January 5,000,000,000 CE, 00:00:00.000 UTC, proleptic Gregorian calendar.
  That is `157,784,697,832,780,800,000` ms after the Unix epoch (`SOLAR_DEATH_UNIX_MS`).
- Every instant before the Sun dies is negative; the clock ticks *up* towards 0.
- Right now it reads about `-157,784,696,041,786,761,029 SDT`.
- Values are ~1.58e20, well past `Number.MAX_SAFE_INTEGER`, so SDT values are always `bigint`.
- Leap seconds are ignored, matching JS `Date` and `Temporal` (every day is 86,400,000 ms).

## Install

```sh
npm install solar-death-time
```

## Usage

```ts
import { SolarDeathTime } from "solar-death-time";

const now = SolarDeathTime.now();
now.value;          // -157784696041786761029n
now.msUntilDeath(); //  157784696041786761029n
now.format();       // "-157,784,696,041,786,761,029 SDT"

// Date interop
const t = SolarDeathTime.fromDate(new Date("2026-10-03T00:00:00Z"));
t.toDate();         // Date 2026-10-03T00:00:00.000Z
t.toISOString();    // "2026-10-03T00:00:00.000Z"

// Unix ms interop
SolarDeathTime.fromUnixMs(Date.now());
t.toUnixMs();       // bigint

// Temporal interop (global Temporal, or pass a polyfill)
import { Temporal } from "@js-temporal/polyfill";
SolarDeathTime.fromInstant(Temporal.Now.instant());
t.toInstant<Temporal.Instant>(Temporal);

// Strings & JSON
SolarDeathTime.parse("-157784696073452000000");
SolarDeathTime.parse("SDT -123");     // also "-123 SDT", "-123n"
JSON.stringify({ t });                // {"t":"-1577846..."}

// Arithmetic & comparison (durations in ms)
const tomorrow = t.add(86_400_000);
t.until(tomorrow);                    // 86400000n
[tomorrow, t].sort(SolarDeathTime.compare);
t < tomorrow;                         // true (operators use the bigint value)
```

Functional helpers for code that only deals with `Date`:

```ts
import { toSolarDeathTime, fromSolarDeathTime, sdtNow } from "solar-death-time";

toSolarDeathTime(new Date()); // bigint
fromSolarDeathTime(-157784696073452000000n); // Date
sdtNow(); // bigint
```

## Range

SDT itself is unbounded (it's a `bigint`). JS `Date` only covers ±8.64e15 ms around 1970
(years −271,821 to 275,760), so `toDate()` and `toISOString()` throw `RangeError` outside
`[SDT_DATE_MIN, SDT_DATE_MAX]`. Use `isDateRepresentable()` to check first. In particular the
death of the Sun itself (`SolarDeathTime.epoch()`) can't be shown as a `Date`.

`Temporal.Instant` has the same range limit. Sub-millisecond precision from Temporal is floored.

## API

| Member | Description |
| --- | --- |
| `new SolarDeathTime(value)` | From an SDT value (`bigint`, or a safe-integer `number`) |
| `now()`, `epoch()` | Current instant; the SDT zero point |
| `fromDate`, `fromUnixMs`, `fromUnixNs`, `fromInstant`, `fromMsUntilDeath`, `parse`, `from` | Constructors |
| `.value` | The SDT timestamp (`bigint`) |
| `toDate`, `toUnixMs`, `toUnixNs`, `toInstant`, `toISOString`, `toString`, `toJSON`, `format` | Conversions |
| `msUntilDeath`, `isBeforeDeath`, `isDateRepresentable` | Queries |
| `add`, `subtract`, `until`, `since`, `equals`, `SolarDeathTime.compare` | Arithmetic and ordering |
| `SOLAR_DEATH_UNIX_MS`, `SDT_DATE_MIN`, `SDT_DATE_MAX`, `daysFromCivil` | Constants and calendar helper |

Instances are immutable.

## Demo site

`npm run demo` bundles `demo/` into one self-contained file, `demo/dist/index.html`, which you can open directly in a browser. It shows the live SDT clock, the matching UTC and local date, and a two-way Unix time (ms or s) and SDT converter.

## Development

```sh
npm install
npm test         # vitest
npm run typecheck
npm run build    # emits dist/
```

License: MIT
