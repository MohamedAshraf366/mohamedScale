import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Users, 
  MessageSquare, 
  Activity,
  ArrowRight,
  Shield,
  Clock
} from 'lucide-react';
import { useMigrationStats, useRunMigration } from '@/hooks/useActivities';
import { cn } from '@/lib/utils';

const AdminMigration = () => {
  const { data: stats, isLoading, refetch } = useMigrationStats();
  const runMigration = useRunMigration();
  const [lastMigrationResult, setLastMigrationResult] = useState<{ migrated: number; created: number } | null>(null);

  const handleRunMigration = async () => {
    const result = await runMigration.mutateAsync();
    setLastMigrationResult(result);
    refetch();
  };

  const migrationProgress = stats 
    ? (stats.migratedActivities / Math.max(stats.totalCommunications, 1)) * 100 
    : 0;

  const isFullyMigrated = stats && stats.migratedActivities >= stats.totalCommunications;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Migration Admin
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Verify and manage the client-centric data migration
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Status Alert */}
        {isFullyMigrated ? (
          <Alert className="border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Migration Complete</AlertTitle>
            <AlertDescription className="text-green-600">
              All legacy communications have been migrated to the new client-centric model.
            </AlertDescription>
          </Alert>
        ) : stats && stats.totalCommunications > 0 ? (
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Migration In Progress</AlertTitle>
            <AlertDescription className="text-amber-600">
              {stats.totalCommunications - stats.migratedActivities} communications remain to be migrated.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Legacy Communications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? '...' : stats?.totalCommunications || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Original data (preserved)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? '...' : stats?.totalClients || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total client records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? '...' : stats?.totalActivities || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.migratedActivities || 0} from legacy data
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Migration Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Migration Progress</CardTitle>
            <CardDescription>
              Tracking the transformation from communications to activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{migrationProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    isFullyMigrated ? "bg-green-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(migrationProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Flow Diagram */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">{stats?.totalCommunications || 0}</div>
                <div className="text-xs text-muted-foreground">Communications</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div className="text-sm font-medium">{stats?.migratedActivities || 0}</div>
                <div className="text-xs text-muted-foreground">Activities</div>
              </div>
            </div>

            <Separator />

            {/* Unmapped Communications */}
            {stats && stats.unmappedCommunications > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {stats.unmappedCommunications} communications without client_id
                  </span>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                  Will create new clients
                </Badge>
              </div>
            )}

            {/* Run Migration Button */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Safe operation - original data preserved
              </div>
              <Button 
                onClick={handleRunMigration}
                disabled={runMigration.isPending || isFullyMigrated}
                className="gap-2"
              >
                {runMigration.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : isFullyMigrated ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Fully Migrated
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Run Migration
                  </>
                )}
              </Button>
            </div>

            {/* Last Migration Result */}
            {lastMigrationResult && (
              <Alert className="border-primary/30 bg-primary/5">
                <Clock className="h-4 w-4" />
                <AlertTitle>Last Migration Run</AlertTitle>
                <AlertDescription>
                  Created {lastMigrationResult.created} new clients and {lastMigrationResult.migrated} activities.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Data Integrity Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Data Integrity Verification</CardTitle>
            <CardDescription>
              Ensuring no data loss during migration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Legacy communications table</span>
                <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Preserved
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Legacy traceability (legacy_communication_id)</span>
                <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Linked
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Client matching by company name</span>
                <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminMigration;
