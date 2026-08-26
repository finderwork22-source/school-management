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
import PickupDesk from "./pages/PickupDesk";
import PickupHistory from "./pages/PickupHistory";

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
        {/* School setup */}
        <Route path="/setup-school" element={<SetupSchool />} />

        {/* ===================================================
            APPLICATION
        =================================================== */}

        <Route element={<AppLayout />}>
          {/* Dashboard */}
          <Route index element={<Dashboard />} />

          {/* School */}
          <Route
            path="admissions"
            element={<Placeholder title="Admissions" />}
          />

          <Route path="students" element={<Students />} />

          <Route path="pickup-history" element={<PickupHistory />} />

          <Route path="pickup-desk" element={<PickupDesk />} />

          <Route path="students/:id" element={<StudentProfile />} />

          <Route path="parents" element={<Parents />} />

          <Route path="teachers" element={<Placeholder title="Teachers" />} />

          {/* Academics */}
          <Route
            path="academics"
            element={<Placeholder title="Classes & Subjects" />}
          />

          <Route path="timetable" element={<Placeholder title="Timetable" />} />

          <Route
            path="attendance"
            element={<Placeholder title="Attendance" />}
          />

          <Route
            path="assessments"
            element={<Placeholder title="Assessments" />}
          />

          {/* Finance */}
          <Route
            path="finance"
            element={<Placeholder title="Fees & Payments" />}
          />

          {/* Communication */}
          <Route
            path="communications"
            element={<Placeholder title="Announcements" />}
          />

          {/* Settings */}
          <Route path="settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Route>
    </Routes>
  );
}
