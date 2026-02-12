
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
  Risk, 
  ProcessingActivity, 
  DataCategory,
  JobTitle
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [guideMode, setGuideMode] = useState<'list' | 'structure'>('list');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [connectionPaths, setConnectionPaths] = useState<{ path: string, sourceId: string, targetId: string }[]>([]);

  // Map States
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

  // --- Grid Layout Logic ---
  // Memoized nodes with calculated grid positions
  const gridNodes = useMemo(() => {
    if (!activeVersion) return [];
    const nodes = activeVersion.model_json.nodes || [];
    const edges = activeVersion.model_json.edges || [];
    const levels: Record<string, number> = {};
    const cols: Record<string, number> = {};
    const processed = new Set<string>();
    
    const startNode = nodes.find(n => n.type === 'start') || nodes[0];
    if (!startNode) return [];

    const queue = [{ id: startNode.id, level: 0, col: 0 }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (processed.has(current.id)) continue;
      processed.add(current.id);
      levels[current.id] = current.level;
      cols[current.id] = current.col;
      
      const outgoingEdges = edges.filter(e => e.source === current.id);
      outgoingEdges.forEach((e, i) => {
        const siblings = outgoingEdges.length;
        queue.push({ id: e.target, level: current.level + 1, col: current.col + i - (siblings - 1) / 2 });
      });
    }

    return nodes.map(n => ({
      ...n,
      x: (cols[n.id] || 0) * 320,
      y: (levels[n.id] || 0) * 220
    }));
  }, [activeVersion]);

  const resetViewport = useCallback(() => {
    if (gridNodes.length === 0 || !containerRef.current) return;
    
    let targetNode = gridNodes.find(n => n.id === activeNodeId) || gridNodes.find(n => n.type === 'start') || gridNodes[0];
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const OFFSET_X = 2500;
    const OFFSET_Y = 2500;

    setPosition({
      x: -(targetNode.x + OFFSET_X) * scale + containerWidth / 2 - (140 * scale),
      y: -(targetNode.y + OFFSET_Y) * scale + containerHeight / 2 - (40 * scale)
    });
  }, [gridNodes, scale, activeNodeId]);

  const updateFlowLines = useCallback(() => {
    if (!activeVersion) {
      setConnectionPaths([]);
      return;
    }

    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, sourceId: string, targetId: string }[] = [];

    edges.forEach(edge => {
      const sNode = gridNodes.find(n => n.id === edge.source);
      const tNode = gridNodes.find(n => n.id === edge.target);
      
      if (sNode && tNode) {
        const OFFSET_X = 2500;
        const OFFSET_Y = 2500;
        
        let sPortX = sNode.x + OFFSET_X + 128; // Center
        let sPortY = sNode.y + OFFSET_Y + 80;  // Bottom
        let tPortX = tNode.x + OFFSET_X + 128; // Center
        let tPortY = tNode.y + OFFSET_Y;       // Top

        // Side routing for large distances (BPMN style)
        if (Math.abs(tNode.x - sNode.x) > 100) {
          if (tNode.x > sNode.x) {
            sPortX = sNode.x + OFFSET_X + 256;
            sPortY = sNode.y + OFFSET_Y + 40;
            tPortX = tNode.x + OFFSET_X;
            tPortY = tNode.y + OFFSET_Y + 40;
          } else {
            sPortX = sNode.x + OFFSET_X;
            sPortY = sNode.y + OFFSET_Y + 40;
            tPortX = tNode.x + OFFSET_X + 256;
            tPortY = tNode.y + OFFSET_Y + 40;
          }
        }
        
        const path = `M ${sPortX} ${sPortY} C ${sPortX} ${sPortY + 40}, ${tPortX} ${tPortY - 40}, ${tPortX} ${tPortY}`;
        newPaths.push({ path, sourceId: edge.source, targetId: edge.target });
      }
    });

    setConnectionPaths(newPaths);
  }, [activeVersion, gridNodes]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && guideMode === 'structure') {
      const timer = setTimeout(resetViewport, 100);
      return () => clearTimeout(timer);
    }
  }, [guideMode, mounted, resetViewport]);

  useEffect(() => {
    updateFlowLines();
  }, [activeVersion, gridNodes, updateFlowLines]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || guideMode !== 'structure') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!isDragging || guideMode !== 'structure') return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (guideMode !== 'structure') return;
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.3, scale + delta), 2);
    setScale(newScale);
  };

  const getFullRoleName = (roleId?: string) => {
    if (!roleId) return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  const GuideCard = ({ node, isMapMode = false }: { node: ProcessNode, isMapMode?: boolean }) => {
    const isActive = activeNodeId === node.id;
    const isExpanded = !isMapMode || isActive;
    
    const roleName = getFullRoleName(node.roleId);
    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
    const nodeFeatures = allFeatures?.filter(f => node.featureIds?.includes(f.id));

    return (
      <Card 
        className={cn(
          "rounded-2xl border transition-all duration-300 bg-white cursor-pointer relative",
          isActive ? "ring-4 ring-primary border-primary shadow-lg" : "border-slate-100 shadow-sm hover:border-primary/20",
          isMapMode && (isActive ? "w-[600px] z-50 scale-110" : "w-64 z-10")
        )}
        onClick={(e) => {
          e.stopPropagation(); // CRITICAL: Stop propagation to prevent background click from unselecting immediately
          setActiveNodeId(isActive ? null : node.id);
        }}
      >
        <CardHeader className={cn("p-4 border-b flex flex-row items-center justify-between gap-4 rounded-t-2xl bg-white", isExpanded && "bg-slate-50/50")}>
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
              {nodeResources?.slice(0, 3).map(res => (
                <Badge key={res.id} className="bg-indigo-50 text-indigo-700 text-[8px] font-black border-none h-5 px-1.5 rounded-md shadow-none">{res.name}</Badge>
              ))}
            </div>
          )}
        </CardHeader>

        {isExpanded && (
          <CardContent className="p-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="md:col-span-7 p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Beschreibung</Label>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description || 'Keine Beschreibung'}"</p>
                </div>
                {node.checklist && node.checklist.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-emerald-600">Checkliste</Label>
                    <div className="space-y-2">
                      {node.checklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl">
                          <Checkbox id={`${node.id}-check-${idx}`} onClick={(e) => e.stopPropagation()} />
                          <span className="text-xs font-bold text-slate-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-5 p-6 bg-slate-50/30 space-y-6">
                <div className="space-y-4">
                  <Label className="text-[9px] font-black uppercase text-blue-600">Expertise</Label>
                  {node.tips && <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-700 italic">Tipp: {node.tips}</div>}
                  {node.errors && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-700 italic">Fehlerquelle: {node.errors}</div>}
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Systeme & Daten</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {nodeResources?.map(res => <Badge key={res.id} variant="outline" className="bg-white text-indigo-700 text-[8px] font-black h-5">{res.name}</Badge>)}
                    {nodeFeatures?.map(f => <Badge key={f.id} variant="outline" className="bg-white text-sky-700 text-[8px] font-black h-5">{f.name}</Badge>)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      {/* Debug HUD: Top Left Fixed */}
      <div className="fixed top-20 left-80 z-[100] bg-slate-900/90 text-white p-3 rounded-xl border border-white/10 shadow-2xl pointer-events-none font-mono text-[9px] space-y-1">
        <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
          <Terminal className="w-3 h-3 text-primary" />
          <span className="font-black uppercase tracking-widest">Map Monitor</span>
        </div>
        <div className="flex justify-between gap-4"><span>Active ID:</span> <span className="text-primary">{activeNodeId || 'none'}</span></div>
        <div className="flex justify-between gap-4"><span>Scale:</span> <span>{scale.toFixed(2)}</span></div>
        <div className="flex justify-between gap-4"><span>Position:</span> <span>X:{Math.floor(position.x)} Y:{Math.floor(position.y)}</span></div>
        <div className="flex justify-between gap-4"><span>Drag:</span> <span className={cn(isDragging ? "text-emerald-400" : "text-red-400")}>{String(isDragging)}</span></div>
      </div>

      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-6 h-6" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold text-slate-900">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">V{activeVersion?.version}.0 • Leitfaden</p>
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
        <aside className="w-80 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1 p-6 space-y-8">
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-b pb-2 flex items-center gap-2"><FileCheck className="w-3.5 h-3.5" /> DSGVO Kontext</h3>
              <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <Label className="text-[8px] font-black uppercase text-slate-400">Zweck (VVT)</Label>
                <p className="text-[11px] font-bold text-slate-900">{vvts?.find(v => v.id === currentProcess?.vvtId)?.name || 'Nicht verknüpft'}</p>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2"><UserCircle className="w-3.5 h-3.5" /> Verantwortung</h3>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <p className="text-[8px] font-black uppercase text-slate-400">Owner Rolle</p>
                <p className="text-[11px] font-bold text-slate-900">{getFullRoleName(currentProcess?.ownerRoleId)}</p>
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
          onClick={() => {
            setActiveNodeId(null); // Unselect when clicking background
          }}
        >
          {guideMode === 'list' ? (
            <ScrollArea className="h-full p-10">
              <div className="max-w-5xl mx-auto space-y-8 pb-40">
                {gridNodes.map(node => (
                  <GuideCard key={node.id} node={node} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div 
              className="absolute inset-0 transition-transform duration-75 origin-top-left"
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, width: '5000px', height: '5000px' }}
            >
              <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                  </marker>
                </defs>
                {connectionPaths.map((p, i) => (
                  <path key={i} d={p.path} fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                ))}
              </svg>
              {gridNodes.map(node => (
                <div key={node.id} className="absolute" style={{ left: node.x + 2500, top: node.y + 2500 }}>
                  <GuideCard node={node} isMapMode />
                </div>
              ))}
            </div>
          )}

          {guideMode === 'structure' && (
            <div className="absolute bottom-8 right-8 z-50 bg-white/90 backdrop-blur-md border rounded-2xl p-1.5 shadow-lg flex flex-col gap-1.5">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(2, s + 0.1)); }}><Plus className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.3, s - 0.1)); }}><Minus className="w-5 h-5" /></Button>
              <Separator />
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); resetViewport(); }}><Maximize2 className="w-5 h-5" /></Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
