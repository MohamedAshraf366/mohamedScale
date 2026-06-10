import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactSelectorProps {
  customerAccountId: string | null;
  projectId: string | null;
  selectedContactId: string;
  onContactChange: (contactId: string) => void;
  onAddNewContact?: () => void;
}

export function ContactSelector({
  customerAccountId,
  projectId,
  selectedContactId,
  onContactChange,
  onAddNewContact,
}: ContactSelectorProps) {
  // Fetch contacts from customer account
  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-account", customerAccountId],
    queryFn: async () => {
      if (!customerAccountId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, role_title, phone, is_primary")
        .eq("account_id", customerAccountId)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerAccountId,
  });

  // Fetch project's POC if different
  const { data: project } = useQuery({
    queryKey: ["project-poc", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(`
          poc,
          poc_contact:contacts!projects_poc_fkey(id, full_name, role_title, phone)
        `)
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Combine and deduplicate contacts
  const allContacts = [...(contacts || [])];
  if (project?.poc_contact && !allContacts.some(c => c.id === project.poc_contact.id)) {
    allContacts.unshift({ ...project.poc_contact, is_primary: false });
  }

  // Default to POC if available
  const pocId = project?.poc;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Contact Person</Label>
        {onAddNewContact && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onAddNewContact}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add new
          </Button>
        )}
      </div>
      <Select
        value={selectedContactId}
        onValueChange={onContactChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select contact person" />
        </SelectTrigger>
        <SelectContent>
          {allContacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span>{c.full_name}</span>
                {c.id === pocId && (
                  <span className="text-xs text-muted-foreground">(Project POC)</span>
                )}
                {c.is_primary && (
                  <span className="text-xs text-muted-foreground">(Primary)</span>
                )}
              </div>
            </SelectItem>
          ))}
          {allContacts.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No contacts found
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
