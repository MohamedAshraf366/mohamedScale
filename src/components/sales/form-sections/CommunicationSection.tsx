import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, MessageCircle, Phone, Users, Mail, Calendar as CalendarIcon2, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "call", label: "Phone call", icon: Phone },
  { value: "in_person", label: "In person", icon: Users },
  { value: "site_visit", label: "Site visit", icon: Users },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: CalendarIcon2 },
  { value: "sms", label: "SMS", icon: MoreHorizontal },
] as const;

export const SENTIMENTS = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
] as const;

interface CommunicationData {
  channel: string;
  summary: string;
  sentiment: string;
  occurredAt: Date | null;
}

interface CommunicationSectionProps {
  data: CommunicationData;
  onChange: (data: CommunicationData) => void;
  showTimePicker?: boolean;
}

export function CommunicationSection({ data, onChange, showTimePicker = true }: CommunicationSectionProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Communication</h3>
      </div>

      {/* Channel */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Channel *</Label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const isSelected = data.channel === ch.value;
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => onChange({ ...data, channel: ch.value })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-colors text-xs",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <Label htmlFor="comm-summary" className="text-xs text-muted-foreground">Summary *</Label>
        <Textarea
          id="comm-summary"
          placeholder="What happened in this interaction?"
          value={data.summary}
          onChange={(e) => onChange({ ...data, summary: e.target.value })}
          rows={3}
        />
      </div>

      {/* Time of conversation (optional) */}
      {showTimePicker && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Time of conversation</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start",
                  data.occurredAt && "border-primary bg-primary/5"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {data.occurredAt
                  ? format(data.occurredAt, "PPp")
                  : "Now"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data.occurredAt || undefined}
                onSelect={(date) => onChange({ ...data, occurredAt: date || null })}
                disabled={{ after: new Date() }}
                initialFocus
              />
              <div className="p-3 border-t">
                <Input
                  type="time"
                  value={data.occurredAt ? format(data.occurredAt, "HH:mm") : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [hours, minutes] = e.target.value.split(":").map(Number);
                      const newDate = data.occurredAt ? new Date(data.occurredAt) : new Date();
                      newDate.setHours(hours, minutes);
                      onChange({ ...data, occurredAt: newDate });
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
