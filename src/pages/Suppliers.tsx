import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AddSupplierSheet } from '@/components/suppliers/AddSupplierSheet';
import { DataTableToolbar, type SortOption, type FilterColumnDef, type SmartFilterRule } from '@/components/shared/DataTableToolbar';
import {
  Plus, Star, MapPin, Phone, Clock, Building2, Factory, Store, Users, CheckCircle2, XCircle, Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

const supplierTypeIcons: Record<string, React.ReactNode> = {
  manufacturer: <Factory className="h-4 w-4" />,
  distributor: <Building2 className="h-4 w-4" />,
  store: <Store className="h-4 w-4" />,
};

type SupplierSortColumn = 'name' | 'type' | 'location' | 'lead_time' | 'rating' | 'status';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'location', label: 'Location' },
  { value: 'lead_time', label: 'Lead Time' },
  { value: 'rating', label: 'Rating' },
  { value: 'status', label: 'Status' },
];

const DEFAULT_SORT: SortOption = { column: 'name', direction: 'asc' };

const FILTER_COLUMNS: FilterColumnDef[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'deleted', label: 'Deleted' }, // Added deleted option
    ],
  },
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'manufacturer', label: 'Manufacturer' },
      { value: 'distributor', label: 'Distributor' },
      { value: 'store', label: 'Store' },
    ],
  },
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'location', label: 'Location', type: 'text' },
  { id: 'zone', label: 'Zone', type: 'text' },
];

function compareNullable(a: string | number | null | undefined, b: string | number | null | undefined, dir: 'asc' | 'desc') {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return dir === 'asc' ? a - b : b - a;
  const r = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? r : -r;
}

function getAvgRating(supplier: any) {
  const dims = [supplier.rating_price, supplier.rating_quality, supplier.rating_delivery, supplier.rating_responsiveness].filter(Boolean) as number[];
  return dims.length > 0 ? dims.reduce((a: number, b: number) => a + b, 0) / dims.length : (supplier.rating || null);
}

const Suppliers = () => {
  const { data: suppliers, isLoading, error } = useSuppliers();
  const [search, setSearch] = useState('');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activeSort, setActiveSort] = useState<SortOption>(DEFAULT_SORT);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSupplierAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const handleFilterChange = (filterId: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [filterId]: value }));
  };

  const handleDeleteClick = (supplier: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

const handleConfirmDelete = async () => {
  if (!supplierToDelete) return;
  
  setIsDeleting(true);
  try {
    // تحديث كل من deleted_at و status
    const { error } = await supabase
      .from('accounts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_reason: 'Soft delete from suppliers page',
        status: 'deleted'  // ✅ هنا التغيير المهم
      })
      .eq('id', supplierToDelete.account_id);

    if (error) throw error;

    toast({
      title: 'Supplier Deleted',
      description: `${supplierToDelete.display_name} has been moved to trash.`,
    });

    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    setDeleteDialogOpen(false);
    setSupplierToDelete(null);
  } catch (error) {
    console.error('Error deleting supplier:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete supplier',
      variant: 'destructive',
    });
  } finally {
    setIsDeleting(false);
  }
};

  const filtered = useMemo(() => {
    let list = suppliers ?? [];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.display_name?.toLowerCase().includes(q) ||
        s.supplier_code?.toLowerCase().includes(q) ||
        s.contact_name?.toLowerCase().includes(q) ||
        s.location_city?.toLowerCase().includes(q)
      );
    }

    if (activeFilters.status && activeFilters.status !== 'all') {
      list = list.filter(s => s.status === activeFilters.status);
    }

    if (activeFilters.type && activeFilters.type !== 'all') {
      list = list.filter(s => s.supplier_type === activeFilters.type);
    }

    return [...list].sort((a, b) => {
      switch (activeSort.column as SupplierSortColumn) {
        case 'name': return compareNullable(a.display_name, b.display_name, activeSort.direction);
        case 'type': return compareNullable(a.supplier_type, b.supplier_type, activeSort.direction);
        case 'location': return compareNullable(a.location_city, b.location_city, activeSort.direction);
        case 'lead_time': return compareNullable(a.lead_time_days, b.lead_time_days, activeSort.direction);
        case 'rating': return compareNullable(getAvgRating(a), getAvgRating(b), activeSort.direction);
        case 'status': return compareNullable(a.status, b.status, activeSort.direction);
        default: return 0;
      }
    });
  }, [suppliers, search, activeFilters, activeSort]);

  const renderRating = (supplier: any) => {
    const avg = getAvgRating(supplier);
    if (!avg) return <span className="text-sm text-muted-foreground">—</span>;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{avg.toFixed(1)}</span>
      </div>
    );
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'default' as const;
      case 'inactive': return 'secondary' as const;
      case 'deleted': return 'destructive' as const;
      default: return 'outline' as const;
    }
  };

  const supplierStats = useMemo(() => {
    const all = suppliers ?? [];
    return {
      total: all.filter(s => s.status !== 'deleted').length, // Exclude deleted from total
      active: all.filter(s => s.status === 'active').length,
      inactive: all.filter(s => s.status === 'inactive').length,
      deleted: all.filter(s => s.status === 'deleted').length,
    };
  }, [suppliers]);

  return (
    <ProtectedRoute>
      <AppLayout title="Suppliers">
        <div className="space-y-4 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-semibold">Suppliers</h1>
              <p className="text-sm text-muted-foreground">
                {supplierStats.total} suppliers
              </p>
            </div>
            <Button className="gap-2" onClick={() => setAddSheetOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card
              className={cn("cursor-pointer transition-colors", !activeFilters.status && "ring-1 ring-primary/50")}
              onClick={() => setActiveFilters({})}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{supplierStats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={cn("cursor-pointer transition-colors", activeFilters.status === 'active' && "ring-1 ring-primary/50")}
              onClick={() => setActiveFilters({ status: 'active' })}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{supplierStats.active}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={cn("cursor-pointer transition-colors", activeFilters.status === 'inactive' && "ring-1 ring-primary/50")}
              onClick={() => setActiveFilters({ status: 'inactive' })}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{supplierStats.inactive}</p>
                    <p className="text-[10px] text-muted-foreground">Inactive</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={cn("cursor-pointer transition-colors", activeFilters.status === 'deleted' && "ring-1 ring-destructive/50")}
              onClick={() => setActiveFilters({ status: 'deleted' })}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{supplierStats.deleted}</p>
                    <p className="text-[10px] text-muted-foreground">Deleted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DataTableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search suppliers..."
            filterColumns={FILTER_COLUMNS}
            activeSmartFilters={Object.entries(activeFilters)
              .filter(([, v]) => v && v !== 'all')
              .map(([col, val], i) => ({ id: `s_${i}`, column: col, value: val }))}
            onSmartFiltersChange={(rules) => {
              const f: Record<string, string> = {};
              rules.forEach((r) => { f[r.column] = r.value; });
              setActiveFilters(f);
            }}
            sortOptions={SORT_OPTIONS}
            activeSort={activeSort}
            defaultSort={DEFAULT_SORT}
            onSortChange={(sort) => setActiveSort(sort ?? DEFAULT_SORT)}
            onClear={() => {
              setSearch('');
              setActiveFilters({});
              setActiveSort(DEFAULT_SORT);
            }}
          />

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-destructive">
                      Failed to load suppliers
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      {search ? 'No suppliers match your search' : 'No suppliers yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((supplier) => (
                    <TableRow
                      key={supplier.account_id}
                      className={cn("cursor-pointer hover:bg-muted/50", supplier.status === 'deleted' && "opacity-60")}
                      onClick={() => supplier.status !== 'deleted' && navigate(`/suppliers/${supplier.account_id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{supplier.display_name || 'Unnamed Supplier'}</span>
                          {supplier.supplier_code && (
                            <span className="text-xs text-muted-foreground">{supplier.supplier_code}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm capitalize">
                          {supplierTypeIcons[supplier.supplier_type] || <Store className="h-4 w-4" />}
                          {supplier.supplier_type || 'Store'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.contact_name ? (
                          <div className="flex flex-col text-sm">
                            <span>{supplier.contact_name}</span>
                            {supplier.contact_phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {supplier.contact_phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.location_city ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {supplier.location_city}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.zone_name ? (
                          <Badge variant="outline" className="text-xs">{supplier.zone_name}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.lead_time_days ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {supplier.lead_time_days}d
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{renderRating(supplier)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(supplier.status)}>
                          {supplier.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {supplier.status !== 'deleted' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteClick(supplier, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <AddSupplierSheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          onSuccess={handleSupplierAdded}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark {supplierToDelete?.display_name} as deleted. 
                It will no longer appear in active supplier lists.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Suppliers;