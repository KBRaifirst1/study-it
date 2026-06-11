// HI 
import React, { useState, useRef, useEffect, useMemo } from "react";

/* ════════════════════════════════════════════════════════════════════════════
 * NO FAKE DATA — BINDING RULE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every number, percentage, badge, chart cell, caption, name, quote, testimonial,
 * count, streak, "last active" timestamp, or activity heatmap rendered to the user
 * MUST be derived from real user state. No exceptions.
 *
 * Specifically FORBIDDEN:
 *   1. Deterministic pseudo-random arrays as fake activity data
 *      (e.g. `Array.from({length: 84}, (_, i) => seedMath(i))`)
 *      → Always derive heatmaps/charts from real persisted state.
 *
 *   2. Fallback values that LIE when state is empty
 *      ❌ `sessionsCount || 12`  ❌ `accuracy || 84%`  ❌ `streakDays || 7`
 *      ✅ `sessionsCount || 0`  ✅ `accuracy !== null ? accuracy : "—"`
 *      Show an honest empty state instead of inventing numbers.
 *
 *   3. Hardcoded testimonial-style captions
 *      ❌ "You study most consistently on Tuesday and Sunday evenings."
 *      ✅ Compute from real data, or show nothing until there's enough signal.
 *
 *   4. Fabricated names / quotes / orgs presented as content
 *      ❌ "John Smith says..."  ❌ "Acme Corp uses Study It"
 *      ✅ Real user-supplied names (display name) or no name at all.
 *
 *   5. Math.random() in render-time data paths
 *      Random IDs are fine. Random "data" is not.
 *
 * LEGITIMATE FALLBACKS — these are fine because they're configuration, not data:
 *   ✅ `opts.maxTokens || 2000` (API request default)
 *   ✅ `opts.thinkingBudget || 8000` (API config default)
 *   ✅ `data.expires_in || 3600` (response field default)
 *   ✅ Curated app content like SKILLS_OF_DAY (real learning techniques) —
 *      these are FEATURES, not user data.
 *
 * Enforcement: test-no-fake-data.js runs on every sweep and fails the build
 * if it detects known antipatterns. Edit that test when adding new patterns
 * to forbid.
 * ════════════════════════════════════════════════════════════════════════════ */

import {
  BookOpen, Layers, PenLine, Target, Sparkles, Check, X,
  ChevronRight, ChevronLeft, ChevronDown, Flame, Clock, FileText, Image as ImageIcon,
  Mic, MicOff, Calendar, Zap, Brain, RotateCw, Loader2, ArrowRight,
  Lightbulb, Camera, Trash2, File as FileIcon, ClipboardPaste, MessageCircle,
  ScrollText, GraduationCap, Send, HelpCircle, Sigma, Scale, Repeat, Timer,
  Globe, Telescope, ExternalLink, Network, Workflow,
  Download, Calculator, Edit3, Settings, Eraser, Heart,
  Drama, Users, Code, Diamond, Plug,
  Headphones, Star, Presentation, GitBranch, Table,
  Printer, Share2, Link2, Copy,
} from "lucide-react";

// ============================================================
// DESIGN SYSTEM — editorial/library aesthetic
// ============================================================
// ============ COLOR PALETTES ============
// Two themes: "Twilight Library" (dark, default) + "Daybreak Library" (light, the original editorial palette).
// Switched at runtime via persistedTheme localStorage key. The exported `C` is replaced with a getter
// that resolves to the active theme's palette.

const PALETTE_DARK = {
  paper:      "#1A1D22", paperLight: "#22262E", paperDark:  "#14171C",
  // ink tiers tuned for readable contrast on dark paper:
  //   ink    (#E5E3DD) on paper — ratio ~13:1 (AAA)
  //   inkSoft (#C2BFB7) on paper — ratio ~10:1 (AAA)
  //   inkMuted (#B0AAA1) on paper — ratio ~7.4:1 (AAA) — was #928E87 (~5:1, AA only, dim at small sizes)
  ink:        "#E5E3DD", inkSoft:    "#C2BFB7", inkMuted:   "#B0AAA1",
  rule:       "#2C313A",
  accent:     "#C28977", accentSoft: "#33231F",
  gold:       "#C9A56B", goldSoft:   "#2E2820",
  moss:       "#7FA382", mossSoft:   "#1E2820",
  blue:       "#7E9ABA", blueSoft:   "#1F2832",
  plum:       "#A87FA0", plumSoft:   "#2A1F28",
  shadow:     "rgba(0, 0, 0, 0.40)",
};

const PALETTE_LIGHT = {
  paper:      "#F4EFE6", paperLight: "#FBF7EE", paperDark:  "#EAE2D2",
  // ink tiers tuned for readable contrast on warm cream paper:
  //   ink     (#1C1A17) on paper — ratio ~17:1 (AAA)
  //   inkSoft (#3D3833) on paper — ratio ~12:1 (AAA)
  //   inkMuted (#5E574F) on paper — ratio ~7.4:1 (AAA) — was #7A716A (~4:1, FAILED AA)
  ink:        "#1C1A17", inkSoft:    "#3D3833", inkMuted:   "#5E574F",
  rule:       "#D9CFBE",
  // Accent colors darkened so text-on-tinted-background patterns (used throughout for chips,
  // badges, error messages) hit WCAG AA:
  //   accent (#8E2D22) on accentSoft — ~6:1 (was #B43A2C → 4.1:1, FAILED AA)
  //   gold   (#7C5F23) on goldSoft   — ~5:1 (was #A88438 → 2.4:1, FAILED AA badly)
  //   moss   (#44502E) on mossSoft   — ~5.4:1 (was #5C6B3F → 4.2:1, FAILED AA)
  // blue + plum already pass AA on their tints (kept as-is).
  accent:     "#8E2D22", accentSoft: "#E8BFB7",
  gold:       "#7C5F23", goldSoft:   "#E8D9B0",
  moss:       "#44502E", mossSoft:   "#CFD9BC",
  blue:       "#3A5C7A", blueSoft:   "#C5D4E2",
  plum:       "#6B3A5C", plumSoft:   "#E0CDD8",
  shadow:     "rgba(28, 26, 23, 0.08)",
};

// Read initial theme from localStorage (default: dark — the Twilight Library aesthetic).
// MUST run before any module-level code that depends on C, so this is at top of file.
const _initialTheme = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("lectern_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
  } catch {}
  return "dark";
})();

// Proxy: any access to C.X returns the current theme's value at access time.
// Components re-render via the React state when setTheme is called.
const _themeState = { current: _initialTheme };
const C = new Proxy({}, {
  get: (_, key) => (_themeState.current === "light" ? PALETTE_LIGHT : PALETTE_DARK)[key],
  ownKeys: () => Object.keys(_themeState.current === "light" ? PALETTE_LIGHT : PALETTE_DARK),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const fontDisplay = `"Cormorant Garamond", "Playfair Display", Georgia, serif`;
const fontSerif = `"Lora", Georgia, serif`;
const fontSans = `"Work Sans", -apple-system, sans-serif`;
const fontMono = `"JetBrains Mono", "Courier New", monospace`;

// ============ APP VERSION / BUILD METADATA ============
// These are real, not fake. APP_VERSION follows semver. BUILD_DATE is set at the time of this build.
// Surfaced in the footer + Settings → About for transparency about which version users are on.
const APP_VERSION = "1.36.0";
const BUILD_DATE = "2026-06-02";
const APP_NAME = "Study It";

// ============ HELP CONTENT — comprehensive in-app manual ============
// Honest descriptions. Names every feature, says what it does AND what it doesn't.
const HELP_CONTENT = [
  {
    category: "Getting Started",
    icon: "🌱",
    entries: [
      {
        id: "gs-what",
        title: "What is Study It?",
        body: "An editorial AI study companion. You bring your own AI API key (or use a free local model via WebGPU); the app does the rest — generates flashcards, practice quizzes, explainers, concept maps, slide decks, audio overview scripts, briefings, mind maps, and more. NotebookLM-inspired: you can ground every output in your own sources via Notebooks, with [S1], [S2] citations linking claims back to where they came from.",
      },
      {
        id: "gs-first-5",
        title: "First 5 minutes",
        body: "1. Open Settings → AI Provider. Paste your AI API key (starts with sk-ant-, available at console.anthropic.com) and click Save. Or, if you have a recent GPU, switch the provider to Local AI and download a model — free but much less capable than the cloud AI.\n\n2. Type a topic in the AI Tutor (e.g. \"photosynthesis\") and click any mode card — Flashcards, Practice, Explain, etc.\n\n3. For source-grounded work: go to Library → New notebook, paste in textbook excerpts or article text as Sources, then generate. Outputs will cite [S1], [S2] back to your sources.",
        action: { label: "Open Settings", onClick: "openSettings" },
      },
      {
        id: "gs-keys",
        title: "Bringing your own API key",
        body: "API keys start with sk-ant- (sign up at console.anthropic.com — paid). The key is stored only in your browser's localStorage — never sent anywhere except direct browser-to-AI API calls. You pay the API provider directly for usage. You can remove the key at any time in Settings.",
      },
      {
        id: "gs-local",
        title: "Free local AI (WebGPU)",
        body: "Settings → AI Provider → Local AI. Runs Llama 3.2, Phi 3.5, or Gemma 2 entirely in your browser via WebGPU. Honest tradeoff: these models are dramatically less capable than the cloud AI — fine for vocab drilling, weak on rigorous analysis or up-to-date information. Requires a recent GPU and ~1-3GB model download (cached after first use).",
      },
    ],
  },
  {
    category: "AI Tutor & Output Modes",
    icon: "✦",
    entries: [
      {
        id: "ai-modes",
        title: "All 19 output modes, by purpose",
        body: "DRILL: Flashcards (front/back, spaced repetition), Recall (active recall practice).\n\nTEST YOURSELF: Practice (10 MCQs), Exam (timed 10-25 Q exam), Diagnostic (assesses what you know first), Free Response (open-ended questions), Error Review (targets your weak spots).\n\nUNDERSTAND: Explain (structured breakdown), Cheatsheet (1-page reference), Derive (step-by-step derivation), Critique (steelman + counterarguments).\n\nPLAN: Curriculum (multi-week study plan), Concept Map (knowledge graph).\n\nNOTEBOOKLM-STYLE: Audio Overview (two-host podcast script), Mind Map (interactive SVG), Briefing Document (executive report), Slide Deck (presentation), Data Table (comparison matrix).\n\nCONVERSE: Tutor chat (free-form Q&A).\n\nFor a full deep-dive on each mode, see the \"Each Output Mode in Detail\" category.",
      },
      {
        id: "ai-quality",
        title: "AI Quality Studio (Settings)",
        body: "4 presets:\n• SPEED — Haiku 4.5, single pass, no thinking, no web. Fast and cheap.\n• BALANCED — Opus 4.7, 8k thinking, 4 web searches, single pass. The default.\n• QUALITY — Opus 4.7, 16k thinking, 8 web searches, 3-stage multi-agent (Draft → Critique → Refine).\n• MAX — Opus 4.8, 24k thinking, 12 web searches, 4-stage with Chain-of-Verification.\n\nOr fine-tune: pick a model, set thinking budget (0-32k tokens), set web search uses (0-16), toggle multi-agent + verification independently. Quality scales with cost.",
      },
      {
        id: "ai-reasoning",
        title: "Reasoning trace",
        body: 'Below every generation, expand "How this was generated · N stages · [Model]" to see what each stage did: Draft (initial output), Critique (brutal senior reviewer flags weaknesses), Refine (apply critiques), Verify (fact-checking auditor on Max preset). This is real — it shows the actual multi-agent pipeline you configured.',
      },
      {
        id: "ai-mastery",
        title: "Mastery Check after high scores",
        body: "Score ≥80% on Practice or Exam but not perfect? The app shows the questions you missed with explanations, then offers a Quick Mastery Check — a fresh re-quiz on the SAME concepts but with different wording, distractors, examples. Catches \"lucky-pass\" results. Pass that re-quiz to level up to the next difficulty tier. Perfect 100%? Skip the review, go straight to leveling up.",
      },
    ],
  },
  {
    category: "Notebooks (NotebookLM-style)",
    icon: "📓",
    entries: [
      {
        id: "nb-what",
        title: "What is a Notebook?",
        body: "A persistent, named workspace with its own sources. When a notebook is active, every AI generation is grounded in the sources you added — and the AI cites them inline as [S1], [S2], etc. Hover over a citation chip to see which source it came from.",
        action: { label: "Open Library", onClick: "openLibrary" },
      },
      {
        id: "nb-create",
        title: "Creating a notebook",
        body: "Library → + New notebook. Name it (e.g. \"Biology 101 Exam\"), pick an emoji and color. Auto-activates so you can start adding sources immediately. The Active Notebook strip appears at the top of AI Tutor when one is selected.",
      },
      {
        id: "nb-sources",
        title: "Adding sources",
        body: "With a notebook active, click \"Sources\" on the strip. Paste in: textbook chapter text, article body, your own notes, references. Up to ~24,000 characters across all sources will be sent in each AI prompt. PDFs aren't ingested directly — extract the text first or use the Materials upload area in AI Tutor.\n\nNot supported (would need server-side infrastructure): YouTube transcript fetching, arbitrary URL fetching (CORS blocks browser fetches of most websites), audio file transcription.",
      },
      {
        id: "nb-citations",
        title: "How citations work",
        body: "The AI is instructed to cite every factual claim from your sources as [S1], [S2], etc., matching the source list order. RichText renders these as small dark inline badges — hover over one to see \"Source N from the active notebook.\" If the AI talks about something NOT in your sources, it's instructed to say so explicitly rather than invent.",
      },
      {
        id: "nb-exit",
        title: "Exiting a notebook",
        body: "Click \"Exit notebook\" on the strip to return to topic mode (no source grounding, AI uses its training only). The notebook still exists — just isn't active. Re-activate by clicking it again in Library.",
      },
    ],
  },
  {
    category: "Vault (Saved Generations)",
    icon: "📚",
    entries: [
      {
        id: "vault-what",
        title: "What gets saved",
        body: "Every artifact-style generation auto-saves to the Vault — Flashcards, Practice, Exam, Explain, Cheatsheet, Curriculum, Concept Map, Diagnostic, Audio Overview, Mind Map, Briefing, Slide Deck, Data Table. Conversational modes (Tutor chat, Error Review) are deliberately NOT saved.\n\nCapped at 200 most recent. Dedup is (mode + topic + notebook) — same topic in two notebooks both get kept.",
        action: { label: "Open Second Brain", onClick: "openBrain" },
      },
      {
        id: "vault-resume",
        title: "Resuming a saved generation",
        body: "AI Tutor home shows \"Resume recent\" with your 4 latest saves. Click any chip to reopen the full content without regenerating (saves API cost). Second Brain → Vault grid shows all 200 with previews, mode badges, age labels, and delete buttons.",
      },
      {
        id: "vault-undo",
        title: "Deleting (with undo)",
        body: "Click the X on any Vault card to delete. A 5-second \"Undo\" toast appears at the bottom of the screen — click Undo to restore. If you don't, it commits permanently. Same pattern for notebook delete.",
      },
    ],
  },
  {
    category: "Handwriting OCR (Power Mode)",
    icon: "✎",
    entries: [
      {
        id: "ocr-tips",
        title: "Image tips for best results",
        body: "For best handwriting reading:\n• Straight-on (not angled)\n• Good lighting (sunlight or bright lamp, no shadow on the page)\n• Filling most of the frame (don't shoot a tiny portion of a big page)\n• In focus (tap the screen to focus before snapping)",
      },
      {
        id: "ocr-pipeline",
        title: "How power mode works",
        body: "Stage 1: Generates 3 preprocessed image variants — Original (scaled, no enhancement), Enhanced (grayscale-lean + S-curve contrast + unsharp mask), and Binarized (Otsu adaptive threshold → pure black/white, best for faint pencil).\n\nStage 2: Sends all 3 variants to Opus 4.8 (frontier vision model) in a single message. The model reads across all 3 lenses and reconciles per-word.\n\nStage 3: Focused refinement pass on uncertain words with the original image + domain context. Final transcript with confidence rating and uncertainty list.",
      },
      {
        id: "ocr-domain",
        title: "Domain hint",
        body: 'Optional one-line context input (e.g. "biology lecture notes" / "Spanish poem" / "physics derivation" / "medical chart"). Gets fed into both stages. Helps the model disambiguate ambiguous words based on what makes sense in your specific subject area.',
      },
      {
        id: "ocr-honest",
        title: "Honest limits",
        body: "This uses the cloud AI's vision model — there's no separate handwriting model. Two frontier-tier calls per run = highest API cost. If a literate human adult can't read your handwriting, this can't either. The 3-variant approach + focused refinement gives meaningful gains on hard cases but isn't magic.",
      },
    ],
  },
  {
    category: "Export & Sharing",
    icon: "↗",
    entries: [
      {
        id: "exp-formats",
        title: "Four export formats",
        body: "Every output has an Export dropdown:\n• PDF — works on every mode (jsPDF, in-bundle)\n• Word (.docx) — prose modes (Explain, Briefing, Cheatsheet, Curriculum, Critique, Derive, Audio Overview transcript, Flashcards)\n• Excel (.xlsx) — Data Table, Flashcards, Practice/Exam/Diagnostic\n• PowerPoint (.pptx) — Slide Deck only (all 4 layouts + speaker notes attached)\n\nThe docx/xlsx/pptx libraries are lazy-loaded from CDN on first use to keep the initial bundle small. First export of a type takes ~1 second extra.",
      },
      {
        id: "exp-other",
        title: "Other export paths",
        body: "Integrations tab:\n• Anki TSV export (for Anki desktop import)\n• Markdown export (full content + frontmatter)\n• .ics calendar export (study schedule)\n• Print study sheet (browser print dialog)\n• Slack/Discord/Zapier webhook (daily summary)\n• Google Drive (OAuth-PKCE, full read/write, Save markdown to Drive)",
      },
    ],
  },
  {
    category: "Keyboard & Power-user",
    icon: "⌨",
    entries: [
      {
        id: "kb-palette",
        title: "Command palette (⌘K / Ctrl+K)",
        body: "Fuzzy-search every nav, mode, action, quality preset, export, account command. Arrow keys to navigate, Enter to execute, Esc to close. Commands that need a topic (e.g. \"Generate Flashcards\") are gated when no topic is entered.",
        action: { label: "Open palette", onClick: "openPalette" },
      },
      {
        id: "kb-shortcuts",
        title: "All keyboard shortcuts",
        body: "? opens shortcut overlay\n⌘K (or Ctrl+K) opens command palette\nEsc closes any open modal or palette\nTab cycles through interactive elements (proper focus rings on keyboard nav)\nWhen in chat: ⌘+Enter sends message\nWhen on a quiz: Space submits, 1-4 picks A/B/C/D, → advances\n\nFull list in the ? overlay.",
        action: { label: "Show shortcuts", onClick: "openShortcuts" },
      },
    ],
  },
  {
    category: "Settings & Customization",
    icon: "⚙",
    entries: [
      {
        id: "set-language",
        title: "Output language (26 supported)",
        body: "Settings → Output language. Pick from 26 languages (English, Spanish, French, German, Italian, Portuguese, Mandarin Chinese, Japanese, Korean, Hindi, Arabic, Russian, Dutch, Polish, Turkish, Vietnamese, Indonesian, Thai, Hebrew, Swedish, Norwegian, Danish, Finnish, Greek, Czech, Ukrainian). The interface stays English; JSON schema keys stay English; only the AI-generated text values translate.",
      },
      {
        id: "set-level",
        title: "Your level (Settings → Profile)",
        body: 'Free-text field describing where you are: "10th grade" / "undergrad junior in CS" / "35yo with no formal math background" / "PhD candidate in molecular bio." Every AI prompt includes this so explanations match your level. Plus the Difficulty picker (Elementary → Frontier) sets the rigor tier.',
      },
      {
        id: "set-classes",
        title: "Classes (Library)",
        body: 'Add your enrolled classes (e.g. "Bio 101 · MWF 9am · Prof Smith") with course code, instructor, meeting times, and exam dates. Every AI generation knows your current classes — curriculum mode mentions "connections to your classes," practice questions reference related concepts you\'ve studied.\n\nSelf-study mode: When creating a class, check "I\'m self-studying this (not enrolled in a formal course)." The form\'s placeholders change ("Subject" instead of "Class name," "Target" instead of "Term"). Use this for things you\'re learning on your own — Linear Algebra over the summer, Spanish on the side, etc.\n\nAuto-curriculum: When creating a new class, you can also check "Also build me a multi-week study plan." After saving, the app jumps to AI Tutor and automatically runs curriculum mode with the class name as the topic. You get a week-by-week plan generated by the AI without any extra clicks. Uses your AI key (Cloud or Local). Toast confirms: "Class added — building study plan…"',
      },
      {
        id: "set-sync",
        title: "Cross-device sync (Supabase)",
        body: "Settings → Account. Sign in (magic link or password) and your profile + classes sync across devices via Supabase with RLS-enforced privacy. Sync is opt-in. Sync status dot in Settings shows synced / pending / error.\n\nNot synced (yet): Vault, Notebooks, notes — these stay local-only.",
      },
    ],
  },
  {
    category: "Internal & Troubleshooting",
    icon: "ⓘ",
    entries: [
      {
        id: "int-diag",
        title: "Diagnostics panel",
        body: "Footer → Diagnostics (or ⌘K → Diagnostics). Real internal state, computed live: app version, build date, browser + OS, online status, WebGPU support, localStorage usage with % of 5MB quota, AI API usage (session + lifetime counts, input/output token estimates, avg + p95 latency), notebook/source/vault counts, recent errors. Copy diagnostics button bundles everything into a text blob for bug reports.",
        action: { label: "Open Diagnostics", onClick: "openDiagnostics" },
      },
      {
        id: "int-offline",
        title: "Offline mode",
        body: 'When your browser detects no network, a red OFFLINE pill appears in the header. Cloud AI calls will fail — but local-only features (Vault browsing, Notebook editing, notes, saved generations) still work. The pill auto-clears when you\'re back online.',
      },
      {
        id: "int-storage",
        title: "Storage limits",
        body: "localStorage is ~5MB total. The Diagnostics panel shows current usage with a color-coded progress bar (green < 60% / gold 60-80% / red > 80%). When full, persistence operations fail silently. Most data is small — a generation is ~5KB, a notebook with sources is ~10-50KB. You should be fine with hundreds of items.",
      },
      {
        id: "int-when-broken",
        title: "When something feels off",
        body: "1. Open Diagnostics — check the API error count, the last error message, and the latency. High latency? The cloud AI API might be slow. 401/403? Re-enter your key. 2. Check the OFFLINE indicator. 3. Try resetting session counters. 4. As a last resort, you can clear localStorage from your browser's devtools (Application → Storage) — but this wipes everything (API key, Notebooks, Vault, classes). Export your data first if you can.",
      },
    ],
  },
  {
    category: "Privacy & Data",
    icon: "🔒",
    entries: [
      {
        id: "priv-storage",
        title: "Where your data lives",
        body: "Almost everything is in your browser's localStorage: API key, notebooks, sources, vault, classes, notes, settings. None of this is sent anywhere unless you explicitly opt-in:\n• Sync (optional) — encrypts profile + classes to Supabase with row-level security\n• Drive (optional) — you grant OAuth access; only files you choose\n• Cloud AI — API calls go DIRECTLY from your browser to the AI provider. Your prompts/responses never route through any intermediate server.",
      },
      {
        id: "priv-analytics",
        title: "Analytics",
        body: 'Lightweight in-browser only — the lectern_analytics_v1 localStorage key tracks event counts (e.g. "flashcard_generated") for your own usage stats. Not transmitted anywhere. Clear it from Diagnostics if you want.',
      },
    ],
  },
  {
    category: "The 8 Tabs",
    icon: "🧭",
    entries: [
      {
        id: "tab-today",
        title: "Today tab — daily home",
        body: "Where to find it: top of every page, leftmost tab.\n\nWhat it does: A daily-review dashboard. Shows: your study streak; total sessions; minutes studied today; concepts mastered; accuracy rating; Skill of the Day card (rotating study technique with explainer); Daily Challenge (one focused practice question, fresh each day); Minimum Viable Session (a 90-second study micro-prompt for low-energy days); Implementation Intention prompt (write down WHEN and WHERE you'll study tomorrow — a behavior-science nudge that doubles follow-through rates).\n\nHow to use it: Start your study session here. Click Skill of the Day to learn the technique. Click Daily Challenge to do today's practice. Fill in the Implementation Intention field with something specific like \"9am at the library.\"\n\nWhy it matters: the daily structure removes decision fatigue. You don't have to figure out what to study — Today suggests something concrete.",
      },
      {
        id: "tab-library",
        title: "Library tab — notebooks + classes",
        body: "Where to find it: second tab from left in the header.\n\nWhat it does: Two things in one place. (1) Your notebooks (source-grounded study collections — see the Notebooks section). (2) Your classes (subjects you're studying — used by the curriculum builder and the iCal subscription).\n\nHow to use it: Click \"New notebook\" to create a notebook scoped to a specific topic. Add classes with their typical study time and difficulty so the curriculum builder can plan a realistic week for you.\n\nClasses don't require you to attach sources. They're just labels that help the AI understand what you're working on across multiple sessions.",
      },
      {
        id: "tab-tutor",
        title: "AI Tutor tab — the main workspace",
        body: "Where to find it: third tab from left, the ✦ icon.\n\nWhat it does: The primary place where AI generation happens. Type a topic, pick a mode (flashcards / explainer / quiz / etc.), generate.\n\nHow to use it: (1) Type a topic in the search bar at the top. (2) Optionally upload material (notes, PDFs, photos via the upload buttons). (3) Click any mode card. (4) Wait for generation — depending on Quality Studio settings, this can be 5 seconds to 2 minutes. (5) Review the output. Save to Vault if useful; rate cards if it was flashcards.\n\nResume Recent strip at the top shows your last 3 generations across all topics — clicking jumps back into them instantly.",
      },
      {
        id: "tab-second-brain",
        title: "Second Brain tab — your generation history",
        body: "Where to find it: fourth tab from left.\n\nWhat it does: A searchable timeline of every AI generation you've saved to the Vault. Filter by mode (only flashcards, only quizzes), filter by topic, filter by date. Click any entry to view the full generation again.\n\nHow to use it: Save generations from the AI Tutor by clicking the bookmark icon on the output. They appear here. The Vault is purely local (browser localStorage) — it doesn't sync across devices unless you've enabled Supabase sync.\n\nUseful for revisiting past explanations, re-running spaced-repetition reviews on old flashcard sets, or pulling up that explainer you generated about photosynthesis three weeks ago.",
      },
      {
        id: "tab-projects",
        title: "Projects tab — long-form work",
        body: "Where to find it: fifth tab from left.\n\nWhat it does: For multi-step, multi-session study projects (e.g. \"prepare for AP Bio exam\" or \"learn React in 30 days\"). Tracks progress across multiple sub-topics, generated materials, and review sessions.\n\nHow to use it: Create a project, define the goal + deadline, let the AI break it into milestones. Each milestone becomes a focused study target with its own generated materials. Mark milestones complete as you work through them.",
      },
      {
        id: "tab-code-stem",
        title: "Code & STEM tab — math, code, derivations",
        body: "Where to find it: sixth tab from left.\n\nWhat it does: Specialized tools for technical subjects.\n\nTools available: (1) Math Solver — paste an equation or word problem, get step-by-step solution with explanations. (2) Whiteboard — draw equations/diagrams freehand on a canvas, AI reads + explains them. (3) Derive a Proof — give the AI a theorem and it walks through the proof step-by-step. (4) Explain Code — paste any code, get line-by-line explanation.\n\nHow to use: Pick a tool, type your question or paste your code, click the action button. Output appears inline.\n\nProvider-aware: Math Solver and Explain Code do honest preflight checks. If you're on Cloud AI without an API key, they tell you. If you're on Local AI without a model loaded, they tell you. They don't silently fail.",
      },
      {
        id: "tab-wellbeing",
        title: "Wellbeing tab — sustainable studying",
        body: "Where to find it: seventh tab from left.\n\nWhat it does: Tracks your study sessions across the week and shows whether you're studying sustainably. Includes a heatmap of when you studied (real, not fake — derived from your actual session timestamps), a fatigue indicator (long sessions without breaks get flagged), and gentle break-reminder defaults.\n\nHow to use it: Mostly automatic — the app tracks sessions as you do them. Visit this tab when you want to see the bigger picture: am I studying every day? Am I burning out by doing 4-hour sessions? When do I tend to be most productive?\n\nThe app does NOT lecture you or score your habits. It just shows what's happening so you can decide.",
      },
      {
        id: "tab-integrations",
        title: "Integrations tab — external connections",
        body: "Where to find it: rightmost tab.\n\nWhat it does: All your external-service connections and configurations in one place.\n\nCards available: (1) Backend configuration — Setup Pack import/export, manual Supabase override. (2) Web search for local model — point to your Edge Function. (3) iCal subscription — generate a calendar feed URL. (4) Google Drive — OAuth sign-in for direct Markdown export to your Drive folders. (5) Anthropic byo-key — manage your API key (alternate location to Settings).\n\nMost users only touch this tab during initial setup. After that it sits idle.",
      },
    ],
  },
  {
    category: "Each Output Mode in Detail",
    icon: "✦",
    entries: [
      {
        id: "mode-flashcards",
        title: "Flashcards (spaced repetition)",
        body: "What it does: Generates a deck of front/back cards from your topic or sources. Uses SM-2 spaced repetition under the hood — every time you rate a card (Again / Hard / Good / Easy), the algorithm schedules its next review interval (1 day → 6 days → exponentially increasing intervals based on ease).\n\nWhere to find it: AI Tutor → Flashcards card. Or Code & STEM has math-specific variants.\n\nHow to use it: Type topic → click Flashcards → review each card by clicking to flip → rate honestly. Cards you rate \"Again\" come back tomorrow. Cards you rate \"Easy\" disappear for weeks.\n\nThe review queue (Today tab) surfaces cards that are DUE for review based on the spaced-repetition schedule. Don't try to review every card every day — trust the algorithm.",
      },
      {
        id: "mode-practice",
        title: "Practice (10-question quiz)",
        body: "What it does: Generates 10 multiple-choice questions with 4 options each. After you finish, shows which you got right/wrong with full explanations.\n\nHow to use it: Type topic → click Practice → answer one at a time → see your score + concept-level breakdown at the end.\n\nIf you score ≥80% but not perfect: a \"Quick Mastery Check\" appears. The app re-quizzes you on the same concepts with different wording/distractors. Pass that re-quiz to level up to harder difficulty.\n\nIf you score <80%: focus on the explanations of what you missed before retrying.",
      },
      {
        id: "mode-exam",
        title: "Exam (timed simulation)",
        body: "What it does: Generates a longer, timed quiz (10-25 questions) styled like an actual exam. Multi-format: MCQs, short answer, sometimes longer free-response.\n\nHow to use it: Pick number of questions + time limit. The countdown timer starts immediately. Submit when done OR when time runs out.\n\nUse this to simulate test conditions before a real exam — the time pressure is part of the practice.",
      },
      {
        id: "mode-diagnostic",
        title: "Diagnostic (find weak spots first)",
        body: "What it does: A short adaptive quiz that probes what you DON'T know. Starts general, narrows in on areas where you struggle. Output is a personalized weakness map.\n\nWhen to use it: Start of a study session when you're not sure what to focus on. Or before a major review — find the gaps before reviewing everything blindly.\n\nThe weak spots it identifies get fed into future quiz generation, so subsequent quizzes weight harder questions toward your weak areas automatically.",
      },
      {
        id: "mode-explain",
        title: "Explain (structured breakdown)",
        body: "What it does: A clear, structured explanation of the topic. Sections include definition, key components, common misconceptions, real-world examples, and how it connects to related concepts.\n\nWhen to use it: First time learning something. Or when you read about something and need to make sense of it.\n\nThis mode streams in real-time — you see Claude's writing appear as it's generated. Cancel by navigating away.",
      },
      {
        id: "mode-cheatsheet",
        title: "Cheatsheet (1-page reference)",
        body: "What it does: Condenses a topic to a one-page reference card: key formulas, definitions, exceptions, common pitfalls, mnemonics. Dense but scannable.\n\nWhen to use it: Right before a quiz or exam when you want to refresh the essentials quickly.\n\nCheatsheets work best with bounded topics (\"trig identities\" or \"causes of WWI\") rather than huge ones (\"world history\").",
      },
      {
        id: "mode-recall",
        title: "Recall (active retrieval practice)",
        body: "What it does: Prompts you to write out everything you know about a topic from memory, no peeking. Then the AI compares your recall against a comprehensive answer and shows what you forgot.\n\nWhy it works: Active recall is the most evidence-backed study technique. Trying to retrieve information strengthens memory more than re-reading does.\n\nHow to use it: Click Recall → write your answer in the textarea → submit → see the gaps.",
      },
      {
        id: "mode-free-response",
        title: "Free Response (open-ended Q)",
        body: "What it does: Generates 3-5 essay-style or short-answer questions. You write your responses. AI grades each one against rubrics and points out what's missing.\n\nWhen to use it: Practicing for exams that have written components, not just MCQs. Honing your ability to explain rather than just recognize.",
      },
      {
        id: "mode-error-review",
        title: "Error Review (target your weak spots)",
        body: "What it does: Queries the questions you've gotten wrong in recent quizzes and regenerates fresh practice focused on those concepts.\n\nWhen to use it: After a quiz with low score. Instead of redoing the same quiz, error review generates NEW questions on the same concepts so you can't just memorize answers.",
      },
      {
        id: "mode-derive",
        title: "Derive (step-by-step derivation)",
        body: "What it does: Walks through a mathematical or logical derivation. Each step shows the rule applied and why.\n\nWhere to find it: Code & STEM tab → Derive a Proof. Or AI Tutor with technical topics.\n\nUse it for: proofs in math, derivations in physics, formal arguments in logic/philosophy.",
      },
      {
        id: "mode-critique",
        title: "Critique (steelman + counterarguments)",
        body: "What it does: For arguments, theories, or claims — the AI presents the strongest version of the argument (steelman), then the strongest counterarguments. Both sides treated seriously.\n\nWhen to use it: Studying for debate. Writing argumentative essays. Stress-testing your own beliefs. Understanding contested topics in your field.",
      },
      {
        id: "mode-curriculum",
        title: "Curriculum (multi-week study plan)",
        body: "What it does: Builds a realistic study plan for a goal, calibrated to YOUR available time and current level. Output: week-by-week schedule with specific topics per session, recommended modes for each session, milestones.\n\nHow to use it: Set up your context in Settings → Profile (your level, hours/week available, exam date if any). Then go to Curriculum, type the subject, generate. You'll get a plan you can actually follow.\n\nWorks WITHOUT a formal class — the curriculum builder uses your learner context (age/grade, goal) to scope appropriately. You don't need to attach materials.",
      },
      {
        id: "mode-concept-map",
        title: "Concept Map (knowledge graph)",
        body: "What it does: Generates a textual concept map: central topic, surrounding concepts, relationships between them (\"X causes Y\", \"X is a type of Y\", \"X depends on Y\").\n\nWhen to use it: Understanding how a topic fits into a bigger picture. Identifying which concepts are foundational vs derivative.",
      },
      {
        id: "mode-audio-overview",
        title: "Audio Overview (podcast-style script)",
        body: "What it does: Generates a script for a two-host podcast episode about the topic. Host A and Host B trade lines, ask each other questions, riff on examples. Reads like a real conversation.\n\nWhy it exists: For audio learners. You can read it aloud, paste into a text-to-speech tool, or have someone help record it.\n\nNotebookLM-inspired. Streams in real-time.",
      },
      {
        id: "mode-mind-map",
        title: "Mind Map (interactive SVG)",
        body: "What it does: Generates a true SVG mind map — central topic in the middle, branches radiating out to sub-topics, with sub-sub-topics on each branch. Rendered as a clickable, zoomable diagram in the browser.\n\nDownload as SVG or PNG for use in your notes app.",
      },
      {
        id: "mode-briefing",
        title: "Briefing Document (executive report)",
        body: "What it does: Generates a 1-2 page formal report on the topic. Headers, sections, bullet points, executive summary at the top. Reads like a McKinsey-style brief.\n\nUse it for: presentations, sharing with non-experts, when you need to communicate a topic to someone else in writing.",
      },
      {
        id: "mode-slide-deck",
        title: "Slide Deck (presentation outline)",
        body: "What it does: Generates a slide-by-slide outline for a presentation. Each slide has a title and bullet points. Export to PPTX for use in PowerPoint, Keynote, Google Slides.",
      },
      {
        id: "mode-data-table",
        title: "Data Table (comparison matrix)",
        body: "What it does: Generates a structured comparison table — items on rows, attributes on columns. Useful when learning a topic that has many similar items differentiated by specific traits (e.g. amino acids by R-group, planets by orbital parameters, historical figures by ideology).",
      },
      {
        id: "mode-tutor-chat",
        title: "Tutor Chat (free-form Q&A)",
        body: "What it does: Open-ended conversation with the AI tutor. You ask questions, it answers, you follow up. No fixed structure.\n\nWhen to use it: When your question isn't \"give me flashcards\" but \"why does this work?\" or \"can you explain why my answer was wrong?\".\n\nThe chat is scoped to your current topic + notebook (if one is active), so the tutor stays grounded in your context.",
      },
    ],
  },
  {
    category: "Code & STEM Tools (Deep Dive)",
    icon: "∑",
    entries: [
      {
        id: "stem-math-solver",
        title: "Math Solver",
        body: "Where to find it: Code & STEM tab → Math Solver card → click Open.\n\nWhat it does: Paste an equation, word problem, or LaTeX expression. AI solves step-by-step with explanations of each step. Handles algebra, calculus, statistics, linear algebra.\n\nHonest limit: very long or research-level math may struggle. Not a replacement for Wolfram Alpha for hard symbolic computation. Best for explaining HOW to solve, not just the final answer.",
      },
      {
        id: "stem-whiteboard",
        title: "Whiteboard",
        body: "Where to find it: Code & STEM tab → Whiteboard.\n\nWhat it does: A drawing canvas where you can sketch equations, diagrams, anatomy, circuits — anything visual. The AI reads your drawing and explains it.\n\nHow to use it: Draw using your trackpad or stylus. When done, click \"Explain this drawing.\" AI uses vision to interpret your sketch.\n\nGreat for hand-drawn math problems where typing the equation is awkward. Works best with clean, legible drawings on the warm off-white canvas.",
      },
      {
        id: "stem-derive",
        title: "Derive a Proof",
        body: "Where to find it: Code & STEM tab → Derive a Proof.\n\nWhat it does: Walks through a formal proof step-by-step. Each step shows the rule applied and why.\n\nHow to use it: Click Derive a Proof → a prompt asks for the theorem (e.g. \"prove the sum of angles in a triangle is 180°\") → submit → AI generates the full derivation.\n\nUse the streaming preview to follow along as the proof unfolds.",
      },
      {
        id: "stem-explain-code",
        title: "Explain Code",
        body: "Where to find it: Code & STEM tab → Explain Code.\n\nWhat it does: Paste any code (any language). AI explains it line-by-line, identifies patterns, notes potential bugs.\n\nHow to use it: Click Explain Code → a prompt asks for the code → paste → submit. Output appears inline.\n\nWorks great with: Python, JavaScript, Java, C++, Rust, SQL, Bash, R, MATLAB, and most major languages.",
      },
    ],
  },
  {
    category: "Settings (Every Section)",
    icon: "⚙",
    entries: [
      {
        id: "settings-where",
        title: "Where to find Settings",
        body: "Click the gear icon ⚙ in the top-right of the header, on any page. Settings opens as a modal overlay. Close with X or Esc.",
      },
      {
        id: "settings-ai-provider",
        title: "Settings → AI Provider",
        body: "Where: Settings → AI Provider section.\n\nWhat it does: Pick which AI runs the show — Cloud AI (paid, world-class) or Local AI (free, weaker).\n\nCloud AI fields:\n• API Key — paste your Anthropic key here. Password-masked. Stored in browser localStorage only.\n• Test connection — verifies the key works.\n• Remove key — clears it from your browser.\n\nLocal AI section:\n• Pick a model (Llama 3.2 1B / 3B, Phi 3.5 mini, Gemma 2 2B, Phi 3.5 vision).\n• Download — first time triggers a ~1-3GB download cached in IndexedDB. Subsequent loads are instant.\n• Unload — frees GPU memory.\n• Quality difference vs Cloud AI is honestly explained inline.",
      },
      {
        id: "settings-profile",
        title: "Settings → Profile",
        body: "Where: Settings → Profile section.\n\nFields:\n• Display name — what the greeting calls you (\"Good evening, [name]\").\n• Age or grade — e.g. \"10th grade\", \"undergrad junior\", \"adult, no formal background in CS\". Helps the AI calibrate explanations to your level.\n• Learning goal — short description of what you're working toward. Used by the curriculum builder.\n• Persona — picks the tone the AI uses. Default, Drill Sergeant, Patient Mentor, etc.\n• Preferred style — \"balanced\" / \"concise\" / \"thorough\". Affects output length and depth.\n\nThe Profile context gets injected into every AI prompt so the AI knows who it's talking to.",
      },
      {
        id: "settings-quality-studio",
        title: "Settings → AI Quality Studio",
        body: "Where: Settings → AI Quality Studio section.\n\nWhat it does: Trade speed for rigor in every AI generation.\n\nFour presets:\n• Speed (Haiku 4.5, no thinking, no web search, single pass) — drafts, vocab drills.\n• Balanced (Opus 4.7, 8k thinking, 4 web searches, single pass) — default.\n• Quality (Opus 4.7, 16k thinking, 8 web searches, 3-stage multi-agent) — important explanations.\n• Max (Opus 4.8, 24k thinking, 12 web searches, 4-stage with verification) — research-grade output.\n\nOr fine-tune the knobs yourself: model picker, thinking budget slider (0-32k), search budget slider (0-16), multi-agent toggle, verification toggle.\n\nAlso here: Output Language (26 supported) and Per-fact source attribution toggle.",
      },
      {
        id: "settings-per-fact",
        title: "Settings → Per-fact source attribution",
        body: "Where: Settings → AI Quality Studio → \"Per-fact source attribution\" checkbox.\n\nWhat it does: When ON, every factual claim in AI output gets a \"→ Source: [Sn]\" or \"→ Source: [Wn]\" line beneath it. [Sn] = notebook source, [Wn] = web search result, \"general knowledge\" = from the AI's training.\n\nWhen to enable: Research notes, fact-checking, source-critical learning.\n\nWhen to disable: Flowing prose, explainers — the citations break narrative flow.\n\nDefault: OFF.",
      },
      {
        id: "settings-account",
        title: "Settings → Account (Supabase sign-in)",
        body: "Where: Settings → Account section.\n\nWhat it does: Sign in with your email to enable cross-device sync of your profile + classes + notebooks via Supabase.\n\nHow to use it: Click \"Sign in,\" enter your email, check inbox for a magic link, click it. You're now signed in.\n\nWhat syncs: profile, classes, notebooks, shared notebooks.\n\nWhat doesn't: Vault (saved generations), recent topics, review queue history. Those stay local to each device.\n\nSign out clears your session locally — your data on Supabase stays put, you can sign back in later to recover it.",
      },
      {
        id: "settings-diagnostics",
        title: "Settings → Diagnostics",
        body: "Where: Settings → Diagnostics section.\n\nWhat it shows: Real-time technical status. App version, build date, browser + OS, online status, WebGPU support, localStorage usage with % of 5MB quota, AI API usage (session + lifetime calls), error log (last 20 errors), latency of last API call.\n\nHow to use it: Open this when something's broken — the error log usually tells you what went wrong. Or open it just to see what the app knows about your setup.\n\nIncludes \"Clear analytics\" and \"Reset session\" buttons for debugging.",
      },
      {
        id: "settings-data-privacy",
        title: "Settings → Data & Privacy",
        body: "Where: Settings → Data & Privacy section.\n\nFeatures:\n• Export Everything — downloads a zip of all your data (profile, notebooks, vault, settings) as JSON files + a Markdown README.\n• Clear all data — nukes everything in localStorage (with a confirmation prompt).\n• Wipe specific categories — clear only flashcard SM-2 states, or only vault, or only review queue.\n\nUse this to back up before clearing, or before sharing your browser with someone.",
      },
    ],
  },
  {
    category: "Notebooks (Source-Grounded Learning)",
    icon: "📔",
    entries: [
      {
        id: "nb-sources-vision",
        title: "Source types you can add",
        body: "Text sources: paste textbook excerpts, article text, lecture notes, your own writing. Click \"+ Add source\" → \"Paste text.\"\n\nPDF sources: drag PDFs into the source list. Text is extracted client-side. Scanned PDFs get vision-mode reading.\n\nImage sources: photos of handwritten notes, whiteboard photos, slide screenshots. AI reads them via vision.\n\nWeb URLs: paste a URL → \"Add URL.\" App fetches the page, extracts the article body, adds as a source. Works for most blogs, news articles, Wikipedia. Doesn't work for sites behind paywalls or JavaScript-only rendered content.\n\nGoogle Drive: if you've connected Drive via OAuth (Integrations tab), import Markdown files directly.",
      },
      {
        id: "nb-share",
        title: "Sharing a notebook with someone",
        body: "Requires Supabase sign-in (both your end and the recipient's).\n\nWhere: Library tab → click a notebook → \"Share\" button.\n\nHow to use it: Enter the recipient's email → click Send. They get a notification when they next sign in. They can see your sources but not edit them.\n\nUse for: group projects, study buddies, sharing a curated set of readings with a friend studying the same subject.",
      },
      {
        id: "nb-citations-rules",
        title: "How citations actually work",
        body: "When a notebook is ACTIVE during AI generation:\n• Sources are numbered [S1], [S2], [S3]... in the order you added them.\n• The AI gets the full text of all sources injected into its prompt.\n• When it states a fact from a source, it cites inline like \"...as Plato argued [S1].\"\n• When per-fact citations are ON (Quality Studio toggle), each fact gets a separate \"→ Source: [S1]\" line.\n\nWhen a notebook is INACTIVE:\n• No [Sn] citations.\n• AI uses training only or web search if enabled.\n• Output is general knowledge, less anchored to specific texts.\n\nTo activate a notebook: click it in Library. The header shows the active notebook name. To deactivate: click \"Exit notebook\" in the active-notebook strip.",
      },
      {
        id: "nb-source-tips",
        title: "Tips for good source quality",
        body: "Length: 500-5000 words per source is the sweet spot. Shorter sources don't have enough for the AI to draw on. Longer sources risk the AI missing details buried deep.\n\nFormat: clean text or PDFs work best. Image-only PDFs (scanned old textbooks) work via vision mode but are slower and less accurate.\n\nVariety: 3-7 sources per notebook is ideal. Too few → narrow scope. Too many → noisy, the AI struggles to keep them all straight.\n\nDeduplication: don't add the same content twice. The AI doesn't know you want to emphasize it — it'll just look weird in the [Sn] numbering.",
      },
    ],
  },
  {
    category: "Camera Scanner (Capture Pages)",
    icon: "📷",
    entries: [
      {
        id: "scanner-where",
        title: "Where to find it",
        body: "AI Tutor tab → upload area (where Photo/Image/PDF/Doc buttons are) → \"Scan with auto-detect\" button below the grid.",
      },
      {
        id: "scanner-how",
        title: "How to use the auto-detect scanner",
        body: "1. Click \"Scan with auto-detect.\" Grant camera permission when prompted.\n2. A full-screen modal opens with live camera view (back camera on mobile).\n3. Point the camera at a piece of paper. Try to:\n   • Hold the camera roughly parallel to the page\n   • Have a darker surface beneath the page (desk, table)\n   • Use even lighting\n4. A gold rectangle appears when the scanner detects a possible page. The rectangle turns green and corner-brackets appear when it's stable.\n5. After ~500ms of stability, auto-capture triggers. You'll see \"Captured!\" and the image is added to your sources.\n6. Or click the white shutter button to capture manually.\n\nClick Cancel to back out without capturing.",
      },
      {
        id: "scanner-honest-limits",
        title: "Honest limits",
        body: "What it does: detects an axis-aligned bounding rectangle of bright pixels on a darker background. Auto-crops to that region with a small padding.\n\nWhat it does NOT do: perspective correction (would need OpenCV, ~8MB library). So if you photograph a page at a steep angle, the captured image is still skewed.\n\nDetection works best: white/light paper on darker desk, even lighting, page covers 30-80% of the frame.\n\nDetection struggles: cluttered backgrounds, dim lighting, glossy pages with reflections, multiple papers in frame.\n\nFallback: if auto-detect doesn't lock on, the manual shutter button always works. Or close the scanner and use the regular \"Photo\" button.",
      },
    ],
  },
  {
    category: "Edge Functions (Backend Extensions)",
    icon: "⚡",
    entries: [
      {
        id: "ef-what",
        title: "What are Edge Functions?",
        body: "Small server-side functions deployed to your Supabase project. They handle things the browser can't (or shouldn't) do directly: calling external APIs with secret keys, serving calendar feeds, etc.\n\nStudy It uses two:\n• study-search — proxies web search queries to Tavily so your local WebGPU AI can fact-check.\n• study-ics — generates an iCalendar feed of your study schedule for Apple/Google Calendar subscription.",
      },
      {
        id: "ef-web-search",
        title: "Web search for local AI",
        body: "Where to find it: Integrations tab → \"Web search for local model\" card.\n\nWhat it does: When you're using Local AI (WebGPU) and have a web search budget set in Quality Studio, the app POSTs your query to your Edge Function. The function calls Tavily's API, returns clean search results, and the app injects them into your local model's prompt as [W1], [W2] citations.\n\nWhy needed: Cloud AI (Claude) has built-in web search via the Anthropic API — no Edge Function needed for that. Local models have no internet access by default; the Edge Function gives them one.\n\nSetup: see the in-app Integrations card or the README in the share pack. Requires a Tavily API key (free 1000 searches/month at tavily.com) and a deployed function in your Supabase.",
      },
      {
        id: "ef-ical",
        title: "iCal subscription (calendar feed)",
        body: "Where to find it: Integrations tab → \"iCal subscription\" card.\n\nWhat it does: Generates a unique URL you subscribe to in Apple Calendar / Google Calendar / Outlook. Your Study It schedule (daily 5pm study reminders for each class + exam date if set) appears as live-updating calendar entries.\n\nHow to subscribe:\n• Apple Calendar: File → New Calendar Subscription → paste URL.\n• Google Calendar: Other calendars → Add by URL → paste.\n• Outlook: Add calendar → Subscribe from web → paste.\n\nCalendars poll every ~15 minutes, so changes you make in Study It (adding a class, changing exam date) appear in your calendar within minutes.\n\nRequires: deployed study-ics Edge Function + a generated token (the app generates one for you with a click).",
      },
      {
        id: "ef-deploy-via-dashboard",
        title: "Deploying Edge Functions without CLI",
        body: "If you can't get the Supabase CLI working on your machine, the dashboard route is just as good:\n\n1. Go to your Supabase project → Edge Functions in the sidebar.\n2. Click \"Deploy a new function.\"\n3. Pick \"Via Editor\" or \"From scratch.\"\n4. Name it study-search (or study-ics).\n5. Paste the function code (shown in the Integrations panel, or in the README).\n6. Click Deploy.\n7. For study-search, go to Edge Functions → Secrets → add TAVILY_API_KEY with your Tavily key.\n8. Go to the function's Settings → toggle OFF \"Verify JWT.\"\n9. The function URL appears on the function detail page — that's what you paste in the Integrations card.",
      },
    ],
  },
  {
    category: "Reading Images Locally (SmolVLM)",
    icon: "👁",
    entries: [
      {
        id: "smolvlm-what",
        title: "What is SmolVLM?",
        body: "SmolVLM is a small vision-language model (~500 MB) that runs entirely in your browser via WebGPU. It reads images and produces text descriptions. Study It uses it as an optional add-on for Local AI users who want to upload images but can't use Cloud AI.\n\nWhy it exists: WebLLM only ships ONE vision model (Phi-3.5 Vision, ~3 GB) which crashes Safari. SmolVLM is small enough to work on Safari's tighter WebGPU memory limits.\n\nQuality honest take: SmolVLM is significantly weaker than Claude vision. It's good for basic image descriptions and reading printed text. It struggles with handwriting, complex diagrams, math notation, and subtle context. If quality matters, use Cloud AI instead.",
      },
      {
        id: "smolvlm-how",
        title: "How to use SmolVLM",
        body: "Where to find it: AI Tutor tab. Upload an image while on Local AI with a non-vision model loaded (e.g. Llama 3.2 1B, Phi 3.5 Mini, Gemma 2 2B). The blue IMAGE READING hint banner will appear.\n\nSteps:\n1. Click \"Load SmolVLM (~500 MB, offline)\" in the hint banner.\n2. Wait for the download (~500 MB, cached after first load).\n3. When loaded, the banner turns green: \"SMOLVLM ACTIVE.\"\n4. Type your topic, click any generation mode (Flashcards, Explain, etc.).\n5. App describes the image with SmolVLM first, then feeds the description to your text model as context.\n6. You see a toast: \"Describing images with SmolVLM…\" during the first step.\n\nTotal time: ~10-30 seconds depending on hardware. Two-stage inference is slower than single-model vision.",
      },
      {
        id: "smolvlm-vs-cloud",
        title: "SmolVLM vs Cloud AI for images — which to pick",
        body: "Cloud AI (Claude) wins on quality:\n• Reads handwriting accurately\n• Understands diagrams, charts, math notation\n• Handles foreign-language text\n• Catches subtle visual details\n• Fast (one API call, no model download)\n\nSmolVLM wins on:\n• Offline operation (no internet needed after model is cached)\n• Privacy (images never leave your device)\n• Free (no API costs)\n• Works on Safari (the local vision alternative crashes Safari)\n\nMy recommendation: use Cloud AI when you can (it's that much better for vision), use SmolVLM when you genuinely need offline or absolute privacy.",
      },
      {
        id: "smolvlm-pipeline",
        title: "How the two-stage pipeline works",
        body: "When SmolVLM is loaded AND you have images uploaded AND you're on Local AI with a non-vision text model:\n\nStage 1 (SmolVLM via Transformers.js): The app feeds your image to SmolVLM-500M-Instruct, which generates a text description. Format: \"[Image 1]: A handwritten page showing a math problem with the equation 2x + 5 = 13...\"\n\nStage 2 (WebLLM): The description is injected into your text model's system prompt as context. Your text model (Llama / Phi / Gemma / etc.) then generates flashcards / explanations / quizzes / whatever based on that description.\n\nNet effect: your text-only local model can now \"see\" images, through the SmolVLM translator. Quality is bounded by SmolVLM's description accuracy, which is much worse than direct image-reading by Claude.",
      },
      {
        id: "smolvlm-troubleshooting",
        title: "Troubleshooting SmolVLM",
        body: "If SmolVLM fails to load:\n• WebGPU requirement: must be Chrome 113+, Edge 113+, Firefox 141+, Safari 17+, Opera 99+. Try the WebGPU report at webgpureport.org.\n• Memory: SmolVLM uses ~500 MB RAM + your text model. If total exceeds available GPU memory, the load will fail. Try Llama 3.2 1B as the smallest text model.\n• Network: First load downloads ~500 MB from HuggingFace's CDN. Subsequent loads are instant from IndexedDB cache.\n\nIf SmolVLM generates garbage descriptions:\n• Image quality: very dark, blurry, or low-contrast images confuse it.\n• Handwriting: SmolVLM struggles with cursive or messy handwriting. Type the text out instead, or use Cloud AI.\n• Complex content: math equations, diagrams, charts — SmolVLM often misreads these. Cloud AI handles them well.\n\nWhen in doubt: switch to Cloud AI from the hint banner — it's one click.",
      },
      {
        id: "smolvlm-hint-banner",
        title: "The IMAGE READING hint banner",
        body: "Where you'll see it: AI Tutor, after you upload one or more images, IF you're on Local AI AND your loaded model doesn't support vision.\n\nThe blue banner with a lightbulb icon explains that the current local model can't read images and offers three options:\n\n1. Switch to Cloud AI (best quality)\n   • If you have an Anthropic API key configured: one click swaps providers. Toast confirms: \"Switched to Cloud AI — images will be read by Claude.\"\n   • If no API key: button instead reads \"Set up Cloud AI\" and opens Settings → AI Provider.\n\n2. Load SmolVLM (~500 MB, offline)\n   • Downloads SmolVLM-500M via Transformers.js.\n   • After load, banner turns green: \"SMOLVLM ACTIVE.\"\n   • Subsequent image uploads get described by SmolVLM, then your text model generates from the description.\n\n3. Remove images\n   • Just clears the uploaded images so generation proceeds text-only.\n\nThe banner hides automatically when conditions don't apply:\n• You're on Cloud AI (Claude reads images natively)\n• Your local model is vision-capable (e.g. Phi-3.5 Vision)\n• You haven't uploaded any images",
      },
    ],
  },
  {
    category: "Feedback & Help",
    icon: "💬",
    entries: [
      {
        id: "fb-where",
        title: "Where to send feedback",
        body: "Click the \"Feedback\" button in the header (next to Sign in). A modal opens.\n\nFields:\n• Rating: positive / neutral / negative (optional)\n• Category: Bug / Suggestion / Praise / Other\n• Message: free-form text\n• Include context checkbox: when checked, attaches your current view, topic, and last 3 errors to help debug\n\nWhere it goes:\n• If the app has a Supabase connection: stored in the deployer's feedback table. The deployer reads it via their Supabase dashboard.\n• If no Supabase: saved locally to your browser only (not transmitted).\n\nThe modal tells you which mode you're in.",
      },
      {
        id: "fb-help-center",
        title: "Help center (this thing you're reading)",
        body: "Where to find it: question-mark ? icon in the header.\n\nWhat it does: Searchable knowledge base of every feature. Categories on the left, entries in each category, full-text search at the top.\n\nIf you can't find something, send feedback (\"can't find how to do X\") and the deployer can add an entry.",
      },
    ],
  },
  {
    category: "Account & Password",
    icon: "🔑",
    entries: [
      {
        id: "acct-signup",
        title: "Creating an account",
        body: "Where to find it: click \"Sign in\" in the header → in the modal, toggle to \"Create account\" mode.\n\nWhat happens:\n1. Enter email + password (8+ characters).\n2. Click Create account.\n3. If the deployer has email confirmation enabled, you'll get a confirmation email — click the link to activate.\n4. If email confirmation is disabled, you're signed in immediately.\n\nWhy sign up?\n• Your profile, classes, and notebooks sync across devices.\n• Lets you share notebooks with friends or classmates.\n• Persists your settings if you clear browser data.\n\nNot needed if you just want to try the app once on this device — everything works without signing in, just stored in localStorage only.",
      },
      {
        id: "acct-signin",
        title: "Signing in (password vs magic link)",
        body: "Where to find it: \"Sign in\" button in the header.\n\nTwo ways to sign in:\n• Password — type email + password, click Sign in. Standard.\n• Magic link — click \"Or email me a magic sign-in link.\" Get an email with a one-click sign-in link. No password needed.\n\nMagic link is great if you forgot your password and don't want to reset — just use the link instead.\n\nNote: emails go through Supabase's built-in mailer (rate-limited to ~4/hour) OR a custom SMTP provider if the deployer configured one. If you don't get an email within a few minutes, check your spam folder.",
      },
      {
        id: "acct-forgot",
        title: "Forgot password — full flow",
        body: "Where to find it: Sign in modal → \"Forgot password?\" link below the magic-link button (only visible in sign-in mode, not sign-up mode).\n\nHow it works end-to-end:\n1. Enter your email in the modal.\n2. Click \"Forgot password?\".\n3. Supabase sends you a reset email (subject: \"Reset your password\").\n4. Click the link in the email.\n5. You land back on the app — a toast appears: \"Reset link verified — set a new password below.\"\n6. The Change Password modal opens automatically.\n7. Type a new password (8+ chars), confirm it, click Update password.\n8. You're now signed in with the new password.\n\nIf the reset link does nothing when clicked:\n• The deployer may not have configured Supabase's redirect URLs correctly. They need to set Site URL + add the app URL to Allowed Redirect URLs in Supabase → Authentication → URL Configuration.\n• The link may have expired (Supabase reset links are valid for ~1 hour). Request a new one.",
      },
      {
        id: "acct-change-password",
        title: "Changing your password",
        body: "Where to find it (when signed in): Settings → Account section → \"Change password\" button (next to Sign out).\n\nA modal opens with two fields:\n• New password (8+ characters)\n• Confirm new password (must match)\n\nClient-side validation checks length and match before sending to Supabase. The new password is hashed by Supabase (bcrypt) — neither the app nor the deployer ever sees the plaintext.\n\nAfter clicking Update password:\n• Modal closes\n• Toast: \"Password updated\"\n• You stay signed in on this device\n• On other devices where you're signed in, sessions may be invalidated (Supabase's default behavior) — you'd need to sign in again",
      },
      {
        id: "acct-recovery-event",
        title: "What happens when you click a reset email link",
        body: "Behind the scenes (for the curious):\n\n1. The email link contains a one-time recovery token + your Vercel app URL.\n2. Clicking the link sends you to Supabase's verify endpoint, which checks the token.\n3. Supabase creates a temporary auth session and redirects you to the app URL with the session data in the URL fragment (e.g. #access_token=...&type=recovery).\n4. The Supabase JS client in your browser parses the fragment and fires a PASSWORD_RECOVERY event.\n5. The app listens for that event and automatically opens the Change Password modal.\n6. You set a new password — Supabase converts the temporary session into a permanent one.\n\nIf step 5 doesn't happen (you click the link but no modal opens), the app may not be deployed at the URL Supabase is redirecting to, or the PASSWORD_RECOVERY listener isn't wired correctly. As of v1.27, this is fixed in the app — if it still doesn't work, the issue is in Supabase's redirect URL config.",
      },
      {
        id: "acct-rate-limits",
        title: "Email rate limits",
        body: "Supabase's built-in email service is throttled:\n• 4 emails per hour, per project (across ALL emails — signups, magic links, password resets)\n\nIf you hit the limit, you'll see an error like \"email rate exceeded.\" Wait an hour and try again.\n\nFor higher limits, the deployer can configure custom SMTP via Resend or similar (raises limits to thousands per day).\n\nFor personal use with a few friends, the 4/hour built-in is usually plenty.",
      },
    ],
  },
  {
    category: "Local AI Models (Deep Dive)",
    icon: "🧠",
    entries: [
      {
        id: "local-which-model",
        title: "Which local model should I pick?",
        body: "Recommendations by use case:\n\n• Safari user, any need: Llama 3.2 1B (~700 MB). The only model genuinely Safari-friendly. Llama 3.2 3B may work but is borderline.\n\n• Chrome/Edge/Firefox user, good Mac/PC: Llama 3.2 3B (~2 GB) — much better quality than 1B, still fast.\n\n• Need vision (reading images): Phi 3.5 Vision (~3 GB) only — but it crashes Safari. On Chrome it works but has known WebLLM bugs. Better alternative: load SmolVLM separately (covered in \"Reading Images Locally\" category).\n\n• Best quality, willing to wait: Qwen 2.5 7B or Llama 3.1 8B (4+ GB). Closer to Cloud AI in quality but slower + Chrome only.\n\nGeneral rule: smaller = faster + lower quality + works on more devices. Bigger = better quality + slower + may crash on Safari.",
      },
      {
        id: "local-safari-gate",
        title: "Safari WebGPU safety gate",
        body: "Where you'll see it: Settings → AI Provider → if you're on Safari AND have selected a model >2 GB, the Download button is replaced with a red \"TOO LARGE FOR SAFARI\" warning panel.\n\nWhy: Safari's WebGPU implementation has tighter memory limits than Chrome's. Loading a multi-GB model crashes the page repeatedly, eventually showing \"a problem occurred repeatedly\" with no clean recovery.\n\nThe panel offers:\n• Switch to Llama 3.2 1B (~700 MB) — one-click fix, picks the safest model\n• Try anyway (likely to crash) — escape hatch behind a confirm() dialog\n\nAlso suggests alternatives: open in Chrome/Arc, or use Cloud AI instead (better quality anyway).\n\nThis check only applies on Safari. Chrome/Edge/Firefox users see the regular Download button regardless of model size.",
      },
      {
        id: "local-cancel-load",
        title: "Cancel a stuck loading",
        body: "Where to find it: Settings → AI Provider → during a model download or load, two cancel buttons appear below the progress bar.\n\nTwo options:\n• Cancel loading (soft cancel) — stops the UI, lets you pick a different model. Background download may continue silently but won't block you.\n• Cancel + clear cache (hard cancel) — same as soft, PLUS deletes any partially-downloaded model shards from your browser's IndexedDB. Use this if a previous load got corrupted and the cached files are causing issues.\n\nThe hard cancel asks for confirmation first (it's irreversible — you'll need to redownload the whole model next time you select it).\n\nUseful when: a model load is hung at some percent and not progressing, OR you got an error mid-load and the engine seems confused, OR you want to switch models quickly without waiting for the current load to time out.",
      },
      {
        id: "local-cache-management",
        title: "Cached model management",
        body: "Where to find it: Settings → AI Provider → Local AI section → \"Cached models\" panel (visible only if you've downloaded at least one).\n\nWhat it shows: list of models you've downloaded, each with size and a Delete button.\n\nDelete frees up IndexedDB storage. Next time you select that model, it'll re-download from scratch.\n\nUseful when:\n• Your browser is low on storage\n• A cached model is somehow corrupted (rare — usually \"Cancel + clear cache\" during loading is what you want)\n• You decided you don't need that model anymore",
      },
      {
        id: "local-webgpu-check",
        title: "Does my browser support WebGPU?",
        body: "WebGPU is required for local AI. Browser support as of 2026:\n\n✓ Supported:\n• Chrome 113+ (Mac, Windows, Linux, Android)\n• Edge 113+ (Mac, Windows)\n• Firefox 141+ (Mac, Windows)\n• Safari 17+ on macOS (but memory limits — see Safari Gate)\n• Safari 26+ on iOS / iPadOS / visionOS\n• Opera 99+ (Chromium-based)\n• Arc, Brave, Vivaldi (all Chromium — works fine)\n\n✗ NOT supported:\n• Older Safari iOS (17, 18) — no WebGPU at all\n• Opera Mini — strips JS APIs aggressively\n• Internet Explorer (obviously)\n\nThe app detects this on startup. If WebGPU is unavailable, the Local AI section shows \"WebGPU not detected\" and the Download button is hidden. You can still use Cloud AI without WebGPU.",
      },
    ],
  },
  {
    category: "Themes",
    icon: "🌗",
    entries: [
      {
        id: "themes-switching",
        title: "Switching themes",
        body: "Where to find it: ✨ Sparkles icon in the header (between Help and Settings icons).\n\nClick to toggle between:\n• Dark mode (\"Twilight Library\") — default. Warm off-white text on dark slate paper, gold and copper accents.\n• Light mode (\"Daybreak Library\") — dark ink on warm cream paper, deeper accent colors.\n\nThe choice persists across sessions. Both themes meet WCAG AAA contrast for body text (verified as of v1.25).\n\nThe editorial aesthetic is preserved in both — same fonts (Cormorant Garamond, Lora, Work Sans), same restrained color palette, same paper-and-ink feel. It's not \"light theme with white background\" — it's a different reading environment for different times of day.",
      },
      {
        id: "themes-when-to-use",
        title: "Which to pick",
        body: "Dark mode is great for:\n• Evening study sessions (less eye strain in dim rooms)\n• Long sessions where you need lower visual noise\n• Battery savings on OLED displays\n\nLight mode is great for:\n• Daytime study in bright rooms (dark mode looks washed out in sunlight)\n• Printing (light mode renders better)\n• When you find dark mode harder to scan quickly\n\nTry both. The app fully supports either — no second-class theme.",
      },
    ],
  },
];

const VALID_MODES = ["flashcards", "practice", "exam", "explain", "cheatsheet", "recall", "freeResponse", "derive", "critique", "curriculum", "conceptMap", "diagnostic", "tutor", "errorReview"];
const safeMode = (m, fallback = "explain") => VALID_MODES.includes(m) ? m : fallback;

// ============================================================
// SEED DATA — library, courses, marketplace, etc.
// ============================================================
const seedJournal = [];

// --- StudyLoop: careers, case studies, feed ---
// ============================================================
// SHARING SETUP — edit this single line before sharing the file
// to receive feedback & error reports from anyone you share with.
// Leave blank to disable email reporting (data stays local).
// ============================================================
const SHARE_OWNER_EMAIL = ""; // e.g. "you@example.com"

// ============================================================
// CLOUD SYNC SETUP — fill these in to enable real accounts
// + cross-device sync via Supabase (free tier is generous).
// Leave blank to run fully local (everything still works).
// See SETUP.md for the 5-minute walkthrough.
// ============================================================
// ============================================================
// BACKEND CONFIG — deployer's defaults (compiled in) + per-user runtime overrides
// ============================================================
// SUPABASE_URL / SUPABASE_ANON_KEY are the DEPLOYER's defaults — the values that ship with
// this Vercel deployment. Every user of this deployment uses these by default and shares this
// Supabase project (with Row Level Security isolating individual users' data).
//
// Each user CAN override with their own Supabase project via Settings → Backend Config.
// When overridden, lectern_backend_overrides in localStorage takes precedence over the defaults.
//
// Leave blank to run fully local (everything still works — notebooks/profile stay in localStorage).
// See SETUP.md for the 5-minute walkthrough.
// ============================================================
const DEFAULT_SUPABASE_URL = "https://nfbzmxuruxqgbeeypsoq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpteHVydXhxZ2JlZXlwc29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ0MTUsImV4cCI6MjA5NTU3MDQxNX0.NqQKeIO3pYOk5rbG4YtJApz1lnss_OZvhWuVkIY79-U";

// Edge Function endpoints — baked-in deployment defaults so every visitor of this Vercel deployment
// gets web search + iCal subscription pre-configured without needing to paste anything. Each user
// can still override in Settings → Integrations if they want their own backend.
const DEFAULT_LOCAL_SEARCH_ENDPOINT = "https://nfbzmxuruxqgbeeypsoq.supabase.co/functions/v1/study-search";
const DEFAULT_ICS_SUBSCRIPTION_ENDPOINT = "https://nfbzmxuruxqgbeeypsoq.supabase.co/functions/v1/study-ics";

// Per-user override resolver. Reads localStorage if set, otherwise falls back to deployer default.
const _getOverrides = () => {
  try { return JSON.parse(localStorage.getItem("lectern_backend_overrides") || "{}"); } catch { return {}; }
};
const SUPABASE_URL = (() => {
  const o = _getOverrides();
  return o.supabaseUrl || DEFAULT_SUPABASE_URL;
})();
const SUPABASE_ANON_KEY = (() => {
  const o = _getOverrides();
  return o.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
})();

const SKILLS_OF_DAY = [
  { name: "Spaced repetition", body: "Review at expanding intervals (1d, 3d, 7d). Beats cramming by ~2x for long-term retention." },
  { name: "The Feynman technique", body: "Explain a concept in plain words as if teaching a 12-year-old. The gaps in your explanation are the gaps in your knowledge." },
  { name: "Active recall", body: "Close the book and write what you remember. Re-reading feels productive but builds far less retention than recall." },
  { name: "Interleaving", body: "Mix problem types in one session instead of blocking. Slower in the moment, much better for transfer." },
  { name: "The 90-second reset", body: "Between hard tasks, look out a window for 90 seconds. Restores focus without the phone-drain." },
  { name: "Pre-question reading", body: "Before a chapter, write what you think it'll say. Prediction mode dramatically boosts retention." },
  { name: "Sleep on it", body: "Stuck? Sleep. REM consolidates connections — people solve ~2x more insight problems after a night's sleep." },
  { name: "Two-pass note-taking", body: "Pass 1: capture raw. Pass 2 within 24 hours: rewrite in your own words, drawing connections. The rewrite is where learning happens." },
  { name: "Desirable difficulties", body: "Make practice slightly harder than feels comfortable — looser handwriting, less familiar room, longer intervals. Discomfort that produces transfer." },
  { name: "Worked-examples first", body: "Before solving, study 2–3 fully worked examples. Cuts cognitive load and speeds skill acquisition more than diving straight into problems." },
  { name: "Concrete before abstract", body: "Always anchor a new concept to a vivid example you can picture before generalizing. Your brain reasons about abstractions through concrete handles." },
  { name: "Generation effect", body: "Try to answer before being told. Even a guess you get wrong dramatically improves retention of the correct answer." },
  { name: "Dual coding", body: "Pair verbal explanation with a sketch. Two encodings beat one — even a bad diagram you drew yourself outperforms a perfect one you only read." },
  { name: "Retrieval before re-reading", body: "Spend 20% of study time on input, 80% on retrieval. Most students invert this ratio." },
  { name: "Teach as you go", body: "After every 25 minutes, voice-record a 60-second explanation to an imagined student. Surfaces gaps instantly." },
  { name: "Pomodoros with intent", body: "25 min focus + 5 min break — but state the specific outcome before each block. Vague effort produces vague learning." },
  { name: "The blank-page test", body: "Once a week, dump everything you remember about a topic onto a blank page. The structure of what you forget tells you what to study next." },
];

const PROJECTS = [
  { title: "Build a study-streak tracker (web app)", tag: "CS · Portfolio", why: "Ships real code to GitHub. Recruiters can click it.", steps: ["Set up a static HTML file", "Track streak in localStorage", "Add a 'last studied' display", "Push to GitHub Pages"], hours: 4 },
  { title: "Write a 1500-word research paper on a public dataset", tag: "Stats · Writing", why: "A real artifact for grad-school applications.", steps: ["Pick a CDC / FRED / Kaggle dataset", "State a clear hypothesis", "Run a regression", "Write intro, methods, results, discussion"], hours: 10 },
  { title: "Replicate a famous experiment from a paper", tag: "Science · Lab", why: "Demonstrates real literacy, not just coursework.", steps: ["Pick a paper with a clear protocol", "Source or simulate materials", "Document each step", "Write your conclusion"], hours: 15 },
  { title: "Make a flashcard deck and publish it", tag: "Any · Portfolio", why: "Teaching is the strongest test of learning.", steps: ["Pick a unit you mostly know", "Write 50 atomic cards", "Test with 3 friends, revise", "Publish on Anki or Quizlet"], hours: 3 },
  { title: "Record a 5-minute explainer video", tag: "Any · Portfolio", why: "Forces Feynman-level clarity. Goes on a personal site.", steps: ["Pick one concept", "Outline in 5 bullets", "Record screen + voice", "Edit and publish"], hours: 4 },
  { title: "Translate a short story into your target language", tag: "Languages · Portfolio", why: "Reading + writing + cultural register in one artifact.", steps: ["Pick a 1000-word public-domain story", "Draft your translation", "Get a native speaker to mark it up", "Write a translator's note on hard choices"], hours: 8 },
  { title: "Compose and record a 60-second piece", tag: "Music · Portfolio", why: "Composition forces you to deploy theory, not just analyse it.", steps: ["Pick a key, time signature, and form", "Sketch the melody on paper or DAW", "Add harmony + rhythm section", "Record and export"], hours: 6 },
  { title: "Run a small user-research study", tag: "Soft skills · UX", why: "Five 30-min interviews teach more about people than a year of reading.", steps: ["Write a 5-question semi-structured guide", "Recruit 5 participants", "Interview, record, transcribe", "Synthesize into 3 insights"], hours: 8 },
  { title: "Build a mini case study from a real company", tag: "Business · Writing", why: "Strategy is invisible until you write one. Becomes interview material.", steps: ["Pick a public company you understand", "Read 3 quarterly reports", "Map their strategy on a 2x2", "Write a 1-page memo"], hours: 6 },
  { title: "Make one piece of physical work this month", tag: "Crafts · Portfolio", why: "A drawing, a knitted square, a 3D-printed widget — anything that exists.", steps: ["Pick a technique you've only read about", "Source minimum materials", "Make a deliberately ugly v1", "Make a better v2 with what you learned"], hours: 5 },
];



// ============================================================
// SHARED UI ATOMS
// ============================================================
const SectionLabel = ({ children, accent, style }) => (
  <div style={{
    fontFamily: fontSans, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
    color: accent ? C.accent : C.inkMuted, fontWeight: 600, ...style,
  }}>{children}</div>
);

const Rule = ({ vertical, style }) => (
  <div style={{
    background: C.rule,
    ...(vertical ? { width: 1, alignSelf: "stretch" } : { height: 1, width: "100%" }),
    ...style,
  }} />
);

const Card = ({ children, style, onClick, hoverable }) => (
  <div onClick={onClick} style={{
    background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4,
    padding: 22, position: "relative", cursor: onClick ? "pointer" : "default",
    transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
    ...style,
  }}
  onMouseEnter={(onClick || hoverable) ? (e) => { e.currentTarget.style.boxShadow = `0 6px 20px ${C.shadow}`; e.currentTarget.style.borderColor = C.inkSoft; } : undefined}
  onMouseLeave={(onClick || hoverable) ? (e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = C.rule; } : undefined}
  >
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style, disabled, type }) => {
  const variants = {
    primary: { background: C.ink, color: C.paper, border: `1px solid ${C.ink}` },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.rule}` },
    accent: { background: C.accent, color: C.paper, border: `1px solid ${C.accent}` },
    soft: { background: C.paperDark, color: C.ink, border: `1px solid ${C.rule}` },
    dark: { background: C.ink, color: C.paper, border: `1px solid ${C.ink}` },
  };
  return (
    <button type={type || "button"} onClick={onClick} disabled={disabled} className="btn" style={{
      ...variants[variant],
      fontFamily: fontSans, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
      fontWeight: 600, padding: "10px 18px", cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: 2, opacity: disabled ? 0.4 : 1,
      display: "inline-flex", alignItems: "center", gap: 6,
      ...style,
    }}>
      {children}
    </button>
  );
};

const Pill = ({ children, color = "ink", style }) => {
  const palettes = {
    ink: { bg: C.paperLight, fg: C.inkSoft }, // elevated panel bg + secondary text — readable on dark
    accent: { bg: C.accentSoft, fg: C.accent },
    gold: { bg: C.goldSoft, fg: C.gold },
    moss: { bg: C.mossSoft, fg: C.moss },
    blue: { bg: C.blueSoft, fg: C.blue },
    plum: { bg: C.plumSoft, fg: C.plum },
  };
  const p = palettes[color] || palettes.ink;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: fontSans, fontSize: 10, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      background: p.bg, color: p.fg,
      padding: "3px 8px", borderRadius: 2, ...style,
    }}>{children}</span>
  );
};

// Rich text renderer for LaTeX, code, bold, etc.
function RichText({ children, style }) {
  const [katexLoaded, setKatexLoaded] = useState(!!window.katex);
  useEffect(() => {
    if (window.katex) { setKatexLoaded(true); return; }
    const id = setInterval(() => {
      if (window.katex) { setKatexLoaded(true); clearInterval(id); }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const html = useMemo(() => {
    if (!children) return "";
    let text = String(children);
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const placeholders = [];
    const stash = (rendered) => {
      const i = placeholders.length;
      placeholders.push(rendered);
      return `\x00MATH${i}\x00`;
    };
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
      try { if (window.katex) return stash(`<div style="margin: 8px 0; overflow-x: auto;">${window.katex.renderToString(m, { displayMode: true, throwOnError: false })}</div>`); } catch {}
      return stash(`<code>${esc(m)}</code>`);
    });
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, m) => {
      try { if (window.katex) return stash(window.katex.renderToString(m, { displayMode: false, throwOnError: false })); } catch {}
      return stash(`<code>${esc(m)}</code>`);
    });
    text = text.replace(/```(\w+)?\n([\s\S]+?)\n```/g, (_, lang, code) =>
      stash(`<pre style="margin: 8px 0; padding: 12px; background: ${C.ink}; color: ${C.paperLight}; border-radius: 4px; overflow-x: auto; font-size: 12px; font-family: ${fontMono};"><code>${esc(code)}</code></pre>`));
    text = text.replace(/`([^`\n]+?)`/g, (_, m) =>
      stash(`<code style="padding: 1px 5px; background: ${C.paperDark}; border-radius: 2px; font-size: 0.9em; font-family: ${fontMono};">${esc(m)}</code>`));
    text = esc(text);
    text = text.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    // Render source citations [S1], [S2], etc. as inline badges (the AI is instructed to emit these
    // when grounding claims in notebook sources).
    text = text.replace(/\[S(\d+)\]/g, (_, n) =>
      `<span style="display: inline-block; padding: 1px 6px; margin: 0 2px; background: ${C.ink}; color: ${C.paper}; border-radius: 2px; font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; vertical-align: 2px;" title="Source ${n} from the active notebook">S${n}</span>`);
    text = text.replace(/\n/g, "<br/>");
    text = text.replace(/\x00MATH(\d+)\x00/g, (_, i) => placeholders[Number(i)]);
    return text;
  }, [children, katexLoaded]);

  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ============================================================
// Error boundary — catches React render errors, persists, shows recoverable fallback
// ============================================================
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    try {
// NOTE: The app was originally named "Lectern" and renamed to "Study It". The localStorage
//   keys are deliberately kept with the `lectern_*` prefix to preserve every existing user's
//   saved data (API keys, OAuth tokens, classes, vault, AI settings, etc.). Renaming the keys
//   would silently wipe all of that on next load. The prefix is internal-only and invisible to users.
      const log = JSON.parse(localStorage.getItem("lectern_errors_v1") || "[]");
      log.unshift({ id: Date.now(), ts: Date.now(), msg: err && err.message ? err.message : String(err), stack: (err && err.stack ? String(err.stack) : "").slice(0, 800), context: "ErrorBoundary · " + (info && info.componentStack ? info.componentStack.split("\n")[1] || "" : "") });
      localStorage.setItem("lectern_errors_v1", JSON.stringify(log.slice(0, 50)));
    } catch {}
  }
  render() {
    if (this.state.err) {
      return React.createElement("div", { style: { minHeight: "100vh", padding: 40, background: "#FBF9F4", color: "#1C1A17", fontFamily: "Charter, Georgia, serif" } },
        React.createElement("div", { style: { maxWidth: 620, margin: "60px auto" } },
          React.createElement("div", { style: { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#8B0000", marginBottom: 12 } }, "SOMETHING BROKE"),
          React.createElement("h1", { style: { fontSize: 36, fontWeight: 600, margin: "0 0 12px" } }, "The page hit an error."),
          React.createElement("p", { style: { fontSize: 16, lineHeight: 1.6, color: "#4A4540" } }, "Logged locally. Reloading will reset just this view — your saved data is safe."),
          React.createElement("pre", { style: { background: "#F3EFE6", padding: 14, borderRadius: 4, fontSize: 12, marginTop: 16, overflow: "auto", maxHeight: 200 } }, this.state.err && this.state.err.message ? this.state.err.message : String(this.state.err)),
          React.createElement("button", { onClick: () => { this.setState({ err: null }); try { window.location.reload(); } catch {} }, style: { marginTop: 16, padding: "10px 20px", background: "#1C1A17", color: "#FBF9F4", border: "none", borderRadius: 2, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" } }, "Reload")
        )
      );
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN APP
// ============================================================
function AppInner() {
  // Navigation
  const [view, setView] = useState("today");

  // Library state
  const [journal, setJournal] = useState(seedJournal);

  // ============ AI ENGINE STATE (full Study Buddy) ============
  const [mode, setMode] = useState(null);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  // Ref mirror of `difficulty` so generateContent always reads the latest value
  // even when fired from a setTimeout closure that captured an older `difficulty`.
  // (Stale-closure bug: setDifficulty + setTimeout(() => generateContent()) would otherwise
  // call the function-instance from BEFORE the re-render, which captured the OLD difficulty.)
  const difficultyRef = useRef("medium");
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  // Multi-language output — applied to all generations via languageClause
  const [outputLanguage, setOutputLanguage] = useState(() => {
    try { return localStorage.getItem("lectern_output_language") || "English"; } catch { return "English"; }
  });
  useEffect(() => { try { localStorage.setItem("lectern_output_language", outputLanguage); } catch {} }, [outputLanguage]);
  const [loading, setLoading] = useState(false);
  // Theme toggle — "dark" (Twilight Library, default) or "light" (Daybreak Library, the original editorial).
  // The C proxy reads from _themeState.current; setTheme syncs both this React state AND the module-level
  // _themeState so existing C.* references at module-scope use the new theme on next render.
  const [theme, _setTheme] = useState(_themeState.current);
  const setTheme = (next) => {
    _themeState.current = next;
    _setTheme(next);
    try { localStorage.setItem("lectern_theme", next); } catch {}
    // Force re-paint of components that don't subscribe to C directly (CSS in <style> blocks)
    document.documentElement.setAttribute("data-theme", next);
  };
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  // Streaming partial output — visible while a streamed generation is in progress.
  // Falls back to the spinner-only path for non-streamed modes (JSON quizzes, multi-stage pipelines).
  const [streamPartial, setStreamPartial] = useState("");
  const [content, setContent] = useState(null);

  // ============ SAVED GENERATIONS (Vault) ============
  // Every successful artifact-style generation auto-saves here so users can revisit.
  // Capped at 200 most recent. Chat/tutor and errorReview are skipped (conversational/personalized — not artifacts).
  const SAVEABLE_MODES = new Set(["flashcards","practice","exam","explain","cheatsheet","recall","freeResponse","derive","critique","curriculum","conceptMap","diagnostic","audioOverview","mindMap","briefing","slideDeck","dataTable"]);
  const [savedGenerations, setSavedGenerations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_saved_generations") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("lectern_saved_generations", JSON.stringify(savedGenerations.slice(0, 200))); } catch {}
  }, [savedGenerations]);

  // ============ NOTEBOOKS (NotebookLM-style source-grounded containers) ============
  // A Notebook is a persistent named container with its own sources. When a notebook is "active",
  // every AI generation is grounded in its sources (with [S1], [S2] citations). When no notebook is
  // active, behavior is unchanged (topic-oriented mode).
  const [notebooks, setNotebooks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_notebooks") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("lectern_notebooks", JSON.stringify(notebooks)); } catch {}
  }, [notebooks]);
  const [currentNotebookId, setCurrentNotebookId] = useState(() => {
    try { return localStorage.getItem("lectern_current_notebook") || null; } catch { return null; }
  });
  useEffect(() => {
    try {
      if (currentNotebookId) localStorage.setItem("lectern_current_notebook", currentNotebookId);
      else localStorage.removeItem("lectern_current_notebook");
    } catch {}
  }, [currentNotebookId]);

  const createNotebook = (name, emoji = "📓", color = "moss") => {
    const id = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const nb = {
      id, name: (name || "Untitled notebook").slice(0, 80),
      emoji: emoji || "📓", color: color || "moss",
      createdAt: now, lastUsedAt: now, updatedAt: now, deletedAt: null,
      sources: [], notes: "",
    };
    setNotebooks((prev) => [nb, ...prev]);
    setCurrentNotebookId(id);
    track("action", "notebook_create");
    return id;
  };
  const renameNotebook = (id, name) => {
    const now = Date.now();
    setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, name: (name || "Untitled").slice(0, 80), lastUsedAt: now, updatedAt: now } : n));
  };
  const updateNotebookMeta = (id, meta) => {
    const now = Date.now();
    setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, ...meta, lastUsedAt: now, updatedAt: now } : n));
  };
  // Soft-delete: mark deletedAt instead of filtering. Lets sync correctly resolve cross-device deletions.
  const deleteNotebook = (id) => {
    const now = Date.now();
    setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, deletedAt: now, updatedAt: now } : n));
    if (currentNotebookId === id) setCurrentNotebookId(null);
    track("action", "notebook_delete");
  };
  const switchToNotebook = (id) => {
    setCurrentNotebookId(id);
    if (id) {
      setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, lastUsedAt: Date.now() } : n));
      track("action", "notebook_switch");
    }
  };

  // Filter out soft-deleted notebooks and soft-deleted sources for UI rendering.
  // The raw `notebooks` array keeps tombstones so sync can correctly reconcile cross-device deletes.
  const liveNotebooks = useMemo(
    () => (notebooks || [])
      .filter((n) => !n.deletedAt)
      .map((n) => ({ ...n, sources: (n.sources || []).filter((s) => !s.deletedAt) })),
    [notebooks]
  );
  const currentNotebook = liveNotebooks.find((n) => n.id === currentNotebookId) || null;
  const addSourceToNotebook = (nbId, source) => {
    if (!source.name || !source.content) return;
    const now = Date.now();
    setNotebooks((prev) => prev.map((n) => n.id === nbId ? {
      ...n,
      sources: [...(n.sources || []), {
        id: `src-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: source.type || "text",
        name: source.name.slice(0, 120),
        content: source.content,
        addedAt: now,
        updatedAt: now,
        deletedAt: null,
      }],
      lastUsedAt: now,
      updatedAt: now,
    } : n));
    track("action", "notebook_add_source", { type: source.type });
  };
  // Soft delete — sets deletedAt tombstone instead of filtering. Lets per-source merge
  // correctly resolve "this was deleted on device A" vs "this was added/edited on device B".
  const removeSourceFromNotebook = (nbId, srcId) => {
    const now = Date.now();
    setNotebooks((prev) => prev.map((n) => n.id === nbId ? {
      ...n,
      sources: (n.sources || []).map((s) => s.id === srcId ? { ...s, deletedAt: now, updatedAt: now } : s),
      updatedAt: now,
    } : n));
  };

  const saveGeneration = (mode, topic, content, model) => {
    if (!SAVEABLE_MODES.has(mode)) return;
    if (!content) return;
    const item = {
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode, topic: topic || "(untitled)", content, model: model || "",
      createdAt: Date.now(),
      // Tag with the active notebook (if any) so Vault can be filtered per-notebook
      notebookId: currentNotebookId || null,
      notebookName: currentNotebook?.name || null,
    };
    setSavedGenerations((prev) => [item, ...prev.filter((g) => !(g.mode === mode && g.topic === item.topic && g.notebookId === item.notebookId))].slice(0, 200));
  };
  const reopenSavedGeneration = (gen) => {
    // If the generation was made in a notebook, switch back to it
    if (gen.notebookId && notebooks.some((n) => n.id === gen.notebookId)) {
      setCurrentNotebookId(gen.notebookId);
    }
    setMode(gen.mode);
    setTopic(gen.topic);
    setContent(gen.content);
    setView("tutor");
    setError(null);
    track("action", "vault_reopen", { mode: gen.mode });
  };
  const deleteSavedGeneration = (id) => {
    setSavedGenerations((prev) => prev.filter((g) => g.id !== id));
  };
  const [error, setError] = useState(null);

  // Materials
  const [images, setImages] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [textDocs, setTextDocs] = useState([]);
  const [pastedText, setPastedText] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");

  // Power features
  const [deepMode, setDeepMode] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  // ============ LOCAL-MODEL WEB SEARCH PROXY ============
  // Bucket C fix #1: web search for the local WebGPU model.
  // Architecturally: a browser tab can't hit search APIs directly (CORS), but a Supabase Edge Function
  // (or any HTTPS endpoint) CAN. The user deploys the function once, pastes its URL here, and Study It
  // calls it whenever a local generation needs web grounding.
  //
  // Function input: { query: string }
  // Function output: { results: [{ title, url, snippet }] }
  // The function uses Brave Search API (free tier: 2,000 queries/month).
  //
  // When configured, the lateral-reading clause is re-enabled on local model, and Quality Studio's
  // searchUses slider becomes meaningful on local instead of being silently ignored.
  const localWebSearch = async (query, maxResults = 5) => {
    const endpoint = persistentProfile.localSearchEndpoint;
    if (!endpoint) return { error: "no_endpoint", results: [] };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: String(query).slice(0, 400), maxResults }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return { error: `HTTP ${response.status}: ${errText.slice(0, 200)}`, results: [] };
      }
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results.slice(0, maxResults) : [];
      track("action", "local_web_search", { count: results.length });
      return { error: null, results };
    } catch (e) {
      logError(e, "local web search");
      return { error: e.message, results: [] };
    }
  };

  // Format search results as a context block for the local model's prompt.
  const formatSearchResultsForPrompt = (results) => {
    if (!results || results.length === 0) return "";
    const blocks = results.map((r, i) => `[W${i + 1}] ${r.title || "(untitled)"}\n${r.url || ""}\n${(r.snippet || "").slice(0, 300)}`).join("\n\n");
    return `\n\nWEB SEARCH RESULTS (use these to ground your answer; cite as [W1], [W2], etc.):\n\n${blocks}\n\nEND WEB SEARCH RESULTS.\n\n`;
  };
  const [maxPower, setMaxPower] = useState(false);

  // ============ AI QUALITY STUDIO ============
  // Centralized AI quality knobs — model, thinking budget, search budget, multi-agent pipeline, chain-of-verification.
  const AI_MODELS = {
    "claude-opus-4-8":          { label: "Opus 4.8",   desc: "Most capable; slowest, highest cost",         tier: "max" },
    "claude-opus-4-7":          { label: "Opus 4.7",   desc: "Capable; balanced",                            tier: "high" },
    "claude-sonnet-4-6":        { label: "Sonnet 4.6", desc: "Fast & strong; default for most use",          tier: "balanced" },
    "claude-haiku-4-5-20251001":{ label: "Haiku 4.5",  desc: "Fastest, cheapest; best for quick drafts",     tier: "fast" },
  };
  // Local WebGPU models — actual LLMs that run in your browser via WebLLM. Honest about quality.
  // Each entry includes the WebLLM model id, display label, download size, RAM requirement,
  // a description, and a "best for" hint mapped to actual Study It modes the model handles well.
  const LOCAL_MODELS = {
    // === RECOMMENDED — strong quality/size balance ===
    "Llama-3.1-8B-Instruct-q4f32_1-MLC":   { label: "Llama 3.1 8B",   size: "~4.6 GB", ram: "~6 GB", desc: "Meta's flagship small model. Best general quality available locally.",     bestFor: "Explain · Tutor chat · Flashcards · Briefings", tier: "best" },
    "Hermes-3-Llama-3.2-3B-q4f16_1-MLC":   { label: "Hermes 3 3B",    size: "~1.8 GB", ram: "~3 GB", desc: "NousResearch fine-tune of Llama 3.2. Best instruction-following at this size.", bestFor: "Flashcards · Practice quizzes · Cheatsheets",     tier: "best" },
    "Qwen2.5-7B-Instruct-q4f16_1-MLC":     { label: "Qwen 2.5 7B",    size: "~4.4 GB", ram: "~6 GB", desc: "Alibaba. Strong reasoning + multilingual. Top open-weights at this size.",   bestFor: "Explain · Concept maps · Code & STEM",            tier: "best" },
    // === BALANCED — good for most modern laptops ===
    "Llama-3.2-3B-Instruct-q4f16_1-MLC":   { label: "Llama 3.2 3B",   size: "~1.7 GB", ram: "~3 GB", desc: "Meta. Solid balance for browser inference. Good default.",                    bestFor: "Flashcards · Tutor chat · Audio overviews",       tier: "balanced" },
    "Phi-3.5-mini-instruct-q4f16_1-MLC":   { label: "Phi 3.5 Mini",   size: "~2.4 GB", ram: "~4 GB", desc: "Microsoft. Strong reasoning for its parameter count.",                        bestFor: "Practice · Exam · Error review",                  tier: "balanced" },
    "gemma-2-2b-it-q4f16_1-MLC":           { label: "Gemma 2 2B",     size: "~1.6 GB", ram: "~3 GB", desc: "Google. Solid generalist; fast on most GPUs.",                                bestFor: "Cheatsheets · Vocab · Quick Q&A",                tier: "balanced" },
    // === LIGHTWEIGHT — older / integrated GPUs ===
    "Llama-3.2-1B-Instruct-q4f16_1-MLC":   { label: "Llama 3.2 1B",   size: "~700 MB", ram: "~1.5 GB", desc: "Tiny. Limited capability — fine for short definitions and vocab.",          bestFor: "Vocab drilling · Definition Q&A",                tier: "tiny" },
    "SmolLM2-1.7B-Instruct-q4f16_1-MLC":   { label: "SmolLM2 1.7B",   size: "~1.0 GB", ram: "~2 GB", desc: "HuggingFace. Surprisingly capable for its size. Fastest.",                    bestFor: "Vocab · Short flashcards",                       tier: "tiny" },
    "SmolLM2-360M-Instruct-q4f16_1-MLC":   { label: "SmolLM2 360M",   size: "~230 MB", ram: "~1 GB", desc: "Smallest viable. Toy-scale — barely useful but works on any device.",        bestFor: "Definition lookup only",                         tier: "tiny" },
    // === REASONING — distilled from DeepSeek-R1 ===
    "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC": { label: "DeepSeek-R1 7B (reasoning)", size: "~4.4 GB", ram: "~6 GB", desc: "Distilled from R1. Better for math/logic at the cost of speed.",     bestFor: "Math problems · Logic puzzles · STEM",          tier: "reasoning" },
    // === VISION — can read images, scanned PDFs, basic handwriting (much weaker than Claude's vision) ===
    "Phi-3.5-vision-instruct-q4f16_1-MLC":     { label: "Phi 3.5 Vision (image-capable)", size: "~3.0 GB", ram: "~5 GB", desc: "Microsoft. Reads printed text + simple diagrams locally. Handwriting unreliable.", bestFor: "Reading printed text · Scanned PDFs · Simple diagrams", tier: "vision" },
  };
  // Default to Llama 3.2 3B (the previous default) — small enough to work on most hardware.
  // But surface bigger options prominently for users with good GPUs.
  const AI_PRESETS = {
    speed:    { model: "claude-haiku-4-5-20251001", thinkingBudget: 0,     searchUses: 0,  multiAgent: false, verification: false, label: "Speed",      desc: "Fast drafts. No thinking, no web." },
    balanced: { model: "claude-opus-4-7",           thinkingBudget: 8000,  searchUses: 4,  multiAgent: false, verification: false, label: "Balanced",   desc: "Default. Good thinking, modest web." },
    quality:  { model: "claude-opus-4-7",           thinkingBudget: 16000, searchUses: 8,  multiAgent: true,  verification: false, label: "Quality",    desc: "Multi-agent + deep thinking." },
    max:      { model: "claude-opus-4-8",           thinkingBudget: 24000, searchUses: 12, multiAgent: true,  verification: true,  label: "Max",        desc: "Opus 4.8 + multi-agent + chain-of-verification. Slowest, most rigorous." },
  };
  const [aiSettings, setAiSettings] = useState(() => {
    try { return { ...AI_PRESETS.balanced, ...(JSON.parse(localStorage.getItem("lectern_ai_settings") || "{}")) }; }
    catch { return AI_PRESETS.balanced; }
  });
  useEffect(() => { try { localStorage.setItem("lectern_ai_settings", JSON.stringify(aiSettings)); } catch {} }, [aiSettings]);
  // Keep legacy maxPower in sync with the multi-agent setting so existing call sites still work.
  // We intentionally do NOT auto-flip deepMode/useWebSearch: deepMode triggers an extra expertise-framing pre-pass
  // that's orthogonal to thinking-budget, and useWebSearch is now superseded by aiSettings.searchUses.
  useEffect(() => { setMaxPower(!!aiSettings.multiAgent); }, [aiSettings.multiAgent]);

  // ============ ANTHROPIC API KEY (BYO key — real Claude in a standalone Vite deploy) ============
  // When running inside Anthropic's Artifact runtime the key is injected automatically by the proxy.
  // When self-hosting via Vite locally, the user pastes their own key here and we send it directly.
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => {
    try { return localStorage.getItem("lectern_anthropic_api_key") || ""; } catch { return ""; }
  });
  const [anthropicApiKeyDraft, setAnthropicApiKeyDraft] = useState("");
  const [aiKeyStatus, setAiKeyStatus] = useState("");
  useEffect(() => { try { localStorage.setItem("lectern_anthropic_api_key", anthropicApiKey); } catch {} }, [anthropicApiKey]);
  // Build auth headers — uses key if user pasted one, otherwise relies on host proxy (Artifact runtime).
  const _claudeHeaders = () => {
    const h = { "Content-Type": "application/json" };
    if (anthropicApiKey && anthropicApiKey.trim()) {
      h["x-api-key"] = anthropicApiKey.trim();
      h["anthropic-version"] = "2023-06-01";
      // Required for direct browser→Anthropic calls (no backend proxy):
      h["anthropic-dangerous-direct-browser-access"] = "true";
    }
    return h;
  };

  // ============ AI PROVIDER (Anthropic Claude vs. Local WebGPU AI via WebLLM) ============
  // "anthropic" → call api.anthropic.com (needs key or Artifact proxy). Full quality, paid, online.
  // "webllm" → load a model into IndexedDB once, run inference locally via WebGPU. Free, offline, much weaker quality.
  const [aiProvider, setAiProvider] = useState(() => {
    try { return localStorage.getItem("lectern_ai_provider") || "anthropic"; } catch { return "anthropic"; }
  });
  const [localModel, setLocalModel] = useState(() => {
    try { return localStorage.getItem("lectern_local_model") || "Llama-3.2-3B-Instruct-q4f16_1-MLC"; } catch { return "Llama-3.2-3B-Instruct-q4f16_1-MLC"; }
  });
  const webllmEngineRef = useRef(null);
  const [webllmLoadedModel, setWebllmLoadedModel] = useState(""); // tracks which model is in the engine
  const [webllmStatus, setWebllmStatus] = useState("");
  const [webllmProgress, setWebllmProgress] = useState(0); // 0-1
  const [webllmLoading, setWebllmLoading] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState(null); // null = checking, true/false

  // Mobile detection — used to override inline styles where CSS media queries can't reach.
  // 640px is our standard "phone" breakpoint, matching the modal-fullscreen breakpoint.
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 640;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ============ SMOLVLM (Transformers.js vision encoder) ============
  // Separate from WebLLM: this is a vision-language model loaded via HuggingFace Transformers.js.
  // We use it ONLY to describe uploaded images, then feed the description into the existing WebLLM
  // (or Cloud AI) pipeline as text context. Two-stage: vision encode → text generation.
  //
  // Why this exists: WebLLM only has Phi-3.5-Vision (~3 GB, crashes Safari). SmolVLM-500M
  // (~500 MB) fits Safari's WebGPU memory limits and works as a lightweight image describer.
  //
  // Quality note: SmolVLM is significantly weaker than Claude vision. It's good for basic
  // image descriptions and printed-text reading, less reliable for handwriting / complex diagrams.
  const smolVLMRef = useRef({ processor: null, model: null });
  const [smolVLMLoaded, setSmolVLMLoaded] = useState(false);
  const [smolVLMLoading, setSmolVLMLoading] = useState(false);
  const [smolVLMStatus, setSmolVLMStatus] = useState("");
  const [smolVLMProgress, setSmolVLMProgress] = useState(0);
  useEffect(() => { try { localStorage.setItem("lectern_ai_provider", aiProvider); } catch {} }, [aiProvider]);
  useEffect(() => { try { localStorage.setItem("lectern_local_model", localModel); } catch {} }, [localModel]);

  // Detect WebGPU availability once on mount
  useEffect(() => {
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.gpu) { setWebgpuSupported(false); return; }
        const adapter = await navigator.gpu.requestAdapter();
        setWebgpuSupported(!!adapter);
      } catch { setWebgpuSupported(false); }
    })();
  }, []);

  // Lazy-load WebLLM library + initialize an engine for the chosen local model.
  // The library is ~30 MB; the model itself is 0.7–2.4 GB. Both are cached in IndexedDB after first load.
  // IMPORTANT: progress callback is throttled to ~250ms intervals — WebLLM can fire it hundreds of
  // times per second, and each call triggers a React re-render. On Safari (which has weaker WebGPU
  // memory management than Chrome) the re-render churn was contributing to OOM crashes.
  const initWebllm = async () => {
    if (webllmEngineRef.current && webllmLoadedModel === localModel) return webllmEngineRef.current;
    if (webgpuSupported === false) throw new Error("WebGPU not available in this browser. Use a recent Chrome/Edge on a desktop with a supported GPU.");
    setWebllmLoading(true);
    setWebllmStatus("Loading WebLLM runtime…");
    setWebllmProgress(0);
    try {
      // Pinned version for stability. esm.run mirrors npm via jsDelivr.
      const webllm = await import(/* @vite-ignore */ "https://esm.run/@mlc-ai/web-llm@0.2.79");
      setWebllmStatus(`Downloading ${LOCAL_MODELS[localModel]?.label || localModel}… (first time only — cached after)`);
      // Progress throttling state — preserve between callback fires
      let lastUpdateTime = 0;
      let lastText = "";
      const engine = await webllm.CreateMLCEngine(localModel, {
        initProgressCallback: (p) => {
          const now = Date.now();
          // Always update on text change (status messages are important and rare).
          // Otherwise throttle to 4 Hz max (250ms) — sufficient for a visible progress bar.
          if (p.text && p.text !== lastText) {
            lastText = p.text;
            setWebllmStatus(p.text);
            setWebllmProgress(typeof p.progress === "number" ? p.progress : 0);
            lastUpdateTime = now;
          } else if (now - lastUpdateTime >= 250) {
            setWebllmProgress(typeof p.progress === "number" ? p.progress : 0);
            lastUpdateTime = now;
          }
        },
      });
      webllmEngineRef.current = engine;
      setWebllmLoadedModel(localModel);
      setWebllmStatus(`✓ ${LOCAL_MODELS[localModel]?.label || localModel} ready`);
      setWebllmProgress(1);
      track("action", "webllm_loaded", { model: localModel });
      setTimeout(() => { setWebllmStatus(""); setWebllmLoading(false); }, 3500);
      return engine;
    } catch (e) {
      setWebllmStatus(`Failed: ${e.message}`);
      setWebllmLoading(false);
      logError(e, "webllm init");
      throw e;
    }
  };

  // ============ CANCEL WEBLLM LOAD ============
  // WebLLM's CreateMLCEngine doesn't expose an abort signal — once it's downloading, there's no
  // clean way to cancel mid-flight. The cleanest approximation: reset our state (UI unblocks),
  // null the engine ref (no partial engine sitting around), and optionally clear the cached shards
  // (if the user wants to start fresh). The background fetch continues but is now harmless.
  const cancelWebllmLoad = async (options = {}) => {
    const { clearCache = false } = options;
    // Unblock UI immediately
    setWebllmLoading(false);
    setWebllmStatus("");
    setWebllmProgress(0);
    // Null the engine so any partial state doesn't get reused
    if (webllmEngineRef.current && webllmEngineRef.current.unload) {
      try { await webllmEngineRef.current.unload(); } catch {}
    }
    webllmEngineRef.current = null;
    setWebllmLoadedModel("");
    // Optionally clear the cached shards (deleteCachedModel exists later in the file)
    if (clearCache && localModel) {
      try { await deleteCachedModel(localModel); } catch (e) { logError(e, "cancelWebllmLoad clearCache"); }
    }
    showToast(clearCache ? "Load cancelled + cache cleared. Try a different model." : "Load cancelled. You can pick a different model.");
    track("action", "webllm_load_cancelled", { clearCache });
  };

  // ============ SMOLVLM LAZY-LOAD + IMAGE DESCRIBE ============
  // Load Transformers.js + SmolVLM-500M-Instruct vision-language model. ~500 MB download cached
  // in IndexedDB by Transformers.js after first load. Works on Safari (small enough for its WebGPU).
  const initSmolVLM = async () => {
    if (smolVLMRef.current.model && smolVLMRef.current.processor) return smolVLMRef.current;
    if (webgpuSupported === false) throw new Error("WebGPU not available — SmolVLM requires WebGPU.");
    setSmolVLMLoading(true);
    setSmolVLMStatus("Loading Transformers.js runtime…");
    setSmolVLMProgress(0);
    try {
      // Pinned version for stability. Use CDN since the project doesn't bundle Transformers.js.
      const tf = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3");
      setSmolVLMStatus("Downloading SmolVLM-500M (first time only — cached after)");
      const modelId = "HuggingFaceTB/SmolVLM-500M-Instruct";
      // Throttled progress callback (same pattern as WebLLM)
      let lastUpdateTime = 0;
      const progressCb = (p) => {
        const now = Date.now();
        if (now - lastUpdateTime < 250) return;
        lastUpdateTime = now;
        if (p && typeof p.progress === "number") setSmolVLMProgress(p.progress / 100);
        if (p && p.status) setSmolVLMStatus(p.file ? `${p.status}: ${p.file}` : p.status);
      };
      const processor = await tf.AutoProcessor.from_pretrained(modelId, { progress_callback: progressCb });
      const model = await tf.AutoModelForVision2Seq.from_pretrained(modelId, {
        dtype: { embed_tokens: "fp16", vision_encoder: "q4", decoder_model_merged: "q4" },
        device: "webgpu",
        progress_callback: progressCb,
      });
      smolVLMRef.current = { processor, model, tf };
      setSmolVLMLoaded(true);
      setSmolVLMStatus("✓ SmolVLM ready");
      setSmolVLMProgress(1);
      track("action", "smolvlm_loaded");
      setTimeout(() => { setSmolVLMStatus(""); setSmolVLMLoading(false); }, 3500);
      return smolVLMRef.current;
    } catch (e) {
      setSmolVLMStatus(`Failed: ${e.message}`);
      setSmolVLMLoading(false);
      logError(e, "smolvlm init");
      throw e;
    }
  };

  // Convert uploaded images to plain-text descriptions via SmolVLM. Used to bridge images into
  // text-only WebLLM models (and as a fallback when Cloud AI isn't configured on Safari).
  // Returns a single newline-joined string of all image descriptions, or null on failure.
  const describeImagesWithSmolVLM = async (imageArr, queryHint) => {
    if (!imageArr || imageArr.length === 0) return null;
    const ctx = await initSmolVLM();
    if (!ctx || !ctx.model || !ctx.processor) return null;
    const { processor, model, tf } = ctx;
    const descriptions = [];
    for (let i = 0; i < imageArr.length; i++) {
      try {
        const img = imageArr[i];
        // SmolVLM expects an image input — convert our base64 to an HTMLImage via load_image
        const dataUrl = img.preview || `data:${img.mediaType || "image/jpeg"};base64,${img.data}`;
        const rawImage = await tf.load_image(dataUrl);
        const messages = [{
          role: "user",
          content: [
            { type: "image" },
            { type: "text", text: queryHint ? `Describe this image in detail. Context: ${queryHint}` : "Describe this image in detail, including any text visible." },
          ],
        }];
        const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await processor(prompt, [rawImage], { return_tensors: "pt" });
        const generatedIds = await model.generate({ ...inputs, max_new_tokens: 256, do_sample: false });
        const generatedTexts = processor.batch_decode(generatedIds.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
        descriptions.push(`[Image ${i + 1}]: ${(generatedTexts[0] || "").trim()}`);
      } catch (e) {
        logError(e, "smolvlm describe");
        descriptions.push(`[Image ${i + 1}]: (could not be described — ${e.message})`);
      }
    }
    return descriptions.join("\n\n");
  };

  // Safari detection — Safari's WebGPU is newer and has weaker memory management than Chrome's.
  // Large models (1B+) often crash the tab on Safari with "a problem occurred repeatedly" errors.
  // We warn users BEFORE they try to load a model so they can switch browsers or pick smaller.
  const isSafariBrowser = typeof navigator !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent || "");

  // Inference stats — surfaced live during streaming generation
  const [webllmStats, setWebllmStats] = useState({ tokensPerSec: 0, totalTokens: 0, firstTokenMs: 0, running: false });
  // Conversation history for local tutor chat (within session only)
  const webllmHistoryRef = useRef([]);

  // Run inference on the local model — OpenAI-compatible API with real upgrades:
  //   • Streaming via stream: true + onChunk callback
  //   • JSON mode via response_format when the calling code needs structured output
  //   • Per-call temperature (0.3 for deterministic, 0.8 for creative — caller decides)
  //   • Tokens/sec + first-token latency tracking surfaced via webllmStats
  //   • Honest context-window truncation for small models (most are 4k-8k)
  //   • Optional conversation history for tutor chat continuity
  const callWebllm = async (prompt, systemPrompt, opts = {}) => {
    const engine = await initWebllm();

    // ============ CONTEXT WINDOW HANDLING ============
    // Most local models top out at 4k-8k context. If the system+user prompt is too big, truncate
    // the system prompt's notebook-source block first (preserves the task instructions). Honest:
    // this means local AI on huge notebooks won't see all sources. A 24k-source clause becomes ~6k.
    const MAX_CONTEXT_CHARS = 18000; // ~4.5k tokens — safe for 8k-context models with room for output
    let trimmedSystem = systemPrompt || "";
    let trimmedPrompt = prompt;
    const totalLen = (trimmedSystem.length + trimmedPrompt.length);
    if (totalLen > MAX_CONTEXT_CHARS) {
      // Trim the source-grounding block (largest variable section) before trimming task instructions
      const sourceBlockMatch = trimmedSystem.match(/NOTEBOOK SOURCES[\s\S]+?END OF NOTEBOOK SOURCES\./);
      if (sourceBlockMatch) {
        const sourceBlock = sourceBlockMatch[0];
        const budget = Math.max(1500, MAX_CONTEXT_CHARS - (trimmedSystem.length - sourceBlock.length) - trimmedPrompt.length - 500);
        const trimmedSourceBlock = sourceBlock.slice(0, budget) + "\n[…truncated for local model context window]\nEND OF NOTEBOOK SOURCES.";
        trimmedSystem = trimmedSystem.replace(sourceBlock, trimmedSourceBlock);
      }
      // If still too long, hard-truncate
      if ((trimmedSystem.length + trimmedPrompt.length) > MAX_CONTEXT_CHARS) {
        trimmedSystem = trimmedSystem.slice(0, MAX_CONTEXT_CHARS - trimmedPrompt.length - 200) + "\n[truncated]";
      }
    }

    const messages = [];
    if (trimmedSystem) messages.push({ role: "system", content: trimmedSystem });
    // If conversation history is enabled (tutor chat mode), prepend prior turns
    if (opts.useHistory && webllmHistoryRef.current.length > 0) {
      messages.push(...webllmHistoryRef.current.slice(-6)); // last 3 turns (6 messages)
    }

    // ============ VISION INPUT (when on a vision-capable local model + images attached) ============
    // Phi-3.5-vision and other multimodal locals accept image_url content blocks like OpenAI.
    // Convert any attached images to base64 data URLs and structure the user message as multi-part content.
    const modelIsVision = LOCAL_MODELS[localModel]?.tier === "vision";
    if (modelIsVision && opts.images && opts.images.length > 0) {
      const content = [
        ...opts.images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mediaType || "image/png"};base64,${img.data}` },
        })),
        { type: "text", text: trimmedPrompt },
      ];
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: trimmedPrompt });
    }

    // Per-call temperature — caller can override; otherwise default 0.7 for generic
    const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.7;
    const max_tokens = Math.min(opts.maxTokens || 2000, 4000);

    const requestOpts = {
      messages, max_tokens, temperature,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    };

    // ============ STREAMING PATH ============
    if (opts.onChunk && typeof opts.onChunk === "function") {
      const callStart = Date.now();
      let firstTokenAt = 0;
      let fullText = "";
      let chunks = 0;
      setWebllmStats({ tokensPerSec: 0, totalTokens: 0, firstTokenMs: 0, running: true });
      try {
        const stream = await engine.chat.completions.create({ ...requestOpts, stream: true });
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content || "";
          if (delta) {
            if (!firstTokenAt) firstTokenAt = Date.now();
            fullText += delta;
            chunks++;
            opts.onChunk(delta, fullText);
            // Update stats every ~10 chunks to avoid excessive React renders
            if (chunks % 10 === 0) {
              const elapsedSec = (Date.now() - firstTokenAt) / 1000;
              const tps = elapsedSec > 0 ? (chunks / elapsedSec) : 0; // approximate — chunks ≈ tokens
              setWebllmStats({ tokensPerSec: Math.round(tps * 10) / 10, totalTokens: chunks, firstTokenMs: firstTokenAt - callStart, running: true });
            }
          }
        }
        const finalElapsedSec = firstTokenAt > 0 ? (Date.now() - firstTokenAt) / 1000 : 0;
        const finalTps = finalElapsedSec > 0 ? chunks / finalElapsedSec : 0;
        setWebllmStats({ tokensPerSec: Math.round(finalTps * 10) / 10, totalTokens: chunks, firstTokenMs: firstTokenAt - callStart, running: false });
        // Track conversation history if requested
        if (opts.useHistory) {
          webllmHistoryRef.current = [...webllmHistoryRef.current, { role: "user", content: trimmedPrompt }, { role: "assistant", content: fullText }].slice(-12);
        }
        return fullText;
      } catch (e) {
        setWebllmStats({ tokensPerSec: 0, totalTokens: 0, firstTokenMs: 0, running: false });
        throw e;
      }
    }

    // ============ NON-STREAMING PATH ============
    const callStart = Date.now();
    setWebllmStats({ tokensPerSec: 0, totalTokens: 0, firstTokenMs: 0, running: true });
    try {
      const completion = await engine.chat.completions.create(requestOpts);
      const text = completion.choices?.[0]?.message?.content || "";
      const elapsedSec = (Date.now() - callStart) / 1000;
      // Approximate token count from char count (4 chars ≈ 1 token for English)
      const approxTokens = Math.round(text.length / 4);
      const tps = elapsedSec > 0 ? approxTokens / elapsedSec : 0;
      setWebllmStats({ tokensPerSec: Math.round(tps * 10) / 10, totalTokens: approxTokens, firstTokenMs: 0, running: false });
      if (opts.useHistory) {
        webllmHistoryRef.current = [...webllmHistoryRef.current, { role: "user", content: trimmedPrompt }, { role: "assistant", content: text }].slice(-12);
      }
      return text;
    } catch (e) {
      setWebllmStats({ tokensPerSec: 0, totalTokens: 0, firstTokenMs: 0, running: false });
      throw e;
    }
  };

  // Reset conversation history (e.g. when user starts a new topic in tutor chat)
  const resetWebllmHistory = () => { webllmHistoryRef.current = []; };

  // ============ BENCHMARK ============
  // Run a fixed 50-token prompt against the currently-loaded model and report tokens/sec + first-token latency.
  // Lets the user evaluate their hardware before committing to using a model for real work.
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const runBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkResult(null);
    try {
      const engine = await initWebllm();
      const benchPrompt = "List 5 study techniques. One sentence each. Number them 1-5.";
      const callStart = Date.now();
      let firstTokenAt = 0;
      let chunks = 0;
      const stream = await engine.chat.completions.create({
        messages: [{ role: "user", content: benchPrompt }],
        max_tokens: 200, temperature: 0.5, stream: true,
      });
      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content || "";
        if (delta) {
          if (!firstTokenAt) firstTokenAt = Date.now();
          chunks++;
        }
      }
      const firstTokenMs = firstTokenAt - callStart;
      const generationMs = Date.now() - firstTokenAt;
      const tps = generationMs > 0 ? (chunks / (generationMs / 1000)) : 0;
      setBenchmarkResult({
        model: localModel,
        modelLabel: LOCAL_MODELS[localModel]?.label || localModel,
        firstTokenMs, tokensPerSec: Math.round(tps * 10) / 10,
        totalTokens: chunks, totalMs: Date.now() - callStart,
      });
      track("action", "webllm_benchmark", { model: localModel, tps });
    } catch (e) {
      setBenchmarkResult({ error: e.message });
      logError(e, "webllm benchmark");
    } finally {
      setBenchmarkRunning(false);
    }
  };

  // ============ CACHE MANAGEMENT ============
  // List cached models in IndexedDB (WebLLM stores model shards in "webllm-cache").
  // Returns array of { modelId, bytesApprox } so user can see disk usage + delete unused models.
  const [cachedModels, setCachedModels] = useState([]);
  const refreshCachedModels = async () => {
    try {
      if (!window.indexedDB || !navigator.storage?.estimate) {
        setCachedModels([]);
        return;
      }
      // List all databases (Chrome 75+ supports this)
      const cached = [];
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        const webllmDbs = dbs.filter((db) => db.name && (db.name.includes("webllm") || db.name.includes("MLC")));
        // Try to identify which models are cached by checking known model IDs against cached database names
        for (const modelId of Object.keys(LOCAL_MODELS)) {
          const matching = webllmDbs.find((db) => db.name.includes(modelId.split("-").slice(0, 3).join("-")));
          if (matching) {
            cached.push({ modelId, dbName: matching.name });
          }
        }
      }
      // Get total storage usage estimate
      const estimate = await navigator.storage.estimate();
      setCachedModels(cached.map((c) => ({ ...c, totalCacheBytes: estimate.usage || 0 })));
    } catch (e) { logError(e, "list cached models"); setCachedModels([]); }
  };
  const deleteCachedModel = async (modelId) => {
    if (!confirm(`Delete cached ${LOCAL_MODELS[modelId]?.label || modelId}? You'll need to re-download (~${LOCAL_MODELS[modelId]?.size || "?"}) to use it again.`)) return;
    try {
      // Find and delete matching IndexedDB databases
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        const matching = dbs.filter((db) => db.name && db.name.includes(modelId.split("-").slice(0, 3).join("-")));
        for (const db of matching) {
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = resolve;
            req.onerror = reject;
            req.onblocked = resolve; // unblock after current tabs close
          });
        }
      }
      // Also clear the engine if this was the loaded model
      if (webllmLoadedModel === modelId) {
        webllmEngineRef.current = null;
        setWebllmLoadedModel("");
      }
      showToast(`Deleted ${LOCAL_MODELS[modelId]?.label || modelId} cache`);
      refreshCachedModels();
    } catch (e) { logError(e, "delete cached model"); showToast("Couldn't delete cache — try clearing site data in browser settings"); }
  };

  const [sources, setSources] = useState([]);
  const [thinkingStage, setThinkingStage] = useState("");
  const [generationLog, setGenerationLog] = useState([]);

  // Tracking
  const [weaknesses, setWeaknesses] = useState([]);
  const [steelmanExplanations, setSteelmanExplanations] = useState({});
  const [loadingSteelman, setLoadingSteelman] = useState(false);

  // Settings
  const [language, setLanguage] = useState("English");
  const [showSettings, setShowSettings] = useState(false);
  // Notebook UI flags
  const [showNotebookCreate, setShowNotebookCreate] = useState(false);
  const [showNotebookSources, setShowNotebookSources] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceDraft, setNewSourceDraft] = useState({ name: "", content: "", type: "text" });
  // ============ HANDWRITING OCR ENHANCEMENTS ============
  // Real upgrade scope: the OCR is Claude's vision (can't swap that out). What I can upgrade is:
  //   (a) preprocessing the image to boost contrast/sharpness before sending it
  //   (b) a dedicated transcription mode with a specialized prompt (multi-pass, mark uncertainty)
  const [enhanceContrast, setEnhanceContrast] = useState(false);
  const [showOcrEnhance, setShowOcrEnhance] = useState(false);
  const [ocrResult, setOcrResult] = useState(null); // { transcript, uncertain, passes }
  const [ocrLoading, setOcrLoading] = useState(false);

  // ============ CAMERA SCANNER — live edge-detect + auto-capture (like Apple's scanner) ============
  // Browsers can't match Apple's native VisionKit scanner — no privileged hardware-accelerated
  // edge detection, no gyroscope fusion. But we CAN do meaningful work with pure JS:
  //   • getUserMedia for live camera preview (back camera on mobile)
  //   • Per-frame downscaled luminance analysis to find the brightest rectangular region (the paper)
  //   • Stability detection: if same bounding box detected for N consecutive frames → auto-capture
  //   • Full-resolution capture from video stream, cropped to the detected region
  // Honest scope: detects axis-aligned bounding box. No perspective correction (that needs OpenCV).
  // Works best on: white/light paper on darker desk surface, decent lighting. Failure mode is graceful:
  // user can always tap "Capture now" to bypass auto-detection.
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState(""); // "Searching for paper..." | "Hold steady..." | "Captured!"
  const [scannerStableFrames, setScannerStableFrames] = useState(0);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraOverlayRef = useRef(null); // canvas overlay for drawing detected corners
  const cameraDetectFrameRef = useRef(null); // animation-frame id
  const cameraLastBoundsRef = useRef(null);
  const cameraStableCountRef = useRef(0);
  const cameraCapturedRef = useRef(false);

  // Per-frame paper detection. Returns { x, y, width, height, confidence } or null.
  // Algorithm: downscale to 240px wide, compute luminance, threshold at mean+30, find bounding box
  // of bright pixels, return if it covers >20% of frame with >60% density inside the box.
  const detectPaperInFrame = (video, processingWidth = 240) => {
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = processingWidth / vw;
    const pw = Math.round(vw * scale), ph = Math.round(vh * scale);
    const tmp = document.createElement("canvas");
    tmp.width = pw; tmp.height = ph;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(video, 0, 0, pw, ph);
    const imgData = tctx.getImageData(0, 0, pw, ph);
    const d = imgData.data;

    // Compute luma + mean
    const N = pw * ph;
    const luma = new Uint8Array(N);
    let sum = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const y = (d[i] + d[i + 1] + d[i + 2]) / 3;
      luma[j] = y; sum += y;
    }
    const mean = sum / N;
    const threshold = Math.min(245, mean + 25); // dynamic threshold

    // Find bounding box of bright pixels
    let minX = pw, minY = ph, maxX = 0, maxY = 0, brightCount = 0;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        if (luma[y * pw + x] > threshold) {
          brightCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const boxW = maxX - minX, boxH = maxY - minY;
    const boxArea = boxW * boxH;
    const totalArea = pw * ph;
    if (boxArea / totalArea < 0.18 || brightCount / totalArea < 0.12) return null;

    const density = brightCount / boxArea;
    if (density < 0.55) return null; // bright region must be solid (paper), not scattered (clouds, lights)

    // Edge margin filter — if box touches the frame edge it's likely not the paper but background
    if (minX < 3 || minY < 3 || maxX > pw - 3 || maxY > ph - 3) {
      // Allow if it covers >80% of frame (close-up shot)
      if (boxArea / totalArea < 0.80) return null;
    }

    // Return in ORIGINAL video coordinates (scale back up)
    const invScale = 1 / scale;
    return {
      x: minX * invScale, y: minY * invScale,
      width: boxW * invScale, height: boxH * invScale,
      confidence: density,
    };
  };

  // Start the camera stream + per-frame detection loop
  const startCameraScanner = async () => {
    cameraCapturedRef.current = false;
    cameraLastBoundsRef.current = null;
    cameraStableCountRef.current = 0;
    setScannerStableFrames(0);
    setScannerStatus("Requesting camera permission…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
      setScannerStatus("Searching for paper…");
      // Detection loop
      const loop = () => {
        if (cameraCapturedRef.current || !cameraStreamRef.current) return;
        const video = cameraVideoRef.current;
        const overlay = cameraOverlayRef.current;
        if (video && overlay && video.videoWidth > 0) {
          // Resize overlay to match video display size
          const rect = video.getBoundingClientRect();
          if (overlay.width !== Math.round(rect.width) || overlay.height !== Math.round(rect.height)) {
            overlay.width = Math.round(rect.width);
            overlay.height = Math.round(rect.height);
          }
          const octx = overlay.getContext("2d");
          octx.clearRect(0, 0, overlay.width, overlay.height);

          const bounds = detectPaperInFrame(video);
          if (bounds) {
            // Convert video-coords to overlay-coords for drawing
            const dx = bounds.x / video.videoWidth * overlay.width;
            const dy = bounds.y / video.videoHeight * overlay.height;
            const dw = bounds.width / video.videoWidth * overlay.width;
            const dh = bounds.height / video.videoHeight * overlay.height;

            // Stability check: same-ish bounds as last frame?
            const last = cameraLastBoundsRef.current;
            const stable = last && Math.abs(bounds.x - last.x) < bounds.width * 0.05
                                && Math.abs(bounds.y - last.y) < bounds.height * 0.05
                                && Math.abs(bounds.width - last.width) < bounds.width * 0.08
                                && Math.abs(bounds.height - last.height) < bounds.height * 0.08;
            if (stable) {
              cameraStableCountRef.current += 1;
            } else {
              cameraStableCountRef.current = 0;
            }
            cameraLastBoundsRef.current = bounds;
            setScannerStableFrames(cameraStableCountRef.current);

            // Draw detected rectangle (green when stable, gold when searching)
            const stableEnough = cameraStableCountRef.current >= 12; // ~500ms at 25fps
            octx.strokeStyle = stableEnough ? "#52a06b" : "#c8a96a";
            octx.lineWidth = 4;
            octx.strokeRect(dx, dy, dw, dh);
            // Corner brackets for visual feedback
            octx.lineWidth = 6;
            const bracketLen = Math.min(dw, dh) * 0.12;
            [[dx, dy, 1, 1], [dx + dw, dy, -1, 1], [dx, dy + dh, 1, -1], [dx + dw, dy + dh, -1, -1]].forEach(([cx, cy, sx, sy]) => {
              octx.beginPath();
              octx.moveTo(cx + bracketLen * sx, cy);
              octx.lineTo(cx, cy);
              octx.lineTo(cx, cy + bracketLen * sy);
              octx.stroke();
            });

            if (stableEnough && !cameraCapturedRef.current) {
              cameraCapturedRef.current = true;
              setScannerStatus("Captured!");
              setTimeout(() => captureCameraFrame(bounds), 100); // small delay so user sees "Captured!"
              return; // stop the loop
            } else {
              setScannerStatus(stable ? `Hold steady… (${Math.min(12, cameraStableCountRef.current)}/12)` : "Paper detected — hold steady");
            }
          } else {
            cameraStableCountRef.current = 0;
            cameraLastBoundsRef.current = null;
            setScannerStableFrames(0);
            setScannerStatus("Searching for paper…");
          }
        }
        cameraDetectFrameRef.current = requestAnimationFrame(loop);
      };
      cameraDetectFrameRef.current = requestAnimationFrame(loop);
    } catch (e) {
      logError(e, "camera scanner getUserMedia");
      setScannerStatus(`Camera unavailable: ${e.message || "permission denied"}`);
    }
  };

  // Capture current video frame at full res, crop to detected bounds, add to images
  const captureCameraFrame = (bounds) => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    // Crop with a small padding so we don't shave the page edge
    const pad = Math.min(vw, vh) * 0.02;
    const cx = Math.max(0, (bounds?.x || 0) - pad);
    const cy = Math.max(0, (bounds?.y || 0) - pad);
    const cw = Math.min(vw - cx, (bounds?.width || vw) + 2 * pad);
    const ch = Math.min(vh - cy, (bounds?.height || vh) + 2 * pad);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw); canvas.height = Math.round(ch);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);

    const dataURL = canvas.toDataURL("image/jpeg", 0.92);
    // Add to images using the same shape handleImageUpload uses
    if (enhanceContrast) {
      preprocessImageForOCR(dataURL).then((processed) => {
        const base64 = processed.split(",")[1];
        setImages((prev) => [...prev, { data: base64, mediaType: "image/jpeg", preview: dataURL, preprocessed: true, scanned: true }]);
        stopCameraScanner();
        showToast("Captured page from camera");
      }).catch(() => {
        const base64 = dataURL.split(",")[1];
        setImages((prev) => [...prev, { data: base64, mediaType: "image/jpeg", preview: dataURL, scanned: true }]);
        stopCameraScanner();
        showToast("Captured page from camera");
      });
    } else {
      const base64 = dataURL.split(",")[1];
      setImages((prev) => [...prev, { data: base64, mediaType: "image/jpeg", preview: dataURL, scanned: true }]);
      stopCameraScanner();
      showToast("Captured page from camera");
    }
    track("action", "camera_scan_capture", { stable_frames: cameraStableCountRef.current });
  };

  const stopCameraScanner = () => {
    if (cameraDetectFrameRef.current) {
      cancelAnimationFrame(cameraDetectFrameRef.current);
      cameraDetectFrameRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setShowCameraScanner(false);
    setScannerStatus("");
    cameraCapturedRef.current = false;
    cameraStableCountRef.current = 0;
    cameraLastBoundsRef.current = null;
    setScannerStableFrames(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      if (cameraDetectFrameRef.current) cancelAnimationFrame(cameraDetectFrameRef.current);
    };
  }, []);

  // Auto-start when the modal opens
  useEffect(() => {
    if (showCameraScanner) {
      setTimeout(() => startCameraScanner(), 100); // wait for video element to mount
    } else {
      // Cleanup if it gets closed externally
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      if (cameraDetectFrameRef.current) {
        cancelAnimationFrame(cameraDetectFrameRef.current);
        cameraDetectFrameRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraScanner]);
  const [ocrPassStatus, setOcrPassStatus] = useState("");
  const [ocrDomain, setOcrDomain] = useState(""); // optional domain hint for disambiguation

  // ============ REAL INTERNAL INFRASTRUCTURE ============

  // Online/offline detection — listens to browser events, shows banner when offline,
  // disables Anthropic-dependent UI gracefully.
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? (navigator.onLine !== false) : true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => { window.removeEventListener("online", onUp); window.removeEventListener("offline", onDown); };
  }, []);

  // API usage tracking — every callClaude logs estimated token counts + latency. Aggregated for the
  // Diagnostics panel so users see what they're spending. Estimates: 1 token ≈ 4 chars (English text).
  // Real production app: would use the API response's usage.input_tokens / output_tokens directly.
  const [apiUsage, setApiUsage] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lectern_api_usage") || "null") || {
        lifetimeCalls: 0, lifetimeInputTokens: 0, lifetimeOutputTokens: 0,
        sessionCalls: 0, sessionInputTokens: 0, sessionOutputTokens: 0,
        latencies: [], lastCallAt: null, lastError: null,
      };
    } catch { return { lifetimeCalls: 0, lifetimeInputTokens: 0, lifetimeOutputTokens: 0, sessionCalls: 0, sessionInputTokens: 0, sessionOutputTokens: 0, latencies: [], lastCallAt: null, lastError: null }; }
  });
  // Persist only the lifetime parts (session resets on reload — that's correct)
  useEffect(() => {
    try {
      const persisted = { ...apiUsage, sessionCalls: 0, sessionInputTokens: 0, sessionOutputTokens: 0, latencies: apiUsage.latencies.slice(-50) };
      localStorage.setItem("lectern_api_usage", JSON.stringify(persisted));
    } catch {}
  }, [apiUsage.lifetimeCalls, apiUsage.lifetimeInputTokens, apiUsage.lifetimeOutputTokens]);

  const logApiCall = ({ inputChars = 0, outputChars = 0, latencyMs = 0, model = "", error = null }) => {
    const inTokens = Math.ceil(inputChars / 4);
    const outTokens = Math.ceil(outputChars / 4);
    setApiUsage((u) => ({
      lifetimeCalls: u.lifetimeCalls + 1,
      lifetimeInputTokens: u.lifetimeInputTokens + inTokens,
      lifetimeOutputTokens: u.lifetimeOutputTokens + outTokens,
      sessionCalls: u.sessionCalls + 1,
      sessionInputTokens: u.sessionInputTokens + inTokens,
      sessionOutputTokens: u.sessionOutputTokens + outTokens,
      latencies: [...u.latencies.slice(-49), latencyMs].filter((n) => n > 0),
      lastCallAt: Date.now(),
      lastError: error || u.lastError,
    }));
  };

  // Undo queue — destructive actions push an "undo function" that's valid for 5 seconds.
  // Real products do this (Gmail's "Undo Send", Linear's delete-with-undo, etc.) instead of
  // hard window.confirm() prompts. Less friction for power users, recovery for mistakes.
  const [undoStack, setUndoStack] = useState([]);
  const pushUndo = (label, undoFn, durationMs = 5000) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setUndoStack((s) => [...s, { id, label, undoFn, expiresAt: Date.now() + durationMs }]);
    // Auto-dismiss after duration
    setTimeout(() => setUndoStack((s) => s.filter((u) => u.id !== id)), durationMs);
    return id;
  };

  // First-run banner — visible once per browser; dismissed via the X button.
  const [firstRunDismissed, setFirstRunDismissed] = useState(() => {
    try { return localStorage.getItem("lectern_first_run_dismissed") === "1"; } catch { return true; }
  });
  const dismissFirstRun = () => {
    setFirstRunDismissed(true);
    try { localStorage.setItem("lectern_first_run_dismissed", "1"); } catch {}
  };

  // ============ ONBOARDING — 4-step guided start for first-time users ============
  // Shown automatically once on first visit (no `lectern_onboarded` flag set yet).
  // 4 steps: name → subject (creates first notebook) → goal (sets context) → starting mode.
  // Completing it persists every answer to the right place and marks onboarded.
  // Skippable at any step; the regular first-run banner remains as a fallback for users who skip.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDraft, setOnboardingDraft] = useState({
    name: "", subject: "", subjectDesc: "", goal: "casual", examDate: "", difficulty: "intermediate",
  });
  useEffect(() => {
    // First visit detection: no onboarding flag AND no existing notebooks AND no profile.name
    // (so existing users with data don't get re-onboarded). Delay 600ms so the app renders first.
    try {
      const done = localStorage.getItem("lectern_onboarded") === "1";
      const hasExistingData = (notebooks && notebooks.length > 0) || persistentProfile.name || (savedGenerations && savedGenerations.length > 0);
      if (!done && !hasExistingData) {
        const t = setTimeout(() => setShowOnboarding(true), 600);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []); // run once on mount

  const completeOnboarding = (skipped = false) => {
    try { localStorage.setItem("lectern_onboarded", "1"); } catch {}
    if (!skipped) {
      // Persist all collected answers to the right places
      if (onboardingDraft.name.trim()) {
        setPersistentProfile((p) => ({ ...p, name: onboardingDraft.name.trim() }));
      }
      if (onboardingDraft.subject.trim()) {
        const nbId = createNotebook(onboardingDraft.subject.trim(), "📓", "moss");
        if (onboardingDraft.subjectDesc.trim()) {
          // Add the description as a first source so the notebook isn't empty
          setTimeout(() => addSourceToNotebook(nbId, {
            name: "Goals & context",
            content: onboardingDraft.subjectDesc.trim(),
            type: "text",
          }), 200);
        }
      }
      if (onboardingDraft.goal === "exam" && onboardingDraft.examDate) {
        setPersistentProfile((p) => ({ ...p, examDate: onboardingDraft.examDate }));
      }
      if (onboardingDraft.difficulty) {
        setDifficulty(onboardingDraft.difficulty);
      }
      // Mark first-run banner dismissed too — onboarding supersedes it
      setFirstRunDismissed(true);
      try { localStorage.setItem("lectern_first_run_dismissed", "1"); } catch {}
      track("event", "onboarding_completed", { goal: onboardingDraft.goal, difficulty: onboardingDraft.difficulty });
    } else {
      track("event", "onboarding_skipped", { atStep: onboardingStep });
    }
    setShowOnboarding(false);
    setOnboardingStep(0);
  };


  // Diagnostics modal flag
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  // Help Center
  const [showHelp, setShowHelp] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");
  const [helpExpanded, setHelpExpanded] = useState({});

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerMode, setTimerMode] = useState("focus");
  const [pomodoroCount, setPomodoroCount] = useState(0);

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    questionsAnswered: 0, questionsCorrect: 0, cardsReviewed: 0,
    cardsMastered: 0, minutesStudied: 0, topicsStudied: [], modesUsed: [],
  });
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(30);

  // Speech
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Tools
  const [showMathSolver, setShowMathSolver] = useState(false);
  const [settingsForceUpdate, setSettingsForceUpdate] = useState(0); // bumped after writing localStorage to refresh derived UI
  const [mathInput, setMathInput] = useState("");
  const [mathSolution, setMathSolution] = useState(null);
  const [solvingMath, setSolvingMath] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  // Code & STEM input modals — collect topic/code from user BEFORE running generation
  const [showDerivePrompt, setShowDerivePrompt] = useState(false);
  const [deriveTopicDraft, setDeriveTopicDraft] = useState("");
  const [showCodeExplain, setShowCodeExplain] = useState(false);
  const [codeExplainDraft, setCodeExplainDraft] = useState("");
  const [codeExplainLang, setCodeExplainLang] = useState("auto");
  const [codeExplainResult, setCodeExplainResult] = useState(null);
  const [codeExplainLoading, setCodeExplainLoading] = useState(false);

  // Suggestions

  // === Persistent profile === Saved to localStorage on every change.
  // Supabase sync (if signed in) is on top of this — local is the fast cache, cloud is the cross-device backup.
  const [persistentProfile, setPersistentProfile] = useState(() => {
    const defaults = {
      goal: "", examDate: "", examPlan: null, weakSpots: [],
      preferredStyle: "balanced", recentTopics: [], masteredConcepts: [],
      totalMinutes: 0, sessionsCount: 0, lastSessionAt: 0, persona: "default",
      cardStates: {}, // SM-2 per-card: key -> { ef, interval, reps, due }
      freezeTokens: 1, // forgiving streak — earn 1 every 5 sessions, max 3
      displayName: "", // what the greeting calls you
      ageOrGrade: "", // e.g. "10th grade", "undergrad junior", "adult, no formal CS background"
      localSearchEndpoint: DEFAULT_LOCAL_SEARCH_ENDPOINT, // deployment default — overridable in Integrations
      icsSubscriptionEndpoint: DEFAULT_ICS_SUBSCRIPTION_ENDPOINT, // deployment default — overridable in Integrations
      perFactCitations: false, // when on, AI emits "→ Source: [Sn]" beneath every factual claim. Off by default to preserve flowing prose for explainer/briefing modes.
    };
    try {
      const saved = JSON.parse(localStorage.getItem("lectern_profile_v1") || "null");
      if (!saved) return defaults;
      // Smart merge: don't let saved empty strings clobber deployment defaults for endpoints
      const merged = { ...defaults, ...saved };
      if (!merged.localSearchEndpoint) merged.localSearchEndpoint = DEFAULT_LOCAL_SEARCH_ENDPOINT;
      if (!merged.icsSubscriptionEndpoint) merged.icsSubscriptionEndpoint = DEFAULT_ICS_SUBSCRIPTION_ENDPOINT;
      return merged;
    } catch { return defaults; }
  });
  // Persist on every change (debounced via the effect — React batches anyway)
  useEffect(() => {
    try { localStorage.setItem("lectern_profile_v1", JSON.stringify(persistentProfile)); } catch {}
  }, [persistentProfile]);

  // ----- SM-2 spaced repetition -----
  const cardKey = (front) => `${(topic || "_").slice(0, 40)}::${String(front).slice(0, 80)}`;
  const sm2Update = (prev, q) => {
    // q: 0 again, 1 hard, 2 hard-ish, 3 good (lapse threshold), 4 good, 5 easy
    let { ef = 2.5, interval = 0, reps = 0 } = prev || {};
    if (q < 3) { reps = 0; interval = 1; }
    else {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ef);
      reps += 1;
    }
    ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    return { ef: Math.round(ef * 100) / 100, interval, reps, due: Date.now() + interval * 86400000 };
  };
  // Rate a card. Now ALSO stores front/back/topic so the review queue has the card content.
  // (Previously only stored SM-2 numbers, leaving cards unreviewable later.)
  const rateCard = (front, quality, back, cardTopic) => {
    const k = cardKey(front);
    setPersistentProfile((p) => {
      const prevState = p.cardStates[k] || {};
      const updated = sm2Update(prevState, quality);
      return {
        ...p,
        cardStates: {
          ...p.cardStates,
          [k]: {
            ...updated,
            front: prevState.front || String(front).slice(0, 500),
            back: back ? String(back).slice(0, 2000) : (prevState.back || ""),
            topic: cardTopic || prevState.topic || topic || "",
            notebookId: prevState.notebookId || currentNotebookId || null,
            lastReviewedAt: Date.now(),
          },
        },
      };
    });
  };
  // Seed cardStates with newly-generated flashcards so they enter the review pipeline
  // even before the user rates them. Uses interval 0 / due now / no reps yet.
  const seedFlashcards = (cards, cardTopic) => {
    if (!Array.isArray(cards) || cards.length === 0) return;
    setPersistentProfile((p) => {
      const newStates = { ...p.cardStates };
      const t = cardTopic || topic || "";
      const tPrefix = (t || "_").slice(0, 40);
      cards.forEach((c) => {
        if (!c || !c.front) return;
        const k = `${tPrefix}::${String(c.front).slice(0, 80)}`;
        if (newStates[k]) return; // don't overwrite existing review history
        newStates[k] = {
          ef: 2.5, interval: 0, reps: 0, due: Date.now(),
          front: String(c.front).slice(0, 500),
          back: String(c.back || "").slice(0, 2000),
          topic: t,
          notebookId: currentNotebookId || null,
          lastReviewedAt: null,
        };
      });
      return { ...p, cardStates: newStates };
    });
  };

  // === Review queue state — spaced repetition centralized review ===
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [reviewCardIdx, setReviewCardIdx] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewSessionCards, setReviewSessionCards] = useState([]); // snapshot of due cards at session start
  const [reviewSessionStats, setReviewSessionStats] = useState({ correct: 0, total: 0, started: 0 });

  const dueCardsList = useMemo(() => {
    const now = Date.now();
    const states = persistentProfile.cardStates || {};
    return Object.entries(states)
      .filter(([_, v]) => (v.due || 0) <= now && v.front)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (a.due || 0) - (b.due || 0));
  }, [persistentProfile.cardStates]);

  const startReviewSession = () => {
    if (dueCardsList.length === 0) { showToast("No cards due — check back tomorrow"); return; }
    setReviewSessionCards(dueCardsList.slice(0, 30)); // cap per session
    setReviewCardIdx(0);
    setReviewFlipped(false);
    setReviewSessionStats({ correct: 0, total: 0, started: Date.now() });
    setShowReviewQueue(true);
    track("action", "review_session_start", { count: dueCardsList.length });
  };

  const reviewRate = (quality) => {
    const card = reviewSessionCards[reviewCardIdx];
    if (!card) return;
    rateCard(card.front, quality, card.back, card.topic);
    setReviewSessionStats((s) => ({ ...s, correct: s.correct + (quality >= 3 ? 1 : 0), total: s.total + 1 }));
    // Auto-advance
    if (reviewCardIdx < reviewSessionCards.length - 1) {
      setReviewCardIdx(reviewCardIdx + 1);
      setReviewFlipped(false);
    } else {
      // Session done — keep modal open to show summary
      setReviewFlipped(false);
      setReviewCardIdx(reviewSessionCards.length); // sentinel value = done
    }
  };

  // === Tutor intelligence ===
  const [socraticMode, setSocraticMode] = useState(false);
  const [tutorPersona, setTutorPersona] = useState("default");
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeInsights, setWelcomeInsights] = useState(null);

  // === Teach-it-back ===
  const [teachBackActive, setTeachBackActive] = useState(false);
  const [teachBackInput, setTeachBackInput] = useState("");
  const [teachBackFeedback, setTeachBackFeedback] = useState(null);
  const [teachBackLoading, setTeachBackLoading] = useState(false);

  // === Stuck/frustration ===

  // === Exam planner ===
  const [showExamPlanner, setShowExamPlanner] = useState(false);
  const [examPlan, setExamPlan] = useState(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // File input refs
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Flashcard state
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());

  // Practice state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [problemIndex, setProblemIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  // ============ MASTERY CHECK ============
  // When user scores high but not perfect, we capture the missed questions, let them
  // review explanations, then re-quiz them on fresh MCQs targeting the SAME concepts
  // before allowing the level-up. Catches "lucky-pass" results and locks in real mastery.
  const [missedProblems, setMissedProblems] = useState([]); // [{ problem, theirAnswer }]
  const [inMasteryCheck, setInMasteryCheck] = useState(false);
  const [masteryCheckSourceTier, setMasteryCheckSourceTier] = useState(null);
  const [masteryCheckLoading, setMasteryCheckLoading] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [hints, setHints] = useState([]);
  const [loadingHint, setLoadingHint] = useState(false);

  // Active recall
  const [typedAnswer, setTypedAnswer] = useState("");
  const [gradingAnswer, setGradingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [recallQueue, setRecallQueue] = useState([]);

  // Free response
  const [frAnswer, setFrAnswer] = useState("");
  const [frGrading, setFrGrading] = useState(false);
  const [frFeedback, setFrFeedback] = useState(null);

  // Session
  const [sessionStart, setSessionStart] = useState(null);

  // Tutor chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Integrations toggles (Lumen)
  // Webhook URL for Slack/Discord/Zapier ping integration
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try { return localStorage.getItem("lectern_webhook_url") || ""; } catch { return ""; }
  });
  const [webhookDraft, setWebhookDraft] = useState("");
  const [webhookStatus, setWebhookStatus] = useState("");
  useEffect(() => { try { localStorage.setItem("lectern_webhook_url", webhookUrl); } catch {} }, [webhookUrl]);

  // Google Drive API key (Path A — public files via api key, no OAuth)
  const [googleApiKey, setGoogleApiKey] = useState(() => {
    try { return localStorage.getItem("lectern_google_api_key") || ""; } catch { return ""; }
  });
  const [googleApiKeyDraft, setGoogleApiKeyDraft] = useState("");
  const [driveUrlDraft, setDriveUrlDraft] = useState("");
  const [driveStatus, setDriveStatus] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  useEffect(() => { try { localStorage.setItem("lectern_google_api_key", googleApiKey); } catch {} }, [googleApiKey]);

  // Google Drive OAuth-PKCE (Path B — full read+write to private Drive)
  const [googleClientId, setGoogleClientId] = useState(() => {
    try { return localStorage.getItem("lectern_google_client_id") || ""; } catch { return ""; }
  });
  const [googleClientIdDraft, setGoogleClientIdDraft] = useState("");
  const [googleAccessToken, setGoogleAccessToken] = useState(() => {
    try { return localStorage.getItem("lectern_google_access_token") || ""; } catch { return ""; }
  });
  const [googleRefreshToken, setGoogleRefreshToken] = useState(() => {
    try { return localStorage.getItem("lectern_google_refresh_token") || ""; } catch { return ""; }
  });
  const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState(() => {
    try { return parseInt(localStorage.getItem("lectern_google_token_expires_at") || "0", 10); } catch { return 0; }
  });
  const [googleUserEmail, setGoogleUserEmail] = useState(() => {
    try { return localStorage.getItem("lectern_google_user_email") || ""; } catch { return ""; }
  });
  const [oauthStatus, setOauthStatus] = useState("");
  const [oauthInFlight, setOauthInFlight] = useState(false);
  useEffect(() => { try { localStorage.setItem("lectern_google_client_id", googleClientId); } catch {} }, [googleClientId]);
  useEffect(() => { try { localStorage.setItem("lectern_google_access_token", googleAccessToken); } catch {} }, [googleAccessToken]);
  useEffect(() => { try { localStorage.setItem("lectern_google_refresh_token", googleRefreshToken); } catch {} }, [googleRefreshToken]);
  useEffect(() => { try { localStorage.setItem("lectern_google_token_expires_at", String(googleTokenExpiresAt)); } catch {} }, [googleTokenExpiresAt]);
  useEffect(() => { try { localStorage.setItem("lectern_google_user_email", googleUserEmail); } catch {} }, [googleUserEmail]);

  // --- StudyLoop: careers ---
  const [caseIdx, setCaseIdx] = useState(0);

  // --- StudyLoop: wellbeing — PERSISTED across sessions ---
  const [sleepHours, setSleepHours] = useState(() => {
    try { return parseFloat(localStorage.getItem("lectern_wb_sleep") || "7.5"); } catch { return 7.5; }
  });
  const [mood, setMood] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lectern_wb_mood") || "null");
      // Only honor today's mood — wipes overnight, so daily check-in still happens
      if (saved && saved.date === new Date().toDateString()) return saved.value;
    } catch {}
    return "";
  });
  const [wbSessionStart] = useState(Date.now());
  const [wbSessionLen, setWbSessionLen] = useState(0);
  const [stopAcknowledged, setStopAcknowledged] = useState(false);
  const [wbToggles, setWbToggles] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_wb_toggles") || "null") || { eye: true, posture: true, hydrate: true }; } catch { return { eye: true, posture: true, hydrate: true }; }
  });
  // Persistence effects
  useEffect(() => {
    try { localStorage.setItem("lectern_wb_sleep", String(sleepHours)); } catch {}
  }, [sleepHours]);
  useEffect(() => {
    try {
      if (mood) localStorage.setItem("lectern_wb_mood", JSON.stringify({ value: mood, date: new Date().toDateString() }));
      else localStorage.removeItem("lectern_wb_mood");
    } catch {}
  }, [mood]);
  useEffect(() => {
    try { localStorage.setItem("lectern_wb_toggles", JSON.stringify(wbToggles)); } catch {}
  }, [wbToggles]);

  // --- StudyLoop: feed ---

  // --- Toast notifications ---
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // --- New: calibration, freeze tokens, daily challenge, prediction, interleaving ---
  const [calibration, setCalibration] = useState([]); // {confidence: 1-5, correct: bool, ts}
  const [pendingConfidence, setPendingConfidence] = useState(null); // null|1-5
  const [interleaved, setInterleaved] = useState(false);
  const [predictionDraft, setPredictionDraft] = useState("");
  const [lastPrediction, setLastPrediction] = useState(""); // sent with next generation
  const [showPrediction, setShowPrediction] = useState(false);
  const [dailyChallenge, setDailyChallenge] = useState(null); // { date, q, options, correctIndex, explanation, answered }

  // --- Feedback / analytics / errors ---
  const [feedbackLog, setFeedbackLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_feedback_v1") || "[]"); } catch { return []; }
  });
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({ rating: null, category: "Suggestion", text: "", includeContext: true });
  const [analytics, setAnalytics] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_analytics_v1") || '{"events":[],"totals":{"mode":{},"view":{},"action":{}}}'); }
    catch { return { events: [], totals: { mode: {}, view: {}, action: {} } }; }
  });
  const [errorLog, setErrorLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_errors_v1") || "[]"); } catch { return []; }
  });
  const [generationFeedback, setGenerationFeedback] = useState({}); // mode|topic -> +1 / -1
  // Owner email for "share without server" mode — bake into SHARE_OWNER_EMAIL or set per-device here
  const [ownerEmail, setOwnerEmail] = useState(() => {
    try { return SHARE_OWNER_EMAIL || localStorage.getItem("lectern_owner_email") || ""; } catch { return SHARE_OWNER_EMAIL || ""; }
  });
  const [ownerEmailDraft, setOwnerEmailDraft] = useState("");
  useEffect(() => { try { if (ownerEmail && !SHARE_OWNER_EMAIL) localStorage.setItem("lectern_owner_email", ownerEmail); } catch {} }, [ownerEmail]);

  // ============ CLOUD SYNC & AUTH (Supabase) ============
  const [supabase, setSupabase] = useState(null); // the Supabase client once loaded
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [user, setUser] = useState(null); // auth user when signed in
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDraft, setAuthDraft] = useState({ mode: "signin", email: "", password: "" });
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [myClasses, setMyClasses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_classes_v1") || "[]"); } catch { return []; }
  });
  const [classDraft, setClassDraft] = useState({ name: "", term: "", color: "blue", selfStudy: false, generateCurriculum: false, notes: "" });
  const [editingClassId, setEditingClassId] = useState(null);
  const [showAddClassLibrary, setShowAddClassLibrary] = useState(false);
  useEffect(() => { try { if (!user) localStorage.setItem("lectern_classes_v1", JSON.stringify(myClasses)); } catch {} }, [myClasses, user]);

  // Load Supabase client from CDN when configured. Tests can pre-inject window.supabase.
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return; // local-only mode
    if (supabaseReady) return;
    const ready = () => {
      try {
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
        setSupabase(client);
        setSupabaseReady(true);
        client.auth.getSession().then(({ data }) => { if (data && data.session) setUser(data.session.user); });
        // Listen for all auth events. PASSWORD_RECOVERY fires when the user lands on the app via a
        // password-reset email link — Supabase has already created a temporary session at that point,
        // we just need to prompt them to set a new password.
        client.auth.onAuthStateChange((evt, session) => {
          setUser(session ? session.user : null);
          if (evt === "PASSWORD_RECOVERY") {
            showToast("Reset link verified — set a new password below");
            setChangePasswordDraft({ next: "", confirm: "", error: "", loading: false });
            setShowChangePassword(true);
          }
        });
      } catch (e) { logError(e, "supabase init"); }
    };
    if (window.supabase && window.supabase.createClient) { ready(); return; }
    if (document.querySelector('script[data-supabase]')) { return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.async = true; s.dataset.supabase = "1";
    s.onload = ready;
    s.onerror = () => logError(new Error("Failed to load Supabase SDK"), "supabase loader");
    document.head.appendChild(s);
  }, [supabaseReady]);

  // Auth helpers
  const signInWithPassword = async () => {
    if (!supabase) { setAuthError("Cloud sync isn't configured yet — see SETUP.md."); return; }
    setAuthLoading(true); setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authDraft.email.trim(), password: authDraft.password });
      if (error) throw error;
      setShowAuthModal(false); setAuthDraft({ mode: "signin", email: "", password: "" }); showToast("Signed in");
      track("action", "signed_in");
    } catch (e) { setAuthError(e.message || "Sign-in failed"); logError(e, "signInWithPassword"); }
    finally { setAuthLoading(false); }
  };
  const signUpWithPassword = async () => {
    if (!supabase) { setAuthError("Cloud sync isn't configured yet — see SETUP.md."); return; }
    setAuthLoading(true); setAuthError("");
    try {
      const { error } = await supabase.auth.signUp({ email: authDraft.email.trim(), password: authDraft.password });
      if (error) throw error;
      showToast("Check your email to confirm sign-up");
      setShowAuthModal(false); setAuthDraft({ mode: "signin", email: "", password: "" });
      track("action", "signed_up");
    } catch (e) { setAuthError(e.message || "Sign-up failed"); logError(e, "signUpWithPassword"); }
    finally { setAuthLoading(false); }
  };
  const signInWithMagicLink = async () => {
    if (!supabase) { setAuthError("Cloud sync isn't configured yet — see SETUP.md."); return; }
    if (!authDraft.email.trim()) { setAuthError("Enter your email first"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: authDraft.email.trim() });
      if (error) throw error;
      showToast(`Magic link sent to ${authDraft.email.trim()}`);
      setShowAuthModal(false); track("action", "magic_link_sent");
    } catch (e) { setAuthError(e.message || "Could not send link"); logError(e, "magicLink"); }
    finally { setAuthLoading(false); }
  };
  const signOut = async () => {
    if (!supabase) return;
    try { await supabase.auth.signOut(); showToast("Signed out"); track("action", "signed_out"); }
    catch (e) { logError(e, "signOut"); }
  };

  // ============ PASSWORD RESET — forgot-password flow ============
  // Sends a Supabase password-reset email to the user. They click the link in the email and
  // land on a Supabase-hosted reset page where they set a new password. The reset email is
  // generated by Supabase using the redirectTo URL (set to this app's origin so they bounce back
  // here after resetting).
  const sendPasswordReset = async () => {
    if (!supabase) { setAuthError("Backend unavailable — sign-in not configured"); return; }
    const email = authDraft.email.trim();
    if (!email || !email.includes("@")) { setAuthError("Enter a valid email above first"); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) { setAuthError(error.message); return; }
      showToast(`Password-reset email sent to ${email}. Check your inbox.`);
      setShowAuthModal(false);
      setAuthDraft({ mode: "signin", email: "", password: "" });
      track("action", "password_reset_requested");
    } catch (e) {
      setAuthError(e.message || "Could not send reset email");
      logError(e, "sendPasswordReset");
    } finally { setAuthLoading(false); }
  };

  // ============ CHANGE PASSWORD — signed-in user updates their password ============
  // For users who are already signed in (Supabase session active). Wraps supabase.auth.updateUser
  // with a new password value. Validates locally that the new password isn't trivially short.
  const changePassword = async (newPassword) => {
    if (!supabase) { return { ok: false, error: "Backend unavailable" }; }
    if (!user) { return { ok: false, error: "Not signed in" }; }
    if (!newPassword || newPassword.length < 8) { return { ok: false, error: "Password must be at least 8 characters" }; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      showToast("Password updated");
      track("action", "password_changed");
      return { ok: true };
    } catch (e) {
      logError(e, "changePassword");
      return { ok: false, error: e.message || "Could not update password" };
    }
  };

  // State for the change-password dialog inside Settings
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePasswordDraft, setChangePasswordDraft] = useState({ next: "", confirm: "", error: "", loading: false });

  // Pull profile + classes from cloud on sign-in
  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setSyncStatus("syncing");
        const { data, error } = await supabase.from("profiles").select("profile, classes").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data) {
          if (data.profile && typeof data.profile === "object") setPersistentProfile((p) => ({ ...p, ...data.profile }));
          if (Array.isArray(data.classes)) setMyClasses(data.classes);
        }
        setSyncStatus("synced");
      } catch (e) { setSyncStatus("error"); logError(e, "pull profile"); }
    })();
    return () => { cancelled = true; };
  }, [supabase, user]);

  // Push profile + classes to cloud (debounced) when signed in
  const lastPushRef = useRef({ profile: null, classes: null, t: 0 });
  useEffect(() => {
    if (!supabase || !user) return;
    const t = setTimeout(async () => {
      try {
        const payload = { user_id: user.id, profile: persistentProfile, classes: myClasses, updated_at: new Date().toISOString() };
        setSyncStatus("syncing");
        const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
        lastPushRef.current = { profile: persistentProfile, classes: myClasses, t: Date.now() };
        setSyncStatus("synced");
      } catch (e) { setSyncStatus("error"); logError(e, "push profile"); }
    }, 800);
    return () => clearTimeout(t);
  }, [supabase, user, persistentProfile, myClasses]);

  // ============ NOTEBOOK SYNC TO SUPABASE — per-source merge ============
  // Schema (run in your Supabase SQL editor):
  //   create table notebooks (
  //     id text primary key,
  //     user_id uuid references auth.users(id) on delete cascade,
  //     data jsonb not null,
  //     updated_at timestamptz default now()
  //   );
  //   alter table notebooks enable row level security;
  //   create policy "Users own their notebooks" on notebooks
  //     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  //
  // Each notebook is one row. The `data` column stores the full notebook object including
  // its sources array. The per-source merge happens client-side: when both local and remote
  // versions of the same source exist, the one with the higher updatedAt (or deletedAt) wins.

  // Merge a remote notebook into a local one. Returns the merged notebook.
  // Per-source: union by source.id, take whichever has higher max(updatedAt, deletedAt).
  // Notebook-level fields: whichever has higher updatedAt.
  const mergeNotebookPair = (local, remote) => {
    if (!local && !remote) return null;
    if (!local) return remote;
    if (!remote) return local;
    const localTs = local.updatedAt || 0, remoteTs = remote.updatedAt || 0;
    const baseLevel = localTs >= remoteTs ? local : remote;
    // Per-source merge
    const allIds = new Set([
      ...((local.sources || []).map((s) => s.id)),
      ...((remote.sources || []).map((s) => s.id)),
    ]);
    const localById = {}; (local.sources || []).forEach((s) => { localById[s.id] = s; });
    const remoteById = {}; (remote.sources || []).forEach((s) => { remoteById[s.id] = s; });
    const mergedSources = [];
    allIds.forEach((id) => {
      const ls = localById[id], rs = remoteById[id];
      if (!ls) { mergedSources.push(rs); return; }
      if (!rs) { mergedSources.push(ls); return; }
      // Both sides have this source — winner = higher of (updatedAt OR deletedAt)
      const lScore = Math.max(ls.updatedAt || 0, ls.deletedAt || 0);
      const rScore = Math.max(rs.updatedAt || 0, rs.deletedAt || 0);
      mergedSources.push(lScore >= rScore ? ls : rs);
    });
    return {
      ...baseLevel,
      sources: mergedSources,
      updatedAt: Math.max(localTs, remoteTs),
    };
  };

  const [notebookSyncStatus, setNotebookSyncStatus] = useState("idle"); // idle | syncing | synced | error

  // ============ SHAREABLE NOTEBOOK LINKS (Phase 1 — sign-in required) ============
  // Owner generates a share link → row created in shared_notebooks table with grant for the recipient(s).
  // Recipient (must be signed in) opens URL like /?share=<notebook_id> → app fetches & renders read-only.
  // SQL schema (run in Supabase):
  //   create table shared_notebooks (
  //     notebook_id text not null,
  //     owner_user_id uuid references auth.users(id) on delete cascade,
  //     shared_with_emails text[] default '{}',
  //     is_public boolean default false,
  //     created_at timestamptz default now(),
  //     primary key (notebook_id)
  //   );
  //   alter table shared_notebooks enable row level security;
  //   create policy "Owners manage shares" on shared_notebooks
  //     for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
  //   create policy "Grantees can read shares" on shared_notebooks
  //     for select using (
  //       auth.uid() = owner_user_id
  //       OR (auth.jwt() ->> 'email') = ANY(shared_with_emails)
  //     );
  //   -- Allow grantees to SELECT the notebook data row when they have a share grant:
  //   create policy "Read shared notebook data" on notebooks for select using (
  //     exists (select 1 from shared_notebooks s
  //       where s.notebook_id = notebooks.id
  //       and ((auth.jwt() ->> 'email') = ANY(s.shared_with_emails) or s.is_public))
  //   );
  const [shareNotebookId, setShareNotebookId] = useState(null);
  const [shareGrants, setShareGrants] = useState({}); // notebook_id -> { shared_with_emails, is_public }
  const [shareLoading, setShareLoading] = useState(false);
  const [shareGrantEmail, setShareGrantEmail] = useState("");
  const [viewingSharedNotebook, setViewingSharedNotebook] = useState(null); // remote notebook object when viewing via ?share=

  // Load existing grants for a notebook when share modal opens
  useEffect(() => {
    if (!supabase || !user || !shareNotebookId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("shared_notebooks")
          .select("notebook_id, shared_with_emails, is_public")
          .eq("notebook_id", shareNotebookId)
          .maybeSingle();
        if (error && error.code !== "PGRST116") throw error;
        if (data) {
          setShareGrants((g) => ({ ...g, [shareNotebookId]: { shared_with_emails: data.shared_with_emails || [], is_public: !!data.is_public } }));
        } else {
          setShareGrants((g) => ({ ...g, [shareNotebookId]: { shared_with_emails: [], is_public: false } }));
        }
      } catch (e) { logError(e, "load share grants"); }
    })();
  }, [supabase, user, shareNotebookId]);

  // Add an email to the share grant
  const addShareGrant = async (notebookId, email) => {
    if (!supabase || !user) { showToast("Sign in to share notebooks"); return; }
    const e = (email || "").trim().toLowerCase();
    if (!e || !/.+@.+\..+/.test(e)) { showToast("Enter a valid email address"); return; }
    setShareLoading(true);
    try {
      const cur = shareGrants[notebookId] || { shared_with_emails: [], is_public: false };
      if (cur.shared_with_emails.includes(e)) { showToast("Already shared with " + e); setShareLoading(false); return; }
      const updated = [...cur.shared_with_emails, e];
      const { error } = await supabase.from("shared_notebooks").upsert({
        notebook_id: notebookId,
        owner_user_id: user.id,
        shared_with_emails: updated,
        is_public: cur.is_public,
      }, { onConflict: "notebook_id" });
      if (error) throw error;
      setShareGrants((g) => ({ ...g, [notebookId]: { ...cur, shared_with_emails: updated } }));
      setShareGrantEmail("");
      showToast(`Shared with ${e}`);
      track("action", "notebook_share_add", {});
    } catch (e) { logError(e, "add share grant"); showToast("Failed to share — see console"); }
    finally { setShareLoading(false); }
  };

  const removeShareGrant = async (notebookId, email) => {
    if (!supabase || !user) return;
    setShareLoading(true);
    try {
      const cur = shareGrants[notebookId] || { shared_with_emails: [], is_public: false };
      const updated = cur.shared_with_emails.filter((x) => x !== email);
      const { error } = await supabase.from("shared_notebooks").upsert({
        notebook_id: notebookId,
        owner_user_id: user.id,
        shared_with_emails: updated,
        is_public: cur.is_public,
      }, { onConflict: "notebook_id" });
      if (error) throw error;
      setShareGrants((g) => ({ ...g, [notebookId]: { ...cur, shared_with_emails: updated } }));
      showToast(`Removed ${email}`);
    } catch (e) { logError(e, "remove share grant"); }
    finally { setShareLoading(false); }
  };

  // Handle ?share=<notebook_id> URL on load — fetch read-only and render
  useEffect(() => {
    if (!supabase || !user) return;
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (!shareId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("notebooks")
          .select("id, data")
          .eq("id", shareId)
          .maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          setViewingSharedNotebook(data.data);
          showToast(`Viewing shared notebook · ${data.data.name}`);
          track("event", "shared_notebook_opened", {});
        } else {
          showToast("Shared notebook not found or you don't have access");
        }
      } catch (e) {
        logError(e, "load shared notebook");
        showToast("Couldn't load shared notebook — make sure you're signed in with an invited email");
      }
    })();
  }, [supabase, user]);


  // Pull notebooks from cloud + merge on sign-in
  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setNotebookSyncStatus("syncing");
        const { data, error } = await supabase
          .from("notebooks")
          .select("id, data, updated_at")
          .eq("user_id", user.id);
        if (error) throw error;
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setNotebooks((prevLocal) => {
            const localById = {}; prevLocal.forEach((n) => { localById[n.id] = n; });
            const remoteById = {}; data.forEach((row) => { if (row.data) remoteById[row.id] = row.data; });
            const allIds = new Set([...Object.keys(localById), ...Object.keys(remoteById)]);
            const merged = [];
            allIds.forEach((id) => {
              const m = mergeNotebookPair(localById[id], remoteById[id]);
              if (m) merged.push(m);
            });
            return merged;
          });
        }
        setNotebookSyncStatus("synced");
      } catch (e) {
        setNotebookSyncStatus("error");
        logError(e, "pull notebooks");
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, user]);

  // Push notebooks to cloud — debounced 1.5s. Pushes only notebooks that changed since last push.
  const lastNotebookPushRef = useRef({}); // id -> last pushed updatedAt
  useEffect(() => {
    if (!supabase || !user) return;
    const t = setTimeout(async () => {
      try {
        setNotebookSyncStatus("syncing");
        const toUpsert = [];
        notebooks.forEach((n) => {
          const lastPushed = lastNotebookPushRef.current[n.id] || 0;
          if ((n.updatedAt || 0) > lastPushed) {
            toUpsert.push({
              id: n.id,
              user_id: user.id,
              data: n,
              updated_at: new Date(n.updatedAt || Date.now()).toISOString(),
            });
          }
        });
        if (toUpsert.length > 0) {
          const { error } = await supabase.from("notebooks").upsert(toUpsert, { onConflict: "id" });
          if (error) throw error;
          toUpsert.forEach((row) => { lastNotebookPushRef.current[row.id] = row.data.updatedAt || 0; });
        }
        setNotebookSyncStatus("synced");
      } catch (e) {
        setNotebookSyncStatus("error");
        logError(e, "push notebooks");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [supabase, user, notebooks]);


  // Class CRUD helpers
  const saveClass = () => {
    const name = classDraft.name.trim();
    if (!name) { showToast("Class needs a name"); return; }
    const notes = (classDraft.notes || "").trim();
    if (editingClassId) {
      setMyClasses((cs) => cs.map((c) => c.id === editingClassId ? { ...c, name, term: classDraft.term.trim(), color: classDraft.color, selfStudy: !!classDraft.selfStudy, notes } : c));
      showToast("Class updated");
    } else {
      setMyClasses((cs) => [...cs, { id: Date.now().toString(), name, term: classDraft.term.trim(), color: classDraft.color, selfStudy: !!classDraft.selfStudy, notes }]);
      showToast(classDraft.generateCurriculum ? "Class added — building study plan…" : "Class added");
    }
    // If the user asked to auto-generate a curriculum, jump to Tutor and dispatch curriculum mode.
    // This pre-fills the topic with the class name so they don't have to retype it.
    const shouldGenerate = classDraft.generateCurriculum && !editingClassId;
    setClassDraft({ name: "", term: "", color: "blue", selfStudy: false, generateCurriculum: false, notes: "" });
    setEditingClassId(null);
    track("action", editingClassId ? "class_updated" : "class_added", { generateCurriculum: shouldGenerate, selfStudy: classDraft.selfStudy, hasNotes: !!notes });
    if (shouldGenerate) {
      setTopic(name);
      setView("tutor");
      // Slight delay so the view transition completes before generation starts (avoids stale-state issues)
      setTimeout(() => generateContent("curriculum", name), 200);
    }
  };
  const deleteClass = (id) => {
    if (!confirm("Remove this class?")) return;
    setMyClasses((cs) => cs.filter((c) => c.id !== id));
    track("action", "class_deleted");
  };
  const editClass = (c) => { setEditingClassId(c.id); setClassDraft({ name: c.name, term: c.term || "", color: c.color || "blue", selfStudy: !!c.selfStudy, generateCurriculum: false, notes: c.notes || "" }); };

  const analyticsRef = useRef(analytics);
  analyticsRef.current = analytics;

  // Persist these three on change
  useEffect(() => { try { localStorage.setItem("lectern_feedback_v1", JSON.stringify(feedbackLog)); } catch {} }, [feedbackLog]);
  useEffect(() => { try { localStorage.setItem("lectern_analytics_v1", JSON.stringify(analytics)); } catch {} }, [analytics]);
  useEffect(() => { try { localStorage.setItem("lectern_errors_v1", JSON.stringify(errorLog)); } catch {} }, [errorLog]);

  // Track usage. Type: "mode" | "view" | "action". Name: free string.
  const track = (type, name, meta) => {
    if (!type || !name) return;
    setAnalytics((a) => {
      const totals = { ...a.totals, [type]: { ...(a.totals[type] || {}), [name]: ((a.totals[type] || {})[name] || 0) + 1 } };
      const events = [...a.events, { type, name, ts: Date.now(), ...(meta ? { meta } : {}) }].slice(-500);
      return { events, totals };
    });
  };

  const logError = (err, context) => {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? String(err.stack).slice(0, 800) : "";
    setErrorLog((l) => [{ id: Date.now() + Math.random(), ts: Date.now(), msg, stack, context: context || "" }, ...l].slice(0, 50));
  };

  // Global error capture for non-React errors (event handlers, async)
  useEffect(() => {
    const onErr = (e) => { logError(e.error || e.message || "Unknown error", "window.onerror"); };
    const onRej = (e) => { logError(e.reason || "Unhandled rejection", "unhandledrejection"); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);

  const submitFeedback = async () => {
    const d = feedbackDraft;
    if (!d.text.trim() && d.rating === null) { showToast("Add a rating or a message"); return; }
    const entry = {
      id: Date.now(), ts: Date.now(), rating: d.rating, category: d.category, text: d.text.trim(),
      context: d.includeContext ? { view, mode, topic: topic.slice(0, 60), recentErrors: errorLog.slice(0, 3).map((e) => e.msg) } : null,
    };
    setFeedbackLog((l) => [entry, ...l].slice(0, 200));
    setFeedbackDraft({ rating: null, category: "Suggestion", text: "", includeContext: true });
    setShowFeedback(false);

    // Write to Supabase feedback table when connected. The table is owner-readable only (RLS).
    // Anonymous inserts allowed so even non-signed-in users can submit. The deployer reads from
    // their Supabase dashboard → Table Editor → feedback.
    let supabaseWrote = false;
    if (supabase) {
      try {
        const payload = {
          user_email: user?.email || null,
          rating: d.rating === 1 ? "positive" : d.rating === -1 ? "negative" : d.rating === 0 ? "neutral" : null,
          category: d.category,
          message: d.text.trim() || null,
          context: entry.context,
          app_version: APP_VERSION,
          user_agent: navigator.userAgent.slice(0, 200),
        };
        const { error } = await supabase.from("feedback").insert(payload);
        if (error) {
          logError(error, "feedback insert");
        } else {
          supabaseWrote = true;
        }
      } catch (e) {
        logError(e, "feedback supabase write");
      }
    }

    if (supabaseWrote) {
      showToast("Thanks — feedback sent");
    } else if (ownerEmail) {
      sendFeedbackByEmail(entry); showToast(`Saved + opened email to ${ownerEmail}`);
    } else {
      showToast("Thanks — feedback saved locally (no Supabase connection)");
    }
    track("action", "feedback_submitted", { sent_to_supabase: supabaseWrote });
  };

  const rateGeneration = (verdict) => {
    if (!mode) return;
    const k = `${mode}::${(topic || "_").slice(0, 40)}`;
    setGenerationFeedback((m) => ({ ...m, [k]: verdict }));
    track("action", verdict === 1 ? "gen_thumbs_up" : "gen_thumbs_down", { mode });
    showToast(verdict === 1 ? "Thanks — noted as helpful" : "Thanks — noted as not helpful");
  };

  const exportData = () => {
    const data = { exportedAt: new Date().toISOString(), profile: persistentProfile, feedback: feedbackLog, analytics, errors: errorLog };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lectern-export-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Export downloaded");
    track("action", "export_data");
  };

  // --- Share-without-server: mailto report system ---
  const openMailto = (subject, body) => {
    if (!ownerEmail) return;
    const href = `mailto:${ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { window.open(href, "_self"); } catch {}
  };
  const buildContextLines = () => [
    `When: ${new Date().toISOString()}`,
    `View: ${view}${mode ? ` · mode: ${mode}` : ""}`,
    topic ? `Topic: ${topic.slice(0, 80)}` : null,
    `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "unknown"}`,
  ].filter(Boolean).join("\n");
  const sendFeedbackByEmail = (entry) => {
    if (!ownerEmail) { showToast("No owner email set"); return; }
    const ratingLabel = entry.rating === 1 ? "👍 Loved it" : entry.rating === -1 ? "👎 Not great" : "○ OK";
    const body = [
      `Study It feedback — ${entry.category}`,
      ``,
      `Rating: ${ratingLabel}`,
      ``,
      `Message:`,
      entry.text || "(none)",
      ``,
      `— context —`,
      buildContextLines(),
      entry.context ? `\nAttached context: ${JSON.stringify(entry.context, null, 2)}` : "",
    ].join("\n");
    openMailto(`[Study It feedback] ${entry.category}`, body);
    track("action", "feedback_emailed");
  };
  const sendErrorByEmail = (err) => {
    if (!ownerEmail) { showToast("No owner email set"); return; }
    const body = [
      `Study It error report`,
      ``,
      `Message: ${err.msg}`,
      `Source: ${err.context || "(none)"}`,
      `When: ${new Date(err.ts).toISOString()}`,
      ``,
      `— current context —`,
      buildContextLines(),
      ``,
      `— stack —`,
      err.stack || "(none)",
    ].join("\n");
    openMailto(`[Study It error] ${err.msg.slice(0, 60)}`, body);
    track("action", "error_emailed");
  };

  // --- StudyLoop: second brain, projects, habits, rewards ---
  // === Session log — REAL daily activity counts for the heatmap. Maps "YYYY-MM-DD" → number of generations that day.
  // Replaces the prior fake deterministic heatmap. Increments on every successful AI generation.
  const [sessionLog, setSessionLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_session_log_v1") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("lectern_session_log_v1", JSON.stringify(sessionLog)); } catch {}
  }, [sessionLog]);
  const logSessionToday = () => {
    const key = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setSessionLog((s) => ({ ...s, [key]: (s[key] || 0) + 1 }));
  };

  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectern_notes_v1") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("lectern_notes_v1", JSON.stringify(notes)); } catch {}
  }, [notes]);
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "", cls: "Biology" });
  const [showAddNote, setShowAddNote] = useState(false);
  const [studyTimeline, setStudyTimeline] = useState([]);
  const [brainConcepts, setBrainConcepts] = useState([]); // personal concept graph nodes
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [projectPlans, setProjectPlans] = useState({}); // idx -> plan text
  const [loadingProject, setLoadingProject] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [intention, setIntention] = useState("");
  const [intentionDraft, setIntentionDraft] = useState("");
  const [mnemonicTopic, setMnemonicTopic] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [connector, setConnector] = useState("");
  const [loadingConnector, setLoadingConnector] = useState(false);
  // Minimum viable session
  const [mvsActive, setMvsActive] = useState(false);
  const [mvsLeft, setMvsLeft] = useState(90);

  const addTimeline = (label) => setStudyTimeline((t) => [{ label, ts: Date.now() }, ...t].slice(0, 100));
  const addReward = (label) => setRewards((r) => [{ label, ts: Date.now() }, ...r].slice(0, 20));
  const addConcept = (c) => { if (c && !brainConcepts.includes(c)) setBrainConcepts((p) => [...p, c].slice(-24)); };

  // Personas
  const personas = {
    default: { name: "Friendly tutor", icon: "🎓", style: "warm, encouraging, conversational. Adapt to student's level." },
    professor: { name: "Strict professor", icon: "🎩", style: "formal, precise, demanding rigor. Expect proper terminology." },
    socratic: { name: "Socratic", icon: "🏛", style: "answer questions with questions. Guide the student to discover the answer themselves." },
    enthusiast: { name: "Excited postdoc", icon: "⚡", style: "genuinely fascinated. Make connections to cutting-edge research." },
    grandma: { name: "Patient grandparent", icon: "🧶", style: "endlessly patient. Cozy, homely analogies. Reassure when the student doubts themselves." },
    coach: { name: "Sports coach", icon: "🏆", style: "direct, motivational. Frame learning as training. Celebrate effort." },
    duck: { name: "Rubber duck", icon: "🦆", style: "mostly listen. Occasionally ask 'wait, why?' Help the student think out loud." },
  };

  const difficultyGuide = {
    elementary: "elementary school (K-5, ages 5-11) — simple, friendly language with concrete examples kids relate to (toys, animals, food, family, sports). Define new words. Keep sentences short.",
    middle: "middle school (6-8, ages 11-14) — clear language with some vocabulary introduced. Relatable examples (sports, games, school). Mix recall with 'why' and 'how' questions.",
    easy: "high school / intro undergrad — definitions, key facts, and core concepts (Bloom levels 1-2)",
    medium: "undergraduate — applying concepts, comparing/contrasting, explaining mechanisms (Bloom levels 3-4)",
    hard: "advanced undergrad — edge cases, multi-step reasoning, critique, cross-domain connections (Bloom levels 5-6)",
    expert: "graduate-level — rigorous derivations, nuanced trade-offs, seminal results, novel problems",
    phd: "research-level — qualifying-exam depth, awareness of open problems, methodological critique",
    frontier: "research-frontier — open problems, contested results, recent (1-3yr) literature, treat student as peer researcher",
  };


  // ============ CLAUDE API ============
  /**
   * Central AI dispatcher. Routes a prompt to either Cloud AI (Anthropic API direct from browser)
   * or Local AI (WebGPU via WebLLM) based on aiProvider state, applying the user's Quality Studio
   * settings (model, thinking budget, web search uses, multi-agent, verification).
   *
   * @param {string} prompt - The user-facing prompt to send to the model
   * @param {string} systemPrompt - System instructions (typically built from baseEnd + mode-specific clauses)
   * @param {boolean} useMaterials - Whether to attach uploaded images/PDFs to the request
   * @param {object} opts - Per-call overrides
   * @param {boolean} opts.streaming - Stream tokens back via onTokenCb (used by audio/briefing/explain modes)
   * @param {function} opts.onTokenCb - Called per-token during streaming
   * @param {number} opts.thinkingBudget - Override the Quality Studio thinking budget
   * @param {number} opts.webSearchUses - Override the Quality Studio web search budget
   * @param {boolean} opts.webSearch - For local model only, gate web search injection
   * @param {Array<File>} opts.pdfs - PDF files (processed into text or vision images before sending)
   * @returns {Promise<string>} The model's response text (full content, post-streaming if applicable)
   */
  const callClaude = async (prompt, systemPrompt, useMaterials = false, opts = {}) => {
    // Provider switch — local WebGPU model handles simpler requests when user opts in.
    if (aiProvider === "webllm") {
      // Auto-detect structured-output intent — if the prompt asks for JSON, enable JSON mode
      // so the local model produces parseable output instead of prose-with-an-attempt-at-JSON.
      const wantsJson = /Respond ONLY with valid JSON|JSON: ?\{|response_format.*json/i.test(prompt + systemPrompt);
      // Per-mode temperature — inferred from prompt content. Deterministic for assessments, creative for cards.
      let inferredTemp = opts.temperature;
      if (typeof inferredTemp !== "number") {
        if (/MCQ|multiple choice|exam question|practice quiz/i.test(prompt + systemPrompt)) inferredTemp = 0.3;
        else if (/flashcard|brainstorm|creative|examples?/i.test(prompt + systemPrompt)) inferredTemp = 0.8;
        else inferredTemp = 0.65;
      }
      // Pass images to local vision models when materials are involved.
      // PDFs are still Claude-only — no PDF-document protocol exists for WebLLM.
      const modelIsVision = LOCAL_MODELS[localModel]?.tier === "vision";
      let imagesForLocal = (useMaterials && modelIsVision && images.length > 0) ? [...images] : [];

      // ============ SMOLVLM VISION FALLBACK ============
      // If the user has images but the local model isn't vision-capable, AND SmolVLM is loaded,
      // describe the images via SmolVLM and inject the description into the system prompt as text.
      // This bridges images into text-only local models (e.g. Llama 3.2 1B can now "see" images).
      let augmentedSystem = systemPrompt;
      if (useMaterials && !modelIsVision && images.length > 0 && smolVLMLoaded) {
        try {
          showToast("Describing images with SmolVLM…");
          const desc = await describeImagesWithSmolVLM(images, topic || prompt.slice(0, 120));
          if (desc) {
            augmentedSystem = `${systemPrompt}\n\n[Image content described by local vision model — quality may vary]:\n${desc}\n\n[End of image descriptions]`;
          }
        } catch (e) {
          logError(e, "smolvlm describe in callClaude");
          // Continue without image context rather than failing the whole generation
        }
      }

      // ============ PDF PROCESSING FOR LOCAL MODEL ============
      // Bridges the gap: extract text (pdf.js) and inject as system-prompt block; for scanned PDFs
      // with a vision-tier model, rasterize pages and add them to images. Honest fallback otherwise.
      // (augmentedSystem already declared above for SmolVLM vision fallback — reusing it here)
      if (useMaterials && pdfs.length > 0) {
        showToast(`Processing ${pdfs.length} PDF${pdfs.length === 1 ? "" : "s"} for local model…`);
        try {
          const { textBlocks, visionImages } = await processPdfsForLocal(pdfs, modelIsVision);
          // Inject text content into system prompt (cap each PDF at ~8000 chars for local context window)
          if (textBlocks.length > 0) {
            const pdfSection = textBlocks.map((b) => {
              const truncated = b.text.length > 8000 ? b.text.slice(0, 8000) + "\n[…truncated — local model context window]" : b.text;
              return `--- PDF: ${b.name} (${b.pages} page${b.pages === 1 ? "" : "s"}, ${b.extractMode} mode) ---\n${truncated}`;
            }).join("\n\n");
            augmentedSystem = (augmentedSystem || "") + `\n\nPDF DOCUMENTS (attached by user):\n\n${pdfSection}\n\nEND PDF DOCUMENTS.\n\n`;
          }
          // Add rasterized pages to vision model input
          if (visionImages.length > 0) {
            imagesForLocal = [...imagesForLocal, ...visionImages];
          }
          // Status toast — tell user honestly what happened
          const textCount = textBlocks.filter((b) => b.extractMode === "text").length;
          const visionCount = textBlocks.filter((b) => b.extractMode === "vision").length;
          const unreadable = textBlocks.filter((b) => b.extractMode === "unreadable" || b.extractMode === "error").length;
          const parts = [];
          if (textCount) parts.push(`${textCount} extracted as text`);
          if (visionCount) parts.push(`${visionCount} via vision (${visionImages.length} page${visionImages.length === 1 ? "" : "s"})`);
          if (unreadable) parts.push(`${unreadable} unreadable`);
          if (parts.length) showToast(`PDFs: ${parts.join(", ")}`);
        } catch (e) {
          logError(e, "process PDFs for local");
          showToast("PDF processing failed — see console");
        }
      }

      // ============ WEB SEARCH FOR LOCAL MODEL ============
      // When caller wants web grounding AND the user has configured a search endpoint, run the search
      // through their proxy first, then inject results into the system prompt as [W1] [W2] blocks.
      // This is what makes lateral-reading actually work on local model.
      if (opts.webSearch && persistentProfile.localSearchEndpoint) {
        const searchCount = Math.max(1, Math.min(8, opts.searchUses || 4));
        // Derive a search query from the prompt: use the prompt itself, trimmed.
        const searchQuery = String(prompt).slice(0, 200);
        showToast(`Searching the web for: ${searchQuery.slice(0, 60)}…`);
        const { results, error } = await localWebSearch(searchQuery, searchCount);
        if (!error && results.length > 0) {
          augmentedSystem = (augmentedSystem || "") + formatSearchResultsForPrompt(results);
          showToast(`Found ${results.length} web result${results.length === 1 ? "" : "s"} — grounding local model`);
        } else if (error === "no_endpoint") {
          // Silent: user hasn't configured search; just skip
        } else {
          showToast(`Web search failed (${error || "no results"}) — local model running without web grounding`);
        }
      }

      return await callWebllm(prompt, augmentedSystem, {
        ...opts,
        jsonMode: opts.jsonMode ?? wantsJson,
        temperature: inferredTemp,
        images: imagesForLocal.length > 0 ? imagesForLocal : undefined,
      });
    }
    const userContent = [];
    if (useMaterials) {
      images.forEach((img) => {
        userContent.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
      });
      pdfs.forEach((pdf) => {
        userContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.data } });
      });
      const textBlocks = [];
      textDocs.forEach((doc) => textBlocks.push(`--- Document: ${doc.name} ---\n${doc.content}`));
      if (pastedText.trim()) textBlocks.push(`--- Pasted notes ---\n${pastedText.trim()}`);
      if (textBlocks.length > 0) userContent.push({ type: "text", text: textBlocks.join("\n\n") });
    }
    userContent.push({ type: "text", text: prompt });

    const messages = opts.messages || [{ role: "user", content: userContent }];
    const body = {
      model: opts.model || aiSettings.model || "claude-opus-4-7", max_tokens: opts.maxTokens || 2000,
      system: systemPrompt, messages,
    };
    if (opts.thinking) {
      const budget = opts.thinkingBudget || 8000;
      body.thinking = { type: "enabled", budget_tokens: budget };
      body.max_tokens = Math.max(body.max_tokens, budget + 2000);
      body.temperature = 1;
    }
    if (opts.webSearch) {
      body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: opts.searchUses || 4 }];
    }

    // Track call timing for the Diagnostics panel
    const callStart = Date.now();
    const inputCharsEstimate = (systemPrompt || "").length + JSON.stringify(messages).length;

    // ============ STREAMING PATH (opt-in via opts.stream) ============
    // Anthropic SSE: server sends `event: content_block_delta` with `data: {"type":"content_block_delta",
    // "delta":{"type":"text_delta","text":"..."}}`. We accumulate text and call opts.onChunk with each delta.
    // Tool-use loops (web search) are NOT streamed — they fall back to the non-streaming path automatically.
    if (opts.stream && !opts.webSearch && typeof opts.onChunk === "function") {
      body.stream = true;
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: _claudeHeaders(),
          body: JSON.stringify(body),
        });
        if (response.status === 401 || response.status === 403) {
          logApiCall({ inputChars: inputCharsEstimate, latencyMs: Date.now() - callStart, model: body.model, error: "401/403 auth" });
          throw new Error("Anthropic API key missing or invalid.");
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          logApiCall({ inputChars: inputCharsEstimate, latencyMs: Date.now() - callStart, model: body.model, error: `HTTP ${response.status}` });
          throw new Error(`Anthropic API returned ${response.status}: ${text.slice(0, 200)}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "", fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line for next iteration
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                fullText += evt.delta.text;
                opts.onChunk(evt.delta.text, fullText);
              }
            } catch {} // ignore malformed event lines
          }
        }
        logApiCall({ inputChars: inputCharsEstimate, outputChars: fullText.length, latencyMs: Date.now() - callStart, model: body.model });
        return fullText.replace(/```json|```/g, "").trim();
      } catch (e) {
        logError(e, "stream callClaude");
        throw e;
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: _claudeHeaders(),
      body: JSON.stringify(body),
    });
    if (response.status === 401 || response.status === 403) {
      logApiCall({ inputChars: inputCharsEstimate, latencyMs: Date.now() - callStart, model: body.model, error: "401/403 auth" });
      throw new Error("Anthropic API key missing or invalid. Open Settings → AI Provider and paste a valid key.");
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logApiCall({ inputChars: inputCharsEstimate, latencyMs: Date.now() - callStart, model: body.model, error: `HTTP ${response.status}` });
      throw new Error(`Anthropic API returned ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    let finalData = data;
    let loopMessages = [...messages, { role: "assistant", content: data.content }];
    let safety = 0;
    while (finalData.stop_reason === "tool_use" && safety < 6) {
      safety++;
      const toolUses = (finalData.content || []).filter(b => b.type === "tool_use");
      if (toolUses.length === 0) break;
      const toolResults = toolUses.map(tu => ({
        type: "tool_result", tool_use_id: tu.id, content: "Search completed.",
      }));
      loopMessages.push({ role: "user", content: toolResults });
      const followUp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: _claudeHeaders(),
        body: JSON.stringify({ ...body, messages: loopMessages }),
      });
      if (!followUp.ok) break;
      finalData = await followUp.json();
      loopMessages.push({ role: "assistant", content: finalData.content });
    }

    const collectedSources = [];
    loopMessages.forEach(m => {
      if (m.role !== "assistant") return;
      (m.content || []).forEach(b => {
        if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          b.content.forEach(r => {
            if (r.url && !collectedSources.find(s => s.url === r.url)) {
              collectedSources.push({ url: r.url, title: r.title || r.url });
            }
          });
        }
      });
    });
    if (collectedSources.length > 0) {
      setSources(prev => {
        const merged = [...prev];
        collectedSources.forEach(s => { if (!merged.find(m => m.url === s.url)) merged.push(s); });
        return merged;
      });
    }
    const text = (finalData.content || []).filter(b => b.type === "text").map(b => b.text || "").join("\n");
    // Log the successful call with latency + estimated tokens
    logApiCall({ inputChars: inputCharsEstimate, outputChars: text.length, latencyMs: Date.now() - callStart, model: body.model });
    return text.replace(/```json|```/g, "").trim();
  };

  const safeParseJSON = async (text, schemaHint) => {
    let cleaned = text.replace(/```json\s*|```/g, "").trim();
    try { return JSON.parse(cleaned); } catch {}
    const firstBrace = cleaned.search(/[\{\[]/);
    const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try { return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)); } catch {}
    }
    try {
      const repaired = await callClaude(
        `Repair this malformed JSON${schemaHint ? ` (schema: ${schemaHint})` : ""}. Return ONLY valid JSON:\n\n${cleaned.slice(0, 8000)}`,
        "You repair malformed JSON. Output ONLY valid JSON.", false, { maxTokens: 4000 }
      );
      return JSON.parse(repaired.replace(/```json\s*|```/g, "").trim());
    } catch { throw new Error("Could not parse generated content as JSON"); }
  };

  // ============ MATERIAL HANDLERS ============
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataURL = ev.target.result;
        // If preprocessing is enabled, run a contrast/sharpen pass on a canvas before storing.
        // This genuinely helps faint pencil and low-contrast photos. Does NOT alter the preview thumbnail
        // (we keep the original preview so the user sees what they took) — only the data sent to Claude.
        if (enhanceContrast) {
          preprocessImageForOCR(dataURL).then((processed) => {
            const base64 = processed.split(",")[1];
            setImages((prev) => [...prev, { data: base64, mediaType: "image/jpeg", preview: dataURL, preprocessed: true }]);
          }).catch(() => {
            // Fallback to raw if preprocessing fails
            const base64 = dataURL.split(",")[1];
            setImages((prev) => [...prev, { data: base64, mediaType: file.type, preview: dataURL }]);
          });
        } else {
          const base64 = dataURL.split(",")[1];
          setImages((prev) => [...prev, { data: base64, mediaType: file.type, preview: dataURL }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // ============ IMAGE PREPROCESSING for OCR ============
  // Three variants generated from each upload — Claude sees all three in one call and picks the strongest
  // reading per word. Variants:
  //   ORIGINAL:  scaled-only (preserves continuous tone — best on already-clean photos)
  //   ENHANCED:  grayscale-lean + S-curve contrast + unsharp mask (best on most everyday photos)
  //   BINARIZED: Otsu adaptive threshold to pure black/white (best on faint pencil & low-contrast)
  const preprocessImageForOCR = (srcDataUrl, variant = "enhanced") => new Promise((resolve, reject) => {
    try {
      // Use createImageBitmap with imageOrientation: "from-image" so EXIF orientation is auto-applied.
      // Phone photos often have EXIF rotation metadata — without this, a sideways photo stays sideways
      // when drawn to canvas, which devastates OCR. Fall back to <img> if createImageBitmap unavailable.
      const drawAndProcess = (bitmap) => {
        try {
          const maxDim = 2000;
          let width = bitmap.width, height = bitmap.height;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale); height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, width, height);
          processCanvas(canvas, ctx, width, height, variant, resolve, reject);
        } catch (e) { reject(e); }
      };
      if (typeof createImageBitmap === "function") {
        fetch(srcDataUrl).then((r) => r.blob()).then((blob) => {
          createImageBitmap(blob, { imageOrientation: "from-image" }).then(drawAndProcess).catch((e) => {
            // Fall back to <img> path
            fallbackImg();
          });
        }).catch(fallbackImg);
      } else {
        fallbackImg();
      }
      function fallbackImg() {
        const img = new Image();
        img.onload = () => drawAndProcess(img);
        img.onerror = reject;
        img.src = srcDataUrl;
      }
    } catch (e) { reject(e); }
  });

  // Extracted from preprocessImageForOCR so the EXIF-aware bitmap path and the fallback <img> path share it
  const processCanvas = (canvas, ctx, width, height, variant, resolve, reject) => {
    try {
          if (variant === "original") {
            resolve(canvas.toDataURL("image/jpeg", 0.95)); return;
          }
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          const N = d.length / 4;
          // Compute grayscale luma channel
          const luma = new Uint8ClampedArray(N);
          let sum = 0;
          for (let i = 0, j = 0; i < d.length; i += 4, j++) {
            const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            luma[j] = y; sum += y;
          }
          const mean = sum / N;

          if (variant === "binarized") {
            // ============ OTSU'S METHOD — adaptive threshold ============
            // Find the threshold that maximizes between-class variance. Standard algorithm.
            const hist = new Uint32Array(256);
            for (let j = 0; j < N; j++) hist[luma[j]]++;
            let total = N, sumAll = 0;
            for (let t = 0; t < 256; t++) sumAll += t * hist[t];
            let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
            for (let t = 0; t < 256; t++) {
              wB += hist[t];
              if (wB === 0) continue;
              const wF = total - wB;
              if (wF === 0) break;
              sumB += t * hist[t];
              const mB = sumB / wB;
              const mF = (sumAll - sumB) / wF;
              const between = wB * wF * (mB - mF) * (mB - mF);
              if (between > maxVar) { maxVar = between; threshold = t; }
            }
            // Apply threshold + slight dilation for thin pencil strokes
            for (let i = 0, j = 0; i < d.length; i += 4, j++) {
              const v = luma[j] < threshold ? 0 : 255;
              d[i] = d[i + 1] = d[i + 2] = v;
            }
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.95)); return;
          }

          // ============ ENHANCED variant: grayscale-lean + S-curve + unsharp mask ============
          // S-curve contrast around mean
          const factor = 1.4;
          const enhanced = new Uint8ClampedArray(N);
          for (let j = 0; j < N; j++) {
            const v = 0.7 * luma[j] + 0.3 * luma[j]; // grayscale lean (effectively pure gray)
            const delta = v - mean;
            enhanced[j] = Math.max(0, Math.min(255, mean + delta * factor));
          }
          // Unsharp mask: 3x3 box blur, then sharpen = enhanced + amount * (enhanced - blurred)
          const blurred = new Uint8ClampedArray(N);
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              let acc = 0, count = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) { acc += enhanced[ny * width + nx]; count++; }
                }
              }
              blurred[y * width + x] = acc / count;
            }
          }
          const amount = 1.2;
          for (let i = 0, j = 0; i < d.length; i += 4, j++) {
            const sharp = Math.max(0, Math.min(255, enhanced[j] + amount * (enhanced[j] - blurred[j])));
            d[i] = d[i + 1] = d[i + 2] = sharp;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (e) { reject(e); }
  };

  // ============ POWER OCR — multi-variant + frontier model + focused refinement ============
  // Pipeline:
  //   1. Generate 3 preprocessed variants of each image (original, enhanced, binarized)
  //   2. CALL 1: send all variants to Opus 4.8 (frontier) in one message — model reconciles across variants
  //   3. CALL 2: focused refinement on uncertain words, sending original image + the surrounding context + domain hint
  //   4. Final transcript with confidence + uncertainty list + side-by-side editable view
  const runHandwritingOCR = async () => {
    if (!images.length) { showToast("Upload an image first"); return; }
    setOcrLoading(true); setOcrResult(null);
    try {
      // STAGE 1: build the 3 preprocessed variants for every uploaded image
      setOcrPassStatus("Stage 1/3 · Preprocessing image variants (original / enhanced / Otsu-binarized)…");
      const variantBundles = [];
      for (const img of images) {
        const previewUrl = img.preview;
        const [origUrl, enhancedUrl, binarizedUrl] = await Promise.all([
          preprocessImageForOCR(previewUrl, "original"),
          preprocessImageForOCR(previewUrl, "enhanced"),
          preprocessImageForOCR(previewUrl, "binarized"),
        ]);
        variantBundles.push({
          original: origUrl.split(",")[1],
          enhanced: enhancedUrl.split(",")[1],
          binarized: binarizedUrl.split(",")[1],
        });
      }

      // STAGE 2: send all variants to Opus 4.8 in one message — model reads across all 3 lenses
      setOcrPassStatus("Stage 2/3 · Frontier model reading across all 3 image variants…");
      const domainLine = ocrDomain.trim() ? `\n\nDOMAIN CONTEXT: ${ocrDomain.trim()} — use this to disambiguate ambiguous words. Words that fit this domain are more likely correct.` : "";
      const sys1 = `You are a world-class handwriting transcriber. You are seeing THREE preprocessed variants of the SAME handwritten image — the original photo, a contrast-enhanced/sharpened version, and an Otsu-binarized (pure black/white) version optimized for faint pencil. Each variant may reveal letters/words the others miss.${domainLine}

Read across ALL THREE variants. Where variants disagree, pick the most plausible reading. Be meticulous:

RULES:
1. Transcribe EVERY word you can see, in order, preserving line breaks and paragraph structure.
2. High-confidence words: write them plainly.
3. UNCERTAIN words: write them as "best-guess[alt1/alt2]" — best guess immediately followed by 1-2 alternatives in brackets.
4. Genuinely illegible: write "[illegible]" but try hard before giving up — check all three variants.
5. Crossed-out text: render as ~~struck~~. Insertions / carets: ^inserted^.
6. Math expressions: render in LaTeX ($...$ for inline, $$...$$ for display).
7. Symbols, arrows, diagrams: describe in [square brackets] like [arrow→] [box with X inside].
8. Pay extra attention to commonly confused pairs: a/o, e/c, n/u, r/s, t/f, i/l, 1/l/I, 0/O/Q, 5/S, 6/G, 9/q.

Respond ONLY with valid JSON: { "transcript": "full transcription", "uncertainCount": N, "writingQuality": "neat|legible|messy|barely-legible|illegible", "notes": "observations about page condition, ink type, layout, ambiguity sources" }`;
      const messages1 = [{
        role: "user",
        content: [
          ...variantBundles.flatMap((v) => [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: v.original } },
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: v.enhanced } },
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: v.binarized } },
          ]),
          { type: "text", text: "Transcribe the handwritten content. Read all 3 variants of each page. Be meticulous." },
        ],
      }];
      const text1 = await callClaude("", sys1, false, {
        messages: messages1,
        model: "claude-opus-4-8", // FORCE frontier vision model regardless of user preset
        maxTokens: 6000,
      });
      const pass1 = await safeParseJSON(text1) || { transcript: text1, uncertainCount: 0, writingQuality: "unknown", notes: "" };

      // STAGE 3: focused refinement on uncertain regions
      setOcrPassStatus("Stage 3/3 · Focused refinement on uncertain words (frontier model)…");
      // Extract uncertain words from pass1 transcript (matches "word[alt1/alt2]" or [illegible])
      const uncertainMatches = (pass1.transcript || "").match(/[\w'-]+\[[^\]]+\]|\[illegible\]/g) || [];
      const uncertainList = uncertainMatches.slice(0, 30);

      let finalTranscript = pass1.transcript;
      let finalUncertain = uncertainList;
      let finalConfidence = pass1.writingQuality === "neat" || pass1.writingQuality === "legible" ? "high" : pass1.writingQuality === "messy" ? "medium" : "low";

      if (uncertainList.length > 0) {
        const sys2 = `You previously transcribed a handwritten image. Here is the current best transcript:\n\n---\n${pass1.transcript}\n---\n\n${uncertainList.length} words remain uncertain (shown as best-guess[alternatives] or [illegible]):\n${uncertainList.join("  ")}${domainLine}\n\nLook at the ORIGINAL image again. For each uncertain word, decide the most likely reading based on:\n  • What you see directly in the handwriting\n  • What fits the surrounding context and domain\n  • Common spelling patterns\n\nProduce a refined transcript. Replace each uncertain word with your final choice. If still genuinely uncertain after this second look, mark with [?] suffix (no alternatives). Respond ONLY with valid JSON: { "final": "refined transcript", "confidence": "high|medium|low", "uncertainWords": ["words you still can't pin down"], "notes": "final observations" }`;
        const messages2 = [{
          role: "user",
          content: [
            // Send only the original image for the refinement pass (less distracting)
            ...variantBundles.map((v) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: v.original } })),
            { type: "text", text: "Refine the transcript based on a fresh look at the original image and the uncertainty list." },
          ],
        }];
        const text2 = await callClaude("", sys2, false, {
          messages: messages2,
          model: "claude-opus-4-8",
          maxTokens: 6000,
        });
        const pass2 = await safeParseJSON(text2) || {};
        if (pass2.final) {
          finalTranscript = pass2.final;
          finalUncertain = pass2.uncertainWords || [];
          finalConfidence = pass2.confidence || finalConfidence;
        }
      }

      setOcrResult({
        transcript: finalTranscript,
        confidence: finalConfidence,
        uncertainWords: finalUncertain,
        notes: pass1.notes || "",
        writingQuality: pass1.writingQuality || "unknown",
        editable: finalTranscript, // mutable copy for the side-by-side editor
        domain: ocrDomain,
        variantsUsed: 3 * images.length,
      });
      setOcrPassStatus("");
      track("action", "ocr_power", { variants: 3, images: images.length });
    } catch (e) {
      logError(e, "handwriting OCR power mode");
      showToast("Transcription failed — try again with better lighting or a closer photo");
      setOcrPassStatus("");
    } finally {
      setOcrLoading(false);
    }
  };

  // ============ PDF TEXT EXTRACTION (lazy-loaded pdf.js) ============
  // Two strategies for PDFs:
  //   (a) Send as-is to Claude vision (expensive per page, works on scanned PDFs)
  //   (b) Extract text client-side with pdf.js, send only the text (cheap, fast for text-based PDFs)
  // pdf.js is loaded from CDN on first use (~1.5MB), cached after.
  const extractPdfText = async (file) => {
    if (!window.pdfjsLib) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js");
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
      }
    }
    if (!window.pdfjsLib) throw new Error("pdf.js failed to load");
    const arrayBuf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const numPages = pdf.numPages;
    const pageTexts = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(" ");
      pageTexts.push(text.trim());
    }
    return { numPages, text: pageTexts.join("\n\n"), perPage: pageTexts };
  };

  // ============ LOCAL-MODEL PDF SUPPORT (Bucket C fix #2) ============
  // Bridges the gap: WebLLM has no PDF document-block protocol. So when a PDF is uploaded and the
  // user is on local AI, we either (a) extract its text via pdf.js and inject as text, or (b) if it's
  // a scanned PDF (no extractable text) AND the loaded model is vision-capable, rasterize pages to
  // images and pass those instead. If neither path works, we tell the user honestly.

  // Convert a base64 string back into a File object so pdf.js can read it.
  const base64ToFile = (base64, name, mimeType = "application/pdf") => {
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return new File([bytes], name || "document.pdf", { type: mimeType });
  };

  // Render a single PDF page to a base64 PNG via canvas. scale=1.5 trades quality vs file size —
  // legible enough for vision models to OCR printed text, small enough to fit in context.
  const pdfPageToBase64Image = async (pdf, pageNum, scale = 1.5) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    // White background — most PDFs have transparent canvas, vision models prefer opaque
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    return { data: dataUrl.split(",")[1], mediaType: "image/png" };
  };

  // Process the PDFs array for local-model consumption. Returns text blocks (to inject into the
  // system prompt) and vision-page images (to add to the user message for vision-tier models).
  const processPdfsForLocal = async (pdfsArray, modelIsVision) => {
    const textBlocks = [];
    const visionImages = [];
    const MAX_VISION_PAGES_PER_PDF = 4; // Cap to avoid context blowup
    const TEXT_EXTRACT_MIN_CHARS = 200;  // Below this, treat as "scanned" and fall back to vision

    for (const pdfRecord of pdfsArray) {
      try {
        const file = base64ToFile(pdfRecord.data, pdfRecord.name);
        const extracted = await extractPdfText(file);
        if (extracted.text.length >= TEXT_EXTRACT_MIN_CHARS) {
          // Text-based PDF (academic papers, business docs, articles) — text extraction works
          textBlocks.push({
            name: pdfRecord.name,
            text: extracted.text,
            pages: extracted.numPages,
            extractMode: "text",
          });
        } else if (modelIsVision) {
          // Scanned PDF + vision-capable local model — rasterize first N pages
          const arrayBuf = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
          const pageCount = Math.min(MAX_VISION_PAGES_PER_PDF, pdf.numPages);
          for (let i = 1; i <= pageCount; i++) {
            const img = await pdfPageToBase64Image(pdf, i);
            visionImages.push({ ...img, sourcePdf: pdfRecord.name, page: i });
          }
          textBlocks.push({
            name: pdfRecord.name,
            text: `[Scanned PDF — rasterized first ${pageCount} of ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"} for the vision model to read]`,
            pages: pdf.numPages,
            extractMode: "vision",
          });
        } else {
          // Scanned PDF + non-vision local model — honest fail
          textBlocks.push({
            name: pdfRecord.name,
            text: `[Unreadable PDF: text extraction failed and the loaded local model is not vision-capable. Switch to the Phi-3.5-vision model (Settings → AI Provider) to read scanned PDFs, or use Cloud AI.]`,
            pages: extracted.numPages || 0,
            extractMode: "unreadable",
          });
        }
      } catch (e) {
        logError(e, `process PDF ${pdfRecord.name}`);
        textBlocks.push({
          name: pdfRecord.name,
          text: `[Failed to read PDF: ${e.message}]`,
          pages: 0,
          extractMode: "error",
        });
      }
    }
    return { textBlocks, visionImages };
  };

  // ============ BULK IMPORT (zip + multi-file) ============
  // Returns array of {name, content, type} source records suitable for addSourceToNotebook.
  // Supports .txt/.md/.rtf (read as text), .pdf (extract via pdf.js), .docx (via mammoth), .zip (recurse).
  const bulkImportFile = async (file) => {
    const name = file.name.toLowerCase();

    if (name.endsWith(".zip")) {
      if (!window.JSZip) {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
      }
      if (!window.JSZip) throw new Error("JSZip failed to load");
      const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
      const sources = [];
      const entries = Object.values(zip.files).filter((f) => !f.dir);
      for (const entry of entries) {
        const fname = entry.name.toLowerCase();
        if (fname.startsWith("__macosx") || fname.split("/").pop().startsWith(".")) continue;
        try {
          if (fname.endsWith(".txt") || fname.endsWith(".md") || fname.endsWith(".rtf")) {
            const text = await entry.async("string");
            if (text.trim()) sources.push({ name: entry.name.split("/").pop(), content: text, type: "text" });
          } else if (fname.endsWith(".pdf")) {
            const blob = await entry.async("blob");
            const wrappedFile = new File([blob], entry.name.split("/").pop(), { type: "application/pdf" });
            try {
              const extracted = await extractPdfText(wrappedFile);
              if (extracted.text.length > 100) {
                sources.push({ name: wrappedFile.name, content: extracted.text, type: "pdf-text" });
              }
            } catch {}
          } else if (fname.endsWith(".docx")) {
            const buf = await entry.async("arraybuffer");
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ arrayBuffer: buf });
            if (result.value?.trim()) sources.push({ name: entry.name.split("/").pop(), content: result.value, type: "text" });
          }
        } catch (err) {
          logError(err, `zip entry: ${entry.name}`);
        }
      }
      return sources;
    }

    if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".rtf")) {
      const text = await file.text();
      if (text.trim()) return [{ name: file.name, content: text, type: "text" }];
      return [];
    }
    if (name.endsWith(".pdf")) {
      const extracted = await extractPdfText(file);
      if (extracted.text.length > 100) return [{ name: file.name, content: extracted.text, type: "pdf-text" }];
      throw new Error("PDF appears scanned/image-only — upload as image instead.");
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (result.value?.trim()) return [{ name: file.name, content: result.value, type: "text" }];
      return [];
    }
    throw new Error(`Unsupported file type: ${file.name}`);
  };

  const handlePdfUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(async (file) => {
      // Try text extraction first (cheap). If yield is < 100 chars, fall back to vision.
      // Hold Shift while uploading to force vision mode.
      const forceVision = e.nativeEvent && e.nativeEvent.shiftKey;
      if (forceVision) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result.split(",")[1];
          setPdfs((prev) => [...prev, { data: base64, name: file.name, mode: "vision" }]);
        };
        reader.readAsDataURL(file);
        return;
      }
      try {
        showToast(`Extracting text from ${file.name}…`);
        const extracted = await extractPdfText(file);
        if (extracted.text.length < 100) {
          showToast(`${file.name}: scanned/image PDF — falling back to vision mode`);
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64 = ev.target.result.split(",")[1];
            setPdfs((prev) => [...prev, { data: base64, name: file.name, mode: "vision", reason: "scanned" }]);
          };
          reader.readAsDataURL(file);
          return;
        }
        setTextDocs((prev) => [...prev, {
          name: file.name,
          content: extracted.text,
          source: "pdf-text-extraction",
          numPages: extracted.numPages,
          chars: extracted.text.length,
        }]);
        showToast(`Extracted ${extracted.text.length.toLocaleString()} chars from ${extracted.numPages} pages`);
        track("action", "pdf_text_extract", { pages: extracted.numPages, chars: extracted.text.length });
      } catch (err) {
        logError(err, "pdf text extraction");
        showToast(`${file.name}: text extraction failed — using vision mode`);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result.split(",")[1];
          setPdfs((prev) => [...prev, { data: base64, name: file.name, mode: "vision", reason: "extract_failed" }]);
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value = "";
  };
  const handleDocUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const name = file.name.toLowerCase();
      try {
        if (name.endsWith(".docx")) {
          const mammoth = await import("mammoth");
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setTextDocs((prev) => [...prev, { content: result.value, name: file.name }]);
        } else {
          const text = await file.text();
          setTextDocs((prev) => [...prev, { content: text, name: file.name }]);
        }
      } catch (err) { setError(`Couldn't read ${file.name}`); }
    }
    e.target.value = "";
  };
  const removeImage = (idx) => setImages((p) => p.filter((_, i) => i !== idx));
  const removePdf = (idx) => setPdfs((p) => p.filter((_, i) => i !== idx));
  const removeTextDoc = (idx) => setTextDocs((p) => p.filter((_, i) => i !== idx));

  const totalMaterials = images.length + pdfs.length + textDocs.length + (pastedText.trim() ? 1 : 0);
  const hasMaterials = totalMaterials > 0;
  const cardsDue = useMemo(() => {
    const states = persistentProfile.cardStates || {};
    const now = Date.now();
    return Object.values(states).filter((s) => (s.due || 0) <= now).length;
  }, [persistentProfile.cardStates]);

  // Calibration: how well does felt-confidence predict actual correctness?
  const calibrationStats = useMemo(() => {
    if (calibration.length === 0) return null;
    const buckets = [1, 2, 3, 4, 5].map((b) => {
      const items = calibration.filter((c) => c.confidence === b);
      if (items.length === 0) return { confidence: b, accuracy: null, count: 0 };
      const acc = items.filter((c) => c.correct).length / items.length;
      return { confidence: b, accuracy: acc, count: items.length };
    });
    const avgConf = calibration.reduce((s, c) => s + c.confidence, 0) / calibration.length / 5;
    const avgAcc = calibration.filter((c) => c.correct).length / calibration.length;
    return { buckets, gap: Math.round((avgConf - avgAcc) * 100), avgConf, avgAcc, n: calibration.length };
  }, [calibration]);

  // Fetch / generate today's daily challenge once per day
  const todayKey = new Date().toDateString();
  const fetchDailyChallenge = async () => {
    if (dailyChallenge && dailyChallenge.date === todayKey) return;
    const recent = (persistentProfile.recentTopics || []).map((t) => t.topic).filter(Boolean);
    const seedTopic = recent[0] || persistentProfile.goal || "general knowledge";
    try {
      const out = await callClaude(
        `Generate exactly ONE high-quality multiple-choice question on "${seedTopic}". Should take ~30 seconds. Return ONLY JSON: {"q":"question","options":["a","b","c","d"],"correctIndex":0,"explanation":"one-sentence why"}`,
        "You write a single sharp daily question — clear stem, one unambiguously correct option, plausible distractors.", false, { maxTokens: 400 }
      );
      const parsed = await safeParseJSON(out);
      if (parsed && parsed.q) setDailyChallenge({ ...parsed, date: todayKey, answered: false, selected: null });
    } catch {}
  };
  // Auto-fetch when on Today and no challenge yet for today
  useEffect(() => { if (view === "today" && (!dailyChallenge || dailyChallenge.date !== todayKey)) fetchDailyChallenge(); /* eslint-disable-next-line */ }, [view]);

  // Analytics: track every view change (silent)
  useEffect(() => { if (view) track("view", view); /* eslint-disable-next-line */ }, [view]);


  // ============ EFFECTS ============
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    setHints([]); setHintsShown(0); setTypedAnswer(""); setAnswerFeedback(null);
    setFrAnswer(""); setFrFeedback(null);
  }, [problemIndex, cardIndex, mode]);

  // KaTeX
  useEffect(() => {
    if (window.katex) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    document.head.appendChild(script);
  }, []);

  // jsPDF
  useEffect(() => {
    if (window.jspdf) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    document.head.appendChild(script);
  }, []);

  // Hydrate profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lecternProfile_v1");
      if (saved) {
        const profile = JSON.parse(saved);
        setPersistentProfile(profile);
        if (profile.examPlan) setExamPlan(profile.examPlan);
        if (profile.sessionsCount > 0 && profile.lastSessionAt > 0) {
          const hoursSince = (Date.now() - profile.lastSessionAt) / (1000 * 60 * 60);
          if (hoursSince > 4) {
            setShowWelcomeBack(true);
            generateWelcomeInsights(profile);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("lecternProfile_v1", JSON.stringify(persistentProfile)); } catch {}
  }, [persistentProfile]);

  useEffect(() => {
    if (!mode || !topic) return;
    setPersistentProfile((p) => {
      const recentTopics = [{ topic, mode, when: Date.now() }, ...p.recentTopics.filter(t => !(t.topic === topic && t.mode === mode))].slice(0, 20);
      return { ...p, recentTopics, lastSessionAt: Date.now() };
    });
  }, [mode, topic]);

  const generateWelcomeInsights = async (profile) => {
    try {
      const ctx = {
        goal: profile.goal, recentTopics: profile.recentTopics.slice(0, 5),
        weakSpots: profile.weakSpots.slice(0, 5), examDate: profile.examDate,
        daysSinceLastSession: Math.round((Date.now() - profile.lastSessionAt) / (1000 * 60 * 60 * 24)),
      };
      const systemPrompt = `You are a thoughtful tutor welcoming a student back. Write a warm, specific 2-3 sentence welcome that references what they were working on and suggests a concrete next step. Feel like a friend who remembers them. Plain text, no JSON.`;
      const text = await callClaude(JSON.stringify(ctx), systemPrompt, false, { maxTokens: 300 });
      setWelcomeInsights(text);
    } catch { setWelcomeInsights(null); }
  };

  // Pomodoro
  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          if (timerMode === "focus") {
            setPomodoroCount((p) => p + 1);
            setSessionStats((stats) => ({ ...stats, minutesStudied: stats.minutesStudied + 25 }));
            setTimerMode("break");
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.start(); osc.stop(ctx.currentTime + 0.5);
            } catch {}
            return 5 * 60;
          } else {
            setTimerMode("focus");
            return 25 * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, timerMode]);

  useEffect(() => {
    if (!mode) return;
    const id = setInterval(() => {
      setSessionStats((s) => ({ ...s, minutesStudied: s.minutesStudied + 1 }));
      setPersistentProfile((p) => ({ ...p, totalMinutes: p.totalMinutes + 1 }));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Speech
  const languageToBCP47 = {
    English: "en-US", Spanish: "es-ES", French: "fr-FR", German: "de-DE",
    Mandarin: "zh-CN", Japanese: "ja-JP", Arabic: "ar-SA", Portuguese: "pt-PT",
    Hindi: "hi-IN", Russian: "ru-RU",
  };

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false;
    rec.lang = languageToBCP47[language] || "en-US";
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setChatInput((prev) => prev + (prev ? " " : "") + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else { try { recognitionRef.current.start(); setListening(true); } catch {} }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const onJournal = (text) => {
    setJournal([{ id: Date.now().toString(), date: "Today", text }, ...journal]);
    showToast("Journal entry saved");
  };

  const addWeakSpot = (t) => {
    setPersistentProfile(p => {
      const existing = p.weakSpots.find(w => w.topic === t);
      const weakSpots = existing
        ? p.weakSpots.map(w => w.topic === t ? { ...w, count: w.count + 1, lastSeen: Date.now() } : w)
        : [...p.weakSpots, { topic: t, count: 1, lastSeen: Date.now() }];
      return { ...p, weakSpots: weakSpots.sort((a, b) => b.count - a.count).slice(0, 20) };
    });
  };

  const markMastered = (concept) => {
    setPersistentProfile(p => ({
      ...p,
      masteredConcepts: [{ concept, when: Date.now() }, ...p.masteredConcepts.filter(c => c.concept !== concept)].slice(0, 100),
    }));
  };


  // ============ GENERATION ENGINE ============
  /**
   * Top-level orchestrator for AI content generation. Called by mode cards (Flashcards, Explain,
   * Practice, etc.) and the Resume Recent strip. Handles topic resolution, mode dispatch, error
   * surfacing, loading-state management, and analytics.
   *
   * Each `selectedMode` value maps to a different prompt builder + parser. The dispatch table inside
   * builds the mode-specific user prompt (e.g. "Generate 12 flashcards on X") then calls callClaude
   * with the appropriate streaming/non-streaming setup.
   *
   * @param {string} selectedMode - One of VALID_MODES + extended set: flashcards, practice, exam,
   *   explain, cheatsheet, recall, freeResponse, derive, critique, curriculum, conceptMap,
   *   diagnostic, tutor, errorReview, briefing, audioOverview, mindMap, slideDeck, dataTable
   * @param {string} [overrideTopic] - Optional topic to use instead of the current state. Used by
   *   the Derive prompt flow (avoids stale-closure bug from earlier rounds)
   */
  const generateContent = async (selectedMode, overrideTopic) => {
    const effectiveTopic = overrideTopic !== undefined ? overrideTopic : topic;
    if (overrideTopic !== undefined && overrideTopic !== topic) setTopic(overrideTopic);
    if (!effectiveTopic.trim() && !hasMaterials) { setError("Enter a topic or add material"); return; }

    setError(null); setLoading(true); setMode(selectedMode);
    setCardIndex(0); setFlipped(false); setProblemIndex(0); setSelectedAnswer(null);
    setSubmitted(false); setScore({ correct: 0, total: 0 }); setKnownCards(new Set());
    // Reset mastery-check tracking unless we're explicitly entering one (handled in runMasteryCheck)
    if (!inMasteryCheck) { setMissedProblems([]); setMasteryCheckSourceTier(null); }
    setHints([]); setHintsShown(0); setChatMessages([]); setRecallQueue([]);
    setSessionStart(Date.now()); setFrAnswer(""); setFrFeedback(null);
    setTypedAnswer(""); setAnswerFeedback(null); setSources([]);
    setThinkingStage(""); setGenerationLog([]);
    setSteelmanExplanations({});

    setSessionStats((s) => ({
      ...s,
      modesUsed: s.modesUsed.includes(selectedMode) ? s.modesUsed : [...s.modesUsed, selectedMode],
      topicsStudied: effectiveTopic && !s.topicsStudied.includes(effectiveTopic) ? [...s.topicsStudied, effectiveTopic] : s.topicsStudied,
    }));
    track("mode", selectedMode, { topic: (effectiveTopic || "").slice(0, 40) });
    if (!sessionStart) setPersistentProfile((p) => {
      const newCount = p.sessionsCount + 1;
      const earned = newCount > 0 && newCount % 5 === 0 && (p.freezeTokens || 0) < 3;
      if (earned) setTimeout(() => showToast("Freeze token earned · " + Math.min(3, (p.freezeTokens || 0) + 1) + " banked"), 400);
      return { ...p, sessionsCount: newCount, lastSessionAt: Date.now(), freezeTokens: Math.min(3, (p.freezeTokens || 0) + (earned ? 1 : 0)) };
    });
    // Consume one-shot prediction (so it doesn't leak into the next generation)
    if (lastPrediction) setLastPrediction("");

    const isYoung = difficulty === "elementary" || difficulty === "middle";
    const sourceClause = hasMaterials
      ? (effectiveTopic.trim() ? `Use the attached material as the primary source, focused on "${effectiveTopic}". Do not invent facts not in or strongly implied by it.` : `Use the attached material as the source. Identify the subject from it, then build content around it.`)
      : `Topic: "${effectiveTopic}".`;
    const weaknessClause = weaknesses.length > 0 ? `\n\nPERSONALIZATION: bias content toward: ${[...new Set(weaknesses.map(w => w.topicArea))].join(", ")}.` : "";
    const webClause = useWebSearch ? `\n\nLATERAL READING PROTOCOL — mandatory whenever you draw on the web. Apply these silently and surface conclusions, not the process.

SOURCE EVALUATION — read laterally, not vertically
• Never evaluate a source by what it says about itself. SEARCH for what other INDEPENDENT sources say about that publisher/author/organization (Wikipedia, mediabiasfactcheck, news articles ABOUT them, encyclopedias). A site's own About page is biased by definition.
• Check the author: real person? Domain credentials? Track record? Conflicts of interest? If anonymous, note that.
• Check the date — old articles recirculated can mislead. Prefer recent sources for active research areas; canonical sources for established facts.
• URL forensics: watch for spoofed URLs (.com.co masquerading as .com), look-alike domains, typo-squats, mirrored sites.
• Visual & page cues: aggressive ads, ALL-CAPS or emotionally manipulative headlines, broken layouts, no contact info — flag as low quality.
• Satire check: sites like The Onion, Babylon Bee, ClickHole publish fake news as satire. Outlandish claims need an explicit satire-check before citation.

VERIFICATION
• Read past the headline. Verify the body actually supports the headline's claim before citing.
• Cross-reference at least 3–5 INDEPENDENT sources. Wire-service republications and aggregators don't count as independent. If only one source has the claim, say so explicitly.
• Trace claims to their PRIMARY source — never cite a source-of-a-source-of-a-source. Click through citations and verify they support the claim (not misread or cherry-picked).
• When sources disagree, present BOTH sides — don't paper over genuine disputes or scientific uncertainty.
• When the claim is the kind major fact-checkers cover, cross-reference Snopes, PolitiFact, FactCheck.org, AP Fact Check, Reuters Fact Check.
• Images can be old, decontextualized, AI-generated, or manipulated. When a claim hinges on visual evidence with only one source, flag that the reader should reverse-image-search.

SOURCE-QUALITY TIERS — state the tier when it matters
• PRIMARY: peer-reviewed papers, .gov / .edu official data, court records, primary reports.
• EXPERT SECONDARY: textbooks, established journalism with named reporters, encyclopedias.
• OPINION / BLOG / SOCIAL / ANON WIKI EDITS: use only as leads, never as definitive sourcing.
PRIORITIZE the top tier.

EPISTEMIC LABELS — use precisely, never conflate
• "verified by primary source" — you traced it to the primary
• "consensus among domain experts" — multiple independent experts agree
• "widely reported" — many outlets, but you haven't seen primary
• "claimed by X" — single source, not corroborated
• "contested" — reasonable experts disagree
• "extraordinary / unverified" — flag with extra caution

BIAS GUARDS
• Be MORE skeptical of claims that conveniently confirm a narrative the user (or you) expects.
• Note when a source has motivated interest in the claim — commercial, political, ideological.
• Apply "too good to be true": dramatically beneficial, perfectly-aligned, or commercially convenient findings need extra evidence.

OUTPUT
• Cite inline with source-quality cues: "[Nature, 2024]" or "[primary, .gov data]" or "[single blog, unverified]". Never bare attributions.
• Surface what's verified, what's contested, what you couldn't verify, and your confidence level. Hedge precisely ("as of [date]", "preliminary evidence suggests", "this is debated") — not vaguely.` : `\n\nEPISTEMIC HYGIENE — no live web access this turn, but apply lateral-reading thinking to claims drawn from training data:
• Distinguish well-established consensus from contested or evolving claims; flag where reasonable experts disagree.
• Prefer primary-source framing over secondary-summary framing where you can.
• Use precise epistemic labels: "consensus among experts" vs "widely reported" vs "claimed by X" vs "contested" — don't conflate them.
• Be MORE skeptical of claims that conveniently confirm a narrative; note when a source you'd be drawing on has motivated interest.
• Note uncertainty rather than asserting confidently. Hedge precisely ("as of training cutoff", "this was debated", "evidence was preliminary") — not vaguely.
• Apply the "too good to be true" check — extraordinary claims need extraordinary evidence.`;
    const diffClause = `Target level: ${difficultyGuide[difficultyRef.current] || difficultyGuide[difficulty]}.`;

    // NO FAKE EXAMPLES / PLACEHOLDERS — every piece of content must be real, useful, specific to the actual topic.
    // No "Example 1, Example 2", no "Lorem ipsum", no "[your answer here]" templates, no "Sample text:" patterns,
    // no "e.g. Some name", no fabricated names like "John Smith", "Acme Corp", "Example University", no fake quotes
    // attributed to invented people, no "(replace this with your own example)" — every example used MUST be a real
    // example from the actual subject. If a generic placeholder feels needed, rewrite using a concrete real instance instead.
    const noFakeExamplesClause = `\n\nREAL CONTENT ONLY — NO PLACEHOLDERS OR EXAMPLES-OF-EXAMPLES: Every piece of content must be substantive and specific to "${topic}". NEVER produce: filler phrases like "for example, [something]" without filling in the something; placeholder text like "Example: ...", "Sample: ...", "Insert your X here"; fabricated names ("John Smith", "Jane Doe", "Acme Corp", "Example University", "Dr. Example"); fake quotes attributed to invented people; "Lorem ipsum" or similar; structural skeletons like "Question 1: [question about X]" — write the actual question. Either give a real, concrete, specific instance from the subject or omit the example slot entirely. Generic illustrative analogies are fine when they actually illuminate — but never use them as filler.`;

    // Typo tolerance: explicitly tell the model to silently understand intent through typos/misspellings.
    // Most modern models already do this implicitly, but making it explicit removes the rare edge case
    // where Claude over-corrects ("did you mean X?") on something obvious. Real lift on student input
    // where they're typing fast or learning a new subject and don't know exact spelling.
    const typoToleranceClause = `\n\nTYPO TOLERANCE: The user may misspell words, use wrong capitalization, or have typos. Silently understand their intent — do NOT surface "I assume you meant X" or ask for clarification on obvious typos (e.g. "phtosynthesis" → photosynthesis, "Bayesian thereom" → Bayes' theorem, "calculas" → calculus). Only ask for clarification if the meaning is genuinely ambiguous between two distinct concepts. In your output, use the correct spelling — don't echo back the user's typo.`;

    const formattingClause = isYoung
      ? `FORMATTING: Simple, friendly language. Plain math (5+3=8) not LaTeX${difficulty === "middle" ? "; use $...$ only for formulas" : ""}. **bold** for key terms.`
      : `FORMATTING: LaTeX for math — inline $...$, display $$...$$. Markdown code blocks with language. **bold** for key terms.`;

    // Multi-language output — when set to anything other than English, all generated content (including JSON string values) is produced in the chosen language.
    // Schema KEYS stay English so the renderer still works; only the values translate.
    const languageClause = outputLanguage && outputLanguage !== "English" ? `\n\nOUTPUT LANGUAGE: Respond in ${outputLanguage}. All string VALUES in the JSON (questions, explanations, summaries, etc.) must be in ${outputLanguage}. JSON keys / schema structure stay in English so the app can render. Names of people, places, and technical terms-of-art may stay in their original form when that's standard.` : "";

    const youthSafetyClause = isYoung
      ? `\n\nYOUNG LEARNER (${difficulty === "elementary" ? "5-11" : "11-14"}): Age-appropriate, encouraging. No violence/drugs/romance/mature themes. Examples kids relate to. Celebrate curiosity. Never make student feel dumb.`
      : "";

    // SMARTER: personalize from the learner's history
    const mastered = (persistentProfile.masteredConcepts || []).slice(0, 8);
    const recent = (persistentProfile.recentTopics || []).map((t) => t.topic).filter(Boolean).slice(0, 5);
    const styleMap = { visual: "Lead with diagrams, spatial structure, and worked visuals.", analogy: "Lean heavily on analogies and concrete metaphors.", formal: "Use precise, formal, technical exposition.", balanced: "" };
    const masteryClause =
      (mastered.length ? `\n\nALREADY UNDERSTOOD (don't re-explain from scratch; build on these): ${mastered.join(", ")}.` : "") +
      (recent.length ? `\n\nRECENTLY STUDIED (draw connections where natural): ${recent.join(", ")}.` : "") +
      (styleMap[persistentProfile.preferredStyle] ? `\n\nLEARNER STYLE: ${styleMap[persistentProfile.preferredStyle]}` : "");

    // LEARNER CONTEXT: classes, age/grade level, related fields — used for curriculum and personalization
    const enrolledClasses = (myClasses || []).map((c) => c.name).filter(Boolean).slice(0, 12);
    // Per-class freeform notes — anything the user told us about each specific class (weak spots,
    // exam format, learning accommodations, professor style, etc.). Merged into the context so the
    // AI tailors output to each class's specific quirks.
    const classNotes = (myClasses || [])
      .filter((c) => c.name && (c.notes || "").trim())
      .slice(0, 12)
      .map((c) => `  • ${c.name}: ${c.notes.trim().slice(0, 800)}`);
    const ageOrGrade = (persistentProfile.ageOrGrade || "").trim();
    const longTermGoal = (persistentProfile.goal || "").trim();
    const learnerContextClause = (enrolledClasses.length || ageOrGrade || longTermGoal || classNotes.length)
      ? `\n\nLEARNER CONTEXT (use this to calibrate depth, vocabulary, prerequisites, and to draw cross-class connections wherever genuinely useful — but do NOT require that the user have a relevant class to ask about this topic):${ageOrGrade ? `\n• Level: ${ageOrGrade}.` : ""}${longTermGoal ? `\n• Long-term goal: ${longTermGoal}.` : ""}${enrolledClasses.length ? `\n• Currently/recently enrolled in: ${enrolledClasses.join("; ")}. Where useful, anchor new material to concepts they likely encountered there.` : ""}${classNotes.length ? `\n• Class-specific notes (honor these — they're learner-supplied context per class):\n${classNotes.join("\n")}` : ""}`
      : "";

    // SMARTER: works for ANY domain, not just STEM — pick the right representation
    const domainClause = `\n\nDOMAIN ADAPTIVITY: Identify what kind of subject this is and use the representations that genuinely fit it — e.g. timelines & causal chains for history; conjugation/usage tables & example sentences for languages; notation, intervals & ear-training cues for music; labeled diagrams & processes for biology; proofs & worked steps for math/CS; close-reading & rhetorical structure for literature; step sequences, materials & safety for hands-on crafts/trades; frameworks, cases & trade-offs for business/law/soft skills. Never force a STEM framing onto a non-STEM topic. Whatever the field, teach for transfer: connect to prior knowledge, show the most illuminating representation, and surface the mistakes learners actually make.`;

    // Interleaving: mixed-topic practice for better transfer (harder in the moment, better retention)
    const interleavingClause = (interleaved && ["practice", "exam", "diagnostic"].includes(selectedMode))
      ? `\n\nINTERLEAVING: Mix sub-topics across the question set instead of grouping them — alternate concepts so no two consecutive questions test the same sub-skill. This is harder in the moment but builds transfer.`
      : "";

    // Pre-question prediction: address the learner's prior prediction
    const predictionClause = (lastPrediction && lastPrediction.trim())
      ? `\n\nLEARNER'S PRIOR PREDICTION (they wrote this before seeing the content; explicitly address whether they were right or wrong, and what they got close to / missed): "${lastPrediction.replace(/"/g, "'").slice(0, 400)}"`
      : "";

    if (selectedMode === "tutor") { setLoading(false); setContent({ ready: true }); return; }

    let expertiseFraming = "";
    if (deepMode) {
      try {
        setThinkingStage("Identifying domain expertise...");
        const framingPrompt = `For "${effectiveTopic || "(see material)"}", identify (a) academic field, (b) subfield, (c) type of expert, (d) 2-3 seminal works/authors at the ${difficulty} level. 4-5 short lines.`;
        expertiseFraming = await callClaude(framingPrompt, "You calibrate expertise.", hasMaterials, { maxTokens: 400 });
      } catch {}
    }
    const expertiseClause = expertiseFraming ? `\n\nADOPT THIS EXPERTISE: ${expertiseFraming}\nRespond AS this kind of expert would.` : "";
    const thinkingOpts = (aiSettings.thinkingBudget > 0 || deepMode) ? { thinking: true, thinkingBudget: aiSettings.thinkingBudget || (maxPower ? 16000 : 8000) } : {};
    const searchOpts = (aiSettings.searchUses > 0 || useWebSearch) ? { webSearch: true, searchUses: aiSettings.searchUses || (maxPower ? 8 : 4) } : {};

    const multiAgentGenerate = async (draftPrompt, draftSystem, schemaHint, options) => {
      const { critiqueAngle = "general" } = options || {};
      const withVerification = !!aiSettings.verification;
      const totalStages = withVerification ? 4 : 3;
      try {
        setThinkingStage(`Stage 1/${totalStages} · Drafting...`);
        setGenerationLog((l) => [...l, { stage: "Draft", status: "running" }]);
        const draft = await callClaude(draftPrompt, draftSystem, true, { maxTokens: 5000, ...thinkingOpts, ...searchOpts });
        setGenerationLog((l) => l.map((e, i) => i === l.length - 1 ? { ...e, status: "done" } : e));

        setThinkingStage(`Stage 2/${totalStages} · Adversarial critique...`);
        setGenerationLog((l) => [...l, { stage: "Critique", status: "running" }]);
        const critiqueSystem = `You are a brutal senior reviewer. Find every weakness. ${critiqueAngle === "questions" ? "Focus: ambiguous wording, weak distractors, factual errors, miscalibrated difficulty." : critiqueAngle === "derivation" ? "Focus: missing justifications, hidden assumptions, logical gaps." : "Focus: factual errors, oversimplifications, missing context, weak examples."} List numbered issues with quotes. End with PRIORITY FIXES (top 3).`;
        const critique = await callClaude(`Draft:\n\n${draft}\n\nCritique now.`, critiqueSystem, false, { maxTokens: 2500, ...thinkingOpts });
        setGenerationLog((l) => l.map((e, i) => i === l.length - 1 ? { ...e, status: "done" } : e));

        setThinkingStage(`Stage 3/${totalStages} · Refining...`);
        setGenerationLog((l) => [...l, { stage: "Refine", status: "running" }]);
        const refineSystem = `${draftSystem}\n\nA reviewer critiqued your draft. Address every priority fix. Respond ONLY with valid JSON matching the original schema.`;
        const refinePrompt = `Original task: ${draftPrompt}\n\nDraft:\n${draft}\n\nCritique:\n${critique}\n\nProduce refined version. ${schemaHint}`;
        const refined = await callClaude(refinePrompt, refineSystem, true, { maxTokens: 6000, ...thinkingOpts, ...searchOpts });
        setGenerationLog((l) => l.map((e, i) => i === l.length - 1 ? { ...e, status: "done" } : e));

        if (withVerification) {
          setThinkingStage(`Stage 4/${totalStages} · Chain-of-verification...`);
          setGenerationLog((l) => [...l, { stage: "Verify", status: "running" }]);
          const verifySystem = `You are a fact-checking auditor applying the lateral-reading protocol. Given a refined answer, internally identify every non-trivial factual claim and label each: VERIFIED (cross-referenced confidently), LIKELY (high confidence from training), CONTESTED (experts disagree or single weak source), or NEEDS-EDIT (likely wrong). Then output a final JSON that (a) keeps all VERIFIED/LIKELY content intact, (b) corrects any NEEDS-EDIT claims, (c) appropriately hedges any CONTESTED claims with precise epistemic labels ("widely reported", "contested among experts", etc.). MAINTAIN THE ORIGINAL JSON SCHEMA EXACTLY — do not add or remove top-level keys. Respond ONLY with the verified JSON.`;
          const verifyPrompt = `Schema: ${schemaHint}\n\nRefined answer to verify:\n${refined}\n\nApply the chain-of-verification protocol and return the verified JSON.`;
          const verified = await callClaude(verifyPrompt, verifySystem, true, { maxTokens: 6000, ...thinkingOpts, ...searchOpts });
          setGenerationLog((l) => l.map((e, i) => i === l.length - 1 ? { ...e, status: "done" } : e));
          setThinkingStage("");
          return verified;
        }
        setThinkingStage("");
        return refined;
      } catch (err) {
        setThinkingStage("");
        return await callClaude(draftPrompt, draftSystem, true, { maxTokens: 5000, ...thinkingOpts, ...searchOpts });
      }
    };

    const generate = async (sys, p, maxTokens, schemaHint, critiqueAngle, allowStream = false) => {
      if (aiSettings.multiAgent || maxPower) return await multiAgentGenerate(p, sys, schemaHint || "Match original schema.", { critiqueAngle });
      const opts = { maxTokens, ...thinkingOpts, ...searchOpts };
      // Streaming policy:
      //   • Claude: only for prose modes (allowStream=true). JSON-mode streaming for Claude is noisy UX.
      //   • Local model: ALWAYS stream, every mode. Local generations take 30-120s; the user MUST see progress
      //     or they'll think the app froze. Even raw JSON streaming is better than a frozen spinner.
      const shouldStream = aiProvider === "webllm"
        ? !opts.tools && !opts.webSearch
        : (allowStream && !opts.tools && !opts.webSearch);
      if (shouldStream) {
        setStreamPartial("");
        opts.stream = true;
        opts.onChunk = (delta, full) => {
          setStreamPartial(full);
        };
      }
      const result = await callClaude(p, sys, true, opts);
      if (shouldStream) setStreamPartial(""); // clear when done
      return result;
    };

    // ============ MCQ VALIDATION + RETRY (local model quality booster) ============
    // Bucket B fix: small local models often produce MCQs with structural problems (wrong correctIndex,
    // < 4 options, "all of the above" distractors) or semantic problems (ambiguous correct answers).
    // This validator catches structural failures cheaply (regex/length checks) and runs a SEMANTIC pass
    // (asking the model itself to flag broken questions) only when structural checks pass.
    // Retries up to 2 times with feedback. Claude-quality MCQs need no validator.
    const validateMcqStructure = (problems) => {
      if (!Array.isArray(problems)) return { ok: false, reason: "Not an array" };
      if (problems.length === 0) return { ok: false, reason: "Empty array" };
      const failures = [];
      problems.forEach((q, i) => {
        if (!q || typeof q !== "object") { failures.push(`#${i + 1}: not an object`); return; }
        if (!q.question || typeof q.question !== "string") failures.push(`#${i + 1}: missing question`);
        if (!Array.isArray(q.options)) { failures.push(`#${i + 1}: missing options array`); return; }
        if (q.options.length !== 4) failures.push(`#${i + 1}: has ${q.options.length} options (need exactly 4)`);
        const optsUnique = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
        if (optsUnique.size !== q.options.length) failures.push(`#${i + 1}: duplicate options`);
        if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          failures.push(`#${i + 1}: invalid correctIndex (${q.correctIndex})`);
        }
        const optsLower = q.options.map((o) => String(o).toLowerCase());
        if (optsLower.some((o) => /^all of (the )?above$|^none of (the )?above$|^both [a-d] and [a-d]$/i.test(o.trim()))) {
          failures.push(`#${i + 1}: contains "all/none of above" or "both X and Y" distractor`);
        }
      });
      return { ok: failures.length === 0, reason: failures.join("; "), failures };
    };

    // Generate MCQ-mode JSON with validation + retry. Only runs the validator on local model;
    // Claude bypasses (its mcqVerifyClause in the system prompt is sufficient).
    const generateMcqWithValidation = async (sys, p, maxTokens, modeName) => {
      const tryOnce = async (extraFeedback) => {
        const augmentedPrompt = extraFeedback ? `${p}\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${extraFeedback}\n\nFix these issues in this attempt.` : p;
        const text = await generate(sys, augmentedPrompt, maxTokens, "MCQ problems schema.", "questions");
        return await safeParseJSON(text);
      };

      // Claude path — single shot, trust the mcqVerifyClause in the prompt
      if (aiProvider !== "webllm") {
        return await tryOnce();
      }

      // Local path — validate + retry up to 2 times
      let lastFeedback = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const parsed = await tryOnce(lastFeedback);
          const problems = parsed?.problems || [];
          const check = validateMcqStructure(problems);
          if (check.ok) {
            if (attempt > 0) showToast(`MCQs validated after ${attempt + 1} attempt${attempt > 0 ? "s" : ""}`);
            return parsed;
          }
          lastFeedback = check.reason;
          if (attempt < 2) {
            setThinkingStage(`Validation failed (attempt ${attempt + 1}/3) — retrying...`);
          }
        } catch (e) {
          lastFeedback = `JSON parse failed: ${e.message}`;
        }
      }
      // All retries failed — return whatever we last got with a warning
      showToast(`Local model produced flawed MCQs after 3 attempts — try a stronger model or use Cloud AI`);
      const lastText = await generate(sys, p, maxTokens, "MCQ problems schema.", "questions");
      return await safeParseJSON(lastText);
    };

    // ============ CURRICULUM CHUNKING (local model quality booster) ============
    // Bucket B fix: small local models can't plan a coherent 8-week curriculum in one shot — they hallucinate
    // weeks, repeat units, or produce vague resources. Strategy: generate a SKELETON first (week titles +
    // goals + count), then expand each week INDIVIDUALLY with its full unit detail. Slower but coherent.
    const generateCurriculumChunked = async (systemPromptBase, baseEnd, sourceClause) => {
      setThinkingStage("Stage 1/2 · Planning the skeleton…");
      const skeletonSys = `${systemPromptBase}\n\nIn this first pass, output ONLY the high-level skeleton — total weeks, prerequisites, week-by-week titles + goals + topic lists. Do not fill in resources, deliverables, or mastery checks yet — those come next.`;
      const skeletonPrompt = `${sourceClause} JSON: { "title": "...", "overview": "...", "totalWeeks": 6, "prerequisitesAssumed": ["..."], "prerequisitesToAcquireFirst": ["..."], "weekTitles": [{"week": 1, "title": "...", "goal": "...", "topics": ["3-5 topics"]}], "milestones": [{"afterWeek": 3, "checkpoint": "..."}], "finalProject": "..." }`;
      const skeletonText = await generate(skeletonSys, skeletonPrompt, 2500, "Curriculum skeleton schema.", "general");
      const skeleton = await safeParseJSON(skeletonText);
      if (!skeleton || !Array.isArray(skeleton.weekTitles)) {
        // Skeleton failed — fall back to single-shot
        setThinkingStage("Skeleton parse failed — single-shot fallback…");
        const fbText = await generate(systemPromptBase, `${sourceClause} Build a multi-week curriculum. JSON with title, overview, totalWeeks, prerequisitesAssumed, prerequisitesToAcquireFirst, units (with week/title/goal/topics/resources/hoursPerWeek/deliverable/masteryCheck), milestones, finalProject.`, 4000, "Curriculum schema.", "general");
        return await safeParseJSON(fbText);
      }
      // Now expand each week one-by-one
      const units = [];
      for (let i = 0; i < skeleton.weekTitles.length; i++) {
        const w = skeleton.weekTitles[i];
        setThinkingStage(`Stage 2/2 · Expanding week ${i + 1}/${skeleton.weekTitles.length}…`);
        const unitSys = `${baseEnd}\n\nExpand a single week of a learning curriculum into its full unit detail. Be specific about resources (named books, courses, papers — not generic descriptors). The deliverable should be something the learner can actually produce. Mastery check should be a concrete verifiable test. Respond ONLY with valid JSON.`;
        const unitPrompt = `Week ${w.week} of "${skeleton.title}". Title: "${w.title}". Goal: "${w.goal}". Topics: ${(w.topics || []).join(", ")}. JSON: { "week": ${w.week}, "title": "${w.title}", "goal": "${w.goal}", "topics": [...], "resources": ["3-5 SPECIFIC named resources"], "hoursPerWeek": 6, "deliverable": "concrete output", "masteryCheck": "concrete verifiable test" }`;
        try {
          const unitText = await generate(unitSys, unitPrompt, 1500, "Single curriculum unit schema.", "general");
          const unit = await safeParseJSON(unitText);
          if (unit && unit.week) units.push(unit);
          else units.push({ week: w.week, title: w.title, goal: w.goal, topics: w.topics || [], resources: ["[expansion failed — see skeleton]"], deliverable: "", masteryCheck: "" });
        } catch (e) {
          units.push({ week: w.week, title: w.title, goal: w.goal, topics: w.topics || [], resources: ["[expansion failed]"], deliverable: "", masteryCheck: "" });
        }
      }
      setThinkingStage("");
      return {
        title: skeleton.title,
        overview: skeleton.overview,
        totalWeeks: skeleton.totalWeeks || units.length,
        prerequisitesAssumed: skeleton.prerequisitesAssumed || [],
        prerequisitesToAcquireFirst: skeleton.prerequisitesToAcquireFirst || [],
        units,
        milestones: skeleton.milestones || [],
        finalProject: skeleton.finalProject || "",
      };
    };

    try {
      let prompt, systemPrompt, parsed;
      // ============ NOTEBOOK SOURCE GROUNDING ============
      // When a notebook is active with sources, inject them into the system prompt and instruct
      // the AI to ground every claim in the sources, citing them as [S1], [S2], etc. matching
      // the source numbers below. This is the core NotebookLM-style behavior.
      const activeNb = currentNotebook;
      const nbSources = activeNb?.sources || [];
      // Cap total source text at ~24k chars so we don't blow context windows on huge notebooks
      let sourcesUsed = 0;
      const sourceBlocks = [];
      for (let i = 0; i < nbSources.length; i++) {
        const s = nbSources[i];
        const text = String(s.content || "").slice(0, Math.max(0, 24000 - sourcesUsed));
        if (!text) break;
        sourceBlocks.push(`[S${i + 1}] ${s.name}${s.type && s.type !== "text" ? ` (${s.type})` : ""}:\n${text}`);
        sourcesUsed += text.length;
      }
      const notebookSourcesClause = activeNb && sourceBlocks.length > 0 ? `\n\nNOTEBOOK SOURCES — the user's curated sources for the notebook "${activeNb.name}". Ground your response in these. When you make a factual claim that comes from a source, cite it inline as [S1], [S2], etc., matching the source numbers below. If the user asks about something not in the sources, say so explicitly rather than inventing.\n\n${sourceBlocks.join("\n\n———\n\n")}\n\nEND OF NOTEBOOK SOURCES.` : "";
      // Per-fact citations: when enabled, the AI emits a "→ Source: [Sn]" or "→ Source: [Wn]" line beneath EVERY factual
      // claim. This makes flowing prose harder to read but is great for fact-checking, research notes, and source-critical
      // learning. User opts in via Settings → AI Quality Studio.
      const perFactCitationsClause = persistentProfile.perFactCitations ? `\n\nPER-FACT SOURCE ATTRIBUTION — REQUIRED FORMAT:\nEvery factual claim must be followed on a NEW LINE by "→ Source: [Sn]" (notebook source) or "→ Source: [Wn]" (web search result) or "→ Source: general knowledge" (your training, no specific source). The arrow → and the word "Source:" are mandatory so the user's UI can recognize and style these lines.\n\nExample of the required format:\nMitochondria produce ATP through oxidative phosphorylation.\n→ Source: [S1]\nThe process involves the electron transport chain across the inner membrane.\n→ Source: [S1]\nIn 2024, researchers identified a new ATP synthase regulatory mechanism.\n→ Source: [W2]\n\nGroup consecutive claims from the same source together — don't repeat the source after every sentence if multiple sentences share it (just put it once at the end of the grouping). For non-factual content (questions, instructions, opinions), no source line is needed.` : "";
      const baseEnd = `${diffClause} ${formattingClause}${expertiseClause}${webClause}${youthSafetyClause}${weaknessClause}${masteryClause}${learnerContextClause}${languageClause}${domainClause}${interleavingClause}${predictionClause}${notebookSourcesClause}${perFactCitationsClause}${noFakeExamplesClause}${typoToleranceClause}`;
      const mcqVerifyClause = ` Before returning, verify EACH question: (1) exactly one option is unambiguously correct and the others are clearly wrong, (2) terminology is precise and the stem is not misleading, (3) correctIndex points to the right option. Silently rewrite any question that fails these checks.`;

      if (selectedMode === "flashcards" || selectedMode === "recall") {
        systemPrompt = `Expert tutor designing flashcards that build understanding, not just memorization. ${baseEnd}\n\nEach card tests ONE clear idea. Avoid trivial fill-ins. Mix types: definitions, application, "why", comparisons, scenarios. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Generate ${selectedMode === "recall" ? 12 : 10} flashcards. JSON: { "cards": [{"front": "question", "back": "answer", "category": "tag"}] }`;
        const text = await generate(systemPrompt, prompt, 3000, "Cards array schema.", "questions");
        parsed = await safeParseJSON(text);
        setContent(parsed.cards);
        if (selectedMode === "recall") setRecallQueue(parsed.cards.map((_, i) => i));
      } else if (selectedMode === "explain") {
        systemPrompt = `Exceptional tutor building real understanding. ${baseEnd}\n\nStart with "why" before "what". Derive results rigorously. Vivid concrete examples. Address misconceptions explicitly. Genuinely illuminating analogy. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} JSON: { "title": "topic", "summary": "core insight", "sections": [{"heading": "name", "content": "explanation", "citation": "optional"}], "commonMisconceptions": ["..."], "keyTakeaways": ["..."], "analogy": "memorable analogy" }`;
        const text = await generate(systemPrompt, prompt, 3500, "Explanation JSON schema.", "general", true);
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "practice") {
        systemPrompt = `Design serious MCQs. ${baseEnd}\n\nEvery distractor plausible (real misconception). No "all/none of above". Vary correct position. Explanations teach why correct AND why others fail.${mcqVerifyClause} Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} 6 MCQs. JSON: { "problems": [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "topicArea": "sub-topic"}] }`;
        parsed = await generateMcqWithValidation(systemPrompt, prompt, 3000, "practice");
        setContent(parsed.problems);
      } else if (selectedMode === "errorReview") {
        const spots = persistentProfile.weakSpots.slice(0, 8).map((w) => w.topic);
        if (spots.length === 0) { setError("No weak spots yet — get some questions wrong first to build a review queue."); setMode(null); return; }
        systemPrompt = `Design MCQs SPECIFICALLY on the user's weak spots, varying the angle from how they previously missed them. ${baseEnd}\n\nEvery distractor plausible. No "all/none of above". Explanations teach why correct AND why others fail.${mcqVerifyClause} Respond ONLY with valid JSON.`;
        prompt = `Weak spots to target (give one question per topic, ordered by weakness): ${spots.join(", ")}. 6 MCQs total. JSON: { "problems": [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "topicArea": "sub-topic"}] }`;
        parsed = await generateMcqWithValidation(systemPrompt, prompt, 3000, "errorReview");
        setContent(parsed.problems);
      } else if (selectedMode === "exam") {
        systemPrompt = `Design comprehensive practice exams at the level of high-stakes assessments. ${baseEnd}\n\nMix types and difficulty. Cover full breadth. Genuinely challenging questions.${mcqVerifyClause} Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} 10-question exam mixing easy/medium/hard. JSON: { "problems": [{"question": "...", "options": ["..."], "correctIndex": 0, "explanation": "...", "level": "easy|medium|hard", "topicArea": "..."}] }`;
        parsed = await generateMcqWithValidation(systemPrompt, prompt, 4500, "exam");
        setContent(parsed.problems);
      } else if (selectedMode === "cheatsheet") {
        systemPrompt = `Create dense one-page study guides. ${baseEnd}\n\nMaximize signal-to-noise. Parallel structure. Formulas with LaTeX, key terms, relationships. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} JSON: { "title": "...", "sections": [{"heading": "...", "items": [{"term": "...", "definition": "..."}]}], "keyFormulas": ["..."], "mustRemember": ["..."] }`;
        const text = await generate(systemPrompt, prompt, 4000, "Cheat sheet schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "diagnostic") {
        systemPrompt = `Design diagnostic pre-tests that identify weak spots. ${baseEnd}\n\nEach question targets a specific sub-skill. Cover breadth with minimal redundancy. Mix difficulty.${mcqVerifyClause} Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} 10-question diagnostic. JSON: { "problems": [{"question": "...", "options": ["..."], "correctIndex": 0, "explanation": "...", "skill": "sub-skill", "difficulty": "easy|medium|hard"}] }`;
        parsed = await generateMcqWithValidation(systemPrompt, prompt, 4500, "diagnostic");
        setContent(parsed.problems);
      } else if (selectedMode === "freeResponse") {
        systemPrompt = `Design free-response exam questions with rubrics. ${baseEnd}\n\nMulti-step reasoning. 5-15 min answers. Clear partial credit. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} 5 free-response questions. JSON: { "problems": [{"question": "...", "rubric": [{"criterion": "...", "max": 10, "guidance": "..."}], "modelAnswer": "complete reference", "topicArea": "..."}] }`;
        const text = await generate(systemPrompt, prompt, 4500, "FR schema.", "questions");
        parsed = await safeParseJSON(text);
        setContent(parsed.problems);
      } else if (selectedMode === "derive") {
        systemPrompt = `Guide through rigorous derivations. ${baseEnd}\n\nEvery step justified (rule/theorem/assumption). State goal and strategy upfront. LaTeX rigorously. Highlight pitfalls. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} JSON: { "title": "...", "goal": "precise statement in LaTeX", "strategy": "approach in 1-2 sentences", "assumptions": ["..."], "steps": [{"step": "LaTeX claim", "justification": "why valid"}], "conclusion": "...", "pitfalls": ["..."] }`;
        const text = await generate(systemPrompt, prompt, 4000, "Derive schema.", "derivation");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "critique") {
        systemPrompt = `Teach critical analysis. ${baseEnd}\n\nIdentify claim and argument structure. Steel-man before critiquing. Distinguish empirical/logical/methodological weaknesses. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} JSON: { "title": "...", "mainClaim": "...", "argumentStructure": "...", "strengths": [{"point": "...", "explanation": "..."}], "weaknesses": [{"point": "...", "type": "empirical|logical|methodological", "explanation": "..."}], "alternativeFramings": ["..."], "questionsToInvestigate": ["..."] }`;
        const text = await generate(systemPrompt, prompt, 4000, "Critique schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "curriculum") {
        systemPrompt = `Design rigorous learning curricula for someone who wants to learn this subject — whether or not they have a class on it. ${baseEnd}\n\nUse the LEARNER CONTEXT above (their level/age/grade, current classes, recent topics, mastered concepts) to:\n• Calibrate the starting point — assume what they likely know from related classes; don't waste weeks re-teaching that\n• Identify the right pre-requisites and acknowledge which they probably have vs need to acquire first\n• Set realistic weekly hours appropriate to their level (a 10th-grader and a working adult will have very different bandwidths)\n• Anchor new material to concepts from their existing classes wherever genuinely useful\n• Specify deliverables they can actually produce (essays, projects, problem sets — not "internship at NASA")\n\nLogical dependency chain. Clear goals and explicit mastery verification at each milestone. Specific resources (named books, courses, papers, channels — not generic descriptors). Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Build a multi-week curriculum for this learner to genuinely learn this subject from where they are now. JSON: { "title": "...", "overview": "...", "totalWeeks": 8, "prerequisitesAssumed": ["what we're assuming they already know from their context"], "prerequisitesToAcquireFirst": ["any gaps they should fill before week 1"], "units": [{"week": 1, "title": "...", "goal": "...", "topics": ["..."], "resources": ["..."], "hoursPerWeek": 8, "deliverable": "...", "masteryCheck": "concrete way to verify they got it"}], "milestones": [{"afterWeek": 4, "checkpoint": "..."}], "finalProject": "...", "connectionsToTheirClasses": "1-2 sentences on how this builds on/complements what they're already studying — omit if no relevant classes" }`;
        // BUCKET B FIX: Local models struggle to plan 8 weeks at once — break into per-week chunks.
        if (aiProvider === "webllm" && !aiSettings.multiAgent && !maxPower) {
          parsed = await generateCurriculumChunked(systemPrompt, baseEnd, sourceClause);
        } else {
          const text = await generate(systemPrompt, prompt, 6000, "Curriculum schema.", "general");
          parsed = await safeParseJSON(text);
        }
        setContent(parsed);
      } else if (selectedMode === "conceptMap") {
        systemPrompt = `Extract conceptual structure. ${baseEnd}\n\nFoundational vs derived concepts. Real dependencies. Group by tier. 10-20 concepts max. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} JSON: { "title": "...", "concepts": [{"id": "snake_case", "name": "Name", "tier": "foundational|intermediate|advanced", "definition": "1 sentence", "whyItMatters": "..."}], "dependencies": [{"from": "id", "to": "id", "label": "optional"}], "suggestedPath": ["id1", "id2"] }`;
        const text = await generate(systemPrompt, prompt, 4000, "Concept map schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "audioOverview") {
        // Two-host podcast-style conversation, NotebookLM-inspired. Plays back via browser speechSynthesis.
        systemPrompt = `Write a two-host audio overview / podcast conversation about this topic. ${baseEnd}\n\nTwo distinct hosts: Host A is enthusiastic, asks the questions a curious listener would; Host B is the domain-expert, explains rigorously but accessibly. The result should feel like a 5–8 minute conversation — natural back-and-forth, not lecture. Hosts can disagree mildly, ask each other to clarify, build on each other's points. End with a "what's the takeaway" beat. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Write a podcast-style audio overview about this topic. JSON: { "title": "...", "estimatedMinutes": 6, "intro": "1-sentence framing — what listeners are about to learn", "turns": [{"speaker": "A" | "B", "text": "What this host says — natural conversational prose, 1-4 sentences"}], "takeaway": "1-2 sentences — the key insight to walk away with" }`;
        const text = await generate(systemPrompt, prompt, 6000, "Audio overview schema.", "general", true);
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "mindMap") {
        // Hierarchical mind map — interactive SVG renderer
        systemPrompt = `Build a hierarchical mind map of this topic. ${baseEnd}\n\nA strong mind map has a central concept, 4–7 main branches off it, each branch with 2–4 sub-branches. Don't go more than 3 levels deep — depth becomes noise. Each node should be SHORT (2-6 words). Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Build a mind map. JSON: { "center": "central concept (3-6 words)", "branches": [{"label": "Branch label (2-6 words)", "color": "moss|gold|blue|accent", "children": [{"label": "...", "children": [{"label": "..."}]}]}] }`;
        const text = await generate(systemPrompt, prompt, 4500, "Mind map schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "briefing") {
        // Executive briefing document — structured, citation-aware
        systemPrompt = `Write a rigorous executive briefing on this topic. ${baseEnd}\n\nBriefings are dense, structured, and assume the reader is intelligent but time-constrained. Lead with the bottom line. Include specific numbers, dates, named sources. Distinguish what's well-established from what's contested. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Write an executive briefing document. JSON: { "title": "...", "subtitle": "...", "bottomLine": "2-3 sentence executive summary — the most important thing to know", "keyFindings": ["finding 1 with specifics", "finding 2 with specifics", "..."], "context": "background paragraph — why this matters", "details": [{"heading": "Section heading", "body": "1-3 paragraphs with specifics"}], "implications": ["implication 1", "implication 2"], "openQuestions": ["what's still unknown / contested"], "sourcesConsulted": ["source quality note 1", "source quality note 2"] }`;
        const text = await generate(systemPrompt, prompt, 6000, "Briefing schema.", "general", true);
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "slideDeck") {
        // HTML/markdown slide deck — presentation generation
        systemPrompt = `Build a slide deck presentation on this topic. ${baseEnd}\n\nStrong decks have a clear arc: title → context → core content (one idea per slide) → implications → close. 8-15 slides total. Each slide has ONE clear idea, 3-6 bullet points (each bullet is a tight phrase, not a sentence), and optional speaker notes. Don't put paragraphs on slides — that's what speaker notes are for. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Build a slide deck. JSON: { "title": "Deck title", "subtitle": "deck subtitle", "slides": [{"layout": "title|content|quote|closing", "heading": "Slide heading", "bullets": ["short phrase", "short phrase"], "speakerNotes": "what you'd say verbally on this slide"}] }`;
        const text = await generate(systemPrompt, prompt, 6000, "Slide deck schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      } else if (selectedMode === "dataTable") {
        // Extract structured tabular data
        systemPrompt = `Extract structured tabular data on this topic. ${baseEnd}\n\nGood data tables have meaningful columns (not just "name | description"), accurate cells, and consistent units. If the topic doesn't naturally yield a table, build a comparison matrix of the most relevant entities/concepts. Include a "notes" field for important caveats per row when applicable. Respond ONLY with valid JSON.`;
        prompt = `${sourceClause} Extract a data table or comparison matrix. JSON: { "title": "Table title", "description": "1-2 sentence framing", "columns": ["Column 1", "Column 2", "..."], "rows": [{"values": ["cell 1", "cell 2", "..."], "notes": "optional row-level caveat"}], "footnotes": ["caveat 1", "data source 1"] }`;
        const text = await generate(systemPrompt, prompt, 5000, "Data table schema.", "general");
        parsed = await safeParseJSON(text);
        setContent(parsed);
      }
      if (effectiveTopic.trim()) { addConcept(effectiveTopic.trim()); addTimeline(`${selectedMode}: ${effectiveTopic.trim()}`); }
      // Real activity tracking — one increment per successful generation. Drives the Today heatmap.
      logSessionToday();
      // Flashcard modes: seed cardStates with the generated cards so they enter the review queue
      if ((selectedMode === "flashcards" || selectedMode === "recall") && parsed && Array.isArray(parsed.cards)) {
        seedFlashcards(parsed.cards, effectiveTopic.trim());
      }
      // Auto-save the generation to the Vault for later re-opening
      // Use a small timeout to read the just-set content from React state via a closure-safe path.
      // We capture parsed directly — content was set with the same value above.
      setTimeout(() => {
        const final = (selectedMode === "flashcards" || selectedMode === "recall") ? parsed.cards
          : (selectedMode === "practice" || selectedMode === "exam" || selectedMode === "diagnostic" || selectedMode === "freeResponse" || selectedMode === "errorReview") ? parsed.problems
          : parsed;
        saveGeneration(selectedMode, effectiveTopic.trim() || "(untitled)", final, AI_MODELS[aiSettings.model]?.label || aiSettings.model);
      }, 0);
    } catch (err) {
      console.error(err);
      logError(err, `generateContent · ${selectedMode}`);
      setError("Something went wrong. Try again.");
      setMode(null);
    } finally { setLoading(false); }
  };

  const resetToHome = () => { setMode(null); setContent(null); setError(null); };

  // Mastery check: generate a fresh mini-quiz on the concepts the user just missed.
  // Same difficulty as the parent quiz; gates the level-up until they pass it.
  const runMasteryCheck = async () => {
    if (!missedProblems.length) return;
    setMasteryCheckLoading(true);
    setMasteryCheckSourceTier(difficulty);
    try {
      const conceptsList = missedProblems.map((m, i) => {
        const t = m.problem.topicArea || m.problem.skill || `Concept ${i + 1}`;
        const q = (m.problem.question || "").slice(0, 200);
        return `${i + 1}. [${t}] ${q}`;
      }).join("\n");
      const n = missedProblems.length;
      const sys = `You are running a MASTERY CHECK. The student just took a quiz on "${topic || "(see material)"}" and scored well overall, but missed the concepts below. Generate exactly ${n} fresh multiple-choice questions that test the SAME underlying concepts — but with different wording, different distractors, and different specific examples. Same difficulty level. Goal: verify the student actually understood the concepts they missed (not just guessed correctly on the others). Respond ONLY with valid JSON: { "problems": [{ "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "topicArea": "..." }] }`;
      const p = `Concepts the student missed:\n\n${conceptsList}\n\nGenerate ${n} fresh mastery-check MCQs. Different wording, same concepts.`;
      const text = await callClaude(p, sys, false, { maxTokens: 3000 });
      const parsed = await safeParseJSON(text);
      if (parsed && Array.isArray(parsed.problems) && parsed.problems.length) {
        setInMasteryCheck(true);
        setContent(parsed.problems);
        setProblemIndex(0); setSelectedAnswer(null); setSubmitted(false);
        setScore({ correct: 0, total: 0 });
        // IMPORTANT: keep missedProblems intact so the user can revisit if they want; we use a separate flag
        track("action", "mastery_check_started", { count: n });
      } else {
        throw new Error("Mastery check generation returned no problems");
      }
    } catch (e) {
      logError(e, "mastery check generation");
      showToast("Couldn't build the mastery check. Try again or skip it.");
    } finally {
      setMasteryCheckLoading(false);
    }
  };

  // Exit the mastery-check flow without changing tier (user can retry the level later)
  const exitMasteryCheck = () => {
    setInMasteryCheck(false);
    setMasteryCheckSourceTier(null);
    setMissedProblems([]);
  };

  // ============ TEACH-BACK & EXAM PLAN ============
  const gradeTeachBack = async (concept) => {
    if (!teachBackInput.trim()) return;
    setTeachBackLoading(true); setTeachBackFeedback(null);
    try {
      const sys = `Evaluate a student's explanation of "${concept}" using the Feynman technique. Encouraging but rigorous — find what they don't actually understand. Respond ONLY with JSON: { "overall": "solid|mostly|shaky", "captured": ["..."], "gaps": [{"concept": "what's missing", "question": "probing question"}], "nextStep": "suggestion" }`;
      const p = `Concept: ${concept}\n\nStudent's explanation:\n${teachBackInput}`;
      const text = await callClaude(p, sys, false, { maxTokens: 1500, ...(deepMode ? { thinking: true, thinkingBudget: 5000 } : {}) });
      setTeachBackFeedback(await safeParseJSON(text));
    } catch {} finally { setTeachBackLoading(false); }
  };

  const generateExamPlan = async (examDate) => {
    setGeneratingPlan(true);
    try {
      const days = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000));
      const sys = `Build an adaptive exam-prep study plan. Cover all major topics, increase density near the exam, save last 2-3 days for mocks. Specific daily tasks. ${persistentProfile.weakSpots.length > 0 ? `Bias toward weak spots: ${persistentProfile.weakSpots.map(w => w.topic).slice(0, 5).join(", ")}.` : ""} Respond ONLY with JSON: { "title": "...", "totalDays": ${days}, "dailyPlan": [{"day": 1, "date": "YYYY-MM-DD", "focus": "...", "tasks": [{"minutes": 30, "activity": "...", "mode": "flashcards|practice|explain|recall|freeResponse"}], "checkpoint": "..."}], "examDayPrep": "..." }`;
      const p = `Exam: ${topic || persistentProfile.goal || "(general)"}\nDays until: ${days}\nDate: ${examDate}`;
      const text = await callClaude(p, sys, hasMaterials, { maxTokens: 5000, thinking: true, thinkingBudget: 8000 });
      const parsed = await safeParseJSON(text);
      setExamPlan(parsed);
      setPersistentProfile((prev) => ({ ...prev, examDate, goal: topic || prev.goal, examPlan: parsed }));
    } catch {} finally { setGeneratingPlan(false); }
  };


  const sleepAdvice = (h) => h < 5
    ? "Under 5 hours — keep sessions to 25 min max, skip new material, only review old."
    : h < 7 ? "5–7 hours — moderate intensity. New concepts OK, but skip the hardest stuff."
    : "7+ hours — full intensity OK. Good day for hard new material.";

  const moodReplies = {
    great: "Glad to hear it. Want to push into something harder while the brain's warm?",
    ok: "A 25-minute focused block is probably the right size right now.",
    tired: "Got it. Try the 90-second minimum session — just enough to keep momentum, no more.",
    overwhelmed: "That's a real signal. It's okay to close the app for the rest of the day. Sleep, walk, eat — the material will still be here tomorrow.",
  };

  // Wellbeing session timer
  useEffect(() => {
    const id = setInterval(() => setWbSessionLen(Math.round((Date.now() - wbSessionStart) / 60000)), 30000);
    setWbSessionLen(Math.round((Date.now() - wbSessionStart) / 60000));
    return () => clearInterval(id);
  }, [wbSessionStart]);

  const stressLevel = wbSessionLen > 240 || sleepHours < 5 ? "High" : wbSessionLen > 120 ? "Medium" : "Low";
  const shouldStop = !stopAcknowledged && (wbSessionLen >= 360 || (wbSessionLen >= 180 && sleepHours < 5));

  // ============ SECOND BRAIN / PROJECTS / HABITS / MNEMONIC ============
  const saveNote = () => {
    if (!noteDraft.title.trim()) return;
    setNotes((n) => [{ id: Date.now(), ...noteDraft, ts: Date.now() }, ...n]);
    addConcept(noteDraft.title.trim());
    addTimeline("Note: " + noteDraft.title.trim());
    setNoteDraft({ title: "", body: "", cls: noteDraft.cls });
    setShowAddNote(false);
    showToast("Note saved & organized");
  };

  const meaningSearch = async () => {
    if (!searchQ.trim()) return;
    const items = notes.map((n) => n.title + (n.body ? ": " + n.body : "")).concat(brainConcepts);
    if (!items.length) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const numbered = items.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const out = await callClaude(
        `User searched: "${searchQ}"\n\nSaved concepts/notes:\n${numbered}\n\nReturn the 1-based numbers of the 1-3 most semantically relevant items. ONLY a JSON array like [3,1]. If nothing matches, [].`,
        "Match queries to notes by meaning, not keyword.", false, { maxTokens: 100 }
      );
      let idx = []; try { idx = await safeParseJSON(out); } catch {}
      setSearchResults((idx || []).map((i) => items[i - 1]).filter(Boolean));
    } catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const planProject = async (i) => {
    setLoadingProject(i);
    try {
      const p = PROJECTS[i];
      const out = await callClaude(
        `Plan the first 60 minutes of this project: "${p.title}". Make it dead easy to start in the next 10 minutes. A numbered list of 5-7 concrete micro-steps with rough minute estimates. No fluff.`,
        "You break large projects into immediate, doable first hours.", false, { maxTokens: 700 }
      );
      setProjectPlans((m) => ({ ...m, [i]: out }));
    } catch {} finally { setLoadingProject(null); }
  };

  const generateMnemonic = async () => {
    if (!mnemonicTopic.trim()) return;
    setLoadingMnemonic(true); setMnemonic("");
    try {
      const interests = persistentProfile.goal || "everyday life";
      const out = await callClaude(
        `Create a vivid, memorable mnemonic for: "${mnemonicTopic}". Tie the metaphor to the learner's world: ${interests}. Make it concrete and visual, 100-150 words. Avoid generic mnemonics — the imagery must be specific.`,
        "You build personalized mnemonics that stick.", false, { maxTokens: 600 }
      );
      setMnemonic(out); addReward("Mnemonic unlocked: " + mnemonicTopic);
    } catch {} finally { setLoadingMnemonic(false); }
  };

  const explainConnector = async () => {
    const cs = brainConcepts.length >= 2 ? brainConcepts : (persistentProfile.recentTopics || []).map((t) => t.topic).filter(Boolean);
    if (cs.length < 2) return;
    const a = cs[cs.length - 1], b = cs[cs.length - 2];
    setLoadingConnector(true);
    try {
      const out = await callClaude(
        `In 2-3 sentences, explain how "${a}" and "${b}" share an underlying concept or method. Be specific. If they truly share nothing, say so plainly.`,
        "You find conceptual bridges between learning topics.", false, { maxTokens: 250 }
      );
      setConnector(out);
    } catch {} finally { setLoadingConnector(false); }
  };

  // Minimum viable session — 90s momentum keeper
  useEffect(() => {
    if (!mvsActive) return;
    if (mvsLeft <= 0) {
      setMvsActive(false);
      setPersistentProfile((p) => ({ ...p, sessionsCount: p.sessionsCount + 1 }));
      addTimeline("Minimum viable session (90s)");
      addReward("Kept your streak with a 90-second session");
      showToast("Streak kept. That counts.");
      setMvsLeft(90);
      return;
    }
    const id = setTimeout(() => setMvsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [mvsActive, mvsLeft]);

  // ============ KEYBOARD SHORTCUTS ============
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
  const lastKeyRef = useRef({ k: "", t: 0 });
  useEffect(() => {
    const handler = (e) => {
      // Don't intercept while typing in inputs/textareas
      const tag = (e.target.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      // Command palette: ⌘K / Ctrl+K — even when in fields
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setShowCommandPalette((open) => !open);
        setCommandQuery(""); setCommandIndex(0);
        return;
      }
      // Escape: close any open modal
      if (e.key === "Escape") {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (showShortcutOverlay) { setShowShortcutOverlay(false); return; }
        if (showPasteModal) { setShowPasteModal(false); return; }
        if (showMathSolver) { setShowMathSolver(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (showWhiteboard) { setShowWhiteboard(false); return; }
        if (showExamPlanner) { setShowExamPlanner(false); return; }
        if (teachBackActive) { setTeachBackActive(false); return; }
      }
      if (inField) return;
      // "?" — shortcut overlay
      if (e.key === "?") { e.preventDefault(); setShowShortcutOverlay(true); return; }
      // "/" focus topic field
      if (e.key === "/" && view === "tutor" && !mode) {
        const el = document.querySelector("input.topic-field");
        if (el) { e.preventDefault(); el.focus(); }
        return;
      }
      // "g X" sequence — go to view
      if (lastKeyRef.current.k === "g" && Date.now() - lastKeyRef.current.t < 900) {
        const map = { t: "tutor", h: "today", l: "library", b: "brain", f: "feed", p: "projects", c: "careers", w: "wellbeing" };
        if (map[e.key]) { setView(map[e.key]); lastKeyRef.current = { k: "", t: 0 }; e.preventDefault(); return; }
      }
      if (e.key === "g") { lastKeyRef.current = { k: "g", t: Date.now() }; return; }
      // Flashcard shortcuts
      if (view === "tutor" && (mode === "flashcards" || mode === "recall") && content && Array.isArray(content)) {
        if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); return; }
        if (e.key === "ArrowRight" && cardIndex < content.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); return; }
        if (e.key === "ArrowLeft" && cardIndex > 0) { setCardIndex(cardIndex - 1); setFlipped(false); return; }
        if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
          const q = { "1": 1, "2": 3, "3": 4, "4": 5 }[e.key];
          const card = content[cardIndex]; if (card) rateCard(card.front, q, card.back, topic);
          if (cardIndex < content.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); }
          return;
        }
      }
      // MCQ shortcuts: 1-4 pick option
      if (view === "tutor" && ["practice", "exam", "diagnostic", "errorReview"].includes(mode) && content && !submitted) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const i = Number(e.key) - 1;
          const prob = content[problemIndex];
          if (prob && prob.options && i < prob.options.length) { setSelectedAnswer(i); return; }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, mode, content, cardIndex, flipped, submitted, problemIndex, showPasteModal, showMathSolver, showSettings, showWhiteboard, showExamPlanner, teachBackActive, showCommandPalette, showShortcutOverlay]);

  // ============ HINTS, STEELMAN, GRADING ============
  const requestHint = async () => {
    if (!content || !["practice", "exam", "diagnostic"].includes(mode)) return;
    const problem = content[problemIndex];
    setLoadingHint(true);
    try {
      const hintLevel = hintsShown + 1;
      const sys = `Give progressive hints. NEVER reveal the answer letter. Plain text, 1-2 sentences.`;
      const p = `Problem: ${problem.question}\nOptions: ${problem.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(" | ")}\nHint #${hintLevel}/3. Previous: ${hints.join(" | ") || "none"}`;
      const text = await callClaude(p, sys, false, { maxTokens: 200 });
      setHints((prev) => [...prev, text]);
      setHintsShown(hintLevel);
    } catch {} finally { setLoadingHint(false); }
  };

  const requestSteelman = async (selectedIdx) => {
    if (!content || !["practice", "exam", "diagnostic"].includes(mode)) return;
    const problem = content[problemIndex];
    if (steelmanExplanations[problemIndex]) return;
    setLoadingSteelman(true);
    try {
      const sys = `Explain why student's wrong answer was tempting (the steelman) then name the precise distinction. Two short paragraphs, ~120 words.`;
      const p = `Problem: ${problem.question}\nOptions:\n${problem.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}\nStudent picked: ${String.fromCharCode(65 + selectedIdx)}\nCorrect: ${String.fromCharCode(65 + problem.correctIndex)}\nExplanation: ${problem.explanation}`;
      const text = await callClaude(p, sys, false, { maxTokens: 600, thinking: deepMode, thinkingBudget: 3000 });
      setSteelmanExplanations((prev) => ({ ...prev, [problemIndex]: text }));
    } catch {} finally { setLoadingSteelman(false); }
  };

  const gradeRecallAnswer = async () => {
    if (!content || mode !== "recall") return;
    const card = content[cardIndex];
    if (!typedAnswer.trim()) return;
    setGradingAnswer(true);
    try {
      const sys = `Grade student answers strictly but fairly. Respond ONLY with JSON: { "correctness": "correct|partial|incorrect", "score": 0-100, "feedback": "1-2 sentences" }`;
      const p = `Q: ${card.front}\nReference: ${card.back}\nStudent: ${typedAnswer}`;
      const text = await callClaude(p, sys, false, { maxTokens: 400 });
      const result = await safeParseJSON(text);
      setAnswerFeedback(result);
      if (result.correctness === "incorrect") setRecallQueue((p) => [...p, cardIndex]);
      else if (result.correctness === "partial") setRecallQueue((prev) => { const c = [...prev]; c.splice(Math.min(2, c.length), 0, cardIndex); return c; });
      if (result.correctness === "correct") {
        setKnownCards((p) => new Set([...p, cardIndex]));
        setSessionStats((s) => ({ ...s, cardsReviewed: s.cardsReviewed + 1, cardsMastered: s.cardsMastered + 1 }));
      } else setSessionStats((s) => ({ ...s, cardsReviewed: s.cardsReviewed + 1 }));
    } catch {} finally { setGradingAnswer(false); }
  };

  const gradeFreeResponse = async () => {
    if (!content || mode !== "freeResponse") return;
    const problem = content[problemIndex];
    if (!frAnswer.trim()) return;
    setFrGrading(true);
    try {
      const sys = `Rigorous professor grading free-response. Respond ONLY with JSON: { "score": 0-100, "rubricScores": [{"criterion": "...", "earned": 0, "max": 10, "note": "..."}], "strengths": ["..."], "improvements": ["..."], "modelAnswer": "..." }`;
      const p = `Q: ${problem.question}\nRubric: ${JSON.stringify(problem.rubric)}\nStudent answer:\n${frAnswer}`;
      const text = await callClaude(p, sys, true, { maxTokens: 1800, ...(deepMode ? { thinking: true, thinkingBudget: 5000 } : {}) });
      const result = await safeParseJSON(text);
      setFrFeedback(result);
      setScore((s) => ({ correct: s.correct + (result.score >= 70 ? 1 : 0), total: s.total + 1 }));
      setSessionStats((s) => ({ ...s, questionsAnswered: s.questionsAnswered + 1, questionsCorrect: s.questionsCorrect + (result.score >= 70 ? 1 : 0) }));
    } catch {} finally { setFrGrading(false); }
  };

  const solveMath = async () => {
    if (!mathInput.trim()) return;
    // Honest preflight: if user is on Anthropic but no API key, tell them clearly instead of generic fail
    if (aiProvider === "anthropic" && !anthropicApiKey) {
      setMathSolution({ error: "No Cloud AI API key set. Add one in Settings → AI Provider, or switch to Local AI." });
      return;
    }
    if (aiProvider === "webllm" && !webllmEngineRef.current) {
      setMathSolution({ error: "Local AI not loaded yet. Open Settings → AI Provider and load a model first." });
      return;
    }
    setSolvingMath(true); setMathSolution(null);
    try {
      const sys = `Solve math step-by-step. LaTeX for math. Respond ONLY with JSON: { "problem": "...", "approach": "...", "steps": [{"step": "...", "result": "..."}], "answer": "LaTeX", "check": "..." }`;
      // Only pass thinking flags on Anthropic — local model has no thinking phase, so they're ignored harmlessly,
      // but better to be explicit. Local model bumps tokens higher to compensate for no thinking.
      const opts = aiProvider === "anthropic"
        ? { maxTokens: 2500, thinking: true, thinkingBudget: 5000 }
        : { maxTokens: 3000, temperature: 0.3 };
      const text = await callClaude(mathInput, sys, false, opts);
      const parsed = await safeParseJSON(text);
      if (!parsed || !parsed.steps) {
        setMathSolution({ error: aiProvider === "webllm" ? "Local model returned malformed output. Try a stronger model or use Cloud AI." : "Couldn't parse the solution. Try rephrasing." });
        return;
      }
      setMathSolution(parsed);
    } catch (e) {
      logError(e, "solve math");
      setMathSolution({ error: `Couldn't solve: ${e.message || "unknown error"}. Try rephrasing.` });
    }
    finally { setSolvingMath(false); }
  };

  // Explain code — line-by-line walkthrough. Detects language if user picks "auto".
  const explainCodeSnippet = async () => {
    if (!codeExplainDraft.trim()) return;
    // Honest preflight: catch missing-key / unloaded-model up front
    if (aiProvider === "anthropic" && !anthropicApiKey) {
      setCodeExplainResult({ error: "No Cloud AI API key set. Add one in Settings → AI Provider, or switch to Local AI." });
      return;
    }
    if (aiProvider === "webllm" && !webllmEngineRef.current) {
      setCodeExplainResult({ error: "Local AI not loaded yet. Open Settings → AI Provider and load a model first." });
      return;
    }
    setCodeExplainLoading(true); setCodeExplainResult(null);
    try {
      const langHint = codeExplainLang === "auto" ? "Auto-detect the language." : `Language is ${codeExplainLang}.`;
      const sys = `You explain code at the level of a senior engineer onboarding a junior. ${langHint}\n\nProvide: (1) language detection + confidence, (2) one-sentence summary of what the code does, (3) line-by-line or block-by-block walkthrough — only the meaningful lines, skip imports/boilerplate, (4) common gotchas or footguns specific to this code, (5) suggested improvements if obvious. Use real technical terminology. Don't dumb it down. Respond ONLY with valid JSON.`;
      const prompt = `Explain this code:\n\n\`\`\`\n${codeExplainDraft.slice(0, 8000)}\n\`\`\`\n\nJSON: { "language": "detected language", "summary": "what it does in one sentence", "walkthrough": [{"lines": "1-5 OR 'function foo'", "explanation": "what these lines do and why"}], "gotchas": ["specific risks in this code"], "improvements": ["optional concrete suggestions"] }`;
      const opts = aiProvider === "anthropic"
        ? { maxTokens: 4000, thinking: true, thinkingBudget: 4000 }
        : { maxTokens: 4000, temperature: 0.4 };
      const text = await callClaude(prompt, sys, false, opts);
      const parsed = await safeParseJSON(text);
      if (!parsed || !parsed.summary) {
        setCodeExplainResult({ error: aiProvider === "webllm" ? "Local model returned malformed output. Try a stronger model or use Cloud AI." : "Couldn't parse the explanation. Try a shorter snippet." });
        return;
      }
      setCodeExplainResult(parsed);
      track("action", "code_explain", { lang: parsed?.language || codeExplainLang });
    } catch (e) {
      setCodeExplainResult({ error: `Couldn't explain: ${e.message || "unknown error"}. The code might be too long, or the API failed.` });
      logError(e, "explain code");
    } finally {
      setCodeExplainLoading(false);
    }
  };

  // ============ CHAT ============
  const detectChatIntent = async (text) => {
    try {
      const sys = `Classify chat intent. Return ONLY JSON: { "intent": "generate|export|speak|translate|math|timer|stats|suggest|chat", "mode": "flashcards|practice|exam|explain|cheatsheet|recall|freeResponse|derive|critique|curriculum|conceptMap|diagnostic|tutor", "topic": "or null", "language": "or null" }`;
      const result = await callClaude(text, sys, false, { maxTokens: 200 });
      return await safeParseJSON(result);
    } catch { return { intent: "chat" }; }
  };

  const sendChatMessage = async (overrideText) => {
    const text = (overrideText || chatInput).trim();
    if (!text || chatLoading) return;
    const newMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages); setChatInput(""); setChatLoading(true);

    try {
      const intent = await detectChatIntent(text);

      if (intent.intent === "generate" && intent.mode) {
        const validatedMode = safeMode(intent.mode);
        const targetTopic = intent.topic && intent.topic !== "null" ? intent.topic : topic;
        if (targetTopic) {
          setChatMessages((prev) => [...prev, { role: "assistant", content: `On it — making ${validatedMode} on **${targetTopic}**.` }]);
          setChatLoading(false);
          setTimeout(() => generateContent(validatedMode, targetTopic), 500);
          return;
        }
      }
      if (intent.intent === "translate" && intent.language) {
        setLanguage(intent.language);
        setChatMessages((prev) => [...prev, { role: "assistant", content: `Switched to ${intent.language}.` }]);
        setChatLoading(false); return;
      }
      if (intent.intent === "math") {
        setMathInput(text); setShowMathSolver(true);
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Opening the math solver." }]);
        setChatLoading(false); return;
      }
      if (intent.intent === "timer") {
        setTimerActive((a) => !a);
        setChatMessages((prev) => [...prev, { role: "assistant", content: timerActive ? "Timer paused." : "Pomodoro started — 25 min focus, 5 min break." }]);
        setChatLoading(false); return;
      }
      if (intent.intent === "stats") {
        const s = sessionStats;
        const acc = s.questionsAnswered > 0 ? Math.round(100 * s.questionsCorrect / s.questionsAnswered) : 0;
        const report = `**Questions:** ${s.questionsAnswered} (${acc}%)\n**Cards mastered:** ${s.cardsMastered}/${s.cardsReviewed}\n**Time:** ${s.minutesStudied}/${dailyGoalMinutes} min\n**Modes:** ${s.modesUsed.join(", ") || "none"}`;
        setChatMessages((prev) => [...prev, { role: "assistant", content: report }]);
        setChatLoading(false); return;
      }

      const isYoung = difficulty === "elementary" || difficulty === "middle";
      const personaInstruction = tutorPersona !== "default" ? `\n\nPERSONA: Respond as ${personas[tutorPersona].name}. Style: ${personas[tutorPersona].style}` : "";
      const systemPrompt = `You are an expert tutor and study companion. ${topic.trim() ? `Topic: "${topic}".` : ""} ${hasMaterials ? "Use attached material." : ""}
Level: ${difficultyGuide[difficulty]}
${language !== "English" ? `Respond in ${language}.` : ""}
${persistentProfile.goal ? `Long-term goal: ${persistentProfile.goal}.` : ""}
${persistentProfile.weakSpots.length > 0 ? `Weak spots: ${persistentProfile.weakSpots.slice(0, 5).map(w => w.topic).join(", ")}.` : ""}
${(persistentProfile.masteredConcepts || []).length > 0 ? `Already understood (build on, don't re-explain): ${persistentProfile.masteredConcepts.slice(0, 8).join(", ")}.` : ""}
${{ visual: "Prefer diagrams and spatial structure.", analogy: "Lean on analogies and concrete metaphors.", formal: "Use precise, formal exposition.", balanced: "" }[persistentProfile.preferredStyle] || ""}

${socraticMode ? "SOCRATIC MODE: Resist direct answers. Ask guiding questions." : ""}
${personaInstruction}

Principles: Adapt to level and to the subject — use whatever representation truly fits the field (timelines for history, example sentences for languages, notation for music, worked steps for math, close-reading for literature, technique steps for crafts). Don't force a STEM framing onto non-STEM topics. Concrete > abstract. Teach for transfer and name common mistakes. Warm not saccharine. 2-4 short paragraphs unless asked for depth.
${isYoung ? "YOUNG LEARNER: Simple language, relatable examples, no mature themes." : "Use LaTeX for math, code blocks for code, **bold** for terms."}`;

      const isFirstTurn = chatMessages.length === 0;
      const apiMessages = isFirstTurn ? null : newMessages.map((m) => ({ role: m.role, content: m.content }));
      let reply;
      if (aiProvider === "webllm") {
        // Local model: streaming chat — append a placeholder assistant message and grow its content
        // as deltas arrive. Conversation history mechanism keeps last 3 turns automatically.
        let assembled = "";
        const placeholderIdx = newMessages.length; // assistant index after user message
        setChatMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);
        reply = await callClaude(text, systemPrompt, false, {
          maxTokens: 1500, useHistory: true, temperature: 0.7,
          onChunk: (_delta, full) => {
            assembled = full;
            setChatMessages((prev) => prev.map((m, i) => i === placeholderIdx ? { ...m, content: assembled, streaming: true } : m));
          },
        });
        // Mark final message non-streaming (drops the streaming cursor styling)
        setChatMessages((prev) => prev.map((m, i) => i === placeholderIdx ? { role: "assistant", content: reply || assembled } : m));
        return; // skip the post-loop setChatMessages below — we already wrote it
      } else if (isFirstTurn) {
        reply = await callClaude(text, systemPrompt, true, { maxTokens: 1500, ...(deepMode ? { thinking: true, thinkingBudget: 6000 } : {}), ...(useWebSearch ? { webSearch: true, searchUses: 3 } : {}) });
      } else {
        reply = await callClaude("", systemPrompt, false, { messages: apiMessages, maxTokens: 1500, ...(deepMode ? { thinking: true, thinkingBudget: 6000 } : {}) });
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again?" }]);
    } finally { setChatLoading(false); }
  };

  // ============ PDF EXPORT ============
  const exportToPDF = (options) => {
    const { title, sections, filename } = options;
    if (!window.jspdf) { showToast("PDF library still loading — try again in a sec"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usable = pageWidth - margin * 2;
    let y = margin;
    const addLine = (text, fontSize, fontStyle = "normal", color = [30, 30, 30]) => {
      doc.setFont("helvetica", fontStyle); doc.setFontSize(fontSize); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text), usable);
      lines.forEach((line) => {
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y); y += fontSize * 1.3;
      });
    };
    addLine(title, 22, "bold");
    addLine(`Study It · ${new Date().toLocaleDateString()}`, 9, "normal", [120, 120, 120]);
    y += 16;
    sections.forEach((section, idx) => {
      if (idx > 0) { doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageWidth - margin, y); y += 16; }
      if (section.heading) { addLine(section.heading, 14, "bold"); y += 4; }
      if (section.body) {
        const clean = String(section.body).replace(/\$\$([\s\S]+?)\$\$/g, "$1").replace(/\$([^\$]+?)\$/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
        addLine(clean, 11); y += 6;
      }
      if (section.bullets) { section.bullets.forEach((b) => addLine("• " + String(b).replace(/\*\*([^*]+)\*\*/g, "$1"), 11)); y += 4; }
      if (section.qa) {
        section.qa.forEach((item, i) => {
          addLine(`${i + 1}. ${item.q}`, 11, "bold"); y += 2;
          if (item.a) addLine("Answer: " + String(item.a).replace(/\$\$([\s\S]+?)\$\$/g, "$1").replace(/\$([^\$]+?)\$/g, "$1"), 10);
          y += 8;
        });
      }
    });
    doc.save(filename || "lectern.pdf");
  };

  // ============ DOCX / XLSX / PPTX EXPORTS ============
  // Heavy libraries (each 600KB-1.2MB) are lazy-loaded from CDN on first click — not in the bundle.
  // First export of a given type takes ~1s extra; subsequent exports use the cached script.
  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      // Already loaded; resolve when the global is present
      const check = () => { if (document.querySelector(`script[data-src="${src}"]`)?.dataset?.loaded === "1") resolve(); else setTimeout(check, 50); };
      check(); return;
    }
    const s = document.createElement("script");
    s.src = src; s.dataset.src = src; s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  // Word .docx — for prose-style outputs (briefing, explain, cheatsheet, curriculum, critique, derive, freeResponse)
  const exportToDocx = async (title, sections, filename) => {
    try {
      showToast("Building Word document…");
      await loadScript("https://unpkg.com/docx@8.5.0/build/index.umd.js");
      const dx = window.docx;
      if (!dx) throw new Error("docx library failed to load");
      const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = dx;

      const paragraphs = [];
      paragraphs.push(new Paragraph({ text: title || "Study It export", heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT }));
      paragraphs.push(new Paragraph({ text: `Generated ${new Date().toLocaleDateString()}`, alignment: AlignmentType.LEFT, spacing: { after: 240 } }));

      for (const sec of sections) {
        if (!sec) continue;
        if (sec.heading) paragraphs.push(new Paragraph({ text: sec.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
        if (sec.subheading) paragraphs.push(new Paragraph({ text: sec.subheading, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } }));
        if (sec.body) {
          const lines = String(sec.body).split("\n");
          for (const line of lines) {
            if (line.trim()) paragraphs.push(new Paragraph({ children: [new TextRun(line)], spacing: { after: 120 } }));
          }
        }
        if (sec.bullets && sec.bullets.length) {
          for (const b of sec.bullets) {
            paragraphs.push(new Paragraph({ text: String(b), bullet: { level: 0 } }));
          }
        }
        if (sec.qa && sec.qa.length) {
          for (let i = 0; i < sec.qa.length; i++) {
            const item = sec.qa[i];
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: `Q${i + 1}. ${item.q || ""}`, bold: true })], spacing: { before: 120, after: 60 } }));
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: String(item.a || "") })], spacing: { after: 120 } }));
          }
        }
      }

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, filename || `${(title || "study-it").replace(/\s+/g, "-").toLowerCase()}.docx`);
      showToast("Word document downloaded");
      track("action", "export_docx");
    } catch (e) {
      logError(e, "docx export");
      showToast("Word export failed — try again or use PDF instead");
    }
  };

  // Excel .xlsx — for data tables (also useful for flashcards, MCQs as a fallback)
  const exportToXlsx = async (filename, sheets) => {
    try {
      showToast("Building Excel file…");
      await loadScript("https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js");
      const XLSX = window.XLSX;
      if (!XLSX) throw new Error("xlsx library failed to load");
      const wb = XLSX.utils.book_new();
      for (const sheet of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        // Auto-fit column widths
        const colWidths = (sheet.rows[0] || []).map((_, ci) =>
          Math.min(60, Math.max(...sheet.rows.map((r) => String(r[ci] || "").length))) + 2
        );
        ws["!cols"] = colWidths.map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, (sheet.name || "Sheet").slice(0, 31)); // 31 char limit on names
      }
      XLSX.writeFile(wb, filename);
      showToast("Excel file downloaded");
      track("action", "export_xlsx");
    } catch (e) {
      logError(e, "xlsx export");
      showToast("Excel export failed — try again");
    }
  };

  // PowerPoint .pptx — for slide decks
  const exportToPptx = async (deck) => {
    try {
      showToast("Building PowerPoint…");
      await loadScript("https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js");
      const PptxGen = window.PptxGenJS;
      if (!PptxGen) throw new Error("pptxgenjs library failed to load");
      const pptx = new PptxGen();
      pptx.layout = "LAYOUT_WIDE"; // 16:9
      pptx.title = deck.title || "Slide Deck";

      for (const slide of deck.slides || []) {
        const s = pptx.addSlide();
        if (slide.layout === "title") {
          s.addText(slide.heading || deck.title || "Title", { x: 0.5, y: 2.2, w: 12.3, h: 1.5, fontSize: 44, bold: true, align: "center", color: "1C1A17" });
          if (deck.subtitle) s.addText(deck.subtitle, { x: 0.5, y: 3.8, w: 12.3, h: 0.8, fontSize: 22, italic: true, align: "center", color: "5A5750" });
        } else if (slide.layout === "quote") {
          s.addText(`"${slide.heading || ""}"`, { x: 1, y: 1.8, w: 11.3, h: 2.5, fontSize: 32, italic: true, align: "center", color: "1C1A17" });
          if (slide.bullets?.[0]) s.addText(`— ${slide.bullets[0]}`, { x: 1, y: 4.5, w: 11.3, h: 0.6, fontSize: 16, align: "center", color: "8A8780" });
        } else if (slide.layout === "closing") {
          s.addText(slide.heading || "Thank you", { x: 0.5, y: 2.5, w: 12.3, h: 1.2, fontSize: 40, bold: true, align: "center", color: "1C1A17" });
          if (slide.bullets?.length) {
            s.addText(slide.bullets.map((b) => ({ text: b, options: { fontSize: 18, color: "5A5750" } })), { x: 0.5, y: 4.0, w: 12.3, h: 2.5, align: "center" });
          }
        } else {
          // content layout
          s.addText(slide.heading || "Slide", { x: 0.5, y: 0.4, w: 12.3, h: 0.9, fontSize: 32, bold: true, color: "1C1A17" });
          if (slide.bullets?.length) {
            s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 20, color: "1C1A17", paraSpaceAfter: 12 } })), { x: 0.5, y: 1.6, w: 12.3, h: 5.5 });
          }
        }
        if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
      }

      await pptx.writeFile({ fileName: `${(deck.title || "slide-deck").replace(/\s+/g, "-").toLowerCase()}.pptx` });
      showToast("PowerPoint downloaded");
      track("action", "export_pptx");
    } catch (e) {
      logError(e, "pptx export");
      showToast("PowerPoint export failed — try again");
    }
  };

  const exportCurrentContent = (format = "pdf") => {
    if (!mode) { showToast("Generate study material first"); return; }

    // Special-case: mode-specific Word/Excel/PowerPoint exports
    if (format === "pptx") {
      if (mode !== "slideDeck" || !content) { showToast("PowerPoint export is only for Slide Deck mode"); return; }
      exportToPptx(content); return;
    }
    if (format === "xlsx") {
      if (mode === "dataTable" && content) {
        const rows = [content.columns || []];
        (content.rows || []).forEach((r) => rows.push(r.values || []));
        if (content.footnotes?.length) { rows.push([]); rows.push(["Footnotes:"]); content.footnotes.forEach((f) => rows.push([f])); }
        exportToXlsx(`${(content.title || topic || "data").replace(/\s+/g, "-").toLowerCase()}.xlsx`, [{ name: content.title || "Data", rows }]);
        return;
      }
      if ((mode === "flashcards" || mode === "recall") && content) {
        const rows = [["Front", "Back", "Category"]];
        content.forEach((c) => rows.push([c.front || "", c.back || "", c.category || ""]));
        exportToXlsx(`${topic.replace(/\s+/g, "-").toLowerCase()}-flashcards.xlsx`, [{ name: "Flashcards", rows }]);
        return;
      }
      if (["practice", "exam", "diagnostic"].includes(mode) && content) {
        const rows = [["#", "Question", "A", "B", "C", "D", "Correct", "Explanation"]];
        content.forEach((p, i) => rows.push([i + 1, p.question || "", ...(p.options || []), String.fromCharCode(65 + (p.correctIndex || 0)), p.explanation || ""]));
        exportToXlsx(`${topic.replace(/\s+/g, "-").toLowerCase()}-${mode}.xlsx`, [{ name: mode, rows }]);
        return;
      }
      showToast("Excel export works for Data Table, Flashcards, Practice, Exam, and Diagnostic modes");
      return;
    }
    if (format === "docx") {
      if (!content) return;
      const baseName = `${topic ? topic.replace(/\s+/g, "-").toLowerCase() : "study"}-${mode}.docx`;
      if (mode === "explain") {
        exportToDocx(content.title || topic, [
          { body: content.summary },
          ...(content.sections || []).map((s) => ({ heading: s.heading, body: s.content })),
          content.analogy && { heading: "Analogy", body: content.analogy },
          content.keyTakeaways?.length && { heading: "Key Takeaways", bullets: content.keyTakeaways },
        ].filter(Boolean), baseName);
        return;
      }
      if (mode === "briefing") {
        exportToDocx(content.title || topic, [
          content.subtitle && { body: content.subtitle },
          content.bottomLine && { heading: "Bottom Line", body: content.bottomLine },
          content.keyFindings?.length && { heading: "Key Findings", bullets: content.keyFindings },
          content.context && { heading: "Context", body: content.context },
          ...(content.details || []).map((d) => ({ heading: d.heading, body: d.body })),
          content.implications?.length && { heading: "Implications", bullets: content.implications },
          content.openQuestions?.length && { heading: "Open Questions", bullets: content.openQuestions },
          content.sourcesConsulted?.length && { heading: "Sources Consulted", bullets: content.sourcesConsulted },
        ].filter(Boolean), baseName);
        return;
      }
      if (mode === "cheatsheet") {
        exportToDocx(content.title || topic, [
          ...(content.sections || []).map((s) => ({ heading: s.heading, bullets: (s.items || []).map((it) => `${it.term}: ${it.definition}`) })),
          content.keyFormulas?.length && { heading: "Key Formulas", bullets: content.keyFormulas },
        ].filter(Boolean), baseName);
        return;
      }
      if (mode === "curriculum") {
        exportToDocx(content.title || topic, [
          content.overview && { body: content.overview },
          ...(content.units || []).map((u) => ({ heading: `Week ${u.week}: ${u.title}`, body: u.goal, bullets: [...(u.topics || []), u.deliverable && `Deliverable: ${u.deliverable}`, u.masteryCheck && `Mastery check: ${u.masteryCheck}`].filter(Boolean) })),
          content.finalProject && { heading: "Final Project", body: content.finalProject },
        ].filter(Boolean), baseName);
        return;
      }
      if (mode === "audioOverview") {
        exportToDocx(content.title || topic, [
          content.intro && { body: content.intro },
          { heading: "Transcript", body: (content.turns || []).map((t) => `${t.speaker}: ${t.text}`).join("\n\n") },
          content.takeaway && { heading: "Takeaway", body: content.takeaway },
        ].filter(Boolean), baseName);
        return;
      }
      if (mode === "flashcards" || mode === "recall") {
        exportToDocx(`${topic} — Flashcards`, [{ qa: content.map((c) => ({ q: c.front, a: c.back })) }], baseName);
        return;
      }
      // Generic prose fallback
      exportToDocx(content.title || topic || mode, [{ body: typeof content === "string" ? content : JSON.stringify(content, null, 2) }], baseName);
      return;
    }

    // Default: PDF
    const filename = `${topic ? topic.replace(/\s+/g, "-").toLowerCase() : "study"}-${mode}.pdf`;
    if (mode === "tutor") {
      if (chatMessages.length === 0) { showToast("Chat is empty — nothing to export"); return; }
      exportToPDF({ title: `${topic || "Tutor chat"}`, filename: `chat-${Date.now()}.pdf`, sections: chatMessages.map((m) => ({ heading: m.role === "user" ? "You" : "Tutor", body: m.content })) });
      return;
    }
    if (!content) return;
    if (mode === "flashcards" || mode === "recall") {
      exportToPDF({ title: `${topic} — Flashcards`, filename, sections: [{ qa: content.map((c) => ({ q: c.front, a: c.back })) }] });
    } else if (mode === "explain") {
      exportToPDF({ title: content.title, filename, sections: [
        { body: content.summary },
        ...(content.sections || []).map((s) => ({ heading: s.heading, body: s.content })),
        content.analogy && { heading: "Analogy", body: content.analogy },
        content.keyTakeaways && { heading: "Key Takeaways", bullets: content.keyTakeaways },
      ].filter(Boolean) });
    } else if (mode === "cheatsheet") {
      exportToPDF({ title: content.title + " — Cheat Sheet", filename, sections: [
        content.mustRemember && { heading: "Must Remember", bullets: content.mustRemember },
        ...(content.sections || []).map((s) => ({ heading: s.heading, bullets: (s.items || []).map((it) => `${it.term}: ${it.definition}`) })),
        content.keyFormulas && { heading: "Key Formulas", bullets: content.keyFormulas },
      ].filter(Boolean) });
    } else if (["practice", "exam", "diagnostic"].includes(mode)) {
      exportToPDF({ title: `${topic} — Practice`, filename, sections: [{ qa: content.map((p) => ({ q: `${p.question}\n${p.options.map((o, i) => `   ${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`, a: `${String.fromCharCode(65 + p.correctIndex)} — ${p.explanation}` })) }] });
    }
  };


  // ============================================================
  // VIEW RENDERERS — each is a function returning JSX
  // ============================================================

  const renderToday = () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const hr = now.getHours();
    const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const niceName = (persistentProfile.displayName || "").trim() || (user && user.email ? user.email.split("@")[0] : "") || "reader";

    // REAL heatmap data — 84 days (12 weeks) of actual activity. Each cell = count of generations that day.
    // Stored in sessionLog as { "YYYY-MM-DD": count }. Empty days = 0.
    const heatCells = (() => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const arr = [];
      for (let i = 83; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        arr.push({ date: d, count: sessionLog[key] || 0 });
      }
      return arr;
    })();
    const heatMax = Math.max(1, ...heatCells.map((c) => c.count));
    const totalSessions = heatCells.reduce((s, c) => s + c.count, 0);

    // Real caption — derived from sessionLog. Only shown when there's enough data to be meaningful.
    const caption = (() => {
      if (totalSessions < 5) return null; // not enough data for an honest pattern
      const dayBuckets = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
      heatCells.forEach((c) => { dayBuckets[c.date.getDay()] += c.count; });
      const topDay = dayBuckets.indexOf(Math.max(...dayBuckets));
      const dayNames = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
      const activeDays = heatCells.filter((c) => c.count > 0).length;
      return `${totalSessions} session${totalSessions === 1 ? "" : "s"} across ${activeDays} day${activeDays === 1 ? "" : "s"} in the last 12 weeks · most active on ${dayNames[topDay]}`;
    })();

    // Real session-based accuracy (no fake fallback). If no quizzes yet, accuracy is null and the stat card hides.
    const acc = sessionStats.questionsAnswered > 0 ? Math.round(100 * sessionStats.questionsCorrect / sessionStats.questionsAnswered) : null;

    return (
      <div>
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 18, marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <SectionLabel>The Daily Review · Vol. I</SectionLabel>
            <SectionLabel>{today}</SectionLabel>
          </div>
          <h1 className="today-hero" style={{ fontFamily: fontDisplay, fontSize: 64, fontWeight: 600, color: C.ink, margin: "8px 0 0", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {greeting}, <em style={{ color: C.accent, fontWeight: 500 }}>{niceName}.</em>
          </h1>
          <div style={{ fontFamily: fontSerif, fontSize: 16, color: C.inkSoft, marginTop: 8, fontStyle: "italic" }}>
            {(() => {
              const sessions = persistentProfile.sessionsCount || 0;
              if (sessions === 0 && cardsDue === 0) return "Ready when you are.";
              if (sessions === 0) return `${cardsDue} card${cardsDue === 1 ? "" : "s"} are waiting for you.`;
              if (cardsDue === 0) return `You're ${sessions} session${sessions === 1 ? "" : "s"} in.`;
              return `You're ${sessions} session${sessions === 1 ? "" : "s"} in — and ${cardsDue} card${cardsDue === 1 ? "" : "s"} are waiting for you.`;
            })()}
          </div>
        </div>

        {/* Welcome back banner */}
        {showWelcomeBack && welcomeInsights && (
          <div style={{ marginBottom: 24, padding: 20, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 4 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Heart size={20} color={C.gold} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Welcome back</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.6 }}>
                  <RichText>{welcomeInsights}</RichText>
                </div>
                <button onClick={() => setShowWelcomeBack(false)} style={{ marginTop: 8, background: "transparent", border: "none", fontSize: 11, color: C.inkMuted, cursor: "pointer", padding: 0 }}>
                  got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stat strip */}
        {!firstRunDismissed && (
          <div className="elev-2" style={{ marginBottom: 28, padding: 24, background: C.paperLight, border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.accent}`, borderRadius: 4, position: "relative" }}>
            <button onClick={dismissFirstRun} title="Dismiss" style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", padding: 4, color: C.inkMuted }}>
              <X size={14} />
            </button>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>Welcome to Study It · v{APP_VERSION}</div>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 500, margin: "0 0 10px", letterSpacing: "-0.01em" }}>Three things to know to get rolling</h2>
            <ol style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.7, paddingLeft: 22, margin: "0 0 12px" }}>
              <li><strong>Bring your own AI API key</strong> in Settings → AI Provider. Direct browser-to-provider — nothing routes through us.</li>
              <li><strong>Or enable WebGPU local AI</strong> in Settings — Llama / Phi / Gemma run entirely in your browser, free but much less capable than the cloud AI.</li>
              <li><strong>Create a Notebook</strong> in Library to ground AI outputs in your own sources (PDFs, articles, your notes) with [S1], [S2] citations.</li>
            </ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn variant="primary" onClick={() => { setShowSettings(true); }}>Open Settings</Btn>
              <Btn variant="ghost" onClick={() => { setView("library"); setShowNotebookCreate(true); }}>Create a notebook</Btn>
              <Btn variant="ghost" onClick={() => setShowHelp(true)}>Open Help Center</Btn>
              <Btn variant="ghost" onClick={dismissFirstRun}>Dismiss</Btn>
            </div>
          </div>
        )}
        <div className="stat-strip" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 36 }}>
          {[
            { label: "Sessions", val: persistentProfile.sessionsCount || 0, suffix: "total", icon: Flame, accent: true },
            { label: "Today", val: sessionStats.minutesStudied, suffix: "min" },
            { label: "Mastered", val: persistentProfile.masteredConcepts.length, suffix: "concepts" },
            { label: "Accuracy", val: acc !== null ? acc : "—", suffix: acc !== null ? "%" : "" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 24px", borderRight: i < 3 ? `1px solid ${C.rule}` : "none", background: s.accent ? C.paperDark : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                {s.icon && <s.icon size={12} color={s.accent ? C.accent : C.inkMuted} />}
                <SectionLabel accent={s.accent}>{s.label}</SectionLabel>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: fontDisplay, fontSize: 44, fontWeight: 500, color: C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.val}</span>
                <span style={{ fontFamily: fontSans, fontSize: 11, color: C.inkMuted, letterSpacing: "0.1em" }}>{s.suffix}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Habit row */}
        <div className="mat-grid" style={{ gap: 12, marginBottom: 36 }}>
          {(() => { const s = SKILLS_OF_DAY[new Date().getDate() % SKILLS_OF_DAY.length]; return (
            <div style={{ background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 5, padding: 16 }}>
              <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Skill of the day</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ); })()}
          {/* Daily challenge */}
          <div style={{ background: dailyChallenge?.answered ? C.mossSoft : C.blueSoft, border: `1px solid ${dailyChallenge?.answered ? C.moss : C.blue}`, borderRadius: 5, padding: 16 }}>
            <SectionLabel style={{ color: dailyChallenge?.answered ? C.moss : C.blue, marginBottom: 6 }}>Daily challenge</SectionLabel>
            {!dailyChallenge ? (
              <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Loading today's question…</div>
            ) : dailyChallenge.answered ? (
              <>
                <div style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}>{dailyChallenge.selected === dailyChallenge.correctIndex ? "✓ You got it." : "Got it wrong — that's fine, you'll see it again."}</div>
                <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{dailyChallenge.explanation}</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{dailyChallenge.q}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dailyChallenge.options.map((opt, i) => (
                    <button key={i} className="btn" onClick={() => {
                      const isC = i === dailyChallenge.correctIndex;
                      setDailyChallenge({ ...dailyChallenge, answered: true, selected: i });
                      setCalibration((prev) => [...prev, { confidence: 3, correct: isC, ts: Date.now() }].slice(-200));
                      if (isC) addReward("Daily challenge: solved");
                    }} style={{ textAlign: "left", padding: "6px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 13, cursor: "pointer" }}>
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 6 }}>Minimum viable session</SectionLabel>
            {!mvsActive ? (
              <>
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>Too tired for a full session? 90 seconds counts. Just keep momentum.</div>
                <Btn variant="primary" onClick={() => { setMvsLeft(90); setMvsActive(true); }}>Start 90s</Btn>
              </>
            ) : (
              <>
                <div style={{ fontFamily: fontDisplay, fontSize: 40, fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{`0:${String(mvsLeft).padStart(2, "0")}`}</div>
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginTop: 6 }}>In one sentence: what's the most important thing you learned recently?</div>
              </>
            )}
          </div>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 6 }}>Implementation intention</SectionLabel>
            {intention ? (
              <>
                <div style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>Plan: <strong>{intention}</strong></div>
                <Btn variant="ghost" style={{ fontSize: 10 }} onClick={() => { setIntention(""); setIntentionDraft(""); }}>Change</Btn>
              </>
            ) : (
              <>
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>When &amp; where will you study tomorrow?</div>
                <input type="text" value={intentionDraft} onChange={(e) => setIntentionDraft(e.target.value)} placeholder="9am at the library"
                  style={{ width: "100%", padding: "7px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
                <Btn variant="primary" style={{ fontSize: 10 }} onClick={() => { if (intentionDraft.trim()) { setIntention(intentionDraft.trim()); showToast("We'll nudge you then"); } }}>Save plan</Btn>
              </>
            )}
          </div>
        </div>

        <div className="today-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1px 1fr", gap: 32 }}>
          {/* Left: Plan */}
          <div>
            <SectionLabel>Today's Plan</SectionLabel>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 600, margin: "4px 0 20px", color: C.ink }}>
              Three things, one hour.
            </h2>
            {[
              { time: "Now", task: "Chat with your AI tutor", duration: "12 min", action: () => { setView("tutor"); generateContent("tutor"); }, urgent: true },
              { time: "After", task: "Practice quiz on your weak spots", duration: "20 min", action: () => { setView("tutor"); const wt = persistentProfile.weakSpots[0]?.topic; if (wt) { setTopic(wt); generateContent("practice", wt); } } },
              { time: "Evening", task: "Write a learning journal entry", duration: "5 min", action: () => document.getElementById("journal-input")?.focus() },
            ].map((item, i) => (
              <div key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 12px 18px 0", borderBottom: i < 2 ? `1px solid ${C.rule}` : "none", cursor: "pointer", borderRadius: 3, transition: "background 0.15s, padding 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.paperDark; e.currentTarget.style.paddingLeft = "12px"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.paddingLeft = "0px"; }}>
                <div style={{ width: 60, fontFamily: fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>{item.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontSerif, fontSize: 19, color: C.ink, fontWeight: item.urgent ? 600 : 400 }}>{item.task}</div>
                  <div style={{ fontFamily: fontSans, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{item.duration}</div>
                </div>
                {item.urgent && (
                  <div style={{ fontFamily: fontSans, fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: "0.15em", padding: "4px 8px", border: `1px solid ${C.accent}`, borderRadius: 2 }}>
                    DUE NOW
                  </div>
                )}
                <ChevronRight size={18} color={C.inkMuted} />
              </div>
            ))}

            {/* Weak spots */}
            {persistentProfile.weakSpots.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <SectionLabel accent>Work on these</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {persistentProfile.weakSpots.slice(0, 5).map((w, i) => (
                    <button key={i} className="btn" onClick={() => { setView("tutor"); setTopic(w.topic); generateContent("practice", w.topic); }} style={{
                      padding: "6px 12px", background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}`,
                      fontFamily: fontSans, fontSize: 12, cursor: "pointer", borderRadius: 2,
                    }}>
                      {w.topic} <span style={{ opacity: 0.6 }}>×{w.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Heatmap — REAL activity from sessionLog. Empty days = 0, hottest = max(day count). */}
            <div style={{ marginTop: 36 }}>
              <SectionLabel>Last 12 Weeks · {totalSessions} session{totalSessions === 1 ? "" : "s"}</SectionLabel>
              {totalSessions === 0 ? (
                <div style={{ marginTop: 12, padding: 24, border: `1px dashed ${C.rule}`, borderRadius: 3, fontFamily: fontSerif, fontStyle: "italic", color: C.inkMuted, textAlign: "center", maxWidth: 480 }}>
                  No study activity yet. Your daily activity will appear here as you generate study materials.
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, marginTop: 12, maxWidth: 480 }}>
                    {heatCells.map((cell, i) => {
                      // Intensity = fraction of cell's count relative to the busiest day. 0 = empty cell.
                      const intensity = cell.count === 0 ? 0 : Math.max(0.15, cell.count / heatMax);
                      const dateLabel = cell.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                      return (
                        <div key={i} title={`${dateLabel} · ${cell.count} session${cell.count === 1 ? "" : "s"}`} style={{
                          aspectRatio: "1",
                          background: cell.count === 0 ? C.paperDark : `rgba(194, 137, 119, ${intensity})`,
                          border: `1px solid ${C.rule}`, borderRadius: 1,
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, maxWidth: 480 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: "0.08em" }}>LESS</span>
                    {[0, 0.25, 0.5, 0.75, 1].map((o, i) => (
                      <div key={i} style={{ width: 11, height: 11, background: o === 0 ? C.paperDark : `rgba(194, 137, 119, ${Math.max(0.15, o)})`, border: `1px solid ${C.rule}`, borderRadius: 1 }} />
                    ))}
                    <span style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: "0.08em" }}>MORE</span>
                  </div>
                  {caption && (
                    <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginTop: 10 }}>
                      {caption}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Rule vertical />

          {/* Right: Journal */}
          <div>
            <SectionLabel accent>The Learning Journal</SectionLabel>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 500, margin: "4px 0 4px", color: C.ink, fontStyle: "italic" }}>
              What did you learn today?
            </h2>
            <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, marginTop: 0, lineHeight: 1.5 }}>
              Three sentences. What clicked, what confused you, what you want to revisit.
            </p>
            <JournalInput onSubmit={onJournal} />
            <div style={{ marginTop: 24 }}>
              {journal.slice(0, 3).map((j) => (
                <div key={j.id} style={{ paddingTop: 14, paddingBottom: 14, borderTop: `1px solid ${C.rule}` }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{j.date}</div>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, lineHeight: 1.5, fontStyle: "italic" }}>"{j.text}"</div>
                </div>
              ))}
            </div>

            {/* Concept connector */}
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `2px solid ${C.ink}` }}>
              <SectionLabel>Concept connector</SectionLabel>
              {(brainConcepts.length >= 2 || (persistentProfile.recentTopics || []).length >= 2) ? (
                <>
                  <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, marginTop: 6, marginBottom: 8 }}>How does what you just learned connect to what came before?</p>
                  <Btn variant="ghost" style={{ fontSize: 10 }} onClick={explainConnector} disabled={loadingConnector}>{loadingConnector ? <><Loader2 size={11} className="spin" /> Connecting</> : "Find the link ↗"}</Btn>
                  {connector && <div style={{ marginTop: 10, fontFamily: fontSerif, fontSize: 14, lineHeight: 1.7, color: C.ink }}><RichText>{connector}</RichText></div>}
                </>
              ) : (
                <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic", marginTop: 6 }}>Study a couple of topics and Study It will draw the connections between them.</p>
              )}
            </div>

            {/* Rewards */}
            {rewards.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.rule}` }}>
                <SectionLabel accent>Unlocked</SectionLabel>
                {rewards.slice(0, 4).map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontFamily: fontSerif, fontSize: 13 }}>
                    <Sparkles size={13} color={C.gold} style={{ flexShrink: 0, marginTop: 3 }} /> {r.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLibrary = () => (
    <div>
      <SectionLabel>The Library</SectionLabel>
      <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 400, margin: "4px 0 8px", color: C.ink, letterSpacing: "-0.02em" }}>
        Everything you're <em style={{ color: C.accent }}>studying.</em>
      </h1>
      <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", maxWidth: 600, marginBottom: 32 }}>
        Curated paths, your own paths, and every material you've uploaded — in one place.
      </p>

      {/* ============ NOTEBOOKS — NotebookLM-style source-grounded containers ============ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <SectionLabel>Notebooks <span style={{ color: C.inkMuted, fontWeight: 400 }}>· source-grounded workspaces</span></SectionLabel>
          <button onClick={() => setShowNotebookCreate(true)}
            style={{ background: C.ink, color: C.paper, border: "none", padding: "5px 12px", borderRadius: 2, fontFamily: fontSans, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>
            + New notebook
          </button>
        </div>
        <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", margin: "0 0 12px" }}>
          A notebook is a named container with its own sources (PDFs, articles, your notes). When active, every AI output is grounded in those sources with [S1], [S2] citations linking back — same paradigm as Google's NotebookLM.
        </p>
        {liveNotebooks.length === 0 ? (
          <div style={{ padding: 18, background: C.paperLight, border: `1px dashed ${C.rule}`, borderRadius: 3, textAlign: "center", fontFamily: fontSerif, fontSize: 14, color: C.inkMuted, fontStyle: "italic" }}>
            No notebooks yet. Click <strong>+ New notebook</strong> to create your first source-grounded workspace.
          </div>
        ) : (
          <div className="stagger-grid notebook-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {liveNotebooks.map((n) => {
              const isActive = n.id === currentNotebookId;
              const colorMap = { moss: C.moss, gold: C.gold, blue: C.blue, accent: C.accent, plum: C.plum };
              const bgColor = colorMap[n.color] || C.moss;
              const ageMs = Date.now() - (n.lastUsedAt || n.createdAt);
              const ageLabel = ageMs < 60000 ? "just now" : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)}m ago` : ageMs < 86400000 ? `${Math.floor(ageMs / 3600000)}h ago` : `${Math.floor(ageMs / 86400000)}d ago`;
              return (
                <div key={n.id} onClick={() => { switchToNotebook(n.id); setView("tutor"); }}
                  style={{ position: "relative", padding: 16, background: C.paper, border: `2px solid ${isActive ? bgColor : C.rule}`, borderRadius: 4, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 8 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = bgColor; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 14px -8px rgba(0,0,0,0.2)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = isActive ? bgColor : C.rule; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{n.emoji || "📓"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, lineHeight: 1.2, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</div>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2 }}>{(n.sources || []).length} source{(n.sources || []).length === 1 ? "" : "s"} · {ageLabel}</div>
                    </div>
                    {isActive && <span style={{ fontFamily: fontMono, fontSize: 9, padding: "2px 6px", background: bgColor, color: C.paper, borderRadius: 2, fontWeight: 600 }}>ACTIVE</span>}
                  </div>
                  {(n.sources || []).length > 0 && (
                    <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.45 }}>
                      {(n.sources || []).slice(0, 3).map((s) => s.name).join(" · ")}{(n.sources || []).length > 3 ? ` · +${(n.sources || []).length - 3}` : ""}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); const newName = prompt("Rename notebook:", n.name); if (newName) renameNotebook(n.id, newName); }} style={{ background: "transparent", border: "none", fontFamily: fontMono, fontSize: 10, color: C.inkMuted, cursor: "pointer", padding: 0 }}>Rename</button>
                    <button onClick={(e) => { e.stopPropagation(); setShareNotebookId(n.id); }} style={{ background: "transparent", border: "none", fontFamily: fontMono, fontSize: 10, color: C.inkMuted, cursor: "pointer", padding: 0 }}>Share</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const snapshot = n;
                      deleteNotebook(n.id);
                      pushUndo(`Deleted "${n.name}" (${(n.sources || []).length} source${(n.sources || []).length === 1 ? "" : "s"})`, () => {
                        setNotebooks((prev) => [snapshot, ...prev.filter((x) => x.id !== snapshot.id)]);
                        showToast(`Restored "${snapshot.name}"`);
                      });
                    }} style={{ background: "transparent", border: "none", fontFamily: fontMono, fontSize: 10, color: C.accent, cursor: "pointer", padding: 0 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <SectionLabel>Your classes</SectionLabel>
        <button onClick={() => { setEditingClassId(null); setClassDraft({ name: "", term: "", color: "blue" }); setShowAddClassLibrary(true); }}
          style={{ background: C.ink, color: C.paper, border: "none", padding: "5px 12px", borderRadius: 2, fontFamily: fontSans, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>
          + Add class
        </button>
      </div>
      {(showAddClassLibrary || editingClassId) && (
        <div style={{ padding: 14, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, marginTop: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", marginBottom: 8 }}>{editingClassId ? "EDIT CLASS" : "ADD A CLASS"}</div>
          <input type="text" value={classDraft.name} onChange={(e) => setClassDraft({ ...classDraft, name: e.target.value })} placeholder={classDraft.selfStudy ? "Subject (e.g. Linear Algebra, Spanish, Web Development)" : "Class name (e.g. Organic Chemistry II)"}
            onKeyDown={(e) => { if (e.key === "Enter") { saveClass(); setShowAddClassLibrary(false); } }}
            style={{ width: "100%", padding: "8px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <input type="text" value={classDraft.term} onChange={(e) => setClassDraft({ ...classDraft, term: e.target.value })} placeholder={classDraft.selfStudy ? "Target (e.g. 8 weeks, by exam)" : "Term (e.g. Fall '26)"}
              style={{ flex: 1, minWidth: 110, padding: "7px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            <select value={classDraft.color} onChange={(e) => setClassDraft({ ...classDraft, color: e.target.value })}
              style={{ padding: "7px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, outline: "none" }}>
              <option value="blue">Blue</option><option value="moss">Moss</option><option value="gold">Gold</option><option value="plum">Plum</option><option value="accent">Accent</option>
            </select>
          </div>
          {/* Self-study + auto-curriculum toggles. Two checkboxes, stacked. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, padding: "8px 10px", background: C.paper, borderRadius: 2, border: `1px solid ${C.rule}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.inkSoft }}>
              <input type="checkbox" checked={!!classDraft.selfStudy} onChange={(e) => setClassDraft({ ...classDraft, selfStudy: e.target.checked })}
                style={{ cursor: "pointer" }} />
              <span>I'm self-studying this (not enrolled in a formal course)</span>
            </label>
            {!editingClassId && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.inkSoft }}>
                <input type="checkbox" checked={!!classDraft.generateCurriculum} onChange={(e) => setClassDraft({ ...classDraft, generateCurriculum: e.target.checked })}
                  style={{ cursor: "pointer", marginTop: 3 }} />
                <span>
                  Also build me a multi-week study plan (AI generates it after saving)
                  <span style={{ display: "block", fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", marginTop: 2 }}>
                    Uses your AI key. Jumps to the AI Tutor and runs curriculum mode automatically.
                  </span>
                </span>
              </label>
            )}
          </div>
          {/* Freeform notes — anything else the AI should know about this class. Injected into
              the system prompt whenever this class is part of the learner context. */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.08em", marginBottom: 4 }}>SOMETHING ELSE? (optional)</div>
            <textarea value={classDraft.notes || ""} onChange={(e) => setClassDraft({ ...classDraft, notes: e.target.value })}
              placeholder="Anything else the AI should know about this class — your weak spots, exam format, professor's style, learning preferences, accommodations, prerequisites you're missing… The AI uses this whenever it generates content for this class."
              rows={3} maxLength={1000}
              style={{ width: "100%", padding: "8px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, lineHeight: 1.5, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 60 }} />
            <div style={{ fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", marginTop: 4 }}>
              Example: "I have ADHD, keep explanations short and visual. The exam is all multiple choice. I'm strong on theory but weak on calculations."
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={() => { saveClass(); setShowAddClassLibrary(false); }}>
              {editingClassId ? "Save" : (classDraft.generateCurriculum ? "Add class + build plan" : "Add class")}
            </Btn>
            <button onClick={() => { setEditingClassId(null); setClassDraft({ name: "", term: "", color: "blue", selfStudy: false, generateCurriculum: false, notes: "" }); setShowAddClassLibrary(false); }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      {myClasses.length === 0 ? (
        <div style={{ marginTop: 12, padding: 32, border: `1px dashed ${C.rule}`, fontFamily: fontSerif, fontStyle: "italic", color: C.inkMuted, textAlign: "center", marginBottom: 36 }}>
          No classes yet. Click <strong style={{ color: C.ink, fontStyle: "normal" }}>+ Add class</strong> above to add the courses you're taking.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginTop: 12, marginBottom: 36 }}>
          {myClasses.map((c) => {
            const palette = { blue: { bg: C.blueSoft, fg: C.blue }, moss: { bg: C.mossSoft, fg: C.moss }, gold: { bg: C.goldSoft, fg: C.gold }, plum: { bg: "#F2E8F0", fg: "#6B2D5C" }, accent: { bg: C.accentSoft, fg: C.accent } }[c.color] || { bg: C.paperLight, fg: C.ink };
            return (
              <div key={c.id} style={{ padding: 18, background: palette.bg, border: `1px solid ${palette.fg}`, borderRadius: 3, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 130 }}>
                <button onClick={() => { setTopic(c.name); setView("tutor"); generateContent("explain", c.name); }}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, background: palette.fg, borderRadius: "50%" }} />
                    <SectionLabel style={{ color: palette.fg }}>{c.term || "Class"}</SectionLabel>
                  </div>
                  <h3 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, color: C.ink, margin: "0 0 6px", lineHeight: 1.15 }}>{c.name}</h3>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.05em" }}>Click to study</div>
                </button>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button onClick={(e) => { e.stopPropagation(); editClass(c); setShowAddClassLibrary(true); }} style={{ background: "transparent", border: `1px solid ${palette.fg}`, color: palette.fg, cursor: "pointer", padding: "4px 10px", borderRadius: 2, fontFamily: fontSans, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em" }}>EDIT</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteClass(c.id); }} title="Delete class" aria-label="Delete class" style={{ background: "transparent", border: `1px solid ${palette.fg}`, color: palette.fg, cursor: "pointer", padding: "4px 8px", borderRadius: 2 }}><X size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );


  // ============ TUTOR — AI ENGINE HOME ============
  const renderTutorHome = () => (
    <div>
      {/* ============ ACTIVE NOTEBOOK STRIP ============ */}
      {currentNotebook ? (
        <div style={{ marginBottom: 20, padding: 14, background: C.ink, color: C.paper, borderRadius: 4, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22 }}>{currentNotebook.emoji}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: "0.15em", opacity: 0.7, textTransform: "uppercase" }}>Active notebook</div>
            <div style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 500 }}>{currentNotebook.name}</div>
            <div style={{ fontFamily: fontMono, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {(currentNotebook.sources || []).length} source{(currentNotebook.sources || []).length === 1 ? "" : "s"} · generations grounded in your sources, cited as [S1], [S2]…
            </div>
          </div>
          <button onClick={() => setShowNotebookSources(true)} style={{ padding: "8px 12px", background: C.paper, color: C.ink, border: "none", borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 12, fontWeight: 600 }}>Sources ({(currentNotebook.sources || []).length})</button>
          <button onClick={() => { setCurrentNotebookId(null); showToast("Exited notebook · back to topic mode"); }} style={{ padding: "8px 12px", background: "transparent", color: C.paper, border: `1px solid ${C.paper}`, borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>Exit notebook</button>
        </div>
      ) : liveNotebooks.length > 0 ? (
        <div style={{ marginBottom: 20, padding: 12, background: C.paperLight, border: `1px dashed ${C.rule}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>
            No notebook active — answers come from the model's training only. <strong style={{ color: C.ink, fontStyle: "normal" }}>Open a notebook</strong> to ground generations in your own sources.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {notebooks.slice(0, 3).map((n) => (
              <button key={n.id} onClick={() => switchToNotebook(n.id)} style={{ padding: "6px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{n.emoji || "📓"}</span>
                <span>{n.name}</span>
              </button>
            ))}
            <button onClick={() => setView("library")} style={{ padding: "6px 10px", background: "transparent", border: "none", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.inkMuted, textDecoration: "underline" }}>See all →</button>
          </div>
        </div>
      ) : null}

      <SectionLabel>The Atelier</SectionLabel>
      <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 400, margin: "4px 0 8px", color: C.ink, letterSpacing: "-0.02em" }}>
        Learn anything, <em style={{ color: C.accent }}>beautifully.</em>
      </h1>
      <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", maxWidth: 600, marginBottom: 28 }}>
        Thirteen ways to engage with what you're studying. Chat with your tutor, generate flashcards, build a study plan, or test yourself rigorously — all in one place.
      </p>

      {/* Resume Recent — surface saved generations as first-class entry points */}
      {savedGenerations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <SectionLabel>Resume recent <span style={{ color: C.inkMuted, fontWeight: 400 }}>· auto-saved to your Vault</span></SectionLabel>
            <button onClick={() => setView("brain")} style={{ background: "transparent", border: "none", fontFamily: fontSans, fontSize: 12, color: C.inkMuted, cursor: "pointer", textDecoration: "underline" }}>
              See all {savedGenerations.length} →
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {savedGenerations.slice(0, 4).map((g) => {
              const ageMs = Date.now() - g.createdAt;
              const ageLabel = ageMs < 60000 ? "just now" : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)}m ago` : ageMs < 86400000 ? `${Math.floor(ageMs / 3600000)}h ago` : `${Math.floor(ageMs / 86400000)}d ago`;
              return (
                <button key={g.id} className="chip-btn" onClick={() => reopenSavedGeneration(g)} style={{
                  padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4
                }}>
                  <div style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.inkMuted }}>
                    {g.mode} · {ageLabel}
                  </div>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 500, color: C.ink, lineHeight: 1.3 }}>{g.topic}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Topic input */}
      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 24, borderRadius: 5, marginBottom: 20, boxShadow: `0 1px 0 ${C.rule}` }}>
        <SectionLabel>What do you want to study?</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, borderBottom: `1px solid ${C.rule}` }}>
          <Lightbulb size={20} color={C.inkMuted} style={{ flexShrink: 0 }} />
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Anything — jazz harmony, the French Revolution, Bayesian stats, watercolor, negotiation..."
            className="topic-field"
            style={{ width: "100%", fontFamily: fontDisplay, fontSize: 24, padding: "10px 0", background: "transparent", border: "none", borderBottom: "1px solid transparent", marginBottom: -1, outline: "none", color: C.ink }}
          />
        </div>
        {!topic.trim() && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {[
              "Photosynthesis", "Bayesian statistics", "Neural networks", "Quantum entanglement", "Linear algebra",
              "The French Revolution", "Greek mythology", "Stoic philosophy", "The Cold War",
              "Spanish subjunctive", "Japanese particles", "Latin declensions",
              "Jazz chord voicings", "Watercolor washes", "Color theory", "Film composition",
              "How to negotiate", "Personal finance basics", "Public speaking",
              "Supply & demand", "Behavioral economics",
              "Wine tasting fundamentals", "Chess openings", "Architecture styles",
            ].map((ex) => (
              <button key={ex} className="chip-btn" onClick={() => setTopic(ex)} style={{
                padding: "6px 13px", background: C.paperLight, border: `1px solid ${C.rule}`, color: C.inkSoft,
                fontFamily: fontSans, fontSize: 12, cursor: "pointer", borderRadius: 99, transition: "all 0.15s ease",
              }}>{ex}</button>
            ))}
          </div>
        )}

        {/* Materials */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionLabel>Material {totalMaterials > 0 && <span style={{ color: C.ink }}>· {totalMaterials}</span>}</SectionLabel>
            <span style={{ fontSize: 11, color: C.inkMuted, fontFamily: fontSans }}>optional</span>
          </div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
          <input ref={pdfInputRef} type="file" accept="application/pdf" multiple onChange={handlePdfUpload} style={{ display: "none" }} />
          <input ref={docInputRef} type="file" accept=".docx,.doc,.txt,.md,.rtf" multiple onChange={handleDocUpload} style={{ display: "none" }} />
          <div className="mat-grid">
            <MaterialBtn icon={<Camera size={14} />} label="Photo" onClick={() => cameraInputRef.current?.click()} />
            <MaterialBtn icon={<ImageIcon size={14} />} label="Image" onClick={() => fileInputRef.current?.click()} />
            <MaterialBtn icon={<FileIcon size={14} />} label="PDF" onClick={() => pdfInputRef.current?.click()} />
            <MaterialBtn icon={<FileText size={14} />} label="Doc" onClick={() => docInputRef.current?.click()} />
          </div>
          {/* Camera scanner — live edge-detect + auto-capture. Better than the simple Photo button
              because it auto-detects when paper is in frame and crops automatically. */}
          <button onClick={() => setShowCameraScanner(true)} style={{
            marginTop: 8, width: "100%", padding: "10px", background: C.ink, color: C.paper, border: "none",
            fontFamily: fontSans, fontSize: 12, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600,
          }}>
            <Camera size={14} /> Scan with auto-detect
          </button>
          <button onClick={() => { setPasteDraft(pastedText); setShowPasteModal(true); }} style={{
            marginTop: 8, width: "100%", padding: "10px", background: C.paperDark, border: `1px solid ${C.rule}`,
            fontFamily: fontSans, fontSize: 12, letterSpacing: "0.05em", color: C.ink, cursor: "pointer", borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <ClipboardPaste size={14} /> {pastedText.trim() ? "Edit pasted notes" : "Paste text"}
          </button>
          {images.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3 }}>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>📷 For best handwriting reading</div>
              <ul style={{ fontFamily: fontSerif, fontSize: 12, color: C.ink, lineHeight: 1.55, paddingLeft: 18, margin: 0 }}>
                <li>Straight-on (not angled)</li>
                <li>Good lighting (sunlight or bright lamp, no shadow on the page)</li>
                <li>Filling most of the frame (don't shoot a tiny portion of a big page)</li>
                <li>In focus (tap the screen to focus before snapping)</li>
              </ul>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setShowOcrEnhance(true)} style={{ padding: "6px 10px", background: C.ink, color: C.paper, border: "none", borderRadius: 2, fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  ✨ Transcribe handwriting (best-effort, multi-pass)
                </button>
                <button onClick={() => setEnhanceContrast((v) => !v)} title="Boost contrast and sharpen images before upload (helps faint pencil)" style={{ padding: "6px 10px", background: enhanceContrast ? C.moss : "transparent", color: enhanceContrast ? C.paper : C.ink, border: `1px solid ${enhanceContrast ? C.moss : C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 11, cursor: "pointer" }}>
                  {enhanceContrast ? "✓ Preprocessing on" : "Enable preprocessing"}
                </button>
              </div>
            </div>
          )}
          {images.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, overflowX: "auto" }}>
              {images.map((img, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <img src={img.preview} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 2, border: `1px solid ${C.rule}` }} />
                  <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, background: C.ink, color: C.paper, border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Vision-capability hint — when images are uploaded but the active local model can't read
              them. The non-vision local model would silently ignore the images and the user would
              wonder why their photo isn't being used. This hint surfaces the issue + offers fixes:
              1) Switch to Cloud AI (best quality, instant if API key configured)
              2) Use SmolVLM (free, offline, ~500 MB, works on Safari, much weaker than Claude)
              3) Remove images and proceed text-only */}
          {images.length > 0 && aiProvider === "webllm" && LOCAL_MODELS[webllmLoadedModel]?.tier !== "vision" && !smolVLMLoaded && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: C.blueSoft, border: `1px solid ${C.blue}`, borderRadius: 2, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Lightbulb size={14} color={C.blue} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.blue, letterSpacing: "0.08em", marginBottom: 4 }}>IMAGE READING</div>
                <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>
                  Your current local AI model{webllmLoadedModel ? ` (${LOCAL_MODELS[webllmLoadedModel]?.label})` : ""} can't read images. Pick one:
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, flexDirection: isMobile ? "column" : "row" }}>
                  {anthropicApiKey ? (
                    <Btn variant="primary" onClick={() => { setAiProvider("anthropic"); showToast("Switched to Cloud AI — images will be read by Claude"); }}>
                      Switch to Cloud AI (best quality)
                    </Btn>
                  ) : (
                    <Btn variant="primary" onClick={() => { setShowSettings(true); track("action", "image_hint_open_settings"); }}>
                      Set up Cloud AI (best quality)
                    </Btn>
                  )}
                  <Btn variant="ghost" onClick={() => { initSmolVLM().catch(() => {}); track("action", "smolvlm_init_from_hint"); }} disabled={smolVLMLoading}>
                    {smolVLMLoading ? <><Loader2 size={11} className="spin" /> Loading…</> : <>Load SmolVLM (~500 MB, offline)</>}
                  </Btn>
                  <button onClick={() => setImages([])} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: isMobile ? "8px 0" : 0, textAlign: isMobile ? "center" : "left" }}>
                    Remove images
                  </button>
                </div>
                <div style={{ fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", lineHeight: 1.5, marginTop: 4 }}>
                  Cloud AI (Claude) reads images, handwriting, diagrams excellently. SmolVLM is free + offline + Safari-friendly but much weaker — best for basic descriptions and printed text.
                </div>
                {smolVLMLoading && smolVLMStatus && (
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.blue, marginTop: 6 }}>
                    {smolVLMStatus} {smolVLMProgress > 0 && `(${Math.round(smolVLMProgress * 100)}%)`}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* SmolVLM loaded confirmation banner */}
          {images.length > 0 && aiProvider === "webllm" && LOCAL_MODELS[webllmLoadedModel]?.tier !== "vision" && smolVLMLoaded && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 2, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.moss }} />
              <div style={{ fontFamily: fontMono, fontSize: 11, color: C.moss, flex: 1 }}>
                SMOLVLM ACTIVE · images will be described locally before generation
              </div>
            </div>
          )}
          {pdfs.map((pdf, i) => (
            <FileChip key={i} icon={<FileIcon size={11} />} label={pdf.name} onRemove={() => removePdf(i)} color="accent" />
          ))}
          {textDocs.map((doc, i) => (
            <FileChip key={i} icon={<FileText size={11} />} label={doc.name} onRemove={() => removeTextDoc(i)} color="blue" />
          ))}
          {pastedText.trim() && (
            <FileChip icon={<ClipboardPaste size={11} />} label={`Pasted (${pastedText.trim().length} chars)`} onRemove={() => setPastedText("")} color="gold" />
          )}
        </div>

        {/* Level */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Level</SectionLabel>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontFamily: fontMono, color: C.inkMuted, marginBottom: 4 }}>SCHOOL</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { v: "elementary", label: "Elementary", sub: "K–5" },
                { v: "middle", label: "Middle", sub: "6–8" },
                { v: "easy", label: "High school", sub: "9–12" },
              ].map((d) => (
                <LevelBtn key={d.v} active={difficulty === d.v} onClick={() => setDifficulty(d.v)} label={d.label} sub={d.sub} />
              ))}
            </div>
            <div style={{ fontSize: 10, fontFamily: fontMono, color: C.inkMuted, marginTop: 10, marginBottom: 4 }}>UNIVERSITY+</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { v: "medium", label: "Undergrad" },
                { v: "hard", label: "Advanced" },
                { v: "expert", label: "Grad" },
                { v: "phd", label: "PhD" },
                { v: "frontier", label: "Frontier" },
              ].map((d) => (
                <LevelBtn key={d.v} active={difficulty === d.v} onClick={() => setDifficulty(d.v)} label={d.label} />
              ))}
            </div>
          </div>
        </div>

        {/* Power features */}
        {difficulty !== "elementary" && (
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.rule}` }}>
            <SectionLabel>Power</SectionLabel>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <PowerToggle enabled={deepMode} onToggle={() => setDeepMode(!deepMode)} icon={<Telescope size={14} />} title="Deep mode" desc="Extended reasoning + expertise framing. Slower but sharper." />
              <PowerToggle enabled={useWebSearch} onToggle={() => setUseWebSearch(!useWebSearch)} icon={<Globe size={14} />} title="Web search" desc="Pull in current research and primary sources." />
              <PowerToggle enabled={maxPower} onToggle={() => { const n = !maxPower; setMaxPower(n); if (n) { setDeepMode(true); setUseWebSearch(true); } }} icon={<Flame size={14} />} title="Max power" desc="3-stage pipeline: draft → critique → refine. Includes Deep + Web." />
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: C.accentSoft, color: C.accent, borderRadius: 2, fontSize: 14 }}>{error}</div>}

      {/* Study modifiers */}
      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <SectionLabel>Study modifiers <span style={{ fontFamily: fontSerif, fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: C.inkMuted, fontSize: 12 }}>— research-backed boosters</span></SectionLabel>
          <div style={{ flex: 1, height: 1, background: C.rule }} />
        </div>
        <div className="mode-grid stagger-grid" style={{ gap: 10 }}>
          <PowerToggle enabled={interleaved} onToggle={() => setInterleaved(!interleaved)} icon={<Repeat size={14} />} title="Interleave"
            desc="Mix sub-topics across the set. Harder now, much better for transfer." />
          <div style={{ padding: 12, border: `2px solid ${lastPrediction || showPrediction ? C.ink : C.rule}`, borderRadius: 2, background: lastPrediction || showPrediction ? C.paperDark : C.paperLight, cursor: showPrediction ? "default" : "pointer" }}
            onClick={() => { if (!showPrediction) setShowPrediction(true); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showPrediction ? 6 : 0 }}>
              <Lightbulb size={14} color={lastPrediction || showPrediction ? C.ink : C.inkMuted} />
              <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Predict first</span>
              {lastPrediction && <Pill color="gold">queued</Pill>}
              {!showPrediction && !lastPrediction && <span style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic", marginLeft: 4 }}>— click to write what you think the topic covers</span>}
            </div>
            {showPrediction && (
              <>
                <textarea value={predictionDraft} onChange={(e) => setPredictionDraft(e.target.value)} placeholder="In one sentence: what do you think this will cover?"
                  style={{ width: "100%", padding: 8, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 50 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="btn" onClick={() => { if (predictionDraft.trim()) { setLastPrediction(predictionDraft.trim()); setPredictionDraft(""); setShowPrediction(false); showToast("Prediction queued — the next generation will address it"); } }}
                    disabled={!predictionDraft.trim()} style={{ padding: "5px 10px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 11, color: C.ink, cursor: "pointer", opacity: predictionDraft.trim() ? 1 : 0.4 }}>
                    Queue prediction
                  </button>
                  <button className="btn" onClick={() => { setShowPrediction(false); setPredictionDraft(""); }} style={{ padding: "5px 10px", background: "transparent", border: "none", fontFamily: fontSans, fontSize: 11, color: C.inkMuted, cursor: "pointer" }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mode groups */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><SectionLabel>Quick study</SectionLabel><div style={{ flex: 1, height: 1, background: C.rule }} /></div>
        <div className="mode-grid" style={{ marginBottom: 20 }}>
          <ModeCard icon={<Zap size={18} />} title="Flashcards" desc="10 flip cards" onClick={() => generateContent("flashcards")} loading={loading && mode === "flashcards"} color="gold" />
          <ModeCard icon={<BookOpen size={18} />} title="Explain" desc="Deep concept" onClick={() => generateContent("explain")} loading={loading && mode === "explain"} color="moss" />
          <ModeCard icon={<ScrollText size={18} />} title="Cheat sheet" desc="One-page guide" onClick={() => generateContent("cheatsheet")} loading={loading && mode === "cheatsheet"} color="plum" />
          <ModeCard icon={<MessageCircle size={18} />} title="Tutor chat" desc="Live Q&A" onClick={() => generateContent("tutor")} loading={loading && mode === "tutor"} color="blue" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><SectionLabel>Test yourself</SectionLabel><div style={{ flex: 1, height: 1, background: C.rule }} /></div>
        <div className="mode-grid" style={{ marginBottom: 20 }}>
          {persistentProfile.weakSpots.length > 0 && (
            <ModeCard icon={<RotateCw size={18} />} title="Review mistakes" desc={`${persistentProfile.weakSpots.length} weak spot${persistentProfile.weakSpots.length === 1 ? "" : "s"}`}
              onClick={() => generateContent("errorReview")} loading={loading && mode === "errorReview"} color="accent" />
          )}
          <ModeCard icon={<Brain size={18} />} title="Practice" desc="6 MCQs w/ hints" onClick={() => generateContent("practice")} loading={loading && mode === "practice"} color="accent" />
          <ModeCard icon={<GraduationCap size={18} />} title="Exam" desc="10 mixed" onClick={() => generateContent("exam")} loading={loading && mode === "exam"} color="accent" />
          <ModeCard icon={<PenLine size={18} />} title="Free response" desc="Essay w/ rubric" onClick={() => generateContent("freeResponse")} loading={loading && mode === "freeResponse"} color="plum" />
          <ModeCard icon={<Repeat size={18} />} title="Active recall" desc="Type answers" onClick={() => generateContent("recall")} loading={loading && mode === "recall"} color="moss" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><SectionLabel>Advanced</SectionLabel><div style={{ flex: 1, height: 1, background: C.rule }} /></div>
        <div className="mode-grid" style={{ marginBottom: 20 }}>
          <ModeCard icon={<Sigma size={18} />} title="Derive" desc="Step-by-step proof" onClick={() => generateContent("derive")} loading={loading && mode === "derive"} color="blue" />
          <ModeCard icon={<Scale size={18} />} title="Critique" desc="Rigorous analysis" onClick={() => generateContent("critique")} loading={loading && mode === "critique"} color="gold" />
          <ModeCard icon={<Target size={18} />} title="Diagnostic" desc="Find weak spots" onClick={() => generateContent("diagnostic")} loading={loading && mode === "diagnostic"} color="accent" />
          <ModeCard icon={<Workflow size={18} />} title="Curriculum" desc="Multi-week plan tuned to your level — no class required" onClick={() => generateContent("curriculum")} loading={loading && mode === "curriculum"} color="moss" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><SectionLabel>Structure</SectionLabel><div style={{ flex: 1, height: 1, background: C.rule }} /></div>
        <div className="mode-grid">
          <ModeCard icon={<Network size={18} />} title="Concept map" desc="Knowledge graph" onClick={() => generateContent("conceptMap")} loading={loading && mode === "conceptMap"} color="plum" />
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Notebook-style outputs <span style={{ color: C.inkMuted, fontWeight: 400 }}>· presentations, briefings, audio overviews</span></SectionLabel>
        <div className="mode-grid">
          <ModeCard icon={<Mic size={18} />} title="Audio Overview" desc="Podcast-style two-host conversation" onClick={() => generateContent("audioOverview")} loading={loading && mode === "audioOverview"} color="blue" />
          <ModeCard icon={<GitBranch size={18} />} title="Mind Map" desc="Interactive hierarchical view" onClick={() => generateContent("mindMap")} loading={loading && mode === "mindMap"} color="plum" />
          <ModeCard icon={<FileText size={18} />} title="Briefing Document" desc="Executive report with bottom line" onClick={() => generateContent("briefing")} loading={loading && mode === "briefing"} color="accent" />
          <ModeCard icon={<Presentation size={18} />} title="Slide Deck" desc="Presentation, prev/next nav" onClick={() => generateContent("slideDeck")} loading={loading && mode === "slideDeck"} color="moss" />
          <ModeCard icon={<Table size={18} />} title="Data Table" desc="Structured comparison matrix" onClick={() => generateContent("dataTable")} loading={loading && mode === "dataTable"} color="blue" />
        </div>
      </div>

      {/* Pipeline progress */}
      {loading && maxPower && generationLog.length > 0 && (
        <div style={{ marginTop: 20, padding: 16, background: C.ink, color: C.paper, borderRadius: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Flame size={14} color={C.goldSoft} />
            <SectionLabel style={{ color: C.gold }}>Multi-agent pipeline</SectionLabel>
          </div>
          {generationLog.map((entry, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "4px 0" }}>
              {entry.status === "running" ? <Loader2 size={14} className="spin" /> : <Check size={14} color={C.mossSoft} />}
              <span style={{ color: entry.status === "running" ? C.paper : C.inkMuted }}>{entry.stage}</span>
            </div>
          ))}
        </div>
      )}

      {/* Substantive loading: a study tip while you wait */}
      {loading && !maxPower && (() => {
        const tip = SKILLS_OF_DAY[Math.floor(Date.now() / 4000) % SKILLS_OF_DAY.length];
        return (
          <div style={{ marginTop: 20, padding: 18, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Loader2 size={14} className="spin" color={C.inkSoft} />
              <SectionLabel>While you wait — a study technique</SectionLabel>
            </div>
            <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, marginTop: 6, marginBottom: 4 }}>{tip.name}</div>
            <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{tip.body}</div>
          </div>
        );
      })()}

      <p style={{ marginTop: 24, fontSize: 10, color: C.inkMuted, textAlign: "center", fontFamily: fontMono, letterSpacing: "0.1em" }}>
        {loading && deepMode && thinkingStage ? thinkingStage.toUpperCase() : "POWERED BY CLAUDE OPUS 4.7"}
      </p>
    </div>
  );


  // ============ TUTOR — CONTENT RENDERERS ============
  const renderTutorContent = () => {
    // Flashcards
    if (mode === "flashcards" && content) {
      const card = content[cardIndex];
      const progress = ((cardIndex + 1) / content.length) * 100;
      return (
        <ContentShell onBack={resetToHome} progress={progress} label={`Card ${cardIndex + 1} of ${content.length}`} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div onClick={() => setFlipped(!flipped)} style={{ cursor: "pointer", perspective: "1000px", aspectRatio: "3/2", marginBottom: 24 }}>
            <div style={{ position: "relative", width: "100%", height: "100%", transition: "transform 0.5s", transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              <CardFace front title="Question" content={card.front} />
              <CardFace back title="Answer" content={card.back} />
            </div>
          </div>
          {flipped && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel style={{ textAlign: "center", marginBottom: 8 }}>How did you do?</SectionLabel>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { q: 1, label: "Forgot", color: "accent", days: "again" },
                  { q: 3, label: "Hard", color: "gold", days: "1d" },
                  { q: 4, label: "Good", color: "moss", days: "" },
                  { q: 5, label: "Easy", color: "blue", days: "" },
                ].map(({ q, label, color, days }) => {
                  const palette = { accent: { bg: C.accentSoft, fg: C.accent }, gold: { bg: C.goldSoft, fg: C.gold }, moss: { bg: C.mossSoft, fg: C.moss }, blue: { bg: C.blueSoft, fg: C.blue } }[color];
                  return (
                    <button key={q} className="btn" onClick={() => {
                      rateCard(card.front, q, card.back, topic);
                      const k = new Set(knownCards);
                      if (q >= 4) k.add(cardIndex); else k.delete(cardIndex);
                      setKnownCards(k);
                      setSessionStats((s) => ({ ...s, cardsReviewed: s.cardsReviewed + 1, cardsMastered: s.cardsMastered + (q >= 4 ? 1 : 0) }));
                      if (cardIndex < content.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); }
                    }} style={{
                      padding: "10px 18px", background: palette.bg, color: palette.fg, border: `1px solid ${palette.fg}`,
                      fontFamily: fontSans, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", borderRadius: 2,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      {label}{days ? ` · ${days}` : ""}
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", marginTop: 8, fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em" }}>SCHEDULED VIA SM-2</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => { if (cardIndex > 0) { setCardIndex(cardIndex - 1); setFlipped(false); } }} disabled={cardIndex === 0} style={navBtnStyle(cardIndex === 0)}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontFamily: fontMono, fontSize: 12, color: C.inkMuted }}>{knownCards.size} / {content.length} known</span>
            <button onClick={() => { if (cardIndex < content.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); } }} disabled={cardIndex === content.length - 1} style={navBtnStyle(cardIndex === content.length - 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </ContentShell>
      );
    }

    // Explain
    if (mode === "explain" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 36, borderRadius: 4 }}>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 44, fontWeight: 400, marginBottom: 10, letterSpacing: "-0.01em", color: C.ink }}>{content.title}</h1>
            <p style={{ fontFamily: fontSerif, fontSize: 18, fontStyle: "italic", color: C.inkSoft, marginBottom: 32, lineHeight: 1.5 }}>
              <RichText>{content.summary}</RichText>
            </p>
            {content.sections?.map((section, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${C.gold}`, paddingLeft: 20, marginBottom: 24 }}>
                <SectionLabel style={{ marginBottom: 8 }}>{String(i + 1).padStart(2, "0")} — {section.heading}</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 16, color: C.ink, lineHeight: 1.7 }}>
                  <RichText>{section.content}</RichText>
                </div>
              </div>
            ))}
            {content.analogy && (
              <div style={{ background: C.goldSoft, border: `1px solid ${C.gold}`, padding: 20, borderRadius: 2, marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Lightbulb size={14} color={C.gold} />
                  <SectionLabel style={{ color: C.gold }}>Think of it like...</SectionLabel>
                </div>
                <div style={{ fontFamily: fontSerif, fontStyle: "italic", fontSize: 17, color: C.ink, lineHeight: 1.6 }}>{content.analogy}</div>
              </div>
            )}
            {content.commonMisconceptions?.length > 0 && (
              <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}`, padding: 20, borderRadius: 2, marginTop: 16 }}>
                <SectionLabel style={{ color: C.accent, marginBottom: 8 }}>Common misconceptions</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: 16, fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.8 }}>
                  {content.commonMisconceptions.map((m, i) => <li key={i}><RichText>{m}</RichText></li>)}
                </ul>
              </div>
            )}
            {content.keyTakeaways && (
              <div style={{ marginTop: 24 }}>
                <SectionLabel style={{ marginBottom: 12 }}>Key takeaways</SectionLabel>
                {content.keyTakeaways.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.6 }}>
                    <span style={{ color: C.accent }}>→</span><RichText>{t}</RichText>
                  </div>
                ))}
              </div>
            )}
          </div>
          {sources.length > 0 && <SourcesPanel sources={sources} />}
        </ContentShell>
      );
    }

    // Practice / Exam / Diagnostic
    if (["practice", "exam", "diagnostic", "errorReview"].includes(mode) && content) {
      const problem = content[problemIndex];
      const isLast = problemIndex === content.length - 1;
      const correct = selectedAnswer === problem.correctIndex;
      if (problemIndex >= content.length) return null;
      const labelPrefix = mode === "exam" ? "Exam" : mode === "diagnostic" ? "Diagnostic" : "Problem";

      return (
        <ContentShell onBack={resetToHome} topic={topic} progress={((problemIndex + (submitted ? 1 : 0)) / content.length) * 100} label={`${labelPrefix} ${problemIndex + 1} of ${content.length}`} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <SectionLabel>Question {problemIndex + 1}</SectionLabel>
                {problem.level && <Pill color={problem.level === "easy" ? "moss" : problem.level === "hard" ? "accent" : "gold"}>{problem.level}</Pill>}
              </div>
              <span style={{ fontSize: 13, color: C.inkMuted, fontFamily: fontMono }}>{score.correct}/{score.total}</span>
            </div>
            <div style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 400, marginBottom: 28, lineHeight: 1.3 }}>
              <RichText>{problem.question}</RichText>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {problem.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = i === problem.correctIndex;
                let bg = C.paperLight, border = C.rule, color = C.ink;
                if (submitted) {
                  if (isCorrect) { bg = C.mossSoft; border = C.moss; }
                  else if (isSelected) { bg = C.accentSoft; border = C.accent; }
                  else { bg = C.paperLight; }
                } else if (isSelected) { bg = C.paperDark; border = C.ink; }
                return (
                  <button key={i} onClick={() => !submitted && setSelectedAnswer(i)} disabled={submitted} style={{
                    padding: "16px 18px", background: bg, border: `2px solid ${border}`, borderRadius: 2,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 14, cursor: submitted ? "default" : "pointer",
                    fontFamily: fontSerif, fontSize: 16, color, transition: "all 0.15s",
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%", border: `1px solid ${border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: fontMono, fontSize: 12, color: isCorrect && submitted ? C.moss : isSelected && submitted && !isCorrect ? C.accent : C.inkSoft,
                      background: C.paper, flexShrink: 0,
                    }}>
                      {submitted && isCorrect ? <Check size={14} /> : submitted && isSelected && !isCorrect ? <X size={14} /> : String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1 }}><RichText>{opt}</RichText></span>
                  </button>
                );
              })}
            </div>

            {!submitted && hints.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {hints.map((h, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: C.blueSoft, color: C.blue, borderRadius: 2, fontSize: 13, marginBottom: 6 }}>
                    <strong>Hint {i + 1}: </strong>{h}
                  </div>
                ))}
              </div>
            )}

            {!submitted && selectedAnswer !== null && (
              <div style={{ padding: "12px 14px", background: C.paperDark, borderRadius: 3, marginBottom: 14 }}>
                <SectionLabel style={{ marginBottom: 8 }}>How sure are you?</SectionLabel>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { v: 1, label: "Guess" },
                    { v: 2, label: "Unsure" },
                    { v: 3, label: "Maybe" },
                    { v: 4, label: "Pretty sure" },
                    { v: 5, label: "Certain" },
                  ].map((c) => (
                    <button key={c.v} className="btn" onClick={() => setPendingConfidence(c.v)} style={{
                      flex: 1, padding: "6px 8px", border: `1px solid ${pendingConfidence === c.v ? C.ink : C.rule}`,
                      background: pendingConfidence === c.v ? C.ink : C.paper, color: pendingConfidence === c.v ? C.paper : C.inkSoft,
                      fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 2,
                    }}>{c.v} · {c.label}</button>
                  ))}
                </div>
              </div>
            )}

            {!submitted && hintsShown < 3 && (
              <button onClick={requestHint} disabled={loadingHint} style={{
                marginBottom: 16, padding: "8px 14px", background: C.blueSoft, color: C.blue, border: "none",
                borderRadius: 2, fontFamily: fontSans, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {loadingHint ? <Loader2 size={12} /> : <HelpCircle size={12} />}
                {loadingHint ? "Thinking..." : `Get hint (${hintsShown}/3)`}
              </button>
            )}

            {submitted && (
              <div style={{ background: correct ? C.mossSoft : C.goldSoft, border: `1px solid ${correct ? C.moss : C.gold}`, padding: 18, borderRadius: 2, marginBottom: 20 }}>
                <SectionLabel style={{ color: correct ? C.moss : C.gold, marginBottom: 6 }}>{correct ? "Correct!" : "Not quite."}</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.6 }}>
                  <RichText>{problem.explanation}</RichText>
                </div>
                {!correct && !steelmanExplanations[problemIndex] && (
                  <button onClick={() => requestSteelman(selectedAnswer)} disabled={loadingSteelman} style={{
                    marginTop: 14, padding: "6px 12px", background: C.paper, color: C.ink, border: `1px solid ${C.rule}`,
                    borderRadius: 2, fontFamily: fontSans, fontSize: 11, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    {loadingSteelman ? "Thinking..." : "Why was my answer tempting?"}
                  </button>
                )}
                {steelmanExplanations[problemIndex] && (
                  <div style={{ marginTop: 14, padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2 }}>
                    <SectionLabel style={{ marginBottom: 6 }}>Steelman</SectionLabel>
                    <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                      <RichText>{steelmanExplanations[problemIndex]}</RichText>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!submitted ? (
              <Btn variant="primary" onClick={() => {
                if (selectedAnswer === null) return;
                setSubmitted(true);
                const isC = selectedAnswer === problem.correctIndex;
                setScore({ correct: score.correct + (isC ? 1 : 0), total: score.total + 1 });
                setSessionStats((s) => ({ ...s, questionsAnswered: s.questionsAnswered + 1, questionsCorrect: s.questionsCorrect + (isC ? 1 : 0) }));
                // Calibration: record felt confidence vs actual correctness
                if (pendingConfidence !== null) {
                  setCalibration((prev) => [...prev, { confidence: pendingConfidence, correct: isC, ts: Date.now() }].slice(-200));
                  setPendingConfidence(null);
                }
                if (!isC) {
                  const wTopic = problem.topicArea || problem.skill || "general";
                  setWeaknesses((p) => [...p, { topicArea: wTopic, missedAt: Date.now() }]);
                  addWeakSpot(wTopic);
                  // Track for the mastery-check flow
                  setMissedProblems((prev) => [...prev, { problem, theirAnswer: selectedAnswer }]);
                } else if (problem.topicArea && persistentProfile.weakSpots.find(w => w.topic === problem.topicArea)) {
                  markMastered(problem.topicArea);
                }
              }} disabled={selectedAnswer === null} style={{ width: "100%", padding: "14px" }}>
                Submit answer
              </Btn>
            ) : isLast ? (
              (() => {
                const pct = score.total > 0 ? score.correct / score.total : 0;
                const mastered = pct >= 0.8;
                const perfect = pct === 1.0;
                const tiers = ["elementary", "middle", "easy", "medium", "hard", "expert", "phd", "frontier"];
                const tierLabels = { elementary: "Elementary", middle: "Middle school", easy: "High school", medium: "Undergrad", hard: "Advanced", expert: "Grad", phd: "PhD", frontier: "Frontier" };
                // When in a mastery check, the "next tier" is computed off the SOURCE tier, not the current one (which is the same anyway, but explicit)
                const tierForLevelUp = inMasteryCheck && masteryCheckSourceTier ? masteryCheckSourceTier : difficulty;
                const curIdx = tiers.indexOf(tierForLevelUp);
                const atTop = curIdx === tiers.length - 1;
                const nextTier = mastered && !atTop ? tiers[curIdx + 1] : null;

                // CASE A: in mastery check — evaluate the mini-quiz result
                if (inMasteryCheck) {
                  if (perfect) {
                    return (
                      <div style={{ padding: 18, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3, marginBottom: 12 }}>
                        <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>Mastery confirmed — {atTop ? "you're at the top tier" : "leveling up"}</SectionLabel>
                        <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}>
                          You aced the mastery check ({score.correct}/{score.total}). The concepts you missed earlier are locked in.
                          {nextTier ? <> Bumping difficulty to <strong>{tierLabels[nextTier]}</strong>.</> : <> Already at <strong>{tierLabels[difficulty]}</strong>, the top of the ladder.</>}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                          {nextTier ? (
                            <Btn variant="primary" onClick={() => { setInMasteryCheck(false); setMissedProblems([]); setMasteryCheckSourceTier(null); setDifficulty(nextTier); showToast(`Leveling up to ${tierLabels[nextTier]}`); setTimeout(() => generateContent(mode), 60); }}>
                              Generate 10 harder <ArrowRight size={14} />
                            </Btn>
                          ) : (
                            <Btn variant="primary" onClick={() => { exitMasteryCheck(); generateContent(mode); }}>Try 10 more at this level</Btn>
                          )}
                          <Btn variant="ghost" onClick={() => { exitMasteryCheck(); resetToHome(); }}>Back to topic</Btn>
                        </div>
                      </div>
                    );
                  }
                  // Mastery check missed some — gaps remain, stay at this level
                  return (
                    <div style={{ padding: 18, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3, marginBottom: 12 }}>
                      <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Still some gaps — staying at this level</SectionLabel>
                      <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}>
                        Mastery check: {score.correct}/{score.total} ({Math.round(pct * 100)}%). The concepts haven't fully clicked yet — let's keep working at <strong>{tierLabels[difficulty]}</strong> before leveling up.
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <Btn variant="primary" onClick={() => { exitMasteryCheck(); generateContent(mode); }}>Try 10 fresh at this level</Btn>
                        <Btn variant="ghost" onClick={() => { exitMasteryCheck(); resetToHome(); }}>Back to topic</Btn>
                      </div>
                    </div>
                  );
                }

                // CASE B: Perfect score — direct level-up, no review needed
                if (perfect && nextTier) {
                  return (
                    <div style={{ padding: 18, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3, marginBottom: 12 }}>
                      <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>Perfect score — leveling up</SectionLabel>
                      <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}>
                        {score.correct}/{score.total} (100%). Clean sweep — no review needed. Bumping to <strong>{tierLabels[nextTier]}</strong>.
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <Btn variant="primary" onClick={() => { setDifficulty(nextTier); showToast(`Leveling up to ${tierLabels[nextTier]}`); setTimeout(() => generateContent(mode), 60); }}>
                          Generate 10 harder <ArrowRight size={14} />
                        </Btn>
                        <Btn variant="ghost" onClick={resetToHome}>Back to topic</Btn>
                      </div>
                    </div>
                  );
                }

                // CASE C: High but not perfect — REVIEW + MASTERY CHECK
                if (mastered && !perfect && missedProblems.length > 0) {
                  return (
                    <div style={{ padding: 18, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3, marginBottom: 12 }}>
                      <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>Strong — let's lock in what you missed first</SectionLabel>
                      <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>
                        You got <strong>{score.correct}/{score.total}</strong> ({Math.round(pct * 100)}%). Quick review of the {missedProblems.length} you missed{nextTier ? <>, then a mastery check before we level you up to <strong>{tierLabels[nextTier]}</strong>.</> : <>.</>}
                      </div>
                      {/* Review panel */}
                      <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 3, marginBottom: 12 }}>
                        {missedProblems.map((m, i) => (
                          <div key={i} style={{ padding: 14, borderBottom: i < missedProblems.length - 1 ? `1px solid ${C.rule}` : "none" }}>
                            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", marginBottom: 4 }}>MISSED · {m.problem.topicArea || m.problem.skill || "general"}</div>
                            <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 500, marginBottom: 8, color: C.ink, lineHeight: 1.5 }}>{m.problem.question}</div>
                            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: fontMono, fontSize: 11, padding: "3px 8px", background: C.accentSoft || "#FCE7E0", color: C.accent, borderRadius: 2 }}>Your pick: {m.problem.options?.[m.theirAnswer] || "—"}</span>
                              <span style={{ fontFamily: fontMono, fontSize: 11, padding: "3px 8px", background: C.mossSoft, color: C.moss, borderRadius: 2 }}>Correct: {m.problem.options?.[m.problem.correctIndex] || "—"}</span>
                            </div>
                            {m.problem.explanation && (
                              <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", lineHeight: 1.5, padding: "8px 10px", background: C.paperLight, borderRadius: 2 }}>
                                {m.problem.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Btn variant="primary" onClick={runMasteryCheck} disabled={masteryCheckLoading}>
                          {masteryCheckLoading ? <><Loader2 size={12} className="spin" /> Building mastery check…</> : <>Quick mastery check ({missedProblems.length}Q) <ArrowRight size={14} /></>}
                        </Btn>
                        {nextTier && (
                          <Btn variant="ghost" onClick={() => { exitMasteryCheck(); setDifficulty(nextTier); showToast(`Leveling up to ${tierLabels[nextTier]}`); setTimeout(() => generateContent(mode), 60); }}>
                            Skip — level me up directly
                          </Btn>
                        )}
                        <Btn variant="ghost" onClick={() => { exitMasteryCheck(); resetToHome(); }}>Back to topic</Btn>
                      </div>
                    </div>
                  );
                }

                // CASE D: Below 80% — existing "not quite" message
                return (
                  <div style={{ padding: 18, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3, marginBottom: 12 }}>
                    <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Not quite mastery yet</SectionLabel>
                    <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}>
                      You got <strong>{score.correct}/{score.total}</strong> ({Math.round(pct * 100)}%). 80% unlocks the next tier — try another set at this level.
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <Btn variant="primary" onClick={() => generateContent(mode)}>Try 10 more at this level</Btn>
                      <Btn variant="ghost" onClick={resetToHome}>Back to topic</Btn>
                    </div>
                  </div>
                );
              })()
            ) : (
              <Btn variant="primary" onClick={() => { setProblemIndex(problemIndex + 1); setSelectedAnswer(null); setSubmitted(false); }} style={{ width: "100%", padding: "14px" }}>
                Next question <ArrowRight size={14} />
              </Btn>
            )}
          </div>
        </ContentShell>
      );
    }

    // Cheat sheet
    if (mode === "cheatsheet" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 400, marginBottom: 6 }}>{content.title}</h1>
            <SectionLabel style={{ marginBottom: 24 }}>One-page reference</SectionLabel>
            {content.mustRemember?.length > 0 && (
              <div style={{ background: C.plumSoft, border: `2px solid ${C.plum}`, padding: 18, borderRadius: 2, marginBottom: 24 }}>
                <SectionLabel style={{ color: C.plum, marginBottom: 10 }}>Must remember</SectionLabel>
                <ol style={{ margin: 0, paddingLeft: 20, fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.7 }}>
                  {content.mustRemember.map((m, i) => <li key={i}><RichText>{m}</RichText></li>)}
                </ol>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {content.sections?.map((s, i) => (
                <div key={i} style={{ border: `1px solid ${C.rule}`, padding: 16, borderRadius: 2 }}>
                  <SectionLabel style={{ marginBottom: 10 }}>{s.heading}</SectionLabel>
                  {s.items?.map((it, j) => (
                    <div key={j} style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600, color: C.ink }}>{it.term}</div>
                      <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
                        <RichText>{it.definition}</RichText>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {content.keyFormulas?.length > 0 && (
              <div style={{ background: C.ink, color: C.paper, padding: 20, borderRadius: 2 }}>
                <SectionLabel style={{ color: C.gold, marginBottom: 10 }}>Key formulas</SectionLabel>
                <div style={{ fontFamily: fontMono, fontSize: 13, lineHeight: 1.8 }}>
                  {content.keyFormulas.map((f, i) => <div key={i}>→ <RichText>{f}</RichText></div>)}
                </div>
              </div>
            )}
          </div>
        </ContentShell>
      );
    }

    // Audio Overview — two-host conversation script with TTS playback
    if (mode === "audioOverview" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.blue }}>Audio overview · ~{content.estimatedMinutes || 6} min conversation</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, marginTop: 6, marginBottom: 10 }}>{content.title || topic}</h1>
            {content.intro && <p style={{ fontFamily: fontSerif, fontSize: 15, color: C.inkSoft, fontStyle: "italic", marginBottom: 20, lineHeight: 1.6 }}><RichText>{content.intro}</RichText></p>}
            {/* Playback controls */}
            <AudioOverviewPlayer turns={content.turns || []} title={content.title || topic} />
            {/* Transcript */}
            <SectionLabel style={{ marginBottom: 10, marginTop: 18 }}>Transcript</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(content.turns || []).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: 12, background: t.speaker === "A" ? C.paperDark : C.paper, border: `1px solid ${C.rule}`, borderRadius: 3 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.speaker === "A" ? C.blue : C.moss, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontMono, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{t.speaker}</div>
                  <div style={{ flex: 1, fontFamily: fontSerif, fontSize: 14, lineHeight: 1.6, color: C.ink }}><RichText>{t.text}</RichText></div>
                </div>
              ))}
            </div>
            {content.takeaway && (
              <div style={{ marginTop: 20, padding: 16, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3 }}>
                <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>Takeaway</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}><RichText>{content.takeaway}</RichText></div>
              </div>
            )}
            <div style={{ marginTop: 18, padding: "10px 14px", background: C.paperDark, borderRadius: 3, fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic" }}>
              Voices use your browser's built-in TTS (free but robotic). For NotebookLM-quality voices, copy the transcript and paste into ElevenLabs, OpenAI TTS, or any premium voice service.
            </div>
          </div>
        </ContentShell>
      );
    }

    // Mind Map — interactive SVG hierarchical view
    if (mode === "mindMap" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 24, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.plum }}>Mind map</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 400, marginTop: 6, marginBottom: 16 }}>{topic}</h1>
            <MindMapView data={content} />
          </div>
        </ContentShell>
      );
    }

    // Briefing Document — executive report
    if (mode === "briefing" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 36, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.accent }}>Executive briefing</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 500, marginTop: 6, marginBottom: 4, lineHeight: 1.2 }}>{content.title}</h1>
            {content.subtitle && <div style={{ fontFamily: fontSerif, fontSize: 16, color: C.inkSoft, fontStyle: "italic", marginBottom: 24 }}>{content.subtitle}</div>}
            {content.bottomLine && (
              <div style={{ padding: 18, background: C.ink, color: C.paper, borderRadius: 3, marginBottom: 24 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: "0.15em", marginBottom: 6, opacity: 0.7 }}>BOTTOM LINE</div>
                <div style={{ fontFamily: fontSerif, fontSize: 16, lineHeight: 1.55 }}><RichText>{content.bottomLine}</RichText></div>
              </div>
            )}
            {content.keyFindings?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Key findings</SectionLabel>
                <ol style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.7, paddingLeft: 22, margin: 0 }}>
                  {content.keyFindings.map((f, i) => <li key={i} style={{ marginBottom: 6 }}><RichText>{f}</RichText></li>)}
                </ol>
              </div>
            )}
            {content.context && (
              <div style={{ marginBottom: 24 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Context</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.7 }}><RichText>{content.context}</RichText></div>
              </div>
            )}
            {content.details?.map((sec, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 500, marginBottom: 8 }}>{sec.heading}</h3>
                <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.7, color: C.inkSoft }}><RichText>{sec.body}</RichText></div>
              </div>
            ))}
            {content.implications?.length > 0 && (
              <div style={{ marginBottom: 24, padding: 16, background: C.mossSoft, borderRadius: 3 }}>
                <SectionLabel style={{ color: C.moss, marginBottom: 8 }}>Implications</SectionLabel>
                <ul style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.65, paddingLeft: 18, margin: 0 }}>
                  {content.implications.map((i, k) => <li key={k} style={{ marginBottom: 4 }}><RichText>{i}</RichText></li>)}
                </ul>
              </div>
            )}
            {content.openQuestions?.length > 0 && (
              <div style={{ marginBottom: 16, padding: 16, background: C.goldSoft, borderRadius: 3 }}>
                <SectionLabel style={{ color: C.gold, marginBottom: 8 }}>Open questions</SectionLabel>
                <ul style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.65, paddingLeft: 18, margin: 0 }}>
                  {content.openQuestions.map((q, k) => <li key={k} style={{ marginBottom: 4 }}><RichText>{q}</RichText></li>)}
                </ul>
              </div>
            )}
            {content.sourcesConsulted?.length > 0 && (
              <div style={{ paddingTop: 16, borderTop: `1px solid ${C.rule}` }}>
                <SectionLabel style={{ marginBottom: 8 }}>Sources consulted</SectionLabel>
                <ul style={{ fontFamily: fontMono, fontSize: 12, color: C.inkMuted, lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                  {content.sourcesConsulted.map((s, k) => <li key={k}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        </ContentShell>
      );
    }

    // Slide Deck — prev/next navigation + print-as-handout
    if (mode === "slideDeck" && content) {
      // ============ PRINT AS HANDOUT ============
      // Opens a print-friendly window with 6 slides per page (3×2 grid) and speaker notes
      // below each slide. Uses window.print() via the new window so the user can save as PDF
      // or print physically. No image generation — pure HTML/CSS.
      const printAsHandout = () => {
        const slides = content.slides || [];
        if (slides.length === 0) { showToast("No slides to print"); return; }
        const w = window.open("", "_blank", "width=1200,height=900");
        if (!w) { showToast("Pop-up blocked — allow pop-ups for this site"); return; }
        const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const slideHtml = slides.map((s, i) => `
          <div class="slide">
            <div class="slide-card">
              <div class="slide-num">${i + 1} / ${slides.length}</div>
              <h2 class="slide-title">${esc(s.title || "")}</h2>
              ${s.bullets && s.bullets.length > 0
                ? `<ul class="slide-bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
                : (s.body ? `<p class="slide-body">${esc(s.body)}</p>` : "")}
            </div>
            ${s.notes ? `<div class="slide-notes"><span class="notes-label">Notes</span>${esc(s.notes)}</div>` : ""}
          </div>
        `).join("");
        w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(content.title || "Slide deck")} — Handout</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1c1a17; background: #fff; margin: 0; padding: 24px; }
  .handout-header { border-bottom: 2px solid #1c1a17; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: baseline; }
  .handout-title { font-family: "Cormorant Garamond", Georgia, serif; font-size: 22pt; font-weight: 600; margin: 0; }
  .handout-meta { font-family: "Work Sans", Helvetica, sans-serif; font-size: 9pt; color: #555; letter-spacing: 0.06em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .slide { break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; gap: 6px; }
  .slide-card { border: 1px solid #1c1a17; padding: 10px 12px; background: #fff; aspect-ratio: 4/3; display: flex; flex-direction: column; overflow: hidden; }
  .slide-num { font-family: "Work Sans", Helvetica, sans-serif; font-size: 8pt; color: #999; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
  .slide-title { font-family: "Cormorant Garamond", Georgia, serif; font-size: 13pt; font-weight: 600; margin: 0 0 6px; line-height: 1.2; }
  .slide-bullets { font-size: 9pt; line-height: 1.4; padding-left: 16px; margin: 0; }
  .slide-bullets li { margin-bottom: 3px; }
  .slide-body { font-size: 9pt; line-height: 1.5; margin: 0; }
  .slide-notes { font-size: 8pt; line-height: 1.4; color: #444; padding: 6px 8px; background: #f5f1e8; border-left: 2px solid #a88438; }
  .notes-label { font-family: "Work Sans", Helvetica, sans-serif; font-size: 7pt; color: #a88438; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px; }
  @media print { body { padding: 0; } .handout-header { margin-bottom: 12px; } }
</style></head>
<body>
  <div class="handout-header">
    <h1 class="handout-title">${esc(content.title || "Slide deck")}</h1>
    <span class="handout-meta">${slides.length} slides · ${esc(topic)} · ${new Date().toLocaleDateString()}</span>
  </div>
  <div class="grid">${slideHtml}</div>
  <script>setTimeout(() => window.print(), 350);<\/script>
</body></html>`);
        w.document.close();
        track("action", "slide_deck_print_handout", { slides: slides.length });
      };
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <Btn variant="ghost" onClick={printAsHandout} style={{ fontSize: 11 }}>
              <Printer size={12} /> Print as handout (6-up)
            </Btn>
          </div>
          <SlideDeckView deck={content} />
        </ContentShell>
      );
    }

    // Data Table — structured table view
    if (mode === "dataTable" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 28, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.blue }}>Data table</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 400, marginTop: 6, marginBottom: 8 }}>{content.title}</h1>
            {content.description && <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, fontStyle: "italic", marginBottom: 18, lineHeight: 1.55 }}>{content.description}</p>}
            <div style={{ overflowX: "auto", border: `1px solid ${C.rule}`, borderRadius: 3 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSerif, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.ink, color: C.paper }}>
                    {(content.columns || []).map((col, i) => (
                      <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontFamily: fontMono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(content.rows || []).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? C.paper : C.paperDark, borderBottom: `1px solid ${C.rule}` }}>
                      {(row.values || []).map((v, j) => (
                        <td key={j} style={{ padding: "10px 14px", verticalAlign: "top", lineHeight: 1.5 }}>
                          <RichText>{String(v)}</RichText>
                          {j === (row.values || []).length - 1 && row.notes && (
                            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 4, fontStyle: "italic" }}>{row.notes}</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {content.footnotes?.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, background: C.paperDark, borderRadius: 2 }}>
                <SectionLabel style={{ marginBottom: 6 }}>Notes</SectionLabel>
                <ol style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                  {content.footnotes.map((n, k) => <li key={k}>{n}</li>)}
                </ol>
              </div>
            )}
          </div>
        </ContentShell>
      );
    }

    return null;
  };


  const renderTutorAdvanced = () => {
    // Tutor chat
    if (mode === "tutor" && content) {
      const quickPrompts = [
        { label: "Make flashcards", prompt: "Make me flashcards on " + (topic || "this topic") },
        { label: "Quiz me", prompt: "Quiz me with practice problems on " + (topic || "this topic") },
        { label: "Explain it", prompt: "Explain " + (topic || "this topic") + " step by step" },
        { label: "How am I doing?", prompt: "Show my stats" },
      ];
      return (
        <ContentShell onBack={resetToHome} topic={topic || "Tutor"} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, display: "flex", flexDirection: "column", height: "70vh" }}>
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ width: 48, height: 48, background: C.blueSoft, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <MessageCircle size={22} color={C.blue} />
                  </div>
                  <div style={{ fontFamily: fontDisplay, fontSize: 24, fontWeight: 400, marginBottom: 8 }}>I'm your study buddy.</div>
                  <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkMuted, maxWidth: 380, margin: "0 auto 20px" }}>
                    Ask me anything. I can explain, quiz you, make flashcards, build study plans — just say the word.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 400, margin: "0 auto" }}>
                    {quickPrompts.map((qp, i) => (
                      <button key={i} onClick={() => sendChatMessage(qp.prompt)} style={{
                        padding: "6px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, fontFamily: fontSans, fontSize: 11, cursor: "pointer", borderRadius: 2, color: C.ink,
                      }}>{qp.label}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  <div style={{
                    maxWidth: "82%", padding: "12px 16px", borderRadius: 4,
                    background: m.role === "user" ? C.ink : C.paperDark,
                    color: m.role === "user" ? C.paper : C.ink,
                    fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6,
                    position: "relative",
                  }}>
                    <RichText>{m.content}</RichText>
                    {m.streaming && (
                      // Animated cursor at the end of streaming local-model replies
                      <span style={{ display: "inline-block", width: 7, height: 14, background: C.gold, marginLeft: 2, verticalAlign: "middle", animation: "blink 0.9s infinite" }} />
                    )}
                    {m.streaming && webllmStats.running && webllmStats.tokensPerSec > 0 && (
                      <div style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted, marginTop: 6, letterSpacing: "0.06em" }}>
                        {webllmStats.tokensPerSec} tok/s · {webllmStats.totalTokens} tokens
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && !chatMessages.some((m) => m.streaming) && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "12px 16px", background: C.paperDark, borderRadius: 4 }}>
                    <Loader2 size={14} className="spin" />
                  </div>
                </div>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.rule}`, padding: 14, display: "flex", gap: 8, alignItems: "center" }}>
              {recognitionRef.current && (
                <button onClick={toggleListening} style={{
                  width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: listening ? C.accent : C.paperDark, color: listening ? C.paper : C.ink,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder='Ask anything — try "quiz me"'
                disabled={chatLoading}
                style={{ flex: 1, padding: "10px 16px", background: C.paperDark, border: "none", borderRadius: 20, fontFamily: fontSerif, fontSize: 15, outline: "none", color: C.ink }}
              />
              <button onClick={() => sendChatMessage()} disabled={!chatInput.trim() || chatLoading} style={{
                width: 40, height: 40, borderRadius: "50%", border: "none", background: C.ink, color: C.paper,
                cursor: chatInput.trim() ? "pointer" : "not-allowed", opacity: chatInput.trim() ? 1 : 0.3,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </ContentShell>
      );
    }

    // Active recall
    if (mode === "recall" && content) {
      const card = content[cardIndex];
      const remaining = recallQueue.length;
      const totalCount = content.length;
      return (
        <ContentShell onBack={resetToHome} topic={topic} progress={(knownCards.size / totalCount) * 100} label={`${knownCards.size} mastered · ${remaining} in queue`} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 28, borderRadius: 4 }}>
            <SectionLabel>{card.category || "Recall"}</SectionLabel>
            <div style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 400, lineHeight: 1.3, marginTop: 12, marginBottom: 20 }}>
              <RichText>{card.front}</RichText>
            </div>
            {!answerFeedback ? (
              <>
                <textarea value={typedAnswer} onChange={(e) => setTypedAnswer(e.target.value)} placeholder="Type your answer from memory..."
                  style={{ width: "100%", minHeight: 140, padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
                <Btn variant="primary" onClick={gradeRecallAnswer} disabled={!typedAnswer.trim() || gradingAnswer} style={{ marginTop: 14, width: "100%", padding: "12px", justifyContent: "center" }}>
                  {gradingAnswer ? <><Loader2 size={14} /> Grading...</> : <>Submit for grading <ArrowRight size={14} /></>}
                </Btn>
              </>
            ) : (
              <>
                <div style={{
                  padding: 16, borderRadius: 2, marginBottom: 12,
                  background: answerFeedback.correctness === "correct" ? C.mossSoft : answerFeedback.correctness === "partial" ? C.goldSoft : C.accentSoft,
                  border: `1px solid ${answerFeedback.correctness === "correct" ? C.moss : answerFeedback.correctness === "partial" ? C.gold : C.accent}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <SectionLabel>{answerFeedback.correctness}</SectionLabel>
                    <span style={{ fontFamily: fontMono, fontSize: 13 }}>{answerFeedback.score}/100</span>
                  </div>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                    <RichText>{answerFeedback.feedback}</RichText>
                  </div>
                </div>
                <details style={{ marginBottom: 12, padding: 12, background: C.paperDark, borderRadius: 2 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, color: C.inkSoft }}>Reference answer</summary>
                  <div style={{ marginTop: 10, fontFamily: fontSerif, fontSize: 14, color: C.ink }}>
                    <RichText>{card.back}</RichText>
                  </div>
                </details>
                <Btn variant="primary" onClick={() => {
                  const queue = recallQueue.filter((idx) => idx !== cardIndex || answerFeedback.correctness !== "correct");
                  if (queue.length === 0) { resetToHome(); return; }
                  const next = queue[0];
                  setRecallQueue(queue); setCardIndex(next);
                  setTypedAnswer(""); setAnswerFeedback(null);
                }} style={{ width: "100%", padding: "12px", justifyContent: "center" }}>
                  {recallQueue.length <= 1 && answerFeedback.correctness === "correct" ? "Finish" : "Next card"} <ArrowRight size={14} />
                </Btn>
              </>
            )}
          </div>
        </ContentShell>
      );
    }

    // Free response
    if (mode === "freeResponse" && content) {
      const problem = content[problemIndex];
      const isLast = problemIndex === content.length - 1;
      return (
        <ContentShell onBack={resetToHome} topic={topic} progress={((problemIndex + (frFeedback ? 1 : 0)) / content.length) * 100} label={`Question ${problemIndex + 1} of ${content.length}`} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 28, borderRadius: 4 }}>
            <SectionLabel>{problem.topicArea || "Free response"}</SectionLabel>
            <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 400, lineHeight: 1.4, marginTop: 12, marginBottom: 18 }}>
              <RichText>{problem.question}</RichText>
            </div>
            {problem.rubric && (
              <details style={{ marginBottom: 14, padding: 10, background: C.paperDark, borderRadius: 2 }}>
                <summary style={{ cursor: "pointer", fontSize: 11, color: C.inkMuted, fontFamily: fontMono, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Rubric ({problem.rubric.reduce((s, r) => s + r.max, 0)} pts)
                </summary>
                <ul style={{ marginTop: 10, paddingLeft: 16, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft }}>
                  {problem.rubric.map((r, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{r.criterion}</strong> ({r.max} pts) — {r.guidance}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!frFeedback ? (
              <>
                <textarea value={frAnswer} onChange={(e) => setFrAnswer(e.target.value)} placeholder="Write your answer..."
                  style={{ width: "100%", minHeight: 220, padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
                <Btn variant="primary" onClick={gradeFreeResponse} disabled={!frAnswer.trim() || frGrading} style={{ marginTop: 14, width: "100%", padding: "12px", justifyContent: "center" }}>
                  {frGrading ? <><Loader2 size={14} /> Grading rigorously...</> : <>Submit <ArrowRight size={14} /></>}
                </Btn>
              </>
            ) : (
              <>
                <div style={{ padding: 18, background: frFeedback.score >= 80 ? C.mossSoft : frFeedback.score >= 60 ? C.goldSoft : C.accentSoft, border: `1px solid ${frFeedback.score >= 80 ? C.moss : frFeedback.score >= 60 ? C.gold : C.accent}`, borderRadius: 2, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <SectionLabel>Score</SectionLabel>
                    <span style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 400 }}>{frFeedback.score}/100</span>
                  </div>
                  {frFeedback.rubricScores?.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: fontSerif, padding: "3px 0" }}>
                      <span>{r.criterion}</span><span style={{ fontFamily: fontMono }}>{r.earned}/{r.max}</span>
                    </div>
                  ))}
                </div>
                {frFeedback.strengths?.length > 0 && (
                  <div style={{ padding: 14, background: C.mossSoft, borderRadius: 2, marginBottom: 8 }}>
                    <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>Strengths</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, fontFamily: fontSerif }}>
                      {frFeedback.strengths.map((s, i) => <li key={i}>+ <RichText>{s}</RichText></li>)}
                    </ul>
                  </div>
                )}
                {frFeedback.improvements?.length > 0 && (
                  <div style={{ padding: 14, background: C.goldSoft, borderRadius: 2, marginBottom: 12 }}>
                    <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>To improve</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, fontFamily: fontSerif }}>
                      {frFeedback.improvements.map((s, i) => <li key={i}>→ <RichText>{s}</RichText></li>)}
                    </ul>
                  </div>
                )}
                <Btn variant="primary" onClick={() => { if (isLast) resetToHome(); else { setProblemIndex(problemIndex + 1); setFrAnswer(""); setFrFeedback(null); } }} style={{ width: "100%", padding: "12px", justifyContent: "center" }}>
                  {isLast ? "Finish" : "Next"} <ArrowRight size={14} />
                </Btn>
              </>
            )}
          </div>
        </ContentShell>
      );
    }

    // Derive
    if (mode === "derive" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.blue }}>Derivation</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, marginTop: 6, marginBottom: 18 }}>{content.title}</h1>
            <div style={{ background: C.blueSoft, padding: 18, borderRadius: 2, marginBottom: 18, border: `1px solid ${C.blue}` }}>
              <SectionLabel style={{ color: C.blue, marginBottom: 6 }}>Goal</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 17 }}><RichText>{content.goal}</RichText></div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <SectionLabel style={{ marginBottom: 6 }}>Strategy</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}><RichText>{content.strategy}</RichText></div>
            </div>
            {content.assumptions?.length > 0 && (
              <div style={{ padding: 14, background: C.paperDark, borderRadius: 2, marginBottom: 18 }}>
                <SectionLabel style={{ marginBottom: 6 }}>Assumptions</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: 16, fontFamily: fontSerif, fontSize: 14 }}>
                  {content.assumptions.map((a, i) => <li key={i}><RichText>{a}</RichText></li>)}
                </ul>
              </div>
            )}
            <div style={{ marginBottom: 18 }}>
              {content.steps?.map((s, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${C.blue}`, paddingLeft: 18, marginBottom: 14 }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.blue, letterSpacing: "0.15em", marginBottom: 4 }}>STEP {i + 1}</div>
                  <div style={{ fontFamily: fontSerif, fontSize: 16, marginBottom: 4 }}><RichText>{s.step}</RichText></div>
                  <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}><RichText>{s.justification}</RichText></div>
                </div>
              ))}
            </div>
            <div style={{ background: C.ink, color: C.paper, padding: 18, borderRadius: 2 }}>
              <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Conclusion ∎</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}><RichText>{content.conclusion}</RichText></div>
            </div>
          </div>
        </ContentShell>
      );
    }

    // Critique
    if (mode === "critique" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.gold }}>Critical analysis</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, marginTop: 6, marginBottom: 20 }}>{content.title}</h1>
            <div style={{ background: C.paperDark, padding: 16, borderRadius: 2, marginBottom: 16 }}>
              <SectionLabel style={{ marginBottom: 6 }}>Main claim</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 16, lineHeight: 1.6 }}><RichText>{content.mainClaim}</RichText></div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <SectionLabel style={{ marginBottom: 6 }}>Argument structure</SectionLabel>
              <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}><RichText>{content.argumentStructure}</RichText></div>
            </div>
            {content.strengths?.length > 0 && (
              <div style={{ padding: 16, background: C.mossSoft, borderRadius: 2, marginBottom: 12 }}>
                <SectionLabel style={{ color: C.moss, marginBottom: 8 }}>Strengths</SectionLabel>
                {content.strengths.map((s, i) => (
                  <div key={i} style={{ marginBottom: 8, fontFamily: fontSerif }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>+ <RichText>{s.point}</RichText></div>
                    <div style={{ fontSize: 13, color: C.inkSoft, marginLeft: 14 }}><RichText>{s.explanation}</RichText></div>
                  </div>
                ))}
              </div>
            )}
            {content.weaknesses?.length > 0 && (
              <div style={{ padding: 16, background: C.accentSoft, borderRadius: 2, marginBottom: 12 }}>
                <SectionLabel style={{ color: C.accent, marginBottom: 8 }}>Weaknesses</SectionLabel>
                {content.weaknesses.map((w, i) => (
                  <div key={i} style={{ marginBottom: 8, fontFamily: fontSerif }}>
                    <div style={{ fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>− <RichText>{w.point}</RichText></span>
                      {w.type && <Pill color="accent" style={{ marginLeft: 6 }}>{w.type}</Pill>}
                    </div>
                    <div style={{ fontSize: 13, color: C.inkSoft, marginLeft: 14 }}><RichText>{w.explanation}</RichText></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ContentShell>
      );
    }

    // Curriculum
    if (mode === "curriculum" && content) {
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.moss }}>Plan of study · {content.totalWeeks} weeks</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 400, marginTop: 6, marginBottom: 10 }}>{content.title}</h1>
            <p style={{ fontFamily: fontSerif, fontSize: 15, color: C.inkSoft, fontStyle: "italic", marginBottom: 20, lineHeight: 1.6 }}>
              <RichText>{content.overview}</RichText>
            </p>
            {(content.prerequisitesAssumed?.length > 0 || content.prerequisitesToAcquireFirst?.length > 0 || content.connectionsToTheirClasses) && (
              <div style={{ background: C.paperDark, border: `1px solid ${C.rule}`, padding: 16, borderRadius: 3, marginBottom: 20, fontFamily: fontSerif, fontSize: 13, lineHeight: 1.6 }}>
                {content.connectionsToTheirClasses && (
                  <div style={{ marginBottom: 10 }}>
                    <SectionLabel style={{ color: C.moss, marginBottom: 4 }}>How this fits with your classes</SectionLabel>
                    <RichText>{content.connectionsToTheirClasses}</RichText>
                  </div>
                )}
                {content.prerequisitesAssumed?.length > 0 && (
                  <div style={{ marginBottom: content.prerequisitesToAcquireFirst?.length ? 10 : 0 }}>
                    <SectionLabel style={{ marginBottom: 4 }}>Assumed you know</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 18, color: C.inkSoft }}>{content.prerequisitesAssumed.map((p, j) => <li key={j}><RichText>{p}</RichText></li>)}</ul>
                  </div>
                )}
                {content.prerequisitesToAcquireFirst?.length > 0 && (
                  <div>
                    <SectionLabel style={{ color: C.accent, marginBottom: 4 }}>Fill these gaps first</SectionLabel>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>{content.prerequisitesToAcquireFirst.map((p, j) => <li key={j}><RichText>{p}</RichText></li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {content.units?.map((u, i) => (
              <details key={i} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 8 }}>
                <summary style={{ cursor: "pointer", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, background: C.mossSoft, color: C.moss, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: fontMono, fontSize: 12, fontWeight: 700 }}>W{u.week}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600 }}>{u.title}</div>
                    <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted }}><RichText>{u.goal}</RichText></div>
                  </div>
                  <div style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted }}>{u.hoursPerWeek}h/wk</div>
                </summary>
                <div style={{ padding: "0 16px 16px 74px", fontFamily: fontSerif, fontSize: 14 }}>
                  {u.topics?.length > 0 && (
                    <>
                      <SectionLabel style={{ marginTop: 6, marginBottom: 4 }}>Topics</SectionLabel>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>{u.topics.map((t, j) => <li key={j}><RichText>{t}</RichText></li>)}</ul>
                    </>
                  )}
                  {u.resources?.length > 0 && (
                    <>
                      <SectionLabel style={{ marginTop: 10, marginBottom: 4 }}>Resources</SectionLabel>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>{u.resources.map((r, j) => <li key={j}>▸ <RichText>{r}</RichText></li>)}</ul>
                    </>
                  )}
                  {u.deliverable && (
                    <div style={{ marginTop: 10, padding: 10, background: C.paperDark, borderRadius: 2 }}>
                      <SectionLabel>Deliverable</SectionLabel>
                      <div style={{ marginTop: 4 }}><RichText>{u.deliverable}</RichText></div>
                    </div>
                  )}
                  {u.masteryCheck && (
                    <div style={{ marginTop: 8, padding: 10, background: C.mossSoft, borderRadius: 2 }}>
                      <SectionLabel style={{ color: C.moss }}>How you'll know you got it</SectionLabel>
                      <div style={{ marginTop: 4 }}><RichText>{u.masteryCheck}</RichText></div>
                    </div>
                  )}
                </div>
              </details>
            ))}
            {content.finalProject && (
              <div style={{ background: C.ink, color: C.paper, padding: 18, borderRadius: 2, marginTop: 16 }}>
                <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Final project</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6 }}><RichText>{content.finalProject}</RichText></div>
              </div>
            )}
          </div>
        </ContentShell>
      );
    }

    // Concept map
    if (mode === "conceptMap" && content) {
      const tierColors = {
        foundational: { bg: C.mossSoft, fg: C.moss },
        intermediate: { bg: C.goldSoft, fg: C.gold },
        advanced: { bg: C.accentSoft, fg: C.accent },
      };
      return (
        <ContentShell onBack={resetToHome} topic={topic} onExport={exportCurrentContent} reasoningLog={generationLog} modelUsed={AI_MODELS[aiSettings.model]?.label}>
          <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, padding: 32, borderRadius: 4 }}>
            <SectionLabel style={{ color: C.plum }}>Knowledge graph</SectionLabel>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, marginTop: 6, marginBottom: 20 }}>{content.title}</h1>
            {content.suggestedPath?.length > 0 && (
              <div style={{ padding: 14, background: C.paperDark, borderRadius: 2, marginBottom: 24 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Suggested order</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  {content.suggestedPath.map((id, i) => {
                    const c = content.concepts.find((x) => x.id === id);
                    return (
                      <React.Fragment key={i}>
                        {i > 0 && <ArrowRight size={12} color={C.inkMuted} />}
                        <span style={{ padding: "4px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 13 }}>{c?.name || id}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
            {["foundational", "intermediate", "advanced"].map((tier) => {
              const concepts = content.concepts?.filter((c) => c.tier === tier);
              if (!concepts || concepts.length === 0) return null;
              const tc = tierColors[tier];
              return (
                <div key={tier} style={{ marginBottom: 18 }}>
                  <SectionLabel style={{ color: tc.fg, marginBottom: 8 }}>{tier}</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {concepts.map((c) => (
                      <div key={c.id} style={{ background: tc.bg, border: `2px solid ${tc.fg}`, padding: 14, borderRadius: 2 }}>
                        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, marginBottom: 4, color: C.ink }}>{c.name}</div>
                        <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginBottom: 6, lineHeight: 1.5 }}>
                          <RichText>{c.definition}</RichText>
                        </div>
                        <div style={{ fontFamily: fontSerif, fontSize: 12, fontStyle: "italic", color: C.inkMuted }}>
                          <RichText>{c.whyItMatters}</RichText>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ContentShell>
      );
    }

    return null;
  };


  // ============ LUMEN-STYLE PAGES ============
  const renderCode = () => (
    <div>
      <SectionLabel>The Workshop</SectionLabel>
      <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 400, margin: "4px 0 8px", letterSpacing: "-0.02em" }}>
        Code that runs. <em style={{ color: C.accent }}>Math that shows its work.</em>
      </h1>
      <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", marginBottom: 32, maxWidth: 620 }}>
        Built-in math solver, equation derivations, code explanations, LaTeX everywhere.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <Card onClick={() => setShowMathSolver(true)}>
          <Calculator size={24} color={C.accent} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Math solver</div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>Step-by-step solutions with LaTeX. Powered by extended thinking.</div>
        </Card>
        <Card onClick={() => setShowWhiteboard(true)}>
          <Edit3 size={24} color={C.blue} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Whiteboard</div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>Sketch problems and diagrams. Download as PNG.</div>
        </Card>
        <Card onClick={() => setShowDerivePrompt(true)}>
          <Sigma size={24} color={C.plum} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Derive a proof</div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>Step-by-step derivations with justifications.</div>
        </Card>
        <Card onClick={() => setShowCodeExplain(true)}>
          <Code size={24} color={C.moss} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Explain code</div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>Paste any code and Study It explains it line-by-line.</div>
        </Card>
      </div>
    </div>
  );

  // ============ REAL INTEGRATIONS: .ics calendar export ============
  const buildICS = () => {
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    const fmtDate = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    const esc = (s) => String(s || "").replace(/[\\;,\n]/g, (m) => ({ "\\": "\\\\", ";": "\\;", ",": "\\,", "\n": "\\n" }[m]));
    const now = new Date();
    const stamp = fmt(now);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyIt//Study Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    // Classes — daily study reminders for the next 14 days at 5pm local
    myClasses.forEach((c, ci) => {
      for (let d = 0; d < 14; d++) {
        const start = new Date(); start.setDate(start.getDate() + d); start.setHours(17, 0, 0, 0);
        const end = new Date(start); end.setHours(end.getHours() + 1);
        lines.push("BEGIN:VEVENT", `UID:class-${c.id}-${d}@studyit`, `DTSTAMP:${stamp}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:Study: ${esc(c.name)}`, `DESCRIPTION:${esc(c.term ? c.term + " · " : "")}Generated by Study It`, "END:VEVENT");
      }
    });
    // Exam date — all-day event
    if (persistentProfile.examDate) {
      const d = new Date(persistentProfile.examDate);
      if (!isNaN(d.getTime())) {
        const dEnd = new Date(d); dEnd.setUTCDate(dEnd.getUTCDate() + 1);
        lines.push("BEGIN:VEVENT", `UID:exam-${d.getTime()}@studyit`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${fmtDate(d)}`, `DTEND;VALUE=DATE:${fmtDate(dEnd)}`, `SUMMARY:Exam: ${esc(persistentProfile.goal || "Study exam")}`, "DESCRIPTION:Exam day — generated by Study It", "END:VEVENT");
      }
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };
  const downloadICS = () => {
    if (myClasses.length === 0 && !persistentProfile.examDate) { showToast("Add a class or exam date first"); return; }
    const ics = buildICS();
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lectern-${Date.now()}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Calendar file downloaded (${myClasses.length} class${myClasses.length === 1 ? "" : "es"} × 14 days)`);
    track("action", "ics_exported");
  };

  // ============ MARKDOWN BUNDLE EXPORT (Obsidian / Notion / any .md editor) ============
  const buildMarkdownExport = () => {
    const d = new Date();
    const ds = d.toISOString().slice(0, 10);
    const niceName = (persistentProfile.displayName || "").trim() || (user && user.email ? user.email.split("@")[0] : "your") + "'s";
    const lines = [];
    lines.push(`# Study It export — ${ds}`, "");
    lines.push(`*Generated ${d.toLocaleString()}*`, "");
    // Profile
    lines.push("## Profile", "");
    if (persistentProfile.displayName) lines.push(`- **Name:** ${persistentProfile.displayName}`);
    if (persistentProfile.goal) lines.push(`- **Studying for:** ${persistentProfile.goal}`);
    if (persistentProfile.examDate) lines.push(`- **Exam date:** ${persistentProfile.examDate}`);
    if (persistentProfile.preferredStyle) lines.push(`- **Preferred style:** ${persistentProfile.preferredStyle}`);
    if (persistentProfile.persona && persistentProfile.persona !== "default") lines.push(`- **Tutor persona:** ${persistentProfile.persona}`);
    lines.push(`- **Sessions completed:** ${persistentProfile.sessionsCount || 0}`);
    lines.push(`- **Total minutes studied:** ${persistentProfile.totalMinutes || 0}`);
    lines.push("");
    // Classes
    if (myClasses.length > 0) {
      lines.push("## Classes", "");
      myClasses.forEach((c) => lines.push(`- **${c.name}**${c.term ? ` (${c.term})` : ""}`));
      lines.push("");
    }
    // Mastered concepts
    if (persistentProfile.masteredConcepts && persistentProfile.masteredConcepts.length > 0) {
      lines.push("## Mastered", "");
      persistentProfile.masteredConcepts.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
    // Recent topics
    if (persistentProfile.recentTopics && persistentProfile.recentTopics.length > 0) {
      lines.push("## Recent topics", "");
      persistentProfile.recentTopics.forEach((t) => lines.push(`- ${t}`));
      lines.push("");
    }
    // Weak spots — to review
    if (persistentProfile.weakSpots && persistentProfile.weakSpots.length > 0) {
      lines.push("## Weak spots — review these", "");
      persistentProfile.weakSpots.forEach((w) => lines.push(`- ${typeof w === "string" ? w : (w.topic || JSON.stringify(w))}`));
      lines.push("");
    }
    // Journal
    if (journal && journal.length > 0) {
      lines.push("## Journal", "");
      journal.forEach((j) => { lines.push(`### ${j.date || ""}`, "", j.text || "", ""); });
    }
    // SM-2 card schedule
    const cards = persistentProfile.cardStates || {};
    const cardKeys = Object.keys(cards);
    if (cardKeys.length > 0) {
      lines.push(`## Flashcard schedule (${cardKeys.length} cards)`, "");
      lines.push("| Card | Interval (days) | Next due |", "|---|---|---|");
      cardKeys.slice(0, 50).forEach((k) => {
        const c = cards[k];
        const due = c.due ? new Date(c.due).toLocaleDateString() : "—";
        lines.push(`| ${k.replace(/\|/g, "\\|").slice(0, 60)} | ${c.interval || 0} | ${due} |`);
      });
      if (cardKeys.length > 50) lines.push(`| _…and ${cardKeys.length - 50} more_ | | |`);
      lines.push("");
    }
    lines.push("---", "", `*Exported from Study It · ${ds}*`);
    return lines.join("\n");
  };
  const downloadMarkdown = () => {
    const md = buildMarkdownExport();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lectern-${Date.now()}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Markdown file downloaded");
    track("action", "md_exported");
  };

  // ============ ANKI TSV EXPORT (flashcards importable into Anki) ============
  const buildAnkiTSV = () => {
    // Format: Front<TAB>Back<TAB>tags
    // Pull from cardStates keys + any cached flashcard content
    const cards = persistentProfile.cardStates || {};
    const lines = ["# Anki import file generated by Study It", "# In Anki: File → Import → select this file → set field separator to Tab", "# Format: Front\tBack\tTags", ""];
    let count = 0;
    Object.keys(cards).forEach((key) => {
      // cardStates keys are encoded as "topic::front" — parse
      const parts = key.split("::");
      const front = (parts[1] || parts[0] || "").replace(/[\t\n]/g, " ").slice(0, 500);
      const back = (cards[key].back || "—").replace(/[\t\n]/g, " ").slice(0, 1000);
      const tag = (parts[0] || "general").replace(/\s+/g, "_").slice(0, 50);
      if (front) { lines.push(`${front}\t${back}\tlectern ${tag}`); count++; }
    });
    return { tsv: lines.join("\n"), count };
  };
  const downloadAnki = () => {
    const { tsv, count } = buildAnkiTSV();
    if (count === 0) { showToast("Study flashcards first to build a deck"); return; }
    const blob = new Blob([tsv], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lectern-anki-${Date.now()}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Anki file downloaded (${count} card${count === 1 ? "" : "s"})`);
    track("action", "anki_exported");
  };

  // ============ PRINT-FRIENDLY STUDY SHEET ============
  const printStudySheet = () => {
    if (!content && !persistentProfile.goal && myClasses.length === 0) { showToast("Generate study material or add a class first"); return; }
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { showToast("Pop-ups blocked — allow them to print"); return; }
    const esc = (s) => String(s || "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
    const niceName = (persistentProfile.displayName || "").trim() || "Study";
    let body = `<h1>${esc(niceName)}'s study sheet</h1><p><em>${new Date().toLocaleString()}</em></p>`;
    if (myClasses.length > 0) body += `<h2>Classes</h2><ul>${myClasses.map((c) => `<li>${esc(c.name)}${c.term ? ` · <em>${esc(c.term)}</em>` : ""}</li>`).join("")}</ul>`;
    if (content && content.cards) body += `<h2>Flashcards</h2>` + content.cards.map((c, i) => `<div style="page-break-inside:avoid;border:1px solid #ccc;padding:10px;margin-bottom:8px"><strong>${i + 1}. ${esc(c.front)}</strong><br><span style="color:#666">${esc(c.back)}</span></div>`).join("");
    if (content && content.problems) body += `<h2>Practice problems</h2><ol>` + content.problems.map((p) => `<li style="margin-bottom:12px"><strong>${esc(p.question)}</strong><br>${(p.options || []).map((o, i) => `${String.fromCharCode(65 + i)}. ${esc(o)}`).join("<br>")}<br><em style="color:#666">Answer: ${String.fromCharCode(65 + p.correctIndex)} — ${esc(p.explanation)}</em></li>`).join("") + `</ol>`;
    if (content && content.body) body += `<h2>${esc(topic || "Notes")}</h2><div style="white-space:pre-wrap">${esc(content.body)}</div>`;
    if (persistentProfile.weakSpots && persistentProfile.weakSpots.length > 0) body += `<h2>Weak spots</h2><ul>${persistentProfile.weakSpots.map((w) => `<li>${esc(typeof w === "string" ? w : w.topic || "")}</li>`).join("")}</ul>`;
    w.document.write(`<!doctype html><html><head><title>Study It study sheet</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#222;line-height:1.6}h1{font-size:28px;margin-bottom:4px}h2{font-size:18px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}@media print{body{margin:20px}}</style></head><body>${body}<script>setTimeout(()=>window.print(),300);</script></body></html>`);
    w.document.close();
    track("action", "print_sheet");
  };

  // ============ WEBHOOK PING (Slack / Discord / Zapier) ============
  const pingWebhook = async () => {
    if (!webhookUrl) { setWebhookStatus("Add a webhook URL first"); return; }
    setWebhookStatus("Sending…");
    const sessions = persistentProfile.sessionsCount || 0;
    const minutes = persistentProfile.totalMinutes || 0;
    const niceName = (persistentProfile.displayName || "").trim() || "Study It user";
    const summary = `📚 *${niceName}'s daily Study It check-in*\n• Sessions completed: ${sessions}\n• Minutes studied: ${minutes}\n• Classes tracked: ${myClasses.length}${persistentProfile.weakSpots && persistentProfile.weakSpots.length ? `\n• Weak spots to review: ${persistentProfile.weakSpots.length}` : ""}${persistentProfile.recentTopics && persistentProfile.recentTopics.length ? `\n• Recently studied: ${persistentProfile.recentTopics.slice(0, 3).join(", ")}` : ""}`;
    try {
      // Slack/Discord both accept "content" or "text" — send both for compatibility
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summary, content: summary }),
      });
      if (!res.ok && res.status !== 0) throw new Error(`HTTP ${res.status}`);
      setWebhookStatus("✓ Sent");
      showToast("Webhook ping sent");
      track("action", "webhook_pinged");
      setTimeout(() => setWebhookStatus(""), 3000);
    } catch (e) {
      setWebhookStatus(`Failed: ${e.message}`);
      logError(e, "webhook ping");
    }
  };

  // ============ EXPORT EVERYTHING — full data backup as a downloadable zip ============
  // Real safety net: if Supabase goes down, localStorage gets wiped, or you want to switch devices,
  // this produces a complete archive of all your work. The zip contains:
  //   profile.json         — persistentProfile (concepts, weak spots, cardStates, journal, settings)
  //   classes.json         — your enrolled classes
  //   notebooks.json       — all notebooks INCLUDING soft-delete tombstones (for sync recovery)
  //   notebooks.md         — same notebooks as human-readable markdown
  //   vault.json           — every saved generation with full content
  //   notes.json           — your free-form notes
  //   session-log.json     — daily session counts (drives the heatmap)
  //   settings.json        — AI provider, theme, language, etc.
  //   README.md            — explains the format + how to restore
  const exportEverything = async () => {
    showToast("Building your archive…");
    try {
      // Lazy-load JSZip if not already cached
      if (!window.JSZip) {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
      }
      if (!window.JSZip) throw new Error("JSZip failed to load");
      const zip = new window.JSZip();
      const now = new Date();
      const stamp = now.toISOString().slice(0, 19).replace(/[T:]/g, "-");

      // ----- profile.json -----
      zip.file("profile.json", JSON.stringify(persistentProfile, null, 2));

      // ----- classes.json -----
      zip.file("classes.json", JSON.stringify(myClasses, null, 2));

      // ----- notebooks.json (raw — preserves tombstones for sync recovery) -----
      zip.file("notebooks.json", JSON.stringify(notebooks, null, 2));

      // ----- notebooks.md (human-readable, live notebooks only) -----
      const nbMdLines = [`# Notebooks · exported ${now.toLocaleString()}`, ""];
      liveNotebooks.forEach((nb) => {
        nbMdLines.push(`## ${nb.emoji || "📓"} ${nb.name}`, "");
        nbMdLines.push(`*Created ${new Date(nb.createdAt).toLocaleDateString()} · ${nb.sources.length} source${nb.sources.length === 1 ? "" : "s"}*`, "");
        if (nb.notes) nbMdLines.push("### Notes", "", nb.notes, "");
        if (nb.sources.length > 0) {
          nbMdLines.push("### Sources", "");
          nb.sources.forEach((s, i) => {
            nbMdLines.push(`#### [S${i + 1}] ${s.name}`, "");
            nbMdLines.push("```", s.content, "```", "");
          });
        }
        nbMdLines.push("---", "");
      });
      zip.file("notebooks.md", nbMdLines.join("\n"));

      // ----- vault.json -----
      zip.file("vault.json", JSON.stringify(savedGenerations, null, 2));

      // ----- notes.json -----
      zip.file("notes.json", JSON.stringify(notes || [], null, 2));

      // ----- session-log.json -----
      try {
        const sessLog = JSON.parse(localStorage.getItem("lectern_session_log_v1") || "{}");
        zip.file("session-log.json", JSON.stringify(sessLog, null, 2));
      } catch {}

      // ----- settings.json (AI provider, theme, language, output language, wellbeing toggles) -----
      const settings = {
        aiProvider, aiSettings, localModel, language, outputLanguage: outputLanguage || "English",
        theme, anthropicApiKeyPresent: !!anthropicApiKey, // never export the actual key
        difficulty,
        wellbeing: {
          sleepLog: (() => { try { return JSON.parse(localStorage.getItem("lectern_wb_sleep") || "{}"); } catch { return {}; } })(),
          moodToday: (() => { try { return JSON.parse(localStorage.getItem("lectern_wb_mood") || "{}"); } catch { return {}; } })(),
          toggles: (() => { try { return JSON.parse(localStorage.getItem("lectern_wb_toggles") || "{}"); } catch { return {}; } })(),
        },
      };
      zip.file("settings.json", JSON.stringify(settings, null, 2));

      // ----- README.md -----
      const readme = `# Study It · Data Export

**Exported:** ${now.toLocaleString()}
**App version:** ${APP_VERSION}
**Build date:** ${BUILD_DATE}

## What's in this archive

This is a complete backup of your Study It data — everything that lives in your browser's localStorage, plus what's synced to Supabase if you're signed in.

| File | What it contains |
|---|---|
| \`profile.json\` | Your learner profile: mastered concepts, weak spots, flashcard schedule (SM-2 card states with front/back/topic/intervals), journal, exam date, recent topics |
| \`classes.json\` | Your enrolled classes with terms and accent colors |
| \`notebooks.json\` | All notebooks (raw, including soft-delete tombstones — needed for cross-device sync to work correctly if you restore) |
| \`notebooks.md\` | Same notebooks rendered as human-readable markdown — open in Obsidian, Notion, Bear, any .md editor |
| \`vault.json\` | Every saved generation (flashcards, explainers, quizzes, etc.) with full content |
| \`notes.json\` | Your free-form study notes |
| \`session-log.json\` | Daily session counts that drive the Today heatmap |
| \`settings.json\` | AI provider, theme, language, wellbeing toggles. **API keys are NOT included** — those stay on the device they were entered on |

## How to restore

Right now there's no built-in "import this archive" button — the export is a one-way safety net. To restore manually:

1. **Notebooks**: paste \`notebooks.json\` content into your browser's localStorage under the key \`lectern_notebooks\` (use browser devtools)
2. **Profile**: paste \`profile.json\` into \`lectern_profile_v1\`
3. **Vault**: paste \`vault.json\` into \`lectern_vault_v1\`
4. **Notes**: paste \`notes.json\` into \`lectern_notes_v1\`
5. **Session log**: paste \`session-log.json\` into \`lectern_session_log_v1\`
6. Refresh the page

If you're signed in with Supabase and notebooks sync is enabled, your notebooks will re-sync automatically on next sign-in — you don't even need to manually restore those.

## Privacy

- The archive is built locally in your browser. Nothing leaves your device until you save the .zip somewhere.
- API keys are deliberately omitted. You'll need to re-enter your AI API key after restoring.
- If you use cloud sync, your data is also stored in your Supabase project under your account.

---

*Built with Study It · v${APP_VERSION}*
`;
      zip.file("README.md", readme);

      // Generate + download
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study-it-export-${stamp}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const sizeKb = Math.round(blob.size / 1024);
      showToast(`Exported · ${sizeKb.toLocaleString()} KB · ${liveNotebooks.length} notebooks · ${savedGenerations.length} vault items`);
      track("action", "export_everything", { size_kb: sizeKb, notebooks: liveNotebooks.length, vault: savedGenerations.length });
    } catch (e) {
      logError(e, "export everything");
      showToast("Export failed — check console for details");
    }
  };

  // ============ GOOGLE DRIVE (API-key path: public/share-link files only) ============
  // Parses various Drive share URL shapes and returns the file ID (or null).
  const extractDriveFileId = (urlOrId) => {
    if (!urlOrId) return null;
    const s = urlOrId.trim();
    // Bare ID (alphanumeric + - + _, typically 25-50 chars)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    // file/d/{id}/...
    let m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    // ?id={id} or &id={id}
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  };

  const fetchDriveFile = async () => {
    if (!googleApiKey) { setDriveStatus("Add your Google API key first"); return; }
    const fileId = extractDriveFileId(driveUrlDraft);
    if (!fileId) { setDriveStatus("Couldn't find a Drive file ID in that — paste the full share link"); return; }
    setDriveLoading(true); setDriveStatus("");
    try {
      // 1. metadata
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size&key=${encodeURIComponent(googleApiKey)}`;
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) {
        const msg = metaRes.status === 403 ? "File isn't shared as 'Anyone with the link' (or API key is invalid)" :
                    metaRes.status === 404 ? "File not found — check the link" :
                    `Drive returned ${metaRes.status}`;
        throw new Error(msg);
      }
      const meta = await metaRes.json();
      const { name, mimeType } = meta;
      // 2. content — branch on mimeType
      let content;
      if (mimeType === "application/vnd.google-apps.document") {
        // Google Doc → export as plain text
        const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&key=${encodeURIComponent(googleApiKey)}`;
        const r = await fetch(expUrl);
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        content = await r.text();
      } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
        const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&key=${encodeURIComponent(googleApiKey)}`;
        const r = await fetch(expUrl);
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        content = await r.text();
      } else if (mimeType === "application/vnd.google-apps.presentation") {
        const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&key=${encodeURIComponent(googleApiKey)}`;
        const r = await fetch(expUrl);
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        content = await r.text();
      } else if (mimeType && (mimeType.startsWith("text/") || mimeType === "application/json")) {
        // Plain text / markdown / csv / json
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${encodeURIComponent(googleApiKey)}`);
        if (!r.ok) throw new Error(`Download failed (${r.status})`);
        content = await r.text();
      } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // .docx — use mammoth like the existing upload flow
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${encodeURIComponent(googleApiKey)}`);
        if (!r.ok) throw new Error(`Download failed (${r.status})`);
        const buf = await r.arrayBuffer();
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        content = result.value;
      } else {
        throw new Error(`Format "${mimeType || "unknown"}" not supported here. Download from Drive and use the file upload above.`);
      }
      if (!content || !content.trim()) throw new Error("File appears empty");
      // Add to existing textDocs so the study flow picks it up automatically
      setTextDocs((prev) => [...prev, { content, name: `${name} (from Drive)`, fromDrive: true, fileId }]);
      setDriveStatus(`✓ Loaded "${name}" — ${Math.round(content.length / 1024) || 1} KB`);
      setDriveUrlDraft("");
      showToast(`Loaded "${name}" as study material`);
      track("action", "drive_file_loaded");
      setTimeout(() => setDriveStatus(""), 5000);
    } catch (e) {
      setDriveStatus(`Failed: ${e.message}`);
      logError(e, "drive fetch");
    } finally {
      setDriveLoading(false);
    }
  };

  // ============ GOOGLE DRIVE OAUTH-PKCE (Path B: full read+write to private Drive) ============
  // PKCE helpers: code_verifier = random 32 bytes base64url; code_challenge = base64url(SHA256(verifier))
  const _b64url = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const _generatePKCEPair = async () => {
    const verifier = _b64url(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: _b64url(hash) };
  };

  // Start the OAuth flow: redirect the user to Google's consent screen.
  const startGoogleOAuth = async () => {
    if (!googleClientId) { setOauthStatus("Add your OAuth Client ID first"); return; }
    try {
      const { verifier, challenge } = await _generatePKCEPair();
      const state = _b64url(crypto.getRandomValues(new Uint8Array(16)));
      localStorage.setItem("lectern_pkce_verifier", verifier);
      localStorage.setItem("lectern_pkce_state", state);
      const redirectUri = window.location.origin + window.location.pathname;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", googleClientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/drive.file");
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline"); // request refresh token
      url.searchParams.set("prompt", "consent"); // force refresh token issuance
      window.location.href = url.toString();
    } catch (e) {
      setOauthStatus(`Failed to start OAuth: ${e.message}`);
      logError(e, "oauth start");
    }
  };

  // Exchange the auth code for tokens once Google redirects back with ?code=&state=
  const _completeOAuth = async (code, state) => {
    const savedState = localStorage.getItem("lectern_pkce_state");
    if (state !== savedState) throw new Error("State mismatch — possible CSRF, sign-in aborted");
    const verifier = localStorage.getItem("lectern_pkce_verifier");
    if (!verifier) throw new Error("PKCE verifier missing — sign in again");
    const clientId = localStorage.getItem("lectern_google_client_id") || googleClientId;
    if (!clientId) throw new Error("Client ID missing — paste it and retry");
    const redirectUri = window.location.origin + window.location.pathname;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code, code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Token exchange returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    setGoogleAccessToken(data.access_token);
    if (data.refresh_token) setGoogleRefreshToken(data.refresh_token);
    setGoogleTokenExpiresAt(Date.now() + ((data.expires_in || 3600) * 1000));
    // Fetch user email/profile
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const user = await userRes.json();
        setGoogleUserEmail(user.email || "");
      }
    } catch {}
    localStorage.removeItem("lectern_pkce_verifier");
    localStorage.removeItem("lectern_pkce_state");
    track("action", "drive_oauth_completed");
  };

  // On mount: detect ?code= in URL and complete OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (error) {
      setOauthStatus(`Google declined: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!code || !state) return;
    setOauthInFlight(true);
    setOauthStatus("Completing sign-in…");
    _completeOAuth(code, state).then(() => {
      setOauthStatus("✓ Connected to Google Drive");
      showToast("Connected to Google Drive");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setOauthStatus(""), 4000);
    }).catch((e) => {
      setOauthStatus(`OAuth failed: ${e.message}`);
      window.history.replaceState({}, "", window.location.pathname);
      logError(e, "oauth callback");
    }).finally(() => setOauthInFlight(false));
  }, []); // intentionally run only once

  // Refresh expired access token using stored refresh token
  const refreshGoogleToken = async () => {
    if (!googleRefreshToken || !googleClientId) return null;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          refresh_token: googleRefreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) throw new Error(`Refresh returned ${res.status}`);
      const data = await res.json();
      setGoogleAccessToken(data.access_token);
      setGoogleTokenExpiresAt(Date.now() + ((data.expires_in || 3600) * 1000));
      return data.access_token;
    } catch (e) { logError(e, "token refresh"); return null; }
  };

  // Return a non-expired access token, refreshing if needed
  const getValidAccessToken = async () => {
    if (!googleAccessToken) return null;
    if (Date.now() < (googleTokenExpiresAt || 0) - 60000) return googleAccessToken;
    return await refreshGoogleToken();
  };

  // Disconnect: revoke at Google + clear local state
  const signOutGoogle = async () => {
    if (googleAccessToken) {
      try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(googleAccessToken)}`, { method: "POST" }); } catch {}
    }
    setGoogleAccessToken(""); setGoogleRefreshToken(""); setGoogleTokenExpiresAt(0); setGoogleUserEmail("");
    setOauthStatus("");
    showToast("Disconnected from Google Drive");
    track("action", "drive_oauth_disconnected");
  };

  // Upload Markdown export to user's Drive
  const saveMarkdownToDrive = async () => {
    const token = await getValidAccessToken();
    if (!token) { setOauthStatus("Sign in to Drive first"); return; }
    const md = buildMarkdownExport();
    const fileName = `lectern-export-${new Date().toISOString().slice(0, 10)}.md`;
    setOauthStatus("Uploading…");
    try {
      const boundary = "lectern" + Math.random().toString(36).slice(2);
      const metadata = { name: fileName, mimeType: "text/markdown" };
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n` +
        md +
        `\r\n--${boundary}--`;
      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload returned ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      setOauthStatus(`✓ Saved "${fileName}" to Drive (id: ${data.id?.slice(0, 8)}…)`);
      showToast("Saved to Google Drive");
      track("action", "drive_save_md");
      setTimeout(() => setOauthStatus(""), 5000);
    } catch (e) {
      setOauthStatus(`Failed: ${e.message}`);
      logError(e, "drive upload");
    }
  };

  const renderIntegrations = () => {
    const cardWrap = { background: C.mossSoft, border: `2px solid ${C.moss}`, padding: 22, borderRadius: 5, marginBottom: 22 };
    const cardHead = { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 };
    const cardLabel = { color: C.moss, marginBottom: 0 };
    const cardBody = { fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.6, marginBottom: 14 };
    const meta = { fontFamily: fontMono, fontSize: 11, color: C.inkMuted };
    const cardCount = Object.keys(persistentProfile.cardStates || {}).length;
    return (
      <div>
        <SectionLabel>Integrations</SectionLabel>
        <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 400, margin: "4px 0 8px", letterSpacing: "-0.02em" }}>
          Plug in. <em style={{ color: C.accent }}>Don't switch tabs.</em>
        </h1>
        <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", marginBottom: 32, maxWidth: 620 }}>
          Five integrations that actually work — built for what you can do without a server.
        </p>

        {/* 1. CALENDAR */}
        <div style={cardWrap}>
          <div style={cardHead}><Calendar size={20} color={C.moss} /><SectionLabel style={cardLabel}>Calendar export · Working</SectionLabel></div>
          <div style={cardBody}>
            Download a <strong>.ics file</strong> with every class scheduled as a daily 5pm study reminder for 14 days{persistentProfile.examDate ? ", plus your exam date as an all-day event" : ""}. Double-click and your calendar app (Google, Apple, Outlook — any) imports everything.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={downloadICS} disabled={myClasses.length === 0 && !persistentProfile.examDate}>
              <Download size={14} /> Download .ics
            </Btn>
            <span style={meta}>{myClasses.length === 0 && !persistentProfile.examDate ? "Add a class first" : `${myClasses.length} class${myClasses.length === 1 ? "" : "es"}${persistentProfile.examDate ? " + 1 exam" : ""}`}</span>
          </div>
        </div>

        {/* 1b. iCAL LIVE SUBSCRIPTION (needs Edge Function deploy) */}
        <div style={cardWrap}>
          <div style={cardHead}><Calendar size={20} color={C.gold} /><SectionLabel style={cardLabel}>iCal live subscription · Setup required</SectionLabel></div>
          <div style={cardBody}>
            A live calendar feed that <strong>auto-updates</strong> when you add classes or change your exam date — no re-downloading. Unlike the one-shot .ics export, this gives you a subscription URL your calendar app refreshes daily.
            <br /><br />
            <strong>Honest constraint:</strong> Study It is a single-page web app — it can't host a live endpoint. To enable live subscriptions, deploy this Edge Function to your own Supabase project (one-time setup, ~5 minutes). After deploying, paste the function URL below and Study It will generate your personal subscription link.
          </div>
          {(() => {
            const icsToken = persistentProfile.icsSubscriptionToken;
            const icsEndpoint = persistentProfile.icsSubscriptionEndpoint;
            const subscriptionUrl = (icsToken && icsEndpoint) ? `${icsEndpoint}?token=${icsToken}&user=${user?.id || "guest"}` : "";
            return (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <SectionLabel style={{ marginBottom: 4 }}>Your Edge Function URL</SectionLabel>
                    <input type="text" value={icsEndpoint || ""} onChange={(e) => setPersistentProfile((p) => ({ ...p, icsSubscriptionEndpoint: e.target.value }))}
                      placeholder="https://YOUR-PROJECT.supabase.co/functions/v1/study-ics"
                      style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none", color: C.ink, boxSizing: "border-box" }} />
                  </div>
                  {!icsToken && (
                    <Btn variant="primary" onClick={() => {
                      const token = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `tok-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                      setPersistentProfile((p) => ({ ...p, icsSubscriptionToken: token }));
                      showToast("Subscription token generated");
                    }}>Generate subscription token</Btn>
                  )}
                  {subscriptionUrl && (
                    <div>
                      <SectionLabel style={{ marginBottom: 4 }}>Your subscription URL — paste into your calendar app</SectionLabel>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="text" readOnly value={subscriptionUrl} onClick={(e) => e.target.select()}
                          style={{ flex: 1, padding: "8px 10px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 10, color: C.inkSoft, outline: "none" }} />
                        <Btn variant="ghost" onClick={() => { navigator.clipboard.writeText(subscriptionUrl); showToast("URL copied"); }}><Copy size={12} /></Btn>
                      </div>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 6, lineHeight: 1.5 }}>
                        Google Calendar → Other calendars → From URL · Apple Calendar → File → New Calendar Subscription · Outlook → Add calendar → Subscribe from web.
                      </div>
                    </div>
                  )}
                </div>
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontFamily: fontMono, fontSize: 11, color: C.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase" }}>Show Edge Function code · deploy this to your Supabase</summary>
                  <pre style={{ marginTop: 8, padding: 12, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontMono, fontSize: 10, color: C.inkSoft, lineHeight: 1.45, overflowX: "auto", maxHeight: 360 }}>{`// supabase/functions/study-ics/index.ts
// Deploy: supabase functions deploy study-ics --no-verify-jwt
import { createClient } from ${'"https://' + 'esm.sh/@supabase/supabase-js@2"'};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const userId = url.searchParams.get("user");
  if (!token || !userId) return new Response("Missing token or user", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch profile to verify token + get classes/exam
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("profile, classes")
    .eq("user_id", userId)
    .single();
  if (error || !profile) return new Response("Not found", { status: 404 });
  if (profile.profile?.icsSubscriptionToken !== token) return new Response("Invalid token", { status: 403 });

  // Generate .ics content
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\\.\\d{3}/, "");
  const events: string[] = [];
  (profile.classes || []).forEach((cls: any, ci: number) => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(17, 0, 0, 0);
      const end = new Date(d.getTime() + 30 * 60000);
      events.push(\`BEGIN:VEVENT
UID:study-\${userId}-\${ci}-\${i}@study-it
DTSTAMP:\${fmt(now)}
DTSTART:\${fmt(d)}
DTEND:\${fmt(end)}
SUMMARY:Study: \${cls.name}
DESCRIPTION:Daily study reminder from Study It
END:VEVENT\`);
    }
  });
  if (profile.profile?.examDate) {
    const exam = new Date(profile.profile.examDate);
    events.push(\`BEGIN:VEVENT
UID:exam-\${userId}@study-it
DTSTAMP:\${fmt(now)}
DTSTART;VALUE=DATE:\${exam.toISOString().slice(0,10).replace(/-/g,"")}
SUMMARY:Exam
END:VEVENT\`);
  }
  const ics = \`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Study It//EN
\${events.join("\\n")}
END:VCALENDAR\`;
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=300" }
  });
});`}</pre>
                </details>
              </div>
            );
          })()}
        </div>

        {/* 1b. BACKEND CONFIG — Setup Pack import/export + per-user backend overrides */}
        <div style={cardWrap}>
          <div style={cardHead}>
            <Plug size={20} color={C.blue} />
            <SectionLabel style={{ ...cardLabel, color: C.blue }}>
              Backend configuration · {(() => {
                try {
                  const o = JSON.parse(localStorage.getItem("lectern_backend_overrides") || "{}");
                  const overrideCount = Object.keys(o).filter((k) => o[k]).length;
                  return overrideCount > 0 ? `${overrideCount} override${overrideCount === 1 ? "" : "s"} active` : "Using deployment defaults";
                } catch { return "Using deployment defaults"; }
              })()}
            </SectionLabel>
          </div>
          <div style={cardBody}>
            Each user of this deployment shares the same Supabase project + Edge Functions by default — fine for a study group where you trust each other (Row Level Security isolates your data from other users). If you want your own private backend instead (your own Supabase, your own Brave Search quota), paste your config below.
            <br /><br />
            <strong>Sharing this deployment with friends?</strong> Generate a Setup Pack (one click) to bundle your backend config into a JSON snippet. Recipients paste it once to import all URLs/keys.
          </div>
          {(() => {
            const overrides = (() => { try { return JSON.parse(localStorage.getItem("lectern_backend_overrides") || "{}"); } catch { return {}; } })();
            const saveOverride = (patch) => {
              const next = { ...overrides, ...patch };
              try { localStorage.setItem("lectern_backend_overrides", JSON.stringify(next)); } catch {}
              showToast("Backend override saved — reload the page for Supabase change to take effect");
              setSettingsForceUpdate((x) => x + 1);
            };
            const clearOverrides = () => {
              try { localStorage.removeItem("lectern_backend_overrides"); } catch {}
              showToast("Backend overrides cleared — using deployment defaults. Reload to apply.");
              setSettingsForceUpdate((x) => x + 1);
            };
            const exportSetupPack = () => {
              const pack = {
                version: 1,
                supabaseUrl: SUPABASE_URL,
                supabaseAnonKey: SUPABASE_ANON_KEY,
                localSearchEndpoint: persistentProfile.localSearchEndpoint || "",
                icsSubscriptionEndpoint: persistentProfile.icsSubscriptionEndpoint || "",
                generatedAt: new Date().toISOString(),
                fromVersion: APP_VERSION,
                note: "Paste into Settings → Backend Configuration → Import Setup Pack on another deployment of Study It.",
              };
              const json = JSON.stringify(pack, null, 2);
              navigator.clipboard?.writeText(json).then(() => showToast("Setup Pack copied to clipboard")).catch(() => {});
              // Also offer download
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `study-it-setup-pack-${Date.now()}.json`;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            };
            const importSetupPack = () => {
              const raw = prompt("Paste your Setup Pack JSON here:");
              if (!raw) return;
              try {
                const pack = JSON.parse(raw);
                if (!pack || pack.version !== 1) { showToast("Invalid Setup Pack (missing version)"); return; }
                const next = {
                  ...(pack.supabaseUrl ? { supabaseUrl: pack.supabaseUrl } : {}),
                  ...(pack.supabaseAnonKey ? { supabaseAnonKey: pack.supabaseAnonKey } : {}),
                };
                try { localStorage.setItem("lectern_backend_overrides", JSON.stringify(next)); } catch {}
                // Also write the per-user Edge Function URLs into persistentProfile
                setPersistentProfile((p) => ({
                  ...p,
                  ...(pack.localSearchEndpoint ? { localSearchEndpoint: pack.localSearchEndpoint } : {}),
                  ...(pack.icsSubscriptionEndpoint ? { icsSubscriptionEndpoint: pack.icsSubscriptionEndpoint } : {}),
                }));
                showToast(`Imported Setup Pack from v${pack.fromVersion || "?"} — reload to apply Supabase changes`);
                setSettingsForceUpdate((x) => x + 1);
              } catch (e) {
                showToast(`Import failed: ${e.message}`);
              }
            };
            return (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <Btn variant="primary" onClick={exportSetupPack}>
                    <Download size={12} /> Export Setup Pack
                  </Btn>
                  <Btn variant="ghost" onClick={importSetupPack}>
                    <ClipboardPaste size={12} /> Import Setup Pack
                  </Btn>
                  {Object.keys(overrides).filter((k) => overrides[k]).length > 0 && (
                    <Btn variant="ghost" onClick={clearOverrides}>
                      <RotateCw size={12} /> Reset to deployment defaults
                    </Btn>
                  )}
                </div>
                <details>
                  <summary style={{ cursor: "pointer", fontFamily: fontMono, fontSize: 11, color: C.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Manual overrides · use your own Supabase project</summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    <div>
                      <SectionLabel style={{ marginBottom: 4 }}>Supabase URL · current: <code style={{ fontFamily: fontMono, fontSize: 10, color: C.inkSoft }}>{SUPABASE_URL || "(none)"}</code></SectionLabel>
                      <input type="text" defaultValue={overrides.supabaseUrl || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (overrides.supabaseUrl || "")) saveOverride({ supabaseUrl: v }); }}
                        placeholder="https://YOUR-PROJECT.supabase.co"
                        style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11, outline: "none", color: C.ink, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <SectionLabel style={{ marginBottom: 4 }}>Supabase anon key</SectionLabel>
                      <input type="password" defaultValue={overrides.supabaseAnonKey || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (overrides.supabaseAnonKey || "")) saveOverride({ supabaseAnonKey: v }); }}
                        placeholder="eyJ... (the project's public anon key, not the service-role key)"
                        style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11, outline: "none", color: C.ink, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", lineHeight: 1.5 }}>
                      To use your own Supabase project, create one at <code style={{ fontFamily: fontMono, fontSize: 10, color: C.accent }}>supabase.com</code>, run the SQL schemas from the README in your project's SQL editor, then paste the URL + anon key here. Reload after saving for the new connection to take effect.
                    </div>
                  </div>
                </details>
              </div>
            );
          })()}
        </div>

        {/* 1c. LOCAL-MODEL WEB SEARCH PROXY (Bucket C fix) */}
        <div style={cardWrap}>
          <div style={cardHead}><Globe size={20} color={persistentProfile.localSearchEndpoint ? C.moss : C.gold} /><SectionLabel style={{ ...cardLabel, color: persistentProfile.localSearchEndpoint ? C.moss : C.gold }}>Web search for local model · {persistentProfile.localSearchEndpoint ? "Configured" : "Setup required"}</SectionLabel></div>
          <div style={cardBody}>
            Re-enables web search and lateral-reading fact-check on the local WebGPU AI. Without this, local generations have no internet access (real architectural limit — browsers can't search the web directly). Deploy the tiny Edge Function below to your own Supabase project, plug in your free Brave Search API key, and paste the function URL here. <strong>Cost:</strong> $0 / month for typical study use (Brave free tier: 2,000 queries/month).
          </div>
          {(() => {
            const endpoint = persistentProfile.localSearchEndpoint;
            return (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <SectionLabel style={{ marginBottom: 4 }}>Your Edge Function URL</SectionLabel>
                    <input type="text" value={endpoint || ""} onChange={(e) => setPersistentProfile((p) => ({ ...p, localSearchEndpoint: e.target.value.trim() }))}
                      placeholder="https://YOUR-PROJECT.supabase.co/functions/v1/study-search"
                      style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none", color: C.ink, boxSizing: "border-box" }} />
                  </div>
                  {endpoint && (
                    <Btn variant="ghost" onClick={async () => {
                      showToast("Pinging your search endpoint…");
                      const { error, results } = await localWebSearch("test query for connectivity", 3);
                      if (error) { showToast(`Test failed: ${error}`); }
                      else { showToast(`Test passed — got ${results.length} results`); }
                    }}>
                      <Sparkles size={11} /> Test endpoint
                    </Btn>
                  )}
                </div>
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontFamily: fontMono, fontSize: 11, color: C.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase" }}>Show Edge Function code · deploy this once to your Supabase</summary>
                  <div style={{ marginTop: 8, padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 12, color: C.ink, lineHeight: 1.55 }}>
                    <strong>Setup steps (~5 minutes):</strong>
                    <ol style={{ margin: "8px 0", paddingLeft: 22, lineHeight: 1.7 }}>
                      <li>Get a free Tavily API key at <code style={{ color: C.accent, fontFamily: fontMono, fontSize: 11 }}>tavily.com</code> (1,000 searches/month free, no credit card required)</li>
                      <li>In your Supabase project, run <code style={{ fontFamily: fontMono, fontSize: 11, color: C.accent }}>supabase secrets set TAVILY_API_KEY=&lt;your-key&gt;</code></li>
                      <li>Save the code below as <code style={{ fontFamily: fontMono, fontSize: 11 }}>supabase/functions/study-search/index.ts</code> in your Supabase project</li>
                      <li>Deploy with <code style={{ fontFamily: fontMono, fontSize: 11, color: C.accent }}>supabase functions deploy study-search --no-verify-jwt</code></li>
                      <li>Paste the resulting function URL in the field above</li>
                    </ol>
                  </div>
                  <pre style={{ marginTop: 8, padding: 12, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontMono, fontSize: 10, color: C.inkSoft, lineHeight: 1.45, overflowX: "auto", maxHeight: 360 }}>{`// supabase/functions/study-search/index.ts
// Deploy: supabase functions deploy study-search --no-verify-jwt
// Requires secret: supabase secrets set TAVILY_API_KEY=<your-tavily-key>
// Get a free Tavily API key at: tavily.com (1,000 searches/month, no credit card)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const apiKey = Deno.env.get("TAVILY_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "TAVILY_API_KEY not set" }), {
    status: 500, headers: { ...CORS, "Content-Type": "application/json" }
  });

  let body: { query: string; maxResults?: number };
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400, headers: CORS }); }

  const query = String(body.query || "").slice(0, 400).trim();
  const count = Math.max(1, Math.min(10, body.maxResults || 5));
  if (!query) return new Response(JSON.stringify({ error: "Empty query" }), {
    status: 400, headers: { ...CORS, "Content-Type": "application/json" }
  });

  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        query,
        max_results: count,
        search_depth: "basic",
        include_answer: false,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return new Response(JSON.stringify({
        error: \`Tavily API \${r.status}: \${errText.slice(0, 200)}\`
      }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    // Tavily's response: data.results[] with { title, url, content, ... }
    const results = (data?.results || []).slice(0, count).map((item: any) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: item.content || "",
    }));
    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "max-age=300" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});`}</pre>
                </details>
                {endpoint && (
                  <div style={{ marginTop: 10, padding: 10, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 12, color: C.ink, lineHeight: 1.55 }}>
                    ✓ Configured. When you generate with Local AI active and any web-search budget set in the AI Quality Studio, your local model will get [W1] [W2] search-result citations injected into its prompt. This unblocks lateral-reading fact-check on local.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 2. EXPORT EVERYTHING — full backup zip */}
        <div style={cardWrap}>
          <div style={cardHead}><Download size={20} color={C.gold} /><SectionLabel style={{ ...cardLabel, color: C.gold }}>Full backup · Working</SectionLabel></div>
          <div style={cardBody}>
            Real safety net. Downloads a <strong>.zip with everything</strong> — profile, classes, all notebooks (as JSON + readable markdown), vault generations, notes, session log, settings. Restore by pasting any file back into localStorage via devtools. API keys are deliberately excluded.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={exportEverything}>
              <Download size={14} /> Download backup zip
            </Btn>
            <span style={meta}>{liveNotebooks.length} notebook{liveNotebooks.length === 1 ? "" : "s"} · {savedGenerations.length} vault · {(notes || []).length} note{(notes || []).length === 1 ? "" : "s"} · {Object.keys(persistentProfile.cardStates || {}).length} card{Object.keys(persistentProfile.cardStates || {}).length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* 2b. MARKDOWN — Obsidian / Notion / any .md editor */}
        <div style={cardWrap}>
          <div style={cardHead}><FileText size={20} color={C.moss} /><SectionLabel style={cardLabel}>Markdown export · Working</SectionLabel></div>
          <div style={cardBody}>
            One <strong>.md file</strong> with your profile, classes, journal, mastered concepts, weak spots, and flashcard schedule. Open it in <strong>Obsidian, Notion (paste-to-import), Bear, Logseq, iA Writer</strong> — anything that reads markdown.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={downloadMarkdown}>
              <Download size={14} /> Download .md
            </Btn>
            <span style={meta}>{myClasses.length} class · {(journal || []).length} journal · {cardCount} cards</span>
          </div>
        </div>

        {/* 3. ANKI */}
        <div style={cardWrap}>
          <div style={cardHead}><Layers size={20} color={C.moss} /><SectionLabel style={cardLabel}>Anki export · Working</SectionLabel></div>
          <div style={cardBody}>
            Tab-separated <strong>.txt file</strong> with every flashcard you've reviewed. In Anki: <em>File → Import</em>, pick the file, set field separator to <strong>Tab</strong>, and import. Cards arrive tagged with their topic.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={downloadAnki} disabled={cardCount === 0}>
              <Download size={14} /> Download for Anki
            </Btn>
            <span style={meta}>{cardCount === 0 ? "Study some flashcards first to build a deck" : `${cardCount} card${cardCount === 1 ? "" : "s"} ready`}</span>
          </div>
        </div>

        {/* 4. PRINT */}
        <div style={cardWrap}>
          <div style={cardHead}><FileIcon size={20} color={C.moss} /><SectionLabel style={cardLabel}>Print study sheet · Working</SectionLabel></div>
          <div style={cardBody}>
            Generate a clean printable view of your current study content — flashcards, practice problems, or explanation notes with your classes and weak spots. Opens a new tab and triggers your printer dialog (or "Save as PDF").
          </div>
          <Btn variant="primary" onClick={printStudySheet}>
            <Camera size={14} /> Generate &amp; print
          </Btn>
        </div>

        {/* 5. WEBHOOK */}
        <div style={cardWrap}>
          <div style={cardHead}><Send size={20} color={C.moss} /><SectionLabel style={cardLabel}>Slack / Discord / Zapier · Working</SectionLabel></div>
          <div style={cardBody}>
            Paste an <strong>incoming webhook URL</strong> from Slack, Discord, or Zapier and Study It pings it with a daily summary of your sessions, minutes, weak spots, and recent topics.
            <br /><span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, marginTop: 6, display: "inline-block" }}>Slack: api.slack.com/messaging/webhooks · Discord: Server Settings → Integrations → Webhooks · Zapier: any "Webhooks by Zapier" trigger</span>
          </div>
          {!webhookUrl ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="text" value={webhookDraft} onChange={(e) => setWebhookDraft(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..."
                style={{ flex: 1, padding: "9px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none" }} />
              <Btn variant="primary" onClick={() => { const u = webhookDraft.trim(); if (!u.startsWith("https://")) { setWebhookStatus("Must be an https:// URL"); return; } setWebhookUrl(u); setWebhookDraft(""); setWebhookStatus("Saved"); showToast("Webhook saved"); }}>Save</Btn>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: fontMono, fontSize: 11, color: C.inkSoft, marginBottom: 8, wordBreak: "break-all", padding: "8px 10px", background: C.paperLight, borderRadius: 2 }}>{webhookUrl.length > 80 ? webhookUrl.slice(0, 70) + "…" + webhookUrl.slice(-8) : webhookUrl}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Btn variant="primary" onClick={pingWebhook}><Send size={14} /> Send summary now</Btn>
                <Btn variant="ghost" onClick={() => { setWebhookUrl(""); setWebhookStatus(""); showToast("Webhook removed"); }}>Remove</Btn>
                {webhookStatus && <span style={meta}>{webhookStatus}</span>}
              </div>
            </div>
          )}
        </div>

        {/* 6. GOOGLE DRIVE (API-key path) */}
        <div style={cardWrap}>
          <div style={cardHead}><Plug size={20} color={C.moss} /><SectionLabel style={cardLabel}>Google Drive · Working</SectionLabel></div>
          <div style={cardBody}>
            Pull <strong>Google Docs, Sheets, Slides, .txt, .md, .csv, and .docx</strong> from Drive into Study It as study material. Uses a <strong>Drive API key</strong> (lighter than full OAuth — no consent screen, no app verification). Read-only, and each file must be shared as <em>"Anyone with the link"</em> before Study It can read it.
            <br /><span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, marginTop: 6, display: "inline-block" }}>5-min setup: console.cloud.google.com → New Project → APIs &amp; Services → Library → enable "Google Drive API" → Credentials → Create credentials → API key → copy</span>
          </div>
          {!googleApiKey ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="password" value={googleApiKeyDraft} onChange={(e) => setGoogleApiKeyDraft(e.target.value)} placeholder="AIzaSy... (your Drive API key)"
                style={{ flex: 1, padding: "9px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none" }} />
              <Btn variant="primary" onClick={() => { const k = googleApiKeyDraft.trim(); if (!k || k.length < 20) { setDriveStatus("That doesn't look like a valid API key"); return; } setGoogleApiKey(k); setGoogleApiKeyDraft(""); setDriveStatus(""); showToast("API key saved"); }}>Save key</Btn>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", background: C.paperLight, borderRadius: 2 }}>
                <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkSoft, flex: 1 }}>API key: {googleApiKey.slice(0, 8)}…{googleApiKey.slice(-4)}</span>
                <button onClick={() => { setGoogleApiKey(""); setDriveStatus(""); showToast("API key removed"); }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer" }}>Remove</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="text" value={driveUrlDraft} onChange={(e) => setDriveUrlDraft(e.target.value)} placeholder="Paste a Drive share link (or file ID)"
                  onKeyDown={(e) => { if (e.key === "Enter" && !driveLoading) fetchDriveFile(); }}
                  style={{ flex: 1, padding: "9px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, outline: "none" }} />
                <Btn variant="primary" onClick={fetchDriveFile} disabled={driveLoading || !driveUrlDraft.trim()}>
                  {driveLoading ? <><Loader2 size={14} className="spin" /> Loading…</> : <><Download size={14} /> Load file</>}
                </Btn>
              </div>
              {driveStatus && (
                <div style={{ fontFamily: fontMono, fontSize: 11, color: driveStatus.startsWith("✓") ? C.moss : driveStatus.startsWith("Failed") ? C.accent : C.inkMuted, marginTop: 4 }}>{driveStatus}</div>
              )}
              {textDocs.filter((d) => d.fromDrive).length > 0 && (
                <div style={{ marginTop: 12, padding: 10, background: C.paperLight, borderRadius: 3 }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", marginBottom: 6 }}>LOADED FROM DRIVE ({textDocs.filter((d) => d.fromDrive).length})</div>
                  {textDocs.filter((d) => d.fromDrive).map((d, i) => (
                    <div key={d.fileId || i} style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, padding: "4px 0", borderBottom: `1px solid ${C.rule}` }}>
                      {d.name} <span style={{ color: C.inkMuted, fontFamily: fontMono, fontSize: 11 }}>· {Math.round(d.content.length / 1024) || 1} KB</span>
                    </div>
                  ))}
                  <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic", marginTop: 6 }}>These are now in your study materials — head to AI Tutor and pick a mode.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. GOOGLE DRIVE OAUTH (Path B — full read+write) */}
        <div style={cardWrap}>
          <div style={cardHead}><Plug size={20} color={C.moss} /><SectionLabel style={cardLabel}>Google Drive · OAuth (read + write) · Working</SectionLabel></div>
          <div style={cardBody}>
            Sign in with Google for <strong>full Drive access</strong> — save your Markdown exports straight to Drive, no manual download step. Uses OAuth 2.0 with PKCE (no client secret needed, no backend). Requires a one-time <strong>OAuth Client ID</strong> setup in Google Cloud Console (10–15 min).
            <br /><span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, marginTop: 6, display: "inline-block" }}>
              Setup: console.cloud.google.com → APIs &amp; Services → OAuth consent screen → External → fill basic info, add yourself as a Test user → save. Then Credentials → Create credentials → OAuth client ID → Web application → Authorized JavaScript origins: <code>{typeof window !== "undefined" ? window.location.origin : "your-app-url"}</code> → Authorized redirect URIs: same URL → Create → copy Client ID
            </span>
          </div>
          {oauthInFlight && <div style={{ ...meta, color: C.gold, marginBottom: 8 }}><Loader2 size={12} className="spin" /> Completing OAuth handshake…</div>}
          {!googleAccessToken ? (
            <div>
              {!googleClientId ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="text" value={googleClientIdDraft} onChange={(e) => setGoogleClientIdDraft(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com"
                    style={{ flex: 1, padding: "9px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none" }} />
                  <Btn variant="primary" onClick={() => { const id = googleClientIdDraft.trim(); if (!id || !id.includes(".apps.googleusercontent.com")) { setOauthStatus("Client ID must end with .apps.googleusercontent.com"); return; } setGoogleClientId(id); setGoogleClientIdDraft(""); setOauthStatus("Client ID saved — now sign in"); }}>Save Client ID</Btn>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", background: C.paperLight, borderRadius: 2 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkSoft, flex: 1 }}>Client ID: {googleClientId.slice(0, 20)}…</span>
                    <button onClick={() => { setGoogleClientId(""); setOauthStatus(""); }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer" }}>Change</button>
                  </div>
                  <Btn variant="primary" onClick={startGoogleOAuth} disabled={oauthInFlight}>Sign in with Google</Btn>
                </div>
              )}
              {oauthStatus && <div style={{ ...meta, color: oauthStatus.startsWith("✓") ? C.moss : oauthStatus.includes("Failed") || oauthStatus.includes("declined") ? C.accent : C.inkSoft, marginTop: 8 }}>{oauthStatus}</div>}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 12px", background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.moss }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, letterSpacing: "0.1em" }}>CONNECTED</div>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, fontWeight: 600 }}>{googleUserEmail || "Google account"}</div>
                </div>
                <Btn variant="ghost" onClick={signOutGoogle}>Disconnect</Btn>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn variant="primary" onClick={saveMarkdownToDrive}><Download size={14} /> Save Markdown export to Drive</Btn>
                {oauthStatus && <span style={{ ...meta, color: oauthStatus.startsWith("✓") ? C.moss : oauthStatus.includes("Failed") ? C.accent : C.inkSoft }}>{oauthStatus}</span>}
              </div>
            </div>
          )}
        </div>

        {/* HONEST: blocked integrations */}
        <div style={{ marginTop: 36, padding: 18, background: C.paperLight, border: `1px dashed ${C.rule}`, borderRadius: 3 }}>
          <SectionLabel style={{ marginBottom: 6 }}>Not possible from a browser alone</SectionLabel>
          <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>
            These show up in lots of edtech sites but can't be done from pure-browser code:
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              <li><strong>Notion live sync</strong> — Notion's API blocks browser CORS. Needs a server proxy. (You can still <em>paste</em> the Markdown export into Notion — it imports cleanly.)</li>
              <li><strong>Canvas, Blackboard, Schoology, Moodle</strong> — Each requires institution-level developer credentials from your school's IT.</li>
              <li><strong>Quizlet, Khan Academy</strong> — No public write APIs.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // ============ STUDYLOOP PAGES ============
  const renderWellbeing = () => (
    <div>
      <SectionLabel>Take Care</SectionLabel>
      <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 400, margin: "4px 0 8px", letterSpacing: "-0.02em" }}>
        Study hard. <em style={{ color: C.accent }}>Rest harder.</em>
      </h1>
      <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", marginBottom: 32, maxWidth: 620 }}>
        The science of learning includes knowing when to stop. Sleep, breaks, and honest check-ins beat grinding.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, marginBottom: 28 }}>
        {[
          { label: "Session length", val: `${wbSessionLen}m` },
          { label: "Hours slept", val: `${sleepHours}h` },
          { label: "Stress signal", val: stressLevel, accent: stressLevel === "High" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "18px 22px", borderRight: i < 2 ? `1px solid ${C.rule}` : "none", background: s.accent ? C.accentSoft : "transparent" }}>
            <SectionLabel accent={s.accent}>{s.label}</SectionLabel>
            <div style={{ fontFamily: fontDisplay, fontSize: 40, fontWeight: 400, color: s.accent ? C.accent : C.ink, lineHeight: 1, marginTop: 6 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {shouldStop && (
        <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 4, padding: 20, marginBottom: 16 }}>
          <SectionLabel style={{ color: C.accent, marginBottom: 6 }}>A gentle stop</SectionLabel>
          <p style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>
            {sleepHours < 5
              ? `You've been at this ${wbSessionLen} minutes on ${sleepHours} hours of sleep. The next hour will retain almost nothing — rest will do more than grinding here.`
              : `You've been studying ${wbSessionLen} minutes today. Past about 4 hours, retention drops sharply. Coming back fresh tomorrow tends to beat pushing through.`}
          </p>
          <Btn variant="accent" onClick={() => setStopAcknowledged(true)}>Take a real break</Btn>
        </div>
      )}

      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, padding: 20, marginBottom: 14 }}>
        <SectionLabel style={{ marginBottom: 6 }}>Sleep integration</SectionLabel>
        <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginBottom: 12 }}>How many hours did you sleep last night? Session intensity adjusts.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <input type="range" min="0" max="12" step="0.5" value={sleepHours} onChange={(e) => setSleepHours(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.ink }} />
          <span style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{sleepHours}h</span>
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginTop: 10, lineHeight: 1.6 }}>{sleepAdvice(sleepHours)}</div>
      </div>

      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, padding: 20, marginBottom: 14 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Long-session nudges</SectionLabel>
        {[
          { key: "eye", label: "20-20-20 eye breaks" },
          { key: "posture", label: "Posture check-in (every 45m)" },
          { key: "hydrate", label: "Hydration nudges" },
        ].map((t, i) => (
          <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: i > 0 ? `1px solid ${C.rule}` : "none" }}>
            <span style={{ fontFamily: fontSerif, fontSize: 15 }}>{t.label}</span>
            <Toggle on={wbToggles[t.key]} onClick={() => setWbToggles((p) => ({ ...p, [t.key]: !p[t.key] }))} />
          </div>
        ))}
      </div>

      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, padding: 20, marginBottom: 14 }}>
        <SectionLabel style={{ marginBottom: 6 }}>How are you feeling?</SectionLabel>
        <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginBottom: 12 }}>An honest check-in. No streaks at stake.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["great", "Great"], ["ok", "OK"], ["tired", "Tired"], ["overwhelmed", "Overwhelmed"]].map(([v, l]) => (
            <Btn key={v} variant={mood === v ? "primary" : "soft"} onClick={() => setMood(v)}>{l}</Btn>
          ))}
        </div>
        {mood && <div style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, marginTop: 12, lineHeight: 1.7, fontStyle: "italic" }}>{moodReplies[mood]}</div>}
      </div>

      <div style={{ background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 4, padding: 20 }}>
        <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>If you want to talk to someone</SectionLabel>
        <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.7, margin: 0 }}>
          If things feel heavy, reaching out is a good move — no pressure, any time. In the US you can call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline). Worldwide, <a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer" style={{ color: C.moss }}>findahelpline.com</a> lists free, confidential lines by country.
        </p>
      </div>
    </div>
  );

  // ============ SECOND BRAIN ============
  const renderBrain = () => {
    const byClass = {};
    notes.forEach((n) => { (byClass[n.cls] = byClass[n.cls] || []).push(n); });
    const n = brainConcepts.length;
    const cx = 350, cy = 150, r = Math.min(120, 40 + n * 9);
    return (
      <div>
        <SectionLabel>The Second Brain</SectionLabel>
        <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 600, margin: "4px 0 8px", letterSpacing: "-0.02em" }}>
          Everything, <em style={{ color: C.accent }}>connected.</em>
        </h1>
        <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", marginBottom: 32, maxWidth: 620 }}>
          Auto-organized notes, a map of every idea you've studied, a timeline of your learning, and search that works by meaning — not keyword.
        </p>

        {/* Meaning search */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Meaning search</SectionLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && meaningSearch()} placeholder={'Try "that thing about cells dividing"'}
              style={{ flex: 1, minWidth: 220, padding: "10px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none" }} />
            <Btn variant="primary" onClick={meaningSearch} disabled={searching}>{searching ? <><Loader2 size={12} className="spin" /> Searching</> : "Search"}</Btn>
          </div>
          {searchResults && (searchResults.length ? searchResults.map((s, i) => (
            <div key={i} style={{ marginTop: 8, padding: 10, background: C.paperDark, borderRadius: 2, fontFamily: fontSerif, fontSize: 14 }}>{s}</div>
          )) : <div style={{ marginTop: 10, fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>No semantic matches{notes.length || brainConcepts.length ? "" : " yet — add a note or study a topic first"}.</div>)}
        </div>

        {/* ============ REVIEW QUEUE: Spaced Repetition ============ */}
        {/* Surfaces all cards due across notebooks. Uses the existing SM-2 algorithm in rateCard(). */}
        <div style={{ background: dueCardsList.length > 0 ? C.goldSoft : C.paperLight, border: `1px solid ${dueCardsList.length > 0 ? C.gold : C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
            <SectionLabel style={{ color: dueCardsList.length > 0 ? C.gold : undefined }}>
              Review queue · {dueCardsList.length} card{dueCardsList.length === 1 ? "" : "s"} due
            </SectionLabel>
            {dueCardsList.length > 0 && (
              <Btn variant="primary" onClick={startReviewSession}>Start review session</Btn>
            )}
          </div>
          {dueCardsList.length === 0 ? (
            <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>
              {Object.keys(persistentProfile.cardStates || {}).length === 0
                ? "Generate flashcards in AI Tutor to start building a review queue."
                : "All due cards reviewed. Generate more, or come back when scheduled reviews are due."}
            </div>
          ) : (
            <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
              {dueCardsList.length === 1
                ? "1 card scheduled for review."
                : `${dueCardsList.length} cards scheduled for review.`}
              {dueCardsList.length > 30 && <span style={{ color: C.inkMuted }}> · Sessions are capped at 30 cards to keep them focused.</span>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {Array.from(new Set(dueCardsList.map((c) => c.topic).filter(Boolean))).slice(0, 8).map((t) => (
                  <span key={t} style={{ padding: "2px 8px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 10, color: C.inkSoft }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ============ VAULT: Saved Generations ============ */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel>Vault · {savedGenerations.length} saved generation{savedGenerations.length === 1 ? "" : "s"}</SectionLabel>
            {savedGenerations.length > 0 && (
              <button onClick={() => { if (confirm("Clear the entire Vault? This can't be undone.")) setSavedGenerations([]); }}
                style={{ background: "transparent", border: "none", fontFamily: fontSans, fontSize: 11, color: C.inkMuted, cursor: "pointer" }}>Clear all</button>
            )}
          </div>
          <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", margin: "0 0 14px" }}>
            Every flashcard set, explanation, exam, cheat sheet, curriculum, and concept map you've generated is saved here automatically. Click any card to reopen it in the Tutor — no need to regenerate.
          </p>
          {savedGenerations.length === 0 ? (
            <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>
              Empty for now. Generate something in the AI Tutor and it'll appear here.
            </div>
          ) : (
            <div className="vault-grid stagger-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {savedGenerations.map((g) => {
                const modeBadgeColor = { flashcards: C.gold, practice: C.blue, exam: C.accent, explain: C.moss, cheatsheet: C.ink, recall: C.gold, freeResponse: C.blue, derive: C.moss, critique: C.accent, curriculum: C.moss, conceptMap: C.blue, diagnostic: C.accent }[g.mode] || C.inkSoft;
                const ageMs = Date.now() - g.createdAt;
                const ageLabel = ageMs < 60000 ? "just now" : ageMs < 3600000 ? `${Math.floor(ageMs / 60000)}m ago` : ageMs < 86400000 ? `${Math.floor(ageMs / 3600000)}h ago` : `${Math.floor(ageMs / 86400000)}d ago`;
                // Build a brief preview
                let preview = "";
                try {
                  if (Array.isArray(g.content)) {
                    const first = g.content[0];
                    preview = first?.front || first?.question || first?.term || "";
                  } else if (g.content && typeof g.content === "object") {
                    preview = g.content.summary || g.content.overview || g.content.title || g.content.goal || "";
                  }
                } catch {}
                preview = String(preview).slice(0, 100);
                return (
                  <div key={g.id} onClick={() => reopenSavedGeneration(g)}
                    style={{ position: "relative", padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 3, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 8 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px -6px rgba(0,0,0,0.15)`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.rule; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: modeBadgeColor, fontWeight: 600 }}>{g.mode}</span>
                      <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>{ageLabel}</span>
                    </div>
                    <div style={{ fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: C.ink }}>{g.topic}</div>
                    {preview && <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, opacity: 0.85 }}>{preview}{preview.length === 100 ? "…" : ""}</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
                      {g.model && <span style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted }}>{g.model}</span>}
                      <button onClick={(e) => {
                        e.stopPropagation();
                        const snapshot = g;
                        deleteSavedGeneration(g.id);
                        pushUndo(`Deleted "${g.topic}" from Vault`, () => {
                          setSavedGenerations((prev) => [snapshot, ...prev.filter((x) => x.id !== snapshot.id)]);
                          showToast(`Restored "${snapshot.topic}"`);
                        });
                      }} title="Delete"
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkMuted, padding: 2, marginLeft: "auto" }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionLabel>Auto-organized notes</SectionLabel>
            <Btn variant="ghost" onClick={() => setShowAddNote(!showAddNote)} style={{ fontSize: 10 }}>{showAddNote ? "Cancel" : "+ Add note"}</Btn>
          </div>
          {showAddNote && (
            <div style={{ marginBottom: 14 }}>
              <input type="text" value={noteDraft.title} onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })} placeholder="Note title (e.g. Mitosis stages)"
                style={{ width: "100%", padding: "8px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
              <textarea value={noteDraft.body} onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })} placeholder="What did you learn?"
                style={{ width: "100%", minHeight: 60, padding: "8px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 14, marginBottom: 6, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <select value={noteDraft.cls} onChange={(e) => setNoteDraft({ ...noteDraft, cls: e.target.value })} style={{ flex: 1, padding: "8px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none" }}>
                  {["Biology", "Chemistry", "Physics", "Math", "CS", "History", "Languages", "Arts", "Economics", "Other"].map((c) => <option key={c}>{c}</option>)}
                </select>
                <Btn variant="primary" onClick={saveNote}>Save</Btn>
              </div>
            </div>
          )}
          {notes.length === 0 ? <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>No notes yet — add one, and it'll file itself by subject.</div> :
            Object.keys(byClass).map((cls) => (
              <div key={cls} style={{ marginBottom: 10 }}>
                <SectionLabel style={{ marginBottom: 6 }}>{cls}</SectionLabel>
                {byClass[cls].map((nt) => (
                  <div key={nt.id} style={{ padding: 10, border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 6, background: C.paper }}>
                    <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600 }}>{nt.title}</div>
                    {nt.body && <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 1.5 }}>{nt.body}</div>}
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Mnemonic generator */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Personalized mnemonic</SectionLabel>
          <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, marginTop: 0, marginBottom: 10 }}>Tell it what to remember — it builds a memory hook tied to your world.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="text" value={mnemonicTopic} onChange={(e) => setMnemonicTopic(e.target.value)} placeholder="e.g. the order of operations, the Krebs cycle"
              style={{ flex: 1, minWidth: 220, padding: "10px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none" }} />
            <Btn variant="primary" onClick={generateMnemonic} disabled={loadingMnemonic || !mnemonicTopic.trim()}>{loadingMnemonic ? <><Loader2 size={12} className="spin" /> Building</> : "Generate"}</Btn>
          </div>
          {mnemonic && <div style={{ marginTop: 12, padding: 14, background: C.goldSoft, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, lineHeight: 1.7 }}><RichText>{mnemonic}</RichText></div>}
        </div>

        {/* Concept graph */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Concept graph</SectionLabel>
          <div style={{ background: C.paperDark, borderRadius: 3, overflow: "hidden" }}>
            <svg width="100%" height="300" viewBox="0 0 700 300">
              {n === 0 ? <text x="350" y="150" textAnchor="middle" fill={C.inkMuted} fontSize="13" fontFamily={fontSans}>Study a topic or add a note — your map grows here.</text> :
                <>
                  {brainConcepts.map((c, i) => {
                    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
                    return <line key={"e" + i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.rule} strokeWidth="1" />;
                  })}
                  {brainConcepts.map((c, i) => {
                    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
                    const short = c.length > 16 ? c.slice(0, 14) + "…" : c;
                    return <g key={"n" + i}><circle cx={x} cy={y} r="24" fill={C.accentSoft} stroke={C.accent} strokeWidth="1.2" /><text x={x} y={y + 3} textAnchor="middle" fill={C.accent} fontSize="9" fontFamily={fontSans}>{short}</text></g>;
                  })}
                  <circle cx={cx} cy={cy} r="18" fill={C.ink} /><text x={cx} y={cy + 3} textAnchor="middle" fill={C.paper} fontSize="10" fontFamily={fontSans}>you</text>
                </>}
            </svg>
          </div>
        </div>

        {/* Insights: calibration + forgetting curve */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20, marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 12 }}>Insights</SectionLabel>
          <div className="mat-grid" style={{ gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            {/* Calibration */}
            <div>
              <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Confidence calibration</div>
              {!calibrationStats ? (
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>Answer a few quiz questions to start calibrating. Most learners are overconfident — this measures the gap.</div>
              ) : (
                <>
                  <svg width="100%" height="140" viewBox="0 0 200 140">
                    <line x1="20" y1="120" x2="190" y2="120" stroke={C.rule} strokeWidth="1" />
                    <line x1="20" y1="20" x2="20" y2="120" stroke={C.rule} strokeWidth="1" />
                    <line x1="20" y1="120" x2="190" y2="20" stroke={C.inkMuted} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    {calibrationStats.buckets.map((b, i) => {
                      if (b.accuracy === null) return null;
                      const x = 20 + (b.confidence - 1) * (170 / 4);
                      const y = 120 - b.accuracy * 100;
                      const onLine = Math.abs(b.accuracy - (b.confidence - 1) / 4) < 0.15;
                      return <g key={i}><circle cx={x} cy={y} r="5" fill={onLine ? C.moss : C.accent} stroke={C.paper} strokeWidth="1.5" /><text x={x} y={135} textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkMuted}>{b.confidence}</text></g>;
                    })}
                    <text x="105" y="14" textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkMuted} letterSpacing="0.1em">ACCURACY ↑ vs CONFIDENCE →</text>
                  </svg>
                  <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.5, marginTop: 4 }}>
                    Over {calibrationStats.n} answer{calibrationStats.n === 1 ? "" : "s"}: you're <strong>{calibrationStats.gap > 5 ? `${calibrationStats.gap}% overconfident` : calibrationStats.gap < -5 ? `${-calibrationStats.gap}% underconfident` : "well-calibrated"}</strong>.
                  </div>
                </>
              )}
            </div>
            {/* Forgetting curve */}
            <div>
              <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Forgetting curve</div>
              {(() => {
                const states = Object.values(persistentProfile.cardStates || {});
                if (states.length === 0) return <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>Rate some flashcards and your retention curve will appear — most material drops to ~30% in 24 hours without review.</div>;
                // For each card with a due/interval, retention at day t ≈ exp(-t/(interval * stabilityScale))
                const days = Array.from({ length: 30 }, (_, i) => i);
                const retention = days.map((d) => {
                  const vals = states.map((s) => {
                    const stab = Math.max(1, s.interval || 1);
                    return Math.exp(-d / (stab * 1.2));
                  });
                  return vals.reduce((a, b) => a + b, 0) / vals.length;
                });
                const pts = retention.map((r, i) => `${20 + (i / 29) * 170},${120 - r * 100}`).join(" ");
                return (
                  <>
                    <svg width="100%" height="140" viewBox="0 0 200 140">
                      <line x1="20" y1="120" x2="190" y2="120" stroke={C.rule} strokeWidth="1" />
                      <line x1="20" y1="20" x2="20" y2="120" stroke={C.rule} strokeWidth="1" />
                      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="2" />
                      <polyline points={`${pts} 190,120 20,120`} fill={C.accentSoft} opacity="0.4" />
                      <text x="20" y="135" fontSize="9" fontFamily={fontMono} fill={C.inkMuted}>NOW</text>
                      <text x="105" y="135" textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkMuted}>15d</text>
                      <text x="190" y="135" textAnchor="end" fontSize="9" fontFamily={fontMono} fill={C.inkMuted}>30d</text>
                      <text x="105" y="14" textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkMuted} letterSpacing="0.1em">EXPECTED RETENTION</text>
                    </svg>
                    <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.5, marginTop: 4 }}>
                      Across {states.length} card{states.length === 1 ? "" : "s"}, expected retention drops to ~{Math.round(retention[15] * 100)}% by day 15 without review.
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20 }}>
          <SectionLabel style={{ marginBottom: 10 }}>Study timeline</SectionLabel>
          {studyTimeline.length === 0 ? <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, fontStyle: "italic", lineHeight: 1.6 }}>"What you do every day matters more than what you do once in a while." <br /><span style={{ fontSize: 12, color: C.inkMuted }}>— Gretchen Rubin · Your timeline starts the moment you do.</span></div> :
            studyTimeline.slice(0, 30).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.rule}` : "none" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontSerif, fontSize: 14 }}>{t.label}</div>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>{new Date(t.ts).toLocaleString()}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  // ============ PROJECTS ============
  const renderProjects = () => (
    <div>
      <SectionLabel>Make Something Real</SectionLabel>
      <h1 className="display-xl" style={{ fontFamily: fontDisplay, fontSize: 56, fontWeight: 600, margin: "4px 0 8px", letterSpacing: "-0.02em" }}>
        Learning that <em style={{ color: C.accent }}>ships.</em>
      </h1>
      <p style={{ fontFamily: fontSerif, fontSize: 17, color: C.inkSoft, fontStyle: "italic", marginBottom: 32, maxWidth: 620 }}>
        Project-based modules where the output is something real — a working app, a research paper, a portfolio piece. Pick one; the AI plans your first hour.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PROJECTS.map((p, i) => (
          <div key={i} style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 21, fontWeight: 600 }}>{p.title}</div>
              <Pill color="moss">{p.tag}</Pill>
            </div>
            <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginBottom: 10, lineHeight: 1.6 }}>{p.why}</div>
            <div style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.9 }}>{p.steps.map((s, j) => <div key={j}>{j + 1}. {s}</div>)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted }}>~{p.hours} hrs total</span>
              <Btn variant="ghost" onClick={() => planProject(i)} disabled={loadingProject === i}>{loadingProject === i ? <><Loader2 size={12} className="spin" /> Planning</> : "Plan first hour ↗"}</Btn>
            </div>
            {projectPlans[i] && <div style={{ marginTop: 10, padding: 12, background: C.paperDark, borderRadius: 2, fontFamily: fontSerif, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{projectPlans[i]}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================================
  // MAIN RETURN — shell + routing + modals
  // ============================================================
  const navItems = [
    { id: "today", label: "Today", icon: BookOpen },
    { id: "library", label: "Library", icon: Layers },
    { id: "tutor", label: "AI Tutor", icon: Sparkles },
    { id: "brain", label: "Second Brain", icon: Network },
    { id: "projects", label: "Projects", icon: Workflow },
    { id: "code", label: "Code & STEM", icon: Code },
    { id: "wellbeing", label: "Wellbeing", icon: Heart },
    { id: "integrations", label: "Integrations", icon: Plug },
  ];

  const renderTutorPane = () => {
    // ============ STREAMING PREVIEW ============
    // Shows live partial text + provider-aware stats while a streamed generation is in progress.
    //   • Claude streams: only for the 3 prose modes (explain / briefing / audioOverview).
    //   • Local model streams: shows for ALL modes — local generations are slow and the user needs
    //     to see progress or they'll assume the app froze. Includes live tokens/sec readout.
    const isCloudStreamingMode = mode === "explain" || mode === "briefing" || mode === "audioOverview";
    const showStreamingPreview = loading && streamPartial && (
      (aiProvider === "anthropic" && isCloudStreamingMode) ||
      (aiProvider === "webllm") // ALL modes for local
    );
    if (showStreamingPreview) {
      const providerLabel = aiProvider === "webllm"
        ? (LOCAL_MODELS[webllmLoadedModel]?.label || "Local model")
        : "Cloud AI";
      const modeLabel = ({
        explain: "Explainer", briefing: "Briefing", audioOverview: "Audio overview",
        flashcards: "Flashcards", recall: "Recall cards", practice: "Practice MCQs", exam: "Exam",
        cheatsheet: "Cheatsheet", curriculum: "Curriculum", conceptMap: "Concept map",
        diagnostic: "Diagnostic", errorReview: "Error review", derive: "Derivation", critique: "Critique",
        mindMap: "Mind map", slideDeck: "Slide deck", dataTable: "Data table", freeResponse: "Free response",
      })[mode] || mode;
      return (
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <Loader2 size={16} className="spin" color={C.gold} />
            <SectionLabel style={{ color: C.gold }}>Streaming · {streamPartial.length.toLocaleString()} chars</SectionLabel>
            {/* Live tokens/sec for local model (the cloud API doesn't expose per-call rate) */}
            {aiProvider === "webllm" && webllmStats.running && webllmStats.tokensPerSec > 0 && (
              <span style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, padding: "2px 8px", background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 2 }}>
                {webllmStats.tokensPerSec} tok/s
                {webllmStats.firstTokenMs > 0 && ` · ${webllmStats.firstTokenMs}ms first`}
              </span>
            )}
            <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginLeft: "auto" }}>
              {providerLabel} · {modeLabel} · {topic}
            </span>
          </div>
          <div style={{ padding: 18, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, maxHeight: 480, overflowY: "auto", fontFamily: fontMono, fontSize: 11, lineHeight: 1.55, color: C.inkSoft, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {/* Strip JSON noise for readability when possible */}
            {streamPartial
              .replace(/^[\s\S]*?"(?:summary|title|intro|bottomLine|content|body|text)"\s*:\s*"/, "")
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .slice(-1800)}
          </div>
          <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic", marginTop: 10, lineHeight: 1.5 }}>
            {aiProvider === "webllm"
              ? `Streaming response from ${providerLabel} (running locally via WebGPU). Generation continues while you read; the formatted view will appear once it completes. ${LOCAL_MODELS[webllmLoadedModel]?.tier === "tiny" ? "This is a tiny model — output quality reflects its size." : ""}`
              : "Streaming raw response from the cloud AI. The final formatted view will appear once generation completes. Cancel by navigating away — partial generations don't save to the Vault."}
          </div>
        </div>
      );
    }
    if (loading || !mode) return renderTutorHome();
    const contentView = renderTutorContent();
    const advancedView = contentView ? null : renderTutorAdvanced();
    const v = contentView || advancedView;
    if (!v) return renderTutorHome();
    const fbKey = `${mode}::${(topic || "_").slice(0, 40)}`;
    const cur = generationFeedback[fbKey];
    return (
      <>
        {v}
        {mode && mode !== "tutor" && (
          <div style={{ marginTop: 20, padding: "14px 18px", borderTop: `1px solid ${C.rule}`, display: "flex", alignItems: "center", gap: 12, fontFamily: fontSans, fontSize: 12, color: C.inkMuted, flexWrap: "wrap" }}>
            <span style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>Was this helpful?</span>
            <button onClick={() => rateGeneration(1)} aria-label="Helpful" style={{
              padding: "5px 10px", background: cur === 1 ? C.mossSoft : C.paperLight, color: cur === 1 ? C.moss : C.inkSoft,
              border: `1px solid ${cur === 1 ? C.moss : C.rule}`, borderRadius: 2, cursor: "pointer", fontFamily: fontSans, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4,
            }}><Check size={12} /> Yes</button>
            <button onClick={() => rateGeneration(-1)} aria-label="Not helpful" style={{
              padding: "5px 10px", background: cur === -1 ? C.accentSoft : C.paperLight, color: cur === -1 ? C.accent : C.inkSoft,
              border: `1px solid ${cur === -1 ? C.accent : C.rule}`, borderRadius: 2, cursor: "pointer", fontFamily: fontSans, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4,
            }}><X size={12} /> No</button>
            <button onClick={() => setShowFeedback(true)} style={{
              padding: "5px 10px", background: "transparent", color: C.inkSoft, border: "none", cursor: "pointer", fontFamily: fontSans, fontSize: 12, textDecoration: "underline",
            }}>Detailed feedback</button>
          </div>
        )}
      </>
    );
  };

  const renderView = () => {
    switch (view) {
      case "today": return renderToday();
      case "library": return renderLibrary();
      case "tutor": return renderTutorPane();
      case "brain": return renderBrain();
      case "projects": return renderProjects();
      case "wellbeing": return renderWellbeing();
      case "code": return renderCode();
      case "integrations": return renderIntegrations();
      default: return renderToday();
    }
  };

  return (
    <div className="app-enter" style={{ minHeight: "100vh", background: C.paper, fontFamily: fontSans, color: C.ink,
      backgroundImage: `radial-gradient(ellipse at top left, ${C.paperDark} 0%, transparent 55%), radial-gradient(ellipse at bottom right, ${C.paperDark} 0%, transparent 55%)`,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; color: ${C.ink}; background: ${C.paper}; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-feature-settings: "kern" 1, "liga" 1; }
        /* Buttons inherit text color from parent — without this they default to browser black,
           which is invisible in dark mode. Affects buttons that don't set their own color. */
        button, input, select, textarea { color: inherit; font-family: inherit; }
        ::selection { background: ${C.accent}; color: ${C.paper}; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        details summary { list-style: none; }
        details summary::-webkit-details-marker { display: none; }
        input::placeholder, textarea::placeholder { color: ${C.inkMuted}; opacity: 0.95; }
        /* page-load + view transitions */
        .app-enter { animation: fadeIn 0.5s ease both; }
        .masthead-in { animation: fadeUp 0.6s cubic-bezier(0.2,0.7,0.2,1) both; }
        .nav-in { animation: fadeUp 0.6s cubic-bezier(0.2,0.7,0.2,1) 0.08s both; }
        .view-enter { animation: fadeUp 0.42s cubic-bezier(0.2,0.7,0.2,1) both; }
        .modal-in { animation: scaleIn 0.22s cubic-bezier(0.2,0.7,0.2,1) both; }
        .modal-bg-in { animation: fadeIn 0.18s ease both; }
        /* numerals: tabular in mono/stat contexts handled inline; editorial oldstyle for serif display */
        .od-num { font-feature-settings: "onum" 1, "kern" 1, "liga" 1; }
        /* micro-interactions */
        .btn { transition: transform 0.12s ease, opacity 0.15s, background 0.15s, box-shadow 0.15s; }
        .btn:not(:disabled):active { transform: translateY(1px) scale(0.985); }
        .btn:not(:disabled):hover { box-shadow: 0 3px 12px ${C.shadow}; }
        .navtab { transition: color 0.18s, background 0.18s, border-color 0.18s; }
        .navtab:hover { background: ${C.paperDark}; }
        .icon-btn { transition: background 0.15s, transform 0.12s; }
        .icon-btn:hover { background: ${C.paperDark}; }
        .icon-btn:active { transform: scale(0.92); }
        .modecard { transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s; }
        .lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px ${C.shadow}; }
        /* focus-visible rings for keyboard users */
        a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, [tabindex]:focus-visible {
          outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 2px;
        }
        button:focus:not(:focus-visible), a:focus:not(:focus-visible) { outline: none; }
        /* inputs */
        input, textarea, select { transition: border-color 0.15s, box-shadow 0.15s; }
        input:focus, textarea:focus, select:focus { border-color: ${C.inkSoft} !important; box-shadow: 0 0 0 3px ${C.accentSoft}55; }
        /* editorial scrollbar */
        ::-webkit-scrollbar { width: 11px; height: 11px; }
        ::-webkit-scrollbar-track { background: ${C.paper}; }
        ::-webkit-scrollbar-thumb { background: ${C.rule}; border: 3px solid ${C.paper}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.inkMuted}; }
        * { scrollbar-width: thin; scrollbar-color: ${C.rule} ${C.paper}; }
        .no-bar::-webkit-scrollbar { display: none; }
        /* ============ PREMIUM POLISH LAYER ============ */
        /* Tabular numerals — for stats, dates, prices, counters. Aligns digits in columns. */
        .tnum { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1, "kern" 1; }
        /* Oldstyle numerals — for editorial prose contexts */
        .onum { font-variant-numeric: oldstyle-nums proportional-nums; font-feature-settings: "onum" 1, "pnum" 1; }
        /* Refined multi-layer shadows — premium products stack 2-3 shadows for depth perception */
        .elev-1 { box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.06); }
        .elev-2 { box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.07); }
        .elev-3 { box-shadow: 0 4px 8px rgba(0,0,0,0.04), 0 12px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05); }
        .elev-4 { box-shadow: 0 8px 16px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.06); }
        /* Premium card lift on hover — subtle, refined */
        .card-lift { transition: transform 0.22s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.22s cubic-bezier(0.2,0.7,0.2,1), border-color 0.18s; }
        .card-lift:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.04), 0 12px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05); }
        /* Frosted-glass modal backdrop — modern premium feel */
        .modal-backdrop { backdrop-filter: blur(8px) saturate(140%); -webkit-backdrop-filter: blur(8px) saturate(140%); }
        /* Hairline rules — true premium dividers */
        .hairline { height: 1px; background: ${C.rule}; border: none; margin: 0; }
        .hairline-thick { height: 1px; background: ${C.ink}; border: none; opacity: 0.85; margin: 0; }
        .hairline-vert { width: 1px; background: ${C.rule}; align-self: stretch; }
        /* Staggered grid entrance — items fade in one after another */
        .stagger-grid > * { animation: fadeUp 0.5s cubic-bezier(0.2,0.7,0.2,1) both; }
        .stagger-grid > *:nth-child(1) { animation-delay: 0s; }
        .stagger-grid > *:nth-child(2) { animation-delay: 0.04s; }
        .stagger-grid > *:nth-child(3) { animation-delay: 0.08s; }
        .stagger-grid > *:nth-child(4) { animation-delay: 0.12s; }
        .stagger-grid > *:nth-child(5) { animation-delay: 0.16s; }
        .stagger-grid > *:nth-child(6) { animation-delay: 0.20s; }
        .stagger-grid > *:nth-child(7) { animation-delay: 0.24s; }
        .stagger-grid > *:nth-child(n+8) { animation-delay: 0.28s; }
        /* Skeleton loaders — content-shaped placeholders for premium async loading */
        .skel { background: linear-gradient(90deg, ${C.paperDark} 0%, ${C.paperLight} 50%, ${C.paperDark} 100%); background-size: 480px 100%; animation: shimmer 1.6s linear infinite; border-radius: 2px; }
        /* Premium primary button — subtle inner highlight + refined press */
        .btn-primary-premium { background: linear-gradient(180deg, #2E343F 0%, #1F242C 100%); color: ${C.ink}; border: 1px solid ${C.rule}; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4); }
        .btn-primary-premium:hover:not(:disabled) { box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 3px 8px rgba(0,0,0,0.22); }
        /* Press state for any clickable */
        .pressable { transition: transform 0.08s ease; }
        .pressable:active:not(:disabled) { transform: scale(0.98); }
        /* Refined section headers — eyebrow + heading + subtitle pattern */
        .section-eyebrow { font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.inkMuted}; font-weight: 600; }
        /* Drop-cap for editorial prose */
        .dropcap::first-letter { float: left; font-size: 3.2em; line-height: 0.9; padding: 4px 8px 0 0; font-family: ${fontDisplay}; color: ${C.accent}; font-weight: 500; }
        /* Subtle background pattern for premium feel (paper texture) */
        .paper-texture { background-image: radial-gradient(rgba(0,0,0,0.012) 1px, transparent 1px); background-size: 20px 20px; }
        /* Refined ink rule with masthead-style ornament */
        .ink-rule { height: 2px; background: ${C.ink}; border: none; margin: 0; }
        .ink-rule-thin { height: 1px; background: ${C.ink}; border: none; margin: 0; opacity: 0.95; }
        /* Focus-within for groups of inputs */
        .input-group:focus-within { box-shadow: 0 0 0 3px ${C.accentSoft}55; border-radius: 3px; }
        /* Better selection on dark backgrounds */
        .on-ink ::selection { background: ${C.gold}; color: ${C.ink}; }
        /* Premium feature: small caps for labels */
        .smcaps { font-variant: small-caps; letter-spacing: 0.04em; }
        /* Larger hit-area for tiny icon buttons (accessibility + premium feel) */
        .hit-area { position: relative; }
        .hit-area::before { content: ""; position: absolute; inset: -8px; }
        /* Reduced motion for users who prefer it */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
        /* High-DPI tweak: tighten letter-spacing on display fonts on Retina */
        @media (-webkit-min-device-pixel-ratio: 2) {
          .display-xl, .today-hero { letter-spacing: -0.025em !important; }
        }
        .no-bar { -ms-overflow-style: none; scrollbar-width: none; }
        /* grain + vignette overlay */
        .grain { position: fixed; inset: 0; pointer-events: none; z-index: 9999; opacity: 0.5; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E"); }
        /* responsive shell padding */
        .shell-pad { padding-left: 40px; padding-right: 40px; }
        @media (max-width: 720px) {
          .shell-pad { padding-left: 18px; padding-right: 18px; }
          .masthead-sub { display: none; }
          .display-xl { font-size: 38px !important; }
          .today-hero { font-size: 44px !important; }
          .today-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .today-grid > *:nth-child(2) { display: none !important; }
          /* On phones, hide secondary header tools — they're still reachable via the command palette (⌘K) */
          .tool-extended { display: none !important; }
          /* Tighter nav padding on phones */
          .navtab { padding: 10px 12px !important; }
        }
        @media (max-width: 480px) {
          .shell-pad { padding-left: 13px; padding-right: 13px; }
          .display-xl { font-size: 31px !important; }
          .today-hero { font-size: 34px !important; }
          .stat-strip { grid-template-columns: 1fr 1fr !important; }
          .stat-strip > * { border-right: none !important; }
          .vault-grid { grid-template-columns: 1fr !important; }
        }
        /* responsive content grids */
        .mode-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .mat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 760px) { .mode-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 440px) { .mode-grid { grid-template-columns: 1fr; } .mat-grid { grid-template-columns: repeat(2, 1fr); } }

        /* ============ COMPREHENSIVE MOBILE RESPONSIVE PASS ============ */
        /* iOS zoom prevention — inputs must be ≥16px font-size on iPhone to avoid auto-zoom on focus.
           Phones get 16px (vs desktop's 13-14px) for all interactive text fields. */
        @media (max-width: 720px) {
          input[type="text"], input[type="email"], input[type="password"], input[type="date"],
          input[type="number"], input[type="search"], input[type="tel"], input[type="url"],
          textarea, select { font-size: 16px !important; }
        }

        /* Nav tabs — horizontal scroll on phones instead of wrap (avoids 2-row tab bar) */
        @media (max-width: 720px) {
          .nav-strip {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x proximity;
            /* Visual scroll hint: a subtle right-edge gradient fade tells users they can scroll more */
            mask-image: linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%);
            -webkit-mask-image: linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%);
            /* Mobile header is shorter (~62px), so sticky offset matches */
            top: 62px !important;
          }
          .nav-strip::-webkit-scrollbar { display: none; }
          .nav-strip > * { scroll-snap-align: start; flex-shrink: 0; }
          /* Tabs themselves: tighter horizontal padding on mobile, more density */
          .navtab { padding: 11px 12px !important; gap: 5px !important; }
          /* Show only icons on very narrow screens, keep label on tablet */
          .navtab span.nav-label { display: inline; font-size: 12px !important; }
        }
        @media (max-width: 480px) {
          /* Phone header is even more compact (~56px tall), so nudge nav up further */
          .nav-strip { top: 56px !important; }
        }
        @media (max-width: 380px) {
          .navtab span.nav-label { display: none !important; }
          .navtab { padding: 11px 14px !important; }
          /* Very narrow phones: title is hidden, header is ~52px */
          .nav-strip { top: 52px !important; }
        }

        /* Modals — go full-screen on phones for actual usability */
        @media (max-width: 640px) {
          .modal-shell {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            margin: 0 !important;
            top: 0 !important; left: 0 !important;
            transform: none !important;
          }
          .modal-backdrop { padding: 0 !important; }
          .modal-body { padding: 18px !important; }
          .modal-header { padding: 14px 18px !important; }
        }

        /* Touch targets — minimum 40px tappable area on phones */
        @media (max-width: 720px) {
          button:not(.btn-link), .icon-btn, .chip-btn {
            min-height: 40px;
            touch-action: manipulation;
          }
          /* Slightly bigger gap between adjacent tappable items to reduce fat-finger mis-taps */
          .btn-row > * + * { margin-left: 8px; }
        }

        /* ============ HEADER (top bar) MOBILE LAYOUT ============
         * The header has the masthead on the left + a stack of icon buttons on the right.
         * On narrow phones, ALL of these compete for space. Tighten relentlessly:
         */
        @media (max-width: 480px) {
          /* "Study It" title slightly smaller on phones */
          .masthead-in > div:first-child > div:last-child > div:first-child {
            font-size: 18px !important;
          }
          /* Tighten icon-button padding so more fit per row */
          .masthead-in .icon-btn { padding: 6px !important; }
          /* Avatar circle shrinks slightly */
          .masthead-in > div:last-child > div:last-child {
            width: 28px !important; height: 28px !important; font-size: 12px !important; margin-left: 2px !important;
          }
        }
        @media (max-width: 380px) {
          /* On VERY narrow phones, hide the "Study It" text — keep only the gold S logo */
          .masthead-in > div:first-child > div:last-child {
            display: none !important;
          }
        }

        /* Notebook grid → 1 column on phones */
        @media (max-width: 640px) {
          .notebook-grid { grid-template-columns: 1fr !important; }
        }

        /* Today stat strip — 2x2 on phones, single column on very narrow */
        @media (max-width: 380px) {
          .stat-strip { grid-template-columns: 1fr !important; }
        }

        /* ============ MOBILE FIXES FOR RECENT ADDITIONS ============
         * Persona grid, change-password modal, class form etc. need mobile-friendly
         * layouts. These rules apply on screens narrower than 480px (phones).
         */
        @media (max-width: 480px) {
          /* Persona button grid (Settings → Tutor persona) — 2 cols cramped on phone */
          div[style*="gridTemplateColumns: \"1fr 1fr\""] {
            grid-template-columns: 1fr !important;
          }
          /* Class draft form gap reduction (was 6px → 8px for thumb spacing) */
          /* Soft, image-related banners stack their button rows vertically (handled via isMobile in JSX) */
          /* Inputs inside modals: 16px font-size already enforced above to prevent iOS zoom */

          /* Modals get tighter inner padding on phones */
          .modal-body, .modal-content { padding: 14px !important; }

          /* Settings sections — reduce label margins so density holds */
          .settings-section { padding: 12px !important; }
        }

        /* Settings / Help / Diagnostics — wide modals reflow */
        @media (max-width: 640px) {
          .settings-twocol { grid-template-columns: 1fr !important; }
          .help-twocol { grid-template-columns: 1fr !important; }
        }

        /* AI Tutor mode grid + content shells */
        @media (max-width: 640px) {
          .tutor-content-shell { padding: 14px !important; }
          .tutor-content-shell h1 { font-size: 24px !important; }
          .tutor-content-shell h2 { font-size: 19px !important; }
        }

        /* Slide deck nav arrows on phones — touch-friendly */
        @media (max-width: 640px) {
          .slide-nav-arrow { width: 44px !important; height: 44px !important; }
        }

        /* Review queue card buttons (Again/Hard/Good/Easy/Trivial) — 6-up grid breaks on phones */
        @media (max-width: 520px) {
          .review-rating-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }

        /* Onboarding modal sizing */
        @media (max-width: 640px) {
          .onboarding-progress { max-width: 100% !important; }
        }

        /* Reduce excessive padding inside content shells on phones */
        @media (max-width: 640px) {
          .content-card { padding: 16px !important; }
        }

        .topic-field { transition: border-color 0.18s, box-shadow 0.18s; }
        .topic-field:focus { border-bottom-color: ${C.accent} !important; box-shadow: 0 1px 0 ${C.accent} !important; }
        .chip-btn:hover { border-color: ${C.ink} !important; color: ${C.ink} !important; background: ${C.paper} !important; transform: translateY(-1px); box-shadow: 0 2px 6px -3px rgba(0,0,0,0.15); }
        .chip-btn:active { transform: translateY(0); }

        /* ========== PROFESSIONAL POLISH ==========
         * Global refinements applied to every interactive element. Each rule:
         *   1. Improves accessibility (visible focus rings on keyboard nav)
         *   2. Adds tactile feedback (subtle hover/active states)
         *   3. Smooths transitions (consistent easing curves)
         * Doesn't override any custom inline styles (specificity is mindful).
         */

        /* Focus-visible: shown only on keyboard navigation, not mouse clicks.
           Replaces the harsh default browser blue outline with a subtle accent ring. */
        input:focus-visible, textarea:focus-visible, select:focus-visible {
          border-color: ${C.accent} !important;
          box-shadow: 0 0 0 2px ${C.accent}33 !important;
        }
        button:focus-visible {
          outline: 2px solid ${C.accent} !important;
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* Smooth transitions on form elements — consistent easing */
        input, textarea, select {
          transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out, background 0.15s ease-out;
        }

        /* Buttons: tactile press feedback (translate down 1px on active) — feels responsive */
        button:not(:disabled):active {
          transform: translateY(1px);
        }
        button {
          transition: transform 0.08s ease-out, background 0.15s ease-out, border-color 0.15s ease-out, opacity 0.15s ease-out;
        }
        button:disabled {
          opacity: 0.55;
          cursor: not-allowed !important;
        }

        /* Subtle hover lift on input fields — confirms interactivity */
        input:not(:disabled):hover, textarea:not(:disabled):hover, select:not(:disabled):hover {
          border-color: ${C.inkMuted} !important;
        }

        /* Selection highlight — matches accent color for brand consistency */
        ::selection {
          background: ${C.accent}33;
          color: ${C.ink};
        }

        /* Scrollbar refinement — keeps editorial feel even on overflow */
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: ${C.paperLight};
        }
        ::-webkit-scrollbar-thumb {
          background: ${C.rule};
          border-radius: 5px;
          border: 2px solid ${C.paperLight};
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${C.inkMuted};
        }

        /* Typography rhythm — better small-cap and uppercase letter-spacing */
        h1, h2, h3, h4, h5, h6 {
          font-feature-settings: "kern", "liga", "calt";
          text-rendering: optimizeLegibility;
        }

        /* Links — restrained, with refined underline */
        a {
          color: ${C.accent};
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
          transition: text-decoration-color 0.15s, color 0.15s;
        }
        a:hover {
          color: ${C.ink};
          text-decoration-thickness: 1.5px;
        }

        /* Code blocks — refined monospace presentation */
        code, pre, .mono {
          font-feature-settings: "tnum", "zero", "ss01";
        }

        /* Refined details/summary disclosure widget */
        details > summary {
          transition: color 0.15s;
          list-style: none;
        }
        details > summary::-webkit-details-marker {
          display: none;
        }
        details > summary::before {
          content: "▸";
          display: inline-block;
          margin-right: 6px;
          transition: transform 0.18s;
          font-size: 0.85em;
        }
        details[open] > summary::before {
          transform: rotate(90deg);
        }
        details > summary:hover {
          color: ${C.ink};
        }

        /* Tab indicator — subtle underline pulse on hover */
        .tab-btn { position: relative; }
        .tab-btn::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -2px;
          width: 0;
          height: 1px;
          background: ${C.accent};
          transition: width 0.2s ease-out, left 0.2s ease-out;
        }
        .tab-btn:hover::after {
          width: 60%;
          left: 20%;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
        }
      `}</style>
      <div className="grain" aria-hidden="true" />

      {/* Command Palette (⌘K) */}
      {showCommandPalette && (() => {
        const commands = [
          // Navigation
          ...navItems.map((n) => ({ id: `nav-${n.id}`, label: `Go to ${n.label}`, group: "Navigate", action: () => setView(n.id) })),
          // AI modes (only on Tutor)
          { id: "mode-flashcards", label: "Generate Flashcards", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("flashcards"), 50); }, gated: !topic.trim() },
          { id: "mode-practice",   label: "Generate Practice MCQs", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("practice"), 50); }, gated: !topic.trim() },
          { id: "mode-explain",    label: "Explain this topic", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("explain"), 50); }, gated: !topic.trim() },
          { id: "mode-exam",       label: "Generate Exam (10 Qs)", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("exam"), 50); }, gated: !topic.trim() },
          { id: "mode-curriculum", label: "Build a Curriculum", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("curriculum"), 50); }, gated: !topic.trim() },
          { id: "mode-cheatsheet", label: "Generate Cheat Sheet", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("cheatsheet"), 50); }, gated: !topic.trim() },
          { id: "mode-conceptmap", label: "Build Concept Map", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("conceptMap"), 50); }, gated: !topic.trim() },
          { id: "mode-diagnostic", label: "Run Diagnostic Test", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("diagnostic"), 50); }, gated: !topic.trim() },
          { id: "mode-derive",     label: "Walk a Derivation", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("derive"), 50); }, gated: !topic.trim() },
          { id: "mode-critique",   label: "Critical Analysis", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("critique"), 50); }, gated: !topic.trim() },
          { id: "mode-tutor",      label: "Chat with Tutor", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("tutor"), 50); }, gated: !topic.trim() },
          { id: "mode-audio",      label: "Generate Audio Overview (podcast script)", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("audioOverview"), 50); }, gated: !topic.trim() },
          { id: "mode-mindmap",    label: "Build Mind Map", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("mindMap"), 50); }, gated: !topic.trim() },
          { id: "mode-briefing",   label: "Write Briefing Document", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("briefing"), 50); }, gated: !topic.trim() },
          { id: "mode-slides",     label: "Build Slide Deck", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("slideDeck"), 50); }, gated: !topic.trim() },
          { id: "mode-table",      label: "Extract Data Table", group: "AI Mode", action: () => { setView("tutor"); setTimeout(() => generateContent("dataTable"), 50); }, gated: !topic.trim() },
          // Actions
          { id: "act-settings",       label: "Open Settings", group: "Action",   action: () => setShowSettings(true) },
          { id: "act-feedback",       label: "Send feedback", group: "Action",   action: () => setShowFeedback(true) },
          { id: "act-paste",          label: "Paste notes as material", group: "Action", action: () => { setPasteDraft(pastedText); setShowPasteModal(true); } },
          { id: "act-math",           label: "Open Math Solver", group: "Action", action: () => setShowMathSolver(true) },
          { id: "act-whiteboard",     label: "Open Whiteboard", group: "Action", action: () => setShowWhiteboard(true) },
          { id: "act-examplan",       label: "Open Exam Planner", group: "Action", action: () => setShowExamPlanner(true) },
          { id: "act-shortcuts",      label: "Show keyboard shortcuts", group: "Action", action: () => setShowShortcutOverlay(true) },
          { id: "act-newtopic",       label: "Clear current topic", group: "Action", action: () => { setTopic(""); resetToHome && resetToHome(); } },
          { id: "act-vault",          label: `Open Vault (${savedGenerations.length} saved)`, group: "Action", action: () => setView("brain") },
          { id: "act-review",         label: `Review queue (${dueCardsList.length} card${dueCardsList.length === 1 ? "" : "s"} due)`, group: "Action", action: () => { setView("brain"); setTimeout(() => { if (dueCardsList.length > 0) startReviewSession(); }, 100); } },
          { id: "act-help",           label: "Help — every feature explained", group: "Action", action: () => setShowHelp(true) },
          { id: "act-theme-dark",     label: "Theme · Twilight Library (dark)", group: "Action", action: () => { setTheme("dark"); showToast("Theme: dark"); } },
          { id: "act-theme-light",    label: "Theme · Daybreak Library (light)", group: "Action", action: () => { setTheme("light"); showToast("Theme: light"); } },
          { id: "act-diagnostics",    label: "Diagnostics — version, storage, API usage", group: "Action", action: () => setShowDiagnostics(true) },
          { id: "act-about",          label: `About Study It v${APP_VERSION}`, group: "Action", action: () => setShowAbout(true) },
          ...(savedGenerations.length > 0 ? [{ id: "act-reopen-last", label: `Resume last: ${savedGenerations[0].topic} (${savedGenerations[0].mode})`, group: "Action", action: () => reopenSavedGeneration(savedGenerations[0]) }] : []),
          // Quality presets
          ...Object.entries(AI_PRESETS).map(([k, p]) => ({ id: `qual-${k}`, label: `Set quality: ${p.label}`, group: "AI Quality", action: () => { setAiSettings({ ...p }); showToast(`Quality: ${p.label}`); } })),
          // Integrations
          { id: "int-md",       label: "Export Markdown to file", group: "Export", action: () => { setView("integrations"); setTimeout(() => downloadMarkdown(), 100); } },
          { id: "int-ics",      label: "Export calendar (.ics)",  group: "Export", action: () => { setView("integrations"); setTimeout(() => downloadICS(), 100); } },
          { id: "int-export-all", label: "Export EVERYTHING (full backup zip)", group: "Export", action: exportEverything },
          { id: "int-anki",     label: "Export to Anki",          group: "Export", action: () => { setView("integrations"); setTimeout(() => downloadAnki(), 100); } },
          { id: "int-print",    label: "Print study sheet",       group: "Export", action: () => printStudySheet() },
          // Account
          ...(user ? [{ id: "act-signout", label: "Sign out", group: "Account", action: () => signOut() }] : (SUPABASE_URL ? [{ id: "act-signin", label: "Sign in", group: "Account", action: () => setShowAuthModal(true) }] : [])),
        ];
        const q = commandQuery.toLowerCase().trim();

        // ============ CROSS-CONTENT SEARCH ============
        // When user types ≥2 chars, search across their notebooks, vault, and notes — not just commands.
        // Matches by substring on title/preview, scored to surface the most-relevant first.
        let contentMatches = [];
        if (q.length >= 2) {
          // Search notebooks (name + source content)
          liveNotebooks.forEach((nb) => {
            const nameMatch = nb.name.toLowerCase().includes(q);
            const sourceMatch = (nb.sources || []).find((s) => (s.name + " " + s.content).toLowerCase().includes(q));
            if (nameMatch || sourceMatch) {
              contentMatches.push({
                id: `content-nb-${nb.id}`, group: "Notebooks",
                label: `${nb.emoji || "📓"} ${nb.name}${nameMatch ? "" : ` — matched in source: ${sourceMatch.name}`}`,
                action: () => { switchToNotebook(nb.id); setView("library"); },
              });
            }
          });
          // Search vault (topic + content stringified)
          savedGenerations.forEach((g) => {
            const haystack = (g.topic + " " + g.mode + " " + JSON.stringify(g.content).slice(0, 2000)).toLowerCase();
            if (haystack.includes(q)) {
              contentMatches.push({
                id: `content-vault-${g.id}`, group: "Vault",
                label: `${g.mode} · ${g.topic}${g.notebookName ? ` (in ${g.notebookName})` : ""}`,
                action: () => reopenSavedGeneration(g),
              });
            }
          });
          // Search notes
          (notes || []).forEach((n) => {
            const haystack = ((n.title || "") + " " + (n.body || "") + " " + (n.cls || "")).toLowerCase();
            if (haystack.includes(q)) {
              contentMatches.push({
                id: `content-note-${n.id || n.ts}`, group: "Notes",
                label: `${n.title || (n.body || "").slice(0, 60)}${n.cls ? ` · ${n.cls}` : ""}`,
                action: () => { setView("brain"); },
              });
            }
          });
          // Cap to avoid overwhelming the UI
          contentMatches = contentMatches.slice(0, 20);
        }

        const baseFiltered = q ? commands.filter((c) => !c.gated && c.label.toLowerCase().includes(q)) : commands.filter((c) => !c.gated);
        const filtered = [...contentMatches, ...baseFiltered];
        const safeIndex = Math.min(commandIndex, Math.max(0, filtered.length - 1));
        const execute = (cmd) => { cmd.action(); setShowCommandPalette(false); setCommandQuery(""); setCommandIndex(0); };
        return (
          <div onClick={() => setShowCommandPalette(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 270, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 6, maxWidth: 580, width: "90%", boxShadow: `0 30px 70px -10px rgba(0,0,0,0.5)`, overflow: "hidden", border: `1px solid ${C.rule}` }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.rule}` }}>
                <Sparkles size={16} color={C.inkMuted} />
                <input autoFocus type="text" value={commandQuery} onChange={(e) => { setCommandQuery(e.target.value); setCommandIndex(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setCommandIndex((i) => Math.min(i + 1, filtered.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setCommandIndex((i) => Math.max(i - 1, 0)); }
                    else if (e.key === "Enter" && filtered[safeIndex]) { e.preventDefault(); execute(filtered[safeIndex]); }
                  }}
                  placeholder="Type a command, page, or action…"
                  style={{ flex: 1, marginLeft: 12, padding: "4px 0", border: "none", outline: "none", fontFamily: fontSans, fontSize: 16, background: "transparent", color: C.ink }} />
                <kbd style={{ fontFamily: fontMono, fontSize: 10, padding: "2px 6px", background: C.paperDark, color: C.inkMuted, borderRadius: 2 }}>ESC</kbd>
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto", padding: "6px 0" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>No commands match "{commandQuery}"</div>
                ) : (() => {
                  const groups = {};
                  filtered.forEach((c, i) => { (groups[c.group] = groups[c.group] || []).push({ ...c, _i: i }); });
                  return Object.entries(groups).map(([group, items]) => (
                    <div key={group}>
                      <div style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: "0.12em", color: C.inkMuted, padding: "8px 18px 4px", textTransform: "uppercase" }}>{group}</div>
                      {items.map((c) => (
                        <button key={c.id} onClick={() => execute(c)} onMouseEnter={() => setCommandIndex(c._i)}
                          style={{ display: "flex", width: "100%", padding: "8px 18px", background: c._i === safeIndex ? C.paperDark : "transparent", border: "none", textAlign: "left", cursor: "pointer", fontFamily: fontSerif, fontSize: 14, color: C.ink }}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  ));
                })()}
              </div>
              <div style={{ display: "flex", gap: 12, padding: "8px 18px", borderTop: `1px solid ${C.rule}`, fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>
                <span><kbd style={{ background: C.paperDark, padding: "1px 5px", borderRadius: 2 }}>↑↓</kbd> navigate</span>
                <span><kbd style={{ background: C.paperDark, padding: "1px 5px", borderRadius: 2 }}>⏎</kbd> select</span>
                <span><kbd style={{ background: C.paperDark, padding: "1px 5px", borderRadius: 2 }}>?</kbd> all shortcuts</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Keyboard Shortcut Overlay (?) */}
      {showShortcutOverlay && (
        <div onClick={() => setShowShortcutOverlay(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 268, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 6, maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: `0 30px 70px -10px rgba(0,0,0,0.5)`, padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Keyboard shortcuts</h2>
              <button onClick={() => setShowShortcutOverlay(false)} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
              {[
                ["Universal", [
                  ["⌘K / Ctrl+K", "Command palette"],
                  ["?", "Show this overlay"],
                  ["Esc", "Close modals"],
                  ["/", "Focus topic field (on Tutor home)"],
                ]],
                ["Navigation", [
                  ["g h", "→ Today"], ["g l", "→ Library"], ["g t", "→ AI Tutor"], ["g b", "→ Second Brain"], ["g p", "→ Projects"], ["g w", "→ Wellbeing"],
                ]],
                ["Flashcards", [
                  ["Space", "Flip card"],
                  ["←  →", "Previous / next"],
                  ["1", "Forgot · 2", "Hard"],
                  ["3", "Good · 4", "Easy"],
                ]],
                ["Multiple-choice", [
                  ["1 / 2 / 3 / 4", "Pick option A / B / C / D"],
                  ["⏎", "Submit answer (after pick)"],
                ]],
              ].map(([groupName, rows]) => (
                <div key={groupName}>
                  <SectionLabel style={{ marginBottom: 10 }}>{groupName}</SectionLabel>
                  {rows.map(([keys, label], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < rows.length - 1 ? `1px solid ${C.rule}` : "none" }}>
                      <kbd style={{ fontFamily: fontMono, fontSize: 11, padding: "2px 7px", background: C.paperDark, color: C.ink, borderRadius: 2 }}>{keys}</kbd>
                      <span style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginLeft: 12, flex: 1, textAlign: "right" }}>{label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: "12px 16px", background: C.paperLight, borderRadius: 3, fontFamily: fontSerif, fontSize: 12, color: C.inkSoft }}>
              Press <kbd style={{ fontFamily: fontMono, fontSize: 10, padding: "1px 5px", background: C.paperDark, borderRadius: 2 }}>⌘K</kbd> anytime to jump to any tab, mode, or action without leaving the keyboard.
            </div>
          </div>
        </div>
      )}

      {/* Auth modal */}
      {showAuthModal && (
        <div onClick={() => !authLoading && setShowAuthModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 260, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 5, padding: 28, maxWidth: 420, width: "100%", boxShadow: `0 24px 60px -12px rgba(0,0,0,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <SectionLabel>{authDraft.mode === "signup" ? "Create account" : "Sign in"}</SectionLabel>
              <button onClick={() => !authLoading && setShowAuthModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={16} /></button>
            </div>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, margin: "4px 0 4px", letterSpacing: "-0.01em" }}>
              {authDraft.mode === "signup" ? "Welcome to Study It." : "Welcome back."}
            </h2>
            <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, margin: "0 0 18px" }}>
              {!supabaseReady ? "Loading cloud sync…" : "Your classes, progress, and notes sync across every device you sign in on."}
            </p>
            <input type="email" autoComplete="email" value={authDraft.email} onChange={(e) => setAuthDraft({ ...authDraft, email: e.target.value })} placeholder="you@example.com" disabled={authLoading}
              style={{ width: "100%", padding: "11px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
            <input type="password" autoComplete={authDraft.mode === "signup" ? "new-password" : "current-password"} value={authDraft.password} onChange={(e) => setAuthDraft({ ...authDraft, password: e.target.value })} placeholder={authDraft.mode === "signup" ? "Choose a password" : "Password"} disabled={authLoading}
              onKeyDown={(e) => { if (e.key === "Enter") { authDraft.mode === "signup" ? signUpWithPassword() : signInWithPassword(); } }}
              style={{ width: "100%", padding: "11px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />
            {authError && (
              <div style={{ padding: "9px 12px", background: C.accentSoft, color: C.accent, borderRadius: 2, fontFamily: fontSans, fontSize: 12, marginBottom: 12 }}>{authError}</div>
            )}
            <Btn variant="primary" onClick={authDraft.mode === "signup" ? signUpWithPassword : signInWithPassword} disabled={authLoading || !supabaseReady} style={{ width: "100%", justifyContent: "center", padding: 12 }}>
              {authLoading ? <><Loader2 size={14} className="spin" /> Working…</> : (authDraft.mode === "signup" ? "Create account" : "Sign in")}
            </Btn>
            <button onClick={signInWithMagicLink} disabled={authLoading || !supabaseReady} style={{ width: "100%", marginTop: 8, padding: 10, background: "transparent", color: C.inkSoft, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, cursor: "pointer" }}>
              Or email me a magic sign-in link
            </button>
            {/* Forgot password? — only shown in sign-in mode (not sign-up). Triggers Supabase
                resetPasswordForEmail which mails a reset link. User uses email above as the address. */}
            {authDraft.mode === "signin" && (
              <button onClick={sendPasswordReset} disabled={authLoading || !supabaseReady}
                style={{ width: "100%", marginTop: 6, padding: "6px 10px", background: "transparent", color: C.inkMuted, border: "none", fontFamily: fontSans, fontSize: 11, cursor: "pointer", textAlign: "center" }}>
                Forgot password?
              </button>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontFamily: fontSans, fontSize: 12 }}>
              <button onClick={() => { setAuthDraft({ ...authDraft, mode: authDraft.mode === "signup" ? "signin" : "signup" }); setAuthError(""); }} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 12 }}>
                {authDraft.mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
              </button>
              <button onClick={() => setShowAuthModal(false)} style={{ background: "transparent", border: "none", color: C.inkMuted, cursor: "pointer", fontSize: 12 }}>
                Continue without
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password modal — for signed-in users to update their password */}
      {showChangePassword && (
        <div onClick={() => !changePasswordDraft.loading && setShowChangePassword(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 5, padding: 28, maxWidth: 440, width: "100%", boxShadow: `0 24px 60px -12px rgba(0,0,0,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontFamily: fontSerif, fontSize: 22, fontWeight: 600, margin: 0, color: C.ink }}>Change password</h3>
              <button onClick={() => !changePasswordDraft.loading && setShowChangePassword(false)} disabled={changePasswordDraft.loading} aria-label="Close"
                style={{ background: "transparent", border: "none", cursor: changePasswordDraft.loading ? "not-allowed" : "pointer", color: C.inkMuted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginTop: 0, marginBottom: 18, fontStyle: "italic" }}>
              Enter your new password — minimum 8 characters. You'll stay signed in on this device after updating.
            </p>
            <input type="password" autoComplete="new-password" value={changePasswordDraft.next}
              onChange={(e) => setChangePasswordDraft({ ...changePasswordDraft, next: e.target.value, error: "" })}
              placeholder="New password" disabled={changePasswordDraft.loading}
              style={{ width: "100%", padding: "11px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
            <input type="password" autoComplete="new-password" value={changePasswordDraft.confirm}
              onChange={(e) => setChangePasswordDraft({ ...changePasswordDraft, confirm: e.target.value, error: "" })}
              placeholder="Confirm new password" disabled={changePasswordDraft.loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !changePasswordDraft.loading) {
                  const submit = document.getElementById("change-password-submit");
                  if (submit) submit.click();
                }
              }}
              style={{ width: "100%", padding: "11px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />
            {changePasswordDraft.error && (
              <div style={{ padding: "9px 12px", background: C.accentSoft, color: C.accent, borderRadius: 2, fontFamily: fontSans, fontSize: 12, marginBottom: 12 }}>{changePasswordDraft.error}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowChangePassword(false)} disabled={changePasswordDraft.loading}>Cancel</Btn>
              <Btn variant="primary" id="change-password-submit" disabled={changePasswordDraft.loading} onClick={async () => {
                const { next, confirm } = changePasswordDraft;
                if (!next || next.length < 8) { setChangePasswordDraft({ ...changePasswordDraft, error: "Password must be at least 8 characters" }); return; }
                if (next !== confirm) { setChangePasswordDraft({ ...changePasswordDraft, error: "Passwords don't match" }); return; }
                setChangePasswordDraft({ ...changePasswordDraft, loading: true, error: "" });
                const result = await changePassword(next);
                if (!result.ok) {
                  setChangePasswordDraft({ ...changePasswordDraft, loading: false, error: result.error });
                  return;
                }
                setShowChangePassword(false);
                setChangePasswordDraft({ next: "", confirm: "", error: "", loading: false });
              }}>
                {changePasswordDraft.loading ? <><Loader2 size={14} className="spin" /> Updating…</> : "Update password"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {showFeedback && (
        <div onClick={() => setShowFeedback(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 5, padding: 28, maxWidth: 480, width: "100%", boxShadow: `0 24px 60px -12px rgba(0,0,0,0.4)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <SectionLabel>Send feedback</SectionLabel>
              <button onClick={() => setShowFeedback(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={16} /></button>
            </div>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 600, margin: "4px 0 4px", letterSpacing: "-0.01em" }}>How's it going?</h2>
            <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>
              {ownerEmail
                ? <>Goes to <strong style={{ color: C.ink }}>{ownerEmail}</strong> via your email app, and is also saved locally.</>
                : <>Saved locally on this device. Export from Settings to share.</>}
            </p>
            {/* Rating */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { v: -1, label: "Not great", icon: "✗", c: C.accent },
                { v: 0, label: "OK", icon: "○", c: C.gold },
                { v: 1, label: "Loved it", icon: "✓", c: C.moss },
              ].map((r) => (
                <button key={r.v} onClick={() => setFeedbackDraft({ ...feedbackDraft, rating: r.v })} style={{
                  flex: 1, padding: "10px 12px", border: `2px solid ${feedbackDraft.rating === r.v ? r.c : C.rule}`,
                  background: feedbackDraft.rating === r.v ? r.c + "22" : C.paperLight, color: feedbackDraft.rating === r.v ? r.c : C.ink,
                  fontFamily: fontSans, fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 3,
                }}>{r.icon} {r.label}</button>
              ))}
            </div>
            {/* Category */}
            <select value={feedbackDraft.category} onChange={(e) => setFeedbackDraft({ ...feedbackDraft, category: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, marginBottom: 10, outline: "none" }}>
              {["Suggestion", "Bug report", "Praise", "AI quality", "GUI / usability", "Feature request", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <textarea value={feedbackDraft.text} onChange={(e) => setFeedbackDraft({ ...feedbackDraft, text: e.target.value })} placeholder="Tell us what worked, what didn't, what would help..."
              style={{ width: "100%", minHeight: 110, padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={feedbackDraft.includeContext} onChange={(e) => setFeedbackDraft({ ...feedbackDraft, includeContext: e.target.checked })} />
              Include current view, topic, and recent errors (helps debug)
            </label>
            <div style={{ padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, marginBottom: 12, fontStyle: "italic", lineHeight: 1.5 }}>
              {supabase
                ? "Goes to the app owner's feedback inbox. They'll see your message, rating, and (if you checked the box above) which page you were on."
                : "Saved locally only — no Supabase connection. The app owner won't see this unless they configure Supabase."}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowFeedback(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={submitFeedback}>{supabase ? "Send" : (ownerEmail ? <>Send to owner ↗</> : "Save locally")}</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 200,
          background: C.ink, color: C.paper, padding: "12px 22px", borderRadius: 3, fontFamily: fontSans, fontSize: 13, fontWeight: 500,
          letterSpacing: "0.02em", boxShadow: `0 12px 32px -8px rgba(0,0,0,0.5)`, display: "flex", alignItems: "center", gap: 10,
          animation: "fadeUp 0.3s cubic-bezier(0.2,0.7,0.2,1) both", maxWidth: "90vw" }}>
          <Check size={15} color={C.mossSoft} /> {toast}
        </div>
      )}


      {/* Header */}
      <header className="masthead-in shell-pad" style={{ borderBottom: `1px solid ${C.rule}`, paddingTop: 18, paddingBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", background: `${C.paperLight}F2`, backdropFilter: "blur(10px) saturate(160%)", WebkitBackdropFilter: "blur(10px) saturate(160%)", position: "sticky", top: 0, zIndex: 30, boxShadow: `0 1px 0 ${C.rule}, 0 8px 24px -18px ${C.shadow}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, background: `linear-gradient(150deg, ${C.gold}, #8B6F40)`, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, fontStyle: "italic", borderRadius: 4, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 6px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`, position: "relative", letterSpacing: "-0.02em" }}>
            S
            <span style={{ position: "absolute", bottom: 4, left: 7, right: 7, height: 2, background: C.accent, borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.01em" }}>Study It</div>
            <div className="masthead-sub" style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 4 }}>VOL.&nbsp;I&nbsp;·&nbsp;ISSUE&nbsp;{new Date().getFullYear() - 2025}&nbsp;·&nbsp;{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!isOnline && (
            <span title="You're offline — cloud AI API calls will fail. Local-only features (Vault, Notebooks, notes) still work." style={{ fontFamily: fontMono, fontSize: 10, padding: "4px 10px", background: C.accent, color: C.paper, borderRadius: 2, marginRight: 6, fontWeight: 600, letterSpacing: "0.1em", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.paper }} /> OFFLINE
            </span>
          )}
          {timerActive && (
            <span style={{ fontFamily: fontMono, fontSize: 12, padding: "4px 10px", background: C.ink, color: C.paper, borderRadius: 2, marginRight: 6, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(timerSeconds)}{timerMode === "break" ? " break" : ""}
            </span>
          )}
          {(persistentProfile.freezeTokens || 0) > 0 && (
            <span title={`${persistentProfile.freezeTokens} freeze token${persistentProfile.freezeTokens > 1 ? "s" : ""} — keeps your streak alive on a missed day`} style={{ fontFamily: fontMono, fontSize: 11, padding: "4px 8px", background: C.blueSoft, color: C.blue, borderRadius: 2, marginRight: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
              ❄ {persistentProfile.freezeTokens}
            </span>
          )}
          {/* Account chip */}
          {SUPABASE_URL ? (
            user ? (
              <button onClick={() => setShowSettings(true)} title={`Signed in as ${user.email}${syncStatus === "syncing" ? " · syncing…" : syncStatus === "error" ? " · sync error" : " · synced"}`} style={{
                fontFamily: fontSans, fontSize: 11, padding: isMobile ? "4px 8px" : "4px 10px", background: C.mossSoft, color: C.moss, border: `1px solid ${C.moss}`, borderRadius: 2, marginRight: isMobile ? 4 : 6,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: syncStatus === "error" ? C.accent : syncStatus === "syncing" ? C.gold : C.moss }} />
                {isMobile ? user.email[0].toUpperCase() : (user.email.length > 22 ? user.email.slice(0, 20) + "…" : user.email)}
              </button>
            ) : (
              <button onClick={() => setShowAuthModal(true)} style={{
                fontFamily: fontSans, fontSize: 11, padding: "4px 12px", background: C.ink, color: C.paper, border: "none", borderRadius: 2, marginRight: isMobile ? 4 : 6,
                cursor: "pointer", fontWeight: 600, letterSpacing: "0.02em",
              }}>Sign in</button>
            )
          ) : null}
          {/* Feedback button — replaces the old floating FAB. Sits next to Sign in for visibility. */}
          <button onClick={() => setShowFeedback(true)} title="Send feedback" aria-label="Send feedback" style={{
            fontFamily: fontSans, fontSize: 11, padding: isMobile ? "6px 8px" : "4px 10px", background: "transparent", color: C.inkSoft,
            border: `1px solid ${C.rule}`, borderRadius: 2, marginRight: isMobile ? 4 : 6,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500,
          }}>
            <MessageCircle size={12} />
            {!isMobile && "Feedback"}
          </button>
          <button className="icon-btn" onClick={() => setShowExamPlanner(true)} title="Exam planner" style={iconBtnStyle}>
            <Calendar size={16} color={C.inkSoft} />
            {persistentProfile.examDate && <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkSoft, marginLeft: 2 }}>{Math.max(0, Math.ceil((new Date(persistentProfile.examDate).getTime() - Date.now()) / 86400000))}d</span>}
          </button>
          <button className="icon-btn tool-extended" onClick={() => setTeachBackActive(true)} title="Teach it back" style={iconBtnStyle}><Drama size={16} color={C.inkSoft} /></button>
          <button className="icon-btn tool-extended" onClick={() => { if (!timerActive && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); setTimerActive(!timerActive); }} title="Pomodoro" style={iconBtnStyle}><Timer size={16} color={C.inkSoft} /></button>
          <button className="icon-btn tool-extended" onClick={() => setShowMathSolver(true)} title="Math solver" style={iconBtnStyle}><Calculator size={16} color={C.inkSoft} /></button>
          <button className="icon-btn tool-extended" onClick={() => setShowWhiteboard(true)} title="Whiteboard" style={iconBtnStyle}><Edit3 size={16} color={C.inkSoft} /></button>
          <button className="icon-btn" onClick={() => setShowHelp(true)} title="Help · explains everything" style={iconBtnStyle}><HelpCircle size={16} color={C.inkSoft} /></button>
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} style={iconBtnStyle}>
            {theme === "dark"
              ? <Sparkles size={16} color={C.gold} />
              : <Sparkles size={16} color={C.inkSoft} style={{ transform: "rotate(180deg)" }} />}
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" style={iconBtnStyle}><Settings size={16} color={C.inkSoft} /></button>
          <div style={{ width: 32, height: 32, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisplay, fontSize: 14, fontWeight: 600, marginLeft: 6 }}>
            {(persistentProfile.goal || "S")[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Nav strip */}
      <nav className="nav-in shell-pad no-bar nav-strip" style={{ borderBottom: `1px solid ${C.rule}`, display: "flex", gap: 2, background: `${C.paperLight}F2`, backdropFilter: "blur(8px)", overflowX: "auto", position: "sticky", top: 75, zIndex: 29, scrollBehavior: "smooth" }}>
        {navItems.map((item) => (
          <div key={item.id}
            ref={(el) => { if (el && view === item.id && isMobile) { try { el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {} } }}
            className="navtab" onClick={() => { setView(item.id); }} title={item.label} style={{
            padding: "12px 16px", fontFamily: fontSans, fontSize: 13, letterSpacing: "0.04em",
            color: view === item.id ? C.ink : C.inkMuted, fontWeight: view === item.id ? 600 : 500,
            borderBottom: view === item.id ? `2px solid ${C.accent}` : "2px solid transparent",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: -1, whiteSpace: "nowrap",
          }}>
            <item.icon size={14} />
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Body */}
      <main className="shell-pad" style={{ maxWidth: view === "tutor" && mode && !loading ? 900 : 1180, margin: "0 auto", paddingTop: 40, paddingBottom: 80, transition: "max-width 0.25s ease" }}>
        <div key={view + (mode || "")} className="view-enter">
          {renderView()}
        </div>
      </main>

      {/* Footer — institutional masthead-style */}
      <footer className="shell-pad" style={{ borderTop: `2px solid ${C.ink}`, paddingTop: 28, paddingBottom: 36, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, background: `linear-gradient(150deg, ${C.gold}, #8B6F40)`, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, fontStyle: "italic", borderRadius: 3, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15)` }}>S</div>
              <div>
                <div style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.005em" }}>Study It</div>
                <div style={{ fontFamily: fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 3 }}>An editorial AI study companion</div>
              </div>
            </div>
            <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", lineHeight: 1.55, margin: 0, maxWidth: 340 }}>
              Your sources stay on your device unless you connect Drive or sync your profile.
            </p>
          </div>
          <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 8 }}>Work</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => setView("today")} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Today</button>
                <button onClick={() => setView("library")} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Library &amp; Notebooks</button>
                <button onClick={() => setView("tutor")} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>AI Tutor</button>
                <button onClick={() => setView("brain")} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Second Brain</button>
              </div>
            </div>
            <div>
              <div className="section-eyebrow" style={{ marginBottom: 8 }}>Tools</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => setShowHelp(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left", fontWeight: 600 }}>Help Center</button>
                <button onClick={() => setShowSettings(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Settings</button>
                <button onClick={() => setShowHelp(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Help &amp; docs</button>
                <button onClick={() => setShowCommandPalette(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Command palette (⌘K)</button>
                <button onClick={() => setShowShortcutOverlay(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Keyboard shortcuts</button>
                <button onClick={() => setShowDiagnostics(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Diagnostics</button>
                <button onClick={() => setShowAbout(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>About v{APP_VERSION}</button>
                <button onClick={() => setShowFeedback(true)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: fontSans, fontSize: 12, color: C.inkSoft, cursor: "pointer", textAlign: "left" }}>Send feedback</button>
              </div>
            </div>
          </div>
        </div>
        <hr className="hairline" style={{ marginTop: 24, marginBottom: 16 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <div>© Study It · Est. 2026 · <span className="tnum">v{APP_VERSION}</span></div>
          <div style={{ fontFamily: fontDisplay, fontSize: 16, fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: C.rule }}>❦</div>
          <div>Read · Reflect · Remember</div>
        </div>
      </footer>

      {/* ============ MODALS ============ */}
      {/* Paste */}
      {showPasteModal && (
        <ModalShell onClose={() => setShowPasteModal(false)} title="Paste your notes">
          <textarea value={pasteDraft} onChange={(e) => setPasteDraft(e.target.value)} placeholder="Paste class notes, an article, a passage..."
            autoFocus style={{ width: "100%", minHeight: 220, padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowPasteModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => { setPastedText(pasteDraft); setShowPasteModal(false); }}>Save notes</Btn>
          </div>
        </ModalShell>
      )}

      {/* Math solver */}
      {/* ============ DERIVE A PROOF — collects topic first, then runs derive mode ============ */}
      {showDerivePrompt && (
        <ModalShell onClose={() => { setShowDerivePrompt(false); setDeriveTopicDraft(""); }} title="Derive a proof or formula" icon={<Sigma size={18} color={C.plum} />}>
          <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14, fontStyle: "italic" }}>
            Tell me what you want derived. Be specific — "the quadratic formula", "integration by parts from the product rule", "F=ma from Newton's second law assuming constant mass", "Bayes' theorem".
          </p>
          <textarea value={deriveTopicDraft} onChange={(e) => setDeriveTopicDraft(e.target.value)}
            placeholder="What to derive..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && deriveTopicDraft.trim()) { const t = deriveTopicDraft.trim(); setShowDerivePrompt(false); setDeriveTopicDraft(""); setView("tutor"); generateContent("derive", t); } }}
            style={{ width: "100%", minHeight: 80, padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => { setShowDerivePrompt(false); setDeriveTopicDraft(""); }}>Cancel</Btn>
            <Btn variant="primary" disabled={!deriveTopicDraft.trim()} onClick={() => {
              const t = deriveTopicDraft.trim();
              if (!t) return;
              setShowDerivePrompt(false);
              setDeriveTopicDraft("");
              setView("tutor");
              // Pass topic directly via overrideTopic parameter — avoids the stale-closure trap
              // that setTopic + setTimeout had (the setTimeout closure captures the OLD generateContent
              // which closes over the OLD empty topic).
              generateContent("derive", t);
            }}>Derive <ArrowRight size={14} /></Btn>
          </div>
          <div style={{ marginTop: 10, fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>⌘+Enter to submit</div>
        </ModalShell>
      )}

      {/* ============ EXPLAIN CODE — paste any snippet, get line-by-line walkthrough ============ */}
      {showCodeExplain && (
        <ModalShell onClose={() => { setShowCodeExplain(false); setCodeExplainDraft(""); setCodeExplainResult(null); }} title="Explain code" icon={<Code size={18} color={C.moss} />} wide>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <SectionLabel style={{ marginBottom: 0 }}>Paste your code</SectionLabel>
            <select value={codeExplainLang} onChange={(e) => setCodeExplainLang(e.target.value)}
              style={{ padding: "4px 10px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11, color: C.ink, outline: "none", marginLeft: "auto" }}>
              <option value="auto">Auto-detect</option>
              <option value="JavaScript">JavaScript / TypeScript</option>
              <option value="Python">Python</option>
              <option value="Rust">Rust</option>
              <option value="Go">Go</option>
              <option value="Java">Java</option>
              <option value="C++">C++</option>
              <option value="C">C</option>
              <option value="SQL">SQL</option>
              <option value="Shell">Shell / Bash</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <textarea value={codeExplainDraft} onChange={(e) => setCodeExplainDraft(e.target.value)}
            placeholder="// Paste any function, snippet, or full file (up to ~8000 chars)..."
            autoFocus
            style={{ width: "100%", minHeight: 140, maxHeight: 320, padding: 12, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.55, whiteSpace: "pre", overflow: "auto" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <Btn variant="primary" disabled={!codeExplainDraft.trim() || codeExplainLoading} onClick={explainCodeSnippet}>
              {codeExplainLoading ? <><Loader2 size={12} className="spin" /> Analyzing…</> : <>Explain <ArrowRight size={14} /></>}
            </Btn>
            <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginLeft: "auto" }}>
              {codeExplainDraft.length.toLocaleString()} / 8,000 chars
            </span>
          </div>

          {codeExplainResult && !codeExplainResult.error && (
            <div style={{ marginTop: 18, padding: 14, background: C.paperLight, borderRadius: 3, border: `1px solid ${C.rule}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <Pill color="moss">{codeExplainResult.language || "Unknown"}</Pill>
                <span style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, fontStyle: "italic" }}>{codeExplainResult.summary}</span>
              </div>
              {Array.isArray(codeExplainResult.walkthrough) && codeExplainResult.walkthrough.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SectionLabel style={{ marginBottom: 6 }}>Walkthrough</SectionLabel>
                  {codeExplainResult.walkthrough.map((w, i) => (
                    <div key={i} style={{ borderLeft: `2px solid ${C.moss}`, paddingLeft: 12, marginBottom: 10 }}>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, marginBottom: 2, letterSpacing: "0.05em" }}>{w.lines}</div>
                      <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.55 }}><RichText>{w.explanation}</RichText></div>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(codeExplainResult.gotchas) && codeExplainResult.gotchas.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SectionLabel style={{ marginBottom: 6, color: C.accent }}>Gotchas</SectionLabel>
                  <ul style={{ margin: 0, paddingLeft: 20, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
                    {codeExplainResult.gotchas.map((g, i) => <li key={i}><RichText>{g}</RichText></li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(codeExplainResult.improvements) && codeExplainResult.improvements.length > 0 && (
                <div>
                  <SectionLabel style={{ marginBottom: 6, color: C.gold }}>Improvements</SectionLabel>
                  <ul style={{ margin: 0, paddingLeft: 20, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
                    {codeExplainResult.improvements.map((g, i) => <li key={i}><RichText>{g}</RichText></li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {codeExplainResult?.error && (
            <div style={{ marginTop: 14, padding: 12, background: C.accentSoft, color: C.accent, borderRadius: 2, fontSize: 13, fontFamily: fontSerif }}>{codeExplainResult.error}</div>
          )}
        </ModalShell>
      )}

      {/* ============ CAMERA SCANNER — live edge-detect + auto-capture ============ */}
      {showCameraScanner && (
        <div onClick={(e) => { if (e.target === e.currentTarget) stopCameraScanner(); }} style={{
          position: "fixed", inset: 0, background: "#000", zIndex: 200,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontFamily: fontSans, fontSize: 13 }}>
              <Camera size={16} />
              <span>{scannerStatus || "Initializing camera…"}</span>
            </div>
            <button onClick={stopCameraScanner} aria-label="Close scanner" style={{
              padding: "8px 14px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 3, fontFamily: fontSans, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <X size={14} /> Cancel
            </button>
          </div>

          <div style={{ position: "relative", width: "100%", maxWidth: 900, maxHeight: "75vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={cameraVideoRef} playsInline autoPlay muted style={{
              width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 4, background: "#111",
            }} />
            <canvas ref={cameraOverlayRef} style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none",
            }} />
          </div>

          {/* Stable-frames progress bar */}
          {scannerStableFrames > 0 && (
            <div style={{ width: "60%", maxWidth: 380, marginTop: 14, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, scannerStableFrames / 12 * 100)}%`, height: "100%", background: "#52a06b", transition: "width 0.08s" }} />
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => {
              const video = cameraVideoRef.current;
              if (!video) return;
              const bounds = detectPaperInFrame(video) || { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
              cameraCapturedRef.current = true;
              captureCameraFrame(bounds);
            }} style={{
              width: 70, height: 70, borderRadius: "50%", background: "#fff", border: "4px solid rgba(255,255,255,0.5)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }} title="Capture now">
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#fff", border: "2px solid #000" }} />
            </button>
          </div>

          <div style={{ marginTop: 14, color: "rgba(255,255,255,0.7)", fontFamily: fontSerif, fontSize: 12, fontStyle: "italic", maxWidth: 500, textAlign: "center", padding: "0 20px" }}>
            Point at a sheet of paper on a contrasting (darker) surface with even lighting. The scanner auto-captures when it sees a stable rectangular region. Or tap the shutter button to capture manually.
          </div>
        </div>
      )}

      {showMathSolver && (        <ModalShell onClose={() => { setShowMathSolver(false); setMathInput(""); setMathSolution(null); }} title="Math solver" icon={<Calculator size={18} />} wide>
          <textarea value={mathInput} onChange={(e) => setMathInput(e.target.value)} placeholder="Enter a problem. E.g. solve 2x²+5x-3=0, or ∫ x·eˣ dx"
            autoFocus style={{ width: "100%", minHeight: 90, padding: 12, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          <Btn variant="primary" onClick={solveMath} disabled={!mathInput.trim() || solvingMath} style={{ marginTop: 12, width: "100%", justifyContent: "center", padding: "12px" }}>
            {solvingMath ? <><Loader2 size={14} className="spin" /> Solving...</> : <>Solve <ArrowRight size={14} /></>}
          </Btn>
          {mathSolution && !mathSolution.error && (
            <div style={{ marginTop: 18 }}>
              <div style={{ padding: 14, background: C.paperDark, borderRadius: 2, marginBottom: 12 }}>
                <SectionLabel>Problem</SectionLabel>
                <div style={{ marginTop: 4 }}><RichText>{mathSolution.problem}</RichText></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <SectionLabel>Approach</SectionLabel>
                <div style={{ marginTop: 4, fontFamily: fontSerif, fontSize: 14 }}><RichText>{mathSolution.approach}</RichText></div>
              </div>
              <SectionLabel style={{ marginBottom: 8 }}>Steps</SectionLabel>
              {mathSolution.steps?.map((s, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${C.rule}`, paddingLeft: 14, marginBottom: 10 }}>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft }}><RichText>{s.step}</RichText></div>
                  <div style={{ fontFamily: fontSerif, fontSize: 15, marginTop: 2 }}><RichText>{s.result}</RichText></div>
                </div>
              ))}
              <div style={{ background: C.ink, color: C.paper, padding: 16, borderRadius: 2, marginTop: 12 }}>
                <SectionLabel style={{ color: C.gold }}>Answer</SectionLabel>
                <div style={{ fontSize: 17, marginTop: 4 }}><RichText>{mathSolution.answer}</RichText></div>
              </div>
            </div>
          )}
          {mathSolution?.error && <div style={{ marginTop: 14, padding: 12, background: C.accentSoft, color: C.accent, borderRadius: 2, fontSize: 14 }}>{mathSolution.error}</div>}
        </ModalShell>
      )}

      {/* Settings */}
      {showSettings && (
        <ModalShell onClose={() => setShowSettings(false)} title="Settings & profile">
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <SectionLabel style={{ marginBottom: 8 }}>Tutor persona</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}>
              {Object.entries(personas).map(([key, p]) => (
                <button key={key} onClick={() => setTutorPersona(key)} style={{
                  padding: 10, border: `2px solid ${tutorPersona === key ? C.ink : C.rule}`, background: tutorPersona === key ? C.paperDark : C.paperLight,
                  borderRadius: 2, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                </button>
              ))}
            </div>

            <div style={{ paddingTop: 16, borderTop: `1px solid ${C.rule}`, marginBottom: 18 }}>
              <button onClick={() => setSocraticMode(!socraticMode)} style={{
                width: "100%", padding: 12, border: `2px solid ${socraticMode ? C.ink : C.rule}`, background: socraticMode ? C.paperDark : C.paperLight,
                borderRadius: 2, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <HelpCircle size={16} color={socraticMode ? C.ink : C.inkMuted} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    Socratic mode {socraticMode && <Pill color="ink">on</Pill>}
                  </div>
                  <div style={{ fontFamily: fontSans, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>Guide with questions instead of giving answers.</div>
                </div>
              </button>
            </div>

            <SectionLabel style={{ marginBottom: 8 }}>Explanation style</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {[{ v: "balanced", l: "Balanced" }, { v: "visual", l: "Visual" }, { v: "analogy", l: "Analogy-heavy" }, { v: "formal", l: "Formal" }].map((s) => (
                <button key={s.v} onClick={() => setPersistentProfile((p) => ({ ...p, preferredStyle: s.v }))} style={{
                  padding: "6px 12px", background: persistentProfile.preferredStyle === s.v ? C.ink : C.paperDark, color: persistentProfile.preferredStyle === s.v ? C.paper : C.ink,
                  border: "none", borderRadius: 2, fontFamily: fontSans, fontSize: 12, cursor: "pointer",
                }}>{s.l}</button>
              ))}
            </div>

            <SectionLabel style={{ marginBottom: 8 }}>What should we call you?</SectionLabel>
            <input type="text" value={persistentProfile.displayName || ""} onChange={(e) => setPersistentProfile((p) => ({ ...p, displayName: e.target.value }))} placeholder={user && user.email ? user.email.split("@")[0] : "Your name"}
              style={{ width: "100%", padding: "8px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 18 }} />

            <SectionLabel style={{ marginBottom: 8 }}>Your level <span style={{ color: C.inkMuted, fontWeight: 400 }}>(used to calibrate curricula &amp; explanations)</span></SectionLabel>
            <input type="text" value={persistentProfile.ageOrGrade || ""} onChange={(e) => setPersistentProfile((p) => ({ ...p, ageOrGrade: e.target.value }))} placeholder="e.g. 10th grade · undergrad junior · 35yo, no formal math background"
              style={{ width: "100%", padding: "8px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 18 }} />

            <SectionLabel style={{ marginBottom: 8 }}>What are you studying for?</SectionLabel>
            <input type="text" value={persistentProfile.goal} onChange={(e) => setPersistentProfile((p) => ({ ...p, goal: e.target.value }))} placeholder="e.g. AP Chemistry, MCAT"
              style={{ width: "100%", padding: "8px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 18 }} />

            <SectionLabel style={{ marginBottom: 8 }}>Language</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {["English", "Spanish", "French", "German", "Mandarin", "Japanese", "Arabic", "Portuguese", "Hindi", "Russian"].map((l) => (
                <button key={l} onClick={() => setLanguage(l)} style={{
                  padding: "6px 12px", background: language === l ? C.ink : C.paperDark, color: language === l ? C.paper : C.ink,
                  border: "none", borderRadius: 2, fontFamily: fontSans, fontSize: 12, cursor: "pointer",
                }}>{l}</button>
              ))}
            </div>

            <SectionLabel style={{ marginBottom: 8 }}>Session stats</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <Stat label="Questions" value={sessionStats.questionsAnswered} />
              <Stat label="Accuracy" value={sessionStats.questionsAnswered > 0 ? Math.round(100 * sessionStats.questionsCorrect / sessionStats.questionsAnswered) + "%" : "—"} />
              <Stat label="Cards mastered" value={`${sessionStats.cardsMastered}/${sessionStats.cardsReviewed}`} />
              <Stat label="Minutes" value={`${sessionStats.minutesStudied}/${dailyGoalMinutes}`} />
            </div>
            {pomodoroCount > 0 && (
              <div style={{ padding: "8px 12px", background: C.goldSoft, borderRadius: 2, fontSize: 12, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}>
                <Flame size={13} /> {pomodoroCount} pomodoro{pomodoroCount > 1 ? "s" : ""} completed
              </div>
            )}

            {persistentProfile.sessionsCount > 0 && (
              <button onClick={() => {
                if (confirm("Clear all memory? Resets weak spots, recent topics, and exam plan.")) {
                  setPersistentProfile({ goal: "", examDate: "", examPlan: null, weakSpots: [], preferredStyle: "balanced", recentTopics: [], masteredConcepts: [], totalMinutes: 0, sessionsCount: 0, lastSessionAt: 0, persona: "default", cardStates: {}, freezeTokens: 1, displayName: "", ageOrGrade: "" });
                  setShowWelcomeBack(false); setWelcomeInsights(null); setExamPlan(null);
                }
              }} style={{ marginTop: 16, background: "transparent", border: "none", fontSize: 11, color: C.inkMuted, cursor: "pointer", padding: 0 }}>
                reset all memory
              </button>
            )}

            {/* ============ AI QUALITY STUDIO ============ */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: `2px solid ${C.ink}` }}>
              <SectionLabel>AI Provider</SectionLabel>
              <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", margin: "4px 0 12px" }}>
                Choose where the AI work happens. Cloud AI (paid) is world-class. Local WebGPU AI is free and offline, but dramatically less capable.
              </p>

              {/* Provider switcher */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <button onClick={() => setAiProvider("anthropic")}
                  style={{ padding: 14, background: aiProvider === "anthropic" ? C.ink : C.paperLight, color: aiProvider === "anthropic" ? C.paper : C.ink, border: `2px solid ${aiProvider === "anthropic" ? C.ink : C.rule}`, borderRadius: 3, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 4 }}>CLOUD · PAID</div>
                  <div style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Cloud AI</div>
                  <div style={{ fontFamily: fontSerif, fontSize: 12, opacity: 0.85 }}>Frontier quality. Thinking, web search, vision, multi-agent. Needs API key.</div>
                </button>
                <button onClick={() => setAiProvider("webllm")} disabled={webgpuSupported === false}
                  style={{ padding: 14, background: aiProvider === "webllm" ? C.moss : C.paperLight, color: aiProvider === "webllm" ? C.paper : C.ink, border: `2px solid ${aiProvider === "webllm" ? C.moss : C.rule}`, borderRadius: 3, cursor: webgpuSupported === false ? "not-allowed" : "pointer", textAlign: "left", opacity: webgpuSupported === false ? 0.5 : 1 }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 4 }}>LOCAL · FREE · WEBGPU</div>
                  <div style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Local AI</div>
                  <div style={{ fontFamily: fontSerif, fontSize: 12, opacity: 0.85 }}>{webgpuSupported === false ? "Not available — your browser doesn't expose WebGPU." : webgpuSupported === null ? "Detecting WebGPU…" : "Runs Llama / Phi / Gemma in your browser. Free, offline. Much weaker than cloud AI."}</div>
                </button>
              </div>

              {aiProvider === "anthropic" ? (
                <div style={{ padding: 14, background: C.paperLight, borderRadius: 3, marginBottom: 18 }}>
                  <SectionLabel style={{ marginBottom: 8 }}>Cloud AI API key (Anthropic)</SectionLabel>
                  <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: "0 0 8px" }}>
                    Stored only on this device's localStorage. Sent directly to <code style={{ fontFamily: fontMono, fontSize: 11 }}>api.anthropic.com</code>.
                  </p>
                  {anthropicApiKey ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.moss }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, letterSpacing: "0.1em" }}>CLAUDE CONNECTED</div>
                        <div style={{ fontFamily: fontMono, fontSize: 12, color: C.ink }}>Key: sk-…{anthropicApiKey.slice(-6)}</div>
                      </div>
                      <button onClick={() => { setAnthropicApiKey(""); setAiKeyStatus("Key removed"); showToast("API key removed"); }} style={{ background: "transparent", border: `1px solid ${C.rule}`, padding: "6px 12px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, borderRadius: 2 }}>Remove key</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="password"
                          value={anthropicApiKeyDraft}
                          onChange={(e) => setAnthropicApiKeyDraft(e.target.value)}
                          placeholder="sk-ant-api03-…"
                          autoComplete="off"
                          style={{ flex: 1, padding: "9px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, outline: "none" }}
                        />
                        <Btn variant="primary" onClick={() => {
                          const k = anthropicApiKeyDraft.trim();
                          if (!k) { setAiKeyStatus("Paste a key first"); return; }
                          if (!k.startsWith("sk-ant-")) { setAiKeyStatus("Keys must start with sk-ant-"); return; }
                          setAnthropicApiKey(k); setAnthropicApiKeyDraft(""); setAiKeyStatus("✓ Key saved — Cloud AI is live");
                          showToast("Cloud AI connected");
                          setTimeout(() => setAiKeyStatus(""), 4000);
                        }}>Save key</Btn>
                      </div>
                      {aiKeyStatus && <div style={{ fontFamily: fontMono, fontSize: 11, marginTop: 6, color: aiKeyStatus.startsWith("✓") ? C.moss : C.accent }}>{aiKeyStatus}</div>}
                      <div style={{ fontFamily: fontMono, fontSize: 11, marginTop: 8, color: C.inkMuted }}>
                        Get one at <span style={{ fontFamily: fontMono }}>console.anthropic.com/settings/keys</span>. Usage billed to your API account (typically a few cents per session on the mid tier, more on the frontier tier).
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 14, background: C.paperLight, borderRadius: 3, marginBottom: 18 }}>
                  <SectionLabel style={{ marginBottom: 8 }}>Local WebGPU model</SectionLabel>
                  <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: "0 0 8px" }}>
                    Model downloads once into your browser's IndexedDB, then runs fully offline. Honest expectations: even the 8B models won't match the cloud AI on curriculum design, lateral reading, or chain-of-verification — but with recent upgrades they CAN do flashcards, simple explanations, MCQs (validated + auto-retried), and short Q&A reliably. The vision-tier model reads printed text and simple diagrams. <strong>PDFs work via client-side text extraction</strong> — Phi-3.5-vision additionally rasterizes scanned PDFs. <strong>Web search works</strong> if you've configured the Edge Function proxy. <strong>Still genuinely disabled on local:</strong> multi-agent verification (capability gap — small models can't usefully critique their own work).
                  </p>

                  {/* Tier-grouped model picker */}
                  {[
                    { tier: "best", label: "Best quality (≥3 GB RAM available)", color: C.gold },
                    { tier: "balanced", label: "Balanced (most modern laptops)", color: C.moss },
                    { tier: "reasoning", label: "Reasoning-focused (math/logic)", color: C.blue },
                    { tier: "vision", label: "Vision-capable (reads images, scanned PDFs)", color: C.plum },
                    { tier: "tiny", label: "Lightweight (older / integrated GPUs)", color: C.inkSoft },
                  ].map(({ tier, label, color }) => {
                    const tierModels = Object.entries(LOCAL_MODELS).filter(([_, m]) => m.tier === tier);
                    if (tierModels.length === 0) return null;
                    return (
                      <div key={tier} style={{ marginBottom: 10 }}>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {tierModels.map(([id, m]) => (
                            <button key={id} onClick={() => setLocalModel(id)} disabled={webllmLoading}
                              style={{ padding: "8px 10px", background: localModel === id ? C.ink : C.paper, color: localModel === id ? C.paper : C.ink, border: `1px solid ${localModel === id ? C.ink : C.rule}`, borderRadius: 2, cursor: webllmLoading ? "wait" : "pointer", textAlign: "left", fontFamily: fontSans, fontSize: 12, opacity: webllmLoading ? 0.5 : 1 }}>
                              <div style={{ fontWeight: 600 }}>{m.label} <span style={{ fontFamily: fontMono, fontSize: 10, opacity: 0.7, fontWeight: 400 }}>· {m.size} · {m.ram}</span></div>
                              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, fontFamily: fontMono, color: localModel === id ? C.paper : color }}>Best for: {m.bestFor}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Loading status */}
                  {webllmStatus && (
                    <div style={{ padding: 10, background: C.paperDark, borderRadius: 2, marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontMono, fontSize: 11, color: webllmStatus.startsWith("✓") ? C.moss : webllmStatus.startsWith("Failed") ? C.accent : C.inkSoft }}>
                        {webllmLoading && !webllmStatus.startsWith("✓") && !webllmStatus.startsWith("Failed") && <Loader2 size={12} className="spin" />}
                        <span style={{ flex: 1 }}>{webllmStatus}</span>
                      </div>
                      {webllmLoading && webllmProgress > 0 && webllmProgress < 1 && (
                        <div style={{ height: 3, background: C.rule, borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: C.moss, width: `${(webllmProgress * 100).toFixed(0)}%`, transition: "width 0.3s" }} />
                        </div>
                      )}
                      {/* Cancel button — only shown while loading. Lets user escape a stuck/hung load. */}
                      {webllmLoading && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
                          <button onClick={() => cancelWebllmLoad({ clearCache: false })} style={{
                            padding: "6px 12px", background: "transparent", color: C.inkSoft, border: `1px solid ${C.rule}`, borderRadius: 2,
                            fontFamily: fontSans, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                          }}>
                            <X size={11} /> Cancel loading
                          </button>
                          <button onClick={() => {
                            if (confirm("This cancels the load AND deletes any partially-downloaded shards from your browser cache. The next attempt starts fresh. Continue?")) {
                              cancelWebllmLoad({ clearCache: true });
                            }
                          }} style={{
                            padding: "6px 12px", background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 2,
                            fontFamily: fontSans, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                          }}>
                            <Trash2 size={11} /> Cancel + clear cache
                          </button>
                          <span style={{ fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", marginLeft: isMobile ? 0 : 4 }}>
                            Stuck? Cancel to unblock — clear cache if a previous load corrupted the shards.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Safari WebGPU warning — Safari's WebGPU has weaker memory management than Chrome.
                      Large models often crash the tab. Honest heads-up before the user commits to a download. */}
                  {isSafariBrowser && webgpuSupported && !webllmLoadedModel && !webllmLoading && (
                    <div style={{ marginTop: 8, padding: "10px 12px", background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 2 }}>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.gold, letterSpacing: "0.08em", marginBottom: 4 }}>SAFARI HEADS-UP</div>
                      <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
                        Safari's WebGPU implementation is newer and uses memory less efficiently than Chrome's. Large models can crash the tab with "a problem occurred repeatedly" errors. If that happens, either:
                        <span style={{ display: "block", marginTop: 4 }}>• <strong>Pick the smallest model</strong> (Llama 3.2 1B is the lightest)</span>
                        <span style={{ display: "block" }}>• <strong>Use Chrome / Arc / Edge</strong> instead — their WebGPU is more battle-tested</span>
                        <span style={{ display: "block" }}>• <strong>Stick with Cloud AI</strong> (Claude API) — it's faster and higher quality anyway</span>
                      </div>
                    </div>
                  )}

                  {/* Ready indicator + live inference stats */}
                  {webllmLoadedModel && webllmLoadedModel === localModel && !webllmLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 12px", background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.moss }} />
                      <div style={{ fontFamily: fontMono, fontSize: 11, color: C.moss, flex: 1 }}>LOCAL AI READY · {LOCAL_MODELS[webllmLoadedModel]?.label || webllmLoadedModel}</div>
                      {webllmStats.tokensPerSec > 0 && (
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, opacity: 0.8 }}>
                          {webllmStats.running && <Loader2 size={9} className="spin" style={{ verticalAlign: "middle", marginRight: 4 }} />}
                          {webllmStats.tokensPerSec} tok/s{webllmStats.firstTokenMs > 0 && ` · ${webllmStats.firstTokenMs}ms first`}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Download / benchmark / cache buttons */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {!webllmLoadedModel && !webllmLoading && webgpuSupported && (() => {
                      // Safari safety gate: if on Safari AND the selected model is >2 GB, gate the
                      // download behind an explicit confirmation. Safari's WebGPU has tight memory
                      // limits — large models crash the tab. Same flow on Chrome → unrestricted.
                      const selectedSize = LOCAL_MODELS[localModel]?.size || "";
                      const sizeMatch = selectedSize.match(/([\d.]+)\s*GB/i);
                      const sizeGB = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
                      const isRiskyOnSafari = isSafariBrowser && sizeGB > 2;
                      if (isRiskyOnSafari) {
                        return (
                          <div style={{ padding: 12, background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 2, width: "100%" }}>
                            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.accent, letterSpacing: "0.08em", marginBottom: 6 }}>⚠ TOO LARGE FOR SAFARI</div>
                            <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>
                              <strong>{LOCAL_MODELS[localModel]?.label}</strong> is {selectedSize} — Safari will crash trying to load it ("a problem occurred repeatedly"). On Chrome / Arc / Edge, this works fine.
                            </div>
                            <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>
                              <strong>Safer options:</strong>
                              <span style={{ display: "block", marginTop: 4 }}>• Switch to <strong>Llama 3.2 1B</strong> (~700 MB) or <strong>SmolLM2 1.7B</strong> (~1 GB) — both fit Safari's memory</span>
                              <span style={{ display: "block" }}>• Open this site in Chrome / Arc to use bigger models</span>
                              <span style={{ display: "block" }}>• Use Cloud AI (Anthropic API key) — faster and higher quality anyway</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
                              <Btn variant="primary" onClick={() => setLocalModel("Llama-3.2-1B-Instruct-q4f16_1-MLC")}>
                                Switch to Llama 3.2 1B
                              </Btn>
                              <button onClick={() => {
                                if (confirm(`This will probably crash Safari and you'll see "a problem occurred repeatedly". You'll need to close the tab and start over. Are you sure you want to try downloading ${LOCAL_MODELS[localModel]?.label} (${selectedSize}) on Safari anyway?`)) {
                                  initWebllm().catch(() => {});
                                }
                              }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: isMobile ? "8px 0" : 0 }}>
                                Try anyway (likely to crash)
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <Btn variant="primary" onClick={() => initWebllm().catch(() => {})}>
                          <Download size={12} /> Download &amp; load {LOCAL_MODELS[localModel]?.label || "model"}
                        </Btn>
                      );
                    })()}
                    {webllmLoadedModel === localModel && !webllmLoading && (
                      <>
                        <Btn variant="ghost" onClick={runBenchmark} disabled={benchmarkRunning}>
                          {benchmarkRunning ? <><Loader2 size={11} className="spin" /> Benchmarking</> : <><Zap size={11} /> Run benchmark</>}
                        </Btn>
                        <Btn variant="ghost" onClick={() => { resetWebllmHistory(); showToast("Tutor history cleared"); }}>
                          <RotateCw size={11} /> Reset tutor history
                        </Btn>
                        <Btn variant="ghost" onClick={refreshCachedModels}>
                          <FileIcon size={11} /> Show cache
                        </Btn>
                      </>
                    )}
                  </div>

                  {/* Benchmark result */}
                  {benchmarkResult && (
                    <div style={{ padding: 10, background: C.paperDark, border: `1px solid ${benchmarkResult.error ? C.accent : C.gold}`, borderRadius: 2, marginTop: 8, fontFamily: fontMono, fontSize: 11, color: C.inkSoft, lineHeight: 1.6 }}>
                      {benchmarkResult.error ? (
                        <div style={{ color: C.accent }}>Benchmark failed: {benchmarkResult.error}</div>
                      ) : (
                        <div>
                          <div style={{ color: C.gold, marginBottom: 4 }}>Benchmark · {benchmarkResult.modelLabel}</div>
                          <div>First token latency: <span style={{ color: C.ink }} className="tnum">{benchmarkResult.firstTokenMs}ms</span></div>
                          <div>Generation speed: <span style={{ color: C.ink }} className="tnum">{benchmarkResult.tokensPerSec} tokens/sec</span></div>
                          <div>Total: {benchmarkResult.totalTokens} tokens in {benchmarkResult.totalMs}ms</div>
                          <div style={{ marginTop: 6, fontStyle: "italic", color: C.inkMuted, fontFamily: fontSerif, fontSize: 12 }}>
                            {benchmarkResult.tokensPerSec >= 25 ? "Fast — comfortable for any mode." :
                             benchmarkResult.tokensPerSec >= 10 ? "Usable — long generations may feel slow." :
                             benchmarkResult.tokensPerSec >= 4 ? "Slow — fine for flashcards, painful for long explainers." :
                             "Very slow — consider a smaller model."}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cache list */}
                  {cachedModels.length > 0 && (
                    <div style={{ padding: 10, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, marginTop: 8 }}>
                      <SectionLabel style={{ marginBottom: 6 }}>Cached locally</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {cachedModels.map(({ modelId }) => (
                          <div key={modelId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: C.paperLight, borderRadius: 2 }}>
                            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.ink }}>{LOCAL_MODELS[modelId]?.label || modelId} <span style={{ color: C.inkMuted }}>· {LOCAL_MODELS[modelId]?.size}</span></span>
                            <button onClick={() => deleteCachedModel(modelId)} style={{ background: "transparent", border: "none", fontFamily: fontMono, fontSize: 10, color: C.accent, cursor: "pointer", padding: 0 }}>Delete</button>
                          </div>
                        ))}
                        {cachedModels[0]?.totalCacheBytes && (
                          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${C.rule}` }}>
                            Total browser storage used: {(cachedModels[0].totalCacheBytes / (1024 ** 3)).toFixed(2)} GB
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <SectionLabel>AI Quality Studio</SectionLabel>

              <div style={{ marginTop: 4, marginBottom: 18, padding: 14, background: C.paperLight, borderRadius: 3 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Output language</SectionLabel>
                <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: "0 0 8px" }}>
                  All AI-generated content (flashcards, explanations, briefings, slide decks, mind maps, etc.) will be produced in this language. The interface stays in English.
                </p>
                <select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, outline: "none" }}>
                  {["English", "Spanish", "French", "German", "Italian", "Portuguese", "Mandarin Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Russian", "Dutch", "Polish", "Turkish", "Vietnamese", "Indonesian", "Thai", "Hebrew", "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Czech", "Ukrainian"].map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Per-fact source attribution toggle — requested by users for source-critical learning */}
              <div style={{ marginTop: 4, marginBottom: 18, padding: 14, background: C.paperLight, borderRadius: 3 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={persistentProfile.perFactCitations} onChange={(e) => setPersistentProfile((p) => ({ ...p, perFactCitations: e.target.checked }))}
                    style={{ marginTop: 3, cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <SectionLabel style={{ marginBottom: 4 }}>Per-fact source attribution</SectionLabel>
                    <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: "0 0 6px", lineHeight: 1.5 }}>
                      AI emits a <code style={{ fontFamily: fontMono, fontSize: 11, background: C.paper, padding: "1px 5px", borderRadius: 2 }}>→ Source: [S1]</code> line beneath every factual claim. Best for fact-checking, research notes, and source-critical learning. Makes flowing prose denser — turn off for narrative explainers if it gets in the way.
                    </p>
                    <p style={{ fontFamily: fontSerif, fontSize: 11, color: C.inkMuted, fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
                      Citation types: <code style={{ fontFamily: fontMono, fontSize: 10 }}>[Sn]</code> = notebook source, <code style={{ fontFamily: fontMono, fontSize: 10 }}>[Wn]</code> = web search result, <em>general knowledge</em> = the model's training (no specific source).
                    </p>
                  </div>
                </label>
              </div>
              <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", margin: "4px 0 14px" }}>
                Trade speed for rigor. Pick a preset or dial each knob yourself.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {Object.entries(AI_PRESETS).map(([k, p]) => {
                  const isActive = aiSettings.model === p.model && aiSettings.thinkingBudget === p.thinkingBudget && aiSettings.searchUses === p.searchUses && aiSettings.multiAgent === p.multiAgent && aiSettings.verification === p.verification;
                  const accentMap = { speed: C.gold, balanced: C.blue, quality: C.moss, max: C.accent };
                  const accent = accentMap[k] || C.ink;
                  return (
                    <button key={k} onClick={() => setAiSettings({ ...p })}
                      style={{ padding: 14, background: isActive ? accent : C.paperLight, border: `2px solid ${isActive ? accent : C.rule}`, borderRadius: 3, cursor: "pointer", textAlign: "left", color: isActive ? C.paper : C.ink, fontFamily: fontSans }}>
                      <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: "0.1em", marginBottom: 4, opacity: 0.7 }}>{k.toUpperCase()}</div>
                      <div style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontFamily: fontSerif, fontSize: 12, opacity: 0.85 }}>{p.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ background: C.paperLight, padding: 16, borderRadius: 3, marginBottom: 8 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", marginBottom: 10 }}>FINE TUNE</div>
                {/* Model */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Model</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {Object.entries(AI_MODELS).map(([id, m]) => (
                      <button key={id} onClick={() => setAiSettings((s) => ({ ...s, model: id }))}
                        style={{ padding: "8px 10px", background: aiSettings.model === id ? C.ink : C.paper, color: aiSettings.model === id ? C.paper : C.ink, border: `1px solid ${aiSettings.model === id ? C.ink : C.rule}`, borderRadius: 2, cursor: "pointer", textAlign: "left", fontFamily: fontSans, fontSize: 12 }}>
                        <strong>{m.label}</strong> <span style={{ opacity: 0.7, fontSize: 11 }}>· {m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Thinking budget */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span>Thinking budget</span>
                    <span style={{ fontFamily: fontMono, color: C.inkSoft, fontWeight: 400 }}>{aiSettings.thinkingBudget === 0 ? "off" : `${(aiSettings.thinkingBudget / 1000).toFixed(0)}k tokens`}</span>
                  </div>
                  <input type="range" min="0" max="32000" step="1000" value={aiSettings.thinkingBudget} onChange={(e) => setAiSettings((s) => ({ ...s, thinkingBudget: parseInt(e.target.value, 10) }))}
                    style={{ width: "100%" }} />
                </div>
                {/* Search uses */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span>Web searches per task</span>
                    <span style={{ fontFamily: fontMono, color: C.inkSoft, fontWeight: 400 }}>{aiSettings.searchUses === 0 ? "off" : `${aiSettings.searchUses}`}</span>
                  </div>
                  <input type="range" min="0" max="16" step="1" value={aiSettings.searchUses} onChange={(e) => setAiSettings((s) => ({ ...s, searchUses: parseInt(e.target.value, 10) }))}
                    style={{ width: "100%" }} />
                </div>
                {/* Toggles */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: fontSans, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!aiSettings.multiAgent} onChange={(e) => setAiSettings((s) => ({ ...s, multiAgent: e.target.checked }))} />
                    Multi-agent (Draft → Critique → Refine)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: fontSans, fontSize: 12, cursor: aiSettings.multiAgent ? "pointer" : "not-allowed", opacity: aiSettings.multiAgent ? 1 : 0.5 }}>
                    <input type="checkbox" disabled={!aiSettings.multiAgent} checked={!!aiSettings.verification} onChange={(e) => setAiSettings((s) => ({ ...s, verification: e.target.checked }))} />
                    + Chain-of-verification (4th stage)
                  </label>
                </div>
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, padding: "6px 0" }}>
                Model: {AI_MODELS[aiSettings.model]?.label || aiSettings.model} · {aiSettings.thinkingBudget > 0 ? `${(aiSettings.thinkingBudget/1000).toFixed(0)}k thinking` : "no thinking"} · {aiSettings.searchUses > 0 ? `${aiSettings.searchUses} searches` : "no web"} · {aiSettings.multiAgent ? (aiSettings.verification ? "4-stage pipeline" : "3-stage pipeline") : "single-pass"}
              </div>
            </div>

            {/* ============ ACCOUNT & CLASSES ============ */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: `2px solid ${C.ink}` }}>
              <SectionLabel>Account &amp; classes</SectionLabel>
              {!SUPABASE_URL ? (
                <div style={{ marginTop: 8, padding: 14, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                  Cloud sync isn't configured yet. Classes are saved on this device only. <br />
                  To enable real accounts and cross-device sync, see <strong>SETUP.md</strong> (a 5-minute Supabase setup).
                </div>
              ) : (
                <div style={{ marginTop: 8, marginBottom: 14, padding: 14, background: user ? C.mossSoft : C.paperLight, border: `1px solid ${user ? C.moss : C.rule}`, borderRadius: 3 }}>
                  {user ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: C.moss, letterSpacing: "0.1em", marginBottom: 4 }}>SIGNED IN</div>
                        <div style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, fontWeight: 600 }}>{user.email}</div>
                        <div style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, marginTop: 2 }}>Sync: {syncStatus === "synced" ? "✓ up to date" : syncStatus === "syncing" ? "saving…" : syncStatus === "error" ? "✗ error" : "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Btn variant="ghost" onClick={() => { setChangePasswordDraft({ next: "", confirm: "", error: "", loading: false }); setShowChangePassword(true); }}>Change password</Btn>
                        <Btn variant="ghost" onClick={signOut}>Sign out</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft }}>{supabaseReady ? "Not signed in — your data lives on this device only." : "Loading cloud sync…"}</div>
                      <Btn variant="primary" onClick={() => setShowAuthModal(true)} disabled={!supabaseReady}>Sign in / Create account</Btn>
                    </div>
                  )}
                </div>
              )}

              {/* My Classes */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>My classes <span style={{ color: C.inkMuted, fontWeight: 400 }}>({myClasses.length})</span></span>
                </div>
                {myClasses.length === 0 && !editingClassId && (
                  <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic", marginBottom: 10 }}>No classes yet — add the courses you're taking and they'll sync across devices.</div>
                )}
                {myClasses.length > 0 && (
                  <div className="mat-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {myClasses.map((c) => {
                      const palette = { blue: { bg: C.blueSoft, fg: C.blue }, moss: { bg: C.mossSoft, fg: C.moss }, gold: { bg: C.goldSoft, fg: C.gold }, plum: { bg: "#F2E8F0", fg: "#6B2D5C" }, accent: { bg: C.accentSoft, fg: C.accent } }[c.color] || { bg: C.paperLight, fg: C.ink };
                      const isBeingEdited = editingClassId === c.id;
                      return (
                        <div key={c.id} style={{ padding: 12, background: palette.bg, border: `${isBeingEdited ? 2 : 1}px solid ${palette.fg}`, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <button onClick={() => editClass(c)} title="Click to edit"
                            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", minWidth: 0, flex: 1, textAlign: "left" }}>
                            <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600, color: palette.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            {c.term && <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2 }}>{c.term}{isBeingEdited ? " · editing" : ""}</div>}
                          </button>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button onClick={() => editClass(c)} title="Edit class" aria-label="Edit class" style={{ background: "transparent", border: `1px solid ${palette.fg}`, color: palette.fg, cursor: "pointer", padding: "4px 8px", borderRadius: 2, fontFamily: fontSans, fontSize: 10, fontWeight: 600 }}>EDIT</button>
                            <button onClick={() => deleteClass(c.id)} title="Delete class" aria-label="Delete class" style={{ background: "transparent", border: `1px solid ${palette.fg}`, color: palette.fg, cursor: "pointer", padding: "4px 6px", borderRadius: 2 }}><X size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Add / edit form */}
                <div style={{ padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3 }}>
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", marginBottom: 8 }}>{editingClassId ? "EDIT CLASS" : "ADD A CLASS"}</div>
                  <input type="text" value={classDraft.name} onChange={(e) => setClassDraft({ ...classDraft, name: e.target.value })} placeholder="Class name (e.g. Organic Chemistry II)"
                    onKeyDown={(e) => { if (e.key === "Enter") saveClass(); }}
                    style={{ width: "100%", padding: "8px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="text" value={classDraft.term} onChange={(e) => setClassDraft({ ...classDraft, term: e.target.value })} placeholder="Term (e.g. Fall '26)"
                      style={{ flex: 1, minWidth: 110, padding: "7px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                    <select value={classDraft.color} onChange={(e) => setClassDraft({ ...classDraft, color: e.target.value })}
                      style={{ padding: "7px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 12, outline: "none" }}>
                      <option value="blue">Blue</option><option value="moss">Moss</option><option value="gold">Gold</option><option value="plum">Plum</option><option value="accent">Accent</option>
                    </select>
                    <Btn variant="primary" onClick={saveClass}>{editingClassId ? "Save" : "Add class"}</Btn>
                    {editingClassId && <button onClick={() => { setEditingClassId(null); setClassDraft({ name: "", term: "", color: "blue" }); }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 12, cursor: "pointer" }}>Cancel</button>}
                  </div>
                </div>
              </div>
            </div>

            {/* ============ SHARING: collect feedback when shared without a server ============ */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: `2px solid ${C.ink}` }}>
              <SectionLabel>Sharing</SectionLabel>
              <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginTop: 4, marginBottom: 12, lineHeight: 1.6 }}>
                Share the App.jsx file with anyone — no server needed. When they hit feedback or errors, they get a "Send to owner" button that opens their email with a structured report addressed to you.
              </p>
              <div style={{ padding: 14, background: ownerEmail ? C.mossSoft : C.paperLight, border: `1px solid ${ownerEmail ? C.moss : C.rule}`, borderRadius: 3, marginBottom: 10 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: ownerEmail ? C.moss : C.inkMuted, letterSpacing: "0.1em", marginBottom: 6 }}>OWNER EMAIL</div>
                {ownerEmail ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: fontSerif, fontSize: 15, color: C.ink, fontWeight: 600 }}>{ownerEmail} {SHARE_OWNER_EMAIL ? <Pill color="moss">baked into file</Pill> : <Pill color="gold">this device only</Pill>}</div>
                    {!SHARE_OWNER_EMAIL && <button onClick={() => { setOwnerEmail(""); try { localStorage.removeItem("lectern_owner_email"); } catch {} showToast("Owner email cleared"); }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Clear</button>}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="email" value={ownerEmailDraft} onChange={(e) => setOwnerEmailDraft(e.target.value)} placeholder="you@example.com"
                      style={{ flex: 1, minWidth: 220, padding: "8px 10px", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, outline: "none" }} />
                    <Btn variant="primary" onClick={() => { const e = ownerEmailDraft.trim(); if (!/.+@.+\..+/.test(e)) { showToast("Enter a valid email"); return; } setOwnerEmail(e); setOwnerEmailDraft(""); showToast("Owner email set on this device"); }}>Set</Btn>
                  </div>
                )}
              </div>
              <div style={{ background: C.paperDark, padding: 12, borderRadius: 3, fontFamily: fontMono, fontSize: 11, color: C.inkSoft, lineHeight: 1.6 }}>
                <div style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 6, letterSpacing: "0.05em" }}>To bake your email into the file before sharing:</div>
                Open <code style={{ color: C.accent }}>App.jsx</code> and change line ~6:
                <pre style={{ background: C.paper, padding: 8, borderRadius: 2, marginTop: 6, marginBottom: 0, fontSize: 11, overflowX: "auto" }}>{`const SHARE_OWNER_EMAIL = "${ownerEmail || "you@example.com"}";`}</pre>
                <span style={{ fontFamily: fontSerif, fontStyle: "italic", color: C.inkMuted }}>Then send the file. Everyone who opens it will route reports back to you.</span>
              </div>
            </div>

            {/* ============ DIAGNOSTICS: usage / feedback / errors ============ */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: `2px solid ${C.ink}` }}>
              <SectionLabel>Diagnostics</SectionLabel>
              <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic", marginTop: 4, marginBottom: 18 }}>All data stays on this device. Export below to share with us.</p>

              {/* Usage */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Most-used features</span>
                  <span style={{ color: C.inkMuted, fontFamily: fontMono, fontSize: 11 }}>{analytics.events.length} events</span>
                </div>
                {(() => {
                  const m = Object.entries(analytics.totals.mode || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  const v = Object.entries(analytics.totals.view || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  if (m.length === 0 && v.length === 0) return <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>Use the app a bit and your patterns will appear here.</div>;
                  const maxM = m.length ? m[0][1] : 1; const maxV = v.length ? v[0][1] : 1;
                  return (
                    <div className="mat-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 4 }}>STUDY MODES</div>
                        {m.length === 0 ? <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkMuted, fontStyle: "italic" }}>None yet.</div> : m.map(([name, n]) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSerif, fontSize: 13, padding: "3px 0" }}>
                            <span style={{ flex: 1, color: C.ink }}>{name}</span>
                            <div style={{ width: 80, height: 6, background: C.paperDark, borderRadius: 1, overflow: "hidden" }}>
                              <div style={{ width: `${(n / maxM) * 100}%`, height: "100%", background: C.accent }} />
                            </div>
                            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, width: 24, textAlign: "right" }}>{n}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 4 }}>TAB VISITS</div>
                        {v.map(([name, n]) => (
                          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSerif, fontSize: 13, padding: "3px 0" }}>
                            <span style={{ flex: 1, color: C.ink, textTransform: "capitalize" }}>{name}</span>
                            <div style={{ width: 80, height: 6, background: C.paperDark, borderRadius: 1, overflow: "hidden" }}>
                              <div style={{ width: `${(n / maxV) * 100}%`, height: "100%", background: C.moss }} />
                            </div>
                            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, width: 24, textAlign: "right" }}>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Feedback log */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Your feedback</span>
                  <button onClick={() => { setShowSettings(false); setTimeout(() => setShowFeedback(true), 80); }} style={{ background: "transparent", border: "none", color: C.accent, fontFamily: fontSans, fontSize: 11, cursor: "pointer" }}>+ Send new</button>
                </div>
                {feedbackLog.length === 0 ? <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic" }}>None yet — tap the speech bubble bottom-right to send one.</div> : (
                  <div style={{ maxHeight: 180, overflowY: "auto" }}>
                    {feedbackLog.slice(0, 8).map((f) => (
                      <div key={f.id} style={{ padding: "8px 10px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <Pill color={f.rating === 1 ? "moss" : f.rating === -1 ? "accent" : "gold"}>{f.category}</Pill>
                          <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>{new Date(f.ts).toLocaleString()}</span>
                        </div>
                        {f.text && <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{f.text}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error log */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Error log</span>
                  {errorLog.length > 0 && <button onClick={() => { if (confirm("Clear all logged errors?")) { setErrorLog([]); showToast("Error log cleared"); } }} style={{ background: "transparent", border: "none", color: C.inkMuted, fontFamily: fontSans, fontSize: 11, cursor: "pointer" }}>Clear</button>}
                </div>
                {errorLog.length === 0 ? <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.moss, fontStyle: "italic" }}>No errors logged. ✓</div> : (
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {errorLog.slice(0, 10).map((e) => (
                      <div key={e.id} style={{ padding: "8px 10px", background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 2, marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.accent }}>{new Date(e.ts).toLocaleString()}{e.context ? ` · ${e.context}` : ""}</div>
                          {ownerEmail && (
                            <button onClick={() => sendErrorByEmail(e)} style={{ background: "transparent", border: `1px solid ${C.accent}`, color: C.accent, fontFamily: fontSans, fontSize: 10, padding: "2px 8px", borderRadius: 2, cursor: "pointer" }}>Report to owner ↗</button>
                          )}
                        </div>
                        <div style={{ fontFamily: fontMono, fontSize: 12, color: C.ink, wordBreak: "break-word" }}>{e.msg}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="ghost" onClick={exportData}>Export all data as JSON</Btn>
                <Btn variant="ghost" onClick={() => { if (confirm("Wipe all usage analytics?")) { setAnalytics({ events: [], totals: { mode: {}, view: {}, action: {} } }); showToast("Analytics reset"); } }}>Reset analytics</Btn>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ============ HELP MODAL — explains every feature ============ */}
      {/* ============ REVIEW QUEUE MODAL ============ */}
      {showReviewQueue && (() => {
        const totalInSession = reviewSessionCards.length;
        const isDone = reviewCardIdx >= totalInSession;
        const card = !isDone ? reviewSessionCards[reviewCardIdx] : null;
        return (
          <ModalShell onClose={() => setShowReviewQueue(false)} title={isDone ? "Review complete" : `Review · ${reviewCardIdx + 1}/${totalInSession}`} icon={<Repeat size={18} />} wide>
            {isDone ? (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 16, lineHeight: 1.6, color: C.ink, marginBottom: 14 }}>
                  Session done. {reviewSessionStats.correct} of {reviewSessionStats.total} card{reviewSessionStats.total === 1 ? "" : "s"} rated 'good' or better — next reviews scheduled based on your ratings.
                </p>
                <div style={{ padding: 14, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, marginBottom: 14 }}>
                  <SectionLabel style={{ marginBottom: 6 }}>This session</SectionLabel>
                  <div style={{ fontFamily: fontMono, fontSize: 12, color: C.inkSoft, lineHeight: 1.7 }}>
                    <div>Reviewed: <span className="tnum" style={{ color: C.ink }}>{reviewSessionStats.total}</span></div>
                    <div>Rated ≥ good: <span className="tnum" style={{ color: C.moss }}>{reviewSessionStats.correct}</span></div>
                    <div>Rated &lt; good: <span className="tnum" style={{ color: C.accent }}>{reviewSessionStats.total - reviewSessionStats.correct}</span></div>
                    <div>Time: <span className="tnum">{Math.max(1, Math.round((Date.now() - reviewSessionStats.started) / 60000))}</span> min</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {dueCardsList.length > totalInSession && (
                    <Btn variant="primary" onClick={() => { startReviewSession(); }}>Review more ({dueCardsList.length - totalInSession} still due)</Btn>
                  )}
                  <Btn variant="ghost" onClick={() => setShowReviewQueue(false)}>Done</Btn>
                </div>
              </div>
            ) : (
              <div>
                {/* Progress bar */}
                <div style={{ height: 4, background: C.paperDark, borderRadius: 99, overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ height: "100%", width: `${(reviewCardIdx / totalInSession) * 100}%`, background: C.gold, transition: "width 0.3s" }} />
                </div>
                {/* Card */}
                <div style={{ minHeight: 240, padding: 28, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, marginBottom: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  {card?.topic && (
                    <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                      {card.topic}{card.reps > 0 && ` · seen ${card.reps}× · last interval ${card.interval}d`}
                    </div>
                  )}
                  <div style={{ fontFamily: fontSerif, fontSize: 20, lineHeight: 1.5, color: C.ink, marginBottom: reviewFlipped ? 16 : 0 }}>
                    {card?.front || ""}
                  </div>
                  {reviewFlipped && (
                    <>
                      <hr className="hairline" style={{ margin: "8px 0 16px" }} />
                      <div style={{ fontFamily: fontSerif, fontSize: 17, lineHeight: 1.6, color: C.inkSoft }}>
                        {card?.back || <em style={{ color: C.inkMuted }}>No answer stored for this card.</em>}
                      </div>
                    </>
                  )}
                </div>
                {!reviewFlipped ? (
                  <Btn variant="primary" onClick={() => setReviewFlipped(true)}>Show answer</Btn>
                ) : (
                  <div>
                    <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>How well did you remember?</div>
                    <div className="review-rating-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                      {[
                        { q: 0, label: "Again", sub: "1d", color: C.accent },
                        { q: 1, label: "Hard", sub: "1d", color: C.accent },
                        { q: 2, label: "Hard-ish", sub: "1d", color: C.gold },
                        { q: 3, label: "Good", sub: "↑", color: C.moss },
                        { q: 4, label: "Easy", sub: "↑↑", color: C.moss },
                        { q: 5, label: "Trivial", sub: "↑↑↑", color: C.moss },
                      ].map((b) => (
                        <button key={b.q} onClick={() => reviewRate(b.q)} style={{
                          padding: "10px 6px", background: C.paperLight, border: `1px solid ${b.color}`, borderRadius: 3,
                          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          fontFamily: fontSans, transition: "background 0.15s",
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.background = b.color + "33"}
                          onMouseLeave={(e) => e.currentTarget.style.background = C.paperLight}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: b.color }}>{b.label}</span>
                          <span style={{ fontSize: 9, color: C.inkMuted, fontFamily: fontMono }}>{b.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalShell>
        );
      })()}

      {/* ============ SHARE NOTEBOOK MODAL ============ */}
      {shareNotebookId && (() => {
        const nb = liveNotebooks.find((n) => n.id === shareNotebookId);
        if (!nb) return null;
        const grant = shareGrants[shareNotebookId] || { shared_with_emails: [], is_public: false };
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareNotebookId}`;
        return (
          <ModalShell onClose={() => { setShareNotebookId(null); setShareGrantEmail(""); }} title={`Share · ${nb.name}`} icon={<Share2 size={18} />}>
            {!user ? (
              <div style={{ padding: 14, background: C.accentSoft, border: `1px solid ${C.accent}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.55 }}>
                You need to be signed in to share notebooks. <button onClick={() => { setShareNotebookId(null); setShowAuthModal(true); }} style={{ background: "transparent", border: "none", color: C.accent, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Sign in</button>
              </div>
            ) : !supabase ? (
              <div style={{ padding: 14, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
                Sharing requires the cloud sync backend, which isn't configured for this deployment.
              </div>
            ) : (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: 14 }}>
                  Invite people by email. Recipients must sign in with that email to view the notebook read-only. They can't edit your sources or notes.
                </p>

                {/* Email input */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input type="email" value={shareGrantEmail} onChange={(e) => setShareGrantEmail(e.target.value)} placeholder="name@example.com"
                    onKeyDown={(e) => e.key === "Enter" && addShareGrant(shareNotebookId, shareGrantEmail)}
                    style={{ flex: 1, padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, outline: "none", color: C.ink }} />
                  <Btn variant="primary" onClick={() => addShareGrant(shareNotebookId, shareGrantEmail)} disabled={shareLoading || !shareGrantEmail.trim()}>Invite</Btn>
                </div>

                {/* Current grants */}
                {grant.shared_with_emails.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionLabel style={{ marginBottom: 6 }}>Shared with</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {grant.shared_with_emails.map((email) => (
                        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2 }}>
                          <span style={{ fontFamily: fontMono, fontSize: 12, color: C.ink }}>{email}</span>
                          <button onClick={() => removeShareGrant(shareNotebookId, email)} disabled={shareLoading} style={{ background: "transparent", border: "none", fontFamily: fontMono, fontSize: 10, color: C.accent, cursor: "pointer", padding: 0 }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share URL */}
                <SectionLabel style={{ marginBottom: 6 }}>Share URL</SectionLabel>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input type="text" readOnly value={shareUrl} onClick={(e) => e.target.select()}
                    style={{ flex: 1, padding: "8px 10px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11, color: C.inkSoft, outline: "none" }} />
                  <Btn variant="ghost" onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Link copied"); }}>
                    <Copy size={12} /> Copy
                  </Btn>
                </div>

                {/* Note about backend SQL */}
                <div style={{ padding: 12, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontMono, fontSize: 10, color: C.inkMuted, lineHeight: 1.5 }}>
                  Sharing requires the <code>shared_notebooks</code> table + RLS policies in your Supabase project. The SQL is in the source — see the "SHAREABLE NOTEBOOK LINKS" section in App.jsx.
                </div>
              </div>
            )}
          </ModalShell>
        );
      })()}

      {/* ============ VIEWING A SHARED NOTEBOOK (read-only) ============ */}
      {viewingSharedNotebook && (
        <ModalShell onClose={() => { setViewingSharedNotebook(null); window.history.replaceState({}, "", window.location.pathname); }} title={`Viewing · ${viewingSharedNotebook.name}`} icon={<Link2 size={18} />} wide>
          <div style={{ padding: 10, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3, marginBottom: 14, fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
            <strong>Read-only view.</strong> You're viewing a shared notebook. To use it for AI tutoring, copy any source content you need into your own notebook.
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 8, color: C.ink }}>
            {viewingSharedNotebook.emoji || "📓"} {viewingSharedNotebook.name}
          </h2>
          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 14 }}>
            {(viewingSharedNotebook.sources || []).filter((s) => !s.deletedAt).length} source{(viewingSharedNotebook.sources || []).filter((s) => !s.deletedAt).length === 1 ? "" : "s"}
          </div>
          <SectionLabel style={{ marginBottom: 6 }}>Sources</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
            {(viewingSharedNotebook.sources || []).filter((s) => !s.deletedAt).map((s, i) => (
              <div key={s.id || i} style={{ padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 4 }}>S{i + 1} · {s.type || "text"}</div>
                <div style={{ fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{s.name}</div>
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{s.content.slice(0, 2000)}{s.content.length > 2000 ? "…" : ""}</div>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* ============ ONBOARDING MODAL — 4-step guided start ============ */}
      {showOnboarding && (() => {
        const steps = [
          { id: 0, title: "Welcome to Study It", label: "1 of 4" },
          { id: 1, title: "What do you want to study?", label: "2 of 4" },
          { id: 2, title: "What's your goal?", label: "3 of 4" },
          { id: 3, title: "Pick your starting level", label: "4 of 4" },
        ];
        const step = steps[onboardingStep];
        const canAdvance = (() => {
          if (onboardingStep === 1) return onboardingDraft.subject.trim().length > 0;
          if (onboardingStep === 2 && onboardingDraft.goal === "exam") return onboardingDraft.examDate.length > 0;
          return true;
        })();
        return (
          <ModalShell onClose={() => completeOnboarding(true)} title={step.title} icon={<Sparkles size={18} color={C.gold} />} wide>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 6, marginBottom: 22, justifyContent: "center" }}>
              {steps.map((s, i) => (
                <div key={s.id} style={{
                  height: 4, flex: 1, maxWidth: 60, borderRadius: 99,
                  background: i <= onboardingStep ? C.gold : C.rule,
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>{step.label}</div>

            {/* STEP 0 — Welcome + name */}
            {onboardingStep === 0 && (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 16, lineHeight: 1.6, color: C.ink, marginBottom: 16 }}>
                  Study It is an AI-powered learning workspace. Bring your own material (notes, PDFs, lecture transcripts) and Study It turns it into flashcards, practice quizzes, explainers, mind maps, and more — grounded in your sources, not made-up.
                </p>
                <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, fontStyle: "italic", marginBottom: 18, lineHeight: 1.55 }}>
                  Three quick questions and you'll be ready. About 60 seconds.
                </p>
                <SectionLabel style={{ marginBottom: 6 }}>What should I call you? (Optional)</SectionLabel>
                <input type="text" value={onboardingDraft.name}
                  onChange={(e) => setOnboardingDraft({ ...onboardingDraft, name: e.target.value })}
                  placeholder="Your first name"
                  onKeyDown={(e) => { if (e.key === "Enter") setOnboardingStep(1); }}
                  style={{ width: "100%", padding: "10px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, color: C.ink, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {/* STEP 1 — Subject */}
            {onboardingStep === 1 && (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6, color: C.ink, marginBottom: 14 }}>
                  Pick a topic, course, or subject you want to learn. I'll create a notebook for it — that's where your sources, generated flashcards, and study history live.
                </p>
                <SectionLabel style={{ marginBottom: 6 }}>Subject or course name</SectionLabel>
                <input type="text" value={onboardingDraft.subject}
                  onChange={(e) => setOnboardingDraft({ ...onboardingDraft, subject: e.target.value })}
                  placeholder="e.g. Organic Chemistry II, US History 1865-1945, Mandarin Vocab, Real Analysis"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) setOnboardingStep(2); }}
                  style={{ width: "100%", padding: "10px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, color: C.ink, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
                <SectionLabel style={{ marginBottom: 6 }}>What's tricky about it? (Optional — helps Study It target your weak spots)</SectionLabel>
                <textarea value={onboardingDraft.subjectDesc}
                  onChange={(e) => setOnboardingDraft({ ...onboardingDraft, subjectDesc: e.target.value })}
                  placeholder="e.g. I keep mixing up SN1 vs SN2 reactions; my exam emphasizes mechanisms over memorization"
                  rows={3}
                  style={{ width: "100%", padding: "10px 14px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
              </div>
            )}

            {/* STEP 2 — Goal */}
            {onboardingStep === 2 && (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6, color: C.ink, marginBottom: 14 }}>
                  This tunes how Study It paces you and what it surfaces on the Today tab.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { id: "exam", label: "Studying for a specific exam", desc: "Sets your exam date, weights the heatmap toward streaks, surfaces error review prominently" },
                    { id: "course", label: "Learning a full course or curriculum", desc: "Surfaces curriculum builder, longer-form briefings, spaced-repetition for the whole semester" },
                    { id: "casual", label: "Casual / curious learning", desc: "Optimized for exploration and breadth — flashcards, explainers, audio overviews" },
                    { id: "research", label: "Deep research or graduate-level work", desc: "Surfaces lateral-reading fact-check, multi-agent verification, deep-thinking modes by default" },
                  ].map((g) => (
                    <button key={g.id} onClick={() => setOnboardingDraft({ ...onboardingDraft, goal: g.id })}
                      style={{
                        padding: "12px 14px", textAlign: "left", borderRadius: 3,
                        background: onboardingDraft.goal === g.id ? C.goldSoft : C.paperLight,
                        border: `1.5px solid ${onboardingDraft.goal === g.id ? C.gold : C.rule}`,
                        cursor: "pointer", fontFamily: fontSans, transition: "all 0.15s",
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 3 }}>{g.label}</div>
                      <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.45 }}>{g.desc}</div>
                    </button>
                  ))}
                </div>
                {onboardingDraft.goal === "exam" && (
                  <div style={{ marginTop: 12 }}>
                    <SectionLabel style={{ marginBottom: 6 }}>When is your exam?</SectionLabel>
                    <input type="date" value={onboardingDraft.examDate}
                      onChange={(e) => setOnboardingDraft({ ...onboardingDraft, examDate: e.target.value })}
                      min={new Date().toISOString().slice(0, 10)}
                      style={{ padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 13, color: C.ink, outline: "none" }} />
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Difficulty */}
            {onboardingStep === 3 && (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 15, lineHeight: 1.6, color: C.ink, marginBottom: 14 }}>
                  Pick the level Study It should target. You can change this anytime in Settings or by mode.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {[
                    { id: "beginner", label: "Beginner", desc: "Plain language, frequent analogies, breaks every concept down" },
                    { id: "intermediate", label: "Intermediate", desc: "Standard textbook level — assumes some background but explains nuances" },
                    { id: "advanced", label: "Advanced", desc: "Rigorous and dense — assumes solid foundation, focuses on edge cases and depth" },
                    { id: "expert", label: "Expert / Graduate", desc: "Professional-grade rigor — derivations, primary literature framing, no hand-holding" },
                  ].map((d) => (
                    <button key={d.id} onClick={() => setOnboardingDraft({ ...onboardingDraft, difficulty: d.id })}
                      style={{
                        padding: "12px 14px", textAlign: "left", borderRadius: 3,
                        background: onboardingDraft.difficulty === d.id ? C.goldSoft : C.paperLight,
                        border: `1.5px solid ${onboardingDraft.difficulty === d.id ? C.gold : C.rule}`,
                        cursor: "pointer", fontFamily: fontSans, transition: "all 0.15s",
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 3 }}>{d.label}</div>
                      <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.45 }}>{d.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{ padding: 12, background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
                  Done! When you finish, I'll drop you into the <strong>AI Tutor</strong> tab with your "{onboardingDraft.subject || "first"}" notebook active. Pick <strong>Flashcards</strong> or <strong>Explain</strong> to see what Study It does. Press <kbd style={{ padding: "1px 5px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11 }}>⌘K</kbd> anytime to search every command.
                </div>
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 22, alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => completeOnboarding(true)}>Skip</Btn>
              <div style={{ flex: 1 }} />
              {onboardingStep > 0 && (
                <Btn variant="ghost" onClick={() => setOnboardingStep(onboardingStep - 1)}>← Back</Btn>
              )}
              {onboardingStep < steps.length - 1 ? (
                <Btn variant="primary" onClick={() => canAdvance && setOnboardingStep(onboardingStep + 1)} disabled={!canAdvance}>
                  Next →
                </Btn>
              ) : (
                <Btn variant="primary" onClick={() => { completeOnboarding(false); setView("tutor"); }}>
                  Start studying
                </Btn>
              )}
            </div>
          </ModalShell>
        );
      })()}

      {/* ============ HELP MODAL — searchable in-app manual ============ */}
      {showHelp && (
        <ModalShell onClose={() => { setShowHelp(false); setHelpSearch(""); }} title="Help" icon={<HelpCircle size={18} />} wide>
          <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginBottom: 14, lineHeight: 1.55 }}>
            Everything Study It can do, honestly described — including the limits. Type to search any topic, or browse by category. <span style={{ color: C.inkMuted }}>Last updated for v{APP_VERSION} on {BUILD_DATE}.</span>
          </p>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <input type="text" value={helpSearch} onChange={(e) => setHelpSearch(e.target.value)} autoFocus
              placeholder="Search help · e.g. notebooks, OCR, export, shortcuts, API key…"
              style={{ width: "100%", padding: "12px 12px 12px 36px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: fontSans, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.inkMuted, fontSize: 14 }}>🔍</span>
            {helpSearch && (
              <button onClick={() => setHelpSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: C.inkMuted, padding: 4 }}>
                <X size={14} />
              </button>
            )}
          </div>
          {(() => {
            const q = helpSearch.trim().toLowerCase();
            const matches = (text) => q === "" || (text || "").toLowerCase().includes(q);
            const renderedCategories = HELP_CONTENT.map((cat) => {
              const matchingEntries = cat.entries.filter((e) => matches(e.title) || matches(e.body));
              if (q && matchingEntries.length === 0) return null;
              const visibleEntries = q ? matchingEntries : cat.entries;
              return { ...cat, visibleEntries };
            }).filter(Boolean);
            const totalMatch = renderedCategories.reduce((sum, c) => sum + c.visibleEntries.length, 0);
            if (q && totalMatch === 0) {
              return (
                <div style={{ padding: 24, textAlign: "center", fontFamily: fontSerif, fontSize: 14, color: C.inkMuted, fontStyle: "italic" }}>
                  No help topics match "<strong style={{ color: C.ink, fontStyle: "normal" }}>{helpSearch}</strong>". Try different keywords, or browse the categories below.
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {q && <div style={{ fontFamily: fontMono, fontSize: 11, color: C.inkSoft }}>{totalMatch} match{totalMatch === 1 ? "" : "es"} for "{helpSearch}"</div>}
                {renderedCategories.map((cat) => (
                  <div key={cat.category}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <h3 style={{ fontFamily: fontDisplay, fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{cat.category}</h3>
                      <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginLeft: "auto", letterSpacing: "0.1em" }}>{cat.visibleEntries.length} topic{cat.visibleEntries.length === 1 ? "" : "s"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {cat.visibleEntries.map((entry) => {
                        const isOpen = helpExpanded[entry.id] || q !== "";
                        return (
                          <div key={entry.id} style={{ border: `1px solid ${C.rule}`, borderRadius: 3, background: C.paperLight, overflow: "hidden" }}>
                            <button onClick={() => setHelpExpanded((s) => ({ ...s, [entry.id]: !s[entry.id] }))}
                              style={{ width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", fontFamily: fontDisplay, fontSize: 15, fontWeight: 500, color: C.ink }}>
                              <span>{entry.title}</span>
                              <ChevronDown size={14} color={C.inkMuted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                            </button>
                            {isOpen && (
                              <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.rule}` }}>
                                <div style={{ fontFamily: fontSerif, fontSize: 14, lineHeight: 1.65, color: C.ink, whiteSpace: "pre-wrap", paddingTop: 12 }}>
                                  {entry.body}
                                </div>
                                {entry.action && (
                                  <div style={{ marginTop: 12 }}>
                                    <Btn variant="primary" onClick={() => {
                                      const a = entry.action.onClick;
                                      setShowHelp(false); setHelpSearch("");
                                      if (a === "openSettings") setShowSettings(true);
                                      else if (a === "openLibrary") setView("library");
                                      else if (a === "openBrain") setView("brain");
                                      else if (a === "openPalette") setShowCommandPalette(true);
                                      else if (a === "openShortcuts") setShowShortcutOverlay(true);
                                      else if (a === "openDiagnostics") setShowDiagnostics(true);
                                    }}>{entry.action.label} →</Btn>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ marginTop: 24, padding: 14, background: C.paperDark, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>
              Can't find what you need? Send feedback — every report is read.
            </div>
            <Btn variant="ghost" onClick={() => { setShowHelp(false); setShowFeedback(true); }}>Send feedback</Btn>
          </div>
        </ModalShell>
      )}

      {/* ============ HELP CENTER ============ */}

      {/* ============ DIAGNOSTICS MODAL ============ */}
      {showDiagnostics && (
        <ModalShell onClose={() => setShowDiagnostics(false)} title="Diagnostics" icon={<Workflow size={18} />} wide>
          {(() => {
            // Compute localStorage usage live
            let lsBytes = 0, lsKeys = 0, lsLectern = 0;
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                lsKeys++;
                const v = localStorage.getItem(k) || "";
                lsBytes += k.length + v.length;
                if (k.startsWith("lectern_")) lsLectern++;
              }
            } catch {}
            const lsKb = (lsBytes / 1024).toFixed(1);
            // localStorage quota varies but ~5MB is typical
            const lsPercent = Math.min(100, Math.round((lsBytes / (5 * 1024 * 1024)) * 100));
            const avgLatency = apiUsage.latencies.length > 0 ? Math.round(apiUsage.latencies.reduce((a, b) => a + b, 0) / apiUsage.latencies.length) : 0;
            const p95Latency = apiUsage.latencies.length > 0 ? apiUsage.latencies.slice().sort((a, b) => a - b)[Math.floor(apiUsage.latencies.length * 0.95)] : 0;
            const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
            const platform = /Mac/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Linux/i.test(ua) ? "Linux" : "unknown";
            const browser = /Chrome\//i.test(ua) && !/Edg\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) && !/Chrome/i.test(ua) ? "Safari" : /Firefox\//i.test(ua) ? "Firefox" : /Edg\//i.test(ua) ? "Edge" : "other";
            const errorEntries = (() => {
              try { return JSON.parse(localStorage.getItem("lectern_errors_v1") || "[]").slice(0, 8); } catch { return []; }
            })();
            const Row = ({ label, value, mono = true }) => (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.rule}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 12, color: C.inkSoft }}>{label}</span>
                <span style={{ fontFamily: mono ? fontMono : fontSans, fontSize: 12, color: C.ink }} className="tnum">{value}</span>
              </div>
            );
            return (
              <div>
                <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginBottom: 14 }}>
                  Real internal state, computed live. Useful when something feels off and you want to know what's happening under the hood. Nothing here is sent anywhere — all client-side.
                </p>

                <SectionLabel style={{ marginBottom: 6 }}>App</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <Row label="Version" value={`v${APP_VERSION}`} />
                  <Row label="Build date" value={BUILD_DATE} />
                  <Row label="Browser" value={`${browser} on ${platform}`} mono={false} />
                  <Row label="Online" value={isOnline ? "yes" : "no — degraded mode"} />
                  <Row label="WebGPU" value={webgpuSupported === true ? "available" : webgpuSupported === false ? "not supported" : "detecting…"} />
                </div>

                <SectionLabel style={{ marginBottom: 6 }}>localStorage</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <Row label="Used" value={`${lsKb} KB (~${lsPercent}% of 5 MB)`} />
                  <Row label="Keys (all)" value={lsKeys.toLocaleString()} />
                  <Row label="Keys (Study It)" value={lsLectern.toLocaleString()} />
                  <div style={{ marginTop: 6, height: 6, background: C.paperDark, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${lsPercent}%`, background: lsPercent > 80 ? C.accent : lsPercent > 60 ? C.gold : C.moss, transition: "width 0.3s" }} />
                  </div>
                </div>

                <SectionLabel style={{ marginBottom: 6 }}>Cloud AI API usage</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <Row label="Calls this session" value={apiUsage.sessionCalls.toLocaleString()} />
                  <Row label="Calls lifetime" value={apiUsage.lifetimeCalls.toLocaleString()} />
                  <Row label="Input tokens (session, estimated)" value={`~${apiUsage.sessionInputTokens.toLocaleString()}`} />
                  <Row label="Output tokens (session, estimated)" value={`~${apiUsage.sessionOutputTokens.toLocaleString()}`} />
                  <Row label="Input tokens (lifetime, estimated)" value={`~${apiUsage.lifetimeInputTokens.toLocaleString()}`} />
                  <Row label="Output tokens (lifetime, estimated)" value={`~${apiUsage.lifetimeOutputTokens.toLocaleString()}`} />
                  <Row label="Latency (avg, last 50)" value={avgLatency > 0 ? `${avgLatency.toLocaleString()} ms` : "—"} />
                  <Row label="Latency (p95, last 50)" value={p95Latency > 0 ? `${p95Latency.toLocaleString()} ms` : "—"} />
                  <Row label="Last call at" value={apiUsage.lastCallAt ? new Date(apiUsage.lastCallAt).toLocaleString() : "—"} mono={false} />
                  {apiUsage.lastError && <Row label="Last error" value={apiUsage.lastError} mono={false} />}
                  <p style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 8, fontStyle: "italic" }}>
                    Token counts are client-side estimates at ~4 chars/token. Real billing uses the API response's usage block.
                  </p>
                </div>

                <SectionLabel style={{ marginBottom: 6 }}>Storage contents</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <Row label="Notebooks" value={liveNotebooks.length.toLocaleString()} />
                  <Row label="Sources (across notebooks)" value={liveNotebooks.reduce((sum, n) => sum + (n.sources || []).length, 0).toLocaleString()} />
                  <Row label="Saved generations" value={savedGenerations.length.toLocaleString()} />
                  <Row label="Classes" value={(myClasses || []).length.toLocaleString()} />
                  <Row label="Notes" value={(notes || []).length.toLocaleString()} />
                  <Row label="Weak spots tracked" value={(persistentProfile.weakSpots || []).length.toLocaleString()} />
                </div>

                {errorEntries.length > 0 && (
                  <>
                    <SectionLabel style={{ marginBottom: 6 }}>Recent errors ({errorEntries.length})</SectionLabel>
                    <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, padding: 12, marginBottom: 16, maxHeight: 200, overflowY: "auto" }}>
                      {errorEntries.map((err, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: i < errorEntries.length - 1 ? `1px solid ${C.rule}` : "none" }}>
                          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.05em" }}>{new Date(err.ts || err.timestamp || 0).toLocaleString()} · {err.context || err.scope || "unknown"}</div>
                          <div style={{ fontFamily: fontMono, fontSize: 11, color: C.accent, marginTop: 2 }}>{err.msg || err.message || JSON.stringify(err).slice(0, 200)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn variant="ghost" onClick={() => {
                    // Copy diagnostics as a single text blob — useful when sending feedback
                    const text = `Study It Diagnostics
Version: v${APP_VERSION} (${BUILD_DATE})
Browser: ${browser} on ${platform}
Online: ${isOnline}
WebGPU: ${webgpuSupported}
localStorage: ${lsKb} KB / ${lsKeys} keys (${lsLectern} app)
Cloud AI calls — session: ${apiUsage.sessionCalls}, lifetime: ${apiUsage.lifetimeCalls}
Tokens (session, est.) — in: ~${apiUsage.sessionInputTokens}, out: ~${apiUsage.sessionOutputTokens}
Tokens (lifetime, est.) — in: ~${apiUsage.lifetimeInputTokens}, out: ~${apiUsage.lifetimeOutputTokens}
Latency — avg: ${avgLatency} ms, p95: ${p95Latency} ms
Last call: ${apiUsage.lastCallAt ? new Date(apiUsage.lastCallAt).toLocaleString() : "—"}
Last error: ${apiUsage.lastError || "—"}
Notebooks: ${liveNotebooks.length} / Sources: ${liveNotebooks.reduce((s, n) => s + (n.sources || []).length, 0)} / Vault: ${savedGenerations.length}
Recent errors: ${errorEntries.length}`;
                    navigator.clipboard?.writeText(text).then(() => showToast("Diagnostics copied to clipboard"));
                  }}>Copy diagnostics</Btn>
                  <Btn variant="ghost" onClick={() => {
                    if (confirm("Reset session counters? Lifetime totals are preserved.")) {
                      setApiUsage((u) => ({ ...u, sessionCalls: 0, sessionInputTokens: 0, sessionOutputTokens: 0, latencies: [] }));
                      showToast("Session counters reset");
                    }
                  }}>Reset session counters</Btn>
                </div>
              </div>
            );
          })()}
        </ModalShell>
      )}

      {/* ============ ABOUT MODAL ============ */}
      {showAbout && (
        <ModalShell onClose={() => setShowAbout(false)} title={`About ${APP_NAME}`} icon={<BookOpen size={18} />}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, background: `linear-gradient(150deg, ${C.gold}, #8B6F40)`, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisplay, fontSize: 32, fontWeight: 600, fontStyle: "italic", borderRadius: 5, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 12px rgba(0,0,0,0.35)`, position: "relative" }}>
                S
                <span style={{ position: "absolute", bottom: 6, left: 11, right: 11, height: 3, background: C.accent, borderRadius: 2 }} />
              </div>
              <div>
                <div style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.01em" }}>{APP_NAME}</div>
                <div style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, marginTop: 4, letterSpacing: "0.05em" }}>v{APP_VERSION} · built {BUILD_DATE}</div>
              </div>
            </div>
            <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: 18 }}>
              An editorial AI study companion. NotebookLM-inspired source-grounded generation. Honest about what works and what doesn't.
            </p>
            <SectionLabel style={{ marginBottom: 8 }}>Built with</SectionLabel>
            <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, padding: 12, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 18px", fontFamily: fontMono, fontSize: 11, color: C.inkSoft }}>
                <span>React 18</span>
                <span>Vite 5</span>
                <span>Lucide icons</span>
                <span>jsPDF / docx / SheetJS / pptxgenjs</span>
                <span>WebLLM (local AI)</span>
                <span>Mammoth (.docx ingest)</span>
                <span>KaTeX (math rendering)</span>
                <span>Supabase (sync)</span>
              </div>
            </div>
            <SectionLabel style={{ marginBottom: 8 }}>Powered by</SectionLabel>
            <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.55, marginBottom: 16 }}>
              Frontier cloud-AI models (Opus, Sonnet, Haiku tiers) for high-quality work; on-device WebGPU models for offline/free use. Your API key, your usage, your control. Bring your own key in Settings → AI Provider.
            </p>
            <div style={{ padding: 12, background: C.paperDark, borderRadius: 3, fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.05em" }}>
              All data is stored locally in your browser. No server-side analytics. Drive integration is opt-in. Supabase sync is opt-in.
            </div>
          </div>
        </ModalShell>
      )}

      {/* ============ HANDWRITING TRANSCRIPTION MODAL ============ */}
      {showOcrEnhance && (
        <ModalShell onClose={() => setShowOcrEnhance(false)} title="Transcribe handwriting · Power mode" icon={<Camera size={18} />} wide>
          {!ocrResult && !ocrLoading && (
            <div>
              <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: 12 }}>
                <strong>Power mode</strong> uses the frontier model (Opus 4.8) and reads <strong>three preprocessed variants</strong> of your image in parallel:
              </p>
              <div style={{ padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, marginBottom: 14, fontFamily: fontSerif, fontSize: 13, lineHeight: 1.7, color: C.inkSoft }}>
                <div><strong style={{ color: C.ink }}>Original</strong> · scaled to 2000px max, no enhancement — best on clean photos</div>
                <div><strong style={{ color: C.ink }}>Enhanced</strong> · grayscale-lean + S-curve contrast + unsharp mask — best for most everyday photos</div>
                <div><strong style={{ color: C.ink }}>Binarized</strong> · Otsu adaptive threshold to pure black/white — best for faint pencil and low-contrast notes</div>
              </div>
              <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14 }}>
                The model reconciles across variants, then a focused refinement pass attacks remaining uncertain words. Frontier model is used for both stages regardless of your Quality Studio preset.
              </p>

              <SectionLabel style={{ marginBottom: 6 }}>Domain hint <span style={{ color: C.inkMuted, fontWeight: 400 }}>· optional, but disambiguates ambiguous words</span></SectionLabel>
              <input type="text" value={ocrDomain} onChange={(e) => setOcrDomain(e.target.value)} placeholder='e.g. "biology lecture notes" / "Spanish poem" / "physics derivation" / "medical chart"'
                style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 13, marginBottom: 16, outline: "none", boxSizing: "border-box" }} />

              <div style={{ padding: 12, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3, marginBottom: 16 }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Honest cost</div>
                <div style={{ fontFamily: fontSerif, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
                  Two Opus 4.8 calls × {3 * images.length} images in the first call + {images.length} in the refinement. Frontier model is the most expensive tier. If a human literate adult can't read the handwriting, this still can't either — there's no separate handwriting model behind this, just the cloud AI's vision used carefully.
                </div>
              </div>
              <SectionLabel style={{ marginBottom: 8 }}>{images.length} image{images.length === 1 ? "" : "s"} ready</SectionLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {images.map((img, i) => (
                  <img key={i} src={img.preview} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 2, border: `1px solid ${C.rule}` }} />
                ))}
              </div>
              <Btn variant="primary" onClick={runHandwritingOCR}>Run power transcription</Btn>
            </div>
          )}
          {ocrLoading && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <Loader2 size={28} className="spin" color={C.ink} />
              <div style={{ marginTop: 14, fontFamily: fontMono, fontSize: 12, color: C.inkSoft, letterSpacing: "0.05em" }}>{ocrPassStatus}</div>
            </div>
          )}
          {ocrResult && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <SectionLabel>Final transcript</SectionLabel>
                <span style={{ padding: "3px 8px", background: ocrResult.confidence === "high" ? C.mossSoft : ocrResult.confidence === "low" ? C.accentSoft : C.goldSoft, color: ocrResult.confidence === "high" ? C.moss : ocrResult.confidence === "low" ? C.accent : C.gold, borderRadius: 2, fontFamily: fontMono, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{ocrResult.confidence} confidence</span>
                {ocrResult.writingQuality && ocrResult.writingQuality !== "unknown" && (
                  <span style={{ padding: "3px 8px", background: C.paperDark, color: C.inkSoft, borderRadius: 2, fontFamily: fontMono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{ocrResult.writingQuality}</span>
                )}
                <span style={{ padding: "3px 8px", background: C.paperDark, color: C.inkSoft, borderRadius: 2, fontFamily: fontMono, fontSize: 10, letterSpacing: "0.1em" }}>{ocrResult.variantsUsed} variants × Opus 4.8</span>
              </div>
              <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic", marginBottom: 8 }}>
                Edit any uncertain word inline. Brackets like <code style={{ fontFamily: fontMono, fontSize: 11, padding: "1px 4px", background: C.paperDark }}>word[alt1/alt2]</code> show the model's alternatives — pick the right one, type a fix, or leave brackets as-is.
              </p>
              <textarea value={ocrResult.editable} onChange={(e) => setOcrResult({ ...ocrResult, editable: e.target.value })}
                style={{ width: "100%", minHeight: 280, padding: 16, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7, marginBottom: 14, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
              {ocrResult.uncertainWords?.length > 0 && (
                <div style={{ padding: 12, background: C.goldSoft, borderRadius: 3, marginBottom: 14 }}>
                  <SectionLabel style={{ color: C.gold, marginBottom: 6 }}>Still uncertain after refinement ({ocrResult.uncertainWords.length}) — review these in the transcript</SectionLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ocrResult.uncertainWords.map((w, i) => (
                      <span key={i} style={{ padding: "2px 8px", background: C.paper, border: `1px solid ${C.gold}`, borderRadius: 2, fontFamily: fontMono, fontSize: 11, color: C.gold }}>{w}</span>
                    ))}
                  </div>
                </div>
              )}
              {ocrResult.notes && (
                <div style={{ padding: 12, background: C.paperDark, borderRadius: 3, marginBottom: 14, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>
                  <SectionLabel style={{ marginBottom: 4 }}>Model notes</SectionLabel>
                  {ocrResult.notes}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="primary" onClick={() => {
                  navigator.clipboard?.writeText(ocrResult.editable).then(() => showToast("Edited transcript copied"));
                }}>Copy transcript</Btn>
                {currentNotebook && (
                  <Btn variant="ghost" onClick={() => {
                    addSourceToNotebook(currentNotebook.id, { name: `Handwritten note · ${new Date().toLocaleDateString()}`, content: ocrResult.editable, type: "notes" });
                    showToast(`Added to "${currentNotebook.name}" as a source`);
                  }}>Save edited transcript to notebook</Btn>
                )}
                <Btn variant="ghost" onClick={() => { setOcrResult(null); }}>Re-run with different domain hint</Btn>
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* ============ NOTEBOOK CREATE MODAL ============ */}
      {showNotebookCreate && (
        <ModalShell onClose={() => setShowNotebookCreate(false)} title="New notebook" icon={<BookOpen size={18} />}>
          <NotebookCreateForm onCreate={(name, emoji, color) => { createNotebook(name, emoji, color); setShowNotebookCreate(false); setView("tutor"); }} onCancel={() => setShowNotebookCreate(false)} />
        </ModalShell>
      )}

      {/* ============ NOTEBOOK SOURCES MODAL ============ */}
      {showNotebookSources && currentNotebook && (
        <ModalShell onClose={() => setShowNotebookSources(false)} title={`Sources · ${currentNotebook.name}`} icon={<Layers size={18} />} wide>
          <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginBottom: 16 }}>
            These sources are injected into every AI generation in this notebook. The AI cites them inline as [S1], [S2], etc. so you can trace any claim back to its source.
          </p>
          {(currentNotebook.sources || []).length === 0 ? (
            <div style={{ padding: 18, background: C.paperLight, border: `1px dashed ${C.rule}`, borderRadius: 3, textAlign: "center", fontFamily: fontSerif, fontSize: 13, color: C.inkMuted, fontStyle: "italic", marginBottom: 14 }}>
              No sources yet. Add text, a PDF, or paste an article to ground this notebook.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {(currentNotebook.sources || []).map((s, i) => (
                <div key={s.id} style={{ padding: 12, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 36, height: 36, borderRadius: 3, background: C.ink, color: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontMono, fontSize: 11, fontWeight: 600 }}>S{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2 }}>{s.type} · {(s.content || "").length.toLocaleString()} chars</div>
                    <div style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginTop: 4, maxHeight: 60, overflow: "hidden" }}>{(s.content || "").slice(0, 240)}{(s.content || "").length > 240 ? "…" : ""}</div>
                  </div>
                  <button onClick={() => { if (confirm(`Remove source "${s.name}"?`)) removeSourceFromNotebook(currentNotebook.id, s.id); }} title="Remove source"
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkMuted, padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Btn variant="primary" onClick={() => { setNewSourceDraft({ name: "", content: "", type: "text" }); setShowAddSource(true); }}>+ Add source</Btn>
        </ModalShell>
      )}

      {/* ============ ADD SOURCE MODAL ============ */}
      {showAddSource && currentNotebook && (
        <ModalShell onClose={() => setShowAddSource(false)} title="Add source to notebook" icon={<FileText size={18} />}>
          {/* Bulk import — multi-file picker including zip archives */}
          <div style={{ marginBottom: 16, padding: 12, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 3 }}>
            <SectionLabel style={{ marginBottom: 6 }}>Bulk import</SectionLabel>
            <p style={{ fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>
              Drop a folder of class materials — .txt, .md, .pdf, .docx, or a .zip containing any of these. Each file becomes its own source. PDFs extract text via pdf.js (free) when possible.
            </p>
            <input id="bulk-import-input" type="file" multiple accept=".txt,.md,.pdf,.docx,.zip,.rtf"
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                let added = 0, failed = 0;
                showToast(`Importing ${files.length} file${files.length === 1 ? "" : "s"}…`);
                for (const file of files) {
                  try {
                    const result = await bulkImportFile(file);
                    for (const src of result) {
                      addSourceToNotebook(currentNotebook.id, src);
                      added++;
                    }
                  } catch (err) {
                    logError(err, `bulk import: ${file.name}`);
                    failed++;
                  }
                }
                showToast(`Imported ${added} source${added === 1 ? "" : "s"}${failed > 0 ? ` · ${failed} failed` : ""}`);
                if (added > 0) setShowAddSource(false);
                e.target.value = "";
              }} />
            <Btn variant="primary" onClick={() => document.getElementById("bulk-import-input")?.click()}>Choose files or zip</Btn>
          </div>

          <SectionLabel style={{ marginBottom: 6 }}>Or paste a single source manually</SectionLabel>
          <input type="text" value={newSourceDraft.name} onChange={(e) => setNewSourceDraft({ ...newSourceDraft, name: e.target.value })} placeholder="e.g. Lecture 3 notes, Chapter 5, Smith et al. 2024"
            style={{ width: "100%", padding: "8px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 14, outline: "none", boxSizing: "border-box" }} />
          <SectionLabel style={{ marginBottom: 6 }}>Type</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {["text", "article", "notes", "pdf-text", "reference"].map((t) => (
              <button key={t} onClick={() => setNewSourceDraft({ ...newSourceDraft, type: t })}
                style={{ padding: "6px 12px", background: newSourceDraft.type === t ? C.ink : C.paper, color: newSourceDraft.type === t ? C.paper : C.ink, border: `1px solid ${newSourceDraft.type === t ? C.ink : C.rule}`, borderRadius: 2, cursor: "pointer", fontFamily: fontMono, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {t}
              </button>
            ))}
          </div>
          <SectionLabel style={{ marginBottom: 6 }}>Content <span style={{ color: C.inkMuted, fontWeight: 400 }}>· paste text, article, or extracted PDF content</span></SectionLabel>
          <textarea value={newSourceDraft.content} onChange={(e) => setNewSourceDraft({ ...newSourceDraft, content: e.target.value })} placeholder="Paste the full text of your source here. Up to ~24,000 characters per source will be used in prompts."
            style={{ width: "100%", minHeight: 240, padding: "10px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontMono, fontSize: 12, lineHeight: 1.5, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 14 }}>
            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted }}>{(newSourceDraft.content || "").length.toLocaleString()} chars</span>
            {(newSourceDraft.content || "").length > 24000 && <span style={{ fontFamily: fontMono, fontSize: 11, color: C.gold }}>Long — first 24k will be used in prompts</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => {
              if (!newSourceDraft.name.trim()) { showToast("Give your source a name first"); return; }
              if (!newSourceDraft.content.trim()) { showToast("Paste some content first"); return; }
              addSourceToNotebook(currentNotebook.id, newSourceDraft);
              setShowAddSource(false);
              showToast(`Added source · ${newSourceDraft.name}`);
            }} disabled={!newSourceDraft.name.trim() || !newSourceDraft.content.trim()}>Add source</Btn>
            <Btn variant="ghost" onClick={() => setShowAddSource(false)}>Cancel</Btn>
          </div>
        </ModalShell>
      )}

      {/* Whiteboard */}
      {showWhiteboard && <Whiteboard onClose={() => setShowWhiteboard(false)} />}

      {/* ============ UNDO TOAST CONTAINER (real product: 5-sec undo on destructive actions) ============ */}
      {undoStack.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 110, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
          {undoStack.map((u) => (
            <div key={u.id} className="elev-3" style={{ pointerEvents: "auto", padding: "10px 14px", background: "#3A4150", color: C.ink, border: `1px solid ${C.rule}`, borderRadius: 3, display: "flex", alignItems: "center", gap: 14, fontFamily: fontSans, fontSize: 13, animation: "fadeUp 0.22s cubic-bezier(0.2,0.7,0.2,1) both" }}>
              <span>{u.label}</span>
              <button onClick={() => { u.undoFn(); setUndoStack((s) => s.filter((x) => x.id !== u.id)); }}
                style={{ padding: "5px 10px", background: C.gold, color: C.paper, border: "none", borderRadius: 2, fontFamily: fontSans, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Exam planner */}
      {showExamPlanner && (
        <ModalShell onClose={() => setShowExamPlanner(false)} title="Exam prep" icon={<Calendar size={18} />} wide>
          {!examPlan ? (
            <div>
              <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginBottom: 16 }}>
                Tell me about your exam and I'll build an adaptive study plan that targets your weak spots and ramps up as the date approaches.
              </p>
              <SectionLabel style={{ marginBottom: 6 }}>Exam date</SectionLabel>
              <input type="date" value={persistentProfile.examDate || ""} onChange={(e) => setPersistentProfile((p) => ({ ...p, examDate: e.target.value }))} min={new Date().toISOString().split("T")[0]}
                style={{ padding: "8px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 14, outline: "none" }} />
              <SectionLabel style={{ marginBottom: 6 }}>What exam?</SectionLabel>
              <input type="text" value={persistentProfile.goal} onChange={(e) => setPersistentProfile((p) => ({ ...p, goal: e.target.value }))} placeholder="e.g. AP Chem, MCAT"
                style={{ width: "100%", padding: "8px 12px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box" }} />
              <Btn variant="primary" onClick={() => generateExamPlan(persistentProfile.examDate)} disabled={!persistentProfile.examDate || generatingPlan} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
                {generatingPlan ? <><Loader2 size={14} className="spin" /> Building...</> : <>Build my study plan <ArrowRight size={14} /></>}
              </Btn>
            </div>
          ) : (
            <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ padding: 16, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 2, marginBottom: 14 }}>
                <SectionLabel style={{ color: C.gold }}>Plan</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600, marginTop: 4 }}>{examPlan.title}</div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{examPlan.totalDays} days · {Math.max(0, Math.ceil((new Date(persistentProfile.examDate).getTime() - Date.now()) / 86400000))} remaining</div>
              </div>
              {examPlan.dailyPlan?.map((day, i) => (
                <details key={i} style={{ border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 6 }}>
                  <summary style={{ cursor: "pointer", padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: C.paperDark, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontMono, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>D{day.day}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600 }}>{day.focus}</div>
                      <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: fontMono }}>{day.tasks?.length || 0} tasks · {day.tasks?.reduce((s, t) => s + (t.minutes || 0), 0)} min</div>
                    </div>
                  </summary>
                  <div style={{ padding: "0 12px 12px" }}>
                    {day.tasks?.map((t, ti) => (
                      <button key={ti} onClick={() => { setShowExamPlanner(false); setView("tutor"); if (t.mode) generateContent(safeMode(t.mode)); }} style={{
                        width: "100%", textAlign: "left", padding: "8px 10px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, marginBottom: 4,
                        display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: fontSans, fontSize: 13,
                      }}>
                        <Timer size={12} color={C.inkMuted} />
                        <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, width: 32 }}>{t.minutes}m</span>
                        <span style={{ flex: 1 }}>{t.activity}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
              {examPlan.examDayPrep && (
                <div style={{ background: C.ink, color: C.paper, padding: 16, borderRadius: 2, marginTop: 12 }}>
                  <SectionLabel style={{ color: C.gold }}>Day-of prep</SectionLabel>
                  <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>{examPlan.examDayPrep}</div>
                </div>
              )}
              <button onClick={() => { setExamPlan(null); setPersistentProfile((p) => ({ ...p, examPlan: null })); }} style={{ marginTop: 12, background: "transparent", border: "none", fontSize: 11, color: C.inkMuted, cursor: "pointer", padding: 0 }}>rebuild plan</button>
            </div>
          )}
        </ModalShell>
      )}

      {/* Teach-it-back */}
      {teachBackActive && (
        <ModalShell onClose={() => { setTeachBackActive(false); setTeachBackInput(""); setTeachBackFeedback(null); }} title="Teach it back" icon={<Drama size={18} />} wide>
          <p style={{ fontFamily: fontSerif, fontSize: 14, color: C.inkSoft, marginBottom: 16 }}>
            The Feynman technique: explain <strong>{topic || "the concept"}</strong> in your own words. I'll find the gaps — not to grade you, but to show what you don't know yet.
          </p>
          {!teachBackFeedback ? (
            <>
              <textarea value={teachBackInput} onChange={(e) => setTeachBackInput(e.target.value)} placeholder={`Explain ${topic || "your topic"} as if teaching a friend.`} autoFocus
                style={{ width: "100%", minHeight: 180, padding: 14, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 15, color: C.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              <Btn variant="primary" onClick={() => gradeTeachBack(topic || "the concept")} disabled={!teachBackInput.trim() || teachBackLoading || !topic} style={{ marginTop: 12, width: "100%", justifyContent: "center", padding: "12px" }}>
                {teachBackLoading ? <><Loader2 size={14} className="spin" /> Listening...</> : <>Find my gaps <ArrowRight size={14} /></>}
              </Btn>
              {!topic && <p style={{ fontSize: 12, color: C.inkMuted, marginTop: 8, textAlign: "center" }}>Set a topic in the AI Tutor first.</p>}
            </>
          ) : (
            <div>
              <div style={{ padding: 12, borderRadius: 2, marginBottom: 14, background: teachBackFeedback.overall === "solid" ? C.mossSoft : teachBackFeedback.overall === "mostly" ? C.goldSoft : C.accentSoft }}>
                <SectionLabel>Overall</SectionLabel>
                <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 600, textTransform: "capitalize", marginTop: 2 }}>{teachBackFeedback.overall} understanding</div>
              </div>
              {teachBackFeedback.captured?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionLabel style={{ color: C.moss, marginBottom: 6 }}>You got these</SectionLabel>
                  {teachBackFeedback.captured.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontFamily: fontSerif, fontSize: 14, marginBottom: 4 }}>
                      <Check size={14} color={C.moss} style={{ flexShrink: 0, marginTop: 3 }} /><RichText>{c}</RichText>
                    </div>
                  ))}
                </div>
              )}
              {teachBackFeedback.gaps?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionLabel style={{ color: C.accent, marginBottom: 6 }}>Gaps I noticed</SectionLabel>
                  {teachBackFeedback.gaps.map((g, i) => (
                    <div key={i} style={{ padding: 12, background: C.accentSoft, borderRadius: 2, marginBottom: 6 }}>
                      <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 600, marginBottom: 2 }}><RichText>{g.concept}</RichText></div>
                      <div style={{ fontFamily: fontSerif, fontSize: 13, fontStyle: "italic", color: C.inkSoft }}>→ <RichText>{g.question}</RichText></div>
                    </div>
                  ))}
                </div>
              )}
              {teachBackFeedback.nextStep && (
                <div style={{ background: C.ink, color: C.paper, padding: 14, borderRadius: 2, marginBottom: 14 }}>
                  <SectionLabel style={{ color: C.gold }}>Next step</SectionLabel>
                  <div style={{ fontFamily: fontSerif, fontSize: 14, marginTop: 4 }}><RichText>{teachBackFeedback.nextStep}</RichText></div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="soft" onClick={() => { setTeachBackInput(""); setTeachBackFeedback(null); }} style={{ flex: 1, justifyContent: "center" }}>Try again</Btn>
                <Btn variant="primary" onClick={() => { setTeachBackActive(false); setTeachBackInput(""); setTeachBackFeedback(null); }} style={{ flex: 1, justifyContent: "center" }}>Done</Btn>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: "transparent", border: "none", cursor: "pointer", padding: 8, borderRadius: 2,
  display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s",
};

function navBtnStyle(disabled) {
  return {
    padding: 12, borderRadius: "50%", background: C.paperLight, border: `1px solid ${C.rule}`,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.3 : 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}


// ============================================================
// HELPER SUBCOMPONENTS
// ============================================================
function ModalShell({ children, onClose, title, icon, wide }) {
  return (
    <div className="modal-bg-in modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
    }}>
      <div className="modal-in elev-4 modal-shell" onClick={(e) => e.stopPropagation()} style={{
        background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 6,
        width: "100%", maxWidth: wide ? 640 : 480, maxHeight: "90vh", overflowY: "auto",
      }}>
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: `1px solid ${C.rule}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {icon}
            <h3 style={{ fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
          </div>
          <button className="icon-btn hit-area" aria-label="Close modal" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 2 }}>
            <X size={18} color={C.inkMuted} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 28 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function JournalInput({ onSubmit }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <textarea id="journal-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Today I finally understood that..."
        style={{ width: "100%", minHeight: 100, padding: 14, marginTop: 10, fontFamily: fontSerif, fontSize: 15, color: C.ink, lineHeight: 1.6, background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      <Btn variant="accent" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} onClick={() => { if (draft.trim()) { onSubmit(draft); setDraft(""); } }}>
        Save entry
      </Btn>
    </div>
  );
}

function ModeCard({ icon, title, desc, onClick, loading, color = "ink" }) {
  const palettes = { ink: C.paperDark, accent: C.accentSoft, gold: C.goldSoft, moss: C.mossSoft, blue: C.blueSoft, plum: C.plumSoft };
  const iconColors = { ink: C.inkSoft, accent: C.accent, gold: C.gold, moss: C.moss, blue: C.blue, plum: C.plum };
  return (
    <button onClick={onClick} disabled={loading} className="modecard" style={{
      background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 5, padding: 16, textAlign: "left",
      cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
      position: "relative", display: "block",
    }}
      onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 10px 28px -10px ${C.shadow}`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.rule; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ width: 40, height: 40, background: palettes[color], borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: iconColors[color] }}>
        {loading ? <Loader2 size={18} className="spin" /> : icon}
      </div>
      <div style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, marginBottom: 2, color: C.ink }}>{title}</div>
      <div style={{ fontFamily: fontSans, fontSize: 12, color: C.inkMuted }}>{desc}</div>
    </button>
  );
}

function MaterialBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px", background: C.paperDark, border: `1px solid ${C.rule}`, borderRadius: 2,
      fontFamily: fontSans, fontSize: 12, color: C.ink, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>{icon} {label}</button>
  );
}

function FileChip({ icon, label, onRemove, color = "ink" }) {
  const palettes = { ink: { bg: C.paperDark, fg: C.inkSoft }, accent: { bg: C.accentSoft, fg: C.accent }, gold: { bg: C.goldSoft, fg: C.gold }, blue: { bg: C.blueSoft, fg: C.blue } };
  const p = palettes[color] || palettes.ink;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 2, background: p.bg, color: p.fg, fontSize: 12, fontFamily: fontSans, marginTop: 8, marginRight: 6 }}>
      {icon}
      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</span>
      <button onClick={onRemove} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", color: p.fg }}><X size={12} /></button>
    </div>
  );
}

function PowerToggle({ enabled, onToggle, icon, title, desc }) {
  return (
    <button onClick={onToggle} style={{
      width: "100%", textAlign: "left", padding: 12, borderRadius: 2, cursor: "pointer",
      border: `2px solid ${enabled ? C.ink : C.rule}`, background: enabled ? C.paperDark : C.paperLight,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <div style={{ marginTop: 2, color: enabled ? C.ink : C.inkMuted }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: enabled ? C.ink : C.inkSoft }}>{title}</span>
          {enabled && <Pill color="ink">on</Pill>}
        </div>
        <div style={{ fontFamily: fontSans, fontSize: 12, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}

function LevelBtn({ active, onClick, label, sub }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 2, cursor: "pointer", border: "none",
      background: active ? C.ink : C.paperDark, color: active ? C.paper : C.inkSoft,
      fontFamily: fontSans, fontSize: 13, display: "inline-flex", alignItems: "baseline", gap: 5,
    }}>
      {label}
      {sub && <span style={{ fontFamily: fontMono, fontSize: 10, opacity: 0.7 }}>{sub}</span>}
    </button>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative",
      background: on ? C.moss : C.rule, transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: C.paper, transition: "left 0.2s" }} />
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: 12, background: C.paperDark, borderRadius: 2 }}>
      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CardFace({ front, back, title, content }) {
  return (
    <div style={{
      position: "absolute", inset: 0, backfaceVisibility: "hidden",
      transform: back ? "rotateY(180deg)" : "rotateY(0deg)",
      background: back ? C.ink : C.paperLight, color: back ? C.paper : C.ink,
      border: `1px solid ${C.rule}`, borderRadius: 4, padding: 48,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
      boxShadow: `0 8px 24px ${C.shadow}`, overflow: "auto",
    }}>
      <SectionLabel style={{ color: back ? C.goldSoft : C.inkMuted, position: "absolute", top: 20, left: 24 }}>{title}</SectionLabel>
      <div style={{ fontFamily: fontDisplay, fontSize: back ? 26 : 32, fontWeight: 400, lineHeight: 1.3 }}>
        <RichText>{content}</RichText>
      </div>
      {front && <SectionLabel style={{ color: C.inkMuted, position: "absolute", bottom: 20 }}>tap to flip</SectionLabel>}
    </div>
  );
}

function SourcesPanel({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: 16, padding: 16, background: C.paperDark, borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Globe size={14} color={C.inkSoft} />
        <SectionLabel>Web sources ({sources.length})</SectionLabel>
      </div>
      {sources.map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "flex-start", gap: 6, fontFamily: fontSerif, fontSize: 14, color: C.blue, textDecoration: "none", padding: "3px 0" }}>
          <ExternalLink size={12} style={{ marginTop: 4, flexShrink: 0, opacity: 0.6 }} />
          <span>{s.title}</span>
        </a>
      ))}
    </div>
  );
}

// ============ NOTEBOOKLM-INSPIRED COMPONENTS ============

// NotebookCreateForm — small modal form for naming and styling a new notebook
function NotebookCreateForm({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📓");
  const [color, setColor] = useState("moss");
  const emojiOptions = ["📓", "📚", "🔬", "🧬", "🧮", "📐", "💻", "🎨", "🎵", "🌍", "📜", "⚖️", "🧠", "💡", "🚀", "🏛"];
  const colorOptions = [{ k: "moss", c: C.moss }, { k: "gold", c: C.gold }, { k: "blue", c: C.blue }, { k: "accent", c: C.accent }, { k: "plum", c: C.plum }];
  return (
    <div>
      <p style={{ fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", marginBottom: 14 }}>
        A notebook is a persistent workspace with its own sources. When active, every AI output is grounded in the sources you add and cites them as [S1], [S2]…
      </p>
      <SectionLabel style={{ marginBottom: 6 }}>Notebook name</SectionLabel>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Biology 101 Exam Prep, AI Safety Reading List, Spanish Literature Term Paper"
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate(name, emoji, color); }} autoFocus
        style={{ width: "100%", padding: "10px 12px", background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 2, fontFamily: fontSans, fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box" }} />
      <SectionLabel style={{ marginBottom: 6 }}>Icon</SectionLabel>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {emojiOptions.map((e) => (
          <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, padding: "6px 10px", background: emoji === e ? C.paperDark : "transparent", border: `1px solid ${emoji === e ? C.ink : C.rule}`, borderRadius: 3, cursor: "pointer" }}>{e}</button>
        ))}
      </div>
      <SectionLabel style={{ marginBottom: 6 }}>Color</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {colorOptions.map(({ k, c }) => (
          <button key={k} onClick={() => setColor(k)} title={k}
            style={{ width: 32, height: 32, background: c, border: color === k ? `3px solid ${C.ink}` : `2px solid transparent`, borderRadius: 4, cursor: "pointer" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={() => name.trim() && onCreate(name, emoji, color)} disabled={!name.trim()}>Create notebook</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

// AudioOverviewPlayer — plays the two-host transcript via browser speechSynthesis API.
// Honest about quality: browser TTS is robotic. We pick distinct voices per speaker (best available).
function AudioOverviewPlayer({ turns, title }) {
  const [playing, setPlaying] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(-1);
  const [voices, setVoices] = useState([]);
  const [voiceA, setVoiceA] = useState(null);
  const [voiceB, setVoiceB] = useState(null);
  const [rate, setRate] = useState(1.0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) { setSupported(false); return; }
    const load = () => {
      const list = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      if (list.length === 0) return;
      setVoices(list);
      // Pick two distinct voices — ideally one "female" and one "male" by name heuristics
      const f = list.find((v) => /female|woman|samantha|victoria|karen|moira|tessa|kate|allison|ava|joanna|salli|kimberly/i.test(v.name)) || list[0];
      const m = list.find((v) => /male|man|daniel|alex|fred|tom|aaron|matthew|joey|justin|bruce/i.test(v.name) && v.name !== f.name) || list[1] || list[0];
      setVoiceA(f); setVoiceB(m);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { try { window.speechSynthesis.cancel(); } catch {} };
  }, []);

  const play = () => {
    if (!supported || !turns?.length) return;
    window.speechSynthesis.cancel();
    setPlaying(true);
    let idx = 0;
    const speakNext = () => {
      if (idx >= turns.length) { setPlaying(false); setCurrentTurn(-1); return; }
      const t = turns[idx];
      setCurrentTurn(idx);
      const u = new SpeechSynthesisUtterance(t.text || "");
      u.voice = t.speaker === "A" ? voiceA : voiceB;
      u.rate = rate;
      u.pitch = t.speaker === "A" ? 1.05 : 0.95;
      u.onend = () => { idx += 1; speakNext(); };
      u.onerror = () => { idx += 1; speakNext(); };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  };
  const stop = () => { try { window.speechSynthesis.cancel(); } catch {} setPlaying(false); setCurrentTurn(-1); };

  if (!supported) {
    return (
      <div style={{ padding: 12, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 3, fontFamily: fontSerif, fontSize: 13, color: C.gold }}>
        Your browser doesn't support speech synthesis. The transcript below is still readable.
      </div>
    );
  }

  return (
    <div style={{ padding: 14, background: C.paperDark, borderRadius: 3, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!playing ? (
          <button onClick={play} disabled={!turns?.length} style={{ padding: "10px 16px", background: C.ink, color: C.paper, border: "none", borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>▶ Play conversation</button>
        ) : (
          <button onClick={stop} style={{ padding: "10px 16px", background: C.accent, color: C.paper, border: "none", borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>■ Stop</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: fontMono, fontSize: 11, color: C.inkMuted }}>
          <span>Speed</span>
          <input type="range" min="0.7" max="1.5" step="0.1" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span>{rate.toFixed(1)}x</span>
        </div>
        {voices.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: fontMono, fontSize: 11, color: C.inkMuted }}>
            <span>Voices:</span>
            <select value={voiceA?.name || ""} onChange={(e) => setVoiceA(voices.find((v) => v.name === e.target.value))} style={{ fontFamily: fontMono, fontSize: 11, padding: "2px 4px" }}>
              {voices.map((v) => <option key={v.name} value={v.name}>A · {v.name}</option>)}
            </select>
            <select value={voiceB?.name || ""} onChange={(e) => setVoiceB(voices.find((v) => v.name === e.target.value))} style={{ fontFamily: fontMono, fontSize: 11, padding: "2px 4px" }}>
              {voices.map((v) => <option key={v.name} value={v.name}>B · {v.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {playing && currentTurn >= 0 && (
        <div style={{ display: "flex", gap: 8, fontFamily: fontMono, fontSize: 11, color: C.inkSoft }}>
          <span>Turn {currentTurn + 1} of {turns.length}</span>
          <div style={{ flex: 1, height: 2, background: C.rule, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", background: C.ink, width: `${((currentTurn + 1) / turns.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// MindMapView — interactive SVG hierarchical mind map. Click branches to collapse/expand.
function MindMapView({ data }) {
  const [collapsed, setCollapsed] = useState({});
  if (!data || !data.center) return null;
  const palette = { moss: C.moss, gold: C.gold, blue: C.blue, accent: C.accent, plum: C.plum, ink: C.ink };
  // Compute radial layout: center node, branches at equal angles, sub-branches below each branch.
  const cx = 500, cy = 350;
  const W = 1000, H = 700;
  const branches = data.branches || [];
  const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);
  const startAngle = -Math.PI / 2;
  const branchRadius = 230;
  const childRadius = 140;
  const toggle = (key) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  return (
    <div style={{ width: "100%", overflowX: "auto", background: C.paper, borderRadius: 3, border: `1px solid ${C.rule}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minHeight: 500, fontFamily: fontSerif }} preserveAspectRatio="xMidYMid meet">
        {/* Branches */}
        {branches.map((br, i) => {
          const angle = startAngle + i * angleStep;
          const bx = cx + Math.cos(angle) * branchRadius;
          const by = cy + Math.sin(angle) * branchRadius;
          const color = palette[br.color] || C.ink;
          const branchKey = `b-${i}`;
          const isCollapsed = collapsed[branchKey];
          const children = isCollapsed ? [] : (br.children || []);
          // Lay children in an arc OUTWARD from the branch
          const childAngleSpread = Math.PI / 3;
          const childStartAngle = angle - childAngleSpread / 2;
          const childAngleStep = children.length > 1 ? childAngleSpread / (children.length - 1) : 0;
          return (
            <g key={i}>
              {/* Line from center to branch */}
              <line x1={cx} y1={cy} x2={bx} y2={by} stroke={color} strokeWidth="2" opacity="0.7" />
              {/* Branch node */}
              <g onClick={() => br.children?.length && toggle(branchKey)} style={{ cursor: br.children?.length ? "pointer" : "default" }}>
                <rect x={bx - 75} y={by - 18} width="150" height="36" rx="18" fill={color} stroke={color} />
                <text x={bx} y={by + 4} fill={C.paper} textAnchor="middle" fontSize="13" fontWeight="600">{br.label || "—"}</text>
                {br.children?.length > 0 && (
                  <text x={bx + 60} y={by - 6} fill={C.paper} textAnchor="middle" fontSize="10" opacity="0.7">{isCollapsed ? `+${br.children.length}` : "−"}</text>
                )}
              </g>
              {/* Children */}
              {children.map((ch, ci) => {
                const childAngle = childStartAngle + ci * childAngleStep;
                const cxC = bx + Math.cos(childAngle) * childRadius;
                const cyC = by + Math.sin(childAngle) * childRadius;
                return (
                  <g key={ci}>
                    <line x1={bx} y1={by} x2={cxC} y2={cyC} stroke={color} strokeWidth="1.2" opacity="0.5" />
                    <rect x={cxC - 60} y={cyC - 14} width="120" height="28" rx="3" fill={C.paper} stroke={color} strokeWidth="1.5" />
                    <text x={cxC} y={cyC + 4} fill={C.ink} textAnchor="middle" fontSize="11">{(ch.label || "").slice(0, 30)}</text>
                    {/* Grandchildren — listed below as small text */}
                    {ch.children?.map((gc, gi) => (
                      <text key={gi} x={cxC} y={cyC + 26 + gi * 14} fill={C.inkMuted} textAnchor="middle" fontSize="10" fontStyle="italic">{(gc.label || "").slice(0, 28)}</text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* Center */}
        <g>
          <circle cx={cx} cy={cy} r="58" fill={C.ink} />
          <text x={cx} y={cy + 4} fill={C.paper} textAnchor="middle" fontSize="13" fontWeight="600">
            {(data.center || "").length > 22 ? (data.center || "").slice(0, 22) + "…" : data.center}
          </text>
        </g>
      </svg>
      <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.rule}`, fontFamily: fontMono, fontSize: 11, color: C.inkMuted, fontStyle: "italic" }}>
        Click a branch to collapse / expand its sub-topics
      </div>
    </div>
  );
}

// SlideDeckView — prev/next slide navigation
function SlideDeckView({ deck }) {
  const [idx, setIdx] = useState(0);
  if (!deck || !deck.slides || !deck.slides.length) return null;
  const slide = deck.slides[idx];
  const isFirst = idx === 0;
  const isLast = idx === deck.slides.length - 1;
  return (
    <div>
      <div style={{ marginBottom: 12, fontFamily: fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {deck.title} · Slide {idx + 1} of {deck.slides.length}
      </div>
      <div style={{ background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 4, padding: 40, minHeight: 420, display: "flex", flexDirection: "column" }}>
        {slide.layout === "title" ? (
          <div style={{ margin: "auto", textAlign: "center" }}>
            <h1 style={{ fontFamily: fontDisplay, fontSize: 44, fontWeight: 500, margin: 0, lineHeight: 1.2 }}>{slide.heading || deck.title}</h1>
            {deck.subtitle && <p style={{ fontFamily: fontSerif, fontSize: 18, color: C.inkSoft, marginTop: 12, fontStyle: "italic" }}>{deck.subtitle}</p>}
          </div>
        ) : slide.layout === "quote" ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 700 }}>
            <div style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, lineHeight: 1.4, color: C.ink }}>&ldquo;{slide.heading}&rdquo;</div>
            {slide.bullets?.[0] && <div style={{ marginTop: 16, fontFamily: fontMono, fontSize: 13, color: C.inkSoft }}>— {slide.bullets[0]}</div>}
          </div>
        ) : slide.layout === "closing" ? (
          <div style={{ margin: "auto", textAlign: "center" }}>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 500, marginBottom: 24 }}>{slide.heading || "Thank you"}</h2>
            {slide.bullets?.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, fontFamily: fontSerif, fontSize: 16, lineHeight: 1.8 }}>
                {slide.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 500, marginBottom: 24, lineHeight: 1.2 }}>{slide.heading}</h2>
            {slide.bullets?.length > 0 && (
              <ul style={{ fontFamily: fontSerif, fontSize: 18, lineHeight: 1.7, paddingLeft: 24 }}>
                {slide.bullets.map((b, i) => <li key={i} style={{ marginBottom: 8 }}><RichText>{b}</RichText></li>)}
              </ul>
            )}
          </div>
        )}
      </div>
      {slide.speakerNotes && (
        <div style={{ marginTop: 10, padding: 12, background: C.paperDark, borderRadius: 3, fontFamily: fontSerif, fontSize: 13, color: C.inkSoft, fontStyle: "italic", lineHeight: 1.55 }}>
          <span style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 8 }}>Speaker notes</span>
          {slide.speakerNotes}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={isFirst} style={{ padding: "10px 16px", background: isFirst ? C.paperDark : C.paper, color: isFirst ? C.inkMuted : C.ink, border: `1px solid ${C.rule}`, borderRadius: 3, cursor: isFirst ? "not-allowed" : "pointer", fontFamily: fontSans, fontSize: 13 }}>← Previous</button>
        <div style={{ display: "flex", gap: 4 }}>
          {deck.slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{ width: 8, height: 8, padding: 0, borderRadius: "50%", background: i === idx ? C.ink : C.rule, border: "none", cursor: "pointer" }} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
        <button onClick={() => setIdx(Math.min(deck.slides.length - 1, idx + 1))} disabled={isLast} style={{ padding: "10px 16px", background: isLast ? C.paperDark : C.ink, color: isLast ? C.inkMuted : C.paper, border: `1px solid ${isLast ? C.rule : C.ink}`, borderRadius: 3, cursor: isLast ? "not-allowed" : "pointer", fontFamily: fontSans, fontSize: 13 }}>Next →</button>
      </div>
    </div>
  );
}

// Small format-picker dropdown for export — PDF / Word / Excel / PowerPoint
function ExportDropdown({ onExport }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest("[data-export-dropdown]")) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div data-export-dropdown style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title="Export" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "transparent", border: `1px solid ${C.rule}`, borderRadius: 3, cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.inkSoft }}>
        <Download size={14} /> Export <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 3, boxShadow: "0 4px 16px -6px rgba(0,0,0,0.15)", zIndex: 50, minWidth: 180, overflow: "hidden" }}>
          {[
            { fmt: "pdf", label: "PDF", sub: "All modes" },
            { fmt: "docx", label: "Word (.docx)", sub: "Prose modes + flashcards" },
            { fmt: "xlsx", label: "Excel (.xlsx)", sub: "Tables, flashcards, MCQs" },
            { fmt: "pptx", label: "PowerPoint (.pptx)", sub: "Slide Deck mode only" },
          ].map((opt, i) => (
            <button key={opt.fmt} onClick={() => { setOpen(false); onExport(opt.fmt); }}
              style={{ display: "block", width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderTop: i > 0 ? `1px solid ${C.rule}` : "none", textAlign: "left", cursor: "pointer", fontFamily: fontSans }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.paperDark}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{opt.label}</div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentShell({ children, topic, onBack, progress, label, onExport, reasoningLog, modelUsed }) {
  const [traceOpen, setTraceOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", fontFamily: fontSans, fontSize: 13, color: C.inkMuted }}>
          <ChevronLeft size={16} /> New topic
        </button>
        <span style={{ fontFamily: fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: "0.1em", textTransform: "uppercase", flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topic}</span>
        <div style={{ display: "flex", justifyContent: "flex-end", position: "relative" }}>
          {onExport && (
            <ExportDropdown onExport={onExport} />
          )}
        </div>
      </div>
      {progress !== undefined && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel style={{ marginBottom: 8 }}>{label}</SectionLabel>
          <div style={{ height: 2, background: C.rule, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", background: C.ink, width: `${progress}%`, transition: "width 0.4s" }} />
          </div>
        </div>
      )}
      {children}
      {reasoningLog && reasoningLog.length > 0 && (
        <div style={{ marginTop: 24, padding: 14, background: C.paperLight, border: `1px solid ${C.rule}`, borderRadius: 3 }}>
          <button onClick={() => setTraceOpen((o) => !o)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0, fontFamily: fontMono, fontSize: 10, letterSpacing: "0.12em", color: C.inkMuted, textTransform: "uppercase" }}>
            <span>How this was generated · {reasoningLog.length} stage{reasoningLog.length === 1 ? "" : "s"}{modelUsed ? ` · ${modelUsed}` : ""}</span>
            <span>{traceOpen ? "−" : "+"}</span>
          </button>
          {traceOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.rule}` }}>
              {reasoningLog.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontFamily: fontSans, fontSize: 13 }}>
                  <Check size={12} color={C.moss} />
                  <span style={{ fontWeight: 500 }}>Stage {i + 1}: {entry.stage}</span>
                  <span style={{ marginLeft: "auto", fontFamily: fontMono, fontSize: 10, color: C.inkMuted }}>{entry.status === "done" ? "✓" : entry.status}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontFamily: fontSerif, fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>
                Multi-agent pipeline: each stage's output feeds the next. The critique step finds weaknesses; the refine step fixes them; the verify step (when on) fact-checks claims with lateral reading.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Whiteboard({ onClose }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(C.ink);
  const [size, setSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  };
  const start = (e) => { e.preventDefault(); const { x, y } = getPos(e); const ctx = canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(x, y); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round"; setDrawing(true); };
  const move = (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = getPos(e); const ctx = canvasRef.current.getContext("2d"); ctx.lineTo(x, y); ctx.stroke(); };
  const stop = () => setDrawing(false);
  const clear = () => { const c = canvasRef.current; const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); };
  const download = () => { const link = document.createElement("a"); link.download = "whiteboard.png"; link.href = canvasRef.current.toDataURL(); link.click(); };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 4, padding: 16, width: "100%", maxWidth: 900, boxShadow: `0 20px 60px rgba(0,0,0,0.25)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Edit3 size={16} color={C.inkSoft} />
            <span style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 500 }}>Whiteboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[C.ink, C.accent, C.blue, C.moss, C.gold].map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${color === c ? C.ink : C.paper}`, background: c, cursor: "pointer", transform: color === c ? "scale(1.15)" : "scale(1)" }} />
            ))}
            <div style={{ width: 1, height: 22, background: C.rule, margin: "0 4px" }} />
            {[2, 4, 8].map((s) => (
              <button key={s} onClick={() => setSize(s)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: size === s ? C.ink : C.paperDark, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: s + 2, height: s + 2, borderRadius: "50%", background: size === s ? C.paper : C.inkSoft }} />
              </button>
            ))}
            <div style={{ width: 1, height: 22, background: C.rule, margin: "0 4px" }} />
            <button onClick={clear} title="Clear" style={iconBtnStyle}><Eraser size={16} color={C.inkSoft} /></button>
            <button onClick={download} title="Download" style={iconBtnStyle}><Download size={16} color={C.inkSoft} /></button>
            <button onClick={onClose} style={iconBtnStyle}><X size={16} color={C.inkSoft} /></button>
          </div>
        </div>
        <canvas ref={canvasRef} width={1200} height={680} style={{ width: "100%", border: `1px solid ${C.rule}`, borderRadius: 2, background: "#F2EEE5", cursor: "crosshair", touchAction: "none" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} />
      </div>
    </div>
  );
}

// === gradeTeachBack & generateExamPlan need to live on App; re-declared as no-ops avoided ===

// ============================================================
// Wrapped export — AppInner inside the ErrorBoundary
// ============================================================
export default function App() {
  return React.createElement(AppErrorBoundary, null, React.createElement(AppInner, null));
}
