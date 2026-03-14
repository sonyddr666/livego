import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Skill definition — each skill maps to a Gemini function declaration
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;           // emoji icon
  category: 'visual' | 'search' | 'data' | 'utility';
  enabled: boolean;
  isBuiltIn: boolean;     // built-in skills cannot be deleted
  functionName: string;   // Gemini function name
  functionDescription: string; // Description sent to Gemini
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
  }>;
}

interface SkillsState {
  skills: Skill[];
  toggleSkill: (id: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  getEnabledSkills: () => Skill[];
  addCustomSkill: (skill: Omit<Skill, 'id' | 'isBuiltIn'>) => void;
  removeCustomSkill: (id: string) => void;
}

// Built-in skills that come with the app
const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'show_image',
    name: 'Mostrar Imagem',
    description: 'A IA pode exibir imagens na tela durante a conversa para ilustrar conceitos visuais.',
    icon: '🖼️',
    category: 'visual',
    enabled: true,
    isBuiltIn: true,
    functionName: 'show_image',
    functionDescription: 'Exibe uma imagem real na tela do usuario. REGRAS OBRIGATORIAS: 1) SEMPRE passe uma URL DIRETA de imagem no campo query (terminando em .jpg .png .webp .gif). 2) Se voce encontrou URLs de imagem nos resultados do Google Search (groundingChunks), use essas URLs diretamente. 3) Se nao tiver URL direta disponivel, passe um termo CURTO em INGLES (maximo 3 palavras, ex: "Barbie doll" ou "solar system"). NUNCA use frases longas em portugues. 4) Se source for "url" o sistema exibe a imagem diretamente sem busca.',
    parameters: {
      query: {
        type: 'string',
        description: 'URL DIRETA de imagem (OBRIGATORIO quando possivel). Exemplos: "https://upload.wikimedia.org/.../Barbie.jpg", "https://images.unsplash.com/photo-xxx.jpg". Se nao tiver URL, use termo CURTO em INGLES (max 3 palavras).',
        required: true,
      },
      caption: {
        type: 'string',
        description: 'Legenda curta em portugues para a imagem',
        required: false,
      },
      source: {
        type: 'string',
        description: 'Use "url" quando query for uma URL direta. Use "search" quando query for um termo de busca.',
        required: false,
        enum: ['search', 'url'],
      },
      duration: {
        type: 'number',
        description: 'Tempo em segundos que a imagem fica visivel. Padrao: 15 segundos.',
        required: false,
      },
    },
  },
  {
    id: 'hide_image',
    name: 'Esconder Imagem',
    description: 'Remove todas as imagens ativas da tela imediatamente.',
    icon: '🚫',
    category: 'visual',
    enabled: true,
    isBuiltIn: true,
    functionName: 'hide_image',
    functionDescription: 'Remove todas as imagens da tela imediatamente. Use quando a imagem nao for mais relevante para a conversa.',
    parameters: {},
  },
  {
    id: 'ghost_search',
    name: 'Ghost Search',
    description: 'Pesquisa avançada com foco em papers, YouTube, Reddit e cálculos (Wolfram).',
    icon: '👻',
    category: 'search',
    enabled: true,
    isBuiltIn: true,
    functionName: 'ghost_search',
    functionDescription: 'Pesquisa avancada via Ghost-Search. Use para pesquisas profundas e especializadas. Suporta focos: academic (papers), youtube (videos), reddit (opinioes), wolfram (calculos), web (geral).',
    parameters: {
      query: {
        type: 'string',
        description: 'Termo de pesquisa',
        required: true,
      },
      focus: {
        type: 'string',
        description: 'Foco da pesquisa: web, academic, youtube, reddit, wolfram',
        required: false,
        enum: ['web', 'academic', 'youtube', 'reddit', 'wolfram'],
      },
      model: {
        type: 'string',
        description: 'Modelo: best (rapido), deep_research (analise completa)',
        required: false,
        enum: ['best', 'deep_research'],
      },
    },
  },
  {
    id: 'fetch_page',
    name: 'Ler Página Web',
    description: 'Acessa e lê o conteúdo de uma página web por URL.',
    icon: '🌐',
    category: 'search',
    enabled: true,
    isBuiltIn: true,
    functionName: 'fetch_page',
    functionDescription: 'Le e retorna o conteudo textual de uma pagina web. Use quando o usuario pedir para acessar, abrir ou ler um site ou link especifico.',
    parameters: {
      url: {
        type: 'string',
        description: 'URL completa da pagina para acessar',
        required: true,
      },
      maxChars: {
        type: 'number',
        description: 'Maximo de caracteres para retornar (padrao: 12000)',
        required: false,
      },
    },
  },
  {
    id: 'save_emotional_note',
    name: 'Notas Emocionais',
    description: 'Salva registros emocionais durante a conversa para análise posterior.',
    icon: '💭',
    category: 'data',
    enabled: false,
    isBuiltIn: true,
    functionName: 'save_emotional_note',
    functionDescription: 'Salva uma nota emocional do usuario. Use quando perceber que o usuario expressou uma emocao forte ou quando ele pedir para registrar como esta se sentindo.',
    parameters: {
      emotion: {
        type: 'string',
        description: 'Emocao detectada',
        required: true,
        enum: ['happy', 'sad', 'anxious', 'angry', 'calm', 'neutral'],
      },
      intensity: {
        type: 'number',
        description: 'Intensidade da emocao de 1 a 10',
        required: true,
      },
      trigger: {
        type: 'string',
        description: 'O que causou a emocao',
        required: false,
      },
      note: {
        type: 'string',
        description: 'Observacao adicional',
        required: false,
      },
    },
  },
  {
    id: 'get_conversation_history',
    name: 'Histórico de Conversas',
    description: 'Acessa o histórico de conversas anteriores para contexto personalizado.',
    icon: '📜',
    category: 'data',
    enabled: false,
    isBuiltIn: true,
    functionName: 'get_conversation_history',
    functionDescription: 'Busca historico de conversas anteriores. Use no inicio da conversa para personalizar a saudacao, ou quando o usuario perguntar sobre conversas passadas.',
    parameters: {
      days: {
        type: 'number',
        description: 'Quantos dias atras buscar (padrao: 7)',
        required: false,
      },
      emotionFilter: {
        type: 'string',
        description: 'Filtrar por emocao especifica ou "all" para todas',
        required: false,
      },
    },
  },
  {
    id: 'search_conversation_topic',
    name: 'Buscar por Tópico',
    description: 'Pesquisa conversas anteriores por tema ou palavra-chave.',
    icon: '🔎',
    category: 'data',
    enabled: false,
    isBuiltIn: true,
    functionName: 'search_conversation_topic',
    functionDescription: 'Busca conversas passadas que mencionam um topico especifico. Use quando o usuario perguntar "a gente ja falou sobre X?" ou quiser rever um assunto.',
    parameters: {
      topic: {
        type: 'string',
        description: 'Topico ou palavra-chave para buscar',
        required: true,
      },
      limit: {
        type: 'number',
        description: 'Maximo de resultados (padrao: 5)',
        required: false,
      },
    },
  },
  {
    id: 'get_time_patterns',
    name: 'Padrões de Uso',
    description: 'Analisa quando o usuário mais conversa (por hora ou dia da semana).',
    icon: '📊',
    category: 'data',
    enabled: false,
    isBuiltIn: true,
    functionName: 'get_time_patterns',
    functionDescription: 'Analisa padroes temporais de uso - quando o usuario mais conversa. Use quando o usuario perguntar sobre seus habitos de conversa.',
    parameters: {
      analysisType: {
        type: 'string',
        description: 'Tipo de analise: hourly (por hora) ou daily (por dia da semana)',
        required: true,
        enum: ['hourly', 'daily'],
      },
    },
  },
  {
    id: 'get_emotion_statistics',
    name: 'Estatísticas Emocionais',
    description: 'Gera relatório estatístico das emoções registradas no período.',
    icon: '📈',
    category: 'data',
    enabled: false,
    isBuiltIn: true,
    functionName: 'get_emotion_statistics',
    functionDescription: 'Gera estatisticas sobre emocoes registradas. Use quando o usuario quiser entender seu historico emocional.',
    parameters: {
      period: {
        type: 'string',
        description: 'Periodo: today, week, month, all',
        required: true,
        enum: ['today', 'week', 'month', 'all'],
      },
    },
  },
];

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set, get) => ({
      skills: DEFAULT_SKILLS,

      toggleSkill: (id: string) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
          ),
        })),

      enableAll: () =>
        set((state) => ({
          skills: state.skills.map((s) => ({ ...s, enabled: true })),
        })),

      disableAll: () =>
        set((state) => ({
          skills: state.skills.map((s) => ({ ...s, enabled: false })),
        })),

      getEnabledSkills: () => get().skills.filter((s) => s.enabled),

      addCustomSkill: (skill) =>
        set((state) => ({
          skills: [
            ...state.skills,
            {
              ...skill,
              id: `custom_${Date.now()}`,
              isBuiltIn: false,
            },
          ],
        })),

      removeCustomSkill: (id: string) =>
        set((state) => ({
          skills: state.skills.filter((s) => s.id !== id || s.isBuiltIn),
        })),
    }),
    {
      name: 'livego-skills',
      // Merge stored skills with any new built-in skills added in updates
      merge: (persisted: any, current: any) => {
        const persistedSkills: Skill[] = persisted?.skills || [];
        const currentSkills: Skill[] = current.skills;

        // Keep user's toggle state for existing skills, add new built-in skills
        const merged = currentSkills.map((defaultSkill) => {
          const saved = persistedSkills.find((s) => s.id === defaultSkill.id);
          if (saved) {
            return { ...defaultSkill, enabled: saved.enabled };
          }
          return defaultSkill;
        });

        // Also keep custom (non-built-in) skills from persisted state
        const customSkills = persistedSkills.filter((s) => !s.isBuiltIn);
        return { ...current, ...persisted, skills: [...merged, ...customSkills] };
      },
    }
  )
);

/**
 * Build Gemini function declarations from enabled skills
 * Used by useLiveAPI to register tools with Gemini
 */
export function buildFunctionDeclarations(): any[] {
  const enabledSkills = useSkillsStore.getState().getEnabledSkills();

  return enabledSkills
    .filter((skill) => {
      // Google Search is handled separately in useLiveAPI
      // ghost_search uses its own route, but we still declare it as a function
      return skill.functionName !== 'googleSearch';
    })
    .map((skill) => {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(skill.parameters).forEach(([name, param]) => {
        properties[name] = {
          type: param.type === 'number' ? 'NUMBER' : 'STRING',
          description: param.description,
          ...(param.enum && { enum: param.enum }),
        };
        if (param.required) {
          required.push(name);
        }
      });

      const hasParams = Object.keys(properties).length > 0;

      return {
        name: skill.functionName,
        description: skill.functionDescription,
        ...(hasParams ? {
          parameters: {
            type: 'OBJECT',
            properties,
            ...(required.length > 0 && { required }),
          }
        } : {}),
      };
    });
}
