import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Unlock, 
  FileCheck, 
  RefreshCw, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowRight,
  Loader2,
  Building2,
  Star
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface UnlockCycleStats {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

interface ValidityStats {
  expiring30Days: number;
  expiring60Days: number;
  expiring90Days: number;
}

interface SupplierPerformanceBand {
  name: string;
  count: number;
  color: string;
}

const SupplyOverview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch unlock cycle stats
  const { data: unlockStats, isLoading: unlockLoading } = useQuery({
    queryKey: ['unlock-cycle-stats'],
    queryFn: async (): Promise<UnlockCycleStats> => {
      const { data, error } = await supabase
        .from('material_unlock_cycles')
        .select('unlock_status');
      
      if (error) throw error;
      
      const stats: UnlockCycleStats = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      };
      
      data?.forEach(item => {
        if (item.unlock_status in stats) {
          stats[item.unlock_status as keyof UnlockCycleStats]++;
        }
      });
      
      return stats;
    }
  });

  // Fetch validity tracker stats
  const { data: validityStats, isLoading: validityLoading } = useQuery({
    queryKey: ['validity-tracker-stats'],
    queryFn: async (): Promise<ValidityStats> => {
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('material_validity_tracker')
        .select('price_valid_until')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const stats: ValidityStats = {
        expiring30Days: 0,
        expiring60Days: 0,
        expiring90Days: 0
      };
      
      data?.forEach(item => {
        const expiryDate = new Date(item.price_valid_until);
        if (expiryDate <= in30Days) {
          stats.expiring30Days++;
        } else if (expiryDate <= in60Days) {
          stats.expiring60Days++;
        } else if (expiryDate <= in90Days) {
          stats.expiring90Days++;
        }
      });
      
      return stats;
    }
  });

  // Fetch renegotiation tasks
  const { data: renegotiationCount, isLoading: renegotiationLoading } = useQuery({
    queryKey: ['renegotiation-count'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('material_unlock_cycles')
        .select('id')
        .eq('is_renegotiation', true)
        .in('renegotiation_status', ['not_started', 'in_progress']);
      
      if (error) throw error;
      return data?.length || 0;
    }
  });

  // Fetch supplier performance stats
  const { data: supplierPerformance, isLoading: performanceLoading } = useQuery({
    queryKey: ['supplier-performance-bands'],
    queryFn: async (): Promise<SupplierPerformanceBand[]> => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('performance_rating');
      
      if (error) throw error;
      
      const bands = {
        low: 0,      // 0-2
        medium: 0,   // 2-3.5
        high: 0      // 3.5-5
      };
      
      data?.forEach(item => {
        if (item.performance_rating !== null) {
          if (item.performance_rating < 2) {
            bands.low++;
          } else if (item.performance_rating < 3.5) {
            bands.medium++;
          } else {
            bands.high++;
          }
        }
      });
      
      return [
        { name: '0-2 (Low)', count: bands.low, color: '#ef4444' },
        { name: '2-3.5 (Medium)', count: bands.medium, color: '#f59e0b' },
        { name: '3.5-5 (High)', count: bands.high, color: '#22c55e' }
      ];
    }
  });

  // Fetch average performance rating
  const { data: avgPerformance } = useQuery({
    queryKey: ['avg-supplier-performance'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('performance_rating');
      
      if (error) throw error;
      
      const validRatings = data?.filter(d => d.performance_rating !== null) || [];
      if (validRatings.length === 0) return 0;
      
      const sum = validRatings.reduce((acc, d) => acc + (d.performance_rating || 0), 0);
      return Math.round((sum / validRatings.length) * 10) / 10;
    }
  });

  const isLoading = unlockLoading || validityLoading || renegotiationLoading || performanceLoading;

  // Prepare chart data for unlock status
  const unlockChartData = unlockStats ? [
    { status: 'Pending', count: unlockStats.pending, fill: 'hsl(var(--chart-4))' },
    { status: 'In Progress', count: unlockStats.in_progress, fill: 'hsl(var(--chart-2))' },
    { status: 'Completed', count: unlockStats.completed, fill: 'hsl(var(--chart-3))' },
    { status: 'Cancelled', count: unlockStats.cancelled, fill: 'hsl(var(--muted))' }
  ] : [];

  const totalUnlockCycles = unlockStats 
    ? unlockStats.pending + unlockStats.in_progress + unlockStats.completed + unlockStats.cancelled 
    : 0;

  const totalExpiringPrices = validityStats 
    ? validityStats.expiring30Days + validityStats.expiring60Days + validityStats.expiring90Days 
    : 0;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('supply.overview', 'Supply Overview')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('supply.overviewDesc', 'Monitor unlock cycles, price validity, and supplier performance')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Unlock Cycles */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('supply.activeUnlockCycles', 'Active Unlock Cycles')}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {(unlockStats?.pending || 0) + (unlockStats?.in_progress || 0)}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {unlockStats?.pending || 0} pending
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {unlockStats?.in_progress || 0} in progress
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Unlock className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Validity Expiring */}
              <Card className={`border-l-4 ${validityStats?.expiring30Days ? 'border-l-destructive' : 'border-l-amber-500'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('supply.expiringPrices', 'Expiring Prices (90d)')}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {totalExpiringPrices}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {validityStats?.expiring30Days ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {validityStats.expiring30Days} in 30d
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-xs">
                          {validityStats?.expiring60Days || 0} in 60d
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <Calendar className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Renegotiations */}
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('supply.renegotiationsActive', 'Active Renegotiations')}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {renegotiationCount || 0}
                      </p>
                      <Badge 
                        variant={renegotiationCount && renegotiationCount > 0 ? 'secondary' : 'outline'} 
                        className="text-xs mt-2"
                      >
                        {renegotiationCount && renegotiationCount > 0 ? 'Tasks in progress' : 'No active tasks'}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <RefreshCw className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Avg Supplier Performance */}
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('supply.avgPerformance', 'Avg Supplier Performance')}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {avgPerformance || 'N/A'}
                        {avgPerformance ? <span className="text-lg text-muted-foreground">/5</span> : null}
                      </p>
                      <Badge 
                        variant={avgPerformance && avgPerformance >= 3.5 ? 'default' : 'secondary'} 
                        className="text-xs mt-2"
                      >
                        {avgPerformance && avgPerformance >= 3.5 ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Good</>
                        ) : avgPerformance ? (
                          'Needs improvement'
                        ) : (
                          'No data'
                        )}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <Star className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Unlock Status Bar Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Unlock className="h-4 w-4 text-primary" />
                    {t('supply.materialsByUnlockStatus', 'Materials by Unlock Status')}
                  </CardTitle>
                  <CardDescription>
                    {totalUnlockCycles} total unlock cycles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    {totalUnlockCycles > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={unlockChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis 
                            dataKey="status" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            radius={[4, 4, 0, 0]}
                            name="Count"
                          >
                            {unlockChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Unlock className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">No unlock cycles yet</p>
                        <p className="text-xs mt-1">Create unlock cycles to track material pricing</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Supplier Performance Donut Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {t('supply.supplierPerformanceBands', 'Supplier Performance Distribution')}
                  </CardTitle>
                  <CardDescription>
                    Suppliers grouped by performance rating
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    {supplierPerformance && supplierPerformance.some(b => b.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={supplierPerformance}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="name"
                            label={({ name, count }) => count > 0 ? `${name}: ${count}` : ''}
                            labelLine={false}
                          >
                            {supplierPerformance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Building2 className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">No performance data yet</p>
                        <p className="text-xs mt-1">Rate suppliers to see performance distribution</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CTA Buttons */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  {t('supply.quickActions', 'Quick Actions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col items-start gap-2 hover:border-primary/50"
                    onClick={() => navigate('/supply/unlock')}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Unlock className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t('supply.viewUnlockPipeline', 'View Unlock Pipeline')}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Manage material unlock cycles and pricing approvals
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col items-start gap-2 hover:border-primary/50"
                    onClick={() => navigate('/supply/confirmations')}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{t('supply.viewPriceConfirmations', 'View Price Confirmations')}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Track price validity and upcoming expirations
                    </p>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex flex-col items-start gap-2 hover:border-primary/50"
                    onClick={() => navigate('/supply/renegotiations')}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{t('supply.viewRenegotiations', 'View Renegotiations')}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground text-left">
                      Manage ongoing supplier renegotiations
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Alerts Section */}
            {(validityStats?.expiring30Days || 0) > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {validityStats?.expiring30Days} prices expiring within 30 days
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Review and renew supplier agreements to avoid pricing disruptions.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/supply/confirmations')}
                    >
                      Review Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default SupplyOverview;
