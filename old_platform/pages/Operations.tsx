import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ClipboardList, 
  Package, 
  Truck, 
  FileText, 
  CheckCircle2,
  CreditCard,
  Filter,
  X,
  Calendar
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderKanban } from '@/components/OrderKanban';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface Order {
  id: string;
  order_number: string;
  deal_id: string;
  status: string;
  payment_status: string;
  first_payment_proof_url: string | null;
  final_payment_proof_url: string | null;
  created_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  client_id: string;
  opportunity_id: string;
  clients?: { company_name: string; city?: string; district?: string; primary_contact_phone?: string } | null;
  projects?: { name: string; location?: string; city?: string; district?: string } | null;
  opportunities?: { name: string; expected_value: number | null; stage?: string } | null;
}

const Operations = () => {
  const { t } = useTranslation();
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateType, setDateType] = useState<'created' | 'closed'>('created');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Fetch operations orders with related data
  const { data: orders, isLoading } = useQuery({
    queryKey: ['operations-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_orders')
        .select(`
          *,
          clients:client_id (company_name, city, district, primary_contact_phone),
          projects:project_id (name, location, city, district),
          opportunities:opportunity_id (name, expected_value, stage)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    }
  });

  // Fetch order materials
  const { data: orderMaterials } = useQuery({
    queryKey: ['operations-order-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_order_materials')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch opportunity materials (source of truth from Sales)
  const { data: opportunityMaterials } = useQuery({
    queryKey: ['opportunity-materials-for-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunity_materials')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  // Filter orders based on selected filters
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    return orders.filter(order => {
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      
      // Payment filter
      if (paymentFilter !== 'all' && order.payment_status !== paymentFilter) {
        return false;
      }
      
      // Date range filter
      if (dateRange?.from) {
        const dateField = dateType === 'created' ? order.created_at : order.closed_at;
        if (!dateField) return false;
        
        const orderDate = parseISO(dateField);
        const fromDate = startOfDay(dateRange.from);
        
        if (isBefore(orderDate, fromDate)) return false;
        
        if (dateRange.to) {
          const toDate = endOfDay(dateRange.to);
          if (isAfter(orderDate, toDate)) return false;
        }
      }
      
      return true;
    });
  }, [orders, statusFilter, paymentFilter, dateType, dateRange]);

  const hasActiveFilters = statusFilter !== 'all' || paymentFilter !== 'all' || dateRange?.from;

  const clearFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateRange(undefined);
  };

  const orderStats = {
    total: orders?.length || 0,
    draft: orders?.filter(o => o.status === 'DRAFT').length || 0,
    inProgress: orders?.filter(o => o.status === 'IN_PROGRESS').length || 0,
    delivered: orders?.filter(o => o.status === 'DELIVERED').length || 0,
    closed: orders?.filter(o => o.status === 'CLOSED').length || 0,
    notPaid: orders?.filter(o => o.payment_status === 'not_paid').length || 0,
    partialPaid: orders?.filter(o => o.payment_status === 'first_payment_received').length || 0,
    paid: orders?.filter(o => o.payment_status === 'payment_completed').length || 0,
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-7 w-7 text-blue-600" />
              {t('operations.title', 'Operations')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('operations.subtitle', 'Manage orders and track delivery lifecycle')}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Filter */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="not_paid">Not Paid</SelectItem>
                <SelectItem value="first_payment_received">1st Payment</SelectItem>
                <SelectItem value="payment_completed">Paid</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-sm gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span>{format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}</span>
                    ) : (
                      <span>From {format(dateRange.from, 'MMM d')}</span>
                    )
                  ) : (
                    <span>Date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <div className="space-y-3">
                  <Select value={dateType} onValueChange={(v: 'created' | 'closed') => setDateType(v)}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">Created Date</SelectItem>
                      <SelectItem value="closed">Closed Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <CalendarComponent
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-sm gap-1 text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            {/* Filter Count Badge */}
            {hasActiveFilters && (
              <span className="text-xs text-muted-foreground">
                ({filteredOrders.length} of {orders?.length || 0})
              </span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.draft}</p>
                  <p className="text-[10px] text-muted-foreground">Draft</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Truck className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.inProgress}</p>
                  <p className="text-[10px] text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.delivered}</p>
                  <p className="text-[10px] text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.closed}</p>
                  <p className="text-[10px] text-muted-foreground">Closed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Stats */}
          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <CreditCard className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.notPaid}</p>
                  <p className="text-[10px] text-muted-foreground">Not Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.partialPaid}</p>
                  <p className="text-[10px] text-muted-foreground">1st Payment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="scale-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CreditCard className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{orderStats.paid}</p>
                  <p className="text-[10px] text-muted-foreground">Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ))}
          </div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <OrderKanban 
            orders={filteredOrders} 
            orderMaterials={orderMaterials || []} 
            opportunityMaterials={opportunityMaterials || []}
          />
        ) : hasActiveFilters ? (
          <Card className="scale-card">
            <CardContent className="p-12 text-center">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">
                No Matching Orders
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                No orders match the current filter criteria.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="scale-card">
            <CardContent className="p-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">
                {t('operations.noOrders', 'No Orders Yet')}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('operations.noOrdersDescription', 'Orders will appear here once Sales converts opportunities to deals.')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Operations;
