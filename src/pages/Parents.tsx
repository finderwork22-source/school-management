import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Search,
  Users,
  Phone,
  Mail,
  ChevronRight,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import {
  getParents,
  type Parent,
} from "../lib/parents";

import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import PageHeader from "../components/ui/PageHeader";

export default function Parents() {
  const { school } = useSchool();

  const [parents, setParents] =
    useState<Parent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedParent, setSelectedParent] =
    useState<Parent | null>(null);

  useEffect(() => {
    async function loadParents() {
      if (!school) {
        setParents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const {
        data,
        error: parentsError,
      } = await getParents(school.id);

      if (parentsError) {
        console.error(
          "Failed to load parents:",
          parentsError,
        );

        setError(parentsError.message);
        setParents([]);
      } else {
        setParents(data);
      }

      setLoading(false);
    }

    loadParents();
  }, [school]);

  const filteredParents = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) {
      return parents;
    }

    return parents.filter((parent) => {
      return (
        parent.name
          .toLowerCase()
          .includes(query) ||
        parent.phone
          ?.toLowerCase()
          .includes(query) ||
        parent.email
          ?.toLowerCase()
          .includes(query) ||
        parent.children.some(
          (child) =>
            child.name
              .toLowerCase()
              .includes(query) ||
            child.studentId
              .toLowerCase()
              .includes(query),
        )
      );
    });
  }, [parents, search]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="School"
        title="Parents"
        description="Manage parents and guardians linked to your students."
      />

      <Card className="overflow-hidden">
        {/* Search */}
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-xl">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search parents or students..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900">
              {filteredParents.length}
            </span>{" "}
            parents
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-600">
              {error}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-slate-500">
              Loading parents...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredParents.map(
              (parent) => (
                <button
                  key={parent.id}
                  onClick={() =>
                    setSelectedParent(
                      parent,
                    )
                  }
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <Avatar
                    name={parent.name}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 group-hover:text-indigo-700">
                      {parent.name}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {parent.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone
                            size={12}
                          />
                          {parent.phone}
                        </span>
                      )}

                      {parent.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail
                            size={12}
                          />
                          {parent.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <Users
                      size={15}
                      className="text-slate-400"
                    />

                    <span className="text-sm text-slate-600">
                      {parent.childrenCount}{" "}
                      {parent.childrenCount ===
                      1
                        ? "child"
                        : "children"}
                    </span>
                  </div>

                  <ChevronRight
                    size={17}
                    className="text-slate-300 transition group-hover:text-indigo-500"
                  />
                </button>
              ),
            )}

            {filteredParents.length ===
              0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Users size={18} />
                </div>

                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  No parents found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {selectedParent && (
        <ParentDetails
          parent={selectedParent}
          onClose={() =>
            setSelectedParent(null)
          }
        />
      )}
    </div>
  );
}

function ParentDetails({
  parent,
  onClose,
}: {
  parent: Parent;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar
              name={parent.name}
              size="lg"
            />

            <div>
              <h2 className="font-semibold text-slate-900">
                {parent.name}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {parent.childrenCount}{" "}
                {parent.childrenCount ===
                1
                  ? "child"
                  : "children"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {parent.phone && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Phone
                </div>

                <div className="mt-1 text-sm font-medium text-slate-900">
                  {parent.phone}
                </div>
              </div>
            )}

            {parent.email && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Email
                </div>

                <div className="mt-1 text-sm font-medium text-slate-900">
                  {parent.email}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Children
            </h3>

            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {parent.children.map(
                (child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {child.name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {child.studentId}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                      {child.className}
                    </div>
                  </div>
                ),
              )}

              {parent.children.length ===
                0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No children linked to this
                  parent.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}