import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InstructionPreset {
    id: string;
    name: string;
    instruction: string;
    isDefault?: boolean;
}

// Default presets that come with the app
const DEFAULT_PRESETS: InstructionPreset[] = [
    {
        id: 'default-assistant',
        name: 'Assistente Padrão',
        instruction: 'Você é um assistente virtual inteligente e amigável. Responda de forma clara, concisa e útil. Use um tom conversacional natural.',
        isDefault: true
    },
    {
        id: 'default-creative',
        name: 'Modo Criativo',
        instruction: 'Você é um assistente criativo. Seja imaginativo, use analogias interessantes e ajude com brainstorming de ideias. Não tenha medo de sugerir abordagens inovadoras.',
        isDefault: true
    },
    {
        id: 'default-professional',
        name: 'Modo Profissional',
        instruction: 'Você é um assistente profissional. Seja formal, preciso e objetivo. Foque em fornecer informações técnicas e orientações práticas.',
        isDefault: true
    },
    {
        id: 'default-teacher',
        name: 'Modo Professor',
        instruction: 'Você é um professor paciente. Explique conceitos passo a passo, use exemplos práticos e verifique se o usuário entendeu antes de avançar.',
        isDefault: true
    }
];

interface InstructionPresetsState {
    // All presets (defaults + custom)
    presets: InstructionPreset[];
    // Currently selected preset ID
    selectedPresetId: string | null;
    // Custom instruction (when not using a preset)
    customInstruction: string;
    // Actions
    addPreset: (name: string, instruction: string) => void;
    updatePreset: (id: string, name: string, instruction: string) => void;
    deletePreset: (id: string) => void;
    selectPreset: (id: string | null) => void;
    setCustomInstruction: (instruction: string) => void;
    getActiveInstruction: () => string;
    resetToDefaults: () => void;
}

export const useInstructionPresets = create<InstructionPresetsState>()(
    persist(
        (set, get) => ({
            presets: DEFAULT_PRESETS,
            selectedPresetId: 'default-assistant',
            customInstruction: '',

            addPreset: (name: string, instruction: string) => {
                const newPreset: InstructionPreset = {
                    id: `custom-${Date.now()}`,
                    name,
                    instruction,
                    isDefault: false
                };
                set((state) => ({
                    presets: [...state.presets, newPreset],
                    selectedPresetId: newPreset.id
                }));
            },

            updatePreset: (id: string, name: string, instruction: string) => {
                set((state) => ({
                    presets: state.presets.map((p) =>
                        p.id === id ? { ...p, name, instruction } : p
                    )
                }));
            },

            deletePreset: (id: string) => {
                const state = get();
                const preset = state.presets.find(p => p.id === id);

                // Can't delete default presets
                if (preset?.isDefault) return;

                set((state) => ({
                    presets: state.presets.filter((p) => p.id !== id),
                    // If deleted preset was selected, select first preset
                    selectedPresetId: state.selectedPresetId === id
                        ? state.presets[0]?.id ?? null
                        : state.selectedPresetId
                }));
            },

            selectPreset: (id: string | null) => {
                set({ selectedPresetId: id });
            },

            setCustomInstruction: (instruction: string) => {
                set({ customInstruction: instruction, selectedPresetId: null });
            },

            getActiveInstruction: () => {
                const state = get();
                if (state.selectedPresetId) {
                    const preset = state.presets.find(p => p.id === state.selectedPresetId);
                    return preset?.instruction ?? state.customInstruction;
                }
                return state.customInstruction;
            },

            resetToDefaults: () => {
                set({
                    presets: DEFAULT_PRESETS,
                    selectedPresetId: 'default-assistant',
                    customInstruction: ''
                });
            }
        }),
        {
            name: 'livego-instruction-presets'
        }
    )
);
