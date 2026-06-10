import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, format, isBefore, startOfDay, nextSunday } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, X, CalendarClock, AlertTriangle, 
  Bell, Lightbulb, Clock, FolderOpen
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AttachmentPreview from '@/components/AttachmentPreview';
import { COMMUNICATION_CHANNELS } from '@/constants/communicationChannels';
import { logAudit, determineAction } from '@/lib/auditLogger';

// Follow-up type options with auto-suggestions
const FOLLOW_UP_TYPES = [
  { value: 'send_quotation', label: 'Send Quotation', suggestion: 'Send updated quotation to the client.' },
  { value: 'update_prices', label: 'Update Prices', suggestion: 'Update and share the latest pricing information.' },
  { value: 'visit_site', label: 'Visit Site', suggestion: 'Schedule and conduct a site visit.' },
  { value: 'collect_boq', label: 'Collect BOQ', suggestion: 'Collect Bill of Quantities from the client.' },
  { value: 'follow_up_after_offer', label: 'Follow-up After Offer', suggestion: 'Follow up on the submitted offer/proposal.' },
  { value: 'closing_attempt', label: 'Closing Attempt', suggestion: 'Attempt to close the deal with final terms.' },
  { value: 'general', label: 'General Follow-up', suggestion: 'General follow-up to maintain relationship.' },
  { value: 'other', label: 'Other', suggestion: '' },
];

const OUTCOME_OPTIONS = [
  { value: 'reached_positive', label: 'Reached – Positive' },
  { value: 'reached_neutral', label: 'Reached – Neutral' },
  { value: 'reached_negative', label: 'Reached – Negative' },
  { value: 'not_reached', label: 'Not Reached' },
  { value: 'postponed', label: 'Postponed' },
];

// Map UI status to database enum values
// Database enum: Open, Closed, In Follow-up
// UI values: Open, Done, Cancelled
const mapStatusToDb = (uiStatus: string): 'Open' | 'Closed' | 'In Follow-up' => {
  switch (uiStatus) {
    case 'Done':
      return 'Closed';
    case 'Cancelled':
      return 'Closed';
    case 'Open':
    default:
      return 'Open';
  }
};

// Map database status to UI status
const mapStatusFromDb = (dbStatus: string | null): string => {
  // The database only has Open/Closed/In Follow-up, but we display Open/Done/Cancelled
  // For display purposes, we keep the original mapping
  if (dbStatus === 'Closed') return 'Done';
  return dbStatus || 'Open';
};

// Objection-based suggestions for "Not Interested" clients
const OBJECTION_SUGGESTIONS: Record<string, { action: string; message: string }> = {
  'Not Interested': {
    action: 'Send a short thank-you message with the Scale profile and ask when would be a better time to reconnect.',
    message: 'No problem at all. When would be a suitable time for us to follow up with you again?',
  },
  'Price Too High': {
    action: 'Thank the client and briefly explain the value: better quality + faster and more reliable delivery. Ask if they would like a comparison breakdown.',
    message: 'We understand your concern. Our pricing reflects higher quality, faster delivery, and more reliable supply — helping reduce delays and issues on site.',
  },
  'Specific Requirements Needed': {
    action: 'Send a thank-you message and ask for the exact specs / approval requirements so we can check compliance and share certificates.',
    message: 'Our products meet the required standards. I can share certificates and technical documentation, or coordinate with your technical team for approval if needed.',
  },
  'Payment Terms Issue': {
    action: 'Thank the client and explain that our 3–5 day payment window is flexible and can improve with repeated business.',
    message: 'We can keep things simple: our 3–5 day payment cycle is straightforward, and as our relationship grows we can explore more flexible options that fit your process.',
  },
};

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communication: {
    id: string;
    follow_up_date: string | null;
    status: string;
    action: string | null;
    notes: string | null;
    quotation_required?: boolean | null;
    summary?: string | null;
    current_phase?: string | null;
    company_name?: string | null;
    interest_level?: string | null;
    objection_type?: string | null;
    opportunity_id?: string | null;
  };
  clientId?: string;
  onSaved: () => void;
  editingFollowUp?: {
    id: string;
    follow_up_date: string;
    status_after: string | null;
    action: string | null;
    notes: string | null;
    priority?: string | null;
    follow_up_type?: string | null;
    outcome?: string | null;
    reminder_enabled?: boolean;
    attachments?: string[];
    follow_up_channel?: string | null;
    client_response?: string | null;
    opportunity_id?: string | null;
  } | null;
}

interface Opportunity {
  id: string;
  name: string;
}

interface FollowUpEntry {
  id: string;
  follow_up_date: string;
  status: string;
  action: string;
  notes: string;
  priority: string;
  follow_up_type: string;
  outcome: string;
  reminder_enabled: boolean;
  attachments: string[];
  follow_up_channel: string;
  client_response: string;
  opportunity_id: string;
}

interface PreviousFollowUp {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  action: string | null;
}

const FollowUpDialog = ({
  open,
  onOpenChange,
  communication,
  clientId,
  onSaved,
  editingFollowUp = null,
}: FollowUpDialogProps) => {
  const [followUpEntries, setFollowUpEntries] = useState<FollowUpEntry[]>([
    {
      id: '1',
      follow_up_date: '',
      status: 'Open',
      action: '',
      notes: '',
      priority: 'Medium',
      follow_up_type: '',
      outcome: '',
      reminder_enabled: false,
      attachments: [],
      follow_up_channel: '',
      client_response: '',
      opportunity_id: communication.opportunity_id || '',
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previousFollowUps, setPreviousFollowUps] = useState<PreviousFollowUp[]>([]);
  const [pipelineDeal, setPipelineDeal] = useState<{ id: string; company_name: string } | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);
  const [dragActiveEntry, setDragActiveEntry] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const isEditMode = !!editingFollowUp;
  const isNotInterested = communication.interest_level === 'Not interested';
  const objectionType = communication.objection_type;
  
  // Get suggestion based on objection type
  const getObjectionSuggestion = () => {
    if (!objectionType) return null;
    return OBJECTION_SUGGESTIONS[objectionType] || null;
  };

  // Fetch previous follow-ups and projects
  useEffect(() => {
    if (open && communication.id) {
      fetchPreviousFollowUps();
      checkPipelineDeal();
      fetchOpportunities();
    }
  }, [open, communication.id, clientId]);

  const fetchOpportunities = async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('opportunities')
      .select('id, name')
      .eq('client_id', clientId)
      .eq('is_closed', false)
      .order('name', { ascending: true });
    if (data) setOpportunities(data);
  };

  const fetchPreviousFollowUps = async () => {
    const today = new Date().toISOString().split('T')[0]; // Get date only (YYYY-MM-DD)
    
    // Only fetch past follow-ups (those with dates before today)
    const { data } = await supabase
      .from('follow_up_history')
      .select('id, follow_up_date, status_after, action')
      .eq('communication_log_id', communication.id)
      .lt('follow_up_date', today)
      .order('follow_up_date', { ascending: false })
      .limit(3);
    
    if (data) {
      setPreviousFollowUps(data);
    }
  };

  const checkPipelineDeal = async () => {
    if (communication.interest_level && ['High', 'Medium', 'Low'].includes(communication.interest_level)) {
      setPipelineDeal({
        id: communication.id,
        company_name: communication.company_name || 'Unknown',
      });
    } else {
      setPipelineDeal(null);
    }
  };

  // Generate AI recommendation based on context
  const getAiRecommendation = (): string | null => {
    if (!communication) return null;
    
    const interestLevel = communication.interest_level?.toLowerCase();
    const hasQuotation = communication.quotation_required;
    
    if (interestLevel === 'high') {
      return "Client showed high interest. Prioritize this follow-up and consider a closing attempt.";
    } else if (interestLevel === 'medium') {
      return "Client showed medium interest. Suggest sharing updated pricing or additional value.";
    } else if (interestLevel === 'low') {
      return "Client interest is low. Consider sending educational content or industry news.";
    } else if (interestLevel === 'not interested') {
      return objectionType 
        ? "Use the suggested follow-up below or write a custom one."
        : "Set an objection type on the communication to get a suggested follow-up.";
    } else if (hasQuotation) {
      return "Quotation was requested. Follow up within 3 days to address any questions.";
    }
    return "Maintain regular contact to build relationship and uncover needs.";
  };

  // Handle applying objection suggestion
  const handleApplySuggestion = (entryId: string) => {
    const suggestion = getObjectionSuggestion();
    if (!suggestion) return;
    
    const followUpDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    
    setFollowUpEntries(
      followUpEntries.map((entry) =>
        entry.id === entryId
          ? { 
              ...entry, 
              follow_up_date: followUpDate,
              action: suggestion.action,
              notes: suggestion.message,
              status: 'Open'
            }
          : entry
      )
    );
    
    toast.success('Suggested follow-up applied. You can edit before saving.');
  };

  // Handle follow-up type change with auto-suggestion
  const handleFollowUpTypeChange = (entryId: string, typeValue: string) => {
    const typeConfig = FOLLOW_UP_TYPES.find(t => t.value === typeValue);
    
    setFollowUpEntries(
      followUpEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        
        const updates: Partial<FollowUpEntry> = { follow_up_type: typeValue };
        
        if (!entry.action && typeConfig?.suggestion) {
          updates.action = typeConfig.suggestion;
        }
        
        return { ...entry, ...updates };
      })
    );
  };

  // Quick date buttons
  const handleQuickDate = (entryId: string, option: 'today' | '+2days' | '+1week' | 'nextSunday') => {
    let date: Date;
    const today = new Date();
    
    switch (option) {
      case 'today':
        date = today;
        break;
      case '+2days':
        date = addDays(today, 2);
        break;
      case '+1week':
        date = addDays(today, 7);
        break;
      case 'nextSunday':
        date = nextSunday(today);
        break;
    }
    
    updateFollowUpEntry(entryId, 'follow_up_date', format(date, 'yyyy-MM-dd'));
  };

  // Handle file upload
  const handleFileUpload = async (entryId: string, files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    
    const entry = followUpEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const fileArray = Array.from(files);
    
    if (entry.attachments.length + fileArray.length > 5) {
      toast.error('Maximum 5 files per follow-up');
      return;
    }
    
    setUploadingFiles(true);
    const newAttachments: string[] = [...entry.attachments];
    
    try {
      for (const file of fileArray) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${communication.id}/${fileName}`;
        
        const { error } = await supabase.storage
          .from('follow-up-attachments')
          .upload(filePath, file);
        
        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        
        newAttachments.push(filePath);
      }
      
      setFollowUpEntries(
        followUpEntries.map((e) =>
          e.id === entryId ? { ...e, attachments: newAttachments } : e
        )
      );
      
      toast.success('Files uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveEntry(entryId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveEntry(null);
  };

  const handleDrop = async (e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveEntry(null);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.xlsx', '.xls'];
      const validFiles: File[] = [];
      
      for (const file of Array.from(droppedFiles)) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (allowedTypes.includes(ext)) {
          validFiles.push(file);
        } else {
          toast.error(`${file.name} is not a supported file type`);
        }
      }
      
      if (validFiles.length > 0) {
        await handleFileUpload(entryId, validFiles);
      }
    }
  };

  // Remove attachment
  const removeAttachment = async (entryId: string, filePath: string) => {
    try {
      await supabase.storage.from('follow-up-attachments').remove([filePath]);
      
      setFollowUpEntries(
        followUpEntries.map((e) =>
          e.id === entryId
            ? { ...e, attachments: e.attachments.filter(a => a !== filePath) }
            : e
        )
      );
    } catch (error) {
      console.error('Error removing attachment:', error);
    }
  };

  useEffect(() => {
    if (open) {
      if (editingFollowUp) {
        setFollowUpEntries([
          {
            id: editingFollowUp.id,
            follow_up_date: editingFollowUp.follow_up_date 
              ? editingFollowUp.follow_up_date.split('T')[0] 
              : '',
            status: editingFollowUp.status_after || 'Open',
            action: editingFollowUp.action || '',
            notes: editingFollowUp.notes || '',
            priority: editingFollowUp.priority || 'Medium',
            follow_up_type: editingFollowUp.follow_up_type || '',
            outcome: editingFollowUp.outcome || '',
            reminder_enabled: editingFollowUp.reminder_enabled || false,
            attachments: editingFollowUp.attachments || [],
            follow_up_channel: editingFollowUp.follow_up_channel || '',
            client_response: editingFollowUp.client_response || '',
            opportunity_id: editingFollowUp.opportunity_id || communication.opportunity_id || '',
          },
        ]);
      } else {
        setFollowUpEntries([
          {
            id: '1',
            follow_up_date: '',
            status: 'Open',
            action: '',
            notes: '',
            priority: 'Medium',
            follow_up_type: '',
            outcome: '',
            reminder_enabled: false,
            attachments: [],
            follow_up_channel: '',
            client_response: '',
            opportunity_id: communication.opportunity_id || '',
          },
        ]);
      }
      setErrors({});
      setShowAiSuggestion(true);
    }
  }, [open, editingFollowUp, communication.opportunity_id]);

  const addFollowUpEntry = () => {
    const newEntry: FollowUpEntry = {
      id: Date.now().toString(),
      follow_up_date: '',
      status: 'Open',
      action: '',
      notes: '',
      priority: 'Medium',
      follow_up_type: '',
      outcome: '',
      reminder_enabled: false,
      attachments: [],
      follow_up_channel: '',
      client_response: '',
      opportunity_id: communication.opportunity_id || '',
    };
    setFollowUpEntries([...followUpEntries, newEntry]);
  };

  const removeFollowUpEntry = (id: string) => {
    if (followUpEntries.length > 1) {
      setFollowUpEntries(followUpEntries.filter((entry) => entry.id !== id));
    }
  };

  const updateFollowUpEntry = (id: string, field: keyof FollowUpEntry, value: string | boolean | string[]) => {
    setFollowUpEntries(
      followUpEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  // Validation - allow past dates but flag them
  const validateEntry = (entry: FollowUpEntry): string[] => {
    const errors: string[] = [];
    
    if (!entry.follow_up_channel) {
      errors.push('Follow-up channel is required');
    }
    
    // Remove past date blocking - now allowed with warning indicator
    
    if (entry.follow_up_type === 'send_quotation' && !entry.attachments.length && !entry.notes) {
      errors.push('Send Quotation requires an attachment or note');
    }
    
    return errors;
  };

  // Check if date is in the past
  const isPastDate = (dateString: string): boolean => {
    if (!dateString) return false;
    const entryDate = new Date(dateString);
    return isBefore(entryDate, startOfDay(new Date()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors: Record<string, string> = {};
    followUpEntries.forEach((entry, index) => {
      const entryErrors = validateEntry(entry);
      if (entryErrors.length > 0) {
        validationErrors[`entry-${index}`] = entryErrors.join(', ');
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isEditMode && editingFollowUp) {
        const entry = followUpEntries[0];
        
        const oldValues = {
          follow_up_date: editingFollowUp.follow_up_date,
          status_after: editingFollowUp.status_after,
          action: editingFollowUp.action,
          notes: editingFollowUp.notes,
          priority: editingFollowUp.priority,
          follow_up_type: editingFollowUp.follow_up_type,
          outcome: editingFollowUp.outcome,
          reminder_enabled: editingFollowUp.reminder_enabled,
          follow_up_channel: editingFollowUp.follow_up_channel,
        };
        
        const newValues = {
          follow_up_date: entry.follow_up_date || new Date().toISOString(),
          status_after: entry.status,
          action: entry.action || null,
          notes: entry.notes || null,
          priority: entry.priority,
          follow_up_type: entry.follow_up_type || null,
          outcome: entry.outcome || null,
          reminder_enabled: entry.reminder_enabled,
          follow_up_channel: entry.follow_up_channel || null,
        };
        
        // Log to follow_up_audit_log for detailed follow-up tracking
        await supabase.from('follow_up_audit_log').insert({
          follow_up_id: editingFollowUp.id,
          communication_log_id: communication.id,
          changed_by: user.id,
          action: 'updated',
          old_values: oldValues,
          new_values: newValues,
        });

        // Log to main audit_log for platform-wide tracking
        const auditAction = determineAction(oldValues, newValues);
        await logAudit({
          action: auditAction,
          module: 'Follow-ups',
          recordId: editingFollowUp.id,
          recordName: entry.action || editingFollowUp.action || 'Follow-up',
          oldValues,
          newValues,
        });

        const { error: updateError } = await supabase
          .from('follow_up_history')
          .update({
            follow_up_date: entry.follow_up_date || new Date().toISOString(),
            status_after: mapStatusToDb(entry.status),
            action: entry.action || null,
            notes: entry.notes || null,
            priority: entry.priority,
            follow_up_type: entry.follow_up_type || null,
            outcome: entry.outcome || null,
            reminder_enabled: entry.reminder_enabled,
            attachments: entry.attachments,
            follow_up_channel: entry.follow_up_channel || null,
            client_response: entry.client_response || null,
            opportunity_id: entry.opportunity_id || null,
          })
          .eq('id', editingFollowUp.id);

        if (updateError) throw updateError;

        if (entry.status === 'Done') {
          const { data: allFollowUps } = await supabase
            .from('follow_up_history')
            .select('status_after')
            .eq('communication_log_id', communication.id);
          
          const allClosed = allFollowUps?.every(f => f.status_after === 'Done' || f.status_after === 'Closed');
          
          if (allClosed) {
            const shouldClose = window.confirm(
              'All follow-ups for this communication are now completed. Would you like to close the communication as well?'
            );
            
            if (shouldClose) {
              await supabase
                .from('communication_log')
                .update({ status: 'Closed' })
                .eq('id', communication.id);
              toast.success('Communication status updated to Closed');
            }
          }
        }

        toast.success('Follow-up updated successfully');
      } else {
        const followUpInserts = followUpEntries.map((entry) => ({
          communication_log_id: communication.id,
          follow_up_date: entry.follow_up_date || new Date().toISOString(),
          status_after: mapStatusToDb(entry.status),
          action: entry.action || null,
          notes: entry.notes || null,
          user_id: user.id,
          priority: entry.priority,
          follow_up_type: entry.follow_up_type || null,
          outcome: entry.outcome || null,
          reminder_enabled: entry.reminder_enabled,
          attachments: entry.attachments,
          follow_up_channel: entry.follow_up_channel || null,
          client_response: entry.client_response || null,
          opportunity_id: entry.opportunity_id || null,
        }));

        const { data: insertedData, error: historyError } = await supabase
          .from('follow_up_history')
          .insert(followUpInserts)
          .select();

        if (historyError) throw historyError;

        if (insertedData) {
          // Log to follow_up_audit_log for detailed follow-up tracking
          const auditLogs = insertedData.map((followUp) => ({
            follow_up_id: followUp.id,
            communication_log_id: communication.id,
            changed_by: user.id,
            action: 'created',
            old_values: null,
            new_values: {
              follow_up_date: followUp.follow_up_date,
              status_after: followUp.status_after,
              action: followUp.action,
              notes: followUp.notes,
              priority: followUp.priority,
              follow_up_type: followUp.follow_up_type,
              outcome: followUp.outcome,
              reminder_enabled: followUp.reminder_enabled,
              follow_up_channel: followUp.follow_up_channel,
            },
          }));
          
          await supabase.from('follow_up_audit_log').insert(auditLogs);

          // Log each follow-up to main audit_log for platform-wide tracking
          for (const followUp of insertedData) {
            await logAudit({
              action: 'created',
              module: 'Follow-ups',
              recordId: followUp.id,
              recordName: followUp.action || 'New Follow-up',
              newValues: {
                follow_up_date: followUp.follow_up_date,
                status_after: followUp.status_after,
                action: followUp.action,
                notes: followUp.notes,
                priority: followUp.priority,
                follow_up_type: followUp.follow_up_type,
                outcome: followUp.outcome,
                reminder_enabled: followUp.reminder_enabled,
                follow_up_channel: followUp.follow_up_channel,
              },
            });
          }
        }

        await supabase
          .from('communication_log')
          .update({ status: 'In Follow-up' })
          .eq('id', communication.id);

        toast.success(
          `${followUpEntries.length} follow-up${followUpEntries.length > 1 ? 's' : ''} added successfully`
        );
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error saving follow-up:', error);
      toast.error(isEditMode ? 'Failed to update follow-up' : 'Failed to add follow-ups');
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low':
        return 'text-gray-500 bg-gray-50 border-gray-200';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'text-primary bg-primary/10 border-primary/20';
      case 'Done':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Cancelled':
        return 'text-muted-foreground bg-muted border-border';
      default:
        return 'text-muted-foreground';
    }
  };

  const objectionSuggestion = getObjectionSuggestion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? 'Edit Follow-up' : 'Add Follow-up'}
            {communication.company_name && (
              <span className="text-sm font-normal text-muted-foreground">
                — {communication.company_name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6 py-4 pr-4">
              {/* Previous Follow-ups Preview */}
              {!isEditMode && previousFollowUps.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Previous Follow-ups</span>
                  </div>
                  <div className="space-y-1.5">
                    {previousFollowUps.map((fu) => (
                      <div key={fu.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {format(new Date(fu.follow_up_date), 'MMM dd')}:
                        </span>
                        <span className="truncate flex-1">{fu.action || 'No action specified'}</span>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5", getStatusColor(fu.status_after || 'Open'))}>
                          {fu.status_after || 'Open'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendation */}
              {!isEditMode && showAiSuggestion && getAiRecommendation() && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <span className="text-xs font-medium text-primary">AI Recommendation</span>
                        <p className="text-sm text-foreground mt-0.5">{getAiRecommendation()}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setShowAiSuggestion(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}


              {/* Suggested Follow-up for "Not Interested" clients */}
              {!isEditMode && isNotInterested && objectionSuggestion && (
                <div className="p-4 rounded-lg border bg-amber-50/50 border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarClock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Suggested follow-up based on objection</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Objection:</span> {objectionType}
                    </p>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Action:</span> {objectionSuggestion.action}
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      "{objectionSuggestion.message}"
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleApplySuggestion(followUpEntries[0].id)}
                    >
                      Use Suggested Follow-up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Fill in the form below manually')}
                    >
                      Custom Follow-up
                    </Button>
                  </div>
                </div>
              )}

              {/* No objection type set warning */}
              {!isEditMode && isNotInterested && !objectionType && (
                <div className="p-3 rounded-lg border bg-amber-50/50 border-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-900">
                      No objection type set on this communication. Edit the communication to add an objection type for suggested follow-ups.
                    </span>
                  </div>
                </div>
              )}

              <Separator />

              {followUpEntries.map((entry, index) => (
                <div key={entry.id} className="space-y-4">
                  {!isEditMode && followUpEntries.length > 1 && (
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">
                        Follow-up {index + 1}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFollowUpEntry(entry.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Opportunity Assignment */}
                  {opportunities.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Assign to Opportunity
                      </Label>
                      <Select
                        value={entry.opportunity_id || 'none'}
                        onValueChange={(value) =>
                          updateFollowUpEntry(entry.id, 'opportunity_id', value === 'none' ? '' : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select opportunity..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No opportunity</SelectItem>
                          {opportunities.map((opp) => (
                            <SelectItem key={opp.id} value={opp.id}>
                              {opp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="h-5">Status</Label>
                    <Select
                      value={entry.status}
                      onValueChange={(value) =>
                        updateFollowUpEntry(entry.id, 'status', value)
                      }
                    >
                      <SelectTrigger className={cn("h-10", getStatusColor(entry.status))}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Follow-up Channel (Required) */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Follow-up Channel <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={entry.follow_up_channel}
                      onValueChange={(value) =>
                        updateFollowUpEntry(entry.id, 'follow_up_channel', value)
                      }
                    >
                      <SelectTrigger className={cn(!entry.follow_up_channel && errors[`entry-${followUpEntries.indexOf(entry)}`]?.includes('channel') && 'border-destructive')}>
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_CHANNELS.map((channel) => {
                          const Icon = channel.icon;
                          return (
                            <SelectItem key={channel.value} value={channel.value}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {channel.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Follow-up Date with Quick Buttons */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Follow-up Date
                      {isPastDate(entry.follow_up_date) && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Clock className="h-3 w-3" />
                          Logged late
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={entry.follow_up_date}
                        onChange={(e) =>
                          updateFollowUpEntry(entry.id, 'follow_up_date', e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickDate(entry.id, 'today')}
                      >
                        Today
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickDate(entry.id, '+2days')}
                      >
                        +2 Days
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickDate(entry.id, '+1week')}
                      >
                        +1 Week
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickDate(entry.id, 'nextSunday')}
                      >
                        Next Sunday
                      </Button>
                    </div>
                  </div>

                  {/* Action Required */}
                  <div className="space-y-2">
                    <Label>Action Required</Label>
                    <Textarea
                      value={entry.action}
                      onChange={(e) =>
                        updateFollowUpEntry(entry.id, 'action', e.target.value)
                      }
                      placeholder="What needs to be done?"
                      rows={2}
                    />
                  </div>

                  {/* Client Response */}
                  <div className="space-y-2">
                    <Label>Client Response</Label>
                    <Textarea
                      value={entry.client_response}
                      onChange={(e) =>
                        updateFollowUpEntry(entry.id, 'client_response', e.target.value)
                      }
                      placeholder="What did the client say? (optional)"
                      rows={3}
                    />
                  </div>

                  {/* Reminder Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm cursor-pointer">Enable Reminder</Label>
                        <p className="text-xs text-muted-foreground">Get notified on the follow-up date</p>
                      </div>
                    </div>
                    <Switch
                      checked={entry.reminder_enabled}
                      onCheckedChange={(checked) =>
                        updateFollowUpEntry(entry.id, 'reminder_enabled', checked)
                      }
                    />
                  </div>

                  {/* Outcome (for editing existing follow-ups) */}
                  {isEditMode && (
                    <div className="space-y-2">
                      <Label>Outcome</Label>
                      <Select
                        value={entry.outcome}
                        onValueChange={(value) =>
                          updateFollowUpEntry(entry.id, 'outcome', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select outcome..." />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTCOME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Error display */}
                  {errors[`entry-${index}`] && (
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{errors[`entry-${index}`]}</p>
                    </div>
                  )}

                  {!isEditMode && index < followUpEntries.length - 1 && (
                    <Separator className="my-6" />
                  )}
                </div>
              ))}

              {/* Add another follow-up button */}
              {!isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addFollowUpEntry}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Follow-up
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 sticky bottom-0 bg-background z-10 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditMode ? 'Update Follow-up' : `Save ${followUpEntries.length} Follow-up${followUpEntries.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpDialog;
