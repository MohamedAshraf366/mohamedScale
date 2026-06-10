import AdminLayout from '@/components/AdminLayout';
import ManagementApprovalComponent from '@/components/renegotiation/ManagementApproval';

const AdminApprovals = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Management Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve renegotiation requests from the Supply Head
          </p>
        </div>

        <ManagementApprovalComponent />
      </div>
    </AdminLayout>
  );
};

export default AdminApprovals;
