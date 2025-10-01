export const dynamic = "force-dynamic";
import type { IncidentWarRoomData } from "@kube-suite/shared";
import { IncidentWarRoom } from "@/components/incidents/incident-war-room";
import { apiFetch, isCompanyMembershipInactiveError } from "@/lib/api-client";
import { PendingMembershipNotice } from "@/components/pending-membership";

export const metadata = {
  title: "Nebula Ops | Incident War Room",
  description: "Emergency overlay voor realtime incident response"
};

export default async function IncidentsPage() {
  try {
    const warRoom = await apiFetch<IncidentWarRoomData>("/compliance/war-room");
    return <IncidentWarRoom warRoom={warRoom} />;
  } catch (error) {
    if (isCompanyMembershipInactiveError(error)) {
      return <PendingMembershipNotice />;
    }
    throw error;
  }
}
