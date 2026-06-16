import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { PortalRoom } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { RoomEditForm } from "./RoomEditForm";

type ProjectRoomsPanelProps = {
  rooms: PortalRoom[];
  canEdit: boolean;
  onAddRoom: (name: string, areaM2?: number, perimeterMeter?: number) => Promise<void>;
  onSaveRoom: (
    roomId: string,
    data: {
      name: string;
      floor?: string;
      areaM2?: number;
      perimeterMeter?: number;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteRoom: (room: PortalRoom) => void;
};

export function ProjectRoomsPanel({
  rooms,
  canEdit,
  onAddRoom,
  onSaveRoom,
  onDeleteRoom
}: ProjectRoomsPanelProps) {
  const [roomName, setRoomName] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [perimeterMeter, setPerimeterMeter] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingRoom, setEditingRoom] = useState<PortalRoom | null>(null);

  async function handleAdd(event: SubmitEventLike) {
    event.preventDefault();
    if (!roomName.trim()) return;

    setIsAdding(true);
    try {
      await onAddRoom(
        roomName.trim(),
        Number(areaM2) || undefined,
        Number(perimeterMeter) || undefined
      );
      setRoomName("");
      setAreaM2("");
      setPerimeterMeter("");
    } catch (err) {
      // Keep inputs on failure
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSave(data: {
    name: string;
    floor?: string;
    areaM2?: number;
    perimeterMeter?: number;
    notes?: string;
  }) {
    if (!editingRoom) return;
    await onSaveRoom(editingRoom.id, data);
    setEditingRoom(null);
  }

  const roomColumns = useMemo<Array<DataTableColumn<PortalRoom>>>(
    () => [
      {
        key: "name",
        header: "Ruimte",
        priority: "primary",
        render: (room) => <strong>{room.naam}</strong>
      },
      {
        key: "area",
        header: "m2",
        align: "right",
        width: "100px",
        render: (room) => room.oppervlakteM2 ?? "-"
      },
      {
        key: "perimeter",
        header: "Omtrek",
        align: "right",
        width: "110px",
        render: (room) => (room.omtrekMeter ? `${room.omtrekMeter} m` : "-")
      },
      {
        key: "notes",
        header: "Notities",
        hideOnMobile: true,
        render: (room) => room.notities ?? "-"
      },
      {
        key: "actions",
        header: "Acties",
        width: "180px",
        render: (room) =>
          canEdit ? (
            <div className="toolbar">
              <Button size="sm" variant="secondary" onClick={() => setEditingRoom(room)}>
                <Pencil size={16} aria-hidden="true" />
                Bewerken
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDeleteRoom(room)}>
                <Trash2 size={16} aria-hidden="true" />
                Verwijderen
              </Button>
            </div>
          ) : (
            "-"
          )
      }
    ],
    [canEdit, onDeleteRoom]
  );

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Ruimtes en maten"
        description="Maten blijven automatisch onderdeel van het projectdossier."
      />
      {canEdit ? (
        <form className="responsive-form-row" onSubmit={handleAdd}>
          <Field htmlFor="room-name" label="Ruimte" required>
            <Input
              id="room-name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              required
            />
          </Field>
          <Field htmlFor="room-area" label="m2">
            <Input
              id="room-area"
              inputMode="decimal"
              value={areaM2}
              onChange={(event) => setAreaM2(event.target.value)}
            />
          </Field>
          <Field htmlFor="room-perimeter" label="Omtrek m">
            <Input
              id="room-perimeter"
              inputMode="decimal"
              value={perimeterMeter}
              onChange={(event) => setPerimeterMeter(event.target.value)}
            />
          </Field>
          <Button
            isLoading={isAdding}
            leftIcon={<Plus size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Ruimte toevoegen
          </Button>
        </form>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <DataTable
          ariaLabel="Projectruimtes"
          columns={roomColumns}
          density="compact"
          emptyDescription="Voeg hierboven de eerste ruimte toe."
          emptyTitle="Nog geen ruimtes"
          getRowKey={(room) => room.id}
          mobileMode="cards"
          renderMobileCard={(room) => (
            <div className="mobile-card-section">
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <strong>{room.naam}</strong>
                  <small className="muted">{room.verdieping ?? "Geen verdieping"}</small>
                </div>
                <strong>{room.oppervlakteM2 ?? "-"} m2</strong>
              </div>
              <div className="mobile-card-meta">
                <span>{room.omtrekMeter ? `${room.omtrekMeter} m omtrek` : "Geen omtrek"}</span>
                <span>{room.notities ?? "Geen notities"}</span>
              </div>
              {canEdit ? (
                <div className="mobile-card-actions">
                  <Button
                    leftIcon={<Pencil size={16} aria-hidden="true" />}
                    onClick={() => setEditingRoom(room)}
                    size="sm"
                    variant="secondary"
                  >
                    Bewerken
                  </Button>
                  <Button
                    leftIcon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() => onDeleteRoom(room)}
                    size="sm"
                    variant="danger"
                  >
                    Verwijderen
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          rows={rooms}
        />
      </div>

      {editingRoom ? (
        <RoomEditForm
          room={editingRoom}
          onSave={handleSave}
          onCancel={() => setEditingRoom(null)}
        />
      ) : null}
    </section>
  );
}
