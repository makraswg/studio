"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  ShieldCheck,
  Activity, 
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
  Clock,
  User as UserIcon,
  Layers,
  FileText,
  Tag,
  Zap,
  CheckCircle2,
  Target,
  Server,
  AlertCircle,
  FileCheck,
  UserCircle,
  LayoutGrid,
  List,
  PlayCircle,
  StopCircle,
  HelpCircle,
  Maximize2,
  Minus,
  Plus,
  Edit3,
  ArrowRightCircle,
  ArrowLeftCircle,
  Terminal,
  Focus,
  BrainCircuit,
  ChevronDown,
  Scale,
  Settings2,
  Database,
  Image as ImageIcon,
  Paperclip,
  FileDown
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
  Department, 
  Feature, 
  Resource, 
  ProcessingActivity, 
  JobTitle,
  UiConfig,
  ProcessType,
  MediaFile,
  Tenant
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { exportDetailedProcessPdf } from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';

const OFFSET_X = 2500;
const OFFSET_Y = 2500;

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataSource, activeTenantId } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [guideMode, setGuideMode] = useState<'list' | 'structure'>('structure');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);
  
  const hasAutoCentered = useRef(false);
  const stateRef = useRef({ position, scale, guideMode });
  useEffect(() => {
    stateRef.current = { position, scale, guideMode };
  }, [position, scale, guideMode]);

  const { data: uiConfigs } = usePluggableCollection<UiConfig>('uiConfigs');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: mediaFiles } = usePluggableCollection<MediaFile>('media');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const activeVersion = useMemo(() => versions?.find((v: any) => v.process_id === id && v.version === currentProcess?.currentVersion), [versions, id, currentProcess]);

  const animationsEnabled = useMemo(() => {
    if (!uiConfigs || uiConfigs.length === 0) return true;
    return uiConfigs[0].enableAdvancedAnimations === true || uiConfigs[0].enableAdvancedAnimations === 1;
  }, [uiConfigs]);

  const gridNodes = useMemo(() => {
    if (!activeVersion) return [];
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    
    const levels: Record<string, number> = {};
    const lanes: Record<string, number> = {};
    const occupiedLanesPerLevel = new Map<number, Set<number>>();

    nodes.forEach(n => levels[n.id] = 0);
    let changed = true;
    let limit = nodes.length * 2;
    while (changed && limit > 0) {
      changed = false;
      edges.forEach(edge => {
        if (levels[edge.target] <= levels[edge.source]) {
          levels[edge.target] = levels[edge.source] + 1;
          changed = true;
        }
      });
      limit--;
    }

    const processed = new Set<string>();
    const queue = nodes.filter(n => !edges.some(e => e.target === n.id)).map(n => ({ id: n.id, lane: 0 }));
    
    while (queue.length > 0) {
      const { id, lane } = queue.shift()!;
      if (processed.has(id)) continue;
      
      const lv = levels[id];
      let finalLane = lane;
      if (!occupiedLanesPerLevel.has(lv)) occupiedLanesPerLevel.set(lv, new Set());
      const levelOccupancy = occupiedLanesPerLevel.get(lv)!;
      while (levelOccupancy.has(finalLane)) { finalLane++; }
      
      lanes[id] = finalLane;
      levelOccupancy.add(finalLane);
      processed.add(id);

      const children = edges.filter(e => e.source === id).map(e => e.target);
      children.forEach((childId, idx) => { queue.push({ id: childId, lane: finalLane + idx }); });
    }

    const H_GAP = 350;
    const V_GAP = 160; 
    const WIDTH_DIFF = 600 - 256;

    return nodes.map(n => {
      const lane = lanes[n.id] || 0;
      const lv = levels[n.id] || 0;
      let x = lane * H_GAP;
      let y = lv * V_GAP;

      if (activeNodeId === n.id) {
        // No movement
      } else if (activeNodeId) {
        const activeLv = levels[activeNodeId];
        const activeLane = lanes[activeNodeId];
        if (lv === activeLv) {
          if (lane > activeLane) x += (WIDTH_DIFF / 2) + 40;
          if (lane < activeLane) x -= (WIDTH_DIFF / 2) + 40;
        }
        if (lv > activeLv) { y += 340; }
      }
      return { ...n, x, y };
    });
  }, [activeVersion, activeNodeId]);

  const centerOnNode = useCallback((nodeId: string) => {
    const node = gridNodes.find(n => n.id === nodeId);
    if (!node || !containerRef.current) return;

    if (guideMode === 'structure') {
      setIsProgrammaticMove(true);
      const targetScale = 1.0;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      setPosition({
        x: -(node.x + OFFSET_X) * targetScale + containerWidth / 2 - (128 * targetScale),
        y: -(node.y + OFFSET_Y) * targetScale + containerHeight / 2 - (150 * targetScale)
      });
      setScale(targetScale);
      setTimeout(() => setIsProgrammaticMove(false), 850);
    } else {
      const el = document.getElementById(`list-node-${nodeId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [gridNodes, guideMode]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !hasAutoCentered.current && gridNodes.length > 0) {
      const startNode = gridNodes.find(n => n.type === 'start') || gridNodes[0];
      centerOnNode(startNode.id);
      hasAutoCentered.current = true;
    }
  }, [mounted, gridNodes, centerOnNode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      const { position: pos, scale: s, guideMode: mode } = stateRef.current;
      if (mode !== 'structure') return;
      e.preventDefault();
      
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(0.2, s + delta), 2);
      
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const pivotX = (mouseX - pos.x) / s;
      const pivotY = (mouseY - pos.y) / s;
      
      const newX = mouseX - pivotX * newScale;
      const newY = mouseY - pivotY * newScale;
      
      setPosition({ x: newX, y: newY });
      setScale(newScale);
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, []);

  const updateFlowLines = useCallback(() => {
    if (!activeVersion || gridNodes.length === 0) { setConnectionPaths([]); return; }
    const edges = activeVersion.model_json.edges || [];
    const newPaths: any[] = [];

    edges.forEach((edge, i) => {
      const sNode = gridNodes.find(n => n.id === edge.source);
      const tNode = gridNodes.find(n => n.id === edge.target);
      if (sNode && tNode) {
        const sIsExp = sNode.id === activeNodeId;
        const isPathActive = sIsExp || tNode.id === activeNodeId;
        const sH = sIsExp ? 420 : 82; 
        const sX = sNode.x + OFFSET_X + 128;
        const sY = sNode.y + OFFSET_Y + sH;
        const tX = tNode.x + OFFSET_X + 128;
        const tY = tNode.y + OFFSET_Y;
        
        const dy = tY - sY;
        const path = `M ${sX} ${sY} C ${sX} ${sY + dy/2}, ${tX} ${tY - dy/2}, ${tX} ${tY}`;
        newPaths.push({ id: i, path, sourceId: edge.source, targetId: edge.target, label: edge.label, isActive: isPathActive });
      }
    });
    setConnectionPaths(newPaths);
  }, [activeVersion, gridNodes, activeNodeId]);

  useEffect(() => { updateFlowLines(); }, [gridNodes, activeNodeId, updateFlowLines]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || guideMode !== 'structure') return;
    setIsProgrammaticMove(false); 
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || guideMode !== 'structure') return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setIsDragging(false); };

  const handleNodeClick = useCallback((nodeId: string) => {
    if (activeNodeId === nodeId) {
      setActiveNodeId(null);
    } else {
      setActiveNodeId(nodeId);
      setTimeout(() => centerOnNode(nodeId), 50);
    }
  }, [activeNodeId, centerOnNode]);

  const handleExportPdf = async () => {
    if (!currentProcess || !activeVersion || !tenants || !jobTitles || !departments) return;
    setIsExporting(true);
    try {
      const tenant = tenants.find(t => t.id === currentProcess.tenantId) || tenants[0];
      await exportDetailedProcessPdf(currentProcess, activeVersion, tenant, jobTitles, departments);
      toast({ title: "Export erfolgreich", description: "PDF Bericht wurde generiert." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Export", description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const getFullRoleName = useCallback((roleId?: string) => {
    if (!roleId) return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  }, [jobTitles, departments]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50 relative w-full">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 rounded-xl transition-all"><ChevronLeft className="w-6 h-6" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold text-slate-900">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">V{activeVersion?.version || currentProcess?.currentVersion}.0 • Dokumentation</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={guideMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 text-[9px] font-bold uppercase" onClick={() => setGuideMode('list')}><List className="w-3.5 h-3.5 mr-1.5" /> Liste</Button>
            <Button variant={guideMode === 'structure' ? 'secondary' : 'ghost'} size="sm" className="h-8 text-[9px] font-bold uppercase" onClick={() => setGuideMode('structure')}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Karte</Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportPdf} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF Bericht
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase gap-2" onClick={() => router.push(`/processhub/${id}`)}><Edit3 className="w-3.5 h-3.5" /> Designer</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside className="w-80 border-r bg-white flex flex-col shrink-0 hidden lg:flex shadow-sm">
          <ScrollArea className="flex-1 p-6 space-y-10">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Stammdaten</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Verantwortliche Abteilung</Label>
                  <p className="text-xs font-bold text-slate-800">{departments?.find(d => d.id === currentProcess?.responsibleDepartmentId)?.name || '---'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Process Owner</Label>
                  <p className="text-xs font-bold text-slate-800">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Automatisierungsgrad</Label>
                  <Badge variant="outline" className="text-[9px] font-black h-5 px-2 bg-slate-50 uppercase border-slate-200">{currentProcess?.automationLevel || 'manual'}</Badge>
                </div>
              </div>
            </section>
          </ScrollArea>
        </aside>

        <main 
          ref={containerRef}
          className={cn("flex-1 relative overflow-hidden", guideMode === 'structure' ? "bg-slate-200 cursor-grab active:cursor-grabbing" : "bg-slate-50")} 
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        >
          {guideMode === 'list' ? (
            <ScrollArea className="h-full p-10">
              <div className="max-w-5xl mx-auto space-y-12 pb-40">
                {gridNodes.map((node, i) => (
                  <div key={node.id} id={`list-node-${node.id}`} className="relative">
                    <ProcessStepCard 
                      node={node} 
                      activeNodeId={activeNodeId} 
                      setActiveNodeId={handleNodeClick} 
                      resources={resources} 
                      allFeatures={allFeatures} 
                      getFullRoleName={getFullRoleName} 
                      allNodes={gridNodes} 
                      mediaFiles={mediaFiles} 
                      expandedByDefault 
                      animationsEnabled={animationsEnabled} 
                    />
                    {i < gridNodes.length - 1 && (
                      <div className="absolute left-1/2 -bottom-12 -translate-x-1/2 flex flex-col items-center">
                        <div className={cn("w-0.5 h-12 bg-slate-200 relative", activeNodeId === node.id && "bg-primary")}></div>
                        <ChevronDown className={cn("w-4 h-4 text-slate-200 -mt-1.5", activeNodeId === node.id && "text-primary")} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, width: '5000px', height: '5000px', zIndex: 10, transition: isProgrammaticMove ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }}>
              <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
                <defs><marker id="arrowhead-v" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><polygon points="0 0, 5 2.5, 0 5" fill="currentColor" /></marker></defs>
                {connectionPaths.map((p) => (
                  <g key={p.id}>
                    <path d={p.path} fill="none" stroke={p.isActive ? "hsl(var(--primary))" : "#94a3b8"} strokeWidth={p.isActive ? "3" : "1.5"} markerEnd="url(#arrowhead-v)" className={cn("transition-all", animationsEnabled && p.isActive && "animate-flow-dash")} />
                    {p.label && (
                      <g transform={`translate(${(p.path.match(/C\s([\d.-]+)\s([\d.-]+)/) || [])[1]}, ${(p.path.match(/C\s([\d.-]+)\s([\d.-]+)/) || [])[2]})`}>
                        <rect x="-30" y="-10" width="60" height="20" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" />
                        <text fontSize="9" fontWeight="bold" fill="#64748b" textAnchor="middle" dy="3">{p.label}</text>
                      </g>
                    )}
                  </g>
                ))}
              </svg>
              {gridNodes.map(node => (<div key={node.id} className="absolute transition-all duration-500" style={{ left: node.x + OFFSET_X, top: node.y + OFFSET_Y }}><ProcessStepCard node={node} isMapMode activeNodeId={activeNodeId} setActiveNodeId={handleNodeClick} resources={resources} allFeatures={allFeatures} mediaFiles={mediaFiles} getFullRoleName={getFullRoleName} animationsEnabled={animationsEnabled} /></div>))}
            </div>
          )}
          {guideMode === 'structure' && (
            <div className="absolute bottom-8 right-8 z-50 bg-white shadow-2xl border rounded-2xl p-1.5 flex flex-col gap-1.5">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.min(2, s + 0.1))}><Plus className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.max(0.2, s - 0.1))}><Minus className="w-5 h-5" /></Button>
              <Separator className="my-1" />
              <Button variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={() => { if(gridNodes.length > 0) centerOnNode(activeNodeId || gridNodes[0].id); }}><Focus className="w-5 h-5" /></Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProcessStepCard({ node, isMapMode = false, activeNodeId, setActiveNodeId, resources, allFeatures, mediaFiles, getFullRoleName, expandedByDefault = false, animationsEnabled }: any) {
  const isActive = activeNodeId === node.id;
  const isExpanded = expandedByDefault || (isMapMode && isActive);
  const nodeResources = resources?.filter((r:any) => node.resourceIds?.includes(r.id));
  const nodeFeatures = allFeatures?.filter((f:any) => node.featureIds?.includes(f.id));
  const nodeMedia = mediaFiles?.filter((m: any) => m.subEntityId === node.id);
  const roleName = getFullRoleName(node.roleId);

  return (
    <Card className={cn("rounded-2xl border transition-all duration-500 bg-white cursor-pointer relative overflow-hidden", isActive ? "border-primary border-2 shadow-lg z-[100]" : "border-slate-100 shadow-sm hover:border-primary/20", isMapMode && (isActive ? "w-[600px] h-[420px]" : "w-64 h-[82px]"))} style={isMapMode && isActive ? { transform: 'translateX(-172px)' } : {}} onClick={(e) => { e.stopPropagation(); setActiveNodeId(node.id); }}>
      <CardHeader className={cn("p-4 flex flex-row items-center justify-between gap-4 transition-colors", isExpanded ? "bg-slate-50 border-b" : "border-b-0")}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", node.type === 'start' ? "bg-emerald-50 text-emerald-600" : node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'subprocess' ? "bg-indigo-600 text-white" : "bg-primary/5 text-primary")}>
            {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : node.type === 'decision' ? <HelpCircle className="w-6 h-6" /> : node.type === 'subprocess' ? <RefreshCw className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn("font-black uppercase tracking-tight text-slate-900 truncate", isMapMode && !isActive ? "text-[10px]" : "text-sm")}>{node.title}</h4>
              {nodeMedia && nodeMedia.length > 0 && !isExpanded && <Paperclip className="w-2.5 h-2.5 text-indigo-400" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5"><Briefcase className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{roleName}</span></div>
          </div>
        </div>
        {nodeMedia && nodeMedia.length > 0 && !isExpanded && <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-full h-4 px-1.5"><Paperclip className="w-2.5 h-2.5" /></Badge>}
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-6 space-y-6 animate-in fade-in overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <div className="space-y-4 overflow-hidden flex flex-col">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tätigkeit</Label>
                <ScrollArea className="max-h-[100px] pr-2">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description || 'Keine Beschreibung hinterlegt.'}"</p>
                </ScrollArea>
              </div>
              
              <div className="space-y-2 flex-1 min-h-0">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Prüfschritte</Label>
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-1.5">
                    {node.checklist?.map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
                        <span className="text-[11px] font-bold text-slate-700">{item}</span>
                      </div>
                    ))}
                    {(!node.checklist || node.checklist.length === 0) && <p className="text-[10px] text-slate-300 italic">Keine Checkliste</p>}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-4 flex flex-col">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Infrastruktur & Daten</Label>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase">IT-Systeme</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nodeResources?.map((res:any) => <Badge key={res.id} variant="outline" className="text-[8px] font-black h-5 border-indigo-100 bg-indigo-50/30 text-indigo-700 uppercase">{res.name}</Badge>)}
                      {nodeResources?.length === 0 && <span className="text-[9px] text-slate-300 italic">Keine Systeme</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Datenobjekte</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nodeFeatures?.map((f:any) => <Badge key={f.id} variant="outline" className="text-[8px] font-black h-5 border-emerald-100 bg-emerald-50/30 text-emerald-700 uppercase">{f.name}</Badge>)}
                      {nodeFeatures?.length === 0 && <span className="text-[9px] text-slate-300 italic">Keine Datenobjekte</span>}
                    </div>
                  </div>
                </div>
              </div>

              {nodeMedia && nodeMedia.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Materialien ({nodeMedia.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {nodeMedia.map((f: any) => (
                      <div key={f.id} className="p-2 bg-slate-50 rounded-lg border text-[10px] font-bold flex items-center gap-2 shadow-sm hover:bg-white transition-all" onClick={(e) => { e.stopPropagation(); window.open(f.fileUrl, '_blank'); }}>
                        <ImageIcon className="w-3 h-3 text-indigo-400" /> {f.fileName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
