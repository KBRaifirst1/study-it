import React from "react";

/* ===========================================================================
   ELEMENTS — physics and chemistry, elementary to AP.
   Single file. React is the only dependency.

   Version: 2026-08-16-v0.1.0

   The same two rules that run Mathema run this, plus one the subject demands:

     1. HOW YOU GET THERE DOESN'T MATTER. No question stores an answer; each
        stores a test an answer has to pass. In science that has to mean more
        than it does in math, because a physical answer carries a unit and a
        precision: 9.81 m/s^2, 9.81 m s^-2, 981 cm/s^2 and 0.00981 km/s^2 are
        the same acceleration, and a checker that marks three of them wrong is
        telling a learner they are wrong when they are right.

     2. NOTHING IS EXPLAINED BY GUESSWORK. Questions are built from chosen
        quantities, recording each move; played back, those moves are the
        worked solution. No language model writes the physics.

     3. UNREADABLE IS NOT WRONG. A mistyped unit is not a physics mistake. The
        checker distinguishes "this is incorrect" from "I could not read this"
        and the app never conflates them, because only one of those is the
        learner's error.

   The checker below is inlined verbatim from the tested source. It runs in
   Node, which is how it gets tested: units, significant figures, formulae and
   equation balancing, all of it.
   =========================================================================== */
/* eslint-disable */

const ELEMENTS_VERSION = "2026-08-16-v0.1.0";

/* ------------------------------- CHECKER ------------------------------- */
const CHK = (function () {
  "use strict";

  /* ---------------------------------------------------------------------------
     DIMENSIONS

     Every unit is stored as a scale factor plus a vector of the seven SI base
     dimensions. Comparing two quantities is then exact: convert both to base
     units and compare the vectors. Newtons and kg·m/s² come out identical
     because they ARE identical, not because a lookup table was told so.
     --------------------------------------------------------------------------- */
  const BASE = ["kg", "m", "s", "A", "K", "mol", "cd"];
  const zero = () => [0, 0, 0, 0, 0, 0, 0];
  const dim = (o) => BASE.map((b) => o[b] || 0);

  // unit -> { scale (to SI base), d (dimension vector), offset (for temperature) }
  const UNITS = {
    // mass
    kg: { s: 1, d: dim({ kg: 1 }) }, g: { s: 1e-3, d: dim({ kg: 1 }) },
    mg: { s: 1e-6, d: dim({ kg: 1 }) }, t: { s: 1e3, d: dim({ kg: 1 }) },
    u: { s: 1.66053906660e-27, d: dim({ kg: 1 }) },
    // length
    m: { s: 1, d: dim({ m: 1 }) }, km: { s: 1e3, d: dim({ m: 1 }) },
    cm: { s: 1e-2, d: dim({ m: 1 }) }, mm: { s: 1e-3, d: dim({ m: 1 }) },
    um: { s: 1e-6, d: dim({ m: 1 }) }, nm: { s: 1e-9, d: dim({ m: 1 }) },
    pm: { s: 1e-12, d: dim({ m: 1 }) }, A_: { s: 1e-10, d: dim({ m: 1 }) },
    // time
    s: { s: 1, d: dim({ s: 1 }) }, ms: { s: 1e-3, d: dim({ s: 1 }) },
    us: { s: 1e-6, d: dim({ s: 1 }) }, ns: { s: 1e-9, d: dim({ s: 1 }) },
    min: { s: 60, d: dim({ s: 1 }) }, h: { s: 3600, d: dim({ s: 1 }) },
    hr: { s: 3600, d: dim({ s: 1 }) }, day: { s: 86400, d: dim({ s: 1 }) },
    yr: { s: 3.1557e7, d: dim({ s: 1 }) },
    // current, temperature, amount, luminosity
    A: { s: 1, d: dim({ A: 1 }) }, mA: { s: 1e-3, d: dim({ A: 1 }) },
    K: { s: 1, d: dim({ K: 1 }) },
    degC: { s: 1, d: dim({ K: 1 }), offset: 273.15 },
    mol: { s: 1, d: dim({ mol: 1 }) }, mmol: { s: 1e-3, d: dim({ mol: 1 }) },
    cd: { s: 1, d: dim({ cd: 1 }) },
    // derived
    N: { s: 1, d: dim({ kg: 1, m: 1, s: -2 }) }, kN: { s: 1e3, d: dim({ kg: 1, m: 1, s: -2 }) },
  // The small-prefix forms too. Leaving them out meant a correct answer written
  // as 15000 mN was refused as unreadable — which is a checker telling someone
  // they are wrong for using a unit it had simply never been taught.
  mN: { s: 1e-3, d: dim({ kg: 1, m: 1, s: -2 }) }, MN: { s: 1e6, d: dim({ kg: 1, m: 1, s: -2 }) },
  uN: { s: 1e-6, d: dim({ kg: 1, m: 1, s: -2 }) },
  "V/m": { s: 1, d: dim({ kg: 1, m: 1, s: -3, A: -1 }) },
  mJ: { s: 1e-3, d: dim({ kg: 1, m: 2, s: -2 }) },
  mW: { s: 1e-3, d: dim({ kg: 1, m: 2, s: -3 }) }, GW: { s: 1e9, d: dim({ kg: 1, m: 2, s: -3 }) },
  kV: { s: 1e3, d: dim({ kg: 1, m: 2, s: -3, A: -1 }) },
  uA: { s: 1e-6, d: dim({ A: 1 }) }, kA: { s: 1e3, d: dim({ A: 1 }) },
  Mohm: { s: 1e6, d: dim({ kg: 1, m: 2, s: -3, A: -2 }) },
  mC: { s: 1e-3, d: dim({ s: 1, A: 1 }) },
  // Micro- and nano-coulombs. Capacitor questions are written in µC because
  // that is the size real capacitors work at; without these the checker
  // refused a correct answer as unreadable.
  uC: { s: 1e-6, d: dim({ s: 1, A: 1 }) }, nC: { s: 1e-9, d: dim({ s: 1, A: 1 }) },
  kJmol: { s: 1, d: zero() },
  MHz: { s: 1e6, d: dim({ s: -1 }) }, GHz: { s: 1e9, d: dim({ s: -1 }) },
  hPa: { s: 100, d: dim({ kg: 1, m: -1, s: -2 }) },
  kmh: { s: 1 / 3.6, d: dim({ m: 1, s: -1 }) },
    J: { s: 1, d: dim({ kg: 1, m: 2, s: -2 }) }, kJ: { s: 1e3, d: dim({ kg: 1, m: 2, s: -2 }) },
    MJ: { s: 1e6, d: dim({ kg: 1, m: 2, s: -2 }) },
    eV: { s: 1.602176634e-19, d: dim({ kg: 1, m: 2, s: -2 }) },
    W: { s: 1, d: dim({ kg: 1, m: 2, s: -3 }) }, kW: { s: 1e3, d: dim({ kg: 1, m: 2, s: -3 }) },
    MW: { s: 1e6, d: dim({ kg: 1, m: 2, s: -3 }) },
    Pa: { s: 1, d: dim({ kg: 1, m: -1, s: -2 }) }, kPa: { s: 1e3, d: dim({ kg: 1, m: -1, s: -2 }) },
    MPa: { s: 1e6, d: dim({ kg: 1, m: -1, s: -2 }) },
    atm: { s: 101325, d: dim({ kg: 1, m: -1, s: -2 }) },
    bar: { s: 1e5, d: dim({ kg: 1, m: -1, s: -2 }) },
    V: { s: 1, d: dim({ kg: 1, m: 2, s: -3, A: -1 }) },
    mV: { s: 1e-3, d: dim({ kg: 1, m: 2, s: -3, A: -1 }) },
    ohm: { s: 1, d: dim({ kg: 1, m: 2, s: -3, A: -2 }) },
    kohm: { s: 1e3, d: dim({ kg: 1, m: 2, s: -3, A: -2 }) },
    C: { s: 1, d: dim({ s: 1, A: 1 }) },
  F: { s: 1, d: dim({ kg: -1, m: -2, s: 4, A: 2 }) }, uF: { s: 1e-6, d: dim({ kg: -1, m: -2, s: 4, A: 2 }) },
  nF: { s: 1e-9, d: dim({ kg: -1, m: -2, s: 4, A: 2 }) }, pF: { s: 1e-12, d: dim({ kg: -1, m: -2, s: 4, A: 2 }) },
    Hz: { s: 1, d: dim({ s: -1 }) }, kHz: { s: 1e3, d: dim({ s: -1 }) },
  T: { s: 1, d: dim({ kg: 1, s: -2, A: -1 }) }, mT: { s: 1e-3, d: dim({ kg: 1, s: -2, A: -1 }) },
  Bq: { s: 1, d: dim({ s: -1 }) },
    L: { s: 1e-3, d: dim({ m: 3 }) }, mL: { s: 1e-6, d: dim({ m: 3 }) },
  // Chemistry writes volumes as decimetres and centimetres cubed. A dm³ is a
  // liter and a cm³ is a millilitre, so "mol/dm^3" and "mol/L" are the same
  // concentration and both have to pass.
  dm: { s: 1e-1, d: dim({ m: 1 }) },
    // dimensionless
    mol_: { s: 1, d: zero() },
  };

  // Written forms that mean the same unit. Kept explicit rather than clever:
  // a learner types °C, degC, or C-for-Celsius, and all three are the same key.
  const ALIAS = {
    "°c": "degC", "degreec": "degC", "celsius": "degC", "°k": "K", "kelvin": "K",
    "å": "A_", "angstrom": "A_", "μm": "um", "µm": "um", "μs": "us", "µs": "us",
    "ω": "ohm", "Ω": "ohm", "kω": "kohm", "ohms": "ohm",
    "second": "s", "seconds": "s", "sec": "s", "secs": "s",
    "metre": "m", "meter": "m", "metres": "m", "meters": "m",
    "gram": "g", "grams": "g", "kilogram": "kg", "kilograms": "kg",
    "newton": "N", "newtons": "N", "joule": "J", "joules": "J",
    "watt": "W", "watts": "W", "volt": "V", "volts": "V",
    "litre": "L", "liter": "L", "litres": "L", "liters": "L",
    "minute": "min", "minutes": "min", "hour": "h", "hours": "h",
    "mole": "mol", "moles": "mol",
  "dm3": "L", "dm^3": "L", "cm3": "mL", "cm^3": "mL", "m3": "m3_",
  "km/h": "kmh", "kph": "kmh", "megaohm": "Mohm", "kilohm": "kohm",
  };

  function unitKey(raw) {
    const t = String(raw).trim();
    if (UNITS[t]) return t;                       // exact, case-sensitive: mS is not ms
    const low = t.toLowerCase();
    if (ALIAS[low]) return ALIAS[low];
    if (ALIAS[t]) return ALIAS[t];
    /* SI PREFIXES, handled generically.

       Three separate bugs shipped from enumerating prefixed units by hand —
       mol/dm^3, uC and uN — each one a topic whose every question failed its
       own answer because a unit had never been typed into the table. Listing
       all ninety prefix-and-base combinations would be the same mistake with
       more rows.

       So: when the exact name is unknown, strip a known prefix and look the
       REMAINDER up as a base unit. The exact table is consulted first, so
       deliberate entries (min, mol, nm) still win over any prefix reading.

       Still no case-insensitive fallback. In SI, case IS the meaning: mS is
       millisiemens and ms is milliseconds; K is kelvin and k is kilo. */
    var PREFIX = { n: 1e-9, u: 1e-6, "\u00b5": 1e-6, m: 1e-3, c: 1e-2, d: 1e-1,
                   k: 1e3, M: 1e6, G: 1e9 };
    var BASEU = ["N", "J", "W", "V", "A", "C", "F", "Hz", "Pa", "m", "g", "s",
                 "L", "mol", "ohm", "T", "K"];
    if (t.length > 1) {
      var pfx = t.charAt(0), rest = t.slice(1);
      if (PREFIX[pfx] && BASEU.indexOf(rest) !== -1 && UNITS[rest]) {
        var bu = UNITS[rest];
        UNITS[t] = { s: bu.s * PREFIX[pfx], d: bu.d.slice() };   // cached
        return t;
      }
    }
    return null;
  }

  /* Parse a unit expression: "m/s^2", "kg m s^-2", "J/(mol K)", "m s^-1".
     Returns { s, d } or null. Null means "not understood", which the caller
     must treat as a refusal, never as a wrong answer. */
  function parseUnit(text) {
    const raw = String(text || "").trim();
    if (!raw) return { s: 1, d: zero(), dimensionless: true };

    let s = 1, d = zero(), ok = false;
    // Split on / at depth 0, so J/(mol K) divides by the whole bracket.
    const parts = [];
    let depth = 0, cur = "", sign = 1;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === "(") { depth++; cur += c; }
      else if (c === ")") { depth--; cur += c; }
      else if (c === "/" && depth === 0) { parts.push({ text: cur, sign: sign }); cur = ""; sign = -1; }
      else cur += c;
    }
    parts.push({ text: cur, sign: sign });

    for (const part of parts) {
      let body = part.text.trim().replace(/^\((.*)\)$/, "$1");
      if (!body) continue;
      // factors separated by space, · or *
      for (const factor of body.split(/[\s*·]+/)) {
        if (!factor) continue;
        const m = factor.match(/^([A-Za-zµμΩ°_]+)(?:\^?(-?\d+))?$/);
        if (!m) return null;
        const key = unitKey(m[1]);
        if (!key) return null;
        const p = (m[2] ? parseInt(m[2], 10) : 1) * part.sign;
        const u = UNITS[key];
        if (u.offset && p !== 1) return null;      // °C² is not a thing anyone means
        s *= Math.pow(u.s, p);
        for (let k = 0; k < d.length; k++) d[k] += u.d[k] * p;
        ok = true;
      }
    }
    if (!ok) return null;
    return { s: s, d: d, offset: parts.length === 1 && UNITS[unitKey(parts[0].text.trim()) || ""] ?
      UNITS[unitKey(parts[0].text.trim())].offset : undefined };
  }

  /* ---------------------------------------------------------------------------
     SIGNIFICANT FIGURES

     Counted from what was written, not from the value. "0.00250" has three; the
     trailing zero is information and the leading ones are not. "2500" is
     ambiguous in every textbook ever written, so it is reported as ambiguous
     rather than guessed at — a checker that silently decides is a checker that
     is silently wrong some of the time.
     --------------------------------------------------------------------------- */
  function sigFigs(text) {
    const t = String(text).trim().replace(/^[+-]/, "");
    const sci = t.match(/^(\d+(?:\.\d+)?)[eE][+-]?\d+$/);
    if (sci) return { n: countSig(sci[1]), ambiguous: false };
    // "100." — a trailing point is the conventional way of saying the zeros
    // count. Written without it, 100 is ambiguous and is reported as such.
    if (/^\d+\.$/.test(t)) return { n: t.replace(/[.]/, "").replace(/^0+/, "").length || 1, ambiguous: false };
    if (!/^\d*\.?\d+$/.test(t)) return { n: null, ambiguous: false };
    if (t.indexOf(".") === -1 && /0$/.test(t) && t !== "0") {
      // 2500 could be 2, 3 or 4 sig figs. Say so rather than choose.
      return { n: countSig(t), ambiguous: true };
    }
    return { n: countSig(t), ambiguous: false };
  }
  function countSig(t) {
    let s = t.replace(".", "");
    s = s.replace(/^0+/, "");                       // leading zeros never count
    if (t.indexOf(".") === -1) s = s.replace(/0+$/, "");  // trailing zeros in an integer don't
    return s.length || 1;
  }

  /* ---------------------------------------------------------------------------
     QUANTITIES
     --------------------------------------------------------------------------- */
  function parseQuantity(text) {
    let t = String(text == null ? "" : text).trim();
    if (!t) return null;
    t = t.replace(/\u2212/g, "-").replace(/\u00d7\s*10\s*\^?/g, "e").replace(/\s*x\s*10\s*\^/gi, "e");
    const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
    if (!m) return null;
    const value = parseFloat(m[1]);
    if (!isFinite(value)) return null;
    const unit = parseUnit(m[2]);
    if (unit === null) return null;                 // unreadable unit: refuse, don't guess
    const sf = sigFigs(m[1]);
    const base = unit.offset ? (value + unit.offset) * unit.s : value * unit.s;
    return {
      value: value, unitText: m[2].trim(), scale: unit.s, d: unit.d,
      base: base, sig: sf.n, sigAmbiguous: sf.ambiguous,
      dimensionless: unit.d.every((x) => x === 0)
    };
  }

  const sameDim = (a, b) => a.every((x, i) => x === b[i]);

  /* Check an answer against an expected quantity.

     Returns one of:
       { ok: true }                              — right, however it was written
       { ok: false, why: "…" }                   — genuinely wrong
       { unreadable: true, why: "…" }            — could not be read; NOT wrong

     The third case is the one most checkers get wrong by folding it into the
     second. A learner who mistypes a unit has not made a physics mistake. */
  function checkQuantity(given, expected, opts) {
    const o = opts || {};
    const g = parseQuantity(given);
    if (!g) return { unreadable: true, why: "That answer couldn't be read." };
    const e = typeof expected === "string" ? parseQuantity(expected) : expected;
    if (!e) return { unreadable: true, why: "The expected answer couldn't be read." };

    if (!sameDim(g.d, e.d)) {
      if (g.dimensionless && !e.dimensionless) {
        return { ok: false, why: "That's the right kind of number but it needs a unit." };
      }
      return { ok: false, why: "That isn't the right kind of quantity — check the units." };
    }

    const tol = o.tol == null ? 0.005 : o.tol;      // 0.5% unless the question says otherwise
    const denom = Math.abs(e.base) > 1e-30 ? Math.abs(e.base) : 1;
    const close = Math.abs(g.base - e.base) / denom <= tol;
    if (!close) return { ok: false, why: "Not the right value." };

    // Significant figures are only judged when the question actually asked.
    if (o.sigFigs) {
      if (g.sigAmbiguous) {
        return { unreadable: true, why: "How many significant figures that is depends on how it's written — try standard form." };
      }
      if (g.sig !== o.sigFigs) {
        return { ok: false, why: "Right value, but it should be given to " + o.sigFigs + " significant figures." };
      }
    }
    return { ok: true };
  }

  /* ---------------------------------------------------------------------------
     CHEMISTRY

     Two things here are checkable the way code is checkable, which is why they
     belong in this app at all: a formula has a definite molar mass, and an
     equation either conserves atoms and charge or it does not. No judgment,
     no model, no tolerance beyond the arithmetic.
     --------------------------------------------------------------------------- */
  const ATOMIC = {
    H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007,
    O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305, Al: 26.982,
    Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098,
    Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938,
    Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723,
    Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468,
    Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Ag: 107.87,
    Cd: 112.41, Sn: 118.71, Sb: 121.76, I: 126.90, Xe: 131.29, Cs: 132.91,
    Ba: 137.33, Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2, U: 238.03,
  };

  /* Count atoms in a formula, brackets and hydrates included:
     Ca(OH)2, CuSO4·5H2O, Fe2(SO4)3. Returns null on anything it cannot read. */
  function atomCounts(formula) {
    const src = String(formula || "").replace(/\s+/g, "");
    if (!src) return null;
    // hydrates: split on · or . between parts, each with its own multiplier
    const chunks = src.split(/[·\u00b7.]/);
    const total = {};
    for (const chunk of chunks) {
      const lead = chunk.match(/^(\d+)(.*)$/);
      const mult = lead ? parseInt(lead[1], 10) : 1;
      const body = lead ? lead[2] : chunk;
      const got = countGroup(body);
      if (!got) return null;
      for (const el in got) total[el] = (total[el] || 0) + got[el] * mult;
    }
    return Object.keys(total).length ? total : null;
  }
  function countGroup(text) {
    const out = {};
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === "(" || c === "[") {
        let depth = 1, j = i + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === "(" || text[j] === "[") depth++;
          else if (text[j] === ")" || text[j] === "]") depth--;
          j++;
        }
        if (depth !== 0) return null;
        const inner = countGroup(text.slice(i + 1, j - 1));
        if (!inner) return null;
        const nm = text.slice(j).match(/^(\d+)/);
        const n = nm ? parseInt(nm[1], 10) : 1;
        for (const el in inner) out[el] = (out[el] || 0) + inner[el] * n;
        i = j + (nm ? nm[1].length : 0);
        continue;
      }
      const m = text.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
      if (!m || !ATOMIC[m[1]]) return null;
      out[m[1]] = (out[m[1]] || 0) + (m[2] ? parseInt(m[2], 10) : 1);
      i += m[0].length;
    }
    return Object.keys(out).length ? out : null;
  }

  function molarMass(formula) {
    const c = atomCounts(formula);
    if (!c) return null;
    let m = 0;
    for (const el in c) m += ATOMIC[el] * c[el];
    return m;
  }

  /* Is this equation balanced? Parsed and counted, not pattern-matched.
     "2H2 + O2 -> 2H2O" is checked by counting H and O on both sides. */
  function isBalanced(equation) {
    const sides = String(equation || "").split(/->|=>|→|=/);
    if (sides.length !== 2) return { ok: false, why: "That doesn't look like an equation with two sides." };
    const tally = (side) => {
      const out = {};
      for (const term of side.split("+")) {
        const t = term.trim().replace(/\([slgaq]+\)$/i, "");
        if (!t) continue;
        const m = t.match(/^(\d+)?\s*(.+)$/);
        const n = m[1] ? parseInt(m[1], 10) : 1;
        const c = atomCounts(m[2]);
        if (!c) return null;
        for (const el in c) out[el] = (out[el] || 0) + c[el] * n;
      }
      return out;
    };
    const L = tally(sides[0]), R = tally(sides[1]);
    if (!L || !R) return { unreadable: true, why: "A formula in that equation couldn't be read." };
    const els = new Set(Object.keys(L).concat(Object.keys(R)));
    const off = [];
    els.forEach((el) => { if ((L[el] || 0) !== (R[el] || 0)) off.push(el + ": " + (L[el] || 0) + " left, " + (R[el] || 0) + " right"); });
    return off.length ? { ok: false, why: "Not balanced — " + off.join("; ") } : { ok: true };
  }


  return { parseUnit, parseQuantity, checkQuantity, sigFigs,
           atomCounts, molarMass, isBalanced, UNITS, ATOMIC };
})();

/* --------------------------- SEEDED RANDOM ----------------------------
   Every question is a pure function of its seed, so a question can be rebuilt
   for review, for a retry, and for a test — and a bug found in the wild can be
   reproduced exactly.
   ---------------------------------------------------------------------- */
function rng(seed) {
  let x = (seed | 0) || 1;
  return function () {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const sig = (v, n) => Number(v.toPrecision(n));

/* Write a value to exactly n significant figures, AS TEXT.

   `sig` returns a number, and a number cannot carry its own precision: rounding
   20.04 to three significant figures gives 20, which reads as one. A question
   that demands three significant figures and offers "20" as the answer is
   asking for something its own answer does not express — so wherever sigFigs
   is set, the expected answer is written with this instead. */
function sigText(v, n) {
  if (!isFinite(v)) return String(v);
  const t = Number(v).toPrecision(n);
  // toPrecision gives exponential form for very large or small values; that is
  // unambiguous already, so it is left alone.
  if (/e/i.test(t)) return t;
  if (t.indexOf(".") !== -1) return t;
  // An integer with trailing zeros is ambiguous written bare. A trailing point
  // is the conventional way of saying the zeros count, and the checker reads it.
  // Any integer ending in a zero is ambiguous written bare — "530" could be two
  // or three significant figures. The length of the number has nothing to do
  // with it, which an earlier version of this line got wrong.
  return /0$/.test(t) ? t + "." : t;
}
const step = (say, paper) => ({ say: say, paper: paper || null });

/* ------------------------------- SKILLS -------------------------------
   Each skill has three tiers, and a tier is a different METHOD, not a bigger
   number. Tier 1 is arithmetic you could do in your head; tier 3 is the thing
   an AP paper actually asks. Sizing the numbers so the intended method is the
   sensible one is part of the design, not decoration.

   Every question returns a `check` — a function the learner's answer is run
   through. Nothing stores a value to string-match against.
   ---------------------------------------------------------------------- */
const q = (opts) => opts;

const SKILLS = [
  /* ---------------------------- PHYSICS ---------------------------- */
  {
    id: "speed", name: "Speed, distance, time", subject: "Physics", strand: "Motion",
    needs: [],
    teach: "Speed is how far something goes in how long it takes. Divide the distance by the time and the unit comes out of the division too: meters divided by seconds is meters per second.",
    gen: function (r, d) {
      if (d === 1) {
        const v = ri(r, 2, 9), t = ri(r, 2, 9), s = v * t;
        return q({
          ask: "A cyclist travels " + s + " m in " + t + " s. What is their speed?",
          expect: v + " m/s",
          steps: [step("Speed is distance divided by time."),
                  step(s + " ÷ " + t + " = " + v),
                  step("The units divide too: meters ÷ seconds = m/s.")],
          hints: ["What do you divide by what?", "Distance ÷ time."]
        });
      }
      if (d === 2) {
        const v = ri(r, 8, 25), t = ri(r, 3, 12), s = v * t;
        return q({
          ask: "A train covers " + (s / 1000).toFixed(3) + " km in " + t + " s. Give its speed in m/s.",
          expect: v + " m/s",
          steps: [step("Convert to meters first: " + (s / 1000).toFixed(3) + " km = " + s + " m."),
                  step("Then divide: " + s + " ÷ " + t + " = " + v + " m/s."),
                  step("Converting before dividing keeps the unit honest.")],
          hints: ["The distance isn't in meters yet.", "1 km = 1000 m."]
        });
      }
      const v1 = ri(r, 10, 20), t1 = ri(r, 4, 9), v2 = ri(r, 22, 35), t2 = ri(r, 4, 9);
      const total = v1 * t1 + v2 * t2, tt = t1 + t2, avg = total / tt;
      return q({
        ask: "A car travels at " + v1 + " m/s for " + t1 + " s, then " + v2 + " m/s for " + t2 +
             " s. What is its average speed, to 3 significant figures?",
        expect: sigText(avg, 3) + " m/s", sigFigs: 3,
        steps: [step("Average speed is TOTAL distance ÷ TOTAL time — not the average of the two speeds."),
                step("Distance: " + v1 + "×" + t1 + " + " + v2 + "×" + t2 + " = " + total + " m"),
                step("Time: " + t1 + " + " + t2 + " = " + tt + " s"),
                step(total + " ÷ " + tt + " = " + sig(avg, 3) + " m/s")],
        hints: ["Averaging the two speeds gives the wrong answer — why?",
                "Total distance over total time."]
      });
    }
  },
  {
    id: "force", name: "Force, mass, acceleration", subject: "Physics", strand: "Forces",
    needs: ["speed"],
    teach: "A resultant force makes a mass accelerate: F = ma. One newton is exactly what it takes to accelerate one kilogram at one meter per second squared, which is why the unit is kg·m/s².",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 9), a = ri(r, 2, 9);
        return q({
          ask: "A " + m + " kg mass accelerates at " + a + " m/s^2. What resultant force acts on it?",
          expect: (m * a) + " N",
          steps: [step("F = ma."), step(m + " × " + a + " = " + (m * a) + " N"),
                  step("kg × m/s² is a newton — the unit comes out of the multiplication.")],
          hints: ["Which two quantities multiply?", "Force = mass × acceleration."]
        });
      }
      if (d === 2) {
        const m = ri(r, 3, 12), a = ri(r, 2, 8), F = m * a;
        return q({
          ask: "A resultant force of " + F + " N acts on a mass, giving it an acceleration of " +
               a + " m/s^2. What is the mass?",
          expect: m + " kg",
          steps: [step("F = ma, so m = F ÷ a."), step(F + " ÷ " + a + " = " + m + " kg"),
                  step("Rearranging first, then substituting, keeps the arithmetic simple.")],
          hints: ["Rearrange F = ma for m.", "m = F ÷ a."]
        });
      }
      const m = ri(r, 40, 90), g = 9.81, mu = ri(r, 20, 45) / 100;
      const W = m * g, fr = mu * W, push = ri(r, 300, 600), net = push - fr, a = net / m;
      return q({
        ask: "A " + m + " kg crate on level ground is pushed with " + push +
             " N. Friction is " + mu + " of its weight (g = 9.81 m/s^2). Find its acceleration, to 3 significant figures.",
        expect: sigText(a, 3) + " m/s^2", sigFigs: 3, tol: 0.01,
        steps: [step("Weight = mg = " + m + " × 9.81 = " + sig(W, 4) + " N"),
                step("Friction = " + mu + " × " + sig(W, 4) + " = " + sig(fr, 4) + " N"),
                step("Resultant = " + push + " − " + sig(fr, 4) + " = " + sig(net, 4) + " N"),
                step("a = F ÷ m = " + sig(net, 4) + " ÷ " + m + " = " + sig(a, 3) + " m/s²")],
        hints: ["Friction acts against the push — what is the RESULTANT force?",
                "Find the weight first, then the friction, then subtract."]
      });
    }
  },
  {
    id: "energy", name: "Kinetic and potential energy", subject: "Physics", strand: "Energy",
    needs: ["force"],
    teach: "Kinetic energy is ½mv² and gravitational potential energy is mgh. Both are measured in joules, because a joule is a newton-meter — a force acting through a distance.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 10), h = ri(r, 2, 10), E = m * 9.81 * h;
        return q({
          ask: "A " + m + " kg book is lifted " + h + " m (g = 9.81 m/s^2). How much gravitational potential energy does it gain? Give your answer to 3 significant figures.",
          expect: sigText(E, 3) + " J", sigFigs: 3,
          steps: [step("Ep = mgh."), step(m + " × 9.81 × " + h + " = " + sig(E, 3) + " J"),
                  step("kg × m/s² × m = N·m = J.")],
          hints: ["Three things multiply together.", "Ep = mgh."]
        });
      }
      if (d === 2) {
        const m = ri(r, 2, 20), v = ri(r, 3, 15), E = 0.5 * m * v * v;
        return q({
          ask: "A " + m + " kg trolley moves at " + v + " m/s. What is its kinetic energy?",
          expect: E + " J",
          steps: [step("Ek = ½mv²."), step("v² = " + v + "² = " + (v * v)),
                  step("½ × " + m + " × " + (v * v) + " = " + E + " J"),
                  step("Square the speed BEFORE halving — the order matters.")],
          hints: ["Square the speed first.", "Ek = ½mv²."]
        });
      }
      const m = ri(r, 2, 8), h = ri(r, 5, 30), v = Math.sqrt(2 * 9.81 * h);
      return q({
        ask: "A " + m + " kg ball is dropped from " + h + " m. Ignoring air resistance (g = 9.81 m/s^2), how fast is it moving as it lands? Give your answer to 3 significant figures.",
        expect: sigText(v, 3) + " m/s", sigFigs: 3, tol: 0.01,
        steps: [step("All the potential energy becomes kinetic: mgh = ½mv²."),
                step("The mass cancels — it falls at the same speed whatever it weighs."),
                step("v = √(2gh) = √(2 × 9.81 × " + h + ") = " + sig(v, 3) + " m/s")],
        hints: ["Set mgh equal to ½mv². What happens to m?",
                "v = √(2gh) — notice the mass isn't in it."]
      });
    }
  },
  {
    id: "ohm", name: "Ohm's law", subject: "Physics", strand: "Electricity",
    needs: [],
    teach: "Voltage is current times resistance: V = IR. A volt is a joule per coulomb — the energy each unit of charge carries — so pushing more charge per second through more resistance needs more voltage.",
    gen: function (r, d) {
      if (d === 1) {
        const I = ri(r, 2, 9), R = ri(r, 2, 9);
        return q({
          ask: "A current of " + I + " A flows through a " + R + " ohm resistor. What is the voltage across it?",
          expect: (I * R) + " V",
          steps: [step("V = IR."), step(I + " × " + R + " = " + (I * R) + " V")],
          hints: ["Which two multiply?", "V = I × R."]
        });
      }
      if (d === 2) {
        const I = ri(r, 2, 9), R = ri(r, 3, 12), V = I * R;
        return q({
          ask: "A " + V + " V supply drives " + I + " A through a resistor. What is its resistance?",
          expect: R + " ohm",
          steps: [step("V = IR, so R = V ÷ I."), step(V + " ÷ " + I + " = " + R + " ohm")],
          hints: ["Rearrange for R.", "R = V ÷ I."]
        });
      }
      const V = ri(r, 6, 12), R1 = ri(r, 100, 400), R2 = ri(r, 100, 400);
      const R = R1 + R2, I = V / R, mA = I * 1000;
      return q({
        ask: V + " V is applied across a " + R1 + " ohm and a " + R2 +
             " ohm resistor in series. What current flows, in mA, to 3 significant figures?",
        expect: sigText(mA, 3) + " mA", sigFigs: 3, tol: 0.01,
        steps: [step("In series the resistances add: " + R1 + " + " + R2 + " = " + R + " ohm"),
                step("I = V ÷ R = " + V + " ÷ " + R + " = " + I.toExponential(3) + " A"),
                step("In milliamps: × 1000 = " + sig(mA, 3) + " mA")],
        hints: ["Series resistances add before you use Ohm's law.",
                "Work in amps, then convert at the end."]
      });
    }
  },
  {
    id: "density", name: "Density", subject: "Physics", strand: "Matter",
    needs: [],
    teach: "Density is mass per unit volume: how much stuff is packed into the space. Divide the mass by the volume and the unit follows — kilograms divided by cubic meters.",
    gen: function (r, d) {
      if (d === 1) {
        const rho = ri(r, 2, 9), V = ri(r, 2, 9), m = rho * V;
        return q({
          ask: "A block has a mass of " + m + " g and a volume of " + V + " cm^3. What is its density in g/cm^3?",
          expect: rho + " g/cm^3",
          steps: [step("Density = mass ÷ volume."), step(m + " ÷ " + V + " = " + rho + " g/cm³")],
          hints: ["Which goes on top?", "Mass ÷ volume."]
        });
      }
      if (d === 2) {
        const l = ri(r, 2, 6), w = ri(r, 2, 6), h = ri(r, 2, 6), rho = ri(r, 2, 8);
        const V = l * w * h, m = rho * V;
        return q({
          ask: "A cuboid measures " + l + " cm × " + w + " cm × " + h + " cm and has a mass of " +
               m + " g. What is its density in g/cm^3?",
          expect: rho + " g/cm^3",
          steps: [step("Volume first: " + l + " × " + w + " × " + h + " = " + V + " cm³"),
                  step("Density = " + m + " ÷ " + V + " = " + rho + " g/cm³")],
          hints: ["You need the volume before you can divide.", "Volume of a cuboid is l × w × h."]
        });
      }
      const rho = ri(r, 2, 9) * 1000, V = ri(r, 2, 9) / 1000, m = rho * V;
      return q({
        ask: "A sample of mass " + sig(m, 3) + " kg occupies " + (V * 1000) +
             " L. Give its density in kg/m^3.",
        expect: rho + " kg/m^3", tol: 0.01,
        steps: [step("1 L = 0.001 m³, so " + (V * 1000) + " L = " + V + " m³"),
                step("Density = " + sig(m, 3) + " ÷ " + V + " = " + rho + " kg/m³"),
                step("Converting the volume first is what keeps the unit right.")],
        hints: ["Liters are not cubic meters.", "1000 L = 1 m³."]
      });
    }
  },

  /* --------------------------- CHEMISTRY --------------------------- */
  {
    id: "formula-mass", name: "Relative formula mass", subject: "Chemistry", strand: "Amount",
    needs: [],
    teach: "The relative formula mass is the sum of the atomic masses of every atom in the formula. Brackets multiply everything inside them, and a dot means separate water molecules attached to the crystal.",
    gen: function (r, d) {
      const simple = ["H2O", "CO2", "NaCl", "NH3", "CH4", "HCl", "SO2"];
      const mid = ["H2SO4", "CaCO3", "Ca(OH)2", "NaOH", "MgCl2", "KNO3", "Al2O3"];
      const hard = ["Fe2(SO4)3", "CuSO4\u00b75H2O", "Al2(SO4)3", "Ca(NO3)2", "(NH4)2SO4"];
      const f = pick(r, d === 1 ? simple : d === 2 ? mid : hard);
      const M = CHK.molarMass(f);
      return q({
        ask: "What is the relative formula mass of " + f + "? Give your answer to 1 decimal place.",
        expect: (Math.round(M * 10) / 10) + "", tol: 0.002,
        steps: [step("Count every atom, brackets and all."),
                step("Add up the atomic masses."),
                step("That comes to " + (Math.round(M * 10) / 10) + ".")],
        hints: d === 1 ? ["Add up each atom's mass.", "Check the small numbers after each symbol."]
          : d === 2 ? ["A bracket multiplies everything inside it.", "Ca(OH)2 has two O and two H."]
            : ["A dot means water molecules attached — count them all.",
               "Work out the bracket contents first, then multiply."]
      });
    }
  },
  {
    id: "moles", name: "Moles from mass", subject: "Chemistry", strand: "Amount",
    needs: ["formula-mass"],
    teach: "Moles are a way of counting atoms by weighing them. Divide the mass you have by the mass of one mole, and the answer is how many moles you have.",
    gen: function (r, d) {
      if (d === 1) {
        const n = ri(r, 2, 9), M = CHK.molarMass("H2O"), m = sig(n * M, 4);
        return q({
          ask: "How many moles are there in " + m + " g of H2O? (Mr = 18.0) Give your answer to 2 significant figures.",
          expect: sigText(n, 2) + " mol", sigFigs: 2, tol: 0.02,
          steps: [step("Moles = mass ÷ Mr."), step(m + " ÷ 18.0 = " + sig(n, 2) + " mol")],
          hints: ["Divide by the formula mass.", "n = m ÷ Mr."]
        });
      }
      if (d === 2) {
        const f = pick(r, ["CaCO3", "NaOH", "H2SO4", "MgCl2"]);
        const M = CHK.molarMass(f), n = ri(r, 2, 9) / 2, m = sig(n * M, 4);
        return q({
          ask: "How many moles are there in " + m + " g of " + f + "? Give your answer to 2 significant figures.",
          expect: sigText(n, 2) + " mol", sigFigs: 2, tol: 0.02,
          steps: [step("Work out the formula mass of " + f + " first: " + sig(M, 4) + "."),
                  step("Moles = " + m + " ÷ " + sig(M, 4) + " = " + sig(n, 2) + " mol")],
          hints: ["You need the formula mass before you can divide.",
                  "Count the atoms, then n = m ÷ Mr."]
        });
      }
      const M = CHK.molarMass("CaCO3"), n = ri(r, 2, 8) / 4, m = sig(n * M, 4);
      return q({
        ask: m + " g of CaCO3 decomposes completely: CaCO3 -> CaO + CO2. What mass of CO2 is produced, to 3 significant figures?",
        expect: sigText(n * CHK.molarMass("CO2"), 3) + " g", sigFigs: 3, tol: 0.01,
        steps: [step("Mr of CaCO3 is " + sig(M, 4) + ", so moles = " + m + " ÷ " + sig(M, 4) + " = " + sig(n, 3)),
                step("The equation is 1:1, so that is the same number of moles of CO2."),
                step("Mr of CO2 is 44.0, so mass = " + sig(n, 3) + " × 44.0 = " + sig(n * CHK.molarMass("CO2"), 3) + " g")],
        hints: ["Moles first, then use the equation's ratio, then back to mass.",
                "The ratio here is 1:1."]
      });
    }
  },
  {
    id: "balancing", name: "Balancing equations", subject: "Chemistry", strand: "Reactions",
    needs: [],
    teach: "Atoms are not created or destroyed, so every element must appear the same number of times on both sides. You may only change the big numbers in front — changing a small number inside a formula changes the substance itself.",
    gen: function (r, d) {
      const sets = {
        1: [["H2 + O2 -> H2O", "2H2 + O2 -> 2H2O"],
            ["Na + Cl2 -> NaCl", "2Na + Cl2 -> 2NaCl"],
            ["Mg + O2 -> MgO", "2Mg + O2 -> 2MgO"]],
        2: [["CH4 + O2 -> CO2 + H2O", "CH4 + 2O2 -> CO2 + 2H2O"],
            ["N2 + H2 -> NH3", "N2 + 3H2 -> 2NH3"],
            ["Al + O2 -> Al2O3", "4Al + 3O2 -> 2Al2O3"]],
        3: [["C3H8 + O2 -> CO2 + H2O", "C3H8 + 5O2 -> 3CO2 + 4H2O"],
            ["Fe2O3 + CO -> Fe + CO2", "Fe2O3 + 3CO -> 2Fe + 3CO2"],
            ["C2H6 + O2 -> CO2 + H2O", "2C2H6 + 7O2 -> 4CO2 + 6H2O"]]
      };
      const chosen = pick(r, sets[d]);
      return q({
        ask: "Balance this equation:  " + chosen[0],
        balance: true, expect: chosen[1],
        steps: [step("Count each element on both sides."),
                step("Change only the big numbers in front — never the small ones inside."),
                step("One that works: " + chosen[1])],
        hints: ["Which element is out first?",
                "Leave oxygen until last — it usually appears in more than one place."]
      });
    }
  },
  {
    id: "concentration", name: "Concentration", subject: "Chemistry", strand: "Solutions",
    needs: ["moles"],
    teach: "Concentration is moles per unit volume. Divide the moles of solute by the volume of solution in cubic decimetres — which is the same as liters.",
    gen: function (r, d) {
      if (d === 1) {
        const c = ri(r, 1, 5), V = ri(r, 1, 4), n = c * V;
        return q({
          ask: n + " mol of solute is dissolved to make " + V + " L of solution. What is the concentration in mol/L?",
          expect: c + " mol/L",
          steps: [step("Concentration = moles ÷ volume."), step(n + " ÷ " + V + " = " + c + " mol/L")],
          hints: ["Which goes on top?", "Moles ÷ liters."]
        });
      }
      if (d === 2) {
        const c = ri(r, 1, 4) / 2, mL = ri(r, 2, 9) * 50, V = mL / 1000, n = sig(c * V, 3);
        return q({
          ask: n + " mol of solute is dissolved to make " + mL + " cm^3 of solution. What is the concentration in mol/L?",
          expect: sig(c, 3) + " mol/L", tol: 0.02,
          steps: [step("Convert first: " + mL + " cm³ = " + V + " L"),
                  step(n + " ÷ " + V + " = " + sig(c, 3) + " mol/L")],
          hints: ["The volume isn't in liters yet.", "1000 cm³ = 1 L."]
        });
      }
      const c = ri(r, 1, 4) / 4, mL = ri(r, 2, 9) * 25, V = mL / 1000;
      const M = CHK.molarMass("NaOH"), m = sig(c * V * M, 3);
      return q({
        ask: "What mass of NaOH is needed to make " + mL + " cm^3 of a " + c +
             " mol/L solution? Give your answer to 3 significant figures.",
        expect: sigText(c * V * M, 3) + " g", sigFigs: 3, tol: 0.01,
        steps: [step("Volume in liters: " + mL + " cm³ = " + V + " L"),
                step("Moles = " + c + " × " + V + " = " + sig(c * V, 3) + " mol"),
                step("Mr of NaOH is " + sig(M, 3) + ", so mass = " + sig(c * V, 3) + " × " + sig(M, 3) + " = " + m + " g")],
        hints: ["Concentration × volume gives moles.", "Then moles × Mr gives the mass."]
      });
    }
  }
];

/* A second batch. Same rules: three tiers, each a different METHOD, and every
   answer checked as a quantity rather than a string. Chosen to fill the gaps
   the first batch left — pressure and moments in mechanics, power and heat in
   energy, parallel circuits in electricity, and on the chemistry side the
   things a paper actually asks for: yields, empirical formulae, gas volumes
   and titrations. */
const MORE_SKILLS = [
  {
    id: "pressure", name: "Pressure", subject: "Physics", strand: "Forces", needs: ["force"],
    teach: "Pressure is force spread over area: the same push through a smaller area presses harder, which is why a drawing pin goes in and your thumb does not. Newtons divided by square meters are pascals.",
    gen: function (r, d) {
      if (d === 1) {
        const F = ri(r, 2, 9) * 10, A = ri(r, 2, 5);
        return q({ ask: "A force of " + F + " N acts on an area of " + A + " m^2. What is the pressure?",
          expect: (F / A) + " Pa",
          steps: [step("Pressure = force ÷ area."), step(F + " ÷ " + A + " = " + (F / A) + " Pa"),
                  step("N ÷ m² is a pascal — the unit falls out of the division.")],
          hints: ["Which goes on top?", "Force ÷ area."] });
      }
      if (d === 2) {
        const m = ri(r, 40, 90), A = ri(r, 2, 6) / 100, F = m * 9.81, P = F / A;
        return q({ ask: "A " + m + " kg person stands on one foot of area " + A +
            " m^2 (g = 9.81 m/s^2). What pressure do they exert, to 3 significant figures?",
          expect: sigText(P, 3) + " Pa", sigFigs: 3, tol: 0.01,
          steps: [step("The force is their weight: " + m + " × 9.81 = " + sig(F, 4) + " N"),
                  step("Pressure = " + sig(F, 4) + " ÷ " + A + " = " + sigText(P, 3) + " Pa")],
          hints: ["What force are they actually applying?", "Weight = mg, then divide by area."] });
      }
      const h = ri(r, 2, 30), rho = 1000, P = rho * 9.81 * h;
      return q({ ask: "How much greater is the pressure " + h +
          " m below the surface of water (density 1000 kg/m^3, g = 9.81 m/s^2)? Give your answer in kPa to 3 significant figures.",
        expect: sigText(P / 1000, 3) + " kPa", sigFigs: 3, tol: 0.01,
        steps: [step("Pressure from a column of liquid is ρgh."),
                step("1000 × 9.81 × " + h + " = " + sig(P, 4) + " Pa"),
                step("In kilopascals: ÷ 1000 = " + sigText(P / 1000, 3) + " kPa")],
        hints: ["The area cancels out — it doesn't matter how wide the water is.",
                "P = ρgh, then convert."] });
    }
  },
  {
    id: "moments", name: "Moments", subject: "Physics", strand: "Forces", needs: ["force"],
    teach: "A moment is the turning effect of a force: force times the perpendicular distance from the pivot. A balanced beam has equal moments each side, which is why a small child far out can balance a big one sitting close in.",
    gen: function (r, d) {
      if (d === 1) {
        const F = ri(r, 2, 12), dd = ri(r, 2, 8);
        return q({ ask: "A force of " + F + " N acts " + dd + " m from a pivot. What is the moment?",
          expect: (F * dd) + " N m",
          steps: [step("Moment = force × distance from the pivot."),
                  step(F + " × " + dd + " = " + (F * dd) + " N m")],
          hints: ["Two things multiply.", "Force × distance."] });
      }
      if (d === 2) {
        const F1 = ri(r, 2, 10) * 2, d1 = ri(r, 2, 6), d2 = ri(r, 2, 6);
        const F2 = (F1 * d1) / d2;
        return q({ ask: "A beam balances on a pivot. " + F1 + " N acts " + d1 +
            " m to the left. What force " + d2 + " m to the right balances it?",
          expect: sig(F2, 4) + " N", tol: 0.01,
          steps: [step("Balanced means the moments are equal: F₁d₁ = F₂d₂."),
                  step(F1 + " × " + d1 + " = " + (F1 * d1) + " N m"),
                  step("So F₂ = " + (F1 * d1) + " ÷ " + d2 + " = " + sig(F2, 4) + " N")],
          hints: ["Set the two moments equal.", "F₂ = F₁d₁ ÷ d₂."] });
      }
      const L = ri(r, 3, 6), W = ri(r, 20, 60), m = ri(r, 10, 40), x = ri(r, 1, L - 1);
      const R2 = (W * L / 2 + m * x) / L;
      return q({ ask: "A uniform beam of length " + L + " m weighs " + W +
          " N and rests on supports at each end. A " + m + " N load sits " + x +
          " m from the left support. What is the upward force at the RIGHT support, to 3 significant figures?",
        expect: sigText(R2, 3) + " N", sigFigs: 3, tol: 0.01,
        steps: [step("Take moments about the LEFT support so its force drops out."),
                step("The beam's weight acts at its middle, " + (L / 2) + " m along."),
                step("Clockwise: " + W + "×" + (L / 2) + " + " + m + "×" + x + " = " + sig(W * L / 2 + m * x, 4)),
                step("Anticlockwise: R × " + L + ", so R = " + sigText(R2, 3) + " N")],
        hints: ["Take moments about one support — that removes one unknown.",
                "A uniform beam's weight acts at its center."] });
    }
  },
  {
    id: "power", name: "Power", subject: "Physics", strand: "Energy", needs: ["energy"],
    teach: "Power is how fast energy is transferred: joules per second, which is a watt. Two motors can do the same job while one takes half the time, and that one is twice as powerful.",
    gen: function (r, d) {
      if (d === 1) {
        const E = ri(r, 2, 12) * 100, t = ri(r, 2, 10);
        return q({ ask: E + " J of energy is transferred in " + t + " s. What is the power?",
          expect: (E / t) + " W",
          steps: [step("Power = energy ÷ time."), step(E + " ÷ " + t + " = " + (E / t) + " W")],
          hints: ["Energy per second.", "P = E ÷ t."] });
      }
      if (d === 2) {
        const m = ri(r, 20, 60), h = ri(r, 2, 10), t = ri(r, 2, 12);
        const E = m * 9.81 * h, P = E / t;
        return q({ ask: "A hoist lifts " + m + " kg through " + h + " m in " + t +
            " s (g = 9.81 m/s^2). What is its useful power output, to 3 significant figures?",
          expect: sigText(P, 3) + " W", sigFigs: 3, tol: 0.01,
          steps: [step("Energy first: mgh = " + m + " × 9.81 × " + h + " = " + sig(E, 4) + " J"),
                  step("Power = " + sig(E, 4) + " ÷ " + t + " = " + sigText(P, 3) + " W")],
          hints: ["Work out the energy before the power.", "Ep = mgh, then P = E ÷ t."] });
      }
      const V = ri(r, 200, 240), I = ri(r, 2, 12), eff = ri(r, 55, 90) / 100;
      const Pin = V * I, Pout = Pin * eff;
      return q({ ask: "A motor draws " + I + " A at " + V + " V and is " + Math.round(eff * 100) +
          "% efficient. What is its useful output power, to 3 significant figures?",
        expect: sigText(Pout, 3) + " W", sigFigs: 3, tol: 0.01,
        steps: [step("Input power = VI = " + V + " × " + I + " = " + Pin + " W"),
                step("Useful output is " + Math.round(eff * 100) + "% of that."),
                step(Pin + " × " + eff + " = " + sigText(Pout, 3) + " W")],
        hints: ["Find the input power first.", "P = VI, then take the percentage."] });
    }
  },
  {
    id: "heat", name: "Specific heat capacity", subject: "Physics", strand: "Energy", needs: ["energy"],
    teach: "Specific heat capacity is how much energy one kilogram needs to warm by one degree. Water's is unusually large, which is why the sea takes so long to warm up and so long to cool down.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 10), c = 4200, dT = ri(r, 5, 40), E = m * c * dT;
        return q({ ask: "How much energy warms " + m + " kg of water (c = 4200 J/kg K) by " +
            dT + " K? Give your answer in kJ to 3 significant figures.",
          expect: sigText(E / 1000, 3) + " kJ", sigFigs: 3, tol: 0.01,
          steps: [step("E = mcΔT."), step(m + " × 4200 × " + dT + " = " + sig(E, 4) + " J"),
                  step("In kilojoules: " + sigText(E / 1000, 3) + " kJ")],
          hints: ["Three things multiply.", "E = m × c × ΔT."] });
      }
      if (d === 2) {
        const m = ri(r, 2, 8), c = ri(r, 300, 900), dT = ri(r, 10, 50), E = m * c * dT;
        return q({ ask: sig(E / 1000, 4) + " kJ warms " + m + " kg of a metal by " + dT +
            " K. What is its specific heat capacity, to 3 significant figures?",
          expect: sigText(c, 3) + " J/kg K", sigFigs: 3, tol: 0.01,
          steps: [step("E = mcΔT, so c = E ÷ (mΔT)."),
                  step("Work in joules: " + sig(E, 4) + " J"),
                  step(sig(E, 4) + " ÷ (" + m + " × " + dT + ") = " + sigText(c, 3) + " J/kg K")],
          hints: ["Rearrange for c before substituting.", "c = E ÷ (m × ΔT)."] });
      }
      const m = ri(r, 1, 4), P = ri(r, 500, 2500), dT = ri(r, 20, 60), c = 4200;
      const t = m * c * dT / P;
      return q({ ask: "A " + P + " W heater warms " + m + " kg of water (c = 4200 J/kg K) by " +
          dT + " K. Assuming no losses, how long does it take, to 3 significant figures?",
        expect: sigText(t, 3) + " s", sigFigs: 3, tol: 0.01,
        steps: [step("Energy needed: mcΔT = " + m + " × 4200 × " + dT + " = " + sig(m * c * dT, 4) + " J"),
                step("Time = energy ÷ power = " + sig(m * c * dT, 4) + " ÷ " + P),
                step("= " + sigText(t, 3) + " s")],
        hints: ["Find the energy first, then use the power.",
                "A watt is a joule per second, so time = energy ÷ power."] });
    }
  },
  {
    id: "parallel", name: "Parallel circuits", subject: "Physics", strand: "Electricity", needs: ["ohm"],
    teach: "Resistors in parallel give the current more than one path, so the total resistance is always LESS than the smallest one on its own. Add the reciprocals to combine them.",
    gen: function (r, d) {
      if (d === 1) {
        const R = ri(r, 2, 12);
        return q({ ask: "Two " + R + " ohm resistors are connected in parallel. What is their combined resistance?",
          expect: (R / 2) + " ohm",
          steps: [step("Two equal resistors in parallel give half of one."),
                  step(R + " ÷ 2 = " + (R / 2) + " ohm"),
                  step("Less than either one — that is always true in parallel.")],
          hints: ["Two identical paths.", "Half of one of them."] });
      }
      if (d === 2) {
        const R1 = ri(r, 2, 12), R2 = ri(r, 2, 12), R = 1 / (1 / R1 + 1 / R2);
        return q({ ask: "A " + R1 + " ohm and a " + R2 +
            " ohm resistor are in parallel. What is the combined resistance, to 3 significant figures?",
          expect: sigText(R, 3) + " ohm", sigFigs: 3, tol: 0.01,
          steps: [step("1/R = 1/R₁ + 1/R₂"),
                  step("1/" + R1 + " + 1/" + R2 + " = " + sig(1 / R1 + 1 / R2, 4)),
                  step("R is the reciprocal of that: " + sigText(R, 3) + " ohm"),
                  step("Check it is smaller than " + Math.min(R1, R2) + " — it must be.")],
          hints: ["Add the reciprocals, then flip.", "Don't forget the final reciprocal."] });
      }
      const V = ri(r, 6, 12), R1 = ri(r, 10, 40), R2 = ri(r, 10, 40);
      const I = V / R1 + V / R2;
      return q({ ask: V + " V is applied across a " + R1 + " ohm and a " + R2 +
          " ohm resistor in parallel. What TOTAL current flows, to 3 significant figures?",
        expect: sigText(I, 3) + " A", sigFigs: 3, tol: 0.01,
        steps: [step("In parallel each resistor gets the full " + V + " V."),
                step("Through the first: " + V + " ÷ " + R1 + " = " + sig(V / R1, 4) + " A"),
                step("Through the second: " + V + " ÷ " + R2 + " = " + sig(V / R2, 4) + " A"),
                step("The currents add: " + sigText(I, 3) + " A")],
        hints: ["What voltage is across each one?",
                "Work out each branch current and add them."] });
    }
  },
  {
    id: "momentum", name: "Momentum", subject: "Physics", strand: "Motion", needs: ["speed", "force"],
    teach: "Momentum is mass times velocity, and in a collision the total before equals the total after. That conservation is what lets you work out a speed you were never told.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 12), v = ri(r, 2, 15);
        return q({ ask: "What is the momentum of a " + m + " kg trolley moving at " + v + " m/s?",
          expect: (m * v) + " kg m/s",
          steps: [step("Momentum = mass × velocity."), step(m + " × " + v + " = " + (m * v) + " kg m/s")],
          hints: ["Two things multiply.", "p = mv."] });
      }
      if (d === 2) {
        const m1 = ri(r, 2, 8), v1 = ri(r, 4, 12), m2 = ri(r, 2, 8);
        const v = (m1 * v1) / (m1 + m2);
        return q({ ask: "A " + m1 + " kg trolley at " + v1 + " m/s hits a stationary " + m2 +
            " kg trolley and they stick together. How fast do they move off, to 3 significant figures?",
          expect: sigText(v, 3) + " m/s", sigFigs: 3, tol: 0.01,
          steps: [step("Momentum before: " + m1 + " × " + v1 + " = " + (m1 * v1) + " kg m/s"),
                  step("The stationary one contributes nothing."),
                  step("After, the combined mass is " + (m1 + m2) + " kg."),
                  step("v = " + (m1 * v1) + " ÷ " + (m1 + m2) + " = " + sigText(v, 3) + " m/s")],
          hints: ["Total momentum before = total after.",
                  "After the collision they move as one object."] });
      }
      const m = ri(r, 40, 90) / 10, v = ri(r, 5, 20), t = ri(r, 2, 10) / 10;
      const F = m * v / t;
      return q({ ask: "A " + m + " kg ball moving at " + v + " m/s is brought to rest in " + t +
          " s. What average force acted on it, to 3 significant figures?",
        expect: sigText(F, 3) + " N", sigFigs: 3, tol: 0.01,
        steps: [step("Force is the rate of change of momentum: F = Δp ÷ Δt."),
                step("Momentum change: " + m + " × " + v + " = " + sig(m * v, 4) + " kg m/s"),
                step("F = " + sig(m * v, 4) + " ÷ " + t + " = " + sigText(F, 3) + " N"),
                step("A longer stopping time means a smaller force — that is what a crumple zone is for.")],
        hints: ["How much momentum is lost, and over how long?",
                "F = change in momentum ÷ time."] });
    }
  },

  /* --------------------------- CHEMISTRY --------------------------- */
  {
    id: "percent-yield", name: "Percentage yield", subject: "Chemistry", strand: "Amount", needs: ["moles"],
    teach: "The theoretical yield is what the equation promises; the actual yield is what you get. The percentage yield is one over the other, and it is never quite 100% because reactions are reversible, incomplete, and some product is always left in the flask.",
    gen: function (r, d) {
      if (d === 1) {
        const theo = ri(r, 2, 10) * 10, pct = ri(r, 4, 9) * 10, act = theo * pct / 100;
        return q({ ask: "A reaction should give " + theo + " g of product but gives " + act +
            " g. What is the percentage yield?",
          expect: pct + "",
          steps: [step("Percentage yield = actual ÷ theoretical × 100."),
                  step(act + " ÷ " + theo + " × 100 = " + pct + "%")],
          hints: ["Which is on top?", "What you got, over what you should have got."] });
      }
      if (d === 2) {
        const theo = ri(r, 20, 90), pct = ri(r, 40, 95), act = theo * pct / 100;
        return q({ ask: "A reaction has a theoretical yield of " + theo + " g and a yield of " +
            Math.round(pct) + "%. What mass of product is actually obtained, to 3 significant figures?",
          expect: sigText(act, 3) + " g", sigFigs: 3, tol: 0.01,
          steps: [step("Actual = theoretical × percentage ÷ 100."),
                  step(theo + " × " + Math.round(pct) + " ÷ 100 = " + sigText(act, 3) + " g")],
          hints: ["Rearrange the percentage yield formula.", "actual = theoretical × %/100."] });
      }
      const nCa = ri(r, 2, 8) / 4, mCaCO3 = nCa * CHK.molarMass("CaCO3");
      const theo = nCa * CHK.molarMass("CaO"), pct = ri(r, 60, 95), act = theo * pct / 100;
      return q({ ask: sig(mCaCO3, 4) + " g of CaCO3 is heated: CaCO3 -> CaO + CO2. " +
          sig(act, 4) + " g of CaO is collected. What is the percentage yield, to 3 significant figures?",
        expect: sigText(pct, 3) + "", sigFigs: 3, tol: 0.02,
        steps: [step("Moles of CaCO3: " + sig(mCaCO3, 4) + " ÷ " + sig(CHK.molarMass("CaCO3"), 4) + " = " + sig(nCa, 3)),
                step("The ratio is 1:1, so that is the moles of CaO expected."),
                step("Theoretical mass: " + sig(nCa, 3) + " × " + sig(CHK.molarMass("CaO"), 4) + " = " + sig(theo, 4) + " g"),
                step(sig(act, 4) + " ÷ " + sig(theo, 4) + " × 100 = " + sigText(pct, 3) + "%")],
        hints: ["Work out what the equation promises before comparing.",
                "Moles, then ratio, then mass, then compare."] });
    }
  },
  {
    id: "empirical", name: "Empirical formula", subject: "Chemistry", strand: "Amount", needs: ["moles"],
    teach: "The empirical formula is the simplest whole-number ratio of atoms. Divide each mass by its atomic mass to get moles, then divide through by the smallest — the ratio that comes out is the formula.",
    gen: function (r, d) {
      const cases = {
        1: [["C", "O", 1, 2, "CO2"], ["H", "O", 2, 1, "H2O"], ["Na", "Cl", 1, 1, "NaCl"]],
        2: [["Fe", "O", 2, 3, "Fe2O3"], ["C", "H", 1, 4, "CH4"], ["Mg", "O", 1, 1, "MgO"]],
        3: [["C", "H", 2, 6, "C2H6"], ["Al", "O", 2, 3, "Al2O3"], ["C", "H", 3, 8, "C3H8"]]
      };
      const c = pick(r, cases[d]);
      const scale = d === 1 ? 1 : ri(r, 2, 5);
      const mA = sig(ATOMIC_OF(c[0]) * c[2] * scale, 4), mB = sig(ATOMIC_OF(c[1]) * c[3] * scale, 4);
      return q({ ask: "A compound contains " + mA + " g of " + c[0] + " and " + mB + " g of " +
          c[1] + ". What is its empirical formula?",
        formula: true, expect: c[4],
        steps: [step("Moles of " + c[0] + ": " + mA + " ÷ " + ATOMIC_OF(c[0]) + " = " + sig(mA / ATOMIC_OF(c[0]), 3)),
                step("Moles of " + c[1] + ": " + mB + " ÷ " + ATOMIC_OF(c[1]) + " = " + sig(mB / ATOMIC_OF(c[1]), 3)),
                step("Divide both by the smaller to get the whole-number ratio."),
                step("That gives " + c[4] + ".")],
        hints: ["Turn the masses into moles first.",
                "Then divide both by whichever is smaller."] });
    }
  },
  {
    id: "gas-volume", name: "Gas volumes", subject: "Chemistry", strand: "Amount", needs: ["moles"],
    teach: "At room temperature and pressure one mole of any gas fills about 24 dm³ — the same for all of them, because what matters is how many molecules there are, not how big they are.",
    gen: function (r, d) {
      if (d === 1) {
        const n = ri(r, 1, 8), V = n * 24;
        return q({ ask: "What volume does " + n + " mol of a gas occupy at RTP? (1 mol = 24 dm^3) Give your answer in dm^3.",
          expect: V + "",
          steps: [step("Volume = moles × 24."), step(n + " × 24 = " + V + " dm³")],
          hints: ["Multiply by 24.", "Every gas is the same at RTP."] });
      }
      if (d === 2) {
        const V = ri(r, 2, 9) * 12, n = V / 24;
        return q({ ask: "How many moles of gas occupy " + V + " dm^3 at RTP? (1 mol = 24 dm^3)",
          expect: sig(n, 4) + " mol", tol: 0.01,
          steps: [step("Moles = volume ÷ 24."), step(V + " ÷ 24 = " + sig(n, 4) + " mol")],
          hints: ["Divide this time.", "n = V ÷ 24."] });
      }
      const n = ri(r, 2, 8) / 4, m = sig(n * CHK.molarMass("CaCO3"), 4), V = n * 24;
      return q({ ask: m + " g of CaCO3 decomposes: CaCO3 -> CaO + CO2. What volume of CO2 is produced at RTP, in dm^3, to 3 significant figures? (1 mol = 24 dm^3)",
        expect: sigText(V, 3) + "", sigFigs: 3, tol: 0.02,
        steps: [step("Moles of CaCO3: " + m + " ÷ " + sig(CHK.molarMass("CaCO3"), 4) + " = " + sig(n, 3)),
                step("1:1, so that is the moles of CO2."),
                step("Volume = " + sig(n, 3) + " × 24 = " + sigText(V, 3) + " dm³")],
        hints: ["Mass to moles, then the equation's ratio, then volume.",
                "The last step is × 24."] });
    }
  },
  {
    id: "titration", name: "Titrations", subject: "Chemistry", strand: "Solutions", needs: ["concentration"],
    teach: "A titration finds an unknown concentration by measuring exactly how much of a known solution reacts with it. Moles from the known side, the equation's ratio across, then back to a concentration.",
    gen: function (r, d) {
      if (d === 1) {
        const c = ri(r, 1, 4) / 10, V = ri(r, 1, 4) * 25, n = c * V / 1000;
        return q({ ask: V + " cm^3 of " + c + " mol/dm^3 acid is used. How many moles is that? Give your answer to 3 significant figures.",
          expect: sigText(n, 3) + " mol", sigFigs: 3, tol: 0.02,
          steps: [step("Convert the volume: " + V + " cm³ = " + (V / 1000) + " dm³"),
                  step("Moles = " + c + " × " + (V / 1000) + " = " + sigText(n, 3) + " mol")],
          hints: ["Volume must be in dm³ first.", "n = c × V."] });
      }
      if (d === 2) {
        const cA = ri(r, 1, 4) / 10, vA = ri(r, 1, 4) * 25, vB = ri(r, 1, 4) * 25;
        const cB = (cA * vA) / vB;
        return q({ ask: vA + " cm^3 of " + cA + " mol/dm^3 HCl exactly neutralises " + vB +
            " cm^3 of NaOH. The ratio is 1:1. What is the concentration of the NaOH, to 3 significant figures?",
          expect: sigText(cB, 3) + " mol/dm^3", sigFigs: 3, tol: 0.02,
          steps: [step("Moles of acid: " + cA + " × " + (vA / 1000) + " = " + sig(cA * vA / 1000, 4)),
                  step("1:1, so the same moles of NaOH."),
                  step("Concentration = moles ÷ volume = " + sig(cA * vA / 1000, 4) + " ÷ " + (vB / 1000)),
                  step("= " + sigText(cB, 3) + " mol/dm³")],
          hints: ["Find the moles of the one you know everything about.",
                  "Then divide by the other volume."] });
      }
      const cA = ri(r, 1, 4) / 10, vA = ri(r, 1, 4) * 25, vB = ri(r, 1, 4) * 25;
      const cB = (cA * vA) / (2 * vB);
      return q({ ask: vA + " cm^3 of " + cA + " mol/dm^3 H2SO4 neutralises " + vB +
          " cm^3 of NaOH. H2SO4 + 2NaOH -> Na2SO4 + 2H2O. What is the concentration of the NaOH, to 3 significant figures?",
        expect: sigText(cB, 3) + " mol/dm^3", sigFigs: 3, tol: 0.02,
        steps: [step("Moles of acid: " + cA + " × " + (vA / 1000) + " = " + sig(cA * vA / 1000, 4)),
                step("The ratio is 1:2, so there are TWICE as many moles of NaOH."),
                step("Moles of NaOH = " + sig(2 * cA * vA / 1000, 4)),
                step("Concentration = that ÷ " + (vB / 1000) + " = " + sigText(cB, 3) + " mol/dm³")],
        hints: ["The ratio is not 1:1 here — read the equation.",
                "One mole of the acid reacts with two of the alkali."] });
    }
  }
];

// Atomic masses for the empirical-formula skill, from the checker's own table
// rather than a second copy that could drift out of step with it.
function ATOMIC_OF(sym) { return CHK.ATOMIC[sym]; }

SKILLS.push.apply(SKILLS, MORE_SKILLS);

/* The elementary end.

   These are choice questions because the ideas are qualitative — states of
   matter, why things float, what a circuit needs. There is no number to check,
   and inventing one to fit the engine would be dressing a guess up as physics.

   Each wrong option carries WHY it is wrong, so getting it wrong tells you
   something rather than just costing you a mark. That is the whole reason
   these are worth having rather than just leaving the range short. */
const ELEMENTARY = [
  {
    id: "states", name: "Solids, liquids and gases", subject: "Chemistry", strand: "Matter", needs: [],
    teach: "Everything is made of particles. In a solid they are packed together and only wobble; in a liquid they touch but slide past each other; in a gas they are far apart and move freely. That is why a solid keeps its shape, a liquid takes the shape of its container, and a gas fills the whole room.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Which one keeps its own shape?",
              options: [{ t: "A solid" }, { t: "A liquid", why: "A liquid takes the shape of whatever it is in." },
                        { t: "A gas", why: "A gas spreads out to fill the whole container." }], correct: 0,
              steps: ["In a solid the particles are held in place.", "So the shape stays put."] },
            { ask: "Which one fills its whole container?",
              options: [{ t: "A solid", why: "A solid keeps its own shape and size." },
                        { t: "A liquid", why: "A liquid takes the container's shape but not its whole volume — it has a level." },
                        { t: "A gas" }], correct: 2,
              steps: ["Gas particles move freely and spread out.", "So a gas fills whatever it is in."] }],
        2: [{ ask: "Water is heated until it boils. What happens to the particles?",
              options: [{ t: "They get bigger", why: "The particles themselves do not change size — their spacing does." },
                        { t: "They move faster and spread apart" },
                        { t: "They disappear", why: "Nothing is lost when water boils; it becomes a gas." }], correct: 1,
              steps: ["Heating gives particles more energy.", "They move faster and push further apart, becoming a gas."] },
            { ask: "A gas is squeezed into a smaller space. Why can it be squashed when a liquid can't?",
              options: [{ t: "Gas particles are smaller", why: "They are not smaller — it is the gaps that differ." },
                        { t: "There are big gaps between gas particles" },
                        { t: "Gas is lighter", why: "Weight is not what allows squashing; spacing is." }], correct: 1,
              steps: ["In a gas the particles are far apart.", "Squeezing closes the gaps; in a liquid there are barely any to close."] }],
        3: [{ ask: "Ice floats on water. What does that tell you?",
              options: [{ t: "Ice is less dense than water" },
                        { t: "Ice is lighter than water", why: "A whole iceberg is far heavier than a glass of water — it is density that matters, not weight." },
                        { t: "Ice is colder than water", why: "Temperature does not decide whether something floats." }], correct: 0,
              steps: ["Floating depends on density, not weight.", "Water is unusual: it expands as it freezes, so ice is less dense."] },
            { ask: "Why does a puddle dry up without ever boiling?",
              options: [{ t: "The water is absorbed by the ground", why: "It happens on a sealed surface too." },
                        { t: "The fastest particles escape from the surface" },
                        { t: "Water disappears in sunlight", why: "It does not disappear — it becomes water vapour in the air." }], correct: 1,
              steps: ["Particles in a liquid move at a range of speeds.",
                      "The fastest ones at the surface escape — that is evaporation, and it needs no boiling."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Think about how the particles are arranged.", "What are the particles actually doing?"] });
    }
  },
  {
    id: "circuits-basic", name: "What a circuit needs", subject: "Physics", strand: "Electricity", needs: [],
    teach: "For a current to flow there has to be a complete loop from one end of the cell, through the components, and back to the other. Break the loop anywhere and everything stops — which is exactly what a switch is for.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "A bulb does not light. The wires are fine and the cell is new. What is the most likely problem?",
              options: [{ t: "The circuit is not a complete loop" },
                        { t: "The bulb is too far from the cell", why: "Distance does not stop a current in a complete circuit." },
                        { t: "The cell is upside down", why: "In a simple circuit a reversed cell still lights a bulb." }], correct: 0,
              steps: ["Current needs a complete path.", "A gap anywhere stops all of it."] },
            { ask: "What does a switch actually do?",
              options: [{ t: "It stores electricity", why: "That is a cell's job, not a switch's." },
                        { t: "It makes or breaks the loop" },
                        { t: "It makes the current stronger", why: "A switch does not change the size of the current." }], correct: 1,
              steps: ["A switch is a deliberate gap you can close.", "Closed, current flows; open, it stops."] }],
        2: [{ ask: "Two identical bulbs are put in series with one cell. Compared with one bulb alone, they are:",
              options: [{ t: "Brighter", why: "More components in series means more resistance, so less current." },
                        { t: "Dimmer" },
                        { t: "The same", why: "The current changes, so the brightness does." }], correct: 1,
              steps: ["In series the resistances add.", "More resistance for the same voltage means less current, so dimmer bulbs."] }],
        3: [{ ask: "One bulb in a string is removed. The others stay lit. What kind of circuit is it?",
              options: [{ t: "Series", why: "In series, removing one breaks the single loop and everything goes out." },
                        { t: "Parallel" },
                        { t: "Neither", why: "A circuit where the others survive has more than one path — that is parallel." }], correct: 1,
              steps: ["In parallel each branch is its own path.", "Breaking one leaves the others complete."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Is there a complete path all the way round?", "Think about what happens to the loop."] });
    }
  },
  {
    id: "forces-basic", name: "Pushes and pulls", subject: "Physics", strand: "Forces", needs: [],
    teach: "A force is a push or a pull. Forces change how things move — starting them, stopping them, speeding them up, slowing them down or turning them. When the forces on something are balanced, its motion does not change at all.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "A book rests on a table and does not move. What can you say about the forces on it?",
              options: [{ t: "There are no forces on it", why: "Gravity is still pulling it down; the table pushes back up." },
                        { t: "The forces are balanced" },
                        { t: "Gravity has stopped", why: "Gravity never switches off." }], correct: 1,
              steps: ["Gravity pulls the book down.", "The table pushes up by exactly as much, so nothing changes."] }],
        2: [{ ask: "A cyclist pedals at a steady speed on a flat road. What are the forces doing?",
              options: [{ t: "The forward force is bigger than the drag", why: "Then they would be speeding up, not steady." },
                        { t: "They are balanced" },
                        { t: "There is no drag", why: "Air resistance and friction are always there — that is why pedalling is needed at all." }], correct: 1,
              steps: ["Steady speed means the motion is not changing.",
                      "That happens when the driving force and the resistances are equal."] }],
        3: [{ ask: "A skydiver reaches terminal velocity. Why do they stop speeding up?",
              options: [{ t: "Gravity gets weaker as they fall", why: "Gravity is essentially the same all the way down." },
                        { t: "Air resistance has grown to equal their weight" },
                        { t: "They run out of energy", why: "Falling does not use up a supply of energy." }], correct: 1,
              steps: ["Air resistance grows as speed grows.",
                      "When it equals the weight the forces balance, so the speed stops changing."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Are the forces balanced or not?", "Balanced forces mean the motion does not change."] });
    }
  }
];

/* A third batch, filling the areas the first two left out entirely: waves,
   springs, radioactivity and magnetism on the physics side; atomic structure,
   acids and rates on the chemistry side.

   Where a topic is genuinely quantitative it gets numeric questions. Where the
   idea is qualitative — what an isotope IS — it gets choice questions with a
   reason on every wrong option, rather than a number invented to fit. */
const BATCH3 = [
  {
    id: "waves", name: "Wave speed", subject: "Physics", strand: "Waves", needs: ["speed"],
    teach: "A wave's speed is its frequency times its wavelength. Frequency is how many waves pass a point each second, and wavelength is how long one wave is — multiply them and you get distance per second, which is a speed.",
    gen: function (r, d) {
      if (d === 1) {
        const f = ri(r, 2, 12), L = ri(r, 2, 9);
        return q({ ask: "A wave has a frequency of " + f + " Hz and a wavelength of " + L + " m. What is its speed?",
          expect: (f * L) + " m/s",
          steps: [step("Speed = frequency × wavelength."), step(f + " × " + L + " = " + (f * L) + " m/s"),
                  step("Hz × m is 1/s × m, which is m/s — a speed.")],
          hints: ["Two things multiply.", "v = fλ."] });
      }
      if (d === 2) {
        const f = ri(r, 20, 90), v = ri(r, 200, 400), L = v / f;
        return q({ ask: "A wave travels at " + v + " m/s with a frequency of " + f +
            " Hz. What is its wavelength, to 3 significant figures?",
          expect: sigText(L, 3) + " m", sigFigs: 3, tol: 0.01,
          steps: [step("v = fλ, so λ = v ÷ f."), step(v + " ÷ " + f + " = " + sigText(L, 3) + " m")],
          hints: ["Rearrange for the wavelength.", "λ = v ÷ f."] });
      }
      const f = ri(r, 2, 9) * 100000, c = 3.0e8, L = c / f;
      return q({ ask: "A radio wave has a frequency of " + (f / 1000) +
          " kHz and travels at 3.0 x 10^8 m/s. What is its wavelength, to 3 significant figures?",
        expect: sigText(L, 3) + " m", sigFigs: 3, tol: 0.01,
        steps: [step("Convert the frequency: " + (f / 1000) + " kHz = " + f + " Hz"),
                step("λ = v ÷ f = 3.0e8 ÷ " + f),
                step("= " + sigText(L, 3) + " m")],
        hints: ["The frequency isn't in hertz yet.", "1 kHz = 1000 Hz."] });
    }
  },
  {
    id: "hooke", name: "Springs", subject: "Physics", strand: "Forces", needs: ["force"],
    teach: "Stretch a spring and the force it pulls back with is proportional to how far you have stretched it: F = kx. The spring constant k says how stiff it is. This holds until the spring is stretched too far and stops springing back — the limit of proportionality.",
    gen: function (r, d) {
      if (d === 1) {
        const k = ri(r, 2, 20), x = ri(r, 2, 9) / 10;
        return q({ ask: "A spring with a spring constant of " + k + " N/m is stretched by " +
            x + " m. What force is needed?",
          expect: sig(k * x, 4) + " N", tol: 0.01,
          steps: [step("F = kx."), step(k + " × " + x + " = " + sig(k * x, 4) + " N")],
          hints: ["Two things multiply.", "Force = spring constant × extension."] });
      }
      if (d === 2) {
        const k = ri(r, 20, 90), F = ri(r, 2, 12), x = F / k;
        return q({ ask: "A " + F + " N force stretches a spring with a spring constant of " +
            k + " N/m. How far does it stretch, to 3 significant figures?",
          expect: sigText(x, 3) + " m", sigFigs: 3, tol: 0.01,
          steps: [step("F = kx, so x = F ÷ k."), step(F + " ÷ " + k + " = " + sigText(x, 3) + " m")],
          hints: ["Rearrange for the extension.", "x = F ÷ k."] });
      }
      const k = ri(r, 20, 80), x = ri(r, 2, 9) / 100, E = 0.5 * k * x * x;
      return q({ ask: "A spring with a spring constant of " + k + " N/m is stretched by " + x +
          " m. How much elastic energy is stored, to 3 significant figures?",
        expect: sigText(E, 3) + " J", sigFigs: 3, tol: 0.01,
        steps: [step("Elastic energy is ½kx² — the ½ is there because the force grows as you stretch."),
                step("x² = " + sig(x * x, 4)),
                step("½ × " + k + " × " + sig(x * x, 4) + " = " + sigText(E, 3) + " J")],
        hints: ["It isn't just force × distance — the force changes as you pull.",
                "E = ½kx²."] });
    }
  },
  {
    id: "halflife", name: "Half-life", subject: "Physics", strand: "Radioactivity", needs: [],
    teach: "A half-life is how long it takes for half the radioactive nuclei in a sample to decay. It is the same length of time whatever you start with — after two half-lives a quarter is left, after three an eighth, and so on.",
    gen: function (r, d) {
      if (d === 1) {
        const start = ri(r, 2, 10) * 100, n = ri(r, 1, 3);
        return q({ ask: "A sample starts with " + start + " nuclei. How many are left after " +
            n + " half-li" + (n === 1 ? "fe" : "ves") + "?",
          expect: (start / Math.pow(2, n)) + "",
          steps: [step("Each half-life halves what is left."),
                  step("After " + n + ": " + start + " ÷ 2^" + n + " = " + (start / Math.pow(2, n)))],
          hints: ["Halve it, once per half-life.", "Divide by 2 each time."] });
      }
      if (d === 2) {
        const hl = ri(r, 2, 12), n = ri(r, 2, 4);
        return q({ ask: "An isotope has a half-life of " + hl + " days. How long until only " +
            "1/" + Math.pow(2, n) + " of it is left? Give your answer in days.",
          expect: (hl * n) + "",
          steps: [step("1/" + Math.pow(2, n) + " left means " + n + " half-lives have passed."),
                  step(n + " × " + hl + " = " + (hl * n) + " days")],
          hints: ["How many halvings give that fraction?",
                  "Count the halvings, then multiply by the half-life."] });
      }
      const hl = ri(r, 2, 10), t = hl * ri(r, 2, 4), A0 = ri(r, 2, 9) * 1000;
      const A = A0 / Math.pow(2, t / hl);
      return q({ ask: "A source has an activity of " + A0 + " Bq and a half-life of " + hl +
          " hours. What is its activity after " + t + " hours, to 3 significant figures?",
        expect: sigText(A, 3) + " Bq", sigFigs: 3, tol: 0.01,
        steps: [step(t + " ÷ " + hl + " = " + (t / hl) + " half-lives have passed."),
                step("Activity halves each time: " + A0 + " ÷ 2^" + (t / hl)),
                step("= " + sigText(A, 3) + " Bq")],
        hints: ["Work out how many half-lives fit into the time.",
                "Then halve the activity that many times."] });
    }
  },
  {
    id: "isotopes", name: "Atoms and isotopes", subject: "Chemistry", strand: "Structure", needs: [],
    teach: "An atom's protons decide which element it is. Neutrons can vary — atoms of the same element with different numbers of neutrons are isotopes. A neutral atom has as many electrons as protons, because their charges cancel.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "What decides which element an atom is?",
              options: [{ t: "The number of protons" },
                        { t: "The number of neutrons", why: "Change the neutrons and it is still the same element — just a different isotope." },
                        { t: "The number of electrons", why: "Electrons can be gained or lost to form ions; the element does not change." }], correct: 0,
              steps: ["Protons define the element.", "That count is the atomic number."] }],
        2: [{ ask: "Carbon-12 and carbon-14 differ in what?",
              options: [{ t: "Protons", why: "Both are carbon, so both have 6 protons — that is what makes them carbon." },
                        { t: "Neutrons" },
                        { t: "Charge", why: "Both are neutral atoms; isotopes differ in mass, not charge." }], correct: 1,
              steps: ["Both are carbon, so both have 6 protons.",
                      "12 and 14 are mass numbers, so they differ by 2 neutrons."] }],
        3: [{ ask: "An ion has 11 protons and 10 electrons. What is it?",
              options: [{ t: "A negative ion", why: "Fewer electrons than protons means positive charge is left over." },
                        { t: "A positive ion" },
                        { t: "A neutral atom", why: "Neutral means equal numbers; these are not equal." }], correct: 1,
              steps: ["11 positive protons, 10 negative electrons.",
                      "One positive charge is unbalanced, so it is a 1+ ion."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Which particle is being counted?", "Protons define the element; electrons decide the charge."] });
    }
  },
  {
    id: "ph", name: "Acids and pH", subject: "Chemistry", strand: "Reactions", needs: ["concentration"],
    teach: "pH measures how acidic something is. It runs from 0 to 14 with 7 neutral, and each step is a factor of ten in hydrogen ion concentration — so pH 3 is a hundred times more acidic than pH 5, not a bit more.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Which pH is the most acidic?",
                        options: [{ t: "pH 2" }, { t: "pH 7", why: "7 is neutral — neither acidic nor alkaline." },
                                  { t: "pH 12", why: "Above 7 is alkaline, the opposite of acidic." }], correct: 0,
                        steps: ["Lower pH means more acidic.", "2 is the lowest here."] },
                       { ask: "What is the pH of a neutral solution?",
                        options: [{ t: "0", why: "0 is strongly acidic." }, { t: "7" },
                                  { t: "14", why: "14 is strongly alkaline." }], correct: 1,
                        steps: ["The scale runs 0 to 14.", "The middle, 7, is neutral."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Low pH or high pH for acid?", "Below 7 is acidic; above 7 is alkaline."] });
      }
      if (d === 2) {
        const p1 = ri(r, 1, 4), diff = ri(r, 1, 3), p2 = p1 + diff;
        return q({ ask: "How many times more acidic is a solution of pH " + p1 +
            " than one of pH " + p2 + "?",
          expect: Math.pow(10, diff) + "",
          steps: [step("Each pH step is a factor of 10."),
                  step(p2 + " − " + p1 + " = " + diff + " steps"),
                  step("10^" + diff + " = " + Math.pow(10, diff) + " times")],
          hints: ["It isn't the difference — it's a power of ten.",
                  "Each whole pH unit multiplies by 10."] });
      }
      const p = ri(r, 1, 6), conc = Math.pow(10, -p);
      return q({ ask: "A solution has a hydrogen ion concentration of 1 x 10^-" + p +
          " mol/dm^3. What is its pH?",
        expect: p + "",
        steps: [step("pH = −log10 of the hydrogen ion concentration."),
                step("The concentration is 10^-" + p + ", so the log is −" + p + "."),
                step("pH = " + p)],
        hints: ["The power of ten IS the pH, with the sign flipped.",
                "1 x 10^-3 mol/dm³ is pH 3."] });
    }
  },
  {
    id: "rates", name: "Rates of reaction", subject: "Chemistry", strand: "Reactions", needs: ["moles"],
    teach: "A rate of reaction is how much is used up or made per second. Anything that makes collisions more frequent or more energetic speeds it up: higher concentration, higher temperature, smaller pieces, or a catalyst.",
    gen: function (r, d) {
      if (d === 1) {
        const V = ri(r, 2, 10) * 6, t = ri(r, 2, 12);
        return q({ ask: V + " cm^3 of gas is produced in " + t +
            " s. What is the mean rate of reaction in cm^3/s, to 3 significant figures?",
          expect: sigText(V / t, 3) + " cm^3/s", sigFigs: 3, tol: 0.01,
          steps: [step("Rate = amount ÷ time."), step(V + " ÷ " + t + " = " + sigText(V / t, 3) + " cm³/s")],
          hints: ["How much, over how long.", "Divide the volume by the time."] });
      }
      if (d === 2) {
        const m = ri(r, 2, 9) / 10, t = ri(r, 10, 90);
        return q({ ask: "A flask loses " + m + " g of mass in " + t +
            " s as gas escapes. What is the mean rate of reaction in g/s, to 3 significant figures?",
          expect: sigText(m / t, 3) + " g/s", sigFigs: 3, tol: 0.01,
          steps: [step("Rate = mass lost ÷ time."), step(m + " ÷ " + t + " = " + sigText(m / t, 3) + " g/s")],
          hints: ["The mass lost is the amount of product.", "Divide by the time."] });
      }
      const sets = [{ ask: "Why does powdering a solid speed up its reaction?",
                      options: [{ t: "The particles gain energy", why: "Grinding does not warm the particles meaningfully — the change is geometric." },
                                { t: "There is more surface area to collide with" },
                                { t: "The concentration rises", why: "Concentration applies to solutions; the solid's amount is unchanged." }], correct: 1,
                      steps: ["Powder exposes far more surface.", "More exposed surface means more collisions per second."] },
                    { ask: "A catalyst speeds up a reaction. What does it actually do?",
                      options: [{ t: "It lowers the activation energy" },
                                { t: "It is used up in the reaction", why: "A catalyst is unchanged at the end — that is what makes it a catalyst." },
                                { t: "It makes more product", why: "It changes the speed, not the yield." }], correct: 0,
                      steps: ["A catalyst offers a route with a lower energy barrier.",
                              "More collisions clear that lower barrier, so the reaction is faster."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Think about collisions — how many, and how energetic.",
                "What has actually changed about the particles?"] });
    }
  }
];

/* A fourth batch: motion under acceleration, efficiency, gas laws, electrical
   cost, bonding and electrolysis. Between them these are most of what a paper
   asks that the first three batches did not reach. */
const BATCH4 = [
  {
    id: "accel", name: "Acceleration", subject: "Physics", strand: "Motion", needs: ["speed"],
    teach: "Acceleration is how fast the speed is changing: the change in speed divided by the time it took. A negative value just means slowing down — the same idea pointing the other way.",
    gen: function (r, d) {
      if (d === 1) {
        const dv = ri(r, 2, 10) * 2, t = ri(r, 2, 8);
        return q({ ask: "A car speeds up by " + dv + " m/s in " + t + " s. What is its acceleration?",
          expect: sig(dv / t, 4) + " m/s^2", tol: 0.01,
          steps: [step("Acceleration = change in speed ÷ time."),
                  step(dv + " ÷ " + t + " = " + sig(dv / t, 4) + " m/s²")],
          hints: ["Change in speed, over time.", "a = Δv ÷ t."] });
      }
      if (d === 2) {
        const u = ri(r, 2, 12), v = u + ri(r, 4, 20), t = ri(r, 2, 9);
        return q({ ask: "A train goes from " + u + " m/s to " + v + " m/s in " + t +
            " s. What is its acceleration, to 3 significant figures?",
          expect: sigText((v - u) / t, 3) + " m/s^2", sigFigs: 3, tol: 0.01,
          steps: [step("Find the CHANGE first: " + v + " − " + u + " = " + (v - u) + " m/s"),
                  step((v - u) + " ÷ " + t + " = " + sigText((v - u) / t, 3) + " m/s²")],
          hints: ["It isn't the final speed you divide — it's the change.",
                  "a = (v − u) ÷ t."] });
      }
      const u = 0, a = ri(r, 2, 8), dist = ri(r, 20, 200);
      const v = Math.sqrt(u * u + 2 * a * dist);
      return q({ ask: "A car starts from rest and accelerates at " + a + " m/s^2 for " + dist +
          " m. How fast is it going, to 3 significant figures?",
        expect: sigText(v, 3) + " m/s", sigFigs: 3, tol: 0.01,
        steps: [step("No time is given, so use v² = u² + 2as."),
                step("u is 0, so v² = 2 × " + a + " × " + dist + " = " + sig(2 * a * dist, 4)),
                step("v = √" + sig(2 * a * dist, 4) + " = " + sigText(v, 3) + " m/s")],
        hints: ["You are not told the time — which equation avoids it?",
                "v² = u² + 2as."] });
    }
  },
  {
    id: "efficiency", name: "Efficiency", subject: "Physics", strand: "Energy", needs: ["power"],
    teach: "Efficiency is how much of the energy you put in comes out doing the job you wanted. The rest is not destroyed — it is still energy, just spread out as heat and sound where it is no use. Nothing is ever 100% efficient.",
    gen: function (r, d) {
      if (d === 1) {
        const inn = ri(r, 2, 10) * 100, pct = ri(r, 2, 9) * 10, out = inn * pct / 100;
        return q({ ask: "A motor takes in " + inn + " J and usefully delivers " + out +
            " J. What is its efficiency as a percentage?",
          expect: pct + "",
          steps: [step("Efficiency = useful out ÷ total in."),
                  step(out + " ÷ " + inn + " = " + (pct / 100)),
                  step("As a percentage: " + pct + "%")],
          hints: ["Which is on top — what you got, or what you paid?",
                  "Useful output over total input."] });
      }
      if (d === 2) {
        const inn = ri(r, 20, 90) * 10, pct = ri(r, 30, 85), out = inn * pct / 100;
        return q({ ask: "A lamp is " + pct + "% efficient and is supplied with " + inn +
            " J. How much energy is WASTED, to 3 significant figures?",
          expect: sigText(inn - out, 3) + " J", sigFigs: 3, tol: 0.01,
          steps: [step("Useful: " + inn + " × " + pct + "% = " + sig(out, 4) + " J"),
                  step("Wasted is the rest: " + inn + " − " + sig(out, 4) + " = " + sigText(inn - out, 3) + " J"),
                  step("It is not lost — it is heat and light going where you did not want it.")],
          hints: ["Work out the useful part first.", "Wasted = total − useful."] });
      }
      const P = ri(r, 40, 90) * 10, t = ri(r, 10, 60), pct = ri(r, 25, 80);
      const inn = P * t, out = inn * pct / 100;
      return q({ ask: "A " + P + " W device runs for " + t + " s and is " + pct +
          "% efficient. How much USEFUL energy does it deliver, in kJ, to 3 significant figures?",
        expect: sigText(out / 1000, 3) + " kJ", sigFigs: 3, tol: 0.01,
        steps: [step("Total energy in: " + P + " × " + t + " = " + inn + " J"),
                step("Useful: " + inn + " × " + pct + "% = " + sig(out, 4) + " J"),
                step("In kilojoules: " + sigText(out / 1000, 3) + " kJ")],
        hints: ["Power × time gives the energy in.",
                "Then take the efficiency, then convert."] });
    }
  },
  {
    id: "gas-laws", name: "Gas laws", subject: "Physics", strand: "Matter", needs: ["pressure"],
    teach: "Squeeze a fixed amount of gas at a steady temperature and its pressure rises in exact proportion: halve the volume and the pressure doubles. Pressure times volume stays the same, which is Boyle's law.",
    gen: function (r, d) {
      if (d === 1) {
        const P1 = ri(r, 2, 10) * 10, V1 = ri(r, 2, 8), V2 = V1 * 2;
        return q({ ask: "A gas at " + P1 + " kPa fills " + V1 +
            " m^3. It expands to " + V2 + " m^3 at the same temperature. What is the new pressure?",
          expect: (P1 / 2) + " kPa",
          steps: [step("Pressure × volume stays the same."),
                  step("The volume doubled, so the pressure halves."),
                  step(P1 + " ÷ 2 = " + (P1 / 2) + " kPa")],
          hints: ["What happened to the volume?", "Double the volume, halve the pressure."] });
      }
      if (d === 2) {
        const P1 = ri(r, 100, 300), V1 = ri(r, 2, 9), V2 = ri(r, 2, 9);
        const P2 = P1 * V1 / V2;
        return q({ ask: "A gas at " + P1 + " kPa fills " + V1 + " m^3. At the same temperature it is moved into " +
            V2 + " m^3. What is its new pressure, to 3 significant figures?",
          expect: sigText(P2, 3) + " kPa", sigFigs: 3, tol: 0.01,
          steps: [step("P₁V₁ = P₂V₂"), step(P1 + " × " + V1 + " = " + (P1 * V1)),
                  step("P₂ = " + (P1 * V1) + " ÷ " + V2 + " = " + sigText(P2, 3) + " kPa")],
          hints: ["The product stays constant.", "P₂ = P₁V₁ ÷ V₂."] });
      }
      const P1 = ri(r, 100, 200), V1 = ri(r, 4, 10), P2 = P1 * ri(r, 2, 4);
      const V2 = P1 * V1 / P2;
      return q({ ask: "A gas at " + P1 + " kPa fills " + V1 + " m^3. It is compressed until the pressure reaches " +
          P2 + " kPa at the same temperature. What volume does it now occupy, to 3 significant figures?",
        expect: sigText(V2, 3) + " m^3", sigFigs: 3, tol: 0.01,
        steps: [step("P₁V₁ = P₂V₂, so V₂ = P₁V₁ ÷ P₂."),
                step(P1 + " × " + V1 + " = " + (P1 * V1)),
                step("V₂ = " + (P1 * V1) + " ÷ " + P2 + " = " + sigText(V2, 3) + " m³"),
                step("Higher pressure, smaller volume — worth a sanity check every time.")],
        hints: ["Rearrange for the new volume.", "V₂ = P₁V₁ ÷ P₂."] });
    }
  },
  {
    id: "elec-cost", name: "Electrical energy and cost", subject: "Physics", strand: "Electricity", needs: ["ohm", "power"],
    teach: "Electricity is billed in kilowatt-hours: one kilowatt running for one hour. Multiply the power in kilowatts by the hours to get the units used, then by the price per unit.",
    gen: function (r, d) {
      if (d === 1) {
        const kW = ri(r, 1, 5), h = ri(r, 2, 8);
        return q({ ask: "A " + kW + " kW heater runs for " + h + " hours. How many kilowatt-hours does it use?",
          expect: (kW * h) + "",
          steps: [step("Units = power in kW × time in hours."),
                  step(kW + " × " + h + " = " + (kW * h) + " kWh")],
          hints: ["Two numbers multiply.", "kW × hours."] });
      }
      if (d === 2) {
        const W = ri(r, 4, 20) * 100, h = ri(r, 2, 10), p = ri(r, 15, 40);
        const kWh = (W / 1000) * h, cost = kWh * p;
        return q({ ask: "A " + W + " W appliance runs for " + h + " hours at " + p +
            "p per kWh. What does it cost, in pence, to 3 significant figures?",
          expect: sigText(cost, 3) + "", sigFigs: 3, tol: 0.01,
          steps: [step("Convert to kilowatts: " + W + " W = " + (W / 1000) + " kW"),
                  step("Units: " + (W / 1000) + " × " + h + " = " + sig(kWh, 4) + " kWh"),
                  step("Cost: " + sig(kWh, 4) + " × " + p + " = " + sigText(cost, 3) + "p")],
          hints: ["Watts are not kilowatts yet.", "Convert, multiply by hours, then by the price."] });
      }
      const V = ri(r, 220, 240), I = ri(r, 2, 12), h = ri(r, 1, 6);
      const kWh = (V * I / 1000) * h;
      return q({ ask: "An appliance draws " + I + " A at " + V + " V for " + h +
          " hours. How many kilowatt-hours does it use, to 3 significant figures?",
        expect: sigText(kWh, 3) + "", sigFigs: 3, tol: 0.01,
        steps: [step("Power first: P = VI = " + V + " × " + I + " = " + (V * I) + " W"),
                step("In kilowatts: " + ((V * I) / 1000) + " kW"),
                step("× " + h + " hours = " + sigText(kWh, 3) + " kWh")],
        hints: ["You are given voltage and current, not power.",
                "P = VI, then convert, then × hours."] });
    }
  },
  {
    id: "bonding", name: "Bonding", subject: "Chemistry", strand: "Structure", needs: ["isotopes"],
    teach: "Atoms bond to reach a full outer shell. Metals give electrons away and non-metals take them, making charged ions that attract — that is ionic. Two non-metals share instead, which is covalent. What a substance is like follows from which it did.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Sodium (a metal) reacts with chlorine (a non-metal). What kind of bond forms?",
              options: [{ t: "Ionic" }, { t: "Covalent", why: "Covalent is sharing, which happens between two non-metals." },
                        { t: "Metallic", why: "Metallic bonding is between metal atoms only." }], correct: 0,
              steps: ["A metal gives electrons away; a non-metal takes them.",
                      "The opposite charges attract — that is an ionic bond."] }],
        2: [{ ask: "Two oxygen atoms bond together. What kind of bond is it?",
              options: [{ t: "Ionic", why: "Neither atom will give electrons away — both are non-metals wanting to gain." },
                        { t: "Covalent" },
                        { t: "Metallic", why: "There is no metal here." }], correct: 1,
              steps: ["Both are non-metals, so neither gives up electrons.",
                      "They share instead — a covalent bond."] }],
        3: [{ ask: "A substance conducts electricity when molten but not when solid. What is it most likely to be?",
              options: [{ t: "A simple covalent molecule", why: "These do not conduct in any state — there are no free charges." },
                        { t: "An ionic compound" },
                        { t: "A metal", why: "A metal conducts when solid too — its electrons are free either way." }], correct: 1,
              steps: ["Conducting needs charges free to move.",
                      "Ionic solids lock their ions in place; melting frees them."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Metal and non-metal, or two non-metals?",
                "Giving and taking is ionic; sharing is covalent."] });
    }
  },
  {
    id: "electrolysis", name: "Electrolysis", subject: "Chemistry", strand: "Reactions", needs: ["bonding"],
    teach: "Pass a current through a molten or dissolved ionic compound and its ions are pulled apart: positive ions go to the negative electrode and negative ions to the positive one. Opposites attract, and that is the whole rule.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Where do positive ions travel during electrolysis?",
              options: [{ t: "To the negative electrode" },
                        { t: "To the positive electrode", why: "Like charges repel — a positive ion is pushed away from a positive electrode." },
                        { t: "They stay put", why: "That is what the current is for: it makes them move." }], correct: 0,
              steps: ["Opposite charges attract.", "So positive ions go to the negative electrode."] }],
        2: [{ ask: "Molten lead bromide is electrolysed. What forms at the negative electrode?",
              options: [{ t: "Bromine", why: "Bromide ions are negative, so they go to the POSITIVE electrode." },
                        { t: "Lead" },
                        { t: "Nothing", why: "Both electrodes produce something in a working cell." }], correct: 1,
              steps: ["Lead ions are positive, bromide ions negative.",
                      "Positive goes to negative, so lead forms there."] }],
        3: [{ ask: "Why must an ionic compound be molten or dissolved before it can be electrolysed?",
              options: [{ t: "Solid ions cannot move" },
                        { t: "Solids do not contain ions", why: "They do — the ions are there, just locked in a lattice." },
                        { t: "Heat provides the energy for the reaction", why: "The current provides the energy; melting only frees the ions." }], correct: 0,
              steps: ["Electrolysis needs charges to travel to the electrodes.",
                      "In a solid lattice the ions are fixed, so nothing can move."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Which charges attract?", "Positive to negative, negative to positive."] });
    }
  }
];

/* AP level. The band had two topics in it, which made "elementary to AP" a
   claim the app could not really back. These are the ones where the difficulty
   is the METHOD rather than the arithmetic: choosing which relation applies,
   carrying a quantity through three stages, or reasoning about a system that
   pushes back when you change it. */
const AP_SKILLS = [
  {
    id: "circular", name: "Circular motion", subject: "Physics", strand: "Motion",
    needs: ["accel", "force"],
    teach: "Something moving in a circle is accelerating even at constant speed, because its direction keeps changing. That acceleration points at the center and equals v²/r — which is why a tighter turn or a faster car needs more grip, and why there is no such thing as an outward force throwing you out of the bend.",
    gen: function (r, d) {
      if (d === 1) {
        const v = ri(r, 2, 10), rad = ri(r, 2, 10);
        return q({ ask: "An object moves at " + v + " m/s in a circle of radius " + rad +
            " m. What is its centripetal acceleration, to 3 significant figures?",
          expect: sigText(v * v / rad, 3) + " m/s^2", sigFigs: 3, tol: 0.01,
          steps: [step("a = v² ÷ r."), step(v + "² = " + (v * v)),
                  step((v * v) + " ÷ " + rad + " = " + sigText(v * v / rad, 3) + " m/s²")],
          hints: ["Square the speed first.", "a = v² ÷ r."] });
      }
      if (d === 2) {
        const m = ri(r, 200, 900), v = ri(r, 8, 25), rad = ri(r, 15, 60);
        const F = m * v * v / rad;
        return q({ ask: "A " + m + " kg car takes a bend of radius " + rad + " m at " + v +
            " m/s. What centripetal force is needed, to 3 significant figures?",
          expect: sigText(F, 3) + " N", sigFigs: 3, tol: 0.01,
          steps: [step("First the acceleration: v² ÷ r = " + sig(v * v / rad, 4) + " m/s²"),
                  step("Then F = ma = " + m + " × " + sig(v * v / rad, 4)),
                  step("= " + sigText(F, 3) + " N — supplied by friction between tires and road.")],
          hints: ["Two steps: acceleration, then force.",
                  "a = v²/r, then F = ma."] });
      }
      const rad = ri(r, 20, 80), mu = ri(r, 40, 90) / 100;
      const v = Math.sqrt(mu * 9.81 * rad);
      return q({ ask: "A car rounds a bend of radius " + rad +
          " m. Friction can supply at most " + mu +
          " of its weight (g = 9.81 m/s^2). What is the fastest it can go, to 3 significant figures?",
        expect: sigText(v, 3) + " m/s", sigFigs: 3, tol: 0.01,
        steps: [step("The friction provides the centripetal force: μmg = mv²/r"),
                step("The mass cancels — a heavy car and a light one skid at the same speed."),
                step("v = √(μgr) = √(" + mu + " × 9.81 × " + rad + ")"),
                step("= " + sigText(v, 3) + " m/s")],
        hints: ["Set the maximum friction equal to the centripetal force needed.",
                "Watch what happens to the mass."] });
    }
  },
  {
    id: "idealgas", name: "The ideal gas equation", subject: "Chemistry", strand: "Matter",
    needs: ["gas-laws", "moles"],
    teach: "pV = nRT ties pressure, volume, amount and temperature into one relation, with R the same for every gas. Temperature must be in kelvin — using Celsius here is the single most common way to get these wrong, because the equation assumes a scale that starts at absolute zero.",
    gen: function (r, d) {
      if (d === 1) {
        const n = ri(r, 1, 5), T = ri(r, 250, 350), V = ri(r, 1, 5) / 100;
        const P = n * 8.314 * T / V;
        return q({ ask: n + " mol of gas occupies " + V + " m^3 at " + T +
            " K. What is its pressure, in kPa, to 3 significant figures? (R = 8.314 J/mol K)",
          expect: sigText(P / 1000, 3) + " kPa", sigFigs: 3, tol: 0.01,
          steps: [step("pV = nRT, so p = nRT ÷ V."),
                  step(n + " × 8.314 × " + T + " = " + sig(n * 8.314 * T, 4)),
                  step("÷ " + V + " = " + sig(P, 4) + " Pa = " + sigText(P / 1000, 3) + " kPa")],
          hints: ["Rearrange for pressure.", "p = nRT ÷ V."] });
      }
      if (d === 2) {
        const n = ri(r, 1, 4), P = ri(r, 100, 300) * 1000, T = ri(r, 270, 340);
        const V = n * 8.314 * T / P;
        return q({ ask: n + " mol of gas is at " + (P / 1000) + " kPa and " + T +
            " K. What volume does it occupy, in m^3, to 3 significant figures? (R = 8.314 J/mol K)",
          expect: sigText(V, 3) + " m^3", sigFigs: 3, tol: 0.01,
          steps: [step("Convert the pressure to pascals: " + (P / 1000) + " kPa = " + P + " Pa"),
                  step("V = nRT ÷ p = " + n + " × 8.314 × " + T + " ÷ " + P),
                  step("= " + sigText(V, 3) + " m³")],
          hints: ["Kilopascals are not pascals.", "V = nRT ÷ p."] });
      }
      const m = ri(r, 2, 9), Mr = CHK.molarMass("CO2"), n = m / Mr;
      const T = ri(r, 20, 60), TK = T + 273.15, P = ri(r, 100, 200) * 1000;
      const V = n * 8.314 * TK / P;
      return q({ ask: m + " g of CO2 is at " + (P / 1000) + " kPa and " + T +
          " degC. What volume does it occupy, in m^3, to 3 significant figures? (R = 8.314 J/mol K, Mr = 44.0)",
        expect: sigText(V, 3) + " m^3", sigFigs: 3, tol: 0.02,
        steps: [step("Moles first: " + m + " ÷ 44.0 = " + sig(n, 3) + " mol"),
                step("Temperature in KELVIN: " + T + " + 273 = " + sig(TK, 4) + " K"),
                step("Using Celsius here is the classic mistake — the equation needs a scale starting at absolute zero."),
                step("V = nRT ÷ p = " + sigText(V, 3) + " m³")],
        hints: ["Three conversions before you can substitute: mass to moles, °C to K, kPa to Pa.",
                "Kelvin is Celsius + 273."] });
    }
  },
  {
    id: "capacitor", name: "Capacitors", subject: "Physics", strand: "Electricity",
    needs: ["ohm", "elec-cost"],
    teach: "A capacitor stores charge in proportion to the voltage across it: Q = CV. The energy stored is ½QV, not QV — the same factor of a half as a spring, and for the same reason: the voltage climbs as the charge builds, so the average is half the final value.",
    gen: function (r, d) {
      if (d === 1) {
        const C = ri(r, 2, 9), V = ri(r, 2, 12);
        return q({ ask: "A " + C + " uF capacitor is charged to " + V +
            " V. How much charge does it store, in uC?",
          expect: (C * V) + " uC", tol: 0.01,
          steps: [step("Q = CV."), step(C + " × " + V + " = " + (C * V) + " µC"),
                  step("Working in microfarads and volts gives microcoulombs directly.")],
          hints: ["Two things multiply.", "Q = C × V."] });
      }
      if (d === 2) {
        const C = ri(r, 100, 900), V = ri(r, 5, 24);
        const E = 0.5 * (C * 1e-6) * V * V;
        return q({ ask: "A " + C + " uF capacitor is charged to " + V +
            " V. How much energy is stored, in mJ, to 3 significant figures?",
          expect: sigText(E * 1000, 3) + " mJ", sigFigs: 3, tol: 0.01,
          steps: [step("E = ½CV² — the half is because the voltage rises as it charges."),
                  step("C in farads: " + C + " µF = " + (C * 1e-6) + " F"),
                  step("½ × " + (C * 1e-6) + " × " + V + "² = " + sig(E, 4) + " J"),
                  step("= " + sigText(E * 1000, 3) + " mJ")],
          hints: ["Convert microfarads to farads first.",
                  "E = ½CV², and mind the half."] });
      }
      const C = ri(r, 100, 500), V = ri(r, 6, 20), R = ri(r, 10, 90) * 1000;
      const tau = (C * 1e-6) * R;
      return q({ ask: "A " + C + " uF capacitor discharges through a " + (R / 1000) +
          " kohm resistor. What is the time constant, in s, to 3 significant figures?",
        expect: sigText(tau, 3) + " s", sigFigs: 3, tol: 0.01,
        steps: [step("The time constant is RC — resistance times capacitance."),
                step("In base units: " + R + " ohm × " + (C * 1e-6) + " F"),
                step("= " + sigText(tau, 3) + " s"),
                step("After that long the charge has fallen to about 37% of its start.")],
        hints: ["Both quantities need to be in base units first.",
                "τ = RC."] });
    }
  },
  {
    id: "equilibrium", name: "Equilibrium", subject: "Chemistry", strand: "Reactions",
    needs: ["rates", "concentration"],
    teach: "A reversible reaction reaches equilibrium when the forward and backward rates are equal — not when nothing is happening, but when both directions happen at the same speed. Change the conditions and the position shifts to oppose that change, which is Le Chatelier's principle.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "A reaction is at equilibrium. What is true?",
              options: [{ t: "The forward and backward rates are equal" },
                        { t: "The reaction has stopped", why: "Both directions carry on — they simply cancel out." },
                        { t: "There are equal amounts of reactants and products", why: "The amounts are constant, but rarely equal." }], correct: 0,
              steps: ["Equilibrium is dynamic, not still.",
                      "Both reactions run; their rates match, so the amounts stop changing."] }],
        2: [{ ask: "A + B ⇌ C is exothermic. The temperature is raised. Which way does the equilibrium shift?",
              options: [{ t: "Toward C", why: "That is the exothermic direction — it would release more heat, not absorb the extra." },
                        { t: "Toward A and B" },
                        { t: "It does not move", why: "Temperature always shifts an equilibrium with a heat change." }], correct: 1,
              steps: ["The system opposes the change.",
                      "Adding heat favors the direction that absorbs it — the endothermic, reverse direction."] }],
        3: [{ ask: "N2 + 3H2 ⇌ 2NH3. The pressure is increased. Which way does it shift, and why?",
              options: [{ t: "Toward NH3, because that side has fewer molecules" },
                        { t: "Toward N2 and H2, because that side has more molecules", why: "The system opposes the pressure rise, so it moves toward FEWER molecules, not more." },
                        { t: "It does not move, because pressure only affects rate", why: "Pressure shifts position too whenever the molecule counts differ." }], correct: 0,
              steps: ["Count the gas molecules: 4 on the left, 2 on the right.",
                      "Raising pressure favors the side with fewer, which lowers it again."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["The system opposes whatever you do to it.",
                "Which direction undoes the change you made?"] });
    }
  },
  {
    id: "enthalpy", name: "Enthalpy changes", subject: "Chemistry", strand: "Reactions",
    needs: ["balancing", "moles"],
    teach: "Breaking bonds takes energy in; making them gives energy out. The overall enthalpy change is bonds broken minus bonds made — so a negative answer means more energy came out than went in, and the reaction is exothermic.",
    gen: function (r, d) {
      if (d === 1) {
        const broken = ri(r, 10, 30) * 100, made = ri(r, 12, 35) * 100;
        return q({ ask: "Breaking the bonds takes " + broken + " kJ/mol and making the new ones releases " +
            made + " kJ/mol. What is the enthalpy change, in kJ/mol?",
          expect: (broken - made) + "",
          steps: [step("Enthalpy change = bonds broken − bonds made."),
                  step(broken + " − " + made + " = " + (broken - made) + " kJ/mol"),
                  step((broken - made) < 0 ? "Negative, so it is exothermic — energy came out."
                                           : "Positive, so it is endothermic — energy went in.")],
          hints: ["In minus out.", "Broken − made."] });
      }
      if (d === 2) {
        const nH = ri(r, 2, 4), bH = 436, bO = 498, bOH = 464;
        const broken = nH * bH + bO, made = nH * 2 * bOH;
        return q({ ask: nH + "H2 + O2 -> " + nH + "H2O. Bond energies: H-H " + bH + ", O=O " + bO +
            ", O-H " + bOH + " kJ/mol. What is the enthalpy change, in kJ/mol?",
          expect: (broken - made) + "",
          steps: [step("Broken: " + nH + " × H-H + 1 × O=O = " + broken + " kJ/mol"),
                  step("Made: each water has TWO O-H bonds, so " + (nH * 2) + " × " + bOH + " = " + made),
                  step(broken + " − " + made + " = " + (broken - made) + " kJ/mol"),
                  step("Negative — combustion releases energy, as you would expect.")],
          hints: ["Count the bonds in the products carefully — water has two O-H each.",
                  "Broken − made."] });
      }
      const dH = -(ri(r, 3, 9) * 100), n = ri(r, 2, 8) / 4;
      const released = -dH * n;
      return q({ ask: "A reaction has an enthalpy change of " + dH + " kJ/mol. How much energy is released when " +
          n + " mol reacts, in kJ, to 3 significant figures?",
        expect: sigText(released, 3) + "", sigFigs: 3, tol: 0.01,
        steps: [step("The value is per MOLE, so multiply by the moles."),
                step(Math.abs(dH) + " × " + n + " = " + sigText(released, 3) + " kJ"),
                step("Released, because the enthalpy change is negative.")],
        hints: ["kJ/mol is a rate per mole, not a total.",
                "Multiply by the number of moles."] });
    }
  }
];

/* A fifth batch, covering areas with nothing in them at all: light, magnetism
   and nuclear change on the physics side; the periodic table, separating
   mixtures and organic chemistry on the chemistry side.

   Several are choice questions, because the real difficulty in them is
   knowing WHICH idea applies rather than doing arithmetic — why a mixture
   separates one way and not another, why a group behaves as it does. Inventing
   numbers for those would make them look rigorous and teach less. */
const BATCH5 = [
  {
    id: "reflection", name: "Reflection and refraction", subject: "Physics", strand: "Waves",
    needs: ["waves"],
    teach: "Light bounces off a mirror at the same angle it arrived, both measured from the normal. Entering a denser material it slows and bends toward the normal; leaving, it speeds up and bends away. That bending is why a straw looks broken in a glass of water.",
    gen: function (r, d) {
      if (d === 1) {
        const a = ri(r, 15, 70);
        return q({ ask: "Light hits a mirror at " + a +
            " degrees to the normal. At what angle does it reflect, in degrees?",
          expect: a + "",
          steps: [step("The angle of reflection equals the angle of incidence."),
                  step("Both are measured from the NORMAL, not the mirror surface."),
                  step("So it reflects at " + a + "°.")],
          hints: ["What is the rule for a mirror?", "The two angles are equal."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Light passes from air into glass. What happens to it?",
                        options: [{ t: "It slows down and bends toward the normal" },
                                  { t: "It speeds up and bends away", why: "Glass is denser than air, so light slows rather than speeds up." },
                                  { t: "It slows down and bends away from the normal", why: "Slowing and bending away do not go together — slowing bends it toward." }], correct: 0,
                        steps: ["Glass is optically denser, so light travels slower in it.",
                                "Slowing at an angle turns the beam toward the normal."] },
                      { ask: "Why does a straw look bent in a glass of water?",
                        options: [{ t: "The water magnifies it", why: "Magnification would change the size, not put a kink in it." },
                                  { t: "Light from the straw refracts leaving the water" },
                                  { t: "The straw actually bends", why: "It does not — take it out and it is straight." }], correct: 1,
                        steps: ["Light from the submerged part changes direction as it leaves the water.",
                                "Your eye assumes light traveled straight, so the straw appears displaced."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which material is denser?", "Into denser: slower, and toward the normal."] });
      }
      const n = ri(r, 13, 16) / 10, i = ri(r, 20, 50);
      const rr = Math.asin(Math.sin(i * Math.PI / 180) / n) * 180 / Math.PI;
      return q({ ask: "Light enters a material of refractive index " + n + " at " + i +
          " degrees to the normal. What is the angle of refraction, in degrees, to 3 significant figures?",
        expect: sigText(rr, 3) + "", sigFigs: 3, tol: 0.02,
        steps: [step("Snell's law: n = sin(i) ÷ sin(r)"),
                step("So sin(r) = sin(" + i + "°) ÷ " + n + " = " + sig(Math.sin(i * Math.PI / 180) / n, 4)),
                step("r = " + sigText(rr, 3) + "°"),
                step("Smaller than the angle in, as it must be going into a denser material.")],
        hints: ["Snell's law relates the two angles through the index.",
                "sin(r) = sin(i) ÷ n."] });
    }
  },
  {
    id: "magnetism", name: "Magnetism and electromagnets", subject: "Physics", strand: "Electricity",
    needs: ["ohm"],
    teach: "A current makes a magnetic field around a wire. Coil that wire and the field concentrates; add an iron core and it strengthens again. The great advantage over a bar magnet is that switching the current off switches the magnet off.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "How do you turn off an electromagnet?",
              options: [{ t: "Switch off the current" },
                        { t: "Remove the iron core", why: "That weakens it, but the coil still makes a field while current flows." },
                        { t: "You cannot", why: "Being switchable is the whole point of an electromagnet." }], correct: 0,
              steps: ["The field exists because current flows.", "No current, no field."] }],
        2: [{ ask: "Which change would NOT make an electromagnet stronger?",
              options: [{ t: "More turns on the coil", why: "More turns does strengthen it." },
                        { t: "A bigger current", why: "A bigger current does strengthen it." },
                        { t: "A longer wire at the same current" }], correct: 2,
              steps: ["Strength comes from turns and current, not the length of wire itself.",
                      "Extra wire without extra turns adds resistance and helps nothing."] }],
        3: [{ ask: "A wire carrying current sits in a magnetic field and experiences a force. What happens if BOTH the current and the field are reversed?",
              options: [{ t: "The force reverses", why: "Reversing one flips the force; reversing both flips it twice." },
                        { t: "The force stays in the same direction" },
                        { t: "The force disappears", why: "The force only vanishes if the wire lies along the field." }], correct: 1,
              steps: ["Reversing the current flips the force.",
                      "Reversing the field flips it again — two flips return it to where it started."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What actually creates the field?", "Think about what each change does on its own."] });
    }
  },
  {
    id: "nuclear", name: "Fission and fusion", subject: "Physics", strand: "Radioactivity",
    needs: ["halflife"],
    teach: "Fission splits a heavy nucleus into lighter ones and releases energy; fusion joins light nuclei and releases more. Both work because the products are more tightly bound than what you started with — the missing mass becomes energy.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "What happens in nuclear fission?",
              options: [{ t: "A heavy nucleus splits into lighter ones" },
                        { t: "Light nuclei join together", why: "That is fusion — the opposite process." },
                        { t: "An electron is emitted", why: "That is beta decay, a different kind of change." }], correct: 0,
              steps: ["Fission means splitting.", "A heavy nucleus such as uranium breaks into lighter pieces."] }],
        2: [{ ask: "Why does a fission chain reaction keep going?",
              options: [{ t: "Each split releases neutrons that cause more splits" },
                        { t: "The heat causes more splits", why: "Heat is a product, not the trigger — neutrons are." },
                        { t: "The nuclei attract each other", why: "Nuclei repel; that is why fusion is hard, not why fission continues." }], correct: 0,
              steps: ["A splitting nucleus throws out spare neutrons.",
                      "Those hit other nuclei and split them too — that is the chain."] }],
        3: [{ ask: "Fusion powers the Sun but is hard to achieve on Earth. Why?",
              options: [{ t: "There is no fuel on Earth", why: "Hydrogen isotopes are plentiful — fuel is not the problem." },
                        { t: "Nuclei repel, so enormous temperature and pressure are needed" },
                        { t: "It would release too little energy", why: "It releases more per kilogram than fission." }], correct: 1,
              steps: ["Both nuclei are positive, so they repel strongly.",
                      "Only enormous temperature and pressure force them close enough to fuse."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Splitting or joining?", "What makes nuclei hard to bring together?"] });
    }
  },
  {
    id: "periodic", name: "The periodic table", subject: "Chemistry", strand: "Structure",
    needs: ["isotopes"],
    teach: "Elements are arranged by proton number, and the arrangement puts similar ones in the same column. A group number tells you how many outer electrons an atom has, and the outer electrons are what decide how it reacts.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "What do elements in the same GROUP have in common?",
              options: [{ t: "The same number of outer electrons" },
                        { t: "The same number of protons", why: "That would make them the same element." },
                        { t: "The same mass", why: "Mass rises down a group; that is not what makes them similar." }], correct: 0,
              steps: ["A group is a column.", "Everything in it has the same outer-shell count, so they react alike."] }],
        2: [{ ask: "Group 1 metals get MORE reactive going down the group. Why?",
              options: [{ t: "The outer electron is further from the nucleus and lost more easily" },
                        { t: "They have more outer electrons lower down", why: "Every Group 1 element has exactly one outer electron — that is what defines the group." },
                        { t: "They get heavier", why: "Mass itself does not drive reactivity." }], correct: 0,
              steps: ["Reacting means losing that one outer electron.",
                      "Further down, it sits further out and is held less tightly, so it goes more readily."] }],
        3: [{ ask: "Group 7 halogens get LESS reactive going down, the opposite of Group 1. Why?",
              options: [{ t: "They have fewer outer electrons lower down", why: "All halogens have seven — the group defines it." },
                        { t: "They need to GAIN an electron, and the outer shell is further away lower down" },
                        { t: "They become metals", why: "They remain non-metals throughout." }], correct: 1,
              steps: ["Group 1 loses an electron; Group 7 gains one.",
                      "Distance makes losing easier but gaining harder — so the trends run opposite ways."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Outer electrons decide reactivity.",
                "Is the atom trying to lose an electron or gain one?"] });
    }
  },
  {
    id: "separating", name: "Separating mixtures", subject: "Chemistry", strand: "Matter", needs: [],
    teach: "How you separate a mixture depends on how its parts differ. Different boiling points call for distillation, different solubility for filtration or crystallization, and different attraction to a paper for chromatography. Nothing here breaks a chemical bond — a mixture is not a compound.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "How would you separate sand from water?",
              options: [{ t: "Filtration" },
                        { t: "Distillation", why: "That would work but wastes energy boiling water off — the sand is not dissolved." },
                        { t: "Chromatography", why: "That separates dissolved colors, not an undissolved solid." }], correct: 0,
              steps: ["Sand does not dissolve.", "Pour it through filter paper — the sand stays, the water passes."] }],
        2: [{ ask: "How would you get pure water FROM salty water?",
              options: [{ t: "Filtration", why: "Salt is dissolved, so it passes straight through the paper with the water." },
                        { t: "Simple distillation" },
                        { t: "Crystallization", why: "That recovers the salt and loses the water — the opposite of what was asked." }], correct: 1,
              steps: ["Salt is dissolved, so filtering will not remove it.",
                      "Boil the water off and condense it — the salt stays behind."] }],
        3: [{ ask: "Two liquids mix completely and boil at 78 degC and 100 degC. Which method separates them?",
              options: [{ t: "Filtration", why: "They are both liquids and fully mixed; nothing would be caught." },
                        { t: "Fractional distillation" },
                        { t: "A separating funnel", why: "That works for liquids that do NOT mix and form layers." }], correct: 1,
              steps: ["They mix, so no layers form and a funnel is no use.",
                      "Different boiling points 22° apart is exactly what a fractionating column exploits."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Is the substance dissolved or not?",
                "What property actually differs between the parts?"] });
    }
  },
  {
    id: "organic", name: "Organic chemistry", subject: "Chemistry", strand: "Structure",
    needs: ["bonding", "formula-mass"],
    teach: "Alkanes are carbon chains with single bonds and the formula CnH2n+2 — methane, ethane, propane. Alkenes have a double bond and CnH2n, which makes them more reactive: the double bond can open up and add something on.",
    gen: function (r, d) {
      if (d === 1) {
        const n = ri(r, 1, 6), names = ["methane", "ethane", "propane", "butane", "pentane", "hexane"];
        return q({ ask: "How many hydrogen atoms does " + names[n - 1] +
            " have? (An alkane with " + n + " carbon" + (n === 1 ? "" : "s") + ", formula CnH2n+2)",
          expect: (2 * n + 2) + "",
          steps: [step("Alkanes follow CnH2n+2."),
                  step("With n = " + n + ": 2 × " + n + " + 2 = " + (2 * n + 2)),
                  step("So " + names[n - 1] + " is C" + n + "H" + (2 * n + 2) + ".")],
          hints: ["Use the general formula.", "Double the carbons, then add two."] });
      }
      if (d === 2) {
        const n = ri(r, 2, 6);
        return q({ ask: "An alkene has " + n + " carbon atoms. What is its formula? (Alkenes are CnH2n)",
          formula: true, expect: "C" + n + "H" + (2 * n),
          steps: [step("Alkenes follow CnH2n — two fewer hydrogens than the alkane."),
                  step("With n = " + n + ": " + (2 * n) + " hydrogens."),
                  step("So the formula is C" + n + "H" + (2 * n) + ".")],
          hints: ["An alkene has a double bond, so two fewer hydrogens than the alkane.",
                  "Just double the carbon count."] });
      }
      const sets = [{ ask: "Why are alkenes more reactive than alkanes?",
                      options: [{ t: "The double bond can open and add atoms across it" },
                                { t: "They have more hydrogens", why: "They have FEWER hydrogens than the matching alkane." },
                                { t: "They are smaller molecules", why: "Size is not what drives it; the double bond is." }], correct: 0,
                      steps: ["A double bond is a site something can add to.",
                              "Alkanes are saturated — there is nowhere for anything to join without breaking a bond first."] },
                    { ask: "Bromine water turns from orange to colorless with one of two substances. Which, and why?",
                      options: [{ t: "The alkane, because it burns", why: "Burning is not what decolorizes bromine water, and alkanes do not react with it." },
                                { t: "The alkene, because bromine adds across the double bond" },
                                { t: "Both, equally", why: "If both reacted the test would distinguish nothing." }], correct: 1,
                      steps: ["Bromine adds across a double bond, using up the orange bromine.",
                              "An alkane has no double bond, so the color stays — which is what makes this a test."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What can a double bond do that a single bond cannot?",
                "Think about what is added, and where it goes."] });
    }
  }
];

/* More AP. The band was seven topics of forty-five, which made "elementary to
   AP" thinner at the top than the range implies. These are the ones where the
   work is deciding WHICH relation applies and carrying a quantity through
   several stages — not arithmetic. */
const AP2 = [
  {
    id: "projectile", name: "Projectiles", subject: "Physics", strand: "Motion",
    needs: ["accel", "circular"],
    teach: "Horizontal and vertical motion are independent. Sideways, nothing accelerates the object, so it travels at a steady speed. Downwards, gravity acts as it would on anything dropped. A bullet fired level and one dropped from the same height hit the ground together.",
    gen: function (r, d) {
      if (d === 1) {
        const t = ri(r, 1, 4), h = 0.5 * 9.81 * t * t;
        return q({ ask: "An object is dropped and falls for " + t +
            " s (g = 9.81 m/s^2). How far does it fall, to 3 significant figures?",
          expect: sigText(h, 3) + " m", sigFigs: 3, tol: 0.01,
          steps: [step("h = ½gt²."), step("t² = " + (t * t)),
                  step("½ × 9.81 × " + (t * t) + " = " + sigText(h, 3) + " m")],
          hints: ["Square the time first.", "h = ½gt²."] });
      }
      if (d === 2) {
        const h = ri(r, 5, 60), t = Math.sqrt(2 * h / 9.81);
        return q({ ask: "A ball rolls off a table " + h +
            " m high (g = 9.81 m/s^2). How long before it lands, to 3 significant figures?",
          expect: sigText(t, 3) + " s", sigFigs: 3, tol: 0.01,
          steps: [step("Only the VERTICAL motion decides the time — the sideways speed does not."),
                  step("h = ½gt², so t = √(2h ÷ g)"),
                  step("√(2 × " + h + " ÷ 9.81) = " + sigText(t, 3) + " s")],
          hints: ["Does the horizontal speed change how long it falls?",
                  "t = √(2h/g)."] });
      }
      const h = ri(r, 5, 45), u = ri(r, 3, 20), t = Math.sqrt(2 * h / 9.81), x = u * t;
      return q({ ask: "A ball leaves a table " + h + " m high at " + u +
          " m/s horizontally (g = 9.81 m/s^2). How far from the table does it land, to 3 significant figures?",
        expect: sigText(x, 3) + " m", sigFigs: 3, tol: 0.01,
        steps: [step("Time in the air comes from the DROP alone: t = √(2h/g) = " + sig(t, 4) + " s"),
                step("Sideways there is no acceleration, so distance = speed × time."),
                step(u + " × " + sig(t, 4) + " = " + sigText(x, 3) + " m"),
                step("The two directions never mix — that is the whole method.")],
        hints: ["Find the time from the vertical drop, then use it sideways.",
                "Horizontal distance = u × t."] });
    }
  },
  {
    id: "efield", name: "Electric fields", subject: "Physics", strand: "Electricity",
    needs: ["capacitor"],
    teach: "Between two parallel plates the field is uniform, and its strength is simply the voltage divided by the gap. A charge placed in it feels a force of qE, whichever way the plates are turned.",
    gen: function (r, d) {
      if (d === 1) {
        const V = ri(r, 2, 12) * 100, dd = ri(r, 1, 9) / 100;
        return q({ ask: V + " V is applied across plates " + dd +
            " m apart. What is the field strength, to 3 significant figures?",
          expect: sigText(V / dd, 3) + " V/m", sigFigs: 3, tol: 0.01,
          steps: [step("E = V ÷ d."), step(V + " ÷ " + dd + " = " + sigText(V / dd, 3) + " V/m")],
          hints: ["Voltage over the gap.", "E = V ÷ d."] });
      }
      if (d === 2) {
        const E = ri(r, 2, 9) * 1000, dd = ri(r, 1, 9) / 100;
        return q({ ask: "A uniform field of " + E + " V/m exists between plates " + dd +
            " m apart. What voltage is across them, to 3 significant figures?",
          expect: sigText(E * dd, 3) + " V", sigFigs: 3, tol: 0.01,
          steps: [step("E = V ÷ d, so V = Ed."),
                  step(E + " × " + dd + " = " + sigText(E * dd, 3) + " V")],
          hints: ["Rearrange for the voltage.", "V = E × d."] });
      }
      const V = ri(r, 2, 12) * 100, dd = ri(r, 1, 9) / 100, q2 = ri(r, 2, 9);
      const F = (V / dd) * (q2 * 1e-6);
      return q({ ask: "A charge of " + q2 + " uC sits between plates " + dd + " m apart with " +
          V + " V across them. What force acts on it, in uN, to 3 significant figures?",
        expect: sigText(F * 1e6, 3) + " uN", sigFigs: 3, tol: 0.01,
        steps: [step("Field first: E = " + V + " ÷ " + dd + " = " + sig(V / dd, 4) + " V/m"),
                step("Then F = qE, with the charge in coulombs: " + (q2 * 1e-6) + " C"),
                step("= " + sigText(F * 1e6, 3) + " µN")],
        hints: ["Two steps: find the field, then the force on the charge.",
                "F = qE, and mind the microcoulombs."] });
    }
  },
  {
    id: "gibbs", name: "Free energy and feasibility", subject: "Chemistry", strand: "Reactions",
    needs: ["enthalpy"],
    teach: "A reaction is feasible when the free energy change is negative. Enthalpy is only half the story: entropy matters too, and it is weighted by temperature — which is why some reactions that will not go when cold will go when hot.",
    gen: function (r, d) {
      if (d === 1) {
        const H = -(ri(r, 2, 9) * 10), T = 298, S = ri(r, 20, 200);
        const G = H * 1000 - T * S;
        return q({ ask: "A reaction has an enthalpy change of " + H +
            " kJ/mol and an entropy change of +" + S + " J/mol K at " + T +
            " K. What is the free energy change, in kJ/mol, to 3 significant figures?",
          expect: sigText(G / 1000, 3) + "", sigFigs: 3, tol: 0.02,
          steps: [step("ΔG = ΔH − TΔS."),
                  step("Work in joules: ΔH = " + (H * 1000) + " J/mol"),
                  step("TΔS = " + T + " × " + S + " = " + (T * S)),
                  step((H * 1000) + " − " + (T * S) + " = " + sig(G, 4) + " J/mol = " + sigText(G / 1000, 3) + " kJ/mol")],
          hints: ["Get both terms into the same units before subtracting.",
                  "ΔG = ΔH − TΔS."] });
      }
      if (d === 2) {
        const H = ri(r, 2, 9) * 10, S = ri(r, 50, 300), T = Math.round(H * 1000 / S);
        return q({ ask: "A reaction has ΔH = +" + H + " kJ/mol and ΔS = +" + S +
            " J/mol K. Above what temperature does it become feasible, in K, to 3 significant figures?",
          expect: sigText(H * 1000 / S, 3) + " K", sigFigs: 3, tol: 0.02,
          steps: [step("Feasible means ΔG < 0, so the turning point is ΔG = 0."),
                  step("0 = ΔH − TΔS, so T = ΔH ÷ ΔS"),
                  step((H * 1000) + " ÷ " + S + " = " + sigText(H * 1000 / S, 3) + " K"),
                  step("Above that, TΔS outweighs ΔH and the reaction goes.")],
          hints: ["Set ΔG to zero and solve for T.",
                  "T = ΔH ÷ ΔS, in matching units."] });
      }
      const sets = [{ ask: "A reaction has ΔH negative and ΔS positive. When is it feasible?",
                      options: [{ t: "At all temperatures" },
                                { t: "Only when hot", why: "Both terms already favor it — heating is not needed." },
                                { t: "Only when cold", why: "Cooling would not help; nothing here opposes the reaction." }], correct: 0,
                      steps: ["ΔG = ΔH − TΔS.",
                              "A negative ΔH and a positive ΔS both push ΔG negative, whatever T is."] },
                    { ask: "A reaction has ΔH positive and ΔS positive. When is it feasible?",
                      options: [{ t: "Never", why: "The entropy term can win if T is large enough." },
                                { t: "Only above a certain temperature" },
                                { t: "At all temperatures", why: "When T is small, TΔS is too small to overcome a positive ΔH." }], correct: 1,
                      steps: ["The TΔS term grows with temperature.",
                              "Once it exceeds ΔH, the free energy change turns negative."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Which way does each term push ΔG?",
                "Only the entropy term depends on temperature."] });
    }
  }
];

SKILLS.push.apply(SKILLS, AP2);

SKILLS.push.apply(SKILLS, BATCH5);

SKILLS.push.apply(SKILLS, AP_SKILLS);

SKILLS.push.apply(SKILLS, BATCH4);

SKILLS.push.apply(SKILLS, BATCH3);

SKILLS.push.apply(SKILLS, ELEMENTARY);

/* ------------------------------- LEVELS -------------------------------
   The app spans elementary to AP, and until now said so nowhere. Tiers are
   levels WITHIN a topic; this is the band the topic itself sits in, so a
   learner can find what is appropriate rather than scrolling 34 topics hoping.

   Assigned by hand, not derived. A rule like "counts prerequisites" would put
   half-life at elementary because it happens to need nothing first, which is
   wrong — it needs no prior topic but is squarely a high-school idea. Where a
   judgement is a judgement, it is written down rather than dressed up as a
   calculation.

   A band is a starting point, not a gate. Nothing is hidden or locked: an
   elementary learner curious about titrations can open titrations.
   ---------------------------------------------------------------------- */
const LEVELS = ["Elementary", "Middle school", "High school", "AP"];

const LEVEL_OF = {
  // Elementary: qualitative, no algebra, no units to rearrange.
  states: "Elementary", "circuits-basic": "Elementary", "forces-basic": "Elementary",
  separating: "Elementary",
  // Middle school: one-step arithmetic with a unit attached.
  speed: "Middle school", density: "Middle school", "formula-mass": "Middle school",
  isotopes: "Middle school", balancing: "Middle school", accel: "Middle school",
  magnetism: "Middle school", nuclear: "Middle school", periodic: "Middle school",
  // High school: rearrangement, multi-step, significant figures.
  force: "High school", energy: "High school", ohm: "High school", pressure: "High school",
  moments: "High school", power: "High school", heat: "High school", parallel: "High school",
  momentum: "High school", waves: "High school", hooke: "High school", halflife: "High school",
  moles: "High school", concentration: "High school", "percent-yield": "High school",
  "gas-volume": "High school", ph: "High school", rates: "High school", bonding: "High school",
  electrolysis: "High school", efficiency: "High school", "gas-laws": "High school",
  "elec-cost": "High school", reflection: "High school", organic: "High school",
  // AP: multi-stage reasoning where the method itself is the difficulty.
  empirical: "AP", titration: "AP", circular: "AP", idealgas: "AP",
  capacitor: "AP", equilibrium: "AP", enthalpy: "AP",
  projectile: "AP", efield: "AP", gibbs: "AP",
};

function levelOf(skillId) { return LEVEL_OF[skillId] || "High school"; }

const BY_ID = {};
SKILLS.forEach(function (s) { BY_ID[s.id] = s; });
const SUBJECTS = ["Physics", "Chemistry"];

/* Build a question. Seed first, then difficulty — the same order Mathema uses,
   because getting that argument order wrong is a bug that hides rather than
   crashes. */
function build(skillId, seed, difficulty) {
  const sk = BY_ID[skillId];
  if (!sk) throw new Error("no skill called " + skillId);
  const d = Math.max(1, Math.min(3, difficulty || 1));
  const out = sk.gen(rng(seed), d);
  out.skill = skillId; out.skillName = sk.name; out.subject = sk.subject;
  out.strand = sk.strand; out.seed = seed; out.difficulty = d;
  out.teach = sk.teach; out.needs = sk.needs || [];
  return out;
}

/* Mark an answer. Returns { ok } or { ok:false, why } or { unreadable, why }.
   The third case exists because "I could not read that" is not "you are
   wrong", and a learner deserves to know which one happened. */
/* A choice question is checked by which option was picked, which is exact —
   no parsing, no tolerance, no judgment. That matters because it is the only
   way the elementary end of this app can exist: "why does ice float" has no
   numeric answer, and inventing one would be worse than not covering it.

   What it is NOT allowed to become: a way to sneak in questions the app cannot
   really check. Every choice question states one correct option and the rest
   are wrong for a stated reason, so the feedback can say WHY rather than just
   "no". */
function markChoice(question, index) {
  if (typeof index !== "number" || index < 0 || index >= question.options.length) {
    return { unreadable: true, why: "No answer was chosen." };
  }
  if (index === question.correct) return { ok: true };
  const opt = question.options[index];
  return { ok: false, why: (opt && opt.why) || "Not quite." };
}

function mark(question, given) {
  if (question.options) return markChoice(question, given);
  /* A formula answer is compared by ATOM COUNT, not as text. CH4 and H4C are
     the same compound; so are Ca(OH)2 and CaO2H2. Marking the second of each
     pair wrong would be marking a learner wrong for writing it differently,
     which is the one thing this app must not do. */
  if (question.formula) {
    const got = CHK.atomCounts(given);
    if (!got) return { unreadable: true, why: "That doesn't read as a chemical formula." };
    const want = CHK.atomCounts(question.expect);
    if (!want) return { unreadable: true, why: "The expected formula couldn't be read." };
    const keys = Object.keys(want);
    const same = keys.length === Object.keys(got).length &&
      keys.every(function (el) { return got[el] === want[el]; });
    if (same) return { ok: true };
    // An empirical formula is a RATIO, so a multiple of it is a different
    // answer to the question asked — say which mistake it is.
    const scale = keys.length ? got[keys[0]] / want[keys[0]] : 0;
    const proportional = scale > 0 && keys.every(function (el) { return got[el] === want[el] * scale; });
    return { ok: false, why: proportional
      ? "That's the right ratio but not the simplest one — divide through."
      : "Not the right combination of atoms." };
  }
  if (question.balance) {
    const r = CHK.isBalanced(given);
    if (r.unreadable) return r;
    if (r.ok) return { ok: true };
    return { ok: false, why: r.why };
  }
  return CHK.checkQuantity(given, question.expect,
    { sigFigs: question.sigFigs, tol: question.tol });
}

/* ------------------------------- SOLVER -------------------------------
   The piece that lets a question come from somewhere other than a hand-written
   generator.

   The checker can already say whether an answer matches. It cannot say what
   the answer IS — so a proposed question has nothing to be checked against.
   That is the same gap Mathema had before its solver, and it is filled the
   same way: the app works the answer out itself, by a route the proposer had
   no part in, and only then compares.

   HOW IT WORKS, AND WHY NOT FREE TEXT

   A proposer does not send a sentence. Parsing "a car accelerates..." reliably
   would need the 170-odd recognized shapes Mathema needs, and anything it
   misread would be discarded anyway. Instead a proposal is structured:

     { relation: "newton2", given: { m: "5 kg", a: "3 m/s^2" }, find: "F" }

   The app solves it, writes the wording itself, and checks the arithmetic by a
   second route. Nothing about the physics comes from the proposer — only the
   choice of what to ask about and what numbers to use.

   CONFIRMATION

   Solving alone is not enough: a wrong rearrangement would be confidently
   wrong. So every solve is confirmed by substituting the answer back into the
   relation and checking it balances. A solve that cannot be confirmed is
   refused, never offered.
   ---------------------------------------------------------------------- */

/* Each relation is a set of named quantities and the rearrangements between
   them. Written out rather than derived symbolically: there are a few dozen,
   they are the ones a syllabus actually uses, and a symbolic rearranger would
   be far more machinery for far less certainty. */
const RELATIONS = {
  speed:     { name: "speed = distance ÷ time", vars: { v: "m/s", s: "m", t: "s" },
               solve: { v: g => g.s / g.t, s: g => g.v * g.t, t: g => g.s / g.v },
               check: g => g.v * g.t - g.s },
  newton2:   { name: "force = mass × acceleration", vars: { F: "N", m: "kg", a: "m/s^2" },
               solve: { F: g => g.m * g.a, m: g => g.F / g.a, a: g => g.F / g.m },
               check: g => g.m * g.a - g.F },
  weight:    { name: "weight = mass × gravitational field strength", vars: { W: "N", m: "kg", g_: "m/s^2" },
               solve: { W: g => g.m * g.g_, m: g => g.W / g.g_, g_: g => g.W / g.m },
               check: g => g.m * g.g_ - g.W },
  density:   { name: "density = mass ÷ volume", vars: { rho: "kg/m^3", m: "kg", V: "m^3" },
               solve: { rho: g => g.m / g.V, m: g => g.rho * g.V, V: g => g.m / g.rho },
               check: g => g.rho * g.V - g.m },
  pressure:  { name: "pressure = force ÷ area", vars: { P: "Pa", F: "N", A: "m^2" },
               solve: { P: g => g.F / g.A, F: g => g.P * g.A, A: g => g.F / g.P },
               check: g => g.P * g.A - g.F },
  moment:    { name: "moment = force × distance", vars: { M: "N m", F: "N", d: "m" },
               solve: { M: g => g.F * g.d, F: g => g.M / g.d, d: g => g.M / g.F },
               check: g => g.F * g.d - g.M },
  ke:        { name: "kinetic energy = ½ × mass × speed²", vars: { E: "J", m: "kg", v: "m/s" },
               solve: { E: g => 0.5 * g.m * g.v * g.v, m: g => 2 * g.E / (g.v * g.v),
                        v: g => Math.sqrt(2 * g.E / g.m) },
               check: g => 0.5 * g.m * g.v * g.v - g.E },
  gpe:       { name: "potential energy = mass × g × height", vars: { E: "J", m: "kg", g_: "m/s^2", h: "m" },
               solve: { E: g => g.m * g.g_ * g.h, m: g => g.E / (g.g_ * g.h),
                        h: g => g.E / (g.m * g.g_), g_: g => g.E / (g.m * g.h) },
               check: g => g.m * g.g_ * g.h - g.E },
  power:     { name: "power = energy ÷ time", vars: { P: "W", E: "J", t: "s" },
               solve: { P: g => g.E / g.t, E: g => g.P * g.t, t: g => g.E / g.P },
               check: g => g.P * g.t - g.E },
  ohm:       { name: "voltage = current × resistance", vars: { V: "V", I: "A", R: "ohm" },
               solve: { V: g => g.I * g.R, I: g => g.V / g.R, R: g => g.V / g.I },
               check: g => g.I * g.R - g.V },
  elecpower: { name: "power = voltage × current", vars: { P: "W", V: "V", I: "A" },
               solve: { P: g => g.V * g.I, V: g => g.P / g.I, I: g => g.P / g.V },
               check: g => g.V * g.I - g.P },
  heat:      { name: "energy = mass × specific heat capacity × temperature change",
               vars: { E: "J", m: "kg", c: "J/kg K", dT: "K" },
               solve: { E: g => g.m * g.c * g.dT, m: g => g.E / (g.c * g.dT),
                        c: g => g.E / (g.m * g.dT), dT: g => g.E / (g.m * g.c) },
               check: g => g.m * g.c * g.dT - g.E },
  momentum:  { name: "momentum = mass × velocity", vars: { p: "kg m/s", m: "kg", v: "m/s" },
               solve: { p: g => g.m * g.v, m: g => g.p / g.v, v: g => g.p / g.m },
               check: g => g.m * g.v - g.p },
  moles:     { name: "moles = mass ÷ relative formula mass", vars: { n: "mol", m: "g", Mr: "" },
               solve: { n: g => g.m / g.Mr, m: g => g.n * g.Mr, Mr: g => g.m / g.n },
               check: g => g.n * g.Mr - g.m },
  wave:      { name: "wave speed = frequency × wavelength", vars: { v: "m/s", f: "Hz", lambda: "m" },
               solve: { v: g => g.f * g.lambda, f: g => g.v / g.lambda, lambda: g => g.v / g.f },
               check: g => g.f * g.lambda - g.v },
  hooke:     { name: "force = spring constant × extension", vars: { F: "N", k: "N/m", x: "m" },
               solve: { F: g => g.k * g.x, k: g => g.F / g.x, x: g => g.F / g.k },
               check: g => g.k * g.x - g.F },
  motoreff:  { name: "force = magnetic flux density × current × length", vars: { F: "N", B: "T", I: "A", L: "m" },
               solve: { F: g => g.B * g.I * g.L, B: g => g.F / (g.I * g.L),
                        I: g => g.F / (g.B * g.L), L: g => g.F / (g.B * g.I) },
               check: g => g.B * g.I * g.L - g.F },
  suvat:     { name: "final speed² = initial speed² + 2 × acceleration × distance",
               vars: { v: "m/s", u: "m/s", a: "m/s^2", s_: "m" },
               /* Both roots can go imaginary: v² + 2as is negative when a
                  deceleration is bigger than the motion allows, and the same
                  for u. Returning NaN would surface as a blank answer, so the
                  square root is guarded and the solver refuses instead — the
                  "no finite answer" path exists exactly for this. */
               solve: { v: g => { const q2 = g.u * g.u + 2 * g.a * g.s_; return q2 < 0 ? NaN : Math.sqrt(q2); },
                        u: g => { const q2 = g.v * g.v - 2 * g.a * g.s_; return q2 < 0 ? NaN : Math.sqrt(q2); },
                        a: g => (g.v * g.v - g.u * g.u) / (2 * g.s_),
                        s_: g => (g.v * g.v - g.u * g.u) / (2 * g.a) },
               check: g => g.u * g.u + 2 * g.a * g.s_ - g.v * g.v },
  accel:     { name: "acceleration = change in speed ÷ time", vars: { a: "m/s^2", dv: "m/s", t: "s" },
               solve: { a: g => g.dv / g.t, dv: g => g.a * g.t, t: g => g.dv / g.a },
               check: g => g.a * g.t - g.dv },
  efficiency:{ name: "efficiency = useful output ÷ total input", vars: { e: "", out: "J", inn: "J" },
               solve: { e: g => g.out / g.inn, out: g => g.e * g.inn, inn: g => g.out / g.e },
               check: g => g.e * g.inn - g.out },
  boyle:     { name: "pressure × volume is constant", vars: { P1: "Pa", V1: "m^3", P2: "Pa", V2: "m^3" },
               solve: { P2: g => g.P1 * g.V1 / g.V2, V2: g => g.P1 * g.V1 / g.P2,
                        P1: g => g.P2 * g.V2 / g.V1, V1: g => g.P2 * g.V2 / g.P1 },
               check: g => g.P1 * g.V1 - g.P2 * g.V2 },
  circular:  { name: "centripetal acceleration = speed² ÷ radius", vars: { a: "m/s^2", v: "m/s", r: "m" },
               solve: { a: g => g.v * g.v / g.r, v: g => Math.sqrt(g.a * g.r), r: g => g.v * g.v / g.a },
               check: g => g.v * g.v / g.r - g.a },
  idealgas:  { name: "pressure × volume = moles × R × temperature",
               vars: { P: "Pa", V: "m^3", n: "mol", T: "K" },
               solve: { P: g => g.n * 8.314 * g.T / g.V, V: g => g.n * 8.314 * g.T / g.P,
                        n: g => g.P * g.V / (8.314 * g.T), T: g => g.P * g.V / (8.314 * g.n) },
               check: g => g.P * g.V - g.n * 8.314 * g.T },
  capacitor: { name: "charge = capacitance × voltage", vars: { Q: "C", C_: "F", V: "V" },
               solve: { Q: g => g.C_ * g.V, C_: g => g.Q / g.V, V: g => g.Q / g.C_ },
               check: g => g.C_ * g.V - g.Q },
  efield:    { name: "electric field strength = voltage ÷ separation", vars: { E: "V/m", V: "V", d: "m" },
               solve: { E: g => g.V / g.d, V: g => g.E * g.d, d: g => g.V / g.E },
               check: g => g.E * g.d - g.V },
  gibbs:     { name: "free energy change = enthalpy change − temperature × entropy change",
               vars: { G: "J", H: "J", T: "K", S_: "J/K" },
               solve: { G: g => g.H - g.T * g.S_, H: g => g.G + g.T * g.S_,
                        S_: g => (g.H - g.G) / g.T, T: g => (g.H - g.G) / g.S_ },
               check: g => g.H - g.T * g.S_ - g.G },
  projectile:{ name: "height fallen = ½ × g × time²", vars: { h: "m", g_: "m/s^2", t: "s" },
               solve: { h: g => 0.5 * g.g_ * g.t * g.t, t: g => Math.sqrt(2 * g.h / g.g_),
                        g_: g => 2 * g.h / (g.t * g.t) },
               check: g => 0.5 * g.g_ * g.t * g.t - g.h },
  charge:    { name: "charge = current × time", vars: { Q: "C", I: "A", t: "s" },
               solve: { Q: g => g.I * g.t, I: g => g.Q / g.t, t: g => g.Q / g.I },
               check: g => g.I * g.t - g.Q },
  conc:      { name: "concentration = moles ÷ volume", vars: { c: "mol/L", n: "mol", V: "L" },
               solve: { c: g => g.n / g.V, n: g => g.c * g.V, V: g => g.n / g.c },
               check: g => g.c * g.V - g.n }
};

/* Solve one relation for one unknown, then confirm.

   Returns { ok, value, unit, confirmedBy } or { ok:false, why }. A refusal is
   never dressed up as an answer. */
function solveRelation(relId, given, find) {
  const rel = RELATIONS[relId];
  if (!rel) return { ok: false, why: "no relation called " + relId };
  if (!rel.vars.hasOwnProperty(find)) return { ok: false, why: find + " is not part of " + relId };
  if (!rel.solve[find]) return { ok: false, why: "this cannot be rearranged for " + find };

  // Every other variable must be present and readable, in units that match the
  // dimension the relation expects. A value in the wrong dimension is refused
  // rather than silently used.
  const vals = {};
  for (const k in rel.vars) {
    if (k === find) continue;
    const raw = given[k];
    if (raw === undefined || raw === null || raw === "") return { ok: false, why: "missing " + k };
    const parsed = CHK.parseQuantity(String(raw));
    if (!parsed) return { ok: false, why: k + " couldn't be read" };
    if (rel.vars[k]) {
      const want = CHK.parseUnit(rel.vars[k]);
      if (want && !parsed.d.every(function (x, i) { return x === want.d[i]; })) {
        return { ok: false, why: k + " is the wrong kind of quantity" };
      }
    }
    vals[k] = parsed.base;    // work in SI base units throughout
  }

  let value;
  try { value = rel.solve[find](vals); } catch (e) { return { ok: false, why: "the arithmetic failed" }; }
  if (!isFinite(value)) return { ok: false, why: "that has no finite answer" };

  /* CONFIRMATION. Put the answer back into the relation and require it to
     balance. A wrong rearrangement is confidently wrong, and this is what
     catches it — the same discipline Mathema's solver uses. */
  const back = Object.assign({}, vals);
  back[find] = value;
  let residual;
  try { residual = rel.check(back); } catch (e) { return { ok: false, why: "couldn't confirm the answer" }; }
  const scale = Math.max(Math.abs(value), 1e-12);
  if (!isFinite(residual) || Math.abs(residual) > 1e-6 * Math.max(scale, 1)) {
    return { ok: false, why: "the answer didn't check out when substituted back" };
  }

  return { ok: true, value: value, unit: siUnitOf(rel.vars[find]), confirmedBy: "substitution" };
}

/* The SI form of a relation's declared unit, so an answer is always stated in
   base units rather than whatever the question happened to use. */
function siUnitOf(unitText) {
  if (!unitText) return "";
  return unitText;
}

/* Verify a proposal.

   Five things must hold, and they are checked in this order so that the
   cheapest refusals happen first:
     1. the relation is one we know
     2. every given quantity reads, in the right dimension
     3. WE solve it — not the proposer
     4. the solve confirms by substitution
     5. only then does the proposer's answer have to agree

   A failure at any step is a discard. Nothing is repaired: correcting a
   proposer's answer would quietly make its mistakes ours. */
function verifyProposal(prop) {
  if (!prop || !prop.relation) return { accept: false, why: "no relation given" };
  const res = solveRelation(prop.relation, prop.given || {}, prop.find);
  if (!res.ok) return { accept: false, why: res.why };

  // The proposer's own answer is optional: it is a cross-check, not the source
  // of truth. When it is present and disagrees, the whole proposal goes.
  if (prop.answer !== undefined && prop.answer !== null && prop.answer !== "") {
    const theirs = CHK.parseQuantity(String(prop.answer));
    if (!theirs) return { accept: false, why: "the proposed answer couldn't be read" };
    const denom = Math.abs(res.value) > 1e-30 ? Math.abs(res.value) : 1;
    if (Math.abs(theirs.base - res.value) / denom > 0.01) {
      return { accept: false, why: "the proposed answer disagrees with ours" };
    }
  }

  return { accept: true, value: res.value, unit: res.unit, confirmedBy: res.confirmedBy };
}

/* ------------------------------ CLOUD SYNC ----------------------------
   Optional, and additive. Elements works exactly as before with no account
   and no network: the device is the source of truth and always has been.
   Signing in adds a copy in Supabase so a record follows you to another one.

   The same account as Study It, Lectern, CodeQuest and Mathema — one sign-in,
   five apps.

   TWO RULES, the same as the sibling apps, for the same reasons:

   Nothing is silently overwritten. If a device and the cloud both hold work
   and they disagree, the learner is asked which to keep. There is no merge,
   because a wrong merge loses work while looking like it worked.

   A sync that did not happen never reports that it did.

   WHAT TRAVELS: the record, and any topics you had made. Generated topics are
   included because their questions were solved and confirmed before they were
   ever shown — losing them on a new device would be losing verified work. They
   arrive still marked as generated, so the caveat travels with them.
   ---------------------------------------------------------------------- */
const CLOUD_TABLE = "elements_state";

let _sbEl2 = null;
function syncClient() {
  if (_sbEl2) return _sbEl2;
  _sbEl2 = (async function () {
    try {
      const mod = await import(/* @vite-ignore */ "https://esm.sh/@supabase/supabase-js@2");
      return mod.createClient(
        "https://nfbzmxuruxqgbeeypsoq.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpteHVydXhxZ2JlZXlwc29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ0MTUsImV4cCI6MjA5NTU3MDQxNX0.NqQKeIO3pYOk5rbG4YtJApz1lnss_OZvhWuVkIY79-U",
        { auth: { persistSession: true, autoRefreshToken: true, storageKey: "elements.sb.auth" } }
      );
    } catch (e) { return null; }
  })();
  return _sbEl2;
}

/* Is there anything here worth protecting? Deliberately conservative: one
   answered question counts, and so does one made topic — losing either is
   losing something. */
function hasWork(bundle) {
  if (!bundle || typeof bundle !== "object") return false;
  const rec = bundle.record || {};
  const skills = rec.skills && typeof rec.skills === "object" ? Object.keys(rec.skills).length : 0;
  const misses = Array.isArray(rec.misses) ? rec.misses.length : 0;
  const topics = Array.isArray(bundle.topics) ? bundle.topics.length : 0;
  return skills > 0 || misses > 0 || topics > 0;
}

/* Compare on the parts that represent work, not on preferences. A different
   level filter is not a conflict worth interrupting anyone for. */
function sameBundle(a, b) {
  try {
    const pick = x => JSON.stringify([
      (x && x.record && x.record.skills) || null,
      (x && x.record && x.record.misses) || null,
      ((x && x.topics) || []).map(t => t.id).sort(),
    ]);
    return pick(a) === pick(b);
  } catch (e) { return false; }
}

async function pullBundle(sb, userId) {
  const { data, error } = await sb.from(CLOUD_TABLE).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data && data.data ? data.data : null;
}

async function pushBundle(sb, userId, bundle) {
  const { error } = await sb.from(CLOUD_TABLE)
    .upsert({ user_id: userId, data: bundle, updated_at: new Date().toISOString() },
            { onConflict: "user_id" });
  if (error) throw error;
}

/* First contact after signing in. Reports what happened rather than acting on
   its own, so the caller can ask the learner when it genuinely matters. */
async function reconcile(sb, userId, local) {
  let remote;
  try { remote = await pullBundle(sb, userId); }
  catch (e) { return { kind: "error", why: (e && e.message) || "Couldn't reach the cloud." }; }

  if (!hasWork(remote)) {
    try { await pushBundle(sb, userId, local); return { kind: "uploaded" }; }
    catch (e) { return { kind: "error", why: (e && e.message) || "Upload failed." }; }
  }
  if (!hasWork(local)) return { kind: "downloaded", bundle: remote };
  if (sameBundle(local, remote)) return { kind: "same" };
  return { kind: "conflict", remote: remote };
}

/* ---------------------------- GENERATED TOPICS ------------------------
   Asking for a topic that isn't in the app yet.

   WHAT IS CHECKED AND WHAT ISN'T — the important part.

   Every QUESTION in a generated topic goes through the solver: the app works
   the answer out from the relation itself, confirms it by substituting back,
   and discards anything it cannot confirm. That part is as trustworthy as a
   hand-written question, because it is verified the same way.

   The TEACHING is not checked. Nothing here can decide whether an explanation
   is a good one, and pretending otherwise would be the exact failure this app
   exists to avoid. So a generated topic says so, on the topic itself and above
   the teaching, every time — not once in a settings note.

   That is the same honest split CodeQuest uses: its interpreter proves the
   code runs, and nothing claims the prose around it was proved.

   WHY A RELATION IS REQUIRED

   A proposal must name a relation the app already knows, or supply one as a
   formula the solver can test. A topic whose math the app cannot do is a
   topic whose questions it cannot check — and unchecked questions are exactly
   what must never reach a learner.
   ---------------------------------------------------------------------- */

const GEN_STORE = "elements.topics.v1";

function loadTopics() {
  try {
    const raw = localStorage.getItem(GEN_STORE);
    const a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function saveTopics(list) {
  try { localStorage.setItem(GEN_STORE, JSON.stringify(list.slice(0, 40))); } catch (e) {}
}

let _sbEl = null;
function elClient() {
  if (_sbEl) return _sbEl;
  _sbEl = (async function () {
    try {
      const mod = await import(/* @vite-ignore */ "https://esm.sh/@supabase/supabase-js@2");
      return mod.createClient(
        "https://nfbzmxuruxqgbeeypsoq.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpteHVydXhxZ2JlZXlwc29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ0MTUsImV4cCI6MjA5NTU3MDQxNX0.NqQKeIO3pYOk5rbG4YtJApz1lnss_OZvhWuVkIY79-U",
        { auth: { persistSession: true, autoRefreshToken: true, storageKey: "elements.sb.auth" } }
      );
    } catch (e) { return null; }
  })();
  return _sbEl;
}

/* The prompt. Built around what the solver can actually check, because a
   proposal naming physics the app cannot do is discarded however good it is —
   asking for it would waste the learner's daily allowance on refusals. */
/* Two names mean the same topic if they say the same thing in different words.
   Compared on the words that carry meaning, with the filler dropped, so
   "Pressure in liquids" and "liquid pressure" match but "pressure" and
   "momentum" do not. */
function topicKey(name) {
  return String(name || "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(function (w) {
      return w && w.length > 2 &&
        ["the", "and", "for", "with", "from", "into", "about", "using"].indexOf(w) === -1;
    })
    // Drop a trailing s. Without this "liquid" and "liquids" were different
    // words, so "pressure in liquids" and "liquid pressure" read as two topics
    // — and so did "Ohm's law" and "ohms law", which is the same page twice.
    // Deliberately crude: proper stemming would be a library, and the failure
    // mode here is only ever a near-duplicate slipping through.
    .map(function (w) { return w.length > 3 && w.slice(-1) === "s" ? w.slice(0, -1) : w; })
    .sort().join(" ");
}

function sameTopic(a, b) {
  const ka = topicKey(a), kb = topicKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  /* Containment counts only when the shorter name has at least two meaningful
     words. On one word it over-matches badly: "forces" would veto "Force, mass,
     acceleration", and "energy" would veto half the syllabus.

     The consequence is deliberate — asking for "pressure in liquids" when
     "Pressure" exists is allowed, because a narrower topic is a real topic and
     not a second copy of a broader one. The failure this guards against is two
     entries teaching the SAME thing, not two entries sharing a word. */
  const wa = ka.split(" "), wb = kb.split(" ");
  const shorter = Math.min(wa.length, wb.length);
  if (shorter < 2) return false;
  const shared = wa.filter(function (w) { return wb.indexOf(w) !== -1; }).length;
  return shared === shorter;
}

/* Is this already here? Checks the built-in topics as well as made ones —
   asking for "moments" when the app already teaches moments should send the
   learner to the real one rather than making a thinner copy of it. */
function findExistingTopic(request, madeTopics) {
  for (let i = 0; i < SKILLS.length; i++) {
    if (sameTopic(request, SKILLS[i].name)) return { kind: "built-in", skill: SKILLS[i] };
  }
  const made = madeTopics || [];
  for (let i = 0; i < made.length; i++) {
    if (sameTopic(request, made[i].name)) return { kind: "made", topic: made[i] };
  }
  return null;
}

function topicPrompt(request, existingNames) {
  const known = Object.keys(RELATIONS).map(function (k) {
    return "  " + k + " — " + RELATIONS[k].name + "  (variables: " + Object.keys(RELATIONS[k].vars).join(", ") + ")";
  }).join("\n");
  return [
    'Write a short science topic for a learner who asked for: "' + String(request).slice(0, 120) + '"',
    "",
    "Return ONLY a JSON object. No prose, no markdown fences:",
    '{"name":"...","subject":"Physics|Chemistry","strand":"...","teach":"...",',
    ' "questions":[{"relation":"<id>","given":{"<var>":"<value with unit>"},"find":"<var>","answer":"<value with unit>"}]}',
    "",
    "You may ONLY use these relations. A question using anything else is discarded:",
    known,
    "",
    "Rules:",
    "- Give 6 questions, easiest first.",
    "- Every value must include its unit, e.g. \"5 kg\", \"3 m/s^2\". A bare number is discarded.",
    "- `find` must be one of that relation's variables, and must NOT appear in `given`.",
    "- Every OTHER variable of that relation must appear in `given`.",
    "- teach: two or three sentences on what the idea is and why the formula looks like that.",
    "- If the request needs physics not in the list above, say so in `teach` and give the",
    "  closest questions you can from the list rather than inventing a relation.",
    "",
    "These topics already exist. Do NOT write another version of any of them —",
    "if the request is one of these, pick a genuinely different angle or a",
    "narrower part of it, and name it so the difference is obvious:",
    (existingNames && existingNames.length ? existingNames.map(function (n) { return "  " + n; }).join("\n") : "  (none yet)")
  ].join("\n");
}

function readTopic(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  let o;
  try { o = JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  if (!o || typeof o.name !== "string" || !Array.isArray(o.questions)) return null;
  return o;
}

/* Turn a verified proposal into a real question — same shape a hand-written
   generator produces, so nothing downstream needs to know where it came from
   or can treat it differently. The WORDING is written here, by us, from the
   relation: the proposer chose the numbers, not the physics. */
function questionFromProposal(prop, verdict) {
  const rel = RELATIONS[prop.relation];
  const givens = Object.keys(prop.given).map(function (k) { return prop.given[k] + " (" + k + ")"; });
  const unit = rel.vars[prop.find];
  return {
    ask: "Using " + rel.name + ": given " + givens.join(", ") + ", find " + prop.find + ".",
    expect: verdict.value + (unit ? " " + unit : ""),
    tol: 0.01,
    steps: [step("The relation is " + rel.name + "."),
            step("Rearrange it for " + prop.find + "."),
            step("Substituting gives " + sig(verdict.value, 4) + (unit ? " " + unit : "") + "."),
            step("Confirmed by putting the answer back into the relation.")],
    hints: ["Which relation connects these quantities?",
            "Rearrange for " + prop.find + " before substituting."],
    generated: true,
    confirmedBy: verdict.confirmedBy
  };
}

/* Ask for a topic, keep only what survives.

   Returns { ok, topic, kept, dropped, why }. A topic with no surviving
   questions is not offered at all — teaching with nothing to practice is not
   a topic, and offering it would imply a completeness that isn't there. */
async function generateTopic(request, opts) {
  const o = opts || {};
  const made = o.existing || [];

  /* Refuse BEFORE spending anything. A second copy of a topic that already
     exists is worse than useless: it splits a learner's record across two
     entries, and the built-in one is hand-written and better. This costs
     nothing and saves a call against the daily allowance. */
  const already = findExistingTopic(request, made);
  if (already) {
    return { ok: false, duplicate: already,
      why: already.kind === "built-in"
        ? "\u201c" + already.skill.name + "\u201d is already here, hand-written and checked. Nothing made would be better than that."
        : "You already made \u201c" + already.topic.name + "\u201d. Open that rather than making a second copy." };
  }

  const sb = o.client || await elClient();
  if (!sb) return { ok: false, why: "Couldn't reach the topic service." };

  /* Deliberately NOT filtered by level: the duplicate check must see every
     topic that exists, whatever band it sits in. Filtering here would let a
     learner browsing Elementary generate a second copy of an AP topic. */
  const existingNames = SKILLS.map(function (x) { return x.name; })
    .concat(made.map(function (x) { return x.name; }));

  let data, error;
  try {
    const r = await sb.functions.invoke("ai", { body: { prompt: topicPrompt(request, existingNames) } });
    data = r.data; error = r.error;
  } catch (e) { return { ok: false, why: "Couldn't reach the topic service." }; }
  const said = data && data.error;
  if (said) return { ok: false, why: said };
  if (error) return { ok: false, why: error.message || "The request failed." };

  const raw = readTopic(data && data.text);
  if (!raw) return { ok: false, why: "Nothing usable came back." };

  const kept = [], dropped = [];
  raw.questions.forEach(function (prop) {
    const v = verifyProposal(prop);
    if (v.accept) kept.push(questionFromProposal(prop, v));
    else dropped.push({ why: v.why, relation: prop && prop.relation });
  });

  /* The prompt asked it not to duplicate; models do it anyway. Check the name
     that actually came back, not the one that was asked for. */
  const clash = findExistingTopic(raw.name, made);
  if (clash) {
    return { ok: false, duplicate: clash,
      why: "That came back as another version of \u201c" +
        (clash.kind === "built-in" ? clash.skill.name : clash.topic.name) +
        "\u201d, which is already here — so it isn't being added." };
  }

  if (!kept.length) {
    return { ok: false, kept: [], dropped: dropped,
      why: "None of the questions could be checked, so the topic isn't being offered." };
  }

  return {
    ok: true,
    topic: {
      id: "gen:" + Date.now().toString(36),
      name: String(raw.name).slice(0, 60),
      subject: raw.subject === "Chemistry" ? "Chemistry" : "Physics",
      strand: String(raw.strand || "Generated").slice(0, 40),
      teach: String(raw.teach || "").slice(0, 600),
      questions: kept,
      generated: true,
      at: Date.now()
    },
    kept: kept, dropped: dropped
  };
}

/* ------------------------------- RECORD --------------------------------
   What the app remembers, and why it remembers that.

   Until now Elements forgot everything the moment you closed the tab — which
   made it a question generator rather than something you could learn from.
   A learner needs three things kept: what they have answered, what they got
   wrong, and when a thing is due to come back.

   Kept per skill and per tier, because "I can do density" is not one fact:
   someone can be solid on tier 1 and lost at tier 3, and a record that
   averaged those would hide exactly what is worth knowing.

   REVIEW SCHEDULING. Get something right and it comes back after a day, then
   three, then a week, then a fortnight, then a month. Get it wrong and it
   resets to a day. That is deliberately unclever: a longer, better-tuned
   ladder would need evidence this app does not have yet, and inventing one
   would be dressing a guess up as a method.
   ---------------------------------------------------------------------- */
const STORE = "elements.v1";
const STEPS_DAYS = [1, 3, 7, 14, 30];
const DAY = 86400000;

function loadRecord() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return { skills: {}, misses: [] };
    const o = JSON.parse(raw);
    return { skills: (o && o.skills) || {}, misses: (o && o.misses) || [] };
  } catch (e) { return { skills: {}, misses: [] }; }
}
function saveRecord(rec) {
  try { localStorage.setItem(STORE, JSON.stringify(rec)); } catch (e) {}
}

/* The record key. A made topic's id contains a colon ("gen:k3f9"), so splitting
   the key on the FIRST colon tore it apart and every made topic's review
   pointed at a skill called "gen". Split on the LAST one instead: a tier is
   always a single digit at the end, whatever the id looks like. */
const keyOf = (skillId, tier) => skillId + ":" + tier;
function splitKey(k) {
  const i = String(k).lastIndexOf(":");
  return i === -1 ? { skill: k, tier: 1 } : { skill: k.slice(0, i), tier: Number(k.slice(i + 1)) || 1 };
}

/* Fold one answered question into the record. Pure: it returns the next
   record rather than mutating, so a caller can never half-apply it. */
function applyAnswer(rec, skillId, tier, correct, question, helped) {
  const k = keyOf(skillId, tier);
  const prev = rec.skills[k] || { seen: 0, right: 0, streak: 0, step: -1, due: 0 };
  const seen = prev.seen + 1;
  const right = prev.right + (correct ? 1 : 0);
  const streak = correct ? prev.streak + 1 : 0;
  /* Right moves one rung up the ladder; wrong drops all the way back, because
     a thing you have just got wrong is not a thing to leave for a month.

     Right AFTER being shown the first step holds where it is: you did get it,
     so it is not a failure, but you did not do it unaided, so scheduling it a
     month out would be scheduling on evidence that isn't there. Holding is the
     honest middle — it comes back at the same interval rather than a longer
     one. */
  const step = !correct ? 0
    : helped ? prev.step < 0 ? 0 : prev.step
    : Math.min(prev.step + 1, STEPS_DAYS.length - 1);
  const due = Date.now() + STEPS_DAYS[step] * DAY;

  const skills = Object.assign({}, rec.skills);
  skills[k] = { seen: seen, right: right, streak: correct && helped ? prev.streak : streak,
                // `last` is read on the record screen. It was being written and
                // never used, which is the same dead-data flaw as the misses.
                step: step, due: due, last: Date.now(),
                // Counted so the record can say how much was done unaided,
                // rather than implying every correct answer was the same.
                helped: (prev.helped || 0) + (correct && helped ? 1 : 0) };

  // Misses are kept whole — the question, what was given, what was wanted —
  // so they can be revisited rather than just counted.
  let misses = rec.misses;
  if (!correct && question) {
    misses = [{ skill: skillId, tier: tier, ask: question.ask, expect: question.expect,
                at: Date.now() }].concat(rec.misses).slice(0, 60);
  }
  return { skills: skills, misses: misses };
}

/* ------------------------------ LEVEL CHECK ---------------------------
   "Which band should I be working in?"

   The level filter says what EXISTS at each band. Nothing said which band the
   learner belongs in, and with 45 topics across four of them that is the first
   question anyone has.

   WHY THIS IS NOT MATHEMA'S PLACEMENT TEST

   Mathema walks a 182-skill prerequisite graph and returns a frontier. Elements
   has a shallow graph — most topics need nothing first — so that machinery
   would be a lot of ceremony for very little signal. What Elements has instead
   is a declared level per topic, so the useful question is narrower and the
   test can be much shorter: work UP from the bottom, stop when a band stops
   holding.

   WHAT IT REPORTS

   The highest band where most answers were right, and the first band that
   wasn't. Not a score, not a percentage, and explicitly not a verdict on the
   learner — a band is where to start reading, and it says so.

   Two questions per band, eight in total. That is deliberately few: this is a
   signpost, not an exam, and a long test at the front door is a good way to
   make someone close the tab.
   ---------------------------------------------------------------------- */
const CHECK_PER_BAND = 2;

/* Build the check: a couple of questions from each band, easiest band first,
   drawn from topics that band actually has. Seeded so a retry gives the same
   paper rather than a different one — a different result from a different draw
   would be indistinguishable from having learned something. */
function buildLevelCheck(seed) {
  const out = [];
  let n = seed || 1;
  const next = function () { n = (n * 1103515245 + 12345) & 0x7fffffff; return n; };
  LEVELS.forEach(function (L) {
    const inBand = SKILLS.filter(function (sk) { return levelOf(sk.id) === L; });
    if (!inBand.length) return;
    for (let i = 0; i < CHECK_PER_BAND; i++) {
      const sk = inBand[next() % inBand.length];
      // Middle tier: the question should ask whether the topic is there at all,
      // not whether its hardest form is.
      let q;
      try { q = build(sk.id, next(), 2); } catch (e) { continue; }
      if (q && q.ask) out.push({ level: L, skill: sk.id, q: q });
    }
  });
  return out;
}

/* Read the answers.

   `solid` is the highest band where the learner got most right AND every band
   below it held too — a good score at AP means nothing if middle school did
   not hold, and reporting it would be flattering rather than useful.

   Refusals to answer count as not-yet, which is the truthful reading: a
   question you would rather skip is not one you are secure on. */
function readLevelCheck(results) {
  const byBand = {};
  results.forEach(function (r) {
    const b = byBand[r.level] || (byBand[r.level] = { right: 0, asked: 0 });
    b.asked++; if (r.correct) b.right++;
  });

  let solid = null, firstShaky = null;
  for (let i = 0; i < LEVELS.length; i++) {
    const L = LEVELS[i], b = byBand[L];
    if (!b || !b.asked) continue;
    const held = b.right / b.asked >= 0.5;
    if (held && firstShaky === null) solid = L;
    else if (!held && firstShaky === null) { firstShaky = L; }
  }
  return {
    byBand: byBand,
    solid: solid,
    startAt: firstShaky || solid || LEVELS[0],
    // Said plainly, because eight questions is eight questions.
    caveat: "Eight questions is a signpost, not a verdict. Nothing here is saved " +
      "against your record, and you can work at any level you like."
  };
}

/* ---------------------------- WHAT COMES FIRST ------------------------
   Every skill declares what it rests on. Until now that was decoration — the
   data was there and nothing read it, which is the same flaw as recording
   misses and never showing them.

   What it is used for, and what it is NOT used for:

   USED to say what a topic builds on, and to suggest what to do next. Someone
   staring at nineteen topics with no idea which to open is the problem this
   solves.

   NOT used to lock anything. A learner who wants to try momentum before
   forces is allowed to — they may know it already, or want to see where it is
   going, and an app that refuses is guessing about a person it cannot see.
   The prerequisites inform; they do not gate.
   ---------------------------------------------------------------------- */

/* Is this ready to try? Ready means every prerequisite has been answered
   correctly at least once — not mastered, just met. Demanding mastery would
   make the whole graph unreachable from a standing start. */
function isReady(rec, skillId) {
  const sk = BY_ID[skillId];
  if (!sk) return false;
  const needs = sk.needs || [];
  return needs.every(function (n) {
    for (let t = 1; t <= 3; t++) {
      const st = rec.skills[keyOf(n, t)];
      if (st && st.right > 0) return true;
    }
    return false;
  });
}

/* The prerequisites not yet met, by name, so a topic can say what it assumes
   rather than just refusing to explain itself. */
function missingNeeds(rec, skillId) {
  const sk = BY_ID[skillId];
  if (!sk) return [];
  return (sk.needs || []).filter(function (n) {
    for (let t = 1; t <= 3; t++) {
      const st = rec.skills[keyOf(n, t)];
      if (st && st.right > 0) return false;
    }
    return true;
  }).map(function (n) { return BY_ID[n] ? BY_ID[n].name : n; });
}

/* What to do next.

   Reviews first — something you are about to forget is worth more than
   something new. Then a topic that is ready and untouched. Then anything
   started but not solid. Returns null when there is genuinely nothing to
   suggest, rather than inventing a recommendation. */
function suggestNext(rec, level) {
  /* Respect the level filter. Someone who has narrowed the list to Elementary
     and is then told to try an AP topic has been given advice that ignores the
     only thing they told the app about themselves.

     Reviews are the exception: something you are about to forget is worth
     surfacing whatever band it sits in, because it is already YOUR work rather
     than a suggestion about where to go next. */
  const inBand = function (id) { return !level || levelOf(id) === level; };

  const due = dueNow(rec);
  if (due.length) {
    return { kind: "review", skill: due[0].skill, tier: due[0].tier,
      why: "You were getting this; it is due before you forget it." };
  }
  const untouched = SKILLS.filter(function (sk) {
    return inBand(sk.id) && standing(rec, sk.id).seen === 0 && isReady(rec, sk.id);
  });
  if (untouched.length) {
    return { kind: "new", skill: untouched[0].id,
      why: (untouched[0].needs || []).length
        ? "You have what this builds on."
        : "This one doesn't need anything first." };
  }
  const shaky = SKILLS.filter(function (sk) {
    const g = standing(rec, sk.id);
    return inBand(sk.id) && g.seen > 0 && g.label !== "solid";
  });
  if (shaky.length) {
    return { kind: "continue", skill: shaky[0].id,
      why: "Started but not solid at every level yet." };
  }
  /* Nothing to suggest WITHIN the chosen band is different from nothing to
     suggest at all — say which, so a filter that hides everything explains
     itself rather than just showing a blank space. */
  if (level) {
    const anyLeft = SKILLS.some(function (sk) {
      return inBand(sk.id) && standing(rec, sk.id).label !== "solid";
    });
    if (!anyLeft) return { kind: "bandDone", level: level };
  }
  return null;
}

/* Everything due, soonest first. A skill never answered is not "due" — it has
   not been started, which is a different thing and belongs on the map. */
function dueNow(rec, now) {
  const t = now || Date.now();
  const out = [];
  for (const k in rec.skills) {
    const st = rec.skills[k];
    if (st.due && st.due <= t) {
      /* A made topic's id is not in BY_ID, and an earlier version filtered on
         that — so a made topic could be recorded but never come back for
         review. Anything with a due date is due, wherever it came from. */
      const bits = splitKey(k);
      out.push({ skill: bits.skill, tier: bits.tier, due: st.due, state: st,
                 made: !BY_ID[bits.skill] });
    }
  }
  return out.sort(function (a, b) { return a.due - b.due; });
}

/* A skill's standing, for the map. Deliberately three states and not a
   percentage: a bar reading 67% invites you to grind it to 100 rather than
   move on, and accuracy on four questions is not a measurement anyway. */
function standing(rec, skillId) {
  let seen = 0, right = 0, tiers = 0, due = false, helped = 0, streak = 0, last = 0;
  for (let t = 1; t <= 3; t++) {
    const st = rec.skills[keyOf(skillId, t)];
    if (!st) continue;
    tiers++; seen += st.seen; right += st.right; helped += st.helped || 0;
    if ((st.streak || 0) > streak) streak = st.streak;
    if ((st.last || 0) > last) last = st.last;
    if (st.due && st.due <= Date.now()) due = true;
  }
  if (!seen) return { label: "", seen: 0, due: false, helped: 0, streak: 0, last: 0 };
  const base = { seen: seen, right: right, helped: helped, due: due, streak: streak, last: last };
  if (due) return Object.assign({ label: "due for review" }, base);

  /* "Solid" has to mean solid unaided. Counting answers that only came after
     being shown the first step would let a topic read as mastered on the
     strength of help — which is exactly the kind of flattering lie this app
     exists not to tell. So the accuracy that decides it is measured on the
     answers you got without a hand. */
  const unaided = right - helped;
  if (tiers === 3 && unaided / seen >= 0.8) return Object.assign({ label: "solid" }, base);
  if (tiers === 3 && right / seen >= 0.8 && helped > 0) {
    return Object.assign({ label: "getting there" }, base);
  }
  return Object.assign({ label: "started" }, base);
}

/* How long ago, in words. Deliberately coarse: "3 days ago" is what a learner
   wants, and a precise timestamp would suggest a precision that does not
   matter here. */
function agoText(t) {
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "an hour ago" : hrs + " hours ago";
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return days + " days ago";
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : months + " months ago";
}

const totals = (rec) => {
  let seen = 0, right = 0, started = 0, helped = 0;
  for (const k in rec.skills) {
    seen += rec.skills[k].seen; right += rec.skills[k].right;
    helped += rec.skills[k].helped || 0; started++;
  }
  return { seen: seen, right: right, started: started, helped: helped };
};

/* --------------------------------- CSS ---------------------------------
   Its own look: cool greys and a blue-green accent, so a science screen is
   never mistaken for a math one at a glance. Sized for a phone first.
   ---------------------------------------------------------------------- */
const CSS = `
.el{--paper:#f5f7f9;--card:#fff;--card-2:#eef2f5;--ink:#111820;--ink-soft:#3d4a57;
  --ink-faint:#6b7885;--line:#dbe3ea;--a:#0f766e;--a-tint:#d6f0ec;--no:#b42318;--no-bg:#fee4e2;
  --ok:#067647;--ok-bg:#d3f8e2;--r:14px;
  min-height:100%;background:var(--paper);color:var(--ink);
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.el *{box-sizing:border-box}
.el .wrap{max-width:680px;margin:0 auto;padding:18px 16px 64px}
.el h1{font-size:26px;font-weight:800;letter-spacing:-.5px;margin:0 0 4px}
.el h2{font-size:17px;font-weight:750;margin:0 0 6px}
.el .sub{color:var(--ink-faint);font-size:13.5px;line-height:1.55;margin:0 0 18px}
.el .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  padding:16px;margin-bottom:12px}
.el .subjhead{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-faint);margin:22px 2px 8px}
.el .skill{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
  background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:13px 15px;
  margin-bottom:8px;font-family:inherit;transition:.15s}
.el .skill:hover{border-color:var(--a);background:var(--a-tint)}
.el .skill .nm{font-size:15.5px;font-weight:700;color:var(--ink)}
.el .skill .st{font-size:12px;color:var(--ink-faint);margin-top:2px}
.el .tag{font-style:normal;margin-left:8px;padding:1px 7px;border-radius:99px;font-size:10.5px;
  font-weight:700;background:var(--a-tint);color:var(--a)}
.el .tag.due{background:#fef0c7;color:#93370d}
.el .tag.made{background:#e9d7fe;color:#6941c6}
.el .askbtn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
  background:var(--card);border:1px dashed var(--line);border-radius:var(--r);padding:13px 15px;
  margin-bottom:14px;font-family:inherit}
.el .askbtn:hover{border-color:var(--a);border-style:solid;background:var(--a-tint)}
.el .askbtn .nm{font-size:15px;font-weight:700;color:var(--ink)}
.el .askbtn .st{font-size:12px;color:var(--ink-faint);margin-top:2px}
.el .genwarn{background:#f4ebff;border:1px solid #d6bbfb;border-radius:12px;padding:12px 14px;
  font-size:12.5px;line-height:1.55;color:#53389e;margin-bottom:14px}
.el .genwarn b{display:block;margin-bottom:3px}
.el .askbtn.record{border-style:solid;border-color:var(--line)}
/* Quieter once there is a record: still there, no longer the loudest thing on
   the screen. */
.el .askbtn.quiet .nm{font-size:13.5px;font-weight:650;color:var(--ink-soft)}
.el .askbtn.quiet .st{font-size:11.5px}
.el .next{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
  background:var(--a);border:1px solid var(--a);border-radius:var(--r);padding:14px 15px;
  margin-bottom:12px;font-family:inherit;color:#fff}
.el .next .nlab{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;opacity:.85}
.el .next .nnm{font-size:17px;font-weight:750;margin-top:3px}
.el .next .nwhy{font-size:12.5px;opacity:.9;margin-top:2px;line-height:1.45}
.el .next .go{color:#fff}
  .el .tag.gettingthere{background:#fef0c7;color:#93370d}
.el .tag.lvl{background:var(--card-2);color:var(--ink-faint);font-weight:650}
.el .levels{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.el .lvbtn{padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);
  font-family:inherit;font-size:12.5px;font-weight:700;color:var(--ink-soft);cursor:pointer}
.el .lvbtn:hover{border-color:var(--a);color:var(--ink)}
.el .lvbtn.on{background:var(--a);border-color:var(--a);color:#fff}
.el .lvn{opacity:.7;font-weight:600;margin-left:3px}
.el .tag.needs{background:transparent;color:var(--ink-faint);padding-left:0;font-weight:600}
.el .opts{display:flex;flex-direction:column;gap:8px}
.el .opt{width:100%;text-align:left;padding:13px 15px;border:2px solid var(--line);
  border-radius:12px;background:var(--card);font-family:inherit;font-size:15px;
  font-weight:600;color:var(--ink);cursor:pointer;transition:.15s}
.el .opt:hover:not(:disabled){border-color:var(--a);background:var(--a-tint)}
.el .opt:disabled{cursor:default}
.el .optmark{font-size:12.5px;font-weight:700;opacity:.85}
/* A visible focus ring on everything reachable by keyboard. Without it a
   keyboard user cannot see where they are, which makes the app unusable
   without a mouse rather than merely awkward. */
.el button:focus-visible,.el input:focus-visible,.el a:focus-visible{
  outline:3px solid var(--a);outline-offset:2px}
.el .opt.right{border-color:var(--ok);background:var(--ok-bg);color:var(--ok)}
.el .opt.chosen{border-color:var(--no);background:var(--no-bg);color:var(--no)}
.el .hint.shown{background:var(--a-tint);border:1px solid var(--a);color:var(--ink)}
.el .hint.shown b{color:var(--a)}
.el input.cloudin{display:block;width:100%;margin-top:10px;padding:11px 13px;
  border:1px solid var(--line);border-radius:12px;background:var(--card-2);
  color:var(--ink);font-family:inherit;font-size:15px;font-weight:600}
.el input.cloudin:focus{outline:none;border-color:var(--a)}
.el .buildson{background:var(--card-2);border:1px solid var(--line);border-radius:12px;
  padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink-soft);margin-bottom:12px}
.el .miss{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:8px;
  background:var(--card)}
.el .miss .mask{font-size:14px;line-height:1.5;color:var(--ink)}
.el .miss .mans{font-size:12.5px;color:var(--ink-faint);margin-top:5px}
.el .miss .mans b{color:var(--a)}
.el .misslink{background:none;border:none;padding:6px 0 0;font-family:inherit;font-size:12.5px;
  font-weight:700;color:var(--a);cursor:pointer}
.el .tcount{display:block;font-size:10.5px;font-weight:600;opacity:.75;margin-top:2px}
.el .review{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
  background:#fef0c7;border:1px solid #f5c86b;border-radius:var(--r);padding:14px 15px;
  margin-bottom:14px;font-family:inherit}
.el .review .rnm{font-size:15px;font-weight:750;color:#93370d}
.el .review .rst{font-size:12px;color:#93370d;opacity:.85;line-height:1.5;margin-top:3px}
.el .skill .go{margin-left:auto;color:var(--a);font-weight:800}
.el .tiers{display:flex;gap:8px;margin:10px 0 16px}
.el .tier{flex:1;padding:9px 6px;border:1px solid var(--line);border-radius:10px;
  background:var(--card);font-family:inherit;font-size:12.5px;font-weight:700;
  color:var(--ink-soft);cursor:pointer}
.el .tier.on{background:var(--a);border-color:var(--a);color:#fff}
.el .ask{font-size:18px;font-weight:650;line-height:1.5;margin:0 0 14px}
.el input.ans{width:100%;padding:13px 14px;font-size:17px;font-weight:650;font-family:inherit;
  border:2px solid var(--line);border-radius:12px;background:var(--card-2);color:var(--ink)}
.el input.ans:focus{outline:none;border-color:var(--a);background:#fff}
.el .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.el .btn{padding:11px 16px;border:1px solid var(--line);border-radius:11px;background:var(--card);
  font-family:inherit;font-size:14px;font-weight:700;color:var(--ink-soft);cursor:pointer}
.el .btn:hover{border-color:var(--a);color:var(--ink)}
.el .btn.primary{background:var(--a);border-color:var(--a);color:#fff}
.el .fb{padding:12px 14px;border-radius:12px;margin-top:14px;font-size:14px;line-height:1.5}
.el .fb.ok{background:var(--ok-bg);color:var(--ok);border:1px solid #a6e9c5}
.el .fb.no{background:var(--no-bg);color:var(--no);border:1px solid #f3b4ae}
.el .fb.hm{background:var(--card-2);color:var(--ink-soft);border:1px solid var(--line)}
.el .steps{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}
.el .stp{display:flex;gap:10px;font-size:14px;line-height:1.55;margin-bottom:8px}
.el .stp b{color:var(--a);flex:0 0 auto}
.el .teach{font-size:14px;line-height:1.6;color:var(--ink-soft)}
.el .hint{font-size:13.5px;line-height:1.55;color:var(--ink-soft);
  background:var(--card-2);border-radius:10px;padding:10px 12px;margin-top:10px}
.el .back{background:none;border:none;color:var(--a);font-family:inherit;font-size:14px;
  font-weight:700;cursor:pointer;padding:6px 0;margin-bottom:6px}
.el .muted{font-size:12.5px;color:var(--ink-faint);line-height:1.5}
@media (max-width:400px){.el .wrap{padding:14px 12px 56px}.el h1{font-size:23px}.el .ask{font-size:17px}}
`;

/* --------------------------------- UI --------------------------------- */
function Steps({ steps }) {
  return (
    <div className="steps">
      <div className="muted" style={{ marginBottom: 8 }}>One way through — not the only one</div>
      {steps.map((s, i) => <div className="stp" key={i}><b>{i + 1}</b><span>{s.say}</span></div>)}
    </div>
  );
}

function Practice({ skillId, tier, onExit, onRecord }) {
  const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1e9));
  const question = React.useMemo(() => build(skillId, seed, tier), [skillId, seed, tier]);
  const [given, setGiven] = React.useState("");
  const [res, setRes] = React.useState(null);
  const [hint, setHint] = React.useState(0);
  // Whether the first worked step has been revealed. Recorded, because a
  // question answered after being shown the way is not the same as one solved
  // cold, and pretending otherwise would make the review schedule optimistic.
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => { setGiven(question.options ? -1 : ""); setRes(null); setHint(0); setShown(false); }, [question]);

  const submit = () => {
    if (!given.trim()) return;
    const r = mark(question, given);
    setRes(r);
    // Only a verdict is recorded. An unreadable answer says nothing about the
    // physics, so counting it would push a learner down the review ladder for
    // mistyping a unit.
    if (r.ok !== undefined && onRecord) onRecord(skillId, tier, r.ok === true, question, shown);
  };
  const next = () => setSeed(Math.floor(Math.random() * 1e9));
  // A verdict is a judgment on the physics. "I could not read that" is not one.
  const verdict = res && res.ok !== undefined;

  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <div className="muted" style={{ marginBottom: 10 }}>
        {question.subject} · {question.strand} · {question.skillName}
      </div>
      <p className="ask">{question.ask}</p>

      {/* A choice question is answered by picking, so it gets buttons rather
          than a box. Once answered the options stay on screen with the chosen
          one marked — hiding them would make the feedback hard to read against
          what was actually asked. */}
      {question.options ? (
        <div className="opts" role="radiogroup" aria-label={question.ask}>
          {question.options.map((o, i) => {
            const isRight = !!res && i === question.correct;
            const isWrongPick = !!res && given === i && i !== question.correct;
            return (
              <button key={i} role="radio" aria-checked={given === i}
                className={"opt" + (isRight ? " right" : "") + (isWrongPick ? " chosen" : "")}
                disabled={!!verdict}
                onClick={() => { setGiven(i); setRes(mark(question, i));
                  if (onRecord) onRecord(skillId, tier, i === question.correct, question, shown); }}>
                {o.t}
                {/* Said in words as well as shown in color. Marking the right
                    answer green and the wrong one red conveys nothing to a
                    screen reader, or to anyone who cannot tell them apart. */}
                {isRight && <span className="optmark"> — correct answer</span>}
                {isWrongPick && <span className="optmark"> — your answer</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <input className="ans" value={given} placeholder="Your answer, with its unit"
          aria-label={"Your answer to: " + question.ask}
          onChange={e => setGiven(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      )}

      {/* An unreadable answer is not an attempt, so the question stays open:
          Check is still offered and hints still work. Only a real verdict —
          right or wrong — moves the learner on. Hiding Check here would force
          someone who mistyped a unit to abandon a question they had not
          actually got wrong. */}
      <div className="row">
        {!verdict && !question.options && <button className="btn primary" onClick={submit}>Check</button>}
        {!verdict && hint < question.hints.length &&
          <button className="btn" onClick={() => setHint(hint + 1)}>Hint</button>}
        {/* The last rung. Without it, someone genuinely stuck has to answer
            wrong on purpose to see the working — which then records as a
            mistake they did not make. */}
        {!verdict && hint >= question.hints.length && !shown &&
          <button className="btn" onClick={() => setShown(true)}>I'm stuck — show me the first step</button>}
        {verdict && <button className="btn primary" onClick={next}>Another</button>}
      </div>

      {!verdict && hint > 0 && question.hints.slice(0, hint).map((h, i) =>
        <div className="hint" key={i}>{h}</div>)}

      {!verdict && shown && (
        <div className="hint shown">
          <b>First step.</b> {question.steps[0].say}
          <div className="muted" style={{ marginTop: 6 }}>
            Getting it from here still counts — it just won't be pushed as far out for review,
            because you had a hand with it.
          </div>
        </div>
      )}

      {/* Three outcomes, never two. "I could not read that" is not "you are
          wrong", and showing the worked solution after an unreadable answer
          would give away a question the learner has not actually attempted. */}
      {/* A verdict conveyed only by color says nothing to a screen reader, and
          nothing to anyone who cannot distinguish red from green. role="status"
          with aria-live makes it announced, and the words carry the meaning on
          their own — "Correct." rather than a green box. */}
      <div aria-live="polite" role="status">
        {res && res.unreadable && (
          <div className="fb hm">
            {res.why} Nothing has been marked — try writing it again.
          </div>
        )}
        {res && res.ok === true && <div className="fb ok">Correct.</div>}
        {res && res.ok === false && <div className="fb no">{res.why}</div>}
      </div>

      {res && res.ok !== undefined && <Steps steps={question.steps} />}
    </div>
  );
}

/* What you have done, and what you got wrong.

   Every number here is counted from answers actually given. There is no
   estimate, no projection and no percentage-complete: the app does not know
   how much science there is to learn, so a bar claiming you are 40% of the way
   through would be inventing a denominator.

   The misses are the point of this screen. They were being recorded and never
   shown, which is close to dishonest — data collected and never surfaced
   implies a use it does not have. Now the questions you got wrong come back,
   with what you said and what it should have been. */
function Progress({ rec, onExit, onOpen, topicName, topics, onRestore }) {
  const t = totals(rec);
  const due = dueNow(rec);
  /* Deliberately NOT filtered by level. This screen is a record of what YOU
     have done, and hiding part of your own history because a browsing filter
     is set elsewhere would make the totals lie. The filter is for finding
     things to learn; this is for looking back. */
  const started = SKILLS.filter(function (s) { return standing(rec, s.id).seen > 0; });
  const solid = SKILLS.filter(function (s) { return standing(rec, s.id).label === "solid"; });

  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <h1>Your record</h1>

      <CloudSync bundle={{ record: rec, topics: topics }} onRestore={onRestore} />

      {t.seen === 0 ? (
        <p className="sub">
          Nothing answered yet. Everything you do gets recorded here — including what you get
          wrong, because that is the part worth coming back to.
        </p>
      ) : (
        <p className="sub">
          {t.right} of {t.seen} answered correctly, across {started.length} topic
          {started.length === 1 ? "" : "s"}.
          {solid.length > 0 ? " " + solid.length + " solid at every level." : ""}
          {t.helped > 0
            ? " " + t.helped + " of those came after being shown the first step — counted, but not counted as knowing it."
            : ""}
        </p>
      )}

      {due.length > 0 && (
        <div>
          <div className="subjhead">Due for review</div>
          <p className="muted" style={{ margin: "0 4px 8px" }}>
            These come back on a schedule — a day after you first get one right, then three, then
            a week, then a fortnight, then a month. Forgetting is normal; this is what catches it.
          </p>
          {due.slice(0, 8).map(function (d) {
            return (
              <button className="skill" key={d.skill + d.tier} onClick={() => onOpen(d.skill, d.tier)}>
                <div>
                  <div className="nm">
                    {BY_ID[d.skill] ? BY_ID[d.skill].name
                      : (topicName && topicName(d.skill)) || "A topic you made"}
                  </div>
                  <div className="st">
                    {d.tier === 1 ? "Starting out" : d.tier === 2 ? "Getting there" : "Exam standard"}
                    {" · "}{d.state.right}/{d.state.seen} right so far
                  </div>
                </div>
                <span className="go">›</span>
              </button>
            );
          })}
        </div>
      )}

      {rec.misses.length > 0 && (
        <div>
          <div className="subjhead">What you got wrong</div>
          <p className="muted" style={{ margin: "0 4px 8px" }}>
            The last {Math.min(rec.misses.length, 12)}. Kept whole rather than counted, so you can
            see what the question actually was.
          </p>
          {rec.misses.slice(0, 12).map(function (m, i) {
            return (
              <div className="miss" key={i}>
                <div className="mask">{m.ask}</div>
                <div className="mans">Answer: <b>{m.expect}</b></div>
                <button className="misslink" onClick={() => onOpen(m.skill, m.tier)}>
                  Try {BY_ID[m.skill] ? BY_ID[m.skill].name
                    : (topicName && topicName(m.skill)) || "this"} again ›
                </button>
              </div>
            );
          })}
        </div>
      )}

      {t.seen > 0 && (
        <div>
          <div className="subjhead">Where you are</div>
          {started.map(function (sk) {
            const g = standing(rec, sk.id);
            return (
              <button className="skill" key={sk.id} onClick={() => onOpen(sk.id)}>
                <div>
                  <div className="nm">{sk.name}</div>
                  <div className="st">
                    {sk.subject}
                    <em className={"tag" + (g.due ? " due" : "")}>{g.label}</em>
                    <span style={{ marginLeft: 8 }}>
                      {g.seen} answered{g.helped > 0 ? ", " + g.helped + " with help" : ""}
                      {g.streak >= 3 ? " · " + g.streak + " right in a row" : ""}
                      {g.last ? " · last " + agoText(g.last) : ""}
                    </span>
                  </div>
                </div>
                <span className="go">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* The level check screen. */
function LevelCheck({ onExit, onPick }) {
  const [seed] = React.useState(() => Math.floor(Math.random() * 1e9));
  const paper = React.useMemo(() => buildLevelCheck(seed), [seed]);
  const [i, setI] = React.useState(0);
  const [results, setResults] = React.useState([]);
  const [given, setGiven] = React.useState("");
  const [note, setNote] = React.useState(null);
  const item = paper[i];

  const record = (correct) => {
    const next = results.concat([{ level: item.level, skill: item.skill, correct: correct }]);
    setResults(next); setGiven(""); setNote(null); setI(i + 1);
  };

  const submit = () => {
    if (item.q.options) return;
    if (!given.trim()) return;
    const r = mark(item.q, given);
    // Unreadable says nothing about the science, so it is re-asked rather than
    // counted — the same rule as everywhere else in the app.
    if (r.ok === undefined) { setNote(r.why || "That couldn't be read."); setGiven(""); return; }
    record(r.ok === true);
  };

  if (i >= paper.length) {
    const out = readLevelCheck(results);
    return (
      <div className="wrap">
        <button className="back" onClick={onExit}>‹ All topics</button>
        <h1>Where to start</h1>
        <p className="sub">
          {out.solid
            ? "You were solid up to " + out.solid + "."
            : "The earlier questions didn't hold, so the best place to start is the beginning."}
          {" "}Try <b>{out.startAt}</b> first.
        </p>
        <div className="card">
          {LEVELS.map(L => {
            const b = out.byBand[L];
            if (!b) return null;
            return <p className="muted" key={L}><b>{L}</b> — {b.right} of {b.asked} right</p>;
          })}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => onPick(out.startAt)}>
            Show me {out.startAt}
          </button>
          <button className="btn" onClick={() => onPick(null)}>Show everything</button>
        </div>
        <p className="muted" style={{ marginTop: 14 }}>{out.caveat}</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <h1>Where to start</h1>
      <p className="sub">Question {i + 1} of {paper.length}. Skipping is fine — it just counts as not yet.</p>
      <div className="muted" style={{ marginBottom: 8 }}>{BY_ID[item.skill].subject} · {item.level}</div>
      <p className="ask">{item.q.ask}</p>

      {item.q.options ? (
        <div className="opts" role="radiogroup" aria-label={item.q.ask}>
          {item.q.options.map((o, k) => (
            <button key={k} className="opt" role="radio" aria-checked="false"
              onClick={() => record(k === item.q.correct)}>{o.t}</button>
          ))}
        </div>
      ) : (
        <input className="ans" value={given} placeholder="Your answer, with its unit"
          aria-label={"Your answer to: " + item.q.ask}
          onChange={e => setGiven(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      )}

      {note && <div className="fb hm" role="status" aria-live="polite">{note} Nothing was counted — try again.</div>}

      <div className="row">
        {!item.q.options && <button className="btn primary" onClick={submit}>Answer</button>}
        <button className="btn" onClick={() => record(false)}>Skip</button>
      </div>
    </div>
  );
}

/* The cloud sync panel.

   States plainly where the record lives: the device holds it, the cloud keeps
   a copy. Never claims a sync that did not happen. */
function CloudSync({ bundle, onRestore, say }) {
  const [user, setUser] = React.useState(null);
  const [status, setStatus] = React.useState("off");   // off|working|ok|error|conflict
  const [note, setNote] = React.useState(null);
  const [at, setAt] = React.useState(null);
  const [pending, setPending] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [mode, setMode] = React.useState("in");
  const readyRef = React.useRef(false);
  const bundleRef = React.useRef(bundle);
  React.useEffect(() => { bundleRef.current = bundle; }, [bundle]);

  const settle = React.useCallback(async (sb, u) => {
    setStatus("working");
    const r = await reconcile(sb, u.id, bundleRef.current);
    if (r.kind === "error") { setStatus("error"); setNote(r.why); return; }
    if (r.kind === "downloaded") {
      onRestore(r.bundle);
      readyRef.current = true; setStatus("ok"); setAt(Date.now());
      say && say("Your saved record was restored.");
      return;
    }
    if (r.kind === "conflict") { setPending(r.remote); setStatus("conflict"); return; }
    readyRef.current = true; setStatus("ok"); setAt(Date.now());
  }, [onRestore, say]);

  // Restore an existing session on load. Runs once: a later change to the
  // record must not re-trigger a reconcile.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const sb = await syncClient();
      if (!sb || !alive) return;
      try {
        const { data } = await sb.auth.getSession();
        const u = data && data.session && data.session.user;
        if (u && alive) { setUser(u); settle(sb, u); }
      } catch (e) { }
    })();
    return () => { alive = false; };
  }, []);

  // Debounced upload, and only after the first reconcile has settled — a
  // half-loaded device must never stamp on a good cloud copy.
  React.useEffect(() => {
    if (!user || !readyRef.current) return;
    const t = setTimeout(async () => {
      const sb = await syncClient();
      if (!sb) return;
      setStatus("working");
      try { await pushBundle(sb, user.id, bundle); setStatus("ok"); setAt(Date.now()); setNote(null); }
      catch (e) { setStatus("error"); setNote((e && e.message) || "Sync failed."); }
    }, 2500);
    return () => clearTimeout(t);
  }, [bundle, user]);

  const signIn = async () => {
    setNote(null);
    if (!email.trim() || !pw) { setNote("Enter an email and a password."); return; }
    const sb = await syncClient();
    if (!sb) { setNote("Couldn't reach the sign-in service."); return; }
    setStatus("working");
    const fn = mode === "in" ? "signInWithPassword" : "signUp";
    const { data, error } = await sb.auth[fn]({ email: email.trim(), password: pw });
    if (error) { setStatus("off"); setNote(error.message); return; }
    if (!data.session) { setStatus("off"); setNote("Check your email to confirm the account, then sign in."); return; }
    setUser(data.user); setEmail(""); setPw("");
    settle(sb, data.user);
  };

  const keepCloud = () => {
    onRestore(pending);
    setPending(null); readyRef.current = true; setStatus("ok"); setAt(Date.now());
    say && say("The saved copy is now on this device.");
  };
  const keepDevice = async () => {
    const sb = await syncClient();
    setPending(null); readyRef.current = true;
    if (!sb || !user) return;
    setStatus("working");
    try { await pushBundle(sb, user.id, bundleRef.current); setStatus("ok"); setAt(Date.now());
          say && say("This device's record is now the saved copy."); }
    catch (e) { setStatus("error"); setNote((e && e.message) || "Sync failed."); }
  };

  const signOut = async () => {
    const sb = await syncClient();
    readyRef.current = false;
    if (sb) { try { await sb.auth.signOut(); } catch (e) { } }
    setUser(null); setStatus("off"); setAt(null); setNote(null); setPending(null);
  };

  if (status === "conflict" && pending) {
    return (
      <div className="card" role="status" aria-live="polite">
        <h2>Two records</h2>
        <p className="muted">
          This device and your account both have work, and they don't match. Nothing has changed
          yet. Keeping one replaces the other — they can't be merged without risking losing part
          of either.
        </p>
        <div className="row">
          <button className="btn primary" onClick={keepCloud}>Use the saved copy</button>
          <button className="btn" onClick={keepDevice}>Keep this device</button>
        </div>
      </div>
    );
  }

  if (user) {
    const line = status === "working" ? "Syncing…"
      : status === "error" ? ("Not synced — " + (note || "something went wrong"))
        : at ? ("Synced at " + new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
          : "Connected.";
    return (
      <div className="card">
        <h2>Cloud sync</h2>
        <p className="muted" role="status" aria-live="polite">Signed in as {user.email}. {line}</p>
        <p className="muted">
          Your record is still saved on this device — the cloud keeps a copy so it follows you to
          another one. Topics you made travel too. The same account works in Study It, Lectern,
          Mathema and CodeQuest.
        </p>
        <div className="row"><button className="btn" onClick={signOut}>Sign out of cloud</button></div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Cloud sync</h2>
      <p className="muted">
        Off — your record is saved on this device only. Sign in to keep a copy so it follows you
        to another device. The same account works in Study It, Lectern, Mathema and CodeQuest.
      </p>
      <div className="row">
        <button className={"btn" + (mode === "in" ? " primary" : "")} aria-pressed={mode === "in"}
          onClick={() => { setMode("in"); setNote(null); }}>Sign in</button>
        <button className={"btn" + (mode === "up" ? " primary" : "")} aria-pressed={mode === "up"}
          onClick={() => { setMode("up"); setNote(null); }}>Create account</button>
      </div>
      <input className="ans cloudin" type="email" autoComplete="email" placeholder="you@example.com"
        aria-label="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="ans cloudin" type="password" placeholder="Password"
        aria-label="Password"
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        value={pw} onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") signIn(); }} />
      {note && <p className="muted" role="status" aria-live="polite">{note}</p>}
      <div className="row">
        <button className="btn primary" disabled={status === "working"} onClick={signIn}>
          {status === "working" ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </div>
      <p className="muted">Nothing is uploaded until you sign in, and nothing is ever overwritten without asking you first.</p>
    </div>
  );
}

/* Asking for a topic that isn't here yet. */
function AskTopic({ onExit, onMade, topics, onOpenExisting }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [dropped, setDropped] = React.useState(0);
  const [dup, setDup] = React.useState(null);

  const go = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null); setDropped(0); setDup(null);
    const r = await generateTopic(text.trim(), { existing: topics || [] });
    setBusy(false);
    if (!r.ok) {
      setErr(r.why); setDup(r.duplicate || null); setDropped((r.dropped || []).length);
      return;
    }
    setDropped((r.dropped || []).length);
    onMade(r.topic, (r.dropped || []).length);
  };

  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <h1>Ask for a topic</h1>
      <p className="sub">
        Say what you want to practice. The questions you get back are worked out and checked by
        this app before you see them — anything it can't check is thrown away rather than shown.
      </p>
      <input className="ans" value={text} placeholder="e.g. pressure in liquids"
        aria-label="What do you want to practice?"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") go(); }} />
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={go}>
          {busy ? "Writing and checking…" : "Make it"}
        </button>
      </div>
      {err && (
        <div className={"fb " + (dup ? "hm" : "no")} style={{ marginTop: 14 }}>
          {err}
          {/* A duplicate is not a failure — the thing asked for exists. Offer
              it rather than leaving the learner at a dead end. */}
          {dup && (
            <div style={{ marginTop: 8 }}>
              <button className="misslink" onClick={() => onOpenExisting(dup)}>
                Open {dup.kind === "built-in" ? dup.skill.name : dup.topic.name} ›
              </button>
            </div>
          )}
          {dropped > 0 && <div style={{ marginTop: 6 }}>{dropped} question{dropped === 1 ? "" : "s"} were discarded for failing that check.</div>}
        </div>
      )}
      <div className="genwarn" style={{ marginTop: 16 }}>
        <b>What's checked and what isn't.</b> Every question is solved by this app and confirmed
        before it's shown, so the math is as trustworthy as anywhere else here. The explanation
        is not checked — nothing in the app can judge whether an explanation is a good one, so a
        made topic always says so.
      </div>
    </div>
  );
}

/* Reading a generated topic. The warning sits above the teaching, not buried
   in a settings note, because that is the moment it matters. */
/* Practicing a made topic counts exactly like practicing a built-in one.

   It did not, at first: answers here vanished while answers everywhere else
   were recorded. That is the kind of inconsistency nobody would notice until
   their record looked wrong, and there is no honest reason for it — the
   questions are solver-checked either way, so the answers are worth the same.

   The record key is the topic's own id, so a made topic gets its own line
   rather than being folded into a built-in skill it merely resembles. */
function GenTopic({ topic, onExit, onDelete, onRecord, rec }) {
  const [i, setI] = React.useState(0);
  const [given, setGiven] = React.useState("");
  const [res, setRes] = React.useState(null);
  const q = topic.questions[i];
  const verdict = res && res.ok !== undefined;

  const submit = () => {
    if (!given.trim()) return;
    const r = mark(q, given);
    setRes(r);
    // Same rule as everywhere: only a verdict counts. Unreadable is not wrong.
    if (r.ok !== undefined && onRecord) onRecord(topic.id, 1, r.ok === true, q);
  };
  const next = () => { setI((i + 1) % topic.questions.length); setGiven(""); setRes(null); };

  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <h1>{topic.name}</h1>
      <p className="sub">{topic.subject} · made for you</p>

      <div className="genwarn">
        <b>This topic was written by AI.</b> Its {topic.questions.length} question{topic.questions.length === 1 ? " was" : "s were"} solved
        and confirmed by this app before being shown, so the answers are checked. The explanation
        below was not checked — treat it as a starting point rather than something verified.
      </div>

      {topic.teach && <div className="card"><p className="teach">{topic.teach}</p></div>}

      <div className="muted" style={{ marginBottom: 8 }}>Question {i + 1} of {topic.questions.length}</div>
      <p className="ask">{q.ask}</p>
      {/* Labelled like every other answer box. This one was missed because it
          lives on the generated-topic screen, which was tested as logic and
          never actually rendered — a placeholder disappears the moment you
          type, so without this a screen reader user has nothing to go on. */}
      <input className="ans" value={given} placeholder="Your answer, with its unit"
        aria-label={"Your answer to: " + q.ask}
        onChange={e => setGiven(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      <div className="row">
        {!verdict && <button className="btn primary" onClick={submit}>Check</button>}
        {verdict && <button className="btn primary" onClick={next}>Next question</button>}
        <button className="btn" onClick={() => onDelete(topic.id)}>Delete this topic</button>
      </div>

      {res && res.unreadable && <div className="fb hm">{res.why} Nothing has been marked — try again.</div>}
      {res && res.ok === true && <div className="fb ok">Correct.</div>}
      {res && res.ok === false && <div className="fb no">{res.why}</div>}
      {verdict && <Steps steps={q.steps} />}
      {/* Set on every generated question and, until now, never shown. It is the
          one piece of evidence that this question was checked rather than
          taken on trust — so it belongs on screen, next to the working. */}
      {verdict && q.generated && q.confirmedBy && (
        <div className="muted" style={{ marginTop: 10 }}>
          This question was solved by the app and confirmed by {q.confirmedBy} before it was shown.
        </div>
      )}
    </div>
  );
}

function Topic({ skillId, tierHint, onExit, onRecord, rec }) {
  const sk = BY_ID[skillId];
  // Arriving from a review card opens the tier that is actually due.
  const [tier, setTier] = React.useState(tierHint || 1);
  const [going, setGoing] = React.useState(false);
  if (going) return <Practice skillId={skillId} tier={tier} onExit={() => setGoing(false)} onRecord={onRecord} />;
  return (
    <div className="wrap">
      <button className="back" onClick={onExit}>‹ All topics</button>
      <h1>{sk.name}</h1>
      <p className="sub">{sk.subject} · {sk.strand} · {levelOf(skillId)}</p>
      {(() => {
        const miss = missingNeeds(rec, skillId);
        if (!miss.length) return null;
        return (
          <div className="buildson">
            This assumes you can already do <b>{miss.join(", ")}</b>. You can carry on regardless —
            it is a note, not a lock.
          </div>
        );
      })()}
      <div className="card"><p className="teach">{sk.teach}</p></div>
      <div className="subjhead">Choose a level</div>
      <div className="tiers">
        {[1, 2, 3].map(t => {
          const st = rec && rec.skills[keyOf(skillId, t)];
          return (
            <button key={t} className={"tier" + (t === tier ? " on" : "")} onClick={() => setTier(t)}>
              {t === 1 ? "Starting out" : t === 2 ? "Getting there" : "Exam standard"}
              {st ? <span className="tcount">{st.right}/{st.seen}</span> : null}
            </button>
          );
        })}
      </div>
      <button className="btn primary" onClick={() => setGoing(true)}>Start practicing</button>
    </div>
  );
}

function Home({ onOpen, rec, onReview, onAsk, topics, onOpenGen, onProgress, level, onLevel, onCheck }) {
  return (
    <div className="wrap">
      <h1>Elements</h1>
      <p className="sub">
        Physics and chemistry. Every answer is checked against the quantity it should be, not
        the way you happened to write it — so 9.81 m/s², 981 cm/s² and 9.81 m s⁻² are all
        correct, because they are the same acceleration.
      </p>
      {(() => {
        const due = dueNow(rec);
        if (!due.length) return null;
        return (
          <button className="review" onClick={() => onReview(due[0])}>
            <div>
              <div className="rnm">{due.length} due for review</div>
              <div className="rst">
                These come back on a schedule — a day after you first get one right, then three,
                then a week. Forgetting is normal; this is what catches it.
              </div>
            </div>
            <span className="go">›</span>
          </button>
        );
      })()}

      {level && SKILLS.filter(s => levelOf(s.id) === level).length === 0 && (
        <p className="sub">Nothing at that level yet.</p>
      )}

      {(() => {
        const n = suggestNext(rec, level);
        if (!n) return null;
        if (n.kind === "bandDone") {
          return (
            <div className="card">
              <p className="muted">
                Everything at {n.level} level is solid. Try another level, or clear the filter to
                see the rest.
              </p>
            </div>
          );
        }
        const sk = BY_ID[n.skill];
        return (
          <button className="next" onClick={() => onOpen(n.skill, n.tier)}>
            <div>
              <div className="nlab">
                {n.kind === "review" ? "Due for review" : n.kind === "new" ? "Try next" : "Pick up where you left off"}
              </div>
              <div className="nnm">{sk.name}</div>
              <div className="nwhy">{n.why}</div>
            </div>
            <span className="go">›</span>
          </button>
        );
      })()}

      {(() => { const t = totals(rec); if (!t.seen) return null; return (
        <button className="askbtn record" onClick={onProgress}>
          <div>
            <div className="nm">Your record</div>
            <div className="st">{t.right} of {t.seen} right · what you got wrong, and what's due</div>
          </div>
          <span className="go">›</span>
        </button>
      ); })()}

      {/* Offered prominently to someone with no record, and still reachable
          afterwards — just quieter. Hiding it the moment a single question is
          answered meant a learner could never re-check their level, which is
          exactly the thing you want to do again after a few weeks. */}
      {(() => {
        const t = totals(rec);
        return (
          <button className={"askbtn" + (t.seen > 0 ? " quiet" : "")} onClick={onCheck}>
            <div>
              <div className="nm">
                {t.seen > 0 ? "Check your level again" : "Not sure where to start?"}
              </div>
              <div className="st">
                {t.seen > 0
                  ? "Eight questions, and it changes nothing you have done."
                  : "Eight quick questions to find your level. Nothing is saved."}
              </div>
            </div>
            <span className="go">›</span>
          </button>
        );
      })()}

      <button className="askbtn" onClick={onAsk}>
        <div>
          <div className="nm">Ask for a topic</div>
          <div className="st">Not here yet? Have one made — the questions get checked before you see them.</div>
        </div>
        <span className="go">›</span>
      </button>

      {topics.length > 0 && (
        <div>
          <div className="subjhead">Made for you</div>
          {topics.map(t => (
            <button className="skill gen" key={t.id} onClick={() => onOpenGen(t)}>
              <div>
                <div className="nm">{t.name}<em className="tag made">made</em></div>
                <div className="st">{t.subject} · {t.questions.length} checked questions</div>
              </div>
              <span className="go">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Filtering by level, because "elementary to AP" is only useful if you can
          find your part of it. Showing everything stays the default: someone who
          does not know their level should not have to choose one to begin. */}
      <div className="levels" role="group" aria-label="Filter by level">
        <button className={"lvbtn" + (level === null ? " on" : "")}
          aria-pressed={level === null} onClick={() => onLevel(null)}>All</button>
        {LEVELS.map(L => {
          const n = SKILLS.filter(s => levelOf(s.id) === L).length;
          if (!n) return null;
          return (
            <button key={L} className={"lvbtn" + (level === L ? " on" : "")}
              aria-pressed={level === L} onClick={() => onLevel(level === L ? null : L)}>
              {L} <span className="lvn">{n}</span>
            </button>
          );
        })}
      </div>

      {SUBJECTS.map(subject => (
        <div key={subject}>
          <div className="subjhead">{subject}</div>
          {SKILLS.filter(s => s.subject === subject && (!level || levelOf(s.id) === level)).map(s => (
            <button className="skill" key={s.id} onClick={() => onOpen(s.id)}>
              <div>
                <div className="nm">{s.name}</div>
                <div className="st">
                  {s.strand}
                  <em className="tag lvl">{levelOf(s.id)}</em>
                  {(() => { const g = standing(rec, s.id);
                    return g.label ? <em className={"tag" + (g.due ? " due" : "")}>{g.label}</em> : null; })()}
                  {(() => {
                    // Said, not enforced: the topic still opens.
                    if (standing(rec, s.id).seen > 0) return null;
                    const miss = missingNeeds(rec, s.id);
                    return miss.length ? <em className="tag needs">builds on {miss.join(", ")}</em> : null;
                  })()}
                </div>
              </div>
              <span className="go">›</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Elements() {
  const [open, setOpen] = React.useState(null);
  const [view, setView] = React.useState(null);      // "ask" | { gen: topic }
  const [topics, setTopics] = React.useState(loadTopics);
  const [level, setLevel] = React.useState(null);   // null = show everything
  const [rec, setRec] = React.useState(loadRecord);
  const topicName = React.useCallback(id => {
    const t = topics.find(x => x.id === id);
    return t ? t.name : null;
  }, [topics]);

  React.useEffect(() => { saveTopics(topics); }, [topics]);

  // Written on every change rather than on a timer: a browser tab can close
  // without warning, and a record that loses the last few answers is worse
  // than one that costs a millisecond.
  React.useEffect(() => { saveRecord(rec); }, [rec]);

  const onRecord = React.useCallback((skillId, tier, correct, question, helped) => {
    setRec(r => applyAnswer(r, skillId, tier, correct, question, helped));
  }, []);

  return (
    <div className="el">
      <style>{CSS}</style>
      {view === "check"
        ? <LevelCheck onExit={() => setView(null)}
            onPick={(L) => { setLevel(L); setView(null); }} />
        : view === "ask"
        ? <AskTopic onExit={() => setView(null)} topics={topics}
            onMade={(t) => { setTopics(ts => [t].concat(ts)); setView({ gen: t }); }}
            onOpenExisting={(d) => {
              setView(null);
              if (d.kind === "built-in") setOpen({ id: d.skill.id });
              else setView({ gen: d.topic });
            }} />
        : view === "progress"
          ? <Progress rec={rec} topics={topics} topicName={topicName}
              onRestore={(b) => {
                // Replace, never merge — the learner already chose which copy
                // to keep, and merging behind that choice would undo it.
                if (b && b.record) setRec({ skills: b.record.skills || {}, misses: b.record.misses || [] });
                if (b && Array.isArray(b.topics)) setTopics(b.topics);
              }}
              onExit={() => setView(null)}
              onOpen={(id, tier) => {
                const made = topics.find(t => t.id === id);
                if (made) { setView({ gen: made }); return; }
                setView(null); setOpen({ id: id, tier: tier });
              }} />
        : view && view.gen
          ? <GenTopic topic={view.gen} rec={rec} onRecord={onRecord} onExit={() => setView(null)}
              onDelete={(id) => {
                setTopics(ts => ts.filter(x => x.id !== id));
                // Deleting the topic deletes its record too — leaving orphaned
                // counts for a topic that no longer exists would quietly inflate
                // every total on the record screen.
                setRec(r => {
                  const skills = {};
                  for (const k in r.skills) if (splitKey(k).skill !== id) skills[k] = r.skills[k];
                  return { skills: skills, misses: r.misses.filter(m => m.skill !== id) };
                });
                setView(null);
              }} />
          : open
            ? <Topic skillId={open.id} tierHint={open.tier} rec={rec}
                onExit={() => setOpen(null)} onRecord={onRecord} />
            : <Home rec={rec} topics={topics} level={level} onLevel={setLevel}
                onOpen={(id, tier) => setOpen({ id: id, tier: tier })}
                onReview={d => {
              // A made topic opens its own screen, not the built-in one.
              const made = topics.find(t => t.id === d.skill);
              if (made) setView({ gen: made }); else setOpen({ id: d.skill, tier: d.tier });
            }}
                onAsk={() => setView("ask")} onOpenGen={(t) => setView({ gen: t })}
                onProgress={() => setView("progress")} onCheck={() => setView("check")} />}
    </div>
  );
}
