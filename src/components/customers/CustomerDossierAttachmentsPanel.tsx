import { FileText, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  dossierBestandHref,
  type DossierAttachmentKind,
  type PortalDossierAttachment,
  type PortalProject
} from "../../lib/portalTypes";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";
import { dateText } from "../projects/measurement/measurementUtils";

export type DossierAttachmentDraft = {
  kind: DossierAttachmentKind;
  projectId?: string;
  titel: string;
  omschrijving?: string;
  file?: File;
};

type CustomerDossierAttachmentsPanelProps = {
  attachments: PortalDossierAttachment[];
  projects: PortalProject[];
  canCreate?: boolean;
  onCreate?: (draft: DossierAttachmentDraft) => Promise<void> | void;
  onArchive?: (attachment: PortalDossierAttachment) => Promise<void> | void;
};

const attachmentKindOptions: Array<{
  kind: DossierAttachmentKind;
  label: string;
  description: string;
  variant: BadgeVariant;
}> = [
  {
    kind: "floor_plan",
    label: "Plattegrond",
    description: "Plattegrond, schets of ruimtefoto voor inmeting.",
    variant: "info"
  },
  {
    kind: "photo",
    label: "Foto",
    description: "Foto van ruimte, situatie, product of bestaande staat.",
    variant: "accent"
  },
  {
    kind: "legacy_excel_quote",
    label: "Oude Excel-offerte",
    description: "Bestaande offerte uit het oude Excel-proces.",
    variant: "warning"
  },
  {
    kind: "physical_dossier",
    label: "Fysieke map",
    description: "Verwijzing naar een papieren dossier of maplocatie.",
    variant: "neutral"
  },
  {
    kind: "scan",
    label: "Scan/document",
    description: "Scan, pdf, werkbon, akkoord of ander document.",
    variant: "success"
  },
  {
    kind: "other",
    label: "Overig",
    description: "Vrij dossierstuk dat niet in de andere soorten past.",
    variant: "neutral"
  }
];

function kindMeta(kind: DossierAttachmentKind) {
  return attachmentKindOptions.find((option) => option.kind === kind) ?? attachmentKindOptions.at(-1)!;
}

function formatFileSize(bytes?: number) {
  if (!bytes) {
    return null;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function CustomerDossierAttachmentsPanel({
  attachments = [],
  projects,
  canCreate = false,
  onCreate,
  onArchive
}: CustomerDossierAttachmentsPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [kind, setKind] = useState<DossierAttachmentKind>("floor_plan");
  const [projectId, setProjectId] = useState("");
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  useEffect(() => {
    if (file && !titel.trim()) {
      setTitel(file.name.replace(/\.[^.]+$/u, ""));
    }
  }, [file, titel]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!titel.trim() || !onCreate) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        kind,
        projectId: projectId || undefined,
        titel: titel.trim(),
        omschrijving: omschrijving.trim() || undefined,
        file
      });
      setKind("floor_plan");
      setProjectId("");
      setTitel("");
      setOmschrijving("");
      setFile(undefined);
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel customer-detail-panel dossier-attachments-panel">
      <SectionHeader
        compact
        title="Dossierstukken"
        description="Plattegronden, foto's, oude Excel-offertes en verwijzingen naar fysieke mappen."
        actions={
          canCreate ? (
            <Button
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={() => setIsFormOpen((current) => !current)}
              size="sm"
              variant={isFormOpen ? "ghost" : "secondary"}
              className="customer-detail-action-button"
            >
              {isFormOpen ? "Annuleren" : "Toevoegen"}
            </Button>
          ) : null
        }
      />

      {isFormOpen ? (
        <form className="dossier-attachment-form" onSubmit={handleSubmit}>
          <Field htmlFor="dossier-attachment-kind" label="Soort" required>
            <Select
              id="dossier-attachment-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as DossierAttachmentKind)}
            >
              {attachmentKindOptions.map((option) => (
                <option value={option.kind} key={option.kind}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="dossier-attachment-project"
            label="Projectkoppeling"
            description="Laat leeg als het stuk alleen bij het klantdossier hoort."
          >
            <Select
              id="dossier-attachment-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Alleen klantdossier</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.titel}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="dossier-attachment-title" label="Titel" required>
            <Input
              id="dossier-attachment-title"
              value={titel}
              onChange={(event) => setTitel(event.target.value)}
              required
            />
          </Field>

          <Field
            htmlFor="dossier-attachment-file"
            label="Bestand of foto"
            description="Optioneel. Voor een fysieke map kun je alleen een titel/notitie vastleggen."
          >
            <Input
              accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx,.heic"
              id="dossier-attachment-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </Field>

          <Field htmlFor="dossier-attachment-description" label="Notitie">
            <Textarea
              id="dossier-attachment-description"
              rows={3}
              value={omschrijving}
              onChange={(event) => setOmschrijving(event.target.value)}
            />
          </Field>

          <div className="dossier-attachment-form-action">
            <Button
              disabled={!titel.trim()}
              isLoading={isSaving}
              leftIcon={<Save size={16} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              Dossierstuk opslaan
            </Button>
          </div>
        </form>
      ) : null}

      {attachments.length === 0 ? (
        <EmptyState
          title="Nog geen dossierstukken"
          description="Voeg later een plattegrond, foto, oude offerte of fysieke mapverwijzing toe."
        />
      ) : (
        <div className="dossier-attachment-list" role="list">
          {attachments.map((attachment) => {
            const meta = kindMeta(attachment.kind);
            const project = attachment.projectId ? projectById.get(attachment.projectId) : undefined;
            const fileSize = formatFileSize(attachment.bestandsgrootteBytes);

            return (
              <article className="dossier-attachment-card" key={attachment.id} role="listitem">
                <div className="dossier-attachment-card-main">
                  <div className="dossier-attachment-title-row">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <strong>{attachment.titel}</strong>
                  </div>
                  <p>{attachment.omschrijving || meta.description}</p>
                  <div className="dossier-attachment-meta">
                    {project ? <span>Project: {project.titel}</span> : <span>Klantdossier</span>}
                    <span>{dateText(attachment.aangemaaktOp)}</span>
                    {attachment.bestandsnaam ? <span>{attachment.bestandsnaam}</span> : null}
                    {fileSize ? <span>{fileSize}</span> : null}
                  </div>
                </div>
                <div className="dossier-attachment-card-actions">
                  {attachment.hasFile ? (
                    <a
                      className="ui-button ui-button-secondary ui-button-sm"
                      href={dossierBestandHref(attachment.id)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <FileText size={16} aria-hidden="true" />
                      Openen
                    </a>
                  ) : (
                    <span className="dossier-attachment-reference">
                      <Upload size={16} aria-hidden="true" />
                      Verwijzing
                    </span>
                  )}
                  {onArchive ? (
                    <Button
                      leftIcon={<Trash2 size={16} aria-hidden="true" />}
                      onClick={() => void onArchive(attachment)}
                      size="sm"
                      variant="ghost"
                      aria-label={`Dossierstuk ${attachment.titel} archiveren`}
                    >
                      Archiveren
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
