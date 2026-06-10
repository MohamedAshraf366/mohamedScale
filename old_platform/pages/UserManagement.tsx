import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, History, Trash2, UserPlus, Users, X, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'admin' | 'procurement_officer' | 'viewer';
  created_at: string;
}

interface RoleChangeLog {
  id: string;
  user_id: string;
  changed_by: string;
  previous_role: string;
  new_role: string;
  created_at: string;
  user_email: string | null;
  changed_by_email: string | null;
}

const UserManagement = () => {
  const { t } = useTranslation();
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [activityLogs, setActivityLogs] = useState<RoleChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<'admin' | 'procurement_officer' | 'viewer' | ''>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Edit user state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserWithRole | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'procurement_officer' | 'viewer'>('viewer');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/');
      toast.error(t('userManagement.accessDenied'));
      return;
    }
    fetchUsers();
    fetchActivityLogs();
  }, [userRole, navigate, t]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: userRole?.role || 'viewer',
          created_at: profile.created_at
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('userManagement.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setLogsLoading(true);
      const { data: logs, error } = await supabase
        .from('user_role_changes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user emails for the logs
      const userIds = [...new Set([
        ...logs.map(l => l.user_id),
        ...logs.map(l => l.changed_by)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      const logsWithEmails = logs.map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id) || null,
        changed_by_email: profileMap.get(log.changed_by) || null
      }));

      setActivityLogs(logsWithEmails);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error(t('userManagement.fetchLogsError'));
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'procurement_officer' | 'viewer') => {
    try {
      const currentUser = users.find(u => u.id === userId);
      if (!currentUser) return;

      const previousRole = currentUser.role;

      // Update the role
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Log the change
      const { error: logError } = await supabase
        .from('user_role_changes')
        .insert({
          user_id: userId,
          changed_by: user?.id,
          previous_role: previousRole,
          new_role: newRole
        });

      if (logError) throw logError;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));

      // Refresh activity logs
      fetchActivityLogs();

      toast.success(t('userManagement.roleUpdated'));
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(t('userManagement.updateError'));
    }
  };

  const handleBulkRoleChange = async () => {
    if (!bulkRole || selectedUserIds.size === 0) return;

    setBulkUpdating(true);
    try {
      const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
      
      for (const selectedUser of selectedUsers) {
        if (selectedUser.role === bulkRole) continue; // Skip if role is the same

        // Update the role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: bulkRole })
          .eq('user_id', selectedUser.id);

        if (updateError) throw updateError;

        // Log the change
        await supabase
          .from('user_role_changes')
          .insert({
            user_id: selectedUser.id,
            changed_by: user?.id,
            previous_role: selectedUser.role,
            new_role: bulkRole
          });
      }

      // Update local state
      setUsers(users.map(u => 
        selectedUserIds.has(u.id) ? { ...u, role: bulkRole } : u
      ));

      // Clear selection
      setSelectedUserIds(new Set());
      setBulkRole('');

      // Refresh activity logs
      fetchActivityLogs();

      toast.success(t('userManagement.bulkRoleUpdated', { count: selectedUsers.length }));
    } catch (error) {
      console.error('Error updating roles:', error);
      toast.error(t('userManagement.updateError'));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Delete user role first
      const { error: roleError, count: roleCount } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.id)
        .select();

      if (roleError) throw roleError;

      // Delete profile
      const { error: profileError, count: profileCount } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id)
        .select();

      if (profileError) throw profileError;

      // Refetch users to ensure consistency with database
      await fetchUsers();
      
      toast.success(t('userManagement.userDeleted'));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(t('userManagement.deleteError'));
    }
  };

  const openDeleteDialog = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (userItem: UserWithRole) => {
    setUserToEdit(userItem);
    setEditFullName(userItem.full_name || '');
    setEditRole(userItem.role);
    setEditDialogOpen(true);
  };

  const getEditChanges = () => {
    if (!userToEdit) return [];
    const changes: { field: string; from: string; to: string }[] = [];
    
    if (editFullName.trim() !== (userToEdit.full_name || '')) {
      changes.push({
        field: t('userManagement.editDialog.fullName'),
        from: userToEdit.full_name || t('userManagement.noName'),
        to: editFullName.trim()
      });
    }
    
    if (editRole !== userToEdit.role) {
      changes.push({
        field: t('userManagement.editDialog.role'),
        from: getRoleLabel(userToEdit.role),
        to: getRoleLabel(editRole)
      });
    }
    
    return changes;
  };

  const handleEditSaveClick = () => {
    if (!userToEdit) return;
    
    // Validation
    if (!editFullName.trim()) {
      toast.error(t('userManagement.editDialog.nameRequired'));
      return;
    }

    const changes = getEditChanges();
    if (changes.length === 0) {
      toast.info(t('userManagement.editDialog.noChanges'));
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleEditConfirm = async () => {
    if (!userToEdit) return;

    setEditSaving(true);
    setConfirmDialogOpen(false);
    
    try {
      // Update profile (full_name)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: editFullName.trim() })
        .eq('id', userToEdit.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editRole !== userToEdit.role) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: editRole })
          .eq('user_id', userToEdit.id);

        if (roleError) throw roleError;

        // Log role change
        await supabase
          .from('user_role_changes')
          .insert({
            user_id: userToEdit.id,
            changed_by: user?.id,
            previous_role: userToEdit.role,
            new_role: editRole
          });

        fetchActivityLogs();
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userToEdit.id 
          ? { ...u, full_name: editFullName.trim(), role: editRole }
          : u
      ));

      toast.success(t('userManagement.editDialog.success'));
      setEditDialogOpen(false);
      setUserToEdit(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(t('userManagement.updateError'));
    } finally {
      setEditSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('userManagement.roles.admin');
      case 'procurement_officer':
        return t('userManagement.roles.procurementOfficer');
      case 'viewer':
        return t('userManagement.roles.viewer');
      default:
        return role;
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
    setBulkRole('');
  };

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('userManagement.title')}</CardTitle>
              <CardDescription>{t('userManagement.description')}</CardDescription>
            </div>
            <Button onClick={() => toast.info(t('userManagement.inviteInfo'))}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('userManagement.addUser')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">{t('userManagement.tabs.users')}</TabsTrigger>
              <TabsTrigger value="activity">
                <History className="h-4 w-4 mr-2" />
                {t('userManagement.tabs.activity')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="users">
              {/* Bulk Action Bar */}
              {selectedUserIds.size > 0 && (
                <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {t('userManagement.bulk.selected', { count: selectedUserIds.size })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as any)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder={t('userManagement.bulk.selectRole')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          {t('userManagement.roles.viewer')}
                        </SelectItem>
                        <SelectItem value="procurement_officer">
                          {t('userManagement.roles.procurementOfficer')}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t('userManagement.roles.admin')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkRoleChange} 
                      disabled={!bulkRole || bulkUpdating}
                      size="sm"
                    >
                      {bulkUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t('userManagement.bulk.applyRole')}
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearSelection}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={users.length > 0 && selectedUserIds.size === users.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>{t('userManagement.table.name')}</TableHead>
                        <TableHead>{t('userManagement.table.email')}</TableHead>
                        <TableHead>{t('userManagement.table.role')}</TableHead>
                        <TableHead>{t('userManagement.table.joinedDate')}</TableHead>
                        <TableHead className="text-right">{t('userManagement.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((userItem) => (
                        <TableRow 
                          key={userItem.id}
                          className={selectedUserIds.has(userItem.id) ? 'bg-primary/5' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedUserIds.has(userItem.id)}
                              onCheckedChange={() => toggleUserSelection(userItem.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {userItem.full_name || t('userManagement.noName')}
                          </TableCell>
                          <TableCell>{userItem.email}</TableCell>
                          <TableCell>
                            <Select
                              value={userItem.role}
                              onValueChange={(value) => handleRoleChange(userItem.id, value as any)}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue>{getRoleLabel(userItem.role)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">
                                  {t('userManagement.roles.viewer')}
                                </SelectItem>
                                <SelectItem value="procurement_officer">
                                  {t('userManagement.roles.procurementOfficer')}
                                </SelectItem>
                                <SelectItem value="admin">
                                  {t('userManagement.roles.admin')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {new Date(userItem.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(userItem)}
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(userItem)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity">
              {logsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('userManagement.activity.timestamp')}</TableHead>
                        <TableHead>{t('userManagement.activity.user')}</TableHead>
                        <TableHead>{t('userManagement.activity.previousRole')}</TableHead>
                        <TableHead>{t('userManagement.activity.newRole')}</TableHead>
                        <TableHead>{t('userManagement.activity.changedBy')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {t('userManagement.activity.noActivity')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        activityLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>{log.user_email}</TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded-md bg-muted text-xs">
                                {getRoleLabel(log.previous_role)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                                {getRoleLabel(log.new_role)}
                              </span>
                            </TableCell>
                            <TableCell>{log.changed_by_email}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

        {/* Delete User Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('userManagement.deleteDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('userManagement.deleteDialog.description', { name: userToDelete?.full_name || userToDelete?.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('userManagement.deleteDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                {t('userManagement.deleteDialog.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t('userManagement.editDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('userManagement.editDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{t('userManagement.editDialog.fullName')}</Label>
                <Input
                  id="edit-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder={t('userManagement.editDialog.namePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">{t('userManagement.editDialog.email')}</Label>
                <Input
                  id="edit-email"
                  value={userToEdit?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t('userManagement.editDialog.emailNote')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">{t('userManagement.editDialog.role')}</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue>{getRoleLabel(editRole)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      {t('userManagement.roles.viewer')}
                    </SelectItem>
                    <SelectItem value="procurement_officer">
                      {t('userManagement.roles.procurementOfficer')}
                    </SelectItem>
                    <SelectItem value="admin">
                      {t('userManagement.roles.admin')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t('userManagement.editDialog.cancel')}
              </Button>
              <Button onClick={handleEditSaveClick} disabled={editSaving}>
                {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t('userManagement.editDialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Changes Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('userManagement.confirmDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('userManagement.confirmDialog.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-3">
              {getEditChanges().map((change, index) => (
                <div key={index} className="flex flex-col gap-1 p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{change.field}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through">{change.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-primary font-medium">{change.to}</span>
                  </div>
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('userManagement.confirmDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleEditConfirm}>
                {t('userManagement.confirmDialog.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default UserManagement;
