import { Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Public
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import SetupSchool from "./pages/SetupSchool";

// Overview
import Dashboard from "./pages/Dashboard";

// School
import Admissions from "./pages/Admissions";
import AdmissionDetails from "./pages/AdmissionDetails";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Parents from "./pages/Parents";
import Teachers from "./pages/Teachers";
import PickupDesk from "./pages/PickupDesk";
import PickupHistory from "./pages/PickupHistory";

// Academics
import AcademicYears from "./pages/AcademicYears";
import ClassesSubjects from "./pages/ClassesSubjects";
import Timetable from "./pages/Timetable";
import Attendance from "./pages/Attendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import AttendanceReports from "./pages/AttendanceReports";
import Assessments from "./pages/Assessments";
import AssessmentMarks from "./pages/AssessmentMarks";
import AssessmentResults from "./pages/AssessmentResults";
import StudentResults from "./pages/StudentResults";

// Finance
import FeeStructure from "./pages/FeeStructure";
import StudentBilling from "./pages/StudentBilling";
import Payments from "./pages/Payments";
import Receipts from "./pages/Receipts";
import FinanceReports from "./pages/FinanceReports";

// Communication
import Announcements from "./pages/Announcements";

// Settings
import SchoolProfile from "./pages/SchoolProfile";
import AcademicSettings from "./pages/AcademicSettings";
import UsersRoles from "./pages/UsersRoles";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/setup-school" element={<SetupSchool />} />

        <Route element={<AppLayout />}>
          {/* Overview */}
          <Route index element={<Dashboard />} />

          {/* School */}
          <Route path="admissions" element={<Admissions />} />
          <Route path="admissions/:id" element={<AdmissionDetails />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:id" element={<StudentProfile />} />
          <Route path="parents" element={<Parents />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="teachers/:id" element={<Teachers />} />
          <Route path="pickup-desk" element={<PickupDesk />} />
          <Route path="pickup-history" element={<PickupHistory />} />

          {/* Academics */}
          <Route path="academic-years" element={<AcademicYears />} />
          <Route path="academics" element={<ClassesSubjects />} />
          <Route path="timetable" element={<Timetable />} />

          {/* Attendance */}
          <Route path="attendance" element={<Attendance />} />
          <Route
            path="attendance/history"
            element={<AttendanceHistory />}
          />
          <Route
            path="attendance/reports"
            element={<AttendanceReports />}
          />

          {/* Assessments */}
          <Route path="assessments" element={<Assessments />} />
          <Route
            path="assessments/:id/marks"
            element={<AssessmentMarks />}
          />
          <Route
            path="assessments/:id/results"
            element={<AssessmentResults />}
          />

          {/* Student results */}
          <Route path="student-results" element={<StudentResults />} />

          {/* Finance */}
          <Route path="finance" element={<FeeStructure />} />
          <Route
            path="finance/billing"
            element={<StudentBilling />}
          />
          <Route
            path="finance/payments"
            element={<Payments />}
          />
          <Route
            path="finance/receipts"
            element={<Receipts />}
          />
          <Route
            path="finance/reports"
            element={<FinanceReports />}
          />

          {/* Communication */}
          <Route
            path="announcements"
            element={<Announcements />}
          />

          {/* Backward-compatible URL */}
          <Route
            path="communications"
            element={<Announcements />}
          />

          {/* Settings */}
          <Route
            path="settings/school-profile"
            element={<SchoolProfile />}
          />
          <Route
            path="settings/academic"
            element={<AcademicSettings />}
          />
          <Route
            path="settings/users"
            element={<UsersRoles />}
          />

          {/* Parent settings URL */}
          <Route
            path="settings"
            element={<AcademicSettings />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
