import { describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  SolarDeathTime,
  SOLAR_DEATH_UNIX_MS,
  SDT_DATE_MAX,
  SDT_DATE_MIN,
  daysFromCivil,
  fromSolarDeathTime,
  sdtNow,
  toSolarDeathTime,
} from "../src/index";

describe("epoch", () => {
  it("is 5,000,000,000-01-01T00:00:00Z in Unix ms", () => {
    expect(SOLAR_DEATH_UNIX_MS).toBe(157_784_697_832_780_800_000n);
  });

  it("matches Temporal's own calendar math", () => {
    // Temporal can't represent year 5e9, so verify the day algorithm on dates it can.
    for (const iso of ["1970-01-01", "2000-02-29", "2026-10-03", "-271821-04-20", "+275760-09-13"]) {
      const d = Temporal.PlainDate.from(iso);
      const expected = BigInt(
        Temporal.PlainDate.from("1970-01-01").until(d, { largestUnit: "days" }).days,
      );
      expect(daysFromCivil(BigInt(d.year), d.month, d.day)).toBe(expected);
    }
  });

  it("follows the 400-year Gregorian cycle (146,097 days)", () => {
    expect(daysFromCivil(2400n, 1, 1) - daysFromCivil(2000n, 1, 1)).toBe(146_097n);
    // 5e9 is a multiple of 400, so it lines up with year 2000 exactly.
    const cycles = (5_000_000_000n - 2000n) / 400n;
    expect(daysFromCivil(5_000_000_000n, 1, 1)).toBe(daysFromCivil(2000n, 1, 1) + cycles * 146_097n);
  });

  it("SDT 0 is the death of the Sun", () => {
    expect(SolarDeathTime.epoch().toUnixMs()).toBe(SOLAR_DEATH_UNIX_MS);
    expect(SolarDeathTime.fromUnixMs(SOLAR_DEATH_UNIX_MS).value).toBe(0n);
  });
});

describe("Date interop", () => {
  it("Unix epoch is -SOLAR_DEATH_UNIX_MS", () => {
    expect(SolarDeathTime.fromDate(new Date(0)).value).toBe(-SOLAR_DEATH_UNIX_MS);
  });

  it("is -x where x is ms until the Sun dies", () => {
    const d = new Date("2026-10-03T02:15:00.123Z");
    const t = SolarDeathTime.fromDate(d);
    expect(t.value).toBeLessThan(0n);
    expect(t.msUntilDeath()).toBe(SOLAR_DEATH_UNIX_MS - BigInt(d.getTime()));
    expect(t.value).toBe(-t.msUntilDeath());
    expect(SolarDeathTime.fromMsUntilDeath(t.msUntilDeath()).equals(t)).toBe(true);
  });

  it("round-trips Dates exactly", () => {
    for (const ms of [0, 1, -1, 1_759_457_700_123, -62_135_596_800_000, 8.64e15, -8.64e15]) {
      const d = new Date(ms);
      expect(SolarDeathTime.fromDate(d).toDate().getTime()).toBe(ms);
    }
  });

  it("rejects invalid Dates", () => {
    expect(() => SolarDeathTime.fromDate(new Date(NaN))).toThrow(RangeError);
  });

  it("range-checks conversion to Date", () => {
    expect(new SolarDeathTime(SDT_DATE_MAX).toDate().getTime()).toBe(8.64e15);
    expect(new SolarDeathTime(SDT_DATE_MIN).toDate().getTime()).toBe(-8.64e15);
    expect(new SolarDeathTime(SDT_DATE_MAX).add(1).isDateRepresentable()).toBe(false);
    expect(() => new SolarDeathTime(SDT_DATE_MAX + 1n).toDate()).toThrow(RangeError);
    expect(() => SolarDeathTime.epoch().toDate()).toThrow(RangeError);
  });

  it("functional helpers", () => {
    const d = new Date("2000-01-01T00:00:00Z");
    const v = toSolarDeathTime(d);
    expect(typeof v).toBe("bigint");
    expect(fromSolarDeathTime(v).getTime()).toBe(d.getTime());
    expect(fromSolarDeathTime(v.toString()).getTime()).toBe(d.getTime());
  });

  it("now() tracks Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    expect(SolarDeathTime.now().toUnixMs()).toBe(BigInt(Date.UTC(2030, 0, 1)));
    expect(sdtNow()).toBe(BigInt(Date.UTC(2030, 0, 1)) - SOLAR_DEATH_UNIX_MS);
    vi.useRealTimers();
  });
});

describe("Temporal interop", () => {
  it("round-trips Temporal.Instant", () => {
    const inst = Temporal.Instant.from("2026-10-03T02:15:00.123Z");
    const t = SolarDeathTime.fromInstant(inst);
    expect(t.toUnixMs()).toBe(inst.epochNanoseconds / 1_000_000n);
    const back = t.toInstant<Temporal.Instant>(Temporal);
    expect(back.equals(inst)).toBe(true);
  });

  it("floors sub-millisecond precision, including before 1970", () => {
    expect(SolarDeathTime.fromUnixNs(1_999_999n).toUnixMs()).toBe(1n);
    expect(SolarDeathTime.fromUnixNs(-1n).toUnixMs()).toBe(-1n);
  });

  it("throws when Temporal is unavailable", () => {
    expect(() => SolarDeathTime.now().toInstant(undefined)).toThrow(TypeError);
  });

  it("from() accepts an Instant", () => {
    const inst = Temporal.Instant.fromEpochMilliseconds(0);
    expect(SolarDeathTime.from(inst).value).toBe(-SOLAR_DEATH_UNIX_MS);
  });
});

describe("parsing and formatting", () => {
  const t = SolarDeathTime.fromDate(new Date("2026-10-03T00:00:00Z"));

  it("toString / parse round-trip", () => {
    expect(SolarDeathTime.parse(t.toString()).equals(t)).toBe(true);
    expect(t.toString().startsWith("-1577846")).toBe(true);
  });

  it("parse accepts SDT prefix/suffix and bigint literal suffix", () => {
    expect(SolarDeathTime.parse("SDT -123").value).toBe(-123n);
    expect(SolarDeathTime.parse("-123 SDT").value).toBe(-123n);
    expect(SolarDeathTime.parse("-123n").value).toBe(-123n);
    expect(SolarDeathTime.parse("+5").value).toBe(5n);
  });

  it("parse rejects garbage", () => {
    for (const s of ["", "abc", "1.5", "-1e20", "2026-10-03"]) {
      expect(() => SolarDeathTime.parse(s)).toThrow(SyntaxError);
    }
  });

  it("format groups digits", () => {
    expect(new SolarDeathTime(-1234567n).format()).toBe("-1,234,567 SDT");
    expect(new SolarDeathTime(123n).format("_")).toBe("123 SDT");
    expect(SolarDeathTime.epoch().format()).toBe("0 SDT");
  });

  it("JSON round-trips", () => {
    const json = JSON.stringify({ t });
    const parsed = SolarDeathTime.parse(JSON.parse(json).t);
    expect(parsed.equals(t)).toBe(true);
  });

  it("toISOString", () => {
    expect(t.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});

describe("arithmetic and comparison", () => {
  const a = SolarDeathTime.fromDate(new Date("2026-01-01T00:00:00Z"));
  const b = a.add(86_400_000);

  it("add / subtract / until / since", () => {
    expect(b.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(b.subtract(86_400_000n).equals(a)).toBe(true);
    expect(a.until(b)).toBe(86_400_000n);
    expect(b.since(a)).toBe(86_400_000n);
  });

  it("compare sorts chronologically", () => {
    expect([b, a].sort(SolarDeathTime.compare)).toEqual([a, b]);
    expect(SolarDeathTime.compare(a, a)).toBe(0);
  });

  it("relational operators work via toPrimitive", () => {
    expect((a as any) < (b as any)).toBe(true);
    expect((b as any) - (a as any)).toBe(86_400_000n);
    expect(`${a}`).toBe(a.toString());
  });

  it("is immutable", () => {
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("rejects unsafe or fractional numbers", () => {
    expect(() => new SolarDeathTime(1.5)).toThrow(RangeError);
    expect(() => new SolarDeathTime(-1.5e20)).toThrow(RangeError);
    expect(() => a.add(Number.NaN)).toThrow(RangeError);
  });

  it("isBeforeDeath", () => {
    expect(a.isBeforeDeath()).toBe(true);
    expect(SolarDeathTime.epoch().isBeforeDeath()).toBe(false);
  });
});
