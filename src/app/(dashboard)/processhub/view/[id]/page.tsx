
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
  HelpCircle,
  MoreHorizontal,
  Split,
  XCircle
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
  const [guideSubMode, setGuideSubMode] = useState<'list' | 'structured'>('list');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isUpdatingVvt, setIsUpdatingVvt] = useState(false);
  
  // Interactive Flow States
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

  const structuredGrid = useMemo(() => {
    if (!activeVersion || guideSubMode !== 'structured') return [];
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    
    const nodeToLevel: Record<string, number> = {};
    const nodeToColumn: Record<string, number> = {};
    
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
            nodeToLevel[edge.target] = targetLevel;
            changed = true;
          }
        }
      });
    }

    const levelGroups: Record<number, ProcessNode[]> = {};
    Object.entries(nodeToLevel).forEach(([id, l]) => {
      if (!levelGroups[l]) levelGroups[l] = [];
      const node = nodes.find(n => n.id === id);
      if (node) levelGroups[l].push(node);
    });

    return Object.keys(levelGroups).sort((a, b) => Number(a) - Number(b)).map(l => levelGroups[Number(l)]);
  }, [activeVersion, guideSubMode]);

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
    if (!activeVersion || viewMode !== 'guide' || !containerRef.current) {
      setConnectionPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, highlight: boolean, label?: string }[] = [];

    edges.forEach(edge => {
      const sourceEl = document.getElementById(`card-${edge.source}`);
      const targetEl = document.getElementById(`card-${edge.target}`);
      
      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const sX = sourceRect.left - containerRect.left + (sourceRect.width / 2);
        const sY = sourceRect.top - containerRect.top + sourceRect.height;
        const tX = targetRect.left - containerRect.left + (targetRect.width / 2);
        const tY = targetRect.top - containerRect.top;

        const path = `M ${sX} ${sY} C ${sX} ${sY + 40}, ${tX} ${tY - 40}, ${tX} ${tY}`;
        const isHighlighted = activeNodeId === edge.source || activeNodeId === edge.target;
        const isAnyActive = !!activeNodeId;
        
        newPaths.push({ 
          path, 
          highlight: isHighlighted, 
          label: edge.label 
        });
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
    if (viewMode === 'guide') {
      setTimeout(updateFlowLines, 100);
    }
  }, [activeNodeId, activeVersion, viewMode, guideSubMode, updateFlowLines]);

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

  const GuideCard = ({ node }: { node: ProcessNode }) => {
    const isActive = activeNodeId === node.id;
    const roleName = getFullRoleName(node.roleId);
    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
    const nodeFeatures = allFeatures?.filter(f => node.featureIds?.includes(f.id));
    const nodeSubjects = subjectGroups?.filter(g => node.subjectGroupIds?.includes(g.id));
    const nodeCats = dataCategories?.filter(c => node.dataCategoryIds?.includes(c.id));

    // Logical neighbors for the card
    const predecessors = activeVersion.model_json.edges.filter(e => e.target === node.id).map(e => activeVersion.model_json.nodes.find(n => n.id === e.source)).filter(Boolean);
    const successors = activeVersion.model_json.edges.filter(e => e.source === node.id).map(e => activeVersion.model_json.nodes.find(n => n.id === e.target)).filter(Boolean);

    const isBpmnEvent = node.type === 'start' || node.type === 'end';
    const isDecision = node.type === 'decision';

    if (guideSubMode === 'structured') {
      // Small BPMN Style node for grid
      return (
        <div id={`card-${node.id}`} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveNodeId(isActive ? null : node.id)}>
          <div className={cn(
            "transition-all duration-300 shadow-lg relative flex items-center justify-center",
            isBpmnEvent ? "w-12 h-12 rounded-full border-4" : isDecision ? "w-16 h-16 border-2 rotate-45" : "w-48 h-20 rounded-xl border-2",
            node.type === 'start' ? "border-emerald-500 bg-emerald-50" : 
            node.type === 'end' ? "border-red-600 bg-red-50" : 
            isDecision ? "border-amber-500 bg-white" : "border-slate-200 bg-white",
            isActive && "ring-4 ring-primary/20 scale-105 border-primary"
          )}>
            <div className={cn(isDecision && "-rotate-45", "flex flex-col items-center gap-1 p-2 text-center")}>
              {node.type === 'start' && <PlayCircle className="w-6 h-6 text-emerald-600" />}
              {node.type === 'end' && <StopCircle className="w-6 h-6 text-red-600" />}
              {isDecision && <HelpCircle className="w-6 h-6 text-amber-600" />}
              {!isBpmnEvent && !isDecision && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 line-clamp-2">{node.title}</p>
                  <p className="text-[8px] font-bold text-slate-400 truncate w-full">{roleName}</p>
                </>
              )}
            </div>
          </div>
          {(isBpmnEvent || isDecision) && <span className="text-[9px] font-black uppercase text-slate-500 text-center max-w-[100px]">{node.title}</span>}
        </div>
      );
    }

    // High Density Guide Card for List View
    return (
      <Card 
        id={`card-${node.id}`}
        className={cn(
          "w-full max-w-4xl mx-auto rounded-2xl border shadow-sm transition-all duration-500 bg-white group cursor-pointer relative z-10",
          isActive ? "ring-4 ring-primary/10 border-primary shadow-xl scale-[1.01]" : "hover:border-primary/20",
          isDecision && "border-amber-200 bg-amber-50/5",
          isBpmnEvent && "opacity-80"
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
                <Badge variant="outline" className="text-[8px] font-black border-none bg-slate-100 text-slate-500 h-4 uppercase">{isDecision ? 'Entscheidung' : 'Prozessschritt'}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Briefcase className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500">{roleName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
            {nodeResources?.map(res => (
              <TooltipProvider key={res.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn(
                      "h-6 px-2 text-[9px] font-black gap-1.5 border-none shadow-sm",
                      res.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700"
                    )}>
                      <Server className="w-3 h-3" /> {res.name}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px] font-bold uppercase">{res.assetType} • Criticality: {res.criticality}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Primary Action Area */}
            <div className="md:col-span-7 p-6 space-y-6">
              {node.description && (
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tätigkeitsbeschreibung</Label>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description}"</p>
                </div>
              )}

              {node.checklist && node.checklist.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operative Checkliste
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

            {/* Context & GRC Area */}
            <div className="md:col-span-5 p-6 bg-slate-50/30 space-y-6">
              {(node.tips || node.errors) && (
                <div className="space-y-4">
                  <Label className="text-[9px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5" /> Expertise & Best-Practice
                  </Label>
                  {node.tips && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-blue-800">Profi-Tipp</p>
                      <p className="text-[10px] text-blue-700 leading-relaxed italic">{node.tips}</p>
                    </div>
                  )}
                  {node.errors && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-red-800">Häufige Fehler</p>
                      <p className="text-[10px] text-red-700 leading-relaxed italic">{node.errors}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Compliance Daten
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {nodeFeatures?.map(f => <Badge key={f.id} variant="outline" className="bg-white border-sky-100 text-sky-700 text-[8px] font-black h-5 px-2 shadow-sm uppercase">{f.name}</Badge>)}
                  {nodeSubjects?.map(s => <Badge key={s.id} variant="outline" className="bg-white border-emerald-100 text-emerald-700 text-[8px] font-black h-5 px-2 shadow-sm uppercase">{s.name}</Badge>)}
                  {nodeCats?.map(c => <Badge key={c.id} variant="outline" className="bg-white border-blue-100 text-blue-700 text-[8px] font-black h-5 px-2 shadow-sm uppercase">{c.name}</Badge>)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-3 bg-slate-50 border-t flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {predecessors.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">Von:</span>
                {predecessors.map(p => (
                  <Badge key={p?.id} variant="ghost" className="bg-white border border-slate-200 text-[8px] font-bold h-5 px-1.5 truncate max-w-[100px]">{p?.title}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[8px] font-black text-primary uppercase">Weiter zu:</span>
            {successors.map(s => (
              <Button 
                key={s.node?.id} 
                variant="outline" 
                size="sm" 
                className="h-7 rounded-lg text-[9px] font-black uppercase bg-white border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                onClick={(e) => { e.stopPropagation(); setActiveNodeId(s.node?.id || null); }}
              >
                {s.node?.title} <ArrowRight className="w-2.5 h-2.5 ml-1" />
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
        {/* Simplified Sidebar */}
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
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Struktur (BPMN)
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
                    <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100">
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
                            <div key={r.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => router.push(`/risks/${r.id}`)}>
                              <div className="flex items-center gap-3">
                                <Badge className={cn(
                                  "h-6 w-8 justify-center rounded-md font-black text-[10px] border-none",
                                  (r.impact * r.probability) >= 15 ? "bg-red-600 text-white" : (r.impact * r.probability) >= 8 ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                                )}>{r.impact * r.probability}</Badge>
                                <span className="text-[11px] font-bold text-slate-800">{r.title}</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-all" />
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
                            <div key={r.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => router.push(`/risks/${r.id}`)}>
                              <div className="flex items-center gap-3">
                                <Badge className={cn(
                                  "h-6 w-8 justify-center rounded-md font-black text-[10px] border-none",
                                  (r.impact * r.probability) >= 15 ? "bg-red-600 text-white" : (r.impact * r.probability) >= 8 ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                                )}>{r.impact * r.probability}</Badge>
                                <span className="text-[11px] font-bold text-slate-800">{r.title}</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-all" />
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
                <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-24 pb-64 relative">
                  
                  {/* Flow Lines SVG Overlay */}
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
                        className={cn(
                          "transition-all duration-500",
                          pathObj.highlight ? "text-primary opacity-80" : "text-slate-200 opacity-20"
                        )}
                        markerEnd="url(#arrowhead)"
                      />
                    ))}
                  </svg>

                  <div className="space-y-16 relative z-10">
                    {guideSubMode === 'structured' ? (
                      structuredGrid.map((levelNodes, levelIdx) => (
                        <div key={levelIdx} className="grid gap-12 items-center justify-center" style={{ gridTemplateColumns: `repeat(${levelNodes.length}, minmax(200px, 1fr))` }}>
                          {levelNodes.map((node, nodeIdx) => (
                            <div key={node.id} className="flex justify-center">
                              <GuideCard node={node} />
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => (
                        <div key={node.id} className="flex justify-center">
                          <GuideCard node={node} />
                        </div>
                      ))
                    )}
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
