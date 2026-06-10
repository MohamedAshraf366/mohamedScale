import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Puzzle } from 'lucide-react';
import { CustomerFormData } from '@/lib/customer-schema';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface CustomFieldsSectionProps {
  form: UseFormReturn<CustomerFormData>;
}

export const CustomFieldsSection = ({ form }: CustomFieldsSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'custom_fields',
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Custom Fields
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ key: '', value: '' })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom fields added. Click "Add Field" to add custom data.
          </p>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3">
              <FormField
                control={form.control}
                name={`custom_fields.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    {index === 0 && <FormLabel>Field Name</FormLabel>}
                    <FormControl>
                      <Input placeholder="field_name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`custom_fields.${index}.value`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    {index === 0 && <FormLabel>Value</FormLabel>}
                    <FormControl>
                      <Input placeholder="value" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className={`text-destructive hover:text-destructive ${index === 0 ? 'mt-8' : ''}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
