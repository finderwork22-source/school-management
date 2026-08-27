import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Edit3, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

export default function AcademicYears() {
  const { school } = useSchool();
  const navigate = useNavigate();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  async function loadYears() {
    if (!school) {
      setYears([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("academic_years")
      .select("id, name, start_date, end_date, is_active")
      .eq("school_id", school.id)
      .order("name", { ascending: false });

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
    () => years.find((year) => year.is_active),
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

  function openClasses(year: AcademicYear) {
    navigate(`/academics?academicYear=${encodeURIComponent(year.id)}`);
  }

  async function activateYear(year: AcademicYear) {
    if (!school || year.is_active) return;
    setError("");

    const { error: deactivateError } = await supabase
      .from("academic_years")
      .update({ is_active: false })
      .eq("school_id", school.id);

    if (deactivateError) {
      setError(deactivateError.message);
      return;
    }

    const { error: activateError } = await supabase
      .from("academic_years")
      .update({ is_active: true })
      .eq("id", year.id)
      .eq("school_id", school.id);

    if (activateError) {
      setError(activateError.message);
      return;
    }

    await loadYears();
  }

  return (
    <div className="mx-auto max-w-[1200px]">
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
                Create the school year first, then set up its classes and curriculum.
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
              onClick={() => openClasses(activeYear)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Set up classes
              <ArrowRight size={15} />
            </button>
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
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
            Keep previous years available for historical records.
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
              Create an academic year before setting up classes and subjects.
            </p>
            <Button className="mt-5" onClick={openCreate}>
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
                    {year.start_date ? formatDate(year.start_date) : "Start date not set"}
                    <span className="mx-2 text-slate-300">•</span>
                    {year.end_date ? formatDate(year.end_date) : "End date not set"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!year.is_active && (
                    <button
                      type="button"
                      onClick={() => activateYear(year)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      Set active
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openClasses(year)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    View classes
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => openEdit(year)}
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
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadYears();
          }}
        />
      )}
    </div>
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
  const [name, setName] = useState(editingYear?.name ?? "");
  const [startDate, setStartDate] = useState(editingYear?.start_date ?? "");
  const [endDate, setEndDate] = useState(editingYear?.end_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Academic year name is required.");
      return;
    }

    if (startDate && endDate && startDate >= endDate) {
      setError("End date must be after the start date.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      school_id: schoolId,
    };

    const result = editingYear
      ? await supabase
          .from("academic_years")
          .update(payload)
          .eq("id", editingYear.id)
          .eq("school_id", schoolId)
      : await supabase.from("academic_years").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingYear ? "Edit academic year" : "Add academic year"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This academic year will be available when creating classes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Academic year <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. 2026–2027"
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
                onChange={(event) => setStartDate(event.target.value)}
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
                onChange={(event) => setEndDate(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingYear ? "Save changes" : "Create academic year"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}