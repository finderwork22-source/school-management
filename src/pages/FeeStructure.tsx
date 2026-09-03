import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Plus,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
}

interface SchoolClass {
  id: string;
  name: string;
  grade: string | null;
  academic_year_id: string | null;
  academic_section_id: string | null;
  is_active: boolean;
}

interface FeeStructure {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  term: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FeeItem {
  id: string;
  fee_structure_id: string;
  name: string;
  description: string | null;
  amount: number;
  is_mandatory: boolean;
  created_at: string;
}

interface FeeItemForm {
  name: string;
  description: string;
  amount: string;
  is_mandatory: boolean;
}

const TERMS = ["Term 1", "Term 2", "Term 3"];

const EMPTY_ITEM: FeeItemForm = {
  name: "",
  description: "",
  amount: "",
  is_mandatory: true,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateTotal(items: FeeItem[]) {
  return items.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );
}

export default function FeeStructure() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [structures, setStructures] = useState<
    FeeStructure[]
  >([]);

  const [items, setItems] = useState<FeeItem[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState("");

  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [editingStructure, setEditingStructure] =
    useState<FeeStructure | null>(null);

  const [expandedStructureId, setExpandedStructureId] =
    useState<string | null>(null);

  const [structureForm, setStructureForm] = useState({
    classId: "",
    term: "Term 1",
    name: "Standard Fee Structure",
  });

  const [itemForms, setItemForms] = useState<FeeItemForm[]>([
    { ...EMPTY_ITEM },
  ]);

  async function loadData() {
    if (!school) {
      setAcademicYears([]);
      setClasses([]);
      setStructures([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const schoolId = school.id;

    const [
      academicYearsResult,
      classesResult,
      structuresResult,
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id, name, is_active")
        .eq("school_id", schoolId)
        .order("name", {
          ascending: false,
        }),

      supabase
        .from("classes")
        .select(
          `
            id,
            name,
            grade,
            academic_year_id,
            academic_section_id,
            is_active
          `,
        )
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("fee_structures")
        .select(
          `
            id,
            school_id,
            academic_year_id,
            class_id,
            term,
            name,
            is_active,
            created_at,
            updated_at
          `,
        )
        .eq("school_id", schoolId)
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (academicYearsResult.error) {
      setError(academicYearsResult.error.message);
      setLoading(false);
      return;
    }

    if (classesResult.error) {
      setError(classesResult.error.message);
      setLoading(false);
      return;
    }

    if (structuresResult.error) {
      setError(structuresResult.error.message);
      setLoading(false);
      return;
    }

    const loadedYears = academicYearsResult.data ?? [];
    const loadedClasses = classesResult.data ?? [];
    const loadedStructures = structuresResult.data ?? [];

    setAcademicYears(loadedYears);
    setClasses(loadedClasses);
    setStructures(loadedStructures);

    setSelectedAcademicYearId((current) => {
      if (
        current &&
        loadedYears.some((year) => year.id === current)
      ) {
        return current;
      }

      const activeYear = loadedYears.find(
        (year) => year.is_active,
      );

      return (
        activeYear?.id ??
        loadedYears[0]?.id ??
        ""
      );
    });

    if (loadedStructures.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const structureIds = loadedStructures.map(
      (structure) => structure.id,
    );

    const { data: loadedItems, error: itemsError } =
      await supabase
        .from("fee_structure_items")
        .select(
          `
            id,
            fee_structure_id,
            name,
            description,
            amount,
            is_mandatory,
            created_at
          `,
        )
        .in("fee_structure_id", structureIds)
        .order("created_at");

    if (itemsError) {
      setError(itemsError.message);
      setLoading(false);
      return;
    }

    setItems(loadedItems ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [school]);

  /*
   * Classes belonging to the selected academic year.
   */
  const yearClasses = useMemo(() => {
    if (!selectedAcademicYearId) {
      return [];
    }

    return classes.filter(
      (classItem) =>
        classItem.academic_year_id ===
        selectedAcademicYearId,
    );
  }, [classes, selectedAcademicYearId]);

  /*
   * Structures visible in the current filters.
   */
  const filteredStructures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return structures.filter((structure) => {
      if (
        selectedAcademicYearId &&
        structure.academic_year_id !==
          selectedAcademicYearId
      ) {
        return false;
      }

      if (
        termFilter !== "All" &&
        structure.term !== termFilter
      ) {
        return false;
      }

      const classItem = classes.find(
        (item) => item.id === structure.class_id,
      );

      const className = classItem?.name ?? "";

      if (!query) {
        return true;
      }

      return (
        className.toLowerCase().includes(query) ||
        structure.term.toLowerCase().includes(query) ||
        structure.name.toLowerCase().includes(query)
      );
    });
  }, [
    structures,
    classes,
    selectedAcademicYearId,
    termFilter,
    search,
  ]);

  const selectedYear = academicYears.find(
    (year) => year.id === selectedAcademicYearId,
  );

  const filteredTotal = filteredStructures.reduce(
    (total, structure) => {
      const structureItems = items.filter(
        (item) =>
          item.fee_structure_id === structure.id,
      );

      return total + calculateTotal(structureItems);
    },
    0,
  );

  function getClassName(classId: string) {
    return (
      classes.find(
        (classItem) => classItem.id === classId,
      )?.name ?? "Unknown class"
    );
  }

  function getItemsForStructure(structureId: string) {
    return items.filter(
      (item) =>
        item.fee_structure_id === structureId,
    );
  }

  function openCreate() {
    setEditingStructure(null);

    setStructureForm({
      classId: yearClasses[0]?.id ?? "",
      term: "Term 1",
      name: "Standard Fee Structure",
    });

    setItemForms([
      {
        ...EMPTY_ITEM,
      },
    ]);

    setError("");
    setShowModal(true);
  }

  function openEdit(structure: FeeStructure) {
    const structureItems =
      getItemsForStructure(structure.id);

    setEditingStructure(structure);

    setStructureForm({
      classId: structure.class_id,
      term: structure.term,
      name: structure.name,
    });

    if (structureItems.length > 0) {
      setItemForms(
        structureItems.map((item) => ({
          name: item.name,
          description: item.description ?? "",
          amount: String(item.amount),
          is_mandatory: item.is_mandatory,
        })),
      );
    } else {
      setItemForms([
        {
          ...EMPTY_ITEM,
        },
      ]);
    }

    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingStructure(null);
  }

  function addItem() {
    setItemForms((current) => [
      ...current,
      {
        ...EMPTY_ITEM,
      },
    ]);
  }

  function removeItem(index: number) {
    setItemForms((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (_, itemIndex) => itemIndex !== index,
      );
    });
  }

  function updateItem(
    index: number,
    field: keyof FeeItemForm,
    value: string | boolean,
  ) {
    setItemForms((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  async function saveStructure(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!school) {
      setError("No school is associated with your account.");
      return;
    }

    setError("");

    if (!selectedAcademicYearId) {
      setError("Please select an academic year.");
      return;
    }

    if (!structureForm.classId) {
      setError("Please select a class.");
      return;
    }

    const validItems = itemForms.filter(
      (item) =>
        item.name.trim() &&
        item.amount !== "" &&
        Number(item.amount) >= 0,
    );

    if (validItems.length === 0) {
      setError("Please add at least one fee item.");
      return;
    }

    setSaving(true);

    try {
      let structureId = "";

      /*
       * EDIT EXISTING STRUCTURE
       */
      if (editingStructure) {
        structureId = editingStructure.id;

        const { error: updateError } =
          await supabase
            .from("fee_structures")
            .update({
              class_id: structureForm.classId,
              term: structureForm.term,
              name:
                structureForm.name.trim() ||
                "Standard Fee Structure",
            })
            .eq("id", editingStructure.id)
            .eq("school_id", school.id);

        if (updateError) {
          throw updateError;
        }

        /*
         * Replace the existing fee items.
         */
        const { error: deleteItemsError } =
          await supabase
            .from("fee_structure_items")
            .delete()
            .eq(
              "fee_structure_id",
              editingStructure.id,
            );

        if (deleteItemsError) {
          throw deleteItemsError;
        }
      } else {
        /*
         * CREATE NEW STRUCTURE
         */
        const { data, error: insertError } =
          await supabase
            .from("fee_structures")
            .insert({
              school_id: school.id,
              academic_year_id:
                selectedAcademicYearId,
              class_id: structureForm.classId,
              term: structureForm.term,
              name:
                structureForm.name.trim() ||
                "Standard Fee Structure",
              is_active: true,
            })
            .select(
              `
                id,
                school_id,
                academic_year_id,
                class_id,
                term,
                name,
                is_active,
                created_at,
                updated_at
              `,
            )
            .single();

        if (insertError) {
          throw insertError;
        }

        if (!data) {
          throw new Error(
            "The fee structure could not be created.",
          );
        }

        structureId = data.id;
      }

      /*
       * Insert fee items.
       */
      const itemsToInsert = validItems.map(
        (item) => ({
          fee_structure_id: structureId,
          name: item.name.trim(),
          description:
            item.description.trim() || null,
          amount: Number(item.amount),
          is_mandatory: item.is_mandatory,
        }),
      );

      const { error: itemsError } =
        await supabase
          .from("fee_structure_items")
          .insert(itemsToInsert);

      if (itemsError) {
        throw itemsError;
      }

      setShowModal(false);
      setEditingStructure(null);

      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the fee structure.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStructure(
    structure: FeeStructure,
  ) {
    if (!school) {
      return;
    }

    const className = getClassName(
      structure.class_id,
    );

    const confirmed = window.confirm(
      `Delete the ${structure.term} fee structure for ${className}?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    const { error: deleteError } =
      await supabase
        .from("fee_structures")
        .delete()
        .eq("id", structure.id)
        .eq("school_id", school.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (
      expandedStructureId === structure.id
    ) {
      setExpandedStructureId(null);
    }

    await loadData();
  }

  async function toggleActive(
    structure: FeeStructure,
  ) {
    if (!school) {
      return;
    }

    setError("");

    const { error: updateError } =
      await supabase
        .from("fee_structures")
        .update({
          is_active: !structure.is_active,
        })
        .eq("id", structure.id)
        .eq("school_id", school.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadData();
  }

  return (
    <div className="space-y-5">
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            Finance
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Fee Structure
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Define what students are expected to pay
            for each class and term.
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus size={16} />
          Add fee structure
        </Button>
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}
      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          FILTERS
      ====================================================== */}
      <Card>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Academic year
            </label>

            <select
              value={selectedAcademicYearId}
              onChange={(event) =>
                setSelectedAcademicYearId(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {academicYears.length === 0 ? (
                <option value="">
                  No academic years
                </option>
              ) : (
                academicYears.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.is_active
                      ? " · Active"
                      : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Term
            </label>

            <select
              value={termFilter}
              onChange={(event) =>
                setTermFilter(event.target.value)
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="All">
                All terms
              </option>

              {TERMS.map((term) => (
                <option
                  key={term}
                  value={term}
                >
                  {term}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Search
            </label>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search class..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </Card>

      {/* =====================================================
          SUMMARY
      ====================================================== */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <WalletCards size={18} />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Fee structures
              </p>

              <p className="mt-0.5 text-xl font-semibold text-slate-900">
                {filteredStructures.length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs text-slate-500">
              Classes with fees
            </p>

            <p className="mt-0.5 text-xl font-semibold text-slate-900">
              {
                new Set(
                  filteredStructures.map(
                    (structure) =>
                      structure.class_id,
                  ),
                ).size
              }
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs text-slate-500">
              Total configured
            </p>

            <p className="mt-0.5 text-xl font-semibold text-slate-900">
              {formatCurrency(filteredTotal)}
            </p>
          </div>
        </Card>
      </div>

      {/* =====================================================
          FEE STRUCTURES
      ====================================================== */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {selectedYear?.name ??
              "Academic year"}{" "}
            fee structures
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Fees are configured per class and term.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading fee structures...
          </div>
        ) : filteredStructures.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <WalletCards size={19} />
            </div>

            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No fee structures yet
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Create the fee structure for a
              class and term to begin configuring
              school fees.
            </p>

            <Button
              className="mt-5"
              onClick={openCreate}
            >
              <Plus size={15} />
              Add fee structure
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStructures.map(
              (structure) => {
                const structureItems =
                  getItemsForStructure(
                    structure.id,
                  );

                const total =
                  calculateTotal(
                    structureItems,
                  );

                const expanded =
                  expandedStructureId ===
                  structure.id;

                return (
                  <div
                    key={structure.id}
                  >
                    {/* =================================================
                        STRUCTURE ROW
                    ================================================== */}
                    <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStructureId(
                            expanded
                              ? null
                              : structure.id,
                          )
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          {expanded ? (
                            <ChevronDown
                              size={17}
                            />
                          ) : (
                            <ChevronRight
                              size={17}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {getClassName(
                                structure.class_id,
                              )}
                            </h3>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              {structure.term}
                            </span>

                            {structure.is_active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                <Check
                                  size={10}
                                />
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                Inactive
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {structure.name}{" "}
                            ·{" "}
                            {
                              structureItems.length
                            }{" "}
                            fee{" "}
                            {structureItems.length ===
                            1
                              ? "item"
                              : "items"}
                          </p>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="mr-2 text-right">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            Total
                          </p>

                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              total,
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleActive(
                              structure,
                            )
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          {structure.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              structure,
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          aria-label="Edit fee structure"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteStructure(
                              structure,
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete fee structure"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    </div>

                    {/* =================================================
                        FEE ITEMS
                    ================================================== */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5">
                        {structureItems.length ===
                        0 ? (
                          <p className="text-sm text-slate-500">
                            No fee items have been
                            added.
                          </p>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Fee
                                  </th>

                                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Description
                                  </th>

                                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Amount
                                  </th>

                                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Type
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-slate-100">
                                {structureItems.map(
                                  (item) => (
                                    <tr
                                      key={
                                        item.id
                                      }
                                    >
                                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                        {
                                          item.name
                                        }
                                      </td>

                                      <td className="px-4 py-3 text-sm text-slate-500">
                                        {item.description ||
                                          "—"}
                                      </td>

                                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                                        {formatCurrency(
                                          Number(
                                            item.amount,
                                          ),
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-right">
                                        {item.is_mandatory ? (
                                          <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                                            Mandatory
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                            Optional
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ),
                                )}

                                <tr className="bg-slate-50">
                                  <td
                                    colSpan={
                                      2
                                    }
                                    className="px-4 py-3 text-sm font-semibold text-slate-800"
                                  >
                                    Total
                                  </td>

                                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                                    {formatCurrency(
                                      total,
                                    )}
                                  </td>

                                  <td />
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </Card>

      {/* =====================================================
          CREATE / EDIT MODAL
      ====================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingStructure
                    ? "Edit fee structure"
                    : "Add fee structure"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Configure the fees students in
                  this class should pay.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={saveStructure}>
              <div className="max-h-[calc(92vh-145px)] overflow-y-auto px-5 py-5">
                {/* BASIC INFORMATION */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Academic year
                    </label>

                    <input
                      type="text"
                      value={
                        selectedYear?.name ?? ""
                      }
                      disabled
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Class
                    </label>

                    <select
                      value={
                        structureForm.classId
                      }
                      onChange={(event) =>
                        setStructureForm(
                          (current) => ({
                            ...current,
                            classId:
                              event.target.value,
                          }),
                        )
                      }
                      required
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">
                        Select class
                      </option>

                      {yearClasses.map(
                        (classItem) => (
                          <option
                            key={
                              classItem.id
                            }
                            value={
                              classItem.id
                            }
                          >
                            {
                              classItem.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Term
                    </label>

                    <select
                      value={
                        structureForm.term
                      }
                      onChange={(event) =>
                        setStructureForm(
                          (current) => ({
                            ...current,
                            term:
                              event.target.value,
                          }),
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {TERMS.map(
                        (term) => (
                          <option
                            key={term}
                            value={term}
                          >
                            {term}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                {/* NAME */}
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Fee structure name
                  </label>

                  <input
                    type="text"
                    value={
                      structureForm.name
                    }
                    onChange={(event) =>
                      setStructureForm(
                        (current) => ({
                          ...current,
                          name: event.target
                            .value,
                        }),
                      )
                    }
                    placeholder="Standard Fee Structure"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* FEE ITEMS */}
                <div className="mt-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Fee items
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Add each charge separately.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <Plus size={14} />
                      Add fee
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {itemForms.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                            {/* FEE NAME */}
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                Fee name
                              </label>

                              <input
                                type="text"
                                value={
                                  item.name
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateItem(
                                    index,
                                    "name",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Tuition"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>

                            {/* AMOUNT */}
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                Amount (RWF)
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  item.amount
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateItem(
                                    index,
                                    "amount",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="550000"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>

                            {/* REMOVE */}
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    index,
                                  )
                                }
                                disabled={
                                  itemForms.length ===
                                  1
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Remove fee"
                              >
                                <Trash2
                                  size={15}
                                />
                              </button>
                            </div>
                          </div>

                          {/* DESCRIPTION + MANDATORY */}
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                Description
                              </label>

                              <input
                                type="text"
                                value={
                                  item.description
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateItem(
                                    index,
                                    "description",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Optional description"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>

                            <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3">
                              <input
                                type="checkbox"
                                checked={
                                  item.is_mandatory
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateItem(
                                    index,
                                    "is_mandatory",
                                    event.target
                                      .checked,
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />

                              <span className="text-xs font-medium text-slate-600">
                                Mandatory
                              </span>
                            </label>
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* TOTAL */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <span className="text-sm font-medium text-indigo-800">
                      Total fee
                    </span>

                    <span className="text-base font-bold text-indigo-900">
                      {formatCurrency(
                        itemForms.reduce(
                          (
                            total,
                            item,
                          ) =>
                            total +
                            (Number(
                              item.amount,
                            ) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingStructure
                      ? "Save changes"
                      : "Create fee structure"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}