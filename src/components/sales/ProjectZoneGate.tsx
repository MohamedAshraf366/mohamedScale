import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProjectZoneGateProps {
  /** Resolved zone code from the project's location, or null/undefined when missing/unresolved. */
  zoneCode: string | null | undefined;
  /** Optional callback when the user clicks the CTA (e.g. open the project sheet). */
  onFixProject?: () => void;
  /** Visual context for the message (e.g. "quotation" vs "order"). */
  context?: "quotation" | "order" | "pricing";
}

/**
 * Hard gate banner shown above the quote builder / pricing UI whenever the
 * project has no resolved delivery zone. Pricing, totals, and send actions
 * MUST be disabled while this banner is visible.
 *
 * This is the visible side of the rule enforced server-side by
 * `resolve_line_pricing` (returns reason='zone_missing').
 */
export function ProjectZoneGate({ zoneCode, onFixProject, context = "quotation" }: ProjectZoneGateProps) {
  if (zoneCode) return null;

  const noun =
    context === "order" ? "this order" : context === "pricing" ? "pricing" : "this quotation";

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        Project location required
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          This project has no delivery zone attached. Prices and delivery cannot be calculated for{" "}
          {noun} until you add a location with a detected zone to the project.
        </p>
        {onFixProject && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background"
            onClick={onFixProject}
          >
            Open project to add a location
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook-style helper: returns the lock state in one shot so callers can disable buttons,
 * hide totals, and short-circuit save/send actions consistently.
 *
 * Two call shapes supported:
 *   useZoneGate(zoneCode)             — pass an already-resolved zone string/null
 *   useZoneGate({ projectId })        — fetches `projects.location.zone_code` internally
 */
export function useZoneGate(input: string | null | undefined | { projectId: string | null | undefined }) {
  const projectId = input && typeof input === "object" ? input.projectId : undefined;
  const directZoneCode = projectId === undefined ? (input as string | null | undefined) : undefined;

  const { data: fetchedZoneCode } = useQuery({
    queryKey: ["zone-gate-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("location:locations(zone_code)")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return ((data?.location as any)?.zone_code as string | null) ?? null;
    },
    enabled: !!projectId,
  });

  const zoneCode = projectId ? (fetchedZoneCode ?? null) : directZoneCode;
  const blocked = !zoneCode;
  return {
    zoneCode: zoneCode ?? null,
    blocked,
    reason: blocked ? ("zone_missing" as const) : null,
    /** Standard tooltip / disabled-reason copy for buttons. */
    blockedReason: blocked
      ? "Add a location with a detected zone to the project before pricing or sending this quotation."
      : null,
  };
}

