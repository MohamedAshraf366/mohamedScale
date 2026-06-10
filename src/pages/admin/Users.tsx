import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { ComingSoon } from '@/components/layout/ComingSoon';

const Users = () => (
  <ProtectedRoute>
    <AppLayout title="Users">
      <ComingSoon 
        title="User Management" 
        description="Manage team members and permissions. Coming soon!" 
      />
    </AppLayout>
  </ProtectedRoute>
);

export default Users;
