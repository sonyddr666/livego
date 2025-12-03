export enum ScreenName {
  HOME = 'HOME',
  USAGE = 'USAGE',
  SETTINGS = 'SETTINGS',
  ACCOUNT = 'ACCOUNT',
  NOTIFICATIONS = 'NOTIFICATIONS',
  PRIVACY = 'PRIVACY',
  HELP = 'HELP',
  ABOUT = 'ABOUT',
  VOICE = 'VOICE',
  INSTRUCTIONS = 'INSTRUCTIONS',
  HISTORY = 'HISTORY'
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
}

export interface HistoryItem {
  id: string;
  date: string;
  duration: string;
  transcript: string;
}