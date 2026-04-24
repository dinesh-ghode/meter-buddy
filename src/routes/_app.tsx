import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = getSession();
    if (!session) {
      // Not authenticated, redirect to login
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
