/**
 * Pipeline classification utilities
 * 
 * CORE PRINCIPLE: The Pipeline is OPPORTUNITY-DRIVEN, not client-driven.
 * 
 * HIERARCHY: Client → Project → Opportunity → (Order / Deal)
 * 
 * PIPELINE BEHAVIOR:
 * - Each Opportunity has its own Interest Level
 * - Opportunity Interest Level (High/Medium/Low) = appears in Pipeline
 * - Opportunity Interest Level (None/Not Interested) = stays outside Pipeline
 * - A single Client can have multiple Opportunities in the Pipeline simultaneously
 * 
 * DATA INTEGRITY:
 * - Legacy data (from communication_log) is treated equally with new data
 * - No restrictions on editing/deleting legacy records
 * - All changes are logged to the audit system
 * 
 * UX CLARIFICATION:
 * - Client-level Interest is optional and informational only
 * - Opportunity Interest Level is mandatory and is the single trigger for Pipeline inclusion
 */

// Interest levels that qualify an OPPORTUNITY for the sales pipeline
const PIPELINE_INTEREST_LEVELS = ['High', 'Medium', 'Low'];

// Interest levels that classify an OPPORTUNITY as a Cold Lead
const COLD_LEAD_INTEREST_LEVELS = ['Not interested', null, undefined, ''];

/**
 * Check if an interest level qualifies for the sales pipeline
 * Opportunities with High, Medium, or Low interest are in the pipeline
 */
export const isInPipeline = (interestLevel: string | null | undefined): boolean => {
  if (!interestLevel) return false;
  return PIPELINE_INTEREST_LEVELS.includes(interestLevel);
};

/**
 * Check if an opportunity is classified as a Cold Lead
 * Opportunities with "Not interested" or no interest level set are Cold Leads
 */
export const isColdLead = (interestLevel: string | null | undefined): boolean => {
  return !isInPipeline(interestLevel);
};

/**
 * Get the pipeline status label for display
 */
export const getPipelineStatusLabel = (interestLevel: string | null | undefined): string => {
  if (isInPipeline(interestLevel)) {
    return 'In Pipeline';
  }
  return 'Cold Lead';
};

/**
 * Check if an opportunity qualifies for the pipeline
 * This is the single trigger for Pipeline inclusion
 * 
 * @param opportunityInterestLevel - The interest level of the OPPORTUNITY (not the client)
 */
export const isOpportunityInPipeline = (
  opportunityInterestLevel: string | null | undefined
): boolean => {
  return isInPipeline(opportunityInterestLevel);
};

/**
 * Check if a client can have new opportunities created
 * 
 * All clients can have opportunities created - the opportunity's own
 * interest level will determine pipeline inclusion
 */
export const canCreateOpportunity = (
  isLegacy: boolean,
  clientInterestLevel?: string | null | undefined
): boolean => {
  // All clients can always create opportunities
  return true;
};

/**
 * Check if a client can have new projects created
 * 
 * All clients can have projects created (projects are just containers)
 */
export const canCreateProject = (
  isLegacy: boolean,
  clientInterestLevel?: string | null | undefined
): boolean => {
  // All clients can always create projects
  return true;
};

/**
 * Get all valid pipeline interest levels
 */
export const getPipelineInterestLevels = (): string[] => {
  return [...PIPELINE_INTEREST_LEVELS];
};

/**
 * Check if interest level is valid
 */
export const isValidInterestLevel = (interestLevel: string | null | undefined): boolean => {
  if (!interestLevel) return false;
  return [...PIPELINE_INTEREST_LEVELS, 'Not interested'].includes(interestLevel);
};
