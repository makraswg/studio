"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  ShieldCheck,
  ShieldAlert,
  Activity, 
  RefreshCw, 
  ChevronRight,
  ClipboardList,
  Maximize2,
  ExternalLink,
  Info,
  Briefcase,
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
  ArrowRightCircle,
  Tag,
  Zap,
  CheckCircle2,
  HelpCircle,
  Target,
  Server,
  AlertCircle,
  TrendingUp,
  FileCheck,
  Save,
  UserCircle,
  ArrowUp,
  ClipboardCheck,
  Link as LinkIcon
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'guide' | 'risks'>('guide');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isUpdatingVvt, setIsUpdatingVvt] = useState(false);

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

  const processFeatures = useMemo(() => {
    if (!featureLinks) return [];
    const links = featureLinks.filter((l: any) => l.processId === id);
    const featureIds = [...new Set(links.map((l: any) => l.featureId))];
    return featureIds.map(fid => allFeatures?.find(f => f.id === fid)).filter(Boolean);
  }, [featureLinks, id, allFeatures]);

  const processResources = useMemo(() => {
    if (!activeVersion) return [];
    const resourceIds = new Set<string>();
    activeVersion.model_json.nodes.forEach((n: ProcessNode) => {
      if (n.resourceIds) n.resourceIds.forEach(rid => resourceIds.add(rid));
    });
    return Array.from(resourceIds).map(rid => resources?.find(r => r.id === rid)).filter(Boolean);
  }, [activeVersion, resources]);

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
        <aside className="w-96 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5" /> DSGVO Koppelung
                </h3>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-4 shadow-inner">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Verarbeitungszweck (VVT)</Label>
                    <Select value={currentProcess?.vvtId || 'none'} onValueChange={handleUpdateVvtLink} disabled={isUpdatingVvt}>
                      <SelectTrigger className="h-10 rounded-xl bg-white border-emerald-100 text-xs font-bold">
                        <SelectValue placeholder="Zweck auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein DSGVO Bezug</SelectItem>
                        {vvts?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {currentVvt && (
                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm space-y-2">
                      <p className="text-[10px] font-bold text-slate-700 leading-tight line-clamp-2">{currentVvt.description}</p>
                      <Badge className="bg-emerald-500 text-white border-none rounded-full text-[8px] font-black h-4 px-2 uppercase">Aktiv im Register</Badge>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2">
                  <UserCircle className="w-3.5 h-3.5" /> Prozess-Verantwortung
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div>
                    <Label className="text-[8px] font-black uppercase text-slate-400">Owner Rolle</Label>
                    <p className="text-xs font-bold text-slate-900">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
                  </div>
                  {currentDept && (
                    <div>
                      <Label className="text-[8px] font-black uppercase text-slate-400">Zuständige Abteilung</Label>
                      <p className="text-xs font-bold text-slate-700">{currentDept.name}</p>
                    </div>
                  )}
                </div>
              </section>

              {maturity && (
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 fill-current" /> Maturity Center
                  </h3>
                  <Card className="rounded-2xl border-none bg-slate-900 text-white shadow-xl overflow-hidden p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Reifegrad Level {maturity.level}</p>
                        <h4 className="text-xl font-headline font-black">{maturity.levelLabel}</h4>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-primary border border-white/10">
                        <Activity className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Gesamt-Score</span>
                        <span className="text-primary">{maturity.totalPercent}%</span>
                      </div>
                      <Progress value={maturity.totalPercent} className="h-2 rounded-full bg-white/5" />
                    </div>
                  </Card>
                </section>
              )}

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-b pb-2 flex items-center gap-2"><Server className="w-3.5 h-3.5" /> IT-Unterstützung</h3>
                <div className="space-y-2">
                  {processResources.map((res: any) => (
                    <div key={res.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between group cursor-pointer hover:border-indigo-300 transition-all" onClick={() => router.push(`/resources?search=${res.name}`)}>
                      <span className="text-[11px] font-bold text-slate-700">{res.name}</span>
                      <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1">{res.assetType}</Badge>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Verarbeitete Daten</h3>
                <div className="space-y-2">
                  {processFeatures.map((f: any) => (
                    <div key={f.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary/30 transition-all" onClick={() => router.push(`/features/${f.id}`)}>
                      <span className="text-[11px] font-bold text-slate-700">{f.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
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
                      <h2 className="text-2xl font-headline font-bold uppercase tracking-tight">Risikoanalyse</h2>
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
            <ScrollArea className="flex-1">
              <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 pb-32">
                <div className="space-y-12 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                  {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => {
                    const roleName = getFullRoleName(node.roleId);
                    const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id);
                    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
                    const nodeGroups = subjectGroups?.filter(g => node.subjectGroupIds?.includes(g.id));
                    const nodeCategories = dataCategories?.filter(c => node.dataCategoryIds?.includes(c.id));
                    
                    return (
                      <div key={node.id} className="relative z-10 pl-16">
                        <div className={cn(
                          "absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm bg-white",
                          node.type === 'start' ? "border-emerald-200" : node.type === 'end' ? "border-red-200" : ""
                        )}>
                          <span className="font-headline font-bold text-lg">{i + 1}</span>
                        </div>
                        
                        <Card className="rounded-2xl border shadow-sm overflow-hidden group hover:border-primary/20 transition-all bg-white">
                          <CardHeader className="p-6 bg-white border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-headline font-bold text-base text-slate-900 uppercase tracking-tight">{node.title}</h3>
                                <Badge variant="outline" className={cn(
                                  "text-[8px] font-black h-4 px-1.5 border-none shadow-none uppercase",
                                  node.type === 'decision' ? "bg-amber-50 text-amber-600" : 
                                  node.type === 'subprocess' ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                                )}>{node.type}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-2">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-md"><Briefcase className="w-3.5 h-3.5" /> {roleName}</div>
                                {nodeResources && nodeResources.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md"><Server className="w-3.5 h-3.5" /> {nodeResources.length} Systeme</div>
                                )}
                              </div>
                            </div>
                            {node.targetProcessId && node.targetProcessId !== 'none' && (
                              <Button size="sm" variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-2" onClick={() => router.push(`/processhub/view/${node.targetProcessId}`)}>
                                <ExternalLink className="w-3 h-3" /> Zielprozess
                              </Button>
                            )}
                          </CardHeader>
                          
                          <CardContent className="p-6 space-y-8">
                            {node.description && <p className="text-sm text-slate-700 leading-relaxed font-medium">{node.description}</p>}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {/* Left Column: Resources & Data */}
                              <div className="space-y-6">
                                {(nodeResources && nodeResources.length > 0) && (
                                  <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                      <Server className="w-3 h-3" /> Einsatzmittel (Systeme)
                                    </Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {nodeResources.map(res => (
                                        <Badge key={res.id} variant="outline" className="bg-slate-50 text-slate-600 border-slate-100 text-[8px] font-bold h-5 px-2">{res.name}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {nodeLinks && nodeLinks.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                      <Tag className="w-3 h-3" /> Verarbeitete Daten
                                    </Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {nodeLinks.map((l: any) => {
                                        const f = allFeatures?.find(feat => feat.id === l.featureId);
                                        return <Badge key={l.id} variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[8px] font-bold h-5 px-2">{f?.name || 'Daten'}</Badge>;
                                      })}
                                    </div>
                                  </div>
                                )}

                                {node.links && node.links.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                      <LinkIcon className="w-3 h-3" /> Dokumente & Links
                                    </Label>
                                    <div className="space-y-1">
                                      {node.links.map((link, idx) => (
                                        <a key={idx} href={link.url} target="_blank" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1.5">
                                          <ExternalLink className="w-2.5 h-2.5" /> {link.title}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right Column: Compliance */}
                              <div className="space-y-6">
                                {(nodeGroups && nodeGroups.length > 0) && (
                                  <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                      <UserCircle className="w-3 h-3" /> Betroffene Personen
                                    </Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {nodeGroups.map(g => (
                                        <Badge key={g.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] font-bold h-5 px-2">{g.name}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {(nodeCategories && nodeCategories.length > 0) && (
                                  <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                      <Layers className="w-3 h-3" /> Datenkategorien
                                    </Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {nodeCategories.map(c => (
                                        <Badge key={c.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[8px] font-bold h-5 px-2">{c.name}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Expertise: Tips & Errors */}
                            {(node.tips || node.errors) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {node.tips && (
                                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-blue-700 flex items-center gap-2"><Lightbulb className="w-3 h-3" /> Tipps & Best-Practice</Label>
                                    <p className="text-[11px] text-blue-900 leading-relaxed italic">{node.tips}</p>
                                  </div>
                                )}
                                {node.errors && (
                                  <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-red-700 flex items-center gap-2"><AlertCircle className="w-3 h-3" /> Typische Fehler</Label>
                                    <p className="text-[11px] text-red-900 leading-relaxed italic">{node.errors}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Checklist */}
                            {node.checklist && node.checklist.length > 0 && (
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 shadow-inner">
                                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><ListChecks className="w-4 h-4 text-primary" /> Operative Prüfschritte</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {node.checklist.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                      <div className="w-4 h-4 rounded-md border bg-slate-50 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle className="w-2.5 h-2.5 text-slate-200" /></div>
                                      <span className="text-[11px] font-bold text-slate-700 leading-tight">{item}</span>
                                    </div>
                                  ))}
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
        </main>
      </div>
    </div>
  );
}
