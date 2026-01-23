import React, { useState, memo } from 'react';

interface OnboardingProps {
    onComplete: () => void;
}

const slides = [
    {
        title: 'Welcome to LiveGo',
        description: 'Real-time voice conversations powered by Gemini AI',
        icon: '👋',
    },
    {
        title: 'Natural Conversations',
        description: 'Speak naturally - Gemini understands context and responds in real-time',
        icon: '🎙️',
    },
    {
        title: 'Always Learning',
        description: 'The more you chat, the better it understands you',
        icon: '🧠',
    },
];

const STORAGE_KEY = 'livego_onboarding_complete';

export function hasCompletedOnboarding(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markOnboardingComplete(): void {
    localStorage.setItem(STORAGE_KEY, 'true');
}

const OnboardingComponent: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(curr => curr + 1);
        } else {
            setIsExiting(true);
            setTimeout(() => {
                markOnboardingComplete();
                onComplete();
            }, 300);
        }
    };

    const handleSkip = () => {
        setIsExiting(true);
        setTimeout(() => {
            markOnboardingComplete();
            onComplete();
        }, 300);
    };

    return (
        <div
            className={`fixed inset-0 z-50 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex flex-col items-center justify-center transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
        >
            {/* Skip Button */}
            <button
                onClick={handleSkip}
                className="absolute top-6 right-6 text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
                Skip
            </button>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md">
                <div
                    key={currentSlide}
                    className="text-center animate-in fade-in slide-in-from-right duration-300"
                >
                    <span className="text-6xl mb-6 block">{slides[currentSlide]!.icon}</span>
                    <h2 className="text-3xl font-bold text-white mb-4">
                        {slides[currentSlide]!.title}
                    </h2>
                    <p className="text-white/80 text-lg leading-relaxed">
                        {slides[currentSlide]!.description}
                    </p>
                </div>
            </div>

            {/* Indicators */}
            <div className="flex gap-2 mb-8">
                {slides.map((_, index) => (
                    <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentSlide
                            ? 'bg-white w-6'
                            : 'bg-white/40'
                            }`}
                    />
                ))}
            </div>

            {/* Next Button */}
            <button
                onClick={handleNext}
                className="mb-12 px-12 py-4 bg-white text-indigo-600 font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all"
            >
                {currentSlide < slides.length - 1 ? 'Next' : 'Get Started'}
            </button>
        </div>
    );
};

export const Onboarding = memo(OnboardingComponent);
