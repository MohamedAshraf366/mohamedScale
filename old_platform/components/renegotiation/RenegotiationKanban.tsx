import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Building2,
  DollarSign,
  CalendarDays,
  MoreVertical,
  GripVertical,
  TrendingDown,
  CheckCircle,
  Clock,
  Handshake,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRenegotiations,
  useUpdateRenegotiationStatus,
  Renegotiation,
} from '@/hooks/useRenegotiations';
import RenegotiationTaskDetail from './RenegotiationTaskDetail';

const KANBAN_COLUMNS = [
  { id: 'pending', title: 'Scheduled', icon: Clock, color: 'text-blue-500' },
  { id: 'in_progress', title: 'In Progress', icon: Handshake, color: 'text-amber-500' },
  { id: 'agreement_reached', title: 'Agreement Reached', icon: TrendingDown, color: 'text-green-500' },
  { id: 'completed', title: 'Completed', icon: CheckCircle, color: 'text-emerald-600' },
];

interface RenegotiationCardProps {
  renegotiation: Renegotiation;
  onUpdateFinalPrice: (id: string, price: number) => void;
  onOpenDetail: (renegotiation: Renegotiation) => void;
  isDragging?: boolean;
}

const RenegotiationCard = ({ renegotiation, onUpdateFinalPrice, onOpenDetail, isDragging }: RenegotiationCardProps) => {
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState(renegotiation.final_agreed_price?.toString() || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: renegotiation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const savings = useMemo(() => {
    if (renegotiation.current_price && renegotiation.management_approved_target) {
      return ((renegotiation.current_price - renegotiation.management_approved_target) / renegotiation.current_price * 100);
    }
    return null;
  }, [renegotiation.current_price, renegotiation.management_approved_target]);

  const handlePriceSave = useCallback(() => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price > 0) {
      onUpdateFinalPrice(renegotiation.id, price);
    }
    setIsEditingPrice(false);
  }, [editPrice, onUpdateFinalPrice, renegotiation.id]);

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={cn(
          'cursor-grab hover:shadow-md transition-all border-l-4 border-l-primary',
          isDragging && 'opacity-50 shadow-lg rotate-2'
        )}
        onClick={() => onOpenDetail(renegotiation)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm line-clamp-1">
                  {renegotiation.materials?.name || 'Unknown Material'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {renegotiation.materials?.category}
                </p>
              </div>
            </div>
            {savings !== null && (
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                {savings.toFixed(1)}% target
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{renegotiation.suppliers?.name || 'No supplier'}</span>
          </div>

          {renegotiation.scheduled_date && (
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>{format(new Date(renegotiation.scheduled_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-muted/50 rounded p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Target</p>
              <p className="text-sm font-medium text-primary">
                {renegotiation.management_approved_target?.toFixed(2) || '—'}
              </p>
            </div>
            <div className="bg-green-50 rounded p-2 border border-green-200">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Final Price</p>
              {isEditingPrice ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="h-6 text-xs px-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePriceSave();
                      if (e.key === 'Escape') setIsEditingPrice(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handlePriceSave}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setIsEditingPrice(false)}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ) : (
                <p
                  className="text-sm font-medium text-green-600 cursor-pointer hover:text-green-700"
                  onClick={() => setIsEditingPrice(true)}
                >
                  {renegotiation.final_agreed_price?.toFixed(2) || 'Click to set'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RenegotiationKanban = () => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedRenegotiation, setSelectedRenegotiation] = useState<Renegotiation | null>(null);

  const { data: approvedRenegotiations, isLoading } = useRenegotiations('approved');
  const { data: activeRenegotiations } = useRenegotiations('active');
  const updateStatus = useUpdateRenegotiationStatus();

  // Combine approved and active
  const allRenegotiations = useMemo(() => {
    return [...(approvedRenegotiations || []), ...(activeRenegotiations || [])];
  }, [approvedRenegotiations, activeRenegotiations]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const getColumnItems = useCallback((columnId: string) => {
    return allRenegotiations.filter(r => r.renegotiation_status === columnId);
  }, [allRenegotiations]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overId = over.id as string;
    const activeItem = allRenegotiations.find(r => r.id === active.id);

    if (!activeItem) return;

    // Check if dropped on a column
    const targetColumn = KANBAN_COLUMNS.find(c => c.id === overId);
    if (targetColumn && activeItem.renegotiation_status !== targetColumn.id) {
      updateStatus.mutate({
        id: activeItem.id,
        renegotiation_status: targetColumn.id,
      });
    }
  };

  const handleUpdateFinalPrice = useCallback((id: string, price: number) => {
    updateStatus.mutate({
      id,
      renegotiation_status: 'agreement_reached',
      final_agreed_price: price,
    });
  }, [updateStatus]);

  const activeRenegotiation = activeId ? allRenegotiations.find(r => r.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading renegotiations...</div>
      </div>
    );
  }

  if (!allRenegotiations.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Handshake className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No Active Renegotiations</p>
          <p className="text-sm mt-2">Approved renegotiations will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-300px)] min-h-[500px]">
        {KANBAN_COLUMNS.map((column) => {
          const Icon = column.icon;
          const items = getColumnItems(column.id);

          return (
            <Card key={column.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', column.color)} />
                    <span>{column.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-2 pt-0">
                <ScrollArea className="h-full">
                  <SortableContext
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      id={column.id}
                      className="space-y-2 min-h-[100px] p-1"
                    >
                      {items.map((renegotiation) => (
                        <RenegotiationCard
                          key={renegotiation.id}
                          renegotiation={renegotiation}
                          onUpdateFinalPrice={handleUpdateFinalPrice}
                          onOpenDetail={setSelectedRenegotiation}
                          isDragging={activeId === renegotiation.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DragOverlay>
        {activeRenegotiation && (
          <RenegotiationCard
            renegotiation={activeRenegotiation}
            onUpdateFinalPrice={() => {}}
            onOpenDetail={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>

      <RenegotiationTaskDetail
        renegotiation={selectedRenegotiation}
        open={!!selectedRenegotiation}
        onOpenChange={(open) => !open && setSelectedRenegotiation(null)}
      />
    </>
  );
};

export default RenegotiationKanban;
