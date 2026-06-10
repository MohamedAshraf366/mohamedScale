import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Star, ArrowUpDown, Eye, Pencil, Trash2, Map, GitCompare, History } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import SupplierDialog from '@/components/SupplierDialog';
import SupplierComparisonDialog from '@/components/SupplierComparisonDialog';
import PriceHistoryDialog from '@/components/PriceHistoryDialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface Supplier {
  id: string;
  name: string;
  supplier_code: string | null;
  contact_person: string | null;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  city: string | null;
  location: string | null;
  rating: number | null;
  lead_time_days: number | null;
  notes: string | null;
  quotation_url: string | null;
  supplier_type: string | null;
  coverage: string[] | null;
  status: string | null;
  total_orders: number | null;
  on_time_delivery_percent: number | null;
  updated_at: string | null;
}

interface MaterialWithPrices {
  name: string;
  manufacturer_price: number | null;
  delivery_price: number | null;
}

interface SupplierWithStats extends Supplier {
  total_communications: number;
  materials_count: number;
  materials_list: string;
  materials_with_prices: MaterialWithPrices[];
}

const SUPPLIER_TYPES = ['Manufacturer', 'Distributor', 'Both'];

const Suppliers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof SupplierWithStats>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [cities, setCities] = useState<string[]>([]);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [priceHistoryDialogOpen, setPriceHistoryDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (suppliersError) throw suppliersError;

      // Get stats for each supplier
      const { data: statsData } = await supabase
        .from('supplier_stats')
        .select('*');

      // Get materials for each supplier with pricing
      const { data: materialsData } = await supabase
        .from('material_alt_suppliers')
        .select('supplier_id, material_id, manufacturer_price, delivery_price, materials(name)');

      const suppliersWithStats: SupplierWithStats[] = (suppliersData || []).map(supplier => {
        const stats = statsData?.find(s => s.id === supplier.id);
        const supplierMaterials = materialsData?.filter(m => m.supplier_id === supplier.id) || [];
        
        return {
          ...supplier,
          total_communications: stats?.total_communications || 0,
          materials_count: supplierMaterials.length,
          materials_list: supplierMaterials.map((m: any) => m.materials?.name).filter(Boolean).join(', '),
          materials_with_prices: supplierMaterials.map((m: any) => ({
            name: m.materials?.name || '',
            manufacturer_price: m.manufacturer_price,
            delivery_price: m.delivery_price,
          })).filter(m => m.name),
        };
      });

      setSuppliers(suppliersWithStats);

      // Extract unique cities for filter
      const uniqueCities = [...new Set(suppliersData?.map(s => s.city).filter(Boolean) as string[])];
      setCities(uniqueCities);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof SupplierWithStats) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete ${supplier.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;

      toast({
        title: t('suppliers.supplierDeleted'),
        description: t('suppliers.supplierDeletedDesc', { name: supplier.name }),
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: t('common.error'),
        description: t('suppliers.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const filteredSuppliers = suppliers
    .filter((supplier) => {
      const matchesSearch =
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.materials_list?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCity = cityFilter === 'all' || supplier.city === cityFilter;
      const matchesRating = ratingFilter === 'all' || supplier.rating === parseInt(ratingFilter);
      const matchesType = typeFilter === 'all' || supplier.supplier_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;

      return matchesSearch && matchesCity && matchesRating && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

  const renderRating = (rating: number | null) => {
    if (!rating) return '-';
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating
                ? 'fill-accent text-accent'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>
    );
  };


  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-muted-foreground">{t('common.loading')}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('suppliers.title')}</h1>
            <p className="text-muted-foreground">
              {t('suppliers.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => setPriceHistoryDialogOpen(true)}
            >
              <History className="h-4 w-4" />
              Price History
            </Button>
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => setComparisonDialogOpen(true)}
            >
              <GitCompare className="h-4 w-4" />
              Compare Suppliers
            </Button>
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/suppliers-map')}
            >
              <Map className="h-4 w-4" />
              {t('suppliers.viewOnMap')}
            </Button>
            <Button 
              className="gap-2"
              onClick={() => {
                setSelectedSupplier(null);
                setDialogMode('edit');
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('suppliers.addSupplier')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('suppliers.searchSuppliers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('suppliers.filterByCity')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('suppliers.allCities')}</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('suppliers.filterByRating')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('suppliers.allRatings')}</SelectItem>
              {[5, 4, 3, 2, 1].map((rating) => (
                <SelectItem key={rating} value={rating.toString()}>
                  {rating} {t('suppliers.stars')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Supplier Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {SUPPLIER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                    Name <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('supplier_type')}>
                    Type <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('lead_time_days')}>
                    Lead Time <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('status')}>
                    Status <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('city')}>
                    City <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('rating')}>
                    Rating <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('total_orders')}>
                    Orders <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('updated_at')}>
                    Last Updated <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery || cityFilter !== 'all' || ratingFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
                        ? 'No suppliers found matching your filters'
                        : 'No suppliers yet. Add your first supplier to get started.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow 
                    key={supplier.id} 
                    className="hover:bg-muted/50"
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {supplier.supplier_code || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setDialogMode('view');
                            setDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <span
                          className="font-medium cursor-pointer hover:text-primary"
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setDialogMode('view');
                            setDialogOpen(true);
                          }}
                        >
                          {supplier.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.supplier_type ? (
                        <Badge variant="outline">{supplier.supplier_type}</Badge>
                      ) : '-'}
                    </TableCell>
                    
                    <TableCell className="text-muted-foreground">
                      {supplier.lead_time_days != null ? `${supplier.lead_time_days} days` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.status === 'Active' ? 'default' : 'secondary'}>
                        {supplier.status || 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.city || '-'}
                    </TableCell>
                    <TableCell>{renderRating(supplier.rating)}</TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      {supplier.total_orders || 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {supplier.updated_at ? format(new Date(supplier.updated_at), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupplier(supplier);
                            setDialogMode('edit');
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(supplier, e)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <SupplierDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          supplier={selectedSupplier}
          onSuccess={fetchSuppliers}
          mode={dialogMode}
        />

        <SupplierComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={setComparisonDialogOpen}
        />

        <PriceHistoryDialog
          open={priceHistoryDialogOpen}
          onOpenChange={setPriceHistoryDialogOpen}
        />
      </div>
    </Layout>
  );
};

export default Suppliers;