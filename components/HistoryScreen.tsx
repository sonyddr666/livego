import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';
import { IconChevronLeft, IconTrash, IconClock, IconUser, IconSparkles } from './Icons';

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
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

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
      <div className="flex flex-col h-full bg-[#f3f4f6]">
        {/* Detail Header */}
        <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
            <button onClick={() => setSelectedItem(null)} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
                <IconChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center mr-8">
                <h1 className="text-[17px] font-semibold text-gray-900">{selectedItem.date}</h1>
                <p className="text-xs text-gray-500 font-medium">{selectedItem.duration}</p>
            </div>
        </div>

        {/* Chat Bubble View */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#f3f4f6] space-y-4">
            {parsedMessages.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 italic">No transcript available.</div>
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
                                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                            }`}
                        >
                            {msg.text}
                        </div>

                         {/* Avatar for User */}
                         {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 ml-2 mt-1 shrink-0">
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
    <div className="flex flex-col h-full bg-[#f3f4f6]">
      <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
          <IconChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-gray-900 mr-8">
          Call History
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                <IconClock className="w-16 h-16 mb-4" />
                <p>No history yet</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                {history.map((item, i) => (
                    <div 
                        key={item.id}
                        className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${i !== history.length - 1 ? 'border-b border-gray-100' : ''}`}
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4 text-blue-600">
                            <IconClock className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">{item.date}</h3>
                            <p className="text-xs text-gray-500">{item.duration}</p>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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