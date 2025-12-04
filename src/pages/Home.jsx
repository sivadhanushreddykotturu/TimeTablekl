import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "../components/Header";
import RecentContributors from "../components/RecentContributors";

export default function Home() {
  const navigate = useNavigate();
  const [timetableData, setTimetableData] = useState(null);

  useEffect(() => {
    const storedTimetable = localStorage.getItem("timetable");
    if (storedTimetable) {
      try {
        setTimetableData(JSON.parse(storedTimetable));
      } catch (error) {
        console.error("Error parsing timetable:", error);
      }
    }
  }, []);

  return (
    <div className="container">
      <Header />

      <div className="card">
        <h2>Your Timetable</h2>
        <p className="text-secondary">
          {timetableData
            ? `Odd Semester • ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`
            : "No timetable data available"}
        </p>
      </div>

      {timetableData && (
        <>
          <div className="card">
            <h3>Current Class</h3>
            <p className="text-secondary">No ongoing class</p>
          </div>

          <div className="card">
            <h3>Next Class</h3>
            <p className="text-secondary">
              Check your timetable for upcoming classes
            </p>
          </div>

          <div className="card">
            <h3>Today's Subjects</h3>
            <p className="text-secondary">View your full timetable for details</p>
          </div>
        </>
      )}

      <button
        onClick={() => navigate("/timetable")}
        className="primary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        View Full Timetable
      </button>

      <button
        onClick={() => navigate("/subjects")}
        className="secondary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        Manage Subject Names
      </button>

      <button
        onClick={() => navigate("/maddys")}
        className="secondary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        Where's Maddy? 👥
      </button>

      <button
        onClick={() => navigate("/attendance")}
        className="secondary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        Attendance
      </button>

      <button
        onClick={() => {
          localStorage.setItem("examMode", "true");
          navigate("/exam");
        }}
        className="secondary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        Exam Mode
      </button>

      <button
        onClick={() => navigate("/handouts")}
        className="secondary full-width-mobile"
        style={{ marginTop: "20px" }}
      >
        📚 Handouts
      </button>

      <RecentContributors />
    </div>
  );
}
