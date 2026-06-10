import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'created' 
  | 'updated' 
  | 'deleted'
  | 'status_changed'
  | 'assigned'
  | 'role_changed'
  | 'auto_created'
  | 'deal_closed';

export type AuditModule = 
  | 'Communications'
  | 'Pipeline'
  | 'Materials'
  | 'Suppliers'
  | 'Follow-ups'
  | 'Tasks'
  | 'Categories'
  | 'Scale KPIs'
  | 'Users'
  | 'Settings'
  | 'System'
  | 'Initial Conversations'
  | 'Clients'
  | 'Projects'
  | 'Opportunities';

interface AuditLogParams {
  action: AuditAction;
  module: AuditModule;
  recordId: string;
  recordName?: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  description?: string;
}

// Fields that should never be logged for security
const SENSITIVE_FIELDS = ['password', 'password_hash', 'secret', 'token', 'api_key'];

/**
 * Sanitizes values to remove or mask sensitive fields
 */
function sanitizeValues(values: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!values) return null;
  
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(values)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Computes a diff between old and new values, returning only changed fields
 */
function computeChanges(
  oldValues: Record<string, any> | null | undefined,
  newValues: Record<string, any> | null | undefined
): Record<string, { old: any; new: any }> | null {
  if (!oldValues || !newValues) return null;

  const changes: Record<string, { old: any; new: any }> = {};

  // Check all keys from new values
  for (const key of Object.keys(newValues)) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Skip if both are null/undefined
    if (oldVal == null && newVal == null) continue;

    // Check if it's a sensitive field
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      if (oldVal !== newVal) {
        changes[key] = { old: '[REDACTED]', new: '[CHANGED]' };
      }
      continue;
    }

    // Compare values (stringify for deep comparison)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  // Check for removed keys
  for (const key of Object.keys(oldValues)) {
    if (!(key in newValues) && oldValues[key] != null) {
      if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
        changes[key] = { old: '[REDACTED]', new: null };
      } else {
        changes[key] = { old: oldValues[key], new: null };
      }
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Logs an audit entry for any CRUD operation
 */
export async function logAudit({
  action,
  module,
  recordId,
  recordName,
  oldValues,
  newValues,
  description,
}: AuditLogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Audit log skipped: No authenticated user');
      return;
    }

    // Sanitize values before storing
    const sanitizedOldValues = sanitizeValues(oldValues);
    const sanitizedNewValues = sanitizeValues(newValues);

    // Compute changes for updates
    const changes = action === 'updated' || action === 'status_changed' || action === 'role_changed'
      ? computeChanges(sanitizedOldValues, sanitizedNewValues) 
      : null;

    // Skip logging updates with no actual changes
    if ((action === 'updated' || action === 'status_changed') && !changes) {
      return;
    }

    // Generate description if not provided
    let finalDescription = description;
    if (!finalDescription) {
      switch (action) {
        case 'created':
          finalDescription = `${recordName || 'Record'} was created in ${module}`;
          break;
        case 'updated':
          const changedFields = changes ? Object.keys(changes).join(', ') : 'fields';
          finalDescription = `${recordName || 'Record'} was updated: ${changedFields}`;
          break;
        case 'deleted':
          finalDescription = `${recordName || 'Record'} was deleted from ${module}`;
          break;
        case 'status_changed':
          const statusChange = changes?.status || changes?.current_phase;
          if (statusChange) {
            finalDescription = `Status changed from "${statusChange.old}" to "${statusChange.new}"`;
          } else {
            finalDescription = `${recordName || 'Record'} status was changed`;
          }
          break;
        case 'assigned':
          const assignment = changes?.assigned_to || changes?.owner_id;
          if (assignment) {
            finalDescription = `${recordName || 'Record'} assigned to ${assignment.new}`;
          } else {
            finalDescription = `${recordName || 'Record'} was assigned`;
          }
          break;
        case 'role_changed':
          const roleChange = changes?.role;
          if (roleChange) {
            finalDescription = `Role changed from "${roleChange.old}" to "${roleChange.new}"`;
          } else {
            finalDescription = `${recordName || 'User'} role was changed`;
          }
          break;
        case 'auto_created':
          finalDescription = `${recordName || 'Record'} was automatically created in ${module}`;
          break;
      }
    }

    const { error } = await supabase.from('audit_log').insert({
      action,
      module,
      record_id: recordId,
      record_name: recordName || null,
      user_id: user.id,
      old_values: sanitizedOldValues || null,
      new_values: sanitizedNewValues || null,
      changes: changes || null,
      description: finalDescription,
    });

    if (error) {
      console.error('Failed to log audit entry:', error);
    }
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

/**
 * Helper to extract a display name from a record based on common field patterns
 */
export function getRecordName(record: Record<string, any>, module: AuditModule): string {
  switch (module) {
    case 'Communications':
    case 'Pipeline':
      return record.company_name || record.person_name || 'Communication';
    case 'Materials':
      return record.name || 'Material';
    case 'Suppliers':
      return record.name || 'Supplier';
    case 'Follow-ups':
      return record.action || 'Follow-up';
    case 'Tasks':
      return record.title || record.action || 'Task';
    case 'Categories':
      return record.name || 'Category';
    case 'Scale KPIs':
      return record.kpi_name || record.metric || 'KPI Target';
    case 'Users':
      return record.full_name || record.email || 'User';
    case 'Settings':
      return record.name || record.key || 'Setting';
    case 'System':
      return record.name || 'System Event';
    case 'Clients':
      return record.company_name || 'Client';
    case 'Projects':
      return record.name || 'Project';
    case 'Opportunities':
      return record.name || 'Opportunity';
    default:
      return 'Record';
  }
}

/**
 * Helper to determine if a status field changed
 */
export function detectStatusChange(
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null
): boolean {
  if (!oldValues || !newValues) return false;
  
  const statusFields = ['status', 'current_phase', 'interest_level', 'priority'];
  return statusFields.some(field => 
    oldValues[field] !== newValues[field] && newValues[field] !== undefined
  );
}

/**
 * Helper to determine the appropriate action type based on changes
 */
export function determineAction(
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null,
  defaultAction: AuditAction = 'updated'
): AuditAction {
  if (!oldValues || !newValues) return defaultAction;
  
  // Check for status change
  if (detectStatusChange(oldValues, newValues)) {
    return 'status_changed';
  }
  
  // Check for assignment change
  if (oldValues.assigned_to !== newValues.assigned_to || oldValues.owner_id !== newValues.owner_id) {
    return 'assigned';
  }
  
  // Check for role change
  if (oldValues.role !== newValues.role) {
    return 'role_changed';
  }
  
  return defaultAction;
}
