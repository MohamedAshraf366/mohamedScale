import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Package, TrendingUp, Pencil, Trash2, Plus, Check, ChevronsUpDown, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '@/components/ui/animated-card';

const PREDEFINED_KPIS = [
  'Annual Target',
  'Average Deal Size',
  'Qualification Ratio',
  'Closing Ratio (Qualified → Deal)',
  'Retention Rate',
  'Monthly Revenue Target',
  'Quarterly Revenue Target',
  'Raw Outreach',
];

const RATE_KPIS = [
  'Qualification Ratio',
  'Closing Ratio (Qualified → Deal)',
  'Retention Rate',
];

const COUNT_KPIS = ['Raw Outreach'];

const isRateKpi = (kpiName: string) => RATE_KPIS.includes(kpiName);
const isCountKpi = (kpiName: string) => COUNT_KPIS.includes(kpiName);

const KPI_PERIOD_MAPPING: Record<string, { periodType: 'Monthly' | 'Quarterly' | 'Yearly'; periodValue: string }> = {
  'Annual Target': { periodType: 'Yearly', periodValue: '2026' },
  'Monthly Revenue Target': { periodType: 'Monthly', periodValue: 'January' },
  'Quarterly Revenue Target': { periodType: 'Quarterly', periodValue: 'Q1' },
  'Qualification Ratio': { periodType: 'Yearly', periodValue: '2026' },
  'Closing Ratio (Qualified → Deal)': { periodType: 'Yearly', periodValue: '2026' },
  'Retention Rate': { periodType: 'Yearly', periodValue: '2026' },
};

const getLockedPeriodType = (kpiName: string) => KPI_PERIOD_MAPPING[kpiName] || null;

interface ScaleTarget {
  id: string;
  kpi_name: string;
  period_type: 'Monthly' | 'Quarterly' | 'Yearly';
  period_value: string;
  target_value: number;
  explanation: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  target_metric: string;
  changes: any;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

type PeriodType = 'Monthly' | 'Quarterly' | 'Yearly';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const YEARS = ['2024', '2025', '2026', '2027', '2028'];

const QUARTER_MONTHS: Record<string, string[]> = {
  'Q1': ['January', 'February', 'March'],
  'Q2': ['April', 'May', 'June'],
  'Q3': ['July', 'August', 'September'],
  'Q4': ['October', 'November', 'December'],
};

const ScaleKPISection = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scaleTargets, setScaleTargets] = useState<ScaleTarget[]>([]);
  const [selectedPeriodType, setSelectedPeriodType] = useState<PeriodType>('Yearly');
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string>('2026');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [yearlyRates, setYearlyRates] = useState<{
    qualificationRatio: number | null;
    closingRatio: number | null;
    retentionRate: number | null;
  }>({ qualificationRatio: null, closingRatio: null, retentionRate: null });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ScaleTarget | null>(null);
  const [formData, setFormData] = useState({
    kpi_name: '',
    period_type: 'Yearly' as PeriodType,
    period_value: '2026',
    target_value: '',
    explanation: '',
  });

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchScaleTargets();
      fetchActivityLogs();
    }
  }, [isOpen, selectedPeriodType, selectedPeriodValue]);

  useEffect(() => {
    if (isOpen && selectedPeriodType === 'Monthly') {
      fetchYearlyRates();
    }
  }, [isOpen, selectedPeriodType, selectedPeriodValue]);

  useEffect(() => {
    if (selectedPeriodType === 'Monthly') {
      setSelectedPeriodValue('January');
    } else if (selectedPeriodType === 'Quarterly') {
      setSelectedPeriodValue('Q1');
    } else {
      setSelectedPeriodValue('2026');
    }
  }, [selectedPeriodType]);

  const getPeriodOptions = (type: PeriodType) => {
    switch (type) {
      case 'Monthly': return MONTHS;
      case 'Quarterly': return QUARTERS;
      case 'Yearly': return YEARS;
    }
  };

  const fetchScaleTargets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scale_targets')
        .select('*')
        .eq('period_type', selectedPeriodType)
        .eq('period_value', selectedPeriodValue)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setScaleTargets(data || []);
    } catch (error) {
      console.error('Error fetching scale targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyRates = async () => {
    try {
      const { data: yearlyTargets, error } = await supabase
        .from('scale_targets')
        .select('kpi_name, target_value, period_value, created_at')
        .eq('period_type', 'Yearly')
        .in('kpi_name', ['Qualification Ratio', 'Closing Ratio (Qualified → Deal)', 'Retention Rate'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const getLatestValue = (kpiName: string): number | null => {
        const target = yearlyTargets?.find(t => t.kpi_name === kpiName);
        return target ? target.target_value : null;
      };

      setYearlyRates({
        qualificationRatio: getLatestValue('Qualification Ratio'),
        closingRatio: getLatestValue('Closing Ratio (Qualified → Deal)'),
        retentionRate: getLatestValue('Retention Rate'),
      });
    } catch (error) {
      console.error('Error fetching yearly rates:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_target_activity_log')
        .select(`
          id,
          action,
          target_metric,
          changes,
          created_at,
          user_id,
          profiles!sales_target_activity_log_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      const mappedData = (data || []).map((log: any) => ({
        ...log,
        profiles: Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
      }));
      setActivityLogs(mappedData);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const logActivity = async (action: string, targetId: string | null, metric: string, changes?: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('sales_target_activity_log').insert({
        sales_target_id: targetId,
        user_id: user.id,
        action,
        target_metric: metric,
        changes,
      });

      fetchActivityLogs();
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const openAddDialog = () => {
    setEditingTarget(null);
    setFormData({
      kpi_name: '',
      period_type: selectedPeriodType,
      period_value: selectedPeriodValue,
      target_value: '',
      explanation: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (target: ScaleTarget) => {
    setEditingTarget(target);
    setFormData({
      kpi_name: target.kpi_name,
      period_type: target.period_type,
      period_value: target.period_value,
      target_value: target.target_value.toString(),
      explanation: target.explanation || '',
    });
    setIsDialogOpen(true);
  };

  const getQuarterForMonth = (month: string): string | null => {
    for (const [quarter, months] of Object.entries(QUARTER_MONTHS)) {
      if (months.includes(month)) return quarter;
    }
    return null;
  };

  const validateTargetConsistency = async (): Promise<{ valid: boolean; message?: string }> => {
    const targetValue = parseFloat(formData.target_value);
    const kpiName = formData.kpi_name;
    const periodType = formData.period_type;
    const periodValue = formData.period_value;

    if (isRateKpi(kpiName) && periodType !== 'Yearly') {
      return {
        valid: false,
        message: 'Rate KPIs are defined on a yearly basis only.',
      };
    }

    if (periodType === 'Monthly') {
      const warnings: string[] = [];

      const { data: allMonthlyTargets } = await supabase
        .from('scale_targets')
        .select('id, target_value, period_value')
        .eq('kpi_name', kpiName)
        .eq('period_type', 'Monthly');

      const otherMonthlyTargets = (allMonthlyTargets || []).filter(t =>
        editingTarget ? t.id !== editingTarget.id : t.period_value !== periodValue
      );

      const quarter = getQuarterForMonth(periodValue);
      if (quarter) {
        const { data: quarterlyTarget } = await supabase
          .from('scale_targets')
          .select('target_value')
          .eq('kpi_name', kpiName)
          .eq('period_type', 'Quarterly')
          .eq('period_value', quarter)
          .maybeSingle();

        if (quarterlyTarget) {
          const quarterMonths = QUARTER_MONTHS[quarter];
          const quarterMonthlySum = otherMonthlyTargets
            .filter(t => quarterMonths.includes(t.period_value))
            .reduce((sum, t) => sum + (Number(t.target_value) || 0), 0) + targetValue;

          if (quarterMonthlySum !== Number(quarterlyTarget.target_value)) {
            warnings.push(`${quarter} quarterly target will not match monthly sum`);
          }
        }
      }

      const { data: yearlyTarget } = await supabase
        .from('scale_targets')
        .select('target_value')
        .eq('kpi_name', kpiName)
        .eq('period_type', 'Yearly')
        .maybeSingle();

      if (yearlyTarget) {
        const yearlyMonthlySum = otherMonthlyTargets
          .reduce((sum, t) => sum + (Number(t.target_value) || 0), 0) + targetValue;

        if (yearlyMonthlySum !== Number(yearlyTarget.target_value)) {
          warnings.push(`Yearly target will not match monthly sum`);
        }
      }

      if (warnings.length > 0) {
        return { valid: false, message: warnings.join('\n') };
      }
    }

    return { valid: true };
  };

  const handleSave = async () => {
    if (!formData.kpi_name || !formData.target_value) {
      toast({ title: "Missing information", description: "Please fill in KPI name and target value.", variant: "destructive" });
      return;
    }

    try {
      const validation = await validateTargetConsistency();
      if (!validation.valid) {
        toast({ title: "Validation Error", description: validation.message, variant: "destructive" });
        return;
      }

      if (editingTarget) {
        const { error } = await supabase
          .from('scale_targets')
          .update({
            kpi_name: formData.kpi_name,
            period_type: formData.period_type,
            period_value: formData.period_value,
            target_value: parseFloat(formData.target_value),
            explanation: formData.explanation || null,
          })
          .eq('id', editingTarget.id);

        if (error) throw error;

        await logActivity('updated', editingTarget.id, formData.kpi_name, {
          before: editingTarget,
          after: formData,
        });

        toast({ title: "Target updated", description: "The KPI target has been updated successfully." });
      } else {
        const { data, error } = await supabase
          .from('scale_targets')
          .insert({
            kpi_name: formData.kpi_name,
            period_type: formData.period_type,
            period_value: formData.period_value,
            target_value: parseFloat(formData.target_value),
            explanation: formData.explanation || null,
          })
          .select()
          .single();

        if (error) throw error;

        await logActivity('created', data.id, formData.kpi_name, { created: formData });
        toast({ title: "Target added", description: "New KPI target has been added successfully." });
      }

      setIsDialogOpen(false);
      fetchScaleTargets();
    } catch (error) {
      console.error('Error saving target:', error);
      toast({ title: "Error", description: "Failed to save KPI target.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const targetToDelete = scaleTargets.find(t => t.id === id);

      const { error } = await supabase.from('scale_targets').delete().eq('id', id);

      if (error) throw error;

      if (targetToDelete) {
        await logActivity('deleted', null, targetToDelete.kpi_name, { deleted: targetToDelete });
      }

      setDeleteTargetId(null);
      fetchScaleTargets();
      toast({ title: "Target deleted", description: "The KPI target has been removed." });
    } catch (error) {
      console.error('Error deleting target:', error);
      toast({ title: "Error", description: "Failed to delete KPI target.", variant: "destructive" });
    }
  };

  const formatTargetValue = (value: number, kpiName?: string) => {
    if (kpiName && isRateKpi(kpiName)) return `${value}%`;
    if (kpiName && isCountKpi(kpiName)) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  };

  const calculateFunnelProjection = () => {
    if (selectedPeriodType !== 'Monthly') return null;
    const rawOutreachTarget = scaleTargets.find(t => t.kpi_name === 'Raw Outreach');
    if (!rawOutreachTarget) return null;

    const rawOutreach = rawOutreachTarget.target_value;
    const { qualificationRatio, closingRatio, retentionRate } = yearlyRates;

    const qualifiedLeads = qualificationRatio !== null ? rawOutreach * (qualificationRatio / 100) : null;
    const deals = qualifiedLeads !== null && closingRatio !== null ? qualifiedLeads * (closingRatio / 100) : null;
    const retainedClients = deals !== null && retentionRate !== null ? deals * (retentionRate / 100) : null;

    return { rawOutreach, qualificationRatio, qualifiedLeads, closingRatio, deals, retentionRate, retainedClients };
  };

  const funnelProjection = calculateFunnelProjection();

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'updated': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'deleted': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <AnimatedCard index={10} animation="card-enter">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Sales KPI Targets
                </div>
                <div className="flex items-center gap-2">
                  {!isOpen && scaleTargets.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {scaleTargets.length} targets
                    </Badge>
                  )}
                  {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Target for {selectedPeriodValue} ({selectedPeriodType})
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {formatTargetValue(scaleTargets.reduce((sum, t) => sum + t.target_value, 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">KPIs</p>
                    <p className="text-xl font-semibold">{scaleTargets.length}</p>
                  </div>
                </div>
              </div>

              {/* Period Filters & Add Button */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {(['Monthly', 'Quarterly', 'Yearly'] as PeriodType[]).map(type => (
                      <Button
                        key={type}
                        variant={selectedPeriodType === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedPeriodType(type)}
                      >
                        {type === 'Monthly' ? 'Month' : type === 'Quarterly' ? 'Quarter' : 'Year'}
                      </Button>
                    ))}
                  </div>
                  <Select value={selectedPeriodValue} onValueChange={setSelectedPeriodValue}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getPeriodOptions(selectedPeriodType).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={openAddDialog} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : scaleTargets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No KPI targets for {selectedPeriodValue} ({selectedPeriodType}).
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI Name</TableHead>
                      <TableHead>Target Value</TableHead>
                      <TableHead>Explanation</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scaleTargets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">{target.kpi_name}</TableCell>
                        <TableCell>{formatTargetValue(target.target_value, target.kpi_name)}</TableCell>
                        <TableCell className="max-w-md truncate">{target.explanation || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(target)} className="h-8 w-8 p-0">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(target.id)} className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Funnel Projection */}
              {selectedPeriodType === 'Monthly' && funnelProjection && (
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/30 space-y-3">
                  <p className="text-sm font-medium">Monthly Funnel Projection</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Raw Outreach</p>
                      <p className="text-lg font-bold">{Math.round(funnelProjection.rawOutreach)}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Qualified Leads</p>
                      {funnelProjection.qualifiedLeads !== null ? (
                        <p className="text-lg font-bold">{Math.round(funnelProjection.qualifiedLeads)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Set Qualification Ratio</p>
                      )}
                    </div>
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Deals Target</p>
                      {funnelProjection.deals !== null ? (
                        <p className="text-lg font-bold">{Math.round(funnelProjection.deals)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Set Closing Ratio</p>
                      )}
                    </div>
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Retained Clients</p>
                      {funnelProjection.retainedClients !== null ? (
                        <p className="text-lg font-bold">{Math.round(funnelProjection.retainedClients)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Set Retention Rate</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Log */}
              {activityLogs.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Recent Activity</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activityLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-sm">
                        <Badge className={cn("text-xs", getActionBadgeColor(log.action))}>{log.action}</Badge>
                        <span className="font-medium">{log.target_metric}</span>
                        <span className="text-muted-foreground text-xs">
                          by {log.profiles?.full_name || 'Unknown'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </AnimatedCard>
      </Collapsible>

      {/* Delete Dialog */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the KPI target.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTargetId && handleDelete(deleteTargetId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTarget ? 'Edit KPI Target' : 'Add KPI Target'}</DialogTitle>
            <DialogDescription>
              {editingTarget ? 'Update the KPI target details below.' : 'Fill in the details for the new KPI target.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kpi_name">KPI Name</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {formData.kpi_name || "Select or type KPI name..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover z-50" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type new KPI..."
                      value={formData.kpi_name}
                      onValueChange={(value) => setFormData({ ...formData, kpi_name: value })}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <span className="text-muted-foreground text-sm">Press enter to use "{formData.kpi_name}"</span>
                      </CommandEmpty>
                      <CommandGroup heading="Suggested KPIs">
                        {PREDEFINED_KPIS.map((kpi) => (
                          <CommandItem
                            key={kpi}
                            value={kpi}
                            onSelect={() => {
                              const locked = getLockedPeriodType(kpi);
                              if (locked) {
                                const periodOptions = getPeriodOptions(locked.periodType);
                                const newPeriodValue = periodOptions.includes(formData.period_value)
                                  ? formData.period_value
                                  : periodOptions[0];
                                setFormData({
                                  ...formData,
                                  kpi_name: kpi,
                                  period_type: locked.periodType,
                                  period_value: newPeriodValue,
                                });
                              } else {
                                setFormData({ ...formData, kpi_name: kpi });
                              }
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.kpi_name === kpi ? "opacity-100" : "opacity-0")} />
                            {kpi}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="period_type">Period Type</Label>
                <Select
                  value={formData.period_type}
                  onValueChange={(value: PeriodType) => {
                    const newPeriodValue = value === 'Monthly' ? 'January' : value === 'Quarterly' ? 'Q1' : '2026';
                    setFormData({ ...formData, period_type: value, period_value: newPeriodValue });
                  }}
                  disabled={!!getLockedPeriodType(formData.kpi_name)}
                >
                  <SelectTrigger className={cn(getLockedPeriodType(formData.kpi_name) && "opacity-60")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="period_value">Period Value</Label>
                <Select value={formData.period_value} onValueChange={(value) => setFormData({ ...formData, period_value: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getPeriodOptions(formData.period_type).map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="target_value">Target Value ($)</Label>
              <Input
                id="target_value"
                type="number"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                placeholder="e.g., 100000"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="explanation">Explanation</Label>
              <Textarea
                id="explanation"
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Describe the target..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTarget ? 'Save Changes' : 'Add Target'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScaleKPISection;
