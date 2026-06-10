import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find approved quotes with valid_until
    const { data: quotes, error: qErr } = await supabase
      .from('supplier_quotes')
      .select('id, supplier_account_id, valid_until, status')
      .eq('status', 'approved')
      .not('valid_until', 'is', null);

    if (qErr) throw qErr;
    if (!quotes || quotes.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No approved quotes with validity dates' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const results = { expiring_soon: 0, expired: 0, already_tracked: 0, created: 0 };

    for (const quote of quotes) {
      const expiry = new Date(quote.valid_until);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Skip quotes well within validity
      if (daysUntilExpiry > 14) continue;

      // Check latest validity record
      const { data: existingRecords } = await supabase
        .from('supplier_quote_validity')
        .select('id, status')
        .eq('supplier_quote_id', quote.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestRecord = existingRecords?.[0];

      // Skip if already being handled (outreach_sent, supplier_confirmed, supplier_changed, management_approved)
      if (latestRecord && ['outreach_sent', 'supplier_confirmed', 'supplier_changed', 'management_approved'].includes(latestRecord.status)) {
        results.already_tracked++;
        continue;
      }

      if (daysUntilExpiry <= 0) {
        // Expired
        results.expired++;

        if (!latestRecord || latestRecord.status !== 'expired') {
          await supabase
            .from('supplier_quote_validity')
            .insert({
              supplier_quote_id: quote.id,
              status: 'expired',
            });
          results.created++;

          // Create renegotiation case if none exists
          const { data: existingCases } = await supabase
            .from('renegotiation_cases')
            .select('id')
            .eq('original_quote_id', quote.id)
            .in('status', ['open', 'outreach_sent', 'quote_received', 'under_review'])
            .limit(1);

          if (!existingCases || existingCases.length === 0) {
            await supabase
              .from('renegotiation_cases')
              .insert({
                supplier_account_id: quote.supplier_account_id,
                original_quote_id: quote.id,
                trigger_type: 'validity_expiry',
                notes: `Quote expired on ${quote.valid_until}`,
              });
          }
        }
      } else {
        // Expiring soon (1-14 days)
        results.expiring_soon++;

        if (!latestRecord || latestRecord.status === 'active') {
          if (latestRecord) {
            // Update existing active record to expiring_soon
            await supabase
              .from('supplier_quote_validity')
              .update({ status: 'expiring_soon' })
              .eq('id', latestRecord.id);
          } else {
            await supabase
              .from('supplier_quote_validity')
              .insert({
                supplier_quote_id: quote.id,
                status: 'expiring_soon',
              });
          }
          results.created++;
        }
      }
    }

    return new Response(JSON.stringify({ processed: quotes.length, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Validity monitor error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
