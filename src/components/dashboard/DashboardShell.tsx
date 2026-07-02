import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { canEditDossiers, canManage } from "../../lib/auth/session";
import type { AppSession } from "../../lib/auth/session";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { createConvexHttpClient } from "../../lib/convex/client";
import { showErrorToast, showToast } from "../../lib/toast";
import type { Omvang } from "../../lib/agenda";
import type { PortalCustomer, PortalProject } from "../../lib/portalTypes";
import { fromDateInputValue, toDateInputValue } from "../projects/measurement/measurementUtils";
import { PlanMeasurementModal, type TeamMember } from "../projects/PlanMeasurementModal";
import ProductionReadiness from "../imports/ProductionReadiness";
import { Alert } from "../ui/feedback/Alert";
import { DashboardFocusCards } from "./DashboardFocusCards";
import { DashboardInvoiceStrip } from "./DashboardInvoiceStrip";
import { DashboardWorkOverview, type DashboardWorkItem } from "./DashboardWorkOverview";
import { DashboardQuoteFollowUps, type DashboardQuoteFollowUp } from "./DashboardQuoteFollowUps";
import { DashboardRecentProjects } from "./DashboardRecentProjects";
import { DashboardAgendaWidget, type DashboardAgenda } from "./DashboardAgendaWidget";
import { KlantStapModal, type KlantKeuze } from "./KlantStapModal";

type DashboardShellProps = {
  session: AppSession;
};

type DashboardData = {
  openQuoteCount: number;
  plannedWorkCount: number;
  workItemCount: number;
  workItems: DashboardWorkItem[];
  quoteFollowUps: DashboardQuoteFollowUp[];
  projects: PortalProject[];
  invoiceStats: { openAmount: number; overdueCount: number };
  agenda: DashboardAgenda;
};

const emptyDashboard: DashboardData = {
  openQuoteCount: 0,
  plannedWorkCount: 0,
  workItemCount: 0,
  workItems: [],
  quoteFollowUps: [],
  projects: [],
  invoiceStats: { openAmount: 0, overdueCount: 0 },
  agenda: { weekStart: 0, dagen: [], nietToegewezenCount: 0 }
};

function normalizeDashboardData(result: Partial<DashboardData> | null | undefined): DashboardData {
  const workItems = Array.isArray(result?.workItems) ? result.workItems : [];
  const invoiceStats = result?.invoiceStats;

  return {
    openQuoteCount: typeof result?.openQuoteCount === "number" ? result.openQuoteCount : 0,
    plannedWorkCount: typeof result?.plannedWorkCount === "number" ? result.plannedWorkCount : 0,
    workItemCount:
      typeof result?.workItemCount === "number" ? result.workItemCount : workItems.length,
    workItems,
    quoteFollowUps: Array.isArray(result?.quoteFollowUps) ? result.quoteFollowUps : [],
    projects: Array.isArray(result?.projects) ? result.projects : [],
    invoiceStats: {
      openAmount: typeof invoiceStats?.openAmount === "number" ? invoiceStats.openAmount : 0,
      overdueCount: typeof invoiceStats?.overdueCount === "number" ? invoiceStats.overdueCount : 0
    },
    agenda: {
      weekStart: typeof result?.agenda?.weekStart === "number" ? result.agenda.weekStart : 0,
      dagen: Array.isArray(result?.agenda?.dagen) ? result.agenda.dagen : [],
      nietToegewezenCount:
        typeof result?.agenda?.nietToegewezenCount === "number"
          ? result.agenda.nietToegewezenCount
          : 0
    }
  };
}

export default function DashboardShell({ session }: DashboardShellProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [wizardStap, setWizardStap] = useState<"closed" | "klant" | "plan">("closed");
  const [wizardDate, setWizardDate] = useState("");
  const [wizardKlant, setWizardKlant] = useState<KlantKeuze | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const showAdminReadiness = canManage(session.role);
  const canPlan = canEditDossiers(session.role);

  const loadDashboard = useCallback(async () => {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = (await client.query(api.portal.dashboard, {
        tenantSlug: session.tenantId
      })) as Partial<DashboardData> | null;
      setDashboard(normalizeDashboardData(result));
    } catch (loadError) {
      console.error(loadError);
      setError("Werkoverzicht kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Laad de bronnen voor de inplan-wizard (monteurs + klanten) alleen als de gebruiker
  // mag plannen; de widget blijft anders read-only.
  useEffect(() => {
    if (!canPlan) return;
    const client = createConvexHttpClient(session);
    if (!client) return;
    let actief = true;
    void (async () => {
      try {
        const [team, klanten] = await Promise.all([
          client.query(api.portal.listTeamMembers, { tenantSlug: session.tenantId }),
          client.query(api.portal.listCustomers, { tenantSlug: session.tenantId })
        ]);
        if (!actief) return;
        setTeamMembers(((team ?? []) as TeamMember[]).filter((m) => m.role !== "viewer"));
        setCustomers((klanten ?? []) as PortalCustomer[]);
      } catch (wizardError) {
        console.error(wizardError);
      }
    })();
    return () => {
      actief = false;
    };
  }, [canPlan, session]);

  function openWizard(datumMs?: number) {
    setWizardKlant(null);
    setWizardDate(datumMs ? toDateInputValue(datumMs) : "");
    setWizardStap("klant");
  }

  function sluitWizard() {
    setWizardStap("closed");
    setWizardKlant(null);
  }

  // Finale stap: keten createCustomer? → createProject → startOrPlanMeasurement. Er wordt
  // pas hier iets aangemaakt; de server-guard (assertInmeetBoeking) blijft leidend.
  async function planInmeting(data: {
    date: string;
    measuredBy: string;
    measuredByUserId?: string;
    omvang: Omvang;
  }) {
    if (!wizardKlant) return;
    const client = createConvexHttpClient(session);
    if (!client) return;
    const actor = mutationActorFromSession(session);
    const inmeetdatum = fromDateInputValue(data.date);
    setIsPlanning(true);
    try {
      let klantId: string;
      const klantNaam = wizardKlant.naam;
      if (wizardKlant.soort === "bestaand") {
        klantId = wizardKlant.customerId;
      } else {
        klantId = String(
          await client.mutation(api.portal.createCustomer, {
            tenantSlug: session.tenantId,
            actor,
            type: wizardKlant.type,
            weergaveNaam: wizardKlant.naam,
            email: wizardKlant.email,
            telefoon: wizardKlant.telefoon
          })
        );
      }
      const projectId = String(
        await client.mutation(api.portal.createProject, {
          tenantSlug: session.tenantId,
          actor,
          klantId,
          titel: `${klantNaam} — inmeten`,
          createdByExternalUserId: session.userId
        })
      );
      await client.mutation(api.portal.startOrPlanMeasurement, {
        tenantSlug: session.tenantId,
        actor,
        projectId,
        inmeetdatum,
        gemetenDoor: data.measuredBy,
        gemetenDoorUserId: data.measuredByUserId
          ? (data.measuredByUserId as Id<"users">)
          : undefined,
        omvang: data.omvang
      });
      showToast({ title: "Inmeting ingepland", description: klantNaam, tone: "success" });
      sluitWizard();
      await loadDashboard();
    } catch (planError) {
      showErrorToast(planError, "Inplannen mislukt", "Controleer de datum en monteur.");
    } finally {
      setIsPlanning(false);
    }
  }

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Werkoverzicht niet geladen" description={error} />
      ) : null}

      <DashboardInvoiceStrip
        isLoading={isLoading}
        openAmount={dashboard.invoiceStats.openAmount}
        overdueCount={dashboard.invoiceStats.overdueCount}
      />

      <DashboardFocusCards
        isLoading={isLoading}
        workItemCount={dashboard.workItemCount}
        openQuoteCount={dashboard.openQuoteCount}
        plannedWorkCount={dashboard.plannedWorkCount}
      />

      <DashboardWorkOverview
        isLoading={isLoading}
        workItems={dashboard.workItems}
        totalCount={dashboard.workItemCount}
      />

      <DashboardQuoteFollowUps isLoading={isLoading} quoteFollowUps={dashboard.quoteFollowUps} />

      <DashboardAgendaWidget
        isLoading={isLoading}
        agenda={dashboard.agenda}
        canPlan={canPlan}
        onPlan={openWizard}
      />

      <DashboardRecentProjects isLoading={isLoading} projects={dashboard.projects} />

      {showAdminReadiness ? <ProductionReadiness session={session} hideWhenReady /> : null}

      {canPlan ? (
        <>
          <KlantStapModal
            open={wizardStap === "klant"}
            customers={customers}
            onNext={(keuze) => {
              setWizardKlant(keuze);
              setWizardStap("plan");
            }}
            onClose={sluitWizard}
          />
          <PlanMeasurementModal
            open={wizardStap === "plan"}
            session={session}
            teamMembers={teamMembers}
            defaultDate={wizardDate}
            defaultMeasuredBy=""
            isSaving={isPlanning}
            onSubmit={planInmeting}
            onClose={sluitWizard}
          />
        </>
      ) : null}
    </div>
  );
}
