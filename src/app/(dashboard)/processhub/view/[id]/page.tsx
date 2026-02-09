
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
  ShieldAlert,
  LayoutGrid,
  List,
  ArrowDown,
  Circle,
  PlayCircle,
  StopCircle,
  HelpCircle
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
  const [guideSubMode, setGuideSubMode] = useState<'list' | 'structured'>('structured');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isUpdatingVvt, setIsUpdatingVvt] = useState(false);
  
  // Interactive Flow States
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<{ path: string, highlight: boolean }[]>([]);

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

  const structuredLevels = useMemo(() => {
    if (!activeVersion) return [];
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    
    const nodeToLevel: Record<string, number> = {};
    
    // 1. Initial leveling (Topological inspired)
    nodes.forEach(node => {
      const incoming = edges.filter(e => e.target === node.id);
      if (incoming.length === 0) nodeToLevel[node.id] = 0;
    });

    if (Object.keys(nodeToLevel).length === 0 && nodes.length > 0) {
      nodeToLevel[nodes[0].id] = 0;
    }

    let changed = true;
    let iteration = 0;
    while (changed && iteration < nodes.length) {
      changed = false;
      iteration++;
      edges.forEach(edge => {
        const srcLevel = nodeToLevel[edge.source];
        if (srcLevel !== undefined) {
          const targetLevel = srcLevel + 1;
          if (nodeToLevel[edge.target] === undefined || nodeToLevel[edge.target] < targetLevel) {
            if (targetLevel < nodes.length) {
              nodeToLevel[edge.target] = targetLevel;
              changed = true;
            }
          }
        }
      });
    }

    nodes.forEach(node => {
      if (nodeToLevel[node.id] === undefined) nodeToLevel[node.id] = 0;
    });

    const levelGroups: Record<number, ProcessNode[]> = {};
    Object.entries(nodeToLevel).forEach(([id, l]) => {
      if (!levelGroups[l]) levelGroups[l] = [];
      const node = nodes.find(n => n.id === id);
      if (node) levelGroups[l].push(node);
    });

    return Object.keys(levelGroups).sort((a, b) => Number(a) - Number(b)).map(l => levelGroups[Number(l)]);
  }, [activeVersion]);

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
    if (!activeVersion || viewMode !== 'guide' || guideSubMode !== 'list' || !containerRef.current) {
      setConnectionPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, highlight: boolean }[] = [];

    edges.forEach(edge => {
      const sourceEl = document.getElementById(`card-${edge.source}`);
      const targetEl = document.getElementById(`card-${edge.target}`);
      
      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const sourceMidX = sourceRect.left - containerRect.left + 5; 
        const sourceMidY = sourceRect.top - containerRect.top + (sourceRect.height / 2);
        const targetMidX = targetRect.left - containerRect.left + 5;
        const targetMidY = targetRect.top - containerRect.top + (targetRect.height / 2);

        const cp1x = sourceMidX - 120;
        const cp1y = sourceMidY;
        const cp2x = targetMidX - 120;
        const cp2y = targetMidY;

        const path = `M ${sourceMidX} ${sourceMidY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetMidX} ${targetMidY}`;
        const isHighlighted = activeNodeId === edge.source || activeNodeId === edge.target;
        newPaths.push({ path, highlight: isHighlighted });
      }
    });

    setConnectionPaths(newPaths);
  }, [activeNodeId, activeVersion, viewMode, guideSubMode]);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('resize', updateFlowLines);
    return () => window.removeEventListener('resize', updateFlowLines);
  }, [updateFlowLines]);

  useLayoutEffect(() => {
    updateFlowLines();
  }, [activeNodeId, activeVersion, updateFlowLines]);

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

  const BpmnNode = ({ node, index, isActive }: { node: ProcessNode, index: number, isActive: boolean }) => {
    const roleName = getFullRoleName(node.roleId);
    const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id);
    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
    
    const successors = activeVersion.model_json.edges
      .filter(e => e.source === node.id)
      .map(e => ({
        edge: e,
        node: activeVersion.model_json.nodes.find(n => n.id === e.target)
      }))
      .filter(s => !!s.node);

    const targetProc = node.targetProcessId ? processes?.find(p => p.id === node.targetProcessId) : null;

    // Semantic BPMN Shapes
    if (node.type === 'start') {
      return (
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveNodeId(isActive ? null : node.id)}>
          <div className={cn(
            "w-12 h-12 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center transition-all shadow-md group-hover:scale-110",
            isActive && "ring-4 ring-emerald-500/20 bg-emerald-50"
          )}>
            <PlayCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-[10px] font-black uppercase text-emerald-700 text-center tracking-tighter">Start</span>
        </div>
      );
    }

    if (node.type === 'end') {
      return (
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveNodeId(isActive ? null : node.id)}>
          <div className={cn(
            "w-12 h-12 rounded-full border-4 border-red-600 bg-white flex items-center justify-center transition-all shadow-md group-hover:scale-110",
            isActive && "ring-4 ring-red-600/20 bg-red-50"
          )}>
            <StopCircle className="w-6 h-6 text-red-600" />
          </div>
          <span className="text-[10px] font-black uppercase text-red-700 text-center tracking-tighter">Ende</span>
        </div>
      );
    }

    if (node.type === 'decision') {
      return (
        <div className="flex flex-col items-center gap-4 group cursor-pointer" onClick={() => setActiveNodeId(isActive ? null : node.id)}>
          <div className={cn(
            "w-16 h-16 bg-white border-2 border-amber-500 rotate-45 flex items-center justify-center transition-all shadow-lg group-hover:scale-105",
            isActive && "ring-4 ring-amber-500/20 bg-amber-50"
          )}>
            <div className="-rotate-45">
              <HelpCircle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <span className="text-[11px] font-black uppercase text-amber-700 block tracking-tight leading-none px-2">{node.title}</span>
            {successors.map((s, idx) => (
              <Badge key={idx} variant="outline" className="bg-white text-[8px] font-black uppercase border-amber-200 text-amber-600 h-4 px-1">{s.edge.label || 'Weg'}</Badge>
            ))}
          </div>
        </div>
      );
    }

    // Standard Step or Subprocess
    return (
      <Card 
        className={cn(
          "w-full max-w-sm rounded-xl border shadow-md overflow-hidden transition-all bg-white group cursor-pointer",
          isActive ? "ring-4 ring-primary/20 border-primary shadow-xl" : "hover:border-primary/30",
          node.type === 'subprocess' && "border-dashed border-indigo-400 bg-indigo-50/5"
        )}
        onClick={() => setActiveNodeId(isActive ? null : node.id)}
      >
        <CardHeader className="p-3 bg-white border-b flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">{node.title}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Briefcase className="w-2.5 h-2.5 text-primary opacity-50" />
              <span className="text-[9px] font-bold text-slate-500 truncate max-w-[150px]">{roleName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {nodeResources?.map(res => (
              <TooltipProvider key={res.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("h-4 px-1 text-[7px] font-black", res.criticality === 'high' ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600")}>
                      <Server className="w-2 h-2" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px] font-bold">System: {res.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {node.description && <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2 italic">"{node.description}"</p>}
          
          {node.checklist && node.checklist.length > 0 && (isActive) && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              {node.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          )}

          {node.type === 'subprocess' && targetProc && (
            <Button size="sm" variant="outline" className="w-full h-7 rounded-lg text-[8px] font-black uppercase border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 transition-all gap-1" onClick={(e) => { e.stopPropagation(); router.push(`/processhub/view/${node.targetProcessId}`); }}>
              <ExternalLink className="w-2.5 h-2.5" /> Referenz: {targetProc.title}
            </Button>
          )}

          {successors.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t mt-2">
              {successors.map((s, idx) => (
                <Button 
                  key={idx} 
                  variant="ghost" 
                  className="h-6 rounded-md px-2 border bg-white shadow-sm gap-1 hover:bg-slate-50 transition-all"
                  onClick={(e) => { e.stopPropagation(); document.getElementById(s.node?.id || '')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveNodeId(s.node?.id || null); }}
                >
                  <span className="text-[8px] font-black uppercase text-slate-400">{s.node?.title}</span>
                  <ArrowRightCircle className="w-2.5 h-2.5 text-slate-300" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • BPMN Ablaufplan</p>
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
          <div className="absolute top-6 right-8 z-30 flex bg-white/90 backdrop-blur-sm p-1 rounded-xl border shadow-md">
            <Button 
              variant={guideSubMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg text-[9px] font-black uppercase px-3"
              onClick={() => setGuideSubMode('list')}
            >
              <List className="w-3.5 h-3.5 mr-1.5" /> Liste
            </Button>
            <Button 
              variant={guideSubMode === 'structured' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg text-[9px] font-black uppercase px-3"
              onClick={() => setGuideSubMode('structured')}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Struktur
            </Button>
          </div>

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
            <div className="flex-1 flex flex-col min-h-0 relative" ref={containerRef}>
              <ScrollArea className="flex-1">
                {guideSubMode === 'list' ? (
                  <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 pb-32 relative">
                    <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary/40" />
                        </marker>
                      </defs>
                      {connectionPaths.map((pathObj, i) => (
                        <path 
                          key={i} 
                          d={pathObj.path} 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={pathObj.highlight ? "3" : "1.5"} 
                          strokeDasharray={pathObj.highlight ? "0" : "4 2"}
                          className={cn(
                            "transition-all duration-500",
                            pathObj.highlight ? "text-primary opacity-60" : "text-slate-300 opacity-10"
                          )}
                          markerEnd={pathObj.highlight ? "url(#arrowhead)" : ""}
                        />
                      ))}
                    </svg>

                    <div className="space-y-12 relative">
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                      {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => (
                        <div key={node.id} className={cn("relative z-10 pl-12")} id={node.id}>
                          <div className={cn(
                            "absolute left-0 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-slate-50 shadow-sm z-20 transition-all cursor-pointer",
                            activeNodeId === node.id ? "scale-125 ring-4 ring-primary/20" : "hover:scale-110",
                            node.type === 'start' ? "bg-emerald-500 text-white" : 
                            node.type === 'end' ? "bg-red-500 text-white" : 
                            node.type === 'decision' ? "bg-amber-500 text-white" : "bg-white text-slate-900 border-slate-200"
                          )} onClick={() => setActiveNodeId(activeNodeId === node.id ? null : node.id)}>
                            {node.type === 'start' ? <ArrowUp className="w-5 h-5" /> : 
                             node.type === 'end' ? <CheckCircle2 className="w-5 h-5" /> :
                             node.type === 'decision' ? <GitBranch className="w-5 h-5" /> :
                             <span className="font-headline font-black text-sm">{i + 1}</span>}
                          </div>
                          
                          <Card 
                            id={`card-${node.id}`}
                            className={cn(
                              "rounded-2xl border shadow-sm overflow-hidden group transition-all bg-white duration-300",
                              activeNodeId === node.id ? "ring-2 ring-primary border-primary/40 shadow-xl" : "hover:border-primary/20"
                            )}
                            onClick={() => setActiveNodeId(activeNodeId === node.id ? null : node.id)}
                          >
                            <CardHeader className="p-4 bg-white border-b flex flex-row items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-headline font-black text-base text-slate-900 uppercase truncate">{node.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[8px] font-black h-4 px-1.5 uppercase">{getFullRoleName(node.roleId)}</Badge>
                                  {node.resourceIds?.map(rid => (
                                    <Badge key={rid} variant="outline" className="text-[7px] font-bold text-slate-400 border-slate-100 h-4 px-1">{resources?.find(r => r.id === rid)?.name}</Badge>
                                  ))}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                              {node.description && <p className="text-xs text-slate-600 leading-relaxed italic">"{node.description}"</p>}
                              {node.checklist && node.checklist.length > 0 && (
                                <div className="grid grid-cols-1 gap-1.5">
                                  {node.checklist.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border">
                                      <CheckCircle className="w-3 h-3 text-emerald-500" /> {item}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 md:p-20 space-y-24 pb-64">
                    {structuredLevels.map((levelNodes, levelIdx) => (
                      <div key={levelIdx} className="relative">
                        {levelIdx < structuredLevels.length - 1 && (
                          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-20">
                            <div className="w-0.5 h-12 bg-slate-400" />
                            <ArrowDown className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        
                        <div className={cn(
                          "grid gap-12 items-center justify-center",
                          levelNodes.length === 1 ? "grid-cols-1 max-w-md mx-auto" : 
                          levelNodes.length === 2 ? "grid-cols-2 max-w-4xl mx-auto" : "grid-cols-3 max-w-6xl mx-auto"
                        )}>
                          {levelNodes.map((node, nodeIdx) => (
                            <div key={node.id} className="flex justify-center">
                              <BpmnNode node={node} index={nodeIdx} isActive={activeNodeId === node.id} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
