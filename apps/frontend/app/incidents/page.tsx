import type { IncidentWarRoomData } from "@kube-suite/shared";
import { IncidentWarRoom } from "@/components/incidents/incident-war-room";
import { apiFetch } from "@/lib/api-client";

export const metadata = {
  title: "Nebula Ops | Incident War Room",
  description: "Emergency overlay voor realtime incident response"
};

export default async function IncidentsPage() {
  const warRoom = await apiFetch<IncidentWarRoomData>("/compliance/war-room");
  return <IncidentWarRoom warRoom={warRoom} />;
}
