/**
 * Hook to calculate weighted score for supplier evaluation
 * Formula: weighted_score = (price_score * 0.7) + (quality_score * 0.3)
 * Price score is inverse-proportional to target price
 */

export interface WeightedScoreParams {
  quotedPrice: number | null;
  targetPrice: number | null;
  qualityRating: number | null; // 1-5 scale
}

export interface WeightedScoreResult {
  priceScore: number;
  qualityScore: number;
  weightedScore: number;
  scoreLevel: 'high' | 'medium' | 'low';
}

export const calculateWeightedScore = ({
  quotedPrice,
  targetPrice,
  qualityRating,
}: WeightedScoreParams): WeightedScoreResult => {
  // Calculate price score (0-100)
  // If quoted price is at or below target, score is 100
  // If quoted price is above target, score decreases proportionally
  let priceScore = 0;
  if (targetPrice && targetPrice > 0 && quotedPrice !== null) {
    if (quotedPrice <= targetPrice) {
      priceScore = 100;
    } else {
      // Score decreases as price exceeds target
      // At 2x target price, score = 0
      const ratio = targetPrice / quotedPrice;
      priceScore = Math.max(0, Math.min(100, ratio * 100));
    }
  } else if (quotedPrice === null && targetPrice) {
    // No quote yet - neutral score
    priceScore = 50;
  }

  // Calculate quality score (0-100)
  // Rating 1-5 maps to 0-100
  const qualityScore = qualityRating ? ((qualityRating - 1) / 4) * 100 : 50;

  // Calculate weighted score
  const weightedScore = (priceScore * 0.7) + (qualityScore * 0.3);

  // Determine score level for color coding
  let scoreLevel: 'high' | 'medium' | 'low' = 'medium';
  if (weightedScore >= 70) {
    scoreLevel = 'high';
  } else if (weightedScore < 50) {
    scoreLevel = 'low';
  }

  return {
    priceScore: Math.round(priceScore),
    qualityScore: Math.round(qualityScore),
    weightedScore: Math.round(weightedScore),
    scoreLevel,
  };
};

export const useWeightedScore = (params: WeightedScoreParams): WeightedScoreResult => {
  return calculateWeightedScore(params);
};

export default useWeightedScore;
