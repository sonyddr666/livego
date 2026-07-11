import React from 'react';
import { IconChevronLeft } from './Icons';
import { useSkillsStore, type Skill } from '../store/skillsStore';

/**
 * SkillsScreen — Gerenciar skills (function calls) do Gemini
 * Cada skill pode ser ativada/desativada individualmente
 */

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  visual: { label: 'Visual', emoji: '🎨' },
  search: { label: 'Busca', emoji: '🔍' },
  data: { label: 'Dados & Histórico', emoji: '📊' },
  utility: { label: 'Utilidades', emoji: '🔧' },
};

const SkillCard: React.FC<{
  skill: Skill;
  onToggle: () => void;
  isLast?: boolean;
}> = ({ skill, onToggle, isLast }) => (
  <button
    type="button"
    role="switch"
    aria-checked={skill.enabled}
    onClick={onToggle}
    className={`w-full flex items-start gap-3 p-4 text-left hover:bg-theme-hover active:bg-theme-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-theme' : ''}`}
  >
    {/* Icon */}
    <span className="text-2xl mt-0.5 shrink-0" aria-hidden="true">
      {skill.icon}
    </span>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-semibold text-[15px] text-theme-primary">
          {skill.name}
        </span>
        {skill.isBuiltIn && (
          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
            built-in
          </span>
        )}
      </div>
      <p className="text-xs text-theme-secondary leading-relaxed line-clamp-2">
        {skill.description}
      </p>
      <p className="text-[10px] text-theme-muted mt-1 font-mono">
        fn: {skill.functionName}
      </p>
    </div>

    {/* Toggle */}
    <span
      className={`w-10 h-6 rounded-full relative transition-colors shrink-0 mt-1 ${skill.enabled ? 'bg-green-500' : 'bg-theme-tertiary'}`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.enabled ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </span>
  </button>
);

export const SkillsScreenContent: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { skills, toggleSkill, enableAll, disableAll, getEnabledSkills } = useSkillsStore();

  const enabledCount = getEnabledSkills().length;
  const totalCount = skills.length;

  // Group skills by category
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    const categorySkills = acc[skill.category] ?? [];
    categorySkills.push(skill);
    acc[skill.category] = categorySkills;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors"
        >
          <IconChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">
          Skills
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {/* Summary */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-primary">
              ⚡ {enabledCount} de {totalCount} skills ativas
            </span>
          </div>
          <p className="text-xs text-theme-secondary leading-relaxed">
            Skills são habilidades que o Gemini pode usar durante a conversa. Cada skill ativa é registrada como uma function no Gemini.
          </p>
          {/* Quick actions */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={enableAll}
              className="flex-1 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Ativar Todas
            </button>
            <button
              type="button"
              onClick={disableAll}
              className="flex-1 py-2 text-xs font-semibold bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-hover transition-colors"
            >
              Desativar Todas
            </button>
          </div>
        </div>

        {/* Skills by category */}
        {Object.entries(grouped).map(([category, categorySkills]) => {
          const catInfo = CATEGORY_LABELS[category] || { label: category, emoji: '📦' };
          return (
            <div key={category} className="mb-6">
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider ml-4 mb-2">
                {catInfo.emoji} {catInfo.label}
              </h3>
              <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme">
                {categorySkills.map((skill, i) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onToggle={() => toggleSkill(skill.id)}
                    isLast={i === categorySkills.length - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Info footer */}
        <p className="mt-2 text-xs text-theme-muted px-2 text-center pb-8">
          Skills ativas são registradas como function declarations na conexão com o Gemini. Alterações são aplicadas na próxima chamada.
        </p>
      </div>
    </div>
  );
};
