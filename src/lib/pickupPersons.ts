import { supabase } from "./supabase";

export interface PickupPerson {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  relationship: string;
  identificationNumber: string | null;
  notes: string | null;
  isActive: boolean;
}

export async function getStudentPickupPersons(
  schoolId: string,
  studentId: string,
): Promise<{
  data: PickupPerson[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("student_pickup_persons")
    .select(`
      pickup_person_id,
      is_active,

      authorized_pickup_persons (
        id,
        first_name,
        last_name,
        phone,
        relationship,
        identification_number,
        notes,
        is_active
      )
    `)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("is_active", true);

  if (error) {
    return {
      data: [],
      error,
    };
  }

  const pickupPersons: PickupPerson[] =
    (data ?? [])
      .map((item) => {
        const person = Array.isArray(
          item.authorized_pickup_persons,
        )
          ? item.authorized_pickup_persons[0]
          : item.authorized_pickup_persons;

        if (!person) {
          return null;
        }

        return {
          id: person.id,
          firstName: person.first_name,
          lastName: person.last_name,
          phone: person.phone,
          relationship: person.relationship,
          identificationNumber:
            person.identification_number,
          notes: person.notes,
          isActive:
            person.is_active && item.is_active,
        };
      })
      .filter(
        (
          person,
        ): person is PickupPerson =>
          person !== null,
      );

  return {
    data: pickupPersons,
    error: null,
  };
}