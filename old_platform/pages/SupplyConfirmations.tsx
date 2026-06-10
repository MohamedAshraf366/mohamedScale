import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileCheck, ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SupplyConfirmations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
                {t('supply.priceConfirmations', 'Price Confirmations')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('supply.priceConfirmationsDesc', 'Track price validity and upcoming expirations')}
              </p>
            </div>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('supply.newConfirmation', 'New Price Confirmation')}
          </Button>
        </div>

        {/* Placeholder Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-500" />
              {t('supply.priceTracker', 'Price Validity Tracker')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileCheck className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Coming Soon</p>
              <p className="text-sm mt-2 text-center max-w-md">
                The price confirmations feature is being developed. You'll be able to track supplier price validity periods here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SupplyConfirmations;
