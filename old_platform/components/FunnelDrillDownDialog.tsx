import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Building2, User, Calendar, Filter } from 'lucide-react';

interface FunnelDrillDownDialogProps {
  open: boolean;
  onClose: () => void;
  stageName: string;
  startDate: Date;
  endDate: Date;
}

interface CommunicationRecord {
  id: string;
  company_name: string | null;
  person_name: string | null;
  communication_date: string | null;
  status: string | null;
  category: string | null;
  current_phase: string | null;
  project_size: string | null;
  quotation_required: boolean | null;
  deal_completed: boolean | null;
  summary: string | null;
}

const FunnelDrillDownDialog = ({
  open,
  onClose,
  stageName,
  startDate,
  endDate,
}: FunnelDrillDownDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<CommunicationRecord[]>([]);

  useEffect(() => {
    if (open) {
      fetchRecords();
    }
  }, [open, stageName, startDate, endDate]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('communication_log')
        .select('id, company_name, person_name, communication_date, status, category, current_phase, project_size, quotation_required, deal_completed, summary')
        .gte('communication_date', startDate.toISOString())
        .lte('communication_date', endDate.toISOString())
        .order('communication_date', { ascending: false });

      // Apply filter based on funnel stage
      switch (stageName) {
        case 'Raw Outreach':
          // All records - no additional filter
          break;
        case 'Quotation Requested':
          // Pipeline entries: interest_level is High/Medium/Low OR quotation_required (for legacy records)
          query = query.or('interest_level.in.(High,Medium,Low),quotation_required.eq.true');
          break;
        case 'In Negotiation':
          query = query.or('current_phase.eq.Negotiation,current_phase.eq.Proposal,current_phase.eq.In Progress');
          break;
        case 'Closed Deal':
          query = query.eq('deal_completed', true);
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageKey = () => {
    switch (stageName) {
      case 'Raw Outreach':
        return 'rawOutreach';
      case 'Quotation Requested':
        return 'quotationRequested';
      case 'In Negotiation':
        return 'inNegotiation';
      case 'Closed Deal':
        return 'closedDeal';
      default:
        return 'rawOutreach';
    }
  };

  const stageKey = getStageKey();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t(`drillDown.stages.${stageKey}`)}
          </DialogTitle>
          <DialogDescription>
            {t(`drillDown.stageDescriptions.${stageKey}`)} • {records.length} {records.length === 1 ? t('drillDown.leadsFound', { count: records.length }) : t('drillDown.leadsFound_plural', { count: records.length })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">{t('drillDown.loading')}</div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">{t('drillDown.noLeadsFound')}</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('drillDown.company')}</TableHead>
                  <TableHead>{t('drillDown.contact')}</TableHead>
                  <TableHead>{t('drillDown.date')}</TableHead>
                  <TableHead>{t('drillDown.category')}</TableHead>
                  <TableHead>{t('drillDown.phase')}</TableHead>
                  <TableHead>{t('drillDown.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {record.company_name || t('drillDown.unknown')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{record.person_name || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {record.communication_date
                            ? format(new Date(record.communication_date), 'MMM dd, yyyy')
                            : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.category || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.current_phase || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {record.deal_completed && (
                          <Badge className="bg-green-500">{t('drillDown.won')}</Badge>
                        )}
                        {record.quotation_required && !record.deal_completed && (
                          <Badge variant="outline">{t('drillDown.quote')}</Badge>
                        )}
                        <Badge variant={record.status === 'Closed' ? 'default' : 'secondary'}>
                          {record.status || t('drillDown.open')}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FunnelDrillDownDialog;
