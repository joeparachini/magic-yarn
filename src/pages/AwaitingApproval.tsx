import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui/button";

export function AwaitingApproval() {
  const { session, loading, roleLoading, isApproved, signOut } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isApproved) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto flex h-full max-w-lg items-center px-6">
      <div className="flex w-full flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Awaiting approval</h1>
        <p className="text-sm text-muted-foreground">
          Your account has been created, but an administrator must approve it
          before you can access the app.
        </p>
        <div>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
