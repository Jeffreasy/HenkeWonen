type DossierActionsProps = {
  canCreateDossiers: boolean;
};

export function DossierActions({ canCreateDossiers }: DossierActionsProps) {
  if (!canCreateDossiers) {
    return null;
  }

  return (
    <section className="grid two-column-even" aria-label="Nieuwe dossieracties">
      <a className="card" href="/portal/klanten">
        <span className="badge accent">Nieuwe aanvraag</span>
        <h2>Klant vastleggen</h2>
        <p className="muted">Maak een klantdossier aan wanneer iemand belt, mailt of langskomt.</p>
      </a>

      <a className="card" href="/portal/projecten">
        <span className="badge accent">Werk starten</span>
        <h2>Project aanmaken</h2>
        <p className="muted">Start een project vanuit een bestaande klant voor inmeten, offerte en uitvoering.</p>
      </a>
    </section>
  );
}
