
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
  Map as MapIcon,
  Building2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { useRouter } from 'next/navigation';
import { Process, ProcessVersion, Department } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function escapeXml(unsafe: string) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

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

    xml += `<mxCell id="${proc.id}" value="${escapeXml(proc.title)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry"/></mxCell>`;
  });

  relations.forEach((rel, idx) => {
    const sourceExists = processes.some(p => p.id === rel.fromId);
    const targetExists = processes.some(p => p.id === rel.toId);
    
    if (sourceExists && targetExists) {
      xml += `<mxCell id="rel-${idx}" value="${escapeXml(rel.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#3b82f6;strokeWidth=2;fontSize=9;fontColor=#1e40af;" edge="1" parent="1" source="${rel.fromId}" target="${rel.toId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);

  const { data: processes, isLoading: isProcLoading } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: departments } = usePluggableCollection<Department>('departments');

  useEffect(() => { setMounted(true); }, []);

  const allRelations = useMemo(() => {
    if (!processes || !versions) return [];
    const relations: { fromId: string; toId: string; label: string }[] = [];
    
    versions.forEach(ver => {
      const nodes = ver.model_json?.nodes || [];
      nodes.filter(n => (n.type === 'end' || n.type === 'subprocess') && !!n.targetProcessId && n.targetProcessId !== 'none').forEach(node => {
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
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchDept = deptFilter === 'all' || p.responsibleDepartmentId === deptFilter;
      return matchTenant && matchSearch && matchStatus && matchDept;
    });
  }, [processes, search, statusFilter, deptFilter, activeTenantId]);

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
    <div className="p-4 md:p-8 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">ProcessHub Map</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Prozesslandkarte</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Unternehmensweite Gesamtsicht & Vernetzung.</p>
          </div>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 h-10 rounded-xl border gap-1">
          <button 
            className={cn("px-4 rounded-lg text-[10px] font-bold uppercase transition-all", activeTab === 'cards' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setActiveTab('cards')}
          >
            <Layers className="w-3.5 h-3.5 inline mr-2" /> Kacheln
          </button>
          <button 
            className={cn("px-4 rounded-lg text-[10px] font-bold uppercase transition-all", activeTab === 'diagram' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
            onClick={() => setActiveTab('diagram')}
          >
            <MapIcon className="w-3.5 h-3.5 inline mr-2" /> Grafik
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-220px)] border rounded-2xl bg-white dark:bg-slate-950 shadow-sm">
        <aside className="w-80 border-r bg-slate-50/50 dark:bg-slate-900/50 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
            <div className="space-y-4 shrink-0">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Suchen & Filtern</Label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Prozessname..." 
                  className="pl-9 h-10 text-xs rounded-lg border-slate-200 bg-white shadow-none"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-[10px] font-bold uppercase bg-white border-slate-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="published">Freigegeben</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 text-[10px] font-bold uppercase bg-white border-slate-200">
                    <SelectValue placeholder="Abteilung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Abteilungen</SelectItem>
                    {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Auswahl ({selectedProcessIds.length})</Label>
                {selectedProcessIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-red-600 px-2" onClick={() => setSelectedProcessIds([])}>Reset</Button>
                )}
              </div>
              <ScrollArea className="flex-1 -mx-2 px-2">
                <div className="space-y-1.5 pb-10">
                  {filteredProcesses.map(proc => (
                    <div 
                      key={proc.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-xl transition-all cursor-pointer bg-white group shadow-sm",
                        selectedProcessIds.includes(proc.id) ? "border-primary bg-primary/5 ring-1 ring-primary/10" : "border-slate-100 hover:border-slate-200"
                      )}
                      onClick={() => setSelectedProcessIds(prev => 
                        prev.includes(proc.id) ? prev.filter(id => id !== proc.id) : [...prev, proc.id]
                      )}
                    >
                      <Checkbox checked={selectedProcessIds.includes(proc.id)} className="rounded-md shrink-0 h-4 w-4" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{proc.title}</p>
                        <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">V{proc.currentVersion}.0 • {proc.status}</p>
                      </div>
                    </div>
                  ))}
                  {filteredProcesses.length === 0 && (
                    <div className="py-10 text-center opacity-30 italic text-[10px]">Keine Prozesse im Filter</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          <div className="mt-auto p-6 bg-white border-t shrink-0">
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 text-center space-y-2 rounded-2xl shadow-inner">
              <p className="text-[10px] font-bold uppercase text-slate-400">Netzwerk-Statistik</p>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xl font-bold text-slate-900">{mapProcesses.length}</p><p className="text-[8px] font-bold uppercase text-slate-400">Sichtbar</p></div>
                <div><p className="text-xl font-bold text-primary">{allRelations.length}</p><p className="text-[8px] font-bold uppercase text-slate-400">Relationen</p></div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
          {activeTab === 'cards' ? (
            <ScrollArea className="h-full p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
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
                            className="w-full h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest gap-2 shadow-lg transition-all active:scale-[0.98]"
                            onClick={() => router.push(`/processhub/view/${proc.id}`)}
                          >
                            Ansehen <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-full flex flex-col p-6">
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
                  <div className="flex items-center gap-2 text-primary"><ArrowRight className="w-3 h-3" /> Link</div>
                </div>
                <p className="text-[9px] font-bold text-slate-400 italic">Interaktives Ökosystem</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {isProcLoading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white animate-pulse">Lade Ökosystem...</p>
        </div>
      )}
    </div>
  );
}
