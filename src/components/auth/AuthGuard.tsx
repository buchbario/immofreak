import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafbff]">
        <div className="size-8 border-2 border-[#4F6BFF]/20 border-t-[#4F6BFF] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
