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
  /* Superscript forms. A learner types cm\u00B3 far more readily than cm^3, and
     the checker rejected it outright \u2014 a correct answer marked wrong on a
     character the question itself had used. */
  "dm\u00B3": "L", "cm\u00B3": "mL", "m\u00B3": "m3_",
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
    /* Normalise superscript digits first. The exponent is matched with
       (-?\d+), which is ASCII only, so "cm\u00B3" never parsed and a learner
       typing the character the QUESTION used was marked wrong. Map the
       superscripts onto ordinary digits before anything else looks at it. */
    const SUP = { "\u00B9": "1", "\u00B2": "2", "\u00B3": "3", "\u2074": "4",
                  "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8",
                  "\u2079": "9", "\u2070": "0", "\u207B": "-" };
    const raw = String(text || "").trim()
      .replace(/[\u00B9\u00B2\u00B3\u2070\u2074-\u2079\u207B]/g, function (ch) { return SUP[ch]; });
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
/* Every question is built through here, so it is the one place that can
   reorder the options without touching a renderer.

   The correct answer sat at index 0 in 85% of 1632 questions. Nothing shuffled
   anywhere, so "always pick the first" scored 85% without reading. Authors
   write the right answer first \u2014 that is natural and it is not going to
   change \u2014 so the fix belongs downstream of the authoring, not in it.

   The order is derived from the question text, so it is stable: the same
   question always shuffles the same way, and mark() keeps agreeing with what
   is on screen because both read the same rearranged object. */
const q = (opts) => {
  if (!opts || !Array.isArray(opts.options) || opts.options.length < 2) return opts;
  if (!Number.isInteger(opts.correct)) return opts;

  let h = 2166136261;
  const key = String(opts.ask || "");
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return Math.abs(h) / 2147483647 % 1; };

  const order = opts.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return Object.assign({}, opts, {
    options: order.map((i) => opts.options[i]),
    correct: order.indexOf(opts.correct),
  });
};

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
      /* Tier 2's method is "Rearranging for mass" and it asked for MOLES in
         every seed \u2014 the same question as tier 1 with a harder formula mass.
         No rearranging happened anywhere in the skill.

         It now gives the moles and asks for the mass, which is n = m \u00F7 Mr
         solved the other way round. The formula mass still has to be worked
         out, so nothing from tier 1 is lost. */
      if (d === 2) {
        const f = pick(r, ["CaCO3", "NaOH", "H2SO4", "MgCl2"]);
        const M = CHK.molarMass(f), n = ri(r, 2, 9) / 2, m = n * M;
        return q({
          ask: "What is the mass of " + sigText(n, 2) + " mol of " + f +
               "? Give your answer in g to 3 significant figures.",
          expect: sigText(m, 3) + " g", sigFigs: 3, tol: 0.02,
          steps: [step("Work out the formula mass of " + f + " first: " + sig(M, 4) + "."),
                  step("n = m \u00F7 Mr rearranges to m = n \u00D7 Mr."),
                  step(sigText(n, 2) + " \u00D7 " + sig(M, 4) + " = " + sigText(m, 3) + " g."),
                  step("Dividing here instead of multiplying is the standard slip, and the answer comes out far too small.")],
          hints: ["You still need the formula mass first.",
                  "Which way round is n = m \u00F7 Mr when you want m?"]
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
      /* Tier 2's method is "Rearranging for moles or volume" and it asked for
         the CONCENTRATION in every seed \u2014 tier 1's question with a unit
         conversion added. The rearranging the method names never happened.

         It now gives the concentration and asks for the moles or the volume,
         picked at random. The cm\u00B3-to-L conversion stays, so the step tier 1
         does not have is still there. */
      if (d === 2) {
        const c = ri(r, 1, 4) / 2, mL = ri(r, 2, 9) * 50, V = mL / 1000;
        const n = c * V;
        if (r() < 0.5) {
          return q({
            ask: "A solution is " + c + " mol/L. How many moles are in " + mL +
                 " cm^3 of it? Give your answer to 3 significant figures.",
            expect: sigText(n, 3) + " mol", sigFigs: 3, tol: 0.02,
            steps: [step("Convert first: " + mL + " cm\u00B3 = " + V + " L."),
                    step("c = n \u00F7 V rearranges to n = c \u00D7 V."),
                    step(c + " \u00D7 " + V + " = " + sigText(n, 3) + " mol.")],
            hints: ["The volume is not in liters yet.",
                    "Which way round is c = n \u00F7 V when you want n?"]
          });
        }
        return q({
          ask: "A solution is " + c + " mol/L and contains " + sigText(n, 3) +
               " mol. What volume is it, in cm^3?",
          expect: mL + " cm^3", tol: 0.02,
          steps: [step("c = n \u00F7 V rearranges to V = n \u00F7 c."),
                  step(sigText(n, 3) + " \u00F7 " + c + " = " + V + " L."),
                  step("The question asks for cm\u00B3, so \u00D7 1000 gives " + mL + " cm\u00B3."),
                  step("Answering in liters is right arithmetic in the wrong unit, which the question does not ask for.")],
          hints: ["Rearrange for V first.",
                  "Then check which unit the question wants."]
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

/* Waves and Radioactivity had two skills each — the thinnest strands in the
   app, and both squarely on every exam paper. These fill them out. */
const BATCH6 = [
  {
    id: "wave-props", name: "Describing waves", subject: "Physics", strand: "Waves", needs: ["waves"],
    teach: "Amplitude is how far the wave moves from its rest position, and it carries the energy. Wavelength is the length of one whole wave, and frequency is how many pass each second. Amplitude is independent of the other two — a loud low note and a quiet low note have the same wavelength.",
    gen: function (r, d) {
      if (d === 1) {
        const f = ri(r, 2, 20);
        return q({ ask: f + " waves pass a point each second. What is the frequency, in Hz?",
          expect: f + " Hz",
          steps: [step("Frequency is how many waves pass each second."),
                  step("That is exactly what you were told: " + f + " Hz."),
                  step("A hertz IS one wave per second — the unit is the definition.")],
          hints: ["What does frequency measure?", "Waves per second."] });
      }
      if (d === 2) {
        const T = ri(r, 2, 10) / 100;
        return q({ ask: "One wave takes " + T + " s to pass. What is the frequency, in Hz, to 3 significant figures?",
          expect: sigText(1 / T, 3) + " Hz", sigFigs: 3, tol: 0.01,
          steps: [step("The time for one wave is the period; frequency is its reciprocal."),
                  step("f = 1 ÷ T = 1 ÷ " + T + "."),
                  step("= " + sigText(1 / T, 3) + " Hz.")],
          hints: ["Frequency and period are reciprocals.", "f = 1 ÷ T."] });
      }
      const sets = [{ ask: "A sound gets louder but the note stays the same. What changed?",
                      options: [{ t: "The amplitude" },
                                { t: "The frequency", why: "That would change the pitch, and the note stayed the same." },
                                { t: "The wavelength", why: "Wavelength goes with frequency here — the note would change." }], correct: 0,
                      steps: ["Loudness is carried by amplitude.",
                              "Pitch is carried by frequency, and the pitch did not change."] },
                    { ask: "Two waves have the same frequency but different amplitudes. What differs?",
                      options: [{ t: "How fast they travel", why: "Speed depends on the material, not the amplitude." },
                                { t: "How much energy they carry" },
                                { t: "Their wavelength", why: "Same frequency in the same material means the same wavelength." }], correct: 1,
                      steps: ["Amplitude carries the energy.",
                              "Frequency and wavelength are unchanged, so only the energy differs."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Which property carries the energy?",
                "Amplitude and frequency describe different things."] });
    }
  },
  {
    id: "em-spectrum", name: "The electromagnetic spectrum", subject: "Physics", strand: "Waves",
    needs: ["waves"],
    teach: "All electromagnetic waves travel at the same speed in a vacuum — 3.0 x 10^8 m/s. What differs is wavelength and frequency, and since their product is fixed, longer wavelength always means lower frequency. Radio is the long, low end; gamma the short, high one.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Which has the LONGEST wavelength?",
                        options: [{ t: "Radio waves" },
                                  { t: "Visible light", why: "Visible sits in the middle of the spectrum." },
                                  { t: "Gamma rays", why: "Gamma is the shortest wavelength of all." }], correct: 0,
                        steps: ["The spectrum runs from radio at the long end to gamma at the short.",
                                "Radio is the longest."] },
                      { ask: "Which has the HIGHEST frequency?",
                        options: [{ t: "Microwaves", why: "Longer wavelength than visible, so lower frequency." },
                                  { t: "Gamma rays" },
                                  { t: "Infrared", why: "Infrared is lower frequency than visible light." }], correct: 1,
                        steps: ["Frequency runs opposite to wavelength.",
                                "Gamma has the shortest wavelength, so the highest frequency."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Picture the spectrum from radio to gamma.",
                  "Long wavelength goes with low frequency."] });
      }
      if (d === 2) {
        const f = ri(r, 2, 9) * 1e8;
        const lam = 3.0e8 / f;
        return q({ ask: "An electromagnetic wave has frequency " + (f / 1e8) +
            " x 10^8 Hz. What is its wavelength, in m, to 3 significant figures? (c = 3.0 x 10^8 m/s)",
          expect: sigText(lam, 3) + " m", sigFigs: 3, tol: 0.01,
          steps: [step("Every electromagnetic wave travels at 3.0 x 10^8 m/s in a vacuum."),
                  step("λ = c ÷ f = 3.0e8 ÷ " + f + "."),
                  step("= " + sigText(lam, 3) + " m.")],
          hints: ["The speed is the same for all of them.",
                  "λ = c ÷ f."] });
      }
      const lam = ri(r, 2, 9) / 1e7;
      const f = 3.0e8 / lam;
      return q({ ask: "A wave has wavelength " + (lam * 1e7) +
          " x 10^-7 m. What is its frequency, in Hz, to 3 significant figures? (c = 3.0 x 10^8 m/s)",
        expect: sigText(f, 3) + " Hz", sigFigs: 3, tol: 0.01,
        steps: [step("Rearrange v = fλ for frequency: f = c ÷ λ."),
                step("3.0e8 ÷ " + lam + " = " + sigText(f, 3) + " Hz."),
                step("That is around visible light — a short wavelength and a very high frequency.")],
        hints: ["Rearrange for f this time.",
                "The wavelength is a small number, so expect a large frequency."] });
    }
  },
  {
    id: "sound", name: "Sound waves", subject: "Physics", strand: "Waves", needs: ["waves"],
    teach: "Sound is a longitudinal wave — the particles vibrate along the direction it travels, not across it. It needs a material to travel through, which is why there is no sound in a vacuum, and it goes fastest in solids where the particles are closest.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Why is there no sound in space?",
                        options: [{ t: "There are no particles to vibrate" },
                                  { t: "It is too cold", why: "Temperature affects the speed, not whether sound exists." },
                                  { t: "There is no gravity", why: "Sound does not depend on gravity at all." }], correct: 0,
                        steps: ["Sound is particles passing a vibration along.",
                                "A vacuum has no particles, so there is nothing to carry it."] },
                      { ask: "In which does sound travel fastest?",
                        options: [{ t: "A gas", why: "Particles are furthest apart, so it is slowest." },
                                  { t: "A liquid", why: "Faster than gas, but not the fastest." },
                                  { t: "A solid" }], correct: 2,
                        steps: ["The vibration passes from particle to particle.",
                                "Closer particles pass it on sooner, so solids are fastest."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What actually carries a sound wave?",
                  "Think about how close the particles are."] });
      }
      if (d === 2) {
        const t = ri(r, 2, 12) / 10, v = 340;
        return q({ ask: "An echo returns after " + t +
            " s. How far away is the wall, in m? (Sound travels at 340 m/s.)",
          expect: sig(v * t / 2, 4) + " m", tol: 0.01,
          steps: [step("The sound goes there AND back, so it covers twice the distance."),
                  step("Total distance = 340 × " + t + " = " + sig(v * t, 4) + " m."),
                  step("The wall is half of that: " + sig(v * t / 2, 4) + " m.")],
          hints: ["How far did the sound actually travel?",
                  "It made the journey twice."] });
      }
      const f = ri(r, 200, 900), v = 340;
      return q({ ask: "A sound of frequency " + f +
          " Hz travels at 340 m/s. What is its wavelength, in m, to 3 significant figures?",
        expect: sigText(v / f, 3) + " m", sigFigs: 3, tol: 0.01,
        steps: [step("The wave equation applies to sound as much as to light: v = fλ."),
                step("λ = 340 ÷ " + f + "."),
                step("= " + sigText(v / f, 3) + " m.")],
        hints: ["Same wave equation as any other wave.",
                "λ = v ÷ f."] });
    }
  }
];

/* Radioactivity, the other two-skill strand. Decay types and safety are on
   every specification and neither was covered. */
const BATCH7 = [
  {
    id: "decay-types", name: "Types of radiation", subject: "Physics", strand: "Radioactivity",
    needs: [],
    teach: "Alpha is a helium nucleus — heavy, highly ionising, stopped by paper. Beta is a fast electron, stopped by a few millimetres of aluminium. Gamma is a wave with no mass or charge, and only thick lead reduces it. The more ionising a radiation, the less far it penetrates.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Which radiation is stopped by a sheet of paper?",
              options: [{ t: "Alpha" },
                        { t: "Beta", why: "Beta passes through paper — it needs aluminium." },
                        { t: "Gamma", why: "Gamma passes through almost everything; it needs lead." }], correct: 0,
              steps: ["Alpha is large and heavily ionising, so it loses energy immediately.",
                      "A sheet of paper is enough to absorb it."] },
            { ask: "Which radiation has no mass and no charge?",
              options: [{ t: "Alpha", why: "Alpha is a helium nucleus — mass 4, charge +2." },
                        { t: "Beta", why: "Beta is an electron — it has mass and a negative charge." },
                        { t: "Gamma" }], correct: 2,
              steps: ["Gamma is an electromagnetic wave, not a particle.",
                      "No mass and no charge is what lets it pass through so much."] }],
        2: [{ ask: "An alpha particle is emitted. What happens to the atomic number?",
              options: [{ t: "It falls by 2" },
                        { t: "It rises by 1", why: "That is beta decay, where a neutron becomes a proton." },
                        { t: "It stays the same", why: "Gamma emission leaves it unchanged; alpha does not." }], correct: 0,
              steps: ["An alpha particle is two protons and two neutrons.",
                      "Losing two protons drops the atomic number by 2."] },
            { ask: "A beta particle is emitted. What happens to the mass number?",
              options: [{ t: "It falls by 4", why: "That is alpha decay." },
                        { t: "It stays the same" },
                        { t: "It rises by 1", why: "Nothing is gained in beta decay." }], correct: 1,
              steps: ["In beta decay a neutron turns into a proton and an electron.",
                      "The count of protons plus neutrons is unchanged, so the mass number stays."] }],
        3: [{ ask: "Which is most dangerous INSIDE the body?",
              options: [{ t: "Alpha" },
                        { t: "Beta", why: "Less ionising than alpha, so it does less damage per unit distance." },
                        { t: "Gamma", why: "Gamma mostly passes straight through without depositing energy." }], correct: 0,
              steps: ["Inside the body there is nothing to block anything.",
                      "Alpha is the most ionising, so it does the most damage to nearby tissue."] },
            { ask: "Which is most dangerous OUTSIDE the body?",
              options: [{ t: "Alpha", why: "Alpha cannot even get through skin." },
                        { t: "Gamma" },
                        { t: "Neither reaches you", why: "Gamma certainly does — that is the point." }], correct: 1,
              steps: ["Outside the body, the radiation has to get in first.",
                      "Alpha is stopped by skin; gamma penetrates deeply.",
                      "The most dangerous one swaps depending on where the source is."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["More ionising means less penetrating.",
                "Where is the source — inside or outside?"] });
    }
  },
  {
    id: "background", name: "Background radiation", subject: "Physics", strand: "Radioactivity",
    needs: ["halflife"],
    teach: "There is always some radiation about, from rocks, cosmic rays, food and medical sources. Any measurement of a source must have that background subtracted, or the reading is too high by whatever the background happened to be.",
    gen: function (r, d) {
      if (d === 1) {
        const bg = ri(r, 10, 40), total = bg + ri(r, 50, 400);
        return q({ ask: "A counter reads " + total + " counts per minute near a source. Background is " +
            bg + ". What is the source's own count rate?",
          expect: (total - bg) + "",
          steps: [step("The counter measures everything, including the background."),
                  step(total + " − " + bg + " = " + (total - bg) + " counts per minute."),
                  step("Without subtracting it the source would look stronger than it is.")],
          hints: ["The counter cannot tell the source from the background.",
                  "Take the background off."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Which is NOT a source of background radiation?",
                        options: [{ t: "Rocks and soil", why: "Radon from rocks is the largest single source." },
                                  { t: "Cosmic rays", why: "They arrive constantly from space." },
                                  { t: "Mobile phone signals" }], correct: 2,
                        steps: ["Background radiation is ionising radiation.",
                                "Phone signals are radio waves — non-ionising, and not part of it."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which of these is actually ionising?",
                  "Radio waves are not."] });
      }
      const bg = ri(r, 15, 35), hl = ri(r, 2, 8);
      const src0 = ri(r, 4, 12) * 100;
      const reading = Math.round(src0 / 2 + bg);
      return q({ ask: "A source plus background reads " + (src0 + bg) +
          " counts per minute. After " + hl + " hours it reads " + reading +
          ". What is the source's half-life, in hours?",
        expect: hl + "",
        steps: [step("Subtract the background from BOTH readings first."),
                step("Source alone: " + src0 + " at the start, and " + (reading - bg) + " later."),
                step("That is half, so one half-life has passed."),
                step("The half-life is " + hl + " hours. Forgetting to subtract would give the wrong ratio entirely.")],
        hints: ["Take the background off before comparing the two readings.",
                "How many times has the source count halved?"] });
    }
  }
];

/* Solutions was the thinnest strand left at two skills. Solubility, dilution
   and the mole-to-mass round trip are all standard and none were covered. */
const BATCH8 = [
  {
    id: "solubility", name: "Solubility", subject: "Chemistry", strand: "Solutions",
    needs: ["concentration"],
    teach: "Solubility is the most that will dissolve in a given amount of solvent at a given temperature. Past that point the extra sits undissolved however long you stir — the solution is saturated, and warming it usually raises the limit.",
    gen: function (r, d) {
      if (d === 1) {
        const per100 = ri(r, 10, 60), water = ri(r, 2, 8) * 100;
        return q({ ask: "A salt dissolves at " + per100 + " g per 100 g of water. How much dissolves in " +
            water + " g of water?",
          expect: (per100 * water / 100) + " g",
          steps: [step("Solubility is quoted per 100 g of water, so scale it."),
                  step(water + " g is " + (water / 100) + " times as much water."),
                  step(per100 + " × " + (water / 100) + " = " + (per100 * water / 100) + " g.")],
          hints: ["How many lots of 100 g is that?",
                  "Scale the solubility by the same factor."] });
      }
      if (d === 2) {
        const per100 = ri(r, 20, 50), water = ri(r, 2, 5) * 100;
        const added = per100 * water / 100 + ri(r, 5, 40);
        return q({ ask: added + " g of salt is stirred into " + water + " g of water. Solubility is " +
            per100 + " g per 100 g. How much stays undissolved, in g?",
          expect: (added - per100 * water / 100) + " g",
          steps: [step("Work out how much CAN dissolve first: " + per100 + " × " + (water / 100) +
                       " = " + (per100 * water / 100) + " g."),
                  step("That is the limit — the rest cannot dissolve however long you stir."),
                  step(added + " − " + (per100 * water / 100) + " = " + (added - per100 * water / 100) + " g left over.")],
          hints: ["Find the maximum that dissolves, then compare.",
                  "Anything past the limit stays solid."] });
      }
      const sets = [{ ask: "A saturated solution is cooled. What usually happens?",
                      options: [{ t: "Some solid comes back out" },
                                { t: "More dissolves", why: "Cooling lowers the limit, so less can stay dissolved, not more." },
                                { t: "Nothing changes", why: "The limit depends on temperature, so changing it matters." }], correct: 0,
                      steps: ["Solubility usually falls as temperature falls.",
                              "The solution now holds more than the new limit allows, so the excess crystallises out."] },
                    { ask: "Why does stirring not help once a solution is saturated?",
                      options: [{ t: "Stirring only speeds up dissolving, it does not raise the limit" },
                                { t: "Stirring cools the solution", why: "Any cooling is negligible and would lower the limit anyway." },
                                { t: "It does help, given long enough", why: "Time does not change the limit — it is set by temperature." }], correct: 0,
                      steps: ["Stirring brings fresh solvent to the solid, which makes dissolving faster.",
                              "The maximum that can dissolve is unchanged, so past the limit nothing more goes in."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What sets the limit — time, stirring, or temperature?",
                "Faster is not the same as more."] });
    }
  },
  {
    id: "dilution", name: "Diluting a solution", subject: "Chemistry", strand: "Solutions",
    needs: ["concentration"],
    teach: "Adding water changes the volume but not the amount of solute, so c1V1 = c2V2. Concentration and volume trade off exactly — double the volume and the concentration halves.",
    gen: function (r, d) {
      if (d === 1) {
        const c1 = ri(r, 2, 10), V1 = ri(r, 1, 5) / 10;
        return q({ ask: c1 + " mol/L solution of volume " + V1 +
            " L is diluted to " + (V1 * 2) + " L. What is the new concentration, in mol/L?",
          expect: (c1 / 2) + " mol/L", tol: 0.01,
          steps: [step("Adding water does not change how much solute there is."),
                  step("The volume doubled, so the concentration halves."),
                  step(c1 + " ÷ 2 = " + (c1 / 2) + " mol/L.")],
          hints: ["What happened to the volume?",
                  "The solute is unchanged; only the water increased."] });
      }
      if (d === 2) {
        const c1 = ri(r, 2, 12), V1 = ri(r, 10, 90) / 100, V2 = V1 + ri(r, 10, 90) / 100;
        const c2 = c1 * V1 / V2;
        return q({ ask: V1 + " L of " + c1 + " mol/L solution is made up to " + sig(V2, 3) +
            " L. What is the new concentration, in mol/L, to 3 significant figures?",
          expect: sigText(c2, 3) + " mol/L", sigFigs: 3, tol: 0.01,
          steps: [step("c1V1 = c2V2 — the moles of solute are the same before and after."),
                  step("Moles = " + c1 + " × " + V1 + " = " + sig(c1 * V1, 4) + " mol."),
                  step("Spread over " + sig(V2, 3) + " L: " + sigText(c2, 3) + " mol/L.")],
          hints: ["Work out the moles first — they do not change.",
                  "Then divide by the new volume."] });
      }
      const c1 = ri(r, 5, 20), c2 = ri(r, 1, 4), V2 = ri(r, 2, 10) / 10;
      const V1 = c2 * V2 / c1;
      return q({ ask: "How much " + c1 + " mol/L stock is needed to make " + V2 + " L of " + c2 +
          " mol/L solution? Give the volume in L, to 3 significant figures.",
        expect: sigText(V1, 3) + " L", sigFigs: 3, tol: 0.01,
        steps: [step("Work out the moles needed at the end: " + c2 + " × " + V2 + " = " + sig(c2 * V2, 4) + " mol."),
                step("Those moles must all come from the stock."),
                step("Volume of stock = moles ÷ concentration = " + sig(c2 * V2, 4) + " ÷ " + c1 + "."),
                step("= " + sigText(V1, 3) + " L, then made up to " + V2 + " L with water.")],
        hints: ["Start from the moles you need, not from the volumes.",
                "The stock is more concentrated, so you need less of it."] });
    }
  },
  {
    id: "mass-conc", name: "Concentration in grams", subject: "Chemistry", strand: "Solutions",
    needs: ["concentration", "moles"],
    teach: "Concentration can be quoted in grams per litre as well as moles per litre. Converting between them goes through the relative formula mass — grams per litre divided by Mr gives moles per litre.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 20) * 5, V = ri(r, 1, 5);
        return q({ ask: m + " g of solute is dissolved to make " + V +
            " L of solution. What is the concentration, in g/L?",
          expect: sig(m / V, 4) + " g/L", tol: 0.01,
          steps: [step("Concentration is mass ÷ volume."),
                  step(m + " ÷ " + V + " = " + sig(m / V, 4) + " g/L.")],
          hints: ["Divide the mass by the volume.",
                  "The units tell you which way round."] });
      }
      if (d === 2) {
        const Mr = pick(r, [40, 58.5, 100, 106]);
        const gpl = ri(r, 2, 20) * 5;
        return q({ ask: "A solution is " + gpl + " g/L. Its solute has Mr = " + Mr +
            ". What is the concentration in mol/L, to 3 significant figures?",
          expect: sigText(gpl / Mr, 3) + " mol/L", sigFigs: 3, tol: 0.01,
          steps: [step("Grams per litre becomes moles per litre by dividing by Mr."),
                  step(gpl + " ÷ " + Mr + " = " + sigText(gpl / Mr, 3) + " mol/L."),
                  step("It is the same conversion as mass to moles, applied to every litre.")],
          hints: ["How do you turn grams into moles?",
                  "Divide by the relative formula mass."] });
      }
      const Mr = pick(r, [40, 58.5, 100, 106]);
      const c = ri(r, 1, 5) / 10, V = ri(r, 2, 10) / 10;
      const m = c * V * Mr;
      return q({ ask: "What mass of solute is needed to make " + V + " L of " + c +
          " mol/L solution? Mr = " + Mr + ". Give the mass in g, to 3 significant figures.",
        expect: sigText(m, 3) + " g", sigFigs: 3, tol: 0.01,
        steps: [step("Moles needed: " + c + " × " + V + " = " + sig(c * V, 4) + " mol."),
                step("Mass = moles × Mr = " + sig(c * V, 4) + " × " + Mr + "."),
                step("= " + sigText(m, 3) + " g."),
                step("Two steps, and the Mr is what connects them.")],
        hints: ["Find the moles first, then convert to a mass.",
                "Multiply by Mr going that direction."] });
    }
  }
];

/* The elementary end. Four topics across two strands meant a young learner
   filtering to Elementary saw almost nothing, while High school had thirty-
   three. These are qualitative on purpose: at this level the ideas are real
   but the algebra is not, and inventing numbers to make them look rigorous
   would teach less, not more. */
const BATCH9 = [
  {
    id: "moving", name: "Things that move", subject: "Physics", strand: "Motion", needs: [],
    teach: "Something moves faster if it covers more ground in the same time, or the same ground in less time. Speed is just those two ideas together — how far, and how long it took.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Two cars travel for one hour. One goes 30 miles, the other 60. Which was faster?",
              options: [{ t: "The one that went 60 miles" },
                        { t: "The one that went 30 miles", why: "It covered less ground in the same time, so it was slower." },
                        { t: "They were the same", why: "Same time, different distance means different speeds." }], correct: 0,
              steps: ["Both took the same time.", "More distance in the same time means faster."] }],
        2: [{ ask: "Two runners both go 100 m. One takes 12 s, the other 15 s. Which was faster?",
              options: [{ t: "The one who took 12 s" },
                        { t: "The one who took 15 s", why: "Taking longer for the same distance means going slower." },
                        { t: "They were the same", why: "Same distance, different times means different speeds." }], correct: 0,
              steps: ["Both covered the same distance.", "Less time for the same distance means faster."] }],
        3: [{ ask: "A car travels 100 km in 2 hours. Another travels 90 km in 1 hour. Which was faster?",
              options: [{ t: "The first", why: "100 km in 2 hours is 50 km each hour — slower than 90." },
                        { t: "The second" },
                        { t: "You cannot tell", why: "You can: work out how far each goes in one hour." }], correct: 1,
              steps: ["The distances and the times are both different, so compare them fairly.",
                      "Work out how far each goes in ONE hour: 50 km and 90 km.",
                      "Now they can be compared directly."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Compare the distance and the time together.",
                "How far would each go in one hour?"] });
    }
  },
  {
    id: "energy-basic", name: "Energy all around", subject: "Physics", strand: "Energy", needs: [],
    teach: "Energy is what makes things happen — moving, heating, lighting. It never disappears; it moves somewhere else or turns into a different kind. When a ball stops rolling the energy has not gone, it has warmed the ground and the air a little.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "A torch is switched on. What does the battery's energy become?",
              options: [{ t: "Light and a little heat" },
                        { t: "It disappears", why: "Energy never disappears — it changes into something else." },
                        { t: "More battery", why: "The battery is running down, not filling up." }], correct: 0,
              steps: ["The battery stores energy chemically.",
                      "The bulb turns it into light, and some always escapes as heat."] }],
        2: [{ ask: "A rolling ball slows down and stops. Where did its energy go?",
              options: [{ t: "It was destroyed", why: "Energy is never destroyed, only moved or changed." },
                        { t: "It warmed the ground and the air" },
                        { t: "It went into the ball", why: "The ball has less energy now, not more." }], correct: 1,
              steps: ["Rubbing against the ground and the air heats them very slightly.",
                      "The energy is spread out and hard to notice, but it is still there."] }],
        3: [{ ask: "A light bulb takes in 100 J and gives out 10 J of light. What happened to the other 90 J?",
              options: [{ t: "It was lost", why: "Nothing is lost — it went somewhere, just not somewhere useful." },
                        { t: "It became heat" },
                        { t: "It was never there", why: "It was: 100 J went in." }], correct: 1,
              steps: ["100 J went in and 10 J came out as light.",
                      "The other 90 J left as heat — which is why bulbs get warm.",
                      "The energy is all accounted for; only 10 J of it did the job you wanted."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Energy never vanishes — where else could it be?",
                "Things that waste energy usually get warm."] });
    }
  },
  {
    id: "sound-basic", name: "Sound and hearing", subject: "Physics", strand: "Waves", needs: [],
    teach: "Sound is made by something vibrating. The vibration passes through the air to your ear, which is why you can hear a drum from across a room but not on the moon — there is no air there to carry it.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "What is always happening when something makes a sound?",
              options: [{ t: "It is vibrating" },
                        { t: "It is getting hotter", why: "Some things do, but that is not what makes the sound." },
                        { t: "It is moving along", why: "A drum stays put and still makes a sound." }], correct: 0,
              steps: ["Every sound starts with something shaking back and forth.",
                      "Touch a speaker while it plays and you can feel it."] }],
        2: [{ ask: "Why can you hear a bell in a room but not in space?",
              options: [{ t: "Space is too dark", why: "Light has nothing to do with hearing." },
                        { t: "There is no air to carry the sound" },
                        { t: "Bells do not work in space", why: "The bell vibrates fine — nothing carries it to you." }], correct: 1,
              steps: ["Sound needs something to travel through.",
                      "Air carries it in a room; space has none."] }],
        3: [{ ask: "A guitar string is tightened and plucked. What changes about the sound?",
              options: [{ t: "It gets louder", why: "Loudness comes from how hard you pluck it, not how tight it is." },
                        { t: "The note gets higher" },
                        { t: "Nothing changes", why: "Tightening a string is exactly how a guitar is tuned." }], correct: 1,
              steps: ["A tighter string vibrates faster.",
                      "Faster vibration means a higher note — which is how tuning works."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Something has to be shaking.",
                "What does the shaking travel through?"] });
    }
  },
  {
    id: "mixtures", name: "Mixing things", subject: "Chemistry", strand: "Solutions", needs: [],
    teach: "When sugar dissolves in water it has not vanished — it is still there, spread out too finely to see, and the water weighs more than before. Dissolving is mixing, not destroying, which is why you can get it back by letting the water evaporate.",
    gen: function (r, d) {
      const sets = {
        1: [{ ask: "Sugar is stirred into water until it disappears. Where is it?",
              options: [{ t: "Still in the water, spread out" },
                        { t: "It turned into water", why: "It is still sugar — taste it." },
                        { t: "It was destroyed", why: "Nothing was destroyed; the water is heavier than before." }], correct: 0,
              steps: ["The sugar has broken into pieces too small to see.",
                      "Weigh the glass before and after and the mass has gone up."] }],
        2: [{ ask: "How could you get the sugar back out of the water?",
              options: [{ t: "Let the water evaporate" },
                        { t: "Stir it the other way", why: "Stirring mixes; it does not separate." },
                        { t: "You cannot", why: "You can — the sugar never stopped being sugar." }], correct: 0,
              steps: ["The water can leave as a gas; the sugar cannot.",
                      "Leave it in a warm place and the sugar is left behind."] }],
        3: [{ ask: "100 g of water and 10 g of sugar are mixed. What does the solution weigh?",
              options: [{ t: "100 g", why: "The sugar did not disappear, so its mass is still there." },
                        { t: "110 g" },
                        { t: "Less than 100 g", why: "Nothing left the glass, so nothing can be missing." }], correct: 1,
              steps: ["Nothing left the glass, so nothing can be missing.",
                      "100 + 10 = 110 g. Dissolving hides the sugar; it does not remove it."] }]
      };
      const c = pick(r, sets[d]);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Did anything actually leave the glass?",
                "Invisible is not the same as gone."] });
    }
  }
];

/* The middle-school bridge. Energy and Forces jumped straight from a
   qualitative elementary topic to a High school one with formulas to
   rearrange, and nothing sat between. These are the arithmetic-with-one-step
   versions that make that jump survivable. */
const BATCH10 = [
  {
    id: "energy-transfer", name: "Energy transfers", subject: "Physics", strand: "Energy",
    needs: ["energy-basic"],
    teach: "Energy moves from one store to another, and the total is unchanged. A falling ball moves energy from a gravity store to a movement store; a kettle moves it from electricity to heat. Naming the stores is what makes the sums possible later.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A ball falls. Which way does the energy go?",
                        options: [{ t: "From a gravity store to a movement store" },
                                  { t: "From movement to gravity", why: "That is a ball thrown upwards, not a falling one." },
                                  { t: "It stays in the same store", why: "The ball is speeding up, so something changed." }], correct: 0,
                        steps: ["Up high it has energy because of its position.",
                                "As it falls that becomes movement — it speeds up."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What does the ball have at the top that it loses on the way down?",
                  "And what does it gain?"] });
      }
      if (d === 2) {
        const inn = ri(r, 2, 10) * 100, useful = Math.round(inn * ri(r, 2, 8) / 10);
        return q({ ask: inn + " J goes into a machine and " + useful +
            " J comes out usefully. How much is wasted, in J?",
          expect: (inn - useful) + " J",
          steps: [step("Energy is never destroyed, so all " + inn + " J went somewhere."),
                  step(inn + " − " + useful + " = " + (inn - useful) + " J."),
                  step("That part is usually heat — it left, but it did not vanish.")],
          hints: ["Everything that went in came out somewhere.",
                  "Take the useful part off the total."] });
      }
      const inn = ri(r, 2, 10) * 100, pct = ri(r, 2, 9) * 10;
      return q({ ask: "A machine takes in " + inn + " J and is " + pct +
          "% efficient. How much useful energy comes out, in J?",
        expect: (inn * pct / 100) + " J",
        steps: [step("Efficiency is the share that comes out doing the job you wanted."),
                step(pct + "% of " + inn + " = " + (inn * pct / 100) + " J."),
                step("The other " + (inn - inn * pct / 100) + " J left as heat.")],
        hints: ["Take that percentage of the energy going in.",
                "The rest is not lost — it is wasted."] });
    }
  },
  {
    id: "balanced-forces", name: "Balanced and unbalanced forces", subject: "Physics",
    strand: "Forces", needs: ["forces-basic"],
    teach: "When the forces on something cancel out, its motion does not change — it stays still, or keeps going exactly as it was. Only unbalanced forces speed things up, slow them down, or turn them.",
    gen: function (r, d) {
      if (d === 1) {
        const a = ri(r, 2, 12) * 10, b = a;
        return q({ ask: "A box is pushed with " + a + " N one way and " + b +
            " N the other. What is the total force on it, in N?",
          expect: "0 N",
          steps: [step("The two forces point in opposite directions, so they cancel."),
                  step(a + " − " + b + " = 0 N."),
                  step("Balanced forces mean the motion does not change.")],
          hints: ["The forces are in opposite directions.",
                  "Take one away from the other."] });
      }
      if (d === 2) {
        const a = ri(r, 5, 20) * 10, b = ri(r, 1, 4) * 10;
        return q({ ask: "A car engine pushes with " + a + " N and friction pushes back with " + b +
            " N. What is the resultant force, in N?",
          expect: (a - b) + " N",
          steps: [step("The forces oppose, so subtract the smaller from the larger."),
                  step(a + " − " + b + " = " + (a - b) + " N, in the direction the engine pushes."),
                  step("It is unbalanced, so the car speeds up.")],
          hints: ["They act in opposite directions.",
                  "The bigger one decides which way the result points."] });
      }
      const sets = [{ ask: "A car travels at a steady speed in a straight line. What is the resultant force on it?",
                      options: [{ t: "Zero" },
                                { t: "Forwards", why: "A forward resultant would make it speed up, and it is not." },
                                { t: "Backwards", why: "A backward resultant would slow it down." }], correct: 0,
                      steps: ["Steady speed in a straight line means the motion is not changing.",
                              "That happens exactly when the forces balance — the engine's push equals the friction."] },
                    { ask: "A parachutist falls at a constant speed. What does that tell you?",
                      options: [{ t: "Gravity has stopped", why: "Gravity is still pulling — it always is." },
                                { t: "Weight and air resistance are equal" },
                                { t: "There is no air resistance", why: "Without it the parachutist would keep speeding up." }], correct: 1,
                      steps: ["Constant speed means no change in motion, so the forces balance.",
                              "The downward weight is matched exactly by the upward air resistance."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Is the motion changing or not?",
                "Unchanging motion means balanced forces."] });
    }
  },
  {
    id: "weight-mass", name: "Weight and mass", subject: "Physics", strand: "Forces",
    needs: ["forces-basic"],
    teach: "Mass is how much stuff there is and never changes. Weight is the pull of gravity on that mass, so it depends on where you are — the same person has the same mass on the Moon but weighs about a sixth as much.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 20) * 5;
        return q({ ask: "An object has a mass of " + m +
            " kg on Earth. What is its mass on the Moon, in kg?",
          expect: m + " kg",
          steps: [step("Mass is how much matter there is — it does not depend on where you are."),
                  step("So it is still " + m + " kg."),
                  step("Its WEIGHT would change, because gravity is weaker there.")],
          hints: ["Does the amount of stuff change when you travel?",
                  "Mass and weight are not the same thing."] });
      }
      if (d === 2) {
        const m = ri(r, 2, 20) * 5;
        return q({ ask: "What is the weight of a " + m +
            " kg object on Earth, in N? (g = 10 N/kg)",
          expect: (m * 10) + " N",
          steps: [step("Weight = mass × gravitational field strength."),
                  step(m + " × 10 = " + (m * 10) + " N."),
                  step("Weight is a force, so it is measured in newtons, not kilograms.")],
          hints: ["Multiply the mass by 10.",
                  "Weight is a force."] });
      }
      const m = ri(r, 2, 20) * 5;
      return q({ ask: "A " + m + " kg object is taken to the Moon, where g = 1.6 N/kg. What does it weigh there, in N?",
        expect: sig(m * 1.6, 4) + " N", tol: 0.01,
        steps: [step("The mass is unchanged at " + m + " kg — mass never depends on location."),
                step("Weight = mass × g = " + m + " × 1.6."),
                step("= " + sig(m * 1.6, 4) + " N, about a sixth of its weight on Earth.")],
        hints: ["Which of the two changes when you move?",
                "Use the Moon's value of g, not Earth's."] });
    }
  }
];

/* Three strands stopped at High school with nothing at AP: Forces, Energy and
   Waves. These are the topics that carry them up — moments in equilibrium,
   power in circuits and rotation, and interference. */
const BATCH11 = [
  {
    id: "equilibrium-forces", name: "Equilibrium of forces", subject: "Physics",
    strand: "Forces", needs: ["moments", "hooke"],
    teach: "A body in equilibrium has no resultant force AND no resultant moment. Both conditions must hold — a beam can have balanced forces and still rotate, so taking moments about a chosen point is what pins it down.",
    gen: function (r, d) {
      if (d === 1) {
        const w = ri(r, 2, 10) * 10, d1 = ri(r, 1, 4), d2 = ri(r, 1, 4);
        const other = w * d1 / d2;
        return q({ ask: "A beam balances on a pivot. " + w + " N sits " + d1 +
            " m to the left. What force " + d2 + " m to the right balances it, in N?",
          expect: sig(other, 4) + " N", tol: 0.01,
          steps: [step("Balanced means the moments about the pivot are equal."),
                  step(w + " × " + d1 + " = F × " + d2 + "."),
                  step("F = " + (w * d1) + " ÷ " + d2 + " = " + sig(other, 4) + " N.")],
          hints: ["Moment is force times distance from the pivot.",
                  "Set the two moments equal."] });
      }
      if (d === 2) {
        const L = ri(r, 2, 8) * 2, w = ri(r, 2, 12) * 10;
        const x = ri(r, 1, L - 1);
        const right = w * x / L;
        return q({ ask: "A uniform beam of length " + L + " m rests on supports at both ends. A " + w +
            " N weight sits " + x + " m from the left. What force does the RIGHT support provide, in N, to 3 significant figures?",
          expect: sigText(right, 3) + " N", sigFigs: 3, tol: 0.01,
          steps: [step("Take moments about the LEFT support — that removes its unknown force from the equation."),
                  step("The weight's moment is " + w + " × " + x + " = " + (w * x) + " N m."),
                  step("The right support acts " + L + " m away: R × " + L + " = " + (w * x) + "."),
                  step("R = " + sigText(right, 3) + " N.")],
          hints: ["Choose a point that eliminates one unknown.",
                  "Take moments about a support, not the middle."] });
      }
      const sets = [{ ask: "A beam has balanced forces but still starts to rotate. What does that tell you?",
                      options: [{ t: "The moments are not balanced" },
                                { t: "The forces must be unbalanced after all", why: "You were told they balance — both conditions are separate." },
                                { t: "This cannot happen", why: "It can: two equal opposite forces not in line form a couple." }], correct: 0,
                      steps: ["Equilibrium needs BOTH no resultant force and no resultant moment.",
                              "Two equal opposite forces acting along different lines cancel but still turn it."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Equilibrium has two conditions, not one.",
                "Can forces cancel and still cause rotation?"] });
    }
  },
  {
    id: "power-energy", name: "Power in practice", subject: "Physics", strand: "Energy",
    needs: ["power", "efficiency"],
    teach: "Power is energy per second, and it shows up wherever work is done: P = Fv for a force moving at constant speed, and P = VI in a circuit. They are the same idea measured through different quantities.",
    gen: function (r, d) {
      if (d === 1) {
        const F = ri(r, 2, 20) * 10, v = ri(r, 2, 15);
        return q({ ask: "A car pushes with " + F + " N at a steady " + v +
            " m/s. What power is it delivering, in W?",
          expect: (F * v) + " W",
          steps: [step("At constant speed, power = force × speed."),
                  step(F + " × " + v + " = " + (F * v) + " W."),
                  step("It is the same as energy per second — the force does F joules of work every metre.")],
          hints: ["Force times speed.",
                  "Both are already in the right units."] });
      }
      if (d === 2) {
        const P = ri(r, 3, 20) * 100, v = ri(r, 2, 15);
        return q({ ask: "An engine delivers " + P + " W while moving at " + v +
            " m/s. What driving force does it produce, in N, to 3 significant figures?",
          expect: sigText(P / v, 3) + " N", sigFigs: 3, tol: 0.01,
          steps: [step("P = Fv, so F = P ÷ v."),
                  step(P + " ÷ " + v + " = " + sigText(P / v, 3) + " N."),
                  step("At higher speed the same engine gives less force — which is why cars change gear.")],
          hints: ["Rearrange P = Fv for the force.",
                  "Divide the power by the speed."] });
      }
      const P = ri(r, 3, 15) * 100, pct = ri(r, 20, 80), t = ri(r, 10, 60);
      const useful = P * pct / 100 * t;
      return q({ ask: "A " + P + " W motor is " + pct + "% efficient and runs for " + t +
          " s. How much USEFUL energy does it deliver, in J, to 3 significant figures?",
        expect: sigText(useful, 3) + " J", sigFigs: 3, tol: 0.01,
        steps: [step("Total energy in: " + P + " × " + t + " = " + (P * t) + " J."),
                step("Only " + pct + "% of it comes out usefully."),
                step((P * t) + " × " + pct + "% = " + sigText(useful, 3) + " J."),
                step("The rest, " + sigText(P * t - useful, 3) + " J, left as heat.")],
        hints: ["Power times time gives the energy in.",
                "Then take the efficiency of that."] });
    }
  },
  {
    id: "interference", name: "Interference and superposition", subject: "Physics",
    strand: "Waves", needs: ["wave-props", "em-spectrum"],
    teach: "When two waves meet their displacements add. In step, they reinforce and the amplitude grows; exactly out of step, they cancel. A path difference of a whole number of wavelengths gives reinforcement, and a half-wavelength difference gives cancellation.",
    gen: function (r, d) {
      if (d === 1) {
        const a1 = ri(r, 2, 8), a2 = ri(r, 2, 8);
        return q({ ask: "Two waves of amplitude " + a1 + " and " + a2 +
            " meet exactly in step. What is the amplitude where they overlap?",
          expect: (a1 + a2) + "",
          steps: [step("In step means the displacements add at every moment."),
                  step(a1 + " + " + a2 + " = " + (a1 + a2) + "."),
                  step("That is constructive interference.")],
          hints: ["In step means they reinforce.",
                  "Add the two amplitudes."] });
      }
      if (d === 2) {
        const a1 = ri(r, 5, 12), a2 = ri(r, 1, 4);
        return q({ ask: "Two waves of amplitude " + a1 + " and " + a2 +
            " meet exactly out of step. What is the amplitude where they overlap?",
          expect: (a1 - a2) + "",
          steps: [step("Out of step means one displacement is positive while the other is negative."),
                  step(a1 + " − " + a2 + " = " + (a1 - a2) + "."),
                  step("They only cancel completely if the amplitudes are equal.")],
          hints: ["They subtract rather than add.",
                  "Equal amplitudes would cancel to nothing."] });
      }
      const shownE = function (n) { return Number(n.toFixed(6)); };
      const lam = ri(r, 2, 9);
      const whole = r() < 0.5;
      const pathDiff = whole ? lam * ri(r, 1, 3) : lam * (ri(r, 0, 2) + 0.5);
      return q({ ask: "Two sources emit waves of wavelength " + lam +
          " m in step. At a point the path difference is " + pathDiff +
          " m. Is the interference constructive?  1 for yes, 0 for no.",
        expect: (whole ? 1 : 0) + "",
        steps: [step("Divide the path difference by the wavelength: " + pathDiff + " ÷ " + lam +
                     " = " + shownE(pathDiff / lam) + "."),
                step(whole ? "That is a whole number of wavelengths, so the waves arrive in step."
                           : "That is a half-number of wavelengths, so they arrive exactly out of step."),
                step(whole ? "Constructive — they reinforce." : "Destructive — they cancel."),
                step("Whole wavelengths reinforce; half wavelengths cancel.")],
        hints: ["How many wavelengths is the path difference?",
                "A whole number means in step."] });
    }
  }
];

/* The last two real gaps: Radioactivity and Structure both stopped at High
   school. (The remaining empty cells are Amount, Reactions, Radioactivity and
   Structure at Elementary, and those stay empty on purpose — moles, balancing
   equations, isotopes and nuclear decay are not elementary ideas, and inventing
   a simplified version would teach something that later has to be unlearned.) */
const BATCH12 = [
  {
    id: "decay-equations", name: "Nuclear equations", subject: "Physics",
    strand: "Radioactivity", needs: ["decay-types", "isotopes"],
    teach: "In a nuclear equation the mass numbers must balance and the proton numbers must balance, separately. Alpha decay takes 4 from the mass and 2 from the protons; beta decay leaves the mass alone and adds 1 to the protons, because a neutron became a proton.",
    gen: function (r, d) {
      if (d === 1) {
        // Real heavy nuclei: A around 210-240 with Z 84-92 is physical.
        const A = ri(r, 210, 240), Z = ri(r, 84, 92);
        return q({ ask: "A nucleus with mass number " + A + " and proton number " + Z +
            " emits an alpha particle. What is the new mass number?",
          expect: (A - 4) + "",
          steps: [step("An alpha particle is 2 protons and 2 neutrons \\u2014 mass number 4."),
                  step(A + " \\u2212 4 = " + (A - 4) + "."),
                  step("The proton number drops by 2 as well, to " + (Z - 2) + ".")],
          hints: ["What is an alpha particle made of?",
                  "Take its mass number off."] });
      }
      if (d === 2) {
        /* Z must be well below A. Chosen independently, this produced "mass
           number 35 and proton number 40" \u2014 more protons than there are
           nucleons, which cannot exist. The arithmetic was right and the
           nucleus was impossible. Build Z from A instead. */
        const A = ri(r, 12, 90);
        const Z = Math.max(3, Math.round(A / 2) - ri(r, 0, 4));
        return q({ ask: "A nucleus with mass number " + A + " and proton number " + Z +
            " emits a beta particle. What is the new proton number?",
          expect: (Z + 1) + "",
          steps: [step("In beta decay a neutron turns into a proton and an electron."),
                  step("One more proton: " + Z + " + 1 = " + (Z + 1) + "."),
                  step("The mass number is unchanged at " + A + " \\u2014 the total of protons and neutrons did not alter.")],
          hints: ["What does a neutron become?",
                  "The mass number does not move."] });
      }
      const A = ri(r, 210, 238), Z = ri(r, 84, 92);
      const alphas = ri(r, 1, 3), betas = ri(r, 1, 3);
      const A2 = A - 4 * alphas, Z2 = Z - 2 * alphas + betas;
      return q({ ask: "A nucleus (mass " + A + ", protons " + Z + ") emits " + alphas +
          " alpha particle" + (alphas === 1 ? "" : "s") + " and " + betas + " beta particle" +
          (betas === 1 ? "" : "s") + ". What is the final proton number?",
        expect: Z2 + "",
        steps: [step("Handle the two kinds separately \\u2014 they change different things."),
                step(alphas + " alpha" + (alphas === 1 ? "" : "s") + " removes " + (2 * alphas) + " protons: " +
                     Z + " \\u2212 " + (2 * alphas) + " = " + (Z - 2 * alphas) + "."),
                step(betas + " beta" + (betas === 1 ? "" : "s") + " adds " + betas + ": " +
                     (Z - 2 * alphas) + " + " + betas + " = " + Z2 + "."),
                step("The mass number ends at " + A2 + ", changed only by the alphas.")],
        hints: ["Alphas and betas do different things to the proton number.",
                "One takes away, the other adds."] });
    }
  },
  {
    id: "electron-config", name: "Electron arrangement", subject: "Chemistry",
    strand: "Structure", needs: ["periodic", "isotopes"],
    teach: "Electrons fill shells from the inside out: 2 in the first, then 8, then 8. The number in the outer shell is the group number, and it is what decides how the element reacts \\u2014 which is why the periodic table is arranged the way it is.",
    gen: function (r, d) {
      if (d === 1) {
        const n = pick(r, [2, 3, 4, 8, 10, 11, 12, 17, 18]);
        const shells = [];
        let left = n;
        for (const cap of [2, 8, 8]) { const put = Math.min(cap, left); if (put > 0) shells.push(put); left -= put; }
        return q({ ask: "An atom has " + n + " electrons. How many are in its FIRST shell?",
          expect: Math.min(2, n) + "",
          steps: [step("The first shell holds at most 2 electrons."),
                  step(n >= 2 ? "There are enough to fill it, so it holds 2."
                              : "There are only " + n + ", so it holds " + n + "."),
                  step("The full arrangement is " + shells.join(", ") + ".")],
          hints: ["How many fit in the innermost shell?",
                  "Fill from the inside out."] });
      }
      if (d === 2) {
        const n = pick(r, [7, 9, 11, 12, 15, 16, 17, 19, 20]);
        let left = n; const shells = [];
        for (const cap of [2, 8, 8]) { const put = Math.min(cap, left); if (put > 0) shells.push(put); left -= put; }
        return q({ ask: "An atom has " + n + " electrons. How many are in its OUTER shell?",
          expect: shells[shells.length - 1] + "",
          steps: [step("Fill from the inside: " + shells.join(", ") + "."),
                  step("The last number is the outer shell: " + shells[shells.length - 1] + "."),
                  step("That is also its group number, which is why the table is arranged this way.")],
          hints: ["Fill 2, then 8, then 8.",
                  "The outer shell is whatever is left at the end."] });
      }
      const sets = [{ ask: "Why do the noble gases barely react?",
                      options: [{ t: "Their outer shell is already full" },
                                { t: "They are too heavy", why: "Helium is the lightest of all and still does not react." },
                                { t: "They have no electrons", why: "They have plenty \\u2014 the arrangement is what matters." }], correct: 0,
                      steps: ["Reacting means gaining, losing or sharing outer electrons.",
                              "A full outer shell means there is nothing to gain from doing so."] },
                    { ask: "Sodium has 1 outer electron and chlorine has 7. Why do they react so readily together?",
                      options: [{ t: "Sodium gives its one away and chlorine takes it" },
                                { t: "They share all their electrons", why: "That is covalent bonding, between two non-metals." },
                                { t: "They are next to each other in the table", why: "They are at opposite ends of it." }], correct: 0,
                      steps: ["Sodium reaches a full shell by losing one; chlorine by gaining one.",
                              "Each solves the other's problem, which is exactly why the reaction is so vigorous."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What is special about a full outer shell?",
                "Count the outer electrons of each."] });
    }
  }
];

/* Chemistry was 26 skills against physics' 42. These even it out across
   Reactions, Structure and Matter. */
const BATCH13 = [
  {
    id: "acids-bases", name: "Acids and bases", subject: "Chemistry", strand: "Reactions",
    needs: ["ph"],
    teach: "An acid gives away hydrogen ions in solution and a base accepts them. When they meet, those ions combine with hydroxide to make water, leaving a salt behind \u2014 which is why neutralisation always produces a salt and water.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What do acids release in solution?",
                        options: [{ t: "Hydrogen ions" },
                                  { t: "Hydroxide ions", why: "That is what a base releases." },
                                  { t: "Electrons", why: "That is oxidation, a different idea." }], correct: 0,
                        steps: ["An acid is a proton donor \u2014 it gives away H+.",
                                "The more it gives away, the stronger the acid."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What makes something acidic?", "Think about what pH measures."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Acid + alkali \u2192 ?",
                        options: [{ t: "Salt + water" },
                                  { t: "Salt + hydrogen", why: "That is acid + metal." },
                                  { t: "Salt + carbon dioxide + water", why: "That is acid + carbonate." }], correct: 0,
                        steps: ["H+ from the acid meets OH- from the alkali and makes water.",
                                "Whatever is left over pairs up as the salt."] },
                      { ask: "Acid + metal carbonate \u2192 ?",
                        options: [{ t: "Salt + water + carbon dioxide" },
                                  { t: "Salt + water", why: "That is acid + alkali \u2014 no carbonate to release CO2." },
                                  { t: "Salt only", why: "The carbonate must go somewhere." }], correct: 0,
                        steps: ["The carbonate breaks up, releasing carbon dioxide.",
                                "That fizzing is the standard test for a carbonate."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What is always made when H+ meets OH-?",
                  "A carbonate releases a gas."] });
      }
      const conc = ri(r, 1, 5) / 10, vol = ri(r, 10, 40);
      const moles = conc * vol / 1000;
      return q({ ask: vol + " cm\u00B3 of " + conc + " mol/dm\u00B3 hydrochloric acid is neutralised by sodium hydroxide of the same concentration. What volume of alkali is needed, in cm\u00B3?",
        expect: vol + " cm\u00B3",
        steps: [step("Write the equation: HCl + NaOH \u2192 NaCl + H2O \u2014 a 1:1 ratio."),
                step("Moles of acid = " + conc + " \u00D7 " + vol + "/1000 = " + sig(moles, 4) + " mol."),
                step("The same number of moles of alkali is needed."),
                step("At the same concentration that means the same volume: " + vol + " cm\u00B3.")],
        hints: ["What is the ratio in the balanced equation?",
                "Same concentration and same moles means same volume."] });
    }
  },
  {
    id: "reactivity", name: "The reactivity series", subject: "Chemistry", strand: "Reactions",
    needs: ["periodic"],
    teach: "Metals can be ordered by how readily they lose electrons. A more reactive metal displaces a less reactive one from its compound, and that single ordering explains extraction, corrosion and displacement together.",
    gen: function (r, d) {
      const order = ["potassium", "sodium", "calcium", "magnesium", "zinc", "iron", "copper", "silver", "gold"];
      if (d === 1) {
        const i = ri(r, 0, 3), j = ri(r, 5, 8);
        return q({ ask: "Which is more reactive, " + order[i] + " or " + order[j] + "?",
          options: [{ t: order[i] }, { t: order[j], why: "It sits lower in the reactivity series." },
                    { t: "They are the same", why: "Every metal has its own place in the order." }], correct: 0,
          steps: [step("The series runs from potassium at the top to gold at the bottom."),
                  step(order[i] + " is higher, so it is more reactive.")],
          hints: ["Which one is nearer the top of the series?",
                  "Gold is the least reactive of all."] });
      }
      if (d === 2) {
        const i = ri(r, 3, 5), j = ri(r, 6, 8);
        const works = r() < 0.5;
        const a = works ? order[i] : order[j], b = works ? order[j] : order[i];
        return q({ ask: "Will " + a + " displace " + b + " from its sulfate solution?  1 for yes, 0 for no.",
          expect: (works ? 1 : 0) + "",
          steps: [step("A metal displaces another only if it is MORE reactive."),
                  step(a + " is " + (works ? "above" : "below") + " " + b + " in the series."),
                  step(works ? "So yes, it displaces it." : "So no \u2014 nothing happens at all."),
                  step("A reaction that does not happen is a real answer here.")],
          hints: ["Which of the two is higher in the series?",
                  "Less reactive cannot displace more reactive."] });
      }
      const sets = [{ ask: "Why is gold found as the pure metal in the ground, while aluminium is not?",
                      options: [{ t: "Gold is unreactive, so it never formed compounds" },
                                { t: "Gold is rarer", why: "Rarity has nothing to do with the chemical form it is found in." },
                                { t: "Aluminium is heavier", why: "Density does not decide whether something reacts." }], correct: 0,
                      steps: ["Gold sits at the bottom of the series and barely reacts with anything.",
                              "Aluminium is high in the series, so it is always found combined with oxygen.",
                              "That is also why extracting aluminium needs electrolysis while gold needs only digging."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Where does each metal sit in the series?",
                "Reactive metals do not stay pure."] });
    }
  },
  {
    id: "giant-structures", name: "Giant structures", subject: "Chemistry", strand: "Structure",
    needs: ["bonding"],
    teach: "In a giant structure the bonding continues throughout the whole solid rather than stopping at a molecule. Melting one means breaking every bond, which is why diamond and salt melt at enormous temperatures while water melts at zero.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Why does diamond have such a high melting point?",
                        options: [{ t: "Every atom is covalently bonded to its neighbours" },
                                  { t: "It is very dense", why: "Density does not set a melting point." },
                                  { t: "It is a metal", why: "Diamond is pure carbon, a non-metal." }], correct: 0,
                        steps: ["The covalent bonds run through the entire crystal.",
                                "Melting it means breaking all of them, which takes enormous energy."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Does the bonding stop anywhere in a diamond?",
                  "How many bonds must break to melt it?"] });
      }
      if (d === 2) {
        const sets = [{ ask: "Graphite conducts electricity but diamond does not. Why?",
                        options: [{ t: "Graphite has spare electrons free to move" },
                                  { t: "Graphite is a metal", why: "Both are pure carbon." },
                                  { t: "Diamond is too hard", why: "Hardness has nothing to do with conduction." }], correct: 0,
                        steps: ["Each carbon in graphite bonds to three others, leaving one electron free.",
                                "In diamond all four are used up in bonds, so nothing can move."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Count the bonds each carbon makes in each structure.",
                  "Conduction needs something free to move."] });
      }
      const sets = [{ ask: "Sodium chloride conducts when molten or dissolved but not as a solid. Why?",
                      options: [{ t: "The ions are locked in place in the solid" },
                                { t: "The solid has no ions", why: "It is made entirely of ions \u2014 they just cannot move." },
                                { t: "Water conducts, not the salt", why: "Pure water is a poor conductor; the dissolved ions carry the current." }], correct: 0,
                      steps: ["Conduction needs charged particles that can MOVE.",
                              "In the solid lattice the ions are held in fixed positions.",
                              "Melting or dissolving frees them, and then it conducts.",
                              "The ions were always there \u2014 what changed is whether they can travel."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What has to move for a current to flow?",
                "Are the ions present in the solid, or absent?"] });
    }
  }
];

const BATCH14 = [
  {
    id: "limiting", name: "Limiting reactants", subject: "Chemistry", strand: "Amount",
    needs: ["moles", "balancing"],
    teach: "When two reactants meet, one usually runs out first and stops the reaction. That one is limiting, and it alone decides how much product forms \u2014 the rest is left over.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Two reactants are mixed and one runs out first. What does the other one do?",
                        options: [{ t: "It is left over unreacted" },
                                  { t: "It also runs out", why: "Only the limiting one runs out completely." },
                                  { t: "It stops the reaction", why: "The reaction stops when the LIMITING reactant is gone." }], correct: 0,
                        steps: ["The reaction stops when one reactant is used up.",
                                "Whatever is left of the other simply sits there."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which one decides when the reaction ends?", "The other is in excess."] });
      }
      if (d === 2) {
        const a = ri(r, 2, 8), b = a + ri(r, 1, 6);
        return q({ ask: a + " mol of hydrogen reacts with " + b +
            " mol of chlorine in a 1:1 ratio. Which is limiting?  1 for hydrogen, 2 for chlorine.",
          expect: "1",
          steps: [step("The ratio is 1:1, so equal moles are needed."),
                  step("There are only " + a + " mol of hydrogen but " + b + " mol of chlorine."),
                  step("Hydrogen runs out first, so it is limiting."),
                  step((b - a) + " mol of chlorine is left over.")],
          hints: ["Compare the moles against the ratio.",
                  "Whichever there is less of, relative to the ratio, runs out."] });
      }
      const nH = ri(r, 2, 10), nO = ri(r, 1, 8);
      // 2H2 + O2 -> 2H2O : need 2 H2 per O2
      const byH = nH / 2, byO = nO;
      const limH = byH < byO;
      const water = Math.min(byH, byO) * 2;
      return q({ ask: nH + " mol of H2 reacts with " + nO +
          " mol of O2 to make water (2H2 + O2 \u2192 2H2O). How many moles of water form?  Give it to 4 decimal places.",
        expect: sigText(water, 6), tol: 0.001,
        steps: [step("The ratio is not 1:1 \u2014 it takes 2 H2 for every O2."),
                step(nH + " mol H2 could make " + sig(nH, 4) + " mol water; " + nO + " mol O2 could make " + sig(nO * 2, 4) + " mol."),
                step("The smaller figure wins, so " + (limH ? "hydrogen" : "oxygen") + " is limiting."),
                step("That gives " + sig(water, 6) + " mol of water.")],
        hints: ["Work out what each reactant alone could produce.",
                "The smaller answer is the real one."] });
    }
  },
  {
    id: "energy-changes", name: "Exothermic and endothermic", subject: "Chemistry",
    strand: "Reactions",
    /* Was needs: ["enthalpy"], which is backwards. This skill starts from
       "does the test tube feel hot" and builds up to bond energies; enthalpy
       is the formal treatment that comes after it. Declaring it the other way
       round gated a Middle school idea behind AP work, and promoting this
       skill to match dragged three others up with it. */
    needs: [],
    teach: "A reaction that releases energy warms its surroundings and is exothermic. One that takes energy in cools them and is endothermic. The sign convention is from the reaction's point of view, which is why a warming reaction has a NEGATIVE enthalpy change.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A reaction makes the test tube feel hot. What is it?",
                        options: [{ t: "Exothermic" },
                                  { t: "Endothermic", why: "That would make it feel cold." },
                                  { t: "Neither", why: "Energy went somewhere \u2014 into the tube and your hand." }], correct: 0,
                        steps: ["Energy left the reaction and warmed the surroundings.",
                                "Out of the reaction means exothermic."] },
                      { ask: "A reaction makes the tube feel cold. What is it?",
                        options: [{ t: "Endothermic" },
                                  { t: "Exothermic", why: "That would warm it up." },
                                  { t: "It has stopped", why: "Cooling is a sign it is running, not stopped." }], correct: 0,
                        steps: ["The reaction took energy IN from its surroundings.",
                                "That is what made them cooler."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Did energy leave the reaction or enter it?",
                  "The surroundings changed temperature the opposite way."] });
      }
      if (d === 2) {
        const neg = r() < 0.5;
        const val = ri(r, 50, 400) * (neg ? -1 : 1);
        return q({ ask: "A reaction has \u0394H = " + val +
            " kJ/mol. Is it exothermic?  1 for yes, 0 for no.",
          expect: (neg ? 1 : 0) + "",
          steps: [step("The sign is measured from the REACTION's point of view."),
                  step(neg ? "Negative means the reaction lost energy \u2014 it went to the surroundings."
                           : "Positive means the reaction gained energy \u2014 it took it from the surroundings."),
                  step(neg ? "So it is exothermic and the surroundings warm."
                           : "So it is endothermic and the surroundings cool."),
                  step("The sign feels backwards until you remember whose point of view it is.")],
          hints: ["Whose energy does the sign describe?",
                  "Negative means the reaction lost it."] });
      }
      const broken = ri(r, 800, 2000), made = ri(r, 800, 2000);
      const dH = broken - made;
      return q({ ask: "Breaking bonds takes " + broken + " kJ and making them releases " + made +
          " kJ. What is \u0394H, in kJ?",
        expect: dH + " kJ",
        steps: [step("\u0394H = energy in to break bonds \u2212 energy out from making them."),
                step(broken + " \u2212 " + made + " = " + dH + " kJ."),
                step(dH < 0 ? "Negative, so more came out than went in \u2014 exothermic."
                            : "Positive, so more went in than came out \u2014 endothermic."),
                step("Breaking always costs energy and making always releases it; the balance decides the sign.")],
        hints: ["Broken minus made, in that order.",
                "The sign tells you which type it is."] });
    }
  },
  {
    id: "polymers", name: "Polymers", subject: "Chemistry", strand: "Structure",
    needs: ["organic"],
    teach: "A polymer is one small molecule repeated thousands of times. Addition polymers form when double bonds open and join up with nothing lost \u2014 which is exactly why they do not easily break down again.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What is a polymer made from?",
                        options: [{ t: "Many small molecules joined together" },
                                  { t: "One very large atom", why: "No atom is that big \u2014 it is many molecules linked." },
                                  { t: "A mixture of metals", why: "That is an alloy." }], correct: 0,
                        steps: ["Poly means many; mer means part.",
                                "The small repeating unit is called the monomer."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What does the word poly mean?", "It is built from repeating units."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Ethene forms poly(ethene). What happens to the double bond?",
                        options: [{ t: "It opens and links to the next molecule" },
                                  { t: "It stays as it is", why: "Then nothing would join up." },
                                  { t: "It becomes a triple bond", why: "No new bonds to the same pair of carbons are formed." }], correct: 0,
                        steps: ["The double bond opens, freeing each carbon to bond to a neighbour.",
                                "Nothing is lost in the process, which is why it is called addition polymerisation."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["An alkene's double bond can open.",
                  "What does each carbon then bond to?"] });
      }
      const sets = [{ ask: "Why do addition polymers persist in the environment for centuries?",
                      options: [{ t: "Their carbon chains are unreactive and nothing digests them" },
                                { t: "They are too heavy to move", why: "Weight has nothing to do with breaking down." },
                                { t: "They are toxic to bacteria", why: "The problem is that bacteria cannot use them, not that they are poisoned." }], correct: 0,
                      steps: ["The chain is all strong carbon-carbon and carbon-hydrogen bonds.",
                              "No organism evolved to break a molecule that did not exist until the 1930s.",
                              "The same unreactivity that makes plastic useful makes it persistent.",
                              "That is the trade: the property you want and the problem you get are the same property."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What kind of bonds hold the chain together?",
                "Why would nothing in nature break it down?"] });
    }
  }
];

const BATCH15 = [
  {
    id: "chromatography", name: "Chromatography", subject: "Chemistry", strand: "Matter",
    needs: ["separating"],
    teach: "A mixture is separated by how strongly each substance sticks to the paper against how well it dissolves in the solvent. Things that dissolve well and stick weakly travel furthest, which is why the spots spread out.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Two dyes are spotted on paper and the solvent runs up. One travels further. Why?",
                        options: [{ t: "It dissolves better and sticks to the paper less" },
                                  { t: "It is lighter", why: "Mass is not what decides how far a spot travels." },
                                  { t: "It was spotted higher", why: "Both start on the same line, which is the point of drawing it." }], correct: 0,
                        steps: ["Two competing pulls: sticking to the paper and dissolving in the solvent.",
                                "Whichever pull wins decides how far the spot goes."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What two things is each dye caught between?",
                  "It is not about weight."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Why is the start line drawn in pencil rather than pen?",
                        options: [{ t: "Ink would dissolve and run up with the solvent" },
                                  { t: "Pencil is more accurate", why: "Accuracy is not the issue." },
                                  { t: "Pen damages the paper", why: "It does not \u2014 the problem is that ink is itself a mixture of dyes." }], correct: 0,
                        steps: ["Ink is a mixture of dyes, exactly like the samples being tested.",
                                "It would separate and travel up the paper, ruining the result.",
                                "Pencil is graphite, which does not dissolve in the solvent."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What is ink actually made of?",
                  "What would the solvent do to it?"] });
      }
      const spot = ri(r, 10, 70) / 10, front = spot + ri(r, 10, 50) / 10;
      const rf = spot / front;
      return q({ ask: "A spot travels " + spot + " cm and the solvent front travels " + front +
          " cm. What is the Rf value, to 3 significant figures?",
        expect: sigText(rf, 3), sigFigs: 3, tol: 0.01,
        steps: [step("Rf = distance travelled by the spot \u00F7 distance travelled by the solvent."),
                step(spot + " \u00F7 " + front + " = " + sigText(rf, 3) + "."),
                step("Rf is always less than 1, because the spot cannot outrun the solvent carrying it."),
                step("It has no units \u2014 it is a ratio of two lengths, which is why it identifies a substance regardless of paper size.")],
        hints: ["Spot distance over solvent distance.",
                "The answer must be under 1."] });
    }
  },
  {
    id: "electrolysis-products", name: "Predicting electrolysis products", subject: "Chemistry",
    strand: "Reactions", needs: ["electrolysis", "reactivity"],
    teach: "At the negative electrode, hydrogen forms instead of the metal if that metal is more reactive than hydrogen. At the positive electrode a halide forms if present, otherwise oxygen. Two rules cover almost every aqueous case.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Which electrode do positive ions travel to?",
                        options: [{ t: "The negative one" },
                                  { t: "The positive one", why: "Like charges repel \u2014 positive ions are pushed away from it." },
                                  { t: "Either", why: "Charge decides it completely." }], correct: 0,
                        steps: ["Opposite charges attract.",
                                "Positive ions go to the negative electrode, called the cathode."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which charges attract?", "The clue is in the sign."] });
      }
      if (d === 2) {
        const reactive = r() < 0.5;
        const metal = reactive ? "sodium" : "copper";
        return q({ ask: "Aqueous " + metal + " chloride is electrolysed. What forms at the negative electrode?  " +
            "1 for " + metal + ", 2 for hydrogen.",
          expect: (reactive ? 2 : 1) + "",
          steps: [step("Compare the metal with hydrogen in the reactivity series."),
                  step(reactive ? "Sodium is MORE reactive than hydrogen, so it stays in solution."
                                : "Copper is LESS reactive than hydrogen, so the metal is deposited."),
                  step(reactive ? "Hydrogen is produced instead." : "Copper is produced."),
                  step("The water is always there offering hydrogen \u2014 the metal only wins if it is less reactive.")],
          hints: ["Is the metal above or below hydrogen?",
                  "The less reactive one is released."] });
      }
      const halide = r() < 0.5;
      const sol = halide ? "sodium chloride" : "sodium sulfate";
      return q({ ask: "Aqueous " + sol + " is electrolysed. What forms at the POSITIVE electrode?  " +
          "1 for chlorine, 2 for oxygen.",
        expect: (halide ? 1 : 2) + "",
        steps: [step("At the positive electrode, a halide is released if one is present."),
                step(halide ? "Chloride ions are present, so chlorine is given off."
                            : "There is no halide here \u2014 only sulfate, which stays put."),
                step(halide ? "Chlorine forms." : "Oxygen from the water forms instead."),
                step("Sulfate and nitrate never form a gas themselves; the water supplies the oxygen.")],
        hints: ["Is there a halide in the solution?",
                "If not, the water provides the answer."] });
    }
  },
  {
    id: "reversible", name: "Reversible reactions", subject: "Chemistry", strand: "Reactions",
    needs: ["equilibrium"],
    teach: "Some reactions run both ways. Written with a double arrow, they reach a point where forward and backward rates match and the amounts stop changing \u2014 which is not the same as the reaction stopping.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What does the \u21CC symbol mean?",
                        options: [{ t: "The reaction goes both ways" },
                                  { t: "The reaction is fast", why: "Speed is a separate matter." },
                                  { t: "It needs heating", why: "Nothing about the arrow says that." }], correct: 0,
                        steps: ["Two arrows in opposite directions mean products can turn back into reactants.",
                                "A single arrow would mean it runs to completion."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Count the arrowheads.", "What does a second arrow allow?"] });
      }
      if (d === 2) {
        const sets = [{ ask: "At equilibrium, what is happening?",
                        options: [{ t: "Both reactions continue at equal rates" },
                                  { t: "Everything has stopped", why: "The rates are equal, not zero \u2014 both directions still run." },
                                  { t: "The reactants are used up", why: "Both reactants and products are present at equilibrium." }], correct: 0,
                        steps: ["Forward and backward rates become equal.",
                                "The amounts stop changing while both reactions keep running \u2014 which is why it is called dynamic."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Does equal mean zero?",
                  "The word dynamic is doing real work here."] });
      }
      const exo = r() < 0.5;
      return q({ ask: "A reversible reaction is " + (exo ? "exothermic" : "endothermic") +
          " in the forward direction. Raising the temperature shifts it which way?  1 forward, 2 backward.",
        expect: (exo ? 2 : 1) + "",
        steps: [step("The system shifts to OPPOSE the change you made."),
                step("Adding heat is opposed by the direction that absorbs heat \u2014 the endothermic one."),
                step(exo ? "Here the forward reaction gives out heat, so the BACKWARD one absorbs it."
                         : "Here the forward reaction absorbs heat, so it is favoured."),
                step("So it shifts " + (exo ? "backward" : "forward") + ". Heating does not always give more product.")],
        hints: ["Which direction absorbs heat?",
                "The system opposes what you did to it."] });
    }
  }
];

const BATCH16 = [
  {
    id: "gravity", name: "Gravitational fields", subject: "Physics", strand: "Forces",
    needs: ["weight-mass"],
    teach: "Every mass attracts every other with a force that falls off as the square of the distance. Double the separation and the force drops to a quarter \u2014 which is why the Moon is held but barely felt on Earth's surface.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What happens to gravitational force if the distance doubles?",
                        options: [{ t: "It falls to a quarter" },
                                  { t: "It halves", why: "That would be an inverse relationship, not an inverse SQUARE one." },
                                  { t: "It stays the same", why: "Distance matters enormously." }], correct: 0,
                        steps: ["Force is proportional to 1/r\u00B2.",
                                "Doubling r divides the force by 2\u00B2 = 4."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["It is an inverse SQUARE law.", "Square the factor, then divide."] });
      }
      if (d === 2) {
        const factor = pick(r, [2, 3, 4, 5]);
        return q({ ask: "The distance between two masses is multiplied by " + factor +
            ". By what factor does the force change?  Give it as a decimal to 4 places.",
          expect: sigText(1 / (factor * factor), 6), tol: 0.001,
          steps: [step("Force \u221D 1/r\u00B2."),
                  step("Multiplying r by " + factor + " divides the force by " + factor + "\u00B2 = " + (factor * factor) + "."),
                  step("So the factor is 1/" + (factor * factor) + " = " + sig(1 / (factor * factor), 6) + ".")],
          hints: ["Square the distance factor.", "Then take the reciprocal."] });
      }
      const sets = [{ ask: "Astronauts on the Space Station float. Why?",
                      options: [{ t: "They are falling around the Earth, along with the station" },
                                { t: "There is no gravity there", why: "Gravity there is about 90% of its strength at the surface." },
                                { t: "They are beyond the atmosphere", why: "Air has nothing to do with weight." }], correct: 0,
                      steps: ["At 400 km up, gravity is still roughly 90% as strong as on the ground.",
                              "The station and everyone in it are in continuous free fall, moving sideways fast enough to keep missing the Earth.",
                              "Floating is falling together, not the absence of gravity.",
                              "\"Zero gravity\" is the most misleading phrase in physics."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["How strong is gravity 400 km up?",
                "What are they and the station both doing?"] });
    }
  },
  {
    id: "induction", name: "Electromagnetic induction", subject: "Physics", strand: "Electricity",
    needs: ["magnetism"],
    teach: "Moving a magnet near a coil makes a voltage across it. Nothing has to touch, and the voltage only exists while the field is CHANGING \u2014 hold the magnet still and it stops.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A magnet is held still inside a coil. What voltage is induced?",
                        options: [{ t: "None" },
                                  { t: "A steady voltage", why: "A steady field induces nothing \u2014 only change does." },
                                  { t: "It depends on the magnet", why: "However strong it is, a stationary field induces nothing." }], correct: 0,
                        steps: ["Induction needs the magnetic field through the coil to CHANGE.",
                                "A stationary magnet gives a constant field, so nothing is induced."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What has to change for induction?",
                  "Is the field changing here?"] });
      }
      if (d === 2) {
        const sets = [{ ask: "How can you increase the induced voltage?",
                        options: [{ t: "Move the magnet faster" },
                                  { t: "Hold it closer without moving", why: "Distance alone changes nothing if the field is not changing." },
                                  { t: "Use a longer wire lying straight", why: "It is turns in a coil that matter, not raw length." }], correct: 0,
                        steps: ["A faster change means a bigger induced voltage.",
                                "More turns and a stronger magnet also increase it \u2014 all three change how fast the field through the coil varies."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Faster change means more voltage.",
                  "What are the three ways to increase it?"] });
      }
      const sets = [{ ask: "A transformer works on AC but not DC. Why?",
                      options: [{ t: "DC gives a constant field, which induces nothing" },
                                { t: "DC is too weak", why: "Strength is not the issue \u2014 a constant field induces nothing however strong." },
                                { t: "DC damages the coil", why: "It may overheat it, but that is not why it fails to transform." }], correct: 0,
                      steps: ["A transformer relies on a changing field in the primary inducing a voltage in the secondary.",
                              "AC reverses constantly, so the field is always changing.",
                              "DC is steady, so after the initial switch-on nothing changes and nothing is induced.",
                              "That single fact is why the grid distributes AC rather than DC."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What does a transformer need in order to work?",
                "Is a DC field changing?"] });
    }
  },
  {
    id: "lenses", name: "Lenses and images", subject: "Physics", strand: "Waves",
    needs: ["reflection"],
    teach: "A converging lens bends parallel light to a focus. Where the image forms, and whether it is upright or inverted, depends entirely on how far the object is compared with the focal length.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What does a converging lens do to parallel light?",
                        options: [{ t: "Brings it to a focus" },
                                  { t: "Spreads it out", why: "That is a diverging lens." },
                                  { t: "Reflects it", why: "A lens refracts; a mirror reflects." }], correct: 0,
                        steps: ["The lens refracts each ray toward the axis.",
                                "They meet at the focal point, a focal length away."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["The name is the clue.", "Converging means coming together."] });
      }
      if (d === 2) {
        const f = ri(r, 5, 20);
        const far = r() < 0.5;
        const u = far ? f * ri(r, 3, 6) : Math.max(1, Math.round(f / 2));
        return q({ ask: "A lens has focal length " + f + " cm and an object sits " + u +
            " cm away. Is the image inverted?  1 for yes, 0 for no.",
          expect: (far ? 1 : 0) + "",
          steps: [step("Compare the object distance with the focal length."),
                  step(far ? u + " cm is beyond the focal length of " + f + " cm."
                           : u + " cm is INSIDE the focal length of " + f + " cm."),
                  step(far ? "A real, inverted image forms on the far side."
                           : "A virtual, upright, magnified image is seen \u2014 this is a magnifying glass."),
                  step("The same lens does both; only the distance changed.")],
          hints: ["Is the object inside or outside the focal length?",
                  "A magnifying glass works with the object close in."] });
      }
      const f = ri(r, 5, 20), u = f * ri(r, 2, 5);
      const v = 1 / (1 / f - 1 / u);
      return q({ ask: "Focal length " + f + " cm, object " + u +
          " cm away. Where does the image form, in cm from the lens, to 3 significant figures?",
        expect: sigText(v, 3) + " cm", sigFigs: 3, tol: 0.01,
        steps: [step("1/f = 1/u + 1/v, so 1/v = 1/f \u2212 1/u."),
                step("1/" + f + " \u2212 1/" + u + " = " + sig(1 / f - 1 / u, 6) + "."),
                step("v = " + sigText(v, 3) + " cm."),
                step("Taking the reciprocal at the END is the step people forget \u2014 1/v is not the answer.")],
        hints: ["Use the lens equation and rearrange for 1/v.",
                "Remember to invert at the end."] });
    }
  }
];

const BATCH17 = [
  {
    id: "thermo-laws", name: "Heat always spreads", subject: "Physics", strand: "Energy",
    needs: ["heat", "efficiency"],
    teach: "Energy is conserved, but it also spreads out. Heat flows from hot to cold on its own and never the other way without work being done \u2014 which is why no engine can be perfectly efficient and why a fridge needs a plug.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A hot drink is left in a cool room. Which way does heat flow?",
                        options: [{ t: "From the drink to the room" },
                                  { t: "From the room to the drink", why: "That would make the drink hotter, which does not happen on its own." },
                                  { t: "Neither way", why: "The drink cools, so energy is clearly moving." }], correct: 0,
                        steps: ["Heat always flows from hotter to colder without help.",
                                "The drink cools and the room warms imperceptibly."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which is hotter?", "Heat moves one way on its own."] });
      }
      if (d === 2) {
        const sets = [{ ask: "A fridge makes its inside colder than the room. Does that break the rule?",
                        options: [{ t: "No \u2014 it uses energy to move the heat" },
                                  { t: "Yes, fridges are an exception", why: "Nothing is an exception; the pump does work." },
                                  { t: "No, because the room is cold too", why: "The room is warmer than the fridge interior." }], correct: 0,
                        steps: ["Heat will not move from cold to hot on its own.",
                                "The compressor does work to force it, which is what the electricity pays for.",
                                "The back of the fridge is warm because that heat had to go somewhere."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What is the plug for?",
                  "Why is the back of a fridge warm?"] });
      }
      const sets = [{ ask: "Why can no heat engine be 100% efficient, even a perfect one?",
                      options: [{ t: "Some heat must be dumped to a colder place" },
                                { t: "Friction always exists", why: "Friction makes real engines worse, but even a frictionless one cannot reach 100%." },
                                { t: "Energy is destroyed", why: "Energy is never destroyed \u2014 that is not the reason." }], correct: 0,
                      steps: ["An engine works by letting heat flow from hot to cold and taking some on the way.",
                              "If nothing were dumped at the cold end, there would be no flow and no work.",
                              "So a fraction must always be given up, regardless of how well the engine is built.",
                              "It is a limit of the universe rather than of engineering, which is why it cannot be designed around."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What does an engine need in order to have a flow at all?",
                "Is this a limit of engineering or of physics?"] });
    }
  },
  {
    id: "resistivity", name: "What decides resistance", subject: "Physics", strand: "Electricity",
    needs: ["ohm"],
    teach: "A wire's resistance depends on the material, its length and its thickness. Twice as long is twice the resistance; twice the cross-sectional area is half. That is why thin extension leads get warm.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A wire is made twice as long. What happens to its resistance?",
                        options: [{ t: "It doubles" },
                                  { t: "It halves", why: "That is what happens if you make it thicker, not longer." },
                                  { t: "No change", why: "Length matters directly." }], correct: 0,
                        steps: ["Electrons meet twice as many obstacles along the way.",
                                "Resistance is proportional to length."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Longer means further to travel.", "Resistance rises with length."] });
      }
      if (d === 2) {
        const R = ri(r, 2, 20), f = pick(r, [2, 3, 4]);
        return q({ ask: "A wire has resistance " + R + " ohm. Its cross-sectional area is multiplied by " + f +
            ". What is the new resistance, in ohm, to 3 significant figures?",
          expect: sigText(R / f, 3) + " ohm", sigFigs: 3, tol: 0.01,
          steps: [step("Resistance is inversely proportional to area \u2014 a wider road carries traffic more easily."),
                  step(R + " \u00F7 " + f + " = " + sigText(R / f, 3) + " ohm."),
                  step("Length and area pull in opposite directions, which is the thing to keep straight.")],
          hints: ["Wider means less resistance.",
                  "Divide rather than multiply."] });
      }
      const L = pick(r, [2, 3, 4]), A = pick(r, [2, 3, 4]);
      const factor = L / A;
      return q({ ask: "A wire is made " + L + " times longer and " + A +
          " times wider in area. By what factor does its resistance change?  Give it to 4 decimal places.",
        expect: sigText(factor, 6), tol: 0.001,
        steps: [step("Length multiplies resistance by " + L + "."),
                step("Area divides it by " + A + "."),
                step("Together: " + L + " \u00F7 " + A + " = " + sig(factor, 6) + "."),
                step(factor > 1 ? "Overall it rises." : factor < 1 ? "Overall it falls \u2014 the widening won." : "They cancel exactly.")],
        hints: ["Handle length and area separately, then combine.",
                "One multiplies and the other divides."] });
    }
  },
  {
    id: "group-chemistry", name: "Group 1 and Group 7", subject: "Chemistry", strand: "Structure",
    needs: ["periodic", "electron-config"],
    teach: "Group 1 metals get MORE reactive down the group because the outer electron is further from the nucleus and easier to lose. Group 7 gets LESS reactive down, because gaining an electron at a distance is harder. Same cause, opposite trends.",
    gen: function (r, d) {
      const g1 = ["lithium", "sodium", "potassium", "rubidium", "caesium"];
      const g7 = ["fluorine", "chlorine", "bromine", "iodine"];
      if (d === 1) {
        const i = ri(r, 0, 2), j = i + ri(r, 1, 2);
        return q({ ask: "Which is more reactive, " + g1[i] + " or " + g1[j] + "?",
          options: [{ t: g1[j] }, { t: g1[i], why: "It is higher in the group, so its outer electron is held more tightly." },
                    { t: "The same", why: "Reactivity changes steadily down the group." }], correct: 0,
          steps: [step("Group 1 reactivity INCREASES down the group."),
                  step(g1[j] + " is lower, so its outer electron is further out and easier to lose.")],
          hints: ["Which is further down the group?",
                  "Group 1 loses an electron to react."] });
      }
      if (d === 2) {
        const i = ri(r, 0, 1), j = i + ri(r, 1, 2);
        return q({ ask: "Which is more reactive, " + g7[i] + " or " + g7[j] + "?",
          options: [{ t: g7[i] }, { t: g7[j], why: "Group 7 reactivity DECREASES down the group \u2014 the opposite of Group 1." },
                    { t: "The same", why: "It changes steadily, just in the other direction." }], correct: 0,
          steps: [step("Group 7 reactivity DECREASES down the group."),
                  step("These elements react by GAINING an electron, and a distant outer shell attracts one less strongly."),
                  step("So " + g7[i] + ", being higher, is more reactive.")],
          hints: ["Group 7 gains rather than loses.",
                  "The trend runs the opposite way to Group 1."] });
      }
      const sets = [{ ask: "Why do Group 1 and Group 7 trends run in opposite directions?",
                      options: [{ t: "One loses an electron and the other gains one" },
                                { t: "They are on opposite sides of the table", why: "Position is where the difference shows, not why it exists." },
                                { t: "Group 7 are gases", why: "Bromine is a liquid and iodine a solid, and it is not the reason." }], correct: 0,
                      steps: ["Going down either group, the outer shell gets further from the nucleus.",
                              "For Group 1 that makes losing an electron EASIER, so reactivity rises.",
                              "For Group 7 it makes gaining one HARDER, so reactivity falls.",
                              "One cause, two opposite effects \u2014 which only makes sense once you ask what each group is trying to do."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What does each group do with electrons?",
                "The distance changes the same way for both."] });
    }
  }
];

const BATCH18 = [
  {
    id: "friction", name: "Friction and drag", subject: "Physics", strand: "Forces",
    needs: ["balanced-forces"],
    teach: "Friction opposes motion between surfaces and drag opposes motion through a fluid. Drag grows with speed, which is why a falling object stops accelerating once drag has grown to match its weight.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Which way does friction act on a box being pushed right?",
                        options: [{ t: "To the left" },
                                  { t: "To the right", why: "It opposes motion, so it cannot act along it." },
                                  { t: "Downwards", why: "That is weight, not friction." }], correct: 0,
                        steps: ["Friction always opposes the direction of motion.",
                                "Pushing right means friction acts left."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Which way is the box moving?", "Friction resists it."] });
      }
      if (d === 2) {
        const push = ri(r, 20, 90), fric = ri(r, 5, 19);
        return q({ ask: "A box is pushed with " + push + " N against " + fric +
            " N of friction. What is the resultant force, in N?",
          expect: (push - fric) + " N",
          steps: [step("The two forces oppose, so subtract."),
                  step(push + " \u2212 " + fric + " = " + (push - fric) + " N in the direction of the push."),
                  step("It is unbalanced, so the box accelerates.")],
          hints: ["They act in opposite directions.",
                  "Take friction off the push."] });
      }
      const sets = [{ ask: "A skydiver reaches terminal velocity. Why do they stop accelerating?",
                      options: [{ t: "Drag has grown until it equals their weight" },
                                { t: "Gravity switched off", why: "Weight is unchanged throughout the fall." },
                                { t: "They ran out of speed", why: "They are still falling fast \u2014 just no longer speeding up." }], correct: 0,
                      steps: ["Drag increases as speed increases.",
                              "Eventually drag grows to match the weight exactly.",
                              "The forces balance, so the acceleration is zero and the speed stays constant.",
                              "Constant speed does not mean no forces \u2014 it means they cancel."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What happens to drag as you speed up?",
                "What must be true for acceleration to be zero?"] });
    }
  },
  {
    id: "specific-latent", name: "Latent heat", subject: "Physics", strand: "Energy",
    needs: ["heat", "states"],
    teach: "Changing state takes energy without changing temperature at all. That energy breaks the bonds holding particles together, which is why boiling water stays at 100 degC however hard you heat it.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Ice at 0 degC is heated and starts to melt. What happens to its temperature while melting?",
                        options: [{ t: "It stays at 0 degC" },
                                  { t: "It rises steadily", why: "It only rises once all the ice has melted." },
                                  { t: "It falls", why: "Energy is going in, not out." }], correct: 0,
                        steps: ["All the energy goes into breaking bonds rather than raising temperature.",
                                "The temperature only climbs once the change of state is complete."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Where is the energy going?",
                  "Does the thermometer move during melting?"] });
      }
      if (d === 2) {
        /* The constant has to match the change of state being described.
           Picking freely from both gave "ice is melted, latent heat of fusion
           is 2260000 J/kg" in 26 of 60 questions \u2014 that is water's
           VAPORISATION figure, nearly seven times too large. The arithmetic
           was right and the physics was wrong, which no check would catch. */
        const boiling = r() < 0.5;
        const m = ri(r, 1, 20) / 10;
        const L = boiling ? 2260000 : 334000;
        const E = m * L;
        return q({ ask: m + " kg of " + (boiling ? "water is boiled" : "ice is melted") +
            ". Latent heat of " + (boiling ? "vaporisation" : "fusion") + " is " + L +
            " J/kg. How much energy is needed, in J?  Give it to 3 significant figures.",
          expect: sigText(E, 3) + " J", sigFigs: 3, tol: 0.01,
          steps: [step("Energy = mass \u00D7 specific latent heat."),
                  step(m + " \u00D7 " + L + " = " + sigText(E, 3) + " J."),
                  step("There is no temperature term \u2014 nothing gets hotter during the change.")],
          hints: ["Multiply mass by the latent heat.",
                  "No \u0394T appears in this one."] });
      }
      const sets = [{ ask: "Why does steam at 100 degC scald far worse than water at 100 degC?",
                      options: [{ t: "It releases its latent heat as it condenses on you" },
                                { t: "Steam is hotter", why: "Both are at exactly 100 degC." },
                                { t: "Steam moves faster", why: "Speed is not what causes the burn." }], correct: 0,
                      steps: ["Both are at the same temperature, so temperature cannot be the difference.",
                              "Condensing steam gives up its latent heat of vaporisation into your skin.",
                              "For water that is 2,260,000 J per kilogram \u2014 far more than cooling from 100 degC delivers.",
                              "It is the change of state, not the temperature, that does the damage."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Both are at the same temperature.",
                "What does steam do when it touches you?"] });
    }
  },
  {
    id: "rates-collision", name: "Collision theory", subject: "Chemistry", strand: "Reactions",
    needs: ["rates"],
    teach: "A reaction happens only when particles collide hard enough and in the right orientation. Every way of speeding a reaction up works by making collisions more frequent or more energetic \u2014 there is only one mechanism underneath.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What must happen for two particles to react?",
                        options: [{ t: "They must collide with enough energy" },
                                  { t: "They must be near each other", why: "Being near is not enough \u2014 they have to actually collide, hard." },
                                  { t: "They must be heated to boiling", why: "Plenty of reactions run at room temperature." }], correct: 0,
                        steps: ["A collision is necessary but not sufficient.",
                                "It also needs enough energy to break the existing bonds \u2014 the activation energy."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Is being close enough?",
                  "What else does the collision need?"] });
      }
      if (d === 2) {
        const sets = [{ ask: "Why does powdering a solid speed up its reaction?",
                        options: [{ t: "More surface is exposed for collisions" },
                                  { t: "The powder is hotter", why: "Grinding it does not meaningfully heat it." },
                                  { t: "There is more of it", why: "The mass is unchanged \u2014 only the surface area rose." }], correct: 0,
                        steps: ["Only the surface can be collided with.",
                                "Breaking it up exposes far more surface for the same mass.",
                                "More collision sites means more collisions per second."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Where do the collisions happen?",
                  "Did the amount of substance change?"] });
      }
      const sets = [{ ask: "A catalyst speeds a reaction up. What does it actually change?",
                      options: [{ t: "It lowers the activation energy needed" },
                                { t: "It makes particles move faster", why: "That is what heating does, and a catalyst does not warm anything." },
                                { t: "It adds more reactant", why: "A catalyst is not consumed and does not add anything." }], correct: 0,
                      steps: ["A catalyst offers a different route with a lower energy barrier.",
                              "More of the existing collisions now have enough energy to succeed.",
                              "The particles are not moving any faster \u2014 the bar was lowered.",
                              "That is also why the catalyst comes out unchanged: it was never a reactant."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Does a catalyst change the particles or the barrier?",
                "Why is it not used up?"] });
    }
  }
];

const BATCH19 = [
  {
    id: "doppler", name: "The Doppler effect", subject: "Physics", strand: "Waves",
    needs: ["waves", "wave-props"],
    teach: "When a source moves towards you the waves arrive bunched up, so the frequency rises. Moving away stretches them and the frequency falls. The source never changes what it emits \u2014 only the motion between you changes.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "An ambulance drives towards you. How does its siren sound?",
                        options: [{ t: "Higher pitched than normal" },
                                  { t: "Lower pitched", why: "That happens as it drives away." },
                                  { t: "Unchanged", why: "The motion changes what reaches you." }], correct: 0,
                        steps: ["Each wave is emitted slightly closer than the last, so they arrive bunched.",
                                "More waves per second means a higher pitch."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Are the waves squashed or stretched?",
                  "More per second means higher."] });
      }
      if (d === 2) {
        const sets = [{ ask: "Does the driver of the ambulance hear the pitch change?",
                        options: [{ t: "No \u2014 there is no motion between them" },
                                  { t: "Yes, the same as everyone else", why: "The effect depends on relative motion, and the driver has none." },
                                  { t: "Yes, but lower", why: "Nothing shifts for the driver at all." }], correct: 0,
                        steps: ["The effect depends on motion BETWEEN source and listener.",
                                "The driver moves with the siren, so there is no relative motion and no shift.",
                                "It is the relative motion, not the speed, that matters."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Is the driver moving relative to the siren?",
                  "The effect needs relative motion."] });
      }
      const sets = [{ ask: "Light from distant galaxies is shifted towards red. What does that tell us?",
                      options: [{ t: "They are moving away from us" },
                                { t: "They are made of red stars", why: "The whole spectrum is shifted, not just the colour of the stars." },
                                { t: "They are hotter", why: "Hotter would shift towards blue, not red." }], correct: 0,
                      steps: ["Red is the long-wavelength, low-frequency end.",
                              "Stretched waves mean the source is receding \u2014 the same effect as the ambulance driving away.",
                              "Almost every distant galaxy is red-shifted, and the further away, the more.",
                              "That single observation is the evidence the universe is expanding."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Is red a longer or shorter wavelength?",
                "Stretched waves mean what kind of motion?"] });
    }
  },
  {
    id: "series-circuits", name: "Series and parallel compared", subject: "Physics",
    strand: "Electricity", needs: ["circuits-basic", "parallel"],
    teach: "In series the current is the same everywhere and the voltages add up. In parallel the voltage is the same across each branch and the currents add. Getting those two the right way round settles most circuit questions.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Two identical bulbs in SERIES. What is true of the current?",
                        options: [{ t: "It is the same through both" },
                                  { t: "It splits between them", why: "That happens in parallel, where there are branches." },
                                  { t: "It doubles", why: "Adding a bulb in series reduces the current, not increases it." }], correct: 0,
                        steps: ["There is only one path, so every electron passes through both.",
                                "Same current everywhere is the defining feature of series."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["How many paths are there?",
                  "Can the current go anywhere else?"] });
      }
      if (d === 2) {
        const V = ri(r, 2, 12), n = ri(r, 2, 4);
        return q({ ask: n + " identical resistors in series share a " + (V * n) +
            " V supply. What is the voltage across ONE of them, in V?",
          expect: V + " V",
          steps: [step("In series the voltages across the components add to the supply."),
                  step("They are identical, so they share it equally."),
                  step((V * n) + " \u00F7 " + n + " = " + V + " V each.")],
          hints: ["The voltages add up to the supply.",
                  "Identical components share equally."] });
      }
      const R = ri(r, 2, 12);
      return q({ ask: "Two " + R + " ohm resistors are connected in PARALLEL. What is the total resistance, in ohm, to 3 significant figures?",
        expect: sigText(R / 2, 3) + " ohm", sigFigs: 3, tol: 0.01,
        steps: [step("Adding a parallel branch gives the current another route, so total resistance FALLS."),
                step("For two equal resistors the total is half of one: " + R + " \u00F7 2."),
                step("= " + sigText(R / 2, 3) + " ohm."),
                step("It is lower than either resistor alone, which is the opposite of series and the thing that surprises people.")],
        hints: ["Does parallel raise or lower the total?",
                "Two equal resistors give half."] });
    }
  },
  {
    id: "purity", name: "Pure substances and mixtures", subject: "Chemistry", strand: "Matter",
    needs: ["states", "separating"],
    teach: "A pure substance melts and boils at one exact temperature. A mixture melts over a range and boils lower or higher than expected \u2014 which is how purity is tested without any equipment beyond a thermometer.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What does 'pure' mean in chemistry?",
                        options: [{ t: "A single substance with nothing else in it" },
                                  { t: "Natural and unprocessed", why: "That is the everyday meaning \u2014 spring water is natural and not chemically pure." },
                                  { t: "Safe to drink", why: "Pure carbon monoxide is chemically pure and lethal." }], correct: 0,
                        steps: ["Chemically, pure means one substance only.",
                                "The everyday sense of pure \u2014 natural, wholesome \u2014 is a different word entirely."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Is spring water chemically pure?",
                  "The everyday meaning is not the chemical one."] });
      }
      if (d === 2) {
        const sets = [{ ask: "A sample melts gradually between 52 and 58 degC. What does that show?",
                        options: [{ t: "It is a mixture" },
                                  { t: "It is pure", why: "A pure substance melts at one sharp temperature." },
                                  { t: "The thermometer is broken", why: "A range is exactly what an impure sample gives." }], correct: 0,
                        steps: ["A pure substance has one sharp melting point.",
                                "A range means more than one substance is present.",
                                "The wider the range, the less pure it is."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What does a pure substance do at its melting point?",
                  "A range means what?"] });
      }
      const sets = [{ ask: "Why does salt on an icy road melt the ice?",
                      options: [{ t: "The mixture has a lower melting point than pure water" },
                                { t: "Salt is warm", why: "It is the same temperature as everything else outside." },
                                { t: "Salt reacts with ice", why: "There is no reaction \u2014 it dissolves." }], correct: 0,
                      steps: ["Ice melts at 0 degC only when it is pure.",
                              "Dissolving salt makes a mixture, which melts at a lower temperature.",
                              "So at -5 degC the salty mixture is liquid where pure water would be solid.",
                              "The same principle is why antifreeze works and why a melting range indicates impurity."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What does adding something do to a melting point?",
                "Is the salt reacting or dissolving?"] });
    }
  }
];

const BATCH20 = [
  {
    id: "stars", name: "The life of a star", subject: "Physics", strand: "Radioactivity",
    needs: ["nuclear"],
    teach: "A star shines by fusing hydrogen into helium, held together by gravity pulling in and radiation pushing out. It stays stable while those balance, and everything that happens at the end follows from that balance failing.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "What is the Sun's energy source?",
                        options: [{ t: "Fusing hydrogen into helium" },
                                  { t: "Burning like a fire", why: "Burning is a chemical reaction and could not last billions of years." },
                                  { t: "Splitting heavy atoms", why: "That is fission, which powers reactors rather than stars." }], correct: 0,
                        steps: ["Hydrogen nuclei fuse into helium in the core.",
                                "The tiny mass difference becomes an enormous amount of energy."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Joining or splitting?", "Chemistry could not last that long."] });
      }
      if (d === 2) {
        const sets = [{ ask: "What stops a star collapsing under its own gravity?",
                        options: [{ t: "Radiation pressure pushing outwards" },
                                  { t: "It is spinning", why: "Rotation helps a little but is not what holds it up." },
                                  { t: "It is too hot to collapse", why: "Heat is the cause of the outward pressure, not a force by itself." }], correct: 0,
                        steps: ["Gravity pulls every part inward constantly.",
                                "Energy from fusion pushes outward with equal force.",
                                "A stable star is that balance, and it lasts as long as the fuel does."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["What pushes back against gravity?",
                  "Where does that push come from?"] });
      }
      const sets = [{ ask: "Why does a star collapse when it runs out of hydrogen?",
                      options: [{ t: "Fusion stops, so nothing pushes back against gravity" },
                                { t: "Gravity gets stronger", why: "Its mass has barely changed \u2014 what changed is the outward push." },
                                { t: "It cools and shrinks slowly", why: "The collapse is sudden, not a gradual cooling." }], correct: 0,
                      steps: ["The star was a balance between gravity in and radiation out.",
                              "When the fuel runs out the outward half of that balance disappears.",
                              "Gravity is unchanged \u2014 it simply has nothing opposing it any more.",
                              "Everything that follows, from red giants to supernovae, is that one balance failing."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Which side of the balance changed?",
                "Did gravity change, or did the other force?"] });
    }
  },
  {
    id: "transformers", name: "Transformers", subject: "Physics", strand: "Electricity",
    needs: ["induction"],
    teach: "A transformer changes voltage using two coils on one iron core. The ratio of turns sets the ratio of voltages, and since power is roughly conserved, raising voltage lowers current in the same proportion.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "A transformer has more turns on the secondary than the primary. What does it do?",
                        options: [{ t: "Raises the voltage" },
                                  { t: "Lowers the voltage", why: "That needs fewer turns on the secondary." },
                                  { t: "Nothing", why: "The turns ratio always sets the voltage ratio." }], correct: 0,
                        steps: ["The voltage ratio matches the turns ratio.",
                                "More turns on the secondary means a higher voltage out."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["More turns on which side?",
                  "Turns ratio equals voltage ratio."] });
      }
      if (d === 2) {
        const np = ri(r, 10, 60) * 10, k = ri(r, 2, 6);
        const ns = np * k, vp = ri(r, 6, 24);
        return q({ ask: "A transformer has " + np + " primary turns and " + ns + " secondary turns, with " + vp +
            " V in. What is the output voltage, in V?",
          expect: (vp * k) + " V",
          steps: [step("Vs/Vp = Ns/Np, so Vs = Vp \u00D7 Ns/Np."),
                  step(ns + " \u00F7 " + np + " = " + k + "."),
                  step(vp + " \u00D7 " + k + " = " + (vp * k) + " V.")],
          hints: ["Find the turns ratio first.",
                  "Then multiply the input voltage by it."] });
      }
      const sets = [{ ask: "Why is electricity sent across the country at very high voltage?",
                      options: [{ t: "High voltage means low current, and low current wastes less as heat" },
                                { t: "High voltage travels faster", why: "The speed is essentially the same either way." },
                                { t: "It is cheaper to generate", why: "It is generated at a moderate voltage and stepped up afterwards." }], correct: 0,
                      steps: ["Power lost in a cable is I\u00B2R \u2014 it depends on the CURRENT squared.",
                              "For a given power, raising the voltage lowers the current in proportion.",
                              "Halving the current quarters the loss, so very high voltage wastes far less.",
                              "It is stepped back down near homes, because high voltage is lethal."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["What does power loss in a cable depend on?",
                "The current is squared in that formula."] });
    }
  },
  {
    id: "extraction", name: "Extracting metals", subject: "Chemistry", strand: "Reactions",
    needs: ["reactivity", "electrolysis"],
    teach: "How a metal is extracted depends on where it sits in the reactivity series. Below carbon it can be reduced by heating with carbon; above carbon it needs electrolysis, which is why aluminium was once more valuable than gold.",
    gen: function (r, d) {
      if (d === 1) {
        const sets = [{ ask: "Why is gold found as the pure metal but iron is not?",
                        options: [{ t: "Gold is too unreactive to form compounds" },
                                  { t: "Gold is heavier", why: "Density has nothing to do with reacting." },
                                  { t: "Iron was all mined already", why: "Iron ore is abundant \u2014 it is just never pure metal." }], correct: 0,
                        steps: ["Reactive metals combine with oxygen and stay combined.",
                                "Gold sits at the bottom of the series and reacts with almost nothing."] }];
        const c = pick(r, sets);
        return q({ ask: c.ask, options: c.options, correct: c.correct,
          steps: c.steps.map(function (x) { return step(x); }),
          hints: ["Where is gold in the reactivity series?",
                  "Reactive metals do not stay pure."] });
      }
      if (d === 2) {
        const belowCarbon = r() < 0.5;
        const metal = belowCarbon ? "iron" : "aluminium";
        return q({ ask: metal.charAt(0).toUpperCase() + metal.slice(1) +
            " is extracted from its ore. Can carbon be used to reduce it?  1 for yes, 0 for no.",
          expect: (belowCarbon ? 1 : 0) + "",
          steps: [step("Compare the metal with CARBON in the reactivity series."),
                  step(belowCarbon ? "Iron is below carbon, so carbon can take the oxygen away from it."
                                   : "Aluminium is ABOVE carbon, so carbon cannot displace it."),
                  step(belowCarbon ? "So yes \u2014 that is what a blast furnace does."
                                   : "So no \u2014 electrolysis is needed instead, which is why it costs so much more."),
                  step("Carbon's position in the series is what decides the whole industrial method.")],
          hints: ["Is the metal above or below carbon?",
                  "Carbon can only displace what is below it."] });
      }
      const sets = [{ ask: "Why was aluminium once more valuable than gold, despite being far more abundant?",
                      options: [{ t: "There was no practical way to extract it" },
                                { t: "It was rarer then", why: "It is the most abundant metal in the crust and always has been." },
                                { t: "It was stronger", why: "Value came from difficulty of extraction, not strength." }], correct: 0,
                      steps: ["Aluminium is above carbon, so smelting cannot free it.",
                              "Until cheap electricity made electrolysis practical in the 1880s, it was almost impossible to obtain.",
                              "Napoleon III reserved aluminium cutlery for his most honoured guests.",
                              "Abundance and availability are different things, and the reactivity series is why."] }];
      const c = pick(r, sets);
      return q({ ask: c.ask, options: c.options, correct: c.correct,
        steps: c.steps.map(function (x) { return step(x); }),
        hints: ["Is aluminium rare, or just hard to extract?",
                "What did it need that did not exist yet?"] });
    }
  }
];

const BATCH21 = [
  {
    id: "terminal-velocity", name: "Terminal velocity", subject: "Physics", strand: "Motion",
    needs: ["friction", "accel"],
    teach: "A falling object speeds up until drag grows to match its weight. From then on the forces balance and the speed stays constant \u2014 that speed is the terminal velocity, and it depends on shape and area as much as on mass.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A skydiver has just jumped. What is happening to their speed?",
          options: [{ t: "Increasing" }, { t: "Constant", why: "That comes later, once drag has grown to match weight." },
                    { t: "Decreasing", why: "Nothing is slowing them yet." }], correct: 0,
          steps: [step("At the start, drag is small because the speed is small."),
                  step("Weight exceeds drag, so there is a resultant force downwards and they accelerate.")],
          hints: ["How big is drag at low speed?", "Which force is winning?"] });
      }
      if (d === 2) {
        const w = ri(r, 5, 9) * 100;
        return q({ ask: "A skydiver of weight " + w + " N reaches terminal velocity. What is the drag force, in N?",
          expect: w + " N",
          steps: [step("At terminal velocity the speed is constant, so the resultant force is zero."),
                  step("Drag must therefore exactly equal the weight."),
                  step("So drag is " + w + " N.")],
          hints: ["What is the resultant force at constant speed?",
                  "The two forces must cancel."] });
      }
      return q({ ask: "A parachute opens. What happens to the terminal velocity?",
        options: [{ t: "It falls to a lower value" },
                  { t: "It rises", why: "More drag means a lower balance point, not a higher one." },
                  { t: "It is unchanged", why: "Terminal velocity depends on area, which just changed enormously." }], correct: 0,
        steps: [step("The parachute vastly increases the area, so drag at any given speed is much larger."),
                step("Drag now matches the weight at a much LOWER speed."),
                step("The skydiver decelerates until they reach that new, slower terminal velocity."),
                step("Weight never changed \u2014 only how much drag a given speed produces.")],
        hints: ["What did the parachute change \u2014 weight or drag?",
                "At what speed do the forces balance now?"] });
    }
  },
  {
    id: "energy-resources", name: "Energy resources", subject: "Physics", strand: "Energy",
    needs: ["efficiency"],
    teach: "Renewables are replaced as fast as they are used; fossil fuels are not. The trade-offs are reliability against emissions \u2014 a gas station runs on demand, while solar and wind depend on conditions.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Which of these is NOT renewable?",
          options: [{ t: "Natural gas" }, { t: "Wind", why: "Wind keeps blowing whatever we use." },
                    { t: "Tidal", why: "Tides are driven by the Moon and do not run out." }], correct: 0,
          steps: [step("Renewable means replaced as fast as it is used."),
                  step("Gas took millions of years to form and is not being replaced.")],
          hints: ["Which one took millions of years to form?",
                  "Renewable means it keeps coming."] });
      }
      if (d === 2) {
        return q({ ask: "Why is a gas power station still used alongside wind farms?",
          options: [{ t: "It can generate on demand when the wind drops" },
                    { t: "It is cleaner", why: "It produces far more carbon dioxide." },
                    { t: "It is renewable", why: "It is not." }], correct: 0,
          steps: [step("Wind output depends on the weather and cannot be increased on demand."),
                  step("Gas can be turned up within minutes, which is what keeps supply matching demand."),
                  step("Reliability, not cleanliness, is what it is providing.")],
          hints: ["What can gas do that wind cannot?",
                  "Think about a still day."] });
      }
      return q({ ask: "A nuclear station produces no carbon dioxide while running. Why is it still controversial?",
        options: [{ t: "The waste stays dangerous for thousands of years" },
                  { t: "It emits more CO2 than coal", why: "It emits essentially none while generating." },
                  { t: "It cannot run at night", why: "That is solar; nuclear runs continuously." }], correct: 0,
        steps: [step("The generation itself is very low carbon and highly reliable."),
                step("The spent fuel remains hazardous for millennia and must be stored securely."),
                step("Decommissioning is also extremely expensive."),
                step("The argument is about long-term risk and cost, not about emissions.")],
        hints: ["What is left over afterwards?",
                "The objection is not about carbon."] });
    }
  },
  {
    id: "static", name: "Static electricity", subject: "Physics", strand: "Electricity", needs: [],
    teach: "Rubbing two materials transfers electrons from one to the other. The one that gains them becomes negative and the one that loses them positive \u2014 protons never move, because they are locked in the nucleus.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A rod is rubbed with a cloth and becomes negatively charged. What moved?",
          options: [{ t: "Electrons, onto the rod" },
                    { t: "Protons, onto the rod", why: "Protons are bound in nuclei and never transfer by rubbing." },
                    { t: "Neutrons", why: "Neutrons have no charge, so moving them would change nothing." }], correct: 0,
          steps: [step("Only electrons are free to move between materials."),
                  step("Gaining electrons makes something negative; losing them makes it positive.")],
          hints: ["Which particle is on the outside of an atom?",
                  "Protons stay put."] });
      }
      if (d === 2) {
        return q({ ask: "The rod gained electrons. What happened to the cloth?",
          options: [{ t: "It became positively charged" },
                    { t: "It also became negative", why: "The electrons came FROM the cloth." },
                    { t: "It stayed neutral", why: "Losing electrons leaves an imbalance." }], correct: 0,
          steps: [step("Charge is not created, only moved."),
                  step("Whatever the rod gained, the cloth lost."),
                  step("Losing negative charge leaves the cloth positive by exactly the same amount.")],
          hints: ["Where did the electrons come from?",
                  "The two charges must be equal and opposite."] });
      }
      return q({ ask: "Why does a charged balloon stick to a neutral wall?",
        options: [{ t: "It pushes the wall's electrons away, leaving the near surface oppositely charged" },
                  { t: "The wall is charged too", why: "The wall is neutral overall \u2014 that is the point." },
                  { t: "Static makes things sticky", why: "There is no stickiness; it is an electrostatic force." }], correct: 0,
        steps: [step("A negative balloon repels electrons in the wall's surface."),
                step("The surface nearest the balloon is left slightly positive, even though the wall is neutral overall."),
                step("Opposite charges attract, so the balloon is held on."),
                step("This is induced charge \u2014 nothing was transferred, only rearranged.")],
        hints: ["What does a negative charge do to nearby electrons?",
                "The wall stays neutral overall."] });
    }
  },
  {
    id: "alloys", name: "Alloys", subject: "Chemistry", strand: "Structure", needs: ["bonding"],
    teach: "A pure metal has neat layers of identical atoms that slide over each other easily. Adding a different-sized atom disrupts those layers, which is why an alloy is harder than either metal alone.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What is an alloy?",
          options: [{ t: "A mixture of a metal with another element" },
                    { t: "A very pure metal", why: "Alloys are deliberately impure." },
                    { t: "A metal compound", why: "The atoms are mixed, not chemically bonded into a compound." }], correct: 0,
          steps: [step("An alloy is a mixture, not a compound."),
                  step("Steel is iron with carbon; brass is copper with zinc.")],
          hints: ["Is it pure or mixed?",
                  "Think of steel and brass."] });
      }
      if (d === 2) {
        return q({ ask: "Why is an alloy harder than the pure metal?",
          options: [{ t: "Different-sized atoms stop the layers sliding" },
                    { t: "The atoms bond more strongly", why: "The bonding is essentially the same metallic bonding." },
                    { t: "It is denser", why: "Alloys are often less dense, and density is not what resists deformation." }], correct: 0,
          steps: [step("A pure metal has regular layers that slide easily, which is why it is soft."),
                  step("An atom of a different size disrupts the regularity."),
                  step("The layers can no longer slide past each other, so the metal resists being deformed.")],
          hints: ["What makes a pure metal soft?",
                  "What does an odd-sized atom do to neat layers?"] });
      }
      return q({ ask: "Pure gold is too soft for jewellery, so it is alloyed with copper. What does 18-carat mean?",
        options: [{ t: "18 parts in 24 are gold" },
                  { t: "It contains 18% gold", why: "Carat is measured in twenty-fourths, not per cent." },
                  { t: "It was heated 18 times", why: "Carat describes composition, not processing." }], correct: 0,
        steps: [step("Carat measures gold content in twenty-fourths."),
                step("24-carat is pure gold and too soft to hold a shape."),
                step("18-carat is 18/24, or 75% gold, with the rest usually copper."),
                step("The alloy keeps the colour and gains the hardness."),],
        hints: ["Carat is a fraction \u2014 out of what?",
                "24-carat is pure."] });
    }
  }
];

const BATCH22 = [
  {
    id: "moments-machines", name: "Levers and gears", subject: "Physics", strand: "Forces",
    needs: ["moments"],
    teach: "A lever trades distance for force. Push a long way with a small force and the load moves a short way with a large one \u2014 the moments balance, so nothing is gained for free.",
    gen: function (r, d) {
      if (d === 1) {
        const F = ri(r, 2, 12) * 10, dl = ri(r, 2, 6), ds = 1;
        return q({ ask: "A lever has effort " + dl + " m from the pivot and load 1 m from it. An effort of " + F +
            " N is applied. What load can it lift, in N?",
          expect: (F * dl) + " N",
          steps: [step("Moments balance: effort \u00D7 its distance = load \u00D7 its distance."),
                  step(F + " \u00D7 " + dl + " = load \u00D7 1."),
                  step("Load = " + (F * dl) + " N.")],
          hints: ["Set the two moments equal.", "Force times distance each side."] });
      }
      if (d === 2) {
        const n1 = ri(r, 2, 5) * 10, n2 = n1 * ri(r, 2, 4);
        return q({ ask: "A gear with " + n1 + " teeth drives one with " + n2 +
            " teeth. Is the output slower or faster?  1 for faster, 0 for slower.",
          expect: "0",
          steps: [step("The teeth must mesh, so both gears move the same number of teeth per second."),
                  step("The bigger gear needs more teeth for one turn, so it turns fewer times."),
                  step("Output is slower \u2014 and the torque is correspondingly larger.")],
          hints: ["Which gear has to turn further for one revolution?",
                  "More teeth means fewer turns."] });
      }
      return q({ ask: "A lever lets you lift four times the force you apply. What is the catch?",
        options: [{ t: "You must move four times as far" },
                  { t: "There is no catch", why: "Energy is conserved \u2014 nothing multiplies force for free." },
                  { t: "It only works downhill", why: "Orientation has nothing to do with it." }], correct: 0,
        steps: [step("Energy in must equal energy out, and energy is force \u00D7 distance."),
                step("If the force is four times larger, the distance must be four times smaller."),
                step("So your end of the lever travels four times as far as the load does."),
                step("A machine multiplies force, never energy \u2014 that is the whole trade.")],
        hints: ["What is conserved here?",
                "Force times distance is energy."] });
    }
  },
  {
    id: "ultrasound", name: "Ultrasound and echoes", subject: "Physics", strand: "Waves",
    needs: ["sound", "waves"],
    teach: "Ultrasound is sound above human hearing. It reflects at a boundary between materials, and timing the echo gives the distance \u2014 which is how a scan builds a picture without any radiation at all.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What makes a sound 'ultrasound'?",
          options: [{ t: "Its frequency is above 20,000 Hz" },
                    { t: "It is very loud", why: "Loudness is amplitude, not frequency." },
                    { t: "It travels faster", why: "All sound travels at the same speed in a given material." }], correct: 0,
          steps: [step("Human hearing tops out around 20,000 Hz."),
                  step("Anything above that is ultrasound \u2014 ordinary sound we simply cannot hear.")],
          hints: ["What is the upper limit of human hearing?",
                  "It is about frequency, not volume."] });
      }
      if (d === 2) {
        const t = ri(r, 2, 20) / 100, v = 1500;
        return q({ ask: "An ultrasound pulse returns after " + t +
            " s in tissue where sound travels at 1500 m/s. How deep is the boundary, in m?",
          expect: sig(v * t / 2, 4) + " m", tol: 0.01,
          steps: [step("The pulse travels there AND back, so it covers twice the depth."),
                  step("Total distance = 1500 \u00D7 " + t + " = " + sig(v * t, 4) + " m."),
                  step("Depth is half of that: " + sig(v * t / 2, 4) + " m."),
                  step("Forgetting the return journey doubles the answer.")],
          hints: ["How far did the pulse actually travel?",
                  "It made the trip twice."] });
      }
      return q({ ask: "Why is ultrasound preferred to X-rays for scanning a foetus?",
        options: [{ t: "It is not ionising, so it does not damage cells" },
                  { t: "It gives a sharper picture", why: "X-ray images are generally sharper; safety is the reason." },
                  { t: "It is cheaper", why: "Cost is not the medical argument." }], correct: 0,
        steps: [step("X-rays are ionising and can damage DNA, which matters most in dividing cells."),
                step("Ultrasound is a mechanical wave carrying far too little energy to ionise anything."),
                step("The image is less sharp, and that is an acceptable trade for safety."),
                step("It is a choice between picture quality and risk, not a case of one being better throughout.")],
        hints: ["What does ionising mean for living tissue?",
                "Which risk matters most for a developing foetus?"] });
    }
  },
  {
    id: "haber", name: "The Haber process", subject: "Chemistry", strand: "Reactions",
    needs: ["equilibrium", "reversible"],
    teach: "Ammonia is made from nitrogen and hydrogen in a reversible reaction. The conditions used are a compromise: what gives the best yield is not what gives the best rate, so industry picks a middle course.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What two gases make ammonia in the Haber process?",
          options: [{ t: "Nitrogen and hydrogen" },
                    { t: "Nitrogen and oxygen", why: "That makes oxides of nitrogen, not ammonia." },
                    { t: "Carbon dioxide and hydrogen", why: "No carbon appears in NH3." }], correct: 0,
          steps: [step("Ammonia is NH3 \u2014 nitrogen and hydrogen only."),
                  step("The nitrogen comes from the air and the hydrogen usually from natural gas.")],
          hints: ["Read the formula NH3.",
                  "What elements does it contain?"] });
      }
      if (d === 2) {
        return q({ ask: "The forward reaction is exothermic. What would a LOWER temperature do to the yield?",
          options: [{ t: "Increase it" },
                    { t: "Decrease it", why: "Cooling favours the exothermic direction, which is the one making ammonia." },
                    { t: "Nothing", why: "Temperature shifts the position of any reversible reaction." }], correct: 0,
          steps: [step("The system opposes the change: removing heat favours the direction that RELEASES heat."),
                  step("That is the forward reaction, so more ammonia forms."),
                  step("Yield improves \u2014 but the reaction also becomes far too slow to be useful.")],
          hints: ["Which direction gives out heat?",
                  "Cooling favours that direction."] });
      }
      return q({ ask: "So why is 450 degC used rather than a lower temperature?",
        options: [{ t: "A lower temperature gives a better yield but far too slowly" },
                  { t: "Higher temperature gives a better yield", why: "It gives a WORSE yield \u2014 that is the compromise." },
                  { t: "The catalyst needs it", why: "The catalyst helps, but the reason is rate against yield." }], correct: 0,
        steps: [step("Cooling raises the yield and cripples the rate."),
                step("Heating raises the rate and lowers the yield."),
                step("450 degC is chosen because a moderate yield obtained quickly beats a high yield obtained never."),
                step("It is an economic compromise, not the answer to either question alone.")],
        hints: ["What does cooling do to the rate?",
                "Neither extreme is best \u2014 why?"] });
    }
  },
  {
    id: "water-treatment", name: "Making water safe", subject: "Chemistry", strand: "Solutions",
    needs: ["separating", "purity"],
    teach: "Drinking water is not chemically pure \u2014 it is water with the harmful things removed. Filtering takes out solids, sterilising kills microbes, and dissolved salts are usually left in.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Is tap water chemically pure?",
          options: [{ t: "No \u2014 it contains dissolved salts" },
                    { t: "Yes", why: "It would boil at exactly 100 degC if it were, and it does not." },
                    { t: "Only if filtered", why: "Filtering removes solids, not dissolved substances." }], correct: 0,
          steps: [step("Chemically pure means one substance only."),
                  step("Tap water contains dissolved minerals, which is why it does not boil at exactly 100 degC."),
                  step("It is safe, which is a different thing from pure.")],
          hints: ["Does it contain anything besides water?",
                  "Safe and pure are different words here."] });
      }
      if (d === 2) {
        return q({ ask: "Which step removes bacteria?",
          options: [{ t: "Sterilising with chlorine or UV" },
                    { t: "Filtering through sand", why: "Sand catches solids; bacteria pass straight through." },
                    { t: "Settling in a tank", why: "Settling removes heavy particles only." }], correct: 0,
          steps: [step("Bacteria are far too small to be caught by a sand filter."),
                  step("They must be killed rather than removed, by chlorine, ozone or ultraviolet light.")],
          hints: ["Are bacteria bigger or smaller than sand grains?",
                  "Can you filter something you cannot catch?"] });
      }
      return q({ ask: "Desalination gives pure water but is rarely used where rivers exist. Why?",
        options: [{ t: "It takes a great deal of energy" },
                  { t: "It does not work", why: "It works well \u2014 it is simply expensive." },
                  { t: "The water is unsafe", why: "It is exceptionally pure." }], correct: 0,
        steps: [step("Distillation means boiling every litre, and water has a very high latent heat."),
                step("Reverse osmosis needs high pressure, which also costs energy."),
                step("Where fresh water exists, treating it is far cheaper than separating salt from seawater."),
                step("The chemistry is easy; the energy bill is what decides it.")],
        hints: ["What does boiling water require?",
                "The obstacle is cost, not chemistry."] });
    }
  }
];

const BATCH23 = [
  {
    id: "orbits", name: "Orbits and satellites", subject: "Physics", strand: "Motion",
    needs: ["gravity", "circular"],
    teach: "A satellite is falling continuously and moving sideways fast enough to keep missing the Earth. Gravity supplies the centripetal force, so a lower orbit needs a higher speed.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What force keeps a satellite in orbit?",
          options: [{ t: "Gravity" }, { t: "Its engines", why: "Most satellites have no engine running at all." },
                    { t: "Centrifugal force", why: "There is no outward force \u2014 that is the sensation, not a cause." }], correct: 0,
          steps: [step("Gravity pulls the satellite toward the Earth constantly."),
                  step("That inward pull is exactly the centripetal force a circular path needs.")],
          hints: ["What pulls it toward the Earth?",
                  "A circle needs an inward force."] });
      }
      if (d === 2) {
        return q({ ask: "A satellite moves to a LOWER orbit. What happens to its speed?",
          options: [{ t: "It must go faster" },
                    { t: "It goes slower", why: "Lower orbits are faster \u2014 the ISS laps the Earth every 90 minutes." },
                    { t: "It is unchanged", why: "Orbital speed depends on radius." }], correct: 0,
          steps: [step("Gravity is stronger closer in, so more centripetal force is available."),
                  step("Matching that stronger pull requires a higher speed."),
                  step("The Space Station orbits in 90 minutes; the Moon takes a month.")],
          hints: ["Where is gravity stronger?",
                  "Compare the ISS with the Moon."] });
      }
      return q({ ask: "A geostationary satellite stays above the same point on the equator. What does that require?",
        options: [{ t: "An orbital period of exactly 24 hours" },
                  { t: "No motion at all", why: "It is moving at about 3 km/s \u2014 it simply keeps pace with the ground." },
                  { t: "A very low orbit", why: "It sits far out, at about 36,000 km." }], correct: 0,
        steps: [step("To stay above one point, it must go round exactly as fast as the Earth turns."),
                step("That means a period of 24 hours, which fixes the radius at about 36,000 km."),
                step("There is only one such orbit, which is why that altitude is crowded."),
                step("It is not stationary at all \u2014 it is matched to the ground beneath it.")],
        hints: ["How long does the Earth take to turn once?",
                "The satellite must match that."] });
    }
  },
  {
    id: "half-equations", name: "Half equations", subject: "Chemistry", strand: "Reactions",
    needs: ["electrolysis-products", "bonding"],
    teach: "A half equation shows what happens at one electrode: electrons on the left means gaining them (reduction), electrons on the right means losing them (oxidation). Written separately, the two halves make the electron transfer visible.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Na+ + e- \u2192 Na.  Is this oxidation or reduction?",
          options: [{ t: "Reduction" }, { t: "Oxidation", why: "Oxidation is LOSING electrons; this gains one." },
                    { t: "Neither", why: "Electrons transferred means one or the other." }], correct: 0,
          steps: [step("The electron is on the LEFT, so it is being gained."),
                  step("Gaining electrons is reduction \u2014 the charge is reduced.")],
          hints: ["Which side is the electron on?",
                  "Gain is reduction."] });
      }
      if (d === 2) {
        const n = pick(r, [1, 2, 3]);
        const ion = n === 1 ? "Na+" : n === 2 ? "Mg2+" : "Al3+";
        const metal = n === 1 ? "Na" : n === 2 ? "Mg" : "Al";
        return q({ ask: "How many electrons does " + ion + " need to become " + metal + "?",
          expect: n + "",
          steps: [step("The charge must go from +" + n + " to 0."),
                  step("Each electron cancels one positive charge."),
                  step("So it needs " + n + " electron" + (n === 1 ? "" : "s") + ".")],
          hints: ["What is the charge on the ion?",
                  "One electron cancels one plus."] });
      }
      return q({ ask: "In electrolysis, why must the electrons lost at one electrode equal those gained at the other?",
        options: [{ t: "Electrons are not created or destroyed \u2014 they travel round the circuit" },
                  { t: "It is a convention", why: "It is a physical requirement, not a bookkeeping choice." },
                  { t: "They do not have to match", why: "They must, or charge would build up without limit." }], correct: 0,
        steps: [step("Every electron released at the positive electrode travels through the wire."),
                step("It has to arrive somewhere \u2014 at the negative electrode."),
                step("So the two half equations must be scaled until the electrons balance."),
                step("That balancing is what turns two halves into one whole equation.")],
        hints: ["Where do the electrons go?",
                "Nothing is created or destroyed."] });
    }
  },
  {
    id: "efficiency-transfer", name: "Reducing waste energy", subject: "Physics", strand: "Energy",
    needs: ["efficiency", "energy-transfer"],
    teach: "Wasted energy is nearly always heat, and it escapes by conduction, convection or radiation. Each route has its own remedy, which is why insulation and reflective surfaces do different jobs.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Most wasted energy ends up as what?",
          options: [{ t: "Heat" }, { t: "Light", why: "Only in a few devices, and even then heat dominates." },
                    { t: "Sound", why: "Sound carries very little energy by comparison." }], correct: 0,
          steps: [step("Friction, resistance and air drag all produce heat."),
                  step("That is why almost anything working gets warm.")],
          hints: ["What does a working machine feel like?",
                  "Friction produces what?"] });
      }
      if (d === 2) {
        return q({ ask: "Why does loft insulation reduce heat loss?",
          options: [{ t: "Trapped air is a poor conductor" },
                    { t: "It reflects the heat back", why: "That is foil, working by radiation instead." },
                    { t: "It is warm itself", why: "It is at room temperature like everything else." }], correct: 0,
          steps: [step("The fibres themselves matter less than the air trapped between them."),
                  step("Still air conducts very poorly, and trapping it also stops convection currents."),
                  step("Two routes for heat are closed by one material.")],
          hints: ["What is between the fibres?",
                  "Is still air a good conductor?"] });
      }
      return q({ ask: "A vacuum flask has silvered walls and a vacuum gap. What does each part stop?",
        options: [{ t: "The vacuum stops conduction and convection; the silvering stops radiation" },
                  { t: "Both stop conduction", why: "The silvering does nothing for conduction \u2014 the vacuum already handles it." },
                  { t: "The silvering is decorative", why: "It is doing the one job the vacuum cannot." }], correct: 0,
        steps: [step("Conduction and convection both need particles, and a vacuum has none."),
                step("Radiation crosses a vacuum perfectly well, so the vacuum alone is not enough."),
                step("A silvered surface reflects radiation back instead of absorbing or emitting it."),
                step("Three routes for heat, and two features between them close all three.")],
        hints: ["Which routes need particles?",
                "Which one crosses empty space?"] });
    }
  },
  {
    id: "chromatography-rf", name: "Identifying with Rf", subject: "Chemistry", strand: "Matter",
    needs: ["chromatography"],
    teach: "An Rf value is a ratio, so it does not depend on how far the solvent ran or how big the paper was. That is what makes it comparable against a reference table \u2014 provided the same solvent was used.",
    gen: function (r, d) {
      if (d === 1) {
        const spot = ri(r, 10, 50) / 10, front = spot + ri(r, 10, 40) / 10;
        return q({ ask: "A spot travels " + spot + " cm; the solvent front travels " + front +
            " cm. What is the Rf, to 3 significant figures?",
          expect: sigText(spot / front, 3), sigFigs: 3, tol: 0.01,
          steps: [step("Rf = spot distance \u00F7 solvent distance."),
                  step(spot + " \u00F7 " + front + " = " + sigText(spot / front, 3) + "."),
                  step("It has no units, being a ratio of two lengths.")],
          hints: ["Divide the spot distance by the solvent distance.",
                  "The answer is always under 1."] });
      }
      if (d === 2) {
        return q({ ask: "The same substance is run on a longer strip of paper. What happens to its Rf?",
          options: [{ t: "It stays the same" },
                    { t: "It increases", why: "Both distances grow together, so the ratio is unchanged." },
                    { t: "It decreases", why: "The ratio does not depend on the size of the paper." }], correct: 0,
          steps: [step("A longer run means the spot travels further AND the solvent travels further."),
                  step("Both numbers scale together, so the ratio is unchanged."),
                  step("That is exactly why Rf is used rather than the raw distance.")],
          hints: ["What happens to both distances?",
                  "A ratio of two things that both grow."] });
      }
      return q({ ask: "Two labs get different Rf values for the same substance. What is the most likely reason?",
        options: [{ t: "They used different solvents" },
                  { t: "One made an arithmetic error", why: "Possible, but a different solvent is the standard cause." },
                  { t: "Rf is unreliable", why: "It is reliable when the solvent matches, which is why it is always quoted." }], correct: 0,
        steps: [step("Rf depends on the competition between sticking to the paper and dissolving in the solvent."),
                step("Change the solvent and that balance changes, so the substance travels a different fraction."),
                step("An Rf value only means anything alongside the solvent used."),
                step("That is why reference tables always state the solvent, and why comparing across them fails.")],
        hints: ["What does Rf actually depend on?",
                "What must be stated alongside it?"] });
    }
  }
];

const BATCH24 = [
  {
    id: "pressure-depth", name: "Pressure in fluids", subject: "Physics", strand: "Forces",
    needs: ["pressure", "density"],
    teach: "Pressure in a liquid is depth \u00D7 density \u00D7 g. It depends on how deep you are, not on how much liquid there is \u2014 a narrow tube and a wide lake read the same at the same depth.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Where is the water pressure greatest in a tank?",
          options: [{ t: "At the bottom" }, { t: "At the top", why: "There is almost nothing above the surface to press down." },
                    { t: "The same throughout", why: "Depth changes the weight of water above you." }], correct: 0,
          steps: [step("Pressure comes from the weight of liquid above."),
                  step("The deeper you go, the more there is above you.")],
          hints: ["What is pressing down on you?",
                  "Where is there most liquid above?"] });
      }
      if (d === 2) {
        const h = ri(r, 2, 20), rho = 1000, g = 10;
        return q({ ask: "How much pressure does " + h +
            " m of water exert at the bottom, in Pa? (density 1000 kg/m^3, g = 10 N/kg)",
          expect: (h * rho * g) + " Pa",
          steps: [step("Pressure = depth \u00D7 density \u00D7 g."),
                  step(h + " \u00D7 1000 \u00D7 10 = " + (h * rho * g) + " Pa."),
                  step("No area or volume appears \u2014 only the depth.")],
          hints: ["Multiply the three quantities.",
                  "The width of the tank is irrelevant."] });
      }
      return q({ ask: "A dam is thicker at the base than the top. Why?",
        options: [{ t: "Pressure increases with depth, so the base takes far more force" },
                  { t: "For stability against wind", why: "Water pressure, not wind, sets the shape." },
                  { t: "To hold more water", why: "The thickness of the wall does not change the volume held." }], correct: 0,
        steps: [step("Pressure at the base is much greater than near the surface."),
                step("Force is pressure \u00D7 area, so the deepest part of the wall is pushed hardest."),
                step("The wall is built thickest exactly where the pressure is largest."),
                step("The shape of a dam is a picture of how pressure varies with depth.")],
        hints: ["Where is the pressure highest?",
                "Where does the wall need to be strongest?"] });
    }
  },
  {
    id: "specific-heat-compare", name: "Comparing heat capacities", subject: "Physics",
    strand: "Energy", needs: ["heat"],
    teach: "Specific heat capacity is how much energy one kilogram needs to warm by one degree. Water's is unusually high, which is why the sea warms slowly and why it works so well in radiators.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Water has a much higher specific heat capacity than sand. On a sunny day, which warms faster?",
          options: [{ t: "The sand" }, { t: "The water", why: "It needs far more energy per degree, so it lags behind." },
                    { t: "Both the same", why: "The capacities differ by a factor of about five." }], correct: 0,
          steps: [step("A high capacity means more energy is needed per degree."),
                  step("Sand needs less, so the same sunshine raises its temperature further."),
                  step("It is why the beach burns your feet while the sea stays cold.")],
          hints: ["Which one needs more energy per degree?",
                  "Think of a beach in summer."] });
      }
      if (d === 2) {
        const m = ri(r, 1, 10), c = 4200, dT = ri(r, 5, 40);
        return q({ ask: m + " kg of water is warmed by " + dT +
            " degC. How much energy is needed, in J? (c = 4200 J/kg degC)",
          expect: (m * c * dT) + " J",
          steps: [step("Energy = mass \u00D7 specific heat capacity \u00D7 temperature change."),
                  step(m + " \u00D7 4200 \u00D7 " + dT + " = " + (m * c * dT) + " J."),
                  step("All three factors matter \u2014 halving any one halves the energy.")],
          hints: ["Multiply the three together.",
                  "mc\u0394T."] });
      }
      return q({ ask: "Why is water used in central heating rather than oil, which heats up faster?",
        options: [{ t: "Water carries more energy per kilogram for the same temperature drop" },
                  { t: "Water is cheaper", why: "It is, but the physics reason is the heat it can carry." },
                  { t: "Oil would boil", why: "Oil boils at a much higher temperature than water." }], correct: 0,
        steps: [step("A radiator works by carrying energy from the boiler and releasing it in the room."),
                step("A high specific heat capacity means each kilogram carries more energy for a given temperature drop."),
                step("The same property that makes water slow to heat makes it excellent at transporting heat."),
                step("Heating up fast is the wrong goal \u2014 carrying a lot is the point.")],
        hints: ["What is the water actually for in a radiator?",
                "Is heating quickly what you want?"] });
    }
  },
  {
    id: "titration-calc", name: "Titration calculations", subject: "Chemistry", strand: "Solutions",
    needs: ["titration", "acids-bases"],
    teach: "Work from the solution you know completely: moles = concentration \u00D7 volume in dm\u00B3. The equation's ratio converts to the other substance, and dividing by its volume gives the unknown concentration.",
    gen: function (r, d) {
      if (d === 1) {
        const c = ri(r, 1, 5) / 10, v = ri(r, 10, 50);
        return q({ ask: "How many moles are in " + v + " cm\u00B3 of " + c +
            " mol/dm\u00B3 solution?  Give it to 4 decimal places.",
          expect: sigText(c * v / 1000, 6), tol: 0.0001,
          steps: [step("Convert the volume to dm\u00B3 first: " + v + " \u00F7 1000 = " + (v / 1000) + " dm\u00B3."),
                  step("Moles = concentration \u00D7 volume = " + c + " \u00D7 " + (v / 1000) + "."),
                  step("= " + sig(c * v / 1000, 6) + " mol."),
                  step("Forgetting the 1000 is the error that costs marks here.")],
          hints: ["Burette readings are in cm\u00B3 and concentration is per dm\u00B3.",
                  "Divide by 1000 first."] });
      }
      if (d === 2) {
        const ca = ri(r, 1, 5) / 10, va = ri(r, 10, 40), vb = ri(r, 10, 40);
        const cb = ca * va / vb;
        return q({ ask: va + " cm\u00B3 of " + ca + " mol/dm\u00B3 acid neutralises " + vb +
            " cm\u00B3 of alkali in a 1:1 ratio. What is the alkali's concentration, in mol/dm\u00B3, to 3 significant figures?",
          expect: sigText(cb, 3) + " mol/dm^3", sigFigs: 3, tol: 0.01,
          steps: [step("Moles of acid = " + ca + " \u00D7 " + (va / 1000) + " = " + sig(ca * va / 1000, 4) + " mol."),
                  step("The ratio is 1:1, so the same number of moles of alkali reacted."),
                  step("Concentration = moles \u00F7 volume = " + sig(ca * va / 1000, 4) + " \u00F7 " + (vb / 1000) + "."),
                  step("= " + sigText(cb, 3) + " mol/dm^3.")],
          hints: ["Start with the solution you know completely.",
                  "Then divide by the other volume in dm\u00B3."] });
      }
      return q({ ask: "Sulfuric acid needs only half as much alkali as hydrochloric for the same concentration. Why?",
        options: [{ t: "Each molecule releases two hydrogen ions" },
                  { t: "It is a stronger acid", why: "Strength is about how fully it ionises, not how many H+ per molecule." },
                  { t: "It is more concentrated", why: "The concentrations were stated as equal." }], correct: 0,
        steps: [step("H2SO4 has two hydrogens to give away; HCl has one."),
                step("So one mole of sulfuric acid neutralises two moles of a single-hydroxide alkali."),
                step("The ratio in the equation is 1:2, not 1:1."),
                step("Assuming 1:1 is right often enough to feel safe, and wrong exactly here.")],
        hints: ["Count the hydrogens in H2SO4.",
                "What does the balanced equation say?"] });
    }
  },
  {
    id: "reaction-profiles", name: "Reaction profiles", subject: "Chemistry", strand: "Reactions",
    needs: ["energy-changes", "rates-collision"],
    teach: "A reaction profile plots energy against progress. The hump is the activation energy needed to start, and the difference between the two ends is the overall energy change \u2014 two separate quantities on one diagram.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "On a reaction profile, what does the height of the hump represent?",
          options: [{ t: "The activation energy" },
                    { t: "The overall energy change", why: "That is the difference between the two ENDS, not the peak." },
                    { t: "The temperature", why: "The axis is energy, not temperature." }], correct: 0,
          steps: [step("The hump is the barrier that must be crossed for any reaction to occur."),
                  step("Its height is the activation energy \u2014 how much a collision must supply.")],
          hints: ["What has to be overcome for a reaction to start?",
                  "The peak, not the ends."] });
      }
      if (d === 2) {
        const exo = r() < 0.5;
        return q({ ask: "The products sit " + (exo ? "LOWER" : "HIGHER") +
            " than the reactants. Is the reaction exothermic?  1 for yes, 0 for no.",
          expect: (exo ? 1 : 0) + "",
          steps: [step("The vertical difference between the ends is the overall energy change."),
                  step(exo ? "Products lower means energy was released to the surroundings."
                           : "Products higher means energy was absorbed from the surroundings."),
                  step(exo ? "So it is exothermic." : "So it is endothermic."),
                  step("The hump says nothing about this \u2014 only the two ends do.")],
          hints: ["Compare the two ends, not the peak.",
                  "Lower products means energy came out."] });
      }
      return q({ ask: "A catalyst is added. What changes on the profile?",
        options: [{ t: "The hump gets lower; the ends stay put" },
                  { t: "The products drop lower", why: "A catalyst cannot change the overall energy change." },
                  { t: "Nothing changes", why: "The barrier is exactly what a catalyst lowers." }], correct: 0,
        steps: [step("A catalyst offers a different route with a smaller barrier."),
                step("So the hump is lower and more collisions have enough energy to succeed."),
                step("The reactants and products are unchanged, so the overall energy change is identical."),
                step("A catalyst changes how fast you get there, never where you end up.")],
        hints: ["Which part of the diagram does a catalyst affect?",
                "Does it change the products?"] });
    }
  }
];

const BATCH25 = [
  {
    id: "seismic", name: "Seismic waves", subject: "Physics", strand: "Waves",
    needs: ["waves", "sound"],
    teach: "P waves are longitudinal and travel through solids and liquids; S waves are transverse and cannot cross a liquid. That single difference is how we know the outer core is molten without ever going there.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Which seismic wave arrives first after an earthquake?",
          options: [{ t: "The P wave" }, { t: "The S wave", why: "S is for secondary \u2014 it arrives later." },
                    { t: "They arrive together", why: "The gap between them is what locates the epicentre." }], correct: 0,
          steps: [step("P stands for primary: it travels fastest and arrives first."),
                  step("S stands for secondary and lags behind."),
                  step("The gap between them tells you how far away the earthquake was.")],
          hints: ["What do P and S stand for?",
                  "Primary means first."] });
      }
      if (d === 2) {
        return q({ ask: "S waves cannot pass through liquid. What does that tell us about the outer core?",
          options: [{ t: "It is liquid, because S waves do not cross it" },
                    { t: "It is solid", why: "S waves would pass through a solid, and they do not." },
                    { t: "Nothing", why: "It is the main evidence we have for the core's state." }], correct: 0,
          steps: [step("S waves are transverse, and a liquid cannot support a sideways shear."),
                  step("There is a shadow zone on the far side of the Earth where no S waves arrive."),
                  step("The only explanation is a liquid layer blocking them."),
                  step("We know the core is molten without ever having been near it.")],
          hints: ["Can a liquid be sheared sideways?",
                  "What does a shadow zone imply?"] });
      }
      return q({ ask: "Why does a longitudinal wave pass through liquid when a transverse one cannot?",
        options: [{ t: "Longitudinal squeezes along the direction of travel, which a liquid resists" },
                  { t: "Longitudinal waves are faster", why: "Speed is a consequence, not the reason." },
                  { t: "Liquids block all transverse motion equally", why: "True, and the question is WHY \u2014 liquids resist compression but not shear." }], correct: 0,
        steps: [step("A longitudinal wave compresses the material along its path, and liquids resist compression strongly."),
                step("A transverse wave shears the material sideways, and a liquid simply flows instead."),
                step("With nothing to restore the sideways displacement, the wave cannot propagate."),
                step("The same reason explains why sound travels through water and a rope wave does not.")],
        hints: ["Which motion does a liquid resist \u2014 squeezing or shearing?",
                "What does a liquid do when pushed sideways?"] });
    }
  },
  {
    id: "circuit-faults", name: "Finding a fault", subject: "Physics", strand: "Electricity",
    needs: ["series-circuits", "ohm"],
    teach: "A break gives zero current and full supply voltage across the gap. A short gives a large current and almost no voltage across the shorted part. Reading both together locates the fault without dismantling anything.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A series circuit reads zero current. What is the most likely cause?",
          options: [{ t: "A break somewhere in the loop" },
                    { t: "A short circuit", why: "A short gives a very LARGE current, not zero." },
                    { t: "The battery is too strong", why: "More voltage would give more current, not none." }], correct: 0,
          steps: [step("Series has one path, so a break anywhere stops the current everywhere."),
                  step("Zero current is the signature of an open circuit.")],
          hints: ["How many paths does a series circuit have?",
                  "What stops current completely?"] });
      }
      if (d === 2) {
        return q({ ask: "A voltmeter across one lamp in a series circuit reads the FULL supply voltage. What does that mean?",
          options: [{ t: "That lamp has broken \u2014 the gap is across it" },
                    { t: "That lamp is working perfectly normally", why: "A working lamp shares the voltage with the others." },
                    { t: "The battery has gone flat", why: "A flat battery would read low everywhere." }], correct: 0,
          steps: [step("In a working series circuit the components share the supply voltage."),
                  step("If one reads the full supply, the others must read nothing."),
                  step("That happens when the break IS that component \u2014 all the voltage appears across the gap."),
                  step("It is the fastest way to find which lamp failed.")],
          hints: ["How is voltage shared when everything works?",
                  "Where does the voltage appear if there is a gap?"] });
      }
      return q({ ask: "Why does a short circuit across a battery make the wires hot?",
        options: [{ t: "Very low resistance means a very large current, and heating goes as I\u00B2R" },
                  { t: "The battery heats up before the wires do", why: "It does too, but the wires heat because of the current through them." },
                  { t: "A short circuit increases the supply voltage", why: "The supply voltage is unchanged." }], correct: 0,
        steps: [step("A short offers a path with almost no resistance."),
                step("By I = V/R, a tiny resistance gives an enormous current."),
                step("Heating in a wire is I\u00B2R, so doubling the current quadruples the heat."),
                step("That squared term is why a short is a fire risk rather than a mild inconvenience.")],
        hints: ["What does low resistance do to the current?",
                "The current is squared in the heating formula."] });
    }
  },
  {
    id: "yield-atom-economy", name: "Atom economy", subject: "Chemistry", strand: "Amount",
    needs: ["percent-yield", "formula-mass"],
    teach: "Percentage yield asks how much of what was possible you actually got. Atom economy asks a different question: what fraction of the starting mass ends up in the product you wanted, rather than in by-products.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A reaction has 100% yield but 40% atom economy. What does that mean?",
          options: [{ t: "Nothing was lost in handling, but most of the mass became by-products" },
                    { t: "The reaction did not work properly", why: "A 100% yield means it went perfectly as written." },
                    { t: "The figures contradict each other", why: "They measure different things and can differ freely." }], correct: 0,
          steps: [step("Yield compares what you got with what the equation predicted."),
                  step("Atom economy compares the wanted product's mass with the total mass of reactants."),
                  step("A reaction can go perfectly and still send most of its atoms into something you did not want.")],
          hints: ["Do the two figures measure the same thing?",
                  "Where did the other 60% of the mass go?"] });
      }
      if (d === 2) {
        const want = ri(r, 20, 90), total = want + ri(r, 10, 80);
        return q({ ask: "The desired product has mass " + want + " and the total mass of reactants is " + total +
            ". What is the atom economy, as a percentage to 3 significant figures?",
          /* "%" is not a unit the checker knows, so "87.8%" came back as
             unreadable and the question rejected its own answer. Every other
             percentage skill in the app states a bare number and names the
             unit in the question, so this follows that. */
          expect: sigText(want / total * 100, 3), sigFigs: 3, tol: 0.01,
          steps: [step("Atom economy = mass of the wanted product \u00F7 total mass of reactants \u00D7 100."),
                  step(want + " \u00F7 " + total + " = " + sig(want / total, 4) + "."),
                  step("\u00D7 100 = " + sigText(want / total * 100, 3) + "%.")],
          hints: ["Wanted over total.",
                  "Then multiply by 100."] });
      }
      return q({ ask: "Why do chemists care about atom economy as well as yield?",
        options: [{ t: "Low atom economy means waste and cost even when the reaction works perfectly" },
                  { t: "Atom economy makes the reaction faster", why: "It has nothing to do with rate." },
                  { t: "It is required by environmental law", why: "It is an economic and environmental measure, not a rule." }], correct: 0,
        steps: [step("A reaction with a perfect yield can still turn most of its raw material into by-product."),
                step("That by-product has to be separated, disposed of or sold, all of which cost."),
                step("Choosing a route with high atom economy reduces waste at source rather than cleaning it up after."),
                step("Yield measures how well you ran the reaction; atom economy measures whether it was the right reaction.")],
        hints: ["What happens to the by-products?",
                "Which figure judges the choice of reaction itself?"] });
    }
  },
  {
    id: "carbon-cycle", name: "Carbon and the atmosphere", subject: "Chemistry", strand: "Reactions",
    needs: ["energy-changes"],
    teach: "Burning a fuel returns carbon to the air that photosynthesis once removed. The problem with fossil fuels is timing: they lock carbon away for millions of years and release it in decades.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What is produced when a hydrocarbon burns completely?",
          options: [{ t: "Carbon dioxide and water" },
                    { t: "Carbon monoxide and water", why: "That is INCOMPLETE combustion, with too little oxygen." },
                    { t: "Only carbon dioxide", why: "The hydrogen must go somewhere too." }], correct: 0,
          steps: [step("A hydrocarbon contains carbon and hydrogen."),
                  step("With plenty of oxygen the carbon becomes CO2 and the hydrogen becomes H2O.")],
          hints: ["What elements are in a hydrocarbon?",
                  "Both must end up somewhere."] });
      }
      if (d === 2) {
        return q({ ask: "Why is incomplete combustion dangerous indoors?",
          options: [{ t: "It produces carbon monoxide, which is toxic and has no smell" },
                    { t: "It produces more heat", why: "It produces less \u2014 the fuel is not fully burned." },
                    { t: "It uses up all the carbon dioxide", why: "CO2 is not what you are breathing for." }], correct: 0,
          steps: [step("Too little oxygen leaves carbon partly oxidised, giving CO rather than CO2."),
                  step("Carbon monoxide binds to haemoglobin far more strongly than oxygen does."),
                  step("It is colourless and odourless, so there is no warning \u2014 which is why detectors exist.")],
          hints: ["What forms when there is not enough oxygen?",
                  "Why would you not notice it?"] });
      }
      return q({ ask: "Burning wood and burning coal both release CO2. Why is coal treated differently?",
        options: [{ t: "Coal releases carbon locked away for millions of years; wood releases carbon absorbed recently" },
                  { t: "Coal releases more per kilogram", why: "It does, but the timing is the substantive difference." },
                  { t: "Wood does not release CO2", why: "It does \u2014 it was absorbed from the air decades ago." }], correct: 0,
        steps: [step("A tree took its carbon from the air within the last few decades, and a replacement tree takes it back."),
                step("Coal took its carbon from the air hundreds of millions of years ago."),
                step("Burning it adds carbon to a cycle that had long since balanced without it."),
                step("The chemistry is identical; the timescale is what makes one additive and the other roughly neutral.")],
        hints: ["Where did each fuel's carbon come from, and when?",
                "Can it be taken back on a human timescale?"] });
    }
  }
];

const BATCH26 = [
  {
    id: "stopping-distance", name: "Stopping distance", subject: "Physics", strand: "Motion",
    needs: ["accel", "friction"],
    teach: "Stopping distance is thinking distance plus braking distance. Thinking distance grows in proportion to speed; braking distance grows with the SQUARE of it, which is why a small speed increase matters so much.",
    gen: function (r, d) {
      if (d === 1) {
        /* The reaction time was printed as "0." + t with t up to 15, giving
           "0.15", while the answer used t/10 = 1.5 \u2014 ten times too large.
           A driver at 10 m/s was said to travel 13 m before touching the
           brakes. Build the decimal once and use that same number in both. */
        /* A human reaction time is 0.2-0.9 s, not 0.05 s. The numbers should
           be ones a learner could sanity-check against the figure they are
           taught, which is typically 0.5 s. */
        const t = ri(r, 2, 9) / 10, sp = ri(r, 10, 30);
        return q({ ask: "A driver travels at " + sp + " m/s with a reaction time of " + t +
            " s. What is the thinking distance, in m?",
          expect: sig(sp * t, 4) + " m", tol: 0.01,
          steps: [step("During the reaction time the car carries on at full speed."),
                  step(sp + " \u00D7 " + t + " = " + sig(sp * t, 4) + " m."),
                  step("No braking has happened yet \u2014 this is distance covered while deciding.")],
          hints: ["Speed times reaction time.",
                  "The brakes are not on yet."] });
      }
      if (d === 2) {
        return q({ ask: "Speed doubles. What happens to the BRAKING distance?",
          options: [{ t: "It quadruples" }, { t: "It doubles", why: "Thinking distance doubles; braking distance goes as the square." },
                    { t: "It is unchanged", why: "Braking distance depends strongly on speed." }], correct: 0,
          steps: [step("Braking must remove the kinetic energy, which is \u00BDmv\u00B2."),
                  step("Doubling v quadruples v\u00B2, so four times the energy must be removed."),
                  step("At the same braking force, that takes four times the distance.")],
          hints: ["What does braking have to get rid of?",
                  "Kinetic energy goes as v squared."] });
      }
      return q({ ask: "Why do wet roads increase stopping distance but not thinking distance?",
        options: [{ t: "Water reduces friction, which affects braking only" },
                  { t: "Rain slows the driver\u0027s reactions down", why: "Reaction time is about the driver, not the road." },
                  { t: "Both parts of the distance increase equally", why: "Thinking distance depends on speed and reaction time alone." }], correct: 0,
        steps: [step("Thinking distance is speed \u00D7 reaction time \u2014 the road surface plays no part."),
                step("Braking distance depends on the friction available between tyre and road."),
                step("Water reduces that friction, so more distance is needed to remove the same energy."),
                step("The two parts of stopping distance depend on completely different things.")],
        hints: ["Which part involves the road at all?",
                "Reaction time is a property of the driver."] });
    }
  },
  {
    id: "wave-behaviour", name: "Reflection, refraction, diffraction", subject: "Physics",
    strand: "Waves", needs: ["reflection", "wave-props"],
    teach: "At a boundary a wave can bounce back, bend as it changes speed, or spread as it passes an edge. Which happens depends on the boundary and, for diffraction, on how the gap compares with the wavelength.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A wave enters a denser material and slows down. What is this called?",
          options: [{ t: "Refraction" }, { t: "Reflection", why: "That is bouncing back, not entering." },
                    { t: "Diffraction", why: "That is spreading past an edge." }], correct: 0,
          steps: [step("Changing speed at a boundary bends the wave \u2014 that is refraction."),
                  step("Slowing down bends it toward the normal.")],
          hints: ["The wave entered the material rather than bouncing.",
                  "What happens when it changes speed?"] });
      }
      if (d === 2) {
        return q({ ask: "When does a wave diffract most through a gap?",
          options: [{ t: "When the gap is about the same size as the wavelength" },
                    { t: "When the gap is much larger", why: "A wide gap gives almost no spreading." },
                    { t: "When the gap is much smaller", why: "Very little gets through at all." }], correct: 0,
          steps: [step("Diffraction is spreading as a wave passes an edge."),
                  step("It is greatest when the gap is comparable to the wavelength."),
                  step("It is why you hear round a corner but cannot see round one \u2014 sound's wavelength matches a doorway and light's does not.")],
          hints: ["Compare the gap with the wavelength.",
                  "Why can you hear round a corner?"] });
      }
      return q({ ask: "Why does a straw look bent in a glass of water?",
        options: [{ t: "Light from the straw refracts as it leaves the water" },
                  { t: "The straw really does bend in water", why: "Take it out and it is straight." },
                  { t: "The curved glass magnifies the shape", why: "Magnification would change size, not apparent shape." }], correct: 0,
        steps: [step("Light leaving the water speeds up and bends away from the normal."),
                step("Your eye assumes light travelled in a straight line, and traces it back along the wrong path."),
                step("The submerged part appears displaced, so the straw looks broken at the surface."),
                step("Nothing is bending except the light \u2014 and your assumption about it.")],
        hints: ["What happens to light as it leaves the water?",
                "What does your eye assume about light's path?"] });
    }
  },
  {
    id: "salts-preparation", name: "Making a soluble salt", subject: "Chemistry", strand: "Reactions",
    needs: ["acids-bases", "solubility"],
    teach: "Add excess insoluble base to warm acid until no more reacts, filter off what is left over, then crystallise. The excess guarantees the acid is fully used up, and filtering removes it again.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Copper oxide is added to sulfuric acid. What salt forms?",
          options: [{ t: "Copper sulfate" }, { t: "Copper chloride", why: "Chloride would come from hydrochloric acid." },
                    { t: "Copper nitrate", why: "Nitrate would come from nitric acid." }], correct: 0,
          steps: [step("The metal comes from the base and the rest from the acid."),
                  step("Sulfuric acid gives sulfates, so copper oxide gives copper sulfate.")],
          hints: ["Which acid was used?",
                  "The acid names the second half of the salt."] });
      }
      if (d === 2) {
        return q({ ask: "Why is the copper oxide added in EXCESS?",
          options: [{ t: "To make sure all the acid is used up" },
                    { t: "To speed the reaction", why: "It helps a little, but the reason is completeness." },
                    { t: "To make more salt", why: "The acid limits the salt, not the oxide." }], correct: 0,
          steps: [step("Leftover acid would contaminate the crystals and is hard to remove."),
                  step("Excess solid guarantees every bit of acid has reacted."),
                  step("The excess is insoluble, so it can simply be filtered off afterwards."),
                  step("That is why the base is chosen insoluble \u2014 the excess is removable.")],
          hints: ["What would be left if you added too little?",
                  "Why does it matter that the excess is a solid?"] });
      }
      return q({ ask: "Why crystallise slowly rather than boiling the solution dry?",
        options: [{ t: "Slow evaporation gives larger, purer crystals" },
                  { t: "Boiling destroys the salt", why: "The salt survives; the crystals are just poor." },
                  { t: "It is faster", why: "It is much slower \u2014 that is the price of quality." }], correct: 0,
        steps: [step("Boiling dry leaves everything behind at once, including impurities."),
                step("Slow evaporation lets the salt come out of solution gradually, building an ordered lattice."),
                step("Impurities tend to stay in the remaining solution rather than joining the crystal."),
                step("The same principle is why recrystallisation is used to purify things.")],
        hints: ["What happens to impurities if you boil everything off?",
                "What does a crystal lattice need in order to form well?"] });
    }
  },
  {
    id: "nanoparticles", name: "Nanoparticles", subject: "Chemistry", strand: "Structure",
    /* Was ["surface-area", ...] \u2014 no such skill exists. The prerequisite was
       silently dropped, so nanoparticles could be offered to someone who had
       never met surface area and collision frequency. rates-collision is where
       that is actually taught. */
    needs: ["rates-collision", "giant-structures"],
    teach: "As a particle gets smaller its surface area to volume ratio rises sharply. That is why nanoparticles are such effective catalysts, and also why their behaviour can differ from the bulk material entirely.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A cube is cut into many smaller cubes. What happens to the total surface area?",
          options: [{ t: "It increases" }, { t: "It stays the same", why: "New faces are created at every cut." },
                    { t: "It decreases", why: "Cutting only ever exposes more surface." }], correct: 0,
          steps: [step("Every cut creates two new faces that were previously inside."),
                  step("The volume is unchanged, so the surface area to volume ratio rises.")],
          hints: ["What does a cut create?",
                  "Did the amount of material change?"] });
      }
      if (d === 2) {
        const n = pick(r, [2, 3, 4]);
        return q({ ask: "A cube's side is divided by " + n +
            ", making smaller cubes. By what factor does the surface area to volume ratio increase?",
          expect: n + "",
          steps: [step("Surface area to volume ratio for a cube is 6/side."),
                  step("Dividing the side by " + n + " multiplies that ratio by " + n + "."),
                  step("Smaller means proportionally more surface, every time.")],
          hints: ["The ratio depends on 1/side.",
                  "Smaller side, bigger ratio."] });
      }
      return q({ ask: "Why are nanoparticle catalysts so effective for their mass?",
        options: [{ t: "Almost every atom is on the surface where reactions happen" },
                  { t: "Nanoparticles are chemically different", why: "The chemistry is largely the same \u2014 the geometry changed." },
                  { t: "They dissolve into the mixture better", why: "Catalysis happens at the surface, dissolved or not." }], correct: 0,
        steps: [step("A reaction on a solid catalyst happens only at the surface."),
                step("In a lump, almost all the atoms are buried inside and doing nothing."),
                step("At the nanoscale a large fraction of atoms are on the surface and available."),
                step("The same mass of catalyst does far more work, which is why so little is needed.")],
        hints: ["Where does catalysis actually happen?",
                "What fraction of atoms are on the surface of a lump?"] });
    }
  }
];

const BATCH27 = [
  {
    id: "momentum-collisions", name: "Collisions and safety", subject: "Physics", strand: "Motion",
    needs: ["momentum", "friction"],
    teach: "Force is the rate of change of momentum, so making a collision last longer reduces the force. Crumple zones, airbags and helmets all work the same way \u2014 the momentum change is fixed, only the time is not.",
    gen: function (r, d) {
      if (d === 1) {
        const m = ri(r, 2, 10) * 100, v = ri(r, 5, 30);
        return q({ ask: "A car of mass " + m + " kg travels at " + v + " m/s. What is its momentum, in kg m/s?",
          expect: (m * v) + " kg m/s",
          steps: [step("Momentum is mass \u00D7 velocity."),
                  step(m + " \u00D7 " + v + " = " + (m * v) + " kg m/s.")],
          hints: ["Multiply the two.", "Momentum has units of kg m/s."] });
      }
      if (d === 2) {
        const p = ri(r, 2, 20) * 1000, t = pick(r, [0.1, 0.2, 0.5, 1]);
        return q({ ask: "A car loses " + p + " kg m/s of momentum in " + t +
            " s. What average force acted, in N?",
          expect: sig(p / t, 4) + " N", tol: 0.01,
          steps: [step("Force = change in momentum \u00F7 time."),
                  step(p + " \u00F7 " + t + " = " + sig(p / t, 4) + " N."),
                  step("Doubling the time would halve the force.")],
          hints: ["Momentum change over time.",
                  "A longer collision means a smaller force."] });
      }
      return q({ ask: "A crumple zone does not reduce the momentum change. So how does it protect you?",
        options: [{ t: "It makes the collision last longer, so the force is smaller" },
                  { t: "The crumple zone absorbs the momentum itself", why: "The momentum change is fixed by the speed and mass \u2014 it cannot be absorbed away." },
                  { t: "It makes the car lighter during the impact", why: "Mass is unchanged during the crash." }], correct: 0,
        steps: [step("Stopping from a given speed always means the same change in momentum."),
                step("Force is that change divided by the time it takes."),
                step("Crumpling extends the stopping time from milliseconds to tenths of a second."),
                step("Same momentum change, far longer time, so a much smaller force on the occupants.")],
        hints: ["Which quantity in F = \u0394p/t can be changed?",
                "The momentum change is fixed."] });
    }
  },
  {
    id: "power-transfer", name: "Power and efficiency together", subject: "Physics",
    strand: "Energy", needs: ["power", "efficiency"],
    teach: "Useful power out divided by total power in is the efficiency, and it can be worked out from power alone without ever computing an energy. The wasted power is what heats the device.",
    gen: function (r, d) {
      if (d === 1) {
        const inn = ri(r, 2, 20) * 100, pct = ri(r, 2, 9) * 10;
        return q({ ask: "A motor takes " + inn + " W and is " + pct +
            "% efficient. What useful power does it deliver, in W?",
          expect: (inn * pct / 100) + " W",
          steps: [step("Efficiency is the share of the input that does the job you wanted."),
                  step(pct + "% of " + inn + " = " + (inn * pct / 100) + " W.")],
          hints: ["Take that percentage of the input.",
                  "The rest is wasted."] });
      }
      if (d === 2) {
        const out = ri(r, 2, 15) * 100, inn = out + ri(r, 1, 15) * 100;
        return q({ ask: inn + " W goes in and " + out +
            " W comes out usefully. What is the efficiency, as a percentage to 3 significant figures?",
          expect: sigText(out / inn * 100, 3), sigFigs: 3, tol: 0.01,
          steps: [step("Efficiency = useful out \u00F7 total in."),
                  step(out + " \u00F7 " + inn + " = " + sig(out / inn, 4) + "."),
                  step("\u00D7 100 = " + sigText(out / inn * 100, 3) + "."),
                  step("The other " + (inn - out) + " W is heating the motor.")],
          hints: ["Useful over total.",
                  "Then multiply by 100."] });
      }
      return q({ ask: "Two motors deliver the same useful power, but one is 40% efficient and the other 80%. What differs?",
        options: [{ t: "The less efficient one draws twice the power and wastes far more as heat" },
                  { t: "The efficient motor does the work faster", why: "They deliver the same useful power, so they do the same work per second." },
                  { t: "Nothing that matters in practice", why: "One costs twice as much to run and needs far more cooling." }], correct: 0,
        steps: [step("Useful power is the same, so the difference is entirely in what goes in."),
                step("At 40% you need 2.5 times the useful power as input; at 80% only 1.25 times."),
                step("The inefficient motor therefore draws twice as much and dumps the difference as heat."),
                step("Efficiency shows up as a running cost and a cooling problem, not as less work done.")],
        hints: ["If the output matches, what must differ?",
                "Where does the extra input go?"] });
    }
  },
  {
    id: "fractional-distillation", name: "Fractional distillation", subject: "Chemistry",
    strand: "Matter", needs: ["separating", "organic"],
    teach: "Crude oil is separated by boiling point. Short molecules boil at low temperatures and rise to the cool top of the column; long ones condense low down where it is hot. The column is a temperature gradient doing the sorting.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What property separates the fractions in crude oil?",
          options: [{ t: "Boiling point" }, { t: "The colour of each fraction", why: "Colour follows from composition; it is not what does the separating." },
                    { t: "The density of each fraction", why: "Densities differ, but the column sorts by boiling point." }], correct: 0,
          steps: [step("The column is hot at the bottom and cool at the top."),
                  step("Each fraction condenses where the temperature drops to its boiling point.")],
          hints: ["What changes up the column?",
                  "What makes a vapour turn back into liquid?"] });
      }
      if (d === 2) {
        return q({ ask: "Where in the column do the SHORTEST molecules come out?",
          options: [{ t: "Near the top" }, { t: "Near the bottom", why: "The bottom is hottest, and short molecules stay as vapour there." },
                    { t: "Evenly throughout", why: "Each fraction has its own level." }], correct: 0,
          steps: [step("Short molecules have weak forces between them and low boiling points."),
                  step("They stay as vapour until they reach the coolest part, near the top."),
                  step("Long molecules condense almost immediately, low down.")],
          hints: ["Do short molecules boil at high or low temperatures?",
                  "Where is the column coolest?"] });
      }
      return q({ ask: "Why does a longer hydrocarbon molecule have a higher boiling point?",
        options: [{ t: "More contact between molecules means stronger forces to overcome" },
                  { t: "The bonds inside the molecule are stronger", why: "Boiling breaks forces BETWEEN molecules, not bonds within them." },
                  { t: "A longer molecule is simply heavier", why: "Mass matters less than the strength of intermolecular forces." }], correct: 0,
        steps: [step("Boiling separates molecules from each other; it does not break them apart."),
                step("A longer chain touches its neighbours along more of its length."),
                step("More contact means stronger intermolecular forces and more energy needed to separate them."),
                step("Confusing bonds WITHIN a molecule with forces BETWEEN molecules is the usual error here.")],
        hints: ["What is actually broken when something boils?",
                "Does a longer chain touch its neighbours more or less?"] });
    }
  },
  {
    id: "identifying-ions", name: "Testing for ions", subject: "Chemistry", strand: "Reactions",
    needs: ["salts-preparation", "acids-bases"],
    teach: "Each test produces a change you can see. A flame colour identifies the metal, a precipitate identifies many others, and fizzing with acid means a carbonate \u2014 the observation IS the identification.",
    gen: function (r, d) {
      if (d === 1) {
        const cases = [{ i: "sodium", c: "yellow" }, { i: "potassium", c: "lilac" }, { i: "copper", c: "green" }];
        const c = pick(r, cases);
        return q({ ask: "Which flame colour does " + c.i + " give?",
          options: [{ t: c.c }, { t: c.c === "yellow" ? "lilac" : "yellow", why: "That is a different metal." },
                    { t: "No colour", why: "Every one of these gives a distinctive flame." }], correct: 0,
          steps: [step("Flame tests identify the METAL ion present."),
                  step(c.i.charAt(0).toUpperCase() + c.i.slice(1) + " burns " + c.c + ".")],
          hints: ["Flame tests identify the metal.",
                  "Each metal has its own colour."] });
      }
      if (d === 2) {
        return q({ ask: "A solid fizzes when acid is added, and the gas turns limewater cloudy. What is it?",
          options: [{ t: "A carbonate" }, { t: "A sulfate", why: "Sulfates do not fizz with acid." },
                    { t: "A chloride", why: "Chlorides do not release a gas with dilute acid." }], correct: 0,
          steps: [step("Fizzing means a gas is being released."),
                  step("Limewater turning cloudy is the specific test for carbon dioxide."),
                  step("A carbonate plus acid gives salt, water and carbon dioxide \u2014 both observations at once.")],
          hints: ["What gas turns limewater cloudy?",
                  "Which compounds release it with acid?"] });
      }
      return q({ ask: "Why must a sample be tested for the metal AND the non-metal part separately?",
        options: [{ t: "The tests detect different ions, and a compound contains both" },
                  { t: "One of the two tests is unreliable", why: "Both are reliable \u2014 they simply answer different questions." },
                  { t: "To get the analysis done faster", why: "It takes longer, not less." }], correct: 0,
        steps: [step("A flame test tells you the metal and nothing about the rest."),
                step("A precipitate or gas test identifies the anion and nothing about the metal."),
                step("Naming the compound needs both halves, so both tests are required."),
                step("Neither test alone identifies a substance \u2014 which is why practical analysis is always a sequence.")],
        hints: ["What does a flame test tell you about the non-metal?",
                "How many parts does a salt have?"] });
    }
  }
];

const BATCH28 = [
  {
    id: "resistors-network", name: "Combining resistors", subject: "Physics", strand: "Electricity",
    needs: ["series-circuits", "parallel"],
    teach: "In series resistances add. In parallel the reciprocals add, so the total is always less than the smallest branch. Working out which arrangement you are looking at comes before any arithmetic.",
    gen: function (r, d) {
      if (d === 1) {
        const a = ri(r, 2, 20), b = ri(r, 2, 20);
        return q({ ask: a + " ohm and " + b + " ohm in SERIES. What is the total, in ohm?",
          expect: (a + b) + " ohm",
          steps: [step("In series the current passes through both, so the resistances add."),
                  step(a + " + " + b + " = " + (a + b) + " ohm.")],
          hints: ["Series resistances add.", "Just add the two."] });
      }
      if (d === 2) {
        const a = ri(r, 2, 12), b = ri(r, 2, 12);
        const tot = 1 / (1 / a + 1 / b);
        return q({ ask: a + " ohm and " + b + " ohm in PARALLEL. What is the total, in ohm, to 3 significant figures?",
          expect: sigText(tot, 3) + " ohm", sigFigs: 3, tol: 0.01,
          steps: [step("In parallel the reciprocals add: 1/R = 1/" + a + " + 1/" + b + "."),
                  step("1/R = " + sig(1 / a + 1 / b, 4) + ", so R = " + sigText(tot, 3) + " ohm."),
                  step("Note it is smaller than either branch \u2014 always.")],
          hints: ["Add the reciprocals, then invert.",
                  "The answer must be below the smaller resistor."] });
      }
      return q({ ask: "Adding another resistor in parallel LOWERS the total resistance. Why is that not a contradiction?",
        options: [{ t: "Each branch is another route, so more current flows for the same voltage" },
                  { t: "The two resistors cancel each other out", why: "Nothing cancels \u2014 both still resist." },
                  { t: "Adding a branch raises the supply voltage", why: "The supply voltage is unchanged." }], correct: 0,
        steps: [step("Resistance measures how hard it is for current to flow overall."),
                step("Another parallel branch is another path, so MORE current flows at the same voltage."),
                step("More current at the same voltage is, by definition, less resistance."),
                step("Nothing about either resistor changed \u2014 the circuit gained an option.")],
        hints: ["What does adding a branch do to the total current?",
                "Resistance is voltage over current."] });
    }
  },
  {
    id: "life-cycle", name: "Life cycle assessment", subject: "Chemistry", strand: "Matter",
    needs: ["polymers", "carbon-cycle"],
    teach: "A life cycle assessment counts the impact of a product from raw material through manufacture and use to disposal. A material can look better at one stage and worse overall, which is why the whole cycle has to be counted.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Which stages does a life cycle assessment cover?",
          options: [{ t: "Raw materials, manufacture, use and disposal" },
                    { t: "Only what happens during manufacture", why: "Use and disposal are often the largest contributions." },
                    { t: "Only what happens at disposal", why: "That misses everything before it." }], correct: 0,
          steps: [step("The point is to count the WHOLE life, not one convenient stage."),
                  step("A product can be cheap to make and expensive to dispose of, or the reverse.")],
          hints: ["The word is life CYCLE.",
                  "Where does a product's impact begin and end?"] });
      }
      if (d === 2) {
        return q({ ask: "A cotton bag needs many uses to beat a plastic one. Why?",
          options: [{ t: "Growing and processing cotton has a large impact per bag" },
                    { t: "Cotton does not biodegrade the way plastic does", why: "It is \u2014 the issue is what it took to make." },
                    { t: "Plastic bags last longer in everyday use", why: "They do, but the argument is about manufacture." }], correct: 0,
          steps: [step("Cotton needs land, water, fertiliser and processing."),
                  step("A plastic bag is very cheap to make in comparison."),
                  step("The cotton bag only wins once its large manufacturing cost is spread over enough uses."),
                  step("Which is better depends entirely on how many times it is actually used.")],
          hints: ["What did each bag cost to produce?",
                  "How is that cost spread out?"] });
      }
      return q({ ask: "Why is a life cycle assessment hard to make objective?",
        options: [{ t: "Deciding how to weigh water use against carbon against waste is a judgement" },
                  { t: "The data needed is never actually available", why: "Data is often available; combining it is the problem." },
                  { t: "It is not \u2014 the numbers decide", why: "The numbers do not compare directly with each other." }], correct: 0,
        steps: [step("The stages can be measured, but they produce different KINDS of impact."),
                step("Comparing litres of water with kilograms of carbon dioxide needs a value judgement."),
                step("Two honest assessments can reach different conclusions by weighting differently."),
                step("The measurement is science; the weighting is not, and saying so is part of doing it properly.")],
        hints: ["Can you add water use to carbon emissions?",
                "Where does judgement enter?"] });
    }
  },
  {
    id: "radiation-uses", name: "Using radiation safely", subject: "Physics",
    strand: "Radioactivity", needs: ["decay-types", "halflife"],
    teach: "The right isotope for a job is chosen by its radiation type and its half-life. A tracer needs to penetrate the body and decay quickly; a thickness gauge needs a source that lasts and radiation the material can partly absorb.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A medical tracer is injected and detected from outside. Which radiation is needed?",
          options: [{ t: "Gamma" }, { t: "Alpha", why: "Alpha cannot escape the body at all \u2014 and would do great damage inside." },
                    { t: "Beta", why: "Beta is largely absorbed by tissue before it gets out." }], correct: 0,
          steps: [step("The radiation has to leave the body to be detected."),
                  step("Only gamma penetrates tissue well enough."),
                  step("It is also the least ionising, so it does the least damage on the way out.")],
          hints: ["What must the radiation do to be detected?",
                  "Which type penetrates the furthest?"] });
      }
      if (d === 2) {
        return q({ ask: "Should a medical tracer have a long or short half-life?",
          options: [{ t: "Short, so it stops irradiating the patient quickly" },
                    { t: "Long, so the tracer keeps working for weeks", why: "Lasting is exactly what you do not want inside a person." },
                    { t: "It does not matter", why: "The dose depends entirely on how long it keeps decaying." }], correct: 0,
          steps: [step("The tracer must last long enough for the scan and no longer."),
                  step("A long half-life means the patient keeps receiving a dose for weeks."),
                  step("A few hours is the usual compromise \u2014 long enough to image, short enough to clear.")],
          hints: ["What happens after the scan finishes?",
                  "Is lasting a good thing inside a body?"] });
      }
      return q({ ask: "A thickness gauge for aluminium foil uses beta, not alpha or gamma. Why?",
        options: [{ t: "Alpha would be stopped completely and gamma would pass straight through" },
                  { t: "Beta is the safest of the three to handle", why: "Safety matters, but the reason is that only beta responds to the thickness." },
                  { t: "Beta sources are the cheapest to obtain", why: "Cost is not what decides it." }], correct: 0,
        steps: [step("The gauge works by measuring how much radiation gets through."),
                step("Alpha is stopped by paper, so no reading would change with foil thickness."),
                step("Gamma passes through almost unaffected, so again nothing would change."),
                step("Beta is partly absorbed by foil, so the amount getting through tracks the thickness \u2014 the only one that works.")],
        hints: ["What must vary as the foil thickness changes?",
                "Which radiation is partly absorbed by thin metal?"] });
    }
  },
  {
    id: "concentration-change", name: "Rate from a graph", subject: "Chemistry",
    strand: "Reactions", needs: ["rates", "rates-collision"],
    teach: "The gradient of a product-against-time graph is the rate. It is steepest at the start and flattens as reactants run out, so a single overall figure is an average rather than the rate at any moment.",
    gen: function (r, d) {
      if (d === 1) {
        const v = ri(r, 10, 90), t = ri(r, 5, 30);
        return q({ ask: v + " cm^3 of gas is produced in " + t +
            " s. What is the mean rate, in cm^3/s, to 3 significant figures?",
          expect: sigText(v / t, 3) + " cm^3/s", sigFigs: 3, tol: 0.01,
          steps: [step("Mean rate = amount produced \u00F7 time taken."),
                  step(v + " \u00F7 " + t + " = " + sigText(v / t, 3) + " cm^3/s."),
                  step("This is an average \u2014 the rate was higher at the start and lower at the end.")],
          hints: ["Volume over time.",
                  "It is a mean, not the rate at any instant."] });
      }
      if (d === 2) {
        return q({ ask: "Where on a product-against-time curve is the reaction fastest?",
          options: [{ t: "At the start, where the curve is steepest" },
                    { t: "At the end, where it flattens", why: "Flattening means the rate is falling toward zero." },
                    { t: "In the middle", why: "The gradient only decreases from the start." }], correct: 0,
          steps: [step("The gradient of the curve IS the rate."),
                  step("It is steepest at the very start, when reactant concentration is highest."),
                  step("As reactants are used up there are fewer collisions, so the curve flattens.")],
          hints: ["What does gradient mean on this graph?",
                  "When is there most reactant left?"] });
      }
      return q({ ask: "Two reactions finish at the same time with the same total gas. Are their rates identical throughout?",
        options: [{ t: "Not necessarily \u2014 the curves could have different shapes" },
                  { t: "Yes, same total and time means same rate", why: "That gives the same MEAN rate, not the same rate at every moment." },
                  { t: "No, that is impossible", why: "It is perfectly possible \u2014 many curves share endpoints." }], correct: 0,
        steps: [step("The endpoints fix the mean rate and say nothing about the path between them."),
                step("One reaction might start explosively and crawl to the finish."),
                step("The other might proceed steadily throughout."),
                step("Only the shape of the curve shows the rate at any given moment, which is why the graph is drawn at all.")],
        hints: ["What do the two endpoints actually tell you?",
                "Could two different curves share them?"] });
    }
  }
];

const BATCH29 = [
  {
    id: "hookes-limit", name: "The limit of proportionality", subject: "Physics",
    strand: "Forces", needs: ["hooke"],
    teach: "A spring extends in proportion to the force only up to a point. Past the limit of proportionality the graph bends, and past the elastic limit it never returns to its original length.",
    gen: function (r, d) {
      if (d === 1) {
        const k = ri(r, 2, 20), x = ri(r, 2, 10);
        return q({ ask: "A spring has spring constant " + k + " N/m and is stretched " + x +
            " m within its limit. What force is needed, in N?",
          expect: (k * x) + " N",
          steps: [step("Within the limit, force = spring constant \u00D7 extension."),
                  step(k + " \u00D7 " + x + " = " + (k * x) + " N.")],
          hints: ["Multiply the two.", "F = kx."] });
      }
      if (d === 2) {
        return q({ ask: "A force-extension graph is a straight line, then curves. What does the curve mean?",
          options: [{ t: "The limit of proportionality has been passed" },
                    { t: "The spring has snapped", why: "It is still extending \u2014 just not proportionally." },
                    { t: "The measurements are wrong", why: "The bend is real behaviour, not error." }], correct: 0,
          steps: [step("A straight line means extension is proportional to force."),
                  step("Where it bends, that proportionality has ended."),
                  step("The spring still stretches \u2014 F = kx simply no longer describes it.")],
          hints: ["What does a straight line through the origin mean?",
                  "What has changed where it bends?"] });
      }
      return q({ ask: "A spring is stretched past its elastic limit and released. What happens?",
        options: [{ t: "It stays longer than it started" },
                  { t: "It returns to its original length", why: "That is behaviour BELOW the elastic limit." },
                  { t: "It snaps immediately", why: "It deforms permanently well before it breaks." }], correct: 0,
        steps: [step("Below the elastic limit, all the energy stored is returned and the spring recovers."),
                step("Past it, some of the work has gone into permanently rearranging the material."),
                step("The spring is now longer than it was, even with no force on it."),
                step("Elastic and plastic deformation are different behaviours, not different amounts of the same one.")],
        hints: ["Where did the extra energy go?",
                "Does it recover fully?"] });
    }
  },
  {
    id: "electrolysis-calc", name: "Electrolysis calculations", subject: "Chemistry",
    strand: "Reactions", needs: ["half-equations", "moles"],
    teach: "Charge is current \u00D7 time. Divide by the Faraday constant for moles of electrons, then use the half equation's ratio to get moles of product. Each step converts one quantity into the next.",
    gen: function (r, d) {
      if (d === 1) {
        const I = ri(r, 1, 10), t = ri(r, 100, 900);
        return q({ ask: "A current of " + I + " A flows for " + t +
            " s. How much charge passes, in C?",
          expect: (I * t) + " C",
          steps: [step("Charge = current \u00D7 time."),
                  step(I + " \u00D7 " + t + " = " + (I * t) + " C.")],
          hints: ["Multiply amps by seconds.",
                  "Q = It."] });
      }
      if (d === 2) {
        const Q = ri(r, 1, 20) * 10000;
        const F = 96500;
        return q({ ask: Q + " C passes through a cell. How many moles of electrons is that, to 3 significant figures? (F = 96500 C/mol)",
          expect: sigText(Q / F, 3) + " mol", sigFigs: 3, tol: 0.01,
          steps: [step("One mole of electrons carries 96500 C \u2014 that is the Faraday constant."),
                  step(Q + " \u00F7 96500 = " + sigText(Q / F, 3) + " mol."),
                  step("Charge in, moles of electrons out.")],
          hints: ["Divide by the Faraday constant.",
                  "It converts coulombs into moles of electrons."] });
      }
      return q({ ask: "The same charge is passed through solutions of Na+ and Al3+. Which deposits more moles of metal?",
        options: [{ t: "Sodium, because each ion needs only one electron" },
                  { t: "Aluminium, because it has more charge", why: "More charge per ion means FEWER ions for the same electrons." },
                  { t: "The same amount", why: "The ratio in the half equation differs." }], correct: 0,
        steps: [step("Na+ + e- \u2192 Na needs one electron per atom."),
                step("Al3+ + 3e- \u2192 Al needs three."),
                step("The same electrons therefore deposit three times as many sodium atoms as aluminium."),
                step("The half equation's ratio is what converts electrons into product, and it differs for every ion.")],
        hints: ["How many electrons does each ion need?",
                "The same electrons go further for a 1+ ion."] });
    }
  },
  {
    id: "national-grid", name: "The national grid", subject: "Physics", strand: "Electricity",
    needs: ["transformers", "resistivity"],
    teach: "Power is stepped up to hundreds of thousands of volts for transmission and back down for use. High voltage means low current for the same power, and losses in the cables go as the current squared.",
    gen: function (r, d) {
      if (d === 1) {
        const P = ri(r, 1, 20) * 1000, V = ri(r, 1, 4) * 100000;
        return q({ ask: P + " W is transmitted at " + V + " V. What current flows, in A, to 3 significant figures?",
          expect: sigText(P / V, 3) + " A", sigFigs: 3, tol: 0.01,
          steps: [step("P = VI, so I = P \u00F7 V."),
                  step(P + " \u00F7 " + V + " = " + sigText(P / V, 3) + " A."),
                  step("At such a high voltage the current is tiny, which is the whole point.")],
          hints: ["Rearrange P = VI for the current.",
                  "Divide power by voltage."] });
      }
      if (d === 2) {
        const f = pick(r, [2, 4, 5, 10]);
        return q({ ask: "The transmission voltage is multiplied by " + f +
            ". By what factor does the power lost in the cables change?  Give it as a decimal to 4 places.",
          expect: sigText(1 / (f * f), 6), tol: 0.0001,
          steps: [step("For the same power, multiplying V by " + f + " divides the current by " + f + "."),
                  step("Loss is I\u00B2R, so dividing the current by " + f + " divides the loss by " + (f * f) + "."),
                  step("The factor is 1/" + (f * f) + " = " + sig(1 / (f * f), 6) + "."),
                  step("The squared term is why the saving is so large.")],
          hints: ["What happens to the current?",
                  "Loss depends on the current SQUARED."] });
      }
      return q({ ask: "Why is the voltage stepped back DOWN before it reaches homes?",
        options: [{ t: "400,000 V would be lethal and no appliance could use it" },
                  { t: "To reduce transmission losses even further", why: "Losses are lowest at high voltage \u2014 stepping down increases them." },
                  { t: "A transformer can only step voltage up, never down", why: "The same transformer works in either direction." }], correct: 0,
        steps: [step("High voltage is ideal for transmission and unusable for anything else."),
                step("Household wiring and appliances are built for 230 V, and 400,000 V would arc across any gap."),
                step("So the grid accepts higher losses in the last stretch in exchange for a usable, survivable supply."),
                step("The design is a compromise between efficiency over distance and safety at the socket.")],
        hints: ["Could you plug a kettle into 400,000 V?",
                "What is the last stretch trading away?"] });
    }
  },
  {
    id: "equilibrium-conditions", name: "Choosing industrial conditions", subject: "Chemistry",
    strand: "Reactions", needs: ["haber", "equilibrium"],
    teach: "Pressure favours the side with fewer gas molecules, temperature favours the endothermic direction, and a catalyst changes neither position \u2014 only the speed. Knowing which lever does what makes any process predictable.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "N2 + 3H2 \u21CC 2NH3.  Which side has fewer gas molecules?",
          options: [{ t: "The right \u2014 2 molecules against 4" },
                    { t: "The left", why: "Count them: 1 + 3 = 4 on the left, 2 on the right." },
                    { t: "They are equal", why: "Four does not equal two." }], correct: 0,
          steps: [step("Count the gas molecules each side: 1 + 3 = 4 on the left, 2 on the right."),
                  step("Fewer molecules means the right-hand side takes up less volume.")],
          hints: ["Add up the coefficients on each side.",
                  "Do not forget the 3 in front of H2."] });
      }
      if (d === 2) {
        return q({ ask: "Raising the pressure shifts that equilibrium which way?",
          options: [{ t: "Toward the ammonia" },
                    { t: "Toward the reactants", why: "That side has MORE molecules, so pressure opposes it." },
                    { t: "It does not move", why: "The sides have different molecule counts, so pressure matters." }], correct: 0,
          steps: [step("The system opposes the increase by reducing the volume it occupies."),
                  step("It does that by favouring the side with fewer gas molecules."),
                  step("That is the ammonia side, so the yield rises.")],
          hints: ["Which side takes up less space?",
                  "The system opposes what you did."] });
      }
      return q({ ask: "A catalyst is added to an equilibrium. What happens to the YIELD?",
        options: [{ t: "Nothing \u2014 only the time taken to get there changes" },
                  { t: "It increases", why: "A catalyst speeds both directions equally, so the position is unchanged." },
                  { t: "It decreases", why: "It does not shift the position at all." }], correct: 0,
        steps: [step("A catalyst lowers the activation energy for BOTH directions equally."),
                step("Forward and backward rates both rise, so they still become equal at the same point."),
                step("Equilibrium is reached sooner and in exactly the same place."),
                step("That is why a catalyst is used for rate and pressure for yield \u2014 different levers, different jobs.")],
        hints: ["Does a catalyst favour one direction over the other?",
                "What decides where equilibrium sits?"] });
    }
  }
];

const BATCH30 = [
  {
    id: "moments-balance", name: "Balanced beams", subject: "Physics", strand: "Forces",
    needs: ["moments-machines"],
    teach: "A beam balances when the clockwise moments equal the anticlockwise ones. With several forces, add each side separately before comparing \u2014 the pivot is where you choose to measure from.",
    gen: function (r, d) {
      if (d === 1) {
        const F = ri(r, 2, 20) * 10, dd = ri(r, 1, 5);
        return q({ ask: "A force of " + F + " N acts " + dd +
            " m from a pivot. What is its moment, in N m?",
          expect: (F * dd) + " N m",
          steps: [step("Moment = force \u00D7 perpendicular distance from the pivot."),
                  step(F + " \u00D7 " + dd + " = " + (F * dd) + " N m.")],
          hints: ["Multiply force by distance.",
                  "The unit is newton metres."] });
      }
      if (d === 2) {
        const F1 = ri(r, 2, 12) * 10, d1 = ri(r, 2, 6), d2 = ri(r, 1, 5);
        const F2 = F1 * d1 / d2;
        return q({ ask: F1 + " N acts " + d1 + " m to the left of a pivot. What force " + d2 +
            " m to the right balances it, in N, to 3 significant figures?",
          expect: sigText(F2, 3) + " N", sigFigs: 3, tol: 0.01,
          steps: [step("Balanced means the two moments are equal."),
                  step(F1 + " \u00D7 " + d1 + " = F \u00D7 " + d2 + "."),
                  step("F = " + (F1 * d1) + " \u00F7 " + d2 + " = " + sigText(F2, 3) + " N.")],
          hints: ["Set the two moments equal.",
                  "Then divide by the second distance."] });
      }
      return q({ ask: "Two children sit on a see-saw and it balances. Must they weigh the same?",
        options: [{ t: "No \u2014 a lighter child further out balances a heavier one close in" },
                  { t: "Yes \u2014 balancing needs equal weights on each side", why: "Only if they sit at equal distances." },
                  { t: "Only if the plank is uniform", why: "The plank matters, but distance is what allows unequal weights." }], correct: 0,
        steps: [step("What balances is the MOMENT, not the force."),
                step("Moment is force \u00D7 distance, so a smaller force at a greater distance gives the same moment."),
                step("A child half the weight balances by sitting twice as far out."),
                step("It is why a see-saw works between people of very different sizes.")],
        hints: ["What quantity actually balances?",
                "Can distance make up for weight?"] });
    }
  },
  {
    id: "endo-exo-uses", name: "Using energy changes", subject: "Chemistry",
    strand: "Reactions", needs: ["energy-changes", "reaction-profiles"],
    teach: "Exothermic reactions are used where heat is wanted \u2014 hand warmers, self-heating cans. Endothermic ones absorb heat, which is why a sports injury pack goes cold. The sign of \u0394H picks the application.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A hand warmer gets hot when activated. What kind of reaction is inside?",
          options: [{ t: "Exothermic" }, { t: "Endothermic", why: "That would make it cold." },
                    { t: "Neither", why: "Energy is clearly leaving the pack." }], correct: 0,
          steps: [step("Getting hot means energy is leaving the reaction and entering its surroundings."),
                  step("Energy out is exothermic.")],
          hints: ["Is energy going in or coming out?",
                  "Out means exo."] });
      }
      if (d === 2) {
        return q({ ask: "A sports injury cold pack works by dissolving a salt in water. What must be true?",
          options: [{ t: "Dissolving is endothermic for that salt" },
                    { t: "The salt is cold to begin with", why: "It is at room temperature like everything else." },
                    { t: "Water freezes", why: "It goes cold, not solid." }], correct: 0,
          steps: [step("The pack gets colder, so energy is being taken FROM the surroundings."),
                  step("Energy in is endothermic."),
                  step("Ammonium nitrate dissolving is the usual example.")],
          hints: ["Where is the energy going?",
                  "Colder surroundings means energy left them."] });
      }
      return q({ ask: "Why can a self-heating can only be used once?",
        options: [{ t: "The reaction is not reversible under those conditions" },
                  { t: "The can itself is damaged by the heat it produces", why: "The can survives \u2014 the chemicals are spent." },
                  { t: "The heat simply escapes and cannot be reused", why: "The heat is the point; the issue is that it cannot be regenerated." }], correct: 0,
        steps: [step("The heat came from a chemical reaction converting reactants into products."),
                step("Reversing it would need at least as much energy put back in."),
                step("Nothing in the can can supply that, so the products simply stay as they are."),
                step("A single-use product is a direct consequence of conservation of energy.")],
        hints: ["What would reversing it require?",
                "Where would that energy come from?"] });
    }
  },
  {
    id: "sound-hearing", name: "How we hear", subject: "Physics", strand: "Waves",
    needs: ["sound", "wave-props"],
    teach: "Sound reaches the eardrum as a pressure variation, which is converted to vibration and then to nerve signals. Frequency is heard as pitch and amplitude as loudness \u2014 two properties of one wave doing two different jobs.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Which property of a sound wave do we hear as PITCH?",
          options: [{ t: "Frequency" }, { t: "Amplitude", why: "That is loudness." },
                    { t: "Speed", why: "Speed is set by the material and is the same for all pitches." }], correct: 0,
          steps: [step("More vibrations per second is heard as a higher note."),
                  step("Amplitude is separate and gives loudness.")],
          hints: ["What changes when a guitar string is tightened?",
                  "It is not how hard you pluck it."] });
      }
      if (d === 2) {
        return q({ ask: "Two notes have the same frequency but different amplitudes. What differs?",
          options: [{ t: "How loud they sound" },
                    { t: "How high they sound", why: "Pitch follows frequency, which is the same for both." },
                    { t: "How fast they travel", why: "Speed depends on the material, not the wave." }], correct: 0,
          steps: [step("Frequency is identical, so the pitch is identical."),
                  step("Amplitude carries the energy, and more energy is heard as louder."),
                  step("Same note, different volume.")],
          hints: ["Which property carries the energy?",
                  "Frequency is unchanged."] });
      }
      return q({ ask: "Human hearing tops out near 20,000 Hz and falls with age. Why is that a limit of the ear, not of the sound?",
        options: [{ t: "The sound exists \u2014 the ear's hair cells simply cannot respond that fast" },
                  { t: "The wave stops being produced above that frequency", why: "Bats and instruments produce it regardless of who is listening." },
                  { t: "It travels too fast for the ear to register it", why: "Speed is unchanged with frequency." }], correct: 0,
        steps: [step("A dog whistle produces a real sound wave that a dog responds to."),
                step("The wave arrives at a human ear exactly as it arrives at a dog's."),
                step("Our hair cells cannot vibrate fast enough to convert it into a nerve signal."),
                step("The limit is in the detector, which is why it differs between species and declines with age.")],
        hints: ["Does a dog whistle make a sound?",
                "Where does the limit actually sit?"] });
    }
  },
  {
    id: "empirical-molecular", name: "Empirical and molecular formulas", subject: "Chemistry",
    strand: "Amount", needs: ["empirical", "formula-mass"],
    teach: "The empirical formula is the simplest whole-number ratio; the molecular formula is what the molecule actually contains. Divide the real formula mass by the empirical one to find how many empirical units make a molecule.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "A compound's empirical formula is CH2. Which could be its molecular formula?",
          options: [{ t: "C4H8" }, { t: "CH3", why: "The ratio would be 1:3, not 1:2." },
                    { t: "C2H2", why: "That is a 1:1 ratio." }], correct: 0,
          steps: [step("The molecular formula must be a whole-number multiple of the empirical one."),
                  step("C4H8 is CH2 multiplied by 4 \u2014 the ratio is still 1:2.")],
          hints: ["Keep the ratio the same.",
                  "Multiply both subscripts equally."] });
      }
      if (d === 2) {
        const emp = pick(r, [{ f: "CH2", m: 14 }, { f: "CH2O", m: 30 }, { f: "NO2", m: 46 }]);
        const n = ri(r, 2, 5);
        return q({ ask: "Empirical formula " + emp.f + " has a formula mass of " + emp.m +
            ". The molecule's mass is " + (emp.m * n) + ". How many " + emp.f + " units are in it?",
          expect: n + "",
          steps: [step("Divide the molecular mass by the empirical mass."),
                  step((emp.m * n) + " \u00F7 " + emp.m + " = " + n + "."),
                  step("So the molecular formula is " + emp.f + " multiplied by " + n + ".")],
          hints: ["Divide the two masses.",
                  "The answer is a whole number."] });
      }
      return q({ ask: "Why can two different compounds share an empirical formula?",
        options: [{ t: "It records only the ratio, not the size or arrangement" },
                  { t: "One of the two laboratories made an error", why: "Both can be perfectly correct." },
                  { t: "They must be the same compound", why: "Ethene and butene share CH2 and are quite different." }], correct: 0,
        steps: [step("An empirical formula gives the simplest ratio and nothing else."),
                step("Ethene is C2H4 and butene is C4H8, and both reduce to CH2."),
                step("They have different masses, different boiling points and different reactions."),
                step("The ratio is real information but it does not identify a substance on its own.")],
        hints: ["What does the empirical formula leave out?",
                "Can two molecules of different size share a ratio?"] });
    }
  }
];

/* Elementary had fallen to 6% of the app \u2014 8 skills out of 132 \u2014 because every
   batch since the early ones landed at Middle school or above. These four cover
   the parts of the primary curriculum that were missing entirely: light,
   magnets, materials and the Earth. */
const BATCH31 = [
  {
    id: "light-basic", name: "Light and shadows", subject: "Physics", strand: "Waves", needs: [],
    teach: "Light travels in straight lines from a source. A shadow appears where something blocks it, which is why the shadow has the same shape as whatever is in the way.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Why can you not see round a corner?",
          options: [{ t: "Light travels in straight lines" },
                    { t: "Light is too fast", why: "Speed does not stop it bending \u2014 it simply does not bend." },
                    { t: "The corner absorbs it", why: "Even a mirror-bright corner would not help you see round it." }], correct: 0,
          steps: [step("Light goes straight out from a source and keeps going straight."),
                  step("A wall in the way blocks it, and nothing arrives from behind the corner.")],
          hints: ["Which way does light travel?", "Can a straight line bend round a corner?"] });
      }
      if (d === 2) {
        return q({ ask: "You move a torch closer to a toy. What happens to its shadow on the wall behind?",
          options: [{ t: "It gets bigger" },
                    { t: "It gets smaller", why: "Moving the light closer spreads the shadow out, not in." },
                    { t: "It stays the same size", why: "The size depends on where the light is." }], correct: 0,
          steps: [step("Light spreads out from the torch in straight lines."),
                  step("Closer in, the toy blocks a wider spread of those lines."),
                  step("So more of the wall is left dark and the shadow grows.")],
          hints: ["The light spreads out as it travels.",
                  "How much of it does the toy block?"] });
      }
      return q({ ask: "Why do you see a book that is not glowing?",
        options: [{ t: "Light from a lamp bounces off it into your eyes" },
                  { t: "Your eyes send out light", why: "Eyes only receive light; they do not produce any." },
                  { t: "The book makes its own light", why: "Then it would be visible in a completely dark room." }], correct: 0,
        steps: [step("Only a few things make their own light \u2014 the Sun, a lamp, a flame."),
                step("Everything else is seen because light bounces off it."),
                step("In a room with no light at all you see nothing, however good your eyes are."),
                step("That is the whole difference between a light source and everything else.")],
        hints: ["What happens in a completely dark room?",
                "Where did the light come from first?"] });
    }
  },
  {
    id: "magnets-basic", name: "Magnets", subject: "Physics", strand: "Forces", needs: [],
    teach: "A magnet pulls on iron, steel, nickel and cobalt, and on nothing else. Two magnets pull together or push apart depending on which ends face each other.",
    gen: function (r, d) {
      if (d === 1) {
        const c = pick(r, [{ t: "A steel paperclip", w: "" }, { t: "An iron nail", w: "" }]);
        return q({ ask: "Which of these will a magnet pick up?",
          options: [{ t: c.t },
                    { t: "A plastic spoon", why: "Plastic is not magnetic at all." },
                    { t: "A copper coin", why: "Copper is a metal and still not magnetic \u2014 only a few metals are." }], correct: 0,
          steps: [step("Magnets attract iron, steel, nickel and cobalt."),
                  step("Most metals, including copper and aluminium, are not magnetic.")],
          hints: ["Not every metal is magnetic.",
                  "Which one contains iron?"] });
      }
      if (d === 2) {
        return q({ ask: "Two magnets are pushed together north end to north end. What happens?",
          options: [{ t: "They push each other away" },
                    { t: "They pull together", why: "That happens when opposite ends meet." },
                    { t: "Nothing", why: "There is always a force between two magnets." }], correct: 0,
          steps: [step("The same ends repel each other."),
                  step("Opposite ends \u2014 north to south \u2014 attract."),
                  step("You can feel the push without the magnets ever touching.")],
          hints: ["Same ends or opposite ends?",
                  "Try to remember two magnets refusing to meet."] });
      }
      return q({ ask: "A magnet moves a paperclip through a sheet of paper. What does that show?",
        options: [{ t: "Magnetism works without touching" },
                  { t: "Paper is magnetic", why: "The paper does nothing \u2014 the force passes straight through it." },
                  { t: "The magnet is very strong", why: "Even a weak magnet works through paper." }], correct: 0,
        steps: [step("The magnet never touches the paperclip."),
                step("The force reaches across the gap and through the paper."),
                step("Magnetism is a non-contact force, like gravity."),
                step("Most forces need touching; this one does not, which is what makes it surprising.")],
        hints: ["Did the magnet touch the paperclip?",
                "What other force works at a distance?"] });
    }
  },
  {
    id: "materials-basic", name: "Choosing materials", subject: "Chemistry", strand: "Matter", needs: [],
    teach: "Things are made of the material that suits the job. A window is glass because you can see through it; a saucepan handle is plastic because it does not carry heat to your hand.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "Why are windows made of glass?",
          options: [{ t: "You can see through it" },
                    { t: "It is cheap", why: "Cheapness is not why you would choose it for a window in particular." },
                    { t: "It is strong", why: "Plenty of stronger materials would make a useless window." }], correct: 0,
          steps: [step("A window has to let you see out."),
                  step("Glass is transparent, so light passes straight through.")],
          hints: ["What does a window have to do?",
                  "Which property matters here?"] });
      }
      if (d === 2) {
        return q({ ask: "Why is a saucepan handle usually plastic and not metal?",
          options: [{ t: "Plastic does not carry heat to your hand" },
                    { t: "Plastic is lighter", why: "Weight is a small advantage; burning your hand is the real problem." },
                    { t: "Plastic is stronger", why: "Metal is stronger \u2014 that is not why plastic is chosen." }], correct: 0,
          steps: [step("Metal conducts heat quickly, which is exactly what you want for the pan."),
                  step("It is exactly what you do not want for the handle."),
                  step("Plastic is a poor conductor, so the handle stays cool enough to hold.")],
          hints: ["What would a metal handle feel like?",
                  "The pan and the handle need opposite properties."] });
      }
      return q({ ask: "One object is often made from several materials. Why?",
        options: [{ t: "Different parts of it need different properties" },
                  { t: "It is cheaper that way", why: "Sometimes, but the reason is what each part has to do." },
                  { t: "It looks better", why: "Appearance is rarely the deciding factor." }], correct: 0,
        steps: [step("A saucepan needs metal to conduct heat and plastic not to."),
                step("A window needs glass to see through and a frame to hold it."),
                step("No single material is best at everything, so parts are chosen separately."),
                step("Looking at an object and asking what each part has to DO explains almost every choice.")],
        hints: ["Think about a saucepan or a window.",
                "Does every part have the same job?"] });
    }
  },
  {
    id: "earth-basic", name: "Day, night and seasons", subject: "Physics", strand: "Motion", needs: [],
    teach: "The Earth spins once a day, which gives day and night. It also circles the Sun once a year, and because it is tilted, that gives the seasons.",
    gen: function (r, d) {
      if (d === 1) {
        return q({ ask: "What causes day and night?",
          options: [{ t: "The Earth spinning round once a day" },
                    { t: "The Sun going round the Earth", why: "It looks that way from the ground, and it is the Earth that moves." },
                    { t: "The Sun switching off", why: "The Sun shines all the time \u2014 the night side is simply facing away." }], correct: 0,
          steps: [step("The Earth turns all the way round once every 24 hours."),
                  step("The side facing the Sun has day; the side facing away has night.")],
          hints: ["Something is turning \u2014 what?",
                  "The Sun never stops shining."] });
      }
      if (d === 2) {
        return q({ ask: "How long does the Earth take to go once round the Sun?",
          options: [{ t: "A year" }, { t: "A day", why: "That is how long it takes to spin once on its own axis." },
                    { t: "A month", why: "That is roughly the Moon going round the Earth." }], correct: 0,
          steps: [step("One spin of the Earth is a day."),
                  step("One trip round the Sun is a year."),
                  step("The Moon going round the Earth takes about a month \u2014 three different movements.")],
          hints: ["Spin is a day. What is the bigger circle?",
                  "Three movements, three lengths of time."] });
      }
      return q({ ask: "Why is it summer in one half of the world when it is winter in the other?",
        options: [{ t: "The Earth is tilted, so one half leans toward the Sun" },
                  { t: "That half is closer to the Sun", why: "The distance barely changes \u2014 and Earth is actually closest in January." },
                  { t: "The Sun is hotter then", why: "The Sun gives out the same amount all year." }], correct: 0,
        steps: [step("The Earth is tilted over as it goes round."),
                step("For half the year the northern half leans toward the Sun and gets more direct light."),
                step("At the same time the southern half leans away, so it is winter there."),
                step("Six months later they swap, which is why the seasons are opposite either side of the equator.")],
        hints: ["The Earth does not sit upright.",
                "What is happening in Australia at Christmas?"] });
    }
  }
];

SKILLS.push.apply(SKILLS, BATCH31);

SKILLS.push.apply(SKILLS, BATCH30);

SKILLS.push.apply(SKILLS, BATCH29);

SKILLS.push.apply(SKILLS, BATCH28);

SKILLS.push.apply(SKILLS, BATCH27);

SKILLS.push.apply(SKILLS, BATCH26);

SKILLS.push.apply(SKILLS, BATCH25);

SKILLS.push.apply(SKILLS, BATCH24);

SKILLS.push.apply(SKILLS, BATCH23);

SKILLS.push.apply(SKILLS, BATCH22);

SKILLS.push.apply(SKILLS, BATCH21);

SKILLS.push.apply(SKILLS, BATCH20);

SKILLS.push.apply(SKILLS, BATCH19);

SKILLS.push.apply(SKILLS, BATCH18);

SKILLS.push.apply(SKILLS, BATCH17);

SKILLS.push.apply(SKILLS, BATCH16);

SKILLS.push.apply(SKILLS, BATCH15);

SKILLS.push.apply(SKILLS, BATCH14);

SKILLS.push.apply(SKILLS, BATCH13);

SKILLS.push.apply(SKILLS, BATCH12);

SKILLS.push.apply(SKILLS, BATCH11);

SKILLS.push.apply(SKILLS, BATCH10);

SKILLS.push.apply(SKILLS, BATCH9);

SKILLS.push.apply(SKILLS, BATCH8);

SKILLS.push.apply(SKILLS, BATCH7);

SKILLS.push.apply(SKILLS, BATCH6);

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
  // Added with the elementary batch: four strands had no entry at this level
  // at all, so a young learner filtering to Elementary saw almost nothing.
  moving: "Elementary", "energy-basic": "Elementary",
  "light-basic": "Elementary", "magnets-basic": "Elementary",
  "materials-basic": "Elementary", "earth-basic": "Elementary",
  "moments-balance": "High school", "endo-exo-uses": "High school",
  "sound-hearing": "High school", "empirical-molecular": "AP",
  "hookes-limit": "High school", "electrolysis-calc": "AP",
  "national-grid": "High school", "equilibrium-conditions": "AP",
  "resistors-network": "High school", "life-cycle": "High school",
  "radiation-uses": "High school", "concentration-change": "High school",
  "momentum-collisions": "High school", "power-transfer": "High school",
  "fractional-distillation": "High school", "identifying-ions": "High school",
  "stopping-distance": "Middle school", "wave-behaviour": "High school",
  "salts-preparation": "High school", nanoparticles: "High school",
  seismic: "High school", "circuit-faults": "High school",
  "yield-atom-economy": "AP", "carbon-cycle": "Middle school",
  "pressure-depth": "High school", "specific-heat-compare": "High school",
  "titration-calc": "AP", "reaction-profiles": "High school",
  orbits: "AP", "half-equations": "AP",
  "efficiency-transfer": "High school", "chromatography-rf": "Middle school",
  "moments-machines": "High school", ultrasound: "High school",
  haber: "AP", "water-treatment": "Middle school",
  "terminal-velocity": "Middle school", "energy-resources": "High school",
  static: "Middle school", alloys: "High school",
  stars: "High school", transformers: "High school", extraction: "High school",
  doppler: "High school", "series-circuits": "High school", purity: "Middle school",
  friction: "Middle school", "specific-latent": "High school", "rates-collision": "High school",
  "thermo-laws": "High school", resistivity: "High school", "group-chemistry": "AP",
  gravity: "High school", induction: "High school", lenses: "High school",
  chromatography: "Middle school", "electrolysis-products": "AP", reversible: "AP",
  limiting: "High school", "energy-changes": "Middle school", polymers: "High school",
  "acids-bases": "High school", reactivity: "Middle school", "giant-structures": "High school",
  "decay-equations": "AP", "electron-config": "AP",
  "equilibrium-forces": "AP", "power-energy": "AP", interference: "AP",
  "energy-transfer": "Middle school", "balanced-forces": "Middle school",
  "weight-mass": "Middle school",
  "sound-basic": "Elementary", mixtures: "Elementary",
  // Waves, radioactivity and solutions additions
  "wave-props": "High school", "em-spectrum": "High school", sound: "High school",
  "decay-types": "Middle school", background: "High school",
  solubility: "High school", dilution: "High school", "mass-conc": "High school",
  // Middle school: one-step arithmetic with a unit attached.
  speed: "Middle school", density: "Middle school", "formula-mass": "Middle school",
  isotopes: "Middle school", balancing: "Middle school", accel: "Middle school",
  magnetism: "High school", nuclear: "High school", periodic: "Middle school",
  // High school: rearrangement, multi-step, significant figures.
  force: "Middle school", energy: "High school", ohm: "High school", pressure: "High school",
  moments: "High school", power: "High school", heat: "High school", parallel: "High school",
  momentum: "High school", waves: "Middle school", hooke: "High school", halflife: "High school",
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

/* Named methods per tier.

   Each entry is up to three { method, teach, why } objects — one per
   difficulty tier. The `why` says what that method buys you that the previous
   one did not, which is the part that makes an escalation feel like progress
   rather than just harder numbers.

   Filled a batch at a time. Anything absent falls back to the skill's single
   `teach`, and elcheck reports how many are still doing that. */
const METHODS = {
  speed: [
    { method: "Distance over time", teach: "Speed is how much ground is covered in each unit of time \u2014 distance divided by time. The units tell you the operation: metres per second is metres divided by seconds.", why: "It is the definition, and reading the unit as an instruction is what makes the rest of the formulas readable." },
    { method: "Rearranging for distance or time", teach: "The same relation gives all three quantities. Distance is speed \u00D7 time, and time is distance \u00F7 speed \u2014 cover up the one you want and the arrangement is left behind.", why: "Most questions ask for something other than the speed, and rearranging beats memorising three separate formulas." },
    { method: "Average speed over a whole journey", teach: "Average speed is the TOTAL distance over the TOTAL time \u2014 not the average of the speeds. A journey out at 30 and back at 60 averages 40, not 45, because more time was spent at the slower speed.", why: "Averaging the speeds is the intuitive move and it is wrong whenever the two legs take different times, which is nearly always." }
  ],
  force: [
    { method: "Force = mass \u00D7 acceleration", teach: "A resultant force accelerates a mass, and the three quantities are locked together by F = ma. Double the force and the acceleration doubles; double the mass and it halves.", why: "It is the relation everything else in mechanics is built on." },
    { method: "Rearranging for mass or acceleration", teach: "Given any two of the three, the third follows. Mass is F \u00F7 a and acceleration is F \u00F7 m \u2014 the same relation read a different way.", why: "The question rarely asks for the force, so the rearrangement is what actually gets used." },
    { method: "Finding the resultant first", teach: "F = ma needs the RESULTANT force, not any single one. Combine the forces first \u2014 subtracting opposing ones \u2014 and only then divide by the mass.", why: "Using the driving force alone ignores friction and gives an acceleration the object never has." }
  ],
  density: [
    { method: "Mass over volume", teach: "Density is how much mass is packed into each unit of volume \u2014 mass divided by volume. Lead is dense because a small piece is heavy; foam is not, because a large piece is light.", why: "It explains why size and weight are different questions, which is the whole point of the quantity." },
    { method: "Rearranging for mass or volume", teach: "Mass is density \u00D7 volume, and volume is mass \u00F7 density. Knowing the density of a material lets you get either from the other.", why: "You rarely measure density directly \u2014 you look it up and use it to find something you cannot weigh or measure." },
    { method: "Comparing without calculating", teach: "Two objects of the same volume: the heavier is denser. Same mass: the smaller is denser. You can often decide which floats without working anything out.", why: "Floating and sinking are decided by a comparison, not a number, and spotting that saves the calculation entirely." }
  ],
  energy: [
    { method: "Work done = force \u00D7 distance", teach: "Energy transferred by a force is the force multiplied by the distance moved in its direction. Push twice as far and you transfer twice the energy.", why: "It connects force, which you can feel, to energy, which you cannot \u2014 and it is where joules come from." },
    { method: "Kinetic and potential stores", teach: "A moving mass stores \u00BDmv\u00B2; a raised mass stores mgh. Both are energy, measured the same way, differing only in what is holding it.", why: "Naming the store is what lets one be converted into the other, which is most energy questions." },
    { method: "Conservation across a change", teach: "Set the store before equal to the store after. A ball falling from height h arrives with \u00BDmv\u00B2 = mgh, and the mass cancels \u2014 which is why everything falls at the same rate.", why: "Equating the two stores answers questions neither formula could answer alone, and the cancellation is the reason Galileo was right." }
  ],
  ohm: [
    { method: "Voltage = current \u00D7 resistance", teach: "V = IR ties the three together. Voltage is the push, current is the flow, and resistance is how much the component fights it.", why: "It is the relation every circuit calculation reduces to." },
    { method: "Rearranging for current or resistance", teach: "Current is V \u00F7 R and resistance is V \u00F7 I. Cover the one you want and the arrangement remains.", why: "Resistance is almost never given directly \u2014 it is worked out from a voltage and a current you measured." },
    { method: "Which voltage across which component", teach: "V = IR applies to a single component with ITS voltage and ITS current, not to the whole circuit. Use the voltage across that component, not the supply voltage, unless they are the same thing.", why: "Using the supply voltage for one component in a series circuit is the standard mistake, and it gives a resistance that is far too high." }
  ],
  pressure: [
    { method: "Force over area", teach: "Pressure is force spread over area. The same push through a small area gives a large pressure, which is why a drawing pin goes in and your thumb does not.", why: "It explains a set of everyday facts that force alone cannot \u2014 snowshoes, knives, foundations." },
    { method: "Rearranging for force or area", teach: "Force is pressure \u00D7 area, and area is force \u00F7 pressure. Hydraulics work on exactly this: the same pressure over a bigger piston gives a bigger force.", why: "It is how a car is lifted by hand, and the rearrangement is the whole explanation." },
    { method: "Pressure in a liquid", teach: "In a liquid, pressure is depth \u00D7 density \u00D7 g \u2014 it depends on how deep you are, not on how much water there is. A narrow tube and a wide tank give the same pressure at the same depth.", why: "The intuition that more water means more pressure is wrong, and this is where it gets corrected." }
  ],
  power: [
    { method: "Energy per second", teach: "Power is how fast energy is transferred \u2014 joules per second, which is a watt. A 60 W bulb uses 60 J every second it is on.", why: "It separates how much energy from how quickly, which are different questions with different answers." },
    { method: "Rearranging for energy or time", teach: "Energy is power \u00D7 time, and time is energy \u00F7 power. This is where kilowatt-hours come from \u2014 a unit of energy built from a power and a time.", why: "Bills are in energy and appliances are rated in power, so the conversion is the practical use." },
    { method: "Power in a circuit", teach: "In electricity, power is also voltage \u00D7 current, and with V = IR it becomes I\u00B2R \u2014 which is why doubling the current quadruples the heat in a wire.", why: "The squared relation explains why thin cables overheat, and it is not visible in P = VI alone." }
  ],
  heat: [
    { method: "Energy = mass \u00D7 c \u00D7 temperature change", teach: "Heating something takes energy proportional to its mass, its specific heat capacity, and how far you raise the temperature. Water's high c is why it takes so long to boil.", why: "It is the relation behind every heating and cooling calculation." },
    { method: "Rearranging for the temperature rise", teach: "Given the energy supplied, the rise is E \u00F7 (mc). The same energy raises a small mass much further than a large one.", why: "It answers the question actually asked \u2014 how hot will this get \u2014 rather than how much energy it took." },
    { method: "Changing state takes energy with no temperature rise", teach: "While ice melts its temperature stays at 0\u00B0C however much energy goes in. That energy breaks bonds instead of raising temperature, and mc\u0394T does not apply during the change.", why: "Applying mc\u0394T through a state change gives a badly wrong answer, and nothing in the arithmetic warns you." }
  ],
  concentration: [
    { method: "Moles per litre", teach: "Concentration is the amount of solute divided by the volume of solution. Two solutions can hold the same solute and differ entirely in how strong they are.", why: "It separates how much from how strong, which is the distinction the whole topic rests on." },
    { method: "Rearranging for moles or volume", teach: "Moles are concentration \u00D7 volume, and volume is moles \u00F7 concentration. Titrations run entirely on this rearrangement.", why: "You measure a volume and want the moles, which is the direction the formula is rarely written in." },
    { method: "Watching the volume units", teach: "Concentration in mol/dm\u00B3 needs the volume in dm\u00B3, and burette readings are in cm\u00B3. Dividing by 1000 first is the step that decides whether the answer is right or out by a thousand.", why: "The arithmetic is trivial and the unit conversion is where the marks go, every time." }
  ],
  balancing: [
    { method: "Counting atoms on each side", teach: "A balanced equation has the same number of each element on both sides. Count them one element at a time \u2014 nothing is created or destroyed in a reaction.", why: "It is conservation of mass made visible, and the count is the only test that matters." },
    { method: "Adjusting the big numbers only", teach: "Balance by changing the numbers in FRONT of formulas, never the small ones inside them. Changing H\u2082O to H\u2082O\u2082 makes a different substance rather than balancing anything.", why: "It is the rule that keeps balancing chemistry rather than arithmetic, and breaking it silently changes the reaction." },
    { method: "Leaving oxygen until last", teach: "Balance the elements that appear in one compound on each side first, and leave oxygen \u2014 which usually appears in several \u2014 until the end. Fractions can be cleared by doubling everything at the finish.", why: "Starting with oxygen means re-balancing it every time something else changes; leaving it last usually makes it fall out on its own." }
  ],
  ph: [
    { method: "Where a substance sits on the scale", teach: "pH runs 0 to 14, with 7 neutral. Below 7 is acidic, above is alkaline \u2014 and the further from 7, the stronger.", why: "It is the reading, and being sure which direction is which comes before anything quantitative." },
    { method: "Each step is a factor of ten", teach: "The scale is logarithmic: pH 3 is ten times more acidic than pH 4 and a hundred times more than pH 5. Two pH units is a hundredfold difference, not double.", why: "Treating the scale as linear underestimates differences enormously, and that is the whole reason the scale is built this way." },
    { method: "From hydrogen ion concentration", teach: "pH is \u2212log\u2081\u2080 of the hydrogen ion concentration, so a concentration of 1 \u00D7 10\u207B\u00B3 mol/dm\u00B3 gives pH 3 \u2014 the power of ten IS the pH with the sign flipped.", why: "It turns the scale from something to memorise into something you can calculate, and shows where the factor of ten came from." }
  ],
  momentum: [
    { method: "Mass \u00D7 velocity", teach: "Momentum is mass times velocity \u2014 a measure of how hard something is to stop. A lorry at walking pace and a bullet carry comparable momentum for very different reasons.", why: "It is why mass and speed both matter in a collision, which neither quantity explains alone." },
    { method: "Momentum is conserved", teach: "In any collision the total momentum before equals the total after, provided nothing external pushes. That single statement solves collisions without knowing anything about the forces involved.", why: "The forces during an impact are impossible to measure; conservation lets you skip them entirely." },
    { method: "Direction carries a sign", teach: "Momentum is a vector, so opposite directions get opposite signs. Two equal objects meeting head-on have a total momentum of zero, and both can stop dead without breaking conservation.", why: "Adding magnitudes without signs makes head-on collisions look impossible, and the sign is what resolves it." }
  ],
  accel: [
    { method: "Change in velocity over time", teach: "Acceleration is how fast the velocity changes \u2014 the change divided by the time it took. Steady speed means zero acceleration however fast you are going.", why: "Speed and acceleration are constantly confused, and this is the distinction." },
    { method: "Using v = u + at", teach: "Rearranged, the same relation gives the final velocity, the time, or the acceleration from any three of them.", why: "It is the equation for questions that mention a time, and recognising that is half of choosing correctly." },
    { method: "When no time is given", teach: "v\u00B2 = u\u00B2 + 2as has no time in it, so it answers questions that never mention one. Choosing between the equations is really about spotting which quantity is missing.", why: "Trying to force a time-based equation into a question with no time is where these get stuck." }
  ],
  waves: [
    { method: "Speed = frequency \u00D7 wavelength", teach: "The wave equation ties the three together: v = f\u03BB. Hz \u00D7 m gives m/s, so the units confirm the arrangement.", why: "It is the one relation that applies to every wave, from sound to gamma rays." },
    { method: "Rearranging for wavelength or frequency", teach: "Wavelength is v \u00F7 f and frequency is v \u00F7 \u03BB. In a fixed material the speed is constant, so the two trade off against each other exactly.", why: "The speed is usually the known quantity and the other two are what you are asked for." },
    { method: "Watching the prefixes", teach: "Frequencies arrive in kHz and MHz and wavelengths in nm \u2014 convert to hertz and metres before substituting. A megahertz is a million, and forgetting that misses the answer by six orders of magnitude.", why: "The physics is one line and the prefix is where the answer is actually won or lost." }
  ],
  "formula-mass": [
    { method: "Adding the atomic masses", teach: "The relative formula mass is the sum of the atomic masses of every atom in the formula. H\u2082O is 1 + 1 + 16 = 18.", why: "It is the number every mole calculation starts from, so an error here poisons everything downstream." },
    { method: "Handling subscripts", teach: "A subscript multiplies only the atom it follows, so CaCl\u2082 is 40 + 2\u00D735, not 2\u00D7(40+35). Read the formula one atom at a time.", why: "Multiplying the whole formula instead of one atom is the mistake, and it produces a plausible number." },
    { method: "Brackets multiply everything inside", teach: "In Ca(OH)\u2082 the subscript applies to both atoms in the bracket \u2014 that is two oxygens and two hydrogens, giving 40 + 2\u00D7(16+1) = 74.", why: "Brackets are the case where a subscript legitimately multiplies more than one atom, and it looks like the mistake you were just told to avoid." }
  ],
  "percent-yield": [
    { method: "Actual over theoretical", teach: "Percentage yield is what you actually got divided by what the equation says you should have, times 100. It can never exceed 100%.", why: "It is the measure of how well a real reaction matched the theory, which is what the calculation is for." },
    { method: "Finding the theoretical yield first", teach: "The theoretical yield comes from the balanced equation and the limiting reactant \u2014 you have to calculate it before the percentage means anything.", why: "Most of the work is in the theoretical figure; the percentage itself is one division at the end." },
    { method: "Why yield is never 100%", teach: "Product is lost transferring between containers, some reactions reverse, and side reactions make something else. A yield above 100% means impurities or water, not a better-than-perfect reaction.", why: "The number is only useful if you know what makes it fall short, and an impossible value is a diagnosis." }
  ],
  halflife: [
    { method: "Halving each time", teach: "A half-life is how long it takes for half the nuclei to decay. After two half-lives a quarter remains, after three an eighth \u2014 you halve, you do not subtract.", why: "Subtracting a fixed amount each time reaches zero; halving never does, and that difference is the whole behaviour." },
    { method: "Counting half-lives from the time", teach: "Divide the elapsed time by the half-life to get how many halvings have happened, then halve that many times.", why: "It turns any elapsed time into a number of steps, which is what makes the arithmetic possible." },
    { method: "Working backwards to the half-life", teach: "Given a before and after count, work out how many halvings that ratio represents, then divide the elapsed time by that number.", why: "Half-life is usually what you are measuring rather than what you are given, so this is the direction real experiments use." }
  ],
  moments: [
    { method: "Force \u00D7 distance from the pivot", teach: "A moment is the turning effect of a force: the force multiplied by its perpendicular distance from the pivot. Further out means more turn for the same push.", why: "It is why door handles are on the far edge, and why a spanner is longer than your hand." },
    { method: "Balancing two moments", teach: "A balanced beam has equal moments each side of the pivot. A small force far out balances a large force close in \u2014 which is what a see-saw and a crowbar both exploit.", why: "It turns a physical intuition into an equation with one unknown." },
    { method: "The distance is perpendicular", teach: "It is the perpendicular distance from the pivot to the line of the force, not the length of the arm. A force pulling along the beam has no moment at all.", why: "Using the arm length when the force is at an angle overstates the moment, and the case of zero moment shows why the distinction is real." }
  ],
  hooke: [
    { method: "Force = spring constant \u00D7 extension", teach: "A spring pulls back in proportion to how far it has been stretched. The spring constant says how stiff it is \u2014 a bigger k means a harder pull for the same stretch.", why: "It makes stiffness a number rather than an impression." },
    { method: "Rearranging for extension or stiffness", teach: "Extension is F \u00F7 k, and k is F \u00F7 x. The constant is usually found by measuring a force and an extension and dividing.", why: "You measure the two easy quantities and calculate the one you actually want." },
    { method: "Energy stored is \u00BDkx\u00B2", teach: "The energy in a stretched spring is \u00BDkx\u00B2, not force \u00D7 distance, because the force grows as you stretch. The half is the average of a force rising from zero.", why: "Using F \u00D7 x doubles the answer, and knowing where the half comes from is what makes it memorable rather than arbitrary." }
  ],
  efficiency: [
    { method: "Useful out over total in", teach: "Efficiency is the fraction of the energy supplied that does the job you wanted. The rest is not destroyed \u2014 it is spread out as heat and sound.", why: "It reframes waste as misplaced energy rather than lost energy, which is what conservation requires." },
    { method: "Finding the wasted energy", teach: "Wasted energy is the total minus the useful part. Working it out is often more revealing than the efficiency itself \u2014 it says how much heat there is to get rid of.", why: "It answers the practical question: how much energy is going somewhere you did not want." },
    { method: "Why nothing is 100% efficient", teach: "Every transfer produces some heat through friction or resistance, so no real machine reaches 100%. A claimed efficiency above 100% means the input was measured wrong, not that the machine is remarkable.", why: "It makes an impossible figure into a diagnosis rather than a surprise." }
  ],
  "gas-volume": [
    { method: "One mole occupies 24 dm\u00B3", teach: "At room temperature and pressure any gas occupies about 24 dm\u00B3 per mole. Volume is moles \u00D7 24, whatever the gas is.", why: "The fact that it does not depend on which gas is the surprising and useful part." },
    { method: "Rearranging for moles", teach: "Moles are volume \u00F7 24. Measuring a gas volume is easy where weighing it is not, so this is the practical direction.", why: "Gas amounts are almost always found from a volume rather than a mass." },
    { method: "Through a balanced equation", teach: "Coefficients give the ratio in moles, and since every gas has the same molar volume, the ratio applies directly to gas volumes too \u2014 the only place a ratio can be used on volumes without converting.", why: "It is a genuine shortcut, and knowing why it works stops it being applied to liquids where it fails." }
  ],
  titration: [
    { method: "Moles from the known solution", teach: "Start with the solution you know completely: moles = concentration \u00D7 volume. That figure is the anchor for everything else.", why: "There is only one place with enough information to start, and finding it is the first decision." },
    { method: "Through the reacting ratio", teach: "The balanced equation gives the ratio between the two solutions. One mole of acid does not always neutralise one mole of alkali \u2014 sulfuric acid needs half as much.", why: "Assuming 1:1 is right often enough to feel safe and wrong exactly when the acid is diprotic." },
    { method: "Back to a concentration", teach: "With the moles of the unknown found, divide by its volume in dm\u00B3 to get its concentration. Burette readings are in cm\u00B3, so that conversion sits in the middle of every titration.", why: "Three steps, and the unit conversion between them is where most of the marks are lost." }
  ],
  empirical: [
    { method: "Masses to moles", teach: "Divide each element's mass by its atomic mass to get moles. The ratio of moles is what the formula records \u2014 the ratio of masses is not.", why: "Using masses directly gives a ratio that means nothing, and this conversion is the whole method." },
    { method: "Dividing by the smallest", teach: "Divide every mole figure by the smallest of them. That turns the ratio into whole numbers starting from one.", why: "It is the step that converts a ratio into a formula you can write down." },
    { method: "When the ratio is not whole", teach: "If you get 1 : 1.5, multiply everything by 2 rather than rounding. Rounding 1.5 to 2 gives a different compound entirely.", why: "The temptation to round is strong and it silently changes the substance, which is why doubling is the rule." }
  ],
  parallel: [
    { method: "Voltage is the same across each branch", teach: "Components in parallel each sit across the full supply voltage. Adding a second bulb does not dim the first, unlike in series.", why: "It explains why household wiring is parallel \u2014 every appliance gets the full voltage regardless of what else is on." },
    { method: "Currents add at a junction", teach: "The current from the supply splits between the branches and recombines afterwards. Whatever flows in flows out.", why: "It is conservation of charge, and it is how the total current is found without knowing anything about the individual paths." },
    { method: "Total resistance falls", teach: "Adding a parallel branch gives current another route, so the total resistance goes DOWN \u2014 below even the smallest single resistor. Two 10 \u03A9 resistors in parallel give 5 \u03A9.", why: "It is counterintuitive: adding a component reduces resistance, which is the opposite of series and the reason circuits overload." }
  ],
  "elec-cost": [
    { method: "Units are kilowatt-hours", teach: "Electricity is billed in kilowatt-hours: a kilowatt running for an hour. Multiply the power in kW by the hours to get the units used.", why: "It is a unit of energy built from a power and a time, which is why the arithmetic is so simple once the units match." },
    { method: "Converting watts and minutes", teach: "Appliances are rated in watts and used for minutes, so convert before multiplying \u2014 divide watts by 1000 and minutes by 60.", why: "The formula is trivial and the conversion is where the answer is decided." },
    { method: "From voltage and current instead", teach: "If the power is not given, find it first: P = VI. A 230 V appliance drawing 5 A is 1150 W, or 1.15 kW.", why: "The rating plate does not always give watts, and this is the route in when it does not." }
  ],
  "gas-laws": [
    { method: "Pressure and volume trade off", teach: "At a steady temperature, squeezing a gas into half the space doubles its pressure. The product pV stays the same.", why: "It is the first gas relation, and the constant product is what makes it calculable." },
    { method: "Using p\u2081V\u2081 = p\u2082V\u2082", teach: "Since the product is unchanged, the before and after states can be equated directly \u2014 no need to know what the constant actually is.", why: "It answers the question without ever computing the constant, which is the practical form." },
    { method: "Only at constant temperature", teach: "Boyle's law holds only if the temperature does not change. Compress a gas quickly and it warms, so the pressure rises by more than pV = constant predicts.", why: "The condition is stated once and forgotten, and it is exactly what makes a bicycle pump get hot." }
  ],
  rates: [
    { method: "Amount over time", teach: "A rate of reaction is how much is used up or made each second. Measure a volume of gas or a loss of mass and divide by the time.", why: "It turns \"fast\" and \"slow\" into a number that can be compared." },
    { method: "What makes it faster", teach: "Anything that makes collisions more frequent or more energetic speeds a reaction up: higher concentration, higher temperature, smaller pieces, a catalyst.", why: "One idea \u2014 collisions \u2014 explains four separate factors, which is far easier than four rules." },
    { method: "Why the rate falls as it goes", teach: "The rate is fastest at the start and slows as reactants are used up, because there is less left to collide. A rate quoted without a time is an average, not the rate at any moment.", why: "The graph curves, and treating the average as constant misreads every point on it." }
  ],
  reflection: [
    { method: "The angles are equal", teach: "Light reflects at the same angle it arrived, both measured from the normal \u2014 the line perpendicular to the surface, not the surface itself.", why: "Measuring from the surface gives the complement and every answer is wrong by the same amount." },
    { method: "Refraction bends toward the normal", teach: "Entering a denser material light slows and bends toward the normal; leaving, it speeds up and bends away.", why: "It explains the broken-looking straw, and the direction follows from the speed change rather than needing to be memorised." },
    { method: "Snell's law", teach: "n = sin(i) \u00F7 sin(r) ties the angles to the refractive index, so any one of the three gives the others. The refracted angle is always smaller going into a denser material \u2014 a useful sanity check.", why: "It makes refraction calculable rather than descriptive, and the check catches a sine taken the wrong way round." }
  ],
  isotopes: [
    { method: "Protons decide the element", teach: "The number of protons is what makes an atom that element. Change it and you have a different substance entirely.", why: "It is the fact the whole periodic table is ordered by." },
    { method: "Neutrons can vary", teach: "Atoms of one element with different neutron counts are isotopes. Carbon-12 and carbon-14 are both carbon; they differ by two neutrons and nothing else.", why: "It separates identity from mass, which is what makes radioactive dating and mass numbers make sense." },
    { method: "Electrons decide the charge", teach: "A neutral atom has as many electrons as protons. Lose one and you have a positive ion; gain one and it is negative \u2014 the element is unchanged either way.", why: "Three particles, three different jobs, and confusing which does what is the root of most structure errors." }
  ],
  bonding: [
    { method: "Atoms want a full outer shell", teach: "Bonding happens because a full outer shell is stable. Every bond is an atom solving that problem \u2014 by giving, taking, or sharing.", why: "One motivation explains every bond type, rather than three unrelated rules." },
    { method: "Metal plus non-metal is ionic", teach: "A metal gives electrons away and a non-metal takes them, leaving charged ions that attract. Two non-metals share instead, which is covalent.", why: "The elements involved predict the bond, so you can tell before knowing anything else about the substance." },
    { method: "Properties follow from the bonding", teach: "Ionic solids conduct only when melted, because the ions must be free to move. Simple covalent substances never conduct. The bonding is not a label \u2014 it predicts the behaviour.", why: "It turns a classification into something with consequences you can test." }
  ],
  electrolysis: [
    { method: "Opposites attract", teach: "Positive ions travel to the negative electrode and negative ions to the positive one. That single rule decides what forms where.", why: "Everything else in the topic is an application of it." },
    { method: "Naming the products", teach: "Metal ions are positive, so metals form at the negative electrode. Non-metal ions are negative, so they form at the positive one.", why: "It turns the rule into a prediction about a specific substance." },
    { method: "Why it must be molten or dissolved", teach: "Electrolysis needs the ions to move. In a solid lattice they are locked in place \u2014 the ions are there, but nothing can travel to an electrode.", why: "It explains a condition that otherwise looks like an arbitrary requirement of the apparatus." }
  ],
  "circuits-basic": [
    { method: "A circuit must be complete", teach: "Current only flows if there is an unbroken loop from one end of the cell to the other. A gap anywhere stops it everywhere.", why: "It is why one switch controls the whole loop, and why a single break turns everything off." },
    { method: "Series and parallel", teach: "In series there is one path and everything shares it. In parallel there are branches, and each gets the full voltage.", why: "The two arrangements behave differently in almost every respect, so telling them apart comes first." },
    { method: "What a switch and a break have in common", teach: "An open switch and a broken wire are the same thing to the circuit \u2014 both are a gap. A circuit does not know the difference between deliberate and accidental.", why: "It reframes a switch as a controlled break rather than a special component." }
  ],
  "forces-basic": [
    { method: "Forces are pushes and pulls", teach: "A force is a push or a pull on an object. It always comes from something else \u2014 there is no force without something applying it.", why: "It grounds the idea in something you can feel before any arithmetic arrives." },
    { method: "Forces have direction", teach: "Which way a force acts matters as much as how big it is. Two forces the same size in opposite directions cancel out entirely.", why: "Direction is what turns forces from numbers into something that can balance." },
    { method: "Balanced means no change", teach: "When forces balance, the motion does not change \u2014 something still stays still, and something moving keeps moving. Only unbalanced forces cause a change.", why: "The intuition that motion needs a continuing force is wrong, and this is where it gets corrected." }
  ],
  states: [
    { method: "Arrangement of the particles", teach: "In a solid particles are packed and fixed, in a liquid they touch but slide, and in a gas they are far apart and move freely.", why: "One picture explains why solids hold shape, liquids pour and gases fill a room." },
    { method: "Changing state", teach: "Heating gives particles energy to break free: solid to liquid to gas. Cooling reverses it. The particles themselves never change \u2014 only their arrangement does.", why: "It makes melting and boiling one idea rather than two facts." },
    { method: "Mass is conserved through a change", teach: "Ice melting into water weighs exactly the same. Nothing is added or removed \u2014 the particles are the same particles in a different arrangement.", why: "The intuition that a gas weighs nothing is strong and wrong, and this corrects it." }
  ],
  separating: [
    { method: "Filtering what has not dissolved", teach: "A solid that has not dissolved can be caught by filter paper while the liquid passes through. Dissolved substances go straight through with it.", why: "Whether something dissolved decides the method entirely, so that question comes first." },
    { method: "Evaporating and distilling", teach: "To recover a dissolved solid, evaporate the liquid. To recover the liquid instead, distil it \u2014 boil it off and condense it somewhere else.", why: "Same mixture, two different methods, chosen by which part you actually want to keep." },
    { method: "Choosing by what differs", teach: "The method follows from the difference between the parts: solubility for filtering, boiling point for distilling, attraction to paper for chromatography.", why: "It replaces a list of techniques with one question \u2014 what is different about these substances?" }
  ],
  projectile: [
    { method: "Falling from rest", teach: "A dropped object falls h = \u00BDgt\u00B2. The distance grows with the SQUARE of the time, so the second second covers three times what the first did.", why: "It is the base case, and the squaring is what makes falling feel like it accelerates." },
    { method: "Finding the time of flight", teach: "Rearranged, t = \u221A(2h/g). Only the vertical drop decides how long something is in the air \u2014 sideways speed makes no difference at all.", why: "A bullet fired level and one dropped hit the ground together, which is the single most surprising fact here." },
    { method: "The two directions are independent", teach: "Get the time from the vertical drop, then use it horizontally: distance = u \u00D7 t. Sideways there is no acceleration, so it is steady speed throughout.", why: "Treating it as one diagonal motion makes it impossible; splitting it makes it two easy problems." }
  ],
  circular: [
    { method: "Acceleration toward the centre", teach: "Moving in a circle at steady speed is still accelerating, because the direction keeps changing. That acceleration is v\u00B2/r and points at the centre.", why: "Constant speed and constant velocity are different, and this is where that distinction earns its keep." },
    { method: "The force that provides it", teach: "F = mv\u00B2/r is the force needed to keep something turning. Something real must supply it \u2014 friction, tension, gravity.", why: "There is no outward force throwing you out of a bend; there is an inward force failing to be enough." },
    { method: "When the mass cancels", teach: "For a skidding car, friction supplies \u03BCmg and the requirement is mv\u00B2/r \u2014 the mass appears on both sides and cancels. A loaded lorry and an empty one skid at the same speed.", why: "The cancellation contradicts the intuition that heavier means more grip, and seeing it is the point of the algebra." }
  ],
  equilibrium: [
    { method: "Both directions happen at once", teach: "At equilibrium the forward and backward reactions are both still running \u2014 they simply run at the same rate, so the amounts stop changing.", why: "Equilibrium looks like nothing happening and is the opposite, which is the fact everything else depends on." },
    { method: "Le Chatelier's principle", teach: "Change a condition and the position shifts to oppose the change. Add heat and the endothermic direction is favoured; add pressure and the side with fewer gas molecules wins.", why: "One principle predicts every shift, rather than a table of cases to memorise." },
    { method: "Counting the molecules", teach: "For pressure, count gas molecules on each side. N\u2082 + 3H\u2082 \u21CC 2NH\u2083 has four on the left and two on the right, so pressure favours ammonia.", why: "The rule is only usable once you know which side is which, and counting is the step that gets skipped." }
  ],
  enthalpy: [
    { method: "Bonds broken minus bonds made", teach: "Breaking bonds takes energy in; making them gives energy out. The overall change is broken minus made.", why: "It reduces every energy calculation to one subtraction in the right order." },
    { method: "Reading the sign", teach: "A negative answer means more energy came out than went in \u2014 exothermic. Positive means endothermic. The sign is the result, not a detail.", why: "The number without the sign says nothing about whether the reaction warms or cools its surroundings." },
    { method: "Counting the bonds carefully", teach: "Every bond in every molecule counts. Water has two O\u2013H bonds, not one, so 2H\u2082O means four of them.", why: "The arithmetic is easy and the counting is where it goes wrong, particularly in the products." }
  ],
  organic: [
    { method: "The general formulas", teach: "Alkanes are C\u2099H\u2082\u2099\u208A\u2082 and alkenes are C\u2099H\u2082\u2099. Two fewer hydrogens is what makes room for the double bond.", why: "Two formulas cover every member of both families." },
    { method: "Naming from the carbon count", teach: "Meth-, eth-, prop-, but- give one to four carbons, and the ending says which family. Butene has four carbons and a double bond.", why: "The name encodes the structure, so it can be read rather than looked up." },
    { method: "Why the double bond matters", teach: "An alkene's double bond can open and add atoms across it, which alkanes cannot do. That is why bromine water decolorises with an alkene and not an alkane.", why: "It turns a structural difference into a test you can perform, which is what makes the distinction real." }
  ],
  periodic: [
    { method: "Ordered by proton number", teach: "Elements are arranged in order of how many protons they have. That order is what puts similar elements underneath each other.", why: "The arrangement is not arbitrary, and knowing what orders it makes the patterns predictable." },
    { method: "Groups share outer electrons", teach: "A group is a column, and everything in it has the same number of outer electrons \u2014 which is why they react in the same way.", why: "It connects position on the table to chemical behaviour, which is the table's whole purpose." },
    { method: "Trends run opposite ways", teach: "Group 1 gets MORE reactive down the group because the outer electron is easier to lose. Group 7 gets LESS reactive down, because gaining one gets harder at a distance.", why: "Same cause \u2014 distance from the nucleus \u2014 producing opposite trends, which only makes sense once you ask whether the atom is losing or gaining." }
  ],
  nuclear: [
    { method: "Splitting and joining", teach: "Fission splits a heavy nucleus into lighter ones; fusion joins light nuclei into a heavier one. Both release energy.", why: "Two opposite processes both giving out energy is the puzzle the rest of the topic resolves." },
    { method: "Why a chain reaction continues", teach: "Each fission releases spare neutrons, which strike other nuclei and split them too. That is the chain \u2014 the reaction supplies its own trigger.", why: "It explains both a reactor and a bomb, differing only in whether the chain is controlled." },
    { method: "Why fusion is hard on Earth", teach: "Both nuclei are positive and repel fiercely. Only enormous temperature and pressure force them close enough \u2014 conditions the Sun's gravity provides and we struggle to.", why: "It answers the obvious question of why we use the harder-to-fuel process, and the answer is not about fuel at all." }
  ],
  "decay-types": [
    { method: "What each one is", teach: "Alpha is a helium nucleus, beta is a fast electron, gamma is an electromagnetic wave with no mass or charge.", why: "Three different things with three different behaviours, and the identity predicts the rest." },
    { method: "Penetration and ionisation", teach: "The more ionising a radiation, the sooner it gives up its energy and the less far it travels. Alpha is stopped by paper, beta by aluminium, gamma needs thick lead.", why: "One relationship explains the whole absorption table rather than three separate facts." },
    { method: "Which is most dangerous depends on where", teach: "Inside the body alpha is worst, because it is most ionising and nothing blocks it. Outside, alpha cannot even cross skin, so gamma is the danger.", why: "The same three options give opposite answers depending on the source's position, which is the point worth taking away." }
  ],
  magnetism: [
    { method: "A current makes a field", teach: "Any current has a magnetic field around it. Coil the wire and the field concentrates inside the coil; add an iron core and it strengthens again.", why: "It links electricity and magnetism, which look like separate subjects until this." },
    { method: "What makes it stronger", teach: "More turns, more current, or an iron core. Simply using a longer wire at the same current adds resistance and helps nothing.", why: "It separates the changes that matter from the ones that only look like they should." },
    { method: "The advantage over a permanent magnet", teach: "Switch the current off and the magnetism goes. That is the whole point \u2014 a crane can pick up scrap and then drop it.", why: "Being switchable is what makes electromagnets useful, and it is not a property a bar magnet can have." }
  ],
  capacitor: [
    { method: "Charge = capacitance \u00D7 voltage", teach: "A capacitor stores charge in proportion to the voltage across it. Capacitance is how much it holds per volt.", why: "It defines the quantity and makes the rest calculable." },
    { method: "Energy is \u00BDQV", teach: "The stored energy is \u00BDQV, not QV \u2014 the same factor of a half as a spring, and for the same reason: the voltage climbs as the charge builds, so the average is half the final value.", why: "The half is not arbitrary, and seeing it come from an average makes it stick." },
    { method: "The time constant RC", teach: "Discharging through a resistor, the charge falls to about 37% of its value after RC seconds. Bigger capacitance or bigger resistance means slower discharge.", why: "It is what makes capacitors useful for timing, and the 37% is where the exponential shows itself." }
  ],
  efield: [
    { method: "Field strength between plates", teach: "Between two parallel plates the field is uniform, and its strength is simply the voltage divided by the gap.", why: "A uniform field is the simplest case, and it makes the definition arithmetic rather than abstract." },
    { method: "Rearranging for voltage or separation", teach: "Voltage is E \u00D7 d, and the gap is V \u00F7 E. Halving the separation doubles the field for the same voltage.", why: "It explains why small gaps break down first, which is why high-voltage equipment is spaced widely." },
    { method: "Force on a charge", teach: "A charge in the field feels F = qE, whichever way the plates are turned. Find the field first, then the force \u2014 two steps, and the charge is usually in microcoulombs.", why: "It connects the field to something measurable, and the unit conversion is where the answer is decided." }
  ],
  idealgas: [
    { method: "pV = nRT", teach: "One relation ties pressure, volume, amount and temperature together, with R the same for every gas.", why: "It replaces several separate gas laws with one, and each of those is a special case of it." },
    { method: "Rearranging for any quantity", teach: "Any three of the four give the fourth. p = nRT/V, V = nRT/p, n = pV/RT.", why: "The question decides which arrangement, and there is only one relation to remember." },
    { method: "Temperature must be in kelvin", teach: "The equation assumes a scale starting at absolute zero, so Celsius will not do. Add 273 before substituting \u2014 this is the single most common way to get these wrong.", why: "Using Celsius gives a plausible number that is badly wrong, and nothing in the arithmetic flags it." }
  ],
  gibbs: [
    { method: "\u0394G = \u0394H \u2212 T\u0394S", teach: "Feasibility depends on both the enthalpy change and the entropy change, with temperature weighting the second.", why: "Enthalpy alone predicts the wrong answer for a whole class of reactions, and this is why." },
    { method: "Reading the sign", teach: "A reaction is feasible when \u0394G is negative. Positive means it will not go on its own, however long you wait.", why: "The sign is the answer; the magnitude is a detail." },
    { method: "Finding the temperature where it turns", teach: "Set \u0394G to zero and solve for T. Above that temperature the entropy term outweighs the enthalpy and the reaction becomes feasible.", why: "It explains why some reactions need heating to start rather than merely going faster when hot." }
  ],
  "decay-equations": [
    { method: "Mass numbers balance", teach: "The total mass number is the same before and after. Alpha decay removes 4; beta decay removes none.", why: "It is half of the check, and the half that is easiest to apply." },
    { method: "Proton numbers balance too", teach: "The proton numbers must balance separately. Alpha takes 2 away; beta ADDS one, because a neutron became a proton.", why: "Beta adding a proton is the counterintuitive part, and it follows from what a neutron turns into." },
    { method: "Several decays in sequence", teach: "Handle each type separately: count all the alphas, then all the betas. They change different things, so they cannot be combined into one step.", why: "Decay chains are the realistic case, and trying to net them out in one go loses track of which number changed." }
  ],
  "electron-config": [
    { method: "Filling from the inside", teach: "Electrons fill shells from the inside out: 2 in the first, then 8, then 8. Nothing goes further out until the inner shell is full.", why: "One rule generates the arrangement for every light element." },
    { method: "The outer count is the group", teach: "However many electrons end up in the outer shell is the element's group number \u2014 which is why the table is laid out as it is.", why: "It ties arrangement to position, and position to behaviour." },
    { method: "Why a full shell means unreactive", teach: "Reacting means gaining, losing or sharing outer electrons. A full outer shell has nothing to gain from any of them, which is why the noble gases sit out.", why: "It explains an entire group's behaviour from the arrangement alone." }
  ],
  "equilibrium-forces": [
    { method: "Balancing moments about a pivot", teach: "A balanced beam has equal moments each side. Force times distance one way equals force times distance the other.", why: "It is the calculable form of a see-saw, and one unknown falls out of it." },
    { method: "Choosing the point to take moments about", teach: "Take moments about a point where an unknown force acts \u2014 that force has zero distance, so it drops out of the equation entirely.", why: "Choosing well turns two unknowns into one, and choosing badly leaves a problem you cannot solve." },
    { method: "Equilibrium needs both conditions", teach: "No resultant force AND no resultant moment. Two equal opposite forces along different lines cancel out and still cause rotation.", why: "Checking only the forces misses a whole class of motion, and the couple is the case that proves it." }
  ],
  "power-energy": [
    { method: "Power is force \u00D7 speed", teach: "At a constant speed, the power delivered is the driving force times the speed \u2014 the force does F joules of work every metre.", why: "It connects power to something you can feel, rather than only to energy and time." },
    { method: "Rearranging for the force", teach: "F = P \u00F7 v. At higher speed the same engine gives less force, which is exactly why a car changes gear.", why: "It explains a familiar experience with one rearrangement." },
    { method: "Combining with efficiency", teach: "Multiply the power by the time for the total energy, then by the efficiency for the useful part. The rest leaves as heat.", why: "Two ideas together is what a real question asks, and keeping them in order is the method." }
  ],
  interference: [
    { method: "Displacements add", teach: "Where two waves meet, their displacements add at every instant. In step they reinforce; out of step they partly or wholly cancel.", why: "Superposition is one rule, and constructive and destructive are just two cases of it." },
    { method: "Equal amplitudes cancel completely", teach: "Out of step, the amplitudes subtract. They only cancel to nothing if they were equal in the first place.", why: "Complete cancellation is a special case, and expecting it always is why interference patterns look wrong at first." },
    { method: "Path difference decides which", teach: "A whole number of wavelengths means the waves arrive in step \u2014 constructive. A half-number means exactly out of step \u2014 destructive.", why: "It turns interference from something observed into something predictable from a distance measurement." }
  ],
  "energy-transfer": [
    { method: "Naming the stores", teach: "Energy sits in stores \u2014 movement, gravity, chemical, thermal \u2014 and transfers move it between them. Naming both ends is what makes a transfer describable.", why: "Vague talk of energy 'being used' hides where it went, and naming the stores is what stops that." },
    { method: "Wasted energy is the difference", teach: "Everything that goes in comes out somewhere. The useful part is what you wanted; the rest is usually heat.", why: "It applies conservation to a real machine, where 'lost' energy is only ever mislaid." },
    { method: "Efficiency as a percentage", teach: "The useful fraction, times 100. A 20% efficient machine sends four-fifths of its energy somewhere you did not want it.", why: "It turns the transfer into a single number that can be compared between machines." }
  ],
  "balanced-forces": [
    { method: "Adding forces in a line", teach: "Forces in the same direction add; opposing forces subtract. What is left over is the resultant.", why: "It reduces several forces to one, which is the only form the rest of mechanics can use." },
    { method: "Balanced means no change", teach: "A zero resultant means the motion does not change. Still stays still; moving keeps moving at the same speed in the same direction.", why: "It corrects the intuition that motion requires a continuing push." },
    { method: "Reading motion backwards to the forces", teach: "A car at steady speed and a parachutist at terminal velocity both have zero resultant force. Constant velocity is the evidence, and balance is the conclusion.", why: "Working from observed motion to the forces is what the topic is actually for, and it is the reverse of every earlier question." }
  ],
  moving: [
    { method: "Same time, compare the distance", teach: "If two things travel for the same length of time, the one that gets further was going faster. Nothing needs calculating.", why: "It is the simplest fair comparison, and it works because one of the two things is held the same." },
    { method: "Same distance, compare the time", teach: "If two things cover the same distance, the one that took less time was faster. Again only one quantity differs.", why: "The mirror image of the first, and together they cover every comparison where something is held fixed." },
    { method: "When both differ, find the speed", teach: "If the distances AND the times are different, work out how far each would go in one hour. Now they can be compared directly.", why: "Neither shortcut applies, and reducing both to the same basis is what speed actually is." }
  ],
  "energy-basic": [
    { method: "Energy makes things happen", teach: "Anything moving, heating or lighting has energy doing it. A battery, a stretched elastic band and a raised weight all hold energy ready to be used.", why: "It gives the word a meaning you can point at before any arithmetic." },
    { method: "Energy changes form", teach: "A torch turns chemical energy into light. A falling ball turns height into movement. Energy does not appear or vanish \u2014 it becomes something else.", why: "Changing form is the whole behaviour, and naming both ends is what makes it visible." },
    { method: "Where the energy went", teach: "A rolling ball stops, but its energy is not destroyed \u2014 it warmed the ground and the air very slightly. Energy is never lost, only spread out where it is hard to notice.", why: "'It disappeared' is the natural conclusion and the wrong one, and correcting it early prevents a lot of later confusion." }
  ],
  "sound-basic": [
    { method: "Sound starts with a vibration", teach: "Everything that makes a sound is shaking. Touch a speaker while it plays and you can feel it.", why: "It replaces sound as a mystery with something you can detect by hand." },
    { method: "Something has to carry it", teach: "The vibration travels through air to your ear. In space there is no air, so there is nothing to carry it and no sound at all.", why: "It explains a fact that sounds like science fiction and is simply about what is in the way." },
    { method: "Faster vibration, higher note", teach: "Tighten a guitar string and it vibrates faster, giving a higher note. How hard you pluck it changes the loudness instead.", why: "Two properties of the same vibration doing two different jobs, which is where pitch and volume stop being confused." }
  ],
  mixtures: [
    { method: "Dissolving is not disappearing", teach: "Sugar stirred into water is still there \u2014 broken into pieces too small to see. Taste it and the sugar is obvious.", why: "Invisible and gone feel like the same thing at this age, and they are not." },
    { method: "Getting it back", teach: "Let the water evaporate and the sugar is left behind. It never stopped being sugar, so it can always be recovered.", why: "Recovery is the proof that nothing was destroyed, which is stronger than being told." },
    { method: "The mass adds up", teach: "100 g of water plus 10 g of sugar makes 110 g of solution. Nothing left the glass, so nothing can be missing.", why: "It turns a qualitative idea into a number that can be checked on a balance." }
  ],
  solubility: [
    { method: "Scaling the solubility", teach: "Solubility is quoted per 100 g of water, so scale it to the amount you have. Twice the water dissolves twice the solid.", why: "It makes a table figure usable for any quantity." },
    { method: "Finding what is left over", teach: "Work out the maximum that can dissolve, then compare with how much was added. Anything past the limit stays solid however long you stir.", why: "It answers the practical question rather than the definitional one." },
    { method: "What actually sets the limit", teach: "Temperature sets the limit; stirring only makes dissolving faster. Cool a saturated solution and solid comes back out, because the limit fell.", why: "Stirring harder feels like it should help and cannot, and knowing why stops the effort being wasted." }
  ],
  dilution: [
    { method: "More water, less concentrated", teach: "Adding water does not change how much solute there is \u2014 only how spread out it is. Double the volume and the concentration halves.", why: "The solute staying constant is the fact everything else follows from." },
    { method: "Using c\u2081V\u2081 = c\u2082V\u2082", teach: "Since the moles are unchanged, the concentration times volume is the same before and after. Any three of the four give the fourth.", why: "It skips calculating the moles at all, which is the shortcut that makes dilution quick." },
    { method: "Working back to the stock", teach: "To make up a solution, start from the moles you need and divide by the stock's concentration. That gives the volume of stock to measure out, then top up with water.", why: "It is the direction used in a lab, and starting from the volumes instead is what gets it backwards." }
  ],
  "weight-mass": [
    { method: "Mass never changes", teach: "Mass is how much matter something is made of. Take it to the Moon, or to space, and it is exactly the same.", why: "It is the fixed quantity, and knowing which one does not move is the whole distinction." },
    { method: "Weight is a force", teach: "Weight is gravity pulling on that mass: W = mg. It is measured in newtons, because it is a force, not an amount of stuff.", why: "The everyday use of 'weight' for mass is what makes this confusing, and the unit is the giveaway." },
    { method: "Same mass, different weight", teach: "On the Moon g is 1.6 rather than 10, so the same object weighs about a sixth as much while its mass is untouched.", why: "It is the case that forces the two ideas apart, and nothing else does it as clearly." }
  ],
  "mass-conc": [
    { method: "Grams per litre", teach: "Concentration can be quoted as a mass in each litre \u2014 mass divided by volume, exactly like density.", why: "It is the form used on labels, and it needs no chemistry to understand." },
    { method: "Converting to moles per litre", teach: "Divide grams per litre by the relative formula mass. It is the same mass-to-moles conversion, applied to every litre at once.", why: "Reactions work in moles, so this is the bridge from what is written on a bottle to what a calculation needs." },
    { method: "Working back to a mass", teach: "To make a solution, find the moles you need, then multiply by Mr to get the mass to weigh out.", why: "It is the direction actually used at a bench, and it chains the two conversions in reverse." }
  ],
  background: [
    { method: "Radiation is always present", teach: "Rocks, cosmic rays, food and medical sources all contribute a low level of radiation everywhere, all the time.", why: "It reframes radiation as ordinary background rather than something only present near a source." },
    { method: "Subtract it from a reading", teach: "A counter near a source measures both. Take the background off to get the source's own count rate.", why: "Without it every source looks stronger than it is, by whatever the background happened to be." },
    { method: "Subtract before comparing readings", teach: "For a half-life, subtract the background from BOTH readings before working out the ratio. The background does not halve, so leaving it in distorts the comparison entirely.", why: "The subtraction feels like a detail and it changes the answer, because a constant offset ruins a ratio." }
  ],
  "wave-props": [
    { method: "Counting waves per second", teach: "Frequency is how many waves pass a point each second, measured in hertz. A hertz IS one wave per second \u2014 the unit is the definition.", why: "It makes the quantity concrete before any formula arrives." },
    { method: "Period is the other way round", teach: "The period is the time for one wave, so frequency and period are reciprocals: f = 1/T.", why: "Two ways of measuring the same thing, and questions give whichever is easier to measure." },
    { method: "Amplitude is separate", teach: "Amplitude is how far the wave moves from rest, and it carries the energy. It is independent of frequency \u2014 a loud low note and a quiet low note share a wavelength.", why: "Loudness and pitch get confused constantly, and they are carried by different properties." }
  ],
  "em-spectrum": [
    { method: "One speed for all of them", teach: "Every electromagnetic wave travels at 3.0 \u00D7 10\u2078 m/s in a vacuum, from radio to gamma. Only wavelength and frequency differ.", why: "The shared speed is what makes the whole spectrum one family rather than seven unrelated things." },
    { method: "Wavelength and frequency trade off", teach: "Since the product is fixed, longer wavelength always means lower frequency. Radio is long and low; gamma is short and high.", why: "One relationship orders the entire spectrum, so the order never has to be memorised." },
    { method: "Calculating one from the other", teach: "\u03BB = c \u00F7 f, and f = c \u00F7 \u03BB. The numbers are large or tiny, so standard form and prefixes are where the care is needed.", why: "The physics is one division and the powers of ten are what decide whether it is right." }
  ],
  sound: [
    { method: "Sound is longitudinal", teach: "The particles vibrate along the direction the wave travels, not across it. It needs a material to travel through, which is why space is silent.", why: "It distinguishes sound from light at the level of what is actually moving." },
    { method: "Echoes travel twice", teach: "An echo covers the distance to the wall and back, so the wall is half the total distance the sound travelled.", why: "Forgetting the return trip doubles the answer, and it is the most common error with echoes." },
    { method: "The wave equation applies", teach: "v = f\u03BB works for sound exactly as for light \u2014 only the speed differs, at around 340 m/s in air rather than 3 \u00D7 10\u2078.", why: "It shows the earlier wave work was not about light specifically, which is the point of having a general equation." }
  ],
  "acids-bases": [
    { method: "What acids and bases are", teach: "An acid donates hydrogen ions and a base accepts them. The pH scale is measuring exactly that \u2014 how many H+ are loose in the solution.", why: "It connects the scale you can measure to the thing that is actually happening." },
    { method: "Predicting the products", teach: "Acid plus alkali gives salt and water. Acid plus carbonate gives salt, water and carbon dioxide. The extra gas is the giveaway for a carbonate.", why: "You can write the products before knowing anything about the specific substances, which is what makes the equations predictable." },
    { method: "Calculating a neutralisation", teach: "Use moles: concentration \u00D7 volume gives the moles of acid, the equation gives the ratio, and that gives the alkali needed. A 1:1 ratio at equal concentrations means equal volumes.", why: "It turns a qualitative reaction into the titration calculation that everything in practical chemistry rests on." }
  ],
  reactivity: [
    { method: "Reading the order", teach: "Metals run from potassium at the top to gold at the bottom. Higher means more readily losing electrons.", why: "One ordering is the whole basis of the topic, so knowing it is most of the work." },
    { method: "Predicting displacement", teach: "A metal displaces another from its compound only if it is higher in the series. If it is lower, nothing happens at all \u2014 which is a real answer.", why: "A reaction that does not occur is as informative as one that does, and the earlier tier cannot produce that answer." },
    { method: "Explaining extraction and corrosion", teach: "Reactive metals are always found combined and need electrolysis to extract. Unreactive ones like gold are found pure and need only digging up.", why: "The same ordering explains where metals come from and why some corrode, which is what makes it worth memorising." }
  ],
  "giant-structures": [
    { method: "Bonding that does not stop", teach: "In a giant structure the bonds continue through the whole solid rather than ending at a molecule, so melting means breaking all of them.", why: "It explains enormous melting points without needing any new idea beyond bond strength." },
    { method: "Structure explains properties", teach: "Graphite conducts because each carbon uses only three of its four bonds, leaving an electron free. Diamond uses all four, so nothing moves.", why: "Two forms of the same element behaving oppositely shows the structure is doing the work, not the element." },
    { method: "When ions can move", teach: "Ionic solids conduct only when melted or dissolved, because the ions must be free to travel. They were always present in the solid \u2014 what changed is mobility.", why: "The natural conclusion is that the solid has no ions, and correcting that is the point of the tier." }
  ],
  limiting: [
    { method: "One runs out first", teach: "When two reactants meet, one is used up before the other. That one stops the reaction and the rest is left over.", why: "It is the whole idea, and everything else is applying it to numbers." },
    { method: "Comparing against the ratio", teach: "Compare the moles you have against the ratio the equation demands. Having more of something does not make it the excess if the ratio needs more still.", why: "The bigger number is not automatically the excess, which is the trap when the ratio is not 1:1." },
    { method: "Working out the product", teach: "Calculate what EACH reactant alone could produce, then take the smaller answer. That figure is the real yield and it identifies the limiting reactant at the same time.", why: "It answers both questions in one calculation, and it cannot be got wrong by picking the wrong reactant first." }
  ],
  "energy-changes": [
    { method: "Feeling the difference", teach: "A reaction that warms its surroundings is exothermic; one that cools them is endothermic. The tube in your hand tells you which.", why: "It grounds the idea in something observable before any sign convention arrives." },
    { method: "Reading the sign", teach: "\u0394H is measured from the reaction's point of view, so a NEGATIVE value means the reaction lost energy and the surroundings warmed.", why: "The sign feels backwards until you know whose energy it describes, and that is the only difficulty here." },
    { method: "From bond energies", teach: "\u0394H is the energy to break bonds minus the energy released making them. Breaking always costs and making always releases; the balance decides the sign.", why: "It predicts the sign before any experiment, and it shows where the energy actually comes from." }
  ],
  polymers: [
    { method: "Many small units joined", teach: "A polymer is one small molecule, the monomer, repeated thousands of times. Poly means many, mer means part.", why: "The name says the structure, which makes the whole topic easier to hold." },
    { method: "How the joining happens", teach: "In addition polymerisation the double bond opens and each carbon links to a neighbour. Nothing is lost, which is what distinguishes it from condensation.", why: "It explains why an alkene can polymerise and an alkane cannot." },
    { method: "Why they last so long", teach: "The chain is strong, unreactive carbon bonds that nothing evolved to digest. The property that makes plastic useful is the same one that makes it persist.", why: "It connects a structural fact to an environmental consequence, which is the point of learning the structure." }
  ],
  chromatography: [
    { method: "Two competing pulls", teach: "Each substance is caught between sticking to the paper and dissolving in the solvent. Whichever pull wins decides how far it travels.", why: "One idea explains why the spots separate at all, and it is not about weight." },
    { method: "Setting it up properly", teach: "The start line is drawn in pencil, because ink is itself a mixture of dyes and would run up the paper with everything else.", why: "It is the step that ruins the experiment when skipped, and the reason is chemistry rather than convention." },
    { method: "Calculating Rf", teach: "Rf is the spot distance divided by the solvent distance. It has no units and is always under 1, so it identifies a substance whatever size the paper was.", why: "It turns a picture into a number that can be compared against a reference table." }
  ],
  "electrolysis-products": [
    { method: "Opposites attract", teach: "Positive ions travel to the negative electrode and negative ions to the positive one. That decides where each element appears.", why: "Everything else is built on knowing which ion goes where." },
    { method: "Competing with hydrogen", teach: "In solution the water offers hydrogen at the negative electrode. The metal is only deposited if it is LESS reactive than hydrogen.", why: "It explains why copper plates out and sodium does not, using the reactivity series you already have." },
    { method: "Halide or oxygen", teach: "At the positive electrode a halide is released if one is present; otherwise the water supplies oxygen. Sulfates and nitrates never form a gas themselves.", why: "Two cases cover almost every aqueous electrolysis question, so the prediction is quick and reliable." }
  ],
  reversible: [
    { method: "Reading the double arrow", teach: "\u21CC means the products can turn back into reactants. A single arrow means the reaction runs to completion.", why: "The symbol carries the whole distinction, so noticing it comes first." },
    { method: "Equilibrium is not stopping", teach: "At equilibrium the forward and backward rates are equal, so the amounts stop changing while both reactions keep running.", why: "Equal is not zero, and treating equilibrium as a stopped reaction makes everything after it wrong." },
    { method: "Predicting a shift", teach: "The position shifts to oppose whatever you changed. Heating favours the endothermic direction, which is not always the forward one.", why: "It predicts the effect of a change without any calculation, and it corrects the assumption that heating always gives more product." }
  ],
  gravity: [
    { method: "The inverse square law", teach: "Gravitational force falls off as the square of the distance. Double the separation and the force drops to a quarter, not a half.", why: "Assuming it simply halves is the natural guess, and it is wrong by a factor of two straight away." },
    { method: "Scaling by a factor", teach: "Multiply the distance by k and the force is divided by k\u00B2. You can answer without knowing either mass or G.", why: "Most questions ask for a ratio rather than a number, and the constants cancel." },
    { method: "Why astronauts float", teach: "Gravity at the Space Station is about 90% of its surface strength. Astronauts float because they and the station are falling around the Earth together.", why: "\"Zero gravity\" is the most misleading phrase in physics, and correcting it is the point of the tier." }
  ],
  induction: [
    { method: "Only change induces", teach: "A voltage appears across a coil only while the magnetic field through it is CHANGING. Hold the magnet still and it stops immediately.", why: "It is the condition everything else depends on, and a stationary magnet inducing nothing is genuinely surprising." },
    { method: "Making it bigger", teach: "Move the magnet faster, use more turns, or use a stronger magnet. All three increase how fast the field through the coil changes.", why: "Three separate adjustments turn out to be one idea, which is easier to remember than a list." },
    { method: "Why the grid uses AC", teach: "A transformer needs a changing field, so it works on AC and does nothing with DC. That single fact decided how electricity is distributed worldwide.", why: "It connects a laboratory demonstration to why the wires outside carry what they carry." }
  ],
  lenses: [
    { method: "Converging to a focus", teach: "A converging lens bends parallel rays together at the focal point, a focal length away.", why: "It defines the focal length, which every later question is measured against." },
    { method: "Inside or outside the focal length", teach: "An object beyond the focal length gives a real inverted image; inside it, you get a virtual upright magnified one. The same lens does both.", why: "It explains why a magnifying glass flips the picture as you move it away, which looks like two different devices." },
    { method: "Using the lens equation", teach: "1/f = 1/u + 1/v gives the image distance from the other two. Rearrange for 1/v, then take the reciprocal at the end.", why: "Forgetting the final reciprocal is the standard error, and it gives an answer that looks plausible." }
  ],
  "thermo-laws": [
    { method: "Heat flows one way", teach: "Heat moves from hotter to colder on its own and never the reverse. A hot drink cools; a cool drink does not spontaneously warm.", why: "It is an everyday fact that turns out to be one of the deepest rules in physics." },
    { method: "Forcing it uphill", teach: "A fridge moves heat from cold to hot, which costs work \u2014 that is what the electricity buys, and why the back of the fridge is warm.", why: "It shows the rule is not violated by an obvious counter-example, which is the objection everyone raises." },
    { method: "Why 100% is impossible", teach: "An engine needs heat to FLOW, so some must always be dumped somewhere colder. Even a frictionless engine cannot reach 100%.", why: "It separates a limit of engineering from a limit of the universe, and only one of those can be designed around." }
  ],
  resistivity: [
    { method: "Longer means more", teach: "Doubling a wire's length doubles its resistance \u2014 there is simply more material to get through.", why: "It is the direct relationship, and it matches intuition before the harder one arrives." },
    { method: "Thicker means less", teach: "Resistance is inversely proportional to cross-sectional area. Double the area and the resistance halves.", why: "Length and area pull in opposite directions, and keeping that straight is the whole difficulty." },
    { method: "Changing both at once", teach: "Handle each separately and combine: multiply by the length factor and divide by the area factor. They can cancel entirely.", why: "Real questions change both, and the two effects can hide each other completely." }
  ],
  "group-chemistry": [
    { method: "Group 1 gets more reactive down", teach: "The outer electron sits further from the nucleus further down the group, so it is easier to lose and the metal is more reactive.", why: "It gives a reason rather than an order to memorise." },
    { method: "Group 7 gets less reactive down", teach: "These react by GAINING an electron, and a shell further out attracts one less strongly \u2014 so reactivity falls down the group.", why: "The trend reverses, and carrying the Group 1 habit across gives the wrong answer every time." },
    { method: "One cause, two directions", teach: "Distance from the nucleus increases down BOTH groups. It makes losing easier and gaining harder, which is why the trends run opposite ways.", why: "Two facts collapse into one once you ask what each group is trying to do with its electrons." }
  ],
  friction: [
    { method: "It opposes motion", teach: "Friction acts against whichever way something is moving or trying to move. Push right and it pulls left.", why: "Getting the direction right comes before any arithmetic with it." },
    { method: "Finding the resultant", teach: "Subtract friction from the driving force to get what is left over. That remainder is what accelerates the object.", why: "Using the push alone ignores friction and gives an acceleration nothing ever has." },
    { method: "Why terminal velocity happens", teach: "Drag grows with speed until it exactly matches the weight. The forces then balance, the acceleration is zero, and the speed stays constant.", why: "Constant speed looks like no forces, and it is really two large forces cancelling." }
  ],
  "specific-latent": [
    { method: "Temperature stops during a change", teach: "While ice melts or water boils, the temperature holds steady. All the energy goes into breaking bonds rather than raising temperature.", why: "A thermometer that stops moving while you are still heating looks broken, and it is the whole idea." },
    { method: "Calculating the energy", teach: "Energy = mass \u00D7 specific latent heat. There is no temperature term at all, which is what distinguishes it from mc\u0394T.", why: "Reaching for mc\u0394T during a state change is the standard error, and there is no \u0394T to use." },
    { method: "Why steam scalds", teach: "Steam and boiling water are both at 100 degC, so temperature cannot explain the difference. Condensing steam releases 2.26 million joules per kilogram into your skin.", why: "It shows latent heat is not a bookkeeping detail but the thing doing the damage." }
  ],
  "rates-collision": [
    { method: "Collisions must be hard enough", teach: "Particles react only when they collide with at least the activation energy. Meeting gently achieves nothing.", why: "It explains why mixtures can sit unreacted indefinitely despite constant collisions." },
    { method: "More collisions per second", teach: "Concentration, pressure and surface area all work the same way: they increase how often particles meet.", why: "Three separate factors collapse into one idea, which is far less to remember." },
    { method: "Lowering the bar instead", teach: "A catalyst does not speed the particles up \u2014 it offers a route with a lower activation energy, so more of the existing collisions succeed.", why: "It is a different mechanism from every other factor, and it explains why the catalyst survives unchanged." }
  ],
  doppler: [
    { method: "Bunched or stretched", teach: "A source moving towards you emits each wave closer than the last, so they arrive bunched and the pitch rises. Moving away stretches them and it falls.", why: "It explains a sound everyone has heard without any formula." },
    { method: "It is RELATIVE motion", teach: "The driver of the ambulance hears no change, because there is no motion between them and the siren. The source never alters what it emits.", why: "It rules out the natural conclusion that the siren itself is changing." },
    { method: "Red shift and the expanding universe", teach: "Light from distant galaxies is stretched towards red, meaning they are receding \u2014 and the further away, the faster.", why: "One everyday effect turns into the evidence for the expansion of the universe, which is worth seeing as the same idea." }
  ],
  "series-circuits": [
    { method: "Series has one path", teach: "With a single loop the current is identical everywhere, and the voltages across the components add up to the supply.", why: "Same current, adding voltages \u2014 half the rules, and the half that is easiest to picture." },
    { method: "Sharing the voltage", teach: "Identical components in series share the supply voltage equally, so each gets the supply divided by how many there are.", why: "It turns the rule into a number without any resistance values." },
    { method: "Parallel lowers the total", teach: "Adding a parallel branch gives current another route, so the total resistance falls \u2014 below even the smallest single resistor.", why: "Adding a component reducing resistance is the opposite of series, and it is why circuits overload." }
  ],
  purity: [
    { method: "What pure actually means", teach: "Chemically pure means one substance and nothing else. The everyday sense \u2014 natural, wholesome \u2014 is a different word entirely.", why: "Spring water is natural and not pure; carbon monoxide can be pure and lethal." },
    { method: "Testing with a thermometer", teach: "A pure substance melts at one sharp temperature. A range means a mixture, and a wider range means less pure.", why: "It gives a real purity test needing nothing but a thermometer." },
    { method: "Why mixtures melt lower", teach: "Dissolving something lowers the melting point, which is why salt clears an icy road and why antifreeze works.", why: "The same fact used as a test in the lab explains something visible on the street in winter." }
  ],
  stars: [
    { method: "Fusion is the fuel", teach: "A star fuses hydrogen into helium, and the tiny mass difference becomes an enormous amount of energy. Burning could not last billions of years.", why: "It rules out the intuitive answer and gives the real one." },
    { method: "Gravity against radiation", teach: "Gravity pulls every part inward while energy from fusion pushes outward. A stable star is exactly that balance.", why: "One balance explains why a star holds its size for billions of years." },
    { method: "What happens when it fails", teach: "When the hydrogen runs out, fusion stops and the outward push vanishes. Gravity has not changed \u2014 it simply has nothing opposing it.", why: "Every late stage, from red giant to supernova, follows from that single balance failing." }
  ],
  transformers: [
    { method: "Turns set the voltage", teach: "The ratio of secondary turns to primary turns is the ratio of the voltages. More turns out means more volts out.", why: "One ratio answers most transformer questions with no other information." },
    { method: "Calculating the output", teach: "Vs = Vp \u00D7 Ns/Np. Find the turns ratio first, then multiply.", why: "Doing it in that order avoids inverting the ratio, which is the usual slip." },
    { method: "Why the grid uses high voltage", teach: "Loss in a cable is I\u00B2R, so it depends on the current squared. Raising voltage lowers current, and halving the current quarters the loss.", why: "The squared term is why the saving is so large, and it is invisible if you only look at P = VI." }
  ],
  extraction: [
    { method: "Reactive metals stay combined", teach: "Metals high in the series bond with oxygen and stay bonded, so they are never found pure. Gold is found as metal because it reacts with almost nothing.", why: "It explains what you actually dig out of the ground before any chemistry begins." },
    { method: "Carbon is the dividing line", teach: "A metal below carbon in the series can be reduced by heating with carbon. Above carbon, it cannot \u2014 electrolysis is the only route.", why: "One comparison decides the entire industrial method, and it is a comparison you can already make." },
    { method: "Why the method sets the price", teach: "Aluminium is the most abundant metal in the crust and was once worth more than gold, because nothing could extract it until cheap electricity arrived.", why: "It shows abundance and availability are different things, and that the reactivity series has economic consequences." }
  ],
  "terminal-velocity": [
    { method: "Speeding up at first", teach: "Just after jumping, drag is small because the speed is small. Weight exceeds it, so there is a resultant force downwards and the fall accelerates.", why: "It establishes that drag is not fixed \u2014 it depends on how fast you are already going." },
    { method: "The balance point", teach: "Drag grows with speed until it exactly equals the weight. The resultant is then zero and the speed stops changing.", why: "It turns terminal velocity from a fact into a consequence you can predict." },
    { method: "Changing the balance", teach: "A parachute multiplies the area, so the same drag is reached at a much lower speed. The weight never changed \u2014 only how much drag a given speed produces.", why: "It shows terminal velocity is a property of the situation rather than of the object, which is what makes parachutes work." }
  ],
  "energy-resources": [
    { method: "Renewable or not", teach: "Renewable means replaced as fast as it is used. Wind and tides keep coming; gas took millions of years and is not being replaced.", why: "It is the distinction everything else in the topic rests on." },
    { method: "Reliability against emissions", teach: "Gas can be turned up within minutes; wind cannot. That is why fossil stations still run alongside renewables \u2014 they supply reliability, not cleanliness.", why: "It explains a fact that otherwise looks like simple inconsistency." },
    { method: "Weighing the whole picture", teach: "Nuclear generation is low-carbon and reliable, and its waste stays hazardous for millennia. The argument is about long-term risk and cost, not emissions.", why: "It shows that comparing resources needs more than one axis, which is the harder half of the topic." }
  ],
  static: [
    { method: "Only electrons move", teach: "Rubbing transfers electrons. Protons are locked in nuclei and never move, so gaining electrons makes something negative and losing them makes it positive.", why: "Naming which particle moves rules out most of the wrong explanations at once." },
    { method: "Charge is conserved", teach: "Whatever the rod gains, the cloth loses. The two end up equally and oppositely charged, because nothing was created \u2014 only moved.", why: "It makes the second object's charge predictable rather than something else to remember." },
    { method: "Induced charge", teach: "A charged balloon repels electrons in a neutral wall, leaving the near surface oppositely charged. Nothing transfers \u2014 the charge is only rearranged.", why: "It explains attraction to an uncharged object, which the first two methods cannot." }
  ],
  alloys: [
    { method: "A mixture, not a compound", teach: "An alloy is a metal mixed with another element \u2014 steel is iron with carbon, brass is copper with zinc. The atoms are mixed, not chemically combined.", why: "Mixture and compound behave differently, and the distinction decides how you reason about it." },
    { method: "Why mixing hardens", teach: "A pure metal has regular layers that slide easily. A different-sized atom disrupts them, so the layers can no longer slide and the metal resists deformation.", why: "It explains a counterintuitive fact \u2014 that impurity improves the material \u2014 from structure alone." },
    { method: "Reading a carat figure", teach: "Carat measures gold in twenty-fourths, so 18-carat is 18/24 or 75% gold. 24-carat is pure and too soft to hold a shape.", why: "It applies the idea to a number people actually meet, and the twenty-fourths are not guessable." }
  ],
  "moments-machines": [
    { method: "Balancing the moments", teach: "Effort \u00D7 its distance equals load \u00D7 its distance. That single equation solves any lever.", why: "One relation covers every lever question, so the work is in identifying the distances." },
    { method: "Gears trade speed for turning force", teach: "Meshed gears move the same number of teeth per second, so a bigger gear turns fewer times \u2014 slower, with correspondingly more torque.", why: "It is the same trade as a lever in a different shape, which makes both easier to hold." },
    { method: "Nothing is gained for free", teach: "A machine multiplies force, never energy. Four times the force means a quarter of the distance, because force \u00D7 distance is conserved.", why: "It rules out the intuition that a lever creates something, and explains why your end travels so far." }
  ],
  ultrasound: [
    { method: "Above what we can hear", teach: "Ultrasound is sound above about 20,000 Hz. It is ordinary sound in every respect except that our ears cannot detect it.", why: "It removes the idea that ultrasound is a different kind of thing rather than a different frequency." },
    { method: "Timing the echo", teach: "The pulse travels to the boundary and back, so the depth is half the total distance. Forgetting the return journey doubles the answer.", why: "The halving is the entire calculation, and it is the step that gets skipped." },
    { method: "Why it is used on people", teach: "Ultrasound carries far too little energy to ionise anything, unlike X-rays. The picture is less sharp, and that is an accepted trade for safety.", why: "It frames the choice as a trade rather than one method being better, which is how medical decisions actually work." }
  ],
  haber: [
    { method: "What reacts", teach: "Nitrogen from the air and hydrogen from natural gas combine to make ammonia, reversibly.", why: "The formula NH3 tells you the reactants, so nothing needs memorising." },
    { method: "What the conditions do to yield", teach: "The forward reaction is exothermic, so cooling favours it and raises the yield. High pressure also favours the side with fewer gas molecules.", why: "It applies Le Chatelier to a real process rather than an abstract equation." },
    { method: "Why the conditions are a compromise", teach: "Cooling raises the yield and cripples the rate. 450 degC is chosen because a moderate yield obtained quickly beats a high yield obtained never.", why: "The best conditions for yield and for rate are opposites, and only seeing both explains the number actually used." }
  ],
  "water-treatment": [
    { method: "Safe is not pure", teach: "Drinking water contains dissolved minerals and is not chemically pure. It is water with the harmful things removed.", why: "The everyday and chemical meanings of pure differ, and the whole topic depends on which one is meant." },
    { method: "Matching the step to the contaminant", teach: "Settling removes heavy particles, filtering removes solids, and sterilising kills microbes \u2014 bacteria are far too small to filter out.", why: "Each step handles something the others cannot, so knowing why there are three is better than listing them." },
    { method: "Why desalination is a last resort", teach: "Separating salt from seawater means boiling it or forcing it through a membrane, and both cost enormous energy. Treating a river is far cheaper.", why: "The chemistry is straightforward and the energy bill decides it, which is true of a lot of industrial chemistry." }
  ],
  orbits: [
    { method: "Gravity is the centripetal force", teach: "A satellite is falling continuously and moving sideways fast enough to keep missing the Earth. Gravity supplies exactly the inward force a circle needs.", why: "It replaces the idea of an outward force with the one force that is actually there." },
    { method: "Lower means faster", teach: "Gravity is stronger closer in, so a lower orbit needs a higher speed to match it. The Space Station laps the Earth in 90 minutes; the Moon takes a month.", why: "The comparison makes the relationship concrete rather than a formula." },
    { method: "Matching the Earth's turn", teach: "A geostationary satellite must orbit in exactly 24 hours, which fixes its altitude at about 36,000 km. There is only one such orbit.", why: "It shows one requirement determining a specific altitude, and explains why that altitude is crowded." }
  ],
  "half-equations": [
    { method: "Which side the electron is on", teach: "Electrons on the left means they are gained \u2014 reduction. On the right means lost \u2014 oxidation.", why: "One glance at the equation gives the answer, with nothing to memorise." },
    { method: "Counting the electrons", teach: "The number of electrons equals the charge on the ion, because each electron cancels one positive charge.", why: "It makes writing a half equation mechanical rather than a matter of recall." },
    { method: "Balancing the two halves", teach: "Every electron lost at one electrode arrives at the other, so the halves must be scaled until the electrons match.", why: "That balancing is what turns two separate halves into one whole reaction." }
  ],
  "efficiency-transfer": [
    { method: "Waste means heat", teach: "Friction, resistance and drag all produce heat, which is why almost anything working gets warm.", why: "It identifies what to look for before asking how to prevent it." },
    { method: "Trapping air", teach: "Insulation works because the air trapped between the fibres conducts poorly and cannot form convection currents. The fibres matter less than the gaps.", why: "One material closing two routes explains why insulation is fluffy rather than dense." },
    { method: "Three routes, three remedies", teach: "Conduction and convection need particles, so a vacuum stops both. Radiation crosses a vacuum, so it needs a reflective surface instead.", why: "A vacuum flask makes sense only once you see that no single feature could stop all three." }
  ],
  "chromatography-rf": [
    { method: "Calculating it", teach: "Rf is the spot distance divided by the solvent distance \u2014 a ratio with no units, always under 1.", why: "It is the definition made usable." },
    { method: "Why the paper size does not matter", teach: "A longer run moves both the spot and the solvent further, so the ratio is unchanged. That is precisely why Rf is used rather than a raw distance.", why: "It explains the choice of measure rather than just how to compute it." },
    { method: "What it depends on", teach: "Rf depends on the solvent, because the solvent sets the competition between sticking and dissolving. A value means nothing without the solvent stated.", why: "It explains why two labs can get different values and both be right." }
  ],
  "pressure-depth": [
    { method: "Deeper means more", teach: "Pressure in a liquid comes from the weight of liquid above, so it rises with depth.", why: "It grounds the formula in something you can picture before any arithmetic." },
    { method: "Depth times density times g", teach: "The calculation needs only those three. No area or volume appears, so a narrow tube and a wide lake read the same at the same depth.", why: "The absence of volume is the surprising part, and it is what the formula is telling you." },
    { method: "Why a dam is wedge-shaped", teach: "Force is pressure \u00D7 area, and pressure is greatest at the base, so the wall is built thickest exactly where it is pushed hardest.", why: "The shape of a dam is a picture of how pressure varies with depth." }
  ],
  "specific-heat-compare": [
    { method: "What the capacity means", teach: "It is the energy one kilogram needs to warm by one degree. A high value means slow to heat \u2014 which is why sand burns your feet and the sea does not.", why: "One comparison makes an abstract constant concrete." },
    { method: "Using mc\u0394T", teach: "Energy = mass \u00D7 capacity \u00D7 temperature change. Halving any one factor halves the energy.", why: "It is the calculation, and seeing all three as equal partners prevents dropping one." },
    { method: "Why slow to heat is useful", teach: "A high capacity means each kilogram carries more energy for a given temperature drop, which is exactly what a radiator needs. Heating quickly is the wrong goal.", why: "The property that looks like a drawback is the reason water is chosen, which is worth seeing." }
  ],
  "titration-calc": [
    { method: "Volumes into dm\u00B3", teach: "Burettes read in cm\u00B3 and concentrations are per dm\u00B3, so divide by 1000 before anything else.", why: "It is one division and it is where most of the marks are lost." },
    { method: "Through the known solution", teach: "Start where you know both concentration and volume, get the moles, apply the ratio, then divide by the other volume.", why: "There is only one place with enough information to start, and finding it is the first decision." },
    { method: "When the ratio is not 1:1", teach: "Sulfuric acid gives two hydrogen ions per molecule, so it needs twice the alkali. The balanced equation, not the acid's strength, sets the ratio.", why: "Assuming 1:1 is right often enough to feel safe and wrong exactly when the acid is diprotic." }
  ],
  "reaction-profiles": [
    { method: "The hump is the barrier", teach: "The peak height is the activation energy \u2014 how much a collision must supply for the reaction to happen at all.", why: "It connects the diagram to collision theory rather than leaving it as a shape." },
    { method: "The ends give the energy change", teach: "The vertical difference between reactants and products is the overall change. Products lower means exothermic.", why: "Two different quantities sit on one diagram, and confusing them is the usual error." },
    { method: "What a catalyst does to it", teach: "A catalyst lowers the hump and leaves both ends exactly where they were. It changes how fast you get there, never where you end up.", why: "It shows in one picture why a catalyst speeds a reaction without changing its energetics." }
  ],
  seismic: [
    { method: "Primary arrives first", teach: "P waves travel fastest and arrive first; S waves lag. The gap between them tells you how far away the earthquake was.", why: "The names carry the fact, and the gap is what makes location possible." },
    { method: "The shadow zone", teach: "S waves do not arrive on the far side of the Earth, and the only explanation is a liquid layer blocking them. That is how we know the outer core is molten.", why: "It is a conclusion about a place nobody has been, drawn from a wave that failed to arrive." },
    { method: "Why liquids block one and not the other", teach: "A liquid resists compression, so a longitudinal wave passes. It cannot resist shear, so a transverse wave has nothing to restore it and dies.", why: "One property of liquids explains both behaviours, and the same reason covers sound in water." }
  ],
  "circuit-faults": [
    { method: "Zero current means a break", teach: "A series circuit has one path, so a gap anywhere stops the current everywhere. Zero current is the signature of an open circuit.", why: "It narrows the fault to one kind before any measurement of voltage." },
    { method: "Full voltage marks the gap", teach: "Working components share the supply. If one reads the full supply voltage, the break is across that component.", why: "It turns a voltmeter into a way of locating the fault rather than just measuring." },
    { method: "Why a short gets hot", teach: "Almost no resistance gives an enormous current, and heating is I\u00B2R. Doubling the current quadruples the heat.", why: "The squared term is why a short is a fire risk rather than a mild fault." }
  ],
  "yield-atom-economy": [
    { method: "Two different questions", teach: "Yield asks how much of what was possible you got. Atom economy asks what fraction of the starting mass ended up in the product you wanted.", why: "They can differ freely, and treating them as the same measure hides the whole point." },
    { method: "Calculating it", teach: "Wanted product mass \u00F7 total reactant mass \u00D7 100. No experimental data is needed \u2014 the equation alone gives it.", why: "It can be worked out before running anything, which is why it guides the choice of route." },
    { method: "Why it matters commercially", teach: "A perfect yield can still turn most of the raw material into by-product, which must be separated, disposed of or sold. High atom economy reduces waste at source.", why: "Yield judges how well you ran the reaction; atom economy judges whether it was the right one." }
  ],
  "carbon-cycle": [
    { method: "Complete combustion", teach: "A hydrocarbon plus plenty of oxygen gives carbon dioxide and water \u2014 both elements have to end up somewhere.", why: "Reading the products off the reactants means nothing needs memorising." },
    { method: "When oxygen runs short", teach: "Incomplete combustion gives carbon monoxide, which is toxic, colourless and odourless. There is no warning, which is why detectors exist.", why: "It connects a chemical condition to a real hazard people are told about but rarely understand." },
    { method: "Why the timescale matters", teach: "Wood releases carbon absorbed within decades and a replacement tree takes it back. Coal releases carbon locked away for hundreds of millions of years.", why: "The chemistry is identical and the timescale is the whole difference, which is the part that is usually skipped." }
  ],
  "stopping-distance": [
    { method: "Thinking distance", teach: "During the reaction time the car carries on at full speed. Thinking distance is speed \u00D7 reaction time, with no braking involved.", why: "It separates the driver's contribution from the car's before anything else." },
    { method: "Braking goes as the square", teach: "Braking must remove \u00BDmv\u00B2, so doubling the speed quadruples the energy and the distance needed.", why: "It explains why a small speed increase matters so much more than it feels like it should." },
    { method: "What each part depends on", teach: "Thinking distance depends on speed and reaction time; braking distance depends on friction. Wet roads change one and not the other.", why: "The two halves depend on completely different things, so a single explanation is always wrong for one of them." }
  ],
  "wave-behaviour": [
    { method: "Naming what happened", teach: "Bouncing back is reflection, bending on entry is refraction, spreading past an edge is diffraction. The boundary decides which.", why: "Three words for three situations, and choosing correctly comes before any explanation." },
    { method: "When diffraction is large", teach: "Spreading is greatest when the gap is about the size of the wavelength \u2014 which is why you can hear round a corner and not see round one.", why: "One comparison explains an everyday asymmetry between sound and light." },
    { method: "Why the straw looks broken", teach: "Light bends leaving the water, and your eye traces it back along a straight line that it never took. The straw is straight; the assumption is wrong.", why: "It locates the illusion in the observer rather than the object, which is what refraction questions are really about." }
  ],
  "salts-preparation": [
    { method: "Naming the salt", teach: "The metal comes from the base and the rest from the acid \u2014 sulfuric acid gives sulfates, hydrochloric gives chlorides.", why: "The products can be written before knowing anything else about the reaction." },
    { method: "Why the base is in excess", teach: "Excess guarantees all the acid is used, and since the base is insoluble the leftover can simply be filtered off.", why: "It explains two choices at once \u2014 the excess and the insolubility \u2014 which otherwise look arbitrary." },
    { method: "Why crystallise slowly", teach: "Slow evaporation lets an ordered lattice build and leaves impurities behind in solution. Boiling dry deposits everything at once.", why: "It is the same principle as recrystallisation, and it explains a step that looks like mere patience." }
  ],
  nanoparticles: [
    { method: "Cutting creates surface", teach: "Every cut exposes two new faces while the volume is unchanged, so the surface area to volume ratio rises.", why: "It establishes the one geometric fact the whole topic rests on." },
    { method: "How fast the ratio grows", teach: "For a cube the ratio is 6/side, so dividing the side by n multiplies the ratio by n. Smaller always means proportionally more surface.", why: "It turns a qualitative trend into a number you can compute." },
    { method: "Why that makes them useful", teach: "Catalysis happens only at the surface. In a lump almost every atom is buried; at the nanoscale most are exposed and working.", why: "It connects the geometry to a practical consequence, which is the reason nanoparticles are made at all." }
  ],
  "momentum-collisions": [
    { method: "Momentum is mass times velocity", teach: "A heavy slow object and a light fast one can carry the same momentum, which is what makes it the useful quantity in a collision.", why: "It is the definition, and it explains why mass alone does not decide the outcome." },
    { method: "Force is momentum change over time", teach: "The same change in momentum spread over a longer time means a smaller force. Doubling the time halves the force.", why: "It turns a definition into the relationship every safety feature exploits." },
    { method: "Why crumple zones work", teach: "Stopping from a given speed always means the same momentum change. A crumple zone cannot reduce it \u2014 it extends the time, and that is what cuts the force.", why: "The natural explanation, that the car absorbs the momentum, is wrong, and the real one is more useful." }
  ],
  "power-transfer": [
    { method: "Taking a share of the input", teach: "Efficiency is the fraction of the input power that does the job. The rest leaves as heat.", why: "It gives the calculation in its simplest direction before any rearranging." },
    { method: "Working it out from power", teach: "Useful out \u00F7 total in \u00D7 100. No energy or time is needed \u2014 powers alone give the efficiency.", why: "It avoids an unnecessary detour through energy, which is where the arithmetic usually goes wrong." },
    { method: "What inefficiency costs", teach: "Two motors delivering the same useful power differ entirely in what they draw. The inefficient one costs more to run and needs more cooling.", why: "Efficiency shows up as a bill and a heat problem rather than as less work done, which is not obvious from the formula." }
  ],
  "fractional-distillation": [
    { method: "Sorting by boiling point", teach: "The column is hot at the bottom and cool at the top, so each fraction condenses where the temperature falls to its boiling point.", why: "One temperature gradient does all the separating, which makes the whole apparatus understandable at a glance." },
    { method: "Where each fraction leaves", teach: "Short molecules boil at low temperatures and rise to the cool top; long ones condense low down where it is hot.", why: "It lets you predict the position of any fraction from its chain length alone." },
    { method: "Why chain length sets the boiling point", teach: "A longer chain touches its neighbours along more of its length, so the forces BETWEEN molecules are stronger. Boiling breaks those, not the bonds inside.", why: "Confusing bonds within a molecule with forces between molecules is the standard error, and it makes the trend look arbitrary." }
  ],
  "identifying-ions": [
    { method: "Flame colour identifies the metal", teach: "Each metal ion burns with its own colour \u2014 sodium yellow, potassium lilac, copper green.", why: "It is the quickest test there is, and it answers exactly one half of the question." },
    { method: "Gas and precipitate tests", teach: "Fizzing with acid and limewater turning cloudy together mean a carbonate. Precipitates identify halides and sulfates.", why: "The observation IS the identification, so the test and the conclusion are the same step." },
    { method: "Why both halves are needed", teach: "A flame test says nothing about the non-metal, and a precipitate test says nothing about the metal. Naming a compound needs both.", why: "Neither test alone identifies a substance, which is why practical analysis is always a sequence rather than one measurement." }
  ],
  "resistors-network": [
    { method: "Series adds", teach: "The current passes through every component in turn, so the resistances simply add.", why: "It is the simple case and the one that matches intuition." },
    { method: "Parallel adds reciprocals", teach: "1/R = 1/R1 + 1/R2, and the answer is always less than the smaller branch.", why: "The reciprocal step is where it goes wrong, and the sanity check catches it immediately." },
    { method: "Why more can mean less", teach: "Another parallel branch is another route, so more current flows at the same voltage \u2014 and more current at the same voltage is less resistance.", why: "It resolves what looks like a contradiction without any formula at all." }
  ],
  "life-cycle": [
    { method: "Counting the whole life", teach: "Raw materials, manufacture, use and disposal all count. A product can be cheap to make and expensive to dispose of.", why: "Picking one convenient stage is how misleading environmental claims get made." },
    { method: "Spreading the cost over uses", teach: "A cotton bag has a large manufacturing impact, so it only beats a plastic one after many uses. Which is better depends on how often it is actually used.", why: "It turns an argument people have into a calculation with a definite answer." },
    { method: "Where judgement enters", teach: "Comparing litres of water with kilograms of carbon needs a value judgement, so two honest assessments can differ.", why: "The measurement is science and the weighting is not, and saying so is part of doing it properly." }
  ],
  "radiation-uses": [
    { method: "Choosing the radiation type", teach: "A tracer must escape the body, so it has to be gamma. A thickness gauge needs radiation the material partly absorbs, so beta.", why: "The job dictates the type, and there is exactly one right answer each time." },
    { method: "Choosing the half-life", teach: "A tracer needs a short half-life so it stops irradiating the patient; a gauge needs a long one so it does not need replacing.", why: "The same property is a virtue in one use and a hazard in the other." },
    { method: "Why the wrong choice fails", teach: "Alpha would be stopped completely by foil and gamma would pass straight through, so neither reading would change with thickness. Only beta responds.", why: "It shows the choice is forced by physics rather than convention." }
  ],
  "concentration-change": [
    { method: "Amount over time", teach: "Mean rate is the amount produced divided by the time taken \u2014 a single figure for the whole reaction.", why: "It is the calculation, and calling it a MEAN sets up everything that follows." },
    { method: "Gradient is the rate", teach: "On a product-against-time graph the gradient is the rate. Steepest at the start, flattening as reactants run out.", why: "It connects the graph's shape to collision theory rather than leaving it as a curve." },
    { method: "Why the mean is not enough", teach: "Two reactions can share their endpoints and take completely different paths between them. Only the curve shows the rate at a given moment.", why: "It explains why the graph is drawn at all rather than just quoting one number." }
  ],
  "hookes-limit": [
    { method: "Within the limit", teach: "Force = spring constant \u00D7 extension, and that holds only while the graph is a straight line.", why: "The condition matters as much as the formula, and it is usually dropped." },
    { method: "Reading where it ends", teach: "Where the force-extension graph bends, proportionality has ended. The spring still stretches \u2014 F = kx just no longer describes it.", why: "It turns the limit from a fact into something you can see on a graph." },
    { method: "Elastic against plastic", teach: "Below the elastic limit all the stored energy is returned and the spring recovers. Past it, some work has permanently rearranged the material.", why: "They are different behaviours rather than different amounts of the same one." }
  ],
  "electrolysis-calc": [
    { method: "Charge from current and time", teach: "Q = It. Amps times seconds gives coulombs.", why: "It is the first conversion in a chain, and each link is simple on its own." },
    { method: "Coulombs into moles of electrons", teach: "One mole of electrons carries 96500 C, so dividing by the Faraday constant converts charge into moles.", why: "It is the bridge between an electrical measurement and a chemical amount." },
    { method: "Electrons into product", teach: "The half equation gives the ratio: Na+ needs one electron, Al3+ needs three, so the same charge deposits three times as much sodium.", why: "The ratio differs for every ion, so this step cannot be skipped or assumed." }
  ],
  "national-grid": [
    { method: "Current from power and voltage", teach: "I = P \u00F7 V, so at hundreds of thousands of volts the current is tiny.", why: "It shows what high voltage actually buys before explaining why that matters." },
    { method: "Why losses fall so fast", teach: "Loss is I\u00B2R, so multiplying the voltage by 10 divides the current by 10 and the loss by 100.", why: "The squared term is why the saving is enormous rather than merely useful." },
    { method: "Why it comes back down", teach: "400,000 V would arc across any gap and no appliance could use it, so the grid accepts higher losses in the last stretch for a survivable supply.", why: "It frames the design as a compromise rather than a single optimisation." }
  ],
  "equilibrium-conditions": [
    { method: "Counting gas molecules", teach: "Add the coefficients on each side. N2 + 3H2 gives 4 on the left and 2 on the right.", why: "Pressure questions are unanswerable until this count is done, and it is the step that gets skipped." },
    { method: "Which way pressure shifts it", teach: "The system opposes an increase by favouring the side that takes up less volume \u2014 the one with fewer molecules.", why: "One rule handles every pressure question once the counting is done." },
    { method: "What a catalyst does not do", teach: "A catalyst lowers the barrier for both directions equally, so equilibrium is reached sooner and in exactly the same place. The yield is unchanged.", why: "Rate and yield are separate questions with separate levers, and assuming a catalyst helps both is the standard error." }
  ],
  "moments-balance": [
    { method: "Force times distance", teach: "A moment is the force multiplied by its perpendicular distance from the pivot, measured in newton metres.", why: "It is the definition, and the units carry it." },
    { method: "Setting two moments equal", teach: "A balanced beam has equal moments each side, which gives one equation with one unknown.", why: "It turns a physical situation into arithmetic with no ambiguity." },
    { method: "Why unequal weights balance", teach: "What balances is the moment, not the force. A child half the weight balances by sitting twice as far out.", why: "It explains a see-saw between people of very different sizes, which force alone cannot." }
  ],
  "endo-exo-uses": [
    { method: "Hot means exothermic", teach: "A hand warmer gets hot because energy is leaving the reaction and entering its surroundings.", why: "It reads the direction of energy flow off something you can feel." },
    { method: "Cold means endothermic", teach: "A sports cold pack takes energy FROM its surroundings as the salt dissolves, so they get colder.", why: "It is the mirror case, and dissolving being endothermic surprises people." },
    { method: "Why single use", teach: "Reversing the reaction would need at least as much energy put back, and nothing in the can can supply it.", why: "A commercial limitation turns out to be a direct consequence of conservation of energy." }
  ],
  "sound-hearing": [
    { method: "Frequency is pitch", teach: "More vibrations per second is heard as a higher note. Tightening a guitar string raises the frequency and the pitch.", why: "It links a property of the wave to something you can hear and change." },
    { method: "Amplitude is loudness", teach: "Amplitude carries the energy, so the same note played harder is louder without changing pitch.", why: "Two properties of one wave doing two different jobs is the distinction people conflate." },
    { method: "Where the limit sits", teach: "A dog whistle makes a real sound wave; our hair cells simply cannot vibrate fast enough to convert it. The limit is in the detector.", why: "It relocates a fact about hearing from the sound to the listener, which is why it differs by species and with age." }
  ],
  "empirical-molecular": [
    { method: "Keeping the ratio", teach: "A molecular formula is a whole-number multiple of the empirical one, so the ratio between elements never changes.", why: "It rules out most wrong answers immediately without any calculation." },
    { method: "Dividing the masses", teach: "Molecular mass \u00F7 empirical mass gives how many empirical units make a molecule, and it is always a whole number.", why: "One division turns the empirical formula into the real one." },
    { method: "What the ratio leaves out", teach: "Ethene and butene both reduce to CH2 and are quite different substances. The ratio is real information and does not identify a compound.", why: "It marks the limit of what an empirical formula can tell you, which is easy to overstate." }
  ],
  "light-basic": [
    { method: "Light goes straight", teach: "Light travels in straight lines from its source, which is why you cannot see round a corner however bright it is.", why: "One fact explains shadows, corners and why you need a mirror to look round things." },
    { method: "Why shadows change size", teach: "Light spreads out from a source, so moving it closer means the object blocks a wider spread and the shadow grows.", why: "It turns a shadow from something that just happens into something you can predict." },
    { method: "Seen light and made light", teach: "Only a few things make their own light. Everything else is seen because light bounces off it, which is why a dark room shows you nothing.", why: "It is the difference between a lamp and a book, and it is not obvious until the lights go out." }
  ],
  "magnets-basic": [
    { method: "What a magnet picks up", teach: "Magnets attract iron, steel, nickel and cobalt. Most metals, including copper and aluminium, are not magnetic at all.", why: "Assuming all metals are magnetic is the natural guess, and testing a copper coin settles it." },
    { method: "Two ends, two behaviours", teach: "Same ends push apart, opposite ends pull together. You can feel it without the magnets touching.", why: "It introduces a force you can feel across a gap, which nothing else at this level does." },
    { method: "Working through things", teach: "A magnet moves a paperclip through paper without touching it. Magnetism is a non-contact force, like gravity.", why: "Most forces need contact, so one that does not is worth naming." }
  ],
  "materials-basic": [
    { method: "Matching material to job", teach: "A window is glass because you can see through it. The property that matters depends entirely on what the thing has to do.", why: "It replaces memorising materials with asking what the object needs." },
    { method: "When you want the opposite", teach: "A saucepan needs metal to conduct heat and a handle that does not. The same object needs opposite properties in different places.", why: "It shows that no material is simply best, which is the step past a list of properties." },
    { method: "Why objects mix materials", teach: "No single material is good at everything, so each part is chosen for what it has to do.", why: "Looking at any object and asking what each part is for explains almost every design choice." }
  ],
  "earth-basic": [
    { method: "The Earth spins", teach: "One turn every 24 hours gives day and night. The Sun never stops shining \u2014 the night side is simply facing away.", why: "It corrects the impression from standing on the ground that the Sun is what moves." },
    { method: "Three different movements", teach: "A spin is a day, a trip round the Sun is a year, and the Moon round the Earth is about a month.", why: "Three movements with three timescales, and keeping them apart is most of the topic." },
    { method: "Why the tilt matters", teach: "The Earth leans as it orbits, so one half gets more direct light while the other gets less. Six months later they swap.", why: "The natural answer is that summer means being closer, and Earth is actually closest to the Sun in January." }
  ],
  moles: [
    { method: "Mass divided by Mr", teach: "The number of moles is the mass divided by the relative formula mass. Mr is the mass of one mole, so dividing by it counts how many moles you have.", why: "It is the conversion everything in chemistry quantities runs through." },
    { method: "Rearranging for mass", teach: "Mass is moles \u00D7 Mr. Same relation, used when the amount is known and the mass is not.", why: "Reactions are calculated in moles and weighed out in grams, so both directions are needed constantly." },
    { method: "Through a balanced equation", teach: "The equation's coefficients give the ratio between substances. Convert to moles, apply the ratio, then convert back to mass \u2014 the ratio only works in moles, never in grams.", why: "Applying a 2:1 ratio directly to masses is the classic error, and it is wrong unless the two Mr values happen to be equal." }
  ]
};

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
  /* PER-TIER TEACHING.

     Every skill used to hand out one block of prose whatever tier you were on,
     so a learner working at tier 3 read the tier-1 explanation. Mathema had
     exactly this gap and closing it was the single biggest improvement to that
     app, so the same mechanism is here: METHODS[skillId] holds up to three
     named methods, and a question gets the one for its tier.

     A skill with no entry falls back to the single blob, which is what every
     skill did before. That fallback is deliberate — it lets the methods be
     written a batch at a time without the untouched skills losing anything —
     but it is also invisible, so `elcheck` counts how many skills still rely
     on it rather than letting the gap sit quietly. */
  const ms = METHODS[sk.id];
  const m = ms && ms[Math.min(d, ms.length) - 1];
  out.teach = m ? m.teach : sk.teach;
  out.method = m ? m.method : null;
  out.methodWhy = m ? m.why : null;
  out.needs = sk.needs || [];
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
/* SCREENING THE GENERATED TEACHING.

   The questions are solved and confirmed before a learner sees them. The
   teaching prose was not checked at all — it was length-capped and put on
   screen. That is the one place where an unverified claim about the world
   reaches the learner, so it is worth narrowing.

   What CAN be checked mechanically: whether the prose stays inside the
   relations the topic actually uses. If a topic built from F = ma starts
   explaining entropy or the speed of light, that is prose the app cannot
   support and has no business showing.

   What CANNOT be checked, and this is stated rather than glossed: whether the
   explanation is correct, clear, or well-pitched. A confident wrong sentence
   about forces will pass. This narrows the surface; it does not verify it, and
   the on-screen warning still says the teaching was not checked.

   The list is of terms belonging to OTHER physics — deliberately not a list of
   banned words in general, which would reject ordinary English. */
const OFF_TOPIC = [
  "entropy", "enthalpy", "relativity", "relativistic", "quantum", "photon",
  "wavefunction", "isotope", "half-life", "radioactive", "capacitance",
  "inductance", "magnetic flux", "refraction", "diffraction", "electrolysis",
  "equilibrium", "catalyst", "titration", "mole ratio", "gibbs", "orbital",
  "electronegativity", "covalent", "ionic bond", "buffer", "redox"
];

function screenTeaching(text, relationIds) {
  const t = String(text || "");
  if (!t.trim()) return { ok: true, teach: "" };          // absent is fine
  const low = t.toLowerCase();

  /* A term is only off-topic if it does not belong to a relation this topic
     actually uses. A topic built on `moles` may of course say "mole". */
  const allowed = {};
  (relationIds || []).forEach(function (id) {
    const rel = RELATIONS[id];
    if (!rel) return;
    String(rel.name).toLowerCase().split(/[^a-z]+/).forEach(function (w) {
      if (w.length > 2) allowed[w] = true;
    });
  });

  const strayed = OFF_TOPIC.filter(function (term) {
    if (low.indexOf(term) === -1) return false;
    return !term.split(" ").every(function (w) { return allowed[w]; });
  });

  if (strayed.length) {
    return { ok: false, why: "the teaching wandered onto " + strayed[0] +
             ", which this topic's relations cannot support" };
  }
  /* Length is a proxy for scope creep: three sentences were asked for, and a
     page of prose is a page the app cannot stand behind. */
  if (t.length > 600) return { ok: false, why: "the teaching ran far past what was asked for" };
  return { ok: true, teach: t.trim() };
}

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

  /* Screen the prose against the relations the SURVIVING questions use — not
     the ones proposed. A question that was discarded cannot license the
     teaching that came with it. */
  const usedRelations = kept.map(function (q) { return q.relation; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  const screened = screenTeaching(raw.teach, usedRelations);
  if (!screened.ok) dropped.push({ ask: "(teaching)", why: screened.why });

  return {
    ok: true,
    topic: {
      id: "gen:" + Date.now().toString(36),
      name: String(raw.name).slice(0, 60),
      subject: raw.subject === "Chemistry" ? "Chemistry" : "Physics",
      strand: String(raw.strand || "Generated").slice(0, 40),
      // Screened, not merely truncated. Prose that strays outside the
      // relations this topic uses is dropped rather than shown.
      teach: screened.ok ? screened.teach : "",
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
/* Four per band, not two.

   Two was measured at roughly 70% accuracy on a clean run and 60% on a
   careless one — one slip flipped an entire band, because 1-of-2 was the pass
   mark. Four gives 91% and 81%.

   Odd counts are worse than they look: three questions needs 2 of 3, a 67%
   bar, which punishes a single slip harder than 2 of 4 does. */
const CHECK_PER_BAND = 4;

/* Stop once a band has clearly failed.

   Sixteen questions at the front door is a lot, so the check gives up on the
   bands above one that plainly did not hold — the answer is already known and
   asking more only costs the learner patience. In practice most people answer
   far fewer than sixteen. */
function checkShouldStop(results, level) {
  const inBand = results.filter(function (r) { return r.level === level; });
  if (inBand.length < CHECK_PER_BAND) return false;
  const right = inBand.filter(function (r) { return r.correct; }).length;
  return right / inBand.length < 0.5;
}

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
    /* An honest statement of what this is worth. Simulated against learners of
       known ability it names the right band about nine times in ten on a clean
       run and eight in ten on a careless one — good enough to point you at a
       shelf, not good enough to call a result. Saying "a signpost" without the
       number would be softer and less useful. */
    caveat: "This gets the band right about nine times in ten, so treat it as a " +
      "signpost rather than a verdict. Nothing here is saved against your record, " +
      "and you can work at any level you like."
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
/* Dark, and deliberately plain.

   The layout follows CodeQuest — a wider single column, generous space at the
   top, a card-based body — because that shape already works on a phone and on
   a desktop without a sidebar to maintain.

   The palette does NOT follow CodeQuest. Its neon-on-near-black is a strong
   look that suits a coding app; a science app wants to be readable for an hour
   at a stretch. So: near-black greys, one restrained teal accent, and body text
   at a contrast that passes comfortably rather than exactly. */
.el{
  --bg-0:#0b0e11;      /* page */
  --bg-1:#12171c;      /* card */
  --bg-2:#1a2128;      /* inset — inputs, code, quiet panels */
  --bg-3:#232c35;      /* hover */
  --ink:#e6ebf0;
  --ink-soft:#a8b4c0;
  --ink-faint:#77848f;
  --line:#242d36;
  --line-soft:#1b2228;
  --a:#4dd0c0;         /* one accent, used sparingly */
  --a-tint:#12312e;
  --a-ink:#7fe3d6;
  --no:#f2836f; --no-bg:#2c1815;
  --ok:#63cf8d; --ok-bg:#13291d;
  --warn:#e0b871; --warn-bg:#2a2115;
  --r:12px;
  min-height:100%;background:var(--bg-0);color:var(--ink);
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
.el *{box-sizing:border-box}

/* Shell: CodeQuest's proportions. */
.el .wrap{max-width:940px;margin:0 auto;padding:52px 28px 96px;animation:el-fade .35s ease}
@keyframes el-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.el h1{font-size:30px;font-weight:750;letter-spacing:-.6px;margin:0 0 6px;color:var(--ink)}
.el h2{font-size:17px;font-weight:700;margin:0 0 8px;color:var(--ink)}
.el .sub{color:var(--ink-soft);font-size:14.5px;line-height:1.6;margin:0 0 26px;max-width:62ch}
.el .muted{font-size:13px;color:var(--ink-faint);line-height:1.6}

.el .card{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r);
  padding:20px 22px;margin-bottom:14px}

.el .subjhead{font-size:11px;font-weight:750;letter-spacing:.12em;text-transform:uppercase;
  color:var(--ink-faint);margin:30px 2px 10px}

/* Rows */
.el .skill,.el .askbtn,.el .next,.el .review{display:flex;align-items:center;gap:14px;width:100%;
  text-align:left;cursor:pointer;font-family:inherit;border-radius:var(--r);
  background:var(--bg-1);border:1px solid var(--line);padding:15px 18px;margin-bottom:9px;
  transition:background .14s,border-color .14s}
.el .skill:hover,.el .askbtn:hover,.el .review:hover{background:var(--bg-2);border-color:var(--a)}
.el .skill .nm,.el .askbtn .nm{font-size:15.5px;font-weight:650;color:var(--ink)}
.el .skill .st,.el .askbtn .st{font-size:12.5px;color:var(--ink-faint);margin-top:3px;line-height:1.5}
.el .skill .go,.el .askbtn .go,.el .review .go{margin-left:auto;color:var(--a);font-weight:700;font-size:17px}
.el .askbtn{border-style:dashed}
.el .askbtn.record,.el .askbtn.quiet{border-style:solid}
.el .askbtn.quiet .nm{font-size:14px;font-weight:600;color:var(--ink-soft)}
.el .askbtn.quiet .st{font-size:12px}

.el .next{background:var(--a-tint);border-color:var(--a)}
.el .next:hover{background:var(--bg-3)}
.el .next .nlab{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--a-ink)}
.el .next .nnm{font-size:17px;font-weight:700;margin-top:4px;color:var(--ink)}
.el .next .nwhy{font-size:12.5px;color:var(--ink-soft);margin-top:3px;line-height:1.5}

.el .review{background:var(--warn-bg);border-color:#4a3a1e}
.el .review .rnm{font-size:15px;font-weight:700;color:var(--warn)}
.el .review .rst{font-size:12.5px;color:var(--ink-soft);margin-top:3px;line-height:1.55}

/* Tags */
.el .tag{font-style:normal;margin-left:9px;padding:2px 8px;border-radius:999px;font-size:10.5px;
  font-weight:700;background:var(--a-tint);color:var(--a-ink)}
.el .tag.due{background:var(--warn-bg);color:var(--warn)}
.el .tag.made{background:#241a30;color:#c39bea}
.el .tag.lvl{background:var(--bg-2);color:var(--ink-faint);font-weight:650}
.el .tag.needs{background:transparent;color:var(--ink-faint);padding-left:0;font-weight:600}
.el .tcount{display:block;font-size:10.5px;font-weight:600;opacity:.75;margin-top:3px}

/* Level filter */
.el .levels{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:22px}
.el .lvbtn{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg-1);
  font-family:inherit;font-size:12.5px;font-weight:650;color:var(--ink-soft);cursor:pointer;transition:.14s}
.el .lvbtn:hover{border-color:var(--a);color:var(--ink)}
.el .lvbtn.on{background:var(--a);border-color:var(--a);color:#08201d}
.el .lvn{opacity:.7;font-weight:600;margin-left:4px}

/* Practice */
.el .tiers{display:flex;gap:9px;margin:14px 0 20px}
.el .tier{flex:1;padding:11px 8px;border:1px solid var(--line);border-radius:10px;
  background:var(--bg-1);font-family:inherit;font-size:12.5px;font-weight:650;
  color:var(--ink-soft);cursor:pointer;transition:.14s}
.el .tier:hover{border-color:var(--a)}
.el .tier.on{background:var(--a);border-color:var(--a);color:#08201d}
.el .qmethod{font-size:12px;font-weight:700;color:var(--a);margin-bottom:8px;line-height:1.5}
.el .qwhy{font-weight:500;color:var(--ink-faint)}
.el .ask{font-size:19px;font-weight:600;line-height:1.55;margin:0 0 18px;color:var(--ink)}
.el input.ans{width:100%;padding:14px 16px;font-size:17px;font-weight:600;font-family:inherit;
  border:1px solid var(--line);border-radius:10px;background:var(--bg-2);color:var(--ink)}
.el input.ans::placeholder{color:var(--ink-faint)}
.el input.ans:focus{outline:none;border-color:var(--a);background:var(--bg-1)}
.el input.cloudin{display:block;width:100%;margin-top:11px;padding:12px 14px;
  border:1px solid var(--line);border-radius:10px;background:var(--bg-2);
  color:var(--ink);font-family:inherit;font-size:15px;font-weight:600}
.el input.cloudin:focus{outline:none;border-color:var(--a)}

.el .opts{display:flex;flex-direction:column;gap:9px}
.el .opt{width:100%;text-align:left;padding:14px 17px;border:1px solid var(--line);
  border-radius:10px;background:var(--bg-1);font-family:inherit;font-size:15px;
  font-weight:600;color:var(--ink);cursor:pointer;transition:.14s}
.el .opt:hover:not(:disabled){border-color:var(--a);background:var(--bg-2)}
.el .opt:disabled{cursor:default}
.el .opt.right{border-color:var(--ok);background:var(--ok-bg);color:var(--ok)}
.el .opt.chosen{border-color:var(--no);background:var(--no-bg);color:var(--no)}
.el .optmark{font-size:12.5px;font-weight:700;opacity:.9}

/* CodeQuest's prev/next row */
.el .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.el .btn{padding:12px 20px;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);
  font-family:inherit;font-size:14px;font-weight:650;color:var(--ink);cursor:pointer;transition:.14s}
.el .btn:hover{border-color:var(--a);background:var(--bg-3)}
.el .btn.primary{background:var(--a);border-color:var(--a);color:#08201d}
.el .btn.primary:hover{background:var(--a-ink);border-color:var(--a-ink)}
.el .btn:disabled{opacity:.5;cursor:default}
.el .back{background:none;border:none;color:var(--a);font-family:inherit;font-size:14px;
  font-weight:650;cursor:pointer;padding:6px 0;margin-bottom:14px}

/* Feedback */
.el .fb{padding:14px 16px;border-radius:10px;margin-top:18px;font-size:14.5px;line-height:1.55}
.el .fb.ok{background:var(--ok-bg);color:var(--ok);border:1px solid #23523a}
.el .fb.no{background:var(--no-bg);color:var(--no);border:1px solid #5a3128}
.el .fb.hm{background:var(--bg-2);color:var(--ink-soft);border:1px solid var(--line)}

.el .steps{margin-top:20px;border-top:1px solid var(--line);padding-top:16px}
.el .stp{display:flex;gap:12px;font-size:14.5px;line-height:1.6;margin-bottom:10px;color:var(--ink-soft)}
.el .stp b{color:var(--a);flex:0 0 auto}
.el .methodname{font-size:11px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;
  color:var(--a);margin-bottom:8px}
.el .methodwhy{font-size:13px;line-height:1.6;color:var(--ink-faint);margin:10px 0 0;
  padding-top:10px;border-top:1px solid var(--line)}
.el .teach{font-size:14.5px;line-height:1.7;color:var(--ink-soft);margin:0}
.el .hint{font-size:14px;line-height:1.6;color:var(--ink-soft);
  background:var(--bg-2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:12px}
.el .hint.shown{background:var(--a-tint);border-color:var(--a);color:var(--ink)}
.el .hint.shown b{color:var(--a-ink)}
.el .buildson{background:var(--bg-2);border:1px solid var(--line);border-radius:10px;
  padding:12px 14px;font-size:13px;line-height:1.6;color:var(--ink-soft);margin-bottom:14px}

/* Generated topics */
.el .genwarn{background:#1d1630;border:1px solid #3a2b52;border-radius:10px;padding:14px 16px;
  font-size:13px;line-height:1.6;color:#c8b6e6;margin-bottom:16px}
.el .genwarn b{display:block;margin-bottom:4px;color:#dcccf5}

/* Misses */
.el .miss{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:9px;
  background:var(--bg-1)}
.el .miss .mask{font-size:14.5px;line-height:1.55;color:var(--ink)}
.el .miss .mans{font-size:13px;color:var(--ink-faint);margin-top:6px}
.el .miss .mans b{color:var(--a)}
.el .misslink{background:none;border:none;padding:8px 0 0;font-family:inherit;font-size:13px;
  font-weight:650;color:var(--a);cursor:pointer}

/* Keyboard focus, on everything reachable. */
.el button:focus-visible,.el input:focus-visible,.el a:focus-visible{
  outline:2px solid var(--a);outline-offset:2px}

@media (max-width:640px){
  .el .wrap{padding:26px 16px 64px;max-width:100%}
  .el h1{font-size:24px}
  .el .ask{font-size:17px}
  .el .card{padding:17px 16px}
  .el .skill,.el .askbtn,.el .next,.el .review{padding:14px 15px}
}
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
      {/* The method being practised, and what it buys over the previous one.
          `methodWhy` was written onto every question and read nowhere — the
          topic screen showed it from the METHODS table directly, so the field
          on the question itself was dead. On the practice screen it is more
          use anyway: this is where a learner is actually applying the method
          and wondering why the tier changed. */}
      {question.method && (
        <div className="qmethod">
          {question.method}
          {question.methodWhy && <span className="qwhy"> — {question.methodWhy}</span>}
        </div>
      )}
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
    setResults(next); setGiven(""); setNote(null);
    // Once a band has plainly failed, the bands above it are already answered.
    // Asking anyway would only cost patience.
    if (checkShouldStop(next, item.level)) { setI(paper.length); return; }
    setI(i + 1);
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
      <p className="sub">
        Question {i + 1}{i + 1 < paper.length ? " of up to " + paper.length : ""}. It stops early
        once your level is clear. Skipping is fine — it just counts as not yet.
      </p>
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
      {/* The teaching for the SELECTED tier, not the skill's single blob.

          Building per-tier methods and then rendering sk.teach was the exact
          dead-data mistake this session kept turning up: a field written, never
          read, and invisible because the old value still looked reasonable.
          The method name is shown too, so switching tier visibly changes what
          is being taught rather than only what is being asked. */}
      {(() => {
        const ms = METHODS[skillId];
        const m = ms && ms[Math.min(tier, ms.length) - 1];
        return (
          <div className="card">
            {m && <div className="methodname">{m.method}</div>}
            <p className="teach">{m ? m.teach : sk.teach}</p>
            {m && m.why && <p className="methodwhy">{m.why}</p>}
          </div>
        );
      })()}
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
