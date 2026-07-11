import { Navigate } from 'react-router-dom';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { adminPath } from '@/lib/adminPaths';
import { Loading } from '@/components/Common';
import type { PermissionKey } from '@/services/admin';

interface Props {
  perm?: PermissionKey;
  superOnly?: boolean;
  children: React.ReactNode;
}

/** يحجب الوصول المباشر عبر الرابط لصفحة لا يملك المشرف صلاحيتها — وليس فقط إخفاءها من القائمة. */
export function PermissionRoute({ perm, superOnly, children }: Props) {
  const { isSuper, can, loading } = useAdminProfile();

  if (loading) return <div className="page-container"><Loading /></div>;
  if (superOnly && !isSuper) return <Navigate to={adminPath('/')} replace />;
  if (perm && !isSuper && !can(perm)) return <Navigate to={adminPath('/')} replace />;

  return <>{children}</>;
}
