import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import AuthGate from "./AuthGate";

/** Blocks admin pages before they mount. Server-side RLS remains the real authority. */
const Inner = ({ children, allowEditor }: { children: React.ReactNode; allowEditor?: boolean }) => {
  const { isAdmin, loading } = useIsAdmin();
  const { isEditor, loading: el } = useIsEditor();
  if (loading || (allowEditor && el)) return null;
  if (!isAdmin && !(allowEditor && isEditor)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRouteGate = ({ children, allowEditor }: { children: React.ReactNode; allowEditor?: boolean }) => (
  <AuthGate><Inner allowEditor={allowEditor}>{children}</Inner></AuthGate>
);

export default AdminRouteGate;
