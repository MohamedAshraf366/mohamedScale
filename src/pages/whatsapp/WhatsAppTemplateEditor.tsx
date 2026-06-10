import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Eye,
  Loader2,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Video,
} from 'lucide-react';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface WabaAccount {
  id: string;
  waba_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'en_US', name: 'English (US)' },
  { code: 'en_GB', name: 'English (UK)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt_BR', name: 'Portuguese (Brazil)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
];

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional content, offers, newsletters' },
  { value: 'UTILITY', label: 'Utility', description: 'Transaction updates, order confirmations' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'OTP codes, login verification' },
];

export default function WhatsAppTemplateEditor() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();
  const queryClient = useQueryClient();
  const isEditing = templateId && templateId !== 'new';

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
  const [language, setLanguage] = useState('en');
  const [headerType, setHeaderType] = useState<'none' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('none');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<TemplateComponent['buttons']>([]);

  // Fetch WABA accounts
  const { data: wabaAccounts } = useQuery({
    queryKey: ['waba-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_accounts_safe' as any)
        .select('*')
        .eq('status', 'active');
      if (error) throw error;
      return data as unknown as WabaAccount[];
    },
  });

  const activeWaba = wabaAccounts?.[0];

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activeWaba?.waba_id) throw new Error('No active WABA');

      // Build components array
      const components: TemplateComponent[] = [];

      // Header
      if (headerType !== 'none') {
        if (headerType === 'TEXT' && headerText) {
          components.push({
            type: 'HEADER',
            format: 'TEXT',
            text: headerText,
          });
        } else if (headerType !== 'TEXT') {
          components.push({
            type: 'HEADER',
            format: headerType,
          });
        }
      }

      // Body (required)
      if (bodyText) {
        components.push({
          type: 'BODY',
          text: bodyText,
        });
      }

      // Footer
      if (footerText) {
        components.push({
          type: 'FOOTER',
          text: footerText,
        });
      }

      // Buttons
      if (buttons && buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: buttons,
        });
      }

      const { data, error } = await supabase.functions.invoke('manage-templates', {
        body: {
          waba_id: activeWaba.waba_id,
          name,
          category,
          language,
          components,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.details?.message || 'Failed to create template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template submitted for approval');
      navigate('/whatsapp/templates');
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const handleAddButton = () => {
    if (buttons && buttons.length >= 3) {
      toast.error('Maximum 3 buttons allowed');
      return;
    }
    setButtons([...(buttons || []), { type: 'QUICK_REPLY', text: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons?.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: string, value: string) => {
    const newButtons = [...(buttons || [])];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name) {
      toast.error('Template name is required');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
      toast.error('Template name must be lowercase with underscores only');
      return;
    }
    if (!bodyText) {
      toast.error('Body text is required');
      return;
    }

    createMutation.mutate();
  };

  // Extract variables from text
  const extractVariables = (text: string) => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches || [];
  };

  const bodyVariables = extractVariables(bodyText);
  const headerVariables = headerType === 'TEXT' ? extractVariables(headerText) : [];

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/whatsapp/templates')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h1>
          <p className="text-muted-foreground">
            Design your WhatsApp message template
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., order_confirmation"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, and underscores only
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={(v: typeof category) => setCategory(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div>
                              <div className="font-medium">{cat.label}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Header (Optional)</CardTitle>
                <CardDescription>
                  Add a header to your template with text or media
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(['none', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={headerType === type ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setHeaderType(type)}
                    >
                      {type === 'none' && 'None'}
                      {type === 'TEXT' && <><MessageSquare className="w-4 h-4 mr-1" /> Text</>}
                      {type === 'IMAGE' && <><ImageIcon className="w-4 h-4 mr-1" /> Image</>}
                      {type === 'VIDEO' && <><Video className="w-4 h-4 mr-1" /> Video</>}
                      {type === 'DOCUMENT' && <><FileText className="w-4 h-4 mr-1" /> Document</>}
                    </Button>
                  ))}
                </div>

                {headerType === 'TEXT' && (
                  <div className="space-y-2">
                    <Label>Header Text</Label>
                    <Input
                      placeholder="e.g., Order Update"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      maxLength={60}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{{1}}'} for variables. Max 60 characters.
                    </p>
                  </div>
                )}

                {headerType !== 'none' && headerType !== 'TEXT' && (
                  <p className="text-sm text-muted-foreground">
                    You'll provide the {headerType.toLowerCase()} when sending the message.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Body (Required)</CardTitle>
                <CardDescription>
                  The main content of your message
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={5}
                    maxLength={1024}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Use {'{{1}}'}, {'{{2}}'}, etc. for variables</span>
                    <span>{bodyText.length}/1024</span>
                  </div>
                </div>

                {bodyVariables.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Variables:</span>
                    {bodyVariables.map((v, i) => (
                      <Badge key={i} variant="secondary">{v}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Footer (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g., Reply STOP to unsubscribe"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-2">Max 60 characters</p>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Buttons (Optional)</CardTitle>
                    <CardDescription>Add up to 3 buttons</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddButton}
                    disabled={(buttons?.length || 0) >= 3}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Button
                  </Button>
                </div>
              </CardHeader>
              {buttons && buttons.length > 0 && (
                <CardContent className="space-y-4">
                  {buttons.map((button, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Button {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveButton(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={button.type}
                            onValueChange={(v) => handleButtonChange(index, 'type', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                              <SelectItem value="URL">URL</SelectItem>
                              <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Button Text</Label>
                          <Input
                            placeholder="e.g., View Order"
                            value={button.text}
                            onChange={(e) => handleButtonChange(index, 'text', e.target.value)}
                            maxLength={25}
                          />
                        </div>
                      </div>

                      {button.type === 'URL' && (
                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            placeholder="https://example.com/order/{{1}}"
                            value={button.url || ''}
                            onChange={(e) => handleButtonChange(index, 'url', e.target.value)}
                          />
                        </div>
                      )}

                      {button.type === 'PHONE_NUMBER' && (
                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            placeholder="+1234567890"
                            value={button.phone_number || ''}
                            onChange={(e) => handleButtonChange(index, 'phone_number', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:sticky lg:top-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* WhatsApp-style message preview */}
                <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-lg p-4 min-h-[300px]">
                  <div className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm max-w-[280px] ml-auto">
                    {/* Header */}
                    {headerType !== 'none' && (
                      <div className="px-3 pt-2">
                        {headerType === 'TEXT' ? (
                          <p className="font-semibold text-sm">
                            {headerText || 'Header text'}
                          </p>
                        ) : (
                          <div className="bg-muted rounded h-32 flex items-center justify-center">
                            {headerType === 'IMAGE' && <ImageIcon className="w-8 h-8 text-muted-foreground" />}
                            {headerType === 'VIDEO' && <Video className="w-8 h-8 text-muted-foreground" />}
                            {headerType === 'DOCUMENT' && <FileText className="w-8 h-8 text-muted-foreground" />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body */}
                    <div className="px-3 py-2">
                      <p className="text-sm whitespace-pre-wrap">
                        {bodyText || 'Your message body will appear here...'}
                      </p>
                    </div>

                    {/* Footer */}
                    {footerText && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-muted-foreground">{footerText}</p>
                      </div>
                    )}

                    {/* Time */}
                    <div className="px-3 pb-2 text-right">
                      <span className="text-xs text-muted-foreground">12:00</span>
                    </div>

                    {/* Buttons */}
                    {buttons && buttons.length > 0 && (
                      <div className="border-t">
                        {buttons.map((button, index) => (
                          <div
                            key={index}
                            className="py-2 px-3 text-center text-sm text-blue-500 border-b last:border-b-0"
                          >
                            {button.text || `Button ${index + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Submit for Approval
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Templates are reviewed by Meta and typically approved within 24 hours.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
