import { useMemo } from 'react';

export interface SupplierCoverage {
  supplierId: string;
  supplierName: string;
  coverageZones: string[];
  weightedScore: number;
  status: string;
}

export interface CoverageGap {
  zoneId: string;
  zoneName: string;
}

export interface BestMixResult {
  suppliers: SupplierCoverage[];
  coveredZones: string[];
  averageScore: number;
  coveragePercentage: number;
}

export interface CoverageAdvisorResult {
  negotiatingSuppliers: SupplierCoverage[];
  coveredZones: string[];
  missingZones: CoverageGap[];
  coveragePercentage: number;
  bestMix: BestMixResult | null;
}

/**
 * Greedy algorithm to find optimal supplier mix for zone coverage
 * Prioritizes coverage first, then weighted score
 */
const findBestMix = (
  suppliers: SupplierCoverage[],
  allZones: { id: string; name: string }[]
): BestMixResult | null => {
  if (suppliers.length === 0 || allZones.length === 0) return null;

  const allZoneIds = new Set(allZones.map(z => z.id));
  const selectedSuppliers: SupplierCoverage[] = [];
  const coveredZones = new Set<string>();

  // Sort suppliers by coverage count (desc) then by weighted score (desc)
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const aNewCoverage = a.coverageZones.filter(z => !coveredZones.has(z)).length;
    const bNewCoverage = b.coverageZones.filter(z => !coveredZones.has(z)).length;
    if (bNewCoverage !== aNewCoverage) return bNewCoverage - aNewCoverage;
    return b.weightedScore - a.weightedScore;
  });

  // Greedy selection
  for (const supplier of sortedSuppliers) {
    const newZones = supplier.coverageZones.filter(z => !coveredZones.has(z) && allZoneIds.has(z));
    
    if (newZones.length > 0 || selectedSuppliers.length === 0) {
      selectedSuppliers.push(supplier);
      newZones.forEach(z => coveredZones.add(z));
    }

    // Check if we have 100% coverage
    if (coveredZones.size >= allZoneIds.size) break;
  }

  const averageScore = selectedSuppliers.length > 0
    ? selectedSuppliers.reduce((sum, s) => sum + s.weightedScore, 0) / selectedSuppliers.length
    : 0;

  return {
    suppliers: selectedSuppliers,
    coveredZones: Array.from(coveredZones),
    averageScore: Math.round(averageScore),
    coveragePercentage: allZoneIds.size > 0 
      ? Math.round((coveredZones.size / allZoneIds.size) * 100) 
      : 0,
  };
};

export const useCoverageAdvisor = (
  suppliers: SupplierCoverage[],
  allZones: { id: string; name: string }[]
): CoverageAdvisorResult => {
  return useMemo(() => {
    // Filter to only negotiating suppliers
    const negotiatingSuppliers = suppliers.filter(s => s.status === 'negotiating');

    // Get all covered zones from negotiating suppliers
    const coveredZonesSet = new Set<string>();
    negotiatingSuppliers.forEach(s => {
      s.coverageZones.forEach(z => coveredZonesSet.add(z));
    });
    const coveredZones = Array.from(coveredZonesSet);

    // Find missing zones
    const missingZones: CoverageGap[] = allZones
      .filter(z => !coveredZonesSet.has(z.id))
      .map(z => ({ zoneId: z.id, zoneName: z.name }));

    // Calculate coverage percentage
    const coveragePercentage = allZones.length > 0
      ? Math.round((coveredZones.length / allZones.length) * 100)
      : 100;

    // Find best mix using all eligible suppliers (filtering + negotiating)
    const eligibleSuppliers = suppliers.filter(
      s => s.status === 'filtering' || s.status === 'negotiating'
    );
    const bestMix = findBestMix(eligibleSuppliers, allZones);

    return {
      negotiatingSuppliers,
      coveredZones,
      missingZones,
      coveragePercentage,
      bestMix,
    };
  }, [suppliers, allZones]);
};

export default useCoverageAdvisor;
