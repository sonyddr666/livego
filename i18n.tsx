import React from 'react';

const STORAGE_KEY = 'livego_locale';
const DEFAULT_LOCALE = 'en';

const translations = {
  en: {
    'app.versionLabel': 'VERSION {version}',
    'app.versionBeta': 'Version {version} (Beta)',
    'common.comingSoon': 'Coming soon',
    'common.showApiKey': 'Show API key',
    'common.hideApiKey': 'Hide API key',
    'home.greetingTitle': "Hi, I'm Gemini.",
    'home.greetingSubtitle': 'How can I help you today?',
    'home.apiKeyWarning': 'No API key configured. Tap to set up.',
    'home.connecting': 'Connecting...',
    'home.tapToSpeak': 'Tap to speak',
    'home.configureApiKey': 'Configure API key first',
    'usage.live': 'Live',
    'usage.settingsDisabled': 'End call to change settings',
    'usage.listening': 'Listening...',
    'usage.geminiActive': 'Gemini is active',
    'usage.mute': 'Mute',
    'usage.muted': 'Muted',
    'usage.end': 'End',
    'usage.speaker': 'Speaker',
    'usage.speakerMuted': 'Muted',
    'settings.title': 'Settings',
    'settings.section.intelligence': 'Intelligence',
    'settings.section.general': 'General',
    'settings.section.legal': 'Legal & Support',
    'settings.item.voice': 'Voice',
    'settings.item.systemInstructions': 'System Instructions',
    'settings.item.account': 'Account',
    'settings.item.history': 'History',
    'settings.item.language': 'Language',
    'settings.item.notifications': 'Notifications',
    'settings.item.privacy': 'Privacy',
    'settings.item.help': 'Help & Support',
    'settings.item.about': 'About',
    'settings.action.logout': 'Log Out',
    'settings.voice.title': 'Voice',
    'settings.voice.description': 'Select a voice for Gemini to use during your conversations.',
    'settings.language.title': 'Language',
    'settings.language.description': 'Select the app language.',
    'settings.instructions.title': 'System Instructions',
    'settings.instructions.placeholder': 'e.g. You are a helpful assistant...',
    'settings.instructions.description': 'Define the persona and context for the AI. This guides how Gemini behaves during the call.',
    'settings.account.title': 'Account',
    'settings.account.demoUser': 'Demo User',
    'settings.account.apiKeyManagement': 'API Key Management',
    'settings.account.apiKeyLabel': 'Gemini API key',
    'settings.account.apiKeyPlaceholder': 'Enter your Gemini API key',
    'settings.account.apiKeySaved': 'Your API key is saved locally on this device and is never sent to our servers.',
    'settings.account.profile': 'Profile',
    'settings.account.plan': 'Plan',
    'settings.account.planValue': 'Free Tier',
    'settings.account.memberSince': 'Member Since',
    'settings.account.memberSinceValue': 'Oct 2024',
    'settings.account.delete': 'Delete Account',
    'settings.notifications.title': 'Notifications',
    'settings.notifications.alerts': 'Alerts',
    'settings.notifications.push': 'Push Notifications',
    'settings.notifications.email': 'Email Digest',
    'settings.privacy.title': 'Privacy',
    'settings.privacy.notice': 'Your voice data is processed in real-time and is not stored permanently on our servers.',
    'settings.privacy.shareUsage': 'Share Usage Statistics',
    'settings.privacy.allowPersonalization': 'Allow Personalization',
    'settings.help.title': 'Help & Support',
    'settings.help.faq': 'FAQ',
    'settings.help.voice': 'How to change voice?',
    'settings.help.free': 'Is it free?',
    'settings.help.contact': 'Contact Support',
    'settings.about.title': 'About',
    'settings.about.powered': 'Powered by Google Gemini 2.5 Live API.',
    'settings.about.tagline': 'Designed to provide seamless real-time conversational experiences.',
    'settings.about.copyright': '(c) 2025 LiveGo Inc.',
    'voice.description.Puck': 'Playful and energetic',
    'voice.description.Charon': 'Deep and mysterious',
    'voice.description.Kore': 'Warm and friendly',
    'voice.description.Fenrir': 'Bold and confident',
    'voice.description.Aoede': 'Melodic and soothing',
    'voice.description.Zephyr': 'Light and breezy',
    'language.name.en': 'English',
    'language.name.pt-BR': 'Portuguese (Brazil)',
    'language.name.es-ES': 'Spanish',
    'language.name.fr-FR': 'French',
    'transcript.userLabel': 'User',
    'transcript.geminiLabel': 'Gemini',
    'history.title': 'Call History',
    'history.empty': 'No history yet',
    'history.emptyTranscript': 'No transcript available.',
    'history.delete': 'Delete history item',
    'systemInstruction.default': 'You are a friendly, helpful, and concise conversational partner. Keep your responses relatively short to facilitate a back-and-forth dialogue.'
  },
  'pt-BR': {
    'app.versionLabel': 'VERS\u00c3O {version}',
    'app.versionBeta': 'Vers\u00e3o {version} (Beta)',
    'common.comingSoon': 'Em breve',
    'common.showApiKey': 'Mostrar chave de API',
    'common.hideApiKey': 'Ocultar chave de API',
    'home.greetingTitle': 'Oi, eu sou o Gemini.',
    'home.greetingSubtitle': 'Como posso ajudar voc\u00ea hoje?',
    'home.apiKeyWarning': 'Nenhuma chave de API configurada. Toque para configurar.',
    'home.connecting': 'Conectando...',
    'home.tapToSpeak': 'Toque para falar',
    'home.configureApiKey': 'Configure a chave de API primeiro',
    'usage.live': 'Ao vivo',
    'usage.settingsDisabled': 'Encerre a chamada para alterar as configura\u00e7\u00f5es',
    'usage.listening': 'Ouvindo...',
    'usage.geminiActive': 'Gemini est\u00e1 ativo',
    'usage.mute': 'Silenciar',
    'usage.muted': 'Silenciado',
    'usage.end': 'Encerrar',
    'usage.speaker': 'Alto-falante',
    'usage.speakerMuted': 'Mudo',
    'settings.title': 'Configura\u00e7\u00f5es',
    'settings.section.intelligence': 'Intelig\u00eancia',
    'settings.section.general': 'Geral',
    'settings.section.legal': 'Legal e suporte',
    'settings.item.voice': 'Voz',
    'settings.item.systemInstructions': 'Instru\u00e7\u00f5es do sistema',
    'settings.item.account': 'Conta',
    'settings.item.history': 'Hist\u00f3rico',
    'settings.item.language': 'Idioma',
    'settings.item.notifications': 'Notifica\u00e7\u00f5es',
    'settings.item.privacy': 'Privacidade',
    'settings.item.help': 'Ajuda e suporte',
    'settings.item.about': 'Sobre',
    'settings.action.logout': 'Sair',
    'settings.voice.title': 'Voz',
    'settings.voice.description': 'Selecione uma voz para o Gemini usar durante suas conversas.',
    'settings.language.title': 'Idioma',
    'settings.language.description': 'Selecione o idioma do aplicativo.',
    'settings.instructions.title': 'Instru\u00e7\u00f5es do sistema',
    'settings.instructions.placeholder': 'Ex.: Voc\u00ea \u00e9 um assistente \u00fatil...',
    'settings.instructions.description': 'Defina a persona e o contexto para a IA. Isso orienta como o Gemini se comporta durante a chamada.',
    'settings.account.title': 'Conta',
    'settings.account.demoUser': 'Usu\u00e1rio demo',
    'settings.account.apiKeyManagement': 'Gerenciamento de chave de API',
    'settings.account.apiKeyLabel': 'Chave de API do Gemini',
    'settings.account.apiKeyPlaceholder': 'Digite sua chave de API do Gemini',
    'settings.account.apiKeySaved': 'Sua chave de API \u00e9 salva localmente neste dispositivo e nunca \u00e9 enviada para nossos servidores.',
    'settings.account.profile': 'Perfil',
    'settings.account.plan': 'Plano',
    'settings.account.planValue': 'Plano gratuito',
    'settings.account.memberSince': 'Membro desde',
    'settings.account.memberSinceValue': 'Out 2024',
    'settings.account.delete': 'Excluir conta',
    'settings.notifications.title': 'Notifica\u00e7\u00f5es',
    'settings.notifications.alerts': 'Alertas',
    'settings.notifications.push': 'Notifica\u00e7\u00f5es push',
    'settings.notifications.email': 'Resumo por e-mail',
    'settings.privacy.title': 'Privacidade',
    'settings.privacy.notice': 'Seus dados de voz s\u00e3o processados em tempo real e n\u00e3o s\u00e3o armazenados permanentemente em nossos servidores.',
    'settings.privacy.shareUsage': 'Compartilhar estat\u00edsticas de uso',
    'settings.privacy.allowPersonalization': 'Permitir personaliza\u00e7\u00e3o',
    'settings.help.title': 'Ajuda e suporte',
    'settings.help.faq': 'FAQ',
    'settings.help.voice': 'Como mudar a voz?',
    'settings.help.free': '\u00c9 gratuito?',
    'settings.help.contact': 'Entrar em contato com o suporte',
    'settings.about.title': 'Sobre',
    'settings.about.powered': 'Desenvolvido com a Google Gemini 2.5 Live API.',
    'settings.about.tagline': 'Projetado para oferecer experi\u00eancias conversacionais em tempo real sem interrup\u00e7\u00f5es.',
    'settings.about.copyright': '(c) 2025 LiveGo Inc.',
    'voice.description.Puck': 'Brincalh\u00e3o e energ\u00e9tico',
    'voice.description.Charon': 'Profundo e misterioso',
    'voice.description.Kore': 'Acolhedor e amig\u00e1vel',
    'voice.description.Fenrir': 'Ousado e confiante',
    'voice.description.Aoede': 'Mel\u00f3dico e relaxante',
    'voice.description.Zephyr': 'Leve e arejado',
    'language.name.en': 'Ingl\u00eas',
    'language.name.pt-BR': 'Portugu\u00eas (Brasil)',
    'language.name.es-ES': 'Espanhol',
    'language.name.fr-FR': 'Franc\u00eas',
    'transcript.userLabel': 'Usu\u00e1rio',
    'transcript.geminiLabel': 'Gemini',
    'history.title': 'Hist\u00f3rico de chamadas',
    'history.empty': 'Nenhum hist\u00f3rico ainda',
    'history.emptyTranscript': 'Nenhuma transcri\u00e7\u00e3o dispon\u00edvel.',
    'history.delete': 'Excluir item do hist\u00f3rico',
    'systemInstruction.default': 'Voc\u00ea \u00e9 um parceiro de conversa amig\u00e1vel, prestativo e conciso. Mantenha suas respostas relativamente curtas para facilitar um di\u00e1logo de ida e volta.'
  },
  'es-ES': {
    'app.versionLabel': 'VERSI\u00d3N {version}',
    'app.versionBeta': 'Versi\u00f3n {version} (Beta)',
    'common.comingSoon': 'Pr\u00f3ximamente',
    'common.showApiKey': 'Mostrar clave de API',
    'common.hideApiKey': 'Ocultar clave de API',
    'home.greetingTitle': 'Hola, soy Gemini.',
    'home.greetingSubtitle': '\u00bfEn qu\u00e9 puedo ayudarte hoy?',
    'home.apiKeyWarning': 'No hay una clave de API configurada. Toca para configurar.',
    'home.connecting': 'Conectando...',
    'home.tapToSpeak': 'Toca para hablar',
    'home.configureApiKey': 'Configura la clave de API primero',
    'usage.live': 'En vivo',
    'usage.settingsDisabled': 'Finaliza la llamada para cambiar la configuraci\u00f3n',
    'usage.listening': 'Escuchando...',
    'usage.geminiActive': 'Gemini est\u00e1 activo',
    'usage.mute': 'Silenciar',
    'usage.muted': 'Silenciado',
    'usage.end': 'Finalizar',
    'usage.speaker': 'Altavoz',
    'usage.speakerMuted': 'Silenciado',
    'settings.title': 'Configuraci\u00f3n',
    'settings.section.intelligence': 'Inteligencia',
    'settings.section.general': 'General',
    'settings.section.legal': 'Legal y soporte',
    'settings.item.voice': 'Voz',
    'settings.item.systemInstructions': 'Instrucciones del sistema',
    'settings.item.account': 'Cuenta',
    'settings.item.history': 'Historial',
    'settings.item.language': 'Idioma',
    'settings.item.notifications': 'Notificaciones',
    'settings.item.privacy': 'Privacidad',
    'settings.item.help': 'Ayuda y soporte',
    'settings.item.about': 'Acerca de',
    'settings.action.logout': 'Cerrar sesi\u00f3n',
    'settings.voice.title': 'Voz',
    'settings.voice.description': 'Selecciona una voz para que Gemini la use durante tus conversaciones.',
    'settings.language.title': 'Idioma',
    'settings.language.description': 'Selecciona el idioma de la aplicaci\u00f3n.',
    'settings.instructions.title': 'Instrucciones del sistema',
    'settings.instructions.placeholder': 'p. ej. Eres un asistente \u00fatil...',
    'settings.instructions.description': 'Define la personalidad y el contexto para la IA. Esto gu\u00eda c\u00f3mo se comporta Gemini durante la llamada.',
    'settings.account.title': 'Cuenta',
    'settings.account.demoUser': 'Usuario de demostraci\u00f3n',
    'settings.account.apiKeyManagement': 'Gesti\u00f3n de clave de API',
    'settings.account.apiKeyLabel': 'Clave de API de Gemini',
    'settings.account.apiKeyPlaceholder': 'Introduce tu clave de API de Gemini',
    'settings.account.apiKeySaved': 'Tu clave de API se guarda localmente en este dispositivo y nunca se env\u00eda a nuestros servidores.',
    'settings.account.profile': 'Perfil',
    'settings.account.plan': 'Plan',
    'settings.account.planValue': 'Plan gratuito',
    'settings.account.memberSince': 'Miembro desde',
    'settings.account.memberSinceValue': 'Oct 2024',
    'settings.account.delete': 'Eliminar cuenta',
    'settings.notifications.title': 'Notificaciones',
    'settings.notifications.alerts': 'Alertas',
    'settings.notifications.push': 'Notificaciones push',
    'settings.notifications.email': 'Resumen por correo',
    'settings.privacy.title': 'Privacidad',
    'settings.privacy.notice': 'Tus datos de voz se procesan en tiempo real y no se almacenan permanentemente en nuestros servidores.',
    'settings.privacy.shareUsage': 'Compartir estad\u00edsticas de uso',
    'settings.privacy.allowPersonalization': 'Permitir personalizaci\u00f3n',
    'settings.help.title': 'Ayuda y soporte',
    'settings.help.faq': 'Preguntas frecuentes',
    'settings.help.voice': '\u00bfC\u00f3mo cambiar la voz?',
    'settings.help.free': '\u00bfEs gratis?',
    'settings.help.contact': 'Contactar soporte',
    'settings.about.title': 'Acerca de',
    'settings.about.powered': 'Impulsado por Google Gemini 2.5 Live API.',
    'settings.about.tagline': 'Dise\u00f1ado para ofrecer experiencias conversacionales en tiempo real sin interrupciones.',
    'settings.about.copyright': '(c) 2025 LiveGo Inc.',
    'voice.description.Puck': 'Juguet\u00f3n y en\u00e9rgico',
    'voice.description.Charon': 'Profundo y misterioso',
    'voice.description.Kore': 'C\u00e1lido y amigable',
    'voice.description.Fenrir': 'Audaz y seguro',
    'voice.description.Aoede': 'Mel\u00f3dico y relajante',
    'voice.description.Zephyr': 'Ligero y fresco',
    'language.name.en': 'Ingl\u00e9s',
    'language.name.pt-BR': 'Portugu\u00e9s (Brasil)',
    'language.name.es-ES': 'Espa\u00f1ol',
    'language.name.fr-FR': 'Franc\u00e9s',
    'transcript.userLabel': 'Usuario',
    'transcript.geminiLabel': 'Gemini',
    'history.title': 'Historial de llamadas',
    'history.empty': 'A\u00fan no hay historial',
    'history.emptyTranscript': 'No hay transcripci\u00f3n disponible.',
    'history.delete': 'Eliminar elemento del historial',
    'systemInstruction.default': 'Eres un compa\u00f1ero de conversaci\u00f3n amable, servicial y conciso. Mant\u00e9n tus respuestas relativamente cortas para facilitar un di\u00e1logo de ida y vuelta.'
  },
  'fr-FR': {
    'app.versionLabel': 'VERSION {version}',
    'app.versionBeta': 'Version {version} (B\u00eata)',
    'common.comingSoon': 'Bient\u00f4t disponible',
    'common.showApiKey': 'Afficher la cl\u00e9 API',
    'common.hideApiKey': 'Masquer la cl\u00e9 API',
    'home.greetingTitle': 'Salut, je suis Gemini.',
    'home.greetingSubtitle': "Comment puis-je vous aider aujourd'hui ?",
    'home.apiKeyWarning': 'Aucune cl\u00e9 API configur\u00e9e. Appuyez pour configurer.',
    'home.connecting': 'Connexion...',
    'home.tapToSpeak': 'Appuyez pour parler',
    'home.configureApiKey': 'Configurez d\'abord la cl\u00e9 API',
    'usage.live': 'En direct',
    'usage.settingsDisabled': 'Terminez l\'appel pour modifier les param\u00e8tres',
    'usage.listening': '\u00c9coute...',
    'usage.geminiActive': 'Gemini est actif',
    'usage.mute': 'Couper',
    'usage.muted': 'Muet',
    'usage.end': 'Terminer',
    'usage.speaker': 'Haut-parleur',
    'usage.speakerMuted': 'Muet',
    'settings.title': 'Param\u00e8tres',
    'settings.section.intelligence': 'Intelligence',
    'settings.section.general': 'G\u00e9n\u00e9ral',
    'settings.section.legal': 'L\u00e9gal et support',
    'settings.item.voice': 'Voix',
    'settings.item.systemInstructions': 'Instructions syst\u00e8me',
    'settings.item.account': 'Compte',
    'settings.item.history': 'Historique',
    'settings.item.language': 'Langue',
    'settings.item.notifications': 'Notifications',
    'settings.item.privacy': 'Confidentialit\u00e9',
    'settings.item.help': 'Aide et support',
    'settings.item.about': '\u00c0 propos',
    'settings.action.logout': 'Se d\u00e9connecter',
    'settings.voice.title': 'Voix',
    'settings.voice.description': 'S\u00e9lectionnez une voix pour que Gemini l\'utilise pendant vos conversations.',
    'settings.language.title': 'Langue',
    'settings.language.description': 'S\u00e9lectionnez la langue de l\'application.',
    'settings.instructions.title': 'Instructions syst\u00e8me',
    'settings.instructions.placeholder': 'p. ex. Vous \u00eates un assistant utile...',
    'settings.instructions.description': 'D\u00e9finissez la personnalit\u00e9 et le contexte pour l\'IA. Cela guide le comportement de Gemini pendant l\'appel.',
    'settings.account.title': 'Compte',
    'settings.account.demoUser': 'Utilisateur d\u00e9mo',
    'settings.account.apiKeyManagement': 'Gestion de la cl\u00e9 API',
    'settings.account.apiKeyLabel': 'Cl\u00e9 API Gemini',
    'settings.account.apiKeyPlaceholder': 'Saisissez votre cl\u00e9 API Gemini',
    'settings.account.apiKeySaved': 'Votre cl\u00e9 API est enregistr\u00e9e localement sur cet appareil et n\'est jamais envoy\u00e9e \u00e0 nos serveurs.',
    'settings.account.profile': 'Profil',
    'settings.account.plan': 'Forfait',
    'settings.account.planValue': 'Forfait gratuit',
    'settings.account.memberSince': 'Membre depuis',
    'settings.account.memberSinceValue': 'Oct 2024',
    'settings.account.delete': 'Supprimer le compte',
    'settings.notifications.title': 'Notifications',
    'settings.notifications.alerts': 'Alertes',
    'settings.notifications.push': 'Notifications push',
    'settings.notifications.email': 'R\u00e9sum\u00e9 par e-mail',
    'settings.privacy.title': 'Confidentialit\u00e9',
    'settings.privacy.notice': 'Vos donn\u00e9es vocales sont trait\u00e9es en temps r\u00e9el et ne sont pas stock\u00e9es de mani\u00e8re permanente sur nos serveurs.',
    'settings.privacy.shareUsage': 'Partager les statistiques d\'utilisation',
    'settings.privacy.allowPersonalization': 'Autoriser la personnalisation',
    'settings.help.title': 'Aide et support',
    'settings.help.faq': 'FAQ',
    'settings.help.voice': 'Comment changer la voix ?',
    'settings.help.free': 'Est-ce gratuit ?',
    'settings.help.contact': 'Contacter le support',
    'settings.about.title': '\u00c0 propos',
    'settings.about.powered': 'Propuls\u00e9 par Google Gemini 2.5 Live API.',
    'settings.about.tagline': 'Con\u00e7u pour offrir des exp\u00e9riences conversationnelles en temps r\u00e9el sans interruption.',
    'settings.about.copyright': '(c) 2025 LiveGo Inc.',
    'voice.description.Puck': 'Enjou\u00e9 et \u00e9nergique',
    'voice.description.Charon': 'Profond et myst\u00e9rieux',
    'voice.description.Kore': 'Chaleureux et amical',
    'voice.description.Fenrir': 'Audacieux et confiant',
    'voice.description.Aoede': 'M\u00e9lodieux et apaisant',
    'voice.description.Zephyr': 'L\u00e9ger et a\u00e9rien',
    'language.name.en': 'Anglais',
    'language.name.pt-BR': 'Portugais (Br\u00e9sil)',
    'language.name.es-ES': 'Espagnol',
    'language.name.fr-FR': 'Fran\u00e7ais',
    'transcript.userLabel': 'Utilisateur',
    'transcript.geminiLabel': 'Gemini',
    'history.title': 'Historique des appels',
    'history.empty': 'Aucun historique pour le moment',
    'history.emptyTranscript': 'Aucune transcription disponible.',
    'history.delete': "Supprimer l'\u00e9l\u00e9ment de l'historique",
    'systemInstruction.default': 'Vous \u00eates un partenaire de conversation amical, serviable et concis. Gardez vos r\u00e9ponses relativement courtes pour faciliter un dialogue aller-retour.'
  }
} as const;

type Translations = typeof translations;
export type Locale = keyof Translations;
export type TranslationKey = keyof Translations['en'];

type TranslationVars = Record<string, string | number>;

type I18nValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
};

const normalizeLocale = (value: string | null | undefined): Locale | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('es')) return 'es-ES';
  if (lower.startsWith('fr')) return 'fr-FR';
  return null;
};

const interpolate = (template: string, vars?: TranslationVars): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
};

const getStoredLocale = (): Locale | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeLocale(stored);
  } catch {
    return null;
  }
};

const detectLocale = (): Locale => {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
};

export const getInitialLocale = (): Locale => {
  return getStoredLocale() ?? detectLocale();
};

const I18nContext = React.createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, vars) => {
    const template = translations[DEFAULT_LOCALE][key] ?? key;
    return interpolate(template, vars);
  }
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = React.useState<Locale>(() => getInitialLocale());

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const t = React.useCallback<I18nValue['t']>((key, vars) => {
    const template = translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key;
    return interpolate(template, vars);
  }, [locale]);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => React.useContext(I18nContext);
