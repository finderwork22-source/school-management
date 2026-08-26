import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Search,
  Clock,
  UserRound,
  ShieldCheck,
  CalendarDays,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";

import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";

interface PickupRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  pickupPersonName: string;
  pickupPersonPhone: string;
  pickupPersonRole: string;
  releasedBy: string;
  releasedAt: string;
  notes: string | null;
}

export default function PickupHistory() {
  const { school } = useSchool();

  const [records, setRecords] =
    useState<PickupRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [date, setDate] =
    useState("");

  const [selectedRecord, setSelectedRecord] =
    useState<PickupRecord | null>(null);

  async function loadHistory() {
    if (!school) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: historyError } =
      await supabase
        .from("student_pickups")
        .select(`
          id,
          student_id,
          released_at,
          notes,

          students (
            student_id,
            first_name,
            last_name,

            enrollments (
              classes (
                name
              )
            )
          ),

          authorized_pickup_persons (
            first_name,
            last_name,
            phone,
            relationship
          )
        `)
        .eq("school_id", school.id)
        .order("released_at", {
          ascending: false,
        });

    if (historyError) {
      console.error(
        "Failed to load pickup history:",
        historyError,
      );

      setError(historyError.message);
      setRecords([]);
      setLoading(false);
      return;
    }

    const pickupRecords: PickupRecord[] =
      (data ?? []).map((record) => {
        const student =
          Array.isArray(record.students)
            ? record.students[0]
            : record.students;

        const person =
          Array.isArray(
            record.authorized_pickup_persons,
          )
            ? record.authorized_pickup_persons[0]
            : record.authorized_pickup_persons;

        const enrollment =
          Array.isArray(
            student?.enrollments,
          )
            ? student.enrollments[0]
            : student?.enrollments;

        const classData =
          Array.isArray(
            enrollment?.classes,
          )
            ? enrollment.classes[0]
            : enrollment?.classes;

        return {
          id: record.id,

          studentId:
            student?.student_id ?? "",

          studentName: student
            ? `${student.first_name} ${student.last_name}`
            : "Unknown student",

          className:
            classData?.name ??
            "Unassigned",

          pickupPersonName: person
            ? `${person.first_name} ${person.last_name}`
            : "Unknown person",

          pickupPersonPhone:
            person?.phone ?? "",

          pickupPersonRole:
            person?.relationship ??
            "Unknown",

          releasedBy: "School Staff",

          releasedAt:
            record.released_at,

          notes:
            record.notes ?? null,
        };
      });

    setRecords(pickupRecords);
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();
  }, [school]);

  const filteredRecords =
    useMemo(() => {
      const query = search
        .toLowerCase()
        .trim();

      return records.filter((record) => {
        const matchesSearch =
          !query ||
          record.studentName
            .toLowerCase()
            .includes(query) ||
          record.studentId
            .toLowerCase()
            .includes(query) ||
          record.pickupPersonName
            .toLowerCase()
            .includes(query) ||
          record.pickupPersonPhone
            .toLowerCase()
            .includes(query);

        if (!date) {
          return matchesSearch;
        }

        const recordDate =
          new Date(record.releasedAt)
            .toISOString()
            .slice(0, 10);

        return (
          matchesSearch &&
          recordDate === date
        );
      });
    }, [records, search, date]);

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Clock
            size={20}
            className="text-indigo-600"
          />

          <h1 className="text-xl font-semibold text-slate-900">
            Pickup History
          </h1>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          View and review student release records.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search student, ID, pickup person..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="relative">
            <CalendarDays
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {(search || date) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDate("");
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={15} />
              Clear
            </button>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* Results */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Release records
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredRecords.length}{" "}
              {filteredRecords.length === 1
                ? "record"
                : "records"}
            </p>
          </div>

          <ShieldCheck
            size={18}
            className="text-emerald-600"
          />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading pickup history...
          </div>
        ) : filteredRecords.length ===
          0 ? (
          <div className="p-12 text-center">
            <Clock
              size={24}
              className="mx-auto text-slate-300"
            />

            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              No pickup records found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or date
              filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map(
              (record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() =>
                    setSelectedRecord(
                      record,
                    )
                  }
                  className="flex w-full flex-col gap-4 px-5 py-4 text-left transition hover:bg-slate-50 md:flex-row md:items-center"
                >
                  {/* Student */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      name={record.studentName}
                    />

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {record.studentName}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {record.studentId}{" "}
                        •{" "}
                        {record.className}
                      </div>
                    </div>
                  </div>

                  {/* Pickup person */}
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <UserRound
                        size={14}
                        className="text-slate-400"
                      />

                      <span className="text-sm font-medium text-slate-800">
                        {
                          record.pickupPersonName
                        }
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {
                        record.pickupPersonRole
                      }{" "}
                      •{" "}
                      {
                        record.pickupPersonPhone
                      }
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 md:w-44 md:justify-end">
                    <Clock size={13} />

                    {formatDateTime(
                      record.releasedAt,
                    )}
                  </div>
                </button>
              ),
            )}
          </div>
        )}
      </Card>

      {/* Details modal */}
      {selectedRecord && (
        <PickupDetailsModal
          record={selectedRecord}
          onClose={() =>
            setSelectedRecord(null)
          }
        />
      )}
    </div>
  );
}

function PickupDetailsModal({
  record,
  onClose,
}: {
  record: PickupRecord;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pickup details
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Release record
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <Detail
            label="Student"
            value={record.studentName}
            secondary={`${record.studentId} • ${record.className}`}
          />

          <Detail
            label="Picked up by"
            value={
              record.pickupPersonName
            }
            secondary={`${record.pickupPersonRole} • ${record.pickupPersonPhone}`}
          />

          <Detail
            label="Released at"
            value={formatDateTime(
              record.releasedAt,
            )}
          />

          <Detail
            label="Released by"
            value={record.releasedBy}
          />

          {record.notes && (
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Notes
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {record.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-900">
        {value}
      </div>

      {secondary && (
        <div className="mt-1 text-xs text-slate-500">
          {secondary}
        </div>
      )}
    </div>
  );
}

function formatDateTime(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}