import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, Truck, ShieldAlert, Gavel, ListTodo, MapPin, Star,
  Phone, Mail, Globe, Building, FileText, Clock, CheckCircle, AlertCircle, Layers,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { SupplierRatingDisplay } from '@/components/suppliers/SupplierRatingInput';
import type { DeliveryRate } from '@/hooks/useDeliveryRates';
import type { SupplierMaterial } from '@/hooks/useSupplierMaterials';

interface SupplierOverviewTabProps {
  supplier: any;
  supplierMaterials: SupplierMaterial[];
  deliveryRates: DeliveryRate[];
  supplierIssues: any[];
  supplierActions: any[];
  supplierAccountId: string;
  onTabChange: (tab: string) => void;
}

export function SupplierOverviewTab({
  supplier,
  supplierMaterials,
  deliveryRates,
  supplierIssues,
  supplierActions,
  supplierAccountId,
  onTabChange,
}: SupplierOverviewTabProps) {
  // Fetch tasks for this supplier
  const { data: tasks } = useQuery({
    queryKey: ['supplier-tasks', supplierAccountId],
    queryFn: async () => {
      const query = supabase
        .from('tasks')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      const { data, error } = await (query as any).eq('supplier_account_id', supplierAccountId);
      if (error) throw error;
      return data as any[];
    },
  });

  const account = supplier?.account;
  const location = (account as any)?.locations;
  const openIssues = supplierIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed');
  const approvedMaterials = supplierMaterials.filter(m => m.status === 'approved');
  const openTasks = tasks?.filter((t: any) => t.status !== 'done' && t.status !== 'completed') || [];
  const zoneCount = new Set(deliveryRates.flatMap(r => r.zone_codes)).size;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Materials"
          value={supplierMaterials.length}
          sub={`${approvedMaterials.length} approved`}
          onClick={() => onTabChange('materials')}
        />
        <StatCard
          icon={<Truck className="h-4 w-4" />}
          label="Delivery Rates"
          value={deliveryRates.length}
          sub={`${zoneCount} zones`}
          onClick={() => onTabChange('delivery')}
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Open Issues"
          value={openIssues.length}
          sub={`${supplierIssues.length} total`}
          variant={openIssues.length > 0 ? 'warning' : 'default'}
          onClick={() => onTabChange('issues')}
        />
        <StatCard
          icon={<Gavel className="h-4 w-4" />}
          label="Actions"
          value={supplierActions.length}
          sub="recorded"
          onClick={() => onTabChange('actions')}
        />
        <StatCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Follow-ups"
          value={openTasks.length}
          sub="open"
          variant={openTasks.length > 0 ? 'info' : 'default'}
          onClick={() => onTabChange('followups')}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Rating"
          value={supplier?.rating != null ? `${supplier.rating}/5` : '—'}
          sub={supplier?.supplier_type || ''}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Supplier Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {account?.legal_name && (
              <InfoRow icon={<Building className="h-3.5 w-3.5" />} label="Legal Name" value={account.legal_name} />
            )}
            {account?.tax_number && (
              <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Tax Number" value={account.tax_number} />
            )}
            {location?.city && (
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="City" value={location.city} />
            )}
            {location?.address_text && (
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={location.address_text} />
            )}
            {account?.website && (
              <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Website">
                <a href={account.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                  {account.website}
                </a>
              </InfoRow>
            )}
            {supplier?.bank_name && (
              <InfoRow icon={<Building className="h-3.5 w-3.5" />} label="Bank" value={supplier.bank_name} />
            )}
            {supplier?.iban && (
              <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="IBAN" value={supplier.iban} />
            )}
            {supplier && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Rating</p>
                <SupplierRatingDisplay
                  overallRating={supplier.rating}
                  qualityGrade={(supplier as any).quality_grade}
                  ratingNotes={(supplier as any).rating_notes}
                />
              </div>
            )}
            {supplier?.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Middle: Recent Materials + Delivery */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Top Materials
              <button className="text-xs text-primary hover:underline font-normal" onClick={() => onTabChange('materials')}>
                View all →
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {supplierMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No materials quoted</p>
            ) : (
              supplierMaterials.slice(0, 6).map(sm => (
                <div key={sm.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{sm.material_name || '—'}</span>
                    <span className="text-xs text-muted-foreground">{sm.material_code}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sm.unit_price != null && (
                      <span className="font-mono text-xs">{sm.unit_price.toLocaleString()} SAR</span>
                    )}
                    <Badge variant={sm.status === 'approved' ? 'default' : sm.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                      {sm.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}

            {/* Delivery zones summary */}
            {deliveryRates.length > 0 && (
              <div className="pt-3 mt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Delivery Zones</span>
                  <button className="text-xs text-primary hover:underline" onClick={() => onTabChange('delivery')}>
                    View all →
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[...new Set(deliveryRates.flatMap(r => r.zone_names.map(z => z.name || z.code)))].slice(0, 10).map(z => (
                    <Badge key={z} variant="outline" className="text-xs gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {z}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Follow-ups + Issues */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Recent Activity
              <button className="text-xs text-primary hover:underline font-normal" onClick={() => onTabChange('followups')}>
                View all →
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Follow-ups */}
            {openTasks.length > 0 ? (
              openTasks.slice(0, 4).map((task: any) => {
                const isOverdue = task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at));
                return (
                  <div key={task.id} className={cn(
                    "flex items-start gap-2 text-sm py-1.5 border-b last:border-0",
                    isOverdue && "text-destructive"
                  )}>
                    {task.status === 'done' || task.status === 'completed'
                      ? <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                      : isOverdue
                        ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        : <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{task.title}</span>
                      {task.due_at && (
                        <span className="text-xs text-muted-foreground">
                          Due {format(new Date(task.due_at), 'MMM d')}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{task.priority}</Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No open follow-ups</p>
            )}

            {/* Issues */}
            {openIssues.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Open Issues</span>
                  <button className="text-xs text-primary hover:underline" onClick={() => onTabChange('issues')}>
                    View →
                  </button>
                </div>
                {openIssues.slice(0, 3).map(issue => (
                  <div key={issue.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="capitalize flex-1 truncate">{issue.issue_type}</span>
                    <Badge variant="outline" className="text-xs capitalize">{issue.severity}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Recent actions */}
            {supplierActions.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Last Actions</span>
                  <button className="text-xs text-primary hover:underline" onClick={() => onTabChange('actions')}>
                    View →
                  </button>
                </div>
                {supplierActions.slice(0, 2).map(action => (
                  <div key={action.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                    <Gavel className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-xs capitalize">{action.action_type.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(action.created_at), 'MMM d')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, variant = 'default', onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  variant?: 'default' | 'warning' | 'info';
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        variant === 'warning' && "border-destructive/30",
        variant === 'info' && "border-primary/30",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value, children }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        {children || <p className="truncate">{value}</p>}
      </div>
    </div>
  );
}
