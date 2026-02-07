"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  ShieldCheck,
  Activity, 
  RefreshCw, 
  ChevronRight,
  ClipboardList,
  FilePen,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  Info,
  Briefcase,
  FileDown,
  Download,
  Building2,
  CheckCircle,
  Network,
  Eye,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessVersion, ProcessNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Erzeugt MX-XML für draw.io Integration (Read-Only Modus).
 */
function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-${idx}`);
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 160, h = 80;
    
    switch (node.type) {
      case 'start': 
        style = 'ellipse;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;shadow=1;'; 
        w = 60; h = 60; 
        break;
      case 'end': 
        const hasLink = !!node.targetProcessId && node.targetProcessId !== 'none';
        style = hasLink 
          ? 'ellipse;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;shadow=1;' 
          : 'ellipse;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=3;shadow=1;'; 
        w = 60; h = 60; 
        break;
      case 'decision': 
        style = 'rhombus;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;shadow=1;'; 
        w = 100; h = 100; 
        break;
      default: 
        style = 'whiteSpace=wrap;html=1;rounded=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;shadow=1;';
    }
    xml += `<mxCell id="${nodeSafeId}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="edge-${idx}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || !currentVersion) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    // UI=min, read-only via params oder messages steuerbar. Hier nutzen wir die Standard-Embed mit gesperrtem Editor
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 0 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [currentVersion]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion?.model_json?.nodes?.length) return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagram();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagram]);

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900">{currentProcess?.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Offizielles Prozess-Stammblatt • V{currentVersion?.version}.0</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl h-10 px-6 font-bold text-xs gap-2 border-slate-200 hover:bg-slate-50">
            <Download className="w-4 h-4" /> PDF Bericht
          </Button>
          <Button className="rounded-xl h-10 px-8 font-bold text-xs bg-primary hover:bg-primary/90 text-white shadow-lg" onClick={() => router.push(`/processhub/${id}`)}>
            <FilePen className="w-4 h-4 mr-2" /> Designer öffnen
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-96 border-r bg-white flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Übersicht</h3>
                  <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black">{currentProcess?.status}</Badge>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 shadow-inner">
                  <div>
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Zusammenfassung</Label>
                    <p className="text-xs text-slate-700 leading-relaxed mt-1">{currentProcess?.description || 'Keine Beschreibung vorhanden.'}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-200/50">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Regulatorik</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="rounded-md border-slate-200 text-[9px] font-bold text-slate-500">ISO 9001</Badge>
                      <Badge variant="outline" className="rounded-md border-slate-200 text-[9px] font-bold text-slate-500">BSI Grundschutz</Badge>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortlichkeiten</h3>
                <div className="space-y-2">
                  {currentVersion?.model_json?.nodes?.filter((n: ProcessNode) => n.roleId && n.roleId !== 'none').map((n: ProcessNode, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{jobTitles?.find(j => j.id === n.roleId)?.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold truncate italic">{n.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prozess-Vernetzung</h3>
                <div className="p-5 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center py-10 opacity-40">
                  <Network className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-[10px] font-bold">Keine systemweiten Abhängigkeiten dokumentiert</p>
                </div>
              </section>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-100 relative">
          <div className="absolute top-6 left-6 z-10">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Live Visualisierung</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5 text-slate-400">
                <Lock className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase">Schreibgeschützt</span>
              </div>
            </div>
          </div>

          <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-md shadow-2xl border rounded-2xl p-1.5 flex flex-col gap-1.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagram} className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-all"><RefreshCw className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Refresh</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-all"><Maximize2 className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Zentrieren</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex-1 bg-white relative overflow-hidden shadow-inner">
            {currentVersion?.model_json?.nodes?.length ? (
              <iframe 
                ref={iframeRef} 
                src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" 
                className="absolute inset-0 w-full h-full border-none" 
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <Workflow className="w-16 h-16 opacity-10 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Keine Prozessschritte definiert</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-2xl">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Start / Ende</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-white shadow-sm" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Prozessschritt</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400 rotate-45 border border-amber-600 shadow-sm" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Entscheidung</span>
              </div>
            </div>
            <p className="text-[9px] font-bold text-slate-500 italic uppercase tracking-tighter">ComplianceHub Process Viewer v2.3</p>
          </div>
        </main>
      </div>
    </div>
  );
}
