import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ListTodo, Plus, X } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

export const TASK_TYPES = [
  { value: "follow_up", label: "Follow up" },
  { value: "ask_quantities", label: "Ask quantities" },
  { value: "send_quote", label: "Send quote" },
  { value: "send_price_list", label: "Send price list" },
  { value: "complete_onboarding", label: "Complete onboarding" },
  { value: "site_visit", label: "Site visit" },
  { value: "send_documents", label: "Send documents" },
  { value: "internal_review", label: "Internal review" },
  { value: "schedule_meeting", label: "Schedule meeting" },
  { value: "custom", label: "Custom" },
] as const;

const QUICK_DATES = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

export interface ActionItem {
  id: string;
  taskType: string;
  customTitle: string;
  dueDate: Date | null;
}

interface NextActionsSectionProps {
  actions: ActionItem[];
  onChange: (actions: ActionItem[]) => void;
}

let nextId = 1;
export function createEmptyAction(): ActionItem {
  return {
    id: `action-${nextId++}`,
    taskType: "follow_up",
    customTitle: "",
    dueDate: addDays(new Date(), 1),
  };
}

export function NextActionsSection({ actions, onChange }: NextActionsSectionProps) {
  const updateAction = (id: string, updates: Partial<ActionItem>) => {
    onChange(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAction = (id: string) => {
    if (actions.length <= 1) return;
    onChange(actions.filter(a => a.id !== id));
  };

  const addAction = () => {
    onChange([...actions, createEmptyAction()]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Next Actions</h3>
          <span className="text-xs text-destructive">*</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={addAction}>
          <Plus className="h-3 w-3 mr-1" /> Add another
        </Button>
      </div>

      {actions.map((action, idx) => (
        <div key={action.id} className="space-y-3 p-3 rounded-lg border bg-muted/30 relative">
          {actions.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={() => removeAction(action.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {/* Task type chips */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">What's next?</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateAction(action.id, { taskType: t.value, customTitle: "" })}
                  className={cn(
                    "text-xs h-7 px-2",
                    action.taskType === t.value && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom title */}
          {action.taskType === "custom" && (
            <div className="space-y-1">
              <Input
                placeholder="Describe the action..."
                value={action.customTitle}
                onChange={(e) => updateAction(action.id, { customTitle: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Due date */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">When?</Label>
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_DATES.map((q) => {
                const targetDate = addDays(new Date(), q.days);
                const isSelected = action.dueDate &&
                  format(action.dueDate, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
                return (
                  <Button
                    key={q.days}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateAction(action.id, { dueDate: targetDate })}
                    className={cn("text-xs h-7 px-2", isSelected && "border-primary bg-primary/10")}
                  >
                    {q.label}
                  </Button>
                );
              })}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {action.dueDate && !QUICK_DATES.some(q =>
                      format(action.dueDate!, "yyyy-MM-dd") === format(addDays(new Date(), q.days), "yyyy-MM-dd")
                    )
                      ? format(action.dueDate, "MMM d")
                      : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={action.dueDate || undefined}
                    onSelect={(date) => updateAction(action.id, { dueDate: date || null })}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
