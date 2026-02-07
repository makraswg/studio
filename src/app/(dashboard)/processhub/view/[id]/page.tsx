
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
  Lock,
  ListChecks,
  AlertTriangle,
  Lightbulb,
  ArrowDown,
  GitBranch,
  ArrowRight,
  Shield,
  History,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessVersion, ProcessNode, Tenant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportDetailedProcessPdf } from '@/lib/export-utils';

/**
 * Erzeugt BPMN 2.0 MX-XML für draw.io Integration (Read-Only Modus).
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
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;shadow=1;'; 
        w = 50; h = 50; 
        break;
      case 'end': 
        const hasLink = !!node.targetProcessId && node.targetProcessId !== 'none';
        style = hasLink 
          ? 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#e1f5fe;strokeColor=#0288d1;strokeWidth=3;shadow=1;' 
          : 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=4;shadow=1;'; 
        w = 50; h = 50; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;shadow=1;'; 
        w = 80; h = 80; 
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;shadow=1;';
        w = 160; h = 80;
    }
    xml += `<mxCell id="${nodeSafeId}" value="${node.title}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="edge-${idx}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=10;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
  const [viewMode, setViewMode] = useState<'diagram' | 'guide'>('diagram');
  const [isExporting, setIsExporting] = useState(false);

  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: auditLogs } = usePluggableCollection<any>('auditEvents');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  const currentTenant = useMemo(() => tenants?.find(t => t.id === currentProcess?.tenantId), [tenants, currentProcess]);
  
  const processAudit = useMemo(() => 
    auditLogs?.filter((e: any) => e.entityId === id && e.entityType === 'process')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [],
    [auditLogs, id]
  );

  useEffect(() => { setMounted(true); }, []);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || !currentVersion || viewMode !== 'diagram') return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 0 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [currentVersion, viewMode]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion?.model_json?.nodes?.length || viewMode !== 'diagram') return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagram();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagram, viewMode]);

  const handlePdfExport = async () => {
    if (!currentProcess || !currentVersion || !currentTenant) return;
    setIsExporting(true);
    try {
      await exportDetailedProcessPdf(currentProcess, currentVersion, currentTenant, jobTitles || []);
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 border border-emerald-500/20 overflow-hidden">
            {currentTenant?.logoUrl ? (
              <img src={currentTenant.logoUrl} alt="Logo" className="w-full h-full object-contain p-1 invert brightness-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900 truncate">{currentProcess?.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Offizielles Prozess-Stammblatt • V{currentVersion?.version}.0</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button 
              variant={viewMode === 'diagram' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg text-[10px] font-bold uppercase px-4"
              onClick={() => setViewMode('diagram')}
            >
              <Network className="w-3.5 h-3.5 mr-1.5" /> Visuell
            </Button>
            <Button 
              variant={viewMode === 'guide' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg text-[10px] font-bold uppercase px-4"
              onClick={() => setViewMode('guide')}
            >
              <ListChecks className="w-3.5 h-3.5 mr-1.5" /> Leitfaden
            </Button>
          </div>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button variant="outline" className="rounded-xl h-10 px-6 font-bold text-xs gap-2 border-slate-200 hover:bg-slate-50" onClick={handlePdfExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </Button>
          <Button className="rounded-xl h-10 px-8 font-bold text-xs bg-primary hover:bg-primary/90 text-white shadow-lg" onClick={() => router.push(`/processhub/${id}`)}>
            <FilePen className="w-4 h-4 mr-2" /> Designer
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-96 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
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
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {currentProcess?.regulatoryFramework ? (
                        <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-bold px-2 h-6">
                          <Shield className="w-3 h-3 mr-1.5" /> {currentProcess.regulatoryFramework}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Keine Regulatorik definiert</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortlichkeiten</h3>
                <div className="space-y-2">
                  {currentVersion?.model_json?.nodes?.filter((n: ProcessNode) => n.roleId && n.roleId !== 'none').map((n: ProcessNode, i: number) => {
                    const role = jobTitles?.find(j => j.id === n.roleId);
                    if (!role) return null;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{role.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold truncate italic">{n.title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Log & Historie</h3>
                <div className="space-y-3">
                  {processAudit.length === 0 ? (
                    <div className="p-4 border border-dashed rounded-xl text-center">
                      <History className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Keine Historie vorhanden</p>
                    </div>
                  ) : processAudit.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-900 flex items-center gap-1.5"><UserIcon className="w-2.5 h-2.5" /> {log.actorUid}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight italic">{log.action}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-100 relative">
          {viewMode === 'diagram' ? (
            <>
              <div className="absolute top-6 left-6 z-10">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">BPMN 2.0 Live</span>
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
            </>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 pb-32">
                <div className="space-y-8 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
                  
                  {currentVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => {
                    const role = jobTitles?.find(j => j.id === node.roleId);
                    const isStep = node.type === 'step';
                    const isDecision = node.type === 'decision';
                    const isStart = node.type === 'start';
                    const isEnd = node.type === 'end';
                    
                    const outgoing = currentVersion?.model_json?.edges?.filter((e: any) => String(e.source) === String(node.id)) || [];
                    
                    return (
                      <div key={node.id} className="relative z-10 pl-16">
                        <div className={cn(
                          "absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all",
                          isStart ? "bg-emerald-500 text-white border-emerald-600 scale-110" : 
                          isEnd ? "bg-red-500 text-white border-red-600 scale-110" : 
                          isDecision ? "bg-amber-100 text-amber-700 border-amber-200 rotate-45" : 
                          "bg-white dark:bg-slate-900 text-slate-600 border-slate-200"
                        )}>
                          <div className={cn(isDecision && "-rotate-45")}>
                            {isStart ? <ArrowDown className="w-6 h-6" /> : 
                             isEnd ? <CircleDot className="w-6 h-6" /> : 
                             isDecision ? <GitBranch className="w-5 h-5" /> : 
                             <span className="font-headline font-bold text-lg">{i + 1}</span>}
                          </div>
                        </div>

                        <Card className="rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all group">
                          <CardHeader className="p-6 bg-white dark:bg-slate-900 border-b flex flex-row items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white uppercase tracking-tight">{node.title}</h3>
                                {node.type !== 'start' && node.type !== 'end' && (
                                  <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200 bg-slate-50 text-slate-500 h-4">{node.type}</Badge>
                                )}
                              </div>
                              {role && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                                  <Briefcase className="w-3.5 h-3.5" /> {role.name}
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 space-y-6">
                            {node.description && (
                              <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Tätigkeitsbeschreibung</Label>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                  {node.description}
                                </p>
                              </div>
                            )}

                            {node.checklist && node.checklist.length > 0 && (
                              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                  <Label className="text-[9px] font-black uppercase text-slate-900 dark:text-white tracking-widest flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-emerald-600" /> Prüfschritte / Checkliste
                                  </Label>
                                  <Badge className="bg-emerald-600 text-white border-none rounded-full text-[8px] h-4 px-2">Compliance</Badge>
                                </div>
                                <div className="space-y-2 pt-1">
                                  {node.checklist.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                      <div className="w-4 h-4 rounded border-2 border-emerald-200 mt-0.5 flex items-center justify-center shrink-0">
                                        <CheckCircle className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-20 transition-opacity" />
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(node.tips || node.errors) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {node.tips && (
                                  <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                    <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-black uppercase text-blue-700 tracking-widest leading-none">Best Practice</p>
                                      <p className="text-[10px] text-slate-600 dark:text-slate-400 italic leading-relaxed">{node.tips}</p>
                                    </div>
                                  </div>
                                )}
                                {node.errors && (
                                  <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-black uppercase text-red-700 tracking-widest leading-none">Risiko-Prävention</p>
                                      <p className="text-[10px] text-slate-600 dark:text-slate-400 italic leading-relaxed">{node.errors}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {outgoing.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                  {isDecision ? 'Entscheidungswege' : 'Nächste Schritte'}
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {outgoing.map((edge: any, eIdx: number) => {
                                    const targetNode = currentVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.target));
                                    return (
                                      <div key={eIdx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 group/link">
                                        <div className="w-5 h-5 rounded bg-white dark:bg-slate-800 flex items-center justify-center border shadow-sm shrink-0">
                                          <ArrowRight className="w-3 h-3 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          {edge.label && <p className="text-[8px] font-black uppercase text-primary mb-0.5">{edge.label}</p>}
                                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{targetNode?.title || 'Unbekannt'}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}

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
            <p className="text-[9px] font-bold text-slate-500 italic uppercase tracking-tighter">ComplianceHub Process Viewer v2.5 (BPMN 2.0)</p>
          </div>
        </main>
      </div>
    </div>
  );
}
