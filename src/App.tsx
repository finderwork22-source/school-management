import { Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PlatformAdminRoute from "./components/auth/PlatformAdminRoute";
import SchoolRoleGuard from "./components/auth/SchoolRoleGuard";
import AdminLayout from "./components/admin/AdminLayout";

// Public
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AcceptInvitation from "./pages/AcceptInvitation";
import SetupSchool from "./pages/SetupSchool";

// Overview
import Dashboard from "./pages/Dashboard";

// School
import Admissions from "./pages/Admissions";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Parents from "./pages/Parents";
import Teachers from "./pages/Teachers";
import TeacherProfile from "./pages/TeacherProfile";
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
import MyProfile from "./pages/MyProfile";

// WISE Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSchools from "./pages/admin/AdminSchools";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminPlatformSettings from "./pages/admin/AdminPlatformSettings";
import AdminForgotPassword from "./pages/admin/AdminForgotPassword";
import AdminResetPassword from "./pages/admin/AdminResetPassword";

export default function App() {
  return (
    <Routes>
      {/* =====================================================
          PUBLIC ROUTES
      ===================================================== */}

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Invitation links must remain public so invited users
          can establish their password before signing in. */}
      <Route path="/accept-invitation" element={<AcceptInvitation />} />

      {/* WISE Admin password recovery */}
      <Route
        path="/admin/forgot-password"
        element={<AdminForgotPassword />}
      />

      <Route
        path="/admin/reset-password"
        element={<AdminResetPassword />}
      />

      {/* =====================================================
          WISE ADMIN — PLATFORM LEVEL

          Separate from school-level authorization.
      ===================================================== */}

      <Route
        path="/admin"
        element={
          <PlatformAdminRoute>
            <AdminLayout />
          </PlatformAdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />

        <Route path="schools" element={<AdminSchools />} />

        <Route path="applications" element={<AdminApplications />} />

        <Route path="billing" element={<AdminBilling />} />

        <Route path="analytics" element={<AdminAnalytics />} />

        <Route path="audit" element={<AdminAuditLogs />} />

        <Route path="settings" element={<AdminPlatformSettings />} />
      </Route>

      {/* =====================================================
          SCHOOL AUTHENTICATED ROUTES
      ===================================================== */}

      <Route element={<ProtectedRoute />}>
        <Route path="/setup-school" element={<SetupSchool />} />

        <Route element={<AppLayout />}>
          {/* =================================================
              OVERVIEW
          ================================================= */}

          <Route index element={<Dashboard />} />

          {/* =================================================
              PERSONAL PROFILE
          ================================================= */}

          <Route path="profile" element={<MyProfile />} />

          {/* =================================================
              SCHOOL
          ================================================= */}

          <Route path="admissions" element={<Admissions />} />

          <Route path="students" element={<Students />} />

          <Route
            path="students/:id"
            element={<StudentProfile />}
          />

          <Route path="parents" element={<Parents />} />

          <Route path="teachers" element={<Teachers />} />

          <Route
            path="teachers/:id"
            element={<TeacherProfile />}
          />

          <Route path="pickup-desk" element={<PickupDesk />} />

          <Route
            path="pickup-history"
            element={<PickupHistory />}
          />

          {/* =================================================
              ACADEMICS
              
              These remain available to the existing school
              roles according to the current RLS/permissions.
          ================================================= */}

          <Route
            path="academic-years"
            element={<AcademicYears />}
          />

          <Route
            path="academics"
            element={<ClassesSubjects />}
          />

          <Route
            path="timetable"
            element={<Timetable />}
          />

          {/* =================================================
              ATTENDANCE
          ================================================= */}

          <Route
            path="attendance"
            element={<Attendance />}
          />

          <Route
            path="attendance/history"
            element={<AttendanceHistory />}
          />

          <Route
            path="attendance/reports"
            element={<AttendanceReports />}
          />

          {/* =================================================
              ASSESSMENTS
          ================================================= */}

          <Route
            path="assessments"
            element={<Assessments />}
          />

          <Route
            path="assessments/:id/marks"
            element={<AssessmentMarks />}
          />

          <Route
            path="assessments/:id/results"
            element={<AssessmentResults />}
          />

          {/* =================================================
              STUDENT RESULTS
          ================================================= */}

          <Route
            path="student-results"
            element={<StudentResults />}
          />

          {/* =================================================
              FINANCE
              
              IMPORTANT:
              Only Owner and Principal may access school
              financial pages.

              Head of Academics is deliberately excluded.
              
              This protects direct URL navigation as well as
              normal sidebar navigation.
          ================================================= */}

          <Route
            element={
              <SchoolRoleGuard
                allowedRoles={["Owner", "Principal"]}
              />
            }
          >
            <Route
              path="finance"
              element={<FeeStructure />}
            />

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
          </Route>

          {/* =================================================
              COMMUNICATION
          ================================================= */}

          <Route
            path="announcements"
            element={<Announcements />}
          />

          <Route
            path="communications"
            element={<Announcements />}
          />

          {/* =================================================
              SETTINGS
          ================================================= */}

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

          <Route
            path="settings"
            element={<AcademicSettings />}
          />
        </Route>
      </Route>
    </Routes>
  );
}