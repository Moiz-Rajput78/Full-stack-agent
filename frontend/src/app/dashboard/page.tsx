"use client";

import {
  useDescope,
  useSession,
  useUser,
} from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import ChatPanel from "@/components/ui/dashboard/chat-panel";
import ConnectionsPanel from "@/components/ui/dashboard/connection-panel";

function DashboardPage() {
  const sdk = useDescope();
  const router = useRouter();

  const {
    isAuthenticated,
    isSessionLoading,
    sessionToken,
  } = useSession();

  const { user, isUserLoading } = useUser();

  const [loggingOut, setLoggingOut] = useState(false);

  /*
   * Descope can expose the session token in different shapes.
   * We need the actual JWT string before sending it to the backend.
   */
  const rawSessionToken: unknown = sessionToken;
  const accessToken =
    typeof rawSessionToken === "string"
      ? rawSessionToken
      : rawSessionToken &&
          typeof rawSessionToken === "object" &&
          "sessionJwt" in rawSessionToken &&
          typeof rawSessionToken.sessionJwt === "string"
        ? rawSessionToken.sessionJwt
        : null;

  useEffect(() => {
    if (
      !isSessionLoading &&
      (!isAuthenticated || !accessToken)
    ) {
      router.replace("/sign-in");
    }
  }, [
    isSessionLoading,
    isAuthenticated,
    accessToken,
    router,
  ]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await sdk.logout();

      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      console.error(
        "[Dashboard] Logout failed:",
        error,
      );

      setLoggingOut(false);
    }
  }

  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        Checking Session......
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return null;
  }

  const label =
    user?.name ||
    user?.email ||
    user?.loginIds?.[0] ||
    "User";

  return (
    <div className="min-h-screen w-full bg-background">
      <ChatPanel
        sessionToken={accessToken}
        connections={
          <ConnectionsPanel
            sessionToken={accessToken}
          />
        }
        footer={
          <>
            <div className="text-sm font-semibold">
              {isUserLoading
                ? "Loading..."
                : label}
            </div>

            <button
              className="mt-1 flex cursor-pointer items-center gap-2 border-0 bg-transparent py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />

              {loggingOut
                ? "Logging out.."
                : "Log out"}
            </button>
          </>
        }
      />
    </div>
  );
}

export default DashboardPage;
