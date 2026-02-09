
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
  Move,
  Maximize2,
  X,
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProcessMetadataAction } from '@/app/actions/process-actions';
import { toast } from '@/hooks/use-toast';

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

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout, allProcesses?: any[]) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  const CANVAS_WIDTH = 800;
  const NODE_W = 160;
  const NODE_H = 70;
  const VERTICAL_SPACING = 140;

  nodes.forEach((node, idx) => {
    let nodeSafeId = escapeXml(String(node.id || `node-${idx}`));
    const pos = positions[node.id] || { 
      x: (CANVAS_WIDTH / 2) - (NODE_W / 2), 
      y: 50 + (idx * VERTICAL_SPACING) 
    };
    
    let style = '';
    let w = NODE_W, h = NODE_H;
    let label = node.title;
    
    if (node.type === 'subprocess' && node.targetProcessId) {
      const target = allProcesses?.find(p => p.id === node.targetProcessId);
      label = target ? `Prozess: ${target.title}` : node.title;
    }

    const escapedLabel = escapeXml(label);

    switch (node.type) {
      case 'start': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f0fdf4;strokeColor=#166534;strokeWidth=2;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 50; h = 50; 
        break;
      case 'end': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#fef2f2;strokeColor=#991b1b;strokeWidth=4;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 50; h = 50; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fffbeb;strokeColor=#d97706;strokeWidth=2;shadow=0;fontStyle=1;'; 
        w = 100; h = 100;
        break;
      case 'subprocess':
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#eef2ff;strokeColor=#4338ca;strokeWidth=2;dashed=1;shadow=0;';
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;shadow=0;';
    }
    
    const finalX = positions[node.id] ? (pos as any).x : (CANVAS_WIDTH / 2) - (w / 2);
    
    xml += `<mxCell id="${nodeSafeId}" value="${escapedLabel}" style="${style}" vertex="1" parent="1"><mxGeometry x="${finalX}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = escapeXml(String(edge.source));
    const targetId = escapeXml(String(edge.target));
    const edgeId = escapeXml(String(edge.id || `edge-${idx}`));
    const edgeLabel = escapeXml(edge.label || '');
    if (nodes.some(n => String(n.id) === edge.source) && nodes.some(n => String(n.id) === edge.target)) {
      xml += `<mxCell id="${edgeId}" value="${edgeLabel}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;strokeWidth=2;fontSize=11;fontColor=#334155;endArrow=block;endFill=1;curved=1;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'guide' | 'risks'>('guide');
  const [guideMode, setGuideMode] = useState<'list' | 'structure'>('list');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isUpdatingVvt, setIsUpdatingVvt] = useState(false);
  
  // Interactive Flow States
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [allPaths, setAllPaths] = useState<{ id: string, path: string, label?: string, isActive: boolean, isConnectedToActive: boolean }[]>([]);

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

  const structuredFlow = useMemo(() => {
    if (!activeVersion || guideMode !== 'structure') return { levels: [], edges: [] };
    
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    
    const levels: ProcessNode[][] = [];
    const processed = new Set<string>();
    
    let currentLevelQueue = nodes.filter(n => !edges.some(e => e.target === n.id));
    if (currentLevelQueue.length === 0 && nodes.length > 0) currentLevelQueue = [nodes[0]];

    while (currentLevelQueue.length > 0) {
      levels.push(currentLevelQueue);
      currentLevelQueue.forEach(n => processed.add(n.id));
      
      const nextLevelSet = new Set<string>();
      currentLevelQueue.forEach(n => {
        edges.filter(e => e.source === n.id).forEach(e => {
          if (!processed.has(e.target)) nextLevelSet.add(e.target);
        });
      });
      
      currentLevelQueue = nodes.filter(n => nextLevelSet.has(n.id) && !processed.has(n.id));
    }
    
    return { levels, edges };
  }, [activeVersion, guideMode]);

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

  // SVG PATH CALCULATION LOGIC
  const updateFlowLines = useCallback(() => {
    if (!activeVersion || viewMode !== 'guide' || !containerRef.current) {
      setAllPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const edges = activeVersion.model_json.edges || [];
    const isStructure = guideMode === 'structure';
    
    const newPaths: any[] = [];

    edges.forEach((edge, idx) => {
      const sourceEl = document.getElementById(`card-${edge.source}`);
      const targetEl = document.getElementById(`card-${edge.target}`);
      
      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        let sX, sY, tX, tY, cp1x, cp1y, cp2x, cp2y;

        if (isStructure) {
          sX = sourceRect.left - containerRect.left + (sourceRect.width / 2);
          sY = sourceRect.top - containerRect.top + (sourceRect.height / 2);
          tX = targetRect.left - containerRect.left + (targetRect.width / 2);
          tY = targetRect.top - containerRect.top + (targetRect.height / 2);
          
          cp1x = sX;
          cp1y = (sY + tY) / 2;
          cp2x = tX;
          cp2y = (sY + tY) / 2;
        } else {
          // LISTENANSICHT: Linien setzen an der linken Icon-Box an
          sX = sourceRect.left - containerRect.left + 20; 
          sY = sourceRect.top - containerRect.top + 20;
          tX = targetRect.left - containerRect.left + 20;
          tY = targetRect.top - containerRect.top + 20;
          
          cp1x = sX - 150;
          cp1y = sY;
          cp2x = tX - 150;
          cp2y = tY;
        }

        const path = `M ${sX} ${sY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tX} ${tY}`;
        const isConnectedToActive = activeNodeId === edge.source || activeNodeId === edge.target;
        
        const shouldShow = isStructure || isConnectedToActive;

        if (shouldShow) {
          newPaths.push({ 
            id: `edge-${idx}`, 
            path, 
            label: edge.label, 
            isActive: isConnectedToActive,
            isConnectedToActive
          });
        }
      }
    });

    setAllPaths(newPaths);
  }, [activeNodeId, activeVersion, viewMode, guideMode]);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('resize', updateFlowLines);
    return () => window.removeEventListener('resize', updateFlowLines);
  }, [updateFlowLines]);

  useLayoutEffect(() => {
    const timer = setTimeout(updateFlowLines, 100);
    return () => clearTimeout(timer);
  }, [activeNodeId, activeVersion, viewMode, guideMode, updateFlowLines]);

  // AUTO-RECENTERING LOGIC WHEN SWITCHING MODES
  useEffect(() => {
    if (!mounted || !scrollAreaRef.current) return;

    if (guideMode === 'structure') {
      // Re-center horizontally on switch to structure
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollLeft = (scrollContainer.scrollWidth - scrollContainer.clientWidth) / 2;
          scrollContainer.scrollTop = 0;
        }, 50);
      }
    } else {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollLeft = 0;
      }
    }
  }, [guideMode, mounted]);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || !activeVersion || viewMode !== 'diagram') return;
    const xml = generateMxGraphXml(activeVersion.model_json, activeVersion.layout_json, processes);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 0 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [activeVersion, viewMode, processes]);

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

  const handleNodeClick = (nodeId: string) => {
    const isDeactivating = activeNodeId === nodeId;
    setActiveNodeId(isDeactivating ? null : nodeId);
    
    if (!isDeactivating) {
      setTimeout(() => {
        const el = document.getElementById(`card-${nodeId}`);
        if (el) {
          el.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center', 
            inline: guideMode === 'structure' ? 'center' : 'nearest' 
          });
        }
      }, 100);
    }
  };

  const GuideCard = ({ node, index, compact = false }: { node: ProcessNode, index: number, compact?: boolean }) => {
    const roleName = getFullRoleName(node.roleId);
    const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id);
    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
    const nodeGroups = subjectGroups?.filter(g => node.subjectGroupIds?.includes(g.id));
    const nodeCategories = dataCategories?.filter(c => node.dataCategoryIds?.includes(c.id));
    
    const successors = activeVersion?.model_json.edges
      .filter(e => e.source === node.id)
      .map(e => ({
        edge: e,
        node: activeVersion?.model_json.nodes.find(n => n.id === e.target)
      }))
      .filter(s => !!s.node);

    const isActive = activeNodeId === node.id;
    const targetProc = node.targetProcessId ? processes?.find(p => p.id === node.targetProcessId) : null;

    // COMPACT RENDER (for Non-Active BPMN Nodes)
    if (compact && !isActive) {
      const isDecision = node.type === 'decision';
      const isStart = node.type === 'start';
      const isEnd = node.type === 'end';

      return (
        <div 
          id={`card-${node.id}`}
          className={cn(
            "z-10 transition-all duration-300 shadow-lg cursor-pointer",
            isDecision ? "w-24 h-24 rotate-45 flex items-center justify-center border-4 border-white bg-amber-500 text-white" : 
            (isStart || isEnd) ? "w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-white shadow-xl" : 
            "w-64 rounded-2xl bg-white border border-slate-200 overflow-hidden"
          )} 
          onClick={() => handleNodeClick(node.id)}
        >
          {isDecision ? (
            <div className="-rotate-45 text-center px-2">
              <GitBranch className="w-6 h-6 mx-auto mb-1" />
              <p className="text-[9px] font-black leading-tight uppercase truncate max-w-[60px]">{node.title}</p>
            </div>
          ) : (isStart || isEnd) ? (
            <div className="flex flex-col items-center">
              {isStart ? <ArrowUp className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              <p className="text-[8px] font-black uppercase mt-1">{isStart ? 'Start' : 'Ende'}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className={cn("p-3 border-b flex items-center gap-3", node.type === 'subprocess' ? "bg-indigo-50" : "bg-slate-50")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm", node.type === 'subprocess' ? "bg-indigo-600" : "bg-primary")}>
                  {node.type === 'subprocess' ? <Network className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-900 truncate leading-tight">{node.type === 'subprocess' && targetProc ? `Prozess: ${targetProc.title}` : node.title}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{roleName}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-relaxed">"{node.description || 'Keine Beschreibung'}"</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // FULL DETAILED CARD RENDER
    return (
      <div className={cn("relative z-10", !compact && "pl-12")}>
        {!compact && (
          <div className={cn(
            "absolute left-0 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-slate-50 shadow-sm z-20 transition-all cursor-pointer",
            isActive ? "scale-125 ring-4 ring-primary/20" : "hover:scale-110",
            node.type === 'start' ? "bg-emerald-500 text-white" : 
            node.type === 'end' ? "bg-red-500 text-white" : 
            node.type === 'decision' ? "bg-amber-500 text-white" : "bg-white text-slate-900 border-slate-200"
          )} onClick={() => handleNodeClick(node.id)}>
            {node.type === 'start' ? <ArrowUp className="w-5 h-5" /> : 
             node.type === 'end' ? <CheckCircle2 className="w-5 h-5" /> :
             node.type === 'decision' ? <GitBranch className="w-5 h-5" /> :
             <span className="font-headline font-black text-sm">{index + 1}</span>}
          </div>
        )}

        <Card 
          id={`card-${node.id}`}
          className={cn(
            "rounded-2xl border shadow-sm overflow-hidden group transition-all bg-white duration-300 cursor-pointer",
            isActive ? "ring-2 ring-primary border-primary/40 shadow-xl scale-[1.01]" : "hover:border-primary/20",
            compact && "w-[650px] mx-auto",
            node.type === 'decision' && !isActive && "border-amber-100 bg-amber-50/10",
            node.type === 'subprocess' && !isActive && "border-indigo-100 bg-indigo-50/10"
          )}
          onClick={() => handleNodeClick(node.id)}
        >
          <CardHeader className="p-5 pb-4 bg-white border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-headline font-black text-base text-slate-900 uppercase tracking-tight">{node.title}</h3>
                  <Badge variant="outline" className={cn(
                    "text-[8px] font-black h-4 px-1.5 border-none shadow-none uppercase",
                    node.type === 'decision' ? "bg-amber-100 text-amber-700" : 
                    node.type === 'step' ? "bg-slate-100 text-slate-500" : 
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
                          {res.assetType} • {res.criticality.toUpperCase()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
              {node.type === 'subprocess' && targetProc && (
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 shadow-sm" onClick={(e) => { e.stopPropagation(); router.push(`/processhub/view/${node.targetProcessId}`); }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Prozess: {targetProc.title}
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
                      {node.tips && <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-[10px] font-bold text-blue-900 italic"><Lightbulb className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" /> {node.tips}</div>}
                      {node.errors && <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100 text-[10px] font-bold text-red-900 italic"><AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /> {node.errors}</div>}
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
                </div>
              </div>
            </div>

            <CardFooter className="p-3 bg-slate-50 border-t flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {successors.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {successors.map((s, idx) => (
                      <Button 
                        key={idx} 
                        variant="ghost" 
                        className="h-8 rounded-full px-4 border bg-white shadow-sm gap-2 group/next active:scale-95 transition-all"
                        onClick={(e) => { e.stopPropagation(); handleNodeClick(s.node?.id || ''); }}
                      >
                        {s.edge.label && <Badge className="bg-amber-500 text-white border-none h-3.5 px-1 text-[6px] font-black uppercase">{s.edge.label}</Badge>}
                        <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 truncate max-w-[80px]">{s.node?.title}</span>
                        <ArrowRightCircle className="w-3.5 h-3.5 text-slate-300 group-hover/next:text-primary group-hover/next:translate-x-0.5 transition-all" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardFooter>
          </CardContent>
        </Card>
      </div>
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

        <main className="flex-1 flex flex-col bg-slate-100 relative min-w-0">
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
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              {/* STICKY MODE BUTTONS - Outside ScrollArea to stay visible */}
              <div className="absolute top-6 right-8 z-30 bg-white/90 backdrop-blur shadow-xl border rounded-xl p-1.5 flex gap-1">
                <Button variant={guideMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => setGuideMode('list')}>Liste</Button>
                <Button variant={guideMode === 'structure' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => setGuideMode('structure')}>Struktur (BPMN)</Button>
              </div>

              <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div 
                  className={cn(
                    "p-6 md:p-10 mx-auto space-y-12 pb-32 relative min-h-[1000px] transition-all duration-500",
                    guideMode === 'structure' ? "min-w-[1400px]" : "max-w-5xl w-full pl-20"
                  )} 
                  ref={containerRef}
                >
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-slate-400" />
                      </marker>
                      <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary" />
                      </marker>
                    </defs>
                    {allPaths.map((p) => (
                      <g key={p.id}>
                        <path 
                          id={p.id}
                          d={p.path} 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={p.isActive ? "4" : "2"} 
                          strokeDasharray={guideMode === 'list' ? "4 2" : "none"}
                          className={cn(
                            p.isActive ? "text-primary z-30 opacity-100" : cn("text-slate-300 z-0", activeNodeId ? "opacity-20" : "opacity-40"),
                            "transition-all duration-500"
                          )}
                          markerEnd={p.isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                        />
                        {p.label && guideMode === 'structure' && (
                          <text 
                            className={cn("text-[9px] font-black uppercase", p.isActive ? "text-primary" : "text-slate-400 opacity-40")}
                            dy="-5"
                            fill="currentColor"
                            style={{ 
                              paintOrder: 'stroke', 
                              stroke: 'white', 
                              strokeWidth: '4px', 
                              textAnchor: 'middle'
                            }}
                          >
                            <textPath href={`#${p.id}`} startOffset="50%">{p.label}</textPath>
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>

                  {guideMode === 'list' && (
                    <div className="space-y-12 relative">
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                      {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => (
                        <GuideCard key={node.id} node={node} index={i} />
                      ))}
                    </div>
                  )}

                  {guideMode === 'structure' && (
                    <div className="space-y-20 py-10 relative">
                      {structuredFlow.levels.map((row, rowIdx) => (
                        <div key={rowIdx} className="relative flex justify-center gap-16 min-h-[140px]">
                          {row.map((node) => (
                            <div key={node.id} className="relative flex flex-col items-center">
                              <GuideCard node={node} index={0} compact={true} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
