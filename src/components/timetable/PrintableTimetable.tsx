import React from "react";
import { createPortal } from "react-dom";

export interface PrintableLesson {
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
}

interface PrintableTimetableProps {
  schoolName: string;
  academicYear: string;
  className: string;
  lessons?: PrintableLesson[];
  logoUrl?: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const BREAKS = [
  {
    start: "10:55",
    end: "11:30",
    label: "Morning Break",
  },
  {
    start: "12:55",
    end: "13:45",
    label: "Lunch Break",
  },
];

function normalizeTime(value?: string) {
  if (!value) return "";
  return value.slice(0, 5);
}

function timeToMinutes(value: string) {
  const normalized = normalizeTime(value);

  if (!normalized || !normalized.includes(":")) {
    return 0;
  }

  const [hours, minutes] = normalized
    .split(":")
    .map(Number);

  return (hours || 0) * 60 + (minutes || 0);
}

function getSubjectColor(subject: string) {
  const value = (subject || "").toLowerCase().trim();

  if (value.includes("math")) {
    return "#00a9e0";
  }

  if (
    value.includes("expression") ||
    value.includes("comprehension")
  ) {
    return "#e83e9f";
  }

  if (
    value.includes("lecture") ||
    value.includes("langue")
  ) {
    return "#9b8b82";
  }

  if (
    value.includes("english") ||
    value.includes("reading") ||
    value.includes("writing")
  ) {
    return "#233d8f";
  }

  if (value.includes("science")) {
    return "#e76f9f";
  }

  if (
    value.includes("phonics") ||
    value.includes("library") ||
    value.includes("kinyarwanda") ||
    value.includes("kinya")
  ) {
    return "#d46c92";
  }

  if (
    value.includes("music") ||
    value.includes("art")
  ) {
    return "#6c9b35";
  }

  if (
    value.includes("coding") ||
    value.includes("robo")
  ) {
    return "#b77777";
  }

  if (
    value === "gp" ||
    value.includes(" gp")
  ) {
    return "#769b35";
  }

  if (value.includes("life skills")) {
    return "#777777";
  }

  if (
    value === "pe" ||
    value.includes(" pe")
  ) {
    return "#555555";
  }

  return "#222222";
}

function buildRows(lessons: PrintableLesson[] = []) {
  const timeMap = new Map<
    string,
    {
      start: string;
      end: string;
    }
  >();

  lessons.forEach((lesson) => {
    if (!lesson) return;

    const start = normalizeTime(lesson.startTime);
    const end = normalizeTime(lesson.endTime);

    if (!start || !end) return;

    const isBreak = BREAKS.some(
      (breakItem) =>
        breakItem.start === start &&
        breakItem.end === end
    );

    if (isBreak) {
      return;
    }

    const key = `${start}-${end}`;

    if (!timeMap.has(key)) {
      timeMap.set(key, {
        start,
        end,
      });
    }
  });

  const lessonRows = Array.from(
    timeMap.values()
  ).map((time) => ({
    type: "lesson" as const,
    start: time.start,
    end: time.end,
  }));

  const breakRows = BREAKS.map(
    (breakItem) => ({
      type: "break" as const,
      start: breakItem.start,
      end: breakItem.end,
      label: breakItem.label,
    })
  );

  return [
    ...lessonRows,
    ...breakRows,
  ].sort(
    (a, b) =>
      timeToMinutes(a.start) -
      timeToMinutes(b.start)
  );
}

function findLesson(
  lessons: PrintableLesson[] = [],
  day: string,
  start: string,
  end: string
) {
  return lessons.find(
    (lesson) =>
      lesson &&
      lesson.day === day &&
      normalizeTime(lesson.startTime) === start &&
      normalizeTime(lesson.endTime) === end
  );
}

function getSubjectSummary(
  lessons: PrintableLesson[] = []
) {
  const counts = new Map<string, number>();

  lessons.forEach((lesson) => {
    if (!lesson?.subject) return;

    counts.set(
      lesson.subject,
      (counts.get(lesson.subject) ?? 0) + 1
    );
  });

  return Array.from(
    counts.entries()
  ).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
}

export default function PrintableTimetable({
  schoolName,
  academicYear,
  className,
  lessons = [],
  logoUrl = "/high-gate-logo.png",
}: PrintableTimetableProps) {
  /*
   * Always work with a safe array.
   *
   * This prevents:
   * "Cannot read properties of undefined
   * (reading 'forEach')"
   */
  const safeLessons = Array.isArray(lessons)
    ? lessons
    : [];

  const rows = buildRows(safeLessons);

  const summary =
    getSubjectSummary(safeLessons);

  /*
   * Render directly into document.body instead
   * of inside #root.
   *
   * This is important because the print CSS
   * hides #root.
   */
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="print-timetable">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="print-header">

        <div className="print-school-info">

          <div className="print-school-name">
            {schoolName}
          </div>

          <div className="print-academic-year">
            {academicYear}
          </div>

          <div className="print-class-name">
            {className}
          </div>

        </div>

        <div className="print-title">
          TIMETABLE
        </div>

        <div className="print-logo-wrapper">

          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="print-logo"
            />
          )}

        </div>

      </div>


      {/* =====================================================
          TIMETABLE TABLE
      ===================================================== */}

      <table className="print-table">

        <colgroup>

          <col className="print-time-col" />

          {DAYS.map((day) => (
            <col key={day} />
          ))}

        </colgroup>


        {/* ===================================================
            TABLE HEADER
        =================================================== */}

        <thead>

          <tr>

            <th>
              Time
            </th>

            {DAYS.map((day) => (
              <th key={day}>
                {day}
              </th>
            ))}

          </tr>

        </thead>


        {/* ===================================================
            TABLE BODY
        =================================================== */}

        <tbody>

          {rows.map((row, index) => {

            /*
             * BREAK ROW
             */

            if (row.type === "break") {
              return (
                <tr
                  key={`break-${index}`}
                  className="print-break-row"
                >

                  <td className="print-time">
                    {row.start} - {row.end}
                  </td>

                  <td
                    colSpan={6}
                    className="print-break-label"
                  >
                    {row.label}
                  </td>

                </tr>
              );
            }


            /*
             * NORMAL LESSON ROW
             */

            return (
              <tr
                key={`${row.start}-${row.end}`}
              >

                <td className="print-time">
                  {row.start} - {row.end}
                </td>

                {DAYS.map((day) => {

                  const lesson =
                    findLesson(
                      safeLessons,
                      day,
                      row.start,
                      row.end
                    );

                  return (
                    <td
                      key={day}
                      className="print-subject-cell"
                    >

                      {lesson && (
                        <span
                          className="print-subject"
                          style={{
                            color:
                              getSubjectColor(
                                lesson.subject
                              ),
                          }}
                        >
                          {lesson.subject}
                        </span>
                      )}

                    </td>
                  );

                })}

              </tr>
            );

          })}

        </tbody>


        {/* ===================================================
            SUBJECT SUMMARY
        =================================================== */}

        <tfoot>

          <tr>

            <td
              colSpan={7}
              className="print-summary"
            >

              <strong>
                Subjects On TimeTable:
              </strong>{" "}

              {summary.length > 0
                ? summary.map(
                    (
                      [subject, count],
                      index
                    ) => (
                      <React.Fragment
                        key={subject}
                      >

                        {subject} ({count})

                        {index <
                        summary.length - 1
                          ? " | "
                          : ""}

                      </React.Fragment>
                    )
                  )
                : "None"}

              <br />

              <strong>
                =&gt; Total: {safeLessons.length}
              </strong>

            </td>

          </tr>

        </tfoot>

      </table>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="print-footer">

        <div className="print-footer-valid">

          <span>
            Valid from :
          </span>

          <span className="print-line">
            ____________________
          </span>

          <span>
            To :
          </span>

          <span className="print-line">
            ____________________
          </span>

        </div>


        <div className="print-footer-signature">

          <span>
            Prepared by :
          </span>

          <span className="print-line">
            ____________________
          </span>

        </div>


        <div className="print-footer-signature">

          <span>
            Approved by :
          </span>

          <span className="print-line">
            ____________________
          </span>

        </div>

      </div>

    </div>,

    document.body
  );
}