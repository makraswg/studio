"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Sparkles, 
  MousePointer2, 
  Wind, 
  Layers, 
  Zap, 
  Loader2, 
  Save, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { UiConfig } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function UxSettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [uxDraft, setUxDraft] = useState<Partial<UiConfig>>({
    enableAdvancedAnimations: true,
    enableQuickTours: true,
    enableGlassmorphism: true,
    enableConfetti: true
  });

  const { data: configs, refresh, isLoading } = usePluggableCollection<UiConfig>('uiConfigs');

  useEffect(() => {
    if (configs && configs.length > 0) {
      setUxDraft(configs[0]);
    } else {
      setUxDraft({ 
        id: 'ux-default', 
        enableAdvancedAnimations: true, 
        enableQuickTours: true, 
        enableGlassmorphism: true,
        enableConfetti: true
      });
    }
  }, [configs]);

  const handleSave = async () => {
    if (!uxDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('uiConfigs', uxDraft.id, uxDraft, dataSource);
      if (res.success) {
        toast({ title: "UX-Einstellungen gespeichert", description: "Einige Änderungen erfordern einen Seiten-Refresh." });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const UxCard = ({ 
    icon: Icon, 
    title, 
    desc, 
    checked, 
    onCheckedChange, 
    badge 
  }: { 
    icon: any, 
    title: string, 
    desc: string, 
    checked: boolean, 
    onCheckedChange: (v: boolean) => void,
    badge?: string
  }) => (
    <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl transition-all hover:shadow-md hover:border-primary/20 flex items-center justify-between group">
      <div className="flex items-center gap-5">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border shadow-inner",
          checked ? "bg-primary/10 text-primary border-primary/10 group-hover:scale-105" : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">{title}</Label>
            {badge && <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black h-4 px-1.5 uppercase">{badge}</Badge>}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase italic">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Erlebnis & Design</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Personalisierung der Plattform-Interaktion</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-10">
          <div className="p-6 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">System Performance</p>
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                Diese Einstellungen steuern die visuelle Qualität der Benutzeroberfläche. Auf älterer Hardware oder bei langsamen Verbindungen kann das Deaktivieren von Animationen die Reaktionszeit verbessern.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UxCard 
              icon={Wind}
              title="Erweiterte Animationen"
              desc="Weiche Übergänge und Einblend-Effekte für Seiten und Dialoge."
              checked={!!uxDraft.enableAdvancedAnimations}
              onCheckedChange={v => setUxDraft({...uxDraft, enableAdvancedAnimations: v})}
              badge="Standard"
            />
            <UxCard 
              icon={MousePointer2}
              title="Interaktive Hilfe-Touren"
              desc="Geführte Einführung für neue Administratoren in den Kernmodulen."
              checked={!!uxDraft.enableQuickTours}
              onCheckedChange={v => setUxDraft({...uxDraft, enableQuickTours: v})}
            />
            <UxCard 
              icon={Layers}
              title="Glassmorphism (Transparenz)"
              desc="Nutzt Blur-Effekte im Header und in Sidebars für mehr visuelle Tiefe."
              checked={!!uxDraft.enableGlassmorphism}
              onCheckedChange={v => setUxDraft({...uxDraft, enableGlassmorphism: v})}
            />
            <UxCard 
              icon={Zap}
              title="Feedback & Gamification"
              desc="Aktiviert visuelle Belohnungen (z.B. Konfetti) bei erfolgreichen Audits."
              checked={!!uxDraft.enableConfetti}
              onCheckedChange={v => setUxDraft({...uxDraft, enableConfetti: v})}
            />
          </div>

          <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isLoading} 
              className="rounded-xl font-black uppercase text-xs tracking-[0.1em] h-12 px-12 gap-3 bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
