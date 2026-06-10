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
import { Building2, User, Calendar, FileText } from 'lucide-react';

interface PieChartDrillDownDialogProps {
  open: boolean;
  onClose: () => void;
  filterField: 'category' | 'current_phase' | 'project_size' | 'project_type';
  filterValue: string;
  filterLabel: string;
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
  project_type: string | null;
  summary: string | null;
  quotation_required: boolean | null;
}

const PieChartDrillDownDialog = ({
  open,
  onClose,
  filterField,
  filterValue,
  filterLabel,
  startDate,
  endDate,
}: PieChartDrillDownDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<CommunicationRecord[]>([]);

  useEffect(() => {
    if (open) {
      fetchRecords();
    }
  }, [open, filterField, filterValue, startDate, endDate]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('communication_log')
        .select('id, company_name, person_name, communication_date, status, category, current_phase, project_size, project_type, summary, quotation_required')
        .gte('communication_date', startDate.toISOString())
        .lte('communication_date', endDate.toISOString())
        .order('communication_date', { ascending: false });

      // Apply filter based on field
      if (filterValue === 'Unknown') {
        query = query.is(filterField, null);
      } else {
        query = query.eq(filterField, filterValue);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t(`drillDown.fieldLabels.${filterField}`)}: {filterLabel}
          </DialogTitle>
          <DialogDescription>
            {records.length} {records.length === 1 ? t('drillDown.communicationsFound', { count: records.length }) : t('drillDown.communicationsFound_plural', { count: records.length })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">{t('drillDown.loading')}</div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">{t('drillDown.noCommunicationsFound')}</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('drillDown.company')}</TableHead>
                  <TableHead>{t('drillDown.contact')}</TableHead>
                  <TableHead>{t('drillDown.date')}</TableHead>
                  <TableHead>{t('drillDown.category')}</TableHead>
                  <TableHead>{t('drillDown.status')}</TableHead>
                  <TableHead>{t('drillDown.summary')}</TableHead>
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
                      <Badge variant={record.status === 'Closed' ? 'default' : 'secondary'}>
                        {record.status || t('drillDown.open')}
                      </Badge>
                      {record.quotation_required && (
                        <Badge variant="outline" className="ml-1">
                          {t('drillDown.quote')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm text-muted-foreground truncate block">
                        {record.summary || '-'}
                      </span>
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

export default PieChartDrillDownDialog;
