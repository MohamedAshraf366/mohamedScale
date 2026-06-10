import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, User } from 'lucide-react';
import { CustomerFormData } from '@/lib/customer-schema';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface ContactCardProps {
  form: UseFormReturn<CustomerFormData>;
  index: number;
  onRemove: () => void;
  onSetPrimary: () => void;
  canRemove: boolean;
}

export const ContactCard = ({ form, index, onRemove, onSetPrimary, canRemove }: ContactCardProps) => {
  const isPrimary = form.watch(`contacts.${index}.is_primary`);

  return (
    <Card className={`relative ${isPrimary ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Contact {index + 1}
            {isPrimary && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Primary
              </span>
            )}
          </CardTitle>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`contacts.${index}.full_name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`contacts.${index}.phone`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="5XX XXX XXXX"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`contacts.${index}.email`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`contacts.${index}.role_title`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role/Title</FormLabel>
                <FormControl>
                  <Input placeholder="Procurement Manager" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <FormField
            control={form.control}
            name={`contacts.${index}.prefers_whatsapp`}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">Prefers WhatsApp</FormLabel>
              </FormItem>
            )}
          />

          {!isPrimary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSetPrimary}
            >
              Set as Primary
            </Button>
          )}
        </div>

        <FormField
          control={form.control}
          name={`contacts.${index}.notes`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this contact..."
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};
