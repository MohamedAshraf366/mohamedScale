import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  decodeToSegments,
  detectDomain,
  parseSalesCode,
  parseSupplierCode,
  BLOCK_TYPE_MAP,
  INSULATION_MAP,
  HOLES_MAP,
  CATEGORY_MAP,
  type CodeSegment,
} from '@/lib/coding-system';
import { Hash, Search, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function CodeDecoder() {
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const trimmed = input.trim();
  const segments = trimmed ? decodeToSegments(trimmed) : [];
  const domain = trimmed ? detectDomain(trimmed) : 'unknown';

  // Look up the entity by code
  const { data: linkedEntity, isLoading: entityLoading } = useQuery({
    queryKey: ['decode-entity', trimmed],
    queryFn: async () => {
      if (!trimmed || domain === 'unknown') return null;

      if (domain === 'MAT') {
        const { data } = await supabase.from('materials').select('id, name, code').eq('code', trimmed).limit(1).maybeSingle();
        return data ? { type: 'material' as const, id: data.id, label: data.name, path: `/materials` } : null;
      }

      if (domain === 'SUP') {
        const { data } = await supabase.from('accounts').select('id, display_name, code').is('deleted_at', null).eq('code', trimmed).limit(1).maybeSingle();
        if (!data) return null;
        const { data: sup } = await supabase.from('suppliers').select('account_id').eq('account_id', data.id).limit(1).maybeSingle();
        return sup ? { type: 'supplier' as const, id: data.id, label: data.display_name || trimmed, path: `/suppliers` } : null;
      }

      if (domain === 'SAL') {
        const parsed = parseSalesCode(trimmed);
        if (!parsed) return null;

        if (parsed.docType === 'QOT' || parsed.docType === 'PL') {
          const { data } = await supabase.from('quotations').select('id, code').eq('code', trimmed).limit(1).maybeSingle();
          const docLabel = parsed.docType === 'PL' ? 'Price List' : 'Quotation';
          if (data) return { type: 'quotation' as const, id: data.id, label: `${docLabel} ${trimmed}`, path: `/sales/opportunities` };
        }
        if (parsed.docType === 'INV') {
          const { data } = await supabase.from('invoices').select('id, code').eq('code', trimmed).limit(1).maybeSingle();
          if (data) return { type: 'invoice' as const, id: data.id, label: `Invoice ${trimmed}`, path: `/orders` };
        }
        if (parsed.entity) {
          const { data: opp } = await supabase.from('opportunities').select('id, title, code').eq('code', trimmed).is('deleted_at', null).limit(1).maybeSingle();
          if (opp) return { type: 'opportunity' as const, id: opp.id, label: opp.title, path: `/sales/opportunities/${opp.id}` };
          const { data: ord } = await supabase.from('orders').select('id, code').eq('code', trimmed).limit(1).maybeSingle();
          if (ord) return { type: 'order' as const, id: ord.id, label: `Order ${trimmed}`, path: `/orders` };
        }
        if (parsed.project && !parsed.entity) {
          const { data } = await supabase.from('projects').select('id, name, code').eq('code', trimmed).is('deleted_at', null).limit(1).maybeSingle();
          if (data) return { type: 'project' as const, id: data.id, label: data.name, path: `/sales/projects/${data.id}` };
        }
        if (!parsed.project) {
          const { data } = await supabase.from('accounts').select('id, display_name, code').is('deleted_at', null).eq('code', trimmed).limit(1).maybeSingle();
          if (data) return { type: 'customer' as const, id: data.id, label: data.display_name || trimmed, path: `/sales/customers/${data.id}` };
        }
      }

      return null;
    },
    enabled: trimmed.length >= 4 && domain !== 'unknown',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Code Decoder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Paste any code (e.g. MAT.BB.01.110.10 or SAL.0001_001_001)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono text-lg"
        />
        {segments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              Domain detected: <Badge variant="outline">{domain}</Badge>
              {entityLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {linkedEntity && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => navigate(linkedEntity.path)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open {linkedEntity.type}: {linkedEntity.label}
                </Button>
              )}
              {!entityLoading && !linkedEntity && trimmed.length >= 4 && domain !== 'unknown' && (
                <span className="text-xs text-muted-foreground/60 italic">No matching entity found</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {segments.map((seg, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {seg.label}
                  </span>
                  <span className={cn('px-3 py-1.5 rounded-md font-mono text-sm font-medium', seg.color)}>
                    {seg.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{seg.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeparatorRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Separator Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Separator</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Meaning</TableHead>
              <TableHead>Example</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Dot</TableCell>
              <TableCell><code className="bg-muted px-2 py-0.5 rounded font-mono">.</code></TableCell>
              <TableCell>Internal structure — non-detachable segments within an entity</TableCell>
              <TableCell><code className="font-mono text-sm">MAT.BB.01.110.10</code></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Underscore</TableCell>
              <TableCell><code className="bg-muted px-2 py-0.5 rounded font-mono">_</code></TableCell>
              <TableCell>Hierarchical — parent-child relationship, detachable</TableCell>
              <TableCell><code className="font-mono text-sm">SAL.0001_001_001</code></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SalesDomain() {
  const levels = [
    { code: 'SAL.0001', label: 'Customer', desc: '4-digit customer sequence' },
    { code: 'SAL.0001_001', label: 'Project', desc: '3-digit project under customer' },
    { code: 'SAL.0001_001_001', label: 'Opportunity / Order', desc: '3-digit entity under project' },
    { code: 'SAL.0001_001_001_QOT.001', label: 'Quotation', desc: 'Document attached to entity' },
    { code: 'SAL.0001_001_001_PL.001', label: 'Price List', desc: 'Price list attached to entity' },
    { code: 'SAL.0001_001_001_INV.001', label: 'Invoice', desc: 'Document attached to entity' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">SAL</Badge>
          Sales Domain
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {levels.map((level, i) => (
            <div key={i} className="flex items-center gap-3">
              <div style={{ paddingLeft: `${i * 24}px` }} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{level.code}</code>
              </div>
              <span className="font-medium text-sm">{level.label}</span>
              <span className="text-xs text-muted-foreground">— {level.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyDomain() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">SUP / MAT</Badge>
          Supply Domain
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Supplier Format */}
        <div>
          <h4 className="font-medium mb-2">Supplier Code: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">SUP.RGN.NNN</code></h4>
          <p className="text-sm text-muted-foreground mb-2">Region derived from supplier location. Sequence is per-region.</p>
          <code className="font-mono text-sm">SUP.RYD.001</code>
          <span className="text-sm text-muted-foreground ml-2">→ Riyadh region, supplier #1</span>
        </div>

        <Separator />

        {/* Material Format */}
        <div>
          <h4 className="font-medium mb-2">Material Code: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">MAT.CC.SS.NNN.NN</code></h4>
          <div className="font-mono text-sm bg-muted p-3 rounded-lg whitespace-pre">{`MAT.BB.01.110.10
 |   |  |  |||  |
 |   |  |  |||  +-- Size: 10 cm
 |   |  |  ||+---- Holes: 0 = Solid
 |   |  |  |+----- Insulation: 1 = Uninsulated
 |   |  |  +------ Block Type: 1 = Regular
 |   |  +--------- Subcategory: 01
 |   +------------ Category: BB
 +---------------- Domain: MAT`}</div>
        </div>

        <Separator />

        {/* Spec Tables */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h5 className="text-sm font-medium mb-2">Block Type (Digit 1)</h5>
            <Table>
              <TableHeader><TableRow><TableHead>Digit</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(BLOCK_TYPE_MAP).map(([k, v]) => (
                  <TableRow key={k}><TableCell className="font-mono">{k}</TableCell><TableCell>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h5 className="text-sm font-medium mb-2">Insulation (Digit 2)</h5>
            <Table>
              <TableHeader><TableRow><TableHead>Digit</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(INSULATION_MAP).map(([k, v]) => (
                  <TableRow key={k}><TableCell className="font-mono">{k}</TableCell><TableCell>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h5 className="text-sm font-medium mb-2">Holes (Digit 3)</h5>
            <Table>
              <TableHeader><TableRow><TableHead>Digit</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(HOLES_MAP).map(([k, v]) => (
                  <TableRow key={k}><TableCell className="font-mono">{k}</TableCell><TableCell>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CodingSystem = () => {
  return (
    <ProtectedRoute>
      <AppLayout title="Coding System">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Hash className="h-6 w-6" />
              Coding System Reference
            </h1>
            <p className="text-sm text-muted-foreground">
              Entity coding conventions, format reference, and interactive decoder
            </p>
          </div>

          <CodeDecoder />
          <SeparatorRules />
          <SalesDomain />
          <SupplyDomain />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default CodingSystem;
