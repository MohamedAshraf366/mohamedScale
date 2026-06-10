/**
 * Utility functions for computing client-level Overall Interest Level
 * Based on the weighted average of active opportunities' interest levels
 */

export type InterestLevel = 'High' | 'Medium' | 'Low' | 'Not set';

interface OpportunityInterest {
  interest_level: string | null;
  is_closed: boolean | null;
}

/**
 * Convert interest level to numeric score
 */
export const interestToScore = (level: string | null): number => {
  switch (level) {
    case 'High':
      return 3;
    case 'Medium':
      return 2;
    case 'Low':
      return 1;
    default:
      return 0; // None, Not Interested, Not Set
  }
};

/**
 * Convert average score back to interest level
 */
export const scoreToInterest = (avgScore: number): InterestLevel => {
  if (avgScore >= 2.5) return 'High';
  if (avgScore >= 1.5) return 'Medium';
  if (avgScore > 0) return 'Low';
  return 'Not set';
};

/**
 * Calculate the Overall Interest Level for a client based on their active opportunities
 * 
 * @param opportunities - Array of opportunities with interest_level and is_closed fields
 * @returns The calculated overall interest level
 */
export const calculateOverallInterest = (opportunities: OpportunityInterest[]): InterestLevel => {
  // Filter to only active (non-closed) opportunities with valid interest levels
  const activeOpportunities = opportunities.filter(
    opp => !opp.is_closed && opp.interest_level && ['High', 'Medium', 'Low'].includes(opp.interest_level)
  );
  
  if (activeOpportunities.length === 0) {
    return 'Not set';
  }
  
  // Calculate average score
  const totalScore = activeOpportunities.reduce(
    (sum, opp) => sum + interestToScore(opp.interest_level),
    0
  );
  const avgScore = totalScore / activeOpportunities.length;
  
  return scoreToInterest(avgScore);
};

/**
 * Get tooltip text for Overall Interest badge
 */
export const getOverallInterestTooltip = (): string => {
  return 'Auto-calculated from active opportunities. Not editable.';
};
