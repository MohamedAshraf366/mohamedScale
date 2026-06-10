import React, { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  ChevronRight, ArrowRight, Circle, CheckCircle2, FileText, Users, Truck, 
  CreditCard, Package, BarChart3, ClipboardList, ShoppingCart, Calculator, 
  Receipt, Wallet, AlertTriangle, Lightbulb, Plus, MessageSquare, GripVertical,
  Inbox, ChevronDown, ChevronUp, Edit3, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

// Master workflow data
const masterWorkflow = [
  {
    id: 'supply',
    name: 'Supply',
    area: 'Supply',
    icon: Package,
    color: 'bg-emerald-500',
    textColor: 'text-white',
    borderColor: 'border-emerald-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    subWorkflow: [
      {
        id: 'sourcing',
        name: 'Sourcing',
        icon: ClipboardList,
        actions: [
          { id: 'identify-needs', name: 'Identify Material Needs', status: 'active' },
          { id: 'research-suppliers', name: 'Research Suppliers', status: 'pending' },
          { id: 'request-quotes', name: 'Request Quotes', status: 'pending' },
        ]
      },
      {
        id: 'negotiation',
        name: 'Negotiation',
        icon: Users,
        actions: [
          { id: 'compare-bids', name: 'Compare Bids', status: 'pending' },
          { id: 'negotiate-terms', name: 'Negotiate Terms', status: 'pending' },
          { id: 'finalize-agreement', name: 'Finalize Agreement', status: 'pending' },
        ]
      },
      {
        id: 'procurement',
        name: 'Procurement',
        icon: ShoppingCart,
        actions: [
          { id: 'create-po', name: 'Create Purchase Order', status: 'pending' },
          { id: 'approve-po', name: 'Approve PO', status: 'pending' },
          { id: 'send-po', name: 'Send to Supplier', status: 'pending' },
        ]
      },
    ]
  },
  {
    id: 'sales',
    name: 'Sales',
    area: 'Sales',
    icon: BarChart3,
    color: 'bg-blue-500',
    textColor: 'text-white',
    borderColor: 'border-blue-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    subWorkflow: [
      {
        id: 'lead-gen',
        name: 'Lead Generation',
        icon: Users,
        actions: [
          { id: 'identify-prospects', name: 'Identify Prospects', status: 'active' },
          { id: 'initial-contact', name: 'Initial Contact', status: 'pending' },
          { id: 'qualify-lead', name: 'Qualify Lead', status: 'pending' },
        ]
      },
      {
        id: 'quotation',
        name: 'Quotation',
        icon: Calculator,
        actions: [
          { id: 'gather-requirements', name: 'Gather Requirements', status: 'pending' },
          { id: 'prepare-quote', name: 'Prepare Quote', status: 'pending' },
          { id: 'send-quote', name: 'Send Quote', status: 'pending' },
        ]
      },
      {
        id: 'closing',
        name: 'Closing',
        icon: CheckCircle2,
        actions: [
          { id: 'negotiate-deal', name: 'Negotiate Deal', status: 'pending' },
          { id: 'get-approval', name: 'Get Client Approval', status: 'pending' },
          { id: 'sign-contract', name: 'Sign Contract', status: 'pending' },
        ]
      },
    ]
  },
  {
    id: 'operations',
    name: 'Operations',
    area: 'Operations',
    icon: Truck,
    color: 'bg-orange-500',
    textColor: 'text-white',
    borderColor: 'border-orange-500',
    bgLight: 'bg-orange-50 dark:bg-orange-950/30',
    subWorkflow: [
      {
        id: 'order-processing',
        name: 'Order Processing',
        icon: ClipboardList,
        actions: [
          { id: 'verify-order', name: 'Verify Order Details', status: 'active' },
          { id: 'allocate-inventory', name: 'Allocate Inventory', status: 'pending' },
          { id: 'create-delivery', name: 'Create Delivery Schedule', status: 'pending' },
        ]
      },
      {
        id: 'logistics',
        name: 'Logistics',
        icon: Truck,
        actions: [
          { id: 'arrange-transport', name: 'Arrange Transport', status: 'pending' },
          { id: 'track-shipment', name: 'Track Shipment', status: 'pending' },
          { id: 'confirm-delivery', name: 'Confirm Delivery', status: 'pending' },
        ]
      },
      {
        id: 'quality',
        name: 'Quality Check',
        icon: CheckCircle2,
        actions: [
          { id: 'inspect-goods', name: 'Inspect Goods', status: 'pending' },
          { id: 'document-issues', name: 'Document Issues', status: 'pending' },
          { id: 'resolve-issues', name: 'Resolve Issues', status: 'pending' },
        ]
      },
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    area: 'Admin',
    icon: Wallet,
    color: 'bg-purple-500',
    textColor: 'text-white',
    borderColor: 'border-purple-500',
    bgLight: 'bg-purple-50 dark:bg-purple-950/30',
    subWorkflow: [
      {
        id: 'invoicing',
        name: 'Invoicing',
        icon: Receipt,
        actions: [
          { id: 'generate-invoice', name: 'Generate Invoice', status: 'active' },
          { id: 'send-invoice', name: 'Send to Client', status: 'pending' },
          { id: 'track-payment', name: 'Track Payment', status: 'pending' },
        ]
      },
      {
        id: 'collections',
        name: 'Collections',
        icon: CreditCard,
        actions: [
          { id: 'payment-reminder', name: 'Send Payment Reminder', status: 'pending' },
          { id: 'process-payment', name: 'Process Payment', status: 'pending' },
          { id: 'reconcile', name: 'Reconcile Accounts', status: 'pending' },
        ]
      },
      {
        id: 'reporting',
        name: 'Reporting',
        icon: FileText,
        actions: [
          { id: 'generate-reports', name: 'Generate Reports', status: 'pending' },
          { id: 'analyze-data', name: 'Analyze Data', status: 'pending' },
          { id: 'present-insights', name: 'Present Insights', status: 'pending' },
        ]
      },
    ]
  },
];

interface StrategicBlocker {
  id: string;
  title: string;
  description: string | null;
  area: string;
  priority: string;
  status: string;
  mitigation_owner: string | null;
  target_date: string | null;
  created_at: string;
  workflow_step: string | null;
}

interface FeedbackRisksPanelProps {
  area: string;
  workflowStep: string;
  color: string;
  bgLight: string;
  borderColor: string;
}

// Draggable Issue Card Component
const DraggableIssueCard = ({ blocker, getPriorityColor, getStatusColor }: { 
  blocker: StrategicBlocker; 
  getPriorityColor: (p: string) => string;
  getStatusColor: (s: string) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: blocker.id,
    data: blocker,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 p-2 rounded bg-background/60 border border-border/50 cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 shadow-lg scale-105"
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
      <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{blocker.title}</p>
        {blocker.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{blocker.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(blocker.priority))}>
            {blocker.priority}
          </Badge>
          <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(blocker.status))}>
            {blocker.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>
    </div>
  );
};

const FeedbackRisksPanel = ({ area, workflowStep, color, bgLight, borderColor }: FeedbackRisksPanelProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'Issue' | 'Process Optimization'>('Issue');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: blockers = [], isLoading } = useQuery({
    queryKey: ['strategic-blockers', area, workflowStep],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_blockers')
        .select('*')
        .eq('area', area)
        .eq('workflow_step', workflowStep)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as StrategicBlocker[];
    },
  });

  const addSuggestionMutation = useMutation({
    mutationFn: async (newBlocker: { title: string; description: string; area: string; priority: string; workflow_step: string }) => {
      const { data, error } = await supabase
        .from('strategic_blockers')
        .insert(newBlocker)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategic-blockers', area, workflowStep] });
      toast.success('Suggestion added successfully');
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setSuggestionType('Issue');
    },
    onError: () => {
      toast.error('Failed to add suggestion');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    addSuggestionMutation.mutate({
      title: `[${suggestionType}] ${title}`,
      description,
      area,
      priority: 'Medium',
      workflow_step: workflowStep,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'resolved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const { isOver, setNodeRef } = useDroppable({
    id: `drop-${workflowStep}`,
    data: { area, workflowStep },
  });

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mt-4 p-4 rounded-lg border transition-all duration-200",
        bgLight, 
        borderColor,
        isOver && "ring-2 ring-primary ring-offset-2 scale-[1.02]"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Feedback & Risks</span>
          <Badge variant="secondary" className="text-xs">
            {blockers.length}
          </Badge>
          {isOver && (
            <Badge className="text-xs bg-primary text-primary-foreground animate-pulse">
              Drop here
            </Badge>
          )}
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs gap-1"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="h-3 w-3" />
          Improvement Suggestion
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
      ) : blockers.length === 0 ? (
        <div className={cn(
          "text-sm text-muted-foreground flex items-center gap-2 p-3 rounded border-2 border-dashed",
          isOver ? "border-primary bg-primary/5" : "border-border"
        )}>
          <Lightbulb className="h-4 w-4" />
          {isOver ? "Drop to assign issue here" : "No issues or suggestions for this area yet. Drag issues here to assign."}
        </div>
      ) : (
        <div className="space-y-2">
          {blockers.map((blocker) => (
            <div 
              key={blocker.id} 
              className="flex items-start gap-2 p-2 rounded bg-background/60 border border-border/50"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{blocker.title}</p>
                {blocker.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{blocker.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(blocker.priority))}>
                    {blocker.priority}
                  </Badge>
                  <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(blocker.status))}>
                    {blocker.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Suggestion Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Improvement Suggestion
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={suggestionType} onValueChange={(v) => setSuggestionType(v as 'Issue' | 'Process Optimization')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Issue">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Issue
                    </div>
                  </SelectItem>
                  <SelectItem value="Process Optimization">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Process Optimization
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Area</Label>
              <Input value={area} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Workflow Step</Label>
              <Input value={workflowStep} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>Title</Label>
              <Input 
                placeholder="Brief description of the issue or suggestion" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea 
                placeholder="Provide more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input value="Medium" disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Default priority is set to Medium</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={addSuggestionMutation.isPending}>
              {addSuggestionMutation.isPending ? 'Saving...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

interface ActionEditData {
  masterId: string;
  subId: string;
  actionId: string;
  name: string;
  status: string;
}

const AdminProcessImprovement = () => {
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actionEditOpen, setActionEditOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionEditData | null>(null);
  const [localWorkflow, setLocalWorkflow] = useState(masterWorkflow);
  const queryClient = useQueryClient();

  const activeMaster = localWorkflow.find(m => m.id === selectedMaster);
  const activeSub = activeMaster?.subWorkflow.find(s => s.id === selectedSub);

  // Fetch unassigned issues (workflow_step is null or empty)
  const { data: unassignedBlockers = [], isLoading: unassignedLoading } = useQuery({
    queryKey: ['strategic-blockers', 'unassigned'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_blockers')
        .select('*')
        .or('workflow_step.is.null,workflow_step.eq.')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching unassigned blockers:', error);
        return [];
      }
      return data as StrategicBlocker[];
    },
  });

  // Mutation to assign issue to a workflow step
  const assignIssueMutation = useMutation({
    mutationFn: async ({ id, area, workflowStep }: { id: string; area: string; workflowStep: string }) => {
      const { error } = await supabase
        .from('strategic_blockers')
        .update({ area, workflow_step: workflowStep })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategic-blockers'] });
      toast.success(`Issue assigned to ${variables.workflowStep}`);
    },
    onError: () => {
      toast.error('Failed to assign issue');
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dropData = over.data.current as { area: string; workflowStep: string } | undefined;
    if (!dropData) return;

    const blocker = active.data.current as StrategicBlocker;
    if (!blocker) return;

    // Assign issue to the workflow step
    assignIssueMutation.mutate({
      id: blocker.id,
      area: dropData.area,
      workflowStep: dropData.workflowStep,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'resolved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleMasterClick = (id: string) => {
    if (selectedMaster === id) {
      setSelectedMaster(null);
      setSelectedSub(null);
    } else {
      setSelectedMaster(id);
      setSelectedSub(null);
    }
  };

  const handleSubClick = (id: string) => {
    if (selectedSub === id) {
      setSelectedSub(null);
    } else {
      setSelectedSub(id);
    }
  };

  const handleActionClick = (masterId: string, subId: string, action: { id: string; name: string; status: string }) => {
    setEditingAction({
      masterId,
      subId,
      actionId: action.id,
      name: action.name,
      status: action.status,
    });
    setActionEditOpen(true);
  };

  const handleSaveAction = () => {
    if (!editingAction) return;
    
    setLocalWorkflow(prev => 
      prev.map(master => 
        master.id === editingAction.masterId
          ? {
              ...master,
              subWorkflow: master.subWorkflow.map(sub =>
                sub.id === editingAction.subId
                  ? {
                      ...sub,
                      actions: sub.actions.map(action =>
                        action.id === editingAction.actionId
                          ? { ...action, name: editingAction.name, status: editingAction.status }
                          : action
                      ),
                    }
                  : sub
              ),
            }
          : master
      )
    );
    
    toast.success('Action updated successfully');
    setActionEditOpen(false);
    setEditingAction(null);
  };

  const activeDragItem = unassignedBlockers.find(b => b.id === activeId);

  return (
    <AdminLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Process Improvement</h1>
          <p className="text-muted-foreground">Visualize and optimize your business workflows</p>
        </div>

        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-h-[24px]">
          <span className="font-medium text-foreground">Master Workflow</span>
          <AnimatePresence mode="wait">
            {selectedMaster && activeMaster && (
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4" />
                <span className={cn("font-medium", activeMaster.textColor.replace('text-white', `text-${activeMaster.color.replace('bg-', '')}-600 dark:text-${activeMaster.color.replace('bg-', '')}-400`))}>
                  {activeMaster.name}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {selectedSub && activeSub && (
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{activeSub.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Level 1: Master Workflow */}
        <Card className="overflow-hidden border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {localWorkflow.map((step, index) => {
                const Icon = step.icon;
                const isSelected = selectedMaster === step.id;
                
                return (
                  <React.Fragment key={step.id}>
                    {index > 0 && (
                      <ArrowRight className="h-6 w-6 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <motion.button
                      onClick={() => handleMasterClick(step.id)}
                      className={cn(
                        "relative flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 flex-shrink-0 min-w-[160px]",
                        "border-2 shadow-sm hover:shadow-md",
                        isSelected 
                          ? cn(step.color, step.textColor, step.borderColor, "shadow-lg scale-105")
                          : "bg-card hover:bg-accent border-border"
                      )}
                      whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="font-semibold text-base">{step.name}</span>
                      <ChevronRight className={cn(
                        "h-5 w-5 ml-auto transition-transform duration-300",
                        isSelected && "rotate-90"
                      )} />
                      {isSelected && (
                        <motion.div
                          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px]"
                          style={{ borderTopColor: 'currentColor' }}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        />
                      )}
                    </motion.button>
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Level 2: Sub Workflow */}
        <AnimatePresence mode="wait">
          {selectedMaster && activeMaster && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card className={cn("overflow-hidden border-2", activeMaster.borderColor)}>
                <CardContent className="p-6">
                  {/* Connecting line from Level 1 */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={cn("w-1 h-8 rounded-full", activeMaster.color)} />
                    <span className="text-sm font-medium text-muted-foreground">
                      {activeMaster.name} Sub-processes
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 overflow-x-auto pb-2">
                    {activeMaster.subWorkflow.map((sub, index) => {
                      const SubIcon = sub.icon;
                      const isSelected = selectedSub === sub.id;
                      
                      return (
                        <React.Fragment key={sub.id}>
                          {index > 0 && (
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div className={cn("w-8 h-0.5", activeMaster.color, "opacity-40")} />
                            </div>
                          )}
                          <motion.button
                            onClick={() => handleSubClick(sub.id)}
                            className={cn(
                              "relative flex flex-col items-center gap-2 px-6 py-4 rounded-lg transition-all duration-300 flex-shrink-0 min-w-[140px]",
                              "border-2",
                              isSelected 
                                ? cn(activeMaster.bgLight, activeMaster.borderColor, "shadow-md")
                                : "bg-card hover:bg-accent border-border hover:border-muted-foreground/30"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className={cn(
                              "p-2 rounded-full",
                              isSelected ? activeMaster.color : "bg-muted"
                            )}>
                              <SubIcon className={cn(
                                "h-5 w-5",
                                isSelected ? activeMaster.textColor : "text-muted-foreground"
                              )} />
                            </div>
                            <span className={cn(
                              "font-medium text-sm",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {sub.name}
                            </span>
                            {isSelected && (
                              <motion.div
                                className={cn(
                                  "absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45",
                                  activeMaster.bgLight,
                                  "border-r-2 border-b-2",
                                  activeMaster.borderColor
                                )}
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                              />
                            )}
                          </motion.button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Level 2 Feedback & Risks Panel */}
                  {selectedSub && activeSub ? null : (
                    <FeedbackRisksPanel 
                      area={activeMaster.area}
                      workflowStep={activeMaster.name}
                      color={activeMaster.color}
                      bgLight={activeMaster.bgLight}
                      borderColor={activeMaster.borderColor}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level 3: Actions View */}
        <AnimatePresence mode="wait">
          {selectedSub && activeSub && activeMaster && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card className="overflow-hidden border-2 border-dashed border-muted-foreground/30">
                <CardContent className="p-6">
                  {/* Tree-view connecting path */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm", activeMaster.color, activeMaster.textColor)}>
                      <activeMaster.icon className="h-4 w-4" />
                      <span className="font-medium">{activeMaster.name}</span>
                    </div>
                    <div className="flex items-center">
                      <div className={cn("w-6 h-0.5", activeMaster.color)} />
                      <Circle className={cn("h-2 w-2 -mx-1", activeMaster.color.replace('bg-', 'text-'))} fill="currentColor" />
                      <div className={cn("w-6 h-0.5", activeMaster.color)} />
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm", activeMaster.bgLight, "border", activeMaster.borderColor)}>
                      <activeSub.icon className="h-4 w-4" />
                      <span className="font-medium">{activeSub.name}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-0.5 bg-muted-foreground/30" />
                      <Circle className="h-2 w-2 -mx-1 text-muted-foreground/50" fill="currentColor" />
                      <div className="w-6 h-0.5 bg-muted-foreground/30" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Actions</span>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {activeSub.actions.map((action, index) => (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleActionClick(activeMaster.id, activeSub.id, action)}
                        className={cn(
                          "relative p-4 rounded-lg border-2 transition-all duration-200",
                          "hover:shadow-md cursor-pointer group",
                          action.status === 'active' 
                            ? cn(activeMaster.bgLight, activeMaster.borderColor)
                            : "bg-card border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {/* Step number */}
                        <div className={cn(
                          "absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          action.status === 'active' 
                            ? cn(activeMaster.color, activeMaster.textColor)
                            : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>

                        {/* Edit indicator */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        
                        {/* Connecting line to next action */}
                        {index < activeSub.actions.length - 1 && (
                          <div className="hidden md:block absolute top-1/2 -right-4 w-4 h-0.5 bg-border" />
                        )}
                        
                        <div className="flex items-start gap-3 pt-2">
                          {action.status === 'active' ? (
                            <CheckCircle2 className={cn("h-5 w-5 mt-0.5", activeMaster.color.replace('bg-', 'text-'))} />
                          ) : (
                            <Circle className="h-5 w-5 mt-0.5 text-muted-foreground/40" />
                          )}
                          <div className="flex-1">
                            <h4 className={cn(
                              "font-medium text-sm",
                              action.status === 'active' ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {action.name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">
                              {action.status}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Level 3 Feedback & Risks Panel */}
                  <FeedbackRisksPanel 
                    area={activeMaster.area}
                    workflowStep={`${activeMaster.name} > ${activeSub.name}`}
                    color={activeMaster.color}
                    bgLight={activeMaster.bgLight}
                    borderColor={activeMaster.borderColor}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unassigned Issues Panel - Within page content */}
        <Card className="border-2 border-dashed border-muted-foreground/30">
          <CardHeader className="pb-3">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            >
              <div className="flex items-center gap-3">
                <Inbox className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Unassigned Issues</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {unassignedBlockers.length}
                </Badge>
              </div>
              <Button variant="ghost" size="sm">
                {unassignedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <AnimatePresence>
            {unassignedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0">
                  {unassignedLoading ? (
                    <div className="text-sm text-muted-foreground animate-pulse py-4">Loading...</div>
                  ) : unassignedBlockers.length === 0 ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      All issues have been assigned to workflow steps
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {unassignedBlockers.map((blocker) => (
                        <DraggableIssueCard 
                          key={blocker.id} 
                          blocker={blocker}
                          getPriorityColor={getPriorityColor}
                          getStatusColor={getStatusColor}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Drag and drop issues onto a workflow step to assign them
                  </p>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragItem && (
            <div className="flex items-start gap-2 p-2 rounded bg-background border-2 border-primary shadow-xl cursor-grabbing w-80">
              <GripVertical className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activeDragItem.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(activeDragItem.priority))}>
                    {activeDragItem.priority}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Action Edit Modal */}
      <Dialog open={actionEditOpen} onOpenChange={setActionEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Action Step
            </DialogTitle>
          </DialogHeader>
          
          {editingAction && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Action Name</Label>
                <Input 
                  value={editingAction.name}
                  onChange={(e) => setEditingAction({ ...editingAction, name: e.target.value })}
                  placeholder="Enter action name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editingAction.status} 
                  onValueChange={(v) => setEditingAction({ ...editingAction, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        Pending
                      </div>
                    </SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        Completed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAction}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProcessImprovement;
