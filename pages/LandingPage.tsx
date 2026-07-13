import React from 'react';
import { useI18n } from '../i18n';
import { APP_VERSION } from '../config/version';

type LandingLocale = 'pt-BR' | 'en';

const copy = {
  'pt-BR': {
    nav: { capabilities: 'Recursos', experience: 'Experiência', privacy: 'Privacidade', open: 'Abrir LiveGo' },
    eyebrow: 'CONVERSAS COM IA, SEM ATRITO',
    titleStart: 'Uma IA que conversa',
    titleAccent: 'no seu ritmo.',
    hero: 'Fale naturalmente, compartilhe contexto e use ferramentas inteligentes em uma experiência de voz feita para acompanhar você.',
    start: 'Começar agora',
    github: 'Ver no GitHub',
    availability: 'Acesso instantâneo quando o serviço estiver disponível. Se necessário, conecte sua própria chave Gemini.',
    live: 'AO VIVO',
    listening: 'Ouvindo você',
    active: 'Gemini Live conectado',
    transcript: 'Posso pesquisar, entender seu contexto e responder por voz em tempo real.',
    featureEyebrow: 'MAIS DO QUE UM CHAT',
    featureTitle: 'Uma conversa que consegue agir.',
    featureBody: 'O LiveGo reúne voz, memória local e ferramentas em uma interface simples, sem transformar a conversa em um painel complicado.',
    features: [
      ['Voz em tempo real', 'Converse de forma contínua, interrompa naturalmente e acompanhe a resposta enquanto ela acontece.'],
      ['Contexto visual', 'Compartilhe sua tela quando quiser mostrar o que está vendo e receber ajuda mais precisa.'],
      ['Ferramentas úteis', 'Pesquisas, leitura de páginas e recursos visuais podem entrar na conversa quando forem necessários.'],
      ['Seu jeito de conversar', 'Escolha voz, idioma, instruções e quais skills ficam ativas em cada experiência.'],
    ],
    flowEyebrow: 'SIMPLES DESDE O PRIMEIRO TOQUE',
    flowTitle: 'Abra. Fale. Continue.',
    steps: [
      ['01', 'Entre no LiveGo', 'Abra o app no navegador, sem instalação obrigatória.'],
      ['02', 'Dê acesso ao microfone', 'A permissão é usada para iniciar a conversa ao vivo.'],
      ['03', 'Converse naturalmente', 'Use voz, contexto e ferramentas sem mudar de fluxo.'],
    ],
    privacyEyebrow: 'PRIVACIDADE VISÍVEL',
    privacyTitle: 'Sua chave não precisa morar no navegador.',
    privacyBody: 'Quando o LiveGo oferece acesso pelo próprio serviço, o navegador recebe apenas uma credencial temporária. Se esse acesso não estiver disponível, você pode usar sua chave Gemini, mantida somente durante a sessão da aba.',
    privacyPoints: ['Token temporário e de uso único', 'Chave pessoal limitada à sessão da aba', 'Conexão direta com o Gemini Live'],
    finalTitle: 'Pronto para uma conversa mais natural?',
    finalBody: 'Abra o LiveGo e transforme sua voz na interface.',
    footer: 'Conversas por voz em tempo real, com contexto e ferramentas.',
    language: 'Idioma',
  },
  en: {
    nav: { capabilities: 'Features', experience: 'Experience', privacy: 'Privacy', open: 'Open LiveGo' },
    eyebrow: 'FRICTIONLESS AI CONVERSATIONS',
    titleStart: 'An AI that speaks',
    titleAccent: 'at your pace.',
    hero: 'Speak naturally, share context, and use intelligent tools in a voice experience designed to keep up with you.',
    start: 'Get started',
    github: 'View on GitHub',
    availability: 'Instant access when the service is available. If needed, connect your own Gemini API key.',
    live: 'LIVE',
    listening: 'Listening to you',
    active: 'Gemini Live connected',
    transcript: 'I can search, understand your context, and answer by voice in real time.',
    featureEyebrow: 'MORE THAN A CHAT',
    featureTitle: 'A conversation that can take action.',
    featureBody: 'LiveGo brings voice, local memory, and tools together in a focused interface without turning the conversation into a complicated dashboard.',
    features: [
      ['Real-time voice', 'Have a continuous conversation, interrupt naturally, and follow the answer as it happens.'],
      ['Visual context', 'Share your screen whenever you need to show what you see and get more precise help.'],
      ['Useful tools', 'Search, page reading, and visual resources can join the conversation when needed.'],
      ['Your way to talk', 'Choose the voice, language, instructions, and skills enabled for each experience.'],
    ],
    flowEyebrow: 'SIMPLE FROM THE FIRST TAP',
    flowTitle: 'Open. Speak. Keep going.',
    steps: [
      ['01', 'Open LiveGo', 'Use the app in your browser, with no mandatory installation.'],
      ['02', 'Allow microphone access', 'The permission is used to start your live conversation.'],
      ['03', 'Talk naturally', 'Use voice, context, and tools without breaking your flow.'],
    ],
    privacyEyebrow: 'VISIBLE PRIVACY',
    privacyTitle: 'Your key does not have to live in the browser.',
    privacyBody: 'When LiveGo provides service access, the browser receives only a temporary credential. If that access is unavailable, you can use your Gemini key, kept only for the lifetime of the browser tab.',
    privacyPoints: ['Short-lived, single-use token', 'Personal key scoped to the current tab', 'Direct connection to Gemini Live'],
    finalTitle: 'Ready for a more natural conversation?',
    finalBody: 'Open LiveGo and turn your voice into the interface.',
    footer: 'Real-time voice conversations with context and tools.',
    language: 'Language',
  },
} as const;

const featureIcons = [
  <path key="voice" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3m-4 0h8" />,
  <path key="screen" d="M4 5h16a2 2 0 0 1 2 2v10H2V7a2 2 0 0 1 2-2Zm4 16h8m-4-4v4" />,
  <path key="spark" d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Zm6 10 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z" />,
  <path key="controls" d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6" />,
];

const ArrowIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

const BrandMark = () => (
  <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-500/25">
    <span className="h-4 w-4 rounded-full border-[5px] border-white" />
  </span>
);

const ProductPreview = ({ text }: { text: (typeof copy)[LandingLocale] }) => (
  <div className="relative mx-auto w-full max-w-[430px]" aria-label="LiveGo application preview">
    <div className="absolute -inset-12 rounded-full bg-indigo-500/20 blur-3xl" />
    <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#090a0f] p-3 shadow-2xl shadow-indigo-950/70">
      <div className="relative min-h-[570px] overflow-hidden rounded-[26px] border border-white/5 bg-[#0b0c12] p-6 sm:min-h-[620px] sm:p-8">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,.8)]" />
            {text.live}
          </div>
          <span className="font-mono text-xs text-zinc-500">00:24</span>
          <span className="h-8 w-8 rounded-full border border-white/10 bg-white/5" />
        </div>

        <div className="relative mt-20 text-center">
          <p className="text-2xl font-semibold tracking-tight text-white">{text.listening}</p>
          <p className="mt-2 text-sm text-zinc-500">{text.active}</p>
          <div className="mx-auto mt-12 flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] shadow-[0_0_70px_rgba(79,70,229,.3)]">
            <div className="flex h-20 w-20 items-center justify-center gap-1 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 shadow-xl shadow-indigo-500/30">
              {[14, 27, 42, 31, 18].map((height, index) => (
                <span
                  key={height}
                  className="landing-wave-bar w-1 rounded-full bg-white"
                  style={{ height, animationDelay: `${index * 90}ms` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-16 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center text-sm leading-6 text-zinc-300 backdrop-blur-xl">
          {text.transcript}
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-4">
          <span className="h-11 w-11 rounded-full border border-white/10 bg-white/5" />
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/25">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 10 2 2 6-6 2 2-6 6 2 2-4 4-5-5 3-5Z" /></svg>
          </span>
          <span className="h-11 w-11 rounded-full border border-white/10 bg-white/5" />
        </div>
      </div>
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  const { locale, setLocale } = useI18n();
  const landingLocale: LandingLocale = locale === 'pt-BR' ? 'pt-BR' : 'en';
  const text = copy[landingLocale];

  React.useEffect(() => {
    const isPortuguese = landingLocale === 'pt-BR';
    document.title = isPortuguese
      ? 'LIVEGO — Converse com IA em tempo real'
      : 'LIVEGO — Real-time voice AI conversations';
    const description = isPortuguese
      ? 'Converse por voz com uma IA em tempo real. Contexto, ferramentas e uma experiência natural com Gemini Live.'
      : 'Talk to AI by voice in real time. Context, tools, and a natural experience powered by Gemini Live.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index,follow,max-image-preview:large');
  }, [landingLocale]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07080d] text-white selection:bg-indigo-500/40">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#07080d]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-3" aria-label="LiveGo home">
            <BrandMark />
            <span className="text-lg font-bold tracking-tight">LIVEGO</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex" aria-label="Primary navigation">
            <a className="transition hover:text-white" href="#features">{text.nav.capabilities}</a>
            <a className="transition hover:text-white" href="#experience">{text.nav.experience}</a>
            <a className="transition hover:text-white" href="#privacy">{text.nav.privacy}</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1" aria-label={text.language}>
              {(['pt-BR', 'en'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => setLocale(language)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${landingLocale === language ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  aria-pressed={landingLocale === language}
                >
                  {language === 'pt-BR' ? 'PT' : 'EN'}
                </button>
              ))}
            </div>
            <a href="/app" className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:flex">
              {text.nav.open}<ArrowIcon />
            </a>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-16 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-24 lg:pt-28">
        <div className="relative z-10 max-w-2xl text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{text.eyebrow}
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {text.titleStart} <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">{text.titleAccent}</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-zinc-400 lg:mx-0">{text.hero}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <a href="/app" className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3.5 text-sm font-semibold shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-indigo-500/40 sm:w-auto">
              {text.start}<ArrowIcon />
            </a>
            <a href="https://github.com/sonyddr666/livego" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] sm:w-auto">
              {text.github}
            </a>
          </div>
          <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-zinc-600 lg:mx-0">{text.availability}</p>
        </div>
        <div className="relative z-10 lg:pt-16"><ProductPreview text={text} /></div>
      </section>

      <section id="features" className="relative border-y border-white/[0.06] bg-white/[0.015] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400">{text.featureEyebrow}</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.featureTitle}</h2>
            <p className="mt-5 text-lg leading-8 text-zinc-400">{text.featureBody}</p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {text.features.map(([title, description], index) => (
              <article key={title} className="group rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-transparent p-7 transition hover:border-indigo-400/25 hover:bg-white/[0.065] sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{featureIcons[index]}</svg>
                </div>
                <h3 className="mt-8 text-xl font-semibold">{title}</h3>
                <p className="mt-3 max-w-lg leading-7 text-zinc-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="experience" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.18em] text-blue-400">{text.flowEyebrow}</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.flowTitle}</h2>
          </div>
          <div className="relative mt-16 grid gap-4 md:grid-cols-3">
            <div className="absolute left-[16.66%] right-[16.66%] top-8 hidden h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent md:block" />
            {text.steps.map(([number, title, description]) => (
              <article key={number} className="relative rounded-3xl border border-white/[0.07] bg-[#0b0c12] p-7 text-center">
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-indigo-400/25 bg-indigo-500/10 font-mono text-sm text-indigo-300">{number}</span>
                <h3 className="mt-7 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="relative border-y border-white/[0.06] bg-gradient-to-br from-indigo-950/30 via-[#090a10] to-blue-950/20 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:px-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-indigo-300">{text.privacyEyebrow}</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.privacyTitle}</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">{text.privacyBody}</p>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-black/25 p-6 backdrop-blur-xl sm:p-8">
            {text.privacyPoints.map((point, index) => (
              <div key={point} className={`flex items-center gap-4 py-4 ${index > 0 ? 'border-t border-white/[0.07]' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                <span className="text-sm font-medium text-zinc-200 sm:text-base">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-24 sm:px-8 sm:py-32">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-indigo-400/20 bg-gradient-to-br from-indigo-600/25 via-blue-600/10 to-transparent px-6 py-16 text-center shadow-glow sm:px-12 sm:py-20">
          <div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{text.finalTitle}</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">{text.finalBody}</p>
            <a href="/app" className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-zinc-200">
              {text.start}<ArrowIcon />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3"><BrandMark /><div><p className="font-semibold">LIVEGO</p><p className="mt-1 text-xs text-zinc-600">{text.footer}</p></div></div>
          <div className="flex items-center gap-5 text-xs text-zinc-600"><span>v{APP_VERSION}</span><a className="transition hover:text-white" href="https://github.com/sonyddr666/livego" target="_blank" rel="noreferrer">GitHub</a></div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
