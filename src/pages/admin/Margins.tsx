import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Percent, Save, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SubcategoryRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  status: string;
  category_id: string;
}

interface CategoryRow {
  id: string;
  name_en: string;
  code2: string;
}

interface MarginRow {
  subcategory_id: string;
  default_margin_pct: number;
  notes: string | null;
  updated_at: string;
}

/**
 * Admin & Management page for centrally managing default margins per
 * material subcategory. Values are stored in `subcategory_margin_defaults`
 * and consumed by the builder via `useSubcategoryMargins`.
 */
export default function MarginsAdmin() {
  const { hasRole, user } = useAuth();
  const isAllowed = hasRole('admin') || hasRole('management');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-margins-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_categories')
        .select('id, name_en, code2')
        .order('name_en');
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
    enabled: isAllowed,
  });

  const { data: subcategories = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['admin-margins-subcategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('id, name_en, name_ar, status, category_id')
        .eq('status', 'active')
        .order('name_en');
      if (error) throw error;
      return (data ?? []) as SubcategoryRow[];
    },
    enabled: isAllowed,
  });

  const { data: margins = [], isLoading: loadingMargins } = useQuery({
    queryKey: ['admin-margins-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcategory_margin_defaults')
        .select('subcategory_id, default_margin_pct, notes, updated_at');
      if (error) throw error;
      return (data ?? []) as MarginRow[];
    },
    enabled: isAllowed,
  });

  const marginMap = useMemo(() => {
    const m = new Map<string, MarginRow>();
    for (const row of margins) m.set(row.subcategory_id, row);
    return m;
  }, [margins]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subcategories;
    return subcategories.filter((s) => {
      const cat = categoryMap.get(s.category_id);
      return (
        s.name_en.toLowerCase().includes(q) ||
        (s.name_ar ?? '').toLowerCase().includes(q) ||
        (cat?.name_en ?? '').toLowerCase().includes(q)
      );
    });
  }, [subcategories, categoryMap, search]);

  if (!isAllowed) return <Navigate to="/" replace />;

  const handleSave = async (subId: string) => {
    const raw = drafts[subId];
    if (raw === undefined) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error('Margin must be a number between 0 and 100');
      return;
    }
    setSavingId(subId);
    try {
      const { error } = await supabase
        .from('subcategory_margin_defaults')
        .upsert(
          {
            subcategory_id: subId,
            default_margin_pct: value,
            updated_by: user?.id ?? null,
          },
          { onConflict: 'subcategory_id' }
        );
      if (error) throw error;
      toast.success('Margin saved');
      setDrafts((d) => {
        const { [subId]: _, ...rest } = d;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ['admin-margins-defaults'] });
      qc.invalidateQueries({ queryKey: ['subcategory-margin-defaults'] });
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const isLoading = loadingSubs || loadingMargins;

  return (
    <AppLayout title="Margins">
      <div className="container max-w-5xl py-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Default margins per subcategory
                </CardTitle>
                <CardDescription className="mt-1">
                  These margins are applied to new quotation lines based on the material's
                  subcategory. Changes here only affect <strong>new</strong> lines —
                  already-quoted lines keep their stored effective margin.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {margins.length} configured
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subcategory or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Subcategory</TableHead>
                      <TableHead className="w-[160px]">Default margin %</TableHead>
                      <TableHead className="w-[120px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                          No subcategories match your search.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((s) => {
                      const cat = categoryMap.get(s.category_id);
                      const existing = marginMap.get(s.id);
                      const draft = drafts[s.id];
                      const currentValue =
                        draft !== undefined ? draft : existing ? String(existing.default_margin_pct) : '';
                      const dirty = draft !== undefined && draft !== (existing ? String(existing.default_margin_pct) : '');
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {cat?.name_en ?? '—'}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {s.name_en}
                            {s.name_ar && (
                              <span className="ml-2 text-xs text-muted-foreground">{s.name_ar}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="relative w-32">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={currentValue}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [s.id]: e.target.value }))
                                }
                                placeholder="—"
                                className="pr-7 h-8 text-sm"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={dirty ? 'default' : 'ghost'}
                              disabled={!dirty || savingId === s.id}
                              onClick={() => handleSave(s.id)}
                              className="h-8 gap-1"
                            >
                              {savingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
