import { Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import SetupSchool from "./pages/SetupSchool";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Parents from "./pages/Parents";
import Teachers from "./pages/Teachers";
import PickupDesk from "./pages/PickupDesk";
import PickupHistory from "./pages/PickupHistory";
import ClassesSubjects from "./pages/ClassesSubjects";
import AcademicYears from "./pages/AcademicYears";
import TeacherProfile from "./pages/TeacherProfile";
import Timetable from "./pages/Timetable";
import Attendance from "./pages/Attendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import AttendanceReports from "./pages/AttendanceReports";
import Assessments from "./pages/Assessments";
import AssessmentMarks from "./pages/AssessmentMarks";
import AssessmentResults from "./pages/AssessmentResults";
import StudentResults from "./pages/StudentResults";
import FeeStructure from "./pages/FeeStructure";
import StudentBilling from "./pages/StudentBilling";
import Payments from "./pages/Payments";
import Receipts from "./pages/Receipts";
import FinanceReports from "./pages/FinanceReports";
import Announcements from "./pages/Announcements";
import SchoolProfile from "./pages/SchoolProfile";
import AcademicSettings from "./pages/AcademicSettings";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>

      <p className="mt-2 text-sm text-slate-500">
        This module will be built in the next development phase.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* =====================================================
          PUBLIC ROUTES
      ===================================================== */}

      <Route path="/login" element={<Login />} />

      <Route path="/signup" element={<SignUp />} />

      {/* =====================================================
          AUTHENTICATED ROUTES
      ===================================================== */}

      <Route element={<ProtectedRoute />}>
        <Route path="/setup-school" element={<SetupSchool />} />

        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />

          <Route
            path="admissions"
            element={<Placeholder title="Admissions" />}
          />

          <Route path="students" element={<Students />} />

          <Route path="pickup-history" element={<PickupHistory />} />

          <Route path="pickup-desk" element={<PickupDesk />} />

          <Route path="students/:id" element={<StudentProfile />} />

          <Route path="parents" element={<Parents />} />

          <Route path="teachers" element={<Teachers />} />

          <Route path="teachers/:id" element={<TeacherProfile />} />

          <Route path="academic-years" element={<AcademicYears />} />
          <Route path="settings/academic" element={<AcademicSettings />} />

          {/* Academics */}
          <Route path="academics" element={<ClassesSubjects />} />

          <Route path="timetable" element={<Timetable />} />

          <Route path="attendance" element={<Attendance />} />

          <Route path="attendance/history" element={<AttendanceHistory />} />

          <Route path="attendance/reports" element={<AttendanceReports />} />

          <Route path="assessments" element={<Assessments />} />

          <Route path="assessments/:id/marks" element={<AssessmentMarks />} />

          <Route path="student-results" element={<StudentResults />} />

          <Route
            path="assessments/:id/results"
            element={<AssessmentResults />}
          />

          {/* Finance */}
          <Route path="finance" element={<FeeStructure />} />
          <Route path="finance/billing" element={<StudentBilling />} />
          <Route path="finance/payments" element={<Payments />} />
          <Route path="finance/receipts" element={<Receipts />} />
          <Route path="finance/reports" element={<FinanceReports />} />

          {/* Communication */}
          <Route path="announcements" element={<Announcements />} />

          {/* Settings */}
          <Route path="settings" element={<Placeholder title="Settings" />} />
          <Route path="settings/school-profile" element={<SchoolProfile />} />
        </Route>
      </Route>
    </Routes>
  );
}
