
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Terminal
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
  JobTitle
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const OFFSET_X = 2500;
const OFFSET_Y = 2500;

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [guideMode, setGuideMode] = useState<'list' | 'structure'>('list');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<{ path: string, sourceId: string, targetId: string }[]>([]);

  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const hasAutoCentered = useRef(false);

  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const activeVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

  const getFullRoleName = useCallback((roleId?: string) => {
    if (!roleId) return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  }, [jobTitles, departments]);

  /**
   * Robust Hierarchical Layout Engine (Longest Path with Column Shifting)
   * This ensures branches are visible side-by-side.
   */
  const gridNodes = useMemo(() => {
    if (!activeVersion) return [];
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    
    const levels: Record<string, number> = {};
    const nodeConfigs: any[] = [];

    // 1. Level Calculation (Ranks)
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

    // 2. Hierarchical Column Assignment
    // We walk through the graph to assign columns to branches
    const columns: Record<string, number> = {};
    const levelUsage: Record<number, number> = {};
    
    // Sort nodes by level to process them in order
    const sortedNodes = [...nodes].sort((a, b) => levels[a.id] - levels[b.id]);
    
    sortedNodes.forEach(node => {
      const lv = levels[node.id];
      const parents = edges.filter(e => e.target === node.id);
      
      let col = 0;
      if (parents.length > 0) {
        // Try to place near primary parent
        const parentCols = parents.map(p => columns[p.source]);
        const primaryParentCol = parentCols[0];
        
        // Find next free column in this level starting from parent's column
        col = primaryParentCol;
        while (nodeConfigs.some(nc => nc.level === lv && (columns[nc.id] === col || columns[nc.id] === col))) {
          col++;
        }
      } else {
        // Root nodes
        col = levelUsage[lv] || 0;
      }
      
      columns[node.id] = col;
      levelUsage[lv] = Math.max(levelUsage[lv] || 0, col + 1);
      nodeConfigs.push({ ...node, level: lv, col: col });
    });

    // 3. Coordinate Projection
    const H_GAP = 450;
    const V_GAP = 220;
    const EXPANDED_W = 600;
    const COLLAPSED_W = 256;
    const EXTRA_W = (EXPANDED_W - COLLAPSED_W);

    return nodeConfigs.map(n => {
      const lvSize = levelUsage[n.level];
      const startX = -(lvSize - 1) * (H_GAP / 2);
      
      let x = startX + n.col * H_GAP;
      let y = n.level * V_GAP;

      // Symmetrical Shifting for Active Node
      if (activeNodeId) {
        const activeNode = nodeConfigs.find(ac => ac.id === activeNodeId);
        if (activeNode) {
          const aLv = activeNode.level;
          const aCol = columns[activeNodeId];
          
          if (n.level === aLv) {
            if (n.col > aCol) x += (EXTRA_W / 2) + 20;
            if (n.col < aCol) x -= (EXTRA_W / 2) + 20;
          }
          if (n.level > aLv) {
            y += 350; // Push following levels down
          }
        }
      }

      return { ...n, x, y };
    });
  }, [activeVersion, activeNodeId]);

  const updateFlowLines = useCallback(() => {
    if (!activeVersion || gridNodes.length === 0) {
      setConnectionPaths([]);
      return;
    }

    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, sourceId: string, targetId: string }[] = [];

    edges.forEach(edge => {
      const sNode = gridNodes.find(n => n.id === edge.source);
      const tNode = gridNodes.find(n => n.id === edge.target);
      
      if (sNode && tNode) {
        const sIsExp = sNode.id === activeNodeId;
        const tIsExp = tNode.id === activeNodeId;
        
        const sW = sIsExp ? 600 : 256;
        const tW = tIsExp ? 600 : 256;
        const sH = sIsExp ? 400 : 80;

        // BPMN Standard: Exit Bottom Center, Entry Top Center
        const sX = sNode.x + OFFSET_X + (sW / 2);
        const sY = sNode.y + OFFSET_Y + sH;

        const tX = tNode.x + OFFSET_X + (tW / 2);
        const tY = tNode.y + OFFSET_Y;

        const dy = tY - sY;
        const stub = 40; // Vertical stub for cleaner entrance/exit
        
        const path = `M ${sX} ${sY} L ${sX} ${sY + stub} C ${sX} ${sY + dy/2}, ${tX} ${tY - dy/2}, ${tX} ${tY - stub} L ${tX} ${tY}`;
        newPaths.push({ path, sourceId: edge.source, targetId: edge.target });
      }
    });

    setConnectionPaths(newPaths);
  }, [activeVersion, gridNodes, activeNodeId]);

  const resetViewport = useCallback(() => {
    if (gridNodes.length === 0 || !containerRef.current) return;
    
    const startNode = gridNodes.find(n => n.type === 'start') || gridNodes[0];
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    setPosition({
      x: -(startNode.x + OFFSET_X) * scale + containerWidth / 2 - (128 * scale),
      y: -(startNode.y + OFFSET_Y) * scale + containerHeight / 2 - (40 * scale)
    });
  }, [gridNodes, scale]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && guideMode === 'structure' && !hasAutoCentered.current && gridNodes.length > 0) {
      resetViewport();
      hasAutoCentered.current = true;
    }
  }, [guideMode, mounted, gridNodes, resetViewport]);

  useEffect(() => {
    updateFlowLines();
  }, [activeVersion, gridNodes, updateFlowLines]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || guideMode !== 'structure') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || guideMode !== 'structure') return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (guideMode !== 'structure') return;
    e.preventDefault();
    
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.2, scale + delta), 2);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const pivotX = (mouseX - position.x) / scale;
    const pivotY = (mouseY - position.y) / scale;
    
    const newX = mouseX - pivotX * newScale;
    const newY = mouseY - pivotY * newScale;
    
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-6 h-6" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold text-slate-900">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">V{activeVersion?.version}.0 • Prozess-Dokumentation</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={guideMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-bold uppercase px-3" onClick={() => setGuideMode('list')}><List className="w-3.5 h-3.5 mr-1.5" /> Liste</Button>
            <Button variant={guideMode === 'structure' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[9px] font-bold uppercase px-3" onClick={() => setGuideMode('structure')}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Landkarte</Button>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4 gap-2 border-primary/20 text-primary hover:bg-primary/5 shadow-sm" onClick={() => router.push(`/processhub/${id}`)}><Edit3 className="w-3.5 h-3.5" /> Designer öffnen</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside className="w-80 border-r bg-white flex flex-col shrink-0 hidden lg:flex shadow-sm">
          <ScrollArea className="flex-1 p-6 space-y-8">
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2"><FileCheck className="w-3.5 h-3.5" /> DSGVO Kontext</h3>
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2 shadow-inner">
                <Label className="text-[8px] font-black uppercase text-slate-400">Verarbeitungszweck (VVT)</Label>
                <p className="text-[11px] font-bold text-slate-900 leading-relaxed">{vvts?.find(v => v.id === currentProcess?.vvtId)?.name || 'Kein VVT verknüpft'}</p>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2"><UserCircle className="w-3.5 h-3.5" /> Verantwortung</h3>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 shadow-inner">
                <p className="text-[8px] font-black uppercase text-slate-400">Strategischer Eigner (Rolle)</p>
                <p className="text-[11px] font-bold text-slate-900 leading-relaxed">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
              </div>
            </section>
          </ScrollArea>
        </aside>

        <main 
          ref={containerRef}
          className={cn(
            "flex-1 relative overflow-hidden",
            guideMode === 'structure' ? "bg-slate-200 cursor-grab active:cursor-grabbing" : "bg-slate-50"
          )} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={() => { if (!isDragging) setActiveNodeId(null); }}
        >
          {guideMode === 'list' ? (
            <ScrollArea className="h-full p-10">
              <div className="max-w-5xl mx-auto space-y-8 pb-40">
                {gridNodes.map(node => (
                  <ProcessStepCard key={node.id} node={node} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} resources={resources} allFeatures={allFeatures} getFullRoleName={getFullRoleName} expandedByDefault />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div 
              className="absolute inset-0 origin-top-left"
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, width: '5000px', height: '5000px', zIndex: 10 }}
            >
              <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                  </marker>
                </defs>
                {connectionPaths.map((p, i) => (
                  <path key={i} d={p.path} fill="none" stroke="#94a3b8" strokeWidth="2.5" markerEnd="url(#arrowhead)" className="transition-all duration-300" />
                ))}
              </svg>
              {gridNodes.map(node => (
                <div key={node.id} className="absolute transition-all duration-300" style={{ left: node.x + OFFSET_X, top: node.y + OFFSET_Y }}>
                  <ProcessStepCard node={node} isMapMode activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} resources={resources} allFeatures={allFeatures} getFullRoleName={getFullRoleName} />
                </div>
              ))}
            </div>
          )}

          {guideMode === 'structure' && (
            <div className="absolute bottom-8 right-8 z-50 bg-white/90 backdrop-blur-md border rounded-2xl p-1.5 shadow-lg flex flex-col gap-1.5">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(2, s + 0.1)); }}><Plus className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.2, s - 0.1)); }}><Minus className="w-5 h-5" /></Button>
              <Separator />
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); resetViewport(); }}><Maximize2 className="w-5 h-5" /></Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProcessStepCard({ node, isMapMode = false, activeNodeId, setActiveNodeId, resources, allFeatures, getFullRoleName, expandedByDefault = false }: any) {
  const isActive = activeNodeId === node.id;
  const isExpanded = expandedByDefault || (isMapMode && isActive) || (!isMapMode && isActive);
  
  const roleName = getFullRoleName(node.roleId);
  const nodeResources = resources?.filter((r:any) => node.resourceIds?.includes(r.id));
  const nodeFeatures = allFeatures?.filter((f:any) => node.featureIds?.includes(f.id));

  return (
    <Card 
      className={cn(
        "rounded-2xl border transition-all duration-300 bg-white cursor-pointer relative overflow-hidden",
        isActive ? "ring-4 ring-primary border-primary shadow-2xl z-[100]" : "border-slate-100 shadow-sm hover:border-primary/20",
        isMapMode && (isActive ? "w-[600px] -translate-x-[172px]" : "w-64")
      )}
      onClick={(e) => {
        e.stopPropagation();
        setActiveNodeId(isActive ? null : node.id);
      }}
    >
      <CardHeader className={cn("p-4 border-b flex flex-row items-center justify-between gap-4 bg-white", isExpanded && "bg-slate-50/50")}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
            node.type === 'start' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
            node.type === 'end' ? "bg-red-50 text-red-600 border-red-100" :
            node.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-primary/5 text-primary border-primary/10"
          )}>
            {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : 
             node.type === 'end' ? <StopCircle className="w-6 h-6" /> :
             node.type === 'decision' ? <HelpCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <h4 className={cn("font-black uppercase tracking-tight text-slate-900 truncate", isMapMode && !isActive ? "text-[10px]" : "text-sm")}>{node.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <Briefcase className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{roleName}</span>
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="flex gap-1.5 shrink-0">
            {nodeResources?.slice(0, 2).map((res:any) => (
              <Badge key={res.id} className="bg-indigo-50 text-indigo-700 text-[8px] font-black border-none h-5 px-1.5 rounded-md shadow-none">{res.name}</Badge>
            ))}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="md:col-span-7 p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400">Tätigkeitsbeschreibung</Label>
                <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description || 'Keine detaillierte Beschreibung vorhanden.'}"</p>
              </div>
              {node.checklist && node.checklist.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Operative Checkliste</Label>
                  <div className="space-y-2">
                    {node.checklist.map((item:any, idx:number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl group/check">
                        <Checkbox id={`${node.id}-check-${idx}`} onClick={(e:any) => e.stopPropagation()} className="data-[state=checked]:bg-emerald-600" />
                        <span className="text-xs font-bold text-slate-700 group-data-[state=checked]/check:line-through opacity-80">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="md:col-span-5 p-6 bg-slate-50/30 space-y-6">
              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-2"><Zap className="w-3 h-3" /> Prozesstipps</Label>
                {node.tips && <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-[10px] text-blue-700 italic font-medium leading-relaxed">Tipp: {node.tips}</div>}
                {node.errors && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] text-red-700 italic font-medium leading-relaxed">Achtung: {node.errors}</div>}
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[9px] font-black uppercase text-slate-400">Verknüpfte Ressourcen</Label>
                <div className="flex flex-wrap gap-1.5">
                  {nodeResources?.map((res:any) => <Badge key={res.id} variant="outline" className="bg-white text-indigo-700 text-[8px] font-black h-5 border-indigo-100">{res.name}</Badge>)}
                  {nodeFeatures?.map((f:any) => <Badge key={f.id} variant="outline" className="bg-white text-sky-700 text-[8px] font-black h-5 border-sky-100">{f.name}</Badge>)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
