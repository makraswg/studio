
"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Loader2, 
  ShieldCheck,
  Activity, 
  RefreshCw, 
  ListChecks,
  Network,
  ExternalLink,
  Info,
  Briefcase,
  Building2,
  CheckCircle,
  Eye,
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
  ShieldAlert,
  LayoutGrid,
  List,
  PlayCircle,
  StopCircle,
  HelpCircle,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Process, 
  ProcessVersion, 
  ProcessNode, 
  Tenant, 
  Department, 
  Feature, 
  Resource, 
  Risk, 
  ProcessingActivity, 
  DataSubjectGroup, 
  DataCategory,
  JobTitle,
  Entitlement
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProcessMetadataAction } from '@/app/actions/process-actions';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'guide' | 'risks'>('guide');
  const [guideMode, setGuideMode] = useState<'list' | 'structure'>('list');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<{ path: string, highlight: boolean, label?: string }[]>([]);

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allRisks } = usePluggableCollection<Risk>('risks');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: dataCategories } = usePluggableCollection<DataCategory>('dataCategories');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  
  const activeVersion = useMemo(() => 
    versions?.find((v: any) => v.process_id === id),
    [versions, id]
  );

  const processResources = useMemo(() => {
    if (!activeVersion || !resources) return [];
    const resourceIds = new Set<string>();
    activeVersion.model_json.nodes.forEach((n: ProcessNode) => {
      n.resourceIds?.forEach(rid => resourceIds.add(rid));
    });
    return Array.from(resourceIds).map(rid => resources.find(r => r.id === rid)).filter(Boolean);
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

  const getFullRoleName = (roleId?: string) => {
    if (!roleId) return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  const handleUpdateVvtLink = async (vvtId: string) => {
    try {
      const res = await updateProcessMetadataAction(id as string, { vvtId: vvtId === 'none' ? undefined : vvtId }, dataSource);
      if (res.success) {
        toast({ title: "Zweck aktualisiert" });
        refreshProc();
      }
    } catch(e) {}
  };

  // --- Logic for Structured Grid (BPMN Style) ---
  const gridLayout = useMemo(() => {
    if (!activeVersion || guideMode !== 'structure') return null;
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];

    const levels: Record<string, number> = {};
    const cols: Record<string, number> = {};
    
    const startNode = nodes.find(n => n.type === 'start') || nodes[0];
    if (!startNode) return null;

    const queue = [{ id: startNode.id, level: 0, col: 0 }];
    const processed = new Set<string>();

    while (queue.length > 0) {
      const { id, level, col } = queue.shift()!;
      if (processed.has(id)) continue;
      processed.add(id);

      levels[id] = level;
      cols[id] = col;

      const children = edges.filter(e => e.source === id).map(e => e.target);
      children.forEach((childId, idx) => {
        queue.push({ id: childId, level: level + 1, col: col + idx });
      });
    }

    const grid: ProcessNode[][] = [];
    nodes.forEach(node => {
      const level = levels[node.id] || 0;
      if (!grid[level]) grid[level] = [];
      grid[level].push(node);
    });

    return grid;
  }, [activeVersion, guideMode]);

  const updateFlowLines = useCallback(() => {
    if (!activeVersion || viewMode !== 'guide' || guideMode !== 'list' || !containerRef.current) {
      setConnectionPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollEl = containerRef.current.querySelector('[data-radix-scroll-area-viewport]');
    const scrollTop = scrollEl?.scrollTop || 0;

    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, highlight: boolean, label?: string }[] = [];

    edges.forEach(edge => {
      const sourceEl = document.getElementById(`card-${edge.source}`);
      const targetEl = document.getElementById(`card-${edge.target}`);
      
      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const sX = sRect.left - containerRect.left + (sRect.width / 2);
        const sY = sRect.top - containerRect.top + sRect.height + scrollTop;
        const tX = tRect.left - containerRect.left + (tRect.width / 2);
        const tY = tRect.top - containerRect.top + scrollTop;

        const path = `M ${sX} ${sY} C ${sX} ${sY + 40}, ${tX} ${tY - 40}, ${tX} ${tY}`;
        const isHighlighted = activeNodeId === edge.source || activeNodeId === edge.target;
        
        newPaths.push({ path, highlight: isHighlighted, label: edge.label });
      }
    });

    setConnectionPaths(newPaths);
  }, [activeNodeId, activeVersion, viewMode, guideMode]);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('resize', updateFlowLines);
    return () => window.removeEventListener('resize', updateFlowLines);
  }, [updateFlowLines]);

  useLayoutEffect(() => {
    if (viewMode === 'guide') {
      setTimeout(updateFlowLines, 100);
    }
  }, [activeNodeId, activeVersion, viewMode, guideMode, updateFlowLines]);

  if (!mounted) return null;

  const GuideCard = ({ node, isCompact = false }: { node: ProcessNode, isCompact?: boolean }) => {
    const isActive = activeNodeId === node.id;
    const roleName = getFullRoleName(node.roleId);
    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
    const nodeFeatures = allFeatures?.filter(f => node.featureIds?.includes(f.id));
    const nodeCats = dataCategories?.filter(c => node.dataCategoryIds?.includes(c.id));

    const predecessors = activeVersion.model_json.edges.filter(e => e.target === node.id).map(e => activeVersion.model_json.nodes.find(n => n.id === e.source)).filter(Boolean);
    const successors = activeVersion.model_json.edges.filter(e => e.source === node.id).map(e => {
      const trg = activeVersion.model_json.nodes.find(n => n.id === e.target);
      return { ...trg, edgeLabel: e.label };
    }).filter(Boolean);

    const isDecision = node.type === 'decision';
    const isEvent = node.type === 'start' || node.type === 'end';

    if (isCompact) {
      return (
        <div 
          id={`grid-node-${node.id}`}
          className={cn(
            "relative flex flex-col items-center gap-2 p-2 transition-all group",
            isActive ? "scale-105 z-20" : "z-10"
          )}
          onClick={() => setActiveNodeId(isActive ? null : node.id)}
        >
          <div className={cn(
            "flex items-center justify-center shadow-lg border-2 transition-all cursor-pointer",
            isEvent ? "w-14 h-14 rounded-full" : isDecision ? "w-16 h-16 rotate-45" : "w-48 h-24 rounded-xl",
            node.type === 'start' ? "bg-emerald-50 border-emerald-500 text-emerald-600" :
            node.type === 'end' ? "bg-red-50 border-red-500 text-red-600" :
            isDecision ? "bg-amber-50 border-amber-500 text-amber-600" :
            "bg-white border-primary/30 text-slate-800",
            isActive && "ring-4 ring-primary/20 border-primary"
          )}>
            <div className={cn("flex flex-col items-center justify-center text-center px-3", isDecision && "-rotate-45")}>
              {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : 
               node.type === 'end' ? <StopCircle className="w-6 h-6" /> :
               isDecision ? <HelpCircle className="w-6 h-6" /> : (
                 <>
                   <span className="text-[10px] font-black uppercase text-primary leading-none mb-1.5">{roleName}</span>
                   <span className="text-[11px] font-bold leading-tight line-clamp-2">{node.title}</span>
                 </>
               )}
            </div>
          </div>
          {!isEvent && !isDecision && (
            <div className="flex flex-wrap gap-1 justify-center max-w-[180px]">
              {nodeResources?.slice(0, 2).map(res => <Badge key={res.id} variant="outline" className="text-[7px] font-black h-3.5 border-slate-200 bg-white">{res.name}</Badge>)}
            </div>
          )}
        </div>
      );
    }

    return (
      <Card 
        id={`card-${node.id}`}
        className={cn(
          "w-full max-w-4xl mx-auto rounded-2xl border shadow-sm transition-all duration-500 bg-white group cursor-pointer relative z-10",
          isActive ? "ring-4 ring-primary/10 border-primary shadow-xl scale-[1.01]" : "hover:border-primary/20",
          isDecision && "border-amber-200 bg-amber-50/5"
        )}
        onClick={() => setActiveNodeId(isActive ? null : node.id)}
      >
        <CardHeader className="p-4 bg-white border-b flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
              node.type === 'start' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
              node.type === 'end' ? "bg-red-50 text-red-600 border-red-100" :
              isDecision ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-primary/5 text-primary border-primary/10"
            )}>
              {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : 
               node.type === 'end' ? <StopCircle className="w-6 h-6" /> :
               isDecision ? <HelpCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">{node.title}</h4>
                <Badge variant="outline" className="text-[8px] font-black border-none bg-slate-100 text-slate-500 h-4 uppercase">
                  {isDecision ? 'Entscheidung' : 'Prozessschritt'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Briefcase className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500">{roleName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
            {nodeResources?.map(res => (
              <Badge key={res.id} className={cn(
                "h-6 px-2 text-[9px] font-black gap-1.5 border-none shadow-sm",
                res.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700"
              )}>
                <Server className="w-3 h-3" /> {res.name}
              </Badge>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="md:col-span-7 p-6 space-y-6">
              {node.description && (
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Beschreibung</Label>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description}"</p>
                </div>
              )}

              {node.checklist && node.checklist.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Checkliste
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {node.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl group/item hover:bg-emerald-50 transition-all">
                        <Checkbox id={`${node.id}-check-${idx}`} className="rounded-md border-emerald-300" />
                        <label htmlFor={`${node.id}-check-${idx}`} className="text-xs font-bold text-slate-700 cursor-pointer">{item}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-5 p-6 bg-slate-50/30 space-y-6">
              {(node.tips || node.errors) && (
                <div className="space-y-4">
                  <Label className="text-[9px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5" /> Expertise
                  </Label>
                  {node.tips && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-blue-800">Tipp</p>
                      <p className="text-[10px] text-blue-700 italic">{node.tips}</p>
                    </div>
                  )}
                  {node.errors && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-red-800">Fehlerquelle</p>
                      <p className="text-[10px] text-red-700 italic">{node.errors}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Compliance
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {nodeFeatures?.map(f => <Badge key={f.id} variant="outline" className="bg-white text-sky-700 text-[8px] font-black h-5 px-2 uppercase">{f.name}</Badge>)}
                  {nodeCats?.map(c => <Badge key={c.id} variant="outline" className="bg-white text-blue-700 text-[8px] font-black h-5 px-2 uppercase">{c.name}</Badge>)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-3 bg-slate-50 border-t flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {predecessors.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[8px] font-black text-slate-400 uppercase">Eingang von:</span>
                {predecessors.map((p: any) => (
                  <Badge key={p?.id} variant="ghost" className="bg-white border border-slate-200 text-[8px] font-bold h-5 px-1.5 truncate max-w-[100px]">{p?.title}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {successors.map((s: any) => (
              <Button 
                key={s.id} 
                variant="outline" 
                size="sm" 
                className="h-7 rounded-lg text-[9px] font-black uppercase bg-white border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                onClick={(e) => { e.stopPropagation(); setActiveNodeId(s.id || null); }}
              >
                {s.title} <ArrowRight className="w-2.5 h-2.5 ml-1" />
              </Button>
            ))}
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-6 h-6" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold text-slate-900">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • Leitfaden</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {viewMode === 'guide' && (
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
              <Button variant={guideMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-bold uppercase px-3" onClick={() => setGuideMode('list')}><List className="w-3 h-3 mr-1.5" /> Liste</Button>
              <Button variant={guideMode === 'structure' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-bold uppercase px-3" onClick={() => setGuideMode('structure')}><LayoutGrid className="w-3 h-3 mr-1.5" /> Struktur</Button>
            </div>
          )}
          <div className="w-px h-8 bg-slate-200" />
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={viewMode === 'guide' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('guide')}><ListChecks className="w-3.5 h-3.5 mr-1.5" /> Leitfaden</Button>
            <Button variant={viewMode === 'risks' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('risks')}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Risikoanalyse</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-80 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2"><FileCheck className="w-3.5 h-3.5" /> DSGVO Kontext</h3>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2 shadow-inner">
                  <Label className="text-[8px] font-black uppercase text-slate-400">Verarbeitungszweck (VVT)</Label>
                  <Select value={currentProcess?.vvtId || 'none'} onValueChange={handleUpdateVvtLink}>
                    <SelectTrigger className="h-8 text-[10px] font-bold px-2 bg-white border-emerald-100"><SelectValue placeholder="Zweck wählen..." /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Kein Bezug</SelectItem>{vvts?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2"><UserCircle className="w-3.5 h-3.5" /> Verantwortung</h3>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <p className="text-[8px] font-black uppercase text-slate-400">Owner Rolle</p>
                  <p className="text-[11px] font-bold text-slate-900">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
                </div>
              </section>

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

        <main className="flex-1 flex flex-col bg-slate-100 relative" ref={containerRef}>
          {viewMode === 'guide' ? (
            <ScrollArea className="flex-1">
              {guideMode === 'list' ? (
                <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-16 pb-64 relative">
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary" />
                      </marker>
                    </defs>
                    {connectionPaths.map((pathObj, i) => (
                      <path 
                        key={i}
                        d={pathObj.path} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth={pathObj.highlight ? "3" : "1"} 
                        className={cn("transition-all duration-500", pathObj.highlight ? "text-primary opacity-80" : "text-slate-200 opacity-20")}
                        markerEnd="url(#arrowhead)"
                      />
                    ))}
                  </svg>
                  <div className="space-y-16 relative z-10">
                    {activeVersion?.model_json?.nodes?.map((node: ProcessNode) => (
                      <div key={node.id} className="flex justify-center">
                        <GuideCard node={node} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-10 pb-64 relative min-w-max">
                  <div className="flex flex-col gap-24 items-center">
                    {gridLayout?.map((levelNodes, levelIdx) => (
                      <div key={levelIdx} className="relative flex items-center justify-center gap-12">
                        {levelNodes.map(node => (
                          <div key={node.id} className="relative flex flex-col items-center">
                            <GuideCard node={node} isCompact />
                            
                            {levelIdx < gridLayout.length - 1 && (
                              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
                                <div className="w-0.5 h-12 bg-slate-400" />
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-12 max-w-5xl mx-auto space-y-10">
                <div className="flex items-center gap-4 border-b pb-6">
                  <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100"><AlertCircle className="w-8 h-8" /></div>
                  <div><h2 className="text-2xl font-headline font-bold uppercase tracking-tight">Risikoanalyse</h2><p className="text-xs text-slate-500">Betrachtung der prozessspezifischen Gefahrenlage.</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b p-6"><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Direkte Risiken</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {risksData.direct.length === 0 ? <div className="p-10 text-center opacity-30 italic text-xs">Keine direkten Risiken.</div> : 
                        <div className="divide-y divide-slate-50">{risksData.direct.map((r: any) => (
                          <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/risks/${r.id}`)}>
                            <div className="flex items-center gap-3"><Badge className="h-6 w-8 justify-center rounded-md font-black text-[10px] bg-red-600 text-white border-none">{r.impact * r.probability}</Badge><span className="text-xs font-bold text-slate-800">{r.title}</span></div>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                          </div>
                        ))}</div>
                      }
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-indigo-50/30 border-b p-6"><CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900"><Layers className="w-4 h-4 text-indigo-600" /> Vererbte Risiken (Assets)</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {risksData.inherited.length === 0 ? <div className="p-10 text-center opacity-30 italic text-xs">Keine systembedingten Risiken.</div> : 
                        <div className="divide-y divide-slate-50">{risksData.inherited.map((r: any) => (
                          <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/risks/${r.id}`)}>
                            <div className="flex items-center gap-3"><Badge className="h-6 w-8 justify-center rounded-md font-black text-[10px] bg-orange-600 text-white border-none">{r.impact * r.probability}</Badge><span className="text-xs font-bold text-slate-800">{r.title}</span></div>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                          </div>
                        ))}</div>
                      }
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          )}
        </main>
      </div>
    </div>
  );
}
