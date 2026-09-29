import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { supabase } from "../lib/supabase";

interface Child {
  id: string;
  studentId: string;
  name: string;
  className: string;
}

interface PickupAuthorisation {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  authorisedName: string;
  authorisedPhone: string;
  relationship: string;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

interface ParentChildRpcRow {
  student_id: string;
  student_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
}

interface ParentPickupRpcRow {
  id: string;
  student_id: string;
  student_name: string;
  student_code?: string | null;
  class_name?: string | null;
  authorised_name: string;
  authorised_phone: string;
  relationship: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "No end date";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ParentDashboard() {
  const navigate = useNavigate();

  const [children, setChildren] = useState<Child[]>([]);
  const [authorisations, setAuthorisations] = useState<PickupAuthorisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const [childrenResult, authorisationsResult] = await Promise.all([
      supabase.rpc("get_parent_children"),
      supabase.rpc("get_parent_pickup_authorisations"),
    ]);

    if (childrenResult.error) {
      console.error("Failed to load parent children:", childrenResult.error);
      setError(childrenResult.error.message);
    }

    if (authorisationsResult.error) {
      console.error(
        "Failed to load parent pickup authorisations:",
        authorisationsResult.error,
      );
      setError((current) => current || authorisationsResult.error.message);
    }

    setChildren(
      ((childrenResult.data ?? []) as ParentChildRpcRow[]).map((item) => ({
        id: item.student_id,
        studentId: item.student_code ?? "",
        name: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim(),
        className: item.class_name ?? "Unassigned",
      })),
    );

    setAuthorisations(
      ((authorisationsResult.data ?? []) as ParentPickupRpcRow[]).map((item) => ({
        id: item.id,
        studentId: item.student_id,
        studentName: item.student_name,
        studentCode: item.student_code ?? "",
        className: item.class_name ?? "Unassigned",
        authorisedName: item.authorised_name,
        authorisedPhone: item.authorised_phone,
        relationship: item.relationship,
        validFrom: item.valid_from,
        validUntil: item.valid_until,
        isActive: item.is_active,
      })),
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeAuthorisations = authorisations.filter((item) => item.isActive);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Parent Portal"
        title="Parent Dashboard"
        description="Stay connected with your children and manage their school pickup authorisations."
      />

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="h-32 animate-pulse bg-slate-100">
              <div aria-hidden="true" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wiser-50 text-wiser-700">
                  <Users size={20} />
                </div>
                <span className="text-xs font-medium text-slate-400">My family</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-900">
                {children.length}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {children.length === 1 ? "Child linked to your account" : "Children linked to your account"}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={20} />
                </div>
                <span className="text-xs font-medium text-slate-400">Pickup</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-900">
                {activeAuthorisations.length}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Active pickup authorisations
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Bell size={20} />
                </div>
                <span className="text-xs font-medium text-slate-400">Communication</span>
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                School announcements
              </p>
              <p className="mt-1 text-sm text-slate-500">
                View notices from the school.
              </p>
              <button
                type="button"
                onClick={() => navigate("/announcements")}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-wiser-700 hover:text-wiser-800"
              >
                View announcements
                <ArrowRight size={15} />
              </button>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">My Children</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Children currently linked to your parent account.
                  </p>
                </div>
                <UserRound size={18} className="text-slate-400" />
              </div>

              {children.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No children are currently linked to your account.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center gap-3 px-5 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wiser-50 text-sm font-semibold text-wiser-700">
                        {child.name
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{child.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {child.studentId} · {child.className}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Pickup</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    People currently authorised to collect your children.
                  </p>
                </div>
                <Clock3 size={18} className="text-slate-400" />
              </div>

              {activeAuthorisations.length === 0 ? (
                <div className="px-5 py-8">
                  <p className="text-sm text-slate-500">No active pickup authorisations.</p>
                  <button
                    type="button"
                    onClick={() => navigate("/pickup-authorisations")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-wiser-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-wiser-700"
                  >
                    <ShieldCheck size={16} />
                    Add pickup person
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeAuthorisations.slice(0, 4).map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{item.authorisedName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.relationship} · {item.studentName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.validFrom)} – {formatDate(item.validUntil)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeAuthorisations.length > 0 && (
                <div className="border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => navigate("/pickup-authorisations")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-wiser-700 hover:bg-wiser-50"
                  >
                    Manage pickup authorisations
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
