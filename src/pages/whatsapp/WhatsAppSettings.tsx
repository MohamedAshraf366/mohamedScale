import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Phone,
  Building2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Shield,
} from 'lucide-react';

interface WabaAccount {
  id: string;
  waba_id: string;
  business_id: string;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  status: string;
  onboarded_at: string | null;
  created_at: string;
}

export default function WhatsAppSettings() {
  const navigate = useNavigate();

  const { data: wabaAccounts, isLoading } = useQuery({
    queryKey: ['waba-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_accounts_safe' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as WabaAccount[];
    },
  });

  const getQualityBadge = (rating: string | null) => {
    switch (rating) {
      case 'GREEN':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">High Quality</Badge>;
      case 'YELLOW':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Medium Quality</Badge>;
      case 'RED':
        return <Badge variant="destructive">Low Quality</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Settings</h1>
          <p className="text-muted-foreground">
            Manage your connected WhatsApp Business accounts
          </p>
        </div>
        <Button onClick={() => navigate('/whatsapp/onboard')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Accounts</CardTitle>
          <CardDescription>
            WhatsApp Business accounts connected to this platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : wabaAccounts?.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No accounts connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect a WhatsApp Business account to get started
              </p>
              <Button onClick={() => navigate('/whatsapp/onboard')}>
                Connect WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {wabaAccounts?.map((account) => (
                <div
                  key={account.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">
                          {account.verified_name || 'WhatsApp Business Account'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {account.display_phone_number || 'No phone number'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {account.status === 'active' ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {account.status}
                          </Badge>
                        )}
                        {account.quality_rating && getQualityBadge(account.quality_rating)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">WABA ID:</span>
                        <p className="font-mono text-foreground">{account.waba_id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone Number ID:</span>
                        <p className="font-mono text-foreground">
                          {account.phone_number_id || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Business ID:</span>
                        <p className="font-mono text-foreground">{account.business_id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Connected:</span>
                        <p className="text-foreground">
                          {account.onboarded_at
                            ? format(new Date(account.onboarded_at), 'MMM d, yyyy')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${account.waba_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Meta Business
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coexistence Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Tech Provider Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This platform is designed to meet Meta's requirements for WhatsApp Tech Provider 
            approval, including full support for coexistence mode.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Embedded Signup with coexistence</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Message template management</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Conversation inbox</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Send text & media messages</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
