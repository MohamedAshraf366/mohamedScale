import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MigrationTrigger = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [fixStatus, setFixStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fixReport, setFixReport] = useState<any>(null);
  const [fixError, setFixError] = useState<string>("");
  const [linkStatus, setLinkStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [linkReport, setLinkReport] = useState<any>(null);
  const [linkError, setLinkError] = useState<string>("");
  const [rescueStatus, setRescueStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [rescueReport, setRescueReport] = useState<any>(null);
  const [rescueError, setRescueError] = useState<string>("");

  const rescueOrphans = async () => {
    setRescueStatus("loading");
    setRescueError("");
    setRescueReport(null);
    try {
      const base = window.location.origin;
      const [comms, tasks] = await Promise.all([
        fetch(`${base}/migration/communications.csv`).then((r) => r.text()),
        fetch(`${base}/migration/tasks.csv`).then((r) => r.text()),
      ]);
      const { data, error: fnError } = await supabase.functions.invoke("rescue-orphan-followups", {
        body: { communications_csv: comms, tasks_csv: tasks },
      });
      if (fnError) throw new Error(fnError.message);
      setRescueReport(data);
      setRescueStatus("success");
    } catch (err: any) {
      setRescueError(err.message || "Unknown error");
      setRescueStatus("error");
    }
  };

  const runMigration = async () => {
    setStatus("loading");
    setError("");
    setReport(null);

    try {
      const base = window.location.origin;
      const [opps, comms, tasks, qi, mats] = await Promise.all([
        fetch(`${base}/migration/opportunities.csv`).then((r) => r.text()),
        fetch(`${base}/migration/communications.csv`).then((r) => r.text()),
        fetch(`${base}/migration/tasks.csv`).then((r) => r.text()),
        fetch(`${base}/migration/quotation_items.csv`).then((r) => r.text()),
        fetch(`${base}/migration/materials.csv`).then((r) => r.text()),
      ]);

      const { data, error: fnError } = await supabase.functions.invoke("migrate-legacy-data", {
        body: {
          opportunities_csv: opps,
          communications_csv: comms,
          tasks_csv: tasks,
          quotation_items_csv: qi,
          materials_csv: mats,
        },
      });

      if (fnError) throw new Error(fnError.message);
      setReport(data);
      setStatus("success");
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setStatus("error");
    }
  };

  const backfillTaskLinks = async () => {
    setLinkStatus("loading");
    setLinkError("");
    setLinkReport(null);
    try {
      const base = window.location.origin;
      const [tasks, clients, profiles] = await Promise.all([
        fetch(`${base}/migration/tasks.csv`).then((r) => r.text()),
        fetch(`${base}/migration/clients.csv`).then((r) => r.text()),
        fetch(`${base}/migration/profiles.csv`).then((r) => r.text()),
      ]);
      const { data, error: fnError } = await supabase.functions.invoke("backfill-legacy-task-links", {
        body: { tasks_csv: tasks, clients_csv: clients, profiles_csv: profiles },
      });
      if (fnError) throw new Error(fnError.message);
      setLinkReport(data);
      setLinkStatus("success");
    } catch (err: any) {
      setLinkError(err.message || "Unknown error");
      setLinkStatus("error");
    }
  };

  const fixMaterialsInterest = async () => {
    setFixStatus("loading");
    setFixError("");
    setFixReport(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("migrate-legacy-data", {
        body: { action: "fix_materials_interest" },
      });

      if (fnError) throw new Error(fnError.message);
      setFixReport(data);
      setFixStatus("success");
    } catch (err: any) {
      setFixError(err.message || "Unknown error");
      setFixStatus("error");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Legacy Data Migration</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run Full Migration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will migrate 200 opportunities, 175 communications, 292 tasks, and 40 quotation items from the legacy CSVs into the new schema.
            </p>

            <Button onClick={runMigration} disabled={status === "loading"} className="gap-2">
              {status === "loading" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Run Migration
                </>
              )}
            </Button>

            {status === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {report && (
              <div className="space-y-3 mt-4">
                <Alert className="border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">Migration complete!</AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Opportunities inserted", report.opportunities_inserted],
                    ["Opportunities skipped", report.opportunities_skipped],
                    ["Communications inserted", report.communications_inserted],
                    ["Synthetic comms created", report.synthetic_comms_created],
                    ["Tasks inserted", report.tasks_inserted],
                    ["Tasks skipped", report.tasks_skipped],
                    ["Materials interest updated", report.materials_interest_updated],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                      <span>{label}</span>
                      <Badge variant="outline">{val}</Badge>
                    </div>
                  ))}
                </div>

                {report.errors?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-destructive mb-1">Errors ({report.errors.length}):</p>
                    <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
                      {report.errors.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fix Materials Interest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Maps legacy material IDs to real material UUIDs for opportunities with quotation items.
              Clears text-only "بلوك" entries for the rest.
            </p>

            <Button onClick={fixMaterialsInterest} disabled={fixStatus === "loading"} variant="secondary" className="gap-2">
              {fixStatus === "loading" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Fix Materials
                </>
              )}
            </Button>

            {fixStatus === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{fixError}</AlertDescription>
              </Alert>
            )}

            {fixReport && (
              <div className="space-y-3 mt-4">
                <Alert className="border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">Fix complete!</AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Total opportunities", fixReport.total],
                    ["Cleared (text-only)", fixReport.cleared],
                    ["Mapped to real materials", fixReport.mapped],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                      <span>{label}</span>
                      <Badge variant="outline">{val}</Badge>
                    </div>
                  ))}
                </div>
                {fixReport.errors?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-destructive mb-1">Errors ({fixReport.errors.length}):</p>
                    <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
                      {fixReport.errors.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backfill Follow-up Linkage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Backfills <code>customer_account_id</code>, <code>project_id</code>, <code>opportunity_id</code>, and <code>assigned_to</code> for the 292 legacy follow-ups.
              Tags every touched row with <code>metadata.legacy_migration = true</code>. Idempotent — never overwrites a non-null value.
            </p>

            <Button onClick={backfillTaskLinks} disabled={linkStatus === "loading"} variant="secondary" className="gap-2">
              {linkStatus === "loading" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Backfilling...</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Backfill Follow-ups</>
              )}
            </Button>

            {linkStatus === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>
            )}

            {linkReport && (
              <div className="space-y-3 mt-4">
                <Alert className="border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Backfill complete — updated {linkReport.updated} of {linkReport.total} tasks.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Resolution breakdown</p>
                  <pre className="text-xs bg-muted p-3 rounded max-h-96 overflow-auto">
                    {JSON.stringify(linkReport.resolution, null, 2)}
                  </pre>
                </div>

                {linkReport.orphans?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 mb-1">
                      Orphans with no resolvable parent ({linkReport.orphans.length}):
                    </p>
                    <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto">
                      {linkReport.orphans.map((o: any) => `${o.task_id}  legacy=${o.legacy_id}  ${o.reason}`).join("\n")}
                    </pre>
                  </div>
                )}

                {linkReport.errors?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Errors ({linkReport.errors.length}):</p>
                    <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
                      {linkReport.errors.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rescue Orphan Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reconstructs the 3 missing parent communications and relinks the 7 orphan follow-ups to their correct customer accounts (SAL.0077, SAL.0079, SAL.0080). Idempotent.
            </p>

            <Button onClick={rescueOrphans} disabled={rescueStatus === "loading"} variant="secondary" className="gap-2">
              {rescueStatus === "loading" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Rescuing...</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Rescue Orphans</>
              )}
            </Button>

            {rescueStatus === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{rescueError}</AlertDescription>
              </Alert>
            )}

            {rescueReport && (
              <div className="space-y-3 mt-4">
                <Alert className="border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Rescue complete — {rescueReport.communications_inserted} comms created, {rescueReport.tasks_relinked} tasks relinked.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Comms inserted", rescueReport.communications_inserted],
                    ["Comms skipped (existing)", rescueReport.communications_skipped_existing],
                    ["Tasks relinked", rescueReport.tasks_relinked],
                    ["Tasks not found", rescueReport.tasks_not_found?.length ?? 0],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                      <span>{label}</span>
                      <Badge variant="outline">{val as any}</Badge>
                    </div>
                  ))}
                </div>
                {rescueReport.errors?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Errors ({rescueReport.errors.length}):</p>
                    <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
                      {rescueReport.errors.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MigrationTrigger;
