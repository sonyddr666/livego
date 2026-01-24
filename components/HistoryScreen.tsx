import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';
import { IconChevronLeft, IconTrash, IconClock, IconUser, IconSparkles } from './Icons';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';

interface HistoryScreenProps {
    history: HistoryItem[];
    onBack: () => void;
    onDelete: (id: string) => void;
}

interface ChatMessage {
    role: 'user' | 'gemini';
    text: string;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onBack, onDelete }) => {
    const { t } = useI18n();
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const { useConversationContext, setUseConversationContext } = useSettingsStore();

    // Helper to parse the raw transcript string into chat messages
    const parsedMessages = useMemo(() => {
        if (!selectedItem || !selectedItem.transcript) return [];

        const messages: ChatMessage[] = [];

        // The transcript format is expected to be "User: ... \nGemini: ... \nUser: ..."
        // We split by the known labels.

        const rawText = selectedItem.transcript;
        // Regex to find "User:" or "Gemini:" at the start of a line (or start of string)
        const parts = rawText.split(/(?=\nUser: )|(?=\nGemini: )|^User: |^Gemini: /).filter(p => p.trim());

        // Fallback: if regex split fails or format is weird, try simple line split
        if (parts.length === 0 && rawText.length > 0) {
            return [{ role: 'user', text: rawText }];
        }

        parts.forEach(part => {
            let cleanPart = part.trim();
            // Remove the leading label if present (it might be inside the part if split kept it or if we used lookahead)
            if (cleanPart.startsWith('User: ')) {
                messages.push({ role: 'user', text: cleanPart.replace('User: ', '') });
            } else if (cleanPart.startsWith('Gemini: ')) {
                messages.push({ role: 'gemini', text: cleanPart.replace('Gemini: ', '') });
            } else if (cleanPart.startsWith('\nUser: ')) {
                messages.push({ role: 'user', text: cleanPart.replace('\nUser: ', '') });
            } else if (cleanPart.startsWith('\nGemini: ')) {
                messages.push({ role: 'gemini', text: cleanPart.replace('\nGemini: ', '') });
            } else {
                // If we can't identify, append to previous or default to user?
                // Ideally this shouldn't happen with correct formatting.
                // Let's assume it's continuation or unlabelled.
                if (messages.length > 0) {
                    messages[messages.length - 1].text += '\n' + cleanPart;
                } else {
                    // Try to guess based on content or default to user
                    messages.push({ role: 'user', text: cleanPart });
                }
            }
        });

        return messages;
    }, [selectedItem]);

    if (selectedItem) {
        return (
            <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
                {/* Detail Header */}
                <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20 shadow-sm">
                    <button type="button" onClick={() => setSelectedItem(null)} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
                        <IconChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1 text-center mr-8">
                        <h1 className="text-[17px] font-semibold text-theme-primary">{selectedItem.date}</h1>
                        <p className="text-xs text-theme-secondary font-medium">{selectedItem.duration}</p>
                    </div>
                </div>

                {/* Chat Bubble View */}
                <div className="flex-1 p-4 overflow-y-auto bg-theme-primary space-y-4">
                    {parsedMessages.length === 0 ? (
                        <div className="text-center text-theme-muted mt-10 italic">{t('history.emptyTranscript')}</div>
                    ) : (
                        parsedMessages.map((msg, idx) => (
                            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                                {/* Avatar for Gemini */}
                                {msg.role === 'gemini' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm mr-2 mt-1 shrink-0">
                                        <IconSparkles className="w-4 h-4" />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[75%] px-4 py-3 text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap
                            ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-theme-secondary text-theme-primary border border-theme rounded-2xl rounded-tl-sm'
                                        }`}
                                >
                                    {msg.text}
                                </div>

                                {/* Avatar for User */}
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-theme-tertiary flex items-center justify-center text-theme-secondary ml-2 mt-1 shrink-0">
                                        <IconUser className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div className="h-4" /> {/* Bottom spacer */}
                </div>
            </div>
        );
    }

    // List View
    return (
        <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
            <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
                <button type="button" onClick={onBack} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">
                    {t('history.title')}
                </h1>
            </div>

            {/* Context Toggle */}
            <div className="px-6 py-4 bg-theme-secondary border-b border-theme">
                <button
                    type="button"
                    onClick={() => setUseConversationContext(!useConversationContext)}
                    className="w-full flex items-center justify-between"
                >
                    <div className="flex flex-col">
                        <span className="text-theme-primary font-medium">Usar como Contexto</span>
                        <span className="text-xs text-theme-secondary">Carregar histórico nas próximas conversas</span>
                    </div>
                    <span className={`w-12 h-7 rounded-full relative transition-colors ${useConversationContext ? 'bg-blue-500' : 'bg-theme-tertiary'}`}>
                        <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${useConversationContext ? 'translate-x-5' : 'translate-x-0'}`} />
                    </span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-theme-muted opacity-60">
                        <IconClock className="w-16 h-16 mb-4" />
                        <p>{t('history.empty')}</p>
                    </div>
                ) : (
                    <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme">
                        {history.map((item, i) => (
                            <div
                                key={item.id}
                                className={`flex items-center p-4 cursor-pointer hover:bg-theme-hover active:bg-theme-active transition-colors ${i !== history.length - 1 ? 'border-b border-theme' : ''}`}
                                onClick={() => setSelectedItem(item)}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4 text-blue-600 dark:text-blue-400">
                                    <IconClock className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-theme-primary">{item.date}</h3>
                                    <p className="text-xs text-theme-secondary">{item.duration}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                    aria-label={t('history.delete')}
                                    className="p-2 text-theme-muted hover:text-red-500 transition-colors"
                                >
                                    <IconTrash className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
