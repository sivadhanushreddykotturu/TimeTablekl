import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import AttendanceModal from "../components/AttendanceModal";
import CalculatorModal from "../components/CalculatorModal";
import Toast from "../components/Toast";

export default function Attendance() {
  const location = useLocation();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const navigate = useNavigate();
  
  // Get friend credentials from location state if available
  const friendCredentials = location.state?.friendCredentials || null;

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
    // Define the weights for L-T-P-S components
    const LTPS_WEIGHTS = {
        'L': 100,
        'T': 25,
        'P': 50,
        'S': 25,
        // Default to a small weight (e.g., 1) for any unknown component type to prevent division by zero
        'O': 1 
    };

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
    
    // Calculate overall percentage for each course using Weighted Average
    Object.values(grouped).forEach(course => {
      if (course.sections.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;

        course.sections.forEach(section => {
          const componentType = section.ltps.charAt(0).toUpperCase();
          const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS['O'];
          const percentage = parseFloat(section.percentage);

          if (!isNaN(percentage) && percentage >= 0) {
            weightedSum += percentage * weight;
            totalWeight += weight;
          }
        });

        if (totalWeight > 0) {
          const calculatedPercentage = (weightedSum / totalWeight);
          // Clamp the result between 0 and 100 and round up (Math.ceil) for display
          course.overallPercentage = Math.ceil(Math.max(0, Math.min(100, calculatedPercentage)));
        } else {
          course.overallPercentage = 0;
        }

        // Add a field to display the type of average used
        course.averageType = "Weighted Average";

      } else {
        course.overallPercentage = 0;
        course.averageType = "N/A";
      }
    });
    
    return Object.values(grouped);
  };

  return (
    <>
      <Header onRefresh={handleFetchAttendance} />

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            {friendCredentials ? `${friendCredentials.name}'s Attendance` : 'Attendance'}
          </h1>
          <div className="action-buttons">
            <button onClick={() => navigate("/home")}>
              Back to Home
            </button>
          </div>
        </div>

        {attendanceData.length === 0 ? (
          <div className="card">
            <p className="text-center">
              Click "ReSync" to fetch {friendCredentials ? `${friendCredentials.name}'s` : 'your'} attendance data
            </p>
          </div>
        ) : (
          <div className="attendance-container">
             {groupAttendanceByCourse(attendanceData).map((course, index) => (
               <div key={index} className="attendance-card">
                 <div className="course-header">
                   <h3 className="course-name">{course.courseName}</h3>
                   <span className="course-code">{course.courseCode}</span>
                 </div>
                 
                 {/* Total Attendance Box */}
                 <div className="total-attendance-box">
                   <div className="total-info">
                     <span className="total-badge">TOTAL</span>
                     <span className="total-label">Overall Attendance</span>
                   </div>
                   <div className="total-stats">
                     <div 
                       className="total-percentage"
                       style={{ color: getPercentageColor(course.overallPercentage) }}
                     >
                       {course.overallPercentage}%
                     </div>
                     <div className="total-details">
                       {/* Display the calculated average type */}
                       {course.averageType || 'Weighted Average'} from {course.sections.length} component{course.sections.length !== 1 ? 's' : ''}
                     </div>
                   </div>
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
        friendCredentials={friendCredentials}
      />

      <CalculatorModal
        isOpen={showCalculatorModal}
        onClose={() => setShowCalculatorModal(false)}
      />

      {/* Calculator Icon Button */}
      <button
        className="calculator-icon-btn"
        onClick={() => setShowCalculatorModal(true)}
        title="Open Calculator"
      >
        🧮
      </button>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}