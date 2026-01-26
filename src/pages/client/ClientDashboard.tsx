import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import ClientDashboardAdvanced from "./ClientDashboardAdvanced";
import ClientDashboardMvp from "./ClientDashboardMvp";

const INTERNAL_ADMIN_EMAIL = 'omniseenblog@gmail.com';

export default function ClientDashboard() {
  const { user } = useAuth();
  const { isPlatformAdmin } = useBlog();

  const showAdvanced = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return isPlatformAdmin || email === INTERNAL_ADMIN_EMAIL;
  }, [isPlatformAdmin, user?.email]);

  if (showAdvanced) {
    return <ClientDashboardAdvanced />;
  }

  return <ClientDashboardMvp />;
}
