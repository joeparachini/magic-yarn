import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LoginForm } from "../components/login-form";

export function Login() {
  const { session, loading, roleLoading, isApproved, signInWithGoogle } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    typeof (location.state as { from?: unknown } | null)?.from === "string"
      ? ((location.state as { from: string }).from ?? "/")
      : "/";
  const targetPath = from.startsWith("/") && from !== "/login" ? from : "/";

  useEffect(() => {
    if (!loading && !roleLoading && session) {
      navigate(isApproved ? targetPath : "/awaiting-approval", {
        replace: true,
      });
    }
  }, [loading, roleLoading, session, isApproved, navigate, targetPath]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm
          onGoogle={() => void signInWithGoogle()}
          disabled={loading || roleLoading}
        />
      </div>
    </div>
  );
}
