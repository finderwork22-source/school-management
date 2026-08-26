export type StudentStatus = "Active" | "Inactive";

export interface Student {
  id: string;
  student_id: string;

  first_name: string;
  middle_name: string | null;
  last_name: string;

  date_of_birth: string | null;
  gender: "Male" | "Female" | null;
  nationality: string | null;

  photo_url: string | null;

  status: StudentStatus;
  enrolled_date: string;

  class_id: string | null;
  class_name: string | null;

  parent_name: string | null;
  parent_phone: string | null;
}