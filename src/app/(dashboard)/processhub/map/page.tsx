"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Workflow, 
  Loader2, 
  ChevronRight, 
  ArrowRight,
  GitBranch,
  Layers,
  Search,
  Network,
  ChevronLeft,
  Maximize2,
  RefreshCw,
  Filter,
  Check,
  X,
  ArrowRightCircle,
  Eye,
  Map as MapIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { useRouter } from 'next/navigation';
import { Process, ProcessVersion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

function generateMapXml(processes: Process[], relations: { fromId: string; toId: string; label: string }[]) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  
  const nodeWidth = 200;
  const nodeHeight = 60;
  const spacingX = 300;
  const spacingY = 120;
  const cols = 3;

  processes.forEach((proc, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = 50 + col * spacingX;
    const y = 50 + row * spacingY;
    
    let style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;fontStyle=1;fontSize=12;';
    if (proc.status === 'published') {
      style += 'fillColor=#f0fdf4;strokeColor=#166534;';
    }

    xml += `<mxCell id="${proc.id}" value="${proc.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry"/></mxCell>`;
  });

  relations.forEach((rel, idx) => {
    const sourceExists = processes.some(p => p.id === rel.fromId);
    const targetExists = processes.some(p => p.id === rel.toId);
    
    if (sourceExists && targetExists) {
      xml += `<mxCell id="rel-${idx}" value="${rel.label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#3b82f6;strokeWidth=2;fontSize=9;fontColor=#1e40af;" edge="1" parent="1" source="${rel.fromId}" target="${rel.toId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });

  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessMapPage() {
  const router = useRouter();
  const { activeTenantId } = useSettings();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('cards');
  const [search, setSearch] = useState('');
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);

  const { data: processes, isLoading: isProcLoading } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');

  useEffect(() => { setMounted(true); }, []);

  const allRelations = useMemo(() => {
    if (!processes || !versions) return [];
    const relations: { fromId: string; toId: string; label: string }[] = [];
    
    versions.forEach(ver => {
      const nodes = ver.model_json?.nodes || [];
      nodes.filter(n => n.type === 'end' && !!n.targetProcessId && n.targetProcessId !== 'none').forEach(node => {
        relations.push({
          fromId: ver.process_id,
          toId: node.targetProcessId!,
          label: node.title
        });
      });
    });
    
    return relations;
  }, [processes, versions]);

  const filteredProcesses = useMemo(() => {
    if (!processes) return [];
    return processes.filter(p => {
      const matchTenant = activeTenantId === 'all' || p.tenantId === activeTenantId;
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
      return matchTenant && matchSearch;
    });
  }, [processes, search, activeTenantId]);

  const mapProcesses = useMemo(() => {
    if (selectedProcessIds.length === 0) return filteredProcesses;
    return filteredProcesses.filter(p => selectedProcessIds.includes(p.id));
  }, [filteredProcesses, selectedProcessIds]);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || isProcLoading) return;
    const xml = generateMapXml(mapProcesses, allRelations);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [mapProcesses, allRelations, isProcLoading]);

  useEffect(() => {
    if (activeTab === 'diagram' && mounted) {
      const handleMessage = (evt: MessageEvent) => {
        if (!evt.data || typeof evt.data !== 'string') return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === 'init') syncDiagram();
        } catch (e) {}
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [activeTab, mounted, syncDiagram]);

  if (!mounted) return null;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-120px)] flex flex-col -m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 border border-primary/10">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900">Prozesslandkarte</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Unternehmensweite Gesamtsicht & Vernetzung</p>
          </div>
        </div>

        <TabsList className="bg-slate-100 p-1 h-10 rounded-xl border gap-1">
          <TabsTrigger value="cards" className="rounded-lg text-[10px] font-bold uppercase data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
            <Layers className="w-3.5 h-3.5 mr-2" /> Kachel-Ansicht
          </TabsTrigger>
          <TabsTrigger value="diagram" className="rounded-lg text-[10px] font-bold uppercase data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
            <MapIcon className="w-3.5 h-3.5 mr-2" /> Diagramm-Ansicht
          </TabsTrigger>
        </TabsList>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r bg-white flex flex-col shrink-0">
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Suchen & Filtern</Label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Prozessname..." 
                  className="pl-9 h-10 text-xs rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Selektive Auswahl</Label>
                {selectedProcessIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[8px] font-bold uppercase text-red-600 px-2" onClick={() => setSelectedProcessIds([])}>Reset</Button>
                )}
              </div>
              <ScrollArea className="h-[calc(100vh-400px)] -mx-6 px-6">
                <div className="space-y-1.5">
                  {filteredProcesses.map(proc => (
                    <div 
                      key={proc.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-xl transition-all cursor-pointer bg-white group shadow-sm",
                        selectedProcessIds.includes(proc.id) ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-300"
                      )}
                      onClick={() => setSelectedProcessIds(prev => 
                        prev.includes(proc.id) ? prev.filter(id => id !== proc.id) : [...prev, proc.id]
                      )}
                    >
                      <Checkbox checked={selectedProcessIds.includes(proc.id)} className="rounded-md shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{proc.title}</p>
                        <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">V{proc.currentVersion}.0 • {proc.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          <div className="mt-auto p-6 bg-slate-50 border-t">
            <div className="p-4 bg-white border border-dashed border-slate-200 text-center space-y-2 rounded-2xl shadow-inner">
              <p className="text-[10px] font-bold uppercase text-slate-400">Netzwerk-Statistik</p>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xl font-bold text-slate-900">{filteredProcesses.length}</p><p className="text-[8px] font-bold uppercase text-slate-400">Prozesse</p></div>
                <div><p className="text-xl font-bold text-primary">{allRelations.length}</p><p className="text-[8px] font-bold uppercase text-slate-400">Links</p></div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 relative overflow-hidden">
          <TabsContent value="cards" className="h-full m-0 p-8 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mapProcesses.map(proc => {
                const outgoing = allRelations.filter(r => r.fromId === proc.id);
                const incoming = allRelations.filter(r => r.toId === proc.id);
                
                return (
                  <Card key={proc.id} className="rounded-2xl border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group flex flex-col bg-white overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-4 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Workflow className="w-4 h-4 text-primary" />
                          <CardTitle className="text-xs font-bold truncate max-w-[200px]">{proc.title}</CardTitle>
                        </div>
                        <Badge className="bg-primary text-white border-none rounded-full text-[8px] h-4 px-2">V{proc.currentVersion}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 flex-1 flex flex-col space-y-6">
                      <div className="space-y-3 flex-1">
                        <p className="text-[9px] font-bold uppercase text-slate-400 border-b pb-1 tracking-wider">Eingang (Handover)</p>
                        <div className="space-y-1.5">
                          {incoming.length > 0 ? incoming.map((rel, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 border border-dashed rounded-lg italic text-slate-600">
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              {processes?.find(p => p.id === rel.fromId)?.title}
                            </div>
                          )) : <p className="text-[9px] text-slate-300 italic px-2">Keine direkten Vorgänger</p>}
                        </div>
                      </div>

                      <div className="space-y-3 flex-1">
                        <p className="text-[9px] font-bold uppercase text-emerald-600 border-b pb-1 tracking-wider">Folgeprozesse (Output)</p>
                        <div className="space-y-1.5">
                          {outgoing.length > 0 ? outgoing.map((rel, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] bg-emerald-50/30 p-2 border border-emerald-100 rounded-lg font-bold text-emerald-900 group-hover:bg-emerald-50 transition-colors">
                              <ArrowRightCircle className="w-3 h-3 text-emerald-500" />
                              {processes?.find(p => p.id === rel.toId)?.title}
                            </div>
                          )) : <p className="text-[9px] text-slate-300 italic px-2">Keine Handover definiert</p>}
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <Button 
                          className="w-full h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest gap-2 shadow-lg transition-all active:scale-95"
                          onClick={() => router.push(`/processhub/${proc.id}`)}
                        >
                          Modellierung öffnen <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="diagram" className="h-full m-0 p-6 flex flex-col">
            <div className="absolute top-10 right-10 z-10 bg-white/95 backdrop-blur-md shadow-2xl border rounded-2xl p-1.5 flex flex-col gap-1.5">
              <TooltipProvider>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagram} className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-all"><RefreshCw className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Aktualisieren</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-all"><Maximize2 className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Zentrieren</TooltipContent></Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1 bg-white shadow-inner border-2 rounded-2xl relative overflow-hidden">
              <iframe 
                ref={iframeRef} 
                src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" 
                className="absolute inset-0 w-full h-full border-none" 
              />
            </div>
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 mt-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm" /> Freigegeben</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-slate-400 rounded-sm" /> Entwurf</div>
                <div className="flex items-center gap-2 text-primary"><ArrowRight className="w-3 h-3" /> Relation</div>
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic">Interaktive Prozesslandschaft</p>
            </div>
          </TabsContent>
        </main>
      </div>

      {isProcLoading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white animate-pulse">Lade Prozess-Infrastruktur...</p>
        </div>
      )}
    </Tabs>
  );
}
