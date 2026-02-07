"use client";

import { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  Check, 
  Send, 
  X, 
  FileEdit,
  Zap,
  Info,
  Sparkle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getFormSuggestions } from '@/ai/flows/form-assistant-flow';
import { useSettings } from '@/context/settings-context';
import { cn } from '@/lib/utils';

interface AiFormAssistantProps {
  formType: 'resource' | 'risk' | 'measure' | 'gdpr' | 'entitlement';
  currentData: any;
  onApply: (suggestions: any) => void;
}

export function AiFormAssistant({ formType, currentData, onApply }: AiFormAssistantProps) {
  const { dataSource, activeTenantId } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setHistory(prev => [...prev, { type: 'user', text: query }]);
    
    try {
      const res = await getFormSuggestions({
        formType: formType === 'entitlement' ? 'gdpr' : formType as any,
        partialData: currentData,
        userPrompt: query,
        tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
        dataSource
      });
      
      setHistory(prev => [...prev, { 
        type: 'ai', 
        text: res.explanation,
        suggestions: res.suggestions 
      }]);
      setQuery('');
    } catch (error) {
      setHistory(prev => [...prev, { type: 'ai', text: "Fehler bei der Anfrage." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Standardized AI Button according to DESIGN_GUIDE.md */}
      <Button 
        variant="outline" 
        size="sm" 
        className={cn(
          "h-9 rounded-xl border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 gap-2 font-bold text-[10px] uppercase tracking-widest shadow-sm transition-all",
          isOpen && "ring-2 ring-indigo-600 ring-offset-2"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <BrainCircuit className="w-4 h-4" />
        KI-Assistent
      </Button>

      {isOpen && (
        <div className="fixed bottom-0 md:bottom-20 right-0 md:right-8 w-full md:w-[450px] h-full md:h-[600px] bg-white border-none shadow-2xl z-[100] flex flex-col animate-in slide-in-from-bottom-4 md:rounded-2xl overflow-hidden ring-1 ring-slate-200">
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-lg border border-white/10">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest leading-none">Governance Intelligence</span>
                <span className="text-[9px] font-bold text-primary uppercase tracking-tight mt-1">KI-Assistenz aktiv</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white rounded-full transition-colors" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-5 bg-slate-50/50">
            <div className="space-y-6 pb-4">
              {history.length === 0 && (
                <div className="text-center py-16 space-y-4 opacity-40">
                  <Sparkles className="w-12 h-12 mx-auto text-primary" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-900">Bereit zur Analyse</p>
                    <p className="text-[10px] text-slate-500 italic max-w-[220px] mx-auto leading-relaxed">
                      Fragen Sie nach Risikobewertungen oder lassen Sie Felder automatisch ergänzen.
                    </p>
                  </div>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={cn("flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1", msg.type === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "p-4 text-[11px] font-medium leading-relaxed max-w-[90%] shadow-sm",
                    msg.type === 'user' 
                      ? "bg-slate-900 text-white rounded-2xl rounded-tr-none" 
                      : "bg-white border text-slate-700 rounded-2xl rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  {msg.suggestions && Object.keys(msg.suggestions).length > 0 && (
                    <div className="w-full space-y-2 mt-2 animate-in fade-in slide-in-from-top-2">
                      {/* Standardized Suggestion Box according to DESIGN_GUIDE.md: bg-blue-50 */}
                      <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl space-y-4 shadow-md group">
                        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                          <p className="text-[10px] font-black uppercase text-blue-700 flex items-center gap-2">
                            <Zap className="w-3 h-3 fill-current" /> KI-Strukturvorschlag
                          </p>
                          <Badge className="bg-blue-600 text-white border-none rounded-full text-[8px] font-black uppercase h-4 px-2">Neu</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(msg.suggestions).map(([key, val]: [string, any]) => (
                            <div key={key} className="text-[9px] flex items-center gap-2 bg-white/80 p-2 border border-blue-100 rounded-lg">
                              <span className="font-bold text-blue-600 uppercase min-w-[90px] shrink-0">{key}:</span>
                              <span className="text-slate-700 truncate font-medium">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase shadow-lg shadow-blue-200 gap-2 transition-all active:scale-95"
                          onClick={() => {
                            onApply(msg.suggestions);
                            setIsOpen(false);
                          }}
                        >
                          <Check className="w-4 h-4" /> Vorschläge übernehmen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border p-4 rounded-2xl flex items-center gap-3 shadow-sm border-blue-100">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">KI generiert Antwort...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-5 border-t bg-white shrink-0 shadow-2xl">
            <div className="flex gap-2">
              <Input 
                placeholder="Schreiben Sie eine Anweisung..." 
                value={query} 
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                className="h-12 text-xs rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                disabled={isLoading}
              />
              <Button size="icon" className="h-12 w-12 shrink-0 rounded-xl bg-slate-900 hover:bg-black text-white shadow-xl active:scale-95 transition-all" onClick={handleAsk} disabled={isLoading || !query}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
