/**
 * Solar Death Time (SDT)
 *
 * A timestamp format that counts milliseconds relative to the death of the Sun,
 * defined as 5,000,000,000-01-01T00:00:00.000Z (proleptic Gregorian calendar, UTC).
 *
 * An SDT timestamp is `-x`, where `x` is the number of milliseconds remaining until
 * that instant. Every moment before the Sun dies is therefore negative, and the
 * count ticks up towards 0. Instants after the epoch (should anyone be around)
 * are positive.
 *
 * Values are around -1.578e20, far beyond Number.MAX_SAFE_INTEGER (~9.007e15),
 * so SDT values are always represented as `bigint`.
 */

/** Days from 1970-01-01 to the given proleptic Gregorian civil date (H. Hinnant's algorithm). */
export function daysFromCivil(year: bigint, month: number, day: number): bigint {
  const y = month <= 2 ? year - 1n : year;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n;
  const m = BigInt(month);
  const mp = m > 2n ? m - 3n : m + 9n;
  const doy = (153n * mp + 2n) / 5n + BigInt(day) - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146097n + doe - 719468n;
}

const MS_PER_DAY = 86_400_000n;

/** The year of the Sun's death, per this library's definition. */
export const SOLAR_DEATH_YEAR = 5_000_000_000n;

/**
 * Unix epoch milliseconds of the SDT zero point,
 * 5,000,000,000-01-01T00:00:00.000Z = 157,784,697,832,780,800,000 ms after 1970-01-01T00:00:00Z.
 */
export const SOLAR_DEATH_UNIX_MS: bigint = daysFromCivil(SOLAR_DEATH_YEAR, 1, 1) * MS_PER_DAY;

/** Largest absolute Unix-ms value a JS `Date` can hold (±100,000,000 days). */
export const DATE_MAX_UNIX_MS = 8_640_000_000_000_000n;

/** SDT range that can be converted to a JS `Date`. */
export const SDT_DATE_MIN: bigint = -DATE_MAX_UNIX_MS - SOLAR_DEATH_UNIX_MS;
export const SDT_DATE_MAX: bigint = DATE_MAX_UNIX_MS - SOLAR_DEATH_UNIX_MS;

/** Minimal structural shape of `Temporal.Instant`, so no Temporal polyfill/types are required. */
export interface InstantLike {
  readonly epochNanoseconds: bigint;
}

/** Anything that can be turned into a SolarDeathTime. */
export type SolarDeathTimeInput = SolarDeathTime | bigint | number | string | Date | InstantLike;

const INTEGER_RE = /^\s*(?:SDT\s*)?([+-]?\d+)n?\s*(?:SDT)?\s*$/i;

function toBigIntMs(value: number | bigint, what: string): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError(`${what} must be a finite integer, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what} ${value} is not a safe integer; pass a bigint instead`);
  }
  return BigInt(value);
}

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
}

function getTemporal(): any {
  return (globalThis as any).Temporal;
}

/**
 * An immutable instant expressed in Solar Death Time.
 *
 * `value` is the SDT timestamp in milliseconds (negative before the Sun's death).
 */
export class SolarDeathTime {
  /** SDT milliseconds: `-(ms until the Sun dies)`. */
  readonly value: bigint;

  constructor(value: bigint | number) {
    this.value = toBigIntMs(value, "SDT value");
    Object.freeze(this);
  }

  // ---- construction ----------------------------------------------------

  /** The current instant (millisecond precision, via `Date.now()`). */
  static now(): SolarDeathTime {
    return SolarDeathTime.fromUnixMs(Date.now());
  }

  /** The SDT zero point itself: the death of the Sun. */
  static epoch(): SolarDeathTime {
    return new SolarDeathTime(0n);
  }

  /** From a JS `Date`. Throws on an invalid date. */
  static fromDate(date: Date): SolarDeathTime {
    const ms = date.getTime();
    if (Number.isNaN(ms)) throw new RangeError("Invalid Date");
    return SolarDeathTime.fromUnixMs(ms);
  }

  /** From Unix epoch milliseconds (as returned by `Date.now()` / `date.getTime()`). */
  static fromUnixMs(unixMs: number | bigint): SolarDeathTime {
    return new SolarDeathTime(toBigIntMs(unixMs, "Unix ms") - SOLAR_DEATH_UNIX_MS);
  }

  /** From Unix epoch nanoseconds; truncated towards -∞ to whole milliseconds. */
  static fromUnixNs(unixNs: bigint): SolarDeathTime {
    return SolarDeathTime.fromUnixMs(floorDiv(unixNs, 1_000_000n));
  }

  /** From a `Temporal.Instant` (or any object exposing `epochNanoseconds: bigint`). */
  static fromInstant(instant: InstantLike): SolarDeathTime {
    return SolarDeathTime.fromUnixNs(instant.epochNanoseconds);
  }

  /** From the number of milliseconds remaining until the Sun dies (i.e. `x` in `-x`). */
  static fromMsUntilDeath(ms: number | bigint): SolarDeathTime {
    return new SolarDeathTime(-toBigIntMs(ms, "ms until death"));
  }

  /**
   * Parse an SDT string. Accepts an integer with optional sign, optional trailing `n`,
   * and an optional `SDT` prefix or suffix: `"-157784696073...000"`, `"SDT -123"`, `"-123 SDT"`.
   */
  static parse(text: string): SolarDeathTime {
    const match = INTEGER_RE.exec(text);
    if (!match) throw new SyntaxError(`Invalid Solar Death Time string: ${JSON.stringify(text)}`);
    return new SolarDeathTime(BigInt(match[1]));
  }

  /**
   * Coerce any supported input. Numbers and bigints are interpreted as SDT values;
   * strings are parsed with `parse()`; Dates and Instants are converted.
   */
  static from(input: SolarDeathTimeInput): SolarDeathTime {
    if (input instanceof SolarDeathTime) return input;
    if (input instanceof Date) return SolarDeathTime.fromDate(input);
    if (typeof input === "string") return SolarDeathTime.parse(input);
    if (typeof input === "number" || typeof input === "bigint") return new SolarDeathTime(input);
    if (input && typeof (input as InstantLike).epochNanoseconds === "bigint") {
      return SolarDeathTime.fromInstant(input);
    }
    throw new TypeError("Cannot convert value to SolarDeathTime");
  }

  // ---- conversion ------------------------------------------------------

  /** Unix epoch milliseconds as a bigint (always exact). */
  toUnixMs(): bigint {
    return this.value + SOLAR_DEATH_UNIX_MS;
  }

  /** Unix epoch nanoseconds as a bigint. */
  toUnixNs(): bigint {
    return this.toUnixMs() * 1_000_000n;
  }

  /** Whether this instant falls inside the range a JS `Date` can represent. */
  isDateRepresentable(): boolean {
    const u = this.toUnixMs();
    return u >= -DATE_MAX_UNIX_MS && u <= DATE_MAX_UNIX_MS;
  }

  /** Convert to a JS `Date`. Throws RangeError outside ±8.64e15 ms of 1970. */
  toDate(): Date {
    if (!this.isDateRepresentable()) {
      throw new RangeError(`SDT ${this.value} is outside the range of a JS Date`);
    }
    return new Date(Number(this.toUnixMs()));
  }

  /**
   * Convert to a `Temporal.Instant`. Uses the global `Temporal` unless a
   * Temporal implementation (e.g. a polyfill) is passed in.
   */
  toInstant<T = unknown>(temporal: any = getTemporal()): T {
    if (!temporal?.Instant?.fromEpochNanoseconds) {
      throw new TypeError("Temporal is not available; pass a Temporal implementation");
    }
    return temporal.Instant.fromEpochNanoseconds(this.toUnixNs());
  }

  /** Milliseconds left until the Sun dies (`x` in `-x`). Negative after the epoch. */
  msUntilDeath(): bigint {
    return -this.value;
  }

  /** True if this instant is before the death of the Sun. */
  isBeforeDeath(): boolean {
    return this.value < 0n;
  }

  // ---- arithmetic & comparison ----------------------------------------

  /** Add a duration in milliseconds. */
  add(ms: number | bigint): SolarDeathTime {
    return new SolarDeathTime(this.value + toBigIntMs(ms, "duration"));
  }

  /** Subtract a duration in milliseconds. */
  subtract(ms: number | bigint): SolarDeathTime {
    return new SolarDeathTime(this.value - toBigIntMs(ms, "duration"));
  }

  /** Milliseconds from this instant until `other` (positive if `other` is later). */
  until(other: SolarDeathTimeInput): bigint {
    return SolarDeathTime.from(other).value - this.value;
  }

  /** Milliseconds from `other` until this instant (positive if this is later). */
  since(other: SolarDeathTimeInput): bigint {
    return this.value - SolarDeathTime.from(other).value;
  }

  equals(other: SolarDeathTimeInput): boolean {
    return SolarDeathTime.from(other).value === this.value;
  }

  /** -1, 0, or 1. Suitable for `Array.prototype.sort`. */
  static compare(a: SolarDeathTimeInput, b: SolarDeathTimeInput): -1 | 0 | 1 {
    const x = SolarDeathTime.from(a).value;
    const y = SolarDeathTime.from(b).value;
    return x < y ? -1 : x > y ? 1 : 0;
  }

  // ---- formatting -----------------------------------------------------

  /** The SDT value as a decimal integer string, e.g. `"-157784696073452000000"`. */
  toString(): string {
    return this.value.toString();
  }

  /** JSON form is the decimal string, since JSON cannot carry bigints. Round-trips via `parse()`. */
  toJSON(): string {
    return this.toString();
  }

  /** ISO 8601 string of the corresponding instant (Date range only). */
  toISOString(): string {
    return this.toDate().toISOString();
  }

  /**
   * Format with digit grouping and an `SDT` suffix, e.g. `"-157,784,696,073,452,000,000 SDT"`.
   * `separator` defaults to `","`.
   */
  format(separator = ","): string {
    const neg = this.value < 0n;
    const digits = (neg ? -this.value : this.value).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${neg ? "-" : ""}${grouped} SDT`;
  }

  /** Lets `<`, `>`, and `-` work directly: they operate on the bigint value. */
  [Symbol.toPrimitive](hint: string): bigint | string {
    return hint === "string" ? this.toString() : this.value;
  }

  get [Symbol.toStringTag](): string {
    return "SolarDeathTime";
  }
}

// ---- functional helpers for Date users ---------------------------------

/** SDT value (bigint) for a Date, or for now if omitted. */
export function toSolarDeathTime(date: Date = new Date()): bigint {
  return SolarDeathTime.fromDate(date).value;
}

/** JS Date for an SDT value. Throws RangeError outside the Date range. */
export function fromSolarDeathTime(sdt: bigint | number | string): Date {
  return SolarDeathTime.from(sdt).toDate();
}

/** Current SDT value as a bigint. */
export function sdtNow(): bigint {
  return SolarDeathTime.now().value;
}

export default SolarDeathTime;
