import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  File,
  FileCheck2,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";

type AdmissionStatus =
  | "Pending"
  | "Under Review"
  | "Accepted"
  | "Rejected"
  | "Waitlisted"
  | "Enrolled"
  | "Withdrawn";

type DocumentStatus =
  | "Pending"
  | "Verified"
  | "Rejected";

type AcademicYear = {
  id: string;
  name: string;
};

type AcademicSection = {
  id: string;
  name: string;
};

type SchoolClass = {
  id: string;
  name: string;
};

type AdmissionApplication = {
  id: string;
  school_id: string;
  application_number: string;

  academic_year_id: string;
  section_id: string | null;
  class_id: string | null;

  first_name: string;
  middle_name: string | null;
  last_name: string;

  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  photo_url: string | null;

  previous_school: string | null;
  previous_class: string | null;

  application_date: string;

  status: AdmissionStatus;

  notes: string | null;
  review_notes: string | null;

  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_date: string | null;

  student_id: string | null;

  created_at: string;
  updated_at: string;
};

type AdmissionDocument = {
  id: string;
  school_id: string;
  application_id: string;

  document_type: string;
  document_name: string;
  file_url: string;

  status: DocumentStatus;

  uploaded_at: string;

  verified_by: string | null;
  verified_at: string | null;

  notes: string | null;

  created_at: string;
};

type AdmissionNote = {
  id: string;
  school_id: string;
  application_id: string;

  user_id: string | null;
  note: string;
  created_at: string;
};

const STATUS_OPTIONS: AdmissionStatus[] = [
  "Pending",
  "Under Review",
  "Accepted",
  "Rejected",
  "Waitlisted",
  "Enrolled",
  "Withdrawn",
];

const DOCUMENT_TYPES = [
  "Birth Certificate",
  "Previous School Report",
  "Transfer Certificate",
  "ID / Passport",
  "Medical Certificate",
  "Proof of Address",
  "Parent / Guardian ID",
  "Passport Photo",
  "Other",
];

const DOCUMENT_STATUS_STYLES: Record<
  DocumentStatus,
  string
> = {
  Pending:
    "bg-amber-50 text-amber-700",
  Verified:
    "bg-emerald-50 text-emerald-700",
  Rejected:
    "bg-red-50 text-red-700",
};

const STATUS_STYLES: Record<
  AdmissionStatus,
  string
> = {
  Pending:
    "bg-amber-50 text-amber-700",
  "Under Review":
    "bg-blue-50 text-blue-700",
  Accepted:
    "bg-emerald-50 text-emerald-700",
  Rejected:
    "bg-red-50 text-red-700",
  Waitlisted:
    "bg-violet-50 text-violet-700",
  Enrolled:
    "bg-indigo-50 text-indigo-700",
  Withdrawn:
    "bg-slate-100 text-slate-600",
};

export default function AdmissionDetails() {
  const { id: applicationId } =
    useParams<{ id: string }>();

  const navigate = useNavigate();
  const { school } = useSchool();

  const [application, setApplication] =
    useState<AdmissionApplication | null>(
      null,
    );

  const [academicYear, setAcademicYear] =
    useState<AcademicYear | null>(null);

  const [section, setSection] =
    useState<AcademicSection | null>(null);

  const [schoolClass, setSchoolClass] =
    useState<SchoolClass | null>(null);

  const [documents, setDocuments] =
    useState<AdmissionDocument[]>([]);

  const [notes, setNotes] =
    useState<AdmissionNote[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingStatus, setSavingStatus] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [deletingDocumentId, setDeletingDocumentId] =
    useState<string | null>(null);

  const [updatingDocumentId, setUpdatingDocumentId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const [showUploadModal, setShowUploadModal] =
    useState(false);

  const [showNoteForm, setShowNoteForm] =
    useState(false);

  const [newNote, setNewNote] =
    useState("");

  const [savingNote, setSavingNote] =
    useState(false);

  const [documentType, setDocumentType] =
    useState("Birth Certificate");

  const [documentFile, setDocumentFile] =
    useState<File | null>(null);

  const [documentNotes, setDocumentNotes] =
    useState("");

  const [viewingDocumentId, setViewingDocumentId] =
    useState<string | null>(null);

  async function loadData() {
    if (!school?.id || !applicationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const schoolId = school.id;

      const {
        data: applicationData,
        error: applicationError,
      } = await supabase
        .from("admission_applications")
        .select("*")
        .eq("id", applicationId)
        .eq("school_id", schoolId)
        .single();

      if (applicationError) {
        throw applicationError;
      }

      const currentApplication =
        applicationData as AdmissionApplication;

      setApplication(currentApplication);

      const [
        academicYearResult,
        sectionResult,
        classResult,
        documentsResult,
        notesResult,
      ] = await Promise.all([
        currentApplication.academic_year_id
          ? supabase
              .from("academic_years")
              .select("id,name")
              .eq(
                "id",
                currentApplication.academic_year_id,
              )
              .eq("school_id", schoolId)
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

        currentApplication.section_id
          ? supabase
              .from("academic_sections")
              .select("id,name")
              .eq(
                "id",
                currentApplication.section_id,
              )
              .eq("school_id", schoolId)
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

        currentApplication.class_id
          ? supabase
              .from("classes")
              .select("id,name")
              .eq(
                "id",
                currentApplication.class_id,
              )
              .eq("school_id", schoolId)
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

        supabase
          .from("admission_documents")
          .select("*")
          .eq(
            "application_id",
            applicationId,
          )
          .eq("school_id", schoolId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("admission_notes")
          .select("*")
          .eq(
            "application_id",
            applicationId,
          )
          .eq("school_id", schoolId)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (academicYearResult.error) {
        throw academicYearResult.error;
      }

      if (sectionResult.error) {
        throw sectionResult.error;
      }

      if (classResult.error) {
        throw classResult.error;
      }

      if (documentsResult.error) {
        throw documentsResult.error;
      }

      if (notesResult.error) {
        throw notesResult.error;
      }

      setAcademicYear(
        academicYearResult.data
          ? (academicYearResult.data as AcademicYear)
          : null,
      );

      setSection(
        sectionResult.data
          ? (sectionResult.data as AcademicSection)
          : null,
      );

      setSchoolClass(
        classResult.data
          ? (classResult.data as SchoolClass)
          : null,
      );

      setDocuments(
        (documentsResult.data ??
          []) as AdmissionDocument[],
      );

      setNotes(
        (notesResult.data ??
          []) as AdmissionNote[],
      );
    } catch (e) {
      console.error(
        "Failed to load admission:",
        e,
      );

      setError(
        e instanceof Error
          ? e.message
          : "Unable to load admission.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [
    school?.id,
    applicationId,
  ]);

  async function updateApplicationStatus(
    status: AdmissionStatus,
  ) {
    if (
      !school?.id ||
      !applicationId ||
      !application
    ) {
      return;
    }

    if (status === application.status) {
      return;
    }

    setSavingStatus(true);
    setError("");

    try {
      const updatePayload: Record<
        string,
        string | null
      > = {
        status,
      };

      if (
        [
          "Accepted",
          "Rejected",
          "Waitlisted",
          "Enrolled",
        ].includes(status)
      ) {
        updatePayload.decision_date =
          new Date().toISOString();
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from("admission_applications")
        .update(updatePayload)
        .eq("id", applicationId)
        .eq("school_id", school.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      setApplication(
        data as AdmissionApplication,
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to update application status.",
      );
    } finally {
      setSavingStatus(false);
    }
  }

  function resetUploadForm() {
    setDocumentType(
      "Birth Certificate",
    );
    setDocumentFile(null);
    setDocumentNotes("");
  }

  function closeUploadModal() {
    if (uploading) return;

    setShowUploadModal(false);
    resetUploadForm();
  }

  function handleDocumentFileChange(
    file: File | null,
  ) {
    if (!file) {
      setDocumentFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError(
        "Document must be 15 MB or smaller.",
      );
      return;
    }

    setError("");
    setDocumentFile(file);
  }

  async function uploadDocument() {
    if (
      !school?.id ||
      !applicationId ||
      !documentFile
    ) {
      setError(
        "Please select a document to upload.",
      );
      return;
    }

    setUploading(true);
    setError("");

    try {
      const originalName =
        documentFile.name;

      const extension =
        originalName
          .split(".")
          .pop()
          ?.toLowerCase() || "file";

      const safeBaseName =
        originalName
          .replace(
            /\.[^/.]+$/,
            "",
          )
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "-",
          )
          .replace(
            /-+/g,
            "-",
          )
          .slice(0, 80);

      const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeBaseName}.${extension}`;

      const filePath = [
        school.id,
        applicationId,
        fileName,
      ].join("/");

      const {
        error: uploadError,
      } = await supabase.storage
        .from("admission-documents")
        .upload(
          filePath,
          documentFile,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              documentFile.type ||
              "application/octet-stream",
          },
        );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: documentData,
        error: documentInsertError,
      } = await supabase
        .from("admission_documents")
        .insert({
          school_id: school.id,
          application_id:
            applicationId,
          document_type:
            documentType,
          document_name:
            originalName,
          file_url:
            filePath,
          status: "Pending",
          notes:
            documentNotes.trim() ||
            null,
        })
        .select("*")
        .single();

      if (documentInsertError) {
        /*
         * Database insert failed after the file
         * was uploaded. Remove the orphaned file.
         */
        await supabase.storage
          .from("admission-documents")
          .remove([filePath]);

        throw documentInsertError;
      }

      setDocuments((current) => [
        documentData as AdmissionDocument,
        ...current,
      ]);

      closeUploadModal();
    } catch (e) {
      console.error(
        "Failed to upload admission document:",
        e,
      );

      setError(
        e instanceof Error
          ? e.message
          : "Unable to upload document.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function createSignedDocumentUrl(
    document: AdmissionDocument,
  ) {
    setViewingDocumentId(document.id);
    setError("");

    try {
      const {
        data,
        error: signedUrlError,
      } = await supabase.storage
        .from("admission-documents")
        .createSignedUrl(
          document.file_url,
          60 * 10,
        );

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Unable to generate document URL.",
        );
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to open document.",
      );
    } finally {
      setViewingDocumentId(null);
    }
  }

  async function deleteDocument(
    document: AdmissionDocument,
  ) {
    if (!school?.id) return;

    const confirmed =
      window.confirm(
        `Delete "${document.document_name}"? This action cannot be undone.`,
      );

    if (!confirmed) return;

    setDeletingDocumentId(
      document.id,
    );
    setError("");

    try {
      /*
       * file_url stores the private Storage path.
       */
      const {
        error: storageError,
      } = await supabase.storage
        .from("admission-documents")
        .remove([
          document.file_url,
        ]);

      if (storageError) {
        throw storageError;
      }

      const {
        error: databaseError,
      } = await supabase
        .from("admission_documents")
        .delete()
        .eq("id", document.id)
        .eq("school_id", school.id)
        .eq(
          "application_id",
          applicationId,
        );

      if (databaseError) {
        throw databaseError;
      }

      setDocuments((current) =>
        current.filter(
          (item) =>
            item.id !== document.id,
        ),
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete document.",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function updateDocumentStatus(
    document: AdmissionDocument,
    status: DocumentStatus,
  ) {
    if (!school?.id) return;

    setUpdatingDocumentId(
      document.id,
    );
    setError("");

    try {
      const updatePayload: {
        status: DocumentStatus;
        verified_at?: string | null;
      } = {
        status,
      };

      if (status === "Verified") {
        updatePayload.verified_at =
          new Date().toISOString();
      } else {
        updatePayload.verified_at =
          null;
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from("admission_documents")
        .update(updatePayload)
        .eq("id", document.id)
        .eq("school_id", school.id)
        .eq(
          "application_id",
          applicationId,
        )
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id
            ? (data as AdmissionDocument)
            : item,
        ),
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to update document.",
      );
    } finally {
      setUpdatingDocumentId(null);
    }
  }

  async function saveNote() {
    if (
      !school?.id ||
      !applicationId ||
      !newNote.trim()
    ) {
      return;
    }

    setSavingNote(true);
    setError("");

    try {
      const {
        data,
        error: noteError,
      } = await supabase
        .from("admission_notes")
        .insert({
          school_id: school.id,
          application_id:
            applicationId,
          note: newNote.trim(),
        })
        .select("*")
        .single();

      if (noteError) {
        throw noteError;
      }

      setNotes((current) => [
        data as AdmissionNote,
        ...current,
      ]);

      setNewNote("");
      setShowNoteForm(false);
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to save note.",
      );
    } finally {
      setSavingNote(false);
    }
  }

  const applicantName = useMemo(() => {
    if (!application) return "";

    return [
      application.first_name,
      application.middle_name,
      application.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }, [application]);

  const documentStats = useMemo(() => {
    return {
      total: documents.length,

      verified: documents.filter(
        (document) =>
          document.status === "Verified",
      ).length,

      pending: documents.filter(
        (document) =>
          document.status === "Pending",
      ).length,

      rejected: documents.filter(
        (document) =>
          document.status === "Rejected",
      ).length,
    };
  }, [documents]);

  const formatDate = (
    value: string | null,
  ) => {
    if (!value) return "—";

    const date = new Date(
      value.includes("T")
        ? value
        : `${value}T00:00:00`,
    );

    if (
      Number.isNaN(date.getTime())
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    ).format(date);
  };

  const formatDateTime = (
    value: string,
  ) => {
    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  };

  const formatFileSize = (
    bytes: number,
  ) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };

  function getFileIcon(
    fileName: string,
  ) {
    const extension =
      fileName
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      ["jpg", "jpeg", "png", "webp"].includes(
        extension ?? "",
      )
    ) {
      return (
        <ImageIcon size={19} />
      );
    }

    if (
      extension === "pdf"
    ) {
      return (
        <FileText size={19} />
      );
    }

    return <File size={19} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2
            size={18}
            className="animate-spin text-indigo-600"
          />
          Loading admission...
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <button
          type="button"
          onClick={() =>
            navigate("/admissions")
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Admissions
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />

          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Admission application not found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error ||
              "The application could not be found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[1400px]">
        {/* Back */}
        <button
          type="button"
          onClick={() =>
            navigate("/admissions")
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Admissions
        </button>

        {error && (
          <ErrorBox
            error={error}
            clear={() => setError("")}
          />
        )}

        {/* Header */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                {/* Photo */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-indigo-500 ring-1 ring-slate-200">
                  {application.photo_url ? (
                    <img
                      src={
                        application.photo_url
                      }
                      alt={applicantName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={32} />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-slate-900">
                      {applicantName}
                    </h1>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_STYLES[
                          application.status
                        ]
                      }`}
                    >
                      {application.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Application{" "}
                    <span className="font-semibold text-slate-700">
                      {application.application_number}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Applied{" "}
                    {formatDate(
                      application.application_date,
                    )}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={application.status}
                  onChange={(event) =>
                    void updateApplicationStatus(
                      event.target.value as AdmissionStatus,
                    )
                  }
                  disabled={savingStatus}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-50"
                >
                  {STATUS_OPTIONS.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ),
                  )}
                </select>

                {savingStatus && (
                  <Loader2
                    size={16}
                    className="animate-spin text-indigo-600"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            {/* Student information */}
            <SectionCard
              title="Student Information"
              icon={
                <UserRound size={17} />
              }
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  label="First Name"
                  value={
                    application.first_name
                  }
                />

                <InfoItem
                  label="Middle Name"
                  value={
                    application.middle_name ||
                    "—"
                  }
                />

                <InfoItem
                  label="Last Name"
                  value={
                    application.last_name
                  }
                />

                <InfoItem
                  label="Date of Birth"
                  value={formatDate(
                    application.date_of_birth,
                  )}
                />

                <InfoItem
                  label="Gender"
                  value={
                    application.gender ||
                    "—"
                  }
                />

                <InfoItem
                  label="Nationality"
                  value={
                    application.nationality ||
                    "—"
                  }
                />
              </div>
            </SectionCard>

            {/* Academic placement */}
            <SectionCard
              title="Academic Placement"
              icon={
                <GraduationCap
                  size={17}
                />
              }
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  label="Academic Year"
                  value={
                    academicYear?.name ||
                    "—"
                  }
                />

                <InfoItem
                  label="Section"
                  value={
                    section?.name ||
                    "—"
                  }
                />

                <InfoItem
                  label="Desired Class"
                  value={
                    schoolClass?.name ||
                    "Not assigned"
                  }
                />
              </div>
            </SectionCard>

            {/* Previous education */}
            <SectionCard
              title="Previous Education"
              icon={
                <FileText size={17} />
              }
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <InfoItem
                  label="Previous School"
                  value={
                    application.previous_school ||
                    "—"
                  }
                />

                <InfoItem
                  label="Previous Class"
                  value={
                    application.previous_class ||
                    "—"
                  }
                />
              </div>
            </SectionCard>

            {/* Documents */}
            <SectionCard
              title="Admission Documents"
              icon={
                <Paperclip size={17} />
              }
              action={
                <button
                  type="button"
                  onClick={() =>
                    setShowUploadModal(true)
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Upload size={14} />
                  Upload Document
                </button>
              }
            >
              {/* Document summary */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DocumentStat
                  label="Total"
                  value={
                    documentStats.total
                  }
                />

                <DocumentStat
                  label="Verified"
                  value={
                    documentStats.verified
                  }
                />

                <DocumentStat
                  label="Pending"
                  value={
                    documentStats.pending
                  }
                />

                <DocumentStat
                  label="Rejected"
                  value={
                    documentStats.rejected
                  }
                />
              </div>

              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 ring-1 ring-slate-200">
                    <Paperclip
                      size={22}
                    />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-900">
                    No documents uploaded
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                    Upload the documents
                    required to process this
                    admission application.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowUploadModal(
                        true,
                      )
                    }
                    className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Upload size={14} />
                    Upload first document
                  </button>
                </div>
              ) : (
                <div className="relative rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-100">
                    {documents.map(
                      (document) => (
                        <DocumentRow
                          key={document.id}
                          document={document}
                          deleting={
                            deletingDocumentId ===
                            document.id
                          }
                          updating={
                            updatingDocumentId ===
                            document.id
                          }
                          viewing={
                            viewingDocumentId ===
                            document.id
                          }
                          onView={() =>
                            void createSignedDocumentUrl(
                              document,
                            )
                          }
                          onDelete={() =>
                            void deleteDocument(
                              document,
                            )
                          }
                          onStatusChange={(
                            status,
                          ) =>
                            void updateDocumentStatus(
                              document,
                              status,
                            )
                          }
                          formatDate={
                            formatDateTime
                          }
                          getFileIcon={
                            getFileIcon
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Application notes */}
            <SectionCard
              title="Application Notes"
              icon={
                <MessageSquare
                  size={17}
                />
              }
              action={
                <button
                  type="button"
                  onClick={() =>
                    setShowNoteForm(
                      (current) =>
                        !current,
                    )
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <MessageSquare
                    size={14}
                  />
                  Add Note
                </button>
              }
            >
              {showNoteForm && (
                <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    New note
                  </label>

                  <textarea
                    value={newNote}
                    onChange={(event) =>
                      setNewNote(
                        event.target.value,
                      )
                    }
                    rows={4}
                    placeholder="Write an internal admission note..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewNote("");
                        setShowNoteForm(
                          false,
                        );
                      }}
                      disabled={
                        savingNote
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void saveNote()
                      }
                      disabled={
                        savingNote ||
                        !newNote.trim()
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingNote && (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      )}

                      Save Note
                    </button>
                  </div>
                </div>
              )}

              {notes.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="mx-auto h-7 w-7 text-slate-300" />

                  <p className="mt-2 text-xs text-slate-500">
                    No internal notes yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map(
                    (note) => (
                      <div
                        key={note.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {note.note}
                        </p>

                        <p className="mt-3 text-[11px] text-slate-400">
                          {formatDateTime(
                            note.created_at,
                          )}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Application overview */}
            <SectionCard
              title="Application Overview"
              icon={
                <FileCheck2
                  size={17}
                />
              }
            >
              <div className="space-y-4">
                <InfoItem
                  label="Application Number"
                  value={
                    application.application_number
                  }
                />

                <InfoItem
                  label="Application Date"
                  value={formatDate(
                    application.application_date,
                  )}
                />

                <InfoItem
                  label="Current Status"
                  value={
                    application.status
                  }
                />

                <InfoItem
                  label="Created"
                  value={formatDateTime(
                    application.created_at,
                  )}
                />

                <InfoItem
                  label="Last Updated"
                  value={formatDateTime(
                    application.updated_at,
                  )}
                />
              </div>
            </SectionCard>

            {/* Decision */}
            <SectionCard
              title="Admission Decision"
              icon={
                <CheckCircle2
                  size={17}
                />
              }
            >
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Decision
                  </p>

                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                        STATUS_STYLES[
                          application.status
                        ]
                      }`}
                    >
                      {application.status}
                    </span>
                  </div>
                </div>

                <InfoItem
                  label="Decision Date"
                  value={formatDateTimeOrDash(
                    application.decision_date,
                  )}
                />

                <InfoItem
                  label="Reviewed At"
                  value={formatDateTimeOrDash(
                    application.reviewed_at,
                  )}
                />

                {application.review_notes && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Review Notes
                    </p>

                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {
                        application.review_notes
                      }
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Original notes */}
            {application.notes && (
              <SectionCard
                title="Applicant Notes"
                icon={
                  <FileText
                    size={17}
                  />
                }
              >
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {application.notes}
                </p>
              </SectionCard>
            )}

            {/* Enrollment */}
            {application.status ===
              "Accepted" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <GraduationCap
                      size={18}
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">
                      Ready for Enrollment
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      This application has been
                      accepted. The next step is to
                      create the official student
                      record and enrollment.
                    </p>

                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white opacity-60"
                    >
                      <GraduationCap
                        size={14}
                      />
                      Enroll Student
                    </button>

                    <p className="mt-2 text-[10px] text-emerald-600">
                      Enrollment workflow will be
                      enabled in the next step.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <UploadDocumentModal
          documentType={documentType}
          setDocumentType={
            setDocumentType
          }
          documentFile={documentFile}
          onFileChange={
            handleDocumentFileChange
          }
          documentNotes={
            documentNotes
          }
          setDocumentNotes={
            setDocumentNotes
          }
          uploading={uploading}
          onClose={
            closeUploadModal
          }
          onUpload={() =>
            void uploadDocument()
          }
        />
      )}
    </>
  );
}

/* =========================================================
   SECTION CARD
========================================================= */

function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {icon}
          </div>

          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
        </div>

        {action}
      </div>

      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   DOCUMENT STAT
========================================================= */

function DocumentStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   DOCUMENT ROW
========================================================= */

function DocumentRow({
  document,
  deleting,
  updating,
  viewing,
  onView,
  onDelete,
  onStatusChange,
  formatDate,
  getFileIcon,
}: {
  document: AdmissionDocument;
  deleting: boolean;
  updating: boolean;
  viewing: boolean;
  onView: () => void;
  onDelete: () => void;
  onStatusChange: (
    status: DocumentStatus,
  ) => void;
  formatDate: (
    value: string,
  ) => string;
  getFileIcon: (
    fileName: string,
  ) => ReactNode;
}) {
  const [showActions, setShowActions] =
    useState(false);

  return (
    <div
      className={`relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${
        showActions ? "z-30" : "z-0"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {getFileIcon(
            document.document_name,
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900">
              {document.document_name}
            </p>

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                DOCUMENT_STATUS_STYLES[
                  document.status
                ]
              }`}
            >
              {document.status}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
            <span>
              {document.document_type}
            </span>

            <span>•</span>

            <span>
              {formatDate(
                document.uploaded_at,
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onView}
          disabled={
            viewing ||
            deleting
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {viewing ? (
            <Loader2
              size={13}
              className="animate-spin"
            />
          ) : (
            <ExternalLink
              size={13}
            />
          )}
          View
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setShowActions(
                (current) =>
                  !current,
              )
            }
            disabled={
              updating ||
              deleting
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <MoreVertical
              size={16}
            />
          </button>

          {showActions && (
            <div className="absolute right-0 top-10 z-[60] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {document.status !==
                "Verified" && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(
                      false,
                    );
                    onStatusChange(
                      "Verified",
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <Check
                    size={14}
                  />
                  Mark Verified
                </button>
              )}

              {document.status !==
                "Rejected" && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(
                      false,
                    );
                    onStatusChange(
                      "Rejected",
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <XCircle
                    size={14}
                  />
                  Mark Rejected
                </button>
              )}

              {document.status !==
                "Pending" && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(
                      false,
                    );
                    onStatusChange(
                      "Pending",
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
                >
                  <Clock3
                    size={14}
                  />
                  Mark Pending
                </button>
              )}

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setShowActions(
                    false,
                  );
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2
                  size={14}
                />
                Delete Document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   UPLOAD DOCUMENT MODAL
========================================================= */

function UploadDocumentModal({
  documentType,
  setDocumentType,
  documentFile,
  onFileChange,
  documentNotes,
  setDocumentNotes,
  uploading,
  onClose,
  onUpload,
}: {
  documentType: string;
  setDocumentType: (
    value: string,
  ) => void;

  documentFile: File | null;

  onFileChange: (
    file: File | null,
  ) => void;

  documentNotes: string;

  setDocumentNotes: (
    value: string,
  ) => void;

  uploading: boolean;

  onClose: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Upload Admission Document
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Add a supporting document to this
              application.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {/* Document type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Document type
              </label>

              <select
                value={documentType}
                onChange={(event) =>
                  setDocumentType(
                    event.target.value,
                  )
                }
                disabled={uploading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {DOCUMENT_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* File */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                File
              </label>

              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition ${
                  documentFile
                    ? "border-indigo-300 bg-indigo-50/50"
                    : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30"
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(
                    event,
                  ) => {
                    const file =
                      event.currentTarget
                        .files?.[0] ??
                      null;

                    onFileChange(
                      file,
                    );

                    event.currentTarget.value =
                      "";
                  }}
                />

                {documentFile ? (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                      <FileCheck2
                        size={21}
                      />
                    </div>

                    <p className="mt-3 max-w-full truncate px-4 text-sm font-medium text-slate-900">
                      {
                        documentFile.name
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatBytes(
                        documentFile.size,
                      )}
                    </p>

                    <span className="mt-3 text-xs font-semibold text-indigo-600">
                      Choose another file
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                      <Upload
                        size={21}
                      />
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      Click to choose a file
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      PDF, JPG, PNG, WebP, DOC or
                      DOCX
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Maximum 15 MB
                    </p>
                  </>
                )}
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Document notes
              </label>

              <textarea
                value={
                  documentNotes
                }
                onChange={(event) =>
                  setDocumentNotes(
                    event.target.value,
                  )
                }
                disabled={uploading}
                rows={3}
                placeholder="Optional notes about this document..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onUpload}
            disabled={
              uploading ||
              !documentFile
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ERROR BOX
========================================================= */

function ErrorBox({
  error,
  clear,
}: {
  error: string;
  clear: () => void;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertCircle
          size={16}
          className="mt-0.5 shrink-0 text-red-500"
        />

        <p className="text-sm text-red-700">
          {error}
        </p>
      </div>

      <button
        type="button"
        onClick={clear}
        className="shrink-0 text-red-400 hover:text-red-600"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatDateTimeOrDash(
  value: string | null,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatBytes(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}