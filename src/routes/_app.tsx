import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    const session = getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    // Role-based routing: admin -> /admin, staff -> /
    if (location.pathname === "/" && session.role === "admin") {
      throw redirect({ to: "/admin" });
    }
    if (location.pathname.startsWith("/admin") && session.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
