
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
  Image as ImageIcon,
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
import { saveMediaAction } from '@/app/actions/media-actions';
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
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth] = useState(380);

  // Map & Navigation States
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const hasAutoCentered = useRef(false);
  
  // UI States
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [connectionPaths, setConnectionPaths] = useState<{ path: string, sourceId: string, targetId: string, label?: string, isActive: boolean }[]>([]);

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
    const config = uiConfigs[0];
    return config.enableAdvancedAnimations === true || config.enableAdvancedAnimations === 1;
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
        // No movement for selected node itself
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

  // Logical Sorting for Sidebar
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

  const updateFlowLines = useCallback(() => {
    if (!activeVersion || gridNodes.length === 0) { setConnectionPaths([]); return; }
    const edges = activeVersion.model_json.edges || [];
    const newPaths: { path: string, sourceId: string, targetId: string, label?: string, isActive: boolean }[] = [];

    edges.forEach(edge => {
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
        
        newPaths.push({ path, sourceId: edge.source, targetId: edge.target, label: edge.label, isActive: isPathActive });
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

    // Update Predecessors
    currentPredEdges.forEach((e: any) => {
      if (!editPredecessorIds.includes(e.source)) ops.push({ type: 'REMOVE_EDGE', payload: { edgeId: e.id } });
    });
    editPredecessorIds.forEach(sourceId => {
      if (!currentPredEdges.some((e: any) => e.source === sourceId)) {
        ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}-${sourceId}`, source: sourceId, target: editingNode.id } } });
      }
    });

    // Update Successors (including Labels)
    const newSuccIds = editSuccessors.map(s => s.targetId);
    currentSuccEdges.forEach((e: any) => {
      if (!newSuccIds.includes(e.target)) {
        ops.push({ type: 'REMOVE_EDGE', payload: { edgeId: e.id } });
      } else {
        const matchingEdit = editSuccessors.find(s => s.targetId === e.target);
        if (matchingEdit && matchingEdit.label !== (e.label || '')) {
          // Label changed -> replace edge
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
        if (res.success) {
          toast({ title: "Datei hochgeladen" });
          refreshMedia();
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Upload Fehler", description: err.message });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubprocessSelect = (targetPid: string) => {
    setEditTargetProcessId(targetPid);
    if (targetPid === 'none') return;

    const targetProc = processes?.find(p => p.id === targetPid);
    if (targetProc) {
      setEditTitle(`Prozess: ${targetProc.title}`);
      setEditDesc(targetProc.description || '');
      setEditRoleId(targetProc.ownerRoleId || '');
      
      const targetVer = versions?.find(v => v.process_id === targetPid && v.version === targetProc.currentVersion);
      if (targetVer) {
        const aggregatedRes = new Set<string>();
        const aggregatedFeat = new Set<string>();
        targetVer.model_json.nodes.forEach(n => {
          n.resourceIds?.forEach(r => aggregatedRes.add(r));
          n.featureIds?.forEach(f => aggregatedFeat.add(f));
        });
        setEditResIds(Array.from(aggregatedRes));
        setEditFeatIds(Array.from(aggregatedFeat));
      }
    }
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setEditChecklist([...editChecklist, newCheckItem.trim()]);
    setNewCheckItem('');
  };

  const removeCheckItem = (idx: number) => {
    setEditChecklist(editChecklist.filter((_, i) => i !== idx));
  };

  // --- Interaction Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isDiagramLocked) return;
    setIsProgrammaticMove(false);
    setIsDragging(true);
    setMouseDownTime(Date.now());
    setLastMousePos({ x: e.clientX, y: e.clientY });
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setIsDragging(false); };

  const handleWheel = (e: React.WheelEvent) => {
    if (isDiagramLocked) return;
    e.preventDefault();
    setIsProgrammaticMove(false);
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

  const handleApplyOps = async (ops: any[]) => {
    if (!activeVersion || !user || !ops.length) return false;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(activeVersion.process_id, activeVersion.version, ops, activeVersion.revision, user.id, dataSource);
      if (res.success) {
        refreshVersion();
        refreshProc();
        return true;
      }
      return false;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
      return false;
    } finally {
      setIsApplying(false);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Schritt permanent löschen?")) return;
    const ops: ProcessOperation[] = [{ type: 'REMOVE_NODE', payload: { nodeId } }];
    await handleApplyOps(ops);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!activeVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Ende', subprocess: 'Referenz' };
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
    
    handleApplyOps(ops).then(s => { 
      if(s) {
        handleNodeClick(newId);
      }
    });
  };

  const handleSaveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(id as string, {
        title: metaTitle, 
        description: metaDesc,
        process_type_id: metaTypeId === 'none' ? undefined : metaTypeId,
        inputs: metaInputs,
        outputs: metaOutputs,
        kpis: metaKpis,
        tags: metaTags,
        openQuestions: metaOpenQuestions,
        responsibleDepartmentId: metaDeptId === 'none' ? undefined : metaDeptId,
        ownerRoleId: metaOwnerRoleId === 'none' ? undefined : metaOwnerRoleId,
        regulatoryFramework: metaFramework === 'none' ? undefined : metaFramework,
        automationLevel: metaAutomation, 
        dataVolume: metaVolume, 
        processingFrequency: metaFrequency
      }, dataSource);
      if (res.success) { 
        toast({ title: "Stammdaten gespeichert" }); 
        refreshProc(); 
      }
    } finally { 
      setIsSavingMeta(false); 
    }
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
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-50 font-body relative">
      <header className="h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md transition-all"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Designer</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • Rev. {activeVersion?.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 transition-all", isDiagramLocked ? "bg-slate-100 text-slate-400" : "hover:bg-amber-50 text-amber-600")}
            onClick={() => setIsDiagramLocked(!isDiagramLocked)}
          >
            {isDiagramLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isDiagramLocked ? 'Karte fixiert' : 'Navigation aktiv'}
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm transition-all gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} 
            Revision sichern
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside className="border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm hidden md:flex" style={{ width: `${leftWidth}px` }}>
          <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary uppercase">Modellierung</TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-blue-600 uppercase">Stammdaten</TabsTrigger>
            </TabsList>
            
            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-4 border-b bg-white space-y-4 shrink-0">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-blue-700 leading-relaxed font-medium">
                    Markieren Sie einen Schritt, um neue Elemente automatisch danach einzufügen. Relevante GRC-Daten werden dabei vererbt.
                  </p>
                </div>
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Element hinzufügen</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2 border-slate-200" onClick={() => handleQuickAdd('step')}>
                    <PlusCircle className="w-3.5 h-3.5 text-primary" /> Arbeitsschritt
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2 border-slate-200" onClick={() => handleQuickAdd('decision')}>
                    <GitBranch className="w-3.5 h-3.5 text-amber-600" /> Weiche (OR)
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2 border-slate-200" onClick={() => handleQuickAdd('subprocess')}>
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Referenz
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold rounded-xl shadow-sm gap-2 border-slate-200" onClick={() => handleQuickAdd('end')}>
                    <StopCircle className="w-3.5 h-3.5 text-red-600" /> Ende
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {sortedSidebarNodes.map((node: any) => {
                    const hasMedia = mediaFiles?.some(m => m.subEntityId === node.id);
                    const hasChecklist = node.checklist && node.checklist.length > 0;
                    
                    return (
                      <div key={node.id} className={cn("group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer bg-white shadow-sm hover:border-primary/20", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => handleNodeClick(node.id)}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-inner", 
                          node.type === 'decision' ? "bg-amber-50 text-amber-600" : 
                          node.type === 'start' ? "bg-emerald-50 text-emerald-600" :
                          node.type === 'end' ? "bg-red-50 text-red-600" :
                          node.type === 'subprocess' ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"
                        )}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : 
                           node.type === 'start' ? <PlayCircle className="w-4 h-4" /> :
                           node.type === 'subprocess' ? <RefreshCw className="w-4 h-4" /> :
                           node.type === 'end' ? <StopCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                            <div className="flex gap-0.5">
                              {hasMedia && <Paperclip className="w-2.5 h-2.5 text-indigo-400" />}
                              {hasChecklist && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                            </div>
                          </div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{node.type}</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/5" onClick={(e) => { e.stopPropagation(); openNodeEditor(node); }}><Edit3 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-white">
                <div className="p-6 space-y-8 pb-10">
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 border-b pb-2 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" /> Stammdaten & Typisierung
                      </h3>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstitel</Label>
                        <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="h-10 text-xs font-bold rounded-xl shadow-sm border-slate-200" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstyp</Label>
                        <Select value={metaTypeId} onValueChange={setMetaTypeId}>
                          <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nicht spezifiziert</SelectItem>
                            {processTypes?.filter(t => t.enabled).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Zusammenfassung</Label>
                        <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="min-h-[80px] text-xs leading-relaxed rounded-2xl shadow-inner border-slate-100" />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-indigo-600 border-b pb-2 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" /> Abgrenzung & Schnittstellen
                      </h3>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Input-Faktoren</Label>
                        <Textarea value={metaInputs} onChange={e => setMetaInputs(e.target.value)} placeholder="Was wird zum Start benötigt?" className="min-h-[60px] text-xs rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Ergebnisse (Outputs)</Label>
                        <Textarea value={metaOutputs} onChange={e => setMetaOutputs(e.target.value)} placeholder="Was ist das Ergebnis?" className="min-h-[60px] text-xs rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Messgrößen (KPIs)</Label>
                        <Input value={metaKpis} onChange={e => setMetaKpis(e.target.value)} placeholder="z.B. Durchlaufzeit < 24h" className="h-10 text-xs rounded-xl" />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-primary border-b pb-2 flex items-center gap-2">
                        <UserCircle className="w-3.5 h-3.5" /> Governance & Verantwortung
                      </h3>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Verantwortliche Abteilung</Label>
                        <Select value={metaDeptId} onValueChange={setMetaDeptId}>
                          <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nicht zugewiesen</SelectItem>
                            {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Strategischer Eigner (Rolle)</Label>
                        <Select value={metaOwnerRoleId} onValueChange={setMetaOwnerRoleId}>
                          <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nicht zugewiesen</SelectItem>
                            {jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(j => <SelectItem key={j.id} value={j.id}>{getFullRoleName(j.id)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Regulatorischer Rahmen</Label>
                        <Input value={metaFramework} onChange={e => setMetaFramework(e.target.value)} placeholder="z.B. ISO 9001, BSI Grundschutz" className="h-10 text-xs rounded-xl" />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-2 flex items-center gap-2">
                        <FileCheck className="w-3.5 h-3.5" /> Compliance-Metriken
                      </h3>
                      <div className="grid grid-cols-1 gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-emerald-600 uppercase">Automatisierungsgrad</Label>
                          <Select value={metaAutomation} onValueChange={(v:any) => setMetaAutomation(v)}>
                            <SelectTrigger className="h-8 text-[10px] bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="manual">Manuell</SelectItem><SelectItem value="partial">Teilautomatisiert</SelectItem><SelectItem value="full">Vollautomatisiert</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-emerald-600 uppercase">Datenvolumen</Label>
                          <Select value={metaVolume} onValueChange={(v:any) => setMetaDataVolume(v)}>
                            <SelectTrigger className="h-8 text-[10px] bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="low">Gering (Ad-hoc)</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch (Massenverarb.)</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-bold text-emerald-600 uppercase">Frequenz</Label>
                          <Select value={metaFrequency} onValueChange={(v:any) => setMetaFrequency(v)}>
                            <SelectTrigger className="h-8 text-[10px] bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_demand">Auf Abruf</SelectItem>
                              <SelectItem value="daily">Täglich</SelectItem>
                              <SelectItem value="weekly">Wöchentlich</SelectItem>
                              <SelectItem value="monthly">Monatlich</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-amber-600 border-b pb-2 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5" /> Review & Organisation
                      </h3>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Offene Fragen / Punkte</Label>
                        <Textarea value={metaOpenQuestions} onChange={e => setMetaOpenQuestions(e.target.value)} placeholder="Was muss noch geklärt werden?" className="min-h-[80px] text-xs rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Tags / Schlagworte</Label>
                        <Input value={metaTags} onChange={e => setMetaTags(e.target.value)} placeholder="Tag1, Tag2..." className="h-10 text-xs rounded-xl" />
                      </div>
                    </section>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-slate-50 shrink-0">
                <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase gap-2 shadow-lg active:scale-95 transition-all">
                  {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} 
                  Stammdaten sichern
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <main 
          ref={containerRef}
          className={cn("flex-1 relative overflow-hidden transition-colors duration-500 bg-slate-200", !isDiagramLocked ? "cursor-grab active:cursor-grabbing" : "cursor-default")} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={(e) => { 
            const dist = Math.sqrt(Math.pow(e.clientX - lastMousePos.x, 2) + Math.pow(e.clientY - lastMousePos.y, 2));
            const time = Date.now() - mouseDownTime;
            if (dist < 5 && time < 200) setSelectedNodeId(null); 
          }}
        >
          <div 
            className="absolute inset-0 origin-top-left"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
              width: '5000px', 
              height: '5000px', 
              zIndex: 10,
              transition: isProgrammaticMove ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          >
            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
              <defs>
                <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <polygon points="0 0, 5 2.5, 0 5" fill="currentColor" />
                </marker>
              </defs>
              {connectionPaths.map((p, i) => (
                <g key={i}>
                  <path 
                    d={p.path} fill="none" 
                    stroke={p.isActive ? "hsl(var(--primary))" : "#94a3b8"} 
                    strokeWidth={p.isActive ? "3" : "1.5"} 
                    markerEnd="url(#arrowhead)" 
                    className={cn("transition-all duration-500", animationsEnabled && p.isActive && "animate-flow-dash")}
                    style={animationsEnabled && p.isActive ? { strokeDasharray: "10, 5", color: "hsl(var(--primary))" } : { color: "#94a3b8" }}
                  />
                  {p.label && (
                    <text
                      className="text-[10px] font-bold fill-slate-500"
                      style={{ filter: 'drop-shadow(0 1px 1px white)' }}
                    >
                      <textPath href={`#path-${i}`} startOffset="50%" dy="-5" textAnchor="middle">{p.label}</textPath>
                    </text>
                  )}
                  <path id={`path-${i}`} d={p.path} fill="none" stroke="transparent" pointerEvents="none" />
                </g>
              ))}
            </svg>
            {gridNodes.map(node => (
              <div key={node.id} className="absolute transition-all duration-500 ease-in-out" style={{ left: node.x + OFFSET_X, top: node.y + OFFSET_Y }}>
                <ProcessStepCard 
                  node={node} isMapMode={{ activeNodeId: selectedNodeId }} activeNodeId={selectedNodeId} 
                  setActiveNodeId={(id: string) => {
                    handleNodeClick(id);
                    if (selectedNodeId === id) openNodeEditor(node);
                  }} 
                  resources={resources} allFeatures={allFeatures} 
                  getFullRoleName={getFullRoleName} 
                  animationsEnabled={animationsEnabled}
                  mediaCount={mediaFiles?.filter(m => m.subEntityId === node.id).length || 0}
                />
              </div>
            ))}
          </div>

          <div className="absolute bottom-8 right-8 z-50 bg-white/95 backdrop-blur-md border rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1.5">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(2, s + 0.1)); }}><Plus className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="left">Vergrößern</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.2, s - 0.1)); }}><Minus className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="left">Verkleinern</TooltipContent></Tooltip>
              <Separator className="my-1" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary" onClick={(e) => { e.stopPropagation(); if(gridNodes.length > 0) centerOnNode(selectedNodeId || gridNodes[0].id); }}><Focus className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent side="left">Zentrieren</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
        </main>
      </div>

      {/* Node Editor Dialog */}
      <Dialog open={isNodeEditorOpen} onOpenChange={setIsNodeEditorOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-primary/20", 
                editType === 'decision' ? "bg-amber-500 text-white" : editType === 'end' ? "bg-red-50 text-white" : editType === 'subprocess' ? "bg-indigo-600 text-white" : "bg-primary text-white"
              )}>
                {editType === 'decision' ? <GitBranch className="w-6 h-6" /> : editType === 'subprocess' ? <RefreshCw className="w-6 h-6" /> : editType === 'end' ? <StopCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-headline font-bold uppercase tracking-tight">Schritt konfigurieren</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Definieren Sie Tätigkeiten und GRC-Abhängigkeiten</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b shrink-0 bg-white">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Basis & Typ</TabsTrigger>
                <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600 transition-all">Zuständigkeiten</TabsTrigger>
                <TabsTrigger value="grc" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600 transition-all">Ressourcen & Daten</TabsTrigger>
                <TabsTrigger value="rel" className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-amber-600 transition-all">Handover</TabsTrigger>
                <TabsTrigger value="checklist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-orange-600 transition-all">Checkliste & Hilfen</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung des Schritts</Label>
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Knoten-Typ</Label>
                        <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="w-3 h-3 text-slate-300" /></TooltipTrigger><TooltipContent className="text-[10px]">Bestimmt die visuelle Darstellung und Logik (z.B. Verzweigung).</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                      <Select value={editType} onValueChange={(v:any) => setEditType(v)}>
                        <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="start">Startpunkt (Start)</SelectItem>
                          <SelectItem value="step">Arbeitsschritt (Schritt)</SelectItem>
                          <SelectItem value="decision">Entscheidung (Weiche)</SelectItem>
                          <SelectItem value="subprocess">Referenz (Teilprozess)</SelectItem>
                          <SelectItem value="end">Abschluss (Ende)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editType === 'subprocess' && (
                      <div className="space-y-2 animate-in slide-in-from-top-2">
                        <Label className="text-[10px] font-bold uppercase text-indigo-600 ml-1">Ziel-Prozess auswählen</Label>
                        <div className="relative group mb-1.5">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input placeholder="Prozesse durchsuchen..." value={subProcSearch} onChange={e => setSubProcSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                        </div>
                        <Select value={editTargetProcessId} onValueChange={handleSubprocessSelect}>
                          <SelectTrigger className="rounded-xl h-11 bg-indigo-50 border-indigo-100"><SelectValue placeholder="Prozess wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein Bezug</SelectItem>
                            {processes?.filter(p => p.id !== id && p.title.toLowerCase().includes(subProcSearch.toLowerCase())).map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anweisung / Beschreibung</Label>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="min-h-[120px] rounded-2xl p-4 text-xs bg-white" placeholder="Beschreiben Sie hier präzise, was der Mitarbeiter in diesem Schritt tun muss." />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="roles" className="mt-0 space-y-8 animate-in fade-in">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b pb-3">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Ausführende Rolle</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Wer führt diese Tätigkeit operativ durch?</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-indigo-700 italic leading-relaxed">
                          Die Rollenzuordnung ermöglicht automatisierte Berechtigungs-Checks. Die KI prüft, ob die technischen Rechte zur fachlichen Aufgabe passen.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortliche Stelle</Label>
                        <Select value={editRoleId || 'none'} onValueChange={setEditRoleId}>
                          <SelectTrigger className="rounded-xl h-11 bg-white border-slate-200"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                          <SelectContent className="rounded-xl max-h-[300px]">
                            <SelectItem value="none">Keine spezifische Rolle</SelectItem>
                            {jobTitles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(j => (
                              <SelectItem key={j.id} value={j.id}>{getFullRoleName(j.id)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="grc" className="mt-0 space-y-10 animate-in fade-in">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-4 shadow-inner">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900 uppercase">GRC Vernetzung</p>
                      <p className="text-[10px] text-emerald-700 font-medium leading-relaxed">
                        Verknüpfen Sie hier die IT-Systeme und Datenobjekte. Das System berechnet daraus automatisch den Schutzbedarf (CIA) und die DSGVO-Relevanz des gesamten Prozesses.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2 ml-1">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> IT-Systeme (Assets)
                        </Label>
                        <div className="relative group">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input placeholder="Systeme suchen..." value={resSearch} onChange={e => setResSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl border bg-white shadow-inner">
                        <ScrollArea className="h-64">
                          <div className="space-y-1.5">
                            {resources?.filter(res => (activeTenantId === 'all' || res.tenantId === activeTenantId || res.tenantId === 'global') && res.name.toLowerCase().includes(resSearch.toLowerCase())).map(res => (
                              <div key={res.id} className={cn(
                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                editResIds.includes(res.id) ? "bg-primary/5 border-primary/20" : "bg-white border-transparent hover:bg-slate-50"
                              )} onClick={() => setEditResIds(prev => editResIds.includes(res.id) ? prev.filter(id => id !== res.id) : [...prev, res.id])}>
                                <Checkbox checked={editResIds.includes(res.id)} />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold text-slate-800 truncate">{res.name}</p>
                                  <p className="text-[8px] font-black uppercase text-slate-400">{res.assetType}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2 ml-1">
                        <Label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2 ml-1">
                          <Database className="w-3.5 h-3.5" /> Datenobjekte (Features)
                        </Label>
                        <div className="relative group">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input placeholder="Daten suchen..." value={featSearch} onChange={e => setFeatSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl border bg-white shadow-inner">
                        <ScrollArea className="h-64">
                          <div className="space-y-1.5">
                            {allFeatures?.filter(f => (activeTenantId === 'all' || f.tenantId === activeTenantId) && f.name.toLowerCase().includes(featSearch.toLowerCase())).map(f => (
                              <div key={f.id} className={cn(
                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                editFeatIds.includes(f.id) ? "bg-emerald-50 border-emerald-200" : "bg-white border-transparent hover:bg-slate-50"
                              )} onClick={() => setEditFeatIds(prev => editFeatIds.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id])}>
                                <Checkbox checked={editFeatIds.includes(f.id)} />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold text-slate-800 truncate">{f.name}</p>
                                  <p className="text-[8px] font-black uppercase text-slate-400">{f.carrier}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rel" className="mt-0 space-y-10 animate-in fade-in">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4 shadow-inner">
                    <Network className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 uppercase">Handover-Punkte & Entscheidungen</p>
                      <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                        Definieren Sie hier den logischen Fluss. Bei Verzweigungen (Weichen) können Sie direkt an den Ausgängen die jeweilige Bedingung (z. B. "Ja" oder "Nein") festlegen.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2 ml-1">
                        <Label className="text-[10px] font-black uppercase text-amber-600 tracking-widest flex items-center gap-2">
                          <ArrowUpCircle className="w-4 h-4" /> Eingang (Vorgänger)
                        </Label>
                        <div className="relative group">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <Input placeholder="Schritte suchen..." value={predSearch} onChange={e => setPredSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl border bg-white shadow-inner">
                        <ScrollArea className="h-64">
                          <div className="space-y-1.5">
                            {activeVersion?.model_json?.nodes?.filter((n: any) => n.id !== editingNode?.id && n.title.toLowerCase().includes(predSearch.toLowerCase())).map((n: any) => (
                              <div key={n.id} className={cn(
                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                editPredecessorIds.includes(n.id) ? "bg-amber-50 border-amber-200" : "bg-white border-transparent hover:bg-slate-50"
                              )} onClick={() => setEditPredecessorIds(prev => editPredecessorIds.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id])}>
                                <Checkbox checked={editPredecessorIds.includes(n.id)} />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold text-slate-800 truncate">{n.title}</p>
                                  <p className="text-[8px] font-black uppercase text-slate-400">{n.type}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2 ml-1">
                        <Label className="text-[10px] font-black uppercase text-amber-600 tracking-widest flex items-center gap-2">
                          <ArrowDownCircle className="w-4 h-4" /> Ausgang (Nachfolger)
                        </Label>
                        <div className="relative group">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <Input placeholder="Schritte suchen..." value={succSearch} onChange={e => setSuccSearch(e.target.value)} className="h-8 pl-8 text-[10px] rounded-lg" />
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl border bg-white shadow-inner">
                        <ScrollArea className="h-64">
                          <div className="space-y-3">
                            {activeVersion?.model_json?.nodes?.filter((n: any) => n.id !== editingNode?.id && n.title.toLowerCase().includes(succSearch.toLowerCase())).map((n: any) => {
                              const isLinked = editSuccessors.some(s => s.targetId === n.id);
                              const currentLink = editSuccessors.find(s => s.targetId === n.id);
                              
                              return (
                                <div key={n.id} className={cn(
                                  "p-3 rounded-xl transition-all border space-y-3",
                                  isLinked ? "bg-amber-50 border-amber-200" : "bg-white border-transparent hover:bg-slate-50"
                                )}>
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                                    if (isLinked) setEditSuccessors(prev => prev.filter(s => s.targetId !== n.id));
                                    else setEditSuccessors(prev => [...prev, { targetId: n.id, label: '' }]);
                                  }}>
                                    <Checkbox checked={isLinked} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-bold text-slate-800 truncate">{n.title}</p>
                                      <p className="text-[8px] font-black uppercase text-slate-400">{n.type}</p>
                                    </div>
                                  </div>
                                  {isLinked && (
                                    <div className="pl-7 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                      <Label className="text-[8px] font-black uppercase text-amber-600">Bedingung / Pfad-Name</Label>
                                      <Input 
                                        placeholder="z.B. Ja, Freigabe erteilt..." 
                                        value={currentLink?.label || ''} 
                                        onChange={e => setEditSuccessors(prev => prev.map(s => s.targetId === n.id ? { ...s, label: e.target.value } : s))}
                                        className="h-7 text-[10px] bg-white rounded-lg border-amber-200"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="checklist" className="mt-0 space-y-10 animate-in fade-in pb-20">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b pb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Operative Checkliste</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Was muss zwingend geprüft werden?</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Neuen Prüfpunkt hinzufügen..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} className="h-11 rounded-xl shadow-sm" />
                      <Button onClick={addCheckItem} className="h-11 rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 transition-all active:scale-95"><Plus className="w-4 h-4" /></Button>
                    </div>
                    <div className="space-y-2">
                      {editChecklist.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group/item shadow-sm">
                          <span className="text-xs font-medium text-slate-700">{item}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={() => removeCheckItem(idx)}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b pb-3">
                      <FileUp className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Begleitmaterialien</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Dokumente & Bilder als Hilfestellung</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 border-2 border-dashed rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-white hover:border-primary/30 relative">
                        <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                        {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <FileUp className="w-8 h-8 text-slate-300" />}
                        <div>
                          <p className="text-xs font-bold text-slate-700">Klicken oder Datei ziehen</p>
                          <p className="text-[9px] text-slate-400 uppercase mt-1">PDF, JPG, PNG (Max. 5MB)</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {mediaFiles?.filter(m => m.subEntityId === editingNode?.id).map(file => (
                          <div key={file.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between group shadow-sm">
                            <div className="flex items-center gap-3">
                              {file.fileType.includes('image') ? <ImageIcon className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-indigo-600" />}
                              <span className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{file.fileName}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                        {(!mediaFiles || mediaFiles.filter(m => m.subEntityId === editingNode?.id).length === 0) && (
                          <div className="py-10 text-center opacity-20 italic text-[10px]">Keine Dateien hinterlegt</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-blue-600 ml-1">Experten-Tipps</Label>
                      <Textarea value={editTips} onChange={e => setEditTips(e.target.value)} className="min-h-[100px] rounded-2xl bg-blue-50/20 border-blue-100 text-xs italic p-4 shadow-inner" placeholder="Geben Sie Kollegen wertvolle Tipps zur Durchführung..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-red-600 ml-1">Typische Fehler</Label>
                      <Textarea value={editErrors} onChange={e => setEditErrors(e.target.value)} className="min-h-[100px] rounded-2xl bg-red-50/20 border-red-100 text-xs italic p-4 shadow-inner" placeholder="Vor welchen Stolperfallen möchten Sie warnen?..." />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsNodeEditorOpen(false)} className="rounded-xl font-bold text-[10px] px-8 h-11 uppercase tracking-widest text-slate-400 hover:bg-white transition-all">Abbrechen</Button>
              <Button onClick={handleSaveNode} disabled={isApplying} className="rounded-xl h-11 px-12 bg-primary text-white font-bold text-[10px] uppercase shadow-lg gap-2 active:scale-95 transition-all tracking-widest">
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Änderungen übernehmen
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProcessStepCard({ node, isMapMode = false, activeNodeId, setActiveNodeId, resources, allFeatures, getFullRoleName, animationsEnabled, mediaCount }: any) {
  const isActive = activeNodeId === node.id;
  const isExpanded = isMapMode && isActive;
  const roleName = getFullRoleName(node.roleId);
  const nodeResources = resources?.filter((r:any) => node.resourceIds?.includes(r.id));

  return (
    <Card 
      className={cn(
        "rounded-2xl border transition-all duration-500 bg-white cursor-pointer relative overflow-hidden",
        isActive ? (animationsEnabled ? "active-flow-card z-[100]" : "border-primary border-2 shadow-lg z-[100]") : "border-slate-100 shadow-sm hover:border-primary/20",
        isMapMode && (isActive ? "w-[600px] h-[420px]" : "w-64 h-[82px]")
      )}
      style={isMapMode && isActive ? { transform: 'translateX(-172px)' } : {}}
      onClick={(e) => { e.stopPropagation(); setActiveNodeId(node.id); }}
    >
      <CardHeader className={cn("p-4 flex flex-row items-center justify-between gap-4 bg-white transition-colors duration-500", isExpanded ? "bg-slate-50/50 border-b" : "border-b-0")}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-transform duration-500",
            isActive && "scale-110",
            node.type === 'start' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
            node.type === 'end' ? "bg-red-50 text-red-600 border-red-100" :
            node.type === 'decision' ? "bg-amber-50 text-amber-600 border-amber-100" :
            node.type === 'subprocess' ? "bg-indigo-600 text-white shadow-lg border-none" : "bg-primary/5 text-primary border-primary/10"
          )}>
            {node.type === 'start' ? <PlayCircle className="w-6 h-6" /> : 
             node.type === 'end' ? <StopCircle className="w-6 h-6" /> : 
             node.type === 'decision' ? <HelpCircle className="w-6 h-6" /> : 
             node.type === 'subprocess' ? <RefreshCw className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn("font-black uppercase tracking-tight text-slate-900 truncate", isMapMode && !isActive ? "text-[10px]" : "text-sm")}>{node.title}</h4>
              {mediaCount > 0 && !isExpanded && <Paperclip className="w-2.5 h-2.5 text-indigo-400" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5"><Briefcase className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{roleName}</span></div>
          </div>
        </div>
        {isActive && (
          <Badge className="bg-primary text-white border-none rounded-full h-5 px-3 text-[8px] font-black uppercase tracking-widest animate-pulse shadow-sm">Edit Mode</Badge>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-0 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="md:col-span-7 p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400">Beschreibung</Label>
                <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{node.description || 'Keine Beschreibung.'}"</p>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Operative Checkliste</Label>
                <div className="space-y-2">
                  {(node.checklist || []).map((item:any, idx:number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl shadow-sm">
                      <Checkbox disabled className="data-[state=checked]:bg-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="md:col-span-5 p-6 bg-slate-50/30 space-y-6 shadow-inner">
              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-2"><Zap className="w-3 h-3" /> Prozesstipps</Label>
                {node.tips && <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-[10px] text-blue-700 italic font-medium leading-relaxed shadow-sm">Tipp: {node.tips}</div>}
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[9px] font-black uppercase text-slate-400">IT-Ressourcen</Label>
                <div className="flex flex-wrap gap-1.5">
                  {nodeResources?.map((res:any) => <Badge key={res.id} variant="outline" className="bg-white text-indigo-700 text-[8px] font-black h-5 border-indigo-100 shadow-sm">{res.name}</Badge>)}
                </div>
              </div>
              <div className="pt-4 border-t flex justify-center">
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-[9px] font-black uppercase border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                  Details bearbeiten <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
