import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
// Study It ships in this same repo. Lectern is the front door, and Study It is
// one route in — see the router at the bottom of this file.
import StudyIt from "./App";
import Mathema from "./Mathema";
import Elements from "./Elements";

/* ============================================================
   Lectern — idiomatic React (single-file component).
   Drop into a React project's src/ folder and bring it in the usual way
   (default export, no named exports). React is the only dependency.
   The pure teaching/logic engine (grading, hint ladder, spaced
   repetition, AI generation + validation) is bundled below as a
   plain module value; the UI is real React components with hooks.
   All state persists per account in localStorage.
   ============================================================ */
/* eslint-disable */

/* Lectern — fresh core (no reuse of any earlier code or palette).
   A multi-subject learning app with REAL lessons and REAL practice.
   Two kinds of practice:
     - choice: multiple choice
     - type:   the learner types the answer; we normalize and accept sensible variants
   Honest checking only. No points / levels / streaks / badges.

   Runs in Node (module.exports) and in the browser (window.Academy). */

const Academy = (function () {
  "use strict";

  /* ---------- text normalizer for typed answers ----------
     lowercases, strips accents/tone-marks (é→e, nǐ→ni), drops punctuation,
     collapses spaces, and keeps Chinese characters intact. */
  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^0-9a-z一-鿿\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ---------- exercise builders ---------- */
  function mc(ask, right, wrong, why) {
    return { kind: "choice", ask: ask, choices: [right].concat(wrong), right: right, why: why || "" };
  }
  function ty(ask, accept, canonical, why) {
    // accept = array of acceptable answers (human readable); canonical shown in feedback.
    // The answer we DISPLAY must always be one we ACCEPT. Without this, an answer
    // written for readability — "nǐ hǎo (你好)" — is shown as correct and then
    // marked wrong when the learner types it back. Telling someone the answer and
    // then rejecting it is the worst thing this app could do.
    var can = canonical || accept[0];
    var acc = accept.slice();
    if (can && !acc.some(function (a) { return norm(a) === norm(can); })) acc.push(can);
    return { kind: "type", ask: ask, accept: acc, canonical: can, why: why || "" };
  }
  function checkType(ex, input) {
    if (!ex || !ex.accept || !ex.accept.length) return false;   // choice questions have no accept list
    const got = norm(input);
    if (!got) return false;
    return ex.accept.some(function (a) { return norm(a) === got; });
  }

  /* ---------- near-miss detection ----------
     How many single-character edits turn one string into the other.
     Used only to tell the learner HOW far off they were. We never claim to
     know they meant to type the right answer — "pato" is one letter from
     "gato" but it is a different word — so the wording stays factual:
     "one letter away", not "just a typo", and a near miss is still wrong. */
  function editDistance(a, b) {
    // Damerau (optimal string alignment): insert, delete, substitute, and
    // swapping two neighboring characters all count as ONE edit. The swap
    // matters — "hoal" for "hola" is the commonest typing slip there is, and
    // plain Levenshtein would score it 2 and miss it.
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3 || m > 64 || n > 64) return 99;
    let prev2 = null, prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        cur[j] = v;
      }
      prev2 = prev; prev = cur; cur = new Array(n + 1);
    }
    return prev[n];
  }
  function nearMiss(ex, input) {
    if (!ex || !ex.accept || ex.kind !== "type") return null;
    const got = norm(input);
    if (!got) return null;
    if (checkType(ex, input)) return null;
    let best = null, bestD = 99;
    ex.accept.forEach(function (a) {
      const t = norm(a);
      if (!t || t.length < 4) return;
      const allow = t.length <= 8 ? 1 : 2;
      const d = editDistance(got, t);
      if (d <= allow && d < bestD) { bestD = d; best = a; }
    });
    return best ? { answer: best, distance: bestD } : null;
  }

  /* ---------- seedable RNG (for math + shuffles, testable) ---------- */
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function pick(rng, a) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(rng, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* =======================================================================
     MATH — each topic teaches a method, then generates fresh problems.
     ======================================================================= */
  const MATH = {
    topics: [
      { id: "add", name: "Addition",
        teach: ["Addition means putting amounts together to find a total. A helpful trick is to start from the bigger number and count on. For 8 + 5, start at 8 and count five more: 9, 10, 11, 12, 13. So 8 + 5 = 13.",
                "When numbers get bigger, add the ones first, then the tens. 27 + 15: 7 + 5 = 12 (write 2, carry 1), then 2 + 1 + 1 = 4, giving 42."],
        gen: function (r, d) { const hi = d === 1 ? 9 : d === 2 ? 30 : 99; const a = ri(r, 2, hi), b = ri(r, 2, hi); return { q: a + " + " + b, answer: a + b }; } },
      { id: "sub", name: "Subtraction",
        teach: ["Subtraction means taking away, or finding the difference between two numbers. 13 − 5 asks 'how far apart are 5 and 13?'. Count up from 5 to 13 — that's 8 steps — so 13 − 5 = 8.",
                "You can always check a subtraction by adding back: if 13 − 5 = 8, then 8 + 5 should return 13. It does, so the answer is right."],
        gen: function (r, d) { const hi = d === 1 ? 10 : d === 2 ? 30 : 99; const a = ri(r, 3, hi), b = ri(r, 1, a); return { q: a + " − " + b, answer: a - b }; } },
      { id: "mul", name: "Multiplication",
        teach: ["Multiplication is fast repeated addition. 4 × 3 means 'four groups of three': 3 + 3 + 3 + 3 = 12. It also means the same as 'three groups of four', because order doesn't change the product.",
                "Learning the times tables up to 12 by heart makes almost every later step in math quicker. Patterns help: any number × 10 just adds a zero, and × 5 always ends in 0 or 5."],
        gen: function (r, d) { const hi = d === 1 ? 9 : d === 2 ? 12 : 15; const a = ri(r, 2, hi), b = ri(r, 2, Math.min(12, hi)); return { q: a + " × " + b, answer: a * b }; } },
      { id: "div", name: "Division",
        teach: ["Division shares an amount into equal groups. 24 ÷ 4 asks 'how many groups of 4 are in 24?' or 'if I split 24 into 4 equal groups, how big is each?'. The answer is 6.",
                "Division is the opposite of multiplication, so your times tables help directly: because 4 × 6 = 24, you instantly know 24 ÷ 4 = 6 and 24 ÷ 6 = 4."],
        gen: function (r, d) { const hi = d === 1 ? 9 : 12; const b = ri(r, 2, hi), ans = ri(r, 2, hi); return { q: (b * ans) + " ÷ " + b, answer: ans }; } },
      { id: "order", name: "Order of Operations",
        teach: ["When a problem mixes operations, there is an agreed order so everyone gets the same answer. Do multiplication and division before addition and subtraction.",
                "In 2 + 3 × 4, the multiplication happens first: 3 × 4 = 12, then 2 + 12 = 14. Doing it left-to-right would wrongly give 20."],
        gen: function (r) { const a = ri(r, 2, 9), b = ri(r, 2, 9), c = ri(r, 1, 20); return { q: c + " + " + a + " × " + b, answer: c + a * b }; } },
      { id: "frac", name: "Fractions",
        teach: ["A fraction describes parts of a whole. In 3/4, the bottom number (denominator) is how many equal parts the whole is split into, and the top (numerator) is how many parts you have.",
                "To add fractions that share the same denominator, add the top numbers and keep the bottom the same: 2/7 + 3/7 = 5/7. The size of the parts hasn't changed, you just have more of them."],
        gen: function (r) { const den = pick(r, [4, 5, 6, 8, 10]); const a = ri(r, 1, den - 2); const b = ri(r, 1, Math.max(1, den - a - 1)); return { q: a + "/" + den + " + " + b + "/" + den + "  — type the top number of the answer (over " + den + ")", answer: a + b, note: "= " + (a + b) + "/" + den }; } },
      { id: "word", name: "Word Problems",
        teach: ["Real math is usually hidden inside a story. The skill is turning words into a number sentence. Look for what you know, what you're asked to find, and which operation fits.",
                "Words like 'in all', 'altogether', and 'total' often mean add. 'Left', 'fewer', and 'how many more' often mean subtract. 'Each' and 'groups of' point to multiply or divide."],
        gen: function (r) {
          const type = ri(r, 1, 4);
          if (type === 1) { const a = ri(r, 3, 20), b = ri(r, 2, 15); return { q: "A basket has " + a + " apples. Someone adds " + b + " more. How many apples are there in all?", answer: a + b, note: a + " + " + b + " = " + (a + b) }; }
          if (type === 2) { const a = ri(r, 8, 30), b = ri(r, 2, a - 1); return { q: "There were " + a + " birds on a wire. " + b + " flew away. How many birds are left?", answer: a - b, note: a + " − " + b + " = " + (a - b) }; }
          if (type === 3) { const a = ri(r, 2, 9), b = ri(r, 2, 9); return { q: "A box holds " + b + " crayons. How many crayons are in " + a + " boxes?", answer: a * b, note: a + " × " + b + " = " + (a * b) }; }
          const per = ri(r, 2, 9), groups = ri(r, 2, 9); return { q: (per * groups) + " cookies are shared equally among " + groups + " friends. How many does each friend get?", answer: per, note: (per * groups) + " ÷ " + groups + " = " + per };
        } }
    ],
    check: function (problem, input) {
      if (input == null || String(input).trim() === "") return false;
      const n = Number(String(input).trim());
      return Number.isFinite(n) && n === problem.answer;
    }
  };

  /* =======================================================================
     MUSIC — note/interval/chord math; real tones played by the app.
     ======================================================================= */
  const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const IVS = [{ s: 0, n: "Unison" }, { s: 1, n: "Minor 2nd" }, { s: 2, n: "Major 2nd" }, { s: 3, n: "Minor 3rd" },
  { s: 4, n: "Major 3rd" }, { s: 5, n: "Perfect 4th" }, { s: 6, n: "Tritone" }, { s: 7, n: "Perfect 5th" },
  { s: 8, n: "Minor 6th" }, { s: 9, n: "Major 6th" }, { s: 10, n: "Minor 7th" }, { s: 11, n: "Major 7th" }, { s: 12, n: "Octave" }];
  const MUSIC = {
    NN: NN, IVS: IVS,
    midi: function (name, oct) { const i = NN.indexOf(name); if (i < 0) throw new Error("bad note " + name); return (oct + 1) * 12 + i; },
    name: function (m) { return NN[((m % 12) + 12) % 12]; },
    fullName: function (m) { return NN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); },
    freq: function (m) { return 440 * Math.pow(2, (m - 69) / 12); },
    intervalName: function (s) { if (s === 12) return "Octave"; const f = IVS.find(function (x) { return x.s === ((s % 12 + 12) % 12); }); return f ? f.n : "?"; },
    majorScale: function (root) { const steps = [0, 2, 4, 5, 7, 9, 11, 12]; const base = MUSIC.midi(root, 4); return steps.map(function (s) { return MUSIC.name(base + s); }); },
    majorTriad: function (root) { const base = MUSIC.midi(root, 4); return [0, 4, 7].map(function (s) { return MUSIC.name(base + s); }); },
    intervalQuiz: function (r) {
      const rootName = pick(r, ["C", "D", "E", "F", "G", "A"]);
      const root = MUSIC.midi(rootName, 4);
      const iv = pick(r, IVS.filter(function (x) { return x.s >= 2 && x.s <= 12; }));
      const names = IVS.map(function (x) { return x.n; });
      const set = [iv.n]; let g = 0;
      while (set.length < 4 && g++ < 60) { const c = pick(r, names); if (set.indexOf(c) === -1) set.push(c); }
      return { root: root, rootName: rootName + "4", semis: iv.s, target: root + iv.s, answer: iv.n, choices: shuffle(r, set) };
    }
  };

  /* =======================================================================
     COURSES with rich lessons + mixed exercises.
     ======================================================================= */
  const COURSES = {
    english: [
      { title: "The Jobs Words Do",
        teach: ["Every word in a sentence has a job. Knowing these jobs — the 'parts of speech' — helps you build clear sentences and understand what you read.",
                "A NOUN names a person, place, thing, or idea: teacher, London, pencil, courage. A VERB shows an action or a state of being: run, think, is. An ADJECTIVE describes a noun and answers 'what kind?' or 'how many?': red, tall, seven. An ADVERB describes a verb and often answers 'how?', usually ending in -ly: quietly, fast. A PRONOUN takes the place of a noun so you don't repeat it: he, she, it, they.",
                "One tricky thing: the same word can do different jobs. In 'I run daily', run is a verb. In 'I went for a run', run is a noun. Always look at how the word is used."],
        ex: [
          mc("Which word is the NOUN in 'The clever fox escaped'?", "fox", ["clever", "escaped", "the"], "Fox is the thing — a noun. 'Clever' describes it, 'escaped' is the action."),
          mc("Which word is the VERB in 'Rain fell all night'?", "fell", ["rain", "all", "night"], "Fell is the action. Rain is the noun doing it."),
          mc("Which word is the ADJECTIVE in 'a gentle breeze'?", "gentle", ["a", "breeze", "blew"], "Gentle describes the noun breeze."),
          mc("Which word is the ADVERB in 'He answered calmly'?", "calmly", ["he", "answered", "answer"], "Calmly tells how he answered and ends in -ly."),
          mc("Which word is the PRONOUN in 'She found the key'?", "She", ["found", "key", "the"], "She stands in for a person's name."),
          ty("What part of speech is the word 'happiness' (a noun, verb, adjective, or adverb)?", ["noun"], "noun", "Happiness names an idea, so it is a noun."),
          ty("Add -ly to make the adverb form of 'quiet'. Type the adverb.", ["quietly"], "quietly", "Many adverbs are made by adding -ly to an adjective."),
          ty("Type a pronoun you could use to replace 'the children'.", ["they", "them"], "they", "'They' (or 'them') replaces a plural group of people.")
        ] },
      { title: "Words People Mix Up",
        teach: ["Some words sound alike but mean different things. Getting them right makes your writing look careful and clear.",
                "THEIR shows something belongs to them (their car). THERE points to a place (sit there). THEY'RE is short for 'they are'. YOUR shows belonging (your bag); YOU'RE means 'you are'. ITS shows belonging (the dog wagged its tail); IT'S means 'it is'. TO shows direction (go to school); TOO means 'also' or 'more than enough'; TWO is the number 2. THAN compares things (taller than me); THEN is about time (first this, then that).",
                "A quick test: if you can replace the word with 'they are', 'you are', or 'it is', then the apostrophe version (they're, you're, it's) is correct."],
        ex: [
          ty("Fill the blank and type the whole word: '___ dog buried its bone.' (belonging to them)", ["their"], "their", "'Their' shows the dog belongs to them."),
          ty("Fill the blank: '___ going to be late.' (they are)", ["they're"], "they're", "'They're' means 'they are'."),
          mc("Choose the right word: 'The cat licked ___ paw.'", "its", ["it's", "his", "her"], "Belonging, no apostrophe: its paw."),
          mc("Choose the right word: '___ almost midnight.'", "It's", ["Its", "It", "Their"], "'It's' means 'it is'."),
          ty("Fill the blank: 'This tea is ___ hot to drink.' (more than enough)", ["too"], "too", "'Too' means excessively or also."),
          mc("Choose the right word: 'A rabbit is faster ___ a turtle.'", "than", ["then", "thann", "that"], "'Than' is used to compare two things."),
          ty("Fill the blank: 'Please put your coat over ___.' (a place)", ["there"], "there", "'There' refers to a place."),
          mc("Choose the right word: 'Is this ___ umbrella?'", "your", ["you're", "yore", "yours'"], "Belonging: your umbrella.")
        ] },
      { title: "Verbs Through Time",
        teach: ["Verbs change to show WHEN something happens (tense) and to match WHO is doing it (agreement).",
                "In the present, verbs used with he, she, or it usually add -s: 'She walks.' With I, you, we, or they, there is no -s: 'They walk.' For the past, most verbs add -ed: walk → walked. But many everyday verbs are irregular and must be learned: go → went, eat → ate, see → saw, is → was.",
                "Agreement means the verb must fit the subject. 'The dogs bark' (plural, no -s on the verb) but 'The dog barks' (singular, add -s). Mismatches like 'The dogs barks' sound wrong to a careful ear."],
        ex: [
          mc("Choose the verb that agrees: 'My sister ___ the piano.'", "plays", ["play", "playing", "played tomorrow"], "Singular 'sister' takes 'plays'."),
          mc("Choose the verb that agrees: 'The players ___ hard.'", "train", ["trains", "training", "is training"], "Plural 'players' takes 'train' with no -s."),
          ty("Type the past tense of the verb 'go'.", ["went"], "went", "'Go' is irregular: its past tense is 'went'."),
          ty("Type the past tense of the verb 'eat'.", ["ate"], "ate", "'Eat' is irregular: its past tense is 'ate'."),
          ty("Type the past tense of the verb 'walk'.", ["walked"], "walked", "Regular verbs add -ed: walk → walked."),
          mc("Choose the correct verb: 'Yesterday we ___ a film.'", "saw", ["see", "seed", "seen"], "Past tense of 'see' is the irregular 'saw'."),
          ty("Type the missing verb (present): 'He ___ to school.' (from 'go')", ["goes"], "goes", "With 'he', 'go' becomes 'goes'."),
          mc("Choose the correct verb: 'The baby ___ asleep now.'", "is", ["are", "am", "be"], "Singular subject takes 'is'.")
        ] },
      { title: "Building Neat Sentences",
        teach: ["A sentence needs a capital letter at the start and an end mark: a period (.), question mark (?), or exclamation point (!). Names of people, places, days, and months are always capitalized, and so is the word 'I'.",
                "Commas separate items in a list: 'We packed apples, cheese, and bread.' Apostrophes do two jobs: they show belonging ('Mia's book') and they stand in for missing letters in contractions ('do not' → 'don't').",
                "Plurals usually add -s (cat → cats), but some change more: words ending in -y often become -ies (baby → babies), and some are irregular (child → children, mouse → mice)."],
        ex: [
          mc("Which sentence is written correctly?", "Where are you going?", ["where are you going.", "Where are you going", "where are you going?"], "Capital start, question mark end."),
          ty("Type the plural of the word 'child'.", ["children"], "children", "'Child' is irregular: its plural is 'children'."),
          ty("Type the plural of the word 'baby'.", ["babies"], "babies", "Words ending in a consonant + y change y to -ies: babies."),
          ty("Type the contraction for 'cannot'.", ["can't", "cant"], "can't", "The apostrophe replaces the missing letters: can't."),
          mc("Which list uses commas correctly?", "I bought pens, paper, and glue.", ["I bought pens paper and glue.", "I bought, pens, paper, glue.", "I bought pens, paper and, glue."], "Commas separate each list item."),
          ty("Rewrite as a possessive: the bike belonging to Sam. Type it (two words).", ["sam's bike", "sams bike"], "Sam's bike", "Add apostrophe + s for one owner: Sam's bike."),
          mc("Which word needs a capital letter: 'we travel in august'?", "august", ["we", "travel", "in"], "Months are always capitalized: August.")
        ] },
      { title: "Word Power: Opposites & Synonyms",
        teach: ["Building vocabulary means learning not just what a word means, but the words near it. A SYNONYM is a word with almost the same meaning (big / large). An ANTONYM is a word with the opposite meaning (big / small).",
                "Knowing synonyms lets you avoid repeating yourself and choose the exact shade of meaning you want. Knowing antonyms sharpens your understanding — you often understand a word best by knowing its opposite."],
        ex: [
          mc("Which word is a SYNONYM of 'happy'?", "glad", ["angry", "tired", "quiet"], "Glad means almost the same as happy."),
          mc("Which word is an ANTONYM of 'ancient'?", "modern", ["old", "dusty", "huge"], "Modern is the opposite of ancient."),
          ty("Type a one-word antonym (opposite) of 'hot'.", ["cold", "cool", "chilly"], "cold", "Cold is the opposite of hot."),
          ty("Type a one-word synonym for 'fast'.", ["quick", "rapid", "speedy", "swift"], "quick", "Quick means the same as fast."),
          mc("Which word is an ANTONYM of 'empty'?", "full", ["hollow", "open", "light"], "Full is the opposite of empty."),
          mc("Which word is a SYNONYM of 'begin'?", "start", ["finish", "stop", "wait"], "Start means the same as begin.")
        ] },
      { title: "Prefixes & Suffixes",
        teach: ["You can unlock the meaning of long words by breaking them into parts. A PREFIX is added to the FRONT of a word to change its meaning. 'un-' means not (unhappy = not happy), 're-' means again (redo = do again), and 'pre-' means before (preview = see before).",
                "A SUFFIX is added to the END of a word. '-ful' means full of (joyful = full of joy), '-less' means without (fearless = without fear), and '-er' often means a person who does something (a teacher is a person who teaches). Spotting these parts helps you read and spell words you've never seen before."],
        ex: [
          mc("The prefix 'un-' in 'unhappy' means...", "not", ["very", "again", "before"], "Un- means not, so unhappy means not happy."),
          ty("Add a prefix meaning 'again' to 'do' to make a word meaning 'do again'. Type the word.", ["redo"], "redo", "Re- means again: redo = do again."),
          mc("The suffix '-less' in 'fearless' means...", "without", ["full of", "again", "more"], "-less means without, so fearless means without fear."),
          ty("Add '-ful' to 'joy' to make a word meaning 'full of joy'. Type the word.", ["joyful"], "joyful", "-ful means full of: joyful = full of joy."),
          mc("The prefix 'pre-' in 'preview' means...", "before", ["after", "not", "again"], "Pre- means before: a preview comes before."),
          ty("A person who teaches is a teach + er = a ___. Type the word.", ["teacher"], "teacher", "-er can mean a person who does something.")
        ] },
      { title: "Similes & Metaphors",
        teach: ["Writers paint pictures in your mind by comparing things. A SIMILE compares two things using the words 'like' or 'as': 'as brave as a lion', or 'she runs like the wind'. The word 'like' or 'as' is the clue.",
                "A METAPHOR is bolder: it says one thing IS another, without using like or as: 'the classroom was a zoo', or 'time is money'. Nobody thinks the classroom is really a zoo — the metaphor just means it was wild and noisy. Both tools make writing vivid."],
        ex: [
          mc("Which sentence is a SIMILE?", "She is as busy as a bee.", ["The world is a stage.", "Time is money.", "His room was a disaster zone."], "It compares using 'as' — that makes it a simile."),
          mc("A simile compares two things using the words...", "like or as", ["is or was", "and or but", "not or no"], "Similes use 'like' or 'as'."),
          mc("Which sentence is a METAPHOR?", "The world is a stage.", ["He eats like a bird.", "She's as quiet as a mouse.", "It shone like gold."], "It says one thing IS another with no like/as — a metaphor."),
          ty("Complete this common simile: 'as quiet as a ___' (an animal). Type the word.", ["mouse"], "mouse", "'As quiet as a mouse' is a well-known simile."),
          mc("'He ran like the wind' is an example of a...", "simile", ["metaphor", "prefix", "verb"], "It uses 'like', so it's a simile.")
        ] },
      { title: "Punctuation That Changes Meaning",
        teach: ["Most punctuation is about breathing room, but some of it genuinely changes what a sentence says. The famous example is the comma of direct address: 'Let's eat, Grandma' invites her to dinner, while 'Let's eat Grandma' proposes something considerably worse. The words are identical; the comma does all the work.",
                "The apostrophe has two jobs and they get confused constantly. It marks a missing letter — do not becomes don't, it is becomes it's — and it marks ownership: the dog's bowl, Anna's coat. The exception that catches everyone is 'its'. When it means belonging, there is no apostrophe at all: the dog wagged its tail. Only write it's when you could say 'it is'.",
                "Apostrophes never make a plural. A sign reading 'fresh apple's' is offering something that belongs to an apple. For a plain plural, just add -s: apples, potatoes, the Smiths. If you are ever unsure, test by expanding: if 'it is' fits, use it's; if the thing owns something, use the apostrophe; if there is simply more than one, use nothing."],
        ex: [
          mc("Which sentence invites Grandma to eat with you?", "Let's eat, Grandma", ["Let's eat Grandma", "Lets eat Grandma", "Let's, eat Grandma"], "The comma of direct address separates the person you're speaking to."),
          mc("Which is correct?", "The dog wagged its tail", ["The dog wagged it's tail", "The dog wagged its' tail", "The dog wagged it is tail"], "Belonging takes no apostrophe: its tail."),
          ty("Rewrite 'it is raining' using the shortened form of 'it is'. Type just that one word.", ["it's"], "it's", "The apostrophe stands in for the missing letter i."),
          mc("A market sign reads 'fresh apple's'. What is wrong?", "An apostrophe never makes a plural", ["Apple should be capitalised", "Fresh should come after", "Nothing is wrong"], "Plurals just add -s: apples."),
          mc("Which shows that the coat belongs to Anna?", "Anna's coat", ["Annas coat", "Annas' coat", "Anna coat's"], "Singular owner: add apostrophe then s."),
          mc("What is the quick test for it's versus its?", "Try saying 'it is' instead", ["Count the letters", "Check if the noun is plural", "See if it starts a sentence"], "If 'it is' fits, write it's. Otherwise no apostrophe."),
          mc("Which sentence is punctuated correctly?", "The Smiths went to the park", ["The Smith's went to the park", "The Smiths' went to the park", "The Smith's' went to the park"], "More than one Smith is just a plural: no apostrophe.")
        ] }
    ],

    science: [
      { title: "Our Place in Space",
        teach: ["We live on Earth, one of eight planets that travel around the Sun. In order from the Sun they are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. A simple sentence can help you remember them: 'My Very Educated Mother Just Served Us Noodles.'",
                "The Sun is not a planet — it is a star, a huge ball of hot glowing gas, and its gravity holds the whole Solar System together. The Moon is much smaller and orbits Earth; it does not make its own light but shines because it reflects sunlight.",
                "The inner planets (Mercury, Venus, Earth, Mars) are small and rocky. The outer giants (Jupiter, Saturn, Uranus, Neptune) are huge balls of gas and ice. Saturn is famous for its bright rings."],
        ex: [
          mc("Which planet is closest to the Sun?", "Mercury", ["Venus", "Earth", "Mars"], "Mercury is the first planet from the Sun."),
          mc("The Sun is best described as a...", "star", ["planet", "moon", "comet"], "The Sun is a star at the center of the Solar System."),
          ty("Type the name of the planet we live on.", ["earth"], "Earth", "We live on Earth, the third planet from the Sun."),
          mc("Why does the Moon shine?", "It reflects the Sun's light", ["It is on fire", "It makes its own light", "It is a star"], "The Moon reflects sunlight; it makes no light of its own."),
          ty("Which planet is famous for its bright rings? Type its name.", ["saturn"], "Saturn", "Saturn's rings are made of ice and rock."),
          mc("How many planets orbit our Sun?", "8", ["7", "9", "12"], "There are eight planets."),
          ty("Type the name of the largest planet in the Solar System.", ["jupiter"], "Jupiter", "Jupiter is the biggest planet by far.")
        ] },
      { title: "How Living Things Work",
        teach: ["Every living thing — from a blade of grass to a blue whale — is built from tiny units called cells. Some living things are a single cell; others, like you, are made of trillions working together.",
                "Plants are special because they make their own food. Using energy from sunlight, they take in carbon dioxide from the air and water from the soil and turn them into food, releasing oxygen. This process is called photosynthesis, and it is why plants are so important for the air we breathe.",
                "Animals, including humans, cannot make food from sunlight, so they must eat. Inside the body, the heart pumps blood to carry oxygen and nutrients everywhere, and the lungs take in the oxygen we need and push out carbon dioxide."],
        ex: [
          ty("What is the tiny basic unit that all living things are made of? Type the word.", ["cell", "cells"], "cell", "Cells are the building blocks of life."),
          mc("What do plants make using sunlight?", "their own food", ["oxygen only", "soil", "water"], "Through photosynthesis, plants make food and release oxygen."),
          ty("Which gas do plants take IN during photosynthesis? Type its name.", ["carbon dioxide", "co2"], "carbon dioxide", "Plants absorb carbon dioxide and release oxygen."),
          mc("Which organ pumps blood around the body?", "the heart", ["the brain", "the stomach", "the liver"], "The heart is a pump for blood."),
          ty("Which gas must humans breathe in to stay alive? Type its name.", ["oxygen", "o2"], "oxygen", "We breathe in oxygen and breathe out carbon dioxide."),
          mc("The process plants use to make food is called...", "photosynthesis", ["digestion", "respiration", "evaporation"], "'Photo' means light — plants use light to make food."),
          mc("What do the lungs do?", "take in oxygen and remove carbon dioxide", ["pump blood", "digest food", "make bones"], "Lungs handle the exchange of gases when we breathe.")
        ] },
      { title: "What Everything Is Made Of",
        teach: ["Everything around you is matter — anything that takes up space and has weight. Matter usually appears in one of three states: solid, liquid, or gas. A solid keeps its shape (an ice cube); a liquid flows and takes the shape of its container (water); a gas spreads out to fill any space (steam).",
                "Adding or removing heat changes the state. Heating ice makes it melt into water; heating water enough makes it boil and become a gas (water vapor). Cooling reverses this: water can freeze back into ice. The water itself is still water the whole time — only its form changes.",
                "If you could zoom in far enough, you'd find that all matter is built from incredibly tiny particles called atoms. Atoms join together to form molecules — for example, two hydrogen atoms and one oxygen atom make one molecule of water, written H₂O."],
        ex: [
          mc("The three common states of matter are solid, liquid, and...", "gas", ["metal", "energy", "wood"], "Solid, liquid, and gas are the everyday states of matter."),
          ty("What state of matter is ice? Type one word.", ["solid"], "solid", "Ice is water in its solid state."),
          ty("When a solid is heated and turns into a liquid, what is that called? Type one word.", ["melting", "melt"], "melting", "Adding heat melts a solid into a liquid."),
          mc("What are the tiny particles that all matter is made of?", "atoms", ["cells", "germs", "grains"], "Atoms are the building blocks of matter."),
          ty("At what temperature in °C does water freeze? Type the number.", ["0", "zero"], "0", "Water freezes at 0°C (32°F)."),
          mc("Water as a gas is called...", "water vapor", ["ice", "frost", "mud"], "Boiling water becomes water vapor (steam)."),
          mc("What is the chemical formula for water?", "H₂O", ["CO₂", "O₂", "NaCl"], "Water is two hydrogen atoms plus one oxygen: H₂O.")
        ] },
      { title: "Forces, Energy & Weather",
        teach: ["A force is simply a push or a pull. Forces can start things moving, stop them, or change their direction. One force is acting on you right now: gravity, the pull that draws everything toward the Earth and makes dropped objects fall.",
                "Another important force is friction — the rubbing force between two surfaces that slows things down. Friction is why a ball rolling on grass eventually stops, and why rubbing your hands together warms them.",
                "Energy is what makes things happen, and it comes in many forms: light, heat, sound, movement, and electricity. Energy can change from one form to another. Weather is powered by the Sun heating the Earth: water evaporates into the air, cools and forms clouds (condensation), and later falls as rain or snow (precipitation) — the water cycle."],
        ex: [
          ty("What force pulls a dropped ball down to the ground? Type the word.", ["gravity"], "gravity", "Gravity pulls objects toward the Earth."),
          mc("A force is best described as a...", "push or a pull", ["kind of matter", "type of cell", "unit of heat"], "Forces push or pull on objects."),
          ty("What rubbing force slows a sliding object down? Type the word.", ["friction"], "friction", "Friction acts between surfaces that rub together."),
          mc("In the water cycle, water turning into vapor in the air is called...", "evaporation", ["condensation", "precipitation", "erosion"], "Heat evaporates water into vapor."),
          ty("What do we call rain or snow falling from clouds? Type the word (starts with p).", ["precipitation"], "precipitation", "Precipitation is water falling from the sky."),
          mc("Which of these is a form of energy?", "sound", ["gravity", "mass", "volume"], "Light, heat, sound, and motion are all forms of energy."),
          mc("What powers the weather and the water cycle?", "the Sun's heat", ["the Moon", "the wind alone", "gravity alone"], "The Sun heats the Earth and drives the water cycle.")
        ] },
      { title: "The Human Body",
        teach: ["Your body is a team of parts that work together. Your skeleton — the frame of bones inside you — holds you up and protects soft organs like your heart and brain. An adult body has 206 bones. Muscles attach to bones and pull on them so you can move.",
                "Your brain is the control center: it lets you think, feel, and move, and it sends messages to the rest of the body. When you eat, food travels to your stomach, which breaks it down so your body can use the energy. Each part has a clear job, and together they keep you alive and active."],
        ex: [
          mc("What supports your body and protects your organs?", "the skeleton", ["the muscles", "the skin", "the blood"], "The skeleton of bones is your body's frame."),
          ty("The organ that controls your body and lets you think is the ___. Type the word.", ["brain"], "brain", "The brain is the body's control center."),
          mc("What pulls on your bones to make you move?", "muscles", ["nerves", "skin", "hair"], "Muscles attach to bones and move them."),
          mc("Where is food broken down after you swallow it?", "the stomach", ["the lungs", "the heart", "the brain"], "The stomach breaks food down."),
          ty("All your bones together make up your ___. Type the word.", ["skeleton"], "skeleton", "The bones together form the skeleton."),
          mc("About how many bones does an adult human body have?", "206", ["50", "100", "500"], "An adult has 206 bones.")
        ] },
      { title: "Plants & Habitats",
        teach: ["A plant has parts that each do a job. The roots grow down and drink in water from the soil. The stem holds the plant up and carries water to the rest of the plant. The leaves catch sunlight and use it to make the plant's food. The flowers make seeds, which can grow into brand-new plants.",
                "Every living thing has a habitat — the natural home that gives it the food, water, and shelter it needs. A desert, a forest, an ocean, and a pond are all habitats, and different plants and animals are suited to each one."],
        ex: [
          mc("Which part of a plant takes in water from the soil?", "the roots", ["the leaves", "the flower", "the seed"], "Roots drink in water from the soil."),
          ty("The part of a plant that catches sunlight to make food is the ___. Type the word.", ["leaves", "leaf"], "leaves", "Leaves catch sunlight to make food."),
          mc("What do flowers make so that new plants can grow?", "seeds", ["water", "soil", "roots"], "Flowers make seeds for new plants."),
          mc("The natural home of an animal or plant is called its...", "habitat", ["garden", "country", "cage"], "A habitat provides food, water, and shelter."),
          ty("A fish's ocean or a camel's desert is called its ___ (natural home). Type the word.", ["habitat"], "habitat", "The natural home of a living thing is its habitat."),
          mc("Which plant part holds the plant up and carries water?", "the stem", ["the roots", "the petal", "the seed"], "The stem supports the plant and carries water.")
        ] },
      { title: "Light & Sound",
        teach: ["Light and sound both travel as waves, but they are not the same kind of thing, and one difference explains almost everything else. Sound needs something to travel through — air, water, a wall. Light does not. That is why the Sun can reach us across empty space and why space itself is silent: there is nothing out there for sound to move through.",
                "Light is also far faster. Light covers about 300,000 kilometres every second; sound manages roughly 340 meters. You can measure the gap yourself in a thunderstorm. The flash and the bang happen at the same moment, but the light arrives almost instantly while the sound is still on its way. Count the seconds between them and divide by three for the rough distance in kilometres.",
                "White light is not plain — it is every color together. A prism or a raindrop bends each color by a slightly different amount and fans them apart, which is exactly what a rainbow is. And an object's color is simply the light it fails to absorb: a leaf looks green because it absorbs the other colors and bounces green back at your eye."],
        ex: [
          mc("Why is space silent?", "Sound needs a material to travel through, and space is nearly empty", ["Sound is too quiet out there", "Space absorbs all sound", "Sound freezes in the cold"], "No air, no water, no solid — nothing for the wave to move through."),
          mc("Which travels faster?", "light", ["sound", "they are the same", "it depends on the color"], "Light: about 300,000 km per second against sound's 340 meters."),
          mc("In a storm you see the flash before you hear the thunder because...", "light reaches you much sooner than sound", ["lightning happens first", "thunder starts later", "your eyes are faster than your ears"], "Both happen at once; the light simply arrives first."),
          ty("Roughly how many seconds between flash and bang for each kilometre of distance? Type the digit.", ["3", "three"], "3", "Sound covers about a third of a kilometre per second."),
          mc("What is white light actually made of?", "all the colors together", ["no color at all", "only yellow", "light with the color removed"], "A prism fans white light back into its colors."),
          mc("Why does a leaf look green?", "It absorbs the other colors and reflects green", ["It makes green light", "Green is the only color in sunlight", "Its shape bends light"], "The color you see is the light the object did not absorb."),
          mc("A rainbow forms because raindrops...", "bend each color by a different amount", ["are green underneath", "glow in sunlight", "reflect the sky"], "Each color bends slightly differently, so they fan apart.")
        ] }
    ],

    social: [
      { title: "Continents & Oceans",
        teach: ["Earth's land is divided into seven large areas called continents: Asia, Africa, North America, South America, Antarctica, Europe, and Australia. Asia is the biggest and has the most people; Antarctica, at the bottom of the world, is a frozen land almost nobody lives on.",
                "Between and around the continents lies water — five oceans. From largest to smallest they are the Pacific, Atlantic, Indian, Southern, and Arctic. The Pacific alone is bigger than all the land on Earth combined.",
                "An imaginary line called the Equator runs around the middle of the Earth, splitting it into the Northern and Southern Hemispheres. Places near the Equator are usually hot; places near the poles are cold."],
        ex: [
          ty("How many continents are there on Earth? Type the number.", ["7", "seven"], "7", "There are seven continents."),
          mc("Which is the largest ocean?", "Pacific", ["Atlantic", "Indian", "Arctic"], "The Pacific is the largest ocean."),
          ty("Which frozen continent is at the very bottom of the Earth? Type its name.", ["antarctica"], "Antarctica", "Antarctica is the icy continent around the South Pole."),
          mc("Which is the largest continent?", "Asia", ["Africa", "Europe", "North America"], "Asia is largest in both land and population."),
          ty("What is the imaginary line around the middle of the Earth called?", ["the equator", "equator"], "the Equator", "The Equator divides the Northern and Southern Hemispheres."),
          mc("On which continent is Egypt?", "Africa", ["Asia", "Europe", "South America"], "Egypt is in northeastern Africa.")
        ] },
      { title: "Capitals of Europe",
        teach: ["A capital city is where a country's government is based and its leaders work. It is not always the biggest or most famous city, but it is the country's official center.",
                "Some European capitals to know: France → Paris, the United Kingdom → London, Germany → Berlin, Italy → Rome, Spain → Madrid, and Greece → Athens, one of the oldest cities in the world and the birthplace of democracy.",
                "Capitals rarely landed where they are by accident. Most began as the safest or best-connected spot available: London and Paris both grew at the lowest bridging point of a major river, close enough to the sea for trade but far enough inland to be defended. Madrid is the odd one out — it sits almost exactly in the geographic center of Spain, chosen in 1561 partly for that neutrality.",
                "Berlin shows how politics can move a capital. When Germany was divided after the Second World War the capital moved to Bonn, and only after reunification in 1990 did it return to Berlin. A capital city is a decision, and decisions can be revisited."],
        ex: [
          ty("Type the capital city of France.", ["paris"], "Paris", "Paris is the capital of France."),
          mc("What is the capital of Italy?", "Rome", ["Milan", "Venice", "Florence"], "Rome is Italy's capital."),
          ty("Type the capital city of Germany.", ["berlin"], "Berlin", "Berlin is the capital of Germany."),
          mc("What is the capital of Spain?", "Madrid", ["Barcelona", "Seville", "Valencia"], "Madrid is Spain's capital."),
          ty("Type the capital of the United Kingdom.", ["london"], "London", "London is the UK's capital."),
          mc("Athens, one of the world's oldest cities, is the capital of...", "Greece", ["Turkey", "Italy", "Egypt"], "Athens is the capital of Greece."),
          mc("Why did cities like London and Paris grow where they did?", "At the lowest bridging point of a river, near trade but defensible", ["At the highest mountain pass", "Wherever the king was born", "At the exact center of the country"], "River crossings gave both trade access and defense."),
          mc("Which capital was chosen partly for sitting at its country's geographic center?", "Madrid", ["London", "Rome", "Berlin"], "Madrid sits near the center of Spain, chosen in 1561 partly for that neutrality."),
          mc("Germany's capital moved to Bonn and back to Berlin because of...", "division after the war, then reunification in 1990", ["a flood", "a royal decree", "a change of language"], "A capital is a political decision, and decisions can be revisited.")
        ] },
      { title: "Capitals Around the World",
        teach: ["Capitals can be surprising. The biggest or most famous city is often NOT the capital. Australia's capital is Canberra, not Sydney. Canada's is Ottawa, not Toronto. Brazil's is Brasília, not Rio de Janeiro. The United States' capital is Washington, D.C., not New York City.",
                "A few more to know: Japan → Tokyo, China → Beijing, Egypt → Cairo, and Kenya → Nairobi.",
                "There is a pattern behind those surprises. Canberra, Ottawa, Brasília and Washington were all chosen or built deliberately, usually to settle a rivalry between two larger cities or to pull a country's center of gravity inland. Canberra was a compromise between Sydney and Melbourne; Brasília was built from empty ground in 1960 to draw people away from the crowded coast.",
                "So when a capital seems like the wrong answer, it is often the point: the country picked a city that belonged to nobody in particular. A handful of countries go further and run more than one capital — South Africa has three, splitting its government, courts and parliament between Pretoria, Bloemfontein and Cape Town."],
        ex: [
          mc("What is the capital of Australia?", "Canberra", ["Sydney", "Melbourne", "Perth"], "Canberra is the capital — a common trick, since Sydney is bigger."),
          mc("What is the capital of Canada?", "Ottawa", ["Toronto", "Vancouver", "Montreal"], "Ottawa is Canada's capital, not Toronto."),
          ty("Type the capital of Japan.", ["tokyo"], "Tokyo", "Tokyo is Japan's capital."),
          mc("What is the capital of Brazil?", "Brasília", ["Rio de Janeiro", "São Paulo", "Salvador"], "Brasília was built to be the capital; Rio is not."),
          ty("Type the capital of Egypt.", ["cairo"], "Cairo", "Cairo is Egypt's capital."),
          mc("What is the capital of the United States?", "Washington, D.C.", ["New York City", "Los Angeles", "Boston"], "Washington, D.C. is the U.S. capital."),
          mc("Why was Canberra made Australia's capital?", "As a compromise between Sydney and Melbourne", ["It was the largest city", "It has the best harbour", "It was the first city founded"], "Neither rival city could have it, so a new one was chosen."),
          mc("Brasília was built from empty ground in 1960 mainly to...", "draw people inland, away from the crowded coast", ["escape a war", "be nearer the sea", "replace a city lost to fire"], "Planned capitals often pull a country's center of gravity inland."),
          mc("Which country runs its government from three different capitals?", "South Africa", ["Japan", "Egypt", "Kenya"], "Pretoria, Bloemfontein and Cape Town hold the government, courts and parliament.")
        ] },
      { title: "Wonders of the World",
        teach: ["Our planet has amazing record-breaking places. The Sahara, spread across North Africa, is the largest hot desert. Mount Everest, in the Himalayas between Nepal and Tibet, is the highest mountain above sea level. The Amazon in South America is the largest rainforest and home to a huge share of Earth's plants and animals.",
                "People have built wonders too: the Great Wall of China stretches for thousands of miles, the pyramids of Giza in Egypt are nearly 4,500 years old, and the Eiffel Tower is the iron landmark of Paris."],
        ex: [
          ty("Type the name of the world's largest hot desert (in North Africa).", ["the sahara", "sahara"], "the Sahara", "The Sahara covers much of North Africa."),
          mc("What is the highest mountain above sea level?", "Mount Everest", ["K2", "Kilimanjaro", "Mont Blanc"], "Everest, in the Himalayas, is the highest peak."),
          mc("In which country are the pyramids of Giza?", "Egypt", ["Mexico", "Greece", "Iraq"], "The Giza pyramids are in Egypt."),
          ty("The Eiffel Tower is the famous landmark of which city? Type the city.", ["paris"], "Paris", "The Eiffel Tower stands in Paris, France."),
          mc("The world's largest rainforest is the...", "Amazon", ["Congo", "Sahara", "Gobi"], "The Amazon is in South America."),
          mc("The Great Wall is found in which country?", "China", ["Japan", "India", "Korea"], "The Great Wall of China is thousands of miles long.")
        ] },
      { title: "Landforms & Maps",
        teach: ["The surface of the Earth comes in many shapes called landforms. A mountain is very high, steep land. A valley is the low land that sits between hills or mountains. An island is a piece of land completely surrounded by water, while a peninsula is land that is nearly surrounded by water but still joined to the mainland.",
                "Maps help us find our way. A compass shows the four main directions: North, East, South, and West. North is usually at the top of a map, and South is the opposite of North."],
        ex: [
          mc("A piece of land completely surrounded by water is an...", "island", ["valley", "mountain", "desert"], "An island is surrounded by water on all sides."),
          ty("Very high, steep land is called a ___. Type the word.", ["mountain"], "mountain", "A mountain is very high land."),
          mc("Low land between two mountains or hills is a...", "valley", ["cliff", "peak", "plateau"], "A valley is the low land between higher land."),
          mc("On a compass, which direction is the opposite of North?", "South", ["East", "West", "Up"], "South is opposite North."),
          ty("The four main compass directions are North, East, South, and ___. Type the word.", ["west"], "West", "North, East, South, West are the main directions."),
          mc("A tool that shows direction on a map is a...", "compass", ["ruler", "clock", "ladder"], "A compass shows which way is North.")
        ] },
      { title: "A Closer Look at Earth",
        teach: ["The Earth spins around like a top, turning all the way around once each day. The half facing the Sun has daytime, while the half turned away has night. That is why day and night take turns.",
                "The Earth is also tilted as it travels around the Sun, and that tilt is what gives us the seasons. The very top of the Earth is the North Pole and the very bottom is the South Pole — both are freezing cold. The Equator, the imaginary line around the middle, is the warmest part."],
        ex: [
          mc("What causes day and night?", "the Earth spinning", ["the Sun moving around Earth", "clouds", "the Moon"], "As Earth spins, each side takes turns facing the Sun."),
          ty("The cold point at the very top of the Earth is the North ___. Type the word.", ["pole"], "Pole", "The North Pole is at the top of the Earth."),
          mc("Which part of the Earth is the warmest?", "the Equator", ["the North Pole", "the South Pole", "the mountains"], "The Equator, around the middle, gets the most direct sunlight."),
          mc("The Earth spins fully around once every...", "day", ["hour", "week", "year"], "One full spin takes a day."),
          ty("The icy region at the bottom of the Earth is the South ___. Type the word.", ["pole"], "Pole", "The South Pole is at the bottom of the Earth."),
          mc("What gives the Earth its seasons?", "its tilt", ["its color", "the Moon", "the wind"], "Earth's tilt causes the seasons.")
        ] },
      { title: "Why No Map Is Quite True",
        teach: ["Every flat map of the world is wrong, and it has to be. The Earth is a sphere, and a sphere cannot be flattened without stretching something. Try it with an orange peel: press it flat and it tears, or you force it out of shape. Mapmakers face the same problem, so they choose which kind of wrongness they can live with.",
                "The world map most people picture is the Mercator projection, drawn in 1569 for sailors. It keeps directions accurate, which is exactly what you need at sea — but it pays for that by stretching everything near the poles. On a Mercator map Greenland looks about the size of Africa. In reality Africa is roughly fourteen times larger. Alaska looks bigger than Mexico; it is not.",
                "Other projections make the opposite trade. Equal-area maps keep the sizes of countries honest and bend their shapes to do it. There is no perfect answer and no conspiracy — just a choice about what matters for the job. The useful habit is to ask what any given map was made for before trusting what it seems to show."],
        ex: [
          mc("Why is every flat world map inaccurate?", "A sphere cannot be flattened without distorting something", ["Mapmakers work from guesses", "The Earth keeps changing shape", "Printing is imprecise"], "Flattening a curved surface always stretches or tears it."),
          mc("What was the Mercator projection designed for?", "Navigation at sea, so directions stay true", ["Showing country sizes fairly", "Teaching in schools", "Measuring populations"], "It preserves direction, which is what sailors needed."),
          mc("On a Mercator map, Greenland looks about the size of Africa. In reality Africa is...", "about fourteen times larger", ["about the same", "slightly smaller", "twice as large"], "Areas near the poles are stretched enormously."),
          ty("The kind of map that keeps country sizes honest is called an equal-___ projection. Type the word.", ["area"], "area", "Equal-area projections preserve size and distort shape instead."),
          mc("What do equal-area maps give up in exchange?", "Accurate shapes", ["Accurate colors", "The equator", "All direction and size"], "Every projection trades one kind of accuracy for another."),
          mc("The best habit when reading any map is to ask...", "what it was made for", ["who printed it", "how old the paper is", "whether it is in color"], "The purpose tells you which distortions it accepted."),
          mc("Distortion on a world map is worst...", "near the poles", ["at the equator", "over oceans", "in the middle of continents"], "The further from the equator, the more a flat map stretches.")
        ] }
    ],

    spanish: [
      { title: "First Words & Greetings",
        teach: ["Spanish is one of the world's most spoken languages, used across Spain and most of Latin America. A friendly start is 'Hola' (hello). To greet by time of day, say 'Buenos días' (good morning), 'Buenas tardes' (good afternoon), and 'Buenas noches' (good evening/night).",
                "Politeness matters everywhere: 'por favor' means please, 'gracias' means thank you, and you reply 'de nada' (you're welcome). 'Sí' is yes and 'no' is no. To say goodbye, use 'Adiós'."],
        ex: [
          ty("Type the Spanish word for 'hello'.", ["hola"], "hola", "Hola = hello."),
          ty("Type the Spanish word for 'thank you'.", ["gracias"], "gracias", "Gracias = thank you."),
          mc("What does 'Buenos días' mean?", "Good morning", ["Good night", "Goodbye", "Thank you"], "Buenos días = good morning."),
          mc("How do you say 'goodbye' in Spanish?", "Adiós", ["Hola", "Gracias", "Sí"], "Adiós = goodbye."),
          ty("Type the Spanish word for 'please'.", ["por favor"], "por favor", "Por favor = please."),
          mc("What does 'de nada' mean?", "You're welcome", ["Good night", "See you soon", "No thanks"], "De nada = you're welcome.")
        ] },
      { title: "Counting 1–10",
        teach: ["The Spanish numbers one to ten are: uno (1), dos (2), tres (3), cuatro (4), cinco (5), seis (6), siete (7), ocho (8), nueve (9), diez (10). Say them out loud a few times — rhythm helps them stick.",
                "You already meet these numbers everywhere: a 'trio' is three, and 'October' comes from 'octo' (eight) in the old Roman calendar — the same root as 'ocho'."],
        ex: [
          ty("Type the Spanish word for the number 1.", ["uno"], "uno", "Uno = one."),
          ty("Type the Spanish word for the number 5.", ["cinco"], "cinco", "Cinco = five."),
          mc("What number is 'tres'?", "3", ["2", "4", "6"], "Tres = three."),
          ty("Type the Spanish word for the number 10.", ["diez"], "diez", "Diez = ten."),
          mc("What number is 'ocho'?", "8", ["6", "7", "9"], "Ocho = eight."),
          ty("Type the Spanish word for the number 7.", ["siete"], "siete", "Siete = seven.")
        ] },
      { title: "Colors & Everyday Things",
        teach: ["Colors (los colores): rojo (red), azul (blue), verde (green), amarillo (yellow), negro (black), and blanco (white).",
                "Some everyday words you'll use constantly: agua (water), casa (house), gato (cat), perro (dog), and libro (book). In Spanish, most words that end in -o are masculine (el gato) and most ending in -a are feminine (la casa).",
                "Two things about colors will surprise an English speaker. First, the color goes AFTER the thing: not 'red house' but 'casa roja'. Second, the color changes to match the noun. Rojo becomes roja for a feminine noun, and adds -s in the plural: el libro rojo, la casa roja, los libros rojos, las casas rojas. Colors already ending in -e or a consonant — verde, azul — do not change for gender, only for number: la casa verde, las casas verdes."],
        ex: [
          ty("Type the Spanish word for 'water'.", ["agua"], "agua", "Agua = water."),
          mc("What does 'rojo' mean?", "red", ["blue", "green", "black"], "Rojo = red."),
          ty("Type the Spanish word for 'cat'.", ["gato"], "gato", "Gato = cat."),
          mc("What does 'casa' mean?", "house", ["dog", "book", "water"], "Casa = house."),
          ty("Type the Spanish word for 'dog'.", ["perro"], "perro", "Perro = dog."),
          mc("What does 'azul' mean?", "blue", ["yellow", "white", "red"], "Azul = blue."),
          mc("How do you say 'the red house'?", "la casa roja", ["la roja casa", "el casa rojo", "la casa rojo"], "The color follows the noun and matches it: casa is feminine, so roja."),
          ty("Complete: 'los libros ___' for 'the red books'.", ["rojos"], "rojos", "Masculine plural noun, so the color takes -os."),
          mc("Why does 'verde' stay the same for a house and a book?", "Colors ending in -e don't change for gender", ["Verde is not a real color word", "Both nouns are feminine", "It changes only in speech"], "Verde and azul change only in the plural, not for gender.")
        ] },
      { title: "Family & People",
        teach: ["Family is 'la familia'. The core members: madre (mother), padre (father), hermano (brother), hermana (sister), abuela (grandmother), and abuelo (grandfather). A friend is 'amigo' (for a boy) or 'amiga' (for a girl).",
                "Notice the -o / -a pattern again: hermano (brother) and hermana (sister), abuelo and abuela. Many Spanish words show whether someone is male or female with that final letter.",
                "To say whose family it is, put a possessive in front: mi (my), tu (your), su (his, her or their). These are refreshingly easy — mi and tu do not change for gender at all. Mi hermano, mi hermana, tu padre, tu madre. They do change for number: mis hermanos, tus abuelos. And 'su' covers his, her and their all at once, so context does the work."],
        ex: [
          ty("Type the Spanish word for 'mother'.", ["madre"], "madre", "Madre = mother."),
          mc("What does 'padre' mean?", "father", ["brother", "friend", "grandfather"], "Padre = father."),
          ty("Type the Spanish word for a (male) 'friend'.", ["amigo"], "amigo", "Amigo = friend (male)."),
          mc("What does 'hermana' mean?", "sister", ["brother", "mother", "aunt"], "Hermana = sister."),
          ty("Type the Spanish word for 'brother'.", ["hermano"], "hermano", "Hermano = brother."),
          ty("Type the Spanish for 'my sister', using hermana.", ["mi hermana"], "mi hermana", "Mi does not change for gender: mi hermano, mi hermana."),
          mc("What is the plural of 'mi hermano'?", "mis hermanos", ["mi hermanos", "mios hermanos", "mi hermanas"], "The possessive becomes plural too: mis hermanos."),
          mc("'Su madre' could mean...", "his, her or their mother", ["only his mother", "only her mother", "our mother"], "Su covers his, her and their — the context tells you which.")
        ] },
      { title: "Handy Phrases",
        teach: ["A few phrases let you have a real little conversation. '¿Cómo estás?' means 'how are you?' and you can answer 'Muy bien' (very well). To share your name, say 'Me llamo...' (my name is...), and to ask someone's name, '¿Cómo te llamas?' (what's your name?). If you're lost, 'No entiendo' means 'I don't understand'.",
                "Spanish has two ways of saying 'you', and choosing between them is a real social decision. 'Tú' is for friends, family, children and people your own age. 'Usted' is for strangers, elders, officials and anyone you want to show respect to. The phrase changes with it: ¿Cómo estás? to a friend, ¿Cómo está usted? to a stranger.",
                "If you are unsure, start with usted. Being slightly too formal reads as polite; being too familiar with someone who expected respect does not. In much of Latin America people will invite you to switch by saying 'puedes tutearme' — you can use tú with me."],
        ex: [
          mc("What does '¿Cómo estás?' mean?", "How are you?", ["What's your name?", "Where are you?", "How old are you?"], "¿Cómo estás? = How are you?"),
          mc("'Me llamo Ana' means...", "My name is Ana", ["I see Ana", "Goodbye Ana", "Ana is here"], "Me llamo... = My name is..."),
          ty("'Muy bien' means 'very ___'. Type the English word.", ["well", "good"], "well", "Muy bien = very well."),
          mc("'¿Cómo te llamas?' means...", "What's your name?", ["How are you?", "How old are you?", "Where do you live?"], "¿Cómo te llamas? = What's your name?"),
          mc("'No entiendo' means...", "I don't understand", ["I'm sorry", "I agree", "I'm hungry"], "No entiendo = I don't understand."),
          mc("Which would you use with a stranger much older than you?", "¿Cómo está usted?", ["¿Cómo estás?", "¿Cómo te llamas?", "¿Qué tal, tío?"], "Usted is the respectful form for strangers and elders."),
          mc("If you are not sure which form to use, the safer choice is...", "usted, because being too formal reads as polite", ["tú, because it is friendlier", "neither — avoid the word for you", "whichever is shorter"], "Too formal is forgivable; too familiar can offend.")
        ] },
      { title: "Every Noun Has a Gender",
        teach: ["In Spanish every noun is either masculine or feminine. This is not about the thing itself — a table is feminine and a book is masculine, and neither one minds. What it changes is the little word in front. Masculine nouns take 'el' for 'the'; feminine nouns take 'la'. So it is 'el libro' (the book) and 'la mesa' (the table).",
                "Most of the time the ending tells you which. Nouns ending in -o are usually masculine: el libro, el perro (the dog), el amigo (the friend). Nouns ending in -a are usually feminine: la mesa, la casa (the house), la amiga. Learn each noun together with its 'el' or 'la' and you never have to guess later.",
                "For 'a' or 'an', masculine takes 'un' and feminine takes 'una': un libro (a book), una casa (a house). To make things plural, add -s and the article changes too: el libro becomes los libros, la casa becomes las casas. So the four words for 'the' are el, la, los, las."],
        ex: [
          mc("Which word means 'the' before a masculine noun like 'libro'?", "el", ["la", "los", "las"], "Masculine singular takes 'el': el libro."),
          mc("Which is correct?", "la casa", ["el casa", "los casa", "un casa"], "Casa ends in -a, so it is feminine: la casa."),
          ty("Type the Spanish for 'the dog', using perro.", ["el perro"], "el perro", "Perro ends in -o, so it takes el."),
          mc("'Un libro' means...", "a book", ["the book", "the books", "some books"], "Un/una means a or an; el/la means the."),
          mc("What is the plural of 'la casa'?", "las casas", ["los casas", "la casas", "el casas"], "Both the noun and the article become plural: las casas."),
          ty("Type the Spanish for 'the books', using libro.", ["los libros"], "los libros", "Masculine plural: los libros."),
          mc("Why is 'mesa' feminine?", "It ends in -a, which is usually feminine", ["Tables are feminine things", "It is borrowed from French", "All short words are feminine"], "The ending is the clue, not the object itself.")
        ] },
      { title: "Your First Verbs",
        teach: ["Spanish verbs carry more information than English ones. In English 'speak' barely changes: I speak, you speak, we speak. In Spanish the ending of the verb tells you who is doing it, which is why Spanish speakers can drop the word for 'I' or 'you' altogether and still be understood.",
                "Take 'hablar', to speak. Chop off the -ar and you are left with the stem 'habl-'. Now add the endings: yo hablo (I speak), tú hablas (you speak), él/ella habla (he/she speaks), nosotros hablamos (we speak), ellos hablan (they speak). The stem never moves; only the tail changes.",
                "That same set of endings works for hundreds of -ar verbs. Trabajar (to work) gives trabajo, trabajas, trabaja. Estudiar (to study) gives estudio, estudias, estudia. Learn the pattern once and every new -ar verb you meet comes free."],
        ex: [
          mc("In 'hablo', what does the -o ending tell you?", "That I am the one speaking", ["That it happened yesterday", "That it is a question", "That the speaker is male"], "-o marks the 'I' form: yo hablo."),
          ty("Type the Spanish for 'I speak', from hablar.", ["hablo", "yo hablo"], "hablo", "Stem habl- plus the -o ending."),
          mc("Which means 'you speak'?", "hablas", ["hablo", "habla", "hablan"], "-as is the 'tú' ending."),
          ty("Estudiar means to study. Type the Spanish for 'I study'.", ["estudio", "yo estudio"], "estudio", "Same pattern: estudi- plus -o."),
          mc("'Ella habla' means...", "She speaks", ["I speak", "They speak", "We speak"], "The -a ending goes with él or ella."),
          mc("Why can Spanish leave out the word 'yo'?", "The verb ending already shows who is speaking", ["Spanish has no word for I", "It is considered rude", "Only in writing"], "Hablo can only mean 'I speak', so yo is optional."),
          ty("Type the Spanish for 'we speak', from hablar.", ["hablamos", "nosotros hablamos"], "hablamos", "-amos is the 'we' ending.")
        ] }
    ],

    french: [
      { title: "First Words & Greetings",
        teach: ["French is spoken in France and in many countries across Europe, Africa, and Canada. The classic greeting is 'Bonjour' (hello / good day). In the evening you can say 'Bonsoir' (good evening), and 'Bonne nuit' means good night.",
                "For politeness: 's'il vous plaît' means please, 'merci' means thank you, and 'de rien' means you're welcome. 'Oui' is yes and 'non' is no. To say goodbye, use 'Au revoir'."],
        ex: [
          ty("Type the French word for 'hello'.", ["bonjour"], "bonjour", "Bonjour = hello / good day."),
          ty("Type the French word for 'thank you'.", ["merci"], "merci", "Merci = thank you."),
          mc("How do you say 'goodbye' in French?", "Au revoir", ["Bonjour", "Merci", "Oui"], "Au revoir = goodbye."),
          mc("What does 'Bonne nuit' mean?", "Good night", ["Good morning", "Hello", "Please"], "Bonne nuit = good night."),
          ty("Type the French word for 'yes'.", ["oui"], "oui", "Oui = yes."),
          mc("What does 's'il vous plaît' mean?", "please", ["thanks", "sorry", "hello"], "S'il vous plaît = please.")
        ] },
      { title: "Counting 1–10",
        teach: ["The French numbers one to ten are: un (1), deux (2), trois (3), quatre (4), cinq (5), six (6), sept (7), huit (8), neuf (9), dix (10).",
                "Some look like English cousins because both borrowed from Latin: 'trois' and 'trio', or 'six' which is spelled the same as in English (just said differently)."],
        ex: [
          ty("Type the French word for the number 1.", ["un"], "un", "Un = one."),
          ty("Type the French word for the number 5.", ["cinq"], "cinq", "Cinq = five."),
          mc("What number is 'trois'?", "3", ["2", "4", "6"], "Trois = three."),
          ty("Type the French word for the number 10.", ["dix"], "dix", "Dix = ten."),
          mc("What number is 'huit'?", "8", ["6", "7", "9"], "Huit = eight."),
          ty("Type the French word for the number 7.", ["sept"], "sept", "Sept = seven.")
        ] },
      { title: "Colors & Everyday Things",
        teach: ["Colors (les couleurs): rouge (red), bleu (blue), vert (green), jaune (yellow), noir (black), and blanc (white).",
                "Everyday words: eau (water), maison (house), chat (cat), chien (dog), and livre (book). French nouns are masculine or feminine, shown by 'le' or 'la' — le chat (the cat), la maison (the house).",
                "As in Spanish, a French color comes after the noun and agrees with it: une maison blanche (a white house), un livre vert (a green book). The feminine usually adds -e, which often wakes up a silent consonant — vert is said 'vair', but verte is said 'vairt'. So the agreement you can barely hear in the masculine becomes clearly audible in the feminine.",
                "A few colors refuse to change. Rouge and jaune already end in -e, so they stay put: une maison rouge, un livre rouge. Blanc is the irregular one worth memorising — its feminine is blanche, not 'blance'."],
        ex: [
          ty("Type the French word for 'water'.", ["eau"], "eau", "Eau = water."),
          mc("What does 'rouge' mean?", "red", ["blue", "green", "black"], "Rouge = red."),
          ty("Type the French word for 'cat'.", ["chat"], "chat", "Chat = cat."),
          mc("What does 'maison' mean?", "house", ["dog", "book", "water"], "Maison = house."),
          ty("Type the French word for 'dog'.", ["chien"], "chien", "Chien = dog."),
          mc("What does 'bleu' mean?", "blue", ["yellow", "white", "red"], "Bleu = blue."),
          mc("How do you say 'a white house'?", "une maison blanche", ["une blanche maison", "un maison blanc", "une maison blanc"], "The color follows the noun; maison is feminine, so blanc becomes blanche."),
          mc("What happens to the final consonant of 'vert' in the feminine?", "It becomes audible: verte", ["It disappears", "It doubles", "Nothing changes"], "Adding -e wakes up the silent consonant."),
          mc("Why doesn't 'rouge' change for a feminine noun?", "It already ends in -e", ["Red has no gender", "It is borrowed from English", "It changes only in the plural"], "Colors already ending in -e stay as they are.")
        ] },
      { title: "Family & People",
        teach: ["Family is 'la famille'. The core members: mère (mother), père (father), frère (brother), sœur (sister), grand-mère (grandmother), and grand-père (grandfather). A friend is 'ami' (boy) or 'amie' (girl).",
                "See how 'grand-mère' is literally 'grand-mother' and 'grand-père' is 'grand-father' — French and English share many roots, so words often look familiar.",
                "Saying 'my' in French means matching the noun, not the owner. Mon is used before a masculine noun, ma before a feminine one, mes before any plural: mon père, ma mère, mes parents. English speakers find this genuinely strange, because in English 'my' never changes no matter what follows it.",
                "There is one trap. Before a word starting with a vowel, ma turns into mon purely because 'ma amie' is awkward to say — so it is mon amie even though amie is feminine. The word sounds masculine and isn't; French has simply chosen smooth speech over tidy rules."],
        ex: [
          ty("Type the French word for 'mother'.", ["mère", "mere"], "mère", "Mère = mother."),
          mc("What does 'père' mean?", "father", ["brother", "friend", "grandfather"], "Père = father."),
          ty("Type the French word for 'friend'.", ["ami", "amie"], "ami", "Ami = friend."),
          mc("What does 'sœur' mean?", "sister", ["brother", "mother", "aunt"], "Sœur = sister."),
          ty("Type the French word for 'brother'.", ["frère", "frere"], "frère", "Frère = brother."),
          mc("Which is correct for 'my mother'?", "ma mère", ["mon mère", "mes mère", "ma mères"], "Mère is feminine, so ma."),
          ty("Type the French for 'my parents', using parents.", ["mes parents"], "mes parents", "Mes is used before any plural noun."),
          mc("Why is it 'mon amie' when amie is feminine?", "Ma before a vowel is awkward to say, so it becomes mon", ["Amie is actually masculine", "It is a spelling mistake in common use", "Friends have no gender in French"], "The change is about sound, not gender.")
        ] },
      { title: "Handy Phrases",
        teach: ["These phrases get a conversation going. 'Comment ça va?' means 'how are you?' and you can answer 'Ça va bien' (I'm well). To give your name, say 'Je m'appelle...' (my name is...), and to ask, 'Comment tu t'appelles?' (what's your name?). 'Je ne comprends pas' means 'I don't understand'.",
                "French, like Spanish, has two words for 'you'. 'Tu' is for friends, family and children. 'Vous' is for strangers, anyone older, anyone serving you, and for more than one person at once. It is not a small distinction — French speakers notice immediately, and using tu with a stranger can sound like a deliberate slight.",
                "So the polite version of the question above is 'Comment allez-vous?' rather than 'Comment ça va?'. The rule of thumb is simple: use vous with anyone you would address by their surname in English, and keep using it until they invite you to switch."],
        ex: [
          mc("What does 'Comment ça va?' mean?", "How are you?", ["What's your name?", "Where are you?", "How old are you?"], "Comment ça va? = How are you?"),
          mc("'Je m'appelle Paul' means...", "My name is Paul", ["I see Paul", "Goodbye Paul", "Paul is here"], "Je m'appelle... = My name is..."),
          mc("'Ça va bien' means...", "I'm well", ["I'm lost", "I'm hungry", "I'm sorry"], "Ça va bien = it's going well / I'm well."),
          mc("'Je ne comprends pas' means...", "I don't understand", ["I agree", "I'm tired", "I'm ready"], "Je ne comprends pas = I don't understand."),
          ty("In 'Je m'appelle', the verb relates to being ___ (named). Type the English word.", ["called", "named"], "called", "S'appeler means 'to be called/named'."),
          mc("Which would you say to a shopkeeper you have never met?", "Comment allez-vous?", ["Comment ça va?", "Comment tu t'appelles?", "Ça va, toi?"], "Vous is the form for strangers and anyone serving you."),
          mc("'Vous' is used for...", "a stranger, an elder, or several people", ["only large groups", "only close friends", "only in writing"], "Vous covers both the polite singular and every plural."),
          mc("A good rule of thumb for choosing vous is...", "use it for anyone you'd call by their surname in English", ["use it only in Paris", "use it only with children", "alternate between the two"], "If you'd say 'Mr Dupont', you'd say vous.")
        ] },
      { title: "Every Noun Has a Gender",
        teach: ["French nouns are either masculine or feminine, and the word for 'the' changes to match. Masculine nouns take 'le', feminine nouns take 'la'. So it is 'le livre' (the book) and 'la table' (the table). The gender is a property of the word, not of the thing — there is nothing feminine about a table.",
                "French endings are less reliable a guide than Spanish ones, so the honest advice is to learn every noun with its article attached: not 'chat' but 'le chat', not 'maison' but 'la maison'. That way the gender is stored with the word from the start and you never have to reconstruct it.",
                "Before a vowel, both le and la shrink to l': l'ami (the friend), l'école (the school). For 'a' or 'an', masculine takes 'un' and feminine 'une': un livre, une table. In the plural, everything simplifies beautifully — 'les' covers both genders: les livres, les tables."],
        ex: [
          mc("Which word means 'the' before a masculine noun?", "le", ["la", "les", "une"], "Le is masculine singular: le livre."),
          mc("Which is correct?", "la table", ["le table", "les table", "un table"], "Table is feminine in French: la table."),
          ty("Type the French for 'the book', using livre.", ["le livre"], "le livre", "Livre is masculine: le livre."),
          mc("What happens to 'le' or 'la' before a vowel, as in ami?", "It shortens to l'", ["It becomes les", "It disappears entirely", "It doubles"], "Le ami becomes l'ami."),
          mc("Which word means 'the' for plural nouns?", "les", ["le", "la", "un"], "Les works for masculine and feminine plurals alike."),
          ty("Type the French for 'a table', using table.", ["une table"], "une table", "Feminine takes une."),
          mc("What is the safest way to learn a French noun?", "With its article, as 'la maison'", ["By its ending alone", "By translating it twice", "By its length"], "French endings are an unreliable guide, so store the article with the word.")
        ] },
      { title: "Your First Verbs",
        teach: ["Most French verbs end in -er, and they all behave the same way. Take 'parler', to speak. Remove the -er and you have the stem 'parl-'. Everything else is built by adding endings to that stem.",
                "The endings are: je parle (I speak), tu parles (you speak), il/elle parle (he/she speaks), nous parlons (we speak), vous parlez (you speak, formally or to several people), ils/elles parlent (they speak). Here is the surprise: parle, parles and parlent all sound identical when spoken. The difference is visible on the page but silent in the air, so the word in front — je, tu, ils — does the real work.",
                "Because the pattern is fixed, every new -er verb comes almost free. Aimer (to like) gives j'aime, tu aimes, il aime. Habiter (to live) gives j'habite, tu habites, nous habitons."],
        ex: [
          ty("Type the French for 'I speak', from parler.", ["je parle", "parle"], "je parle", "Stem parl- plus the -e ending."),
          mc("Which is the 'nous' form of parler?", "parlons", ["parle", "parles", "parlez"], "-ons is the nous ending: nous parlons."),
          mc("Why do je parle, tu parles and ils parlent sound the same?", "Those endings are silent when spoken", ["They are spelled the same", "French has no plural", "Only in songs"], "The endings are written but not pronounced, so the pronoun carries the meaning."),
          ty("Aimer means to like. Type the French for 'we like'.", ["nous aimons", "aimons"], "nous aimons", "Stem aim- plus -ons."),
          mc("'Vous parlez' is used when...", "Speaking to several people, or politely to one", ["Talking about the past", "Asking a question", "Speaking to a child"], "Vous is both the plural you and the polite singular you."),
          mc("What do you remove from parler to get the stem?", "-er", ["-r", "par-", "-ler"], "Drop -er and parl- remains."),
          ty("Type the French for 'she speaks', from parler.", ["elle parle"], "elle parle", "Il and elle both take the -e ending.")
        ] }
    ],

    latin: [
      { title: "Words from Ancient Rome",
        teach: ["Latin was the language of ancient Rome. Though no country speaks it day to day now, it never really died: it grew into Spanish, French, Italian, Portuguese, and Romanian, and it fills English with thousands of words. Learning a little Latin is like finding the roots under a whole forest of languages.",
                "Start with these core words: aqua (water), terra (earth/land), sol (sun), luna (moon), and canis (dog). You already know their descendants — an 'aquarium' holds water, 'terrain' is land, 'solar' power comes from the sun."],
        ex: [
          mc("What does the Latin word 'aqua' mean?", "water", ["earth", "sun", "dog"], "Aqua = water (as in aquarium)."),
          ty("The Latin word 'sol' means the... (type the English word)", ["sun"], "sun", "Sol = sun (as in solar)."),
          mc("What does 'terra' mean?", "earth / land", ["water", "sky", "fire"], "Terra = earth (as in terrain, territory)."),
          ty("The Latin word 'luna' means the... (type the English word)", ["moon"], "moon", "Luna = moon (as in lunar)."),
          mc("What does 'canis' mean?", "dog", ["cat", "horse", "bird"], "Canis = dog (as in canine).")
        ] },
      { title: "Numbers & Simple Verbs",
        teach: ["Latin numbers begin: unus (1), duo (2), tres (3), quattuor (4), quinque (5). Their descendants are everywhere — a 'unicycle' has one wheel, a 'duet' has two singers, a 'trio' has three.",
                "Latin verbs often end in -o to mean 'I': amo means 'I love', video means 'I see', and audio means 'I hear'. That's why an 'audience' listens and a 'video' is something you watch.",
                "You already read Latin numbers regularly, on clock faces, in book chapters and after kings' names. I is one, V five, X ten, L fifty, C a hundred, D five hundred, M a thousand. The rule is that a smaller symbol before a larger one subtracts, and after it adds: IV is four, VI is six, IX is nine, XI is eleven.",
                "So MMXXV is 1000 + 1000 + 10 + 10 + 5, which is 2025. Reading them is a matter of working left to right and watching for the one place a symbol has shrunk instead of grown."],
        ex: [
          mc("What number is 'unus'?", "1", ["2", "3", "5"], "Unus = one (as in unit, unicorn)."),
          ty("The Latin word 'tres' means which number? Type the digit.", ["3", "three"], "3", "Tres = three (as in trio, triangle)."),
          mc("What does the Latin verb 'amo' mean?", "I love", ["I see", "I hear", "I run"], "Amo = I love (as in amorous)."),
          ty("The Latin verb 'video' means 'I ___'. Type the missing English word.", ["see"], "see", "Video = I see (as in video)."),
          mc("What does 'audio' mean?", "I hear", ["I see", "I speak", "I sleep"], "Audio = I hear (as in audience, audible)."),
          ty("What number is the Roman numeral IX? Type the digits.", ["9", "nine"], "9", "A smaller symbol before a larger one subtracts: 10 − 1."),
          mc("What number is XI?", "11", ["9", "10", "6"], "After the larger symbol it adds: 10 + 1."),
          ty("What number is MMXXV? Type the digits.", ["2025"], "2025", "1000 + 1000 + 10 + 10 + 5."),
          mc("In Roman numerals, a smaller symbol placed BEFORE a larger one...", "subtracts from it", ["adds to it", "is ignored", "doubles it"], "IV is 4, IX is 9 — the rule that makes the system compact.")
        ] },
      { title: "Roots Hiding in English",
        teach: ["A huge number of English words are built from Latin roots. If you learn the root, you can often unlock a word you've never seen before.",
                "Key roots: 'port' means carry (transport = carry across, portable = able to be carried). 'spect' means look (inspect = look into, spectator = one who looks). 'dict' means say (predict = say beforehand, dictate). 'aud' means hear (audible). 'scrib/script' means write (describe, manuscript = written by hand)."],
        ex: [
          mc("The Latin root 'port' means...", "carry", ["look", "say", "write"], "Transport = carry across."),
          ty("The root 'spect' means to... (type the English verb)", ["look", "see", "watch"], "look", "Spectator = one who looks."),
          mc("The Latin root 'dict' means...", "say", ["write", "carry", "hear"], "Predict = say beforehand."),
          ty("The root 'scrib' or 'script' means to... (type the English verb)", ["write"], "write", "Manuscript = written by hand."),
          mc("The Latin root 'aud' means...", "hear", ["see", "say", "carry"], "Audible = able to be heard.")
        ] },
      { title: "Famous Latin Phrases",
        teach: ["Some Latin phrases are still used today, and they carry big ideas in few words. 'Carpe diem' means 'seize the day' — make the most of now. 'Veni, vidi, vici' is what Julius Caesar reportedly said: 'I came, I saw, I conquered.'",
                "'E pluribus unum' means 'out of many, one' and appears on United States coins. 'Et cetera' (etc.) means 'and the rest'. These little phrases show how Latin still lives inside modern life."],
        ex: [
          mc("What does 'carpe diem' mean?", "seize the day", ["good luck", "the end", "long live the king"], "Carpe diem = seize the day."),
          mc("What does 'veni, vidi, vici' mean?", "I came, I saw, I conquered", ["to be or not to be", "peace and love", "now and forever"], "Caesar's famous line: I came, I saw, I conquered."),
          ty("What does the everyday abbreviation 'etc.' stand for (two Latin words)? Type them.", ["et cetera", "etcetera"], "et cetera", "Et cetera = and the rest."),
          mc("'E pluribus unum', found on U.S. coins, means...", "out of many, one", ["in God we trust", "land of the free", "one for all"], "E pluribus unum = out of many, one.")
        ] },
      { title: "Family & Nature Words",
        teach: ["Latin family words live on inside English. Mater (mother), pater (father), frater (brother), and soror (sister) gave us 'maternal', 'paternal', 'fraternity', and 'sorority'.",
                "Latin also named the natural world: mare (sea) gives us 'marine', silva (forest) gives us 'Pennsylvania' ('Penn's woods'), and stella (star) gives us 'stellar' and 'constellation'."],
        ex: [
          mc("What does 'mater' mean?", "mother", ["father", "sister", "daughter"], "Mater = mother (as in maternal)."),
          ty("'pater' means ___ (English word).", ["father"], "father", "Pater = father (as in paternal)."),
          mc("The English word 'fraternity' comes from 'frater', meaning...", "brother", ["friend", "father", "leader"], "Frater = brother."),
          ty("'stella' means ___ (English word).", ["star"], "star", "Stella = star (as in stellar, constellation)."),
          mc("What does 'mare' mean?", "sea", ["mountain", "sky", "river"], "Mare = sea (as in marine).")
        ] },
      { title: "Endings Do the Work of Word Order",
        teach: ["English decides who did what to whom by word order alone. 'The girl sees the sailor' and 'The sailor sees the girl' use identical words and mean opposite things. Latin does it a completely different way: it changes the end of the noun.",
                "A noun doing the action takes one ending; a noun receiving the action takes another. 'Puella' is a girl doing something; 'puellam' is a girl having something done to her. So 'puella nautam videt' means the girl sees the sailor, while 'puellam nauta videt' means the sailor sees the girl — even though 'videt' (sees) sits at the end in both.",
                "This is why Latin word order is so free. A Roman poet could scatter the words almost anywhere and still be understood perfectly, because each word carries its job on its own back. The endings, not the positions, hold the sentence together."],
        ex: [
          mc("In Latin, what tells you which noun is doing the action?", "The ending of the noun", ["Its position in the sentence", "The capital letter", "The length of the word"], "Latin marks the job of a noun with its ending."),
          mc("'Puellam nauta videt' means...", "The sailor sees the girl", ["The girl sees the sailor", "The girl and the sailor see", "The sailor is a girl"], "Puellam has the receiving ending, so the girl is being seen."),
          ty("In 'puella nautam videt', who is doing the seeing? Type the English word.", ["girl", "the girl"], "girl", "Puella has the doing ending, so the girl sees."),
          mc("Why can Latin move its words around freely?", "Each word's ending already shows its job", ["Latin has very few words", "Only in poetry", "Word order is actually fixed"], "The endings carry the grammar, so position is free."),
          mc("Which form would you use for a girl having something done to her?", "puellam", ["puella", "puellae", "puellis"], "The -am ending marks the receiver of the action."),
          mc("What does this tell you about translating Latin?", "Read the endings before guessing from order", ["Translate strictly left to right", "Ignore the last syllable", "The first word is always the subject"], "Word order is the least reliable clue in a Latin sentence.")
        ] },
      { title: "The Verb Ending Tells You Who",
        teach: ["Latin verbs carry the person inside them, exactly as Spanish and Italian later would — because both descend from Latin. Take 'amare', to love. The stem is 'ama-', and the endings do the rest.",
                "Amo means I love. Amas means you love. Amat means he, she or it loves. Amamus means we love, amatis means you all love, and amant means they love. There is no separate word for 'I' or 'she' in an ordinary sentence: the -o and the -t already said it.",
                "You have met these endings before without knowing it. 'Amo' sits inside 'amorous'; 'amat' gives us 'amateur', someone who does a thing purely for love of it. The Latin ending survived the journey into English intact."],
        ex: [
          ty("Type the Latin for 'I love', from amare.", ["amo"], "amo", "The -o ending means I."),
          mc("'Amat' means...", "he or she loves", ["I love", "we love", "they love"], "-t marks the third person singular."),
          mc("Which ending marks 'we'?", "-mus", ["-o", "-t", "-nt"], "Amamus = we love."),
          mc("Why does Latin usually leave out the word for 'I'?", "The verb ending already says who", ["It has no such word", "Only in inscriptions", "To save space on stone"], "Amo can only mean 'I love'."),
          ty("Type the Latin for 'they love', from amare.", ["amant"], "amant", "-nt marks the third person plural."),
          mc("The English word 'amateur' comes from this verb because an amateur...", "does something for the love of it", ["is paid for it", "is new to it", "teaches it"], "Amat = loves; an amateur acts out of love, not payment.")
        ] }
    ],

    chinese: [
      { title: "Sounds & Tones",
        teach: ["Mandarin Chinese is written with characters, each standing for a syllable and a meaning. To help learners, 'pinyin' spells those sounds using our familiar alphabet — so 你好 is written 'nǐ hǎo'.",
                "Mandarin is a tonal language: the pitch of your voice changes a word's meaning. There are four main tones, shown by marks over the vowel: ā stays high and flat, á rises like a question, ǎ dips down then up, and à falls sharply. The classic example: 'mā' (high) means mother, but 'mǎ' (dipping) means horse — same letters, different tune, different word.",
                "Don't worry about perfect tones at first. Just knowing that tone matters — and listening for it — already puts you ahead."],
        ex: [
          mc("What is 'pinyin'?", "A way to spell Chinese sounds with our alphabet", ["An ancient sword", "A Chinese city", "A kind of tea"], "Pinyin writes Chinese pronunciation in Roman letters."),
          ty("How many main tones does Mandarin have? Type the number.", ["4", "four"], "4", "Mandarin has four main tones (plus a light neutral one)."),
          mc("Why do tones matter in Chinese?", "They change a word's meaning", ["They show politeness", "They mark the past", "They are just decoration"], "mā (mother) vs mǎ (horse): tone changes meaning."),
          mc("The mark in 'mā' (a flat line) means the tone is...", "high and flat", ["rising", "falling", "dipping"], "The first tone is high and level.")
        ] },
      { title: "Hello & Thank You",
        teach: ["Here are the most useful first phrases, shown as character — pinyin — meaning: 你好 — nǐ hǎo — hello; 谢谢 — xièxie — thank you; 再见 — zàijiàn — goodbye (it literally means 'see again'); 是 — shì — to be / yes; 不 — bù — no / not.",
                "Notice 再见 (zàijiàn): 再 means 'again' and 见 means 'see' — 'see you again'. Chinese often builds meaning by combining simple characters like this."],
        ex: [
          ty("Type the pinyin (or characters) for 'hello' in Chinese.", ["ni hao", "nǐ hǎo", "你好"], "nǐ hǎo (你好)", "你好 nǐ hǎo = hello."),
          ty("Type the pinyin (or characters) for 'thank you'.", ["xiexie", "xièxie", "谢谢"], "xièxie (谢谢)", "谢谢 xièxie = thank you."),
          mc("What does 再见 (zàijiàn) mean?", "Goodbye", ["Hello", "Thank you", "Sorry"], "再见 = goodbye ('see again')."),
          mc("What does 是 (shì) mean?", "to be / yes", ["no", "hello", "run"], "是 shì = to be / yes.")
        ] },
      { title: "Numbers 1–10",
        teach: ["Chinese numbers are wonderfully logical: 一 yī (1), 二 èr (2), 三 sān (3), 四 sì (4), 五 wǔ (5), 六 liù (6), 七 qī (7), 八 bā (8), 九 jiǔ (9), 十 shí (10).",
                "Look at the first three characters: 一 is one line, 二 is two lines, 三 is three lines. After ten it stays simple: eleven is 十一 (ten-one), twelve is 十二 (ten-two), and twenty is 二十 (two-ten).",
                "That pattern is the whole system, and it is worth pausing on how much work it saves. Where the number sits relative to 十 decides everything: BEFORE it multiplies, AFTER it adds. 三十 sānshí is three tens, thirty. 十三 shísān is ten and three, thirteen. Same two characters, opposite sides, different numbers.",
                "Combine both and you can count to ninety-nine with the ten words you already know: 三十五 sānshíwǔ is three-ten-five, thirty-five. Compare that with English, which needs brand-new words for eleven, twelve, twenty, thirty and fifty. Chinese children learn to count higher, faster, for exactly this reason."],
        ex: [
          ty("Type the pinyin (or character) for the number 1 in Chinese.", ["yi", "yī", "一"], "yī (一)", "一 = one (a single stroke)."),
          mc("Which character means 3?", "三", ["二", "五", "十"], "三 sān = three (three strokes)."),
          ty("Type the pinyin (or character) for the number 5.", ["wu", "wǔ", "五"], "wǔ (五)", "五 wǔ = five."),
          mc("What number is 十 (shí)?", "10", ["7", "8", "9"], "十 shí = ten."),
          ty("Type the pinyin (or character) for the number 2.", ["er", "èr", "二"], "èr (二)", "二 èr = two (two strokes)."),
          mc("What number is 三十 (sānshí)?", "30", ["13", "3", "310"], "Before 十 the number multiplies: three tens."),
          mc("And what number is 十三 (shísān)?", "13", ["30", "3", "103"], "After 十 the number adds: ten and three."),
          mc("What number is 三十五 (sānshíwǔ)?", "35", ["305", "53", "315"], "Three tens, then five: 35."),
          mc("Why can Chinese count to 99 with only ten number words?", "Position decides whether a number multiplies or adds", ["Chinese stops counting at 99", "The words are much longer", "It borrows the rest from English"], "Before 十 multiplies, after 十 adds — no new words needed.")
        ] },
      { title: "Everyday Characters",
        teach: ["Single characters can be whole words. Some of the most common: 水 shuǐ (water), 火 huǒ (fire), 人 rén (person), 大 dà (big), 小 xiǎo (small), and 猫 māo (cat).",
                "Many characters are tiny pictures. 人 (rén, person) looks like two walking legs. 大 (dà, big) looks like a person stretching their arms out wide to show something is BIG. Once you see the picture, the character is hard to forget."],
        ex: [
          mc("What does 水 (shuǐ) mean?", "water", ["fire", "person", "big"], "水 shuǐ = water."),
          ty("The character 人 (rén) means a... (type the English word)", ["person", "human", "people"], "person", "人 rén = person (it looks like walking legs)."),
          mc("What does 大 (dà) mean?", "big", ["small", "cat", "fire"], "大 dà = big (a person with arms stretched wide)."),
          ty("Type the English meaning of 猫 (māo).", ["cat"], "cat", "猫 māo = cat."),
          mc("What does 火 (huǒ) mean?", "fire", ["water", "wind", "tree"], "火 huǒ = fire.")
        ] },
      { title: "Family & People",
        teach: ["Family words in Mandarin often repeat a syllable, which makes them friendly and easy to say: 妈妈 māma (mom), 爸爸 bàba (dad), 哥哥 gēge (older brother), and 姐姐 jiějie (older sister). A friend is 朋友 péngyou.",
                "Chinese is careful about age: there are different words for an older brother (哥哥) and a younger brother, because respect for elders is built right into the language.",
                "So there is no single word for 'brother' or 'sister' at all. You must know who is older before you can speak: 哥哥 gēge is an older brother, 弟弟 dìdi a younger one; 姐姐 jiějie is an older sister, 妹妹 mèimei a younger one. Four words where English manages with two.",
                "This runs right through the family. Chinese also distinguishes your mother's parents from your father's parents with separate words, where English says 'grandmother' for both. A language reveals what its speakers consider worth tracking, and Chinese has decided that seniority is never a detail you can leave out."],
        ex: [
          ty("Type the pinyin (or characters) for 'mom' in Chinese.", ["mama", "māma", "妈妈"], "māma (妈妈)", "妈妈 māma = mom."),
          mc("What does 爸爸 (bàba) mean?", "dad", ["mom", "brother", "friend"], "爸爸 bàba = dad."),
          ty("Type the pinyin (or characters) for 'friend'.", ["pengyou", "péngyou", "朋友"], "péngyou (朋友)", "朋友 péngyou = friend."),
          mc("What does 姐姐 (jiějie) mean?", "older sister", ["older brother", "mom", "aunt"], "姐姐 jiějie = older sister."),
          mc("What does 哥哥 (gēge) mean?", "older brother", ["older sister", "dad", "friend"], "哥哥 gēge = older brother."),
          mc("What does 弟弟 (dìdi) mean?", "younger brother", ["older brother", "younger sister", "cousin"], "弟弟 dìdi = younger brother; 哥哥 gēge = older brother."),
          mc("What does 妹妹 (mèimei) mean?", "younger sister", ["older sister", "younger brother", "aunt"], "妹妹 mèimei = younger sister; 姐姐 jiějie = older sister."),
          mc("Why is there no single Chinese word for 'brother'?", "The language always marks who is older", ["Brothers are rarely mentioned", "The word was lost over time", "It only exists in writing"], "Seniority is built into the vocabulary itself.")
        ] },
      { title: "Building a Sentence",
        teach: ["Mandarin sentences follow the same basic order as English: who, then the action, then the thing. 我 wǒ means I, 是 shì means am/is/are, and 人 rén means person. Put them together and 我是人 wǒ shì rén means 'I am a person'.",
                "Here is the good news for a learner: Chinese verbs never change. 是 shì is the same word for I am, you are, she is and they are. There is no am/is/are to sort out, no past-tense form to memorize, no agreement to get wrong. 我是 wǒ shì, 你是 nǐ shì, 他是 tā shì — one word throughout.",
                "你 nǐ means you and 他 tā means he (她 tā, written differently but said identically, means she). To make something negative, put 不 bù in front of the verb: 我不是 wǒ bù shì means 'I am not'. The word order stays exactly where it was."],
        ex: [
          mc("What does 是 (shì) mean?", "am, is, are", ["to go", "to have", "very"], "是 shì covers all forms of 'to be'."),
          ty("Type the pinyin for 'I' in Chinese.", ["wo", "wǒ", "我"], "wǒ (我)", "我 wǒ = I."),
          mc("How does 是 change for 'they are' rather than 'I am'?", "It does not change at all", ["It adds an ending", "It doubles", "It becomes shìle"], "Chinese verbs have no person endings."),
          mc("Where does 不 (bù) go to make a sentence negative?", "Directly in front of the verb", ["At the end of the sentence", "In front of the subject", "It replaces the verb"], "我不是 wǒ bù shì = I am not."),
          ty("Type the pinyin for 'you' in Chinese.", ["ni", "nǐ", "你"], "nǐ (你)", "你 nǐ = you."),
          mc("What is the basic Chinese word order?", "Who, then the action, then the thing", ["The thing, then who, then the action", "Action first, always", "There is no fixed order"], "Subject, verb, object — the same shape as English.")
        ] },
      { title: "Counting Things: Measure Words",
        teach: ["In Chinese you cannot simply put a number next to a noun. Between them sits a small word called a measure word. English does this occasionally — two slices of bread, three sheets of paper — but Chinese does it every single time you count anything.",
                "The workhorse is 个 gè, which fits people and most everyday objects: 一个人 yī gè rén is one person, 三个苹果 sān gè píngguǒ is three apples. If you learn only one measure word, learn this one; it will be understood everywhere even where a more precise word exists.",
                "Different shapes take different measure words, and the choice is oddly poetic. Flat things take 张 zhāng: 一张纸 yī zhāng zhǐ, one sheet of paper. Bound things take 本 běn: 三本书 sān běn shū, three books. The pattern never varies: number, then measure word, then noun."],
        ex: [
          mc("What sits between a number and a noun in Chinese?", "A measure word", ["A verb", "A tone mark", "Nothing at all"], "Number, measure word, noun — every time."),
          mc("Which measure word covers people and most everyday things?", "个 (gè)", ["张 (zhāng)", "本 (běn)", "是 (shì)"], "个 gè is the general-purpose measure word."),
          ty("Type the pinyin for 'one person' in Chinese, using rén.", ["yi ge ren", "yī gè rén", "一个人"], "yī gè rén (一个人)", "Number yī, measure word gè, then noun rén."),
          mc("'三本书 sān běn shū' means...", "three books", ["three sheets of paper", "three people", "book number three"], "本 běn is the measure word for bound volumes."),
          mc("Which English phrase works most like a Chinese measure word?", "two slices of bread", ["two breads", "bread and butter", "the bread"], "'Slices of' does the same job that a measure word does."),
          mc("What is the correct order?", "number, measure word, noun", ["noun, number, measure word", "measure word, noun, number", "number, noun, measure word"], "It never varies: 三本书 is three, běn, books.")
        ] }
    ],

    history: [
      { title: "The First Civilizations",
        teach: ["For most of human history people lived in small groups, hunting animals and gathering plants. Everything changed about 10,000 years ago when people learned to farm. Growing food in one place meant they could settle down, store surplus, and build the first towns and cities. This shift is so important it is called the Agricultural Revolution.",
                "The earliest cities grew up in Mesopotamia, a region between the Tigris and Euphrates rivers (in modern Iraq). Its name even means 'the land between rivers'. There the Sumerians invented one of the world's first writing systems, cuneiform, by pressing wedge shapes into wet clay. Writing let people record laws, trade, and stories for the first time.",
                "Another great river civilization grew along the Nile in Egypt. The Egyptians built enormous stone pyramids as tombs for their god-kings, the pharaohs, and wrote using picture-symbols called hieroglyphics. Rivers were the key to all these early civilizations: they gave water, rich soil for farming, and a highway for travel and trade."],
        ex: [
          mc("The change from hunting to farming let people first do what?", "settle down and build towns", ["fly", "use electricity", "read minds"], "Farming let people stay in one place and build permanent settlements."),
          mc("Between which two rivers did Mesopotamia lie?", "the Tigris and Euphrates", ["the Nile and Amazon", "the Thames and Seine", "the Ganges and Yangtze"], "Mesopotamia means 'land between rivers' — the Tigris and Euphrates."),
          ty("Which river was ancient Egypt built along? Type its name.", ["nile", "the nile"], "the Nile", "The Nile gave Egypt water and rich soil for farming."),
          ty("What are the giant stone tombs built for Egyptian kings called? (one word)", ["pyramids", "pyramid"], "pyramids", "Pyramids were tombs for the pharaohs."),
          mc("Ancient Egyptian picture-writing is called...", "hieroglyphics", ["cuneiform", "the alphabet", "Braille"], "Hieroglyphics used pictures and symbols."),
          ty("The god-kings who ruled ancient Egypt were called ___. Type the word.", ["pharaohs", "pharaoh"], "pharaohs", "The rulers of Egypt were called pharaohs."),
          mc("The early writing made by pressing wedge shapes into clay is called...", "cuneiform", ["hieroglyphics", "calligraphy", "shorthand"], "The Sumerians of Mesopotamia invented cuneiform.")
        ] },
      { title: "Ancient Greece & Rome",
        teach: ["Ancient Greece was not one country but many independent city-states, each with its own government and army. The two most famous were Athens and Sparta. Athens is remembered as the birthplace of democracy — a word meaning 'rule by the people' — where citizens could vote on decisions. Sparta was famous for its tough, disciplined warriors.",
                "The Greeks gave us ideas we still use today: the Olympic Games began there as a religious festival, and great thinkers called philosophers — Socrates, Plato, and Aristotle — asked deep questions about how to live and what is true.",
                "Later, the city of Rome grew into a mighty empire that ruled lands all around the Mediterranean Sea. The Romans were brilliant builders: they made straight paved roads, aqueducts to carry water, and the Colosseum, a huge arena where crowds watched gladiators fight. Their language, Latin, became the ancestor of Spanish, French, and Italian."],
        ex: [
          ty("Which ancient Greek city is remembered as the birthplace of democracy?", ["athens"], "Athens", "Athens is where citizens voted — the birthplace of democracy."),
          mc("Which Greek city-state was famous for its fierce, disciplined warriors?", "Sparta", ["Athens", "Troy", "Cairo"], "Sparta was known for its powerful army."),
          mc("The word 'democracy' means rule by the...", "people", ["king", "army", "priests"], "'Demos' means people; democracy is rule by the people."),
          ty("The athletic games that began in ancient Greece are the ___ Games. Type the missing word.", ["olympic", "olympics"], "Olympic", "The Olympic Games began in ancient Greece."),
          mc("The huge Roman arena where gladiators fought was the...", "Colosseum", ["Parthenon", "Pyramid", "Forum"], "The Colosseum in Rome held tens of thousands of spectators."),
          ty("What language did the Romans speak, which became the root of Spanish and French?", ["latin"], "Latin", "Latin was the language of Rome."),
          mc("Which of these was a famous ancient Greek philosopher?", "Aristotle", ["Julius Caesar", "Cleopatra", "Napoleon"], "Aristotle, along with Socrates and Plato, was a Greek philosopher.")
        ] },
      { title: "The Middle Ages",
        teach: ["After the Roman Empire fell apart around 476 AD, Europe entered a long period called the Middle Ages, lasting roughly a thousand years. Without a single strong government, society was organized by a system called feudalism: a king granted land to powerful lords, who in return provided soldiers — armored warriors on horseback called knights — to fight for him. At the bottom, most people were peasants who farmed the land.",
                "Lords and their families lived in castles, huge stone fortresses built to withstand attack, with thick walls, towers, and sometimes a moat. Knights followed a code of honor called chivalry.",
                "The Middle Ages had dark moments too. In the 1300s a terrible disease known as the Black Death swept across Europe, killing a huge portion of the population. Meanwhile, fierce seafaring raiders from Scandinavia — the Vikings — sailed their longships to explore, trade, and raid distant coasts."],
        ex: [
          ty("The system where kings gave land to lords in exchange for soldiers is called ___. Type the word.", ["feudalism", "feudal system"], "feudalism", "Feudalism organized medieval society around land and loyalty."),
          mc("Armored warriors who fought on horseback for their lord were called...", "knights", ["gladiators", "pharaohs", "senators"], "Knights served their lords in exchange for land or pay."),
          ty("Lords lived in large stone fortresses called ___. Type the word.", ["castles", "castle"], "castles", "Castles were built strong to defend against attack."),
          mc("The deadly plague that swept Europe in the 1300s was called the...", "Black Death", ["Great Fire", "Ice Age", "Dust Bowl"], "The Black Death killed a huge share of Europe's people."),
          ty("Seafaring raiders and explorers from Scandinavia were the ___. Type the word.", ["vikings", "viking"], "Vikings", "The Vikings sailed longships across the seas."),
          mc("Roughly when did the Roman Empire in the west fall, beginning the Middle Ages?", "around 476 AD", ["around 1776", "around 3000 BC", "around 1969"], "The western Roman Empire fell around 476 AD."),
          mc("The medieval code of honor that knights followed was called...", "chivalry", ["democracy", "feudalism", "philosophy"], "Chivalry was the knights' code of honor.")
        ] },
      { title: "Renaissance & Exploration",
        teach: ["Around the 1400s, Europe entered an exciting age of new ideas called the Renaissance, a French word meaning 'rebirth'. Beginning in Italy, artists and thinkers rediscovered the learning of ancient Greece and Rome and created stunning new art and science. Leonardo da Vinci — who painted the Mona Lisa — and Michelangelo were among the greatest artists of this time.",
                "A world-changing invention helped spread these ideas: around 1440 Johannes Gutenberg built a printing press with movable type. Before it, every book was copied slowly by hand; now books could be printed quickly and cheaply, so knowledge spread faster than ever before.",
                "This was also the Age of Exploration. Europeans sailed across vast oceans looking for new trade routes. In 1492 Christopher Columbus crossed the Atlantic and reached the Americas, linking continents that had been separate. A few decades later, an expedition led by Ferdinand Magellan became the first to sail all the way around the world, proving just how large the Earth really is."],
        ex: [
          ty("The 'rebirth' of art and learning that began in Italy is called the ___. Type the word.", ["renaissance"], "Renaissance", "Renaissance means 'rebirth' in French."),
          mc("Who painted the Mona Lisa?", "Leonardo da Vinci", ["Michelangelo", "Julius Caesar", "Gutenberg"], "Leonardo da Vinci painted the Mona Lisa."),
          ty("In 1492, ___ sailed across the Atlantic and reached the Americas. Type the surname.", ["columbus"], "Columbus", "Christopher Columbus reached the Americas in 1492."),
          mc("Gutenberg's invention around 1440 that spread books quickly was the...", "printing press", ["steam engine", "telescope", "compass"], "The printing press let books be made quickly and cheaply."),
          mc("Whose expedition was the first to sail all the way around the world?", "Magellan's", ["Columbus's", "Caesar's", "Napoleon's"], "Ferdinand Magellan's expedition first circled the globe."),
          ty("Before the printing press, every book had to be copied by ___. Type the word.", ["hand"], "hand", "Books were copied slowly by hand before printing.")
        ] },
      { title: "Revolutions That Made the Modern World",
        teach: ["The last few centuries brought waves of dramatic change. In the late 1700s the Industrial Revolution began in Britain: new machines and factories, powered first by steam engines burning coal, transformed how goods were made. People moved from farms to fast-growing cities to work, and trains and steamships shrank the world.",
                "Political revolutions reshaped nations too. In 1776 the thirteen American colonies declared independence from Britain, creating the United States. In 1789 the French Revolution overthrew the king of France in the name of 'liberty, equality, and fraternity'. These revolutions spread the powerful idea that ordinary people, not just kings, should have a say in government.",
                "New inventions kept coming: electricity lit up cities, the telephone carried voices across distances, and cars and airplanes changed how people traveled. Each built on the last, and the pace of change grew faster and faster."],
        ex: [
          ty("The period when machines and factories transformed work is called the Industrial ___. Type the word.", ["revolution"], "Revolution", "The Industrial Revolution changed how goods were made."),
          mc("What power source drove the earliest factories and trains?", "steam", ["nuclear power", "solar power", "wind turbines"], "Steam engines, burning coal, powered early industry."),
          ty("In which year did the American colonies declare independence? Type the 4-digit year.", ["1776"], "1776", "The Declaration of Independence was in 1776."),
          mc("The French Revolution of 1789 overthrew the country's...", "king", ["president", "army", "church only"], "The French Revolution overthrew the monarchy."),
          mc("The Industrial Revolution caused many people to move from farms to...", "cities", ["deserts", "the sea", "mountains"], "People moved to cities to work in the new factories."),
          ty("The French Revolution's motto was 'liberty, equality, and ___'. Type the missing word.", ["fraternity", "brotherhood"], "fraternity", "Liberty, equality, fraternity was the revolution's rallying cry.")
        ] },
      { title: "The Twentieth Century & Space Age",
        teach: ["The 1900s were a century of extremes — terrible wars but also astonishing progress. Two global conflicts, World War I (1914–1918) and World War II (1939–1945), involved dozens of countries and changed the map of the world. They showed how powerful — and dangerous — modern technology had become.",
                "After the wars, two superpowers, the United States and the Soviet Union, competed without directly fighting in a tense standoff called the Cold War. Part of that rivalry was the Space Race, a contest to explore beyond Earth.",
                "It reached a breathtaking peak in 1969, when the American Apollo 11 mission landed humans on the Moon and Neil Armstrong became the first person to walk on its surface. In a single lifetime, humans had gone from the first powered airplane flight to walking on another world."],
        ex: [
          mc("World War II took place during which years?", "1939–1945", ["1914–1918", "1776–1783", "1969–1975"], "World War II ran from 1939 to 1945."),
          ty("In which year did World War I begin? Type the 4-digit year.", ["1914"], "1914", "World War I began in 1914."),
          ty("In which year did humans first land on the Moon? Type the 4-digit year.", ["1969"], "1969", "Apollo 11 landed on the Moon in 1969."),
          mc("Who was the first person to walk on the Moon?", "Neil Armstrong", ["Christopher Columbus", "Albert Einstein", "Yuri Gagarin"], "Neil Armstrong was first to step onto the Moon in 1969."),
          mc("The tense standoff between the USA and the Soviet Union after WWII was called the...", "Cold War", ["Hundred Years' War", "Trojan War", "Cold Front"], "The Cold War was a rivalry without direct fighting."),
          ty("The contest between the USA and USSR to explore beyond Earth was the ___ Race. Type the word.", ["space"], "Space", "The Space Race was part of the Cold War rivalry.")
        ] },
      { title: "How We Know About the Past",
        teach: ["History is not a list of facts handed down intact. It is a case built from evidence, and knowing how that case is built is what separates history from storytelling. Historians divide their evidence into two kinds. A primary source comes from the time itself: a letter, a coin, a photograph, a court record, a wall someone painted. A secondary source is written later by someone studying those things — a textbook, a documentary, this lesson.",
                "Primary sources are closer to the event but they are not neutral. Every one was made by a particular person for a particular reason. A king's monument records his victories and quietly omits his defeats. A tax register lists who owned land and says nothing about anyone who owned none. So historians ask three questions of any source: who made it, when, and what did they want the reader to believe?",
                "That is also why the record is so uneven. Writing survives from people who could write; buildings survive from those who could afford stone. Vast numbers of ordinary lives left almost no trace at all, which does not mean they were unimportant — only that the evidence is thin. Good history is honest about the gaps rather than filling them in with confident guesses."],
        ex: [
          mc("Which of these is a primary source?", "A letter written during the event", ["A textbook chapter about it", "A documentary made last year", "An encyclopedia entry"], "Primary sources come from the time itself."),
          ty("A source written later by someone studying the evidence is called a ___ source. Type the word.", ["secondary"], "secondary", "Secondary sources interpret primary ones."),
          mc("Why is a king's monument an unreliable record of his reign?", "It was made to present him well, so it omits his failures", ["Stone wears away", "Kings could not write", "It is too old to read"], "Every source was made by someone with a purpose."),
          mc("Which question do historians ask of every source?", "Who made it, and what did they want you to believe?", ["Is it long enough?", "Is it beautiful?", "Was it expensive?"], "Purpose and authorship shape what a source shows."),
          mc("Why does far less evidence survive from ordinary people?", "Writing and stone came mostly from those with money or schooling", ["They led less interesting lives", "Their records were deliberately destroyed", "Historians are not interested"], "Survival of evidence is uneven, not a measure of importance."),
          mc("When the evidence runs out, good history...", "says so plainly", ["fills the gap with a likely story", "picks the most exciting version", "ignores the period entirely"], "Being honest about gaps is part of the discipline."),
          mc("A coin from the reign of an emperor is...", "a primary source", ["a secondary source", "not evidence at all", "only useful for its value"], "Objects made at the time are primary evidence too.")
        ] }
    ]
  };

  const SUBJECTS = [
    { id: "english", name: "English", icon: "📖", blurb: "Words, grammar, and clear writing", accent: "#f0356f", tint: "#ffe1ec" },
    { id: "math", name: "Math", icon: "➕", blurb: "From counting on to word problems", accent: "#0ca678", tint: "#d6f5ea", kind: "math" },
    { id: "science", name: "Science", icon: "🔬", blurb: "Space, life, matter, and forces", accent: "#2f6ff0", tint: "#e0ebff" },
    { id: "social", name: "World Studies", icon: "🌍", blurb: "Continents, capitals, and wonders", accent: "#f08c00", tint: "#ffefd6" },
    { id: "history", name: "History", icon: "📜", blurb: "From ancient times to the space age", accent: "#e8590c", tint: "#ffe6d6" },
    { id: "spanish", name: "Spanish", icon: "🇪🇸", blurb: "Hola — your first Spanish words", accent: "#fa3e3e", tint: "#ffe2e2" },
    { id: "french", name: "French", icon: "🇫🇷", blurb: "Bonjour — start speaking French", accent: "#6741d9", tint: "#e9e4ff" },
    { id: "latin", name: "Latin", icon: "🏛️", blurb: "The ancient root of many languages", accent: "#0b8a9c", tint: "#d6f2f5" },
    { id: "chinese", name: "Chinese", icon: "🀄", blurb: "Characters, pinyin, and tones", accent: "#e64980", tint: "#ffe1ef" },
    { id: "music", name: "Music", icon: "🎵", blurb: "Notes and sounds you can hear", accent: "#9c36b5", tint: "#f4e2fb", kind: "music" }
  ];

  /* =======================================================================
     AI TOPIC-SET GENERATOR — prompt + parse + validate (no network here).
     The network call lives in the app; this pure code is fully testable.
     Mirrors CodeQuest: a topic becomes a SET of lessons, every question is
     validated for integrity, and the teach text must actually teach.
     ======================================================================= */
  var TEACH_FILLER = ["this","that","lesson","teaches","you","will","learn","about","concept","here","the","a","an","of","to","and","in","is","it","some","things","topic","understand","explore"];
  function teachIsSubstantive(teach){
    var t = Array.isArray(teach) ? teach.join(" ") : String(teach||"");
    if (t.trim().length < 60) return false;
    var words = t.toLowerCase().replace(/[^a-z\s]/g," ").split(/\s+/).filter(Boolean);
    if (words.length < 12) return false;
    var meaningful = words.filter(function(w){ return TEACH_FILLER.indexOf(w) === -1; });
    return (meaningful.length / words.length) > 0.45;
  }

  function clean(s){ return String(s==null?"":s).replace(/\s+/g," ").trim(); }
  function uniqStrings(arr){ var seen={}, out=[]; arr.forEach(function(x){ var k=norm(x); if(x && !(k in seen)){ seen[k]=1; out.push(x); } }); return out; }

  var GEN = {
    CAP_LESSONS: 4, CAP_QS: 8, MIN_QS: 3,
    buildPrompt: function(topic, difficulty, ctx){
      difficulty = difficulty || "beginner";
      ctx = ctx || {};
      var head = [
        "You are a curriculum author for a friendly learning app for a general audience.",
        "Create a short SET of lessons that teaches this topic: \"" + clean(topic) + "\".",
        "Audience level: " + difficulty + "."
      ];
      if (ctx.profile) head.push("About the learner: " + clean(ctx.profile) + ". Match your examples and tone to them.");
      if (ctx.known && ctx.known.length) head.push("The learner ALREADY KNOWS these things — where it helps, connect new ideas to them (e.g. \"you already know X, here it's Y\"): " + ctx.known.slice(0,12).map(clean).join("; ") + ".");
      return head.concat([
        "",
        "Return ONLY a JSON object (no markdown, no code fences, no commentary) shaped exactly like this:",
        "{",
        '  "topic": "a short title, 2-4 words",',
        '  "lessons": [',
        '    {',
        '      "title": "clear lesson title",',
        '      "teach": ["2-4 sentences that name the idea, explain it plainly, and give a concrete example", "optional second short paragraph"],',
        '      "questions": [',
        '        {"type":"choice","ask":"a clear question","correct":"the correct answer","distractors":["a wrong but plausible option","another wrong option","a third wrong option"],"explain":"one sentence on why the answer is right"},',
        '        {"type":"write","ask":"a question the learner types a short answer to","answer":"the canonical short answer","accept":["an acceptable alternative spelling or synonym"],"explain":"one sentence explanation"}',
        '      ]',
        "    }",
        "  ]",
        "}",
        "",
        "Rules:",
        "- Make 2 to " + this.CAP_LESSONS + " lessons; each with 5 to " + this.CAP_QS + " questions; mix \"choice\" and \"write\" questions.",
        "- Every fact must be accurate. Keep answers short (a word or a short phrase), especially for \"write\".",
        "- For \"choice\": give exactly 3 distractors, all clearly wrong and all different from the correct answer and each other.",
        "- Every question needs a one-sentence \"explain\". Write in clear, warm, simple language.",
        "- Output the JSON only."
      ]).join("\n");
    },
    buildHelpPrompt: function(teach, question, topicTitle){
      return [
        "You are a warm, patient tutor inside a learning app. Keep replies short (2-4 sentences) and encouraging.",
        "The current lesson" + (topicTitle ? " (\"" + clean(topicTitle) + "\")" : "") + " teaches:",
        (Array.isArray(teach) ? teach.join(" ") : String(teach || "")),
        "",
        "The learner asks: \"" + clean(question) + "\"",
        "",
        "Explain in a simple way, teaching ONE small step at a time. If they're asking for a practice answer, guide them toward it with a hint or example instead of just stating it. Use plain language."
      ].join("\n");
    },
    extractJSON: function(text){
      var t = String(text||"").trim();
      // strip code fences
      t = t.replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
      // if there is prose around it, grab the outermost braces
      var first = t.indexOf("{"), last = t.lastIndexOf("}");
      if (first > 0 || last < t.length-1){ if(first>=0 && last>first) t = t.slice(first, last+1); }
      try { return JSON.parse(t); }
      catch(e){
        // salvage: trim trailing incomplete content back to last closing brace
        var cut = t.lastIndexOf("}");
        while (cut > 0){
          try { return JSON.parse(t.slice(0, cut+1)); } catch(e2){ cut = t.lastIndexOf("}", cut-1); }
        }
        throw new Error("The AI's response wasn't valid JSON.");
      }
    },
    // validate a parsed object (or raw text) into a clean topic set. Throws on total failure.
    validate: function(raw, fallbackTitle){
      var obj = (typeof raw === "string") ? GEN.extractJSON(raw) : raw;
      if (!obj || typeof obj !== "object") throw new Error("The AI didn't return a usable lesson set.");
      var rawLessons = Array.isArray(obj.lessons) ? obj.lessons
        : (Array.isArray(obj.questions) ? [{title: obj.title, teach: obj.teach, questions: obj.questions}] : []);
      var lessons = [], dropped = {lessons:0, questions:0};
      rawLessons.slice(0, GEN.CAP_LESSONS).forEach(function(L){
        if (!L || typeof L !== "object"){ dropped.lessons++; return; }
        var teach = Array.isArray(L.teach) ? L.teach.map(clean).filter(Boolean) : (L.teach ? [clean(L.teach)] : []);
        if (!teachIsSubstantive(teach)){ dropped.lessons++; return; }
        var ex = [];
        (Array.isArray(L.questions)?L.questions:[]).forEach(function(Q){
          var made = GEN._question(Q);
          if (made) ex.push(made); else dropped.questions++;
          });
        ex = ex.slice(0, GEN.CAP_QS);
        if (ex.length >= GEN.MIN_QS){ lessons.push({ title: clean(L.title)||"Lesson", teach: teach, ex: ex }); }
        else { dropped.lessons++; }
      });
      if (!lessons.length) throw new Error("The AI's lessons didn't pass our quality checks. Try a clearer or broader topic.");
      return { name: clean(obj.topic) || clean(fallbackTitle) || "New Topic", lessons: lessons, dropped: dropped };
    },
    _question: function(Q){
      if (!Q || typeof Q !== "object") return null;
      var ask = clean(Q.ask); if (ask.length < 4) return null;
      var why = clean(Q.explain || Q.why) || "See the lesson above.";
      var kind = (Q.type === "write" || Q.type === "type") ? "type" : (Q.type === "choice" ? "choice" : (Q.distractors || Q.choices || Q.wrong) ? "choice" : "type");
      if (kind === "choice"){
        var correct = clean(Q.correct != null ? Q.correct : Q.answer);
        var dist = (Q.distractors || Q.wrong || []).map(clean).filter(Boolean);
        if (Array.isArray(Q.choices) && !dist.length){ dist = Q.choices.map(clean).filter(function(c){ return norm(c)!==norm(correct); }); }
        if (!correct) return null;
        var choices = uniqStrings([correct].concat(dist));
        if (choices.length < 3) return null;
        if (choices.map(norm).indexOf(norm(correct)) === -1) return null;
        return { kind:"choice", ask: ask, choices: choices.slice(0,4), right: correct, why: why };
      } else {
        var answer = clean(Q.answer != null ? Q.answer : Q.correct);
        var accept = uniqStrings([answer].concat((Q.accept||[]).map(clean)).filter(Boolean));
        if (!accept.length) return null;
        return { kind:"type", ask: ask, accept: accept, canonical: answer || accept[0], why: why };
      }
    }
  };

  /* ---------- HINT LADDER (nudge -> warmer -> structure -> answer) ---------- */
  function maskWord(w){
    return String(w||"").split(/(\s+)/).map(function(tok){
      if (/^\s*$/.test(tok)) return tok;
      if (tok.length <= 2) return tok;
      var mid = tok.slice(1, -1).replace(/[^\s]/g, "_");
      return tok.charAt(0) + mid + tok.charAt(tok.length-1);
    }).join("");
  }
  var HINTS = {
    maskWord: maskWord,
    build: function(e){
      var rungs = [];
      if (e.kind === "choice"){
        rungs.push({ label:"Nudge", text:"Think back to the lesson just above — this is covered there." });
        var wrongs = (e.choices||[]).filter(function(c){ return norm(c) !== norm(e.right); });
        if (wrongs.length) rungs.push({ label:"Warmer", text:"It is not \"" + wrongs[0] + "\"." });
        if (wrongs.length >= 2) rungs.push({ label:"Almost there", text:"It is either \"" + e.right + "\" or \"" + wrongs[wrongs.length-1] + "\" — which one fits?" });
        rungs.push({ label:"Answer", text:"The answer is \"" + e.right + "\".", isAnswer:true });
      } else {
        var ans = e.canonical || (e.accept && e.accept[0]) || "";
        var letters = ans.replace(/\s/g,"").length;
        rungs.push({ label:"Nudge", text:"This is a short answer straight from the lesson. Picture what you just read." });
        rungs.push({ label:"Warmer", text:"It starts with \"" + ans.trim().charAt(0) + "\" and has " + letters + " letters." });
        rungs.push({ label:"Almost there", text:"Fill in the blanks:  " + maskWord(ans) });
        rungs.push({ label:"Answer", text:"The answer is \"" + ans + "\".", isAnswer:true });
      }
      return rungs;
    }
  };

  /* ---------- PROFILE + AUTO-DIFFICULTY ---------- */
  var PROFILE_PRESETS = [
    { id:"new",  label:"I'm brand new to this",   short:"New to it" },
    { id:"some", label:"I know some basics",      short:"Know some" },
    { id:"exp",  label:"I'm fairly experienced",  short:"Confident" }
  ];
  function autoDifficulty(presetId, completed){
    var base = presetId === "exp" ? 2 : presetId === "some" ? 1 : 0;
    var prog = completed >= 12 ? 2 : completed >= 5 ? 1 : 0;
    var score = Math.max(base, prog);              // skill score = the stronger signal
    if (base && prog > base) score = Math.min(2, base + 1); // both point up -> nudge higher
    return score >= 2 ? "advanced" : score >= 1 ? "intermediate" : "beginner";
  }

  /* ---------- spaced repetition (SM-2-lite): remember & re-surface items ---------- */
  var SRS_DAY = 86400000;
  function schedNext(prev, correct, now) {
    var reps = prev ? (prev.reps || 0) : 0, ivl;
    // running totals, so the app can show you what you keep getting wrong.
    // Older saved data has neither field; both default to 0 and simply start counting.
    var seen = (prev && prev.seen) || 0, missed = (prev && prev.missed) || 0;
    seen = seen + 1; if (!correct) missed = missed + 1;
    if (correct) {
      reps = reps + 1;
      ivl = (!prev || !prev.ivl || prev.ivl < 1) ? 1 : (prev.ivl === 1 ? 3 : Math.round(prev.ivl * 2.3));
    } else {
      reps = 0; ivl = 0;               // missed -> due again now (relearn)
    }
    return { reps: reps, ivl: ivl, due: now + ivl * SRS_DAY, seen: seen, missed: missed };
  }
  /* Questions you have got wrong more than once, worst first. Two misses, not
     one: everybody slips once, and calling that a trouble spot would be noise. */
  function weakItems(sched, minMissed) {
    var floor = minMissed || 2, out = [];
    for (var k in sched) {
      if (!Object.prototype.hasOwnProperty.call(sched, k)) continue;
      var it = sched[k];
      if (it && (it.missed || 0) >= floor) out.push(k);
    }
    out.sort(function (a, b) {
      var A = sched[a], B = sched[b];
      var d = (B.missed || 0) - (A.missed || 0);
      if (d) return d;
      return ((B.missed || 0) / Math.max(1, B.seen || 1)) - ((A.missed || 0) / Math.max(1, A.seen || 1));
    });
    return out;
  }
  function dueItems(sched, now) {
    var out = [];
    for (var k in sched) { if (Object.prototype.hasOwnProperty.call(sched, k) && sched[k] && sched[k].due <= now) out.push(k); }
    out.sort(function (a, b) { return sched[a].due - sched[b].due; });
    return out;
  }
  var SRS = { DAY: SRS_DAY, schedNext: schedNext, dueItems: dueItems, weakItems: weakItems };

  /* ---------- spoken pronunciation: pick the foreign word + language ---------- */
  var SPEAK_LANG = { spanish: "es-ES", french: "fr-FR", chinese: "zh-CN" };
  function sayTarget(ex, subjId) {
    var lang = SPEAK_LANG[subjId]; if (!lang || !ex) return null;
    var ask = ex.ask || "", text = "";
    if (subjId === "chinese") {
      var inAsk = (ask.match(/[一-鿿]+/g) || []).join("");
      if (inAsk) text = inAsk;
      else { var src = (ex.kind === "type" ? ex.canonical : ex.right) || ""; var c = src.match(/[一-鿿]+/g); text = c ? c.join("") : ""; }
      return text ? { text: text, lang: lang } : null;   // only speak when real Chinese characters exist
    }
    if (/\bmean/i.test(ask)) { var m = ask.match(/[‘'"“]([^’'"”]+)[’'"”]/); if (m) text = m[1]; }
    if (!text) text = (ex.kind === "type" ? (ex.canonical || (ex.accept && ex.accept[0])) : ex.right) || "";
    text = String(text).replace(/[()]/g, "").trim();
    return text ? { text: text, lang: lang } : null;
  }

  const API = {
    norm: norm, mc: mc, ty: ty, checkType: checkType, nearMiss: nearMiss, editDistance: editDistance,
    teachIsSubstantive: teachIsSubstantive, GEN: GEN,
    HINTS: HINTS, maskWord: maskWord, PROFILE_PRESETS: PROFILE_PRESETS, autoDifficulty: autoDifficulty,
    SPEAK_LANG: SPEAK_LANG, sayTarget: sayTarget, SRS: SRS,
    makeRng: makeRng, ri: ri, pick: pick, shuffle: shuffle,
    MATH: MATH, MUSIC: MUSIC, COURSES: COURSES, SUBJECTS: SUBJECTS
  };

  return API;
})();

const A = Academy;

const CSS = `
  :root{
    --paper:#f4f6fc; --card:#ffffff; --card-2:#eef1f9;
    --ink:#1e2437; --ink-soft:#5b6478; --ink-faint:#98a1b6; --line:#e6eaf4;
    --ok:#12b886; --ok-bg:#e2f8ef; --no:#fa5252; --no-bg:#ffe6e9;
    --a:#6d5cf5; --a-tint:#ece9ff;
    --shadow:0 10px 28px rgba(70,80,130,.10);
    --tabh:64px;
  }
  *{box-sizing:border-box}
  button{color:inherit;font-family:inherit}
  html,body{margin:0;padding:0}
  body{
    background:var(--paper); color:var(--ink);
    font:16px/1.55 ui-rounded,"SF Pro Rounded","Segoe UI",Nunito,Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .app{max-width:720px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
  .scroll{flex:1;padding:16px 16px calc(var(--tabh) + 26px);overflow-x:hidden}

  /* top app bar */
  .appbar{position:sticky;top:0;z-index:20;background:rgba(244,246,252,.9);-webkit-backdrop-filter:saturate(1.4) blur(8px);backdrop-filter:saturate(1.4) blur(8px);
    display:flex;align-items:center;gap:10px;padding:12px 16px 10px;border-bottom:1px solid var(--line)}
  .appbar .mk{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#6d5cf5,#e64980);
    display:flex;align-items:center;justify-content:center;font-size:19px;flex:0 0 auto}
  .appbar .ti{font-size:18px;font-weight:800}
  .appbar .rt{margin-left:auto;display:flex;align-items:center}
  /* The apps launcher: one control in the header, a menu beneath it. Sized so
     the button never squeezes the title — on a narrow screen the label goes and
     the grid icon carries it alone. */
  .applauncher{position:relative;flex:0 0 auto}
  .applauncher .alkbtn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 11px;
    border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink-soft);
    font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:.15s}
  .applauncher .alkbtn:hover{border-color:var(--a);color:var(--ink);background:var(--a-tint)}
  .applauncher .alkbtn:focus-visible{outline:2px solid var(--a);outline-offset:2px}
  .applauncher .alkgrid{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:13px;height:13px}
  .applauncher .alkgrid i{background:currentColor;border-radius:1.5px;display:block}
  .applauncher .alkmenu{position:absolute;right:0;top:38px;z-index:60;width:min(310px,calc(100vw - 28px));
    background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px;
    box-shadow:var(--shadow)}
  .applauncher .alkhead{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
    color:var(--ink-faint);padding:6px 8px 8px}
  .applauncher .alkitem{display:flex;align-items:center;gap:11px;width:100%;padding:10px;
    border:none;border-radius:10px;background:transparent;font-family:inherit;cursor:pointer;
    text-align:left;text-decoration:none;color:inherit;transition:.12s}
  .applauncher .alkitem:hover{background:var(--a-tint)}
  .applauncher .alkitem:focus-visible{outline:2px solid var(--a);outline-offset:-2px}
  .applauncher .alkic{width:34px;height:34px;flex:0 0 auto;border-radius:9px;display:flex;
    align-items:center;justify-content:center;font-size:17px;background:var(--a-tint);color:var(--a)}
  .applauncher .alktx{display:flex;flex-direction:column;gap:1px;min-width:0}
  .applauncher .alktx b{font-size:14.5px;font-weight:750;color:var(--ink)}
  .applauncher .alktx em{font-style:normal;font-size:11.5px;color:var(--ink-faint);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .applauncher .alkgo{margin-left:auto;color:var(--a);font-weight:800;flex:0 0 auto}
  @media (max-width:560px){
    .applauncher.compact .alklb{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .applauncher.compact .alkbtn{padding:0 10px}
  }
  .obswitch{display:flex;justify-content:center;padding:14px 12px 0}
  .avatar{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;flex:0 0 auto;box-shadow:var(--shadow)}
  .avatar.tap{cursor:pointer}
  .avatar.tap:active{transform:scale(.94)}
  .avatar.sm{width:30px;height:30px;font-size:13px}

  /* screen transition */
  .screen.fwd{animation:pushIn .3s cubic-bezier(.2,.7,.3,1)}
  .screen.back{animation:popIn .3s cubic-bezier(.2,.7,.3,1)}
  .screen.fade{animation:fadeIn .28s ease}
  @keyframes pushIn{from{opacity:.35;transform:translateX(30px)}to{opacity:1;transform:none}}
  @keyframes popIn{from{opacity:.35;transform:translateX(-30px)}to{opacity:1;transform:none}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes sin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .back{background:var(--card);border:1px solid var(--line);color:var(--ink-soft);border-radius:12px;
    padding:9px 15px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:14px;box-shadow:var(--shadow);min-height:44px}
  .back:hover{color:var(--ink)}

  /* bottom tab bar */
  .tabbar{position:fixed;left:0;right:0;bottom:0;z-index:30;height:calc(var(--tabh) + env(safe-area-inset-bottom));
    padding-bottom:env(safe-area-inset-bottom);background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    border-top:1px solid var(--line);display:flex}
  .tab{flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:3px;color:var(--ink-faint);font:inherit;font-size:11px;font-weight:700;padding:6px 0}
  .tab .tic{font-size:21px;line-height:1;opacity:.78}
  .tab.on{color:var(--a)}
  .tab.on .tic{opacity:1}

  /* headings */
  h1{font-size:25px;margin:0;font-weight:800}
  h2{font-size:16px;margin:0;font-weight:800}
  .sub{color:var(--ink-soft);font-size:14px;margin:3px 0 2px}
  .shead{display:flex;align-items:center;gap:12px;margin-bottom:4px}
  .ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex:0 0 auto}
  .kicker{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;
    color:var(--a);background:var(--a-tint);padding:4px 11px;border-radius:999px;margin-bottom:12px}

  .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;margin-top:14px;box-shadow:var(--shadow)}

  /* dashboard */
  .hero{background:linear-gradient(135deg,#eae9ff,#ffffff);border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:var(--shadow);
    display:flex;align-items:center;gap:18px;margin-bottom:14px}
  .hero .txt{flex:1;min-width:0}
  .hero .hi2{font-size:20px;font-weight:800}
  .hero .p2{color:var(--ink-soft);font-size:13.5px;margin-top:3px}
  .ring{width:96px;height:96px;flex:0 0 auto;position:relative}
  .ring .lab{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ring .num{font-size:22px;font-weight:800;line-height:1}
  .ring .of{font-size:11px;color:var(--ink-faint);font-weight:700}
  .cont{display:flex;align-items:center;gap:14px;cursor:pointer;width:100%;text-align:left;background:var(--card);
    border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
  .cont:hover{transform:translateY(-2px)}
  .cont .cic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:23px;flex:0 0 auto}
  .cont .cl{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--a)}
  .cont .ct2{font-weight:750;margin-top:2px}
  .cont .cs{font-size:12.5px;color:var(--ink-faint)}
  .cont .go2{margin-left:auto;font-size:22px;color:var(--a);font-weight:800;flex:0 0 auto}
  .secttl{font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--ink-faint);margin:22px 4px 2px}
  /* Hub doors. Two shapes: a <button> for Study It (same deploy, one route in)
     and an <a> for CodeQuest (a separate site). .cont was written for a button,
     so the anchor needs the link bits back: no underline, inherited color. Both
     need a min-width:0 middle column so a long blurb wraps instead of pushing
     the arrow off a narrow phone. */
  .cont.door{margin-top:10px}
  a.cont.door{text-decoration:none;color:inherit}
  .cont.door>div:nth-child(2){min-width:0}
  .cont.door .cs{overflow-wrap:anywhere}
  .cont.door:hover{transform:translateY(-2px);border-color:var(--a)}
  .cont.door:focus-visible{outline:2px solid var(--a);outline-offset:2px}
  .doornote{font-size:12px;color:var(--ink-faint);margin:8px 4px 2px;text-align:center}

  /* subject grid */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
  .subj{text-align:left;cursor:pointer;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px;box-shadow:var(--shadow);transition:transform var(--t-fast) var(--ease)}
  .subj:hover{transform:translateY(-3px)}
  .subj .ic{margin-bottom:11px;width:50px;height:50px;font-size:26px;border-radius:15px}
  .subj .nm{font-size:18px;font-weight:800}
  .subj .bl{font-size:13px;color:var(--ink-soft);margin-top:4px}
  .subj .ct{font-size:12.5px;color:var(--ink-faint);margin-top:11px;font-weight:600}
  .tick{font-size:15px;margin-left:7px;font-weight:900}
  .pbar{height:6px;border-radius:999px;background:var(--line);margin-top:9px;overflow:hidden}
  .pbar>i{display:block;height:100%;border-radius:999px;transition:width var(--t-slow) var(--ease)}

  /* level path */
  .path{position:relative;padding-left:6px}
  .path::before{content:"";position:absolute;left:24px;top:14px;bottom:14px;width:3px;background:var(--line);border-radius:2px}
  .stop{position:relative;display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);
    border-radius:16px;padding:13px 15px;margin:10px 0;cursor:pointer;box-shadow:var(--shadow);z-index:1;transition:transform var(--t-fast) var(--ease)}
  .stop:hover{transform:translateY(-2px)}
  .node{width:38px;height:38px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
    font-weight:800;background:var(--card-2);color:var(--ink-soft);border:3px solid var(--line);font-size:15px}
  .stop.done .node{background:var(--a);border-color:var(--a);color:#fff}
  .stop.current{border-color:var(--a);box-shadow:0 0 0 2px var(--a-tint),var(--shadow)}
  .stop.current .node{border-color:var(--a);color:var(--a);animation:pulse 1.8s infinite}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 var(--a-tint)}50%{box-shadow:0 0 0 6px var(--a-tint)}}
  .stop .st{font-weight:750}
  .stop .ss{font-size:12.5px;color:var(--ink-faint);margin-top:1px}
  .stop .badge{margin-left:auto;font-size:12px;font-weight:800;color:var(--a);flex:0 0 auto}
  .stop.review{border-style:dashed;border-width:2px;border-color:var(--a);background:var(--a-tint)}
  .stop.review .node{background:var(--a);border-color:var(--a);color:#fff}

  /* progress screen */
  .prow{display:flex;align-items:center;gap:12px;padding:13px 4px;border-bottom:1px solid var(--line)}
  .prow:last-child{border-bottom:none}
  .prow .pic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto}
  .prow .pn{font-weight:750}
  .prow .pc{font-size:12.5px;color:var(--ink-faint)}
  .prow .pbar{flex:1;max-width:150px;margin:0 0 0 auto}
  .linkbtn{background:none;border:none;color:var(--ink-faint);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;padding:12px;min-height:44px}
  .linkbtn:hover{color:var(--ink-soft)}

  /* lesson + practice components */
  .lesson p{margin:0 0 12px;font-size:16px}
  .lesson p:last-child{margin-bottom:0}
  .prog{font-size:13px;color:var(--ink-faint);font-weight:600;margin-bottom:10px}
  .ask{font-size:19px;font-weight:750;margin:2px 0 16px}
  .opts{display:flex;flex-direction:column;gap:11px}
  .opt{text-align:left;background:var(--card-2);border:2px solid var(--line);border-radius:14px;padding:13px 16px;
    font-size:16px;color:var(--ink);cursor:pointer;min-height:50px;transition:all var(--t-fast) var(--ease);font-weight:600}
  .opt:hover:not(:disabled){border-color:var(--a)}
  .opt:disabled{cursor:default}
  .opt.right{border-color:var(--ok);background:var(--ok-bg)}
  .opt.wrong{border-color:var(--no);background:var(--no-bg)}
  .opt .m{float:right;font-weight:800;display:inline-block;animation:pop .3s}
  @keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
  .typerow{display:flex;gap:10px;flex-wrap:wrap}
  input.ans{flex:1;min-width:150px;font-size:18px;padding:13px 15px;border-radius:14px;border:2px solid var(--line);
    background:var(--card-2);color:var(--ink);font-family:inherit;font-weight:600}
  input.ans:focus{outline:none;border-color:var(--a);background:#fff}
  input.ans.cloudin{width:100%;flex:none;min-width:0;font-size:16px;font-weight:600}
  /* Cloud sign-in modal. Centred rather than a bottom sheet, matching the shape
     of Study It's own auth modal so the two read as one product. It sits above
     the tab bar but below nothing else — there is no other layer it could hide. */
  .cloudmodal{position:fixed;z-index:80;left:50%;top:50%;transform:translate(-50%,-50%);
    width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;
    background:var(--card);border:1px solid var(--line);border-radius:20px;
    padding:22px 20px 18px;box-shadow:var(--shadow)}
  .cloudmodal .cmhead{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .cloudmodal .cmx{background:transparent;border:none;font-size:16px;line-height:1;
    color:var(--ink-faint);cursor:pointer;padding:4px 6px;border-radius:8px}
  .cloudmodal .cmx:hover{background:var(--card-2);color:var(--ink)}
  .cloudmodal .cmtitle{font-size:27px;font-weight:800;letter-spacing:-.4px;margin:8px 0 4px}
  .cloudmodal .cmsub{font-size:13.5px;line-height:1.5;color:var(--ink-soft);margin:0 0 16px}
  .cloudmodal .cmprimary{width:100%;justify-content:center;margin-top:14px}
  .cloudmodal .cmsecondary{width:100%;justify-content:center;margin-top:8px;font-size:13px}
  .cloudmodal .cmquiet{display:block;width:100%;margin-top:8px;padding:6px;background:transparent;
    border:none;color:var(--ink-faint);font-size:12px;font-family:inherit;cursor:pointer}
  .cloudmodal .cmquiet:hover{color:var(--ink-soft)}
  .cloudmodal .cmfoot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);text-align:center}
  .cloudmodal .cmlink{background:transparent;border:none;color:var(--a);font-size:12.5px;
    font-family:inherit;font-weight:700;cursor:pointer;padding:4px}
  @media (max-width:400px){.cloudmodal{padding:18px 15px 15px}.cloudmodal .cmtitle{font-size:23px}}

  .fb{margin-top:15px;border-radius:14px;padding:13px 15px;font-size:15px;animation:sin .25s}
  .fb.ok{background:var(--ok-bg);color:#1f6b4c;border:1px solid #bfe6cf}
  .fb.no{background:var(--no-bg);color:#a2432e;border:1px solid #f0c9bd}
  .fb b{font-weight:800}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center}
  .btn{font-size:15px;font-weight:750;cursor:pointer;border-radius:14px;padding:12px 20px;min-height:48px;border:2px solid var(--line);background:var(--card);color:var(--ink)}
  .btn:hover{border-color:var(--a)}
  .btn.go{background:var(--a);border-color:var(--a);color:#fff}
  .btn.go:hover{filter:brightness(1.05)}
  .spacer{flex:1}
  .mathq{font-size:40px;font-weight:800;text-align:center;margin:6px 0 2px}
  .mathq.small{font-size:20px;line-height:1.4}
  .segs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
  .seg{background:var(--card-2);border:2px solid var(--line);color:var(--ink-soft);border-radius:999px;padding:8px 16px;cursor:pointer;font-size:14px;font-weight:700;min-height:44px}
  .seg.on{background:var(--a);color:#fff;border-color:var(--a)}
  .piano{position:relative;height:170px;margin:10px 0 4px;user-select:none;touch-action:manipulation}
  .whites{display:flex;height:100%}
  .wk{flex:1;background:linear-gradient(#ffffff,#f4eee2);border:1px solid #d8cdb5;border-radius:0 0 9px 9px;position:relative;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:9px;color:#9a8f78;font-size:12px;font-weight:700}
  .wk:active,.wk.on{background:linear-gradient(#ffe9c2,#ffd692)}
  .bk{position:absolute;top:0;width:8.4%;height:62%;background:linear-gradient(#5b5040,#2c2418);border-radius:0 0 7px 7px;z-index:2;cursor:pointer;box-shadow:0 3px 5px rgba(0,0,0,.3)}
  .bk:active,.bk.on{background:linear-gradient(#c98a3a,#a9702a)}
  .bignote{font-size:30px;font-weight:800;text-align:center;color:var(--a);margin:6px 0}
  .chip{display:inline-block;background:var(--a-tint);color:var(--a);border-radius:10px;padding:8px 12px;font-weight:800;font-family:ui-monospace,Menlo,monospace;letter-spacing:1px}
  /* tactile press feedback */
  .subj:active,.stop:active,.cont:active,.opt:active,.btn:active,.tab:active,.seg:active,.wk:active,.switch:active,.back:active{transform:scale(.97)}
  /* settings */
  .setrow{display:flex;align-items:center;gap:14px;padding:14px 2px;border-bottom:1px solid var(--line)}
  .setrow:last-child{border-bottom:none}
  .seticon{width:42px;height:42px;border-radius:12px;background:var(--a-tint);display:flex;align-items:center;justify-content:center;font-size:21px;flex:0 0 auto}
  .setmid{flex:1;min-width:0}
  .settitle{font-weight:750}
  .setdesc{font-size:12.5px;color:var(--ink-faint)}
  .switch{width:54px;height:32px;border-radius:999px;background:var(--line);border:none;position:relative;cursor:pointer;flex:0 0 auto;transition:background var(--t) var(--ease);padding:0}
  .switch.on{background:var(--a)}
  .switch .knob{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transition:left var(--t) var(--ease);box-shadow:0 2px 4px rgba(0,0,0,.25)}
  .switch.on .knob{left:25px}
  /* hear-it (pronunciation) */
  .hearbtn{display:inline-flex;align-items:center;gap:6px;background:var(--a-tint);color:var(--a);border:none;border-radius:999px;
    padding:7px 14px;font-weight:800;font-size:13.5px;cursor:pointer;margin:-6px 0 14px;min-height:40px}
  .hearbtn:active{transform:scale(.96)}
  /* hint ladder */
  .hints{margin-top:14px}
  .hintbtn{background:var(--a-tint);color:var(--a);border:none;border-radius:12px;padding:10px 15px;font-weight:800;cursor:pointer;font-size:14px;min-height:44px}
  .hintbtn:disabled{opacity:.7;cursor:default}
  .hintlist{margin-top:10px;display:flex;flex-direction:column;gap:8px}
  .rung{background:var(--card-2);border:1px solid var(--line);border-left:3px solid var(--a);border-radius:10px;padding:9px 12px;font-size:14px}
  .rung .rl{font-weight:800;color:var(--a);font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  .rung.answer{border-left-color:var(--ok)}
  .rung.answer .rl{color:var(--ok)}
  /* AI teacher chat */
  .chat{display:flex;flex-direction:column;gap:8px;margin:12px 0}
  .msg{padding:9px 13px;border-radius:14px;font-size:14px;max-width:85%;white-space:pre-wrap;line-height:1.5}
  .msg.me{align-self:flex-end;background:var(--a);color:#fff;border-bottom-right-radius:4px}
  .msg.ai{align-self:flex-start;background:var(--card-2);color:var(--ink);border-bottom-left-radius:4px}
  /* per-class familiarity */
  .famrow{background:var(--a-tint);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-top:14px}
  .famq{font-weight:750;font-size:15px}
  .famhint{font-size:12.5px;color:var(--ink-faint);margin-top:8px}
  /* labels + AI generate */
  .lbl{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--ink-faint);margin:14px 0 7px}
  textarea.ans{width:100%;min-height:70px;resize:vertical;font-family:inherit}
  .subj.create{border:2px dashed var(--a);background:var(--a-tint)}
  .spin{display:flex;align-items:center;gap:12px;margin-top:14px}
  .spinner{width:26px;height:26px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--a);animation:spin 0.8s linear infinite;flex:0 0 auto}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spintext{font-size:14px;color:var(--ink-soft)}
  /* completion screen */
  .done-card{text-align:center}
  .burst{display:flex;justify-content:center;margin:8px 0 2px}
  .checkbig{width:88px;height:88px;border-radius:50%;background:var(--a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:900;animation:popbig .55s cubic-bezier(.2,.8,.3,1.5)}
  @keyframes popbig{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
  .btn.big{width:100%;justify-content:center;text-align:center;padding:14px 20px}
  /* dark theme */
  [data-theme="dark"]{
    --paper:#12141d; --card:#1b1e2a; --card-2:#232838;
    --ink:#eef1f8; --ink-soft:#a6afc4; --ink-faint:#7c869d; --line:#2c3242;
    --ok:#3ddc97; --ok-bg:#173026; --no:#ff6b81; --no-bg:#31202a;
    --shadow:0 10px 26px rgba(0,0,0,.5);
  }
  [data-theme="dark"] .appbar{background:rgba(18,20,29,.9)}
  [data-theme="dark"] .tabbar{background:rgba(27,30,42,.95)}
  [data-theme="dark"] .hero{background:linear-gradient(135deg,#20233a,#1b1e2a)}
  [data-theme="dark"] .fb.ok{color:#8fe6b4;border-color:#2f5e46}
  [data-theme="dark"] .fb.no{color:#ffb0a0;border-color:#5e392e}
  [data-theme="dark"] .wk{background:linear-gradient(#f2ece0,#ded5c4);border-color:#b7ac97;color:#6f6455}
  .foot{margin-top:26px;color:var(--ink-faint);font-size:12px;text-align:center;line-height:1.7;white-space:pre-line}
  /* launch splash */
  #splash{position:fixed;inset:0;z-index:200;background:linear-gradient(160deg,#6d5cf5,#e64980);display:flex;align-items:center;justify-content:center;pointer-events:none;animation:splashout .42s forwards}
  .splashinner{text-align:center;color:#fff;animation:splashpop .55s cubic-bezier(.2,.8,.3,1.5)}
  .splashmk{width:92px;height:92px;border-radius:27px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:48px;margin:0 auto 16px}
  .splashname{font-size:25px;font-weight:800;letter-spacing:.3px}
  @keyframes splashpop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
  @keyframes splashout{0%,40%{opacity:1}100%{opacity:0;visibility:hidden}}
  /* onboarding */
  .ob{position:fixed;inset:0;z-index:150;background:var(--paper);display:flex;flex-direction:column;padding:30px 22px calc(env(safe-area-inset-bottom) + 24px)}
  .obtop{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px}
  .obmk{width:100px;height:100px;border-radius:30px;background:linear-gradient(135deg,#6d5cf5,#e64980);display:flex;align-items:center;justify-content:center;font-size:52px;box-shadow:var(--shadow)}
  .ob h1{font-size:27px;margin:0}
  .obsub{color:var(--ink-soft);font-size:16px;max-width:340px;line-height:1.5}
  .obinput{width:100%;max-width:360px;font-size:18px;padding:14px 16px;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--ink);text-align:center;font-family:inherit}
  .obinput:focus{outline:none;border-color:var(--a)}
  .obchoices{display:flex;flex-direction:column;gap:10px;width:100%;max-width:360px}
  .obchoice{padding:15px;border-radius:14px;border:2px solid var(--line);background:var(--card);font-size:16px;font-weight:700;cursor:pointer;color:var(--ink)}
  .obchoice.withava{display:flex;align-items:center;gap:11px;text-align:left}
  .obfoot{display:flex;flex-direction:column;align-items:center;gap:8px}
  .obnext{width:100%;max-width:360px;background:var(--a);color:#fff;border:none;border-radius:14px;padding:15px;font-size:16px;font-weight:800;cursor:pointer;min-height:52px}
  .obskip{background:none;border:none;color:var(--ink-faint);font:inherit;font-size:14px;cursor:pointer;padding:10px;text-decoration:underline}
  /* confetti */
  #confetti{position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden}
  .confetti-piece{position:absolute;width:9px;height:14px;top:-24px;border-radius:2px}
  @keyframes conffall{to{transform:translateY(112vh) rotate(720deg)}}

  /* screen transitions — namespaced so they cannot collide with the .back BUTTON style */
  .screen.nav-fwd{animation:pushIn .3s cubic-bezier(.2,.7,.3,1)}
  .screen.nav-back{animation:popIn .3s cubic-bezier(.2,.7,.3,1)}
  .screen.nav-fade{animation:fadeIn .28s ease}
  /* ================= native app shell ================= */
  html,body{height:100%;-webkit-text-size-adjust:100%;overscroll-behavior-y:none}
  body{overflow-x:hidden}
  .lectern-root{min-height:100dvh}
  .app{min-height:100dvh;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
  .scroll{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  button,.stop,.subj,.cont,.opt,.tab,.seg,.wk,.bk,.switch{-webkit-tap-highlight-color:transparent}
  .appbar,.tabbar,.tab,.back,.seg,.switch,.node,.badge,.kicker,.prog,.avatar,.grab,.sheetitem,.actionbar{-webkit-user-select:none;user-select:none}
  /* safe areas (needs viewport-fit=cover, which the app sets on mount) */
  .appbar{padding-top:calc(12px + env(safe-area-inset-top))}
  .ob{padding-top:calc(30px + env(safe-area-inset-top))}
  /* tab bar: active pill */
  .tab{transition:color var(--t) var(--ease)}
  .tab .tic{display:flex;align-items:center;justify-content:center;width:46px;height:28px;border-radius:14px;
    transition:background var(--t) var(--ease),transform var(--t) var(--ease)}
  .tab.on .tic{background:var(--a-tint);transform:translateY(-1px)}
  /* interactive swipe-back */
  .screen{will-change:transform}
  .dragging .screen{animation:none!important}
  .snapback .screen{transition:transform var(--t) var(--ease),opacity var(--t) var(--ease)}
  /* sticky action bar inside practice cards */
  .actionbar{position:sticky;bottom:calc(var(--tabh) + env(safe-area-inset-bottom) + 6px);z-index:12;
    display:flex;gap:10px;align-items:center;margin:16px -18px -4px;padding:11px 18px;
    background:linear-gradient(to top,var(--card) 68%,rgba(255,255,255,0))}
  [data-theme="dark"] .actionbar{background:linear-gradient(to top,var(--card) 68%,rgba(0,0,0,0))}
  .actionbar .btn{flex:1;justify-content:center;text-align:center}
  /* bottom sheet */
  .scrim{position:fixed;inset:0;z-index:140;background:rgba(12,14,22,.44);animation:fadeIn .2s ease}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:141;background:var(--card);color:var(--ink);
    border-radius:22px 22px 0 0;padding:10px 18px calc(20px + env(safe-area-inset-bottom));
    box-shadow:0 -12px 40px rgba(20,24,40,.3);max-width:720px;margin:0 auto;
    animation:sheetup .28s cubic-bezier(.2,.8,.3,1)}
  @keyframes sheetup{from{transform:translateY(102%)}to{transform:none}}
  .grab{width:40px;height:5px;border-radius:3px;background:var(--line);margin:2px auto 12px}
  .sheet h2{font-size:19px;margin-bottom:4px}
  .sheet .sheetsub{color:var(--ink-soft);font-size:14.5px;margin-bottom:15px;line-height:1.5}
  .sheetbtns{display:flex;flex-direction:column;gap:10px}
  .sheetbtns .btn{width:100%;justify-content:center;text-align:center}
  .btn.danger{background:var(--no);border-color:var(--no);color:#fff}
  .sheetitem{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:none;border:none;
    border-bottom:1px solid var(--line);padding:13px 2px;font:inherit;font-size:16px;font-weight:750;
    color:var(--ink);cursor:pointer;min-height:58px}
  .sheetitem:last-child{border-bottom:none}
  .sheetitem .si{width:38px;height:38px;border-radius:12px;background:var(--a-tint);display:flex;
    align-items:center;justify-content:center;font-size:19px;flex:0 0 auto}
  .sheetitem:active{transform:scale(.985)}
  /* toast */
  .toastwrap{position:fixed;left:0;right:0;bottom:calc(var(--tabh) + env(safe-area-inset-bottom) + 14px);
    z-index:160;display:flex;justify-content:center;pointer-events:none;padding:0 16px}
  .toast{background:var(--ink);color:var(--paper);border-radius:14px;padding:12px 18px;font-size:14.5px;
    font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.32);max-width:100%;text-align:center;
    animation:toastin .26s cubic-bezier(.2,.8,.3,1)}
  @keyframes toastin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  /* ---- class view: chapters, and the steps inside them ---- */
  .clsbar{display:flex;align-items:center;gap:11px;margin:16px 0 12px}
  .chap{border:1px solid var(--line);border-radius:16px;background:var(--card);margin-top:10px;overflow:hidden}
  .chap.open{border-color:var(--a)}
  .chaphd{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;
    padding:14px;font:inherit;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:64px}
  .chapno{width:34px;height:34px;border-radius:11px;background:var(--a-tint);color:var(--a);flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;font-weight:850;font-size:15px}
  .chapno.done{background:var(--ok);color:#fff}
  .chapmid{flex:1;min-width:0}
  .chapttl{display:block;font-size:15.5px;font-weight:800;line-height:1.35}
  .chapsub{display:block;font-size:12.5px;color:var(--ink-faint);margin-top:2px;font-variant-numeric:tabular-nums}
  .chapchev{color:var(--ink-faint);font-size:19px;flex:0 0 auto}
  .chapsteps{border-top:1px solid var(--line);padding:4px 8px 8px}
  .stprow{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:none;border:none;
    border-radius:12px;padding:11px 8px;font:inherit;color:var(--ink);cursor:pointer;
    -webkit-tap-highlight-color:transparent;min-height:52px}
  .stprow:active{background:var(--card-2)}
  .stprow.done .stpttl{color:var(--ink-soft)}
  .stpic{width:28px;height:28px;border-radius:9px;background:var(--card-2);flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;font-size:14px}
  .stprow.done .stpic{background:var(--ok);color:#fff;font-size:13px}
  .stpmid{flex:1;min-width:0}
  .stpttl{display:block;font-size:14.5px;font-weight:700;line-height:1.4;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .stpkind{display:block;font-size:11.5px;color:var(--ink-faint);margin-top:2px;text-transform:uppercase;letter-spacing:.6px;font-weight:800}
  /* ---- one step, on its own ---- */
  .stephd{margin:6px 0 14px}
  .stepchap{font-size:12.5px;font-weight:850;color:var(--a);text-transform:uppercase;letter-spacing:.7px;margin-bottom:9px}
  .steprow{display:flex;align-items:center;gap:10px;margin-top:14px}
  /* ===================== professional pass =====================
     Line icons on the baseline, a tighter type scale, calmer weights, less
     rounding and softer shadow. Nothing here changes behavior. */
  .ico{display:block;flex:0 0 auto}
  .intro{gap:0}
  .introdots{display:flex;gap:7px;justify-content:center;margin:20px 0 6px}
  .introdots span{width:7px;height:7px;border-radius:50%;background:var(--line);transition:all var(--t) var(--ease)}
  .introdots span.on{background:var(--a);width:20px;border-radius:4px}
  .introbtns{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:14px}
  .introbtns .btn{min-width:220px;justify-content:center;text-align:center}
  /* ---------- motion ----------
     Three durations and two curves, used everywhere. Interfaces feel unfinished
     when every element eases differently; the eye reads the inconsistency even
     when it can't name it. */
  :root{
    --ease:cubic-bezier(.2,.7,.3,1);
    --ease-out:cubic-bezier(.16,1,.3,1);
    --t-fast:.13s;
    --t:.2s;
    --t-slow:.32s;
  }
  .btn,.opt,.subj,.cont,.stop,.chaphd,.stprow,.sheetitem,.noterow,.tab,.seg,.savebtn,.iconbtn,.hintbtn,.palitem{
    transition:transform var(--t-fast) var(--ease),background var(--t) var(--ease),
      border-color var(--t) var(--ease),color var(--t) var(--ease),box-shadow var(--t) var(--ease)}
  .btn:active,.opt:active,.subj:active,.cont:active,.stop:active,.chaphd:active,
  .stprow:active,.sheetitem:active,.noterow:active,.savebtn:active,.iconbtn:active,.hintbtn:active{transform:scale(.977)}
  .btn:disabled:active{transform:none}
  .progbar i,.pbar i,.sbtrack i{transition:width var(--t-slow) var(--ease)}
  .screen.nav-fwd{animation:pushIn var(--t-slow) var(--ease-out)}
  .screen.nav-back{animation:popIn var(--t-slow) var(--ease-out)}
  .screen.nav-fade{animation:fadeIn var(--t) ease}
  /* content settles in rather than snapping */
  .card,.cont,.subj{animation:riseIn var(--t) var(--ease-out) both}
  @keyframes riseIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  /* every tappable thing is reachable with a thumb */
  .btn,.opt,.tab,.seg,.chaphd,.stprow,.sheetitem,.noterow,.hintbtn,.linkbtn{min-height:44px}
  .savebtn,.iconbtn,.searchclear,.hearbtn{min-width:36px;min-height:36px}
  @media (prefers-reduced-motion:reduce){
    .card,.cont,.subj{animation:none}
  }
  .aboutrows{margin:2px 0 4px}
  .aboutrow{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:8px 0;
    border-bottom:1px solid var(--line);font-size:13.5px}
  .aboutrow:last-child{border-bottom:none}
  .aboutrow span{color:var(--ink-faint)}
  .aboutrow b{font-weight:640;text-align:right}
  .tic{position:relative}
  .tbadge{position:absolute;top:-5px;left:calc(50% + 5px);min-width:16px;height:16px;padding:0 4px;
    border-radius:8px;background:var(--no);color:#fff;font-size:10px;font-weight:750;line-height:16px;
    text-align:center;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px var(--card)}
  .tiwrap{display:flex;flex-direction:column;justify-content:center;min-width:0;line-height:1.15}
  .tiwhere{font-size:11.5px;color:var(--ink-faint);font-weight:600;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;max-width:46vw}
  .stepchaprow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .savebtn{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);
    color:var(--ink-faint);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;
    -webkit-tap-highlight-color:transparent}
  .savebtn.on{background:var(--a-tint);border-color:var(--a);color:var(--a)}
  .savebtn:active{transform:scale(.93)}
  .chart{margin:6px 0 10px}
  .chart svg{display:block;overflow:visible}
  .chartx{display:flex;margin-top:5px}
  .chartx span{flex:1;text-align:center;font-size:10px;color:var(--ink-faint);font-weight:640}
  .chartx span.on{color:var(--a);font-weight:750}
  .donut{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1}
  .donuttext{font-size:17px;font-weight:680;fill:var(--ink);font-variant-numeric:tabular-nums}
  .donutcap{font-size:11.5px;color:var(--ink-faint);text-align:center;line-height:1.35;max-width:120px}
  .reccols{display:flex;gap:14px;margin:4px 0 14px}
  .subjchart{display:flex;flex-direction:column;gap:9px}
  .sbrow{display:flex;align-items:center;gap:10px}
  .sbname{flex:0 0 40%;font-size:13.5px;font-weight:640;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sbtrack{flex:1;height:8px;border-radius:5px;background:var(--line);overflow:hidden}
  .sbtrack i{display:block;height:100%;border-radius:5px}
  .sbpct{flex:0 0 34px;text-align:right;font-size:12px;color:var(--ink-faint);font-variant-numeric:tabular-nums}
  .summary .sumrow{display:flex;gap:10px;margin:2px 0 12px}
  .sumstat{flex:1;background:var(--card-2);border-radius:12px;padding:12px 8px;text-align:center}
  .sumbig{font-size:22px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .sumlab{font-size:11.5px;color:var(--ink-faint);margin-top:2px}
  .summiss{margin:10px 0 0;padding-left:18px}
  .summiss li{font-size:13.5px;line-height:1.55;color:var(--ink-soft);margin-bottom:4px}
  .nextup{margin-bottom:18px}
  .cont.rec{align-items:flex-start;padding-top:14px;padding-bottom:14px}
  .cont.rec.lead{border-color:var(--a)}
  .recmid{flex:1;min-width:0}
  .recwhy{font-size:12.5px;line-height:1.5;color:var(--ink-faint);margin-top:4px}
  .clsest{font-size:12.5px;color:var(--ink-faint);text-align:center;margin:-2px 0 16px;font-variant-numeric:tabular-nums}
  /* app-bar icon button */
  .rt{display:flex;align-items:center;gap:8px}
  .iconbtn{width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--card);
    color:var(--ink-soft);display:flex;align-items:center;justify-content:center;cursor:pointer;
    -webkit-tap-highlight-color:transparent}
  .iconbtn:active{transform:scale(.94)}
  /* offline notice */
  .offbar{background:#fff6e5;color:#7a5210;border-bottom:1px solid #f3d08a;font-size:12.5px;font-weight:640;
    padding:8px 16px;text-align:center}
  [data-theme="dark"] .offbar{background:#3a2f14;color:#f2d79a;border-bottom-color:#6b5520}
  /* crash card */
  .crash{padding:18px}
  .crashdet{margin-top:12px;background:var(--card-2);border-radius:10px;padding:10px 12px;
    font-size:12px;overflow-x:auto;color:var(--ink-soft)}
  .crashdet code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  /* command palette */
  .palette{position:fixed;left:50%;top:8vh;transform:translateX(-50%);z-index:170;width:min(620px,92vw);
    background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;
    box-shadow:0 24px 60px rgba(15,20,40,.28);animation:palin .16s ease-out}
  @keyframes palin{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%)}}
  .palrow{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);color:var(--ink-faint)}
  .palinput{flex:1;border:none;background:none;font:inherit;font-size:16px;color:var(--ink);outline:none}
  .kbd{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line);
    border-radius:6px;padding:2px 6px;color:var(--ink-faint)}
  .pallist{max-height:56vh;overflow-y:auto;padding:6px}
  .palgroup{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);
    padding:10px 10px 5px}
  .palitem{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:none;border:none;
    padding:9px 10px;border-radius:9px;font:inherit;font-size:14.5px;color:var(--ink);cursor:pointer}
  .palitem.on{background:var(--a-tint);color:var(--a)}
  .palic{width:22px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:15px}
  .pallabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .palsub{color:var(--ink-faint)}
  .palempty{padding:18px 12px;color:var(--ink-soft);font-size:14px;text-align:center}
  .hearbtn,.hintbtn{display:inline-flex;align-items:center;gap:7px}
  .seticon,.si{display:flex;align-items:center;justify-content:center;color:var(--a)}
  .mk .ico,.obmk .ico,.tic .ico{display:block}
  /* type scale: fewer sizes, and headings that stop shouting */
  h1{letter-spacing:-.021em;font-weight:680}
  .shead h1{letter-spacing:-.018em}
  .sub{font-size:14.5px;line-height:1.6;color:var(--ink-soft)}
  .kicker{font-size:11px;font-weight:700;letter-spacing:.075em;text-transform:uppercase;
    background:none;color:var(--ink-faint);padding:0;border-radius:0;margin-bottom:10px;display:block}
  .lesson p{font-size:16.5px;line-height:1.72;color:var(--ink)}
  .ask{font-weight:640;letter-spacing:-.012em}
  /* weights: 800s everywhere reads as shouting; 600–680 reads as considered */
  .btn,.opt,.seg,.tab,.settitle,.cl,.nm,.st,.pn,.notettl,.sheetitem{font-weight:640}
  .btn.go{font-weight:680}
  .badge,.chip{font-weight:700;letter-spacing:.04em}
  /* geometry: slightly squarer, and shadows that suggest depth rather than announce it */
  .card,.cont,.subj,.stop,.famrow,.sheet{border-radius:14px}
  .btn,.opt,.ans,.obinput,.searchbox,.seg{border-radius:10px}
  .card{box-shadow:0 1px 2px rgba(20,24,40,.05),0 1px 1px rgba(20,24,40,.03)}
  .cont,.subj{box-shadow:0 1px 2px rgba(20,24,40,.05)}
  [data-theme="dark"] .card,[data-theme="dark"] .cont,[data-theme="dark"] .subj{box-shadow:none;border:1px solid var(--line)}
  /* the app bar: a hairline instead of a heavy edge */
  .appbar{border-bottom:1px solid var(--line);box-shadow:none}
  .mk{background:var(--a-tint);color:var(--a);display:flex;align-items:center;justify-content:center}
  .ti{font-weight:680;letter-spacing:-.01em}
  /* tab bar: icons carry it, labels stay quiet */
  .tabbar{border-top:1px solid var(--line)}
  .tab{font-size:10.5px;letter-spacing:.01em;color:var(--ink-faint);gap:3px}
  .tab.on{color:var(--a)}
  .tab .tic{opacity:1;width:auto;height:auto;background:none;transform:none}
  .tab.on .tic{background:none;transform:none}
  /* the sign-in mark: a quiet monogram, not a gradient badge */
  .obmk{background:var(--a-tint);color:var(--a);box-shadow:none;border-radius:22px;
    width:76px;height:76px}
  .splashmk{border-radius:22px}
  /* a caution, not an error: something to read before acting, not a failure */
  .warnnote{background:#fff6e5;border:1px solid #f3d08a;color:#7a5210;border-radius:12px;
    padding:11px 13px;font-size:13.5px;line-height:1.55;font-weight:600;margin-bottom:12px}
  [data-theme="dark"] .warnnote{background:#3a2f14;border-color:#6b5520;color:#f2d79a}
  /* install card hides itself once running as an installed app */
  @media all and (display-mode:standalone){.installcard{display:none}}
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }

  /* focus handling: screens take focus on navigation but shouldn't show a ring;
     every real control keeps a clearly visible one */
  .screen:focus{outline:none}
  .screen:focus-visible{outline:none}
  button:focus-visible,input:focus-visible,textarea:focus-visible,[role="switch"]:focus-visible{
    outline:3px solid var(--a);outline-offset:2px;border-radius:12px}
  /* toast with an action (undo) */
  .toast{display:flex;align-items:center;gap:14px}
  .toastact{pointer-events:auto;background:none;border:none;color:var(--paper);font:inherit;font-size:14px;
    font-weight:850;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:2px 0;flex:0 0 auto;
    -webkit-tap-highlight-color:transparent}
  .toastwrap{pointer-events:none}
  /* trouble spots */
  .weakrow{padding:11px 0;border-bottom:1px solid var(--line)}
  .weakrow:last-child{border-bottom:none}
  .weakq{font-size:15px;font-weight:700;line-height:1.45}
  .weakn{font-size:12.5px;color:var(--ink-faint);margin-top:3px;font-variant-numeric:tabular-nums}
  /* saved notes list */
  .noterow{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;
    border-bottom:1px solid var(--line);padding:12px 2px;font:inherit;color:var(--ink);cursor:pointer;
    -webkit-tap-highlight-color:transparent}
  .noterow:last-child{border-bottom:none}
  .noteic{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;
    font-size:19px;flex:0 0 auto}
  .notemid{display:block;flex:1;min-width:0}
  .notettl{display:block;font-size:15px;font-weight:800}
  .notetxt{display:block;font-size:13px;color:var(--ink-soft);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  /* search on the Learn tab */
  .searchrow{position:relative;margin:14px 0 4px}
  .searchic{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;opacity:.75;pointer-events:none}
  .searchbox{width:100%;font-size:16px;padding:13px 42px;border-radius:14px;border:2px solid var(--line);
    background:var(--card);color:var(--ink);font-family:inherit;-webkit-appearance:none;appearance:none}
  .searchbox:focus{outline:none;border-color:var(--a)}
  .searchbox::-webkit-search-cancel-button{display:none}
  .searchclear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;
    border-radius:10px;border:none;background:var(--card-2);color:var(--ink-soft);font-size:13px;cursor:pointer;
    -webkit-tap-highlight-color:transparent}
  /* "you left off here" notice */
  .resumed{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px;font-weight:700;
    color:var(--ink-soft);background:var(--card-2);border-radius:12px;padding:9px 12px;margin-bottom:12px}
  .resumed .linkbtn{font-size:13.5px}
  /* larger text */
  [data-text="large"] .lesson p{font-size:18.5px;line-height:1.85}
  [data-text="large"] .ask{font-size:22px}
  [data-text="large"] .opt{font-size:17.5px}
  [data-text="large"] .ans{font-size:19px}
  [data-text="large"] .fb{font-size:16px}
  [data-text="large"] .sub{font-size:16px}
  [data-text="large"] .prog{font-size:14px}
  /* practice progress bar */
  .progwrap{display:flex;align-items:center;gap:11px;margin-bottom:12px}
  .progbar{flex:1;height:7px;border-radius:4px;background:var(--line);overflow:hidden}
  .progbar i{display:block;height:100%;border-radius:4px;background:var(--a);
    transition:width var(--t-slow) var(--ease)}
  .progwrap .prog{margin:0;white-space:nowrap;font-variant-numeric:tabular-nums}
  /* password field with a Show/Hide control */
  .pwwrap{position:relative;width:100%;max-width:360px;margin:0 auto}
  .pwwrap .obinput{max-width:none;padding-left:64px;padding-right:64px}
  .pweye{position:absolute;top:50%;right:8px;transform:translateY(-50%);height:38px;padding:0 12px;
    border-radius:11px;border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);
    font:inherit;font-size:13px;font-weight:800;letter-spacing:.2px;cursor:pointer;
    -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;
    display:flex;align-items:center;justify-content:center;min-width:52px}
  .pweye:active{transform:translateY(-50%) scale(.94)}
  .pweye[aria-pressed="true"]{background:var(--a-tint);border-color:var(--a);color:var(--a)}
`;

/* ---------------- storage (per-account) ---------------- */
const MEM = {};
function jget(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return (k in MEM) ? MEM[k] : d; } }
function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { MEM[k] = v; } }
const AKEY = "lectern.auth.v1", SKEY = "lectern.settings.v3", TKEY = "lectern.topics.v2";

/* Lectern used to accept a personal Anthropic key. It no longer does — AI runs
   through the shared server, so there is nothing to type. Any key saved by an
   older version is REMOVED here rather than left sitting in localStorage: a
   secret the app can no longer use should not keep existing on the device, and
   it would otherwise ride along in every cloud backup for no reason. */
(function dropStoredApiKey() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return;
    const raw = localStorage.getItem(SKEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && (("aiKey" in o) || ("aiModel" in o))) {
      delete o.aiKey; delete o.aiModel;
      localStorage.setItem(SKEY, JSON.stringify(o));
    }
  } catch (e) {}
})();

/* ---------------------------------------------------------------------------
   THE HUB

   Lectern is the front door. Two kinds of door:

   - INTERNAL (`internal: true`) — same deploy, one route away. Study It ships
     in this same repo, so it is reached by changing the route, not by leaving
     the site. Rendered as a <button>, because it isn't a link anywhere.
   - EXTERNAL (`url`) — a separate deploy. Rendered as a real <a> with
     target="_blank", so long-press, middle-click and cmd-click all work.

   A door is only shown if it can actually go somewhere: an external door needs
   an https url, and an internal door needs a handler wired up. A door that
   looks tappable and goes nowhere is a lie, so it is dropped instead.

   To add another app later: add an entry here. Nothing else needs editing.
   --------------------------------------------------------------------------- */
const APPS = [
  {
    id: "studyit",
    name: "Study It",
    kicker: "Study",
    blurb: "Notebooks, an AI tutor, flashcards and quizzes on spaced repetition.",
    icon: "📖",
    accent: "#2f6ff0", tint: "#dfeaff",
    internal: true,
  },
  {
    id: "mathema",
    name: "Mathema",
    kicker: "Practice",
    blurb: "Math from counting to calculus — every answer checked, never just marked.",
    icon: "\u2211",
    accent: "#c0293f", tint: "#ffe0e4",
    internal: true,
  },
  {
    id: "elements",
    name: "Elements",
    kicker: "Investigate",
    blurb: "Physics and chemistry — answers checked as quantities, so any correct unit passes.",
    icon: "\u269b",
    accent: "#0f766e", tint: "#d6f0ec",
    internal: true,
  },
  {
    id: "codequest",
    name: "CodeQuest",
    kicker: "Build",
    blurb: "Learn to code by writing it — real engines run and grade your code.",
    icon: "💻",
    accent: "#0ca678", tint: "#d8f5ec",
    url: "https://code-quest-tau-puce.vercel.app",
  },
];
// Doors that can actually go somewhere. `handlers` maps a door id to the
// function that opens it; an internal door with no handler is dropped.
function openDoors(handlers) {
  const h = handlers || {};
  return APPS.filter(function (a) {
    if (a.internal) return typeof h[a.id] === "function";
    return typeof a.url === "string" && a.url.indexOf("https://") === 0;
  });
}
/* ===========================================================================
   CLOUD SYNC

   Lectern keeps working exactly as it did with no account and no network: every
   store below is still written to localStorage first, and that is still the
   source of truth on the device. Cloud sync is ADDITIVE and OPTIONAL — signing
   in adds a copy in Supabase so progress follows you to another device.

   It uses the SAME Supabase project as Study It and CodeQuest, so one email and
   password signs you in to all three. Lectern's own on-device profiles (the
   name-and-password list on the welcome screen) are untouched and still work
   offline; a cloud account is a separate, optional thing layered on top.

   The client is imported from esm.sh at the moment it's first needed, matching
   how App.jsx in this same repo does it. That means no package.json change and
   nothing extra in the bundle for anyone who never signs in.

   The anon key is meant to be public — Row Level Security is what protects the
   data, and the policy on lectern_state scopes every row to its owner. The
   service_role key must never appear in front-end code.
   =========================================================================== */
const SB_URL = "https://nfbzmxuruxqgbeeypsoq.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpteHVydXhxZ2JlZXlwc29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ0MTUsImV4cCI6MjA5NTU3MDQxNX0.NqQKeIO3pYOk5rbG4YtJApz1lnss_OZvhWuVkIY79-U";
const CLOUD_TABLE = "lectern_state";

let _sbPromise = null;
// Resolves to a Supabase client, or null if the module can't be fetched (no
// network, blocked CDN). Null is returned rather than thrown so every caller
// degrades to local-only instead of the app breaking.
function getSupabase() {
  if (_sbPromise) return _sbPromise;
  _sbPromise = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ "https://esm.sh/@supabase/supabase-js@2");
      return mod.createClient(SB_URL, SB_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "lectern.sb.auth" },
      });
    } catch (e) { return null; }
  })();
  return _sbPromise;
}

const pkey = id => "lectern.progress.v3." + (id || "none");
const lkey = id => "lectern.last.v3." + (id || "none");
const skey = id => "lectern.srs.v1." + (id || "none");
const dkey = id => "lectern.deck.v1." + (id || "none");
const nkey = id => "lectern.notes.v1." + (id || "none");
const xkey = id => "lectern.added.v1." + (id || "none");
const akey = id => "lectern.activity.v1." + (id || "none");
const mkey = id => "lectern.saved.v1." + (id || "none");
const dayStamp = d => { const x = d || new Date(); const m = x.getMonth() + 1, day = x.getDate(); return x.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day; };
const tkey = id => "lectern.steps.v1." + (id || "none");

/* THE ONE LIST OF WHAT SYNCS.

   Every per-account store is named here once. Reset, Backup and now Cloud sync
   all read from this list, so a store added later can't be silently left out of
   one of them — the store-audit test enumerates this list from source and fails
   if a `lectern.` key exists that isn't in it. */
const CLOUD_STORES = [
  { field: "progress", key: pkey, empty: {} },
  { field: "schedule", key: skey, empty: {} },
  { field: "last", key: lkey, empty: null },
  { field: "notes", key: nkey, empty: {} },
  { field: "added", key: xkey, empty: {} },
  { field: "steps", key: tkey, empty: {} },
  { field: "deck", key: dkey, empty: {} },
  { field: "activity", key: akey, empty: {} },
  { field: "saved", key: mkey, empty: {} },
];

/* WHAT LEAVES THE DEVICE.

   Everything a learner would be upset to lose, and nothing they'd be upset to
   have stored:

   - the seven per-account stores above (progress, schedule, last opened, notes,
     generated lessons, finished steps, flashcard decks)
   - settings, which INCLUDES the AI API key and model — so a key entered on one
     device is there on the next. See the warning below.
   - topics
   - the profile itself: display name, per-subject levels, and the "about me"
     text, so a new device shows your name rather than a blank profile.

   ⚠️ THE AI KEY. It rides along inside `settings`, in plain text in the
   `lectern_state.data` column. Row Level Security means only that account can
   read the row, and the key never appears in a URL or in any log — but it is
   readable by anyone who can get into the Supabase project, which is Kabir.
   That is the honest trade for "type your key once, not on every device". The
   Cloud sync panel says so plainly rather than leaving it to be discovered.

   ⚠️ WHAT DOES NOT SYNC: the local profile's password `hash`. Deliberate. It's
   a djb2 hash from hashPw() — a device-level lock to stop a sibling opening
   your profile, not a real credential — and putting weak password hashes in a
   database is how they end up cracked. The cloud account has its own proper
   Supabase password; the on-device lock stays on the device. A restored profile
   arrives unlocked on the new device, which is the same access the cloud
   password already granted. */
const ACCOUNT_FIELDS = ["name", "levels", "profile"];

// Gather one local profile's stores into the shape that goes to the server.
function collectLocal(uid) {
  const out = {};
  for (const st of CLOUD_STORES) out[st.field] = jget(st.key(uid), st.empty);
  out.settings = jget(SKEY, {});
  out.topics = jget(TKEY, []);
  const a = jget(AKEY, { users: [], current: null });
  const u = (a.users || []).find(x => x.id === uid);
  if (u) {
    out.account = {};
    for (const f of ACCOUNT_FIELDS) if (f in u) out.account[f] = u[f];
  }
  return out;
}

// Write a downloaded snapshot back over one local profile.
function applyLocal(uid, data) {
  if (!data) return;
  for (const st of CLOUD_STORES) {
    if (st.field in data) jset(st.key(uid), data[st.field]);
  }
  if (data.settings) jset(SKEY, data.settings);
  if (data.topics) jset(TKEY, data.topics);
  if (data.account) {
    const a = jget(AKEY, { users: [], current: null });
    let touched = false;
    a.users = (a.users || []).map(u => {
      if (u.id !== uid) return u;
      touched = true;
      const next = { ...u };
      // Only the named fields are copied. `hash` and `guest` stay exactly as
      // they are on this device — a downloaded snapshot can never unlock or
      // lock a local profile.
      for (const f of ACCOUNT_FIELDS) if (f in data.account) next[f] = data.account[f];
      return next;
    });
    if (touched) jset(AKEY, a);
  }
}

// Is there anything here worth protecting? Used to decide whether a first sync
// can proceed silently or has to ask. Deliberately conservative: a single
// finished step counts as "has data".
function hasData(d) {
  if (!d) return false;
  const big = k => d[k] && typeof d[k] === "object" && Object.keys(d[k]).length > 0;
  return !!(big("progress") || big("steps") || big("notes") || big("added") ||
            big("deck") || big("schedule") || big("activity") || big("saved") || d.last);
}

// Compare two snapshots on the parts that represent real work.
function sameData(a, b) {
  try {
    const pick = d => JSON.stringify(CLOUD_STORES.map(st => (d && d[st.field]) || st.empty));
    return pick(a) === pick(b);
  } catch (e) { return false; }
}

async function cloudLoad(sb, userId) {
  const { data, error } = await sb.from(CLOUD_TABLE).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data && data.data ? data.data : null;
}

async function cloudSave(sb, userId, snapshot) {
  const { error } = await sb.from(CLOUD_TABLE)
    .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() },
            { onConflict: "user_id" });
  if (error) throw error;
}
/* The app used to be called Bright Academy. Anyone who used it then keeps their
   accounts, progress and topics: copy the old keys across once, and leave the
   originals alone so nothing is destroyed if this runs somewhere unexpected. */
function migrateLegacyKeys() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return;
    const OLD = "brightAcademy.", NEW = "lectern.";
    const copy = k => {
      const dest = NEW + k.slice(OLD.length);
      try {
        if (localStorage.getItem(dest) !== null) return;
        const v = localStorage.getItem(k);
        if (v !== null) localStorage.setItem(dest, v);
      } catch (e) {}
    };
    // 1. the fixed, account-independent keys
    const base = [OLD + "auth.v1", OLD + "settings.v3", OLD + "topics.v2"];
    base.forEach(copy);
    // 2. the per-account keys, derived from whichever account list we now have
    const ids = ["none", "guest"];
    try {
      const raw = localStorage.getItem(NEW + "auth.v1") || localStorage.getItem(OLD + "auth.v1");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.users)) parsed.users.forEach(u => { if (u && u.id && ids.indexOf(u.id) < 0) ids.push(u.id); });
    } catch (e) {}
    ids.forEach(id => { copy(OLD + "progress.v3." + id); copy(OLD + "last.v3." + id); copy(OLD + "srs.v1." + id); });
    // 3. belt and braces: if this storage supports enumeration, sweep anything left
    try {
      if (typeof localStorage.length === "number" && typeof localStorage.key === "function") {
        const rest = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(OLD) === 0) rest.push(k); }
        rest.forEach(copy);
      }
    } catch (e) {}
  } catch (e) {}
}
migrateLegacyKeys();

/* ---------------- audio + haptics + speech ---------------- */
const PREFS = { sound: true, haptics: true };
let _ac = null;
function actx() { if (typeof window === "undefined") return null; if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _ac = null; } } return _ac; }
// One soft note. Fades in and out rather than clicking on and off.
function tone(freq, seconds, delay) {
  const ctx = actx();
  if (!ctx) return;
  const length = seconds || 0.5;
  const at = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}
function playMidi(m, d, w) { tone(A.MUSIC.freq(m), d || 0.55, w || 0); }
function haptic(p) { if (PREFS.haptics && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
function sfxCorrect() { haptic(14); if (!PREFS.sound) return; tone(A.MUSIC.freq(72), 0.13, 0); tone(A.MUSIC.freq(76), 0.16, 0.12); tone(A.MUSIC.freq(79), 0.22, 0.24); }
function sfxWrong() { haptic([11, 55, 11]); if (!PREFS.sound) return; tone(A.MUSIC.freq(58), 0.16, 0); tone(A.MUSIC.freq(54), 0.22, 0.14); }
function sfxDone() { haptic([16, 40, 16, 40, 60]); if (!PREFS.sound) return; [72, 76, 79, 84].forEach((m, i) => tone(A.MUSIC.freq(m), 0.3, i * 0.13)); }
function speak(text, lang) {
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = lang || "en-US";
    utterance.rate = 0.85;                       // a shade slower, for learners
    // prefer a voice that actually speaks the language, not the system default
    const voices = window.speechSynthesis.getVoices() || [];
    const wanted = (lang || "").slice(0, 2).toLowerCase();
    const match = voices.filter(v => v.lang && v.lang.toLowerCase().indexOf(wanted) === 0)[0];
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

/* ---------------- native shell: viewport, icon, manifest ---------------- */
/* Lectern's mark: an open book on a deep-ink tile.

   Drawn to survive a browser tab. At 16px it measures ~26% ink and — the bit
   that actually matters — the gutter between the two pages stays open, so it
   still reads as a book rather than a white blob. The fine rules dissolve
   cleanly at small sizes instead of smearing into gray.

   Three layers of paper, deliberately: a plain white block underneath, crisp
   rules along its bottom edge where the sheets stack, leaves fanned along the
   top edge, then the shaded top sheet over everything. Thickness reads from
   both directions. The mark this replaced used thin strokes and two
   near-transparent bars; measured at 16px it came out at half this ink and the
   stem fell below one pixel.

   Two variants, because they do different jobs:
   - APP_ICON has rounded corners, for the favicon and the iOS home screen,
     where nothing crops it.
   - APP_ICON_MASKABLE is full bleed with no corner radius and the artwork
     scaled to 76%, because Android applies its OWN mask. Declaring a rounded
     icon as maskable — which this file used to do — means Android rounds the
     already-rounded corners and clips them. At 76% the whole drawing sits
     inside the maskable safe circle. */
const ICON_DEFS =
  '<defs>' +
  '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#252a3d"/><stop offset="1" stop-color="#12141d"/></linearGradient>' +
  '<linearGradient id="cov" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e05262"/><stop offset=".5" stop-color="#c0293f"/><stop offset="1" stop-color="#8c1628"/></linearGradient>' +
  '<linearGradient id="pgl" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#c8ccdd"/><stop offset=".16" stop-color="#f4f5fa"/><stop offset="1" stop-color="#ffffff"/></linearGradient>' +
  '<linearGradient id="pgr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c8ccdd"/><stop offset=".16" stop-color="#f4f5fa"/><stop offset="1" stop-color="#ffffff"/></linearGradient>' +
  '</defs>';
const ICON_ART =
  '<path d="M256 148c-50-34-116-50-188-48-15 0-27 12-27 26v218c0 14 12 26 27 26 72-2 138 14 188 48 50-34 116-50 188-48 15 0 27-12 27-26V124c0-14-12-26-27-26-72-2-138 14-188 48Z" fill="url(#cov)"/>' +
  '<path d="M222 182c-42-28-98-42-152-40v182c54-2 110 12 152 40Z" fill="#ffffff"/>' +
  '<path d="M290 182c42-28 98-42 152-40v182c-54-2-110 12-152 40Z" fill="#ffffff"/>' +
  '<g stroke="#9aa0bd" stroke-width="5" fill="none" stroke-linecap="round">' +
  '<path d="M70 324c54-2 110 12 152 40"/><path d="M74 312c53-2 108 12 149 39"/>' +
  '<path d="M442 324c-54-2-110 12-152 40"/><path d="M438 312c-53-2-108 12-149 39"/></g>' +
  '<g stroke="#aab0c9" stroke-width="4.5" fill="none" stroke-linecap="round">' +
  '<path d="M80 146c50 2 98 14 138 36"/><path d="M80 164c50 2 98 14 138 36"/>' +
  '<path d="M432 146c-50 2-98 14-138 36"/><path d="M432 164c-50 2-98 14-138 36"/></g>' +
  '<path d="M226 166c-40-27-94-40-146-38v184c52-2 106 12 146 38Z" fill="url(#pgl)"/>' +
  '<path d="M286 166c40-27 94-40 146-38v184c-52-2-106 12-146 38Z" fill="url(#pgr)"/>' +
  '<path d="M248 344h16v84l-8-22-8 22Z" fill="#e64980"/>';
const ICON_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">';
/* Served as real files from /public rather than inlined as data: URIs.
   Safari's support for a data: URI SVG favicon is unreliable — it will happily
   accept the <link> and then paint nothing, which is precisely the "favicon
   doesn't work" symptom. A real path is also cacheable and you can open it in a
   tab to check it rendered. The two SVGs must exist in the repo's public/
   folder; if they are missing the tab simply keeps whatever index.html set,
   rather than showing a broken image. */
const APP_ICON = "/lectern-icon.svg";
const APP_ICON_MASKABLE = "/lectern-icon-maskable.svg";

/* Study It's mark.

   The repo already ships one — index.html has a <link rel="icon"> pointing at
   favicon.svg — so the right icon for the Study It route is that file, not
   something invented here. Rather than hardcode a path that could be renamed
   out from under this file, the href sitting in the document at boot is
   captured BEFORE anything touches it.

   This has to be read at module load: installShell() and the router both
   rewrite that link, so by the time a component renders the original is gone.
   If index.html ever ships without an icon, the fallback is a bookmark in Study
   It's own editorial palette (App.jsx PALETTE_DARK — paper #1A1D22, gold
   #C9A56B), a different shape from Lectern's so the two can't be confused. */
const STUDY_ICON_FALLBACK = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" rx="116" fill="#1A1D22"/>' +
  '<path d="M146 72h220a30 30 0 0 1 30 30v338l-140-96-140 96V102a30 30 0 0 1 30-30Z" fill="#C9A56B"/></svg>');
/* Mathema's mark: rotating squares with a logarithmic spiral, served as a real
   file from public/ like Lectern's.

   Measured at tab size it comes out around 40% ink, so it is unmistakably
   THERE — but the fine spiral detail does collapse at 16px and it reads as a
   shape and a color rather than a diagram. That is the honest trade for this
   design, and it is the right one: a favicon's job at that size is to be
   distinguishable from its neighbors, which a dark tile with a pink-and-teal
   mass is, from a book and from a gold bookmark. */
const MATH_ICON = "/mathema-icon.png";

/* Elements' mark: an atom on the same deep-ink tile, in the app's own teal so
   it is distinguishable from a book, a bookmark and a spiral at tab size.
   Inlined rather than served as a file because it is three ellipses and a dot
   — small enough that a round trip to fetch it would cost more than it saves. */
const SCIENCE_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  /* Contrast, measured rather than eyeballed:
       rings #5eead4 on #04141a  = 12.7:1   (was 9.9:1 on the old darker teal)
     The nucleus is a DARK disc, not a bright one. A white or amber center
     measured 1.5:1 and 1.1:1 against the rings it sits on — it would have
     melted into them at tab size however bright it looked at 512px. Punching
     a hole in the ring crossings instead gives 12.7:1 exactly where the eye
     needs it, and the small teal core inside reads as the nucleus. */
  '<rect width="512" height="512" rx="116" fill="#04141a"/>' +
  // Stroke width 50, not 26: at 26 the rings measured 3.3% ink at 16px and the
  // whole mark read as an empty tile — the same near-blank failure the first
  // Lectern icon had. At 50 it measures 43% and is plainly an atom in a tab.
  '<g fill="none" stroke="#5eead4" stroke-width="50">' +
  '<ellipse cx="256" cy="256" rx="180" ry="76"/>' +
  '<ellipse cx="256" cy="256" rx="180" ry="76" transform="rotate(60 256 256)"/>' +
  '<ellipse cx="256" cy="256" rx="180" ry="76" transform="rotate(120 256 256)"/></g>' +
  '<circle cx="256" cy="256" r="86" fill="#04141a"/>' +
  '<circle cx="256" cy="256" r="46" fill="#5eead4"/></svg>');

const STUDY_ICON = (() => {
  try {
    if (typeof document === "undefined") return STUDY_ICON_FALLBACK;
    const l = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    const href = l && l.getAttribute("href");
    return href ? href : STUDY_ICON_FALLBACK;
  } catch (e) { return STUDY_ICON_FALLBACK; }
})();

/* Point the tab icon at one of the two marks.

   The href is NOT mutated in place. Browsers differ on whether changing the
   href of an existing <link rel="icon"> makes them repaint the tab, and Safari
   is the least willing of them. Removing every icon link and appending a fresh
   node is the version that works in the most places.

   It also find-or-CREATES, which matters: installShell() bails if an icon link
   already exists — and index.html ships one — so Lectern's own icon would never
   have been installed. And installShell() only runs inside the Lectern app, so
   opening /#/study cold never reaches it at all. */
function setFavicon(href) {
  try {
    if (typeof document === "undefined") return;
    const head = document.head;
    if (!head) return;
    const links = head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    // Already showing this exact icon and nothing stale alongside it: leave it
    // alone. Re-appending on every render would make the tab flicker.
    if (links.length === 1 && links[0].getAttribute("href") === href) return;
    for (let i = 0; i < links.length; i++) {
      try { links[i].parentNode.removeChild(links[i]); } catch (e) {}
    }
    const l = document.createElement("link");
    l.setAttribute("rel", "icon");
    // A data-URI mark is SVG; a repo file might be .svg, .png or .ico, so the
    // type attribute is only asserted when it's actually known to be right.
    if (href.indexOf("data:image/svg+xml") === 0 || /\.svg(\?|$)/i.test(href)) {
      l.setAttribute("type", "image/svg+xml");
    }
    l.setAttribute("href", href);
    head.appendChild(l);
  } catch (e) {}
}
/* Every step here is decoration: it makes the app installable and lets it use the
   full screen. In a sandboxed preview these calls can be refused outright, so no
   single failure is ever allowed to stop the app from rendering. */
function installShell() {
  const safe = fn => { try { fn(); } catch (e) {} };
  let head = null;
  safe(() => { if (typeof document !== "undefined") head = document.head || null; });
  if (!head) return;
  const has = sel => { try { return !!head.querySelector(sel); } catch (e) { return true; } };
  safe(() => {
    let vp = head.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement("meta"); vp.setAttribute("name", "viewport"); vp.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover"); head.appendChild(vp); }
    else if (String(vp.getAttribute("content") || "").indexOf("viewport-fit") < 0) { vp.setAttribute("content", vp.getAttribute("content") + ", viewport-fit=cover"); }
  });
  const meta = (name, content) => safe(() => {
    if (has('meta[name="' + name + '"]')) return;
    const m = document.createElement("meta"); m.setAttribute("name", name); m.setAttribute("content", content); head.appendChild(m);
  });
  meta("theme-color", "#f4f6fc");
  meta("apple-mobile-web-app-capable", "yes");
  meta("mobile-web-app-capable", "yes");
  meta("apple-mobile-web-app-status-bar-style", "default");
  meta("apple-mobile-web-app-title", "Lectern");
  const link = (rel, href, type) => safe(() => {
    if (has('link[rel="' + rel + '"]')) return;
    const l = document.createElement("link"); l.setAttribute("rel", rel); l.setAttribute("href", href); if (type) l.setAttribute("type", type); head.appendChild(l);
  });
  link("icon", APP_ICON, "image/svg+xml");
  link("apple-touch-icon", APP_ICON);
  safe(() => {
    const man = { name: "Lectern", short_name: "Lectern", start_url: ".", scope: ".", display: "standalone", orientation: "portrait", background_color: "#f4f6fc", theme_color: "#6d5cf5", icons: [{ src: APP_ICON, sizes: "512x512", type: "image/svg+xml", purpose: "any" }, { src: APP_ICON_MASKABLE, sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }] };
    link("manifest", "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(man)));
  });
  safe(() => { if (!document.title) document.title = "Lectern"; });
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  try { if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) {}
  return !!(window.navigator && window.navigator.standalone);
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "");
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

/* ---------------- avatar ---------------- */
const AVA = ["#6d5cf5", "#e64980", "#0ca678", "#2f6ff0", "#f08c00", "#e8590c", "#9c36b5", "#0b8a9c"];
function avatarColor(n) { let h = 0; n = String(n || ""); for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return AVA[h % AVA.length]; }
function initial(n) { n = String(n || "").trim(); return n ? n.charAt(0).toUpperCase() : "🙂"; }
const MUSIC_UNITS = [
  { t: "Keyboard & Notes", s: "Play notes and learn their names" },
  { t: "Intervals", s: "Hear the distance between notes" },
  { t: "The Major Scale", s: "The do-re-mi pattern" },
  { t: "Chords", s: "Three notes played together" }
];

/* ================= small components ================= */
function Hear({ target }) {
  return <button className="hearbtn" aria-label="Hear it pronounced" onClick={e => { e.stopPropagation(); haptic(5); speak(target.text, target.lang); }}><Icon name="sound" size={16} /><span>Hear it</span></button>;
}

/* Keys that belong to whichever step is on screen. Kept in its own component
   so the handler is torn down with the step rather than leaking across them. */
function StepKeys({ app, subj, index, canAdvance, onPrev, onNext }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (ev.key === "ArrowLeft" && index > 0) { ev.preventDefault(); haptic(4); if (onPrev) onPrev(); return; }
      if (ev.key === "ArrowRight") {
        // only forward when the step is genuinely finished — the arrow must not
        // become a way to skip past questions
        if (!canAdvance) return;
        ev.preventDefault(); haptic(4); if (onNext) onNext(); return;
      }
      if (ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        haptic(5);
        const now = !app.isSaved(subj, index);
        app.toggleSaved(subj, index);
        app.showToast(now ? "Saved. Find it under Progress." : "Removed from Saved.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subj, index, app, canAdvance, onPrev, onNext]);
  return null;
}
function Hints({ ex }) {
  const rungs = useMemo(() => A.HINTS.build(ex), [ex]);
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); }, [ex]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = ev => {
      if (ev.key !== "h" && ev.key !== "H") return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      ev.preventDefault();
      haptic(5);
      setShown(v => Math.min(rungs.length, v + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rungs.length]);
  return (
    <div className="hints">
      <button className="hintbtn" disabled={shown >= rungs.length} onClick={() => setShown(s => Math.min(rungs.length, s + 1))}>
        {shown === 0 ? <><Icon name="hint" size={16} /><span>Stuck? Show a hint</span></> : shown >= rungs.length ? "That's every hint" : "Need more help?"}
      </button>
      <div className="hintlist">
        {rungs.slice(0, shown).map((r, i) => (
          <div className={"rung" + (r.isAnswer ? " answer" : "")} key={i}><div className="rl">{r.label}</div><div>{r.text}</div></div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   THE STEP MODEL

   A class (a subject) is a list of chapters. A chapter is a lesson: a few
   teaching steps followed by the practice that checks them. You take one step
   at a time and each is marked off as you finish it, so a long lesson is a row
   of small wins rather than one wall of text.

   Step types:
     concept  — one idea, explained. Read it and move on.
     puzzle   — choose the right answer from several.
     type     — write the answer yourself.
   Every step knows the chapter it belongs to and, for practice steps, which
   lesson and exercise it came from, so reviews and trouble spots still line up.
--------------------------------------------------------------------------- */
function buildSteps(lessons) {
  const steps = [], chapters = [];
  (lessons || []).forEach((L, li) => {
    const title = L.title || "Lesson " + (li + 1);
    const chapter = { no: li + 1, title: title, lesson: li, from: steps.length, count: 0 };
    const teach = L.teach || [];
    teach.forEach((para, pi) => {
      steps.push({
        type: "concept", chapter: chapter, lesson: li, title: title,
        part: teach.length > 1 ? pi + 1 : 0, parts: teach.length, teach: para
      });
    });
    (L.ex || []).forEach((e, ei) => {
      steps.push({
        type: e.kind === "choice" ? "puzzle" : "type",
        chapter: chapter, lesson: li, ex: ei, item: e,
        title: e.kind === "choice" ? "Choose the answer" : "Write the answer"
      });
    });
    chapter.count = steps.length - chapter.from;
    if (chapter.count) chapters.push(chapter);
  });
  return { steps: steps, chapters: chapters };
}
/* Roughly how long a run of steps takes. Reading time comes from the actual
   word count at an unhurried 180 words a minute, and a question is costed at the
   time it takes to read it, think, and answer. Rounded to something a person can
   act on — never presented as more precise than it is. */
function estimateMinutes(steps) {
  let seconds = 0;
  (steps || []).forEach(st => {
    if (st.type === "concept") {
      const words = String(st.teach || "").split(/\s+/).filter(Boolean).length;
      seconds += Math.max(20, (words / 180) * 60);
    } else {
      const words = String(st.q || "").split(/\s+/).filter(Boolean).length;
      seconds += 20 + (words / 180) * 60;
    }
  });
  return Math.max(1, Math.round(seconds / 60));
}
function minutesLabel(mins) { return mins === 1 ? "about a minute" : "about " + mins + " min"; }
const STEP_LOOK = {
  concept: { icon: "\u{1F4D6}", label: "Read" },
  puzzle:  { icon: "\u{2753}",  label: "Choose" },
  type:    { icon: "\u{270F}\uFE0F", label: "Write" }
};

/* bottom sheet — replaces browser confirm()/menus with a native-feeling panel */
/* A small set of line icons. Stroke-drawn, inherit the current color, and
   sized in ems so they sit on the text baseline wherever they're used. */
function Icon({ name, size = 20 }) {
  const p = {
    home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
    learn: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5z",
    progress: "M4 19.5h16M7 16V9.5M12 16V5M17 16v-7",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a1.7 1.7 0 0 0 .35 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .35-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.35-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.35H9.1A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z",
    lectern: "M4 7.5 12 5l8 2.5v2L12 7 4 9.5zM12 8.5V19M8 19h8",
    review: "M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5",
    target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z",
    spark: "M12 3v5M12 16v5M3 12h5M16 12h5M6.2 6.2l3 3M14.8 14.8l3 3M17.8 6.2l-3 3M9.2 14.8l-3 3",
    install: "M12 3v11M8 10.5l4 4 4-4M4.5 17.5V20h15v-2.5",
    lock: "M6.5 10.5V8a5.5 5.5 0 0 1 11 0v2.5M5.5 10.5h13V20h-13z",
    sound: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5a4 4 0 0 1 0 5M18.6 7a7.5 7.5 0 0 1 0 10",
    vibrate: "M8 5.5h8v13H8zM4.5 9v6M19.5 9v6",
    moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
    text: "M5 7V5.5h14V7M12 5.5V19M9 19h6",
    hint: "M9.5 18h5M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-.9 1-.9 1.6v.5h-5.2v-.5c0-.6-.3-1.1-.9-1.6A6 6 0 0 1 12 3z",
    note: "M5 4.5h9L19 9v10.5H5zM14 4.5V9h5",
    back: "M14.5 5.5 8 12l6.5 6.5",
    forward: "M9.5 5.5 16 12l-6.5 6.5",
    check: "M5 12.5 10 17.5 19 7",
    close: "M6 6l12 12M18 6 6 18",
    person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
    exit: "M15 4.5h4.5v15H15M11 8l-4 4 4 4M7 12h9",
    switchuser: "M4 8h12l-3-3M20 16H8l3 3"
  }[name];
  if (!p) return null;
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}
/* A crash in one screen shouldn't take the whole app with it, and it should
   never leave a blank page. This catches it, says so plainly, and offers a way
   back — the learner's saved work is untouched either way. */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  componentDidCatch(err, info) { try { console.error("Lectern caught:", err, info); } catch (e) {} }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="crash">
        <div className="card">
          <span className="kicker">Something broke</span>
          <h1>This screen hit a problem.</h1>
          <div className="sub">Your account and everything you've finished are saved and untouched. Going back usually clears it.</div>
          <div className="crashdet"><code>{String(this.state.err && this.state.err.message || this.state.err)}</code></div>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <button className="btn go" onClick={() => { this.setState({ err: null }); if (this.props.onReset) this.props.onReset(); }}>Back to Home</button>
            <button className="btn" onClick={() => { try { location.reload(); } catch (e) {} }}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}

/* ---------------- command palette ----------------
   Ctrl/Cmd-K anywhere. Jumps to a subject, a chapter, a screen or a setting. */
function CommandPalette({ app, close }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  const all = useMemo(() => {
    const out = [];
    out.push({ group: "Go to", label: "Home", icon: "home", on: () => app.go({ tab: "home" }) });
    out.push({ group: "Go to", label: "Learn", icon: "learn", on: () => app.go({ tab: "learn", scr: "grid" }) });
    out.push({ group: "Go to", label: "Your progress", icon: "progress", on: () => app.go({ tab: "progress" }) });
    out.push({ group: "Go to", label: "Settings", icon: "settings", on: () => app.go({ tab: "settings" }) });
    if (app.dueIds.length) out.push({ group: "Go to", label: "Daily review (" + app.dueIds.length + " due)", icon: "review", on: () => app.go({ tab: "learn", scr: "srs" }) });
    if (app.weakIds.length) out.push({ group: "Go to", label: "Trouble spots", icon: "target", on: () => app.go({ tab: "learn", scr: "weak" }) });
    // pick up exactly where the last session stopped
    const rec = recommendNext(app).filter(r => r.id === "continue")[0];
    if (rec) out.unshift({ group: "Go to", label: rec.title, icon: "forward", on: rec.on });
    app.trackedSubjects.forEach(sub => {
      out.push({ group: "Subjects", label: sub.name, hint: sub.icon, on: () => app.go({ tab: "learn", scr: "subject", subj: sub.id }) });
    });
    (app.savedList() || []).forEach(x => {
      out.push({
        group: "Saved", hint: x.sub.icon,
        label: (x.step.item && x.step.item.ask) || x.step.title,
        sub: x.sub.name,
        on: () => app.openStep(x.sub.id, x.i)
      });
    });
    (app.noteList() || []).forEach(nt => {
      out.push({ group: "Notes", hint: nt.sub.icon, label: nt.title, sub: nt.sub.name, on: () => app.openLesson(nt.sub.id, nt.unit) });
    });
    app.trackedSubjects.forEach(sub => {
      (app.courseLessons(sub.id) || []).forEach((L, i) => {
        out.push({ group: "Lessons", label: L.title, sub: sub.name, hint: sub.icon, on: () => app.openLesson(sub.id, i) });
      });
    });
    out.push({ group: "Settings", label: (app.settings.dark ? "Turn off" : "Turn on") + " dark mode", icon: "moon", on: () => app.setSettings(x => ({ ...x, dark: !x.dark })) });
    out.push({ group: "Settings", label: (app.settings.textBig ? "Turn off" : "Turn on") + " larger text", icon: "text", on: () => app.setSettings(x => ({ ...x, textBig: !x.textBig })) });
    out.push({ group: "Settings", label: (app.settings.sound ? "Turn off" : "Turn on") + " sound effects", icon: "sound", on: () => app.setSettings(x => ({ ...x, sound: !x.sound })) });
    return out;
  }, [app.trackedSubjects, app.settings, app.dueIds.length, app.weakIds.length, app.savedList, app.noteList]);

  const hits = useMemo(() => {
    const nq = A.norm(q);
    if (!nq) return all.filter(x => x.group === "Go to").concat(all.filter(x => x.group === "Subjects")).slice(0, 12);
    return all.filter(x => A.norm(x.label + " " + (x.sub || "")).indexOf(nq) >= 0).slice(0, 20);
  }, [q, all]);
  useEffect(() => { setSel(0); }, [q]);

  const run = item => { close(); haptic(6); item.on(); };
  const hitsRef = useRef(hits); hitsRef.current = hits;
  const selRef = useRef(sel); selRef.current = sel;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = e => {
      const list = hitsRef.current;
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(v => Math.min(v + 1, list.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel(v => Math.max(v - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const item = list[selRef.current]; if (item) run(item); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  let lastGroup = null;
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palrow">
          <Icon name="learn" size={18} />
          <input ref={inputRef} className="palinput" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search subjects, lessons and settings…" aria-label="Search everything" autoComplete="off" spellCheck={false} />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="pallist">
          {hits.length === 0 && <div className="palempty">Nothing matches “{q}”.</div>}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null; lastGroup = h.group;
            return (
              <div key={h.group + h.label + i}>
                {head && <div className="palgroup">{head}</div>}
                <button className={"palitem" + (i === sel ? " on" : "")} onMouseEnter={() => setSel(i)} onClick={() => run(h)}>
                  <span className="palic">{h.icon ? <Icon name={h.icon} size={17} /> : h.hint}</span>
                  <span className="pallabel">{h.label}{h.sub ? <span className="palsub"> · {h.sub}</span> : null}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
/* How this app works, said once, plainly. Three cards, skippable, and
   available again from Settings. It explains the parts a learner can't infer —
   especially that being wrong costs nothing and that review is scheduled. */
const APP_VERSION = "1.0";
const INTRO = [
  {
    icon: "lectern",
    title: "Read a little, then use it",
    body: "Every chapter alternates between short explanations and questions about what you just read. One thing per screen, so you're never asked to hold six ideas at once."
  },
  {
    icon: "hint",
    title: "Being wrong costs nothing",
    body: "There are no points, streaks or badges here. A wrong answer just means the question comes back sooner. Hints are always available and using one is never held against you."
  },
  {
    icon: "review",
    title: "Things come back on purpose",
    body: "Questions you've answered return days later, and the ones you keep missing return sooner. That spacing is what moves something from 'I read it' to 'I know it'."
  }
];
function Intro({ onDone }) {
  const [at, setAt] = useState(0);
  const card = INTRO[at];
  const last = at === INTRO.length - 1;
  return (
    <div className="ob intro" id="intro">
      <div className="obtop"><div className="obmk"><Icon name={card.icon} size={44} /></div></div>
      <h1 style={{ textAlign: "center" }}>{card.title}</h1>
      <div className="sub" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>{card.body}</div>
      <div className="introdots" role="presentation">
        {INTRO.map((_, i) => <span key={i} className={i === at ? "on" : ""} />)}
      </div>
      <div className="introbtns">
        <button className="btn go big" onClick={() => { haptic(6); last ? onDone() : setAt(at + 1); }}>
          {last ? "Start learning" : "Next"}
        </button>
        {!last && <button className="linkbtn" onClick={onDone}>Skip</button>}
      </div>
    </div>
  );
}
function Sheet({ sheet, close: rawClose }) {
  /* A choice sheet has three exits, not two: confirm, cancel, and dismissed
     without answering (scrim tap, Escape, the X). The third used to be
     indistinguishable from cancel. It matters for the cloud-conflict prompt,
     where "cancel" means "keep this device" — a real decision — and dismissing
     means no decision was made at all. */
  const close = useCallback(() => {
    rawClose();
    if (sheet && sheet.onDismiss) sheet.onDismiss();
  }, [rawClose, sheet]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.title || "Options"}>
        <div className="grab" />
        {sheet.title && <h2>{sheet.title}</h2>}
        {sheet.body && <div className="sheetsub">{sheet.body}</div>}
        {sheet.items ? (
          <div>
            {sheet.items.map((it, i) => (
              <button className="sheetitem" key={i} onClick={() => { haptic(6); rawClose(); if (it.on) it.on(); }}>
                <span className="si">{typeof it.icon === "string" && it.icon.length > 2 ? <Icon name={it.icon} size={19} /> : it.icon}</span><span>{it.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sheetbtns">
            <button className={"btn " + (sheet.danger ? "danger" : "go")} onClick={() => { haptic(8); rawClose(); if (sheet.onConfirm) sheet.onConfirm(); }}>{sheet.confirmLabel || "Confirm"}</button>
            <button className="btn" onClick={() => { haptic(6); rawClose(); if (sheet.onCancel) sheet.onCancel(); }}>{sheet.cancelLabel || "Cancel"}</button>
          </div>
        )}
      </div>
    </>
  );
}
function Toast({ toast, dismiss }) {
  return (
    <div className="toastwrap">
      <div className="toast">
        <span>{toast.msg}</span>
        {toast.action ? (
          <button className="toastact" onClick={() => { haptic(6); dismiss(); toast.action.on(); }}>{toast.action.label}</button>
        ) : null}
      </div>
    </div>
  );
}

/* One idea, then a button. Nothing to get wrong. */
function ConceptStep({ step, onDone, done }) {
  return (
    <div className="card">
      <span className="kicker">{STEP_LOOK.concept.icon} Read{step.parts > 1 ? " \u00b7 " + step.part + " of " + step.parts : ""}</span>
      <div className="lesson"><p>{step.teach}</p></div>
      <div className="actionbar">
        <button className="btn go" onClick={onDone}>{done ? "Next \u203a" : "Got it \u203a"}</button>
      </div>
    </div>
  );
}

/* A question, graded honestly, with the hint ladder underneath. */
function QuestionStep({ step, speakSubj, onAnswer, onDone, done }) {
  const e = step.item;
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState(false);
  const inputRef = useRef(null);
  const advanceRef = useRef(null);
  const choiceOrder = useMemo(
    () => (e.kind === "choice" ? A.shuffle(A.makeRng(hashOf(e.ask)), e.choices.slice()) : []),
    [e]
  );
  const target = speakSubj ? A.sayTarget(e, speakSubj) : null;

  useEffect(() => { setPicked(null); setTyped(""); setAnswered(false); }, [step]);
  useEffect(() => { if (e.kind === "type" && inputRef.current) inputRef.current.focus(); }, [step]);
  useEffect(() => {
    if (!answered || !advanceRef.current) return;
    try { advanceRef.current.focus({ preventScroll: true }); } catch (err) { try { advanceRef.current.focus(); } catch (err2) {} }
  }, [answered]);
  useEffect(() => {
    if (answered || e.kind !== "choice" || typeof window === "undefined") return;
    const onKey = ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const i = parseInt(ev.key, 10);
      if (!i || i < 1 || i > choiceOrder.length) return;
      ev.preventDefault();
      answerChoice(choiceOrder[i - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function answerChoice(c) {
    if (answered) return;
    const ok = c === e.right;
    setPicked(c); setAnswered(true);
    ok ? sfxCorrect() : sfxWrong();
    if (onAnswer) onAnswer(ok);
  }
  function submitType() {
    if (answered || !typed.trim()) return;
    const ok = A.checkType(e, typed);
    setAnswered(true);
    ok ? sfxCorrect() : sfxWrong();
    if (onAnswer) onAnswer(ok);
  }
  const okChoice = answered && picked === e.right;
  const okType = answered && A.checkType(e, typed);
  const right = okChoice || okType;
  const near = answered && e.kind === "type" && !okType ? A.nearMiss(e, typed) : null;

  return (
    <div className="card">
      <span className="kicker">{STEP_LOOK[step.type].icon} {STEP_LOOK[step.type].label}</span>
      <div className="ask">{e.ask}</div>
      {target && <Hear target={target} />}
      {e.kind === "choice" ? (
        <div className="opts">
          {choiceOrder.map((c, i) => {
            let cls = "opt";
            if (answered && c === e.right) cls += " right";
            else if (answered && c === picked) cls += " wrong";
            return (
              <button className={cls} key={i} disabled={answered} onClick={() => answerChoice(c)}>
                {c}{answered && c === e.right ? <span className="m">✓</span> : (answered && c === picked ? <span className="m">✗</span> : null)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="typerow">
          <input className="ans" ref={inputRef} type="text" aria-label="Type your answer" placeholder="Type your answer\u2026"
            autoCapitalize="off" autoComplete="off" spellCheck={false} disabled={answered}
            style={{ width: "100%", ...(answered ? { borderColor: okType ? "var(--ok)" : "var(--no)" } : null) }}
            value={typed} onChange={ev => setTyped(ev.target.value)}
            onKeyDown={ev => { if (ev.key === "Enter") submitType(); }}
            onFocus={() => { const el = inputRef.current; if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (err) {} } }} />
        </div>
      )}
      {answered && (
        <div className={"fb " + (right ? "ok" : "no")} role="status" aria-live="polite">
          {right
            ? <span><b>Correct.</b> {e.why}</span>
            : <span><b>Not quite.</b>{near ? <> You wrote <b>{typed.trim()}</b>, which is {near.distance === 1 ? "one letter" : "two letters"} away. </> : " "}The answer is <b>{e.kind === "choice" ? e.right : e.canonical}</b>. {e.why}</span>}
        </div>
      )}
      <Hints ex={e} />
      {(answered || e.kind === "type") && (
        <div className="actionbar">
          {!answered
            ? <button className="btn go" disabled={!typed.trim()} onClick={submitType}>Check</button>
            : <button className="btn go" ref={advanceRef} onClick={onDone}>{done ? "Next \u203a" : "Continue \u203a"}</button>}
        </div>
      )}
    </div>
  );
}
function hashOf(str) { let h = 7; str = String(str); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h || 1; }

/* practice deck: choice + type, hints, audio, records each answer */
function Deck({ exList, ids, speakSubj, seed, onAnswer, onLast, onFinish, saveKey, load, save, clear }) {
  const rngRef = useRef(A.makeRng(seed || 1));
  // If this set was left part-way through, pick it back up exactly where it was.
  // Only a saved position that still fits this exact set is trusted.
  const initRef = useRef(null);
  if (!initRef.current) {
    const fresh = A.shuffle(rngRef.current, exList.map((_, i) => i));
    let sv = null;
    try { sv = saveKey && load ? load(saveKey) : null; } catch (e) { sv = null; }
    const fits = sv && Array.isArray(sv.order) && sv.order.length === exList.length
      && sv.order.every(x => typeof x === "number" && x >= 0 && x < exList.length && Math.floor(x) === x)
      && new Set(sv.order).size === exList.length
      && typeof sv.pos === "number" && sv.pos > 0 && sv.pos < exList.length;
    initRef.current = fits ? { order: sv.order, pos: sv.pos, resumed: true } : { order: fresh, pos: 0, resumed: false };
  }
  const [order, setOrder] = useState(initRef.current.order);
  const [pos, setPos] = useState(initRef.current.pos);
  const [resumed, setResumed] = useState(initRef.current.resumed);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);
  const e = exList[order[pos]];
  const isLast = pos >= order.length - 1;
  const choiceOrder = useMemo(() => e && e.kind === "choice" ? A.shuffle(rngRef.current, e.choices.slice()) : [], [pos, order]);
  const target = speakSubj && e ? A.sayTarget(e, speakSubj) : null;

  const advanceRef = useRef(null);
  useEffect(() => { if (e && e.kind === "type" && inputRef.current) inputRef.current.focus(); }, [pos, order]);
  // once an answer is in, put the keyboard focus on the button that moves you on,
  // so Enter or Space continues without reaching for the mouse
  useEffect(() => {
    if (!answered || !advanceRef.current) return;
    try { advanceRef.current.focus({ preventScroll: true }); } catch (err) { try { advanceRef.current.focus(); } catch (err2) {} }
  }, [answered]);
  // number keys pick an option on a physical keyboard
  useEffect(() => {
    if (answered || !e || e.kind !== "choice" || typeof window === "undefined") return;
    const onKey = ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const i = parseInt(ev.key, 10);
      if (!i || i < 1 || i > choiceOrder.length) return;
      ev.preventDefault();
      answerChoice(choiceOrder[i - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function record(ok) { if (onAnswer && ids) onAnswer(ids[order[pos]], ok); }
  function answerChoice(c) {
    if (answered) return;
    const ok = c === e.right; setPicked(c); setAnswered(true);
    ok ? sfxCorrect() : sfxWrong(); record(ok);
    if (isLast) { finishUp(); if (onLast) onLast(); }
  }
  function finishUp() { if (saveKey && clear) { try { clear(saveKey); } catch (e) {} } }
  function submitType() {
    if (answered) return; if (!typed.trim()) return;
    const ok = A.checkType(e, typed); setAnswered(true);
    ok ? sfxCorrect() : sfxWrong(); record(ok);
    if (isLast) { finishUp(); if (onLast) onLast(); }
  }
  function next() {
    const np = pos + 1;
    setAnswered(false); setPicked(null); setTyped(""); setPos(np); setResumed(false);
    if (saveKey && save) { try { save(saveKey, { order: order, pos: np }); } catch (e) {} }
  }
  function again() {
    const o = A.shuffle(rngRef.current, exList.map((_, i) => i));
    setOrder(o); setPos(0); setAnswered(false); setPicked(null); setTyped(""); setResumed(false);
    if (saveKey && clear) { try { clear(saveKey); } catch (e) {} }
  }
  function startOver() { haptic(6); again(); }

  if (!e) return null;
  const okChoice = answered && picked === e.right;
  const okType = answered && A.checkType(e, typed);
  const near = answered && e.kind === "type" && !okType ? A.nearMiss(e, typed) : null;
  return (
    <div>
      {resumed && (
        <div className="resumed">Picked up where you left off — question {pos + 1}.
          <button className="linkbtn" onClick={startOver}>Start over</button>
        </div>
      )}
      <div className="progwrap">
        <div className="progbar" role="progressbar" aria-valuemin={0} aria-valuemax={order.length} aria-valuenow={pos + (answered ? 1 : 0)} aria-label="Progress through this practice set">
          <i style={{ width: (order.length ? ((pos + (answered ? 1 : 0)) / order.length) * 100 : 0) + "%" }} />
        </div>
        <div className="prog">{pos + 1} of {order.length}</div>
      </div>
      <div className="ask">{e.ask}</div>
      {target && <Hear target={target} />}
      {e.kind === "choice" ? (
        <div className="opts">
          {choiceOrder.map((c, i) => {
            let cls = "opt";
            if (answered && c === e.right) cls += " right";
            else if (answered && c === picked) cls += " wrong";
            return <button className={cls} key={i} disabled={answered} onClick={() => answerChoice(c)}>{c}{answered && c === e.right ? <span className="m">✓</span> : (answered && c === picked ? <span className="m">✗</span> : null)}</button>;
          })}
        </div>
      ) : (
        <div className="typerow">
          <input className="ans" ref={inputRef} type="text" aria-label="Type your answer" placeholder="Type your answer…"
            autoCapitalize="off" autoComplete="off" spellCheck={false} disabled={answered}
            style={{ width: "100%", ...(answered ? { borderColor: okType ? "var(--ok)" : "var(--no)" } : null) }}
            value={typed} onChange={e2 => setTyped(e2.target.value)} onKeyDown={e2 => { if (e2.key === "Enter") submitType(); }}
            onFocus={() => { const el = inputRef.current; if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e3) {} } }} />
        </div>
      )}
      {answered && (
        <div className={"fb " + ((okChoice || okType) ? "ok" : "no")} role="status" aria-live="polite">
          {(okChoice || okType)
            ? <span><b>Correct.</b> {e.why}</span>
            : <span><b>Not quite.</b>{near ? <> You wrote <b>{typed.trim()}</b>, which is {near.distance === 1 ? "one letter" : "two letters"} away. </> : " "}The answer is <b>{e.kind === "choice" ? e.right : e.canonical}</b>. {e.why}</span>}
        </div>
      )}
      <Hints ex={e} />
      {(answered || e.kind === "type") && (
        <div className="actionbar">
          {!answered
            ? <button className="btn go" disabled={!typed.trim()} onClick={submitType}>Check</button>
            : !isLast ? <button className="btn go" ref={advanceRef} onClick={next}>Next ›</button>
              : onFinish ? <button className="btn go" ref={advanceRef} onClick={onFinish}>Finish lesson ›</button>
                : <button className="btn go" ref={advanceRef} onClick={again}>Practice again</button>}
        </div>
      )}
    </div>
  );
}

/* in-lesson AI teacher */
function AITeacher({ teach, title, aiAvailable, callModel, aiUnavailableReason }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  // The old copy told people to fetch an API key. They don't need one any more —
  // signing in is the whole requirement — so it says that instead.
  const whyNot = () => (aiUnavailableReason && aiUnavailableReason()) ||
    "Sign in under Settings → Cloud sync to chat with the AI teacher.";
  const [note, setNote] = useState(aiAvailable() ? "" : whyNot());
  function ask() {
    const question = q.trim(); if (!question) return;
    if (!aiAvailable()) { setNote(whyNot()); return; }
    setMsgs(m => [...m, { who: "me", text: question }, { who: "ai", text: "…thinking…" }]); setQ(""); setBusy(true); setNote("");
    callModel(A.GEN.buildHelpPrompt(teach, question, title)).then(t => {
      setMsgs(m => { const c = m.slice(); c[c.length - 1] = { who: "ai", text: (t || "").trim() || "(no reply)" }; return c; }); setBusy(false);
    }).catch(err => {
      setMsgs(m => { const c = m.slice(); c[c.length - 1] = { who: "ai", text: "Sorry — " + ((err && err.message === "no-ai") ? "the AI isn't connected here." : (err && err.message) || "something went wrong.") }; return c; }); setBusy(false);
    });
  }
  return (
    <div className="card">
      <span className="kicker">AI teacher</span>
      <div className="setdesc">Stuck or curious? Ask about this lesson — the AI helps one step at a time, without just handing you answers.</div>
      <div className="chat">{msgs.map((m, i) => <div className={"msg " + m.who} key={i}>{m.text}</div>)}</div>
      <div className="typerow">
        <input className="ans" style={{ width: "100%" }} aria-label="Ask the AI teacher" placeholder="Ask a question about this lesson…"
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") ask(); }} />
        <button className="btn go" disabled={busy} onClick={ask}>Ask</button>
      </div>
      {note && <div className="setdesc" style={{ marginTop: 8 }}>{note}</div>}
    </div>
  );
}

/* ================= root component ================= */
/* The Lectern app itself. Not the default export any more — the router at the
   bottom of this file is, because Lectern is now the hub and has to be able to
   hand over to Study It. */
function LecternApp({ onOpenStudyIt, onOpenMathema, onOpenElements } = {}) {
  const [auth, setAuth] = useState(() => jget(AKEY, { users: [], current: null }));
  const [settings, setSettings] = useState(() => ({ sound: true, dark: false, autoTheme: false, haptics: true, textBig: false, ...jget(SKEY, {}) }));
  const [notes, setNotes] = useState({});
  // Lessons the learner generated INTO a built-in subject, kept per account and
  // always appended after the built-in ones so finished-lesson numbering holds.
  const [added, setAdded] = useState({});
  // How many steps were taken on each day. A plain record, not a streak: there
  // is no reward for a long run and no penalty for a gap.
  const [activity, setActivity] = useState({});
  // Steps the learner flagged to come back to. Their choice, not the app's.
  const [saved, setSaved] = useState({});
  // Which individual steps are finished, keyed "subject/stepIndex".
  const [stepsDone, setStepsDone] = useState({});
  const [topics, setTopics] = useState(() => jget(TKEY, []));
  const cur = useMemo(() => auth.users.find(u => u.id === auth.current) || null, [auth]);
  /* Cloud sync state. `cloud.user` is the SUPABASE account (shared with Study It
     and CodeQuest); `cur` above is still the on-device profile. They are
     deliberately separate: you can use Lectern with no cloud account at all. */
  const [cloud, setCloud] = useState({ user: null, status: "off", at: null, error: null });
  const cloudRef = useRef({ timer: null, ready: false });
  const [prog, setProg] = useState(() => jget(pkey(auth.current), {}));
  const [sched, setSched] = useState(() => jget(skey(auth.current), {}));
  const [last, setLast] = useState(() => jget(lkey(auth.current), null));
  // Reopening the app should put you back where you were, the way a real app
  // does. Only screens worth returning to are restored — not a half-finished
  // sheet or the topic generator.
  const [route, setRoute] = useState({ tab: "home", scr: "grid", subj: null, unit: 0 });
  const routeReady = useRef(false);
  const [splash, setSplash] = useState(true);
  const [confettiKey, setConfettiKey] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [palette, setPalette] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [offline, setOffline] = useState(() => (typeof navigator !== "undefined" && navigator.onLine === false));
  const [toast, setToast] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const scrollRef = useRef(null);
  const depthRef = useRef(0);
  const toastTimer = useRef(null);
  const sheetRef = useRef(null); sheetRef.current = sheet;

  // persistence
  useEffect(() => { jset(AKEY, auth); }, [auth]);
  useEffect(() => {
    jset(SKEY, settings);
    PREFS.sound = settings.sound;
    PREFS.haptics = settings.haptics;
    try {
      const root = document.documentElement;
      root.setAttribute("data-text", settings.textBig ? "large" : "normal");
      root.setAttribute("data-theme", settings.dark ? "dark" : "light");
      // keep the phone's status bar in step with the theme
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute("content", settings.dark ? "#12141d" : "#f4f6fc");
    } catch (e) {}
  }, [settings]);
  useEffect(() => { jset(TKEY, topics); }, [topics]);
  const uid = cur ? cur.id : null;
  useEffect(() => { setProg(jget(pkey(uid), {})); setSched(jget(skey(uid), {})); setLast(jget(lkey(uid), null)); }, [uid]);
  useEffect(() => { if (uid) jset(pkey(uid), prog); }, [prog, uid]);
  useEffect(() => { if (uid) jset(skey(uid), sched); }, [sched, uid]);
  useEffect(() => { if (uid) jset(lkey(uid), last); }, [last, uid]);
  useEffect(() => { setNotes(uid ? (jget(nkey(uid), {}) || {}) : {}); }, [uid]);
  useEffect(() => { if (uid) jset(nkey(uid), notes); }, [notes, uid]);
  useEffect(() => { setActivity(uid ? (jget(akey(uid), {}) || {}) : {}); }, [uid]);
  useEffect(() => { setSaved(uid ? (jget(mkey(uid), {}) || {}) : {}); }, [uid]);
  // Once per account, and never again unless asked for from Settings.
  useEffect(() => {
    if (!uid) { setShowIntro(false); return; }
    let seen = true;
    try { seen = !!localStorage.getItem("lectern.intro.v1." + uid); } catch (e) { seen = true; }
    setShowIntro(!seen);
  }, [uid]);
  const RESUMABLE = { home: 1, progress: 1, settings: 1, learn: 1 };
  useEffect(() => {
    routeReady.current = false;
    if (!uid) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("lectern.route.v1." + uid) || "null"); } catch (e) { saved = null; }
    if (saved && RESUMABLE[saved.tab] && saved.scr !== "generate" && saved.scr !== "done") {
      setRoute(r => ({ ...r, ...saved }));
    }
    routeReady.current = true;
  }, [uid]);
  useEffect(() => {
    if (!uid || !routeReady.current) return;
    try { localStorage.setItem("lectern.route.v1." + uid, JSON.stringify(route)); } catch (e) {}
  }, [route, uid]);

  const openIntro = () => setShowIntro(true);
  const closeIntro = () => {
    setShowIntro(false);
    try { if (uid) localStorage.setItem("lectern.intro.v1." + uid, "1"); } catch (e) {}
  };
  useEffect(() => { if (uid) jset(mkey(uid), saved); }, [saved, uid]);
  useEffect(() => { if (uid) jset(akey(uid), activity); }, [activity, uid]);
  useEffect(() => { setAdded(uid ? (jget(xkey(uid), {}) || {}) : {}); }, [uid]);
  useEffect(() => { if (uid) jset(xkey(uid), added); }, [added, uid]);
  useEffect(() => {
    if (!uid) { setStepsDone({}); return; }
    const saved = jget(tkey(uid), null);
    if (saved) { setStepsDone(saved); return; }
    // First run under the step model: anyone who had finished lessons before
    // keeps them, with every step of those lessons marked off.
    const seeded = {};
    const done = jget(pkey(uid), {}) || {};
    Object.keys(done).forEach(k => {
      if (!done[k]) return;
      const cut = k.lastIndexOf("/");
      const id = k.slice(0, cut), li = +k.slice(cut + 1);
      const built = buildSteps(A.COURSES[id] || []);
      const ch = built.chapters.filter(c => c.lesson === li)[0];
      if (!ch) return;
      for (let i = ch.from; i < ch.from + ch.count; i++) seeded[id + "/" + i] = true;
    });
    setStepsDone(seeded);
  }, [uid]);
  useEffect(() => { if (uid) jset(tkey(uid), stepsDone); }, [stepsDone, uid]);
  useEffect(() => { const t = setTimeout(() => setSplash(false), 420); return () => clearTimeout(t); }, []);
  useEffect(() => { try { installShell(); } catch (e) {} }, []);
  // Keep the browser tab and task switcher honest about where you are.
  useEffect(() => {
    if (typeof document === "undefined") return;
    try {
      const where = locationLabel(app);
      document.title = where && where !== "Lectern" ? where + " · Lectern" : "Lectern";
    } catch (e) {}
  }, [route.tab, route.scr, route.subj, route.unit, route.step, cur, topics, added]);
  // When asked to, track the device's light/dark setting live.
  useEffect(() => {
    if (!settings.autoTheme || typeof window === "undefined" || !window.matchMedia) return;
    let mq = null;
    try { mq = window.matchMedia("(prefers-color-scheme: dark)"); } catch (e) { return; }
    if (!mq) return;
    const apply = () => setSettings(x => (x.dark === mq.matches ? x : { ...x, dark: mq.matches }));
    apply();
    if (mq.addEventListener) { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
    if (mq.addListener) { mq.addListener(apply); return () => mq.removeListener(apply); }
  }, [settings.autoTheme]);
  // Losing the network doesn't stop the lessons — they're on the device — but it
  // does stop the AI, so say so rather than letting a request fail silently.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  // Keyboard shortcuts, for anyone on a real keyboard.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = e => {
      const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setPalette(v => !v); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
      if (e.key === "?") { e.preventDefault(); setSheet({ title: "Keyboard shortcuts", body: "Everything here works from any screen it applies to.", items: [
        { icon: "learn", label: "⌘K or /  —  search everything" },
        { icon: "forward", label: "1 – 4  —  pick an answer" },
        { icon: "hint", label: "H  —  reveal the next hint" },
        { icon: "note", label: "S  —  save this step for later" },
        { icon: "forward", label: "\u2190 \u2192  —  move between steps" },
        { icon: "back", label: "Esc  —  close what's open" },
        { icon: "settings", label: "?  —  show this list" }
      ] }); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBip = e => { if (e && e.preventDefault) e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => { setInstallEvt(null); showToast("Installed — open Lectern from your home screen."); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  // helpers
  const courseLessons = useCallback(id => {
    if (typeof id === "string" && id.indexOf("topic_") === 0) {
      const t = topics.find(x => x.id === id);
      return t ? t.lessons : [];
    }
    const base = A.COURSES[id] || [];
    const extra = added[id] || [];
    return extra.length ? base.concat(extra) : base;
  }, [topics, added]);
  const builtInCount = id => (A.COURSES[id] || []).length;
  const addedCount = id => (added[id] || []).length;
  const addLessons = (id, lessons) => setAdded(o => ({ ...o, [id]: (o[id] || []).concat(lessons) }));
  const clearAdded = id => setAdded(o => { const nx = { ...o }; delete nx[id]; return nx; });
  const subjOf = useCallback(id => { const b = A.SUBJECTS.find(s => s.id === id); if (b) return b; if (typeof id === "string" && id.indexOf("topic_") === 0) { const t = topics.find(x => x.id === id); if (t) return { id, name: t.name, icon: "✨", accent: "#7b61ff", tint: "#efeaff", kind: "topic" }; } return null; }, [topics]);
  const courseSubjects = A.SUBJECTS.filter(s => s.kind !== "math" && s.kind !== "music");
  const isDone = (id, i) => !!prog[id + "/" + i];
  const doneCount = (id, total) => { let n = 0; for (let i = 0; i < total; i++) if (isDone(id, i)) n++; return n; };
  // Everything with lessons in it, built-in courses and the learner's own AI
  // topics alike. A topic you made is still something you are working through,
  // so it belongs in the totals.
  const trackedSubjects = courseSubjects.concat(topics.map(t => subjOf(t.id)).filter(Boolean));
  const lessonsIn = id => (courseLessons(id) || []).length;
  const totalLessons = trackedSubjects.reduce((a, s) => a + lessonsIn(s.id), 0);
  const totalDone = trackedSubjects.reduce((a, s) => a + doneCount(s.id, lessonsIn(s.id)), 0);
  const firstIncomplete = id => { const u = courseLessons(id); for (let i = 0; i < u.length; i++) if (!isDone(id, i)) return i; return -1; };
  const nextLesson = () => { for (const s of courseSubjects) { const i = firstIncomplete(s.id); if (i >= 0) return { subj: s.id, unit: i }; } return null; };
  const dueIds = A.SRS.dueItems(sched, Date.now());
  const weakIds = A.SRS.weakItems(sched, 2);
  const exFromId = id => { const p = String(id).split("/"); if (p.length < 3) return null; const ls = courseLessons(p[0]); const L = ls && ls[+p[1]]; return L && L.ex ? (L.ex[+p[2]] || null) : null; };
  const recordReview = (id, ok) => { if (!id) return; setSched(s => ({ ...s, [id]: A.SRS.schedNext(s[id], ok, Date.now()) })); };
  const markDone = (id, i) => setProg(p => (p[id + "/" + i] ? p : { ...p, [id + "/" + i]: true }));
  // where you had got to in a practice set, so leaving mid-way doesn't lose it
  const deckLoad = key => { const all = jget(dkey(uid), {}) || {}; return all[key] || null; };
  const deckSave = (key, val) => { const all = jget(dkey(uid), {}) || {}; all[key] = val; jset(dkey(uid), all); };
  const deckClear = key => { const all = jget(dkey(uid), {}) || {}; if (key in all) { delete all[key]; jset(dkey(uid), all); } };
  // A class in CodeQuest's sense: the chapters and the flat list of steps.
  /* Build a class once per subject and hand back the SAME object until its
     lessons actually change. Rebuilding on every render gave every step a new
     identity, and the runner resets its answer whenever the step changes — so
     an answer was wiped in the same tick it was submitted. */
  const classCache = useRef({});
  const classOf = useCallback(id => {
    const lessons = courseLessons(id);
    const hit = classCache.current[id];
    if (hit && hit.lessons === lessons) return hit.cls;
    const cls = buildSteps(lessons);
    classCache.current[id] = { lessons: lessons, cls: cls };
    return cls;
  }, [courseLessons]);
  const stepKey = (id, i) => id + "/" + i;
  const isStepDone = (id, i) => !!stepsDone[stepKey(id, i)];
  const markStep = (id, i, cls) => {
    const already = !!stepsDone[stepKey(id, i)];
    setStepsDone(o => (o[stepKey(id, i)] ? o : { ...o, [stepKey(id, i)]: true }));
    if (!already) { const key = dayStamp(); setActivity(a => ({ ...a, [key]: (a[key] || 0) + 1 })); }
    // A chapter counts as a finished lesson once every one of its steps is done.
    const step = cls && cls.steps[i];
    if (!step) return;
    const ch = step.chapter;
    let all = true;
    for (let k = ch.from; k < ch.from + ch.count; k++) {
      if (k !== i && !stepsDone[stepKey(id, k)]) { all = false; break; }
    }
    if (all) markDone(id, ch.lesson);
  };
  /* A learner who used Lectern before it tracked individual steps has their
     history in the lesson-level store only, so every finished lesson showed as
     "0 of 8 steps". Their work isn't lost — expand each finished lesson into its
     steps, once, and record that it has been done so it never runs twice. */
  useEffect(() => {
    if (!uid) return;
    const flag = "lectern.stepfill.v1." + uid;
    try { if (localStorage.getItem(flag)) return; } catch (e) {}
    const markDoneFlag = () => { try { localStorage.setItem(flag, "1"); } catch (e) {} };
    const finished = jget(pkey(uid), {}) || {};
    const lessonsBySubject = {};
    Object.keys(finished).forEach(k => {
      if (!finished[k]) return;
      const parts = String(k).split("/");
      if (parts.length !== 2) return;
      const idx = parseInt(parts[1], 10);
      if (!isFinite(idx)) return;
      (lessonsBySubject[parts[0]] = lessonsBySubject[parts[0]] || []).push(idx);
    });
    const subjects = Object.keys(lessonsBySubject);
    if (!subjects.length) { markDoneFlag(); return; }
    const filled = {};
    subjects.forEach(sid => {
      let cls = null;
      try { cls = classOf(sid); } catch (e) { return; }
      if (!cls || !cls.steps) return;
      cls.steps.forEach((st, i) => {
        if (st.chapter && lessonsBySubject[sid].indexOf(st.chapter.lesson) >= 0) filled[sid + "/" + i] = true;
      });
    });
    if (Object.keys(filled).length) setStepsDone(o => ({ ...filled, ...o }));
    markDoneFlag();
  }, [uid, classOf]);

  const isSaved = (id, i) => !!saved[id + "/" + i];
  const toggleSaved = (id, i) => setSaved(o => {
    const k = id + "/" + i, nx = { ...o };
    if (nx[k]) delete nx[k]; else nx[k] = Date.now();
    return nx;
  });
  const savedList = () => Object.keys(saved).map(k => {
    const cut = String(k).lastIndexOf("/");
    const sid = k.slice(0, cut), idx = parseInt(k.slice(cut + 1), 10);
    const sub = subjOf(sid);
    if (!sub || !isFinite(idx)) return null;
    let cls = null;
    try { cls = classOf(sid); } catch (e) { return null; }
    const st = cls && cls.steps[idx];
    if (!st) return null;
    return { key: k, sub: sub, i: idx, step: st, at: saved[k] };
  }).filter(Boolean).sort((a, b) => b.at - a.at);

  /* Everything this account holds about one subject, and nothing else.
     Returns what was removed so the action can be undone. */
  const clearSubject = id => {
    const removed = { steps: {}, sched: {}, notes: {}, saved: {}, prog: {} };
    const prefix = id + "/";
    Object.keys(stepsDone).forEach(k => { if (k.indexOf(prefix) === 0) removed.steps[k] = stepsDone[k]; });
    Object.keys(sched).forEach(k => { if (k.indexOf(prefix) === 0) removed.sched[k] = sched[k]; });
    Object.keys(notes).forEach(k => { if (k.indexOf(prefix) === 0) removed.notes[k] = notes[k]; });
    Object.keys(saved).forEach(k => { if (k.indexOf(prefix) === 0) removed.saved[k] = saved[k]; });
    Object.keys(prog).forEach(k => { if (k.indexOf(prefix) === 0) removed.prog[k] = prog[k]; });
    const strip = obj => { const nx = {}; Object.keys(obj).forEach(k => { if (k.indexOf(prefix) !== 0) nx[k] = obj[k]; }); return nx; };
    setStepsDone(strip); setSched(strip); setNotes(strip); setSaved(strip); setProg(strip);
    setLast(l => (l && l.subj === id ? null : l));
    return removed;
  };
  const restoreSubject = removed => {
    if (!removed) return;
    setStepsDone(o => ({ ...o, ...removed.steps }));
    setSched(o => ({ ...o, ...removed.sched }));
    setNotes(o => ({ ...o, ...removed.notes }));
    setSaved(o => ({ ...o, ...removed.saved }));
    setProg(o => ({ ...o, ...removed.prog }));
  };
  const subjectHasWork = id => {
    const prefix = id + "/";
    return Object.keys(stepsDone).some(k => k.indexOf(prefix) === 0);
  };

  const stepsDoneIn = (id, from, count) => {
    let done = 0;
    for (let k = from; k < from + count; k++) if (stepsDone[stepKey(id, k)]) done++;
    return done;
  };
  const firstUnfinishedStep = (id, cls) => {
    for (let i = 0; i < cls.steps.length; i++) if (!isStepDone(id, i)) return i;
    return cls.steps.length ? cls.steps.length - 1 : 0;
  };
  const getNote = key => (notes && notes[key]) || "";
  const setNote = (key, text) => setNotes(o => {
    const nx = { ...o };
    if (String(text || "").trim()) nx[key] = text; else delete nx[key];
    return nx;
  });
  const noteList = () => Object.keys(notes || {}).map(k => {
    const p = String(k).split("/"), sub = subjOf(p[0]), L = sub ? courseLessons(p[0])[+p[1]] : null;
    return sub && L ? { key: k, sub: sub, unit: +p[1], title: L.title, text: notes[k] } : null;
  }).filter(Boolean);
  const levelOf = id => (cur && cur.levels && cur.levels[id]) || "new";
  const setLevelOf = (id, v) => setAuth(a => ({ ...a, users: a.users.map(u => u.id === cur.id ? { ...u, levels: { ...(u.levels || {}), [id]: v } } : u) }));
  const getProfile = () => (cur && cur.profile) || "";
  const setProfile = v => setAuth(a => ({ ...a, users: a.users.map(u => u.id === cur.id ? { ...u, profile: v } : u) }));
  /* ---- backup & restore ----
     Contains what you have learned, not who you are: no password hash and no
     API key ever go into the file. */
  // A full backup: everything needed to pick up on another device, including
  // the saved password and API key. That makes the file sensitive — the Settings
  // card says so plainly, because a backup you can't restore fully isn't one.
  const buildBackup = () => ({
    app: "lectern", version: 3, exportedAt: new Date().toISOString(),
    account: {
      name: cur ? cur.name : "",
      levels: (cur && cur.levels) || {},
      profile: (cur && cur.profile) || "",
      hash: (cur && cur.hash) || ""
    },
    // Everything the account owns. This list must grow whenever a new store is
    // added, or a restore silently drops it.
    progress: prog || {}, reviews: sched || {}, last: last || null,
    topics: topics || [], added: added || {},
    steps: stepsDone || {}, notes: notes || {}, saved: saved || {}, activity: activity || {},
    settings: {
      sound: !!settings.sound, haptics: !!settings.haptics,
      dark: !!settings.dark, textBig: !!settings.textBig,
    }
  });
  const readBackup = text => {
    let d = null;
    try { d = JSON.parse(String(text || "").trim()); } catch (e) { return { ok: false, error: "That isn't valid backup text. Paste the whole file, starting with { and ending with }." }; }
    if (!d || typeof d !== "object") return { ok: false, error: "That isn't valid backup text." };
    if (d.app !== "lectern") return { ok: false, error: "That file isn't a Lectern backup." };
    if (!d.progress || typeof d.progress !== "object") return { ok: false, error: "That backup is missing its progress section, so there is nothing to restore." };
    const counts = {
      lessons: Object.keys(d.progress).filter(k => d.progress[k]).length,
      reviews: d.reviews && typeof d.reviews === "object" ? Object.keys(d.reviews).length : 0,
      topics: Array.isArray(d.topics) ? d.topics.length : 0,
      added: d.added && typeof d.added === "object" ? Object.keys(d.added).reduce((a, k) => a + (d.added[k] || []).length, 0) : 0,
      steps: d.steps && typeof d.steps === "object" ? Object.keys(d.steps).length : 0,
      notes: d.notes && typeof d.notes === "object" ? Object.keys(d.notes).length : 0
    };
    return { ok: true, data: d, counts };
  };
  const applyBackup = d => {
    setProg(d.progress || {});
    setSched(d.reviews && typeof d.reviews === "object" ? d.reviews : {});
    setLast(d.last || null);
    if (Array.isArray(d.topics)) setTopics(d.topics);
    if (d.added && typeof d.added === "object") setAdded(d.added);
    if (d.steps && typeof d.steps === "object") setStepsDone(d.steps);
    if (d.notes && typeof d.notes === "object") setNotes(d.notes);
    if (d.saved && typeof d.saved === "object") setSaved(d.saved);
    if (d.activity && typeof d.activity === "object") setActivity(d.activity);
    if (d.settings) setSettings(x => ({
      ...x,
      sound: !!d.settings.sound, haptics: !!d.settings.haptics,
      dark: !!d.settings.dark, textBig: !!d.settings.textBig,
      // older backups (version 1) carried no key; leave whatever is set here
    }));
    if (d.account && cur) setAuth(a => ({ ...a, users: a.users.map(u => u.id === cur.id ? {
      ...u,
      levels: d.account.levels || {},
      profile: typeof d.account.profile === "string" ? d.account.profile : (u.profile || ""),
      hash: typeof d.account.hash === "string" && d.account.hash ? d.account.hash : (u.hash || "")
    } : u) }));
  };
  const exportBackup = () => {
    const text = JSON.stringify(buildBackup(), null, 2);
    const name = "lectern-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
      return { ok: true, text: text, name: name };
    } catch (e) { return { ok: false, text: text, name: name }; }
  };
  // A plain-English summary of what this learner already knows, handed to the AI
  // so a generated topic can build on it instead of starting from nothing.
  const knownContext = () => {
    const out = [];
    A.SUBJECTS.forEach(s => {
      if (s.kind === "math" || s.kind === "music") return;
      const lessons = A.COURSES[s.id] || [];
      const finished = lessons.filter((L, i) => isDone(s.id, i)).map(L => L.title);
      const level = levelOf(s.id);
      if (!finished.length && level === "new") return;
      const bits = [];
      if (level !== "new") {
        const preset = A.PROFILE_PRESETS.filter(p => p.id === level)[0];
        bits.push("self-rated " + (preset ? preset.short : level));
      }
      if (finished.length) bits.push("completed: " + finished.join(", "));
      out.push(s.name + " (" + bits.join("; ") + ")");
    });
    topics.forEach(t => out.push('their topic "' + t.name + '"'));
    return out;
  };

  const depths = { home: 0, progress: 0, settings: 0 };
  function depthOf(r) { if (r.tab !== "learn") return 0; return r.scr === "grid" ? 0 : (r.scr === "subject" || r.scr === "generate" || r.scr === "srs" || r.scr === "weak") ? 1 : r.scr === "done" ? 3 : 2; }
  const scrollMemory = useRef({});
  // Identify the SCREEN, not the whole route: coming back to the grid leaves the
  // old subject id sitting in the route, and including it meant the key never
  // matched the one we saved on the way out.
  const routeKey = r => {
    if (r.tab !== "learn") return r.tab;
    if (r.scr === "grid" || r.scr === "srs" || r.scr === "weak" || r.scr === "generate") return "learn/" + r.scr;
    if (r.scr === "subject") return "learn/subject/" + r.subj;
    return ["learn", r.scr, r.subj, r.unit, r.step].join("/");
  };
  const go = useCallback(patch => {
    // remember where this screen was scrolled to before leaving it
    setRoute(r => {
      try {
        const el = scrollRef.current;
        if (el && typeof el.scrollTop === "number") scrollMemory.current[routeKey(r)] = el.scrollTop;
      } catch (e) {}
      return { ...r, ...patch };
    });
  }, []);
  // Open a class at a particular step. This is how the learner moves now.
  const openStep = (id, i, lesson) => {
    if (lesson !== undefined) setLast({ subj: id, unit: lesson });
    go({ tab: "learn", scr: "step", subj: id, step: i });
  };
  // "Open lesson n" now means "go to the first step of chapter n that isn't done".
  const openLesson = (id, i) => {
    const built = buildSteps(courseLessons(id));
    const ch = built.chapters.filter(c => c.lesson === i)[0];
    if (!ch) { setLast({ subj: id, unit: i }); go({ tab: "learn", scr: "subject", subj: id }); return; }
    let at = ch.from;
    for (let k = ch.from; k < ch.from + ch.count; k++) {
      if (!stepsDone[id + "/" + k]) { at = k; break; }
      if (k === ch.from + ch.count - 1) at = ch.from;   // finished: start it again
    }
    openStep(id, at, i);
  };
  // Returns true if there was somewhere to go back to, false at the top level.
  const goBack = () => {
    if (route.tab !== "learn") return false;
    const fromHome = route.scr === "srs" || route.scr === "weak";
    const insideASubject = route.scr === "unit" || route.scr === "step" || route.scr === "review" || route.scr === "done";
    if (fromHome) { go({ tab: "home", scr: "grid" }); return true; }
    if (insideASubject) { go({ scr: "subject" }); return true; }
    if (route.scr === "subject" || route.scr === "generate") { go({ scr: "grid" }); return true; }
    return false;
  };
  const showConfetti = () => setConfettiKey(k => k + 1);
  const showToast = useCallback((msg, action) => {
    setToast({ msg: msg, action: action || null, k: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // an undoable toast stays up longer — there is a decision to make
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2600);
  }, []);
  const openSheet = useCallback(cfg => { haptic(6); setSheet(cfg); }, []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const confirmSheet = useCallback(cfg => { haptic(9); setSheet(cfg); }, []);
  const installReady = !!installEvt;
  const promptInstall = () => {
    if (!installEvt) return;
    try {
      installEvt.prompt();
      const c = installEvt.userChoice;
      if (c && c.then) c.then(r => { if (r && r.outcome === "dismissed") showToast("No problem — you can install any time from Settings."); setInstallEvt(null); });
      else setInstallEvt(null);
    } catch (e) { showToast("This browser wouldn't show the install prompt."); }
  };
  const signOut = () => { setAuth(a => ({ ...a, current: null })); };

  const pushNow = useCallback(async (reason) => {
    const sb = await getSupabase();
    const u = cloud.user;
    if (!sb || !u || !uid) return false;
    setCloud(c => ({ ...c, status: "syncing", error: null }));
    try {
      await cloudSave(sb, u.id, collectLocal(uid));
      setCloud(c => ({ ...c, status: "ok", at: Date.now(), error: null }));
      return true;
    } catch (e) {
      setCloud(c => ({ ...c, status: "error", error: (e && e.message) || "Sync failed" }));
      return false;
    }
  }, [cloud.user, uid]);

  // Debounced autosave. Only runs once the first reconcile has finished, so a
  // half-loaded device can't stomp a good cloud copy.
  useEffect(() => {
    if (!cloud.user || !uid || !cloudRef.current.ready) return;
    if (cloudRef.current.timer) clearTimeout(cloudRef.current.timer);
    cloudRef.current.timer = setTimeout(() => { pushNow("auto"); }, 2500);
    return () => { if (cloudRef.current.timer) clearTimeout(cloudRef.current.timer); };
  }, [prog, sched, last, notes, added, stepsDone, topics, settings, auth, cloud.user, uid, pushNow]);

  // First contact after signing in: decide between the two copies, out loud.
  const reconcile = useCallback(async (sbUser) => {
    const sb = await getSupabase();
    if (!sb || !uid) return;
    setCloud(c => ({ ...c, status: "syncing", error: null }));
    let remote = null;
    try { remote = await cloudLoad(sb, sbUser.id); }
    catch (e) {
      setCloud(c => ({ ...c, status: "error", error: (e && e.message) || "Couldn't reach the cloud" }));
      return;
    }
    const localSnap = collectLocal(uid);
    const finish = () => { cloudRef.current.ready = true; };

    if (!hasData(remote)) {                      // nothing up there yet
      try {
        await cloudSave(sb, sbUser.id, localSnap);
        setCloud(c => ({ ...c, status: "ok", at: Date.now() }));
        showToast("Cloud sync on. This device's progress was uploaded.");
      } catch (e) {
        setCloud(c => ({ ...c, status: "error", error: (e && e.message) || "Upload failed" }));
      }
      return finish();
    }
    if (!hasData(localSnap)) {                   // nothing here yet
      applyLocal(uid, remote);
      setCloud(c => ({ ...c, status: "ok", at: Date.now() }));
      finish();
      showToast("Cloud progress downloaded.");
      setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 600);
      return;
    }
    if (sameData(localSnap, remote)) {           // already identical
      setCloud(c => ({ ...c, status: "ok", at: Date.now() }));
      return finish();
    }
    // Both sides have real work and they differ. Ask; never guess.
    confirmSheet({
      title: "Two sets of progress",
      body: "This device and your cloud account both have progress, and they don't match. " +
            "Nothing has been changed yet. Keeping one replaces the other — there's no way to merge them.",
      confirmLabel: "Use the cloud copy",
      cancelLabel: "Keep this device",
      onConfirm: () => {
        applyLocal(uid, remote);
        setCloud(c => ({ ...c, status: "ok", at: Date.now() }));
        finish();
        showToast("Cloud copy restored.");
        setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 600);
      },
      onCancel: async () => {
        finish();
        const okPush = await pushNow("keep-local");
        if (okPush) showToast("This device's progress is now the cloud copy.");
      },
      // Dismissed without answering. Nothing is chosen and nothing is synced;
      // Settings shows the unresolved state with a way back to this prompt.
      onDismiss: () => {
        setCloud(c => ({ ...c, status: "conflict", error: null }));
      },
    });
  }, [uid, pushNow]);

  // Restore an existing session on load, and follow sign-in/out.
  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = await getSupabase();
      if (!sb || !alive) return;
      try {
        const { data } = await sb.auth.getSession();
        const u = data && data.session && data.session.user;
        if (u && alive) { setCloud(c => ({ ...c, user: u, status: "syncing" })); reconcile(u); }
      } catch (e) {}
      try {
        sb.auth.onAuthStateChange((_evt, session) => {
          if (!alive) return;
          const su = session && session.user;
          if (!su) { cloudRef.current.ready = false; setCloud({ user: null, status: "off", at: null, error: null }); }
        });
      } catch (e) {}
    })();
    return () => { alive = false; };
  }, [reconcile]);

  const cloudSignIn = useCallback(async (email, password) => {
    const sb = await getSupabase();
    if (!sb) return { error: "Couldn't load the sign-in service. Check your connection." };
    const { data, error } = await sb.auth.signInWithPassword({ email: (email || "").trim(), password });
    if (error) return { error: error.message };
    setCloud(c => ({ ...c, user: data.user, status: "syncing", error: null }));
    reconcile(data.user);
    return {};
  }, [reconcile]);

  const cloudSignUp = useCallback(async (email, password) => {
    const sb = await getSupabase();
    if (!sb) return { error: "Couldn't load the sign-in service. Check your connection." };
    const { data, error } = await sb.auth.signUp({ email: (email || "").trim(), password });
    if (error) return { error: error.message };
    if (!data.session) return { needsConfirm: true };   // project requires email confirmation
    setCloud(c => ({ ...c, user: data.user, status: "syncing", error: null }));
    reconcile(data.user);
    return {};
  }, [reconcile]);

  // Study It's sign-in modal offers a magic link and a password reset, so
  // Lectern offers the same two — it is the same account, and finding one app
  // can recover it while another can't would be its own small betrayal.
  const cloudMagicLink = useCallback(async (email) => {
    const sb = await getSupabase();
    if (!sb) return { error: "Couldn't load the sign-in service. Check your connection." };
    const { error } = await sb.auth.signInWithOtp({
      email: (email || "").trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) return { error: error.message };
    return { sent: true };
  }, []);

  const cloudResetPassword = useCallback(async (email) => {
    const sb = await getSupabase();
    if (!sb) return { error: "Couldn't load the sign-in service. Check your connection." };
    const { error } = await sb.auth.resetPasswordForEmail((email || "").trim(), {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (error) return { error: error.message };
    return { sent: true };
  }, []);

  const cloudSignOut = useCallback(async () => {
    const sb = await getSupabase();
    cloudRef.current.ready = false;
    if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
    setCloud({ user: null, status: "off", at: null, error: null });
  }, []);

  // Reopen the conflict prompt after it was dismissed.
  const cloudResolve = useCallback(() => {
    if (cloud.user) reconcile(cloud.user);
  }, [cloud.user, reconcile]);

  const cloudSyncNow = useCallback(async () => {
    const okPush = await pushNow("manual");
    showToast(okPush ? "Synced." : "Sync failed. Your progress is still safe on this device.");
  }, [pushNow]);

  /* AI access.

     Three routes, in order:
       1. The Claude preview host, if the app is running inside one.
       2. The shared Gemini proxy — a Supabase Edge Function that holds ONE
          Gemini key as a server secret. Signing in is what unlocks it, so
          nobody has to find, paste or protect an API key. This is the normal
          path for everyone.
       3. A personal key from Settings, if someone has deliberately set one.
          Kept as an escape hatch: their key, their quota, their choice.

     A browser cannot call Gemini without a key, and a key shipped in front-end
     JavaScript is public — anyone could take it from the bundle and spend it.
     The proxy is the only version of "no keys in the app" that isn't just a
     hidden key. It also meters usage per account per day, so one signed-in
     account can't run up an unbounded bill. */
  const aiAvailable = () =>
    (typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function") ||
    !!cloud.user;

  // Why AI isn't available, in words a learner can act on rather than "no-ai".
  const aiUnavailableReason = () =>
    cloud.user ? "" : "Sign in under Settings → Cloud sync to use the AI teacher. No API key needed.";

  const callModel = async prompt => {
    if (typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function") {
      return window.claude.complete(prompt);
    }

    if (cloud.user) {
      const sb = await getSupabase();
      if (sb) {
        // invoke() attaches the caller's session, which is exactly what the
        // function checks — an anonymous call is refused server-side.
        const { data, error } = await sb.functions.invoke("ai", {
          body: { prompt },
        });
        // A non-2xx comes back as `error`, but the useful message is in the
        // body the function sent, so that is preferred over the generic one.
        const said = data && data.error;
        if (said) throw new Error(said);
        if (error) throw new Error(error.message || "The AI request failed.");
        if (data && data.text) return data.text;
        throw new Error("The AI returned nothing. Try rephrasing.");
      }
    }

    throw new Error(aiUnavailableReason() || "no-ai");
  };

  // Moving between screens has to move the keyboard and screen-reader focus with
  // it, or someone using either is left behind on the page they just left.
  const screenRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const el = screenRef.current;
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
  }, [route.tab, route.scr, route.subj, route.unit]);

  // one place that answers "what does Back do right now?"
  const backAction = () => { if (sheetRef.current) { setSheet(null); return true; } return goBack(); };
  const canGoBack = () => !!sheetRef.current || (route.tab === "learn" && route.scr !== "grid");
  const backRef = useRef(backAction); backRef.current = backAction;
  const canBackRef = useRef(canGoBack); canBackRef.current = canGoBack;

  // hardware / browser Back. One "guard" entry sits on the history stack whenever
  // there is somewhere to go back to; Back consumes it, we navigate, and re-arm.
  // (history.go() is asynchronous, so we never call it — nothing here can race.)
  const armedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.history || !window.history.pushState) return;
    const onPop = () => {
      if (canBackRef.current() && backRef.current()) armedRef.current = false;
      else armedRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !window.history || !window.history.pushState) return;
    if (canGoBack() && !armedRef.current) { try { window.history.pushState({ ba: 1 }, ""); armedRef.current = true; } catch (e) {} }
  }, [route.tab, route.scr, route.subj, route.unit, sheet]);

  // swipe-from-left-edge to go back — the screen follows your finger
  useEffect(() => {
    const sc = scrollRef.current; if (!sc) return;
    let sx = 0, sy = 0, st = 0, armed = false, dragging = false, el = null;
    const clear = () => { if (el) { el.style.transform = ""; el.style.opacity = ""; } sc.classList.remove("dragging"); el = null; dragging = false; };
    const ts = e => {
      if (!e.touches || e.touches.length !== 1) { armed = false; return; }
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
      armed = sx < 44 && canBackRef.current(); dragging = false; el = null;
    };
    const tm = e => {
      if (!armed || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (!dragging) {
        if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { armed = false; return; }
        if (dx < 12) return;
        dragging = true; el = sc.querySelector(".screen"); sc.classList.add("dragging");
      }
      if (el) { const p = Math.max(0, Math.min(dx, 260)); el.style.transform = "translateX(" + p + "px)"; el.style.opacity = String(Math.max(0.4, 1 - p / 420)); }
    };
    const te = e => {
      if (!armed) { clear(); return; }
      armed = false;
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - sx : 0, dy = t ? t.clientY - sy : 0, dt = Date.now() - st;
      const done = (dx > 78 && Math.abs(dy) < 60) || (dx > 40 && dt < 260 && Math.abs(dy) < 50);
      if (!done && dragging) { sc.classList.add("snapback"); setTimeout(() => sc.classList.remove("snapback"), 240); }
      clear();
      if (done && backRef.current()) haptic(8);
    };
    sc.addEventListener("touchstart", ts, { passive: true });
    sc.addEventListener("touchmove", tm, { passive: true });
    sc.addEventListener("touchend", te, { passive: true });
    sc.addEventListener("touchcancel", te, { passive: true });
    return () => { sc.removeEventListener("touchstart", ts); sc.removeEventListener("touchmove", tm); sc.removeEventListener("touchend", te); sc.removeEventListener("touchcancel", te); };
  }, []);

  // Everything the screens are allowed to reach, grouped by what it is for.
  const app = {
    // where we are and how to move
    route, go, openLesson, openStep, backAction,
    // who is signed in
    cur, auth, setAuth, signOut, levelOf, setLevelOf, getProfile, setProfile,
    // the course material
    courseLessons, subjOf, courseSubjects, trackedSubjects, lessonsIn, topics, setTopics,
    added, addLessons, clearAdded, addedCount, builtInCount, activity,
    isSaved, toggleSaved, savedList, clearSubject, restoreSubject, subjectHasWork,
    classOf, isStepDone, markStep, stepsDoneIn, firstUnfinishedStep,
    // what they have done
    prog, sched, last, isDone, doneCount, totalDone, totalLessons,
    firstIncomplete, nextLesson, dueIds, weakIds, exFromId, recordReview, markDone,
    // notes, saved practice positions and backups
    getNote, setNote, noteList, deckLoad, deckSave, deckClear,
    buildBackup, readBackup, applyBackup, exportBackup,
    // preferences and the AI
    settings, setSettings, knownContext, aiAvailable, callModel, aiUnavailableReason,
    // talking to the person
    showToast, openSheet, closeSheet, confirmSheet, showConfetti, openIntro,
    // installing to the home screen
    installReady, promptInstall, isStandalone, isIOS,
    // cloud sync (optional; local storage is still the source of truth)
    cloud, cloudSignIn, cloudSignUp, cloudSignOut, cloudSyncNow, cloudResolve,
    cloudMagicLink, cloudResetPassword,
    // The hub: how to reach the other apps that ship in this same deploy, each
    // one route away. Undefined when Lectern runs standalone, and both the
    // doors and the switcher drop a door in that case rather than showing a
    // button that does nothing.
    onOpenStudyIt, onOpenMathema, onOpenElements
  };

  const d = depthOf(route); const dir = d > depthRef.current ? "fwd" : d < depthRef.current ? "back" : "fade"; depthRef.current = d;
  // Going back restores the reading position; anything else starts at the top.
  const dirRef = useRef(dir); dirRef.current = dir;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof el.scrollTop !== "number") return;
    const remembered = scrollMemory.current[routeKey(route)];
    const target = dirRef.current === "back" && typeof remembered === "number" ? remembered : 0;
    try { if (el.scrollTo) el.scrollTo(0, target); else el.scrollTop = target; } catch (e) { el.scrollTop = target; }
  }, [route.tab, route.scr, route.subj, route.unit, route.step]);

  let screen = null;
  if (route.tab === "home") screen = <Dashboard app={app} />;
  else if (route.tab === "progress") screen = <ProgressScreen app={app} />;
  else if (route.tab === "settings") screen = <SettingsScreen app={app} />;
  else if (route.scr === "grid") screen = <Grid app={app} />;
  else if (route.scr === "generate") screen = <Generate app={app} />;
  else if (route.scr === "subject") screen = <SubjectPath app={app} />;
  else if (route.scr === "review") screen = <MixedReview app={app} />;
  else if (route.scr === "srs") screen = <DailyReview app={app} />;
  else if (route.scr === "weak") screen = <TroubleSpots app={app} />;
  else if (route.scr === "step") screen = <StepRunner app={app} />;
  else if (route.scr === "done") screen = <Done app={app} />;
  else screen = <Unit app={app} />;

  const accent = (route.tab === "learn" && (route.subj)) ? (subjOf(route.subj) || {}).accent : (route.scr === "generate" ? "#7b61ff" : null);
  const tint = (route.tab === "learn" && (route.subj)) ? (subjOf(route.subj) || {}).tint : (route.scr === "generate" ? "#efeaff" : null);
  const rootStyle = { minHeight: "100vh" };
  if (accent) { rootStyle["--a"] = accent; rootStyle["--a-tint"] = tint; }

  return (
    <>
      <style>{CSS}</style>
      <div className="lectern-root" style={rootStyle}>
        <div className="app">
          <header className="appbar">
            <div className="mk"><Icon name="lectern" size={19} /></div>
            <div className="tiwrap">
              <div className="ti">Lectern</div>
              <div className="tiwhere">{locationLabel(app)}</div>
            </div>
            <div className="rt">
              <AppLauncher app={app} compact />
              {cur && <button className="iconbtn" aria-label="Search everything" title="Search (⌘K)" onClick={() => { haptic(5); setPalette(true); }}><Icon name="learn" size={18} /></button>}
              {cur && <button className="avatar tap" style={{ background: avatarColor(cur.name) }} aria-label="Your account" onClick={() => openSheet({ title: cur.name, body: cur.guest ? "Signed in as a guest on this device." : "Signed in on this device.", items: [
              { icon: "progress", label: "Your progress", on: () => go({ tab: "progress" }) },
              { icon: "settings", label: "Settings", on: () => go({ tab: "settings" }) },
              ...(auth.users.length > 1 ? [{ icon: "switchuser", label: "Switch account", on: () => { signOut(); showToast("Pick an account to continue."); } }] : []),
              { icon: "exit", label: "Sign out", on: () => { signOut(); showToast("Signed out."); } }
            ] })}>{initial(cur.name)}</button>}</div>
          </header>
          {offline && <div className="offbar" role="status">Offline — your lessons still work. AI topics need a connection.</div>}
          <main className="scroll" ref={scrollRef} id="lectern-main">
            <div className={"screen nav-" + dir} ref={screenRef} tabIndex={-1} key={route.tab + "/" + route.scr + "/" + route.subj + "/" + route.unit + "/" + route.step}>
              <ErrorBoundary key={route.tab + route.scr + route.subj + route.unit} onReset={() => go({ tab: "home", scr: "grid" })}>{screen}</ErrorBoundary>
            </div>
          </main>
          <nav className="tabbar">
            {[["home", "Home", "home"], ["learn", "Learn", "learn"], ["progress", "Progress", "progress"], ["settings", "Settings", "settings"]].map(t => (
              <button className={"tab" + (route.tab === t[0] ? " on" : "")} key={t[0]} aria-current={route.tab === t[0] ? "page" : undefined}
                aria-label={t[0] === "home" && dueIds.length > 0 ? t[1] + ", " + dueIds.length + (dueIds.length === 1 ? " review due" : " reviews due") : undefined} onClick={() => { haptic(5); t[0] === "learn" ? go({ tab: "learn", scr: "grid" }) : go({ tab: t[0] }); }}>
                <span className="tic">
                  <Icon name={t[2]} size={21} />
                  {t[0] === "home" && dueIds.length > 0 && (
                    <span className="tbadge" aria-hidden="true">{dueIds.length > 99 ? "99+" : dueIds.length}</span>
                  )}
                </span>
                <span>{t[1]}</span>
              </button>
            ))}
          </nav>
        </div>
        {showIntro && cur && <Intro onDone={closeIntro} />}
        {palette && <CommandPalette app={app} close={() => setPalette(false)} />}
        {confettiKey > 0 && <Confetti trigger={confettiKey} />}
        {sheet && <Sheet sheet={sheet} close={closeSheet} />}
        {toast && <Toast toast={toast} key={toast.k} dismiss={() => setToast(null)} />}
        {!cur && <Auth app={app} />}
        {splash && <Splash />}
      </div>
    </>
  );
}

/* ================= screens ================= */
function Ring({ done, total }) {
  const frac = total ? done / total : 0, r = 42, C = 2 * Math.PI * r, off = C * (1 - frac);
  return (
    <div className="ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--a)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 48 48)" />
      </svg>
      <div className="lab"><div className="num">{Math.round(frac * 100)}%</div><div className="of">{done}/{total}</div></div>
    </div>
  );
}
function SubjectCard({ app, s }) {
  const isCourse = s.kind !== "math" && s.kind !== "music";
  let cls = null;
  if (isCourse) { try { cls = app.classOf(s.id); } catch (e) { cls = null; } }
  const steps = cls ? cls.steps.length : 0;
  let stepsDone = 0;
  if (cls) for (let i = 0; i < steps; i++) if (app.isStepDone(s.id, i)) stepsDone++;
  const chapters = cls ? cls.chapters.length : 0;
  const chaptersDone = cls ? cls.chapters.filter(ch => app.stepsDoneIn(s.id, ch.from, ch.count) === ch.count).length : 0;
  const allDone = isCourse && steps > 0 && stepsDone === steps;
  const pct = steps ? Math.round(stepsDone / steps * 100) : 0;
  return (
    <button className="subj" style={{ "--a": s.accent, "--a-tint": s.tint }} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })}>
      <div className="ic" style={{ background: s.tint }}>{s.icon}</div>
      <div className="nm">{s.name}{allDone && <span className="tick" style={{ color: s.accent }}>✓</span>}</div>
      <div className="bl">{s.blurb || (s.kind === "topic" ? "Made with AI · your topic" : "")}</div>
      {s.kind === "math" ? <div className="ct">{A.MATH.topics.length} topics</div>
        : s.kind === "music" ? <div className="ct">{MUSIC_UNITS.length} units</div>
          : <>
            <div className="ct">
              {stepsDone === 0
                ? chapters + (chapters === 1 ? " chapter" : " chapters")
                : allDone
                  ? "All " + chapters + " chapters done"
                  : chaptersDone + " of " + chapters + " chapters · " + pct + "%"}
            </div>
            <div className="pbar"><i style={{ width: pct + "%", background: s.accent }} /></div>
          </>}
    </button>
  );
}
/* What to do next, in the order a tutor would suggest it — and each suggestion
   carries the reason, so the learner can disagree with it. The order is fixed
   and explainable rather than a score nobody can audit:
     1. reviews that are due, because a memory decays on a schedule
     2. questions repeatedly missed, because they are the actual gaps
     3. the class already in progress, because finishing beats starting
     4. the shortest way back in, when nothing is pressing */
/* A plain name for wherever the learner currently is. Used for the window title
   and the app bar, so the app never claims to be somewhere it isn't. */
function locationLabel(app) {
  const r = app.route;
  if (r.tab === "progress") return "Your progress";
  if (r.tab === "settings") return "Settings";
  if (r.tab === "home") return "Home";
  if (r.tab === "learn") {
    if (r.scr === "grid") return "Subjects";
    if (r.scr === "srs") return "Daily review";
    if (r.scr === "weak") return "Trouble spots";
    if (r.scr === "generate") return "New topic";
    const sub = r.subj ? app.subjOf(r.subj) : null;
    if (!sub) return "Subjects";
    if (r.scr === "subject") return sub.name;
    let cls = null;
    try { cls = app.classOf(sub.id); } catch (e) { cls = null; }
    const st = cls && cls.steps[r.step != null ? r.step : r.unit];
    if (st && st.chapter) return st.chapter.title + " · " + sub.name;
    return sub.name;
  }
  return "Lectern";
}
function greetingFor(d) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function recommendNext(app) {
  const out = [];
  const due = app.dueIds.length;
  if (due > 0) {
    out.push({
      id: "review", accent: "#e64980", tint: "#ffe1ef", icon: "review",
      title: "Daily review",
      detail: due === 1 ? "1 question is due" : due + " questions are due",
      why: "Due now — reviewing today holds it longer than reviewing tomorrow.",
      on: () => app.go({ tab: "learn", scr: "srs" })
    });
  }
  const weak = app.weakIds.length;
  if (weak > 0) {
    out.push({
      id: "weak", accent: "#f08c00", tint: "#fff0d6", icon: "target",
      title: "Trouble spots",
      detail: weak === 1 ? "1 question you keep missing" : weak + " questions you keep missing",
      why: "You've got each of these wrong more than once, so they're worth more than new material.",
      on: () => app.go({ tab: "learn", scr: "weak" })
    });
  }
  // the class in progress: partly done, and the nearest to finishing
  let best = null;
  (app.trackedSubjects || []).forEach(sub => {
    let cls = null;
    try { cls = app.classOf(sub.id); } catch (e) { return; }
    if (!cls || !cls.steps.length) return;
    let doneHere = 0;
    for (let i = 0; i < cls.steps.length; i++) if (app.isStepDone(sub.id, i)) doneHere++;
    if (doneHere === 0 || doneHere === cls.steps.length) return;
    const left = cls.steps.length - doneHere;
    if (!best || left < best.left) best = { sub: sub, cls: cls, left: left, done: doneHere };
  });
  if (best) {
    // Point at the chapter they are actually inside, not the whole subject —
    // "63 steps left" is a wall; "4 steps left in this chapter" is a decision.
    const at = app.firstUnfinishedStep(best.sub.id, best.cls);
    const ch = best.cls.chapters.filter(c => at >= c.from && at < c.from + c.count)[0] || best.cls.chapters[0];
    const chLeft = [];
    for (let i = ch.from; i < ch.from + ch.count; i++) if (!app.isStepDone(best.sub.id, i)) chLeft.push(best.cls.steps[i]);
    const pct = Math.round(best.done / best.cls.steps.length * 100);
    out.push({
      id: "continue", accent: best.sub.accent, tint: best.sub.tint, glyph: best.sub.icon,
      title: "Continue " + best.sub.name,
      detail: ch.title + " · " + chLeft.length + (chLeft.length === 1 ? " step left · " : " steps left · ") + minutesLabel(estimateMinutes(chLeft)),
      why: "You're part way through this chapter" + (pct >= 5 ? ", and " + pct + "% through " + best.sub.name : "") + ".",
      on: () => app.openStep(best.sub.id, at)
    });
  }
  if (out.length < 2) {
    // nothing in flight: offer the shortest way in
    let shortest = null;
    (app.trackedSubjects || []).forEach(sub => {
      let cls = null;
      try { cls = app.classOf(sub.id); } catch (e) { return; }
      if (!cls || !cls.chapters.length) return;
      let started = false;
      for (let i = 0; i < cls.steps.length; i++) if (app.isStepDone(sub.id, i)) { started = true; break; }
      if (started) return;
      const ch = cls.chapters[0];
      const mins = estimateMinutes(cls.steps.slice(ch.from, ch.from + ch.count));
      if (!shortest || mins < shortest.mins) shortest = { sub: sub, ch: ch, mins: mins };
    });
    if (shortest) {
      out.push({
        id: "start", accent: shortest.sub.accent, tint: shortest.sub.tint, glyph: shortest.sub.icon,
        title: "Start " + shortest.sub.name,
        detail: shortest.ch.title + " · " + minutesLabel(shortest.mins),
        why: "The shortest first chapter of anything you haven't opened yet.",
        on: () => app.openStep(shortest.sub.id, shortest.ch.from)
      });
    }
  }
  return out.slice(0, 3);
}
function NextUp({ app }) {
  const picks = recommendNext(app);
  if (!picks.length) return null;
  return (
    <div className="nextup">
      <div className="secttl">Up next</div>
      {picks.map((p, i) => (
        <button className={i === 0 ? "cont rec lead" : "cont rec"} key={p.id}
          style={{ "--a": p.accent, "--a-tint": p.tint }}
          onClick={() => { haptic(6); p.on(); }}>
          <div className="cic" style={{ background: p.tint, color: p.accent }}>{p.icon ? <Icon name={p.icon} size={19} /> : p.glyph}</div>
          <div className="recmid">
            <div className="cl">{p.title}</div>
            <div className="ct2">{p.detail}</div>
            <div className="recwhy">{p.why}</div>
          </div>
          <div className="go2">›</div>
        </button>
      ))}
    </div>
  );
}
function Dashboard({ app }) {
  const done = app.totalDone, total = app.totalLessons;
  let target = null, label = "Continue";
  if (app.last && app.subjOf(app.last.subj) && app.courseLessons(app.last.subj)[app.last.unit]) target = app.last;
  else { target = app.nextLesson(); label = "Start learning"; }
  const nDue = app.dueIds.length;
  return (
    <div>
      <div className="hero">
        <div className="txt">
          <h1 className="hi2">{greetingFor(new Date())}{app.cur ? ", " + app.cur.name : ""}</h1>
          <div className="p2">{done === 0 ? "Pick a subject below to begin." : done === total ? "Every chapter complete." : done + " of " + total + " chapters complete."}</div>
        </div>
        <Ring done={done} total={total} />
      </div>
      <NextUp app={app} />
      {app.weakIds.length > 0 && (
        <button className="cont" style={{ "--a": "#f08c00", "--a-tint": "#fff0d6" }} onClick={() => { haptic(6); app.go({ tab: "learn", scr: "weak" }); }}>
          <div className="cic" style={{ background: "#fff0d6" }}>🎯</div>
          <div><div className="cl">Trouble spots</div><div className="ct2">{app.weakIds.length === 1 ? "1 question you keep missing" : app.weakIds.length + " questions you keep missing"}</div><div className="cs">Practice just those</div></div>
          <div className="go2">›</div>
        </button>
      )}
      {target && (() => { const s = app.subjOf(target.subj), u = app.courseLessons(target.subj)[target.unit]; return (
        <button className="cont" style={{ "--a": s.accent, "--a-tint": s.tint }} onClick={() => app.openLesson(target.subj, target.unit)}>
          <div className="cic" style={{ background: s.tint }}>{s.icon}</div>
          <div><div className="cl">{label}</div><div className="ct2">{u.title}</div><div className="cs">{s.name}</div></div>
          <div className="go2">›</div>
        </button>
      ); })()}
      <div className="secttl">Jump into a subject</div>
      <div className="grid">{A.SUBJECTS.slice(0, 6).map(s => <SubjectCard app={app} s={s} key={s.id} />)}</div>
      <div style={{ textAlign: "center" }}><button className="linkbtn" onClick={() => app.go({ tab: "learn", scr: "grid" })}>See all {A.SUBJECTS.length} subjects →</button></div>
      <AppDoors app={app} />
    </div>
  );
}
/* The hub. Lectern's home screen is also the front door to the other apps.
   An internal door changes route inside this same deploy; an external door is
   a real link that leaves the site in a new tab. They are deliberately
   different elements so the browser treats each correctly, and they carry
   different arrows so the difference is visible: › goes further in, ↗ leaves. */
/* Cross-app switcher, always on screen.

   The doors on the Home dashboard are the browsable version — icon, blurb,
   tags. This is the persistent one: it sits in the header on every tab and on
   the sign-in screen, so there is never a state where you can see Lectern but
   can't reach the other two apps.

   Same rules as the doors: an internal app is a <button> (it changes route in
   this deploy), an external one is a real <a target="_blank"> so long-press and
   cmd-click work. A door with nowhere to go is dropped, not shown greyed out. */
/* The apps launcher.

   One control, not one button per app. With four apps a row of cross-links was
   already crowding the header on a phone, and it gets worse with every app
   added — five apps means four buttons in every header, twenty links across
   the suite. A launcher is one button everywhere, and adding an app changes
   nothing but the list inside it.

   The rules the doors follow apply here too: an app in this same deploy is a
   <button> because it changes route, an app on its own deploy is a real <a>
   so long-press and cmd-click work, and an app with nowhere to go is left out
   rather than shown greyed. */
function AppLauncher({ app, compact }) {
  const handlers = { studyit: app && app.onOpenStudyIt, mathema: app && app.onOpenMathema, elements: app && app.onOpenElements };
  const doors = openDoors(handlers);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on Escape and on a click outside — a menu that can only be dismissed
  // by choosing something is a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [open]);

  if (doors.length === 0) return null;

  return (
    <div className={"applauncher" + (compact ? " compact" : "")} ref={wrapRef}>
      <button className="alkbtn" type="button" aria-haspopup="menu" aria-expanded={open ? "true" : "false"}
        aria-label="Switch app" title="Switch app"
        onClick={() => { haptic(6); setOpen(!open); }}>
        <span className="alkgrid" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <span className="alklb">Apps</span>
      </button>

      {open && (
        <div className="alkmenu" role="menu">
          <div className="alkhead">Go to</div>
          {doors.map(d => d.internal ? (
            <button className="alkitem" key={d.id} type="button" role="menuitem"
              style={{ "--a": d.accent, "--a-tint": d.tint }}
              onClick={() => { haptic(6); setOpen(false); handlers[d.id](); }}>
              <span className="alkic" aria-hidden="true">{d.icon}</span>
              <span className="alktx"><b>{d.name}</b><em>{d.blurb}</em></span>
              <span className="alkgo" aria-hidden="true">{"\u203a"}</span>
            </button>
          ) : (
            <a className="alkitem" key={d.id} role="menuitem" href={d.url}
              target="_blank" rel="noopener noreferrer"
              style={{ "--a": d.accent, "--a-tint": d.tint }}
              aria-label={"Open " + d.name + " — opens in a new tab"}
              onClick={() => { haptic(6); setOpen(false); }}>
              <span className="alkic" aria-hidden="true">{d.icon}</span>
              <span className="alktx"><b>{d.name}</b><em>{d.blurb}</em></span>
              <span className="alkgo" aria-hidden="true">{"\u2197"}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AppDoors({ app }) {
  const handlers = { studyit: app.onOpenStudyIt, mathema: app.onOpenMathema, elements: app.onOpenElements };
  const doors = openDoors(handlers);
  if (doors.length === 0) return null;
  const inner = d => (
    <>
      <div className="cic" style={{ background: d.tint }} aria-hidden="true">{d.icon}</div>
      <div>
        <div className="cl">{d.kicker}</div>
        <div className="ct2">{d.name}</div>
        <div className="cs">{d.blurb}</div>
      </div>
      <div className="go2" aria-hidden="true">{d.internal ? "\u203a" : "\u2197"}</div>
    </>
  );
  return (
    <div>
      <div className="secttl">Your other apps</div>
      {doors.map(d => d.internal ? (
        <button className="cont door" key={d.id} type="button"
          style={{ "--a": d.accent, "--a-tint": d.tint }}
          aria-label={"Open " + d.name}
          title={"Open " + d.name}
          onClick={() => { haptic(6); handlers[d.id](); }}>
          {inner(d)}
        </button>
      ) : (
        <a className="cont door" key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
          style={{ "--a": d.accent, "--a-tint": d.tint }}
          aria-label={"Open " + d.name + " — opens in a new tab"}
          title={"Open " + d.name + " in a new tab"}
          onClick={() => haptic(6)}>
          {inner(d)}
        </a>
      ))}
      <div className="doornote">
        {doors.some(d => !d.internal)
          ? "CodeQuest opens in a new tab. Your Lectern progress stays here."
          : "Your Lectern progress stays here."}
      </div>
    </div>
  );
}
/* search across subject names and lesson titles, accent- and case-insensitive */
function searchLearn(app, q) {
  const nq = A.norm(q);
  if (!nq) return null;
  const subjects = [], lessons = [];
  const all = A.SUBJECTS.concat((app.topics || []).map(t => app.subjOf(t.id)).filter(Boolean));
  all.forEach(sub => {
    if (A.norm(sub.name).indexOf(nq) >= 0) subjects.push(sub);
    const L = app.courseLessons(sub.id) || [];
    L.forEach((u, i) => { if (u && u.title && A.norm(u.title).indexOf(nq) >= 0) lessons.push({ sub: sub, i: i, title: u.title }); });
  });
  return { subjects: subjects, lessons: lessons, count: subjects.length + lessons.length };
}
function Grid({ app }) {
  const [q, setQ] = useState("");
  const res = searchLearn(app, q);
  return (
    <div>
      <h1>Subjects</h1>
      <div className="sub">Ten subjects to explore — or create your own with AI.</div>
      <div className="searchrow">
        <span className="searchic" aria-hidden="true">🔎</span>
        <input className="searchbox" type="search" aria-label="Search subjects and lessons"
          placeholder="Search subjects and lessons…" autoComplete="off" autoCorrect="off" spellCheck={false}
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") setQ(""); }} />
        {q ? <button className="searchclear" aria-label="Clear search" onClick={() => setQ("")}>✕</button> : null}
      </div>
      {res ? (
        <div>
          <div className="secttl">{res.count === 0 ? "No matches" : res.count + (res.count === 1 ? " match" : " matches")}</div>
          {res.count === 0 && <div className="sub">Nothing matches “{q}”. Try a subject name like Spanish, or part of a lesson title.</div>}
          {res.subjects.map(sub => (
            <button className="cont" key={"s" + sub.id} style={{ "--a": sub.accent, "--a-tint": sub.tint }}
              onClick={() => { haptic(6); app.go({ tab: "learn", scr: "subject", subj: sub.id }); }}>
              <div className="cic" style={{ background: sub.tint }}>{sub.icon}</div>
              <div><div className="cl">{sub.name}</div><div className="cs">Subject</div></div>
              <div className="go2">›</div>
            </button>
          ))}
          {res.lessons.map(m => (
            <button className="cont" key={"l" + m.sub.id + m.i} style={{ "--a": m.sub.accent, "--a-tint": m.sub.tint }}
              onClick={() => { haptic(6); app.openLesson(m.sub.id, m.i); }}>
              <div className="cic" style={{ background: m.sub.tint }}>{m.sub.icon}</div>
              <div><div className="cl">{m.title}</div><div className="cs">{m.sub.name}{app.isDone(m.sub.id, m.i) ? " · done" : ""}</div></div>
              <div className="go2">›</div>
            </button>
          ))}
        </div>
      ) : (
      <div>
      <div className="grid" style={{ marginTop: 14 }}>
        <button className="subj create" style={{ "--a": "#7b61ff", "--a-tint": "#efeaff" }} onClick={() => app.go({ tab: "learn", scr: "generate" })}>
          <div className="ic" style={{ background: "#efeaff" }}>✨</div>
          <div className="nm">Create a topic</div><div className="bl">Type any topic and let AI build a set of chapters</div><div className="ct">Powered by AI</div>
        </button>
        {app.topics.map(t => <SubjectCard app={app} s={app.subjOf(t.id)} key={t.id} />)}
      </div>
      <div className="secttl">All subjects</div>
      <div className="grid" style={{ marginTop: 6 }}>{A.SUBJECTS.map(s => <SubjectCard app={app} s={s} key={s.id} />)}</div>
      </div>
      )}
    </div>
  );
}
function Lesson({ teach }) {
  return <div className="card"><span className="kicker">Lesson</span><div className="lesson">{teach.map((p, i) => <p key={i}>{p}</p>)}</div></div>;
}
function Back({ label, onClick }) { return <button className="back" onClick={onClick}>‹ {label}</button>; }
function SubjectPath({ app }) {
  const s = app.subjOf(app.route.subj);
  if (!s) return null;
  if (s.kind === "math") return <SimplePath app={app} s={s} items={A.MATH.topics.map(t => ({ t: t.name, s: "lesson + practice" }))} />;
  if (s.kind === "music") return <SimplePath app={app} s={s} items={MUSIC_UNITS} />;
  const units = app.courseLessons(s.id);
  const allQ = units.reduce((a, u) => a + u.ex.length, 0);
  return (
    <div>
      <Back label="Subjects" onClick={() => app.go({ tab: "learn", scr: "grid" })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>{s.name}</h1></div>
      <div className="sub">{s.blurb || (s.kind === "topic" ? "A topic you created with AI" : "")}</div>
      <div className="famrow" style={{ "--a": s.accent, "--a-tint": s.tint }}>
        <span className="famq">How much do you already know in {s.name}?</span>
        <div className="segs" style={{ margin: "8px 0 0" }}>
          {A.PROFILE_PRESETS.map(o => (
            <button className={"seg" + (app.levelOf(s.id) === o.id ? " on" : "")} key={o.id} title={o.label} onClick={() => { app.setLevelOf(s.id, o.id); haptic(6); }}>{o.short}</button>
          ))}
        </div>
        <div className="famhint">This tunes any AI lessons you make for this subject — it doesn't change the built-in lessons below.</div>
      </div>
      <ClassChapters app={app} s={s} />
      <div className="stop review" style={{ marginTop: 18 }} onClick={() => app.go({ tab: "learn", scr: "review", subj: s.id })}>
        <div className="node">🔀</div><div><div className="st">Mixed Review</div><div className="ss">All {allQ} questions, shuffled</div></div>
      </div>
      <div className="card" style={{ "--a": s.accent, "--a-tint": s.tint }}>
        <span className="kicker">More {s.name}</span>
        <div className="setdesc" style={{ margin: "4px 0 12px" }}>
          {s.kind === "topic"
            ? "Add another set of lessons to " + s.name + ". The AI is told what this topic already covers, so it builds on it instead of repeating it."
            : "Ask for a topic within " + s.name + " — anything the built-in lessons don't cover. The new lessons are added to this subject, below the ones already here."}
        </div>
        <button className="btn go" onClick={() => app.go({ tab: "learn", scr: "generate", subj: s.id })}>
          {s.kind === "topic" ? "Add more chapters" : "Add a topic to " + s.name}
        </button>
        {app.subjectHasWork(s.id) && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button className="linkbtn" onClick={() => app.confirmSheet({
              title: "Start " + s.name + " over?",
              body: "Your progress, notes and saved steps for " + s.name + " will be cleared. Every other subject is untouched, and you can undo this straight after.",
              confirmLabel: "Start over", danger: true,
              onConfirm: () => {
                const removed = app.clearSubject(s.id);
                app.showToast(s.name + " reset.", { label: "Undo", on: () => { app.restoreSubject(removed); app.showToast(s.name + " restored."); } });
              }
            })}>Start {s.name} over</button>
          </div>
        )}
        {s.kind !== "topic" && app.addedCount(s.id) > 0 && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button className="linkbtn" onClick={() => app.confirmSheet({
              title: "Remove the lessons you added?",
              body: app.addedCount(s.id) === 1
                ? "The 1 lesson you generated for " + s.name + " will be removed. The built-in lessons are untouched."
                : "The " + app.addedCount(s.id) + " lessons you generated for " + s.name + " will be removed. The built-in lessons are untouched.",
              confirmLabel: "Remove them", danger: true,
              onConfirm: () => {
                const removed = (app.added[s.id] || []).slice();
                app.clearAdded(s.id);
                app.showToast("Removed.", { label: "Undo", on: () => { app.addLessons(s.id, removed); app.showToast("Put back."); } });
              }
            })}>Remove the {app.addedCount(s.id) === 1 ? "lesson" : app.addedCount(s.id) + " lessons"} you added</button>
          </div>
        )}
      </div>
      {s.kind === "topic" && <div style={{ textAlign: "center" }}><button className="linkbtn" onClick={() => app.confirmSheet({
        title: "Delete this topic?",
        body: '"' + s.name + '" and its lessons will be removed from this device. This can\'t be undone.',
        confirmLabel: "Delete topic", danger: true,
        onConfirm: () => {
          const removed = app.topics.find(t => t.id === s.id);
          const at = app.topics.findIndex(t => t.id === s.id);
          app.setTopics(app.topics.filter(t => t.id !== s.id));
          app.go({ tab: "learn", scr: "grid" });
          app.showToast("Topic deleted.", removed ? { label: "Undo", on: () => { app.setTopics(list => { const nx = list.slice(); nx.splice(Math.max(0, at), 0, removed); return nx; }); app.showToast("Topic restored."); } } : null);
        }
      })}>Delete this topic</button></div>}
    </div>
  );
}
/* The class laid out as chapters, each chapter its own row of steps. This is
   the map of the subject: what it covers, how far in you are, where to resume. */
function ClassChapters({ app, s }) {
  const cls = app.classOf(s.id);
  const resume = app.firstUnfinishedStep(s.id, cls);
  const totalDone = cls.steps.reduce((a, _, i) => a + (app.isStepDone(s.id, i) ? 1 : 0), 0);
  const [open, setOpen] = useState(() => {
    const at = cls.steps[resume];
    return at ? at.chapter.lesson : 0;
  });
  return (
    <div>
      <div className="clsbar">
        <div className="progbar" role="progressbar" aria-valuemin={0} aria-valuemax={cls.steps.length} aria-valuenow={totalDone} aria-label={"Progress through " + s.name}>
          <i style={{ width: (cls.steps.length ? (totalDone / cls.steps.length) * 100 : 0) + "%" }} />
        </div>
        <div className="prog">{totalDone} / {cls.steps.length} steps</div>
      </div>
      {cls.steps.length > 0 && (
        <button className="btn go big" onClick={() => app.openStep(s.id, resume)}>
          {totalDone === 0 ? "Start " + s.name + " \u203a" : totalDone === cls.steps.length ? "Practice again \u203a" : "Continue \u203a"}
        </button>
      )}
      {totalDone < cls.steps.length && (
        <div className="clsest">
          {cls.steps.length - totalDone} step{cls.steps.length - totalDone === 1 ? "" : "s"} left · {minutesLabel(estimateMinutes(cls.steps.filter((_, i) => !app.isStepDone(s.id, i))))} at an unhurried pace
        </div>
      )}
      {cls.chapters.map(ch => {
        const doneHere = app.stepsDoneIn(s.id, ch.from, ch.count);
        const isOpen = open === ch.lesson;
        const complete = doneHere === ch.count;
        return (
          <div className={"chap" + (isOpen ? " open" : "")} key={ch.lesson}>
            <button className="chaphd" aria-expanded={isOpen} onClick={() => { haptic(5); setOpen(isOpen ? -1 : ch.lesson); }}>
              <span className={"chapno" + (complete ? " done" : "")}>{complete ? "\u2713" : ch.no}</span>
              <span className="chapmid">
                <span className="chapttl">{ch.title}</span>
                <span className="chapsub">
                  {doneHere} of {ch.count} steps
                  {complete
                    ? " \u00b7 finished"
                    : " \u00b7 " + minutesLabel(estimateMinutes(cls.steps.slice(ch.from + doneHere, ch.from + ch.count))) + (doneHere ? " left" : "")}
                </span>
              </span>
              <span className="chapchev">{isOpen ? "\u2304" : "\u203a"}</span>
            </button>
            {isOpen && (
              <div className="chapsteps">
                {Array.from({ length: ch.count }, (_, k) => ch.from + k).map(i => {
                  const st = cls.steps[i], look = STEP_LOOK[st.type], sdone = app.isStepDone(s.id, i);
                  return (
                    <button className={"stprow" + (sdone ? " done" : "") + (i === resume ? " next" : "")} key={i} onClick={() => app.openStep(s.id, i)}>
                      <span className="stpic">{sdone ? "\u2713" : look.icon}</span>
                      <span className="stpmid">
                        <span className="stpttl">{st.type === "concept" ? st.title + (st.parts > 1 ? " \u00b7 part " + st.part : "") : st.item.ask}</span>
                        <span className="stpkind">{look.label}</span>
                      </span>
                      {i === resume && <span className="badge">NEXT</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* One step, filling the screen, with the class's progress along the top. */
function StepRunner({ app }) {
  const s = app.subjOf(app.route.subj);
  const cls = app.classOf(s.id);
  const i = Math.max(0, Math.min(app.route.step || 0, cls.steps.length - 1));
  const step = cls.steps[i];
  const scrollTop = () => { try { window.scrollTo(0, 0); } catch (e) {} };
  useEffect(scrollTop, [i]);
  if (!step) return null;
  const ch = step.chapter;
  const doneHere = app.stepsDoneIn(s.id, ch.from, ch.count);
  const isLast = i >= cls.steps.length - 1;
  const chapterEndsHere = i === ch.from + ch.count - 1;
  const advance = () => {
    app.markStep(s.id, i, cls);
    if (chapterEndsHere) { app.go({ tab: "learn", scr: "done", subj: s.id, unit: ch.lesson }); return; }
    if (isLast) { app.go({ tab: "learn", scr: "subject", subj: s.id }); return; }
    app.openStep(s.id, i + 1);
  };
  const answer = ok => { if (step.ex !== undefined) app.recordReview(s.id + "/" + step.lesson + "/" + step.ex, ok); };
  return (
    <div>
      <Back label={s.name} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })} />
      <StepKeys app={app} subj={s.id} index={i}
        canAdvance={app.isStepDone(s.id, i)}
        onPrev={() => app.openStep(s.id, i - 1)}
        onNext={() => (i < cls.steps.length - 1 ? app.openStep(s.id, i + 1) : advance())} />
      <div className="stephd">
        <div className="stepchaprow">
          <div className="stepchap">{ch.no} · {ch.title}</div>
          <button className={"savebtn" + (app.isSaved(s.id, i) ? " on" : "")}
            aria-pressed={app.isSaved(s.id, i)}
            aria-label={app.isSaved(s.id, i) ? "Remove this step from Saved" : "Save this step to come back to"}
            title={app.isSaved(s.id, i) ? "Saved" : "Save for later"}
            onClick={() => {
              haptic(5);
              const now = !app.isSaved(s.id, i);
              app.toggleSaved(s.id, i);
              app.showToast(now ? "Saved. Find it under Progress." : "Removed from Saved.");
            }}>
            <Icon name="note" size={17} />
          </button>
        </div>
        <div className="progwrap">
          <div className="progbar" role="progressbar" aria-valuemin={0} aria-valuemax={ch.count} aria-valuenow={doneHere} aria-label={"Progress through " + ch.title}>
            <i style={{ width: (ch.count ? (doneHere / ch.count) * 100 : 0) + "%" }} />
          </div>
          <div className="prog">{i - ch.from + 1} of {ch.count}</div>
        </div>
      </div>
      {step.type === "concept"
        ? <ConceptStep step={step} done={app.isStepDone(s.id, i)} onDone={advance} />
        : <QuestionStep step={step} speakSubj={s.id} onAnswer={answer} onDone={advance} done={app.isStepDone(s.id, i)} />}
      <div className="steprow">
        {i > 0 && <button className="linkbtn" onClick={() => app.openStep(s.id, i - 1)}>‹ Previous step</button>}
        <span className="spacer" />
        {!app.isStepDone(s.id, i) && step.type !== "concept" &&
          <button className="linkbtn" onClick={() => { app.markStep(s.id, i, cls); app.openStep(s.id, Math.min(i + 1, cls.steps.length - 1)); }}>Skip this one</button>}
      </div>
      <NotesCard app={app} noteKey={s.id + "/" + step.lesson} />
      <AITeacher teach={(app.courseLessons(s.id)[step.lesson] || {}).teach || []} title={ch.title} aiAvailable={app.aiAvailable} callModel={app.callModel} aiUnavailableReason={app.aiUnavailableReason} />
    </div>
  );
}
function SimplePath({ app, s, items }) {
  return (
    <div>
      <Back label="Subjects" onClick={() => app.go({ tab: "learn", scr: "grid" })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>{s.name}</h1></div>
      <div className="sub">{s.blurb}</div>
      <div className="path" style={{ marginTop: 14 }}>
        {items.map((it, i) => (
          <div className="stop" key={i} onClick={() => app.go({ tab: "learn", scr: "unit", subj: s.id, unit: i })}>
            <div className="node">{i + 1}</div><div><div className="st">{it.t}</div><div className="ss">{it.s}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
/* your own notes on a lesson — plain, private, saved on this device */
function NotesCard({ app, noteKey }) {
  const saved = app.getNote(noteKey);
  const [text, setText] = useState(saved);
  const [open, setOpen] = useState(!!saved);
  const tRef = useRef(null);
  useEffect(() => { setText(app.getNote(noteKey)); setOpen(!!app.getNote(noteKey)); }, [noteKey]);
  useEffect(() => () => { if (tRef.current) clearTimeout(tRef.current); }, []);
  const change = v => {
    setText(v);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => app.setNote(noteKey, v), 400);
  };
  return (
    <div className="card">
      <span className="kicker">Your notes</span>
      {open ? (
        <>
          <div className="setdesc" style={{ margin: "4px 0 10px" }}>Anything you want to remember about this lesson. Saved on this device as you type.</div>
          <textarea className="ans" aria-label="Your notes for this lesson" placeholder="e.g. -ar verbs drop the -ar and add -o for I…" value={text} onChange={e => change(e.target.value)} />
          {text.trim() ? <div className="row" style={{ marginTop: 8 }}><button className="linkbtn" onClick={() => { change(""); app.showToast("Note cleared."); }}>Clear note</button></div> : null}
        </>
      ) : (
        <button className="btn" style={{ marginTop: 6 }} onClick={() => { haptic(5); setOpen(true); }}>Add a note</button>
      )}
    </div>
  );
}
function Unit({ app }) {
  const s = app.subjOf(app.route.subj);
  if (s.kind === "math") return <MathUnit app={app} s={s} />;
  if (s.kind === "music") return <MusicUnit app={app} s={s} />;
  const u = app.courseLessons(s.id)[app.route.unit];
  return (
    <div>
      <Back label={s.name} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>{u.title}</h1></div>
      <Lesson teach={u.teach} />
      <div className="card"><span className="kicker">Practice</span>
        <Deck exList={u.ex} ids={u.ex.map((_, i) => s.id + "/" + app.route.unit + "/" + i)} speakSubj={s.id}
          saveKey={s.id + "/" + app.route.unit} load={app.deckLoad} save={app.deckSave} clear={app.deckClear}
          seed={(app.route.unit + 1) * 101 + s.id.length * 7 + u.ex.length}
          onAnswer={app.recordReview} onLast={() => app.markDone(s.id, app.route.unit)}
          onFinish={() => app.go({ tab: "learn", scr: "done", subj: s.id, unit: app.route.unit })} />
      </div>
      <NotesCard app={app} noteKey={s.id + "/" + app.route.unit} />
      <AITeacher teach={u.teach} title={u.title} aiAvailable={app.aiAvailable} callModel={app.callModel} aiUnavailableReason={app.aiUnavailableReason} />
    </div>
  );
}
function MixedReview({ app }) {
  const s = app.subjOf(app.route.subj);
  const all = [], ids = [];
  app.courseLessons(s.id).forEach((u, ui) => u.ex.forEach((e, ei) => { all.push(e); ids.push(s.id + "/" + ui + "/" + ei); }));
  return (
    <div>
      <Back label={s.name} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>Mixed Review</h1></div>
      <div className="sub">Every question from {s.name}, shuffled together.</div>
      <div className="card"><span className="kicker">Practice</span>
        <Deck exList={all} ids={ids} speakSubj={s.id} seed={7 + s.id.length * 13 + all.length} onAnswer={app.recordReview} />
      </div>
    </div>
  );
}
function DailyReview({ app }) {
  // Snapshot the queue once. Answering changes the schedule, which would other-
  // wise rebuild this list mid-set and shuffle the questions under your feet.
  const [due] = useState(() => app.dueIds.map(id => ({ id, ex: app.exFromId(id) })).filter(x => x.ex).slice(0, 20));
  return (
    <div>
      <Back label="Home" onClick={() => app.go({ tab: "home" })} />
      <div className="shead"><div className="ic" style={{ background: "#ffe1ef" }}>🔁</div><h1>Daily Review</h1></div>
      {due.length === 0 ? (
        <div><div className="sub">Nothing to review right now — you're all caught up. Finish more lessons and they'll come back here when it's time to refresh them.</div>
          <button className="btn go big" style={{ marginTop: 14 }} onClick={() => app.go({ tab: "home" })}>Back to Home</button></div>
      ) : (
        <div>
          <div className="sub">A quick mix of things you've learned, timed to help them stick. {due.length} to review.</div>
          <div className="card"><span className="kicker">Review</span>
            <Deck exList={due.map(x => x.ex)} ids={due.map(x => x.id)} seed={13 + due.length} onAnswer={app.recordReview} />
          </div>
        </div>
      )}
    </div>
  );
}
function TroubleSpots({ app }) {
  // Frozen for the same reason as Daily Review: answering rewrites the schedule
  // these ids came from, and the set must stay put while you work through it.
  const [items] = useState(() => app.weakIds.map(id => ({ id, ex: app.exFromId(id), st: app.sched[id] })).filter(x => x.ex).slice(0, 20));
  return (
    <div>
      <Back label="Home" onClick={() => app.go({ tab: "home" })} />
      <div className="shead"><div className="ic" style={{ background: "#fff0d6" }}>🎯</div><h1>Trouble Spots</h1></div>
      {items.length === 0 ? (
        <div>
          <div className="sub">Nothing here yet. A question shows up once you've got it wrong more than once — one slip doesn't count.</div>
          <button className="btn go big" style={{ marginTop: 14 }} onClick={() => app.go({ tab: "home" })}>Back to Home</button>
        </div>
      ) : (
        <div>
          <div className="sub">The questions you keep missing, hardest first. {items.length === 1 ? "1 question" : items.length + " questions"}.</div>
          <div className="card"><span className="kicker">Practice</span>
            <Deck exList={items.map(x => x.ex)} ids={items.map(x => x.id)} seed={29 + items.length} onAnswer={app.recordReview} />
          </div>
          <div className="card">
            <span className="kicker">What you're missing</span>
            {items.slice(0, 8).map(x => (
              <div className="weakrow" key={x.id}>
                <div className="weakq">{x.ex.ask}</div>
                <div className="weakn">missed {(app.sched[x.id] || x.st).missed}× of {(app.sched[x.id] || x.st).seen}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Done({ app }) {
  const s = app.subjOf(app.route.subj), units = app.courseLessons(s.id), i = app.route.unit;
  useEffect(() => { sfxDone(); app.showConfetti(); }, []);
  const hasNext = i + 1 < units.length;
  const allDone = app.doneCount(s.id, units.length) === units.length;
  return (
    <div>
      <div className="card done-card">
        <div className="burst"><div className="checkbig">✓</div></div>
        <h1 style={{ textAlign: "center", marginTop: 6 }}>Chapter complete</h1>
        <div className="sub" style={{ textAlign: "center", marginBottom: 6 }}>{units[i].title} · {s.name}</div>
      </div>
      <ChapterSummary app={app} s={s} unit={i} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {hasNext ? <button className="btn go big" onClick={() => app.openLesson(s.id, i + 1)}>
          Next: {units[i + 1].title} · {(() => {
            try {
              const cls = app.classOf(s.id);
              const ch = cls.chapters.filter(c => c.lesson === i + 1)[0];
              return ch ? minutesLabel(estimateMinutes(cls.steps.slice(ch.from, ch.from + ch.count))) : "";
            } catch (e) { return ""; }
          })()} ›
        </button>
          : (allDone && <div className="sub" style={{ textAlign: "center" }}>🎉 You've finished every lesson in {s.name}!</div>)}
        <button className="btn big" onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })}>Back to {s.name}</button>
      </div>
      <div style={{ textAlign: "center" }}><button className="linkbtn" onClick={() => app.openLesson(s.id, i)}>Go through this chapter again</button></div>
    </div>
  );
}
/* What actually happened in this chapter. The numbers come from the review
   record for its questions — a question you have never missed is one you have
   answered right every time it has been asked. Where there is no record yet, the
   screen says so rather than inventing an accuracy figure. */
function ChapterSummary({ app, s, unit }) {
  let cls = null;
  try { cls = app.classOf(s.id); } catch (e) { cls = null; }
  const ch = cls && cls.chapters ? cls.chapters.filter(c => c.lesson === unit)[0] : null;
  if (!ch) return null;

  const questions = [];
  for (let i = ch.from; i < ch.from + ch.count; i++) {
    const st = cls.steps[i];
    if (!st || st.type === "concept" || st.ex === undefined) continue;
    // the same id the runner records against: subject / lesson / exercise
    questions.push({ i: i, step: st, rec: app.sched[s.id + "/" + st.lesson + "/" + st.ex] || null });
  }
  if (!questions.length) return null;

  const answered = questions.filter(q => q.rec && q.rec.seen);
  const clean = answered.filter(q => !(q.rec.missed > 0));
  const missed = answered.filter(q => q.rec.missed > 0);
  const readMins = estimateMinutes(cls.steps.slice(ch.from, ch.from + ch.count));

  return (
    <div className="card summary">
      <span className="kicker">How it went</span>
      <div className="sumrow">
        <div className="sumstat">
          <div className="sumbig">{questions.length}</div>
          <div className="sumlab">{questions.length === 1 ? "question" : "questions"}</div>
        </div>
        <div className="sumstat">
          <div className="sumbig">{answered.length ? clean.length + "/" + answered.length : "—"}</div>
          <div className="sumlab">never missed</div>
        </div>
        <div className="sumstat">
          <div className="sumbig">{readMins}</div>
          <div className="sumlab">min of reading</div>
        </div>
      </div>
      {missed.length > 0 ? (
        <>
          <div className="setdesc" style={{ marginTop: 4 }}>
            {missed.length === 1 ? "One question here has tripped you up." : missed.length + " questions here have tripped you up."} They'll come back in review, sooner than the rest.
          </div>
          <ul className="summiss">
            {missed.slice(0, 4).map(q => <li key={q.i}>{(q.step.item && q.step.item.ask) || q.step.title}</li>)}
          </ul>
        </>
      ) : answered.length === questions.length ? (
        <div className="setdesc" style={{ marginTop: 4 }}>Every question here answered without a miss. They'll come back on a longer schedule.</div>
      ) : (
        <div className="setdesc" style={{ marginTop: 4 }}>Some of these haven't been asked yet — they'll appear in review over the next few days.</div>
      )}
    </div>
  );
}
/* A learner's record, counted the same way everywhere: chapters finished,
   steps taken, and how the questions have actually gone. Nothing here is
   estimated — every figure is a count of something that happened. */
/* ---------- charts ----------
   Hand-drawn SVG so the app stays one file with one dependency. Each one plots
   a count, never a projection, and each says plainly when it has no data. */
function BarChart({ bars, max, height = 96, label }) {
  const top = Math.max(1, max || Math.max.apply(null, bars.map(b => b.v).concat([1])));
  const w = 100 / Math.max(1, bars.length);
  return (
    <div className="chart" role="img" aria-label={label}>
      <svg viewBox={"0 0 100 " + height} preserveAspectRatio="none" style={{ height: height, width: "100%" }}>
        {bars.map((b, i) => {
          const h = b.v > 0 ? Math.max(2, (b.v / top) * (height - 16)) : 0;
          return (
            <g key={i}>
              <rect x={i * w + w * 0.18} y={height - 14 - h} width={w * 0.64} height={h}
                rx={Math.min(1.6, w * 0.3)} fill={b.v > 0 ? "var(--a)" : "var(--line)"} opacity={b.v > 0 ? 1 : 0.75}>
                <title>{b.title}</title>
              </rect>
              {b.v === 0 && <rect x={i * w + w * 0.18} y={height - 16} width={w * 0.64} height="2" rx="1" fill="var(--line)" />}
            </g>
          );
        })}
      </svg>
      <div className="chartx">{bars.map((b, i) => <span key={i} className={b.mark ? "on" : ""}>{b.label}</span>)}</div>
    </div>
  );
}
function Donut({ part, whole, caption }) {
  const r = 32, c = 2 * Math.PI * r;
  const frac = whole ? Math.max(0, Math.min(1, part / whole)) : 0;
  return (
    <div className="donut">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={caption}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        {whole > 0 && (
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--a)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 42 42)" />
        )}
        <text x="42" y="46" textAnchor="middle" className="donuttext">{whole ? Math.round(frac * 100) + "%" : "—"}</text>
      </svg>
      <div className="donutcap">{caption}</div>
    </div>
  );
}
function lastDays(activity, days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayStamp(d);
    const v = (activity && activity[key]) || 0;
    out.push({
      v: v,
      label: "SMTWTFS".charAt(d.getDay()),
      mark: i === 0,
      title: v + (v === 1 ? " step on " : " steps on ") + key
    });
  }
  return out;
}
function reviewForecast(sched, days) {
  const out = [];
  const now = new Date();
  const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOf(now);
  let overdue = 0;
  const buckets = new Array(days).fill(0);
  Object.keys(sched || {}).forEach(k => {
    const r = sched[k];
    if (!r || typeof r.due !== "number") return;
    const dayIndex = Math.floor((startOf(new Date(r.due)) - todayStart) / 86400000);
    if (dayIndex < 0) overdue++;
    else if (dayIndex < days) buckets[dayIndex] += 1;
  });
  buckets[0] += overdue;   // anything overdue is due now
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      v: buckets[i],
      label: i === 0 ? "now" : "SMTWTFS".charAt(d.getDay()),
      mark: i === 0,
      title: buckets[i] + (buckets[i] === 1 ? " review " : " reviews ") + (i === 0 ? "due now" : "on " + dayStamp(d))
    });
  }
  return out;
}
function studyRecord(app) {
  const subjects = [];
  let steps = 0, stepsDone = 0, chapters = 0, chaptersDone = 0;
  (app.trackedSubjects || []).forEach(sub => {
    let cls = null;
    try { cls = app.classOf(sub.id); } catch (e) { return; }
    if (!cls || !cls.steps.length) return;
    let doneHere = 0;
    for (let i = 0; i < cls.steps.length; i++) if (app.isStepDone(sub.id, i)) doneHere++;
    const chDone = cls.chapters.filter(ch => app.stepsDoneIn(sub.id, ch.from, ch.count) === ch.count).length;
    steps += cls.steps.length; stepsDone += doneHere;
    chapters += cls.chapters.length; chaptersDone += chDone;
    subjects.push({ sub: sub, cls: cls, steps: cls.steps.length, done: doneHere, chapters: cls.chapters.length, chaptersDone: chDone });
  });
  // question record, from the review schedule
  let asked = 0, clean = 0;
  const sched = app.sched || {};
  Object.keys(sched).forEach(k => {
    const r = sched[k];
    if (!r || !r.seen) return;
    asked++;
    if (!(r.missed > 0)) clean++;
  });
  const started = subjects.filter(x => x.done > 0 && x.done < x.steps).length;
  const finished = subjects.filter(x => x.done === x.steps && x.steps).length;
  return { subjects, steps, stepsDone, chapters, chaptersDone, asked, clean, started, finished };
}
function ProgressScreen({ app }) {
  const rec = studyRecord(app);
  return (
    <div>
      <h1>Your Progress</h1>
      <div className="sub">Counted from what you've actually finished. Nothing here is an estimate.</div>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 680 }}>Overall</div>
          <div className="pc" style={{ color: "var(--ink-faint)", fontSize: 13 }}>
            {rec.chaptersDone} of {rec.chapters} chapters · {rec.stepsDone} of {rec.steps} steps
          </div>
        </div>
        <Ring done={rec.chaptersDone} total={rec.chapters} />
      </div>
      <div className="card summary">
        <span className="kicker">Your record</span>
        <div className="sumrow">
          <div className="sumstat">
            <div className="sumbig">{rec.stepsDone}</div>
            <div className="sumlab">steps taken</div>
          </div>
          <div className="sumstat">
            <div className="sumbig">{rec.asked ? rec.clean + "/" + rec.asked : "—"}</div>
            <div className="sumlab">never missed</div>
          </div>
          <div className="sumstat">
            <div className="sumbig">{rec.started + rec.finished}</div>
            <div className="sumlab">{rec.started + rec.finished === 1 ? "subject open" : "subjects open"}</div>
          </div>
        </div>
        <div className="reccols">
          <Donut part={rec.clean} whole={rec.asked} caption={rec.asked ? "answered without a miss" : "no questions yet"} />
          <Donut part={rec.chaptersDone} whole={rec.chapters} caption="chapters finished" />
        </div>
        <div className="setdesc">
          {rec.asked === 0
            ? "No questions answered yet — the record fills in as you go."
            : rec.clean === rec.asked
              ? "Every question you've been asked, you've answered without a miss."
              : (rec.asked - rec.clean) + (rec.asked - rec.clean === 1 ? " question has" : " questions have") + " tripped you up at least once. Those come back sooner."}
        </div>
      </div>
      {(() => {
        const list = app.savedList();
        if (!list.length) return null;
        return (
          <div className="card">
            <span className="kicker">Saved for later</span>
            <div className="setdesc" style={{ marginBottom: 8 }}>{list.length === 1 ? "1 step you flagged." : list.length + " steps you flagged."}</div>
            {list.slice(0, 8).map(x => (
              <button className="noterow" key={x.key} onClick={() => { haptic(5); app.openStep(x.sub.id, x.i); }}>
                <span className="noteic" style={{ background: x.sub.tint }}>{x.sub.icon}</span>
                <span className="notemid">
                  <span className="notettl">{(x.step.item && x.step.item.ask) || x.step.title}</span>
                  <span className="notetxt">{x.sub.name} · {x.step.chapter ? x.step.chapter.title : ""}</span>
                </span>
                <span className="go2">›</span>
              </button>
            ))}
          </div>
        );
      })()}
      <div className="card">
        <span className="kicker">Steps taken · last 14 days</span>
        {(() => {
          const bars = lastDays(app.activity, 14);
          const total = bars.reduce((a, b) => a + b.v, 0);
          return (
            <>
              <BarChart bars={bars} label={"Steps taken on each of the last 14 days, " + total + " in total"} />
              <div className="setdesc">
                {total === 0
                  ? "Nothing recorded in the last two weeks. A bar appears on any day you take a step."
                  : total + (total === 1 ? " step" : " steps") + " over 14 days, on " + bars.filter(b => b.v > 0).length + " of them. Gaps are just gaps — nothing is lost by missing a day."}
              </div>
            </>
          );
        })()}
      </div>
      <div className="card">
        <span className="kicker">Reviews coming up</span>
        {(() => {
          const bars = reviewForecast(app.sched, 7);
          const total = bars.reduce((a, b) => a + b.v, 0);
          return (
            <>
              <BarChart bars={bars} label={"Reviews falling due over the next 7 days"} />
              <div className="setdesc">
                {total === 0
                  ? "No reviews scheduled yet. Answer some questions and they'll be scheduled to come back."
                  : bars[0].v > 0
                    ? bars[0].v + (bars[0].v === 1 ? " review is" : " reviews are") + " due now, " + total + " over the week."
                    : "Nothing due today. " + total + " scheduled across the week."}
              </div>
            </>
          );
        })()}
      </div>
      <div className="card">
        <span className="kicker">By subject</span>
        <div className="subjchart">
          {rec.subjects.filter(x => x.done > 0).length === 0
            ? <div className="setdesc">No subject started yet.</div>
            : rec.subjects.filter(x => x.done > 0).sort((a, b) => (b.done / b.steps) - (a.done / a.steps)).map(x => (
              <div className="sbrow" key={x.sub.id}>
                <span className="sbname">{x.sub.icon} {x.sub.name}</span>
                <span className="sbtrack"><i style={{ width: Math.max(2, Math.round(x.done / x.steps * 100)) + "%", background: x.sub.accent }} /></span>
                <span className="sbpct">{Math.round(x.done / x.steps * 100)}%</span>
              </div>
            ))}
        </div>
      </div>
      <div className="card">
        {rec.subjects.map(x => (
          <div className="prow" key={x.sub.id}>
            <div className="pic" style={{ background: x.sub.tint }}>{x.sub.icon}</div>
            <div>
              <div className="pn">{x.sub.name}</div>
              <div className="pc">{x.chaptersDone} / {x.chapters} chapters{x.done && x.done < x.steps ? " · " + (x.steps - x.done) + " steps left" : ""}</div>
            </div>
            <div className="pbar"><i style={{ width: (x.steps ? Math.round(x.done / x.steps * 100) : 0) + "%", background: x.sub.accent }} /></div>
          </div>
        ))}
      </div>
      {app.weakIds.length > 0 && (
        <button className="cont" style={{ "--a": "#f08c00", "--a-tint": "#fff0d6", marginTop: 14 }} onClick={() => { haptic(6); app.go({ tab: "learn", scr: "weak" }); }}>
          <div className="cic" style={{ background: "#fff0d6" }}>🎯</div>
          <div><div className="cl">Trouble spots</div><div className="ct2">{app.weakIds.length === 1 ? "1 question you keep missing" : app.weakIds.length + " questions you keep missing"}</div><div className="cs">Practice just those</div></div>
          <div className="go2">›</div>
        </button>
      )}
      <NotesList app={app} />
      <div className="sub" style={{ textAlign: "center", marginTop: 14 }}>You can reset your progress in Settings.</div>
    </div>
  );
}
function NotesList({ app }) {
  const list = app.noteList();
  if (!list.length) return null;
  return (
    <div className="card">
      <span className="kicker">Your notes</span>
      <div className="setdesc" style={{ margin: "4px 0 10px" }}>{list.length === 1 ? "1 lesson has a note." : list.length + " lessons have notes."}</div>
      {list.map(nt => (
        <button className="noterow" key={nt.key} onClick={() => { haptic(5); app.openLesson(nt.sub.id, nt.unit); }}>
          <span className="noteic" style={{ background: nt.sub.tint }}>{nt.sub.icon}</span>
          <span className="notemid">
            <span className="notettl">{nt.title}</span>
            <span className="notetxt">{nt.text.length > 90 ? nt.text.slice(0, 90) + "…" : nt.text}</span>
          </span>
          <span className="go2">›</span>
        </button>
      ))}
    </div>
  );
}
/* Cloud sign-in, laid out to mirror Study It's own modal so the three apps feel
   like one product: same flow (label, "Welcome back.", email, password, primary
   action, magic link, forgot password, mode toggle at the bottom), same copy
   shape, rendered in Lectern's visual language rather than Study It's.

   Feature parity is the point of the magic link and the reset link — it's the
   same account, and being able to recover it from one app but not another would
   be its own small betrayal. */
function CloudAuthModal({ app, onClose }) {
  const [mode, setMode] = useState("signin");   // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async () => {
    setErr(""); setNote("");
    if (!email.trim() || !pw) { setErr("Enter an email and a password."); return; }
    setBusy(true);
    const r = mode === "signup" ? await app.cloudSignUp(email, pw) : await app.cloudSignIn(email, pw);
    setBusy(false);
    if (r.error) { setErr(r.error); haptic([11, 55, 11]); return; }
    if (r.needsConfirm) { setNote("Check your email to confirm the account, then sign in."); return; }
    onClose();
  };

  const needEmail = () => {
    if (email.trim()) return true;
    setErr("Enter your email address first."); return false;
  };
  const magic = async () => {
    setErr(""); setNote("");
    if (!needEmail()) return;
    setBusy(true); const r = await app.cloudMagicLink(email); setBusy(false);
    if (r.error) setErr(r.error); else setNote("Sign-in link sent. Check your email.");
  };
  const reset = async () => {
    setErr(""); setNote("");
    if (!needEmail()) return;
    setBusy(true); const r = await app.cloudResetPassword(email); setBusy(false);
    if (r.error) setErr(r.error); else setNote("Password reset link sent. Check your email.");
  };

  return (
    <>
      <div className="scrim" onClick={() => !busy && onClose()} />
      <div className="cloudmodal" role="dialog" aria-modal="true" aria-label="Cloud sign in">
        <div className="cmhead">
          <span className="kicker">{mode === "signup" ? "Create account" : "Sign in"}</span>
          <button className="cmx" onClick={() => !busy && onClose()} aria-label="Close">✕</button>
        </div>
        <h2 className="cmtitle">{mode === "signup" ? "Welcome to Lectern." : "Welcome back."}</h2>
        <p className="cmsub">
          Your progress, notes and settings sync across every device you sign in on. The same account works in Study It and CodeQuest.
        </p>
        <input className="ans cloudin" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} disabled={busy} onChange={e => setEmail(e.target.value)} />
        <input className="ans cloudin" type="password" style={{ marginTop: 10 }}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "Choose a password" : "Password"}
          value={pw} disabled={busy} onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        {err && <div className="fb no" style={{ marginTop: 12 }}>{err}</div>}
        {note && <div className="fb ok" style={{ marginTop: 12 }}>{note}</div>}
        <button className="btn go cmprimary" disabled={busy} onClick={submit}>
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button className="btn cmsecondary" disabled={busy} onClick={magic}>Or email me a magic sign-in link</button>
        {mode === "signin" && <button className="cmquiet" disabled={busy} onClick={reset}>Forgot password?</button>}
        <div className="cmfoot">
          <button className="cmlink" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); setNote(""); }}>
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      </div>
    </>
  );
}

/* Cloud sync panel in Settings. The card states the truth about where data
   lives; the sign-in itself happens in the modal above. */
function CloudCard({ app }) {
  const c = app.cloud;
  const [open, setOpen] = useState(false);

  if (c.user) {
    const when = c.at ? new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
    const line =
      c.status === "syncing" ? "Syncing…" :
      c.status === "error" ? ("Not synced — " + (c.error || "something went wrong")) :
      c.status === "conflict" ? "Two copies of your progress don't match. Nothing has been changed." :
      when ? ("Synced at " + when) : "Connected.";
    return (
      <div className="card">
        <span className="kicker">Cloud sync</span>
        <div className="settitle" style={{ marginTop: 6 }}>Signed in as {c.user.email}</div>
        <div className="setdesc" style={{ marginTop: 2 }}>{line}</div>
        <div className="setdesc" style={{ marginTop: 6 }}>
          The same account works in Study It and CodeQuest. Your progress is still saved on this device — the cloud is a copy.
        </div>
        <div className="setdesc" style={{ marginTop: 6 }}>
          Stored: your progress, notes, flashcards, generated lessons, settings and profile name.
          {" "}Your profile password stays on this device and is never uploaded.
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          {c.status === "conflict"
            ? <button className="btn go" onClick={app.cloudResolve}>Choose which to keep</button>
            : <button className="btn go" disabled={c.status === "syncing"} onClick={app.cloudSyncNow}>Sync now</button>}
          <button className="btn" onClick={() => app.confirmSheet({
            title: "Sign out of cloud sync?",
            body: "Your progress stays on this device. The cloud copy is kept and will be there when you sign back in.",
            confirmLabel: "Sign out",
            onConfirm: () => { app.cloudSignOut(); app.showToast("Cloud sync off."); },
          })}>Sign out of cloud</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="kicker">Cloud sync</span>
      <div className="settitle" style={{ marginTop: 6 }}>Off — progress is saved on this device only</div>
      <div className="setdesc" style={{ marginTop: 2 }}>
        Sign in to keep a copy in the cloud so your progress follows you to another device. The same account works in Study It and CodeQuest.
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn go" onClick={() => setOpen(true)}>Sign in / Create account</button>
      </div>
      <div className="setdesc" style={{ marginTop: 8 }}>
        Nothing is uploaded until you sign in, and nothing is ever overwritten without asking you first.
      </div>
      {open && <CloudAuthModal app={app} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SettingsScreen({ app }) {
  const [, force] = useState(0);
  const u = app.cur;
  const set = patch => app.setSettings(s => ({ ...s, ...patch }));
  return (
    <div>
      <h1>Settings</h1><div className="sub">Make the app feel just right.</div>
      <CloudCard app={app} />
      <div className="card">
        <span className="kicker">Account</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          {u && <span className="avatar" style={{ background: avatarColor(u.name) }}>{initial(u.name)}</span>}
          <div className="settitle">Signed in as {u ? u.name : "—"}{u && u.guest ? " (guest)" : ""}</div>
        </div>
        <div className="setdesc" style={{ marginTop: 2 }}>{u && u.hash ? "Password protected · progress saved to this account." : "No password set · progress saved to this account."}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => app.confirmSheet({ title: "Sign out?", body: "Your progress stays saved on this device.", confirmLabel: "Sign out", onConfirm: () => { app.signOut(); app.showToast("Signed out."); } })}>Sign out</button>
        </div>
      </div>
      <div className="card">
        <Toggle icon="sound" title="Sound effects" desc="Play a gentle chime for right and wrong answers" val={app.settings.sound} on={v => { set({ sound: v }); if (v) sfxCorrect(); }} />
        <Toggle icon="vibrate" title="Vibration" desc="Feel a tap on your phone for answers" val={app.settings.haptics} on={v => { set({ haptics: v }); if (v) { PREFS.haptics = true; haptic(14); } }} />
        <Toggle icon="settings" title="Match system theme" desc="Follow your device's light or dark setting automatically" val={app.settings.autoTheme} on={v => set({ autoTheme: v })} />
        {!app.settings.autoTheme && <Toggle icon="moon" title="Dark mode" desc="Switch to a cool, easy-on-the-eyes dark theme" val={app.settings.dark} on={v => set({ dark: v })} />}
        <Toggle icon="text" title="Larger text" desc="Bigger type for lessons, questions and answers" val={app.settings.textBig} on={v => set({ textBig: v })} />
      </div>
      <div className="card">
        <span className="kicker">AI topic generator</span>
        <div className="setdesc" style={{ margin: "4px 0 0" }}>
          {app.aiAvailable()
            ? "Ready. Ask for a topic in Learn and the AI teacher will write lessons for it."
            : "Sign in under Cloud sync above and the AI teacher can write new lessons for any topic you ask for. There's no API key to find or paste."}
        </div>
      </div>
      <div className="card">
        <span className="kicker">Your profile</span>
        <div className="setdesc" style={{ margin: "4px 0 10px" }}>Tell the AI teacher a little about you — it uses this when it writes new lessons. Your familiarity with each subject is set on that subject's page.</div>
        <p className="lbl">Anything about you? (optional)</p>
        <textarea className="ans" aria-label="About you" placeholder="e.g. I already speak some Spanish and I'm learning for travel." defaultValue={app.getProfile()} onChange={e => app.setProfile(e.target.value)} />
      </div>
      <div className="card">
        <span className="kicker">Data</span>
        {(() => {
          const r = studyRecord(app);
          return (
            <div style={{ fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 10px" }}>
              {r.chaptersDone} of {r.chapters} chapters and {r.stepsDone} of {r.steps} steps are saved on this device
              {r.asked ? ", along with the review record for " + r.asked + (r.asked === 1 ? " question" : " questions") : ""}.
            </div>
          );
        })()}
        <button className="btn" onClick={() => app.confirmSheet({
          title: "Reset all progress?",
          body: "Every finished step, chapter and review for this account will be cleared. Your notes and saved steps go too. Topics you generated are kept. This can't be undone.",
          confirmLabel: "Reset progress", danger: true,
          onConfirm: () => {
            // Clear every per-account store, not the three that existed when this
            // button was written — steps, notes, saved items, activity and
            // half-finished practice all belong to the same "progress".
            const id = app.cur && app.cur.id;
            jset(pkey(id), {});
            jset(tkey(id), {});
            jset(skey(id), {});
            jset(lkey(id), null);
            jset(dkey(id), {});
            jset(nkey(id), {});
            jset(mkey(id), {});
            jset(akey(id), {});
            try { localStorage.removeItem("lectern.stepfill.v1." + id); } catch (e) {}
            try { location.reload(); } catch (e) {}
          }
        })}>Reset all progress</button>
      </div>
      <div className="card">
        <span className="kicker">About</span>
        {(() => {
          const rec = studyRecord(app);
          let questions = 0;
          rec.subjects.forEach(x => { questions += x.cls.steps.filter(st => st.item !== undefined || st.type !== "concept").length; });
          let bytes = 0;
          try {
            const id = app.cur && app.cur.id;
            ["progress.v3", "steps.v1", "srs.v1", "notes.v1", "saved.v1", "activity.v1", "topics.v2", "added.v1"].forEach(k => {
              const v = localStorage.getItem("lectern." + k + "." + id) || localStorage.getItem("lectern." + k);
              if (v) bytes += v.length;
            });
          } catch (e) { bytes = 0; }
          const size = bytes < 1024 ? bytes + " bytes" : Math.round(bytes / 1024) + " KB";
          return (
            <>
              <div className="aboutrows">
                <div className="aboutrow"><span>Version</span><b>{APP_VERSION}</b></div>
                <div className="aboutrow"><span>Content</span><b>{rec.subjects.length} subjects · {rec.chapters} chapters · {rec.steps} steps</b></div>
                <div className="aboutrow"><span>Your data</span><b>{size} on this device</b></div>
              </div>
              <div className="setdesc" style={{ margin: "10px 0 12px" }}>
                Nothing is sent anywhere. Everything above lives in this browser, on this device, and leaves only if you export a backup.
              </div>
            </>
          );
        })()}
        <button className="btn" onClick={() => { haptic(5); app.openIntro(); }}>How Lectern works</button>
      </div>
      <BackupCard app={app} />
      <div className="card installcard">
        <span className="kicker">Install</span>
        {app.isStandalone()
          ? <div className="setdesc" style={{ marginTop: 4 }}>Lectern is installed and running from your home screen.</div>
          : app.installReady
            ? <><div className="setdesc" style={{ margin: "4px 0 12px" }}>Add Lectern to your home screen so it opens full-screen, without browser bars.</div>
                <button className="btn go big" onClick={app.promptInstall}>Install Lectern</button></>
            : <div className="installnote" style={{ marginTop: 4 }}>{app.isIOS()
                ? "On iPhone or iPad: tap the Share button in Safari, then “Add to Home Screen”. It opens full-screen from then on."
                : "Your browser hasn't offered an install button here. Most browsers put “Install app” or “Add to Home Screen” in their own menu."}</div>}
      </div>
      <div className="foot">Lectern · a calm place to learn a little of everything.{"\n"}Your progress stays on your device.</div>
    </div>
  );
}
function BackupCard({ app }) {
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [copyText, setCopyText] = useState("");
  const doExport = () => {
    const r = app.exportBackup();
    if (r.ok) { app.showToast("Backup saved as " + r.name); setCopyText(""); }
    else { setCopyText(r.text); app.showToast("This browser wouldn't download the file — copy the text below instead."); }
  };
  const doRestore = () => {
    const r = app.readBackup(paste);
    if (!r.ok) { setErr(r.error); return; }
    setErr("");
    app.confirmSheet({
      title: "Restore this backup?",
      body: "It holds " + r.counts.steps + (r.counts.steps === 1 ? " finished step" : " finished steps") + ", "
        + r.counts.reviews + (r.counts.reviews === 1 ? " review" : " reviews") + " and "
        + r.counts.topics + (r.counts.topics === 1 ? " AI topic" : " AI topics")
        + (r.counts.added ? " and " + r.counts.added + (r.counts.added === 1 ? " lesson added to a subject" : " lessons added to subjects") : "")
        + ". This replaces what is on this device now.",
      confirmLabel: "Restore", danger: true,
      onConfirm: () => { app.applyBackup(r.data); setPaste(""); app.showToast("Restored."); }
    });
  };
  return (
    <div className="card">
      <span className="kicker">Backup</span>
      <div className="setdesc" style={{ margin: "4px 0 12px" }}>Everything lives on this device, so a backup is the only way to move to another one. The file holds your finished lessons, reviews, AI topics, familiarity, profile, your saved password and your API key — so you can restore and carry straight on.</div>
      <div className="warnnote">Because it contains your password and API key, treat the file like a password itself: keep it somewhere private and don't email or share it.</div>
      <button className="btn go" onClick={doExport}>Download a backup</button>
      {copyText ? (
        <>
          <p className="lbl" style={{ marginTop: 12 }}>Copy this and save it somewhere safe</p>
          <textarea className="ans" aria-label="Backup text" readOnly value={copyText} onFocus={e => e.target.select()} />
        </>
      ) : null}
      <p className="lbl" style={{ marginTop: 14 }}>Restore — paste a backup file here</p>
      <textarea className="ans" aria-label="Paste a backup" placeholder="Paste the contents of a lectern-backup file…" value={paste} onChange={e => { setPaste(e.target.value); setErr(""); }} />
      {err ? <div className="fb no" style={{ marginTop: 8 }}>{err}</div> : null}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={!paste.trim()} onClick={doRestore}>Restore from backup</button>
      </div>
    </div>
  );
}
function Toggle({ icon, title, desc, val, on }) {
  const [v, setV] = useState(val);
  return (
    <div className="setrow">
      <div className="seticon">{typeof icon === "string" && icon.length > 2 ? <Icon name={icon} size={19} /> : icon}</div>
      <div className="setmid"><div className="settitle">{title}</div><div className="setdesc">{desc}</div></div>
      <button className={"switch" + (v ? " on" : "")} role="switch" aria-checked={v} aria-label={title} onClick={() => { const nv = !v; setV(nv); on(nv); }}><span className="knob" /></button>
    </div>
  );
}
function MathUnit({ app, s }) {
  const t = A.MATH.topics[app.route.unit];
  const fixed = (t.id === "order" || t.id === "frac" || t.id === "word");
  // Start at a level that matches what the learner told us and what they have
  // finished, rather than always at Easy. They can still change it by hand.
  const startDiff = (() => {
    const band = A.autoDifficulty(app.levelOf(s.id), app.totalDone);
    return band === "advanced" ? 3 : band === "intermediate" ? 2 : 1;
  })();
  const [diff, setDiff] = useState(startDiff);
  const rngRef = useRef(A.makeRng((app.route.unit + 3) * 211 + 9));
  const [cur, setCur] = useState(() => t.gen(rngRef.current, startDiff));
  const [val, setVal] = useState(""); const [res, setRes] = useState(null); const inRef = useRef(null);
  const fresh = (dd) => { setCur(t.gen(rngRef.current, dd || diff)); setVal(""); setRes(null); setTimeout(() => inRef.current && inRef.current.focus(), 20); };
  const submit = () => { if (res !== null) return; if (!val.trim()) return; const ok = A.MATH.check(cur, val); ok ? sfxCorrect() : sfxWrong(); setRes(ok); };
  const big = cur.q.length > 16;
  return (
    <div>
      <Back label={s.name} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>{t.name}</h1></div>
      <Lesson teach={t.teach} />
      <div className="card"><span className="kicker">Practice</span>
        {!fixed && <div className="segs">{[["Easy", 1], ["Medium", 2], ["Hard", 3]].map(dd => <button className={"seg" + (diff === dd[1] ? " on" : "")} key={dd[1]} onClick={() => { setDiff(dd[1]); fresh(dd[1]); }}>{dd[0]}</button>)}</div>}
        <div className={"mathq" + (big ? " small" : "")}>{cur.q}</div>
        <div className="typerow">
          <input className="ans" ref={inRef} type="text" inputMode="numeric" placeholder="answer" aria-label="Your answer" disabled={res !== null}
            value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} style={res !== null ? { borderColor: res ? "var(--ok)" : "var(--no)" } : null} />
          <button className="btn go" disabled={res !== null} onClick={submit}>Check</button>
          <button className="btn" onClick={() => fresh()}>New problem</button>
        </div>
        {res !== null && <div className={"fb " + (res ? "ok" : "no")}>{res ? <span><b>Correct.</b> {cur.q} = {cur.answer}{cur.note ? " (" + cur.note + ")" : ""}</span> : <span><b>Not quite.</b> The answer is <b>{cur.answer}</b>. {cur.note || ""}</span>}</div>}
      </div>
    </div>
  );
}
function MusicUnit({ app, s }) {
  const u = app.route.unit;
  const head = (
    <>
      <Back label={s.name} onClick={() => app.go({ tab: "learn", scr: "subject", subj: s.id })} />
      <div className="shead"><div className="ic" style={{ background: s.tint }}>{s.icon}</div><h1>{MUSIC_UNITS[u].t}</h1></div>
    </>
  );
  if (u === 0) return <div>{head}<MKeyboard /></div>;
  if (u === 1) return <div>{head}<MIntervals /></div>;
  if (u === 2) return <div>{head}<MScale /></div>;
  return <div>{head}<MChords /></div>;
}
/* The music units all ask the same thing — choose one, then see the tick or the
   cross. This is that control, once. */
function Options({ items, correct, picked, onPick }) {
  return (
    <div className="opts">
      {items.map((c, i) => {
        let cls = "opt";
        if (picked && c === correct) cls += " right";
        else if (picked === c && c !== correct) cls += " wrong";
        const mark = picked && c === correct ? "\u2713" : (picked === c && c !== correct ? "\u2717" : null);
        return (
          <button className={cls} key={i} disabled={!!picked} onClick={() => { if (!picked) onPick(c); }}>
            {c}{mark ? <span className="m">{mark}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
function Piano({ onPlay }) {
  const whites = [["C", 60], ["D", 62], ["E", 64], ["F", 65], ["G", 67], ["A", 69], ["B", 71], ["C", 72]];
  const blacks = [[61, 0], [63, 1], [66, 3], [68, 4], [70, 5]];
  const wp = 100 / whites.length;
  const [lit, setLit] = useState(-1);
  const flash = m => { setLit(m); setTimeout(() => setLit(-1), 200); };
  return (
    <div className="piano">
      <div className="whites">{whites.map((k, i) => <div className={"wk" + (lit === k[1] ? " on" : "")} key={i} onClick={() => { playMidi(k[1]); flash(k[1]); onPlay && onPlay(k[1]); }}>{k[0]}</div>)}</div>
      {blacks.map((b, i) => <div className={"bk" + (lit === b[0] ? " on" : "")} key={i} style={{ left: ((b[1] + 1) * wp - 4.2) + "%" }} onClick={e => { e.stopPropagation(); playMidi(b[0]); flash(b[0]); onPlay && onPlay(b[0]); }} />)}
    </div>
  );
}
function MKeyboard() {
  const [note, setNote] = useState("Tap a key");
  return (
    <div>
      <Lesson teach={["A piano keyboard repeats a pattern of seven white keys — C, D, E, F, G, A, B — and five black keys tucked between some of them. The black keys are the sharps (#).", "Tap any key to hear its note. The distance from one C up to the next C is called an octave: the same note name, sounding higher."]} />
      <div className="card"><span className="kicker">Play</span><div className="bignote">{note}</div><Piano onPlay={m => setNote(A.MUSIC.fullName(m))} /></div>
    </div>
  );
}
function MIntervals() {
  const rngRef = useRef(A.makeRng(31));
  const [q, setQ] = useState(() => A.MUSIC.intervalQuiz(rngRef.current));
  const [picked, setPicked] = useState(null);
  const play = () => { playMidi(q.root, 0.55, 0); playMidi(q.target, 0.55, 0.65); };
  const pick = c => { if (picked) return; setPicked(c); c === q.answer ? sfxCorrect() : sfxWrong(); playMidi(q.root, 0.5, 0); playMidi(q.target, 0.5, 0.55); };
  return (
    <div>
      <Lesson teach={["An interval is the distance in pitch between two notes, counted in half-steps. A Major 3rd is 4 half-steps (C up to E), a Perfect 5th is 7 (C up to G), and an Octave is 12.", "Press Play to hear a low note then a higher note, and choose which interval it was."]} />
      <div className="card"><span className="kicker">Ear training</span>
        <div className="row" style={{ marginTop: 0 }}><button className="btn go" onClick={play}>▶ Play the two notes</button><button className="btn" onClick={play}>Replay</button></div>
        <div className="prog">Root note: {q.rootName} — which interval is the second note above it?</div>
        <Options items={q.choices} correct={q.answer} picked={picked} onPick={pick} />
        {picked && <><div className={"fb " + (picked === q.answer ? "ok" : "no")}>{picked === q.answer ? <b>Correct.</b> : <b>Not quite.</b>} That jump was a <b>{q.answer}</b> ({q.semis} half-steps).</div>
          <div className="row"><span className="spacer" /><button className="btn go" onClick={() => { setQ(A.MUSIC.intervalQuiz(rngRef.current)); setPicked(null); }}>Next ›</button></div></>}
      </div>
    </div>
  );
}
function MScale() {
  const notes = A.MUSIC.majorScale("C");
  const rngRef = useRef(A.makeRng(88));
  const inS = ["C", "D", "E", "F", "G", "A", "B"], out = ["C#", "D#", "F#", "G#", "A#"];
  const gen = () => { const wrong = A.pick(rngRef.current, out); return { wrong, opts: A.shuffle(rngRef.current, [wrong].concat(A.shuffle(rngRef.current, inS).slice(0, 3))) }; };
  const [q, setQ] = useState(gen); const [picked, setPicked] = useState(null);
  const play = () => [0, 2, 4, 5, 7, 9, 11, 12].forEach((st, i) => playMidi(60 + st, 0.4, i * 0.42));
  return (
    <div>
      <Lesson teach={["A major scale is the bright do-re-mi sound. Starting on C and playing only white keys gives C major: " + notes.join(" ") + ", ending back on C.", "The pattern of gaps is Whole, Whole, Half, Whole, Whole, Whole, Half. Every major scale follows that same recipe from a different starting note."]} />
      <div className="card"><span className="kicker">Listen</span><button className="btn go" onClick={play}>▶ Play C major scale</button><div /><span className="chip">C  D  E  F  G  A  B  C</span></div>
      <div className="card"><span className="kicker">Check yourself</span>
        <div className="ask">Which of these notes is NOT in the C major scale?</div>
        <Options items={q.opts} correct={q.wrong} picked={picked}
          onPick={c => { setPicked(c); c === q.wrong ? sfxCorrect() : sfxWrong(); }} />
        {picked && <><div className={"fb " + (picked === q.wrong ? "ok" : "no")}>{picked === q.wrong ? <b>Correct.</b> : <b>Not quite.</b>} <b>{q.wrong}</b> is a black key (a sharp), so it isn't in C major — that scale uses only white keys.</div>
          <div className="row"><span className="spacer" /><button className="btn go" onClick={() => { setQ(gen()); setPicked(null); }}>Next ›</button></div></>}
      </div>
    </div>
  );
}
function MChords() {
  const rngRef = useRef(A.makeRng(55));
  const correct = "C – E – G", wrongs = ["C – D – E", "C – E – F", "C – F – A", "D – F – A"];
  const gen = () => A.shuffle(rngRef.current, [correct].concat(A.shuffle(rngRef.current, wrongs).slice(0, 3)));
  const [opts, setOpts] = useState(gen); const [picked, setPicked] = useState(null);
  const play = () => [60, 64, 67].forEach(m => playMidi(m, 1.1, 0));
  return (
    <div>
      <Lesson teach={["A chord is several notes played at the same time. The most common is the major triad — three notes that sound happy and complete together.", "You build a major triad from the 1st, 3rd, and 5th notes of the major scale. For C that's C – E – G. Press Play to hear them together."]} />
      <div className="card"><span className="kicker">Listen</span><button className="btn go" onClick={play}>▶ Play the C major chord</button><div /><span className="chip">C + E + G</span></div>
      <div className="card"><span className="kicker">Check yourself</span>
        <div className="ask">Which three notes make up a C major chord?</div>
        <Options items={opts} correct={correct} picked={picked}
          onPick={c => { setPicked(c); c === correct ? sfxCorrect() : sfxWrong(); play(); }} />
        {picked && <><div className={"fb " + (picked === correct ? "ok" : "no")}>{picked === correct ? <b>Correct.</b> : <b>Not quite.</b>} A C major chord is the 1st, 3rd, and 5th notes of C major: <b>C, E, and G</b>.</div>
          <div className="row"><span className="spacer" /><button className="btn go" onClick={() => { setOpts(gen()); setPicked(null); }}>Next ›</button></div></>}
      </div>
    </div>
  );
}
function Generate({ app }) {
  // If we arrived from inside a topic, we are adding to that topic rather than
  // starting a new one.
  // "into" is whatever we are adding to: an AI topic, or a built-in subject.
  const intoSubj = app.route.subj ? app.subjOf(app.route.subj) : null;
  const isTopic = !!(intoSubj && intoSubj.kind === "topic");
  const into = intoSubj ? { id: intoSubj.id, name: intoSubj.name, isTopic: isTopic, lessons: app.courseLessons(intoSubj.id) } : null;
  const [topic, setTopic] = useState(into ? "" : "");
  const [level, setLevel] = useState("beginner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const backToTopic = () => app.go({ tab: "learn", scr: "subject", subj: into.id });
  const gen = () => {
    const tp = topic.trim(); setError("");
    if (tp.length < 2) { setError(into ? "Please type what else you want to cover." : "Please type a topic to learn about."); return; }
    if (busy) return; setBusy(true);
    const known = app.knownContext();
    if (into) {
      // tell the model what is already there so it extends rather than repeats
      known.unshift((into.isTopic ? 'their topic "' : 'the ' + into.name + ' course "') + into.name + '" already covers: '
        + into.lessons.map(L => L.title).join(", "));
    }
    const prompt = A.GEN.buildPrompt(into ? into.name + " — " + tp : tp, level, { known: known, profile: app.getProfile() });
    app.callModel(prompt).then(text => {
      const set = A.GEN.validate(text, into ? into.name : tp);
      if (into) {
        const startAt = into.lessons.length;
        const marked = set.lessons.map(L => ({ ...L, ai: true }));
        if (into.isTopic) app.setTopics(app.topics.map(t => t.id === into.id ? { ...t, lessons: t.lessons.concat(marked) } : t));
        else app.addLessons(into.id, marked);
        setBusy(false);
        app.showToast(marked.length === 1 ? "1 lesson added to " + into.name + "." : marked.length + " lessons added to " + into.name + ".");
        app.openLesson(into.id, startAt);
      } else {
        const id = "topic_" + String(Date.now());
        app.setTopics([{ id, name: set.name, lessons: set.lessons }, ...app.topics]);
        setBusy(false); app.openLesson(id, 0);
      }
    }).catch(err => { setBusy(false); setError(err && err.message === "no-ai" ? "AI generation needs the Claude preview (or an API key in Settings). Your lessons weren't created." : (err && err.message) || "Something went wrong generating your lessons."); });
  };
  return (
    <div>
      <Back label={into ? into.name : "Subjects"} onClick={() => (into ? backToTopic() : app.go({ tab: "learn", scr: "grid" }))} />
      <div className="shead"><div className="ic" style={{ background: intoSubj ? intoSubj.tint : "#efeaff" }}>{intoSubj ? intoSubj.icon : "✨"}</div><h1>{into ? "Add to " + into.name : "Create a topic"}</h1></div>
      <div className="sub">{into
        ? (into.isTopic ? "This topic" : "This subject") + " already has "
          + (into.lessons.length === 1 ? "1 lesson" : into.lessons.length + " lessons")
          + ". Say what else you want to cover and the new chapters will be added to " + into.name
          + " — the AI is told what is already there, so it builds on it rather than repeating it."
        : "Type anything you want to learn. AI will write a short set of lessons with practice — and every question is quality-checked before it's added."}</div>
      <div className="card">
        <p className="lbl">{into ? "What should the new " + into.name + " lessons cover?" : "What do you want to learn?"}</p>
        <input className="ans" style={{ width: "100%" }} aria-label="Topic" placeholder={into ? (into.isTopic ? "e.g. how eruptions are predicted" : "e.g. ordering food in a restaurant") : "e.g. Volcanoes, the water cycle, chess openings…"} value={topic} onChange={e => setTopic(e.target.value)} />
        <p className="lbl">How familiar are you with this topic?</p>
        <div className="segs">{[["New to it", "beginner"], ["Know some", "intermediate"], ["Confident", "advanced"]].map(l => <button className={"seg" + (level === l[1] ? " on" : "")} key={l[1]} onClick={() => setLevel(l[1])}>{l[0]}</button>)}</div>
        <button className="btn go big" disabled={busy} onClick={gen}>{into ? "Add more chapters" : "Generate chapters"}</button>
        {busy && <div className="spin"><div className="spinner" /><div className="spintext">Writing your lessons… this can take a few seconds.</div></div>}
      </div>
      {!app.aiAvailable() && <div className="card" style={{ borderColor: "var(--a)" }}><div className="settitle">AI isn't connected here</div><div className="setdesc" style={{ marginTop: 4 }}>Sign in under Settings → Cloud sync to generate lessons here. No API key needed.</div></div>}
      {error && <div className="fb no">{error}</div>}
    </div>
  );
}
/* A password box you can read back. Nothing is revealed unless the person asks:
   it starts hidden, and every field gets its own independent toggle. */
function PasswordField({ value, onChange, onEnter, placeholder, label, autoComplete, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pwwrap">
      <input className="obinput" type={show ? "text" : "password"} aria-label={label || "Password"}
        placeholder={placeholder} value={value} autoFocus={autoFocus}
        autoComplete={autoComplete || "current-password"} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }} />
      <button type="button" className="pweye" aria-pressed={show}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        onClick={() => { haptic(5); setShow(v => !v); }}>{show ? "Hide" : "Show"}</button>
    </div>
  );
}
function Auth({ app }) {
  const [mode, setMode] = useState(app.auth.users.length ? "login" : "create");
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState(""); const [pass, setPass] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const users = app.auth.users.filter(u => !u.guest);
  function hashPw(s) { let h = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h; }
  const enter = id => app.setAuth(a => ({ ...a, current: id }));
  const create = () => {
    const nm = name.trim() || "Learner"; const id = "u_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    app.setAuth(a => ({ users: [...a.users, { id, name: nm, hash: pass ? hashPw(pass) : "", levels: {}, profile: "" }], current: id }));
  };
  const guest = () => { let g = app.auth.users.find(u => u.guest); app.setAuth(a => { g = a.users.find(u => u.guest); if (g) return { ...a, current: g.id }; const ng = { id: "guest", name: "Guest", hash: "", levels: {}, profile: "", guest: true }; return { users: [...a.users, ng], current: "guest" }; }); };
  const login = u => { if (!u.hash) return enter(u.id); setSelected(u); };
  const tryPw = () => { if (hashPw(pw) === selected.hash) enter(selected.id); else { setErr("That password doesn't match. Try again."); haptic([11, 55, 11]); } };
  if (selected) return (
    <div className="ob" id="auth">
      <div className="obtop"><div className="obmk"><Icon name="lock" size={44} /></div><h1>Hi {selected.name}</h1><div className="obsub">Enter your password to continue.</div>
        <PasswordField value={pw} onChange={setPw} onEnter={tryPw} placeholder="Password" label="Password" autoComplete="current-password" autoFocus />
        <div className="obsub" style={{ color: "var(--no)", minHeight: 18 }}>{err}</div>
      </div>
      <div className="obfoot"><button className="obnext" onClick={tryPw}>Log in</button><button className="obskip" onClick={() => { setSelected(null); setErr(""); setPw(""); }}>← Choose a different account</button></div>
    </div>
  );
  return (
    <div className="ob" id="auth">
      <div className="obswitch"><AppLauncher app={app} /></div>
      <div className="obtop"><div className="obmk"><Icon name="lectern" size={44} /></div>
        {mode === "login" ? (
          <>
            <h1>Welcome back</h1><div className="obsub">Choose your account to pick up where you left off.</div>
            <div className="obchoices">{users.map(u => <button className="obchoice withava" key={u.id} onClick={() => login(u)}><span className="avatar sm" style={{ background: avatarColor(u.name) }}>{initial(u.name)}</span>{u.name}{u.hash ? "   🔒" : ""}</button>)}</div>
          </>
        ) : (
          <>
            <h1>Create your account</h1><div className="obsub">Your lessons and progress are saved to your account on this device.</div>
            <input className="obinput" type="text" aria-label="Name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <PasswordField value={pass} onChange={setPass} onEnter={create} placeholder="Password (optional)" label="Password" autoComplete="new-password" />
          </>
        )}
      </div>
      <div className="obfoot">
        {mode === "login"
          ? <><button className="obnext" onClick={() => setMode("create")}>Create a new account</button><button className="obskip" onClick={guest}>Continue as guest</button></>
          : <><button className="obnext" onClick={create}>Create account</button>{users.length > 0 && <button className="obskip" onClick={() => setMode("login")}>Log in to an existing account</button>}<button className="obskip" onClick={guest}>Continue as guest</button></>}
        <div className="obsub" style={{ fontSize: 12.5, opacity: .8 }}>Accounts are stored on this device. Cloud sync across devices can be added later.</div>
      </div>
    </div>
  );
}
function Splash() {
  return <div id="splash"><div className="splashinner"><div className="splashmk">📖</div><div className="splashname">Lectern</div></div></div>;
}
function Confetti({ trigger }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    const colors = ["#6d5cf5", "#e64980", "#12b886", "#f08c00", "#2f6ff0", "#ffe66d"];
    const arr = []; for (let i = 0; i < 28; i++) { const dur = 1.3 + Math.random() * 0.9, delay = Math.random() * 0.25; arr.push({ left: (5 + Math.random() * 90) + "%", bg: colors[i % colors.length], anim: "conffall " + dur.toFixed(2) + "s " + delay.toFixed(2) + "s linear forwards", rot: Math.floor(Math.random() * 360) }); }
    setPieces(arr); const t = setTimeout(() => setPieces([]), 2600); return () => clearTimeout(t);
  }, [trigger]);
  return <div id="confetti">{pieces.map((p, i) => <div className="confetti-piece" key={i} style={{ left: p.left, background: p.bg, animation: p.anim, transform: "translateY(0) rotate(" + p.rot + "deg)" }} />)}</div>;
}

/* ===========================================================================
   THE HUB — the entry point for this whole deploy.

   Study It's repo now holds two apps. Lectern is the front door: it's what you
   land on, and it has the buttons through to the others. Study It itself lives
   one route in. CodeQuest is a separate deploy, so that one is a real outbound
   link (see APPS above).

     /            -> Lectern (the hub)
     /#/study     -> Study It
     CodeQuest    -> an ordinary external link, opened in a new tab

   WHY THE HASH. Vercel serves a single-page build. With a plain path like
   /study, a refresh or a pasted link asks Vercel for a file that isn't there
   and you get a 404 unless a rewrite rule is added. A hash never reaches the
   server, so /#/study survives refresh, bookmarking and the browser Back
   button with no vercel.json and nothing to keep in sync.

   WHY ONLY ONE MOUNTS AT A TIME. Both apps inject their own global <style>
   (body background, fonts, box-sizing). Rendered side by side they would
   fight. Rendering exactly one means the other's styles aren't in the
   document at all.

   STORAGE IS SAFE TO SHARE. They're on one origin now, so they see the same
   localStorage. They don't collide: Study It's keys are all `lectern_...`
   (underscore) plus `lecternProfile_v1`; Lectern's are all `lectern....`
   (dot). Nothing in either app clears by prefix, and Study It's only prefix
   scan is a read-only size counter matching `lectern_`, which can never match
   `lectern.`.
   =========================================================================== */

// The routes this shell knows about. Anything else falls back to the hub, so a
// stale or mistyped link lands somewhere real instead of a blank screen.
const ROUTES = { "": "hub", "#": "hub", "#/": "hub", "#/study": "study", "#/math": "math", "#/science": "science" };

/* An app mounted inside the hub keeps its own routes in the same hash, so the
   hub has to hand over everything beneath that app's prefix rather than only
   the bare route. Without this, Mathema writing "#/math/progress" would fall
   through to the hub's default and bounce the learner home on every tap. */
const NESTED = { math: "math" };

export function routeFromHash(hash) {
  // Trailing slashes and query junk shouldn't break a route.
  const clean = String(hash || "").trim().replace(/\?.*$/, "").replace(/\/+$/, "") || "";
  if (Object.prototype.hasOwnProperty.call(ROUTES, clean)) return ROUTES[clean];
  const seg = clean.replace(/^#\/?/, "").split("/")[0];
  if (NESTED[seg]) return NESTED[seg];
  return "hub";
}

/* The way back. Study It is a whole app with its own header, and editing that
   header would mean touching App.jsx — 13,000 lines Kabir would have to repaste
   by hand. So the door back is rendered here instead, over the top of Study It,
   and App.jsx stays untouched.

   Deliberate choices:
   - Bottom LEFT. Study It's own floating things (toasts, the scroll-to-top
     button) sit bottom-center at left:50%, so this can't collide with them.
   - z-index 190. Above Study It's page content, but BELOW its toasts (200) and
     its modals (260-270), so an open dialog covers this rather than having a
     stray button floating on top of it.
   - No theme colors. Study It has a light and a dark palette and swaps them
     live; a pill that read the saved theme would go stale the moment someone
     toggled it. This is a self-contained high-contrast pill instead, legible on
     both papers, with nothing to keep in sync.
   - A real <button>. It changes route in this same app, so it isn't a link. */
const HUB_RETURN_CSS = `
.lec-hubreturn{
  position:fixed; z-index:190;
  left:max(14px, env(safe-area-inset-left));
  /* Clear of a bottom tab bar. Mathema and Study It both fix a nav bar to the
     bottom of the screen, and this pill sits above everything at z-index 190 —
     so at 14px it landed ON that bar, covering a tab and reading as part of the
     app rather than a way out of it. The offset is a variable so an app that
     has no bottom bar can set it back to 14px. */
  bottom:calc(var(--lec-hubreturn-lift, 72px) + env(safe-area-inset-bottom));
  display:inline-flex; align-items:center; gap:7px;
  margin:0; padding:9px 15px 9px 12px;
  border:1px solid rgba(255,255,255,.22); border-radius:999px;
  background:#20232e; color:#f2f4fa;
  font:600 13px/1 ui-rounded,"SF Pro Rounded","Segoe UI",Nunito,Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  letter-spacing:.01em; cursor:pointer; white-space:nowrap;
  box-shadow:0 6px 20px rgba(10,12,20,.34);
  -webkit-appearance:none; appearance:none;
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
}
.lec-hubreturn:hover{background:#2b2f3d; transform:translateY(-1px); box-shadow:0 10px 26px rgba(10,12,20,.42)}
.lec-hubreturn:active{transform:translateY(0)}
.lec-hubreturn:focus-visible{outline:2px solid #8fb4ff; outline-offset:3px}
.lec-hubreturn .lec-hubreturn-caret{font-size:15px; line-height:1; opacity:.85}
@media (prefers-reduced-motion:reduce){.lec-hubreturn{transition:none}.lec-hubreturn:hover{transform:none}}
`;

function HubReturn({ onBack, lift }) {
  return (
    <>
      <style>{HUB_RETURN_CSS}</style>
      {/* `lift` is how far to sit above the bottom of the screen. An app with a
          fixed bottom nav needs clearance; one without it does not. */}
      {lift !== undefined && (
        <style>{".lec-hubreturn{--lec-hubreturn-lift:" + lift + "px}"}</style>
      )}
      <button className="lec-hubreturn" type="button" onClick={onBack}
        aria-label="Back to Lectern" title="Back to Lectern">
        <span className="lec-hubreturn-caret" aria-hidden="true">{"\u2039"}</span>
        Lectern
      </button>
    </>
  );
}

export default function Lectern() {
  const read = () => routeFromHash(typeof window !== "undefined" ? window.location.hash : "");
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Navigating by changing the hash keeps the browser Back button honest:
  // Back out of Study It returns you to the hub, which is what a door should do.
  const go = useCallback(to => {
    const next = to === "study" ? "#/study" : to === "math" ? "#/math"
      : to === "science" ? "#/science" : "#/";
    if (window.location.hash === next) setRoute(routeFromHash(next));
    else window.location.hash = next;
  }, []);

  // The title should say where you are. Cheap, and it makes bookmarks useful.
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Only the Study It route is named here. On the hub, Lectern sets its own
    // per-screen title ("Home · Lectern", "Learn · Lectern") which is more
    // useful than a flat app name — overriding it would be a downgrade, and it
    // would fight back on the next screen change anyway.
    // Only the routes that are a different app rename the tab; on the hub,
    // Lectern names each screen itself, which is more useful than a flat name.
    if (route === "study") document.title = "Study It";
    else if (route === "math") document.title = "Mathema";
    else if (route === "science") document.title = "Elements";
    setFavicon(route === "study" ? STUDY_ICON : route === "math" ? MATH_ICON
      : route === "science" ? SCIENCE_ICON : APP_ICON);
  }, [route]);

  if (route === "science") {
    return (
      <>
        <Elements />
        {/* Elements scrolls a single column with no fixed bottom bar. */}
        <HubReturn onBack={() => go("hub")} lift={14} />
      </>
    );
  }
  if (route === "math") {
    return (
      <>
        <Mathema base="math" />
        <HubReturn onBack={() => go("hub")} />
      </>
    );
  }
  if (route === "study") {
    return (
      <>
        <StudyIt />
        <HubReturn onBack={() => go("hub")} />
      </>
    );
  }
  return <LecternApp onOpenStudyIt={() => go("study")} onOpenMathema={() => go("math")}
    onOpenElements={() => go("science")} />;
}
