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

function formatTime(time?: string) {
  if (!time) return "";
  return time.slice(0, 5);
}

function normalizeTime(time?: string) {
  if (!time) return "";
  return time.slice(0, 5);
}

function timeToMinutes(time?: string) {
  if (!time) return 0;

  const [hours, minutes] = time
    .slice(0, 5)
    .split(":")
    .map(Number);

  return (hours || 0) * 60 + (minutes || 0);
}

function isBreak(
  startTime: string,
  endTime: string,
) {
  return BREAKS.some(
    (breakTime) =>
      breakTime.start === startTime &&
      breakTime.end === endTime,
  );
}

function getSubjectColor(subject: string) {
  const value = (subject || "").toLowerCase();

  if (
    value.includes("math") ||
    value.includes("cambridge math")
  ) {
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

  if (value.includes("gp")) {
    return "#769b35";
  }

  if (value.includes("life skills")) {
    return "#777777";
  }

  return "#333333";
}

function buildTimeRows(
  lessons: PrintableLesson[] = [],
) {
  const uniqueTimes = new Map<
    string,
    {
      start: string;
      end: string;
    }
  >();

  lessons.forEach((lesson) => {
    if (!lesson) return;

    const start = normalizeTime(
      lesson.startTime,
    );

    const end = normalizeTime(
      lesson.endTime,
    );

    if (!start || !end) return;

    if (isBreak(start, end)) {
      return;
    }

    const key = `${start}-${end}`;

    if (!uniqueTimes.has(key)) {
      uniqueTimes.set(key, {
        start,
        end,
      });
    }
  });

  const rows = Array.from(
    uniqueTimes.values(),
  );

  rows.sort(
    (a, b) =>
      timeToMinutes(a.start) -
      timeToMinutes(b.start),
  );

  const result: Array<
    | {
        type: "lesson";
        start: string;
        end: string;
      }
    | {
        type: "break";
        start: string;
        end: string;
        label: string;
      }
  > = [];

  rows.forEach((row) => {
    result.push({
      type: "lesson",
      start: row.start,
      end: row.end,
    });
  });

  BREAKS.forEach((breakTime) => {
    result.push({
      type: "break",
      start: breakTime.start,
      end: breakTime.end,
      label: breakTime.label,
    });
  });

  result.sort(
    (a, b) =>
      timeToMinutes(a.start) -
      timeToMinutes(b.start),
  );

  return result;
}

function getLesson(
  lessons: PrintableLesson[] = [],
  day: string,
  start: string,
  end: string,
) {
  return lessons.find(
    (lesson) =>
      lesson &&
      lesson.day === day &&
      normalizeTime(
        lesson.startTime,
      ) === start &&
      normalizeTime(
        lesson.endTime,
      ) === end,
  );
}

function getSubjectSummary(
  lessons: PrintableLesson[] = [],
) {
  const counts = new Map<
    string,
    number
  >();

  lessons.forEach((lesson) => {
    if (!lesson?.subject) return;

    counts.set(
      lesson.subject,
      (counts.get(lesson.subject) ?? 0) + 1,
    );
  });

  return Array.from(
    counts.entries(),
  ).sort((a, b) =>
    a[0].localeCompare(b[0]),
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
   * Always use a safe array.
   */
  const safeLessons = Array.isArray(lessons)
    ? lessons
    : [];

  const rows = buildTimeRows(
    safeLessons,
  );

  const subjectSummary =
    getSubjectSummary(
      safeLessons,
    );

  const totalLessons =
    safeLessons.length;

  /*
   * The printable timetable must be
   * rendered OUTSIDE #root.
   *
   * Your print CSS hides #root,
   * so rendering here allows the timetable
   * to remain visible during printing.
   */
  if (
    typeof document === "undefined"
  ) {
    return null;
  }

  const printableContent = (
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

          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="print-logo"
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />
          ) : null}

        </div>

      </div>


      {/* =====================================================
          TABLE
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

          {rows.map(
            (row, index) => {

              /*
               * BREAK
               */

              if (
                row.type === "break"
              ) {
                return (
                  <tr
                    key={`break-${index}`}
                    className="print-break-row"
                  >

                    <td className="print-time">
                      {row.start} -{" "}
                      {row.end}
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
               * LESSON ROW
               */

              return (
                <tr
                  key={`${row.start}-${row.end}`}
                >

                  <td className="print-time">
                    {row.start} -{" "}
                    {row.end}
                  </td>

                  {DAYS.map(
                    (day) => {

                      const lesson =
                        getLesson(
                          safeLessons,
                          day,
                          row.start,
                          row.end,
                        );

                      return (
                        <td
                          key={day}
                          className="print-subject-cell"
                        >

                          {lesson ? (
                            <span
                              className="print-subject"
                              style={{
                                color:
                                  getSubjectColor(
                                    lesson.subject,
                                  ),
                              }}
                            >
                              {
                                lesson.subject
                              }
                            </span>
                          ) : null}

                        </td>
                      );

                    },
                  )}

                </tr>
              );

            },
          )}

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

              {subjectSummary.length >
              0
                ? subjectSummary.map(
                    (
                      [
                        subject,
                        count,
                      ],
                      index,
                    ) => (
                      <React.Fragment
                        key={subject}
                      >

                        {subject}{" "}
                        ({count})

                        {index <
                        subjectSummary.length -
                          1
                          ? " | "
                          : ""}

                      </React.Fragment>
                    ),
                  )
                : "None"}

              <br />

              <strong>
                =&gt; Total:{" "}
                {totalLessons}
              </strong>

            </td>

          </tr>

        </tfoot>

      </table>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="print-footer">

        <div>
          Valid from :

          <span className="print-line">
            ____________________
          </span>

          To :

          <span className="print-line">
            ____________________
          </span>
        </div>


        <div>
          Prepared by :

          <span className="print-line prepared-line">
            __________________________
          </span>
        </div>


        <div>
          Approved by :

          <span className="print-line approved-line">
            __________________________
          </span>
        </div>

      </div>

    </div>
  );

  /*
   * IMPORTANT:
   * Render outside #root.
   */
  return createPortal(
    printableContent,
    document.body,
  );
}