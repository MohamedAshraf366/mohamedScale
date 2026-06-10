import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Pencil, Phone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface CustomerContactsCardProps {
  contacts: Contact[];
}

export function CustomerContactsCard({ contacts }: CustomerContactsCardProps) {
  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No contacts found
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.slice(0, 3).map((contact) => {
          const initials = contact.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={contact.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{contact.full_name}</div>
                {contact.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {contacts.length > 3 && (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            View all {contacts.length} contacts
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
