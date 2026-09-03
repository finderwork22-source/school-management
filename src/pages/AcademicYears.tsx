import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Plus,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface AcademicSection {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface AcademicClass {
  id: string;
  name: string;
  grade: string | null;
  capacity: number | null;
  is_active: boolean;
  academic_section_id: string | null;
}

interface ClassStream {
  id: string;
  class_id: string;
  name: string;
  capacity: number | null;
  is_active: boolean;
}

export default function AcademicYears() {
  const { school } = useSchool();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const structureYearId =
    searchParams.get("structure");

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editingYear, setEditingYear] =
    useState<AcademicYear | null>(null);

  const structureYear = useMemo(
    () =>
      years.find(
        (year) => year.id === structureYearId,
      ) ?? null,
    [years, structureYearId],
  );

  async function loadYears() {
    if (!school) {
      setYears([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } =
      await supabase
        .from("academic_years")
        .select(
          "id, name, start_date, end_date, is_active",
        )
        .eq("school_id", school.id)
        .order("name", {
          ascending: false,
        });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setYears(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadYears();
  }, [school]);

  const activeYear = useMemo(
    () =>
      years.find(
        (year) => year.is_active,
      ),
    [years],
  );

  function openCreate() {
    setEditingYear(null);
    setError("");
    setShowModal(true);
  }

  function openEdit(year: AcademicYear) {
    setEditingYear(year);
    setError("");
    setShowModal(true);
  }

  function openStructure(
    year: AcademicYear,
  ) {
    navigate(
      `/academic-years?structure=${encodeURIComponent(
        year.id,
      )}`,
    );
  }

  function closeStructure() {
    navigate(
      `/academics?academicYear=${encodeURIComponent(
        structureYearId ?? activeYear?.id ?? "",
      )}`,
    );
  }

  async function activateYear(
    year: AcademicYear,
  ) {
    if (!school || year.is_active) {
      return;
    }

    setError("");

    const {
      error: deactivateError,
    } = await supabase
      .from("academic_years")
      .update({ is_active: false })
      .eq("school_id", school.id);

    if (deactivateError) {
      setError(
        deactivateError.message,
      );
      return;
    }

    const {
      error: activateError,
    } = await supabase
      .from("academic_years")
      .update({ is_active: true })
      .eq("id", year.id)
      .eq("school_id", school.id);

    if (activateError) {
      setError(
        activateError.message,
      );
      return;
    }

    await loadYears();
  }

  if (structureYear) {
    return (
      <AcademicStructure
        schoolId={school?.id ?? ""}
        year={structureYear}
        onBack={closeStructure}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <button
        type="button"
        onClick={() =>
          navigate(
            `/academics?academicYear=${encodeURIComponent(
              activeYear?.id ?? "",
            )}`,
          )
        }
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Classes & Subjects
      </button>

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays size={19} />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Academic Years
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Create the school year first, then
                configure its sections, classes and
                streams.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={openCreate}>
          <Plus size={16} />
          Add academic year
        </Button>
      </div>

      {activeYear && (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check size={17} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Current academic year
                </p>

                <div className="mt-0.5 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {activeYear.name}
                  </h2>

                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Active
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                openStructure(activeYear)
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Manage structure
              <ArrowRight size={15} />
            </button>
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            School academic years
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Previous years remain available for
            historical records.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading academic years...
          </div>
        ) : years.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <CalendarDays size={22} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              No academic years yet
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Create an academic year before
              setting up classes and subjects.
            </p>

            <Button
              className="mt-5"
              onClick={openCreate}
            >
              <Plus size={15} />
              Add academic year
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {years.map((year) => (
              <div
                key={year.id}
                className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {year.name}
                    </h3>

                    {year.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        <Check size={11} />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {year.start_date
                      ? formatDate(
                          year.start_date,
                        )
                      : "Start date not set"}

                    <span className="mx-2 text-slate-300">
                      •
                    </span>

                    {year.end_date
                      ? formatDate(year.end_date)
                      : "End date not set"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!year.is_active && (
                    <button
                      type="button"
                      onClick={() =>
                        activateYear(year)
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      Set active
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      openStructure(year)
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Manage structure
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openEdit(year)
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Edit ${year.name}`}
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <AcademicYearModal
          schoolId={school?.id ?? ""}
          editingYear={editingYear}
          onClose={() =>
            setShowModal(false)
          }
          onSaved={() => {
            setShowModal(false);
            loadYears();
          }}
        />
      )}
    </div>
  );
}

function AcademicStructure({
  schoolId,
  year,
  onBack,
}: {
  schoolId: string;
  year: AcademicYear;
  onBack: () => void;
}) {
  const [sections, setSections] =
    useState<AcademicSection[]>([]);

  const [classes, setClasses] =
    useState<AcademicClass[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showSectionModal, setShowSectionModal] =
    useState(false);

  const [expandedSectionId, setExpandedSectionId] =
    useState<string | null>(null);

  async function loadStructure() {
    setLoading(true);
    setError("");

    const [
      sectionsResult,
      classesResult,
    ] = await Promise.all([
      supabase
        .from("academic_sections")
        .select(
          "id, school_id, academic_year_id, name, display_order, is_active",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", year.id)
        .order("display_order", {
          ascending: true,
        }),

      supabase
        .from("classes")
        .select(
          "id, name, grade, capacity, is_active, academic_section_id",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", year.id)
        .order("name", {
          ascending: true,
        }),
    ]);

    if (sectionsResult.error) {
      setError(
        sectionsResult.error.message,
      );
      setLoading(false);
      return;
    }

    if (classesResult.error) {
      setError(
        classesResult.error.message,
      );
      setLoading(false);
      return;
    }

    setSections(
      (sectionsResult.data ??
        []) as AcademicSection[],
    );

    setClasses(
      (classesResult.data ??
        []) as AcademicClass[],
    );

    setLoading(false);
  }

  useEffect(() => {
    loadStructure();
  }, [schoolId, year.id]);

  function getClassesForSection(
    sectionId: string,
  ) {
    return classes.filter(
      (item) =>
        item.academic_section_id ===
        sectionId,
    );
  }

  async function toggleSectionStatus(
    section: AcademicSection,
  ) {
    const nextActive = !section.is_active;
    const confirmed = window.confirm(
      `${nextActive ? "Reactivate" : "Deactivate"} section "${section.name}"?`,
    );

    if (!confirmed) return;

    setError("");

    const { error: updateError } = await supabase
      .from("academic_sections")
      .update({ is_active: nextActive })
      .eq("id", section.id)
      .eq("school_id", schoolId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadStructure();
  }

  async function toggleClassStatus(
    schoolClass: AcademicClass,
  ) {
    const nextActive = !schoolClass.is_active;
    const confirmed = window.confirm(
      `${nextActive ? "Reactivate" : "Deactivate"} class "${schoolClass.name}"?`,
    );

    if (!confirmed) return;

    setError("");

    const { error: updateError } = await supabase
      .from("classes")
      .update({ is_active: nextActive })
      .eq("id", schoolClass.id)
      .eq("school_id", schoolId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadStructure();
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-7">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Academic Years
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Academic structure
            </p>

            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {year.name}
              </h1>

              {year.is_active && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  Active
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Configure sections first, then classes
              and optional streams.
            </p>
          </div>

          <Button
            onClick={() =>
              setShowSectionModal(true)
            }
          >
            <Plus size={16} />
            Add section
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Sections
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Each section contains its own classes.
            Deactivate items instead of deleting them
            so historical student records remain safe.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading academic structure...
          </div>
        ) : sections.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold text-slate-800">
              No sections yet
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Add sections such as Creche, Nursery,
              Primary or Lower Secondary.
            </p>

            <Button
              className="mt-5"
              onClick={() =>
                setShowSectionModal(true)
              }
            >
              <Plus size={15} />
              Add section
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sections.map((section) => {
              const sectionClasses =
                getClassesForSection(
                  section.id,
                );

              const expanded =
                expandedSectionId ===
                section.id;

              return (
                <div key={section.id}>
                  <div className="flex items-center gap-2 px-5 py-4 hover:bg-slate-50/70">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSectionId(
                          expanded
                            ? null
                            : section.id,
                        )
                      }
                      className="flex min-w-0 flex-1 items-center justify-between text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          {expanded ? (
                            <ChevronDown size={17} />
                          ) : (
                            <ChevronRight size={17} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {section.name}
                            </h3>

                            <span
                              className={
                                section.is_active
                                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                  : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                              }
                            >
                              {section.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {sectionClasses.length}{" "}
                            class
                            {sectionClasses.length ===
                            1
                              ? ""
                              : "es"}
                          </p>
                        </div>
                      </div>

                      <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {sectionClasses.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleSectionStatus(section)
                      }
                      className={
                        section.is_active
                          ? "h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          : "h-9 shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      }
                    >
                      {section.is_active
                        ? "Deactivate"
                        : "Reactivate"}
                    </button>
                  </div>

                  {expanded && (
                    <SectionClasses
                      schoolId={schoolId}
                      academicYearId={year.id}
                      section={section}
                      classes={sectionClasses}
                      onChanged={
                        loadStructure
                      }
                      onToggleClass={
                        toggleClassStatus
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showSectionModal && (
        <SectionModal
          schoolId={schoolId}
          academicYearId={year.id}
          nextOrder={sections.length + 1}
          onClose={() =>
            setShowSectionModal(false)
          }
          onSaved={() => {
            setShowSectionModal(false);
            loadStructure();
          }}
        />
      )}
    </div>
  );
}

function SectionClasses({
  schoolId,
  academicYearId,
  section,
  classes,
  onChanged,
  onToggleClass,
}: {
  schoolId: string;
  academicYearId: string;
  section: AcademicSection;
  classes: AcademicClass[];
  onChanged: () => void;
  onToggleClass: (schoolClass: AcademicClass) => void;
}) {
  const [showClassModal, setShowClassModal] =
    useState(false);

  const [selectedClassId, setSelectedClassId] =
    useState<string | null>(null);

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Classes
        </p>

        <button
          type="button"
          onClick={() =>
            setShowClassModal(true)
          }
          disabled={!section.is_active}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Add class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-500">
          No classes in this section yet.
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((schoolClass) => (
            <ClassRow
              key={schoolClass.id}
              schoolClass={schoolClass}
              onManageStreams={() =>
                setSelectedClassId(
                  schoolClass.id,
                )
              }
              onToggleStatus={() =>
                onToggleClass(schoolClass)
              }
            />
          ))}
        </div>
      )}

      {showClassModal && (
        <ClassModal
          schoolId={schoolId}
          academicYearId={academicYearId}
          academicSectionId={section.id}
          onClose={() =>
            setShowClassModal(false)
          }
          onSaved={() => {
            setShowClassModal(false);
            onChanged();
          }}
        />
      )}

      {selectedClassId && (
        <StreamsModal
          schoolId={schoolId}
          classId={selectedClassId}
          className={
            classes.find(
              (item) =>
                item.id ===
                selectedClassId,
            )?.name ?? "Class"
          }
          onClose={() =>
            setSelectedClassId(null)
          }
        />
      )}
    </div>
  );
}

function ClassRow({
  schoolClass,
  onManageStreams,
  onToggleStatus,
}: {
  schoolClass: AcademicClass;
  onManageStreams: () => void;
  onToggleStatus: () => void;
}) {
  const [streamCount, setStreamCount] =
    useState<number | null>(null);

  useEffect(() => {
    async function loadStreams() {
      const { count } = await supabase
        .from("class_streams")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("class_id", schoolClass.id)
        .eq("is_active", true);

      setStreamCount(count ?? 0);
    }

    loadStreams();
  }, [schoolClass.id]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">
            {schoolClass.name}
          </h4>

          {!schoolClass.is_active && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              Inactive
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-slate-500">
          Capacity:{" "}
          {schoolClass.capacity ??
            "Not set"}

          {streamCount !== null &&
            streamCount > 0 && (
              <>
                <span className="mx-2 text-slate-300">
                  •
                </span>

                {streamCount} active stream
                {streamCount === 1
                  ? ""
                  : "s"}
              </>
            )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onManageStreams}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
        >
          Manage streams
          <ArrowRight size={14} />
        </button>

        <button
          type="button"
          onClick={onToggleStatus}
          className={
            schoolClass.is_active
              ? "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              : "h-9 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          }
        >
          {schoolClass.is_active
            ? "Deactivate"
            : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function SectionModal({
  schoolId,
  academicYearId,
  nextOrder,
  onClose,
  onSaved,
}: {
  schoolId: string;
  academicYearId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Section name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const { error: saveError } =
      await supabase
        .from("academic_sections")
        .insert({
          school_id: schoolId,
          academic_year_id:
            academicYearId,
          name: name.trim(),
          display_order: nextOrder,
          is_active: true,
        });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <ModalShell
      title="Add section"
      description="Add a school section for this academic year."
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <ErrorBox
            error={error}
            onClose={() => setError("")}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Section name{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Primary"
            required
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <p className="mt-1.5 text-xs text-slate-500">
            Examples: Creche, Nursery, Primary,
            Lower Secondary.
          </p>
        </div>

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Add section"
        />
      </form>
    </ModalShell>
  );
}

function ClassModal({
  schoolId,
  academicYearId,
  academicSectionId,
  onClose,
  onSaved,
}: {
  schoolId: string;
  academicYearId: string;
  academicSectionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Class name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const { error: saveError } =
      await supabase
        .from("classes")
        .insert({
          school_id: schoolId,
          academic_year_id:
            academicYearId,
          academic_section_id:
            academicSectionId,
          name: name.trim(),
          grade: name.trim(),
          section: null,
          capacity:
            capacity.trim()
              ? Number(capacity)
              : null,
          is_active: true,
        });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <ModalShell
      title="Add class"
      description="Create a class inside this section."
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <ErrorBox
            error={error}
            onClose={() => setError("")}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Class name{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. Grade 4"
            required
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Capacity
          </label>

          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(event) =>
              setCapacity(event.target.value)
            }
            placeholder="e.g. 30"
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <p className="mt-1.5 text-xs text-slate-500">
            The maximum number of students for
            this class.
          </p>
        </div>

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Add class"
        />
      </form>
    </ModalShell>
  );
}

function StreamsModal({
  schoolId,
  classId,
  className,
  onClose,
}: {
  schoolId: string;
  classId: string;
  className: string;
  onClose: () => void;
}) {
  const [streams, setStreams] =
    useState<ClassStream[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showAdd, setShowAdd] =
    useState(false);

  async function loadStreams() {
    setLoading(true);

    const { data } = await supabase
      .from("class_streams")
      .select(
        "id, class_id, name, capacity, is_active",
      )
      .eq("class_id", classId)
      .order("name", {
        ascending: true,
      });

    setStreams(
      (data ?? []) as ClassStream[],
    );

    setLoading(false);
  }

  useEffect(() => {
    loadStreams();
  }, [classId]);

  async function toggleStreamStatus(
    stream: ClassStream,
  ) {
    const nextActive = !stream.is_active;
    const confirmed = window.confirm(
      `${nextActive ? "Reactivate" : "Deactivate"} stream "${stream.name}"?`,
    );

    if (!confirmed) return;

    const { error: updateError } = await supabase
      .from("class_streams")
      .update({ is_active: nextActive })
      .eq("id", stream.id)
      .eq("class_id", classId)
      .eq("school_id", schoolId);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    setStreams((current) =>
      current.map((item) =>
        item.id === stream.id
          ? { ...item, is_active: nextActive }
          : item,
      ),
    );
  }

  return (
    <ModalShell
      title={`${className} — Streams`}
      description="Create streams only when the class needs to be divided."
      onClose={onClose}
      wide
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Loading streams...
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              Streams
            </p>

            <button
              type="button"
              onClick={() =>
                setShowAdd(true)
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              Add stream
            </button>
          </div>

          {streams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No streams
              </p>

              <p className="mt-1 text-xs text-slate-500">
                This class currently has one
                classroom. Add a stream when it
                needs to be divided.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {streams.map((stream) => (
                <div
                  key={stream.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {className}{" "}
                      {stream.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Capacity:{" "}
                      {stream.capacity ??
                        "Not set"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={
                        stream.is_active
                          ? "rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500"
                      }
                    >
                      {stream.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        toggleStreamStatus(stream)
                      }
                      className={
                        stream.is_active
                          ? "h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          : "h-8 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                      }
                    >
                      {stream.is_active
                        ? "Deactivate"
                        : "Reactivate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <StreamModal
          schoolId={schoolId}
          classId={classId}
          className={className}
          onClose={() =>
            setShowAdd(false)
          }
          onSaved={() => {
            setShowAdd(false);
            loadStreams();
          }}
        />
      )}
    </ModalShell>
  );
}

function StreamModal({
  schoolId,
  classId,
  className,
  onClose,
  onSaved,
}: {
  schoolId: string;
  classId: string;
  className: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Stream name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const { error: saveError } =
      await supabase
        .from("class_streams")
        .insert({
          school_id: schoolId,
          class_id: classId,
          name: name.trim(),
          capacity:
            capacity.trim()
              ? Number(capacity)
              : null,
          is_active: true,
        });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <ModalShell
      title={`Add stream to ${className}`}
      description="Use streams when a class needs to be divided into additional physical classrooms."
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <ErrorBox
            error={error}
            onClose={() => setError("")}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Stream name{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. A"
            required
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <p className="mt-1.5 text-xs text-slate-500">
            Examples: A, B, C, Blue, Red.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Capacity
          </label>

          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(event) =>
              setCapacity(event.target.value)
            }
            placeholder="e.g. 30"
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Add stream"
        />
      </form>
    </ModalShell>
  );
}

function AcademicYearModal({
  schoolId,
  editingYear,
  onClose,
  onSaved,
}: {
  schoolId: string;
  editingYear: AcademicYear | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(
    editingYear?.name ?? "",
  );

  const [startDate, setStartDate] =
    useState(
      editingYear?.start_date ?? "",
    );

  const [endDate, setEndDate] =
    useState(
      editingYear?.end_date ?? "",
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Academic year name is required.",
      );
      return;
    }

    if (
      startDate &&
      endDate &&
      startDate >= endDate
    ) {
      setError(
        "End date must be after the start date.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      start_date:
        startDate || null,
      end_date: endDate || null,
      school_id: schoolId,
    };

    const result = editingYear
      ? await supabase
          .from("academic_years")
          .update(payload)
          .eq("id", editingYear.id)
          .eq("school_id", schoolId)
      : await supabase
          .from("academic_years")
          .insert(payload);

    if (result.error) {
      setError(
        result.error.message,
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <ModalShell
      title={
        editingYear
          ? "Edit academic year"
          : "Add academic year"
      }
      description={
        editingYear
          ? "Update the academic year details."
          : "Create the academic year before configuring its academic structure."
      }
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <ErrorBox
            error={error}
            onClose={() => setError("")}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Academic year{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="e.g. 2027–2028"
            required
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Start date
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value,
                )
              }
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              End date
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value,
                )
              }
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel={
            editingYear
              ? "Save changes"
              : "Create academic year"
          }
        />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={`w-full ${
          wide ? "max-w-2xl" : "max-w-lg"
        } max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </Button>

      <Button
        type="submit"
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : submitLabel}
      </Button>
    </div>
  );
}

function ErrorBox({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
      <p className="text-xs text-red-600">
        {error}
      </p>

      <button
        type="button"
        onClick={onClose}
        className="text-red-400 hover:text-red-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(value));
}