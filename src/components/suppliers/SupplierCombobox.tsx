/**
 * Phase 2b — searchable supplier picker. cmdk combobox with "+ New supplier"
 * pinned at the top (not buried at the end of the list). The create button
 * opens the full AddSupplierSheet side-sheet so every supplier field is
 * captured up-front.
 */

import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AddSupplierSheet } from './AddSupplierSheet';

export interface SupplierOption { id: string; name: string }

interface Props {
  value: string;
  valueName: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SupplierCombobox({ value, valueName, onChange, disabled, placeholder = 'Select supplier' }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data: supData } = await supabase.from('suppliers').select('account_id');
      if (supData) {
        const ids = supData.map((s) => s.account_id);
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, display_name')
          .is('deleted_at', null)
          .in('id', ids);
        setSuppliers(
          (accounts || [])
            .map((a) => ({ id: a.id, name: a.display_name || 'Unnamed' }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const display = useMemo(() => {
    if (!value) return placeholder;
    return valueName || suppliers.find((s) => s.id === value)?.name || placeholder;
  }, [value, valueName, suppliers, placeholder]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
          >
            <span className="truncate">{display}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search suppliers…" />
            <CommandList>
              {/* Pinned create button at top */}
              <CommandGroup>
                <CommandItem
                  value="__create_new_supplier__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New supplier…
                </CommandItem>
              </CommandGroup>
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <CommandEmpty>No suppliers found.</CommandEmpty>
                  <CommandGroup heading="Suppliers">
                    {suppliers.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={`${s.name} ${s.id}`}
                        onSelect={() => {
                          onChange(s.id, s.name);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{s.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AddSupplierSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id, name) => {
          setSuppliers((prev) =>
            [...prev.filter((s) => s.id !== id), { id, name }].sort((a, b) => a.name.localeCompare(b.name)),
          );
          onChange(id, name);
        }}
      />
    </>
  );
}
