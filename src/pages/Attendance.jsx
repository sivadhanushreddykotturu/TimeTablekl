import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import AttendanceModal from "../components/AttendanceModal";
import Toast from "../components/Toast";

export default function Attendance() {
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const navigate = useNavigate();

  const handleFetchAttendance = () => {
    setShowAttendanceModal(true);
  };

  const handleAttendanceSuccess = (attendance) => {
    setAttendanceData(attendance);
    setToast({
      show: true,
      message: "Attendance fetched successfully!",
      type: "success"
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const getPercentageColor = (percentage) => {
    const num = parseInt(percentage);
    if (num >= 85) return "#28a745"; // Green
    if (num >= 75) return "#ffc107"; // Yellow
    return "#dc3545"; // Red
  };

  const groupAttendanceByCourse = (attendance) => {
    const grouped = {};
    attendance.forEach(item => {
      const courseCode = item.Coursecode;
      if (!grouped[courseCode]) {
        grouped[courseCode] = {
          courseName: item.Coursedesc,
          courseCode: courseCode,
          sections: []
        };
      }
      grouped[courseCode].sections.push({
        ltps: item.Ltps,
        section: item.Section,
        percentage: item.Percentage,
        totalConducted: item["Total Conducted"],
        totalAttended: item["Total Attended"],
        totalAbsent: item["Total Absent"]
      });
    });
    return Object.values(grouped);
  };

  return (
    <>
      <Header onRefresh={handleFetchAttendance} />

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Attendance</h1>
          <div className="action-buttons">
            <button onClick={() => navigate("/home")}>
              Back to Home
            </button>
          </div>
        </div>

        {attendanceData.length === 0 ? (
          <div className="card">
            <p className="text-center">Click "ReSync" to fetch your attendance data</p>
          </div>
        ) : (
          <div className="attendance-container">
            {groupAttendanceByCourse(attendanceData).map((course, index) => (
              <div key={index} className="attendance-card">
                <div className="course-header">
                  <h3 className="course-name">{course.courseName}</h3>
                  <span className="course-code">{course.courseCode}</span>
                </div>
                <div className="sections-container">
                  {course.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="section-item">
                      <div className="section-info">
                        <span className="ltps-badge">{section.ltps}</span>
                        <span className="section-name">{section.section}</span>
                      </div>
                      <div className="attendance-stats">
                        <div 
                          className="percentage"
                          style={{ color: getPercentageColor(section.percentage) }}
                        >
                          {section.percentage}
                        </div>
                        <div className="attendance-details">
                          <span>{section.totalAttended}/{section.totalConducted}</span>
                          <span className="absent-count">({section.totalAbsent} absent)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        onSuccess={handleAttendanceSuccess}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
