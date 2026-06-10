import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface AuditChangeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: {
    id: string;
    created_at: string;
    action: string;
    module: string;
    record_name: string | null;
    changes: Record<string, { old: any; new: any }> | null;
    old_values: any;
    new_values: any;
    description: string | null;
    profiles?: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
}

const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company Name',
  person_name: 'Person Name',
  contact_info: 'Contact Info',
  communication_date: 'Communication Date',
  communication_channels: 'Channel',
  interest_level: 'Interest Level',
  status: 'Status',
  current_phase: 'Phase',
  project_type: 'Project Type',
  project_size: 'Project Size',
  city: 'City',
  district: 'District',
  location: 'Location',
  category: 'Category',
  topic: 'Topic',
  action: 'Action',
  outcome_notes: 'Outcome Notes',
  notes: 'Notes',
  summary: 'Summary',
  other_projects: 'Other Projects',
  quotation_required: 'Quotation Required',
  deal_completed: 'Deal Completed',
  assigned_to: 'Assigned To',
  owner_id: 'Owner',
  follow_up_date: 'Follow-up Date',
  follow_up_channel: 'Follow-up Channel',
  follow_up_type: 'Follow-up Type',
  client_response: 'Client Response',
  outcome: 'Outcome',
  priority: 'Priority',
  reminder_enabled: 'Reminder',
  full_name: 'Full Name',
  email: 'Email',
  role: 'Role',
  title: 'Title',
  description: 'Description',
  due_date: 'Due Date',
  kpi_name: 'KPI Name',
  period_type: 'Period Type',
  period_value: 'Period Value',
  target_value: 'Target Value',
  explanation: 'Explanation',
  name: 'Name',
  objection_type: 'Objection Type',
  is_general_quotation: 'General Quotation',
  quantity: 'Quantity',
  unit_price: 'Unit Price',
};

function formatFieldName(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : value.join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  
  // Check if it's a date string
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, 'MMM dd, yyyy HH:mm');
      }
    } catch {
      // Fall through to return string
    }
  }
  
  return String(value);
}

function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'created':
    case 'auto_created':
      return 'bg-green-500/15 text-green-600 border-green-500/30';
    case 'updated':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
    case 'deleted':
      return 'bg-red-500/15 text-red-600 border-red-500/30';
    case 'status_changed':
      return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
    case 'assigned':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    case 'role_changed':
      return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function AuditChangeDetailsDialog({ open, onOpenChange, log }: AuditChangeDetailsDialogProps) {
  if (!log) return null;

  const changes = log.changes || {};
  const changeEntries = Object.entries(changes as Record<string, { old: any; new: any }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Change Details
            <Badge className={getActionColor(log.action)} variant="outline">
              {log.action.toUpperCase().replace('_', ' ')}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {log.description || `${log.action} on ${log.module}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta Information */}
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 rounded-lg p-4">
            <div>
              <div className="text-muted-foreground">Module</div>
              <div className="font-medium">{log.module}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Record</div>
              <div className="font-medium">{log.record_name || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Changed By</div>
              <div className="font-medium">
                {log.profiles?.full_name || 'Unknown'}
                {log.profiles?.email && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({log.profiles.email})
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Timestamp</div>
              <div className="font-medium">
                {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
              </div>
            </div>
          </div>

          {/* Changes Table */}
          {changeEntries.length > 0 ? (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Field</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeEntries.map(([field, change]) => (
                    <TableRow key={field}>
                      <TableCell className="font-medium">
                        {formatFieldName(field)}
                      </TableCell>
                      <TableCell className="text-destructive/70 max-w-[200px] break-words">
                        {formatValue(change?.old)}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="text-primary max-w-[200px] break-words">
                        {formatValue(change?.new)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : log.action === 'created' ? (
            <div className="text-center py-8 text-muted-foreground">
              New record created with initial values
            </div>
          ) : log.action === 'deleted' ? (
            <div className="text-center py-8 text-muted-foreground">
              Record was permanently deleted
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No field-level changes recorded
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
