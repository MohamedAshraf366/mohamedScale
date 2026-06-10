import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const INTEREST_LEVELS = [
  { value: "Not interested", label: "Not interested", color: "bg-red-100 text-red-700 hover:bg-red-200 border-red-300" },
  { value: "Low", label: "Low", color: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300" },
  { value: "Medium", label: "Medium", color: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300" },
  { value: "High", label: "High", color: "bg-green-100 text-green-700 hover:bg-green-200 border-green-300" },
] as const;

interface InterestLevelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function InterestLevelSelector({ 
  value, 
  onChange,
  label = "Interest Level"
}: InterestLevelSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        {INTEREST_LEVELS.map((level) => (
          <Badge
            key={level.value}
            variant="outline"
            className={cn(
              "cursor-pointer transition-all px-3 py-1",
              value === level.value
                ? level.color + " ring-2 ring-offset-1 ring-primary/30"
                : "bg-background hover:bg-muted"
            )}
            onClick={() => onChange(level.value)}
          >
            {level.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
