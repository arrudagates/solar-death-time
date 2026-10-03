import { SolarDeathTime } from "../src/index";

const MS_PER_YEAR = 31_556_952_000n; // 365.2425 days

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const nowSdt = $("now-sdt");
const nowIso = $("now-iso");
const nowLocal = $("now-local");
const nowUnix = $("now-unix");
const nowYears = $("now-years");

const unixInput = $<HTMLInputElement>("unix-input");
const unixUnit = $<HTMLSelectElement>("unix-unit");
const unixHint = $("unix-hint");
const sdtInput = $<HTMLInputElement>("sdt-input");
const sdtHint = $("sdt-hint");

const group = (n: bigint) => n.toLocaleString("en-US");

function yearsLeft(t: SolarDeathTime): string {
  const ms = t.msUntilDeath();
  const hundredths = (ms * 100n) / MS_PER_YEAR;
  const whole = hundredths / 100n;
  const frac = (hundredths % 100n).toString().padStart(2, "0");
  return `${group(whole)}.${frac}`;
}

function dateText(t: SolarDeathTime): string {
  return t.isDateRepresentable() ? t.toISOString() : "Outside the JavaScript Date range";
}

const localFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

function tick() {
  const t = SolarDeathTime.now();
  nowSdt.textContent = group(t.value);
  nowIso.textContent = t.toISOString();
  nowLocal.textContent = localFmt.format(t.toDate());
  nowUnix.textContent = t.toUnixMs().toString();
  nowYears.textContent = yearsLeft(t);
  requestAnimationFrame(tick);
}

// ---- converter ----------------------------------------------------------

const INT_RE = /^[+-]?\d+$/;

function clean(text: string): string {
  return text.replace(/[,_\s]/g, "").replace(/sdt$/i, "").replace(/^sdt/i, "").replace(/n$/, "");
}

function setHint(el: HTMLElement, input: HTMLInputElement, text: string, error = false) {
  el.textContent = text;
  el.classList.toggle("error", error);
  input.setAttribute("aria-invalid", String(error));
}

function unixMultiplier(): bigint {
  return unixUnit.value === "s" ? 1000n : 1n;
}

function showFromSdt(t: SolarDeathTime, from: "unix" | "sdt" | "none") {
  const unixMs = t.toUnixMs();
  const mult = unixMultiplier();
  if (from !== "unix") {
    // Seconds are floored, matching Math.floor(Date.now() / 1000).
    const v = mult === 1n ? unixMs : (unixMs - ((unixMs % mult) + mult) % mult) / mult;
    unixInput.value = v.toString();
  }
  if (from !== "sdt") sdtInput.value = t.toString();
  setHint(unixHint, unixInput, dateText(t));
  setHint(sdtHint, sdtInput, t.format());
}

function onUnixInput() {
  const raw = clean(unixInput.value);
  if (!INT_RE.test(raw)) {
    setHint(unixHint, unixInput, raw === "" ? "Enter a whole number." : "Use digits only, with an optional minus sign.", true);
    return;
  }
  showFromSdt(SolarDeathTime.fromUnixMs(BigInt(raw) * unixMultiplier()), "unix");
}

function onSdtInput() {
  const raw = clean(sdtInput.value);
  if (!INT_RE.test(raw)) {
    setHint(sdtHint, sdtInput, raw === "" ? "Enter a whole number." : "Use digits only, with an optional minus sign.", true);
    return;
  }
  showFromSdt(new SolarDeathTime(BigInt(raw)), "sdt");
}

unixInput.addEventListener("input", onUnixInput);
sdtInput.addEventListener("input", onSdtInput);
unixUnit.addEventListener("change", () => {
  // Keep the SDT side fixed and re-express it in the new unit.
  if (sdtInput.getAttribute("aria-invalid") !== "true") onSdtInput();
});

$("use-now").addEventListener("click", () => showFromSdt(SolarDeathTime.now(), "none"));
$("use-epoch").addEventListener("click", () => showFromSdt(SolarDeathTime.fromUnixMs(0), "none"));
$("use-death").addEventListener("click", () => showFromSdt(SolarDeathTime.epoch(), "none"));

const copyBtn = $<HTMLButtonElement>("copy-sdt");
copyBtn.addEventListener("click", () => {
  const text = sdtInput.value;
  navigator.clipboard?.writeText(text).then(
    () => { copyBtn.textContent = "Copied"; setTimeout(() => (copyBtn.textContent = "Copy SDT"), 1400); },
    () => { sdtInput.focus(); sdtInput.select(); },
  ) ?? (sdtInput.focus(), sdtInput.select());
});

showFromSdt(SolarDeathTime.now(), "none");
tick();
