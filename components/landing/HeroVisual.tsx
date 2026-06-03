"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, Zap } from "lucide-react";

const COMPETITORS = [
  { label: "competitor1.ru", score: 91, color: "#f43f5e" },
  { label: "top-site.ru",    score: 78, color: "#fb923c" },
  { label: "example.ru",     score: 64, color: "#facc15" },
  { label: "ваш сайт",       score: 42, color: "#fd356e", you: true },
];

const KEYWORDS = ["диваны москва", "купить диван", "угловой диван", "диван-кровать"];

const QUICK_WINS = ["Добавить FAQ блок", "Обновить title", "Schema.org разметка"];

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDash((score / 100) * circ), 400);
    return () => clearTimeout(t);
  }, [score, circ]);

  const color = score >= 90 ? "#4ade80" : score >= 50 ? "#facc15" : "#f43f5e";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] text-zinc-500">/100</span>
      </div>
    </div>
  );
}

function AnimatedBar({ score, color, delay }: { score: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 300 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  return (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          backgroundColor: color,
          transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
          boxShadow: `0 0 8px ${color}60`,
        }}
      />
    </div>
  );
}

export default function HeroVisual() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [kwVisible, setKwVisible] = useState<boolean[]>(KEYWORDS.map(() => false));

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Keywords fade in one by one
  useEffect(() => {
    KEYWORDS.forEach((_, i) => {
      setTimeout(() => {
        setKwVisible((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 800 + i * 250);
    });
  }, []);

  // 3D mouse tilt
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const parent = card.parentElement;
    if (!parent) return;

    function onMove(e: MouseEvent) {
      const rect = parent!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card!.style.transform = `perspective(1200px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateZ(10px)`;
    }

    function onLeave() {
      card!.style.transform = `perspective(1200px) rotateY(-6deg) rotateX(4deg) translateZ(0px)`;
    }

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center select-none" style={{ minHeight: 480 }}>
      {/* Glow behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-64 w-64 rounded-full bg-[#fd356e]/20 blur-[60px]" />
      </div>

      {/* 3D Card */}
      <div
        ref={cardRef}
        className="relative w-[320px] rounded-2xl border border-white/10 bg-[#0d1117]/90 shadow-2xl backdrop-blur-xl overflow-hidden"
        style={{
          transform: "perspective(1200px) rotateY(-6deg) rotateX(4deg)",
          transition: "transform 0.15s ease-out",
          opacity: visible ? 1 : 0,
          transitionProperty: "transform, opacity",
          transitionDuration: "0.15s, 0.6s",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Pink gradient top edge */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#fd356e]/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500 truncate">
            myshop.ru/catalog/divany
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Score + label */}
          <div className="flex items-center gap-3">
            <ScoreRing score={42} size={72} />
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">SEO Score</p>
              <p className="text-sm font-semibold text-red-400">Нужна оптимизация</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#fd356e]">
                <TrendingUp className="h-3 w-3" />
                <span>3 быстрых улучшения</span>
              </div>
            </div>
          </div>

          {/* Competitors */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Конкуренты</p>
            <div className="space-y-2">
              {COMPETITORS.map((c, i) => (
                <div key={c.label} className={`flex items-center gap-2 ${c.you ? "opacity-100" : ""}`}>
                  <span className={`text-[10px] w-24 truncate shrink-0 ${c.you ? "text-[#fd356e] font-medium" : "text-zinc-400"}`}>
                    {c.label}
                  </span>
                  <div className="flex-1">
                    <AnimatedBar score={c.score} color={c.color} delay={i * 150} />
                  </div>
                  <span className="text-[10px] tabular-nums text-zinc-500 w-6 text-right">{c.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Gap-ключи</p>
            <div className="flex flex-wrap gap-1">
              {KEYWORDS.map((kw, i) => (
                <span
                  key={kw}
                  className="rounded-full border border-[#fd356e]/20 bg-[#fd356e]/10 px-2 py-0.5 text-[10px] text-[#fd356e]"
                  style={{
                    opacity: kwVisible[i] ? 1 : 0,
                    transform: kwVisible[i] ? "translateY(0)" : "translateY(4px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Quick fixes */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3 w-3 text-[#fd356e]" />
              <p className="text-[10px] font-medium text-[#fd356e]">Что сделать сейчас</p>
            </div>
            {QUICK_WINS.map((fix, i) => (
              <div key={fix} className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#fd356e] shrink-0" />
                <p className="text-[10px] text-zinc-300">{fix}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom shimmer */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#fd356e]/5 to-transparent pointer-events-none" />
      </div>

      {/* Floating badges */}
      <div
        className="absolute -top-3 -right-4 rounded-xl border border-green-500/20 bg-[#0d1117] px-3 py-1.5 shadow-lg"
        style={{
          animation: "float-badge 3s ease-in-out infinite",
          boxShadow: "0 0 20px rgba(74,222,128,0.1)",
        }}
      >
        <p className="text-[10px] text-zinc-400">Готовый title</p>
        <p className="text-xs font-medium text-green-400">Скопировано ✓</p>
      </div>

      <div
        className="absolute -bottom-2 -left-6 rounded-xl border border-[#fd356e]/20 bg-[#0d1117] px-3 py-1.5 shadow-lg"
        style={{
          animation: "float-badge 3s ease-in-out infinite 1.5s",
          boxShadow: "0 0 20px rgba(253,53,110,0.1)",
        }}
      >
        <p className="text-[10px] text-zinc-400">Потенциал</p>
        <p className="text-xs font-medium text-[#fd356e]">+16 429 / мес</p>
      </div>

      <style>{`
        @keyframes float-badge {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
