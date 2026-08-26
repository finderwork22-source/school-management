import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Search,
  ShieldCheck,
  Phone,
  UserRound,
  Clock,
  CheckCircle2,
  X,
  Users,
  UserCheck,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";

import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";

interface Student {
  id: string;
  studentId: string;
  name: string;
  className: string;
  status: string;
}

interface PickupPerson {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface PickupRecord {
  id: string;
  studentName: string;
  pickupPersonName: string;
  pickupPersonRole: string;
  releasedAt: string;
}

export default function PickupDesk() {
  const { school } = useSchool();

  const [students, setStudents] =
    useState<Student[]>([]);

  const [pickupPersons, setPickupPersons] =
    useState<PickupPerson[]>([]);

  const [pickupHistory, setPickupHistory] =
    useState<PickupRecord[]>([]);

  const [todayPickupIds, setTodayPickupIds] =
    useState<string[]>([]);

  const [search, setSearch] =
    useState("");

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [selectedPerson, setSelectedPerson] =
    useState<PickupPerson | null>(null);

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [personsLoading, setPersonsLoading] =
    useState(false);

  const [releasing, setReleasing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showConfirm, setShowConfirm] =
    useState(false);

  async function loadStudents() {
    if (!school) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: studentsError } =
      await supabase
        .from("students")
        .select(`
          id,
          student_id,
          first_name,
          last_name,
          status,

          enrollments (
            classes (
              name
            )
          )
        `)
        .eq("school_id", school.id)
        .eq("status", "Active")
        .order("last_name", {
          ascending: true,
        });

    if (studentsError) {
      console.error(
        "Failed to load students:",
        studentsError,
      );

      setError(studentsError.message);
      setStudents([]);
      setLoading(false);
      return;
    }

    const mappedStudents: Student[] =
      (data ?? []).map((student) => {
        const enrollment =
          Array.isArray(
            student.enrollments,
          )
            ? student.enrollments[0]
            : student.enrollments;

        const classData =
          Array.isArray(
            enrollment?.classes,
          )
            ? enrollment.classes[0]
            : enrollment?.classes;

        return {
          id: student.id,
          studentId: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          className:
            classData?.name ??
            "Unassigned",
          status: student.status,
        };
      });

    setStudents(mappedStudents);
    setLoading(false);
  }

  async function loadPickupPersons(
    studentId: string,
  ) {
    if (!school) return;

    setPersonsLoading(true);
    setError("");
    setSelectedPerson(null);

    const { data, error: personsError } =
      await supabase
        .from("student_pickup_persons")
        .select(`
          pickup_person_id,

          authorized_pickup_persons (
            id,
            first_name,
            last_name,
            phone,
            relationship,
            is_active
          )
        `)
        .eq("school_id", school.id)
        .eq("student_id", studentId)
        .eq("is_active", true);

    if (personsError) {
      console.error(
        "Failed to load pickup persons:",
        personsError,
      );

      setError(personsError.message);
      setPickupPersons([]);
      setPersonsLoading(false);
      return;
    }

    const mappedPersons: PickupPerson[] =
      (data ?? [])
        .map((item) => {
          const person = Array.isArray(
            item.authorized_pickup_persons,
          )
            ? item.authorized_pickup_persons[0]
            : item.authorized_pickup_persons;

          if (
            !person ||
            !person.is_active
          ) {
            return null;
          }

          return {
            id: person.id,
            name: `${person.first_name} ${person.last_name}`,
            phone: person.phone,
            relationship:
              person.relationship,
          };
        })
        .filter(
          (
            person,
          ): person is PickupPerson =>
            person !== null,
        );

    setPickupPersons(mappedPersons);
    setPersonsLoading(false);
  }

  async function loadPickupHistory() {
    if (!school) {
      setPickupHistory([]);
      return;
    }

    const { data, error: historyError } =
      await supabase
        .from("student_pickups")
        .select(`
          id,
          released_at,

          students (
            first_name,
            last_name
          ),

          authorized_pickup_persons (
            first_name,
            last_name,
            relationship
          )
        `)
        .eq("school_id", school.id)
        .order("released_at", {
          ascending: false,
        })
        .limit(10);

    if (historyError) {
      console.error(
        "Failed to load pickup history:",
        historyError,
      );

      return;
    }

    const history: PickupRecord[] =
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

        return {
          id: record.id,

          studentName: student
            ? `${student.first_name} ${student.last_name}`
            : "Unknown student",

          pickupPersonName: person
            ? `${person.first_name} ${person.last_name}`
            : "Unknown person",

          pickupPersonRole:
            person?.relationship ??
            "Unknown",

          releasedAt:
            record.released_at,
        };
      });

    setPickupHistory(history);
  }

  async function loadTodayPickups() {
    if (!school) {
      setTodayPickupIds([]);
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(
      23,
      59,
      59,
      999,
    );

    const { data, error: todayError } =
      await supabase
        .from("student_pickups")
        .select("student_id")
        .eq("school_id", school.id)
        .gte(
          "released_at",
          startOfDay.toISOString(),
        )
        .lte(
          "released_at",
          endOfDay.toISOString(),
        );

    if (todayError) {
      console.error(
        "Failed to load today's pickups:",
        todayError,
      );

      return;
    }

    setTodayPickupIds(
      (data ?? []).map(
        (item) => item.student_id,
      ),
    );
  }

  useEffect(() => {
    loadStudents();
    loadPickupHistory();
    loadTodayPickups();
  }, [school]);

  const filteredStudents =
    useMemo(() => {
      const query = search
        .toLowerCase()
        .trim();

      if (!query) {
        return students;
      }

      return students.filter(
        (student) =>
          student.name
            .toLowerCase()
            .includes(query) ||
          student.studentId
            .toLowerCase()
            .includes(query) ||
          student.className
            .toLowerCase()
            .includes(query),
      );
    }, [students, search]);

  const remainingCount = Math.max(
    students.length -
      new Set(todayPickupIds).size,
    0,
  );

  function handleStudentSelect(
    student: Student,
  ) {
    setSelectedStudent(student);
    setSuccess("");
    setError("");
    setNotes("");

    if (
      todayPickupIds.includes(
        student.id,
      )
    ) {
      setSelectedPerson(null);
      setPickupPersons([]);

      setSuccess(
        `${student.name} has already been released today.`,
      );

      return;
    }

    loadPickupPersons(student.id);
  }

  function clearSelectedStudent() {
    setSelectedStudent(null);
    setSelectedPerson(null);
    setPickupPersons([]);
    setNotes("");
    setSuccess("");
    setError("");
  }

  function openConfirmation() {
    if (
      !selectedStudent ||
      !selectedPerson
    ) {
      setError(
        "Please select a student and an authorized pickup person.",
      );

      return;
    }

    setError("");
    setShowConfirm(true);
  }

  async function confirmRelease() {
    if (
      !selectedStudent ||
      !selectedPerson
    ) {
      return;
    }

    setReleasing(true);
    setError("");
    setSuccess("");

    const { error: releaseError } =
      await supabase.rpc(
        "release_student",
        {
          p_student_id:
            selectedStudent.id,

          p_pickup_person_id:
            selectedPerson.id,

          p_notes:
            notes.trim() || null,
        },
      );

    if (releaseError) {
      console.error(
        "Failed to release student:",
        releaseError,
      );

      setError(releaseError.message);
      setReleasing(false);
      setShowConfirm(false);
      return;
    }

    setReleasing(false);
    setShowConfirm(false);

    setTodayPickupIds(
      (current) => [
        ...current,
        selectedStudent.id,
      ],
    );

    setSuccess(
      `${selectedStudent.name} has been released to ${selectedPerson.name}.`,
    );

    setSelectedStudent(null);
    setSelectedPerson(null);
    setPickupPersons([]);
    setNotes("");

    await loadPickupHistory();
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck
            size={20}
            className="text-indigo-600"
          />

          <h1 className="text-xl font-semibold text-slate-900">
            Pickup Desk
          </h1>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Verify authorized persons before releasing
          students.
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2
            size={18}
            className="shrink-0 text-emerald-600"
          />

          <p className="text-sm font-medium text-emerald-700">
            {success}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Students"
          value={students.length}
          icon={Users}
        />

        <StatCard
          label="Picked up today"
          value={
            new Set(todayPickupIds).size
          }
          icon={UserCheck}
        />

        <StatCard
          label="Remaining"
          value={remainingCount}
          icon={Clock}
        />
      </div>

      {/* Main area */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        {/* Student selection */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Select student
            </h2>

            <div className="relative mt-4">
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
                placeholder="Search student or ID..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading students...
              </div>
            ) : filteredStudents.length ===
              0 ? (
              <div className="p-8 text-center">
                <UserRound
                  size={22}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-2 text-sm font-medium text-slate-700">
                  No students found
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStudents.map(
                  (student) => {
                    const selected =
                      selectedStudent?.id ===
                      student.id;

                    const alreadyReleased =
                      todayPickupIds.includes(
                        student.id,
                      );

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() =>
                          handleStudentSelect(
                            student,
                          )
                        }
                        className={[
                          "flex w-full items-center gap-3 px-5 py-4 text-left transition",
                          alreadyReleased
                            ? "bg-emerald-50/50"
                            : selected
                              ? "bg-indigo-50"
                              : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <Avatar
                          name={student.name}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900">
                            {student.name}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {student.studentId}{" "}
                            •{" "}
                            {student.className}
                          </div>
                        </div>

                        {alreadyReleased && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            Released
                          </span>
                        )}

                        {selected &&
                          !alreadyReleased && (
                            <CheckCircle2
                              size={18}
                              className="text-indigo-600"
                            />
                          )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Release panel */}
        <Card className="p-6">
          {!selectedStudent ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <ShieldCheck size={22} />
              </div>

              <h2 className="mt-4 text-sm font-semibold text-slate-900">
                Select a student
              </h2>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Select a student from the list to see
                their authorized pickup persons.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {selectedStudent.name}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedStudent.studentId}{" "}
                    •{" "}
                    {selectedStudent.className}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    clearSelectedStudent
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              </div>

              {todayPickupIds.includes(
                selectedStudent.id,
              ) ? (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      size={22}
                      className="text-emerald-600"
                    />

                    <div>
                      <h3 className="text-sm font-semibold text-emerald-800">
                        Student already released
                      </h3>

                      <p className="mt-1 text-xs text-emerald-700">
                        This student has already been
                        recorded as picked up today.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Authorized pickup persons
                      </h3>

                      <ShieldCheck
                        size={16}
                        className="text-emerald-600"
                      />
                    </div>

                    {personsLoading ? (
                      <div className="py-10 text-center text-sm text-slate-500">
                        Loading authorized persons...
                      </div>
                    ) : pickupPersons.length ===
                      0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                        <ShieldCheck
                          size={22}
                          className="mx-auto text-slate-300"
                        />

                        <p className="mt-2 text-sm font-medium text-slate-700">
                          No authorized pickup persons
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          This student cannot be released
                          until an authorized person is
                          registered.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {pickupPersons.map(
                          (person) => {
                            const selected =
                              selectedPerson?.id ===
                              person.id;

                            return (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() =>
                                  setSelectedPerson(
                                    person,
                                  )
                                }
                                className={[
                                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition",
                                  selected
                                    ? "border-indigo-300 bg-indigo-50"
                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                                ].join(" ")}
                              >
                                <Avatar
                                  name={
                                    person.name
                                  }
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {person.name}
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    {
                                      person.relationship
                                    }
                                  </div>

                                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                    <Phone
                                      size={11}
                                    />

                                    {
                                      person.phone
                                    }
                                  </div>
                                </div>

                                {selected && (
                                  <CheckCircle2
                                    size={19}
                                    className="text-indigo-600"
                                  />
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPerson && (
                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <div className="rounded-xl bg-indigo-50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                          Selected pickup person
                        </div>

                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {
                            selectedPerson.name
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {
                            selectedPerson.relationship
                          }{" "}
                          •{" "}
                          {
                            selectedPerson.phone
                          }
                        </div>
                      </div>

                      <label className="mb-1.5 mt-5 block text-xs font-medium text-slate-700">
                        Notes
                      </label>

                      <textarea
                        value={notes}
                        onChange={(event) =>
                          setNotes(
                            event.target.value,
                          )
                        }
                        rows={3}
                        placeholder="Optional pickup notes..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />

                      <Button
                        className="mt-4 w-full"
                        onClick={
                          openConfirmation
                        }
                      >
                        <CheckCircle2 size={16} />
                        Confirm child release
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Recent history */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock
              size={17}
              className="text-indigo-600"
            />

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent pickups
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Latest student release records
              </p>
            </div>
          </div>
        </div>

        {pickupHistory.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              No pickup records yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pickupHistory.map(
              (record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {record.studentName}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Released to{" "}
                      <span className="font-medium text-slate-700">
                        {
                          record.pickupPersonName
                        }
                      </span>{" "}
                      ·{" "}
                      {
                        record.pickupPersonRole
                      }
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={13} />

                    {formatDateTime(
                      record.releasedAt,
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Card>

      {/* Confirmation modal */}
      {showConfirm &&
        selectedStudent &&
        selectedPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Confirm child release
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Please verify the pickup person's
                  identity before releasing the child.
                </p>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Student
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedStudent.name
                    }
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {
                      selectedStudent.studentId
                    }{" "}
                    •{" "}
                    {
                      selectedStudent.className
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">
                    Authorized person
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedPerson.name
                    }
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {
                      selectedPerson.relationship
                    }
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {
                      selectedPerson.phone
                    }
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs leading-5 text-amber-800">
                    Make sure the person presenting
                    themselves matches the authorized
                    person's information before
                    confirming release.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setShowConfirm(false)
                  }
                  disabled={releasing}
                >
                  Cancel
                </Button>

                <Button
                  onClick={confirmRelease}
                  disabled={releasing}
                >
                  {releasing
                    ? "Releasing..."
                    : "Confirm Release"}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={19} />
        </div>
      </div>
    </Card>
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