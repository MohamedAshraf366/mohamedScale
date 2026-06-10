import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageCircle, Phone, Users, Mail, Calendar as CalendarIcon2,
  MoreHorizontal, StickyNote, CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type ContextType = "communication" | "internal_note";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "call", label: "Phone call", icon: Phone },
  { value: "in_person", label: "In person", icon: Users },
  { value: "site_visit", label: "Site visit", icon: Users },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: CalendarIcon2 },
  { value: "sms", label: "SMS", icon: MoreHorizontal },
] as const;

export interface ContextData {
  contextType: ContextType;
  channel: string;
  summary: string;
  occurredAt: Date | null;
}

interface ContextSectionProps {
  data: ContextData;
  onChange: (data: ContextData) => void;
}

export function ContextSection({ data, onChange }: ContextSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Context</h3>
        <span className="text-xs text-destructive">*</span>
      </div>

      {/* Context type selector */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...data, contextType: "communication", channel: data.channel || "whatsapp" })}
          className={cn(
            "text-xs flex-1",
            data.contextType === "communication" && "border-primary bg-primary/10 text-primary"
          )}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Communication
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...data, contextType: "internal_note", channel: "internal" })}
          className={cn(
            "text-xs flex-1",
            data.contextType === "internal_note" && "border-primary bg-primary/10 text-primary"
          )}
        >
          <StickyNote className="h-3 w-3 mr-1" />
          Internal Note
        </Button>
      </div>

      {/* Channel selector (communication only) */}
      {data.contextType === "communication" && (
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
      )}

      {/* Summary / Note */}
      <div className="space-y-2">
        <Label htmlFor="context-summary" className="text-xs text-muted-foreground">
          {data.contextType === "communication" ? "Summary *" : "Note *"}
        </Label>

        {/* Quick-fill chips for internal notes */}
        {data.contextType === "internal_note" && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              "Status update",
              "Edit mistake correction",
              "Data cleanup",
              "Management note",
              "Price adjustment",
              "Info update",
            ].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs h-6 px-2",
                  data.summary === preset && "border-primary bg-primary/10 text-primary"
                )}
                onClick={() => onChange({ ...data, summary: preset })}
              >
                {preset}
              </Button>
            ))}
          </div>
        )}

        <Textarea
          id="context-summary"
          placeholder={
            data.contextType === "communication"
              ? "What happened in this interaction?"
              : "Internal observation, status update, or decision..."
          }
          value={data.summary}
          onChange={(e) => onChange({ ...data, summary: e.target.value })}
          rows={3}
        />
      </div>

      {/* Time picker (communication only) */}
      {data.contextType === "communication" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Time</Label>
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
                {data.occurredAt ? format(data.occurredAt, "PPp") : "Now"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data.occurredAt || undefined}
                onSelect={(date) => onChange({ ...data, occurredAt: date || null })}
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
