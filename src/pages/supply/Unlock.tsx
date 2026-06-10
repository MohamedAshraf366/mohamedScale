import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ScopeSelectorSheet } from '@/components/supply/ScopeSelectorSheet';
import { CycleDetail } from '@/components/supply/CycleDetail';
import { useUnlockCycles, type UnlockCycle } from '@/hooks/useUnlockCycles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, CalendarDays, Grid3X3 } from 'lucide-react';
import { PageGuidance } from '@/components/supply/PageGuidance';
import { UNLOCK_GUIDANCE } from '@/components/supply/guidance-content';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-600',
  completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
};

import { WipShelf } from '@/components/supply/WipShelf';

export default function Unlock() {
  return (
    <WipShelf
      title="Supply Cycles — Work in Progress"
      description="Cycles are paused. Day-to-day supplier selection now happens on Supply Domains."
      redirectHint="Open Supply → Domains to continue."
    />
  );
}

function _LegacyUnlock() {
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<UnlockCycle | null>(null);

  const { data: cycles, isLoading: cyclesLoading } = useUnlockCycles();

  if (selectedCycle) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <CycleDetail cycle={selectedCycle} onBack={() => setSelectedCycle(null)} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Supply cycles are paused. Day-to-day supplier selection now happens on{' '}
          <a href="/supply/domains" className="underline font-medium">Supply Domains</a>. This page remains for legacy planning.
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Supply Cycles</h1>
            <p className="text-sm text-muted-foreground mt-1">Plan and track material sourcing cycles</p>
          </div>
          <Button onClick={() => setNewCycleOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Cycle
          </Button>
        </div>

        <PageGuidance {...UNLOCK_GUIDANCE} />

        {cyclesLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : !cycles?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No supply cycles yet. Create one to define your material scope.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead>Domains (Area × Group)</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Materials</TableHead>
                  <TableHead>Zones</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map(cycle => {
                  return (
                    <TableRow
                      key={cycle.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCycle(cycle)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{cycle.name}</span>
                          {cycle.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-48">{cycle.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cycle.subcategory_name ? (
                          <Badge variant="secondary" className="text-xs">{cycle.subcategory_name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* SSOT §1: Domain = Area × Group */}
                        <div className="flex items-center gap-1">
                          <Grid3X3 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{cycle.domain_count || 0} domain(s)</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cycle.start_date || cycle.end_date ? (
                          <div className="flex items-center gap-1 text-xs">
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            {cycle.start_date ? format(new Date(cycle.start_date), 'dd MMM') : '—'}
                            {' → '}
                            {cycle.end_date ? format(new Date(cycle.end_date), 'dd MMM') : '—'}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{cycle.material_count || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{cycle.zone_codes?.length || 0}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[cycle.status] || statusColors.planning}>
                          {cycle.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ScopeSelectorSheet open={newCycleOpen} onOpenChange={setNewCycleOpen} />
    </AppLayout>
  );
}
