import React, { useEffect, useMemo, useState } from 'react';

type Recipe = {
  id: string;
  name: string;
  style: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  ideal: string;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
  method: string[];
};

const RECIPES: Recipe[] = [
  {
    id: 'chef-01',
    name: 'Golden Ember Risotto',
    style: 'Comfort + Precision',
    baseServings: 2,
    prepMinutes: 15,
    cookMinutes: 24,
    ideal: 'Layering heat and fat in small additions creates deep flavor without heaviness.',
    ingredients: [
      { name: 'Arborio rice', amount: 180, unit: 'g' },
      { name: 'Vegetable stock', amount: 800, unit: 'ml' },
      { name: 'Shallot', amount: 1, unit: 'unit' },
      { name: 'Parmesan', amount: 45, unit: 'g' },
      { name: 'Butter', amount: 25, unit: 'g' }
    ],
    method: [
      'Toast rice dry for 90 seconds to open starch.',
      'Add stock in 5 small rounds while stirring.',
      'Finish off heat with butter and parmesan.',
      'Rest 2 minutes before plating.'
    ]
  },
  {
    id: 'chef-02',
    name: 'Citrus Iron Chicken',
    style: 'Crisp + Bright',
    baseServings: 2,
    prepMinutes: 20,
    cookMinutes: 30,
    ideal: 'High-heat sear then moderate finish keeps skin crisp and center juicy.',
    ingredients: [
      { name: 'Chicken thigh', amount: 420, unit: 'g' },
      { name: 'Orange zest', amount: 1, unit: 'tbsp' },
      { name: 'Garlic', amount: 3, unit: 'cloves' },
      { name: 'Olive oil', amount: 2, unit: 'tbsp' },
      { name: 'Sea salt', amount: 1.2, unit: 'tsp' }
    ],
    method: [
      'Season and rest 10 minutes at room temperature.',
      'Sear skin side until deep amber.',
      'Flip, lower heat, and baste with citrus-garlic oil.',
      'Rest 5 minutes before slicing.'
    ]
  },
  {
    id: 'chef-03',
    name: 'Midnight Cocoa Pear',
    style: 'Dessert + Contrast',
    baseServings: 2,
    prepMinutes: 12,
    cookMinutes: 18,
    ideal: 'Bitterness + fruit acidity keeps sweetness elegant and modern.',
    ingredients: [
      { name: 'Pear', amount: 2, unit: 'units' },
      { name: 'Dark cocoa', amount: 20, unit: 'g' },
      { name: 'Brown sugar', amount: 35, unit: 'g' },
      { name: 'Greek yogurt', amount: 120, unit: 'g' },
      { name: 'Vanilla', amount: 0.5, unit: 'tsp' }
    ],
    method: [
      'Roast pear halves with sugar until caramelized.',
      'Dust cocoa in the last 3 minutes.',
      'Whip yogurt with vanilla for cold contrast.',
      'Serve hot pears over cold cream.'
    ]
  }
];

const FLAVOR_MATRIX = [
  { axis: 'Acid', move: 'add citrus / vinegar drops', effect: 'lifts heavy sauces' },
  { axis: 'Salt', move: 'micro pinch near finish', effect: 'sharpens aroma definition' },
  { axis: 'Fat', move: 'butter or olive emulsion', effect: 'extends finish on palate' },
  { axis: 'Heat', move: 'pepper layers, not single hit', effect: 'progressive warmth, less burn' }
];

const CHECKLIST = [
  'Knife and board ready',
  'Proteins tempered',
  'Stock warm',
  'Serving bowls heated',
  'Cleanup sink pre-filled'
];

function getDefaultRecipe(): Recipe {
  const recipe = RECIPES[0];
  if (!recipe) {
    throw new Error('No recipes configured.');
  }
  return recipe;
}

const DEFAULT_RECIPE = getDefaultRecipe();

const SegredoDoChefPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState(DEFAULT_RECIPE.id);
  const [servings, setServings] = useState(2);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [checkedPrep, setCheckedPrep] = useState<string[]>([]);

  const selectedRecipe = useMemo<Recipe>(() => {
    return RECIPES.find(item => item.id === selectedId) || DEFAULT_RECIPE;
  }, [selectedId]);

  const scaledIngredients = useMemo(() => {
    const multiplier = servings / selectedRecipe.baseServings;
    return selectedRecipe.ingredients.map(item => ({
      ...item,
      amount: Number((item.amount * multiplier).toFixed(2))
    }));
  }, [servings, selectedRecipe]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [remainingSeconds]);

  const timerLabel = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  const totalMinutes = selectedRecipe.prepMinutes + selectedRecipe.cookMinutes;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#f8f5ef] text-[#2b2218]">
      <div className="max-w-6xl mx-auto px-5 py-8 md:py-12 space-y-7">
        <section className="rounded-3xl bg-[linear-gradient(130deg,#2b2218_0%,#5a3920_45%,#a0602b_100%)] text-[#fff4e6] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.28em] opacity-80">Culinary Vault</p>
          <h1 className="text-3xl md:text-5xl font-black mt-2">Segredo do Chef</h1>
          <p className="max-w-3xl mt-3 text-[#ffe6cc]">
            Hidden kitchen page with full recipes, scaling engine, prep checklist, timer, and flavor strategy map.
            Each section follows a practical chef ideal: structure, precision, and service rhythm.
          </p>
        </section>

        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
          <article className="rounded-3xl border border-[#d8c7ac] bg-white p-5 md:p-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              {RECIPES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`px-3 py-2 rounded-xl border text-sm transition ${
                    item.id === selectedId
                      ? 'bg-[#2e1f12] text-[#fff1df] border-[#2e1f12]'
                      : 'bg-[#fffaf4] border-[#d8c7ac] hover:bg-[#f7efe4]'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#f7eee2] p-3">
                <p className="text-xs text-[#7b5f45]">Style</p>
                <p className="font-semibold">{selectedRecipe.style}</p>
              </div>
              <div className="rounded-2xl bg-[#f7eee2] p-3">
                <p className="text-xs text-[#7b5f45]">Total time</p>
                <p className="font-semibold">{totalMinutes} min</p>
              </div>
              <div className="rounded-2xl bg-[#f7eee2] p-3">
                <p className="text-xs text-[#7b5f45]">Chef ideal</p>
                <p className="font-semibold">{selectedRecipe.ideal}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Scaled Ingredients</h2>
                <label className="text-sm flex items-center gap-2">
                  Servings
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={servings}
                    onChange={event => setServings(Number(event.target.value))}
                    className="accent-[#5a3920]"
                  />
                  <span className="font-semibold">{servings}</span>
                </label>
              </div>

              <ul className="grid md:grid-cols-2 gap-2">
                {scaledIngredients.map(item => (
                  <li key={item.name} className="rounded-xl border border-[#eadbc6] bg-[#fffdf9] p-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-[#7b5f45]">{item.amount} {item.unit}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Method</h3>
              <ol className="space-y-2">
                {selectedRecipe.method.map((step, index) => (
                  <li key={step} className="rounded-xl bg-[#fff8ee] border border-[#ecdcc5] p-3 text-sm">
                    <span className="font-semibold mr-2">{index + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </article>

          <div className="space-y-5">
            <article className="rounded-3xl border border-[#d8c7ac] bg-white p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Service Timer</h2>
                <p className="font-mono text-2xl">{timerLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, selectedRecipe.cookMinutes].map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setRemainingSeconds(minutes * 60)}
                    className="px-3 py-2 rounded-xl bg-[#2e1f12] text-[#fff1df] text-sm hover:bg-[#4a2f1a]"
                  >
                    {minutes} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRemainingSeconds(0)}
                  className="px-3 py-2 rounded-xl border border-[#d8c7ac] text-sm hover:bg-[#f7efe4]"
                >
                  Reset
                </button>
              </div>
              <p className="text-sm text-[#7b5f45]">
                Use this for staging: sear, rest, and plate windows.
              </p>
            </article>

            <article className="rounded-3xl border border-[#d8c7ac] bg-white p-5 md:p-6 space-y-3">
              <h2 className="text-xl font-semibold">Mise en Place</h2>
              {CHECKLIST.map(item => {
                const checked = checkedPrep.includes(item);
                return (
                  <label key={item} className="flex items-center gap-3 rounded-xl bg-[#fff8ee] border border-[#ecdcc5] p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setCheckedPrep(prev => (
                          checked ? prev.filter(entry => entry !== item) : [...prev, item]
                        ));
                      }}
                      className="accent-[#5a3920]"
                    />
                    <span className="text-sm">{item}</span>
                  </label>
                );
              })}
            </article>

            <article className="rounded-3xl border border-[#d8c7ac] bg-white p-5 md:p-6 space-y-3">
              <h2 className="text-xl font-semibold">Flavor Matrix</h2>
              <div className="space-y-2">
                {FLAVOR_MATRIX.map(row => (
                  <div key={row.axis} className="rounded-xl border border-[#ecdcc5] bg-[#fffdf9] p-3">
                    <p className="text-sm font-semibold">{row.axis}</p>
                    <p className="text-sm text-[#7b5f45]">Move: {row.move}</p>
                    <p className="text-sm text-[#7b5f45]">Effect: {row.effect}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SegredoDoChefPage;
