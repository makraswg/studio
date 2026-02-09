"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  ShieldCheck,
  Activity, 
  RefreshCw, 
  ChevronRight,
  ListChecks,
  Network,
  ExternalLink,
  Info,
  Briefcase,
  Building2,
  CheckCircle,
  Eye,
  Lock,
  AlertTriangle,
  Lightbulb,
  GitBranch,
  ArrowRight,
  Shield,
  History,
  Clock,
  User as UserIcon,
  Layers,
  FileText,
  FileEdit,
  ArrowRightCircle,
  Tag,
  Zap,
  CheckCircle2,
  Target,
  Server,
  AlertCircle,
  FileCheck,
  UserCircle,
  ArrowUp,
  ClipboardCheck,
  Link as LinkIcon,
  ArrowLeftRight,
  ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessVersion, ProcessNode, Tenant, Department, Feature, Resource, Risk, ProcessingActivity, DataSubjectGroup, DataCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProcessMetadataAction } from '@/app/actions/process-actions';
import { toast } from '@/hooks/use-toast';

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-${idx}`);
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 140, h = 70;
    let label = node.title;
    
    switch (node.type) {
      case 'start': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'end': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=4;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;'; 
        w = 60; h = 60;
        label = 'X'; 
        break;
      case 'subprocess':
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;dashed=1;shadow=0;';
        w = 140; h = 70;
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;';
        w = 140; h = 70;
    }
    
    const displayValue = node.type === 'decision' ? label : node.title;
    xml += `<mxCell id="${nodeSafeId}" value="${displayValue}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edge.id || `edge-${idx}`}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'guide' | 'risks'>('guide');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isUpdatingVvt, setIsUpdatingVvt] = useState(false);
  
  // Interactive Flow States
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<string[]>([]);

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allRisks } = usePluggableCollection<Risk>('risks');
  const { data: media } = usePluggableCollection<any>('media');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: subjectGroups } = usePluggableCollection<DataSubjectGroup>('dataSubjectGroups');
  const { data: dataCategories } = usePluggableCollection<DataCategory>('dataCategories');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentDept = useMemo(() => 
    departments?.find(d => d.id === currentProcess?.responsibleDepartmentId),
    [departments, currentProcess]
  );

  const allProcessVersions = useMemo(() => 
    versions?.filter((v: any) => v.process_id === id).sort((a: any, b: any) => b.version - a.version) || [],
    [versions, id]
  );

  const activeVersion = useMemo(() => {
    if (selectedVersionNum === null) return allProcessVersions[0];
    return allProcessVersions.find((v: any) => v.version === selectedVersionNum);
  }, [allProcessVersions, selectedVersionNum]);

  const risksData = useMemo(() => {
    if (!allRisks || !currentProcess || !activeVersion) return { direct: [], inherited: [], maxScore: 0 };
    const direct = allRisks.filter(r => r.processId === id);
    const resourceIdsUsed = new Set<string>();
    activeVersion.model_json.nodes.forEach((n: ProcessNode) => {
      if (n.resourceIds) n.resourceIds.forEach(rid => resourceIdsUsed.add(rid));
    });
    const inherited = allRisks.filter(r => r.assetId && resourceIdsUsed.has(r.assetId) && r.processId !== id);
    const allRelevantRisks = [...direct, ...inherited];
    const maxScore = allRelevantRisks.length > 0 
      ? Math.max(...allRelevantRisks.map(r => r.impact * r.probability))
      : 0;
    return { direct, inherited, maxScore };
  }, [allRisks, currentProcess, activeVersion, id]);

  const maturity = useMemo(() => {
    if (!currentProcess || !activeVersion) return null;
    const pMedia = media?.filter((m: any) => m.entityId === id).length || 0;
    return calculateProcessMaturity(currentProcess, activeVersion, pMedia);
  }, [currentProcess, activeVersion, media, id]);

  const processResources = useMemo(() => {
    if (!activeVersion || !resources) return [];
    const resourceIds = new Set<string>();
    activeVersion.model_json.nodes.forEach((n: ProcessNode) => {
      n.resourceIds?.forEach(rid => resourceIds.add(rid));
    });
    return Array.from(resourceIds).map(rid => resources.find(r => r.id === rid)).filter(Boolean);
  }, [activeVersion, resources]);

  const getFullRoleName = (roleId?: string) => {
    if (!roleId) return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  const currentVvt = useMemo(() => vvts?.find(v => v.id === currentProcess?.vvtId), [vvts, currentProcess]);

  const handleUpdateVvtLink = async (vvtId: string) => {
    setIsUpdatingVvt(true);
    try {
      const res = await updateProcessMetadataAction(id as string, { vvtId: vvtId === 'none' ? undefined : vvtId }, dataSource);
      if (res.success) {
        toast({ title: "Datenschutzzweck aktualisiert" });
        refreshProc();
      }
    } finally {
      setIsUpdatingVvt(false);
    }
  };

  const updateFlowLines = useCallback(() => {
    if (!activeNodeId || !activeVersion || viewMode !== 'guide' || !containerRef.current) {
      setConnectionPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const sourceEl = document.getElementById(`card-${activeNodeId}`);
    if (!sourceEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const sourceMidX = sourceRect.left - containerRect.left + 5; 
    const sourceMidY = sourceRect.top - containerRect.top + (sourceRect.height / 2);

    const edges = activeVersion.model_json.edges || [];
    const relatedEdges = edges.filter(e => e.source === activeNodeId || e.target === activeNodeId);
    
    const newPaths: string[] = [];

    relatedEdges.forEach(edge => {
      const isOutbound = edge.source === activeNodeId;
      const targetId = isOutbound ? edge.target : edge.source;
      const targetEl = document.getElementById(`card-${targetId}`);
      
      if (targetEl) {
        const targetRect = targetEl.getBoundingClientRect();
        const targetMidX = targetRect.left - containerRect.left + 5;
        const targetMidY = targetRect.top - containerRect.top + (targetRect.height / 2);

        const cp1x = sourceMidX - 100;
        const cp1y = sourceMidY;
        const cp2x = targetMidX - 100;
        const cp2y = targetMidY;

        const path = `M ${sourceMidX} ${sourceMidY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetMidX} ${targetMidY}`;
        newPaths.push(path);
      }
    });

    setConnectionPaths(newPaths);
  }, [activeNodeId, activeVersion, viewMode]);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('resize', updateFlowLines);
    return () => window.removeEventListener('resize', updateFlowLines);
  }, [updateFlowLines]);

  useLayoutEffect(() => {
    if (activeNodeId) updateFlowLines();
  }, [activeNodeId, updateFlowLines]);

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

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900 truncate">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
              {risksData.maxScore > 0 && (
                <Badge className={cn(
                  "rounded-full px-2 h-5 text-[10px] font-black border-none",
                  risksData.maxScore >= 15 ? "bg-red-600 text-white" : risksData.maxScore >= 8 ? "bg-accent text-white" : "bg-emerald-600 text-white"
                )}>
                  Risk: {risksData.maxScore}
                </Badge>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • Leitfaden</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={viewMode === 'diagram' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('diagram')}><Network className="w-3.5 h-3.5 mr-1.5" /> Visuell</Button>
            <Button variant={viewMode === 'guide' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('guide')}><ListChecks className="w-3.5 h-3.5 mr-1.5" /> Leitfaden</Button>
            <Button variant={viewMode === 'risks' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('risks')}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Risikoanalyse</Button>
          </div>
          <Button variant="outline" className="rounded-xl h-10 px-6 font-bold text-xs border-slate-200 gap-2 shadow-sm" onClick={() => router.push(`/processhub/${id}`)}><FileEdit className="w-4 h-4" /> Designer</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-80 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5" /> DSGVO Koppelung
                </h3>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3 shadow-inner">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-slate-400">VVT-Bezug</Label>
                    <Select value={currentProcess?.vvtId || 'none'} onValueChange={handleUpdateVvtLink} disabled={isUpdatingVvt}>
                      <SelectTrigger className="h-8 rounded-lg bg-white border-emerald-100 text-[10px] font-bold px-2">
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Bezug</SelectItem>
                        {vvts?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {currentVvt && <p className="text-[9px] font-medium text-slate-600 leading-tight line-clamp-2 italic px-1">"{currentVvt.description}"</p>}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2">
                  <UserCircle className="w-3.5 h-3.5" /> Verantwortung
                </h3>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div>
                    <Label className="text-[8px] font-black uppercase text-slate-400">Owner Rolle</Label>
                    <p className="text-[11px] font-bold text-slate-900">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
                  </div>
                  {currentDept && (
                    <div>
                      <Label className="text-[8px] font-black uppercase text-slate-400">Abteilung</Label>
                      <p className="text-[11px] font-bold text-slate-700">{currentDept.name}</p>
                    </div>
                  )}
                </div>
              </section>

              {maturity && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 fill-current" /> Maturity
                  </h3>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-headline font-black uppercase text-primary">{maturity.levelLabel}</h4>
                      <Badge className="bg-primary/10 text-primary border-none rounded-full h-4 px-1.5 text-[8px] font-black">{maturity.totalPercent}%</Badge>
                    </div>
                    <Progress value={maturity.totalPercent} className="h-1 bg-slate-100" />
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-b pb-2 flex items-center gap-2"><Server className="w-3.5 h-3.5" /> Involvierte Systeme</h3>
                <div className="flex flex-wrap gap-1.5">
                  {processResources.map((res: any) => (
                    <Badge key={res.id} variant="outline" className="bg-white border-slate-100 text-[9px] font-bold h-6 px-2 text-slate-600 shadow-sm cursor-help" onClick={() => router.push(`/resources?search=${res.name}`)}>
                      {res.name}
                    </Badge>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-100 relative">
          {viewMode === 'diagram' ? (
            <div className="flex-1 bg-white relative overflow-hidden shadow-inner">
              <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
            </div>
          ) : viewMode === 'risks' ? (
            <ScrollArea className="flex-1">
              <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-10 pb-32">
                <div className="flex items-center justify-between border-b pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-headline font-bold uppercase tracking-tight text-slate-900">Risikoanalyse</h2>
                      <p className="text-xs text-slate-500 font-medium">Betrachtung der prozessspezifischen Gefahrenlage.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-slate-50/50 border-b p-6">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" /> Direkte Risiken
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {risksData.direct.length === 0 ? (
                        <div className="p-10 text-center opacity-30 italic text-xs">Keine direkten Risiken.</div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {risksData.direct.map(r => (
                            <div key={r.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => router.push(`/risks?search=${r.title}`)}>
                              <div className="flex items-center gap-3">
                                <Badge className={cn(
                                  "h-6 w-8 justify-center rounded-md font-black text-[10px] border-none",
                                  (r.impact * r.probability) >= 15 ? "bg-red-600 text-white" : (r.impact * r.probability) >= 8 ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                                )}>{r.impact * r.probability}</Badge>
                                <span className="text-[11px] font-bold text-slate-800">{r.title}</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-indigo-50/30 border-b p-6">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900">
                        <Layers className="w-4 h-4 text-indigo-600" /> Vererbte Risiken (Assets)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {risksData.inherited.length === 0 ? (
                        <div className="p-10 text-center opacity-30 italic text-xs">Keine systembedingten Risiken.</div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {risksData.inherited.map(r => (
                            <div key={r.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => router.push(`/risks?search=${r.title}`)}>
                              <div className="flex items-center gap-3">
                                <Badge className={cn(
                                  "h-6 w-8 justify-center rounded-md font-black text-[10px] border-none",
                                  (r.impact * r.probability) >= 15 ? "bg-red-600 text-white" : (r.impact * r.probability) >= 8 ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                                )}>{r.impact * r.probability}</Badge>
                                <span className="text-[11px] font-bold text-slate-800">{r.title}</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 relative">
              <ScrollArea className="flex-1">
                <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 pb-32 relative" ref={containerRef}>
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary/40" />
                      </marker>
                    </defs>
                    {connectionPaths.map((path, i) => (
                      <path 
                        key={i} 
                        d={path} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeDasharray="4 2"
                        className="text-primary/20 animate-in fade-in duration-1000"
                        markerEnd="url(#arrowhead)"
                      />
                    ))}
                  </svg>

                  <div className="space-y-12 relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                    
                    {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => {
                      const roleName = getFullRoleName(node.roleId);
                      const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id);
                      const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
                      const nodeGroups = subjectGroups?.filter(g => node.subjectGroupIds?.includes(g.id));
                      const nodeCategories = dataCategories?.filter(c => node.dataCategoryIds?.includes(c.id));
                      
                      const predecessors = activeVersion.model_json.edges
                        .filter(e => e.target === node.id)
                        .map(e => activeVersion.model_json.nodes.find(n => n.id === e.source))
                        .filter(Boolean);
                      
                      const successors = activeVersion.model_json.edges
                        .filter(e => e.source === node.id)
                        .map(e => ({
                          edge: e,
                          node: activeVersion.model_json.nodes.find(n => n.id === e.target)
                        }))
                        .filter(s => !!s.node);

                      const isActive = activeNodeId === node.id;
                      const targetProc = node.targetProcessId ? processes?.find(p => p.id === node.targetProcessId) : null;

                      return (
                        <div key={node.id} className="relative z-10 pl-12" id={node.id}>
                          <div className={cn(
                            "absolute left-0 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-slate-50 shadow-sm z-20 transition-all cursor-pointer",
                            isActive ? "scale-125 ring-4 ring-primary/20" : "hover:scale-110",
                            node.type === 'start' ? "bg-emerald-500 text-white" : 
                            node.type === 'end' ? "bg-red-500 text-white" : 
                            node.type === 'decision' ? "bg-amber-500 text-white" : "bg-white text-slate-900 border-slate-200"
                          )} onClick={() => setActiveNodeId(isActive ? null : node.id)}>
                            {node.type === 'start' ? <ArrowUp className="w-5 h-5" /> : 
                             node.type === 'end' ? <CheckCircle2 className="w-5 h-5" /> :
                             node.type === 'decision' ? <GitBranch className="w-5 h-5" /> :
                             <span className="font-headline font-black text-sm">{i + 1}</span>}
                          </div>

                          {predecessors.length > 0 && (
                            <div className="flex gap-1.5 mb-2 ml-1">
                              {predecessors.map((p, idx) => (
                                <Badge key={idx} variant="ghost" className="h-4 px-2 text-[7px] font-black uppercase text-slate-400 bg-slate-100/50 border-none rounded-full">
                                  <ArrowLeftRight className="w-2 h-2 mr-1" /> Folge von: {p?.title}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          <Card 
                            id={`card-${node.id}`}
                            className={cn(
                              "rounded-2xl border shadow-sm overflow-hidden group transition-all bg-white duration-300 cursor-pointer",
                              isActive ? "ring-2 ring-primary border-primary/40 shadow-xl scale-[1.01]" : "hover:border-primary/20",
                              node.type === 'decision' && !isActive && "border-amber-100 bg-amber-50/10",
                              node.type === 'subprocess' && !isActive && "border-indigo-100 bg-indigo-50/10"
                            )}
                            onClick={() => setActiveNodeId(isActive ? null : node.id)}
                          >
                            <CardHeader className="p-5 pb-4 bg-white border-b">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-headline font-black text-base text-slate-900 uppercase tracking-tight">{node.title}</h3>
                                    <Badge variant="outline" className={cn(
                                      "text-[8px] font-black h-4 px-1.5 border-none shadow-none uppercase",
                                      node.type === 'decision' ? "bg-amber-100 text-amber-700" : 
                                      node.type === 'subprocess' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                    )}>{node.type === 'decision' ? 'Entscheidung' : node.type === 'step' ? 'Prozessschritt' : node.type}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                      <Briefcase className="w-3 h-3" /> {roleName}
                                    </div>
                                    {nodeResources?.map(res => (
                                      <TooltipProvider key={res.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md h-5 px-1.5 text-[8px] font-black cursor-help">
                                              <Server className="w-2.5 h-2.5 mr-1" /> {res.name}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-[9px] font-bold p-2 bg-slate-900 border-none rounded-lg text-white">
                                            {res.assetType} • {res.criticality.toUpperCase()} • {res.dataLocation}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                  </div>
                                </div>
                                {node.type === 'subprocess' && targetProc && (
                                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 shadow-sm" onClick={(e) => { e.stopPropagation(); router.push(`/processhub/view/${node.targetProcessId}`); }}>
                                    <ExternalLink className="w-3 h-3" /> Prozess: {targetProc.title}
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            
                            <CardContent className="p-0">
                              <div className="grid grid-cols-1 md:grid-cols-10 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="md:col-span-7 p-5 space-y-6">
                                  {node.description && <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">{node.description}</p>}
                                  
                                  {node.checklist && node.checklist.length > 0 && (
                                    <div className="space-y-3">
                                      <Label className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2 tracking-widest">
                                        <ListChecks className="w-3.5 h-3.5" /> Checkliste / To-Do
                                      </Label>
                                      <div className="grid grid-cols-1 gap-2">
                                        {node.checklist.map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 group/item hover:border-emerald-200 transition-all cursor-pointer">
                                            <div className="w-5 h-5 rounded-md border border-slate-200 flex items-center justify-center shrink-0 group-hover/item:bg-emerald-500 group-hover/item:border-emerald-500 transition-all">
                                              <CheckCircle className="w-3.5 h-3.5 text-transparent group-hover/item:text-white" />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{item}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="md:col-span-3 p-5 space-y-6 bg-slate-50/30">
                                  <div className="space-y-4">
                                    {(node.tips || node.errors) && (
                                      <div className="space-y-2">
                                        <Label className="text-[8px] font-black uppercase text-slate-400">Expertise</Label>
                                        {node.tips && (
                                          <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-[10px] font-bold text-blue-900 italic">
                                            <Lightbulb className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" /> {node.tips}
                                          </div>
                                        )}
                                        {node.errors && (
                                          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100 text-[10px] font-bold text-red-900 italic">
                                            <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /> {node.errors}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="space-y-2">
                                      <Label className="text-[8px] font-black uppercase text-slate-400">Compliance & Daten</Label>
                                      <div className="flex flex-wrap gap-1">
                                        {nodeLinks?.map((l: any) => (
                                          <Badge key={l.id} variant="outline" className="bg-white text-primary border-primary/10 text-[7px] font-black h-4 px-1.5 uppercase rounded-none">{allFeatures?.find(f => f.id === l.featureId)?.name}</Badge>
                                        ))}
                                        {nodeGroups?.map(g => (
                                          <Badge key={g.id} variant="outline" className="bg-white text-emerald-700 border-emerald-100 text-[7px] font-black h-4 px-1.5 uppercase rounded-none">{g.name}</Badge>
                                        ))}
                                        {nodeCategories?.map(c => (
                                          <Badge key={c.id} variant="outline" className="bg-white text-blue-700 border-blue-100 text-[7px] font-black h-4 px-1.5 uppercase rounded-none">{c.name}</Badge>
                                        ))}
                                      </div>
                                    </div>

                                    {node.links && node.links.length > 0 && (
                                      <div className="space-y-2">
                                        <Label className="text-[8px] font-black uppercase text-slate-400">Links</Label>
                                        {node.links.map((link, idx) => (
                                          <a key={idx} href={link.url} target="_blank" className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-slate-100 text-[10px] font-bold text-slate-600 hover:text-primary transition-all">
                                            <LinkIcon className="w-3 h-3" /> <span className="truncate">{link.title}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {successors.length > 0 && (
                                <div className="bg-slate-50/80 p-3 border-t flex flex-wrap justify-center gap-2">
                                  {successors.map((s, idx) => (
                                    <Button 
                                      key={idx} 
                                      variant="ghost" 
                                      className="h-8 rounded-full px-4 border bg-white shadow-sm gap-2 group/next active:scale-95 transition-all"
                                      onClick={(e) => { e.stopPropagation(); document.getElementById(s.node?.id || '')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveNodeId(s.node?.id || null); }}
                                    >
                                      {s.edge.label && <Badge className="bg-amber-500 text-white border-none h-3.5 px-1 text-[6px] font-black uppercase">{s.edge.label}</Badge>}
                                      <span className="text-[9px] font-black uppercase tracking-tight text-slate-600">{s.node?.title}</span>
                                      <ArrowRightCircle className="w-3.5 h-3.5 text-slate-300 group-hover/next:text-primary group-hover/next:translate-x-0.5 transition-all" />
                                    </Button>
                                  ))}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
