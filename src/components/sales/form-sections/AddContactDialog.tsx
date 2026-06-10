import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onContactCreated?: (contactId: string) => void;
}

export function AddContactDialog({
  open,
  onOpenChange,
  accountId,
  onContactCreated,
}: AddContactDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: "",
    role_title: "",
    phone: "",
    email: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formData.full_name.trim()) {
        throw new Error("Name is required");
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          full_name: formData.full_name.trim(),
          role_title: formData.role_title.trim() || null,
          phone: formData.phone || null,
          email: formData.email.trim() || null,
          is_primary: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Contact added");
      queryClient.invalidateQueries({ queryKey: ["contacts-for-account", accountId] });
      onContactCreated?.(data.id);
      onOpenChange(false);
      setFormData({ full_name: "", role_title: "", phone: "", email: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add contact");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>Add a contact person for this customer</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Name *</Label>
            <Input
              id="full_name"
              placeholder="Full name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role_title">Role / Title</Label>
            <Input
              id="role_title"
              placeholder="e.g., Project Manager"
              value={formData.role_title}
              onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <PhoneInput
              value={formData.phone}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              defaultCountry="SA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
