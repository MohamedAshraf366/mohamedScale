import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMemo } from 'react';

export interface RenegotiationBid {
  id: string;
  renegotiation_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_role: 'selected' | 'backup' | 'new_entrant';
  current_price: number | null;
  new_bid: number | null;
  quality_rating: number | null;
  bid_submitted_at: string | null;
  notes: string | null;
}

export interface SupplierRoleSwapRecommendation {
  currentSelected: RenegotiationBid | null;
  challenger: RenegotiationBid;
  priceImprovement: number;
  qualityMet: boolean;
  reason: string;
}

// Get suppliers linked to material (Selected + Backup from material_alt_suppliers)
export const useMaterialSuppliers = (materialId: string | null) => {
  return useQuery({
    queryKey: ['material-suppliers', materialId],
    queryFn: async () => {
      if (!materialId) return { selected: null, backups: [] };

      // Get main supplier (selected)
      const { data: material } = await supabase
        .from('materials')
        .select('main_supplier_id, suppliers:main_supplier_id(id, name, rating)')
        .eq('id', materialId)
        .maybeSingle();

      // Get backup suppliers from material_alt_suppliers
      const { data: altSuppliers } = await supabase
        .from('material_alt_suppliers')
        .select(`
          id,
          supplier_id,
          unit_price,
          suppliers:supplier_id(id, name, rating)
        `)
        .eq('material_id', materialId);

      return {
        selected: material?.suppliers ? {
          id: (material.suppliers as { id: string }).id,
          name: (material.suppliers as { name: string }).name,
          rating: (material.suppliers as { rating: number | null }).rating,
        } : null,
        backups: (altSuppliers || []).map(alt => ({
          id: (alt.suppliers as { id: string }).id,
          name: (alt.suppliers as { name: string }).name,
          rating: (alt.suppliers as { rating: number | null }).rating,
          currentPrice: alt.unit_price,
        })),
      };
    },
    enabled: !!materialId,
  });
};

// Get bids for a renegotiation (from material_unlock_suppliers linked to renegotiation)
export const useRenegotiationBids = (renegotiationId: string | null) => {
  return useQuery({
    queryKey: ['renegotiation-bids', renegotiationId],
    queryFn: async () => {
      if (!renegotiationId) return [];

      // First get the renegotiation to find material info
      const { data: renegotiation } = await supabase
        .from('material_renegotiations')
        .select('material_id, supplier_id')
        .eq('id', renegotiationId)
        .maybeSingle();

      if (!renegotiation) return [];

      // Get unlock suppliers linked to this renegotiation
      // We'll use a cycle that matches the renegotiation
      const { data: cycle } = await supabase
        .from('material_unlock_cycles')
        .select('id')
        .eq('material_id', renegotiation.material_id)
        .eq('is_renegotiation', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (!cycle) return [];

      const { data: unlockSuppliers } = await supabase
        .from('material_unlock_suppliers')
        .select(`
          id,
          supplier_id,
          quoted_price,
          quality_rating,
          notes,
          quoted_at,
          suppliers:supplier_id(id, name, rating)
        `)
        .eq('cycle_id', cycle.id);

      // Get main supplier to determine roles
      const { data: material } = await supabase
        .from('materials')
        .select('main_supplier_id')
        .eq('id', renegotiation.material_id)
        .maybeSingle();

      const { data: altSuppliers } = await supabase
        .from('material_alt_suppliers')
        .select('supplier_id, unit_price')
        .eq('material_id', renegotiation.material_id);

      const backupIds = new Set(altSuppliers?.map(a => a.supplier_id) || []);

      return (unlockSuppliers || []).map(us => {
        const supplierId = us.supplier_id;
        let role: 'selected' | 'backup' | 'new_entrant' = 'new_entrant';
        
        if (material?.main_supplier_id === supplierId) {
          role = 'selected';
        } else if (backupIds.has(supplierId)) {
          role = 'backup';
        }

        // Find current price from alt_suppliers
        const altSupplier = altSuppliers?.find(a => a.supplier_id === supplierId);

        return {
          id: us.id,
          renegotiation_id: renegotiationId,
          supplier_id: supplierId,
          supplier_name: (us.suppliers as { name: string })?.name || 'Unknown',
          supplier_role: role,
          current_price: altSupplier?.unit_price || null,
          new_bid: us.quoted_price,
          quality_rating: us.quality_rating,
          bid_submitted_at: us.quoted_at,
          notes: us.notes,
        } as RenegotiationBid;
      });
    },
    enabled: !!renegotiationId,
  });
};

// Create unlock cycle for renegotiation and add initial suppliers
export const useInitializeRenegotiationBids = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { renegotiationId: string; materialId: string }) => {
      // Check if cycle already exists
      const { data: existingCycle } = await supabase
        .from('material_unlock_cycles')
        .select('id')
        .eq('material_id', data.materialId)
        .eq('is_renegotiation', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      let cycleId = existingCycle?.id;

      if (!cycleId) {
        // Create unlock cycle for this renegotiation
        const { data: newCycle, error: cycleError } = await supabase
          .from('material_unlock_cycles')
          .insert({
            material_id: data.materialId,
            is_renegotiation: true,
            cycle_status: 'collecting_quotes',
            unlock_status: 'in_progress',
          })
          .select()
          .single();

        if (cycleError) throw cycleError;
        cycleId = newCycle.id;
      }

      // Get selected and backup suppliers
      const { data: material } = await supabase
        .from('materials')
        .select('main_supplier_id')
        .eq('id', data.materialId)
        .maybeSingle();

      const { data: altSuppliers } = await supabase
        .from('material_alt_suppliers')
        .select('supplier_id')
        .eq('material_id', data.materialId);

      const supplierIds = new Set<string>();
      if (material?.main_supplier_id) supplierIds.add(material.main_supplier_id);
      altSuppliers?.forEach(a => supplierIds.add(a.supplier_id));

      // Check which suppliers already exist in this cycle
      const { data: existingSuppliers } = await supabase
        .from('material_unlock_suppliers')
        .select('supplier_id')
        .eq('cycle_id', cycleId);

      const existingIds = new Set(existingSuppliers?.map(e => e.supplier_id) || []);

      // Add new suppliers
      const newSuppliers = Array.from(supplierIds)
        .filter(id => !existingIds.has(id))
        .map(supplierId => ({
          cycle_id: cycleId,
          supplier_id: supplierId,
          status: 'collecting_quotes',
        }));

      if (newSuppliers.length > 0) {
        const { error } = await supabase
          .from('material_unlock_suppliers')
          .insert(newSuppliers);

        if (error) throw error;
      }

      return { cycleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiation-bids'] });
      toast.success('Bid event initialized');
    },
    onError: (error) => {
      toast.error('Failed to initialize: ' + error.message);
    },
  });
};

// Update a bid
export const useUpdateBid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; new_bid?: number; quality_rating?: number; notes?: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.new_bid !== undefined) {
        updateData.quoted_price = data.new_bid;
        updateData.quoted_at = new Date().toISOString();
      }
      if (data.quality_rating !== undefined) updateData.quality_rating = data.quality_rating;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const { error } = await supabase
        .from('material_unlock_suppliers')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiation-bids'] });
    },
  });
};

// Add new supplier to renegotiation (Phase 2 - Expand Search)
export const useAddSupplierToRenegotiation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { materialId: string; supplierId: string }) => {
      // Find the renegotiation cycle
      const { data: cycle } = await supabase
        .from('material_unlock_cycles')
        .select('id')
        .eq('material_id', data.materialId)
        .eq('is_renegotiation', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (!cycle) throw new Error('No active renegotiation cycle found');

      // Check if supplier already exists
      const { data: existing } = await supabase
        .from('material_unlock_suppliers')
        .select('id')
        .eq('cycle_id', cycle.id)
        .eq('supplier_id', data.supplierId)
        .maybeSingle();

      if (existing) throw new Error('Supplier already in this renegotiation');

      const { error } = await supabase
        .from('material_unlock_suppliers')
        .insert({
          cycle_id: cycle.id,
          supplier_id: data.supplierId,
          status: 'collecting_quotes',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiation-bids'] });
      toast.success('Supplier added to renegotiation');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

// Calculate supplier role swap recommendations
export const useSupplierSwapRecommendation = (
  bids: RenegotiationBid[],
  managementTarget: number | null
) => {
  return useMemo(() => {
    if (!bids.length || !managementTarget) return null;

    const selectedBid = bids.find(b => b.supplier_role === 'selected');
    const selectedPrice = selectedBid?.new_bid || selectedBid?.current_price;

    // Find best challenger (backup or new entrant)
    const challengers = bids.filter(b => 
      b.supplier_role !== 'selected' && 
      b.new_bid !== null &&
      b.new_bid <= managementTarget
    );

    if (!challengers.length) return null;

    // Sort by weighted score (70% price, 30% quality)
    const scoredChallengers = challengers.map(c => {
      const priceScore = managementTarget > 0 
        ? Math.max(0, 100 - ((c.new_bid! / managementTarget) * 100 - 100))
        : 50;
      const qualityScore = (c.quality_rating || 3) * 20; // 1-5 -> 20-100
      const weightedScore = (priceScore * 0.7) + (qualityScore * 0.3);

      return { ...c, weightedScore };
    }).sort((a, b) => b.weightedScore - a.weightedScore);

    const bestChallenger = scoredChallengers[0];

    // Check if challenger beats selected
    if (!selectedPrice || bestChallenger.new_bid! < selectedPrice) {
      const qualityMet = (bestChallenger.quality_rating || 0) >= 3; // 3/5 minimum
      const priceImprovement = selectedPrice 
        ? ((selectedPrice - bestChallenger.new_bid!) / selectedPrice) * 100
        : 0;

      if (qualityMet || priceImprovement > 15) {
        return {
          currentSelected: selectedBid || null,
          challenger: bestChallenger,
          priceImprovement,
          qualityMet,
          reason: qualityMet 
            ? `${bestChallenger.supplier_name} offers ${priceImprovement.toFixed(1)}% savings with acceptable quality`
            : `${bestChallenger.supplier_name} offers significant savings (${priceImprovement.toFixed(1)}%) - verify quality before swap`,
        } as SupplierRoleSwapRecommendation;
      }
    }

    return null;
  }, [bids, managementTarget]);
};
