import React, { useState, useEffect, useMemo, useCallback } from "react";

import ALL_TIMETABLE_DATA from "./timeTable.json";

import SUBJECT_COLORS from "./subjectColor.json";

const getSubjectColor = (subject) => {
  if (!subject) return SUBJECT_COLORS.FREE;
  return SUBJECT_COLORS[subject.toUpperCase()] || SUBJECT_COLORS.DEFAULT;
};

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
    const selectedDayIndex = new Date(e.target.value).getDay();
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

  useEffect(() => {
    // Google Fonts અને Tailwind CSS CDN સ્ક્રિપ્ટો ઉમેરો
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const tailwindScript = document.createElement("script");
    tailwindScript.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(tailwindScript);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(tailwindScript);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 p-4 font-inter text-gray-800">
      {/* College Title */}
      <h1 className="text-4xl md:text-5xl font-extrabold text-center text-indigo-800 mb-5 drop-shadow-lg">
        Smt. K.B. Parekh College
      </h1>

      <h3 className="text-center mb-3">
        Developer :{" "}
        <b>
          <a href="https://jatinporiya.netlify.app" target="_blank">
            Jatin Poriya
          </a>
        </b>
      </h3>

      {/* Selection Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="degree-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Degree:
          </label>
          <select
            id="degree-select"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
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

        <div>
          <label
            htmlFor="semester-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Semester:
          </label>
          <select
            id="semester-select"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
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

        <div>
          <label
            htmlFor="division-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Division:
          </label>
          <select
            id="division-select"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
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
        <div className="text-center text-lg text-red-600 font-semibold mt-8">
          No timetable data available for the selected options. Please select a
          valid combination.
        </div>
      )}

      {currentTimetable.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Current and Next Lecture Cards */}
          <div className="flex flex-col gap-6">
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
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4">
              Day-wise Timetable
            </h2>
            <div className="mb-4">
              <label
                htmlFor="day-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select Day:
              </label>
              <select
                id="day-select"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
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
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4">
              Complete Weekly Timetable
            </h2>
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
  const cardColorClass = isFree
    ? "bg-gray-200 border-gray-400"
    : getSubjectColor(lecture?.subject);
  const textColorClass = isFree ? "text-gray-800" : "text-white";
  const borderColorClass = isFree ? "border-gray-400" : "border-current"; // Use current color if not free

  return (
    <div
      className={`rounded-xl shadow-md p-6 flex flex-col justify-between transform transition-transform duration-300 hover:scale-105 ${cardColorClass} ${borderColorClass} border-b-4`}
    >
      <h3 className={`text-xl font-semibold mb-2 ${textColorClass}`}>
        {title}
      </h3>
      {lecture ? (
        <div>
          <p className={`text-3xl font-bold ${textColorClass} mb-1`}>
            {lecture.subject}
          </p>
          <p className={`text-lg italic ${textColorClass}`}>
            {lecture.teacher ? `Teacher: ${lecture.teacher}` : ""}
          </p>
          <p className={`text-sm ${textColorClass}`}>{lecture.time}</p>
          {lecture.day && (
            <p className={`text-sm ${textColorClass}`}>On: {lecture.day}</p>
          )}
        </div>
      ) : (
        <p className={`text-xl italic ${textColorClass}`}>{defaultMessage}</p>
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
    <div className="overflow-x-auto rounded-lg shadow-inner border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-indigo-600 text-white">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
            >
              Time
            </th>
            {day === "all" ? (
              daysOfWeek.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </th>
              ))
            ) : (
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
              >
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {timetable.map((slot, index) => (
            <tr key={index}>
              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                {slot.time}
              </td>
              {day === "all"
                ? daysOfWeek.map((d) => {
                    const lecture = slot[d];
                    const bgColor = getSubjectColor(lecture?.subject);
                    const textColor =
                      lecture &&
                      (lecture.subject === "FREE" ||
                        lecture.subject === "LUNCH")
                        ? "text-gray-800"
                        : "text-white";
                    return (
                      <td
                        key={d}
                        className={`px-3 py-2 whitespace-normal text-sm ${bgColor} ${textColor} rounded-md m-1 transition-all duration-200 ease-in-out`}
                      >
                        {lecture ? (
                          <>
                            <div className="font-semibold">
                              {lecture.subject}
                            </div>
                            <div className="text-xs italic">
                              {lecture.teacher}
                            </div>
                          </>
                        ) : (
                          <div className="font-semibold">FREE</div>
                        )}
                      </td>
                    );
                  })
                : (() => {
                    const lecture = slot[day];
                    const bgColor = getSubjectColor(lecture?.subject);
                    const textColor =
                      lecture &&
                      (lecture.subject === "FREE" ||
                        lecture.subject === "LUNCH")
                        ? "text-gray-800"
                        : "text-white";
                    return (
                      <td
                        className={`px-3 py-2 whitespace-normal text-sm ${bgColor} ${textColor} rounded-md m-1 transition-all duration-200 ease-in-out`}
                      >
                        {lecture ? (
                          <>
                            <div className="font-semibold">
                              {lecture.subject}
                            </div>
                            <div className="text-xs italic">
                              {lecture.teacher}
                            </div>
                          </>
                        ) : (
                          <div className="font-semibold">FREE</div>
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
