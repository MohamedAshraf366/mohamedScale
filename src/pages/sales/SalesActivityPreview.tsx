import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { Building2, FolderKanban, Target, Plus, Pencil, MessageSquare, AlertTriangle } from "lucide-react";

/**
 * Hidden QA preview page (NOT linked from the nav).
 * Renders every variant of GlobalActivitySheet for visual + functional QA.
 *
 * Route: /sales/_preview
 */
export default function SalesActivityPreview() {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<GlobalActivityContext | undefined>();

  // Pick a real customer / project / opportunity from the DB so that
  // edit/update flows render with realistic prefills.
  const { data: sample, isLoading } = useQuery({
    queryKey: ["sales-preview-sample"],
    queryFn: async () => {
      const [{ data: cust }, { data: proj }, { data: opp }] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, display_name, code, customers!inner(account_id)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("id, name, code, customer_account_id, accounts!projects_customer_account_id_fkey(display_name, code)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("opportunities")
          .select("id, title, code, customer_account_id, project_id, accounts!opportunities_customer_account_id_fkey(display_name, code), projects!opportunities_project_id_fkey(name, code)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { cust, proj, opp };
    },
  });

  const presets = useMemo(() => {
    const c = sample?.cust as any;
    const p = sample?.proj as any;
    const o = sample?.opp as any;

    return [
      // CREATE
      { group: "Create", label: "Add Customer", icon: Building2,
        ctx: { action: "create", entityType: "customer" } as GlobalActivityContext },
      { group: "Create", label: "Add Project (under customer)", icon: FolderKanban, requires: c,
        ctx: c && {
          action: "create", entityType: "project",
          customerId: c.id, customerName: c.display_name, customerCode: c.code,
        } as GlobalActivityContext },
      { group: "Create", label: "Add Opportunity (under project)", icon: Target, requires: p,
        ctx: p && {
          action: "create", entityType: "opportunity",
          customerId: p.customer_account_id,
          customerName: p.accounts?.display_name, customerCode: p.accounts?.code,
          projectId: p.id, projectName: p.name, projectCode: p.code,
        } as GlobalActivityContext },

      // EDIT
      { group: "Edit", label: "Edit Customer", icon: Pencil, requires: c,
        ctx: c && {
          action: "edit", entityType: "customer",
          customerId: c.id, customerName: c.display_name, customerCode: c.code,
        } as GlobalActivityContext },
      { group: "Edit", label: "Edit Project", icon: Pencil, requires: p,
        ctx: p && {
          action: "edit", entityType: "project",
          customerId: p.customer_account_id,
          customerName: p.accounts?.display_name, customerCode: p.accounts?.code,
          projectId: p.id, projectName: p.name, projectCode: p.code,
        } as GlobalActivityContext },
      { group: "Edit", label: "Edit Opportunity", icon: Pencil, requires: o,
        ctx: o && {
          action: "edit", entityType: "opportunity",
          customerId: o.customer_account_id,
          customerName: o.accounts?.display_name, customerCode: o.accounts?.code,
          projectId: o.project_id, projectName: o.projects?.name, projectCode: o.projects?.code,
          opportunityId: o.id, opportunityName: o.title, opportunityCode: o.code,
        } as GlobalActivityContext },

      // UPDATE (Add Update)
      { group: "Add Update", label: "Update on Customer", icon: MessageSquare, requires: c,
        ctx: c && {
          action: "update", entityType: "customer",
          customerId: c.id, customerName: c.display_name, customerCode: c.code,
        } as GlobalActivityContext },
      { group: "Add Update", label: "Update on Project", icon: MessageSquare, requires: p,
        ctx: p && {
          action: "update", entityType: "project",
          customerId: p.customer_account_id,
          customerName: p.accounts?.display_name, customerCode: p.accounts?.code,
          projectId: p.id, projectName: p.name, projectCode: p.code,
        } as GlobalActivityContext },
      { group: "Add Update", label: "Update on Opportunity", icon: MessageSquare, requires: o,
        ctx: o && {
          action: "update", entityType: "opportunity",
          customerId: o.customer_account_id,
          customerName: o.accounts?.display_name, customerCode: o.accounts?.code,
          projectId: o.project_id, projectName: o.projects?.name, projectCode: o.projects?.code,
          opportunityId: o.id, opportunityName: o.title, opportunityCode: o.code,
        } as GlobalActivityContext },
      { group: "Add Update", label: 'Update on Opportunity → "Not Interested"', icon: AlertTriangle, requires: o,
        ctx: o && {
          action: "update", entityType: "opportunity",
          customerId: o.customer_account_id,
          customerName: o.accounts?.display_name, customerCode: o.accounts?.code,
          projectId: o.project_id, projectName: o.projects?.name, projectCode: o.projects?.code,
          opportunityId: o.id, opportunityName: o.title, opportunityCode: o.code,
          opportunityPrefill: { interestLevel: "Not interested" },
        } as GlobalActivityContext },

      // ENTRY POINTS WITHOUT CONTEXT (the "global" plus button)
      { group: "Bare", label: "Open with no context", icon: Plus,
        ctx: undefined as unknown as GlobalActivityContext },
    ];
  }, [sample]);

  const groups = ["Create", "Edit", "Add Update", "Bare"] as const;

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <div>
          <Badge variant="outline" className="mb-2">Internal QA · not in nav</Badge>
          <h1 className="text-2xl font-semibold">Global Activity Sheet — All Variants</h1>
          <p className="text-sm text-muted-foreground">
            Renders every entry point of <code>GlobalActivitySheet</code> against real DB rows so you can
            visually QA Add Customer / Add Project / Add Opportunity / Add Update / Edit flows.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample data picked from DB</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 font-mono">
                <div>Customer: {(sample?.cust as any)?.display_name ?? "—"} ({(sample?.cust as any)?.code ?? "no code"})</div>
                <div>Project: {(sample?.proj as any)?.name ?? "—"} ({(sample?.proj as any)?.code ?? "no code"})</div>
                <div>Opportunity: {(sample?.opp as any)?.title ?? "—"} ({(sample?.opp as any)?.code ?? "no code"})</div>
              </CardContent>
            </Card>

            {groups.map(group => (
              <Card key={group}>
                <CardHeader>
                  <CardTitle className="text-sm">{group}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {presets.filter(p => p.group === group).map((p) => {
                    const Icon = p.icon;
                    const disabled = "requires" in p && !p.requires;
                    return (
                      <Button
                        key={p.label}
                        variant="outline"
                        className="justify-start h-auto py-3"
                        disabled={disabled}
                        onClick={() => { setCtx(p.ctx); setOpen(true); }}
                      >
                        <Icon className="h-4 w-4 mr-2 text-primary" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm">{p.label}</span>
                          {disabled && (
                            <span className="text-xs text-muted-foreground">No matching row in DB</span>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </>
        )}

        <GlobalActivitySheet open={open} onOpenChange={setOpen} context={ctx} />
      </div>
    </AppLayout>
  );
}
