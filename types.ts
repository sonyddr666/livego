export enum ScreenName {
  HOME = 'HOME',
  USAGE = 'USAGE',
  SETTINGS = 'SETTINGS',
  LANGUAGE = 'LANGUAGE',
  ACCOUNT = 'ACCOUNT',
  NOTIFICATIONS = 'NOTIFICATIONS',
  PRIVACY = 'PRIVACY',
  HELP = 'HELP',
  ABOUT = 'ABOUT',
  VOICE = 'VOICE',
  INSTRUCTIONS = 'INSTRUCTIONS',
  HISTORY = 'HISTORY',
  ANALYTICS = 'ANALYTICS'
}

export interface SettingsItemProps {
  icon: string;
  label: string;
  colorClass: string;
  onClick: () => void;
}

export interface LiveConfig {
  voiceName: string;
  systemInstruction: string;
  apiKey?: string;
  enableAdvancedFeatures?: boolean;
  useConversationContext?: boolean;
}

export interface HistoryItem {
  id: string;
  date: string;
  duration: string;
  transcript: string;
}

// Advanced Analytics Types
export type EmotionType = 'happy' | 'sad' | 'anxious' | 'angry' | 'calm' | 'neutral' | 'unknown';

export interface EmotionalNote {
  timestamp: string;
  emotion: EmotionType;
  intensity: number; // 1-10
  trigger?: string;
  note?: string;
}

export interface ConversationEntry {
  id: string;
  timestamp: string;
  duration: number; // minutes
  transcript: string;
  emotion?: EmotionType;
  intensity?: number;
}

export interface EmotionStatistics {
  period: string;
  totalNotes: number;
  averageIntensity: number;
  mostCommonEmotion: EmotionType;
  distribution: Array<{
    emotion: EmotionType;
    count: number;
    percentage: string;
  }>;
}

export interface TimePattern {
  type: 'hourly' | 'daily' | 'weekly';
  peakHour?: string;
  peakDay?: string;
  distribution: Array<{
    period: string;
    conversations: number;
    dominantEmotion: EmotionType;
  }>;
}
