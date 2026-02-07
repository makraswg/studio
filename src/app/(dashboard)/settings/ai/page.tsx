"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrainCircuit, Loader2, Save, Sparkles, Server, Cloud, Building2, Info, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { testOllamaConnectionAction, testOpenRouterConnectionAction } from '@/app/actions/ai-actions';
import { AiConfig } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function AiSettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({});

  const { data: configs, refresh } = usePluggableCollection<AiConfig>('aiConfigs');

  useEffect(() => {
    if (configs && configs.length > 0) setAiDraft(configs[0]);
    else setAiDraft({ id: 'ai-default', enabled: false, provider: 'ollama' });
  }, [configs]);

  const handleSave = async () => {
    if (!aiDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('aiConfigs', aiDraft.id, aiDraft, dataSource);
      if (res.success) {
        toast({ title: "KI-Einstellungen gespeichert" });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">KI Access Engine</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Intelligente Analyse von Berechtigungen & Prozessen</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-12">
          {/* Global Toggle */}
          <div className="flex items-center justify-between p-6 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <Label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">KI-Unterstützung aktiv</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Nutzt LLMs zur automatisierten Risiko-Bewertung und Prozess-Modellierung.</p>
            </div>
            <Switch checked={!!aiDraft.enabled} onCheckedChange={v => setAiDraft({...aiDraft, enabled: v})} />
          </div>

          {/* Provider Selection */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">KI Provider & Konnektivität</h3>
            </div>
            
            <Tabs value={aiDraft.provider} onValueChange={(v: any) => setAiDraft({...aiDraft, provider: v})} className="w-full">
              <TabsList className="grid grid-cols-3 h-12 bg-slate-100 dark:bg-slate-950 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
                <TabsTrigger value="ollama" className="rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                  <Server className="w-3.5 h-3.5" /> Ollama
                </TabsTrigger>
                <TabsTrigger value="google" className="rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                  <Cloud className="w-3.5 h-3.5" /> Gemini
                </TabsTrigger>
                <TabsTrigger value="openrouter" className="rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" /> OpenRouter
                </TabsTrigger>
              </TabsList>

              <div className="mt-8 p-6 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-950/50">
                <TabsContent value="ollama" className="space-y-6 mt-0 animate-in fade-in slide-in-from-top-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ollama Server URL</Label>
                      <Input value={aiDraft.ollamaUrl || ''} onChange={e => setAiDraft({...aiDraft, ollamaUrl: e.target.value})} placeholder="http://localhost:11434" className="rounded-lg h-11 border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Modellbezeichner</Label>
                      <Input value={aiDraft.ollamaModel || ''} onChange={e => setAiDraft({...aiDraft, ollamaModel: e.target.value})} placeholder="llama3" className="rounded-lg h-11 border-slate-200 dark:border-slate-800" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => testOllamaConnectionAction(aiDraft.ollamaUrl!).then(res => toast({title: "Ollama-Test", description: res.message}))} className="rounded-lg text-[9px] font-black uppercase h-9 px-6">Verbindung testen</Button>
                </TabsContent>

                <TabsContent value="google" className="space-y-6 mt-0 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-2 max-w-md">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gemini Modell auswählen</Label>
                    <Select value={aiDraft.geminiModel || 'gemini-1.5-flash'} onValueChange={v => setAiDraft({...aiDraft, geminiModel: v})}>
                      <SelectTrigger className="rounded-lg h-11 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Performance)</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Präzise)</SelectItem>
                        <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Next-Gen)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="openrouter" className="space-y-6 mt-0 animate-in fade-in slide-in-from-top-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">OpenRouter API Key</Label>
                      <Input type="password" value={aiDraft.openrouterApiKey || ''} onChange={e => setAiDraft({...aiDraft, openrouterApiKey: e.target.value})} placeholder="sk-or-v1-..." className="rounded-lg h-11 border-slate-200 dark:border-slate-800 font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Enterprise Modell</Label>
                      <Input value={aiDraft.openrouterModel || ''} onChange={e => setAiDraft({...aiDraft, openrouterModel: e.target.value})} placeholder="anthropic/claude-3.5-sonnet" className="rounded-lg h-11 border-slate-200 dark:border-slate-800" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => testOpenRouterConnectionAction(aiDraft.openrouterApiKey!).then(res => toast({title: "OpenRouter-Test", description: res.message}))} className="rounded-lg text-[9px] font-black uppercase h-9 px-6">Verbindung testen</Button>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="rounded-xl font-black uppercase text-xs tracking-[0.1em] h-12 px-12 gap-3 bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Konfiguration Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
