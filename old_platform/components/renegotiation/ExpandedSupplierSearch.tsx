import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Building2, Star, MapPin, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddSupplierToRenegotiation, RenegotiationBid } from '@/hooks/useRenegotiationBids';

interface ExpandedSupplierSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  existingBids: RenegotiationBid[];
}

const ExpandedSupplierSearch = ({
  open,
  onOpenChange,
  materialId,
  existingBids,
}: ExpandedSupplierSearchProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const addSupplier = useAddSupplierToRenegotiation();

  // Get all suppliers
  const { data: allSuppliers, isLoading } = useQuery({
    queryKey: ['all-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, rating, city, supplier_type, status')
        .eq('status', 'Active')
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Filter out already added suppliers
  const existingSupplierIds = useMemo(() => 
    new Set(existingBids.map(b => b.supplier_id)),
    [existingBids]
  );

  // Filter by search query
  const filteredSuppliers = useMemo(() => {
    if (!allSuppliers) return [];

    return allSuppliers.filter(s => {
      // Already in renegotiation
      if (existingSupplierIds.has(s.id)) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.city?.toLowerCase().includes(query) ||
          s.supplier_type?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allSuppliers, existingSupplierIds, searchQuery]);

  const handleAddSupplier = async (supplierId: string) => {
    await addSupplier.mutateAsync({ materialId, supplierId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t('renegotiation.expandSearch', 'Expand Search - Add New Suppliers')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers by name, city, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Phase 2: Open Market Hunting</strong>
            <p className="mt-1 text-blue-600">
              Add new suppliers to this renegotiation. They will appear as "New Entrant" in the bid comparison.
            </p>
          </div>

          {/* Supplier List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No suppliers match your search' : 'All active suppliers are already in this renegotiation'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {supplier.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {supplier.city}
                            </span>
                          )}
                          {supplier.supplier_type && (
                            <Badge variant="outline" className="text-[10px]">
                              {supplier.supplier_type}
                            </Badge>
                          )}
                          {supplier.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {supplier.rating}/5
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddSupplier(supplier.id)}
                      disabled={addSupplier.isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Already Added Section */}
          {existingBids.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Already in this renegotiation ({existingBids.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {existingBids.map(bid => (
                  <Badge key={bid.id} variant="secondary" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {bid.supplier_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpandedSupplierSearch;
