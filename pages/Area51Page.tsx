import React, { useMemo, useState } from 'react';

type Clearance = 'PUBLIC' | 'CONFIDENTIAL' | 'TOP_SECRET';

type Dossier = {
  id: string;
  codename: string;
  clearance: Clearance;
  status: 'Monitoring' | 'Dormant' | 'Active';
  summary: string;
  risk: number;
  signals: string[];
};

const DOSSIERS: Dossier[] = [
  {
    id: 'A-17',
    codename: 'Echo Lantern',
    clearance: 'PUBLIC',
    status: 'Monitoring',
    summary: 'Atmospheric light anomalies observed over dry lake sectors.',
    risk: 36,
    signals: ['ionized dust', 'cold plasma fringe', 'triangulated drift']
  },
  {
    id: 'K-91',
    codename: 'Night Orchard',
    clearance: 'CONFIDENTIAL',
    status: 'Dormant',
    summary: 'Signal orchard map with repeating geometric pulses every 47 minutes.',
    risk: 62,
    signals: ['harmonic pulse', 'phase jitter', 'orbital sync']
  },
  {
    id: 'X-03',
    codename: 'Red Meridian',
    clearance: 'TOP_SECRET',
    status: 'Active',
    summary: 'Rapid spectrum spikes coupled with magnetic shear and low-altitude echoes.',
    risk: 88,
    signals: ['spectrum spike', 'magnetic shear', 'ground resonance']
  },
  {
    id: 'R-44',
    codename: 'Silent Atlas',
    clearance: 'CONFIDENTIAL',
    status: 'Monitoring',
    summary: 'Inactive array reawakened by unknown directional carrier.',
    risk: 55,
    signals: ['carrier lock', 'narrow beam', 'lateral jump']
  }
];

const MILESTONES = [
  { year: '1947', title: 'Dry Lake Program Established', detail: 'Initial desert telemetry and radar harmonization.' },
  { year: '1962', title: 'Subsurface Vault Expansion', detail: 'Archive corridors and command relay hardened.' },
  { year: '1989', title: 'Multiband Sensor Network', detail: 'Night capture array deployed to perimeter ring.' },
  { year: '2026', title: 'Cognitive Briefing Console', detail: 'Human-readable mission summaries and adaptive triage.' }
];

const COMMAND_HINTS = [
  'help',
  'list',
  'risk top',
  'open X-03',
  'status active'
];

const clearanceClasses: Record<Clearance, string> = {
  PUBLIC: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  CONFIDENTIAL: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  TOP_SECRET: 'border-rose-400/40 bg-rose-400/10 text-rose-200'
};

const Area51Page: React.FC = () => {
  const [clearanceFilter, setClearanceFilter] = useState<Clearance | 'ALL'>('ALL');
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleLines, setConsoleLines] = useState<string[]>([
    'Area-51 console online.',
    'Type "help" to list commands.'
  ]);

  const visibleDossiers = useMemo(() => {
    return clearanceFilter === 'ALL'
      ? DOSSIERS
      : DOSSIERS.filter(item => item.clearance === clearanceFilter);
  }, [clearanceFilter]);

  const executeCommand = () => {
    const raw = consoleInput.trim();
    if (!raw) return;

    const command = raw.toLowerCase();
    const nextLines = [...consoleLines, `> ${raw}`];

    if (command === 'help') {
      nextLines.push(`Available: ${COMMAND_HINTS.join(', ')}`);
    } else if (command === 'list') {
      nextLines.push(`Dossiers: ${DOSSIERS.map(item => item.id).join(', ')}`);
    } else if (command === 'risk top') {
      const top = [...DOSSIERS].sort((a, b) => b.risk - a.risk)[0];
      nextLines.push(top ? `${top.codename} (${top.id}) risk ${top.risk}` : 'No dossiers available.');
    } else if (command.startsWith('open ')) {
      const id = raw.slice(5).trim().toUpperCase();
      const found = DOSSIERS.find(item => item.id === id);
      nextLines.push(found ? `${found.id}: ${found.summary}` : `No dossier found for ${id}`);
    } else if (command === 'status active') {
      const activeIds = DOSSIERS.filter(item => item.status === 'Active').map(item => item.id);
      nextLines.push(activeIds.length ? `Active: ${activeIds.join(', ')}` : 'No active entries.');
    } else {
      nextLines.push('Unknown command. Use "help".');
    }

    setConsoleLines(nextLines.slice(-10));
    setConsoleInput('');
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#071018] text-[#d5e5ee]">
      <style>{`
        .scan-grid {
          background-image:
            linear-gradient(rgba(66, 153, 225, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(66, 153, 225, 0.08) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .radar-pulse {
          animation: radarPulse 3.8s ease-out infinite;
        }
        @keyframes radarPulse {
          0% { transform: scale(0.88); opacity: 0.72; }
          70% { transform: scale(1.06); opacity: 0.1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>

      <div className="relative min-h-full">
        <div className="absolute inset-0 scan-grid pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <main className="relative z-10 max-w-6xl mx-auto px-5 py-8 md:py-12 space-y-8">
          <section className="rounded-3xl border border-cyan-300/20 bg-[#0b1d2a]/80 backdrop-blur p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs tracking-[0.3em] uppercase text-cyan-200/80">Restricted Archive</p>
                <h1 className="text-3xl md:text-5xl font-black leading-tight text-cyan-100">Area-51 Mission Deck</h1>
                <p className="max-w-2xl text-cyan-50/80">
                  Tactical vault for anomaly dossiers, timeline intelligence, and command execution.
                  Built as a full briefing page for the hidden route.
                </p>
              </div>
              <div className="self-start md:self-auto">
                <div className="relative w-36 h-36 rounded-full border border-cyan-300/40 grid place-items-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-200/40 radar-pulse" />
                  <div className="w-14 h-14 rounded-full bg-cyan-300/20 border border-cyan-200/50" />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-400/20 bg-[#0d1a24]/90 p-6 md:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl md:text-2xl font-semibold text-slate-100">Dossier Matrix</h2>
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'PUBLIC', 'CONFIDENTIAL', 'TOP_SECRET'] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setClearanceFilter(level)}
                    className={`px-3 py-1.5 rounded-full border text-xs tracking-wide uppercase transition ${
                      clearanceFilter === level
                        ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                        : 'border-slate-300/30 text-slate-200 hover:bg-slate-400/10'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {visibleDossiers.map(item => (
                <article key={item.id} className="rounded-2xl border border-slate-300/20 bg-slate-950/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">#{item.id}</p>
                      <h3 className="text-lg font-semibold text-slate-100">{item.codename}</h3>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${clearanceClasses[item.clearance]}`}>
                      {item.clearance}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300">{item.summary}</p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Risk index</span>
                      <span>{item.risk}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700/40 overflow-hidden">
                      <div
                        className={`h-full ${item.risk > 75 ? 'bg-rose-400' : item.risk > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${item.risk}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.signals.map(signal => (
                      <span key={signal} className="text-[11px] rounded-full bg-slate-700/40 px-2 py-1 text-slate-200">
                        {signal}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-cyan-200/90">Status: {item.status}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid lg:grid-cols-2 gap-5">
            <article className="rounded-3xl border border-slate-300/20 bg-[#111b24] p-6 space-y-4">
              <h2 className="text-xl font-semibold text-slate-100">Program Timeline</h2>
              <div className="space-y-4">
                {MILESTONES.map(step => (
                  <div key={step.year} className="grid grid-cols-[72px_1fr] gap-3">
                    <span className="text-sm font-semibold text-cyan-300">{step.year}</span>
                    <div>
                      <p className="font-medium text-slate-100">{step.title}</p>
                      <p className="text-sm text-slate-300">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-300/20 bg-black/50 p-6 space-y-4">
              <h2 className="text-xl font-semibold text-slate-100">Command Console</h2>
              <div className="rounded-xl border border-emerald-300/20 bg-[#021207] p-3 h-56 overflow-y-auto text-sm font-mono text-emerald-200 space-y-1">
                {consoleLines.map((line, idx) => (
                  <p key={`${line}-${idx}`} className="break-words">{line}</p>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={consoleInput}
                  onChange={event => setConsoleInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') executeCommand();
                  }}
                  placeholder='Try "help"'
                  className="flex-1 rounded-xl border border-emerald-300/30 bg-[#021207] px-3 py-2 text-sm text-emerald-100 outline-none focus:border-emerald-300"
                />
                <button
                  type="button"
                  onClick={executeCommand}
                  className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition"
                >
                  Run
                </button>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Area51Page;
