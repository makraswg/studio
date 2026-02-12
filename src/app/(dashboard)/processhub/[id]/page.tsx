
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Save as SaveIcon, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  Trash2,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  ClipboardList,
  Building2,
  Settings2,
  Clock,
  Info,
  Briefcase,
  X,
  Layers,
  ChevronRight,
  Maximize2,
  Plus,
  Minus,
  PlayCircle,
  StopCircle,
  HelpCircle,
  Search,
  CheckCircle2,
  Save,
  ArrowLeftCircle,
  ArrowRightCircle,
  Edit3,
  Check,
  Database,
  Link as LinkIcon,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Scale,
  Network,
  Target,
  Tag,
  ListFilter,
  FileCode,
  MessageSquare,
  UserCircle,
  FileUp,
  ImageIcon,
  FileText,
  Focus,
  Paperclip
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction, updateProcessMetadataAction, commitProcessVersionAction } from '@/app/actions/process-actions';
import { saveMediaAction, deleteMediaAction } from '@/app/actions/media-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessNode, ProcessOperation, ProcessVersion, Department, Resource, Feature, UiConfig, ProcessType, MediaFile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const OFFSET_X = 2500;
const OFFSET_Y = 2500;

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth] = useState(380);

  // Map & Navigation States
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);
  const hasAutoCentered = useRef(false);
  
  // Ref for native listener state
  const stateRef = useRef({ position, scale, isDiagramLocked });
  useEffect(() => {
    stateRef.current = { position, scale, isDiagramLocked };
  }, [position, scale, isDiagramLocked]);

  // UI States
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [connectionPaths, setConnectionPaths] = useState<any[]>([]);

  // Node Editor Form State
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<ProcessNode['type']>('step');
  const [editDesc, setEditDesc] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editResIds, setEditResIds] = useState<string[]>([]);
  const [editFeatIds, setEditFeatIds] = useState<string[]>([]);
  const [editChecklist, setEditChecklist] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [editTips, setEditTips] = useState('');
  const [editErrors, setEditErrors] = useState('');
  const [editTargetProcessId, setEditTargetProcessId] = useState('');
  const [editPredecessorIds, setEditPredecessorIds] = useState<string[]>([]);
  const [editSuccessors, setEditSuccessors] = useState<{ targetId: string, label: string }[]>([]);

  // Media States
  const [isUploading, setIsUploading] = useState(false);

  // Node Editor Search States
  const [resSearch, setResSearch] = useState('');
  const [featSearch, setFeatSearch] = useState('');
  const [predSearch, setPredSearch] = useState('');
  const [succSearch, setSuccSearch] = useState('');
  const [subProcSearch, setSubProcSearch] = useState('');

  // Master Data Form State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaTypeId, setMetaTypeId] = useState('none');
  const [metaInputs, setMetaInputs] = useState('');
  const [metaOutputs, setMetaOutputs] = useState('');
  const [metaKpis, setMetaKpis] = useState('');
  const [metaTags, setMetaTags] = useState('');
  const [metaOpenQuestions, setMetaOpenQuestions] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('none');
  const [metaOwnerRoleId, setMetaOwnerRoleId] = useState('none');
  const [metaFramework, setMetaFramework] = useState('none');
  const [metaAutomation, setMetaAutomation] = useState<'manual' | 'partial' | 'full'>('manual');
  const [metaVolume, setMetaDataVolume] = useState<'low' | 'medium' | 'high'>('low');
  const [metaFrequency, setMetaFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'on_demand'>('on_demand');

  const { data: uiConfigs } = usePluggableCollection<UiConfig>('uiConfigs');
  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: processTypes } = usePluggableCollection<ProcessType>('process_types');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const activeVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

  const animationsEnabled = useMemo(() => {
    if (!uiConfigs || uiConfigs.length === 0) return true;
    return uiConfigs[0].enableAdvancedAnimations === true || uiConfigs[0].enableAdvancedAnimations === 1;
  }, [uiConfigs]);

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaTypeId(currentProcess.process_type_id || 'none');
      setMetaInputs(currentProcess.inputs || '');
      setMetaOutputs(currentProcess.outputs || '');
      setMetaKpis(currentProcess.kpis || '');
      setMetaTags(currentProcess.tags || '');
      setMetaOpenQuestions(currentProcess.openQuestions || '');
      setMetaDeptId(currentProcess.responsibleDepartmentId || 'none');
      setMetaOwnerRoleId(currentProcess.ownerRoleId || 'none');
      setMetaFramework(currentProcess.regulatoryFramework || 'none');
      setMetaAutomation(currentProcess.automationLevel || 'manual');
      setMetaDataVolume(currentProcess.dataVolume || 'low');
      setMetaFrequency(currentProcess.processingFrequency || 'on_demand');
    }
  }, [currentProcess]);

  useEffect(() => { setMounted(true); }, []);

  // --- Map Calculation Logic ---
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

      if (selectedNodeId === n.id) {
        // No movement
      } else if (selectedNodeId) {
        const activeLv = levels[selectedNodeId];
        const activeLane = lanes[selectedNodeId];
        if (lv === activeLv) {
          if (lane > activeLane) x += (WIDTH_DIFF / 2) + 40;
          if (lane < activeLane) x -= (WIDTH_DIFF / 2) + 40;
        }
        if (lv > activeLv) y += 340; 
      }
      return { ...n, x, y, lv, lane };
    });
  }, [activeVersion, selectedNodeId]);

  const sortedSidebarNodes = useMemo(() => {
    return [...gridNodes].sort((a, b) => {
      if (a.lv !== b.lv) return a.lv - b.lv;
      return a.lane - b.lane;
    });
  }, [gridNodes]);

  const centerOnNode = useCallback((nodeId: string) => {
    const node = gridNodes.find(n => n.id === nodeId);
    if (!node || !containerRef.current) return;
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
  }, [gridNodes]);

  useEffect(() => {
    if (mounted && !hasAutoCentered.current && gridNodes.length > 0) {
      const startNode = gridNodes.find(n => n.type === 'start') || gridNodes[0];
      centerOnNode(startNode.id);
      hasAutoCentered.current = true;
    }
  }, [mounted, gridNodes, centerOnNode]);

  // NATIVE NON-PASSIVE WHEEL LISTENER
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      const { position: pos, scale: s, isDiagramLocked: locked } = stateRef.current;
      if (locked) return;
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
        const sIsExp = sNode.id === selectedNodeId;
        const tIsExp = tNode.id === selectedNodeId;
        const isPathActive = sIsExp || tIsExp;
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
  }, [activeVersion, gridNodes, selectedNodeId]);

  useEffect(() => { updateFlowLines(); }, [gridNodes, selectedNodeId, updateFlowLines]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(nodeId);
      setTimeout(() => centerOnNode(nodeId), 50);
    }
  }, [selectedNodeId, centerOnNode]);

  // --- Node Editor Logic ---
  const openNodeEditor = (node: any) => {
    setEditingNode(node);
    setEditTitle(node.title || '');
    setEditType(node.type || 'step');
    setEditDesc(node.description || '');
    setEditRoleId(node.roleId || '');
    setEditResIds(node.resourceIds || []);
    setEditFeatIds(node.featureIds || []);
    setEditChecklist(node.checklist || []);
    setEditTips(node.tips || '');
    setEditErrors(node.errors || '');
    setEditTargetProcessId(node.targetProcessId || '');
    
    setResSearch('');
    setFeatSearch('');
    setPredSearch('');
    setSuccSearch('');
    setSubProcSearch('');

    const preds = activeVersion?.model_json?.edges?.filter((e: any) => e.target === node.id).map((e: any) => e.source) || [];
    const succs = activeVersion?.model_json?.edges?.filter((e: any) => e.source === node.id).map((e: any) => ({
      targetId: e.target,
      label: e.label || ''
    })) || [];
    
    setEditPredecessorIds(preds);
    setEditSuccessors(succs);
    setIsNodeEditorOpen(true);
  };

  const handleSaveNode = async () => {
    if (!editingNode) return;
    const ops: ProcessOperation[] = [{
      type: 'UPDATE_NODE',
      payload: {
        nodeId: editingNode.id,
        patch: {
          title: editTitle,
          type: editType,
          description: editDesc,
          roleId: editRoleId === 'none' ? '' : editRoleId,
          resourceIds: editResIds,
          featureIds: editFeatIds,
          checklist: editChecklist,
          tips: editTips,
          errors: editErrors,
          targetProcessId: editTargetProcessId === 'none' ? '' : editTargetProcessId,
          predecessorIds: editPredecessorIds
        }
      }
    }];

    const oldEdges = activeVersion?.model_json?.edges || [];
    const currentPredEdges = oldEdges.filter((e: any) => e.target === editingNode.id);
    const currentSuccEdges = oldEdges.filter((e: any) => e.source === editingNode.id);

    currentPredEdges.forEach((e: any) => {
      if (!editPredecessorIds.includes(e.source)) ops.push({ type: 'REMOVE_EDGE', payload: { edgeId: e.id } });
    });
    editPredecessorIds.forEach(sourceId => {
      if (!currentPredEdges.some((e: any) => e.source === sourceId)) {
        ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}-${sourceId}`, source: sourceId, target: editingNode.id } } });
      }
    });

    const newSuccIds = editSuccessors.map(s => s.targetId);
    currentSuccEdges.forEach((e: any) => {
      if (!newSuccIds.includes(e.target)) {
        ops.push({ type: 'REMOVE_EDGE', payload: { edgeId: e.id } });
      } else {
        const matchingEdit = editSuccessors.find(s => s.targetId === e.target);
        if (matchingEdit && matchingEdit.label !== (e.label || '')) {
          ops.push({ type: 'REMOVE_EDGE', payload: { edgeId: e.id } });
          ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}-${e.target}`, source: editingNode.id, target: e.target, label: matchingEdit.label } } });
        }
      }
    });
    editSuccessors.forEach(succ => {
      if (!currentSuccEdges.some((e: any) => e.target === succ.targetId)) {
        ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}-${succ.targetId}`, source: editingNode.id, target: succ.targetId, label: succ.label } } });
      }
    });

    const success = await handleApplyOps(ops);
    if (success) setIsNodeEditorOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingNode) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const mediaId = `med-${Math.random().toString(36).substring(2, 9)}`;
      const mediaData: MediaFile = {
        id: mediaId,
        tenantId: currentProcess?.tenantId || activeTenantId || 'global',
        module: 'ProcessHub',
        entityId: currentProcess?.id || '',
        subEntityId: editingNode.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: base64,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'system'
      };
      try {
        const res = await saveMediaAction(mediaData, dataSource);
        if (res.success) { toast({ title: "Datei hochgeladen" }); refreshMedia(); }
      } finally { setIsUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || stateRef.current.isDiagramLocked) return;
    setIsProgrammaticMove(false);
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setIsDragging(false); };

  const handleApplyOps = async (ops: any[]) => {
    if (!activeVersion || !user || !ops.length) return false;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(activeVersion.process_id, activeVersion.version, ops, activeVersion.revision, user.id, dataSource);
      if (res.success) { refreshVersion(); refreshProc(); return true; }
      return false;
    } finally { setIsApplying(false); }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Schritt permanent löschen?")) return;
    const ops: ProcessOperation[] = [{ type: 'REMOVE_NODE', payload: { nodeId } }];
    await handleApplyOps(ops);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'subprocess') => {
    if (!activeVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', subprocess: 'Referenz' };
    const nodes = activeVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : (nodes.length > 0 ? nodes[nodes.length - 1] : null);
    
    const newNode: ProcessNode = {
      id: newId, type, title: titles[type], checklist: [],
      roleId: predecessor?.roleId || '',
      resourceIds: predecessor?.resourceIds || [],
      featureIds: predecessor?.featureIds || [],
      predecessorIds: predecessor ? [predecessor.id] : []
    };

    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: newNode } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    
    handleApplyOps(ops).then(s => { if(s) handleNodeClick(newId); });
  };

  const handleSaveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(id as string, {
        title: metaTitle, description: metaDesc,
        process_type_id: metaTypeId === 'none' ? undefined : metaTypeId,
        inputs: metaInputs, outputs: metaOutputs, kpis: metaKpis, tags: metaTags,
        openQuestions: metaOpenQuestions, responsibleDepartmentId: metaDeptId === 'none' ? undefined : metaDeptId,
        ownerRoleId: metaOwnerRoleId === 'none' ? undefined : metaOwnerRoleId,
        regulatoryFramework: metaFramework === 'none' ? undefined : metaFramework,
        automationLevel: metaAutomation, dataVolume: metaVolume, processingFrequency: metaFrequency
      }, dataSource);
      if (res.success) { toast({ title: "Stammdaten gespeichert" }); refreshProc(); }
    } finally { setIsSavingMeta(false); }
  };

  const handleCommitVersion = async () => {
    if (!activeVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentProcess.id, activeVersion.version, user.email || user.id, dataSource);
      if (res.success) { toast({ title: "Revision gespeichert" }); refreshVersion(); }
    } finally { setIsCommitting(false); }
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
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-50 relative">
      <header className="h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md"><ChevronLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Designer</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • Rev. {activeVersion?.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className={cn("h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 transition-all", isDiagramLocked ? "bg-slate-100 text-slate-400" : "hover:bg-amber-50 text-amber-600")} onClick={() => setIsDiagramLocked(!isDiagramLocked)}>
            {isDiagramLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />} {isDiagramLocked ? 'Karte fixiert' : 'Navigation aktiv'}
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} Revision sichern
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside className="border-r flex flex-col bg-white shrink-0 h-full shadow-sm hidden md:flex" style={{ width: `${leftWidth}px` }}>
          <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full text-[10px] font-bold text-slate-500 data-[state=active]:text-primary uppercase">Modellierung</TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full text-[10px] font-bold text-slate-500 data-[state=active]:text-blue-600 uppercase">Stammdaten</TabsTrigger>
            </TabsList>
            
            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col p-0">
              <div className="px-6 py-4 border-b bg-white space-y-4 shrink-0">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Element hinzufügen</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-3.5 h-3.5 text-primary" /> Schritt</Button>
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2" onClick={() => handleQuickAdd('decision')}><GitBranch className="w-3.5 h-3.5 text-amber-600" /> Weiche</Button>
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2" onClick={() => handleQuickAdd('subprocess')}><RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Referenz</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {sortedSidebarNodes.map((node: any) => (
                    <div key={node.id} className={cn("group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer bg-white shadow-sm", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => handleNodeClick(node.id)}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'start' ? "bg-emerald-50 text-emerald-600" : node.type === 'subprocess' ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500")}>
                        {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : node.type === 'start' ? <PlayCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                        <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">{node.type}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={(e) => { e.stopPropagation(); openNodeEditor(node); }}><Edit3 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col p-0">
              <ScrollArea className="flex-1 bg-white p-6 space-y-8">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 border-b pb-2 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Stammdaten</h3>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Prozesstitel</Label><Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="h-10 text-xs font-bold rounded-xl" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstyp</Label>
                    <Select value={metaTypeId} onValueChange={setMetaTypeId}><SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{processTypes?.filter(t => t.enabled).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Beschreibung</Label><Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="min-h-[80px] text-xs rounded-xl" /></div>
                </section>
                <div className="pt-4 border-t"><Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full h-10 rounded-xl bg-blue-600 text-white font-bold text-[10px] uppercase gap-2">{isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Stammdaten sichern</Button></div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        <main 
          ref={containerRef}
          className={cn("flex-1 relative overflow-hidden bg-slate-200", !isDiagramLocked ? "cursor-grab active:cursor-grabbing" : "cursor-default")} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div 
            className="absolute inset-0 origin-top-left"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
              width: '5000px', height: '5000px', zIndex: 10,
              transition: isProgrammaticMove ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          >
            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
              <defs><marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><polygon points="0 0, 5 2.5, 0 5" fill="currentColor" /></marker></defs>
              {connectionPaths.map((p, i) => (
                <g key={i}>
                  <path d={p.path} fill="none" stroke={p.isActive ? "hsl(var(--primary))" : "#94a3b8"} strokeWidth={p.isActive ? "3" : "1.5"} markerEnd="url(#arrowhead)" className={cn("transition-all", animationsEnabled && p.isActive && "animate-flow-dash")} />
                  {p.label && (<text className="text-[10px] font-bold fill-slate-500" style={{ filter: 'drop-shadow(0 1px 1px white)' }}><textPath href={`#path-${i}`} startOffset="50%" dy="-5" textAnchor="middle">{p.label}</textPath></text>)}
                  <path id={`path-${i}`} d={p.path} fill="none" stroke="transparent" pointerEvents="none" />
                </g>
              ))}
            </svg>
            {gridNodes.map(node => (
              <div key={node.id} className="absolute transition-all duration-500" style={{ left: node.x + OFFSET_X, top: node.y + OFFSET_Y }}>
                <ProcessStepCard node={node} activeNodeId={selectedNodeId} setActiveNodeId={handleNodeClick} resources={resources} allFeatures={allFeatures} getFullRoleName={getFullRoleName} mediaCount={mediaFiles?.filter(m => m.subEntityId === node.id).length || 0} />
              </div>
            ))}
          </div>

          <div className="absolute bottom-8 right-8 z-50 bg-white/95 backdrop-blur-md border rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1.5">
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.min(2, s + 0.1))}><Plus className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setScale(s => Math.max(0.2, s - 0.1))}><Minus className="w-5 h-5" /></Button>
            <Separator className="my-1" />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={() => { if(gridNodes.length > 0) centerOnNode(selectedNodeId || gridNodes[0].id); }}><Focus className="w-5 h-5" /></Button>
          </div>
        </main>
      </div>

      <Dialog open={isNodeEditorOpen} onOpenChange={setIsNodeEditorOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg", editType === 'decision' ? "bg-amber-500 text-white" : "bg-primary text-white")}>
                {editType === 'decision' ? <GitBranch className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">Schritt konfigurieren</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Definition der GRC-Abhängigkeiten</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-white border-b h-12 px-6 justify-start gap-8 shrink-0">
              <TabsTrigger value="base" className="text-[10px] font-bold uppercase tracking-widest h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">Basis</TabsTrigger>
              <TabsTrigger value="grc" className="text-[10px] font-bold uppercase tracking-widest h-full rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600">GRC</TabsTrigger>
              <TabsTrigger value="rel" className="text-[10px] font-bold uppercase tracking-widest h-full rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:text-amber-600">Handover</TabsTrigger>
              <TabsTrigger value="checklist" className="text-[10px] font-bold uppercase tracking-widest h-full rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:text-orange-600">Checkliste & Medien</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-12 text-sm font-bold rounded-xl" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Typ</Label><Select value={editType} onValueChange={(v:any) => setEditType(v)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="start">Startpunkt</SelectItem><SelectItem value="step">Arbeitsschritt</SelectItem><SelectItem value="decision">Entscheidung (Weiche)</SelectItem><SelectItem value="subprocess">Referenz</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Beschreibung</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="min-h-[120px] rounded-xl text-xs" /></div>
                  </div>
                </TabsContent>

                <TabsContent value="grc" className="mt-0 space-y-8 animate-in fade-in">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Ausführende Rolle</Label>
                      <Select value={editRoleId || 'none'} onValueChange={setEditRoleId}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger><SelectContent>{jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(j => <SelectItem key={j.id} value={j.id}>{getFullRoleName(j.id)}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> IT-Systeme</Label>
                        <Input placeholder="Suchen..." value={resSearch} onChange={e => setResSearch(e.target.value)} className="h-8 text-[10px] rounded-lg" />
                        <div className="p-4 rounded-xl border bg-slate-50/50"><ScrollArea className="h-48">{resources?.filter(res => res.name.toLowerCase().includes(resSearch.toLowerCase())).map(res => (<div key={res.id} className="flex items-center gap-3 p-2"><Checkbox checked={editResIds.includes(res.id)} onCheckedChange={v => setEditResIds(v ? [...editResIds, res.id] : editResIds.filter(id => id !== res.id))} /><span className="text-[11px] font-bold">{res.name}</span></div>))}</ScrollArea></div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Datenobjekte</Label>
                        <Input placeholder="Suchen..." value={featSearch} onChange={e => setFeatSearch(e.target.value)} className="h-8 text-[10px] rounded-lg" />
                        <div className="p-4 rounded-xl border bg-slate-50/50"><ScrollArea className="h-48">{allFeatures?.filter(f => f.name.toLowerCase().includes(featSearch.toLowerCase())).map(f => (<div key={f.id} className="flex items-center gap-3 p-2"><Checkbox checked={editFeatIds.includes(f.id)} onCheckedChange={v => setEditFeatIds(v ? [...editFeatIds, f.id] : editFeatIds.filter(id => id !== f.id))} /><span className="text-[11px] font-bold">{f.name}</span></div>))}</ScrollArea></div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rel" className="mt-0 space-y-10 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4" /> Eingang (Input)</Label>
                      <div className="p-4 rounded-xl border bg-white shadow-inner"><ScrollArea className="h-64">{activeVersion?.model_json?.nodes?.filter((n: any) => n.id !== editingNode?.id).map((n: any) => (<div key={n.id} className="flex items-center gap-3 p-2 cursor-pointer" onClick={() => setEditPredecessorIds(prev => prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id])}><Checkbox checked={editPredecessorIds.includes(n.id)} /><span className="text-[11px] font-bold">{n.title}</span></div>))}</ScrollArea></div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4" /> Ausgang (Output)</Label>
                      <div className="p-4 rounded-xl border bg-white shadow-inner">
                        <ScrollArea className="h-64">
                          {activeVersion?.model_json?.nodes?.filter((n: any) => n.id !== editingNode?.id).map((n: any) => {
                            const link = editSuccessors.find(s => s.targetId === n.id);
                            return (
                              <div key={n.id} className="p-2 space-y-2 border-b last:border-0">
                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setEditSuccessors(prev => link ? prev.filter(s => s.targetId !== n.id) : [...prev, { targetId: n.id, label: '' }])}><Checkbox checked={!!link} /><span className="text-[11px] font-bold">{n.title}</span></div>
                                {link && <Input placeholder="Bedingung (z.B. Ja/Nein)" value={link.label} onChange={e => setEditSuccessors(prev => prev.map(s => s.targetId === n.id ? { ...s, label: e.target.value } : s))} className="h-7 text-[10px] ml-7 w-[calc(100%-28px)]" />}
                              </div>
                            );
                          })}
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="checklist" className="mt-0 space-y-8 animate-in fade-in pb-20">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Checkliste</Label>
                    <div className="flex gap-2"><Input placeholder="Prüfpunkt..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} /><Button onClick={addCheckItem} className="bg-emerald-600"><Plus className="w-4 h-4" /></Button></div>
                    <div className="space-y-2">{editChecklist.map((item, idx) => (<div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border rounded-lg"><span className="text-xs">{item}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeCheckItem(idx)}><X className="w-3.5 h-3.5" /></Button></div>))}</div>
                  </div>
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Begleitmaterialien</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 border-2 border-dashed rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center gap-3 hover:bg-white cursor-pointer transition-all" onClick={() => fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileUp className="w-8 h-8 text-slate-300" />}
                        <p className="text-xs font-bold text-slate-700">Klicken zum Hochladen</p>
                      </div>
                      <div className="space-y-2">
                        {mediaFiles?.filter(m => m.subEntityId === editingNode?.id).map(f => (
                          <div key={f.id} className="p-2 bg-white border rounded-lg flex items-center justify-between shadow-sm">
                            <span className="text-[10px] font-bold truncate max-w-[150px]">{f.fileName}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if(confirm("Datei löschen?")) deleteMediaAction(f.id, f.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia()); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex gap-2">
              <Button variant="ghost" onClick={() => setIsNodeEditorOpen(false)} className="rounded-xl font-bold text-[10px] px-8">Abbrechen</Button>
              <Button onClick={handleSaveNode} disabled={isApplying} className="rounded-xl bg-primary text-white font-bold text-[10px] px-12 shadow-lg gap-2">{isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Übernehmen</Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProcessStepCard({ node, activeNodeId, setActiveNodeId, resources, allFeatures, getFullRoleName, mediaCount, isMapMode = false }: any) {
  const isActive = activeNodeId === node.id;
  const isExpanded = isMapMode && isActive;
  const roleName = getFullRoleName(node.roleId);
  const nodeResources = resources?.filter((r:any) => node.resourceIds?.includes(r.id));

  return (
    <Card 
      className={cn(
        "rounded-2xl border transition-all duration-500 bg-white cursor-pointer relative overflow-hidden shadow-sm",
        isActive ? "border-primary border-2 shadow-lg z-[100]" : "border-slate-100 hover:border-primary/20",
        isMapMode && (isActive ? "w-[600px] h-[420px]" : "w-64 h-[82px]")
      )}
      style={isMapMode && isActive ? { transform: 'translateX(-172px)' } : {}}
      onClick={(e) => { e.stopPropagation(); setActiveNodeId(node.id); }}
    >
      <CardHeader className={cn("p-4 flex flex-row items-center justify-between gap-4 bg-white transition-colors", isExpanded ? "bg-slate-50/50 border-b" : "border-b-0")}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", node.type === 'start' ? "bg-emerald-50 text-emerald-600" : node.type === 'decision' ? "bg-amber-50 text-amber-600" : node.type === 'subprocess' ? "bg-indigo-600 text-white" : "bg-primary/5 text-primary")}>
            {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : node.type === 'decision' ? <HelpCircle className="w-6 h-6" /> : node.type === 'subprocess' ? <RefreshCw className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <h4 className={cn("font-black uppercase tracking-tight text-slate-900 truncate", isMapMode && !isActive ? "text-[10px]" : "text-sm")}>{node.title}</h4>
            <div className="flex items-center gap-2 mt-0.5"><Briefcase className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{roleName}</span></div>
          </div>
        </div>
        {mediaCount > 0 && !isExpanded && <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-full h-4 px-1.5"><Paperclip className="w-2.5 h-2.5" /></Badge>}
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-6 space-y-6 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label className="text-[9px] font-black uppercase text-slate-400">Beschreibung</Label>
              <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description || '---'}"</p>
            </div>
            <div className="space-y-4">
              <Label className="text-[9px] font-black uppercase text-slate-400">IT-Ressourcen</Label>
              <div className="flex flex-wrap gap-1.5">{nodeResources?.map((res:any) => <Badge key={res.id} variant="outline" className="text-[8px] font-black h-5 border-indigo-100">{res.name}</Badge>)}</div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
