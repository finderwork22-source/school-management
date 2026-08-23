import { useMemo, useState } from "react";
import {
    Search,
    Plus,
    SlidersHorizontal,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    UserRound,
    X,
} from "lucide-react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import PageHeader from "../components/ui/PageHeader";
import { useNavigate } from "react-router-dom";

type StudentStatus = "Active" | "Inactive";

interface Student {
    id: string;
    name: string;
    studentId: string;
    className: string;
    gender: "Male" | "Female";
    parent: string;
    parentPhone: string;
    status: StudentStatus;
    enrolledDate: string;
}

const initialStudents: Student[] = [
    {
        id: "1",
        name: "John Doe",
        studentId: "HGA-2026-001",
        className: "G5 Blue",
        gender: "Male",
        parent: "Jane Doe",
        parentPhone: "+250 788 123 456",
        status: "Active",
        enrolledDate: "2026-01-12",
    },
    {
        id: "2",
        name: "Sarah Uwase",
        studentId: "HGA-2026-002",
        className: "G5 Blue",
        gender: "Female",
        parent: "David Uwase",
        parentPhone: "+250 789 234 567",
        status: "Active",
        enrolledDate: "2026-01-14",
    },
    {
        id: "3",
        name: "David Mugisha",
        studentId: "HGA-2026-003",
        className: "G6 Blue",
        gender: "Male",
        parent: "Grace Mugisha",
        parentPhone: "+250 780 345 678",
        status: "Active",
        enrolledDate: "2026-01-15",
    },
    {
        id: "4",
        name: "Grace Mukamana",
        studentId: "HGA-2026-004",
        className: "G5 Red",
        gender: "Female",
        parent: "Patrick Mukamana",
        parentPhone: "+250 781 456 789",
        status: "Active",
        enrolledDate: "2026-01-17",
    },
    {
        id: "5",
        name: "Michael Ndayisenga",
        studentId: "HGA-2026-005",
        className: "G7 Blue",
        gender: "Male",
        parent: "Alice Ndayisenga",
        parentPhone: "+250 782 567 890",
        status: "Active",
        enrolledDate: "2026-01-18",
    },
    {
        id: "6",
        name: "Emma Ingabire",
        studentId: "HGA-2026-006",
        className: "G4 Green",
        gender: "Female",
        parent: "Eric Ingabire",
        parentPhone: "+250 783 678 901",
        status: "Inactive",
        enrolledDate: "2026-01-20",
    },
];

const classes = [
    "All classes",
    "G4 Green",
    "G5 Blue",
    "G5 Red",
    "G6 Blue",
    "G7 Blue",
];

const statuses = ["All statuses", "Active", "Inactive"];

export default function Students() {
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>(initialStudents);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All classes");
    const [statusFilter, setStatusFilter] = useState("All statuses");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(
        null,
    );

    const filteredStudents = useMemo(() => {
        const query = search.toLowerCase().trim();

        return students.filter((student) => {
            const matchesSearch =
                !query ||
                student.name.toLowerCase().includes(query) ||
                student.studentId.toLowerCase().includes(query) ||
                student.parent.toLowerCase().includes(query);

            const matchesClass =
                classFilter === "All classes" ||
                student.className === classFilter;

            const matchesStatus =
                statusFilter === "All statuses" ||
                student.status === statusFilter;

            return matchesSearch && matchesClass && matchesStatus;
        });
    }, [students, search, classFilter, statusFilter]);

    function handleAddStudent(student: Student) {
        setStudents((current) => [student, ...current]);
        setShowAddModal(false);
    }

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                eyebrow="School"
                title="Students"
                description="Manage student records, enrollment and parent information."
                actions={
                    <Button onClick={() => setShowAddModal(true)}>
                        <Plus size={16} />
                        Add student
                    </Button>
                }
            />

            <Card className="overflow-hidden">
                {/* Toolbar */}
                <div className="border-b border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                size={17}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by name, student ID or parent..."
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <select
                                value={classFilter}
                                onChange={(event) => setClassFilter(event.target.value)}
                                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            >
                                {classes.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            >
                                {statuses.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>

                            <Button variant="secondary" size="md">
                                <SlidersHorizontal size={16} />
                                Filters
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <p className="text-sm text-slate-500">
                        Showing{" "}
                        <span className="font-medium text-slate-900">
                            {filteredStudents.length}
                        </span>{" "}
                        students
                    </p>

                    <p className="hidden text-xs text-slate-400 sm:block">
                        {students.filter((student) => student.status === "Active").length}{" "}
                        active students
                    </p>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Student
                                </th>

                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Student ID
                                </th>

                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Class
                                </th>

                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Parent / Guardian
                                </th>

                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </th>

                                <th className="w-12 px-5 py-3" />
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredStudents.map((student) => (
                                <tr
                                    key={student.id}
                                    className="group transition hover:bg-slate-50"
                                >
                                    <td className="px-5 py-4">
                                        <button
                                            onClick={() => navigate(`/students/${student.id}`)}
                                            className="flex items-center gap-3 text-left"
                                        >
                                            <Avatar name={student.name} />

                                            <div>
                                                <div className="text-sm font-medium text-slate-900 group-hover:text-indigo-700">
                                                    {student.name}
                                                </div>

                                                <div className="mt-0.5 text-xs text-slate-400">
                                                    {student.gender}
                                                </div>
                                            </div>
                                        </button>
                                    </td>

                                    <td className="px-5 py-4 text-sm text-slate-600">
                                        {student.studentId}
                                    </td>

                                    <td className="px-5 py-4">
                                        <span className="text-sm font-medium text-slate-700">
                                            {student.className}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="text-sm text-slate-700">
                                            {student.parent}
                                        </div>

                                        <div className="mt-0.5 text-xs text-slate-400">
                                            {student.parentPhone}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <Badge
                                            variant={
                                                student.status === "Active"
                                                    ? "success"
                                                    : "default"
                                            }
                                        >
                                            {student.status}
                                        </Badge>
                                    </td>

                                    <td className="px-5 py-4">
                                        <button
                                            onClick={() => setSelectedStudent(student)}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                                        >
                                            <MoreHorizontal size={17} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center">
                                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                            <UserRound size={18} />
                                        </div>

                                        <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                            No students found
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Try changing your search or filters.
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
                    <p className="text-xs text-slate-500">
                        Page 1 of 1
                    </p>

                    <div className="flex gap-1">
                        <button
                            disabled
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300"
                        >
                            <ChevronLeft size={15} />
                        </button>

                        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-medium text-white">
                            1
                        </button>

                        <button
                            disabled
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </Card>

            {showAddModal && (
                <AddStudentModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddStudent}
                />
            )}

            {selectedStudent && (
                <StudentDetails
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
}

interface AddStudentModalProps {
    onClose: () => void;
    onAdd: (student: Student) => void;
}

function AddStudentModal({
    onClose,
    onAdd,
}: AddStudentModalProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [className, setClassName] = useState("G5 Blue");
    const [parent, setParent] = useState("");
    const [parentPhone, setParentPhone] = useState("");
    const [gender, setGender] = useState<Student["gender"]>("Male");

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!firstName.trim() || !lastName.trim() || !parent.trim()) {
            return;
        }

        const name = `${firstName.trim()} ${lastName.trim()}`;

        onAdd({
            id: crypto.randomUUID(),
            name,
            studentId: `HGA-2026-${String(Date.now()).slice(-4)}`,
            className,
            gender,
            parent: parent.trim(),
            parentPhone: parentPhone.trim(),
            status: "Active",
            enrolledDate: new Date().toISOString().split("T")[0],
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">
                            Add student
                        </h2>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Create a new student record.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X size={17} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 p-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                                Student information
                            </h3>

                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                <Field
                                    label="First name"
                                    value={firstName}
                                    onChange={setFirstName}
                                    required
                                />

                                <Field
                                    label="Last name"
                                    value={lastName}
                                    onChange={setLastName}
                                    required
                                />

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                                        Gender
                                    </label>

                                    <select
                                        value={gender}
                                        onChange={(event) =>
                                            setGender(
                                                event.target.value as Student["gender"],
                                            )
                                        }
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    >
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                                        Class
                                    </label>

                                    <select
                                        value={className}
                                        onChange={(event) =>
                                            setClassName(event.target.value)
                                        }
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    >
                                        {classes
                                            .filter((item) => item !== "All classes")
                                            .map((item) => (
                                                <option key={item}>{item}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-5">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Parent / guardian
                            </h3>

                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                <Field
                                    label="Parent / guardian name"
                                    value={parent}
                                    onChange={setParent}
                                    required
                                />

                                <Field
                                    label="Phone number"
                                    value={parentPhone}
                                    onChange={setParentPhone}
                                    placeholder="+250 7XX XXX XXX"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button type="submit">
                            Add student
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    required,
}: FieldProps) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
                {label}
            </label>

            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
        </div>
    );
}

interface StudentDetailsProps {
    student: Student;
    onClose: () => void;
}

function StudentDetails({
    student,
    onClose,
}: StudentDetailsProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <Avatar name={student.name} size="lg" />

                        <div>
                            <h2 className="font-semibold text-slate-900">
                                {student.name}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {student.studentId}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                    >
                        <X size={17} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <InfoItem label="Class" value={student.className} />
                    <InfoItem label="Gender" value={student.gender} />
                    <InfoItem label="Parent" value={student.parent} />
                    <InfoItem label="Phone" value={student.parentPhone} />
                    <InfoItem label="Status" value={student.status} />
                    <InfoItem
                        label="Enrolled"
                        value={student.enrolledDate}
                    />
                </div>

                <div className="flex justify-end border-t border-slate-200 p-4">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

function InfoItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="bg-white p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {label}
            </div>

            <div className="mt-1 text-sm font-medium text-slate-900">
                {value}
            </div>
        </div>
    );
}