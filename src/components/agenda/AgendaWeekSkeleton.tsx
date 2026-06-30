import { Card } from "../ui/data-display/Card";
import { Skeleton } from "../ui/feedback/Skeleton";

/**
 * Spiegelt de agenda-weekweergave tijdens laden: een paar monteur-kaarten met
 * elk een kop + 7-daags rooster. Zelfde className-structuur (agenda-monteur /
 * agenda-week / agenda-dag) zodat er geen layout-sprong is als de data binnenkomt.
 */
export function AgendaWeekSkeleton() {
  const dagen = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div aria-label="Agenda laden" aria-busy="true">
      {[0, 1, 2].map((m) => (
        <Card key={m} className="agenda-monteur">
          <div className="agenda-monteur-head">
            <Skeleton height={18} width={150} />
            <Skeleton height={28} width={130} />
          </div>
          <div className="agenda-week">
            {dagen.map((d) => (
              <div className="agenda-dag" key={d}>
                <div className="agenda-dag-kop">
                  <Skeleton height={11} width={34} />
                  <Skeleton height={11} width={44} />
                </div>
                <Skeleton height={14} width="72%" />
                {d >= 1 && d <= 3 ? <Skeleton height={20} width="58%" /> : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
