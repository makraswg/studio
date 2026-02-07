"use client";

import { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  Check, 
  Send, 
  MessageSquare,
  ChevronRight,
  X,
  FileEdit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getFormSuggestions } from '@/ai/flows/form-assistant-flow';
import { useSettings } from '@/context/settings-context';
import { cn } from '@/lib/utils';

interface AiFormAssistantProps {
  formType: 'resource' | 'risk' | 'measure' | 'gdpr';
  currentData: any;
  onApply: (suggestions: any) => void;
}

export function AiFormAssistant({ formType, currentData, onApply }: AiFormAssistantProps) {
  const { dataSource } = useSettings();
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
        formType,
        partialData: currentData,
        userPrompt: query,
        dataSource
      });
      
      setHistory(prev => [...prev, { 
        type: 'ai', 
        text: res.explanation,
        suggestions: res.suggestions 
      }]);
      setQuery('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button 
        variant="outline" 
        size="sm" 
        className={cn(
          "h-8 rounded-none border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 gap-2 font-black uppercase text-[9px]",
          isOpen && "ring-2 ring-primary ring-offset-2"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <BrainCircuit className="w-3.5 h-3.5" />
        KI Hilfe
      </Button>

      {isOpen && (
        <div className="fixed bottom-0 md:bottom-20 right-0 md:right-8 w-full md:w-[450px] h-full md:h-[600px] bg-white border-2 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-bottom-4 border-slate-900 md:rounded-[1.5rem] overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest">KI Governance Assistent</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Auto-Fill Support aktiv</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4 bg-slate-50/50">
            <div className="space-y-6 pb-4">
              {history.length === 0 && (
                <div className="text-center py-16 space-y-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <BrainCircuit className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-900 uppercase">Bereit für Unterstützung</p>
                    <p className="text-[9px] text-slate-400 italic max-w-[200px] mx-auto leading-relaxed">
                      "Schlage eine Risikobewertung für Malware vor" oder "Erkläre den Zweck dieser SaaS-App".
                    </p>
                  </div>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={cn("flex flex-col gap-2", msg.type === 'user' ? "items-end" : "items-start")}>
                  <div className={cn(
                    "p-3 text-[11px] leading-relaxed max-w-[90%] border",
                    msg.type === 'user' ? "bg-slate-900 text-white border-slate-900 rounded-none" : "bg-white border-slate-200 shadow-sm text-slate-700 rounded-none"
                  )}>
                    {msg.text}
                  </div>
                  {msg.suggestions && Object.keys(msg.suggestions).length > 0 && (
                    <div className="w-full space-y-2 mt-1 animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-none space-y-3">
                        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                          <p className="text-[10px] font-black uppercase text-blue-700 flex items-center gap-2">
                            <FileEdit className="w-3 h-3" /> Strukturierte Vorschläge
                          </p>
                          <Badge className="bg-blue-600 text-white rounded-none text-[8px] font-black uppercase h-4">Validiert</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {Object.entries(msg.suggestions).map(([key, val]: [string, any]) => (
                            <div key={key} className="text-[9px] flex items-center gap-2 bg-white/50 p-1 px-2 border border-blue-50">
                              <span className="font-bold text-slate-500 uppercase min-w-[80px] shrink-0">{key}:</span>
                              <span className="text-slate-700 italic truncate font-medium">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full h-9 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase shadow-md gap-2"
                          onClick={() => {
                            onApply(msg.suggestions);
                            setIsOpen(false);
                          }}
                        >
                          <Check className="w-3.5 h-3.5" /> Vorschläge in Formular übernehmen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border p-3 rounded-none flex items-center gap-3 shadow-sm border-blue-200">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">KI analysiert Kontext...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-white shrink-0">
            <div className="flex gap-2">
              <Input 
                placeholder="Schreiben Sie eine Anweisung..." 
                value={query} 
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                className="h-11 text-xs rounded-none border-2 focus:ring-0 focus:border-slate-900 transition-all"
                disabled={isLoading}
              />
              <Button size="icon" className="h-11 w-11 shrink-0 rounded-none bg-slate-900 hover:bg-slate-800 text-white" onClick={handleAsk} disabled={isLoading || !query}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
