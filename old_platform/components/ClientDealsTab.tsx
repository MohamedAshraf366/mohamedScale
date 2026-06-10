import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Handshake, 
  ExternalLink, 
  Calendar,
  Package,
  DollarSign,
  MapPin,
  FileText,
  CreditCard,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ClientDealsTabProps {
  clientId: string | null;
}

export const ClientDealsTab = ({ clientId }: ClientDealsTabProps) => {
  const navigate = useNavigate();

  // Fetch operations orders for this client
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['client-deals', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('operations_orders')
        .select(`
          *,
          clients(company_name),
          projects(name, city, district),
          opportunities(name, deal_id, expected_value, interest_level, is_deal)
        `)
        .eq('client_id', clientId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter out orders where the opportunity has been unlocked (is_deal = false)
      const activeOrders = (data || []).filter((order: any) => 
        order.opportunities?.is_deal !== false
      );
      
      return activeOrders;
    },
    enabled: !!clientId,
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DRAFT':
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/30">Draft</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">In Progress</Badge>;
      case 'DELIVERED':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Delivered</Badge>;
      case 'CLOSED':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'not_paid':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Not Paid</Badge>;
      case 'first_payment_received':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">First Payment</Badge>;
      case 'payment_completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Paid</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Deals / Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Deals / Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Handshake className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No deals yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Convert an opportunity to create a deal.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Deals / Orders
            <Badge variant="secondary" className="ml-2">{orders.length}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order #</TableHead>
                <TableHead>Deal ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => (
                <TableRow key={order.id} className="group">
                  <TableCell className="font-mono font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {order.deal_id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{order.projects?.name || '-'}</span>
                      {(order.projects?.city || order.projects?.district) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {[order.projects?.city, order.projects?.district].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.opportunities?.expected_value ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        SAR {order.opportunities.expected_value.toLocaleString()}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getPaymentStatusBadge(order.payment_status)}
                      {/* Payment proof links */}
                      <div className="flex gap-1">
                        {order.first_payment_proof_url && (
                          <a
                            href={order.first_payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-0.5"
                            title="First Payment Proof"
                          >
                            <Download className="h-3 w-3" />
                            1st
                          </a>
                        )}
                        {order.final_payment_proof_url && (
                          <a
                            href={order.final_payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-0.5"
                            title="Final Payment Proof"
                          >
                            <Download className="h-3 w-3" />
                            Final
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/operations')}
                      className="h-8 w-8 p-0"
                      title="View in Operations"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientDealsTab;
