// ACC Empathy Workshop — single-file Claude artifact
// Paste this into a Claude artifact. Default export.
// Storage: window.storage (Claude artifacts API). Polled every 3s.
// All labels bilingual (English primary, 繁體中文 secondary).

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users, Archive, Heart, Layers, CheckCircle2, QrCode,
  Settings, ChevronLeft, ChevronRight, Plus, X, Trash2,
  RefreshCw, Printer, Eye, EyeOff, Clock, Maximize2, Minimize2,
  AlertCircle, WifiOff, Wifi, Loader2, Send, Edit3, ArrowRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   STORAGE — thin wrapper over window.storage with retries.
   Never throws. Returns null/false on failure so UI can recover.
   ───────────────────────────────────────────────────────────── */
const STORAGE_KEYS = {
  personas: "acc-personas",
  active: "acc-active-board",
  empathy: "acc-stickies-empathy",
  parking: "acc-stickies-parking-lot",
  reflections: "acc-stickies-reflections",
  practices: "acc-stickies-practices",
  commitments: "acc-stickies-commitments",
  draft: "acc-draft",
  agenda: "acc-agenda",
};

async function sGet(key) {
  try {
    if (typeof window === "undefined" || !window.storage) return null;
    const v = await window.storage.get(key);
    return v ?? null;
  } catch (e) {
    console.warn("storage.get failed", key, e);
    return null;
  }
}
async function sSet(key, value, opts = { shared: true }) {
  try {
    if (typeof window === "undefined" || !window.storage) return false;
    await window.storage.set(key, value, opts);
    return true;
  } catch (e) {
    console.warn("storage.set failed", key, e);
    return false;
  }
}
async function sSetWithRetry(key, value, opts = { shared: true }, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    if (await sSet(key, value, opts)) return true;
    await new Promise(r => setTimeout(r, 400 * (i + 1)));
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────
   DOMAIN — boards, personas, palettes
   ───────────────────────────────────────────────────────────── */
const BOARDS = [
  { id: "empathy",     en: "Empathy Maps",      zh: "同理心地圖", icon: Users,        prompt: "Step into someone else's shoes. Pick a person, pick a quadrant, share what you imagine." },
  { id: "parking",     en: "Parking Lot",       zh: "暫存區",     icon: Archive,      prompt: "Capture operational concerns here so we can stay focused on listening.",
    longEn: "This workshop isn't for solving operational questions — building space, program scheduling, staffing, ministry logistics. Those matter, but if we let them in now they'll crowd out the harder work of genuinely hearing each other across campuses, languages, and generations. Park them here so we don't lose them; the elder board will revisit them in their longer deliberation.",
    longZh: "這個工作坊不是用來解決營運問題 — 例如建築空間、課程安排、人員配置或事工後勤。這些都很重要，但如果現在討論，會擠掉我們真正需要做的功課：跨堂會、跨語言、跨世代地真誠聆聽彼此。請把這些想法暫存於此，我們不會遺忘；長老會將在後續的討論中再度檢視。" },
  { id: "reflections", en: "Reflections",       zh: "反思",       icon: Heart,        prompt: "What did you hear today from a community different from your own that you'd have missed?" },
  { id: "practices",   en: "Practice Proposals",zh: "實踐提案",   icon: Layers,       prompt: "What's one thing we could build together — a rhythm, a structure, or a personal habit?" },
  { id: "commitments", en: "Commitments",       zh: "個人承諾",   icon: CheckCircle2, prompt: "Which practice would you personally commit to participating in?" },
];

const QUADRANTS = [
  { id: "says",   en: "Says",             zh: "說的話",     hint: "Words they might use out loud" },
  { id: "thinks", en: "Thinks",           zh: "想的事",     hint: "Private thoughts they may not voice" },
  { id: "does",   en: "Does",             zh: "做的事",     hint: "Behaviours, habits, choices" },
  { id: "feels",  en: "Feels",            zh: "感受",       hint: "Emotions — hopes and fears" },
];

// Sample empathy map shown to participants as an example before they start.
// Uses a fictional persona so it doesn't bias the real ones.
const SAMPLE_PERSONA = {
  id: "_sample", emoji: "👴🏻", name: "Sample · Uncle Tan", nameZh: "陳叔叔",
  campus: "main", tag: "Example only · 範例",
  description: "A made-up example so you can see what good empathy notes look like before you write your own.",
};
const SAMPLE_STICKIES = [
  { quadrant: "says",   text: "\"The young people don't sing the old hymns anymore.\"", color: 0 },
  { quadrant: "says",   text: "\"I'll come early to set up — it's my way of serving.\"", color: 2 },
  { quadrant: "thinks", text: "Will anyone notice if I stop coming?", color: 1 },
  { quadrant: "thinks", text: "The English service feels like a different church.", color: 3 },
  { quadrant: "does",   text: "Volunteers every Sunday but rarely speaks in meetings.", color: 4 },
  { quadrant: "does",   text: "Drives 30 min to the Cantonese service.", color: 0 },
  { quadrant: "feels",  text: "Quietly proud of his decades here, but invisible to younger leaders.", color: 1 },
  { quadrant: "feels",  text: "Worried his grandkids won't speak Chinese in church.", color: 2 },
];

const PRACTICE_COLS = [
  { id: "rhythms",    en: "Rhythms",         zh: "節奏",   prompt: "What's one rhythm we could establish?", example: "e.g. quarterly cross-campus gatherings" },
  { id: "structures", en: "Structures",      zh: "結構",   prompt: "What's one structure we could build?",   example: "e.g. a campus-bridging committee" },
  { id: "habits",     en: "Personal Habits", zh: "個人習慣",prompt: "What's one habit each leader could adopt?", example: "e.g. visit the other campus quarterly" },
];

// Quick palette for a per-board accent line
const BOARD_ACCENT = { empathy: "#0d6e6e", parking: "#b8862e", reflections: "#0d6e6e", practices: "#5a4a8a", commitments: "#5a4a8a" };

const DEFAULT_PERSONAS = [
  { id: "david",  campus: "main", emoji: "👨🏻", name: "David",
    nameZh: "", age: 28, tag: "ABC · English-speaking · single",
    description: "Grew up at ACC. Visiting a megachurch with strong young-adult ministry. Wonders if he should stay." },
  { id: "wong",   campus: "main", emoji: "👨🏻‍🦳", name: "Mr. Wong",
    nameZh: "王先生", age: 55, tag: "Cantonese · 20 years here",
    description: "Faithful volunteer. Watches younger Cantonese-speakers age out. Hesitant to voice that his community is shrinking." },
  { id: "zhang",  campus: "main", emoji: "👫🏻", name: "The Zhang Couple",
    nameZh: "張夫婦", age: null, tag: "Married 4 yrs · split Sundays",
    description: "Daniel is ABC; Lily immigrated from Shanghai 3 yrs ago, still learning English. He goes to English service, she to Mandarin." },
  { id: "kevin",  campus: "main", emoji: "🧑🏻‍🎓", name: "Kevin",
    nameZh: "凱文", age: 22, tag: "Mandarin · UTA student · new to faith",
    description: "International student. Finds sermons long; feels awkward as a non-Christian background among lifelong believers. Lonely between worlds." },
  { id: "grace",  campus: "main", emoji: "👩🏻", name: "Grace",
    nameZh: "恩慈", age: 34, tag: "Mandarin · grad-school transplant",
    description: "Quietly visiting another Chinese church 30 min away with a larger Mandarin-speaking singles community." },
  { id: "mei",    campus: "north", emoji: "👵🏻", name: "Auntie Mei",
    nameZh: "美阿姨", age: 62, tag: "Mandarin · doesn't drive far",
    description: "Came to faith 8 years ago. Worries North Campus will always be 'the smaller one' and that decisions are made without her community in mind." },
  { id: "liu",    campus: "north", emoji: "👨‍👩‍👧‍👦", name: "The Liu Family",
    nameZh: "劉家", age: null, tag: "Two kids (10, 13) · proximity choice",
    description: "Both parents working. Chose North Campus for proximity and warmth, but kids' programs are fewer than Main. Quietly wondering if they should switch." },
  { id: "chen",   campus: "both", emoji: "🏡", name: "The Chen Family",
    nameZh: "陳家", age: null, tag: "New from California · visited both",
    description: "Liked Main Campus's energy but felt anonymous; liked North Campus's warmth but worried about long-term programs." },
];

const STICKY_PALETTE = [
  { bg: "#FEF3C7", ink: "#78350F", edge: "#FDE68A" }, // warm yellow
  { bg: "#FCE7F3", ink: "#831843", edge: "#FBCFE8" }, // soft pink
  { bg: "#DBEAFE", ink: "#1E3A8A", edge: "#BFDBFE" }, // sky blue
  { bg: "#DCFCE7", ink: "#14532D", edge: "#BBF7D0" }, // sage green
  { bg: "#EDE9FE", ink: "#4C1D95", edge: "#DDD6FE" }, // lavender
];
const pickColor = () => Math.floor(Math.random() * STICKY_PALETTE.length);

const CAMPUS_LABEL = {
  main:  { en: "Main Campus",  zh: "主堂", color: "#0d6e6e" },
  north: { en: "North Campus", zh: "北堂", color: "#b8862e" },
  both:  { en: "Both Campuses",zh: "兩堂", color: "#5a4a8a" },
};

/* ─────────────────────────────────────────────────────────────
   ROOT — view router
   ───────────────────────────────────────────────────────────── */
export default function ACCWorkshop() {
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "landing";
    const role = new URLSearchParams(window.location.search).get("role");
    return role === "participant" || role === "facilitator" ? role : "landing";
  }); // landing | participant | facilitator
  const [bootError, setBootError] = useState(null);

  // Lazy-init personas if missing.
  useEffect(() => {
    (async () => {
      try {
        const existing = await sGet(STORAGE_KEYS.personas);
        if (!existing || !Array.isArray(existing) || existing.length === 0) {
          await sSet(STORAGE_KEYS.personas, DEFAULT_PERSONAS, { shared: true });
        }
        const active = await sGet(STORAGE_KEYS.active);
        if (!active) await sSet(STORAGE_KEYS.active, "empathy", { shared: true });
      } catch (e) {
        setBootError(String(e?.message || e));
      }
    })();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#faf6f0] text-[#2a251f]" style={{ fontFamily: "ui-sans-serif, -apple-system, system-ui, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .font-serif-display { font-family: 'Fraunces', ui-serif, Georgia, serif; font-optical-sizing: auto; }
        .font-ui { font-family: 'Inter', ui-sans-serif, -apple-system, system-ui, sans-serif; }
        .paper-grain {
          background-image:
            radial-gradient(rgba(120,90,40,0.03) 1px, transparent 1px),
            radial-gradient(rgba(120,90,40,0.025) 1px, transparent 1px);
          background-size: 22px 22px, 13px 13px;
          background-position: 0 0, 7px 11px;
        }
        @keyframes stickyIn {
          0% { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .sticky-in { animation: stickyIn .42s cubic-bezier(.2,.7,.2,1.05) both; }
        @keyframes pulseDot { 0%,100%{opacity:.5} 50%{opacity:1} }
        .pulse-dot { animation: pulseDot 1.6s ease-in-out infinite; }
      `}</style>

      {bootError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-800">
          Storage error: {bootError}. The app will still work locally.
        </div>
      )}

      {view === "landing"     && <Landing onPick={setView} />}
      {view === "participant" && <ParticipantApp onExit={() => setView("landing")} />}
      {view === "facilitator" && <FacilitatorApp onExit={() => setView("landing")} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   LANDING
   ───────────────────────────────────────────────────────────── */
function Landing({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 paper-grain">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d6e6e]/8 text-[#0d6e6e] text-xs font-medium tracking-wider uppercase mb-6 font-ui">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0d6e6e] pulse-dot" />
          ACC Leadership Retreat
        </div>
        <h1 className="font-serif-display text-5xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-3">
          Empathy across the lines<br />
          <span className="italic text-[#0d6e6e]">that matter most.</span>
        </h1>
        <p className="font-ui text-lg text-[#5a4a3a] mb-1">同理心 · 跨越彼此的距離</p>
        <p className="font-ui text-base text-[#7a6a5a] max-w-lg mx-auto mb-12">
          A two-hour practice in listening across campuses, languages, and generations.
          Not to produce a vision &mdash; to make sure we genuinely hear each other before one is written.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
          <button
            onClick={() => onPick("participant")}
            className="group relative bg-white rounded-2xl p-6 text-left border border-[#e8dfd0] hover:border-[#0d6e6e] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-[#0d6e6e]/10 flex items-center justify-center mb-3 group-hover:bg-[#0d6e6e]/15 transition-colors">
              <Send size={18} className="text-[#0d6e6e]" />
            </div>
            <div className="font-serif-display text-xl font-medium mb-1">I'm a Participant</div>
            <div className="font-ui text-sm text-[#7a6a5a] mb-2">我是參與者</div>
            <div className="font-ui text-xs text-[#9a8a7a]">Submit anonymously from your phone.</div>
            <ArrowRight size={16} className="absolute top-6 right-6 text-[#9a8a7a] group-hover:text-[#0d6e6e] group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => onPick("facilitator")}
            className="group relative bg-[#1f2937] text-white rounded-2xl p-6 text-left hover:shadow-xl transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/15 transition-colors">
              <Eye size={18} className="text-white" />
            </div>
            <div className="font-serif-display text-xl font-medium mb-1">I'm the Facilitator</div>
            <div className="font-ui text-sm text-white/70 mb-2">我是主持人</div>
            <div className="font-ui text-xs text-white/50">Project this view. Drive the workshop.</div>
            <ArrowRight size={16} className="absolute top-6 right-6 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        <div className="mt-12 text-xs text-[#9a8a7a] font-ui tracking-wide">
          Arlington Chinese Church · 主堂 + 北堂 · 2026
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   POLL HOOK — 3-second polling with cleanup. Pause on tab hide.
   ───────────────────────────────────────────────────────────── */
function usePoll(fn, deps = [], interval = 3000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || document.hidden) return;
      try { await fnRef.current(); } catch (e) {}
    };
    tick();
    const id = setInterval(tick, interval);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* ─────────────────────────────────────────────────────────────
   PARTICIPANT VIEW (mobile)
   ───────────────────────────────────────────────────────────── */
function ParticipantApp({ onExit }) {
  const [activeBoard, setActiveBoard] = useState("empathy");
  const [personas, setPersonas] = useState(DEFAULT_PERSONAS);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("synced"); // synced | retrying | offline
  const [parkingOverlay, setParkingOverlay] = useState(false);

  usePoll(async () => {
    const [b, p] = await Promise.all([sGet(STORAGE_KEYS.active), sGet(STORAGE_KEYS.personas)]);
    if (b && b !== activeBoard) setActiveBoard(b);
    if (Array.isArray(p) && p.length) setPersonas(p);
    setSyncStatus("synced");
    if (loading) setLoading(false);
  }, [activeBoard, loading]);

  if (loading) return <CenteredLoader label="Connecting…" />;

  const board = BOARDS.find(b => b.id === activeBoard) || BOARDS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf6f0]">
      {/* sticky header */}
      <header className="sticky top-0 z-20 bg-[#faf6f0]/95 backdrop-blur-sm border-b border-[#e8dfd0]">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <button onClick={onExit} className="font-ui text-xs text-[#7a6a5a] hover:text-[#0d6e6e] flex items-center gap-1">
            <ChevronLeft size={14} /> Exit
          </button>
          <SyncDot status={syncStatus} />
        </div>
        <div className="px-4 pb-3 pt-1">
          <div className="font-ui text-[11px] uppercase tracking-widest text-[#0d6e6e] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0d6e6e] pulse-dot" />
            Active Now · 進行中
          </div>
          <div className="font-serif-display text-2xl font-medium leading-tight mt-0.5">{board.en}</div>
          <div className="font-ui text-sm text-[#7a6a5a]">{board.zh}</div>
        </div>
      </header>

      {/* board-specific flow */}
      <main className="flex-1 px-4 py-5 pb-28">
        {board.id === "empathy"     && <EmpathyFlow personas={personas} onSyncFail={() => setSyncStatus("retrying")} />}
        {board.id === "parking"     && <SimpleFlow boardId="parking"     storageKey={STORAGE_KEYS.parking}     promptEn={board.prompt} longEn={board.longEn} longZh={board.longZh} />}
        {board.id === "reflections" && <SimpleFlow boardId="reflections" storageKey={STORAGE_KEYS.reflections} promptEn={board.prompt} />}
        {board.id === "practices"   && <PracticesFlow />}
        {board.id === "commitments" && <SimpleFlow boardId="commitments" storageKey={STORAGE_KEYS.commitments} promptEn={board.prompt} />}
      </main>

      {/* persistent parking-lot button */}
      <div className="fixed bottom-0 inset-x-0 z-30 px-4 pb-4 pt-3 bg-gradient-to-t from-[#faf6f0] via-[#faf6f0]/95 to-transparent">
        <button
          onClick={() => setParkingOverlay(true)}
          className="w-full bg-white border border-[#e8dfd0] rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-ui text-sm font-medium text-[#5a4a3a] active:scale-[0.99] transition-transform shadow-sm"
          style={{ minHeight: 52 }}
        >
          <Archive size={16} className="text-[#b8862e]" />
          Add to Parking Lot · 加入暫存區
        </button>
      </div>

      {parkingOverlay && (
        <ParkingOverlay onClose={() => setParkingOverlay(false)} />
      )}
    </div>
  );
}

/* — Empathy flow: persona → quadrant → text — */
function EmpathyFlow({ personas, onSyncFail }) {
  const [step, setStep] = useState("persona"); // persona | compose | done
  const [personaId, setPersonaId] = useState(null);
  const [quadrant, setQuadrant] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [stickies, setStickies] = useState([]);
  const persona = personas.find(p => p.id === personaId);

  usePoll(async () => {
    const s = await sGet(STORAGE_KEYS.empathy);
    if (Array.isArray(s)) setStickies(s);
  }, []);

  // If persona evaporates from settings while we have it selected, recover.
  useEffect(() => {
    if (personaId && !personas.find(p => p.id === personaId)) {
      setStep("persona"); setPersonaId(null); setQuadrant(null);
    }
  }, [personas, personaId]);

  // Restore draft
  useEffect(() => {
    (async () => {
      const d = await sGet(STORAGE_KEYS.draft);
      if (d && d.board === "empathy" && d.text) {
        setText(d.text); setPersonaId(d.personaId || null); setQuadrant(d.quadrant || null);
      }
    })();
  }, []);

  // Persist draft on change
  useEffect(() => {
    sSet(STORAGE_KEYS.draft, { board: "empathy", personaId, quadrant, text }, { shared: false });
  }, [personaId, quadrant, text]);

  const submit = async () => {
    if (!persona || !quadrant || !text.trim()) return;
    setSubmitting(true);
    const sticky = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      personaId: persona.id,
      quadrant,
      text: text.trim(),
      color: pickColor(),
      timestamp: Date.now(),
    };
    const cur = (await sGet(STORAGE_KEYS.empathy)) || [];
    const next = [...(Array.isArray(cur) ? cur : []), sticky];
    const ok = await sSetWithRetry(STORAGE_KEYS.empathy, next);
    setSubmitting(false);
    if (!ok) { onSyncFail && onSyncFail(); return; }
    sSet(STORAGE_KEYS.draft, null, { shared: false });
    setStep("done");
  };

  if (step === "done") {
    // Return to step 2 (quadrant) for the same persona — most participants
    // stay with one persona and add several stickies across quadrants.
    return <PostedScreen
      onAnother={() => { setStep("compose"); setQuadrant(null); setText(""); }}
      onSwitchPerson={() => { setStep("persona"); setPersonaId(null); setQuadrant(null); setText(""); }}
      personaName={persona ? persona.name : null}
    />;
  }

  if (step === "persona") {
    return (
      <div>
        <StepHeader n={1} total={2} title="Pick a person" subtitle="選擇一位" />
        <button
          onClick={() => setShowSample(true)}
          className="mt-3 w-full bg-[#0d6e6e]/8 border border-[#0d6e6e]/20 rounded-xl px-3 py-2.5 flex items-center justify-between font-ui text-xs text-[#0d6e6e] hover:bg-[#0d6e6e]/12 transition-colors">
          <span className="flex items-center gap-2">
            <Eye size={14} />
            See an example empathy map first · 先看一個範例
          </span>
          <ChevronRight size={14} />
        </button>
        <div className="grid grid-cols-1 gap-2.5 mt-4">
          {personas.map(p => (
            <button key={p.id}
              onClick={() => { setPersonaId(p.id); setStep("compose"); }}
              className="bg-white border border-[#e8dfd0] rounded-2xl p-4 text-left active:scale-[0.99] transition-transform flex gap-3 items-start"
              style={{ minHeight: 76 }}>
              <div className="text-3xl leading-none flex-shrink-0 mt-0.5">{p.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-serif-display text-base font-medium">{p.name}</span>
                  {p.nameZh && <span className="font-ui text-sm text-[#7a6a5a]">{p.nameZh}</span>}
                </div>
                <div className="font-ui text-xs text-[#7a6a5a] mt-0.5">{p.tag}</div>
                <CampusBadge campus={p.campus} className="mt-1.5" />
              </div>
              <ChevronRight size={16} className="text-[#9a8a7a] mt-1 flex-shrink-0" />
            </button>
          ))}
        </div>
        {showSample && <SampleOverlay onClose={() => setShowSample(false)} />}
      </div>
    );
  }

  // step === "compose" — pick a quadrant + write a sticky in one screen
  const selectedQ = quadrant ? QUADRANTS.find(x => x.id === quadrant) : null;
  const existingForSelected = quadrant
    ? stickies.filter(s => s.personaId === personaId && s.quadrant === quadrant)
    : [];
  return (
    <div>
      <BackButton onClick={() => { setStep("persona"); setQuadrant(null); setText(""); }} />
      <div className="bg-white border border-[#e8dfd0] rounded-2xl p-3 flex gap-3 items-center mt-2">
        <div className="text-2xl">{persona.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-serif-display text-base font-medium">
            {persona.name}
            {persona.nameZh && <span className="font-ui text-sm text-[#7a6a5a] ml-1">{persona.nameZh}</span>}
          </div>
          <div className="font-ui text-xs text-[#7a6a5a] line-clamp-2">{persona.description}</div>
        </div>
      </div>
      <StepHeader n={2} total={2} title="Add an observation" subtitle="新增觀察" className="mt-5" />
      <p className="font-ui text-xs text-[#7a6a5a] mt-1 mb-3">Tap a quadrant, then write a sticky · 點選一格再寫</p>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {QUADRANTS.map((q) => {
          const isActive = q.id === quadrant;
          const count = stickies.filter(s => s.personaId === personaId && s.quadrant === q.id).length;
          return (
            <button key={q.id}
              onClick={() => setQuadrant(q.id)}
              className={`relative rounded-2xl p-3 text-left active:scale-[0.99] transition-all border ${
                isActive
                  ? "bg-[#0d6e6e] border-[#0d6e6e] text-white shadow-md"
                  : "bg-white border-[#e8dfd0] text-[#2a251f]"
              }`}
              style={{ minHeight: 92 }}>
              <div className="font-serif-display text-base font-medium">{q.en}</div>
              <div className={`font-ui text-xs mt-0.5 ${isActive ? "text-white/85" : "text-[#7a6a5a]"}`}>{q.zh}</div>
              <div className={`font-ui text-[11px] mt-1.5 leading-snug ${isActive ? "text-white/75" : "text-[#9a8a7a]"}`}>{q.hint}</div>
              {count > 0 && (
                <div className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 font-ui text-[10px] font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-[#0d6e6e]/10 text-[#0d6e6e]"
                }`}>
                  {count}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {existingForSelected.length > 0 && (
        <div className="mt-4">
          <div className="font-ui text-[10px] uppercase tracking-widest text-[#0d6e6e] font-semibold mb-1.5">
            Already posted in {selectedQ.en} · 已提交 ({existingForSelected.length})
          </div>
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-0.5">
            {existingForSelected.map(s => (
              <div key={s.id} className="rounded-xl px-3 py-2 font-ui text-xs leading-snug"
                style={{ background: STICKY_PALETTE[s.color % STICKY_PALETTE.length].bg, color: STICKY_PALETTE[s.color % STICKY_PALETTE.length].ink }}>
                {s.text}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <StickyInput
          value={text}
          onChange={setText}
          disabled={submitting || !quadrant}
          placeholder={selectedQ ? `What might ${persona.name} ${selectedQ.en.toLowerCase()}?` : "Pick a quadrant above first · 先選一格"} />
      </div>
      <BigSubmit onClick={submit} disabled={!quadrant || !text.trim() || submitting} loading={submitting} />
    </div>
  );
}

/* — Single-prompt boards (parking/reflections/commitments) — */
function SimpleFlow({ boardId, storageKey, promptEn, longEn, longZh }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [practiceSuggestions, setPracticeSuggestions] = useState([]);

  useEffect(() => {
    (async () => {
      const d = await sGet(STORAGE_KEYS.draft);
      if (d && d.board === boardId && d.text) setText(d.text);
    })();
  }, [boardId]);

  // For Commitments, surface existing practice proposals as tappable suggestions.
  useEffect(() => {
    if (boardId !== "commitments") return;
    let cancelled = false;
    const load = async () => {
      const arr = await sGet(STORAGE_KEYS.practices);
      if (!cancelled && Array.isArray(arr)) setPracticeSuggestions(arr);
    };
    load();
    const t = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [boardId]);

  useEffect(() => { sSet(STORAGE_KEYS.draft, { board: boardId, text }, { shared: false }); }, [boardId, text]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const sticky = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.trim(), color: pickColor(), timestamp: Date.now() };
    const cur = (await sGet(storageKey)) || [];
    const next = [...(Array.isArray(cur) ? cur : []), sticky];
    await sSetWithRetry(storageKey, next);
    sSet(STORAGE_KEYS.draft, null, { shared: false });
    setSubmitting(false); setDone(true);
  };

  if (done) return <PostedScreen onAnother={() => { setText(""); setDone(false); }} />;
  return (
    <div>
      <p className="font-ui text-base text-[#5a4a3a] leading-relaxed mb-3">{promptEn}</p>
      {longEn && (
        <details className="bg-[#0d6e6e]/6 border border-[#0d6e6e]/15 rounded-xl px-3 py-2 mb-4 group">
          <summary className="font-ui text-xs text-[#0d6e6e] font-medium cursor-pointer flex items-center justify-between list-none">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={12} />
              Why a parking lot? · 為什麼要暫存？
            </span>
            <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 font-ui text-[11px] text-[#5a4a3a] leading-relaxed space-y-2">
            <p>{longEn}</p>
            {longZh && <p className="text-[#7a6a5a]">{longZh}</p>}
          </div>
        </details>
      )}
      <StickyInput value={text} onChange={setText} disabled={submitting} placeholder="Type your sticky note…" />
      {boardId === "commitments" && practiceSuggestions.length > 0 && (
        <div className="mt-4">
          <div className="font-ui text-[10px] uppercase tracking-widest text-[#0d6e6e] font-semibold mb-1.5">From the practice proposals · 從實踐提案</div>
          <div className="font-ui text-[11px] text-[#7a6a5a] mb-2">Tap to drop into your commitment.</div>
          <div className="flex flex-col gap-1.5">
            {practiceSuggestions.slice(-12).reverse().map(s => {
              const colMeta = PRACTICE_COLS.find(c => c.id === s.column);
              return (
                <button key={s.id}
                  onClick={() => setText(s.text)}
                  className="text-left bg-white border border-[#e8dfd0] rounded-xl px-3 py-2 active:scale-[0.99] transition-transform">
                  <div className="font-ui text-[10px] uppercase tracking-wider text-[#b8862e] font-semibold">{colMeta ? colMeta.en : "Practice"}</div>
                  <div className="font-ui text-xs text-[#3a2c1c] mt-0.5 leading-snug">{s.text}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <BigSubmit onClick={submit} disabled={!text.trim() || submitting} loading={submitting} />
    </div>
  );
}

/* — Practices: column → text — */
function PracticesFlow() {
  const [col, setCol] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await sGet(STORAGE_KEYS.draft);
      if (d && d.board === "practices" && d.text) { setText(d.text); setCol(d.column || null); }
    })();
  }, []);
  useEffect(() => { sSet(STORAGE_KEYS.draft, { board: "practices", column: col, text }, { shared: false }); }, [col, text]);

  if (done) return <PostedScreen onAnother={() => { setCol(null); setText(""); setDone(false); }} />;
  if (!col) {
    return (
      <div>
        <StepHeader n={1} total={2} title="Pick a column" subtitle="選擇一欄" />
        <div className="grid gap-2.5 mt-4">
          {PRACTICE_COLS.map(c => (
            <button key={c.id} onClick={() => setCol(c.id)}
              className="bg-white border border-[#e8dfd0] rounded-2xl p-4 text-left active:scale-[0.99] transition-transform"
              style={{ minHeight: 72 }}>
              <div className="flex items-baseline gap-2">
                <span className="font-serif-display text-base font-medium">{c.en}</span>
                <span className="font-ui text-sm text-[#7a6a5a]">{c.zh}</span>
              </div>
              <div className="font-ui text-xs text-[#7a6a5a] mt-1">{c.prompt}</div>
              <div className="font-ui text-[11px] text-[#9a8a7a] italic mt-1">{c.example}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const colMeta = PRACTICE_COLS.find(c => c.id === col);
  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const sticky = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, column: col, text: text.trim(), color: pickColor(), timestamp: Date.now() };
    const cur = (await sGet(STORAGE_KEYS.practices)) || [];
    const next = [...(Array.isArray(cur) ? cur : []), sticky];
    await sSetWithRetry(STORAGE_KEYS.practices, next);
    sSet(STORAGE_KEYS.draft, null, { shared: false });
    setSubmitting(false); setDone(true);
  };

  return (
    <div>
      <BackButton onClick={() => setCol(null)} />
      <div className="bg-white border border-[#e8dfd0] rounded-2xl p-3 mt-2">
        <div className="font-serif-display text-base font-medium">{colMeta.en} · <span className="font-ui text-sm text-[#7a6a5a]">{colMeta.zh}</span></div>
        <div className="font-ui text-xs text-[#0d6e6e] mt-0.5">{colMeta.prompt}</div>
      </div>
      <StepHeader n={2} total={2} title="Your proposal" subtitle="你的提案" className="mt-5" />
      <StickyInput value={text} onChange={setText} disabled={submitting} placeholder={colMeta.example.replace(/^e\.g\. /, "")} />
      <BigSubmit onClick={submit} disabled={!text.trim() || submitting} loading={submitting} />
    </div>
  );
}

/* — Parking lot overlay (always available from any board) — */
function ParkingOverlay({ onClose }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const sticky = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.trim(), color: pickColor(), timestamp: Date.now() };
    const cur = (await sGet(STORAGE_KEYS.parking)) || [];
    await sSetWithRetry(STORAGE_KEYS.parking, [...(Array.isArray(cur) ? cur : []), sticky]);
    setSubmitting(false); setDone(true);
  };
  return (
    <div className="fixed inset-0 z-40 bg-[#2a251f]/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-[#faf6f0] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-[#b8862e]" />
            <div className="font-serif-display text-lg font-medium">Parking Lot</div>
            <div className="font-ui text-sm text-[#7a6a5a]">暫存區</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-[#e8dfd0] flex items-center justify-center"><X size={18} /></button>
        </div>
        {done ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#0d6e6e]/10 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 size={22} className="text-[#0d6e6e]" />
            </div>
            <div className="font-serif-display text-lg font-medium">Parked!</div>
            <div className="font-ui text-sm text-[#7a6a5a] mt-1">已暫存 · We won't lose it.</div>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-full bg-[#0d6e6e] text-white text-sm font-ui font-medium">Back to the workshop</button>
          </div>
        ) : (
          <>
            <p className="font-ui text-sm text-[#7a6a5a] mb-3">Capture an operational concern, building need, or program idea — anything we shouldn't lose.</p>
            <StickyInput value={text} onChange={setText} disabled={submitting} placeholder="e.g. North Campus needs more classroom space" />
            <BigSubmit onClick={submit} disabled={!text.trim() || submitting} loading={submitting} label="Park it" />
          </>
        )}
      </div>
    </div>
  );
}

/* — small participant primitives — */
function StepHeader({ n, total, title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <div className="font-ui text-[11px] uppercase tracking-widest text-[#9a8a7a]">Step {n} of {total}</div>
      <div className="font-serif-display text-xl font-medium leading-tight mt-0.5">{title}</div>
      {subtitle && <div className="font-ui text-sm text-[#7a6a5a]">{subtitle}</div>}
    </div>
  );
}
function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="font-ui text-sm text-[#0d6e6e] flex items-center gap-1 -ml-1 mb-1">
      <ChevronLeft size={16} /> Back · 返回
    </button>
  );
}
function StickyInput({ value, onChange, disabled, placeholder }) {
  const max = 200;
  return (
    <div className="relative">
      <textarea
        value={value} onChange={e => onChange(e.target.value.slice(0, max))} disabled={disabled}
        rows={5} placeholder={placeholder}
        className="w-full rounded-2xl border border-[#e8dfd0] bg-[#fff8e7] p-4 font-ui text-base resize-none outline-none focus:border-[#0d6e6e] focus:ring-2 focus:ring-[#0d6e6e]/15 transition-all"
        style={{ minHeight: 140, lineHeight: 1.5 }}
      />
      <div className="absolute bottom-3 right-3 font-ui text-[11px] text-[#9a8a7a] tabular-nums">{value.length}/{max}</div>
    </div>
  );
}
function BigSubmit({ onClick, disabled, loading, label = "Post sticky · 送出" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="mt-4 w-full bg-[#0d6e6e] text-white rounded-2xl py-4 font-ui text-base font-medium flex items-center justify-center gap-2 disabled:bg-[#9a8a7a] disabled:opacity-60 active:scale-[0.99] transition-transform"
      style={{ minHeight: 56 }}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
      {loading ? "Posting…" : label}
    </button>
  );
}
function PostedScreen({ onAnother, onSwitchPerson, personaName }) {
  return (
    <div className="py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-[#0d6e6e]/10 mx-auto flex items-center justify-center mb-4">
        <CheckCircle2 size={28} className="text-[#0d6e6e]" />
      </div>
      <div className="font-serif-display text-2xl font-medium">Posted!</div>
      <div className="font-ui text-base text-[#7a6a5a] mt-1">已提交 · It will appear on the screen in a moment.</div>
      <div className="mt-6 flex flex-col gap-2 items-center">
        <button onClick={onAnother}
          className="px-6 py-3 rounded-full bg-[#0d6e6e] text-white font-ui text-sm font-medium inline-flex items-center gap-2 active:scale-[0.99] transition-transform">
          <Plus size={16} />
          {personaName
            ? <>Add another for {personaName} · 再寫一張</>
            : <>Add another · 再寫一張</>
          }
        </button>
        {onSwitchPerson && (
          <button onClick={onSwitchPerson}
            className="px-4 py-2 rounded-full font-ui text-xs text-[#7a6a5a] hover:text-[#0d6e6e]">
            Switch to a different person · 換一位
          </button>
        )}
      </div>
    </div>
  );
}

function SampleOverlay({ onClose }) {
  const byQ = QUADRANTS.map(q => ({ q, items: SAMPLE_STICKIES.filter(s => s.quadrant === q.id) }));
  return (
    <div className="fixed inset-0 z-50 bg-[#3a2c1c]/60 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-[#faf6f0] w-full rounded-t-3xl max-h-[90vh] overflow-y-auto"
        style={{ animation: "slideUp 240ms cubic-bezier(0.16,1,0.3,1)" }}>
        <div className="sticky top-0 bg-[#faf6f0] px-5 pt-4 pb-3 border-b border-[#e8dfd0] flex items-center justify-between">
          <div>
            <div className="font-ui text-[10px] uppercase tracking-widest text-[#0d6e6e]">Example · 範例</div>
            <div className="font-serif-display text-lg font-medium leading-tight">What good notes look like</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border border-[#e8dfd0] flex items-center justify-center">
            <X size={16} className="text-[#5a4a3a]" />
          </button>
        </div>
        <div className="px-5 pt-4 pb-6">
          <div className="bg-white border border-[#e8dfd0] rounded-2xl p-3 flex gap-3 items-center">
            <div className="text-2xl">{SAMPLE_PERSONA.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-serif-display text-base font-medium">{SAMPLE_PERSONA.name}
                <span className="font-ui text-sm text-[#7a6a5a] ml-1">{SAMPLE_PERSONA.nameZh}</span>
              </div>
              <div className="font-ui text-xs text-[#7a6a5a] mt-0.5 leading-relaxed">{SAMPLE_PERSONA.description}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {byQ.map(({ q, items }) => (
              <div key={q.id} className="bg-white/60 border border-[#e8dfd0] rounded-xl p-2.5">
                <div className="font-ui text-[10px] uppercase tracking-widest text-[#0d6e6e] font-semibold">{q.en}</div>
                <div className="font-ui text-[10px] text-[#7a6a5a]">{q.zh}</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {items.map((s, i) => (
                    <div key={i} className="rounded-md p-2 font-ui text-[11px] leading-snug"
                      style={{ background: STICKY_PALETTE[s.color % STICKY_PALETTE.length].bg, color: STICKY_PALETTE[s.color % STICKY_PALETTE.length].ink }}>
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 bg-[#0d6e6e]/8 border border-[#0d6e6e]/20 rounded-xl px-3 py-2.5 font-ui text-[11px] text-[#0d6e6e] leading-relaxed">
            <strong>Tip · 小提示:</strong> Specifics &gt; generalities. One concrete sentence beats a paragraph of summary. Write what you imagine — there are no wrong answers.
          </div>
          <button onClick={onClose}
            className="mt-5 w-full bg-[#0d6e6e] text-white rounded-2xl py-3 font-ui text-sm font-medium active:scale-[0.99] transition-transform">
            Got it · 開始
          </button>
        </div>
      </div>
    </div>
  );
}

function CampusBadge({ campus, className = "" }) {
  const c = CAMPUS_LABEL[campus];
  if (campus === "both") {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-ui font-medium tracking-wide uppercase rounded-full px-2 py-0.5 ${className}`}
        style={{ background: "linear-gradient(90deg, #0d6e6e22, #b8862e22)", color: "#5a4a3a" }}>
        Both · 兩堂
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-ui font-medium tracking-wide uppercase rounded-full px-2 py-0.5 ${className}`}
      style={{ background: `${c.color}1a`, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
      {c.en} · {c.zh}
    </span>
  );
}
function SyncDot({ status }) {
  const map = {
    synced:   { c: "#0d6e6e", icon: Wifi,    label: "Live" },
    retrying: { c: "#b8862e", icon: RefreshCw, label: "Retrying" },
    offline:  { c: "#b91c1c", icon: WifiOff, label: "Offline" },
  };
  const m = map[status] || map.synced;
  const Icon = m.icon;
  return (
    <div className="flex items-center gap-1.5 font-ui text-[11px]" style={{ color: m.c }}>
      <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: m.c }} />
      <Icon size={11} /> {m.label}
    </div>
  );
}
function CenteredLoader({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="text-[#0d6e6e] animate-spin" size={28} />
      <div className="font-ui text-sm text-[#7a6a5a] mt-3">{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FACILITATOR VIEW (desktop / projected)
   ───────────────────────────────────────────────────────────── */
function FacilitatorApp({ onExit }) {
  const [active, setActive] = useState("empathy");
  const [personas, setPersonas] = useState(DEFAULT_PERSONAS);
  const [empathy, setEmpathy] = useState([]);
  const [parking, setParking] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [practices, setPractices] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [empathyMode, setEmpathyMode] = useState("grid"); // grid | focus
  const [focusPersona, setFocusPersona] = useState(null);
  const [revealMode, setRevealMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState({}); // {boardId: Set<id>}

  // Initial + polled load
  const refreshAll = useCallback(async () => {
    try {
      const [a, ps, e, pk, rf, pr, cm] = await Promise.all([
        sGet(STORAGE_KEYS.active), sGet(STORAGE_KEYS.personas),
        sGet(STORAGE_KEYS.empathy), sGet(STORAGE_KEYS.parking),
        sGet(STORAGE_KEYS.reflections), sGet(STORAGE_KEYS.practices),
        sGet(STORAGE_KEYS.commitments),
      ]);
      if (a && a !== active) setActive(a);
      if (Array.isArray(ps) && ps.length) setPersonas(ps);
      if (Array.isArray(e))  setEmpathy(e);
      if (Array.isArray(pk)) setParking(pk);
      if (Array.isArray(rf)) setReflections(rf);
      if (Array.isArray(pr)) setPractices(pr);
      if (Array.isArray(cm)) setCommitments(cm);
      setSyncStatus("synced");
      setLoading(false);
    } catch { setSyncStatus("retrying"); }
  }, [active]);

  usePoll(refreshAll, []);

  const setActiveBoard = async (id) => {
    setActive(id);
    await sSetWithRetry(STORAGE_KEYS.active, id);
  };

  if (loading) return <CenteredLoader label="Loading workshop…" />;

  const counts = {
    empathy: empathy.length, parking: parking.length, reflections: reflections.length,
    practices: practices.length, commitments: commitments.length,
  };
  const board = BOARDS.find(b => b.id === active);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf6f0]">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e8dfd0] flex items-center px-5 h-16">
        <button onClick={onExit} className="font-ui text-xs text-[#7a6a5a] hover:text-[#0d6e6e] flex items-center gap-1 mr-5">
          <ChevronLeft size={14} /> Exit
        </button>
        <div className="font-serif-display text-lg font-medium mr-5">ACC Empathy Workshop</div>
        <nav className="flex items-center gap-1">
          {BOARDS.map(b => {
            const Icon = b.icon;
            const on = b.id === active;
            return (
              <button key={b.id} onClick={() => setActiveBoard(b.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-ui font-medium transition-colors ${on ? "bg-[#0d6e6e] text-white" : "text-[#5a4a3a] hover:bg-[#f0e9dc]"}`}>
                <Icon size={14} /> {b.en}
                <span className={`tabular-nums text-[11px] ml-0.5 px-1.5 py-0.5 rounded-full ${on ? "bg-white/20 text-white" : "bg-[#e8dfd0] text-[#7a6a5a]"}`}>{counts[b.id]}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <AgendaTimer />
          <button onClick={() => setShowPrompt(true)} className="px-3 py-1.5 rounded-lg text-sm font-ui text-[#5a4a3a] hover:bg-[#f0e9dc] flex items-center gap-1.5" title="Show prompt big">
            <Maximize2 size={14} /> Prompt
          </button>
          <button onClick={() => setShowQR(true)} className="px-3 py-1.5 rounded-lg text-sm font-ui text-[#5a4a3a] hover:bg-[#f0e9dc] flex items-center gap-1.5">
            <QrCode size={14} /> QR
          </button>
          <button onClick={refreshAll} className="w-9 h-9 rounded-lg hover:bg-[#f0e9dc] flex items-center justify-center" title="Refresh">
            <RefreshCw size={14} className="text-[#5a4a3a]" />
          </button>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-lg hover:bg-[#f0e9dc] flex items-center justify-center" title="Settings">
            <Settings size={14} className="text-[#5a4a3a]" />
          </button>
          <SyncDot status={syncStatus} />
        </div>
      </header>

      {/* BOARD AREA */}
      <main className="flex-1 overflow-auto">
        {active === "empathy" && (
          <EmpathyBoard personas={personas} stickies={empathy}
            mode={empathyMode} setMode={setEmpathyMode}
            focusPersona={focusPersona} setFocusPersona={setFocusPersona}
            revealMode={revealMode} setRevealMode={setRevealMode}
            revealedIds={revealedIds.empathy} onReveal={(id) => setRevealedIds(p => ({ ...p, empathy: { ...(p.empathy || {}), [id]: true } }))} />
        )}
        {active === "parking"     && <SimpleBoard stickies={parking}     accent="#b8862e" promptEn={board.prompt} />}
        {active === "reflections" && <SimpleBoard stickies={reflections} accent="#0d6e6e" promptEn={board.prompt} />}
        {active === "practices"   && <PracticesBoard stickies={practices} />}
        {active === "commitments" && <SimpleBoard stickies={commitments} accent="#5a4a8a" promptEn={board.prompt} />}
      </main>

      {showQR       && <QRPanel onClose={() => setShowQR(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)}
                          personas={personas} setPersonas={async (n) => { setPersonas(n); await sSetWithRetry(STORAGE_KEYS.personas, n); }}
                          empathy={empathy} setEmpathy={async (n) => { setEmpathy(n); await sSetWithRetry(STORAGE_KEYS.empathy, n); }}
                          parking={parking} setParking={async (n) => { setParking(n); await sSetWithRetry(STORAGE_KEYS.parking, n); }}
                          reflections={reflections} setReflections={async (n) => { setReflections(n); await sSetWithRetry(STORAGE_KEYS.reflections, n); }}
                          practices={practices} setPractices={async (n) => { setPractices(n); await sSetWithRetry(STORAGE_KEYS.practices, n); }}
                          commitments={commitments} setCommitments={async (n) => { setCommitments(n); await sSetWithRetry(STORAGE_KEYS.commitments, n); }}
                          revealMode={revealMode} setRevealMode={setRevealMode}
                          empathyMode={empathyMode} setEmpathyMode={setEmpathyMode} />}
      {showPrompt   && <BigPrompt board={board} onClose={() => setShowPrompt(false)} />}
    </div>
  );
}

/* — Empathy board (grid + focus) — */
function EmpathyBoard({ personas, stickies, mode, setMode, focusPersona, setFocusPersona, revealMode, setRevealMode, revealedIds = {}, onReveal }) {
  const idx = focusPersona ? personas.findIndex(p => p.id === focusPersona) : -1;
  const persona = idx >= 0 ? personas[idx] : null;

  // Counts per persona (visibility)
  const perPersonaCount = personas.reduce((acc, p) => { acc[p.id] = stickies.filter(s => s.personaId === p.id).length; return acc; }, {});

  return (
    <div className="p-6">
      {/* mode + reveal controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("grid")}
            className={`px-3 py-1.5 rounded-lg text-sm font-ui font-medium ${mode === "grid" ? "bg-[#0d6e6e] text-white" : "bg-white border border-[#e8dfd0] text-[#5a4a3a]"}`}>Gallery (8)</button>
          <button onClick={() => { setMode("focus"); if (!focusPersona) setFocusPersona(personas[0]?.id); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-ui font-medium ${mode === "focus" ? "bg-[#0d6e6e] text-white" : "bg-white border border-[#e8dfd0] text-[#5a4a3a]"}`}>Focus (1)</button>
        </div>
        <label className="flex items-center gap-2 text-xs font-ui text-[#5a4a3a] bg-white border border-[#e8dfd0] rounded-lg px-3 py-1.5 cursor-pointer">
          <input type="checkbox" checked={revealMode} onChange={e => setRevealMode(e.target.checked)} className="accent-[#0d6e6e]" />
          Reveal one at a time
        </label>
      </div>

      {mode === "grid" ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {personas.map(p => (
            <PersonaMiniCard key={p.id} persona={p} stickies={stickies.filter(s => s.personaId === p.id)}
              count={perPersonaCount[p.id]} onClick={() => { setFocusPersona(p.id); setMode("focus"); }} />
          ))}
        </div>
      ) : persona ? (
        <PersonaFocusCard persona={persona} stickies={stickies.filter(s => s.personaId === persona.id)}
          onPrev={() => setFocusPersona(personas[(idx - 1 + personas.length) % personas.length].id)}
          onNext={() => setFocusPersona(personas[(idx + 1) % personas.length].id)}
          allPersonas={personas} setFocusPersona={setFocusPersona}
          revealMode={revealMode} revealedIds={revealedIds} onReveal={onReveal}
          counts={perPersonaCount} />
      ) : null}
    </div>
  );
}

function PersonaMiniCard({ persona, stickies, count, onClick }) {
  const c = CAMPUS_LABEL[persona.campus];
  return (
    <button onClick={onClick} className="bg-white border border-[#e8dfd0] rounded-2xl p-4 text-left hover:shadow-lg transition-shadow group">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">{persona.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-serif-display text-base font-medium">{persona.name}</div>
          {persona.nameZh && <div className="font-ui text-xs text-[#7a6a5a]">{persona.nameZh}</div>}
          <div className="mt-1.5"><CampusBadge campus={persona.campus} /></div>
        </div>
        <div className="tabular-nums text-xs font-ui font-medium px-2 py-0.5 rounded-full bg-[#f0e9dc] text-[#5a4a3a]">{count}</div>
      </div>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {QUADRANTS.map((q, i) => (
          <div key={q.id} className={`bg-[#faf6f0] rounded-md p-1.5 text-[10px] font-ui font-medium text-[#7a6a5a] flex items-center justify-between ${i === 4 ? "col-span-2" : ""}`}>
            <span>{q.en}</span>
            <span className="tabular-nums text-[#0d6e6e]">{stickies.filter(s => s.quadrant === q.id).length}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function PersonaFocusCard({ persona, stickies, onPrev, onNext, allPersonas, setFocusPersona, revealMode, revealedIds, onReveal, counts }) {
  return (
    <div>
      {/* header */}
      <div className="bg-white border border-[#e8dfd0] rounded-2xl p-5 flex items-center gap-4">
        <button onClick={onPrev} className="w-10 h-10 rounded-full hover:bg-[#f0e9dc] flex items-center justify-center"><ChevronLeft /></button>
        <div className="text-5xl">{persona.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-serif-display text-2xl font-medium">{persona.name}</span>
            {persona.nameZh && <span className="font-ui text-lg text-[#7a6a5a]">{persona.nameZh}</span>}
            <CampusBadge campus={persona.campus} />
          </div>
          <div className="font-ui text-sm text-[#7a6a5a] mt-1">{persona.description}</div>
        </div>
        <button onClick={onNext} className="w-10 h-10 rounded-full hover:bg-[#f0e9dc] flex items-center justify-center"><ChevronRight /></button>
      </div>

      {/* 4-quadrant map */}
      <div className="mt-5 grid grid-cols-2 gap-4" style={{ minHeight: 540 }}>
        {QUADRANTS.map(q => (
          <QuadrantCell key={q.id} quadrant={q}
            stickies={stickies.filter(s => s.quadrant === q.id)}
            revealMode={revealMode} revealedIds={revealedIds} onReveal={onReveal} />
        ))}
      </div>

      {/* persona thumbnails */}
      <div className="mt-5 flex items-center gap-1.5 flex-wrap">
        {allPersonas.map(p => (
          <button key={p.id} onClick={() => setFocusPersona(p.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-ui ${p.id === persona.id ? "bg-[#0d6e6e] text-white" : "bg-white border border-[#e8dfd0] text-[#5a4a3a] hover:border-[#0d6e6e]"}`}>
            <span>{p.emoji}</span>
            <span>{p.name.replace("The ", "")}</span>
            <span className={`tabular-nums text-[10px] ${p.id === persona.id ? "text-white/70" : "text-[#9a8a7a]"}`}>{counts[p.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuadrantCell({ quadrant, stickies, tall = false, revealMode, revealedIds, onReveal }) {
  const visible = revealMode ? stickies.filter(s => revealedIds[s.id]) : stickies;
  const hidden = stickies.length - visible.length;
  return (
    <div className="bg-white border border-[#e8dfd0] rounded-2xl p-4 flex flex-col" style={{ minHeight: tall ? 540 : 240 }}>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-serif-display text-base font-medium">{quadrant.en}</span>
        <span className="font-ui text-sm text-[#7a6a5a]">{quadrant.zh}</span>
        <span className="ml-auto tabular-nums text-xs font-ui text-[#9a8a7a]">{stickies.length}</span>
      </div>
      <div className="flex-1 flex flex-wrap gap-2 content-start">
        {visible.map(s => <Sticky key={s.id} sticky={s} small />)}
        {hidden > 0 && (
          <button onClick={() => stickies.filter(s => !revealedIds[s.id]).forEach(s => onReveal(s.id))}
            className="rounded-lg bg-[#0d6e6e]/10 hover:bg-[#0d6e6e]/20 text-[#0d6e6e] font-ui text-xs font-medium px-3 py-2 flex items-center gap-1.5 self-start">
            <Eye size={12} /> Reveal {hidden}
          </button>
        )}
        {stickies.length === 0 && <div className="font-ui text-xs text-[#bbada0] italic">No notes yet…</div>}
      </div>
    </div>
  );
}

/* — single-board grid (parking, reflections, commitments) — */
function SimpleBoard({ stickies, accent, promptEn }) {
  return (
    <div className="p-6">
      <div className="bg-white border border-[#e8dfd0] rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
        <div className="w-1 h-10 rounded-full" style={{ background: accent }} />
        <div>
          <div className="font-serif-display text-lg font-medium leading-tight">{promptEn}</div>
          <div className="font-ui text-xs text-[#7a6a5a] mt-0.5">Live submissions appear below · 即時更新</div>
        </div>
        <div className="ml-auto tabular-nums font-ui text-2xl font-medium" style={{ color: accent }}>{stickies.length}</div>
      </div>
      {stickies.length === 0 ? (
        <EmptyHint />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {stickies.slice().sort((a,b) => b.timestamp - a.timestamp).map(s => <Sticky key={s.id} sticky={s} />)}
        </div>
      )}
    </div>
  );
}

function PracticesBoard({ stickies }) {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {PRACTICE_COLS.map(c => {
        const items = stickies.filter(s => s.column === c.id).slice().sort((a,b) => b.timestamp - a.timestamp);
        return (
          <div key={c.id} className="bg-white border border-[#e8dfd0] rounded-2xl p-4 flex flex-col" style={{ minHeight: 480 }}>
            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <span className="font-serif-display text-lg font-medium">{c.en}</span>
                <span className="font-ui text-sm text-[#7a6a5a]">{c.zh}</span>
                <span className="ml-auto tabular-nums text-xs font-ui text-[#9a8a7a]">{items.length}</span>
              </div>
              <div className="font-ui text-xs text-[#7a6a5a] mt-0.5">{c.prompt}</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-2 content-start">
              {items.map(s => <Sticky key={s.id} sticky={s} small />)}
              {items.length === 0 && <div className="font-ui text-xs text-[#bbada0] italic">No notes yet…</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="border-2 border-dashed border-[#e8dfd0] rounded-2xl py-20 text-center">
      <div className="font-serif-display text-xl text-[#9a8a7a]">Waiting for the first sticky…</div>
      <div className="font-ui text-sm text-[#bbada0] mt-2">Submissions appear here in real time.</div>
    </div>
  );
}

function Sticky({ sticky, small = false }) {
  const c = STICKY_PALETTE[((sticky.color ?? 0) % STICKY_PALETTE.length + STICKY_PALETTE.length) % STICKY_PALETTE.length];
  const rot = ((parseInt(sticky.id?.slice(-2) || "0", 36) || 0) % 7) - 3; // -3..3 deg, deterministic
  return (
    <div className="sticky-in font-ui leading-snug shadow-sm hover:shadow-md transition-shadow"
      style={{
        background: c.bg, color: c.ink,
        padding: small ? "10px 12px" : "14px 16px",
        fontSize: small ? 12 : 14,
        borderRadius: 4,
        transform: `rotate(${rot * 0.3}deg)`,
        width: small ? "auto" : 200,
        minWidth: small ? 110 : 180,
        maxWidth: small ? 200 : 240,
        boxShadow: `0 1px 0 ${c.edge}, 0 2px 6px rgba(0,0,0,0.06), 0 8px 16px -8px rgba(0,0,0,0.08)`,
      }}>
      {sticky.text}
    </div>
  );
}

/* — agenda timer — */
function AgendaTimer() {
  const [durationMin, setDurationMin] = useState(120); // default 2 hr
  const [startedAt, setStartedAt] = useState(null);
  const [paused, setPaused] = useState(true);
  const [pausedTotal, setPausedTotal] = useState(0);
  const [pausedAt, setPausedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await sGet(STORAGE_KEYS.agenda);
      if (a) {
        setStartedAt(a.startedAt || null);
        setPaused(a.paused == null ? true : !!a.paused);
        setPausedTotal(a.pausedTotal || 0);
        setPausedAt(a.pausedAt || null);
        if (a.durationMin) setDurationMin(a.durationMin);
      }
    })();
  }, []);
  useEffect(() => {
    sSet(STORAGE_KEYS.agenda, { startedAt, paused, pausedTotal, pausedAt, durationMin }, { shared: true });
  }, [startedAt, paused, pausedTotal, pausedAt, durationMin]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const elapsed = startedAt
    ? Math.max(0, (paused ? (pausedAt || now) : now) - startedAt - pausedTotal)
    : 0;
  const totalMs = durationMin * 60000;
  const remaining = Math.max(0, totalMs - elapsed);
  const overtime = elapsed > totalMs;
  const displayMs = overtime ? (elapsed - totalMs) : remaining;
  const min = Math.floor(displayMs / 60000);
  const sec = Math.floor((displayMs % 60000) / 1000);

  const elapsedMin = elapsed / 60000;
  const phase = (() => {
    if (!startedAt) return { en: "Not started", color: "#9a8a7a" };
    const frac = elapsedMin / durationMin;
    if (frac < 0.21)  return { en: "Empathy Maps",  color: "#0d6e6e" };
    if (frac < 0.71)  return { en: "Empathy Maps",  color: "#0d6e6e" };
    if (frac < 0.78)  return { en: "Gallery walk",  color: "#0d6e6e" };
    if (frac < 0.83)  return { en: "Reflections",   color: "#b8862e" };
    if (frac < 0.96)  return { en: "Practices",     color: "#5a4a8a" };
    return { en: "Commitments", color: "#0d6e6e" };
  })();
  const tone = overtime ? "#b94a4a" : phase.color;

  const start = () => { setStartedAt(Date.now()); setPaused(false); setPausedTotal(0); setPausedAt(null); };
  const toggle = () => {
    if (!startedAt) return start();
    if (paused) {
      setPausedTotal(t => t + (Date.now() - (pausedAt || Date.now())));
      setPausedAt(null); setPaused(false);
    } else {
      setPausedAt(Date.now()); setPaused(true);
    }
  };
  const reset = () => { setStartedAt(null); setPaused(true); setPausedTotal(0); setPausedAt(null); };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#faf6f0] border border-[#e8dfd0] hover:border-[#0d6e6e] transition-colors"
        title="Workshop timer">
        <Clock size={14} style={{ color: tone }} />
        <span className="font-ui text-xs tabular-nums font-medium" style={{ color: overtime ? "#b94a4a" : "#2a251f" }}>
          {overtime ? "+" : ""}{String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 bg-white border border-[#e8dfd0] rounded-2xl shadow-lg p-4 w-72" onClick={e => e.stopPropagation()}>
          <div className="font-serif-display text-base font-medium leading-tight">Workshop Timer</div>
          <div className="font-ui text-[11px] text-[#7a6a5a] mb-3">計時器 · counts down</div>

          <div className="font-ui text-[10px] uppercase tracking-widest text-[#7a6a5a] font-semibold mb-1.5">Duration</div>
          <div className="flex items-center gap-1.5 mb-3">
            {[60, 90, 120, 150].map(d => (
              <button key={d}
                onClick={() => setDurationMin(d)}
                className={`flex-1 py-1.5 rounded-lg font-ui text-xs font-medium border ${durationMin === d ? "bg-[#0d6e6e] text-white border-[#0d6e6e]" : "bg-[#faf6f0] text-[#5a4a3a] border-[#e8dfd0]"}`}>
                {d / 60 % 1 === 0 ? `${d / 60}h` : `${d}m`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setDurationMin(d => Math.max(5, d - 5))} className="w-8 h-8 rounded-lg bg-[#faf6f0] border border-[#e8dfd0] font-ui text-sm">−</button>
            <input type="number" min="5" max="300" value={durationMin}
              onChange={e => setDurationMin(Math.max(5, Math.min(300, parseInt(e.target.value, 10) || 5)))}
              className="flex-1 text-center font-ui text-sm font-medium tabular-nums px-2 py-1.5 bg-[#faf6f0] border border-[#e8dfd0] rounded-lg" />
            <button onClick={() => setDurationMin(d => Math.min(300, d + 5))} className="w-8 h-8 rounded-lg bg-[#faf6f0] border border-[#e8dfd0] font-ui text-sm">+</button>
            <span className="font-ui text-xs text-[#7a6a5a]">min</span>
          </div>

          <div className="bg-[#faf6f0] border border-[#e8dfd0] rounded-xl px-3 py-2.5 text-center mb-3">
            <div className="font-ui text-[10px] uppercase tracking-widest font-semibold" style={{ color: tone }}>
              {overtime ? "Overtime · 超時" : (startedAt ? "Time remaining · 剩餘時間" : "Ready · 準備中")}
            </div>
            <div className="font-serif-display text-3xl font-medium tabular-nums mt-0.5" style={{ color: tone }}>
              {overtime ? "+" : ""}{String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </div>
            {startedAt && <div className="font-ui text-[10px] text-[#7a6a5a] mt-0.5">Phase: {phase.en}</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={toggle}
              className="flex-1 py-2 rounded-lg bg-[#0d6e6e] text-white font-ui text-xs font-medium">
              {!startedAt ? "Start" : (paused ? "Resume" : "Pause")}
            </button>
            {startedAt && (
              <button onClick={reset}
                className="px-3 py-2 rounded-lg bg-[#faf6f0] border border-[#e8dfd0] font-ui text-xs text-[#5a4a3a]">
                Reset
              </button>
            )}
            <button onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg bg-[#faf6f0] border border-[#e8dfd0] font-ui text-xs text-[#5a4a3a]">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* — QR panel — */
function QRPanel({ onClose }) {
  const ref = useRef(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    let u = "";
    if (typeof window !== "undefined") {
      try {
        const link = new URL(window.location.href);
        link.searchParams.set("role", "participant");
        u = link.toString();
      } catch {
        u = window.location?.href || "";
      }
    }
    setUrl(u);
    // qrcode-generator UMD attaches `qrcode` to window. Load it once.
    const renderInto = (el) => {
      if (!el || !window.qrcode) return;
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(u || "https://example.com");
        qr.make();
        el.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
        const svg = el.querySelector("svg");
        if (svg) { svg.setAttribute("width", "260"); svg.setAttribute("height", "260"); svg.style.display = "block"; }
      } catch (e) { el.innerHTML = '<div class="text-sm text-red-700">QR error</div>'; }
    };
    if (window.qrcode) { renderInto(ref.current); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    s.onload = () => renderInto(ref.current);
    s.onerror = () => { if (ref.current) ref.current.innerHTML = '<div class="text-sm text-red-700">Could not load QR library.</div>'; };
    document.head.appendChild(s);
  }, []);
  return (
    <div className="fixed inset-0 z-40 bg-[#2a251f]/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#faf6f0] rounded-3xl p-10 max-w-md w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="font-serif-display text-3xl font-medium leading-tight mb-1">Scan to join</div>
        <div className="font-ui text-base text-[#7a6a5a] mb-6">用手機掃描加入</div>
        <div ref={ref} className="bg-white inline-block p-5 rounded-2xl border border-[#e8dfd0]" style={{ minWidth: 280, minHeight: 280 }} />
        <div className="font-ui text-xs text-[#9a8a7a] break-all mt-5 px-4 leading-relaxed">{url}</div>
        <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-full bg-[#0d6e6e] text-white font-ui text-sm font-medium">Close</button>
      </div>
    </div>
  );
}

/* — Big-text prompt mode (for projector intro) — */
function BigPrompt({ board, onClose }) {
  const Icon = board.icon;
  return (
    <div className="fixed inset-0 z-40 bg-[#2a251f] text-[#faf6f0] flex flex-col items-center justify-center p-12" onClick={onClose}>
      <div className="text-center max-w-5xl">
        <Icon size={48} className="mx-auto mb-6 text-[#fef3c7]" />
        <div className="font-ui text-sm uppercase tracking-[0.3em] text-[#fef3c7]/70 mb-3">Now · 現在</div>
        <h1 className="font-serif-display text-7xl font-medium leading-[1.05] mb-4">{board.en}</h1>
        <div className="font-ui text-3xl text-[#fef3c7]/80 mb-10">{board.zh}</div>
        <p className="font-serif-display text-3xl italic leading-snug text-[#faf6f0]/90 max-w-3xl mx-auto">"{board.prompt}"</p>
      </div>
      <button onClick={onClose} className="mt-12 px-6 py-2.5 rounded-full bg-white/10 text-white font-ui text-sm font-medium hover:bg-white/20">
        <X size={14} className="inline mr-1.5" /> Close · Esc
      </button>
    </div>
  );
}

/* — Settings — */
function SettingsPanel({ onClose, personas, setPersonas, empathy, setEmpathy, parking, setParking, reflections, setReflections, practices, setPractices, commitments, setCommitments }) {
  const [tab, setTab] = useState("personas"); // personas | move | export | clear
  const [editing, setEditing] = useState(null);
  const [confirmText, setConfirmText] = useState("");

  const allBoards = {
    empathy: { items: empathy, set: setEmpathy, label: "Empathy" },
    parking: { items: parking, set: setParking, label: "Parking Lot" },
    reflections: { items: reflections, set: setReflections, label: "Reflections" },
    practices: { items: practices, set: setPractices, label: "Practices" },
    commitments: { items: commitments, set: setCommitments, label: "Commitments" },
  };

  const moveSticky = async (fromKey, toKey, sticky) => {
    if (fromKey === toKey) return;
    await allBoards[fromKey].set(allBoards[fromKey].items.filter(s => s.id !== sticky.id));
    // strip type-specific fields when moving
    const cleaned = { id: sticky.id, text: sticky.text, color: sticky.color, timestamp: sticky.timestamp };
    if (toKey === "empathy")   cleaned.personaId = sticky.personaId; cleaned.quadrant = sticky.quadrant || "thinks";
    if (toKey === "practices") cleaned.column = sticky.column || "rhythms";
    await allBoards[toKey].set([...allBoards[toKey].items, cleaned]);
  };

  const clearAll = async () => {
    await setEmpathy([]); await setParking([]); await setReflections([]); await setPractices([]); await setCommitments([]);
    setConfirmText(""); setTab("personas");
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#2a251f]/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#faf6f0] rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e8dfd0] px-6 py-4">
          <div className="font-serif-display text-xl font-medium">Settings</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#e8dfd0] flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="flex border-b border-[#e8dfd0]">
          {[
            { id: "personas", label: "Personas" },
            { id: "move",     label: "Move stickies" },
            { id: "export",   label: "Print / Export" },
            { id: "clear",    label: "Clear data" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-[#0d6e6e] text-[#0d6e6e]" : "border-transparent text-[#7a6a5a]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tab === "personas" && (
            <div>
              {editing ? (
                <PersonaEditor persona={editing} onCancel={() => setEditing(null)} onSave={async (p) => {
                  const next = personas.map(x => x.id === p.id ? p : x);
                  await setPersonas(next); setEditing(null);
                }} />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {personas.map(p => (
                    <button key={p.id} onClick={() => setEditing(p)}
                      className="bg-white border border-[#e8dfd0] rounded-xl p-3 text-left hover:border-[#0d6e6e] flex gap-3 items-start">
                      <div className="text-2xl">{p.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif-display text-sm font-medium">{p.name} {p.nameZh && <span className="font-ui text-xs text-[#7a6a5a]">{p.nameZh}</span>}</div>
                        <div className="font-ui text-[11px] text-[#7a6a5a] line-clamp-2">{p.description}</div>
                        <CampusBadge campus={p.campus} className="mt-1.5" />
                      </div>
                      <Edit3 size={14} className="text-[#9a8a7a] mt-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "move" && (
            <div>
              <p className="font-ui text-sm text-[#7a6a5a] mb-4">Reclassify stickies between boards. Useful when an empathy note is really an operational concern.</p>
              {Object.entries(allBoards).map(([key, b]) => (
                <div key={key} className="mb-6">
                  <div className="font-serif-display text-base font-medium mb-2">{b.label} <span className="font-ui text-xs text-[#9a8a7a]">({b.items.length})</span></div>
                  <div className="grid gap-2">
                    {b.items.length === 0 && <div className="text-xs italic text-[#9a8a7a]">No stickies.</div>}
                    {b.items.map(s => (
                      <div key={s.id} className="bg-white border border-[#e8dfd0] rounded-lg p-2.5 flex items-center gap-2">
                        <div className="flex-1 text-sm font-ui line-clamp-2">{s.text}</div>
                        <select value={key} onChange={e => moveSticky(key, e.target.value, s)}
                          className="text-xs font-ui bg-[#faf6f0] border border-[#e8dfd0] rounded-md px-2 py-1">
                          {Object.entries(allBoards).map(([k, bb]) => <option key={k} value={k}>{bb.label}</option>)}
                        </select>
                        <button onClick={async () => await b.set(b.items.filter(x => x.id !== s.id))}
                          className="w-7 h-7 rounded-md hover:bg-red-50 text-red-600 flex items-center justify-center" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "export" && (
            <ExportPanel personas={personas} empathy={empathy} parking={parking} reflections={reflections} practices={practices} commitments={commitments} />
          )}

          {tab === "clear" && (
            <div className="max-w-md">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-serif-display text-base font-medium text-red-900">This will permanently delete all stickies.</div>
                    <div className="font-ui text-sm text-red-800 mt-1">Personas are kept. Empathy, Parking, Reflections, Practices, and Commitments will be cleared.</div>
                  </div>
                </div>
              </div>
              <label className="font-ui text-sm text-[#5a4a3a]">Type <span className="font-mono font-bold">CLEAR</span> to confirm:</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CLEAR"
                className="mt-2 w-full rounded-lg border border-[#e8dfd0] bg-white px-3 py-2 font-mono text-sm outline-none focus:border-[#0d6e6e]" />
              <button onClick={clearAll} disabled={confirmText !== "CLEAR"}
                className="mt-3 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-ui font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                Clear all data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonaEditor({ persona, onCancel, onSave }) {
  const [p, setP] = useState({ ...persona });
  return (
    <div className="max-w-lg">
      <button onClick={onCancel} className="font-ui text-xs text-[#7a6a5a] mb-3 inline-flex items-center gap-1"><ChevronLeft size={12} /> Back to all personas</button>
      <div className="grid gap-3">
        <Field label="Name (English)"><input className="input" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Name (Chinese)"><input className="input" value={p.nameZh || ""} onChange={e => setP({ ...p, nameZh: e.target.value })} /></Field>
        <Field label="Campus">
          <select className="input" value={p.campus} onChange={e => setP({ ...p, campus: e.target.value })}>
            <option value="main">Main · 主堂</option>
            <option value="north">North · 北堂</option>
            <option value="both">Both · 兩堂</option>
          </select>
        </Field>
        <Field label="Tag (short)"><input className="input" value={p.tag || ""} onChange={e => setP({ ...p, tag: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={4} className="input" value={p.description || ""} onChange={e => setP({ ...p, description: e.target.value })} /></Field>
        <Field label="Emoji"><input className="input w-24" value={p.emoji || ""} onChange={e => setP({ ...p, emoji: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onSave(p)} className="px-4 py-2 rounded-lg bg-[#0d6e6e] text-white text-sm font-ui font-medium">Save</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white border border-[#e8dfd0] text-sm font-ui">Cancel</button>
      </div>
      <style>{`.input{width:100%;border:1px solid #e8dfd0;background:#fff;border-radius:8px;padding:.5rem .75rem;font-size:14px;font-family:inherit;outline:none}.input:focus{border-color:#0d6e6e}`}</style>
    </div>
  );
}
function Field({ label, children }) {
  return <label className="block"><div className="font-ui text-xs text-[#7a6a5a] mb-1">{label}</div>{children}</label>;
}

/* — Print/export — */
function ExportPanel({ personas, empathy, parking, reflections, practices, commitments }) {
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow popups to print/export."); return; }
    const stickies = (arr) => arr.map(s => `<div class="s">${escapeHtml(s.text)}</div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ACC Empathy Workshop</title>
      <style>
        @page { size: letter; margin: 0.6in; }
        body { font-family: 'Fraunces', Georgia, serif; color: #2a251f; }
        h1 { font-size: 32pt; margin: 0 0 4pt; font-weight: 500; }
        h2 { font-size: 20pt; margin: 0 0 8pt; font-weight: 500; }
        h3 { font-size: 14pt; margin: 12pt 0 4pt; font-weight: 600; color: #0d6e6e; font-family: Inter, sans-serif; }
        .sub { color: #7a6a5a; font-size: 11pt; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin-top: 12pt; }
        .col { border: 1px solid #e8dfd0; border-radius: 8pt; padding: 12pt; min-height: 130pt; }
        .col.tall { grid-column: 1 / -1; }
        .s { background: #fef3c7; padding: 8pt 10pt; margin: 4pt 0; font-family: Inter, sans-serif; font-size: 10pt; border-radius: 3pt; page-break-inside: avoid; }
        .footer { position: fixed; bottom: 0.4in; left: 0.6in; right: 0.6in; font-family: Inter, sans-serif; font-size: 9pt; color: #9a8a7a; border-top: 1px solid #e8dfd0; padding-top: 6pt; display: flex; justify-content: space-between; }
        .page { page-break-after: always; min-height: 9.5in; position: relative; padding-bottom: 0.5in; }
        .cover { text-align: center; padding-top: 2in; }
        .meta { font-family: Inter, sans-serif; font-size: 11pt; color: #5a4a3a; margin-bottom: 6pt; }
        .stickies { display: flex; flex-wrap: wrap; gap: 8pt; margin-top: 12pt; }
        .stickies .s { width: calc(50% - 8pt); }
        .stickies.three .s { width: calc(33% - 8pt); }
      </style></head><body>
      <div class="page cover">
        <div class="meta">Arlington Chinese Church · 阿靈頓華人教會</div>
        <h1>Empathy Workshop</h1>
        <div class="sub" style="font-size:14pt; margin-top:6pt;">同理心地圖工作坊</div>
        <div class="meta" style="margin-top:24pt;">Leadership Retreat · ${new Date().toLocaleDateString()}</div>
      </div>
      ${personas.map(p => {
        const ps = empathy.filter(s => s.personaId === p.id);
        return `<div class="page">
          <h2>${escapeHtml(p.name)} ${p.nameZh ? `<span class="sub">${escapeHtml(p.nameZh)}</span>` : ""}</h2>
          <div class="sub">${escapeHtml(p.tag || "")} · ${CAMPUS_LABEL[p.campus]?.en || ""}</div>
          <div class="sub" style="margin-top:6pt; font-style:italic;">${escapeHtml(p.description || "")}</div>
          <div class="grid">
            ${QUADRANTS.map(q => `
              <div class="col">
                <h3>${q.en} · ${q.zh}</h3>
                ${stickies(ps.filter(s => s.quadrant === q.id))}
              </div>`).join("")}
          </div>
          <div class="footer"><span>ACC Leadership Retreat — Empathy Workshop</span><span>${escapeHtml(p.name)}</span></div>
        </div>`;
      }).join("")}
      <div class="page"><h2>Parking Lot · 暫存區</h2><div class="sub">${parking.length} note(s)</div><div class="stickies">${stickies(parking)}</div><div class="footer"><span>ACC Leadership Retreat — Empathy Workshop</span><span>Parking Lot</span></div></div>
      <div class="page"><h2>Reflections · 反思</h2><div class="sub">${reflections.length} note(s)</div><div class="stickies">${stickies(reflections)}</div><div class="footer"><span>ACC Leadership Retreat — Empathy Workshop</span><span>Reflections</span></div></div>
      <div class="page"><h2>Practice Proposals · 實踐提案</h2>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12pt; margin-top:12pt;">
          ${PRACTICE_COLS.map(c => `<div class="col"><h3>${c.en} · ${c.zh}</h3>${stickies(practices.filter(s => s.column === c.id))}</div>`).join("")}
        </div><div class="footer"><span>ACC Leadership Retreat — Empathy Workshop</span><span>Practices</span></div></div>
      <div class="page"><h2>Commitments · 個人承諾</h2><div class="sub">${commitments.length} note(s)</div><div class="stickies">${stickies(commitments)}</div><div class="footer"><span>ACC Leadership Retreat — Empathy Workshop</span><span>Commitments</span></div></div>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
  };

  return (
    <div>
      <p className="font-ui text-sm text-[#7a6a5a] mb-4 max-w-prose">
        Generates a printable document (use your browser's "Save as PDF") with a cover page, one page per persona empathy map, and one page each for Parking Lot, Reflections, Practices, and Commitments.
      </p>
      <button onClick={print} className="px-5 py-2.5 rounded-lg bg-[#0d6e6e] text-white text-sm font-ui font-medium inline-flex items-center gap-2">
        <Printer size={14} /> Open print view
      </button>
    </div>
  );
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
