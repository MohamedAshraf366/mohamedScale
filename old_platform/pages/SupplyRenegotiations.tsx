import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Inbox, Shield, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupplyHeadInbox from '@/components/renegotiation/SupplyHeadInbox';
import ManagementApproval from '@/components/renegotiation/ManagementApproval';
import RenegotiationKanban from '@/components/renegotiation/RenegotiationKanban';
import { useRenegotiations } from '@/hooks/useRenegotiations';

const SupplyRenegotiations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('supply-head');

  // Get counts for badges
  const { data: pendingSupplyHead } = useRenegotiations('pending_supply_head');
  const { data: pendingManagement } = useRenegotiations('pending_management');
  const { data: approved } = useRenegotiations('approved');
  const { data: active } = useRenegotiations('active');

  const pipelineCount = (approved?.length || 0) + (active?.length || 0);

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/supply')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('supply.renegotiations', 'Renegotiation Hub')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('supply.renegotiationsDesc', 'Multi-tier approval workflow for price renegotiations')}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="supply-head" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Supply Head</span>
              <span className="sm:hidden">Inbox</span>
              {(pendingSupplyHead?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pendingSupplyHead?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Management</span>
              <span className="sm:hidden">Approve</span>
              {(pendingManagement?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pendingManagement?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline</span>
              <span className="sm:hidden">Board</span>
              {pipelineCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pipelineCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="supply-head" className="mt-4">
            <SupplyHeadInbox />
          </TabsContent>

          <TabsContent value="management" className="mt-4">
            <ManagementApproval />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <RenegotiationKanban />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SupplyRenegotiations;
