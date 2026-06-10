import Layout from '@/components/Layout';
import ManagementApprovalComponent from '@/components/renegotiation/ManagementApproval';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManagementApproval = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/supply/renegotiations')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Renegotiation Hub
          </Button>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold">Management Approval</h1>
          <p className="text-muted-foreground">
            Review and approve renegotiation requests from the Supply Head
          </p>
        </div>

        <ManagementApprovalComponent />
      </div>
    </Layout>
  );
};

export default ManagementApproval;