"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles, 
  MousePointer2,
  Zap,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { UiConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export interface TourStep {
  target: string; // CSS Selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface QuickTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
}

export function QuickTour({ tourId, steps, onComplete }: QuickTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const { data: uiConfigs } = usePluggableCollection<UiConfig>('uiConfigs');
  const enableTours = useMemo(() => {
    if (!uiConfigs || uiConfigs.length === 0) return true; // Default true
    const config = uiConfigs[0];
    return config.enableQuickTours === true || config.enableQuickTours === 1;
  }, [uiConfigs]);

  useEffect(() => {
    setMounted(true);
    const hasSeen = localStorage.getItem(`tour_seen_${tourId}`);
    if (!hasSeen && enableTours) {
      // Delay starting the tour slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [tourId, enableTours]);

  useEffect(() => {
    if (!isVisible) return;

    const updatePosition = () => {
      const step = steps[currentStep];
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the element
        el.classList.add('ring-4', 'ring-primary', 'ring-offset-4', 'transition-all', 'duration-500', 'z-[101]', 'relative');
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      // Clean up highlights
      steps.forEach(s => {
        document.querySelector(s.target)?.classList.remove('ring-4', 'ring-primary', 'ring-offset-4', 'z-[101]', 'relative');
      });
    };
  }, [isVisible, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      // Remove old highlight before moving
      document.querySelector(steps[currentStep].target)?.classList.remove('ring-4', 'ring-primary', 'ring-offset-4', 'z-[101]', 'relative');
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      document.querySelector(steps[currentStep].target)?.classList.remove('ring-4', 'ring-primary', 'ring-offset-4', 'z-[101]', 'relative');
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`tour_seen_${tourId}`, 'true');
    setIsVisible(false);
    onComplete?.();
    // Clean up all highlights
    steps.forEach(s => {
      document.querySelector(s.target)?.classList.remove('ring-4', 'ring-primary', 'ring-offset-4', 'z-[101]', 'relative');
    });
  };

  if (!mounted || !isVisible || !enableTours) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with hole */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-500" />
      
      {/* Floating Info Card */}
      <div 
        className="absolute transition-all duration-500 pointer-events-auto"
        style={{ 
          top: `${coords.top + coords.height + 20}px`, 
          left: `${Math.min(window.innerWidth - 340, Math.max(20, coords.left))}px`,
          width: '320px'
        }}
      >
        <Card className="rounded-[2rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden animate-in zoom-in-95 duration-300">
          <CardHeader className="bg-slate-900 text-white py-4 px-6 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest">Plattform Guide</CardTitle>
            </div>
            <button onClick={handleComplete} className="text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <Badge className="mb-2 bg-primary/10 text-primary border-none rounded-full text-[8px] font-black uppercase px-2 h-4">
                Schritt {currentStep + 1} von {steps.length}
              </Badge>
              <h4 className="font-headline font-bold text-lg text-slate-900 dark:text-white leading-tight">{step.title}</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
              {step.content}
            </p>
          </CardContent>
          <CardFooter className="p-6 pt-0 flex items-center justify-between gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack} 
              disabled={currentStep === 0}
              className="rounded-xl h-9 px-4 text-[10px] font-black uppercase"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Zurück
            </Button>
            <Button 
              size="sm" 
              onClick={handleNext} 
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {currentStep === steps.length - 1 ? (
                <><Check className="w-3.5 h-3.5 mr-1.5" /> Starten</>
              ) : (
                <><ChevronRight className="w-3.5 h-3.5 mr-1.5" /> Weiter</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
