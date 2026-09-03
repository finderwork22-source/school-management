import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Edit3,
  ImagePlus,
  Mail,
  Phone,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface Teacher {
  id: string;
  teacher_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: "Active" | "Inactive";
  joined_date: string;

  // Teaching assignment counts
  class_count: number;
  subject_count: number;
}

interface TeacherForm {
  teacherId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  phone: string;
  email: string;
  photoUrl: string;
  joinedDate: string;
  status: "Active" | "Inactive";
}

function emptyForm(): TeacherForm {
  return {
    teacherId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    phone: "",
    email: "",
    photoUrl: "",
    joinedDate: new Date().toISOString().slice(0, 10),
    status: "Active",
  };
}

function getFullName(teacher: Teacher) {
  return [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ");
}

async function uploadTeacherPhoto(
  schoolId: string,
  file: File,
): Promise<{ url: string | null; error: Error | null }> {
  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const safeExtension =
    extension.replace(/[^a-z0-9]/g, "") || "jpg";

  const filePath =
    `${schoolId}/${crypto.randomUUID()}.${safeExtension}`;

  const { error } = await supabase.storage
    .from("teacher-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (error) {
    return {
      url: null,
      error,
    };
  }

  const { data } = supabase.storage
    .from("teacher-photos")
    .getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    error: null,
  };
}

export default function Teachers() {
  const navigate = useNavigate();

  const [schoolId, setSchoolId] =
    useState<string | null>(null);

  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editingTeacher, setEditingTeacher] =
    useState<Teacher | null>(null);

  const [form, setForm] =
    useState<TeacherForm>(emptyForm());

  const [photoFile, setPhotoFile] =
    useState<File | null>(null);

  const [photoPreviewUrl, setPhotoPreviewUrl] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  /*
   * Load the school associated with the
   * currently authenticated user.
   */
  useEffect(() => {
    async function loadSchool() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in to view teachers.",
        );

        setLoading(false);
        return;
      }

      const { data, error: schoolError } =
        await supabase
          .from("school_members")
          .select("school_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (schoolError) {
        setError(schoolError.message);
        setLoading(false);
        return;
      }

      if (!data?.school_id) {
        setError(
          "No school is associated with your account.",
        );

        setLoading(false);
        return;
      }

      setSchoolId(data.school_id);
    }

    void loadSchool();
  }, []);

  /*
   * Load teachers AND their teaching assignments.
   *
   * Classes and Subjects are calculated from
   * teacher_assignments.
   *
   * Example:
   *
   * Grade 1 A -> Mathematics
   * Grade 1 A -> English
   * Grade 2   -> Mathematics
   *
   * Result:
   * Classes  = 2
   * Subjects = 2
   *
   * We use Set so the same class or subject
   * is not counted multiple times.
   */
  async function loadTeachers(
    currentSchoolId = schoolId,
  ) {
    if (!currentSchoolId) return;

    setLoading(true);
    setError("");

    const [
      teachersResult,
      assignmentsResult,
    ] = await Promise.all([
      supabase
        .from("teachers")
        .select(`
          id,
          teacher_id,
          first_name,
          middle_name,
          last_name,
          date_of_birth,
          gender,
          nationality,
          phone,
          email,
          photo_url,
          status,
          joined_date
        `)
        .eq("school_id", currentSchoolId)
        .order("last_name", {
          ascending: true,
        })
        .order("first_name", {
          ascending: true,
        }),

      supabase
        .from("teacher_assignments")
        .select(`
          id,
          teacher_id,
          class_id,
          subject_id
        `)
        .eq("school_id", currentSchoolId),
    ]);

    if (teachersResult.error) {
      setError(
        teachersResult.error.message,
      );

      setTeachers([]);
      setLoading(false);
      return;
    }

    if (assignmentsResult.error) {
      setError(
        assignmentsResult.error.message,
      );

      setTeachers([]);
      setLoading(false);
      return;
    }

    const teachersData =
      teachersResult.data ?? [];

    const assignmentsData =
      assignmentsResult.data ?? [];

    /*
     * Store unique classes and subjects
     * for every teacher.
     */
    const assignmentCounts = new Map<
      string,
      {
        classes: Set<string>;
        subjects: Set<string>;
      }
    >();

    for (const assignment of assignmentsData) {
      if (
        !assignmentCounts.has(
          assignment.teacher_id,
        )
      ) {
        assignmentCounts.set(
          assignment.teacher_id,
          {
            classes: new Set<string>(),
            subjects: new Set<string>(),
          },
        );
      }

      const counts =
        assignmentCounts.get(
          assignment.teacher_id,
        )!;

      if (assignment.class_id) {
        counts.classes.add(
          assignment.class_id,
        );
      }

      if (assignment.subject_id) {
        counts.subjects.add(
          assignment.subject_id,
        );
      }
    }

    /*
     * Add the calculated counts to each teacher.
     */
    const mappedTeachers: Teacher[] =
      teachersData.map((teacher) => {
        const counts =
          assignmentCounts.get(
            teacher.id,
          );

        return {
          ...(teacher as Omit<
            Teacher,
            "class_count" | "subject_count"
          >),

          class_count:
            counts?.classes.size ?? 0,

          subject_count:
            counts?.subjects.size ?? 0,
        };
      });

    setTeachers(mappedTeachers);

    setLoading(false);
  }

  /*
   * Reload teachers whenever the school
   * becomes available.
   */
  useEffect(() => {
    if (schoolId) {
      void loadTeachers(schoolId);
    }
  }, [schoolId]);

  /*
   * Search teachers.
   */
  const filteredTeachers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return teachers;
      }

      return teachers.filter(
        (teacher) =>
          [
            getFullName(teacher),
            teacher.teacher_id,
            teacher.phone ?? "",
            teacher.email ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
    }, [search, teachers]);

  /*
   * Open create teacher modal.
   */
  function openCreate() {
    setEditingTeacher(null);

    setForm(emptyForm());

    setPhotoFile(null);

    setPhotoPreviewUrl("");

    setError("");

    setShowModal(true);
  }

  /*
   * Open edit teacher modal.
   */
  function openEdit(
    teacher: Teacher,
  ) {
    setEditingTeacher(teacher);

    setForm({
      teacherId:
        teacher.teacher_id,

      firstName:
        teacher.first_name,

      middleName:
        teacher.middle_name ?? "",

      lastName:
        teacher.last_name,

      dateOfBirth:
        teacher.date_of_birth ?? "",

      gender:
        teacher.gender ?? "",

      nationality:
        teacher.nationality ?? "",

      phone:
        teacher.phone ?? "",

      email:
        teacher.email ?? "",

      photoUrl:
        teacher.photo_url ?? "",

      joinedDate:
        teacher.joined_date,

      status:
        teacher.status,
    });

    setPhotoFile(null);

    setPhotoPreviewUrl(
      teacher.photo_url ?? "",
    );

    setError("");

    setShowModal(true);
  }

  /*
   * Handle photo selection.
   */
  function handlePhotoChange(
    file: File | undefined,
  ) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select an image file.",
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Photo must be 5 MB or smaller.",
      );

      return;
    }

    setError("");

    setPhotoFile(file);

    setPhotoPreviewUrl(
      URL.createObjectURL(file),
    );
  }

  /*
   * Remove selected photo.
   */
  function removePhoto() {
    setPhotoFile(null);

    setPhotoPreviewUrl("");

    updateField(
      "photoUrl",
      "",
    );
  }

  /*
   * Update form field.
   */
  function updateField<
    K extends keyof TeacherForm
  >(
    field: K,
    value: TeacherForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /*
   * Create or update teacher.
   */
  async function saveTeacher(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!schoolId) {
      setError(
        "School information is not available.",
      );

      return;
    }

    if (!form.teacherId.trim()) {
      setError(
        "Teacher ID is required.",
      );

      return;
    }

    if (!form.firstName.trim()) {
      setError(
        "First name is required.",
      );

      return;
    }

    if (!form.lastName.trim()) {
      setError(
        "Last name is required.",
      );

      return;
    }

    setSaving(true);
    setError("");

    let photoUrl =
      form.photoUrl.trim() || null;

    /*
     * Upload a new photo if one was selected.
     */
    if (photoFile) {
      const uploadResult =
        await uploadTeacherPhoto(
          schoolId,
          photoFile,
        );

      if (
        uploadResult.error ||
        !uploadResult.url
      ) {
        setError(
          uploadResult.error?.message ??
            "Photo upload failed.",
        );

        setSaving(false);

        return;
      }

      photoUrl =
        uploadResult.url;
    }

    const payload = {
      school_id:
        schoolId,

      teacher_id:
        form.teacherId.trim(),

      first_name:
        form.firstName.trim(),

      middle_name:
        form.middleName.trim() ||
        null,

      last_name:
        form.lastName.trim(),

      date_of_birth:
        form.dateOfBirth ||
        null,

      gender:
        form.gender ||
        null,

      nationality:
        form.nationality.trim() ||
        null,

      phone:
        form.phone.trim() ||
        null,

      email:
        form.email.trim() ||
        null,

      photo_url:
        photoUrl,

      status:
        form.status,

      joined_date:
        form.joinedDate ||
        new Date()
          .toISOString()
          .slice(0, 10),
    };

    const result =
      editingTeacher
        ? await supabase
            .from("teachers")
            .update(payload)
            .eq(
              "id",
              editingTeacher.id,
            )
            .eq(
              "school_id",
              schoolId,
            )
        : await supabase
            .from("teachers")
            .insert(payload);

    if (result.error) {
      setError(
        result.error.message,
      );

      setSaving(false);

      return;
    }

    setSaving(false);

    setShowModal(false);

    setEditingTeacher(null);

    await loadTeachers(
      schoolId,
    );
  }

  /*
   * Toggle teacher status.
   */
  async function toggleStatus(
    teacher: Teacher,
  ) {
    if (!schoolId) return;

    const nextStatus =
      teacher.status === "Active"
        ? "Inactive"
        : "Active";

    const { error: updateError } =
      await supabase
        .from("teachers")
        .update({
          status: nextStatus,
        })
        .eq(
          "id",
          teacher.id,
        )
        .eq(
          "school_id",
          schoolId,
        );

    if (updateError) {
      setError(
        updateError.message,
      );

      return;
    }

    await loadTeachers(
      schoolId,
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="flex items-start justify-between gap-4">

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Teachers
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage teachers and their information.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Teacher
        </button>

      </div>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

        <Search
          size={18}
          className="text-slate-400"
        />

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search teachers..."
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && !showModal && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          TEACHERS TABLE
      ===================================================== */}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px]">

            <thead className="border-b border-slate-200 bg-slate-50">

              <tr>

                {[
                  "Teacher",
                  "Teacher ID",
                  "Contact",
                  "Classes",
                  "Subjects",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {heading}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {/* Loading */}
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Loading teachers...
                  </td>
                </tr>

              ) : filteredTeachers.length === 0 ? (

                /* Empty state */
                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >

                    <div className="mx-auto flex max-w-sm flex-col items-center">

                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <UserRound
                          size={22}
                          className="text-slate-400"
                        />
                      </div>

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        {search
                          ? "No teachers found"
                          : "No teachers yet"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {search
                          ? "Try a different search."
                          : "Add your first teacher to get started."}
                      </p>

                      {!search && (
                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          <Plus size={15} />
                          Add Teacher
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                /* Teacher rows */
                filteredTeachers.map(
                  (teacher) => (
                    <tr
                      key={teacher.id}
                      className="hover:bg-slate-50"
                    >

                      {/* Teacher */}
                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          {teacher.photo_url ? (
                            <img
                              src={
                                teacher.photo_url
                              }
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                              <UserRound
                                size={17}
                                className="text-slate-400"
                              />
                            </div>
                          )}

                          <div>

                            <p className="text-sm font-medium text-slate-800">
                              {getFullName(
                                teacher,
                              )}
                            </p>

                            <p className="text-xs text-slate-400">
                              {teacher.email ||
                                "No email"}
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* Teacher ID */}
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {teacher.teacher_id}
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">

                        <div className="space-y-1 text-xs text-slate-500">

                          {teacher.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={13} />
                              {teacher.phone}
                            </div>
                          )}

                          {teacher.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail size={13} />
                              {teacher.email}
                            </div>
                          )}

                          {!teacher.phone &&
                            !teacher.email &&
                            "—"}

                        </div>

                      </td>

                      {/* =================================================
                          CLASSES COUNT
                      ================================================= */}

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {teacher.class_count > 0
                          ? teacher.class_count
                          : "—"}
                      </td>

                      {/* =================================================
                          SUBJECTS COUNT
                      ================================================= */}

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {teacher.subject_count > 0
                          ? teacher.subject_count
                          : "—"}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">

                        <button
                          type="button"
                          onClick={() =>
                            void toggleStatus(
                              teacher,
                            )
                          }
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",

                            teacher.status ===
                            "Active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          {teacher.status}
                        </button>

                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/teachers/${teacher.id}`,
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                teacher,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <Edit3
                              size={14}
                            />
                            Edit
                          </button>

                        </div>

                      </td>

                    </tr>
                  ),
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================================
          ADD / EDIT TEACHER MODAL
      ===================================================== */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>

                <h2 className="text-lg font-semibold text-slate-900">
                  {editingTeacher
                    ? "Edit Teacher"
                    : "Add Teacher"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Enter the teacher's information below.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={saveTeacher}
              className="space-y-6 p-6"
            >

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* =====================================================
                  PERSONAL INFORMATION
              ===================================================== */}

              <section>

                <h3 className="text-sm font-semibold text-slate-800">
                  Personal Information
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <Field
                    label="First name"
                    value={
                      form.firstName
                    }
                    onChange={(value) =>
                      updateField(
                        "firstName",
                        value,
                      )
                    }
                    required
                  />

                  <Field
                    label="Middle name"
                    value={
                      form.middleName
                    }
                    onChange={(value) =>
                      updateField(
                        "middleName",
                        value,
                      )
                    }
                  />

                  <Field
                    label="Last name"
                    value={
                      form.lastName
                    }
                    onChange={(value) =>
                      updateField(
                        "lastName",
                        value,
                      )
                    }
                    required
                  />

                  <Field
                    label="Date of birth"
                    type="date"
                    value={
                      form.dateOfBirth
                    }
                    onChange={(value) =>
                      updateField(
                        "dateOfBirth",
                        value,
                      )
                    }
                  />

                  <SelectField
                    label="Gender"
                    value={
                      form.gender
                    }
                    onChange={(value) =>
                      updateField(
                        "gender",
                        value,
                      )
                    }
                    options={[
                      "Male",
                      "Female",
                    ]}
                  />

                  <Field
                    label="Nationality"
                    value={
                      form.nationality
                    }
                    onChange={(value) =>
                      updateField(
                        "nationality",
                        value,
                      )
                    }
                    placeholder="e.g. Rwandan"
                  />

                  {/* Photo */}
                  <div className="sm:col-span-2">

                    <span className="mb-1.5 block text-xs font-medium text-slate-600">
                      Profile photo
                    </span>

                    <div className="flex flex-wrap items-center gap-4">

                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100">

                        {photoPreviewUrl ? (
                          <img
                            src={
                              photoPreviewUrl
                            }
                            alt="Teacher preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound
                            size={28}
                            className="text-slate-400"
                          />
                        )}

                      </div>

                      <div className="flex items-center gap-2">

                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">

                          <ImagePlus
                            size={16}
                          />

                          {photoPreviewUrl
                            ? "Change photo"
                            : "Upload photo"}

                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(
                              event,
                            ) => {
                              handlePhotoChange(
                                event
                                  .target
                                  .files?.[0],
                              );

                              event.currentTarget.value =
                                "";
                            }}
                          />

                        </label>

                        {photoPreviewUrl && (
                          <button
                            type="button"
                            onClick={
                              removePhoto
                            }
                            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}

                      </div>

                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      JPG, PNG or other image format. Maximum 5 MB.
                    </p>

                  </div>

                </div>

              </section>

              {/* =====================================================
                  CONTACT INFORMATION
              ===================================================== */}

              <section>

                <h3 className="text-sm font-semibold text-slate-800">
                  Contact Information
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <Field
                    label="Phone"
                    value={
                      form.phone
                    }
                    onChange={(value) =>
                      updateField(
                        "phone",
                        value,
                      )
                    }
                    placeholder="+250..."
                  />

                  <Field
                    label="Email"
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(value) =>
                      updateField(
                        "email",
                        value,
                      )
                    }
                  />

                </div>

              </section>

              {/* =====================================================
                  EMPLOYMENT
              ===================================================== */}

              <section>

                <h3 className="text-sm font-semibold text-slate-800">
                  Employment
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <Field
                    label="Teacher ID"
                    value={
                      form.teacherId
                    }
                    onChange={(value) =>
                      updateField(
                        "teacherId",
                        value,
                      )
                    }
                    placeholder="e.g. T-001"
                    required
                  />

                  <Field
                    label="Joined date"
                    type="date"
                    value={
                      form.joinedDate
                    }
                    onChange={(value) =>
                      updateField(
                        "joinedDate",
                        value,
                      )
                    }
                    required
                  />

                  <SelectField
                    label="Status"
                    value={
                      form.status
                    }
                    onChange={(value) =>
                      updateField(
                        "status",
                        value as
                          | "Active"
                          | "Inactive",
                      )
                    }
                    options={[
                      "Active",
                      "Inactive",
                    ]}
                  />

                </div>

              </section>

              {/* =====================================================
                  ACTIONS
              ===================================================== */}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? photoFile
                      ? "Uploading..."
                      : "Saving..."
                    : editingTeacher
                      ? "Save changes"
                      : "Create Teacher"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

/* =============================================================
   INPUT FIELD
============================================================= */

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />

    </label>
  );
}

/* =============================================================
   SELECT FIELD
============================================================= */

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: string[];
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >

        <option value="">
          Select {label.toLowerCase()}
        </option>

        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ),
        )}

      </select>

    </label>
  );
}