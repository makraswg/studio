
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  MessageSquare, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Check, 
  X, 
  Zap, 
  Plus, 
  Share2,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction } from '@/app/actions/process-actions';
import { getProcessSuggestions, ProcessDesignerOutput } from '@/ai/flows/process-designer-flow';
import { publishToBookStackAction } from '@/app/actions/bookstack-actions';
import { toast } from '@/hooks/use-toast';
import { Process, ProcessVersion, ProcessNode, ProcessModel, ProcessLayout } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach(node => {
    const pos = positions[node.id] || { x: 100, y: 100 };
    const style = node.type === 'start' ? 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;' : 
                  node.type === 'end' ? 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;' :
                  node.type === 'decision' ? 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;' :
                  'whiteSpace=wrap;html=1;rounded=1;fillColor=#f5f5f5;strokeColor=#666666;';
    
    xml += `<mxCell id="${node.id}" value="${node.title}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${pos.x}" y="${pos.y}" width="120" height="60" as="geometry"/>
    </mxCell>`;
  });

  edges.forEach(edge => {
    xml += `<mxCell id="${edge.id}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jetline=1;html=1;" edge="1" parent="1" source="${edge.source}" target="${edge.target}">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>`;
  });

  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const { user } = usePlatformAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ProcessDesignerOutput | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const { data: processes, isLoading: isProcLoading } = usePluggableCollection<Process>('processes');
  const { data: versions, isLoading: isVerLoading, refresh: refreshVersion } = usePluggableCollection<ProcessVersion>('process_versions');
  
  const currentProcess = useMemo(() => processes?.find(p => p.id === id), [processes, id]);
  const currentVersion = useMemo(() => versions?.find(v => v.process_id === id), [versions, id]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion) return;

    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string' || evt.data.length === 0) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
            action: 'load',
            xml: xml
          }), '*');
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion]);

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user) return;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(
        currentVersion.process_id,
        currentVersion.version,
        ops,
        currentVersion.revision,
        user.id,
        dataSource
      );
      if (res.success) {
        toast({ title: "Modell aktualisiert" });
        setAiSuggestions(null);
        refreshVersion();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const handleAiChat = async () => {
    if (!chatMessage.trim() || !currentVersion) return;
    setIsAiLoading(true);
    try {
      const suggestions = await getProcessSuggestions({
        userMessage: chatMessage,
        currentModel: currentVersion.model_json,
        dataSource
      });
      setAiSuggestions(suggestions);
      setChatMessage('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "KI-Fehler", description: e.message });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!mounted) return null;

  if ((isProcLoading || isVerLoading) && (!currentProcess || !currentVersion)) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lade Prozess-Modell...</p>
      </div>
    );
  }

  if (!currentProcess || !currentVersion) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="rounded-none border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-bold uppercase">Prozess nicht gefunden</AlertTitle>
          <AlertDescription className="text-xs">
            Der angeforderte Prozess existiert nicht oder die Daten konnten nicht geladen werden. 
            Bitte initialisieren Sie die Datenbank unter "Setup".
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/processhub')} className="mt-4 rounded-none uppercase text-[10px] font-bold">Zurück zur Übersicht</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-background">
      <div className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')}><ChevronLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wider">{currentProcess.title}</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black">V{currentVersion.version} | Rev {currentVersion.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-none h-8 text-[9px] font-bold uppercase"><Share2 className="w-3 h-3 mr-2" /> Export</Button>
          <Button size="sm" className="rounded-none h-8 text-[9px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700" disabled={isPublishing}>
            <BookOpen className="w-3 h-3 mr-2" /> Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[300px] border-r flex flex-col bg-slate-50/50">
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prozessschritte</span>
            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {(currentVersion.model_json.nodes || []).map((node: ProcessNode) => (
                <div key={node.id} className="p-3 bg-white border border-slate-200 group hover:border-primary transition-all cursor-pointer">
                  <Badge variant="outline" className="text-[8px] h-4 rounded-none mb-1">{node.type}</Badge>
                  <div className="font-bold text-xs">{node.title}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 relative bg-white flex flex-col">
          <iframe 
            ref={iframeRef}
            src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json"
            className="absolute inset-0 w-full h-full border-none"
          />
        </main>

        <aside className="w-[350px] border-l flex flex-col bg-white">
          <div className="p-4 border-b bg-slate-900 text-white flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 flex items-center justify-center rounded-sm">
              <Zap className="w-4 h-4 text-primary fill-current" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest block">AI Co-Pilot</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Vibecoding</span>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 bg-slate-50/30">
            <div className="space-y-6">
              {aiSuggestions ? (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                  <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-none space-y-4">
                    <p className="text-[11px] italic text-slate-700 leading-relaxed">"{aiSuggestions.explanation}"</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApplyOps(aiSuggestions.proposedOps)} disabled={isApplying} className="flex-1 h-9 rounded-none bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase">
                        Übernehmen
                      </Button>
                      <Button variant="outline" onClick={() => setAiSuggestions(null)} className="h-9 rounded-none text-[10px] font-black uppercase">X</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 opacity-20">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase">Schreiben Sie eine Anweisung</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input 
                placeholder="Anweisung..." 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiChat()}
                className="h-11 rounded-none border-2 text-xs"
                disabled={isAiLoading}
              />
              <Button size="icon" className="h-11 w-11 shrink-0 rounded-none bg-slate-900" onClick={handleAiChat} disabled={isAiLoading || !chatMessage}>
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
