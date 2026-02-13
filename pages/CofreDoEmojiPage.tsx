import React, { useEffect, useMemo, useState } from 'react';

type EmojiEntry = {
  char: string;
  label: string;
  mood: 'focus' | 'hype' | 'calm' | 'play' | 'chaos';
};

type EmojiGroup = {
  id: string;
  title: string;
  description: string;
  entries: EmojiEntry[];
};

const FAVORITES_KEY = 'emoji_vault_favorites';

const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'signals',
    title: 'Signal Room',
    description: 'Emojis for status, alerts, and momentum.',
    entries: [
      { char: '🚀', label: 'launch', mood: 'hype' },
      { char: '📡', label: 'scan', mood: 'focus' },
      { char: '⚡', label: 'burst', mood: 'chaos' },
      { char: '🧭', label: 'heading', mood: 'focus' },
      { char: '🛰️', label: 'orbit', mood: 'calm' }
    ]
  },
  {
    id: 'kitchen',
    title: 'Kitchen Tokens',
    description: 'Emojis for recipe and flavor storytelling.',
    entries: [
      { char: '🍳', label: 'sear', mood: 'focus' },
      { char: '🧂', label: 'season', mood: 'calm' },
      { char: '🔥', label: 'heat', mood: 'hype' },
      { char: '🍋', label: 'acid', mood: 'play' },
      { char: '🍫', label: 'cocoa', mood: 'calm' }
    ]
  },
  {
    id: 'social',
    title: 'Social Vault',
    description: 'Emojis for reactions and chat rhythm.',
    entries: [
      { char: '🫶', label: 'support', mood: 'calm' },
      { char: '🤝', label: 'deal', mood: 'focus' },
      { char: '🎉', label: 'party', mood: 'hype' },
      { char: '😎', label: 'cool', mood: 'play' },
      { char: '🤖', label: 'bot', mood: 'chaos' }
    ]
  }
];

const MOOD_OPTIONS: Array<EmojiEntry['mood'] | 'all'> = ['all', 'focus', 'hype', 'calm', 'play', 'chaos'];

const CofreDoEmojiPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<EmojiEntry['mood'] | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [combo, setCombo] = useState('🚀📡⚡');
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavorites(parsed.filter(item => typeof item === 'string'));
      }
    } catch {
      // Ignore malformed local data.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage failures.
    }
  }, [favorites]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => setCopyFeedback(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const flatEntries = useMemo(() => {
    return EMOJI_GROUPS.flatMap(group =>
      group.entries.map(entry => ({ ...entry, group: group.title }))
    );
  }, []);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return flatEntries.filter(item => {
      const matchesMood = mood === 'all' || item.mood === mood;
      const matchesQuery = !needle || item.label.includes(needle) || item.group.toLowerCase().includes(needle);
      return matchesMood && matchesQuery;
    });
  }, [flatEntries, mood, query]);

  const stats = useMemo(() => {
    const total = flatEntries.length;
    const byMood = MOOD_OPTIONS.filter(item => item !== 'all').map(item => ({
      mood: item,
      count: flatEntries.filter(entry => entry.mood === item).length
    }));
    return { total, byMood };
  }, [flatEntries]);

  const toggleFavorite = (char: string) => {
    setFavorites(prev => (prev.includes(char) ? prev.filter(item => item !== char) : [...prev, char]));
  };

  const createRandomCombo = () => {
    const pool = filteredEntries.length > 0 ? filteredEntries : flatEntries;
    const picks: string[] = [];
    while (picks.length < 3 && picks.length < pool.length) {
      const next = pool[Math.floor(Math.random() * pool.length)];
      if (!next || picks.includes(next.char)) continue;
      picks.push(next.char);
    }
    setCombo(picks.join(''));
  };

  const copyCombo = async () => {
    try {
      await navigator.clipboard.writeText(combo);
      setCopyFeedback('Combo copied');
    } catch {
      setCopyFeedback('Clipboard unavailable');
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#f4fbff] text-[#12303d]">
      <style>{`
        .aurora-bg {
          background:
            radial-gradient(circle at 15% 20%, rgba(3, 169, 244, 0.22), transparent 45%),
            radial-gradient(circle at 85% 10%, rgba(16, 185, 129, 0.22), transparent 48%),
            radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.18), transparent 44%);
        }
      `}</style>

      <div className="aurora-bg min-h-full">
        <main className="max-w-6xl mx-auto px-5 py-8 md:py-12 space-y-7">
          <section className="rounded-3xl bg-white/80 backdrop-blur border border-cyan-200 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-700/80">Emoji Intelligence</p>
            <h1 className="text-3xl md:text-5xl font-black mt-2 text-cyan-900">Cofre do Emoji</h1>
            <p className="max-w-3xl mt-3 text-cyan-900/80">
              Full hidden page with live filtering, vault sections, favorites, mood analytics, and combo generator.
            </p>
          </section>

          <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
            <article className="rounded-3xl border border-cyan-200 bg-white p-5 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search by tag or room"
                  className="flex-1 rounded-xl border border-cyan-200 px-4 py-3 outline-none focus:border-cyan-500"
                />
                <select
                  value={mood}
                  onChange={event => setMood(event.target.value as EmojiEntry['mood'] | 'all')}
                  className="rounded-xl border border-cyan-200 px-4 py-3 bg-white outline-none focus:border-cyan-500"
                >
                  {MOOD_OPTIONS.map(item => (
                    <option key={item} value={item}>
                      Mood: {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredEntries.map(item => {
                  const isFav = favorites.includes(item.char);
                  return (
                    <div key={`${item.group}-${item.char}`} className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3">
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">{item.char}</span>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item.char)}
                          className={`text-xs px-2 py-1 rounded-full border ${
                            isFav
                              ? 'bg-amber-100 border-amber-300 text-amber-700'
                              : 'bg-white border-cyan-200 text-cyan-700'
                          }`}
                        >
                          {isFav ? 'saved' : 'save'}
                        </button>
                      </div>
                      <p className="font-semibold mt-2">{item.label}</p>
                      <p className="text-xs text-cyan-900/70">{item.group}</p>
                      <p className="text-xs mt-1 text-cyan-700 uppercase">{item.mood}</p>
                    </div>
                  );
                })}
              </div>
            </article>

            <div className="space-y-5">
              <article className="rounded-3xl border border-cyan-200 bg-white p-5 md:p-6 space-y-4">
                <h2 className="text-xl font-semibold">Vault Combo Lab</h2>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-xs text-cyan-700 uppercase tracking-wide">Current combo</p>
                  <p className="text-4xl mt-2">{combo}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createRandomCombo}
                    className="flex-1 rounded-xl bg-cyan-600 text-white px-4 py-2.5 hover:bg-cyan-500 transition"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={copyCombo}
                    className="rounded-xl border border-cyan-300 px-4 py-2.5 hover:bg-cyan-50 transition"
                  >
                    Copy
                  </button>
                </div>
                {copyFeedback && <p className="text-sm text-cyan-700">{copyFeedback}</p>}
              </article>

              <article className="rounded-3xl border border-cyan-200 bg-white p-5 md:p-6 space-y-3">
                <h2 className="text-xl font-semibold">Favorites</h2>
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 min-h-20">
                  {favorites.length > 0 ? (
                    <p className="text-3xl leading-relaxed">{favorites.join(' ')}</p>
                  ) : (
                    <p className="text-sm text-cyan-800/70">No favorites yet. Save from cards.</p>
                  )}
                </div>
              </article>

              <article className="rounded-3xl border border-cyan-200 bg-white p-5 md:p-6 space-y-3">
                <h2 className="text-xl font-semibold">Mood Analytics</h2>
                <p className="text-sm text-cyan-900/80">Total entries: {stats.total}</p>
                <div className="space-y-2">
                  {stats.byMood.map(row => (
                    <div key={row.mood}>
                      <div className="flex justify-between text-xs text-cyan-800">
                        <span>{row.mood}</span>
                        <span>{row.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-cyan-100 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500"
                          style={{ width: `${(row.count / stats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default CofreDoEmojiPage;
