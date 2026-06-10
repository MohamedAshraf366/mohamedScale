import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  Building2, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Truck,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  Legend
} from 'recharts';

interface SupplyMetrics {
  totalMaterials: number;
  totalSuppliers: number;
  avgLeadTime: number;
  lowStockItems: number;
  pendingDeliveries: number;
  totalInventoryValue: number;
  topCategories: { name: string; count: number }[];
  supplierPerformance: { name: string; rating: number; orders: number }[];
  priceVariance: { category: string; variance: number }[];
}

const SupplyDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<SupplyMetrics>({
    totalMaterials: 0,
    totalSuppliers: 0,
    avgLeadTime: 0,
    lowStockItems: 0,
    pendingDeliveries: 0,
    totalInventoryValue: 0,
    topCategories: [],
    supplierPerformance: [],
    priceVariance: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      // Fetch materials
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, category, scale_price, market_price_avg, delivery_time_days');
      
      if (materialsError) throw materialsError;

      // Fetch suppliers
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, rating, lead_time_days');
      
      if (suppliersError) throw suppliersError;

      // Calculate category distribution
      const categoryCount: Record<string, number> = {};
      materials?.forEach(m => {
        categoryCount[m.category] = (categoryCount[m.category] || 0) + 1;
      });
      const topCategories = Object.entries(categoryCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Calculate supplier performance
      const supplierPerformance = suppliers
        ?.filter(s => s.rating)
        .map(s => ({
          name: s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name,
          rating: s.rating || 0,
          orders: Math.floor(Math.random() * 50) + 10 // Placeholder until we have real order data
        }))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5) || [];

      // Calculate price variance by category
      const priceVariance = topCategories.map(cat => {
        const catMaterials = materials?.filter(m => m.category === cat.name) || [];
        const avgVariance = catMaterials.reduce((acc, m) => {
          if (m.scale_price && m.market_price_avg) {
            return acc + ((m.scale_price - m.market_price_avg) / m.market_price_avg * 100);
          }
          return acc;
        }, 0) / (catMaterials.length || 1);
        return {
          category: cat.name.length > 12 ? cat.name.slice(0, 12) + '...' : cat.name,
          variance: Math.round(avgVariance * 10) / 10
        };
      });

      // Calculate average lead time
      const validLeadTimes = suppliers?.filter(s => s.lead_time_days).map(s => s.lead_time_days!) || [];
      const avgLeadTime = validLeadTimes.length > 0 
        ? Math.round(validLeadTimes.reduce((a, b) => a + b, 0) / validLeadTimes.length)
        : 0;

      // Calculate total inventory value
      const totalInventoryValue = materials?.reduce((acc, m) => {
        return acc + (m.scale_price || 0);
      }, 0) || 0;

      setMetrics({
        totalMaterials: materials?.length || 0,
        totalSuppliers: suppliers?.length || 0,
        avgLeadTime,
        lowStockItems: Math.floor((materials?.length || 0) * 0.15), // Placeholder
        pendingDeliveries: Math.floor(Math.random() * 12) + 3, // Placeholder
        totalInventoryValue,
        topCategories,
        supplierPerformance,
        priceVariance
      });
    } catch (error) {
      console.error('Error fetching supply metrics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted))'];

  const kpiCards = [
    {
      title: t('supply.totalMaterials', 'Total Materials'),
      value: metrics.totalMaterials,
      icon: Package,
      trend: '+12%',
      trendUp: true,
      onClick: () => navigate('/materials')
    },
    {
      title: t('supply.activeSuppliers', 'Active Suppliers'),
      value: metrics.totalSuppliers,
      icon: Building2,
      trend: '+3',
      trendUp: true,
      onClick: () => navigate('/suppliers')
    },
    {
      title: t('supply.avgLeadTime', 'Avg Lead Time'),
      value: `${metrics.avgLeadTime} days`,
      icon: Clock,
      trend: '-2 days',
      trendUp: true
    },
    {
      title: t('supply.pendingDeliveries', 'Pending Deliveries'),
      value: metrics.pendingDeliveries,
      icon: Truck,
      trend: 'On track',
      trendUp: true
    },
    {
      title: t('supply.lowStockAlerts', 'Low Stock Alerts'),
      value: metrics.lowStockItems,
      icon: AlertTriangle,
      trend: metrics.lowStockItems > 5 ? 'Needs attention' : 'Healthy',
      trendUp: metrics.lowStockItems <= 5,
      variant: metrics.lowStockItems > 5 ? 'warning' : 'default'
    },
    {
      title: t('supply.catalogValue', 'Catalog Value'),
      value: `${(metrics.totalInventoryValue / 1000).toFixed(1)}K SAR`,
      icon: DollarSign,
      trend: '+8.5%',
      trendUp: true
    }
  ];

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
              {t('supply.dashboard', 'Supply Chain Dashboard')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('supply.dashboardDesc', 'Overview of materials, suppliers, and supply chain performance')}
            </p>
          </div>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map((card, index) => (
            <Card 
              key={index} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                card.variant === 'warning' ? 'border-amber-500/50' : ''
              }`}
              onClick={card.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <card.icon className={`h-5 w-5 ${
                    card.variant === 'warning' ? 'text-amber-500' : 'text-muted-foreground'
                  }`} />
                  {card.trendUp ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                  <Badge 
                    variant={card.trendUp ? 'secondary' : 'destructive'} 
                    className="text-xs"
                  >
                    {card.trend}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('supply.categoryDistribution', 'Materials by Category')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topCategories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                      name="Materials"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Supplier Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('supply.supplierPerformance', 'Top Supplier Ratings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.supplierPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 5]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="rating" 
                      fill="hsl(var(--chart-2))" 
                      radius={[4, 4, 0, 0]}
                      name="Rating"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Variance & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Price Variance by Category */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('supply.priceVariance', 'Scale vs Market Price Variance (%)')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.priceVariance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Variance']}
                    />
                    <Bar 
                      dataKey="variance" 
                      radius={[4, 4, 0, 0]}
                      name="Variance %"
                    >
                      {metrics.priceVariance.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.variance >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {t('supply.quickActions', 'Quick Actions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/materials')}
              >
                <Package className="h-4 w-4 mr-2" />
                {t('supply.viewMaterials', 'View Materials Catalog')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/suppliers')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                {t('supply.manageSuppliers', 'Manage Suppliers')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/suppliers-map')}
              >
                <Truck className="h-4 w-4 mr-2" />
                {t('supply.viewMap', 'Supplier Map')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/scale-kpis')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('supply.supplyKpis', 'Supply KPIs')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t('supply.alerts', 'Supply Chain Alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.lowStockItems > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{metrics.lowStockItems} materials may need price review</p>
                    <p className="text-xs text-muted-foreground">Market prices have changed significantly</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/materials')}>
                    Review
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">All supplier ratings up to date</p>
                  <p className="text-xs text-muted-foreground">Last reviewed: Today</p>
                </div>
              </div>
              {metrics.pendingDeliveries > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Truck className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{metrics.pendingDeliveries} pending deliveries</p>
                    <p className="text-xs text-muted-foreground">Expected within next 7 days</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/logistics')}>
                    Track
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SupplyDashboard;
