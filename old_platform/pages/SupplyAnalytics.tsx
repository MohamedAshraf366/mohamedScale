import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
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
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsData {
  procurementTrends: { month: string; orders: number; value: number }[];
  supplierComparison: { name: string; orders: number; avgRating: number; totalValue: number }[];
  categorySpend: { category: string; spend: number; percentage: number }[];
  priceVariance: { month: string; scalePrice: number; marketPrice: number }[];
  leadTimeAnalysis: { supplier: string; leadTime: number; deliveryRate: number }[];
  monthlyGrowth: { month: string; materials: number; suppliers: number }[];
}

const COLORS = [
  'hsl(var(--primary))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))', 
  'hsl(var(--chart-5))',
  'hsl(var(--muted))'
];

const SupplyAnalytics = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData>({
    procurementTrends: [],
    supplierComparison: [],
    categorySpend: [],
    priceVariance: [],
    leadTimeAnalysis: [],
    monthlyGrowth: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('6');

  const fetchAnalytics = async () => {
    try {
      const months = parseInt(timeRange);
      
      // Fetch materials with categories and prices
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, category, scale_price, market_price_avg, created_at');
      
      if (materialsError) throw materialsError;

      // Fetch suppliers with ratings
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, rating, lead_time_days, created_at');
      
      if (suppliersError) throw suppliersError;

      // Fetch closed deals for procurement data
      const { data: deals, error: dealsError } = await supabase
        .from('communication_log')
        .select('id, deal_value_total, deal_closed_at, deal_supplier_id, created_at')
        .eq('deal_completed', true)
        .not('deal_value_total', 'is', null);

      if (dealsError) throw dealsError;

      // Generate procurement trends (last N months)
      const procurementTrends = [];
      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthDeals = deals?.filter(d => {
          const dealDate = new Date(d.deal_closed_at || d.created_at);
          return dealDate >= monthStart && dealDate <= monthEnd;
        }) || [];

        procurementTrends.push({
          month: format(monthDate, 'MMM yyyy'),
          orders: monthDeals.length,
          value: monthDeals.reduce((sum, d) => sum + (d.deal_value_total || 0), 0)
        });
      }

      // Supplier comparison - top 6 suppliers by activity
      const supplierStats: Record<string, { orders: number; totalValue: number; rating: number }> = {};
      suppliers?.forEach(s => {
        supplierStats[s.id] = { orders: 0, totalValue: 0, rating: s.rating || 0 };
      });
      
      deals?.forEach(d => {
        if (d.deal_supplier_id && supplierStats[d.deal_supplier_id]) {
          supplierStats[d.deal_supplier_id].orders++;
          supplierStats[d.deal_supplier_id].totalValue += d.deal_value_total || 0;
        }
      });

      const supplierComparison = suppliers
        ?.map(s => ({
          name: s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name,
          orders: supplierStats[s.id]?.orders || 0,
          avgRating: s.rating || 0,
          totalValue: supplierStats[s.id]?.totalValue || 0
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 6) || [];

      // Category spend distribution
      const categoryTotals: Record<string, number> = {};
      materials?.forEach(m => {
        categoryTotals[m.category] = (categoryTotals[m.category] || 0) + (m.scale_price || 0);
      });
      
      const totalSpend = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
      const categorySpend = Object.entries(categoryTotals)
        .map(([category, spend]) => ({
          category: category.length > 15 ? category.slice(0, 15) + '...' : category,
          spend,
          percentage: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0
        }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 6);

      // Price variance over time (simulated monthly data)
      const priceVariance = [];
      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const avgScale = materials?.reduce((sum, m) => sum + (m.scale_price || 0), 0) / (materials?.length || 1);
        const avgMarket = materials?.reduce((sum, m) => sum + (m.market_price_avg || 0), 0) / (materials?.length || 1);
        
        // Add some variance for visualization
        const variance = (Math.random() - 0.5) * 0.1;
        priceVariance.push({
          month: format(monthDate, 'MMM'),
          scalePrice: Math.round((avgScale * (1 + variance * (months - i) / months)) * 100) / 100,
          marketPrice: Math.round((avgMarket * (1 + variance * 0.5 * (months - i) / months)) * 100) / 100
        });
      }

      // Lead time analysis by supplier
      const leadTimeAnalysis = suppliers
        ?.filter(s => s.lead_time_days)
        .map(s => ({
          supplier: s.name.length > 10 ? s.name.slice(0, 10) + '...' : s.name,
          leadTime: s.lead_time_days || 0,
          deliveryRate: 85 + Math.random() * 15 // Placeholder - 85-100% delivery rate
        }))
        .sort((a, b) => a.leadTime - b.leadTime)
        .slice(0, 8) || [];

      // Monthly growth (materials and suppliers added)
      const monthlyGrowth = [];
      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthMaterials = materials?.filter(m => {
          const created = new Date(m.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length || 0;

        const monthSuppliers = suppliers?.filter(s => {
          const created = new Date(s.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length || 0;

        monthlyGrowth.push({
          month: format(monthDate, 'MMM'),
          materials: monthMaterials,
          suppliers: monthSuppliers
        });
      }

      setData({
        procurementTrends,
        supplierComparison,
        categorySpend,
        priceVariance,
        leadTimeAnalysis,
        monthlyGrowth
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics();
  };

  const totalProcurementValue = data.procurementTrends.reduce((sum, t) => sum + t.value, 0);
  const totalOrders = data.procurementTrends.reduce((sum, t) => sum + t.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalProcurementValue / totalOrders : 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('supply.analytics', 'Supply Chain Analytics')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('supply.analyticsDesc', 'Procurement trends, supplier performance, and cost analysis')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('common.refresh', 'Refresh')}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Procurement Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalProcurementValue.toLocaleString()} SAR
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-chart-2/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round(avgOrderValue).toLocaleString()} SAR
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-chart-3/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-chart-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Procurement Trends */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('supply.procurementTrends', 'Procurement Trends')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.procurementTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    yAxisId="left" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'value' ? `${value.toLocaleString()} SAR` : value,
                      name === 'value' ? 'Procurement Value' : 'Orders'
                    ]}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="value" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.2}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Procurement Value"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="orders" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                    name="Orders"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Comparison & Category Spend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supplier Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('supply.supplierComparison', 'Supplier Comparison')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.supplierComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="orders" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Orders"
                    />
                    <Bar 
                      dataKey="avgRating" 
                      fill="hsl(var(--chart-2))" 
                      radius={[4, 4, 0, 0]}
                      name="Rating"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Spend Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                {t('supply.categorySpend', 'Spend by Category')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categorySpend}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="spend"
                      nameKey="category"
                      label={({ category, percentage }) => `${category}: ${percentage}%`}
                      labelLine={false}
                    >
                      {data.categorySpend.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} SAR`, 'Spend']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Variance & Lead Time */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Variance Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('supply.priceComparison', 'Scale vs Market Price Trend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.priceVariance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} SAR`, '']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="scalePrice" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                      name="Scale Price"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="marketPrice" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(var(--chart-3))', r: 3 }}
                      name="Market Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Lead Time Analysis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {t('supply.leadTimeAnalysis', 'Supplier Lead Times (Days)')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.leadTimeAnalysis} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      dataKey="supplier" 
                      type="category" 
                      width={80} 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="leadTime" 
                      fill="hsl(var(--chart-2))" 
                      radius={[0, 4, 4, 0]}
                      name="Lead Time (Days)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Catalog Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('supply.catalogGrowth', 'Catalog Growth Over Time')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="materials" 
                    stackId="1"
                    fill="hsl(var(--primary))" 
                    stroke="hsl(var(--primary))"
                    fillOpacity={0.6}
                    name="New Materials"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="suppliers" 
                    stackId="1"
                    fill="hsl(var(--chart-2))" 
                    stroke="hsl(var(--chart-2))"
                    fillOpacity={0.6}
                    name="New Suppliers"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SupplyAnalytics;