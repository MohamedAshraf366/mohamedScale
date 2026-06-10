import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OutreachAction = 'validity_confirmation' | 'renegotiation_outreach' | 'follow_up';

interface OutreachInput {
  action: OutreachAction;
  to: string;
  body?: string;
  template_name?: string;
  template_language?: string;
  template_components?: unknown[];
  supplier_quote_id?: string;
  validity_record_id?: string;
  renegotiation_case_id?: string;
  supplier_account_id?: string;
  send_mode?: 'text' | 'template';
}

interface OutreachResult {
  success: boolean;
  wa_message_id: string | null;
  conversation_id?: string | null;
  action: string;
  to: string;
}

export function useSendOutreach() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: OutreachInput): Promise<OutreachResult> => {
      const { data, error } = await supabase.functions.invoke('supply-outreach', {
        body: input,
      });

      if (error) throw new Error(error.message || 'Outreach failed');
      if (!data?.success) throw new Error(data?.error || 'Outreach failed');

      return data as OutreachResult;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['supplier-quote-validity'] });
      qc.invalidateQueries({ queryKey: ['renegotiation-cases'] });

      const labels: Record<OutreachAction, string> = {
        validity_confirmation: 'Validity confirmation sent',
        renegotiation_outreach: 'Renegotiation outreach sent',
        follow_up: 'Follow-up sent',
      };
      toast.success(labels[data.action as OutreachAction] || 'Message sent');
    },
    onError: (e: Error) => {
      toast.error('Outreach failed: ' + e.message);
    },
  });
}
