import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, ListTodo } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

export const NEXT_ACTIONS = [
  { value: "ask_quantities", label: "Ask about quantities" },
  { value: "follow_up_quantities", label: "Follow up on quantities" },
  { value: "send_price_list", label: "Send price list" },
  { value: "send_quote", label: "Send quote" },
  { value: "confirm_quote", label: "Get quote approval" },
  { value: "send_revised_quote", label: "Send revised quote" },
  { value: "follow_up", label: "Follow up" },
  { value: "schedule_meeting", label: "Schedule meeting" },
  { value: "custom", label: "Custom" },
] as const;

const QUICK_DATES = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

interface NextActionData {
  action: string;
  customAction: string;
  dueDate: Date | null;
}

interface NextActionSectionProps {
  data: NextActionData;
  onChange: (data: NextActionData) => void;
}

export function NextActionSection({ data, onChange }: NextActionSectionProps) {
  const isCustom = data.action === "custom";

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Next Action</h3>
      </div>

      {/* Action type */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">What's the next step?</Label>
        <div className="flex flex-wrap gap-2">
          {NEXT_ACTIONS.map((action) => {
            const isSelected = data.action === action.value;
            return (
              <Button
                key={action.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...data, action: action.value, customAction: "" })}
                className={cn(
                  "text-xs",
                  isSelected && "border-primary bg-primary/10 text-primary"
                )}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Custom action input */}
      {isCustom && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Custom action</Label>
          <Input
            placeholder="Describe the next action..."
            value={data.customAction}
            onChange={(e) => onChange({ ...data, customAction: e.target.value })}
          />
        </div>
      )}

      {/* Due date */}
      {data.action && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">When?</Label>
          <div className="flex gap-2 flex-wrap">
            {QUICK_DATES.map((q) => {
              const targetDate = addDays(new Date(), q.days);
              const isSelected =
                data.dueDate &&
                format(data.dueDate, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
              return (
                <Button
                  key={q.days}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...data, dueDate: targetDate })}
                  className={cn(
                    "text-xs",
                    isSelected && "border-primary bg-primary/10"
                  )}
                >
                  {q.label}
                </Button>
              );
            })}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "text-xs",
                    data.dueDate &&
                      !QUICK_DATES.some(
                        (q) =>
                          format(data.dueDate!, "yyyy-MM-dd") ===
                          format(addDays(new Date(), q.days), "yyyy-MM-dd")
                      ) &&
                      "border-primary bg-primary/10"
                  )}
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {data.dueDate && !QUICK_DATES.some(
                    (q) =>
                      format(data.dueDate!, "yyyy-MM-dd") ===
                      format(addDays(new Date(), q.days), "yyyy-MM-dd")
                  )
                    ? format(data.dueDate, "MMM d")
                    : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data.dueDate || undefined}
                  onSelect={(date) => onChange({ ...data, dueDate: date || null })}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {data.dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => onChange({ ...data, dueDate: null })}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
