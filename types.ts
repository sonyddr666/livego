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
  ANALYTICS = 'ANALYTICS',
  SKILLS = 'SKILLS'
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
  credential?: LiveCredential;
  enableAdvancedFeatures?: boolean;
  useConversationContext?: boolean;
  onUnexpectedDisconnect?: (data: {
    transcript: string;
    toolResults: ToolResult[];
    closeCode: number;
    closeReason: string;
  }) => void;
}

export type LiveCredential =
  | { kind: 'ephemeral'; value: string; apiVersion: 'v1alpha' }
  | { kind: 'user-key'; value: string; apiVersion: 'v1beta' };

export interface ToolResult {
  toolName: string;
  query: string;
  timestamp: number;
  answer?: string;
  citations?: { title: string; url: string }[];
  ok: boolean;
}

export interface DroppedSession {
  dropped: true;
  timestamp: number;
  transcript: string;
  toolResults: ToolResult[];
  closeCode: number;
  closeReason: string;
  pendingGhostResults: ToolResult[];
  startTime: number;
}

export interface HistoryItem {
  id: string;
  date: string;
  duration: string;
  transcript: string;
  toolResults?: ToolResult[];
  closeReason?: 'manual' | 'error';
  closeCode?: number;
  wasDropped?: boolean;
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

// Tool Call Types for Gemini Live API
export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallMessage {
  functionCalls?: FunctionCall[];
}

export interface FunctionResponseItem {
  id: string;
  name: string;
  response: Record<string, unknown> | undefined;
}

export interface ToolResponsePayload {
  functionResponses: FunctionResponseItem[];
}

// Audio Context with webkit fallback
export interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}
