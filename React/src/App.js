import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./App.scss"; // Import your Sass file

import ALL_TIMETABLE_DATA from "./timeTable.json";
import SUBJECT_COLORS from "./subjectColor.json";

// Helper to get day name from day index (0 = Sunday, 1 = Monday)
const getDayName = (dayIndex) => {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[dayIndex];
};

function App() {
  // State for selected options
  const [selectedDegree, setSelectedDegree] = useState(
    () =>
      localStorage.getItem("selectedDegree") ||
      Object.keys(ALL_TIMETABLE_DATA)[0]
  );
  const [selectedSemester, setSelectedSemester] = useState(() => {
    const degreeData = ALL_TIMETABLE_DATA[selectedDegree];
    return (
      localStorage.getItem("selectedSemester") ||
      (degreeData ? Object.keys(degreeData)[0] : "")
    );
  });
  const [selectedDivision, setSelectedDivision] = useState(() => {
    const semesterData = ALL_TIMETABLE_DATA[selectedDegree]?.[selectedSemester];
    return (
      localStorage.getItem("selectedDivision") ||
      (semesterData ? Object.keys(semesterData)[0] : "")
    );
  });
  const [currentDate, setCurrentDate] = useState(new Date()); // For day-wise timetable selection

  // Update localStorage whenever selection changes
  useEffect(() => {
    localStorage.setItem("selectedDegree", selectedDegree);
    localStorage.setItem("selectedSemester", selectedSemester);
    localStorage.setItem("selectedDivision", selectedDivision);
  }, [selectedDegree, selectedSemester, selectedDivision]);

  // Derive available options based on selections
  const degrees = useMemo(() => Object.keys(ALL_TIMETABLE_DATA), []);
  const semesters = useMemo(() => {
    return selectedDegree
      ? Object.keys(ALL_TIMETABLE_DATA[selectedDegree])
      : [];
  }, [selectedDegree]);
  const divisions = useMemo(() => {
    return selectedDegree && selectedSemester
      ? Object.keys(ALL_TIMETABLE_DATA[selectedDegree][selectedSemester])
      : [];
  }, [selectedDegree, selectedSemester]);

  // Get the current timetable for the selected degree, semester, and division
  const currentTimetable = useMemo(() => {
    return (
      ALL_TIMETABLE_DATA[selectedDegree]?.[selectedSemester]?.[
        selectedDivision
      ] || []
    );
  }, [selectedDegree, selectedSemester, selectedDivision]);

  // Function to get current and next lecture
  const getCurrentAndNextLecture = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentDayName = getDayName(currentDayIndex);

    let currentLecture = null;
    let nextLecture = null;

    for (let i = 0; i < currentTimetable.length; i++) {
      const slot = currentTimetable[i];
      const lecture = slot[currentDayName];
      if (!lecture) continue;

      const [startTimeStr, endTimeStr] = slot.time.split("-");
      const [startHour, startMinute] = startTimeStr.split(":").map(Number);
      const [endHour, endMinute] = endTimeStr.split(":").map(Number);

      const startTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        startHour,
        startMinute
      );
      const endTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        endHour,
        endMinute
      );

      // Check if current time is within this lecture slot
      if (now >= startTime && now < endTime) {
        currentLecture = { ...lecture, time: slot.time };
      }
      // Check for the next lecture
      if (now < startTime && !nextLecture) {
        nextLecture = { ...lecture, time: slot.time };
        // If current lecture is found, and this is the first slot after current, it's the next
        if (currentLecture) break;
      }
      // If we've passed the current time and found a next lecture, we can stop early
      if (currentLecture && nextLecture) break;
    }

    // If no current lecture, but there are lectures later today
    if (
      !currentLecture &&
      nextLecture === null &&
      currentTimetable.length > 0
    ) {
      // Find the very first lecture of the day if it's before the first lecture starts
      const firstSlot = currentTimetable[0];
      if (firstSlot && firstSlot[currentDayName]) {
        const [firstStartHour, firstStartMinute] = firstSlot.time
          .split("-")[0]
          .split(":")
          .map(Number);
        const firstLectureStartTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          firstStartHour,
          firstStartMinute
        );
        if (now < firstLectureStartTime) {
          nextLecture = { ...firstSlot[currentDayName], time: firstSlot.time };
        }
      }
    }

    // If no current or next lecture found for today, check for the next day
    if (!currentLecture && !nextLecture) {
      let foundNextLectureForNextDay = false;
      for (let d = 1; d <= 7; d++) {
        // Check next 7 days
        const nextDayIndex = (currentDayIndex + d) % 7;
        const nextDayName = getDayName(nextDayIndex);

        for (let i = 0; i < currentTimetable.length; i++) {
          const slot = currentTimetable[i];
          const lecture = slot[nextDayName];
          if (lecture) {
            nextLecture = {
              ...lecture,
              time: slot.time,
              day: nextDayName.charAt(0).toUpperCase() + nextDayName.slice(1),
            };
            foundNextLectureForNextDay = true;
            break;
          }
        }
        if (foundNextLectureForNextDay) break;
      }
    }

    return { currentLecture, nextLecture };
  }, [currentTimetable]);

  const { currentLecture, nextLecture } = getCurrentAndNextLecture();

  // Handle day selection for daily timetable view
  const handleDaySelect = (e) => {
    setCurrentDate(new Date(e.target.value));
  };

  const dayOptions = useMemo(() => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const today = new Date();
    const options = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      options.push({
        value: day.toISOString().split("T")[0], // YYYY-MM-DD
        label: days[day.getDay()] + (i === 0 ? " (Today)" : ""),
      });
    }
    return options;
  }, []);

  const selectedDayName = getDayName(currentDate.getDay());

  return (
    <div className="app-container">
      {/* College Title */}
      <h1 className="college-title">Smt. K.B. Parekh College</h1>

      <h3 className="developer-info">
        Developer :{" "}
        <b>
          <a
            href="https://jatinporiya.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jatin Poriya
          </a>
        </b>
      </h3>

      {/* Selection Filters */}
      <div className="selection-filters">
        <div className="filter-group">
          <label htmlFor="degree-select">Degree:</label>
          <select
            id="degree-select"
            value={selectedDegree}
            onChange={(e) => {
              setSelectedDegree(e.target.value);
              const newSemesters = ALL_TIMETABLE_DATA[e.target.value]
                ? Object.keys(ALL_TIMETABLE_DATA[e.target.value])
                : [];
              if (newSemesters.length > 0) {
                setSelectedSemester(newSemesters[0]);
                const newDivisions = ALL_TIMETABLE_DATA[e.target.value][
                  newSemesters[0]
                ]
                  ? Object.keys(
                      ALL_TIMETABLE_DATA[e.target.value][newSemesters[0]]
                    )
                  : [];
                if (newDivisions.length > 0) {
                  setSelectedDivision(newDivisions[0]);
                } else {
                  setSelectedDivision("");
                }
              } else {
                setSelectedSemester("");
                setSelectedDivision("");
              }
            }}
          >
            {degrees.map((degree) => (
              <option key={degree} value={degree}>
                {degree}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="semester-select">Semester:</label>
          <select
            id="semester-select"
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              const newDivisions = ALL_TIMETABLE_DATA[selectedDegree]?.[
                e.target.value
              ]
                ? Object.keys(
                    ALL_TIMETABLE_DATA[selectedDegree][e.target.value]
                  )
                : [];
              if (newDivisions.length > 0) {
                setSelectedDivision(newDivisions[0]);
              } else {
                setSelectedDivision("");
              }
            }}
            disabled={semesters.length === 0}
          >
            {semesters.length > 0 ? (
              semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))
            ) : (
              <option value="">No Semesters</option>
            )}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="division-select">Division:</label>
          <select
            id="division-select"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            disabled={divisions.length === 0}
          >
            {divisions.length > 0 ? (
              divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))
            ) : (
              <option value="">No Divisions</option>
            )}
          </select>
        </div>
      </div>

      {currentTimetable.length === 0 && (
        <div className="no-timetable-message">
          No timetable data available for the selected options. Please select a
          valid combination.
        </div>
      )}

      {currentTimetable.length > 0 && (
        <div className="timetable-sections-grid">
          {/* Current and Next Lecture Cards */}
          <div className="lecture-cards-container">
            <LectureCard
              title="Current Lecture"
              lecture={currentLecture}
              defaultMessage="No lecture currently running."
            />
            <LectureCard
              title="Next Lecture"
              lecture={nextLecture}
              defaultMessage="No upcoming lectures for today or the selected day."
            />
          </div>

          {/* Day-wise Timetable */}
          <div className="day-wise-timetable-section">
            <h2 className="section-title">Day-wise Timetable</h2>
            <div className="day-select-container">
              <label htmlFor="day-select">Select Day:</label>
              <select
                id="day-select"
                value={currentDate.toISOString().split("T")[0]}
                onChange={handleDaySelect}
              >
                {dayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <TimetableTable
              timetable={currentTimetable}
              day={selectedDayName}
              title={`Timetable for ${
                selectedDayName.charAt(0).toUpperCase() +
                selectedDayName.slice(1)
              }`}
            />
          </div>

          {/* Weekly Timetable */}
          <div className="weekly-timetable-section">
            <h2 className="section-title">Complete Weekly Timetable</h2>
            <TimetableTable
              timetable={currentTimetable}
              day="all" // Special value to render all days
              title={`Weekly Timetable for ${selectedDegree} ${selectedSemester} - ${selectedDivision}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Component for Current/Next Lecture Cards
const LectureCard = ({ title, lecture, defaultMessage }) => {
  const isFree =
    lecture && (lecture.subject === "FREE" || lecture.subject === "LUNCH");
  const cardBackgroundColor = lecture
    ? SUBJECT_COLORS[lecture.subject.toUpperCase()] || SUBJECT_COLORS.DEFAULT
    : SUBJECT_COLORS.FREE;
  const cardTextColor = isFree ? "#4B5563" : "#FFFFFF"; // Adjusted for better contrast on light free background

  return (
    <div
      className="lecture-card"
      style={{
        backgroundColor: cardBackgroundColor,
        borderColor: isFree ? "#9CA3AF" : cardBackgroundColor, // Border matches background
      }}
    >
      <h3 className="card-title" style={{ color: cardTextColor }}>
        {title}
      </h3>
      {lecture ? (
        <div>
          <p className="card-subject" style={{ color: cardTextColor }}>
            {lecture.subject}
          </p>
          <p className="card-teacher" style={{ color: cardTextColor }}>
            {lecture.teacher ? `Teacher: ${lecture.teacher}` : ""}
          </p>
          <p className="card-time" style={{ color: cardTextColor }}>
            {lecture.time}
          </p>
          {lecture.day && (
            <p className="card-day" style={{ color: cardTextColor }}>
              On: {lecture.day}
            </p>
          )}
        </div>
      ) : (
        <p className="card-default-message" style={{ color: cardTextColor }}>
          {defaultMessage}
        </p>
      )}
    </div>
  );
};

// Component for displaying timetable in a table format
const TimetableTable = ({ timetable, day }) => {
  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ]; // Assuming Sunday is off based on image

  return (
    <div className="timetable-table-container">
      <table className="timetable-table">
        <thead className="timetable-thead">
          <tr>
            <th scope="col" className="timetable-th">
              Time
            </th>
            {day === "all" ? (
              daysOfWeek.map((d) => (
                <th key={d} scope="col" className="timetable-th">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </th>
              ))
            ) : (
              <th scope="col" className="timetable-th">
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="timetable-tbody">
          {timetable.map((slot, index) => (
            <tr key={index}>
              <td className="timetable-td timetable-time-cell">{slot.time}</td>
              {day === "all"
                ? daysOfWeek.map((d) => {
                    const lecture = slot[d];
                    const bgColor = lecture
                      ? SUBJECT_COLORS[lecture.subject.toUpperCase()] ||
                        SUBJECT_COLORS.DEFAULT
                      : SUBJECT_COLORS.FREE;
                    const textColor =
                      lecture &&
                      (lecture.subject === "FREE" ||
                        lecture.subject === "LUNCH")
                        ? "#4B5563"
                        : "#FFFFFF";
                    return (
                      <td
                        key={d}
                        className="timetable-cell"
                        style={{ backgroundColor: bgColor, color: textColor }}
                      >
                        {lecture ? (
                          <>
                            <div className="cell-subject">
                              {lecture.subject}
                            </div>
                            <div className="cell-teacher">
                              {lecture.teacher}
                            </div>
                          </>
                        ) : (
                          <div className="cell-subject cell-free">FREE</div>
                        )}
                      </td>
                    );
                  })
                : (() => {
                    const lecture = slot[day];
                    const bgColor = lecture
                      ? SUBJECT_COLORS[lecture.subject.toUpperCase()] ||
                        SUBJECT_COLORS.DEFAULT
                      : SUBJECT_COLORS.FREE;
                    const textColor =
                      lecture &&
                      (lecture.subject === "FREE" ||
                        lecture.subject === "LUNCH")
                        ? "#4B5563"
                        : "#FFFFFF";
                    return (
                      <td
                        className="timetable-cell"
                        style={{ backgroundColor: bgColor, color: textColor }}
                      >
                        {lecture ? (
                          <>
                            <div className="cell-subject">
                              {lecture.subject}
                            </div>
                            <div className="cell-teacher">
                              {lecture.teacher}
                            </div>
                          </>
                        ) : (
                          <div className="cell-subject cell-free">FREE</div>
                        )}
                      </td>
                    );
                  })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
