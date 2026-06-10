import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Plus, Zap, User, MapPin } from "lucide-react";
import { MapLocationPicker, type LocationResult } from "@/components/customers/MapLocationPicker";

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Infrastructure", "Mixed-Use", "Other"];
const PROJECT_SIZES = ["Very Small (< 100 m²)", "Small (100-1,000 m²)", "Medium (1,000-10,000 m²)", "Large (10,000-100,000 m²)", "Huge (+100,000 m²)"];
const PROJECT_PHASES = ["Site Preparation & Fencing", "Foundation Works / Substructure", "Skeleton Works / Superstructure", "Masonry & MEP Works", "Finishing Works", "Paused", "Completed"];

export interface ProjectData {
  mode: "chip" | "select" | "create" | "default" | "edit";
  selectedId: string;
  selectedName: string;
  selectedCode: string;
  name: string;
  projectType: string;
  currentPhase: string;
  projectSize?: string;
  notes?: string;
  pocId?: string | null;
  location?: LocationResult | null;
}

interface ProjectSectionProps {
  data: ProjectData;
  onChange: (data: ProjectData) => void;
  customerAccountId: string;
}

export function ProjectSection({ data, onChange, customerAccountId }: ProjectSectionProps) {
  const [showLocation, setShowLocation] = useState(true);

  const { data: projects } = useQuery({
    queryKey: ["projects-for-global", customerAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, code, current_phase, project_type")
        .eq("customer_account_id", customerAccountId)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!customerAccountId && (data.mode === "select"),
  });

  // Fetch full project for edit mode
  const { data: fullProject } = useQuery({
    queryKey: ["project-edit-global", data.selectedId],
    queryFn: async () => {
      const { data: proj, error } = await supabase
        .from("projects")
        .select(`*, location:locations(*), poc_contact:contacts!projects_poc_fkey(id, full_name, phone)`)
        .eq("id", data.selectedId)
        .single();
      if (error) throw error;
      return proj;
    },
    enabled: data.mode === "edit" && !!data.selectedId,
  });

  // Fetch customer contacts for POC
  const { data: customerContacts } = useQuery({
    queryKey: ["contacts-for-poc", customerAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts").select("id, full_name, phone, is_primary").eq("account_id", customerAccountId);
      if (error) throw error;
      return data;
    },
    enabled: data.mode === "edit" && !!customerAccountId,
  });

  // Track which selectedId we've already populated
  const populatedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (data.mode !== "edit") populatedIdRef.current = null;
  }, [data.mode]);

  // Populate edit fields
  useEffect(() => {
    if (data.mode === "edit" && fullProject && data.selectedId && populatedIdRef.current !== data.selectedId) {
      populatedIdRef.current = data.selectedId;
      const loc = (fullProject as any)?.location;
      onChange({
        ...data,
        name: fullProject.name || "",
        projectType: fullProject.project_type || "",
        currentPhase: fullProject.current_phase || "",
        projectSize: fullProject.project_size || "",
        notes: fullProject.notes || "",
        pocId: fullProject.poc || null,
        location: loc ? {
          address_text: loc.address_text || "", city: loc.city || "", country: loc.country || "SA",
          place_name: loc.place_name || "", place_id: loc.place_id || "",
          lat: Number(loc.lat) || 0, lng: Number(loc.lng) || 0,
          address_link: loc.address_link || "",
          region_code: (loc.region_code as string) || 'RYD',
          zone_code: (loc.zone_code as string) || null,
          zone_name: null,
        } : null,
      });
      if (loc) setShowLocation(true);
    }
  }, [fullProject, data.mode, data.selectedId]);

  const handleSelectProject = (projectId: string) => {
    const proj = projects?.find(p => p.id === projectId);
    onChange({ ...data, mode: "select", selectedId: projectId, selectedName: proj?.name || "", selectedCode: proj?.code || "" });
  };

  if (data.mode === "chip") return null;

  if (!customerAccountId && data.mode === "select") {
    return <div className="p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">Select a customer first</div>;
  }

  const isEdit = data.mode === "edit";
  const isCreate = data.mode === "create";
  const isDefault = data.mode === "default";
  const isSelect = data.mode === "select";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">{isEdit ? "Edit Project" : "Project"}</h3>
        </div>
        {!isEdit && (
          <div className="flex gap-1">
            {!isCreate && <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => onChange({ ...data, mode: "create" })}><Plus className="h-3 w-3 mr-1" /> New</Button>}
            {!isSelect && <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => onChange({ ...data, mode: "select" })}>Select</Button>}
          </div>
        )}
      </div>

      {isSelect && (
        <div className="space-y-2">
          <Select value={data.selectedId} onValueChange={handleSelectProject}>
            <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
            <SelectContent>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span>{p.name}</span>
                  {p.code && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.code}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => onChange({ ...data, mode: "default", name: "General", projectType: "", currentPhase: "" })}>
            <Zap className="h-3 w-3 mr-1" /> Create Default Project (000)
          </Button>
        </div>
      )}

      {isDefault && (
        <div className="p-3 rounded-lg border bg-primary/5 text-sm">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><span className="font-medium">Default Project</span></div>
          <p className="text-xs text-muted-foreground mt-1">Will create a "General" project with code suffix _000</p>
        </div>
      )}

      {(isCreate || isEdit) && (
        <div className="space-y-3 p-3 rounded-lg border bg-background/50">
          <div className="space-y-2">
            <Label className="text-xs">Project Name *</Label>
            <Input placeholder="e.g., Villa Phase 1" value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select value={data.projectType} onValueChange={v => onChange({ ...data, projectType: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label className="text-xs">Size</Label>
                <Select value={data.projectSize || ""} onValueChange={v => onChange({ ...data, projectSize: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{PROJECT_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Phase</Label>
              <Select value={data.currentPhase} onValueChange={v => onChange({ ...data, currentPhase: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{PROJECT_PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && customerContacts && customerContacts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Point of Contact</Label>
              <Select value={data.pocId || "none"} onValueChange={v => onChange({ ...data, pocId: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Use customer primary" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use customer's primary</SelectItem>
                  {customerContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} {c.is_primary && "(Primary)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {isEdit && (
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={data.notes || ""} onChange={e => onChange({ ...data, notes: e.target.value })} />
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            {!data.location && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Project location is required for delivery zone detection.</span>
              </div>
            )}
            <MapLocationPicker
              initialLat={data.location?.lat}
              initialLng={data.location?.lng}
              onLocationSelect={loc => onChange({ ...data, location: loc })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
