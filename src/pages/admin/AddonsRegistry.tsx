import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { resolveUom, uomSourceLabel } from "@/lib/resolve-inherited";
import type { AddonDefinition } from "@/hooks/useAddonDefinitions";

interface FormState {
  id?: string;
  name: string;
  name_ar: string;
  default_uom: string;
  default_price: string;
  scope: "global" | "subcategory" | "material";
  subcategory_id: string;
  material_id: string;
  notes: string;
  status: "active" | "inactive";
}

const emptyForm: FormState = {
  name: "",
  name_ar: "",
  default_uom: "unit",
  default_price: "",
  scope: "global",
  subcategory_id: "",
  material_id: "",
  notes: "",
  status: "active",
};

export default function AddonsRegistry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);

  const { data: defs = [], isLoading } = useQuery({
    queryKey: ["addon_definitions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_definitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AddonDefinition[];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["addon-registry", "subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_subcategories")
        .select("id, name_en, default_uom, category_id")
        .eq("status", "active")
        .order("name_en");
      if (error) throw error;
      return (data ?? []) as { id: string; name_en: string; default_uom: string | null; category_id: string }[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["addon-registry", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_categories")
        .select("id, default_uom");
      if (error) throw error;
      return (data ?? []) as { id: string; default_uom: string | null }[];
    },
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["addon-registry", "materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, uom, subcategory_id")
        .eq("status", "active")
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; uom: string | null; subcategory_id: string | null }[];
    },
  });

  // Resolve UoM from parent for scoped add-ons (display & save)
  const resolveScopedUom = (form: FormState): string => {
    if (form.scope === "global") return form.default_uom.trim() || "unit";
    if (form.scope === "subcategory") {
      const sub = subcategories.find((x) => x.id === form.subcategory_id);
      const cat = sub ? categories.find((c) => c.id === sub.category_id) : null;
      return resolveUom(null, sub ?? null, cat ?? null).uom;
    }
    if (form.scope === "material") {
      const mat = materials.find((x) => x.id === form.material_id);
      const sub = mat ? subcategories.find((s) => s.id === mat.subcategory_id) : null;
      const cat = sub ? categories.find((c) => c.id === sub.category_id) : null;
      return resolveUom(mat ?? null, sub ?? null, cat ?? null).uom;
    }
    return "unit";
  };

  const upsert = useMutation({
    mutationFn: async (form: FormState) => {
      const payload = {
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        default_uom: resolveScopedUom(form),
        default_price: form.default_price === "" ? null : Number(form.default_price),
        default_margin_pct: null,
        scope: form.scope,
        subcategory_id: form.scope === "subcategory" ? form.subcategory_id || null : null,
        material_id: form.scope === "material" ? form.material_id || null : null,
        notes: form.notes.trim() || null,
        status: form.status,
        updated_by: user?.id ?? null,
      };
      if (form.id) {
        const { error } = await supabase.from("addon_definitions").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("addon_definitions")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addon_definitions"] });
      toast.success(editing?.id ? "Add-on updated" : "Add-on created");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addon_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addon_definitions"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return defs;
    const s = search.trim().toLowerCase();
    return defs.filter(
      (d) => d.name.toLowerCase().includes(s) || (d.name_ar ?? "").toLowerCase().includes(s),
    );
  }, [defs, search]);

  const subcategoryName = (id: string | null) =>
    subcategories.find((s) => s.id === id)?.name_en ?? "—";
  const materialName = (id: string | null) =>
    materials.find((m) => m.id === id)?.name ?? "—";

  const inheritedUom = (() => {
    if (!editing || editing.scope === "global") return null;
    if (editing.scope === "subcategory") {
      const sub = subcategories.find((s) => s.id === editing.subcategory_id);
      const cat = sub ? categories.find((c) => c.id === sub.category_id) : null;
      return resolveUom(null, sub ?? null, cat ?? null);
    }
    const mat = materials.find((m) => m.id === editing.material_id);
    const sub = mat ? subcategories.find((s) => s.id === mat.subcategory_id) : null;
    const cat = sub ? categories.find((c) => c.id === sub.category_id) : null;
    return resolveUom(mat ?? null, sub ?? null, cat ?? null);
  })();

  return (
    <ProtectedRoute>
      <AppLayout title="Add-ons Registry">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground hover:text-foreground">
                <Link to="/materials">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Back to Materials
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Add-ons Registry
              </h1>
              <p className="text-sm text-muted-foreground">
                Reusable commercial add-ons surfaced in the quotation builder.
              </p>
            </div>
            <Button onClick={() => setEditing({ ...emptyForm })}>
              <Plus className="h-4 w-4 mr-2" />
              New Add-on
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">Definitions</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No add-on definitions yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Bound to</TableHead>
                      <TableHead className="text-center">UoM</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{d.name}</div>
                          {d.name_ar && (
                            <div className="text-xs text-muted-foreground" dir="rtl">{d.name_ar}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{d.scope}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.scope === "subcategory" ? subcategoryName(d.subcategory_id)
                            : d.scope === "material" ? materialName(d.material_id)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center text-xs">{d.default_uom}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {d.default_price != null ? Number(d.default_price).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.status === "active" ? "default" : "secondary"} className="text-[10px]">
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditing({
                              id: d.id,
                              name: d.name,
                              name_ar: d.name_ar ?? "",
                              default_uom: d.default_uom,
                              default_price: d.default_price?.toString() ?? "",
                              scope: d.scope,
                              subcategory_id: d.subcategory_id ?? "",
                              material_id: d.material_id ?? "",
                              notes: d.notes ?? "",
                              status: (d.status as "active" | "inactive") ?? "active",
                            })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (confirm(`Delete "${d.name}"?`)) remove.mutate(d.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit Add-on" : "New Add-on"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name (EN)</Label>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name (AR)</Label>
                    <Input
                      dir="rtl"
                      value={editing.name_ar}
                      onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Scope</Label>
                  <Select
                    value={editing.scope}
                    onValueChange={(v) => setEditing({ ...editing, scope: v as FormState["scope"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (any quotation)</SelectItem>
                      <SelectItem value="subcategory">Subcategory</SelectItem>
                      <SelectItem value="material">Specific material</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.scope === "subcategory" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subcategory</Label>
                    <Select
                      value={editing.subcategory_id}
                      onValueChange={(v) => setEditing({ ...editing, subcategory_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select subcategory…" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name_en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editing.scope === "material" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Material</Label>
                    <Select
                      value={editing.material_id}
                      onValueChange={(v) => setEditing({ ...editing, material_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select material…" /></SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">UoM</Label>
                    {editing.scope === "global" ? (
                      <Input
                        value={editing.default_uom}
                        onChange={(e) => setEditing({ ...editing, default_uom: e.target.value })}
                      />
                    ) : (
                      <div className="h-9 px-3 flex items-center rounded-md border bg-muted/40 text-sm">
                        <span className="font-medium">{inheritedUom?.uom ?? "—"}</span>
                        {inheritedUom && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            ({uomSourceLabel(inheritedUom.source)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Default Price (per UoM)</Label>
                    <Input
                      type="number"
                      value={editing.default_price}
                      onChange={(e) => setEditing({ ...editing, default_price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={2}
                    value={editing.notes}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v) => setEditing({ ...editing, status: v as "active" | "inactive" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Margins are managed centrally in Admin → Margins. They are not set per add-on here.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                disabled={!editing?.name?.trim() || upsert.isPending}
                onClick={() => editing && upsert.mutate(editing)}
              >
                {editing?.id ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}
