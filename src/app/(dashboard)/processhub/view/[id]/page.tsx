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
  User as UserIcon,
  Layers,
  ChevronDown,
  ArrowUpRight,
  Split,
  FileText,
  FileEdit,
  ArrowRightCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessVersion, ProcessNode, Tenant, Department, RegulatoryOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { exportDetailedProcessPdf } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';

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
      case 'start': style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;shadow=1;'; w = 50; h = 50; break;
      case 'end': style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=4;shadow=1;'; w = 50; h = 50; break;
      case 'decision': style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;shadow=1;'; w = 80; h = 80; break;
      default: style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#334155;strokeWidth=2;shadow=1;'; w = 160; h = 80;
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
  const [viewMode, setViewMode] = useState<'diagram' | 'guide'>('guide');
  const [isExporting, setIsExporting] = useState(false);
  
  // Versions Management
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: regulatoryOptions } = usePluggableCollection<RegulatoryOption>('regulatory_options');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: auditLogs } = usePluggableCollection<any>('auditEvents');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const allProcessVersions = useMemo(() => 
    versions?.filter((v: any) => v.process_id === id).sort((a: any, b: any) => b.version - a.version) || [],
    [versions, id]
  );

  const activeVersion = useMemo(() => {
    if (selectedVersionNum === null) return allProcessVersions[0];
    return allProcessVersions.find((v: any) => v.version === selectedVersionNum);
  }, [allProcessVersions, selectedVersionNum]);

  const versionAuditLog = useMemo(() => {
    if (!activeVersion) return null;
    return auditLogs?.find((e: any) => e.entityId === id && e.entityType === 'process' && e.action.includes(`Version ${activeVersion.version}.0`));
  }, [auditLogs, id, activeVersion]);

  const currentTenant = useMemo(() => tenants?.find(t => t.id === currentProcess?.tenantId), [tenants, currentProcess]);
  const currentDept = useMemo(() => departments?.find(d => d.id === currentProcess?.responsibleDepartmentId), [departments, currentProcess]);
  
  const processAudit = useMemo(() => 
    auditLogs?.filter((e: any) => e.entityId === id && e.entityType === 'process')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [],
    [auditLogs, id]
  );

  const regulatoryFrameworks = useMemo(() => {
    if (!currentProcess?.regulatoryFramework) return [];
    try {
      const ids = JSON.parse(currentProcess.regulatoryFramework);
      return Array.isArray(ids) ? ids.map(rid => regulatoryOptions?.find(o => o.id === rid)).filter(Boolean) : [];
    } catch (e) { return []; }
  }, [currentProcess, regulatoryOptions]);

  const incomingProcessLinks = useMemo(() => {
    if (!processes || !versions || !id) return [];
    const links: any[] = [];
    versions.forEach((v: any) => {
      if (v.process_id === id) return;
      const hasLink = v.model_json?.nodes?.some((n: any) => n.targetProcessId === id);
      if (hasLink) {
        const p = processes.find(proc => proc.id === v.process_id);
        if (p) links.push({ id: p.id, title: p.title });
      }
    });
    return links;
  }, [processes, versions, id]);

  const outgoingProcessLinks = useMemo(() => {
    if (!activeVersion || !processes) return [];
    const targetIds = (activeVersion.model_json?.nodes || [])
      .filter((n: any) => n.targetProcessId && n.targetProcessId !== 'none')
      .map((n: any) => n.targetProcessId);
    return processes.filter(p => targetIds.includes(p.id));
  }, [activeVersion, processes]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || !activeVersion || viewMode !== 'diagram') return;
    const xml = generateMxGraphXml(activeVersion.model_json, activeVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 0 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [activeVersion, viewMode]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !activeVersion || viewMode !== 'diagram') return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagram();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, activeVersion, syncDiagram, viewMode]);

  const handlePdfExport = async () => {
    if (!currentProcess || !activeVersion || !currentTenant) return;
    setIsExporting(true);
    try {
      await exportDetailedProcessPdf(currentProcess, activeVersion, currentTenant, jobTitles || []);
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900 truncate">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Offizielles Prozess-Stammblatt</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl text-[10px] font-bold uppercase border-slate-200 gap-2 shadow-sm bg-white">
                <History className="w-4 h-4 text-primary" /> Version {activeVersion?.version}.0
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-1 shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-3 py-2 tracking-widest">Versionsverlauf</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-64">
                {allProcessVersions.map(v => (
                  <DropdownMenuItem 
                    key={v.id} 
                    onSelect={() => setSelectedVersionNum(v.version)}
                    className={cn("rounded-lg px-3 py-2 cursor-pointer transition-all", activeVersion?.version === v.version ? "bg-primary/5 text-primary" : "hover:bg-slate-50")}
                  >
                    <div className="flex-1">
                      <p className="text-xs font-bold">Version {v.version}.0</p>
                      <p className="text-[9px] text-slate-400 font-medium">Revidiert am {new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                    {activeVersion?.version === v.version && <CheckCircle className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-8 mx-1" />
          
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={viewMode === 'diagram' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('diagram')}><Network className="w-3.5 h-3.5 mr-1.5" /> Visuell</Button>
            <Button variant={viewMode === 'guide' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('guide')}><ListChecks className="w-3.5 h-3.5 mr-1.5" /> Leitfaden</Button>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="rounded-xl h-10 px-6 font-bold text-xs border-slate-200 gap-2 hover:bg-primary hover:text-white transition-all shadow-sm"
              onClick={() => router.push(`/processhub/${id}`)}
            >
              <FileEdit className="w-4 h-4" /> Designer
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl h-10 px-4 font-bold text-xs border-slate-200" 
              onClick={handlePdfExport} 
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-96 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Stammdaten & Verantwortung</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 shadow-inner">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-slate-400">Verantwortliche Abteilung</Label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm font-black uppercase tracking-tight">{currentDept?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                    <Separator className="bg-slate-200/50" />
                    <div>
                      <Label className="text-[9px] font-black uppercase text-slate-400">Zusammenfassung</Label>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1">{currentProcess?.description || '---'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Compliance & Regulatorik</Label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {regulatoryFrameworks.length > 0 ? regulatoryFrameworks.map((r: any) => (
                        <Badge key={r.id} variant="outline" className="rounded-md border-primary/20 bg-primary/5 text-primary text-[9px] font-black px-2 h-6 uppercase tracking-wider">
                          <Shield className="w-3 h-3 mr-1.5" /> {r.name}
                        </Badge>
                      )) : <span className="text-[10px] text-slate-300 italic">Keine Normen verknüpft</span>}
                    </div>
                  </div>
                </div>
              </section>

              {activeVersion && versionAuditLog && (
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Revisions-Snapshot
                  </h3>
                  <div className="p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100 space-y-2">
                    <p className="text-[11px] font-bold text-emerald-900 leading-relaxed italic">
                      "{versionAuditLog.action}"
                    </p>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-600 uppercase pt-1">
                      <UserIcon className="w-3 h-3" /> {versionAuditLog.actorUid}
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Prozess-Vernetzung</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Vorgänger-Prozesse</Label>
                    <div className="space-y-1.5">
                      {incomingProcessLinks.length > 0 ? incomingProcessLinks.map(p => (
                        <div key={p.id} className="p-2.5 rounded-xl border border-dashed bg-slate-50 flex items-center justify-between group">
                          <span className="text-[10px] font-bold text-slate-600 truncate flex-1">{p.title}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button>
                        </div>
                      )) : <p className="text-[10px] text-slate-300 italic px-1">Keine</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Ziel-Prozesse (Output)</Label>
                    <div className="space-y-1.5">
                      {outgoingProcessLinks.length > 0 ? outgoingProcessLinks.map(p => (
                        <div key={p.id} className="p-2.5 rounded-xl border bg-primary/5 border-primary/10 flex items-center justify-between group">
                          <span className="text-[10px] font-bold text-primary truncate flex-1">{p.title}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => router.push(`/processhub/view/${p.id}`)}><ExternalLink className="w-3 h-3" /></Button>
                        </div>
                      )) : <p className="text-[10px] text-slate-300 italic px-1">Keine</p>}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Historie</h3>
                <div className="space-y-3">
                  {processAudit.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5 transition-all hover:bg-white hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-900 flex items-center gap-1.5 uppercase"><UserIcon className="w-2.5 h-2.5" /> {log.actorUid}</span>
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
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">BPMN 2.0 Live</span></div>
                  <Separator orientation="vertical" className="h-4" /><div className="flex items-center gap-1.5 text-slate-400"><Lock className="w-3 h-3" /><span className="text-[9px] font-bold uppercase">Version {activeVersion?.version}.0</span></div>
                </div>
              </div>
              <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-md shadow-2xl border rounded-2xl p-1.5 flex flex-col gap-1.5">
                <TooltipProvider>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={syncDiagram} className="h-9 w-9 rounded-xl"><RefreshCw className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Refresh</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*')} className="h-9 w-9 rounded-xl"><Maximize2 className="w-4 h-4 text-slate-600" /></Button></TooltipTrigger><TooltipContent side="left" className="text-[10px] font-bold uppercase">Zentrieren</TooltipContent></Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex-1 bg-white relative overflow-hidden shadow-inner">
                {activeVersion ? (
                  <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300"><Workflow className="w-16 h-16 opacity-10 mb-4" /><p className="text-xs font-bold uppercase tracking-widest">Keine Daten verfügbar</p></div>
                )}
              </div>
            </>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 pb-32">
                <div className="space-y-8 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                  {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => {
                    const role = jobTitles?.find(j => j.id === node.roleId);
                    const isDecision = node.type === 'decision';
                    const outgoing = activeVersion?.model_json?.edges?.filter((e: any) => String(e.source) === String(node.id)) || [];
                    return (
                      <div key={node.id} className="relative z-10 pl-16">
                        <div className={cn("absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all", node.type === 'start' ? "bg-emerald-500 text-white" : node.type === 'end' ? "bg-red-500 text-white" : isDecision ? "bg-amber-100 text-amber-700 rotate-45" : "bg-white text-slate-600 border-slate-200")}>
                          <div className={cn(isDecision && "-rotate-45")}>{node.type === 'start' ? <ArrowDown className="w-6 h-6" /> : node.type === 'end' ? <CircleDot className="w-6 h-6" /> : isDecision ? <GitBranch className="w-5 h-5" /> : <span className="font-headline font-bold text-lg">{i + 1}</span>}</div>
                        </div>
                        <Card className="rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all group">
                          <CardHeader className="p-6 bg-white border-b flex flex-row items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-headline font-bold text-base text-slate-900 uppercase tracking-tight">{node.title}</h3>
                              {role && <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest mt-1"><Briefcase className="w-3.5 h-3.5" /> {role.name}</div>}
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 space-y-6">
                            {node.description && <div className="space-y-2"><Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Beschreibung</Label><p className="text-sm text-slate-700 leading-relaxed font-medium">{node.description}</p></div>}
                            {node.checklist && node.checklist.length > 0 && (
                              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                <Label className="text-[9px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2 border-b pb-2"><ListChecks className="w-4 h-4 text-emerald-600" /> Prüfschritte</Label>
                                <div className="space-y-2 pt-1">{node.checklist.map((item, idx) => (<div key={idx} className="flex items-start gap-3"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /><span className="text-[11px] font-bold text-slate-600 leading-relaxed">{item}</span></div>))}</div>
                              </div>
                            )}
                            {outgoing.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-100">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isDecision ? 'Entscheidungswege' : 'Nächste Schritte'}</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{outgoing.map((edge: any, eIdx: number) => (<div key={eIdx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border group/link"><ArrowRight className="w-3 h-3 text-primary shrink-0" /><div className="min-w-0 flex-1">{edge.label && <p className="text-[8px] font-black uppercase text-primary mb-0.5">{edge.label}</p>}<p className="text-[10px] font-bold text-slate-700 truncate">{activeVersion?.model_json?.nodes?.find((n: any) => String(n.id) === String(edge.target))?.title || 'Unbekannt'}</p></div></div>))}</div>
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
        </main>
      </div>
    </div>
  );
}
