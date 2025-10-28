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
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedRegisterData, setSelectedRegisterData] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const navigate = useNavigate();
    
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

  const handleRegisterClick = (registerData) => {
    console.log('handleRegisterClick called with:', registerData);
    setSelectedRegisterData(registerData);
    setShowRegisterModal(true);
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
    setSelectedRegisterData(null);
  };

  const getPercentageColor = (percentage) => {
    const num = parseInt(percentage);
    if (num >= 85) return "#28a745";
    if (num >= 75) return "#ffc107";
    return "#dc3545";
  };

  const groupAttendanceByCourse = (attendance) => {
    const LTPS_WEIGHTS = {
      L: 100,
      T: 100,
      P: 50,
      S: 25,
      O: 1
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
      
      const totalAttended = parseInt(item["Total Attended"]);
      const totalConducted = parseInt(item["Total Conducted"]);
      
      let rawPercentage = 0;
      if (totalConducted > 0) {
        rawPercentage = (totalAttended / totalConducted) * 100;
      }
      
      grouped[courseCode].sections.push({
        ltps: item.Ltps,
        section: item.Section,
        percentage: item.Percentage,
        totalConducted: item["Total Conducted"],
        totalAttended: item["Total Attended"],
        totalAbsent: item["Total Absent"],
        // Store the precise raw percentage, fixed to 2 decimals for display
        rawPercentage: rawPercentage.toFixed(2)
      });
    });
    
    Object.values(grouped).forEach(course => {
      if (course.sections.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;

        course.sections.forEach(section => {
          const componentType = section.ltps.charAt(0).toUpperCase();
          const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS.O;
          
          let calculationPercentage = 0;
          const attended = parseInt(section.totalAttended);
          const conducted = parseInt(section.totalConducted);
          
          if (conducted > 0) {
            // Use precise percentage for weighted calculation
            calculationPercentage = (attended / conducted) * 100;
          }

          if (!isNaN(calculationPercentage) && calculationPercentage >= 0) {
            weightedSum += calculationPercentage * weight;
            totalWeight += weight;
          }
        });

        if (totalWeight > 0) {
          const calculatedPercentage = weightedSum / totalWeight;
          // Apply Math.ceil to the final overall average
          course.overallPercentage = Math.ceil(Math.max(0, Math.min(100, calculatedPercentage)));
        } else {
          course.overallPercentage = 0;
        }

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
            <button onClick={() => navigate("/home")}>Back to Home</button>
          </div>
        </div>

        {attendanceData.length === 0 ? (
          <div className="card">
            <p className="text-center">
              Click "ReSync" to fetch {friendCredentials ? `${friendCredentials.name}'s` : 'your attendance and wait min 5 seconds becasue it also fetches register' } 
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
                      {course.averageType || 'Weighted Average'} from{" "}
                      {course.sections.length} component
                      {course.sections.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div className="sections-container">
                  {course.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="section-item">
                      <div className="section-info">
                        <span className="ltps-badge">{section.ltps}</span>
                        <span className="section-name">{section.section}</span>
                      </div>

                      {/* Cool Register Button */}
                      {["L", "P", "S", "T"].includes(section.ltps.charAt(0).toUpperCase()) && (
                        <div
                          className="register-button"
                          style={{
                            marginLeft: "2.6rem",
                            marginTop: "4px",
                            padding: "6px 12px",
                            fontSize: "clamp(0.8rem, 1.2vw, 0.9rem)",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = "var(--bg-tertiary)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "var(--bg-primary)";
                          }}
                          onClick={() => {
                            console.log('Register button clicked!');
                            console.log('Looking for:', {
                              courseCode: course.courseCode,
                              ltps: section.ltps,
                              section: section.section
                            });
                            console.log('Available attendance data:', attendanceData);
                            
                            // Find the corresponding attendance item with register_details
                            const attendanceItem = attendanceData.find(item => 
                              item.Coursecode === course.courseCode && 
                              item.Ltps === section.ltps && 
                              item.Section === section.section
                            );
                            
                            console.log('Found attendance item:', attendanceItem);
                            
                            if (attendanceItem) {
                              console.log('Attendance item found:', attendanceItem);
                              console.log('Has register_details?', !!attendanceItem.register_details);
                              
                              if (attendanceItem.register_details) {
                                console.log('Register details found:', attendanceItem.register_details);
                                // Pass the complete attendance item data including metadata
                                const registerData = {
                                  metadata: {
                                    ...attendanceItem.register_details.metadata,
                                    Coursecode: attendanceItem.Coursecode,
                                    Ltps: attendanceItem.Ltps,
                                    Section: attendanceItem.Section
                                  },
                                  daily_attendance: attendanceItem.register_details.daily_attendance
                                };
                                console.log('Passing register data:', registerData);
                                handleRegisterClick(registerData);
                              } else {
                                console.log('No register_details in attendance item, trying alternative approach...');
                                // Fallback: create register data from the attendance item itself
                                const registerData = {
                                  metadata: {
                                    Coursecode: attendanceItem.Coursecode,
                                    Coursedesc: attendanceItem.Coursedesc,
                                    Ltps: attendanceItem.Ltps,
                                    Section: attendanceItem.Section,
                                    "Student Uni Id": "N/A",
                                    "Student Name": "N/A",
                                    "Total Conducted": attendanceItem["Total Conducted"],
                                    "Total Attended": attendanceItem["Total Attended"],
                                    "Total Absent": attendanceItem["Total Absent"],
                                    Percentage: attendanceItem.Percentage
                                  },
                                  daily_attendance: [] // Empty array if no daily attendance data
                                };
                                console.log('Using fallback register data:', registerData);
                                handleRegisterClick(registerData);
                              }
                            } else {
                              console.log('No attendance item found matching the criteria');
                            }
                          }}
                        >
                          Register
                        </div>
                      )}

                      <div className="attendance-stats">
                        <div
                          className="percentage"
                          style={{ color: getPercentageColor(section.percentage) }}
                        >
                          {/* Display the rounded percentage + % symbol */}
                          {section.percentage}
                          {/* Display the precise raw percentage in parentheses (CORRECTED) */}
                          {section.totalConducted > 0 && section.rawPercentage && (
                            <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                              ({section.rawPercentage}%)
                            </span>
                          )}
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

      {/* Register Modal */}
      {showRegisterModal && selectedRegisterData && (
        <div className="modal-overlay" onClick={closeRegisterModal}>
          <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Details</h2>
              <button className="close-btn" onClick={closeRegisterModal}>×</button>
            </div>
            
            <div className="register-content">
              {/* Daily Attendance */}
              <div className="daily-attendance">
                <div className="attendance-table">
                  <div className="table-header" style={{display: 'flex', width: '100%', background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)'}}>
                    <span className="header-date" style={{flex: '0 0 60%', padding: '12px 16px', borderRight: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-primary)'}}>Date & Time</span>
                    <span className="header-status" style={{flex: '0 0 40%', padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)'}}>Status</span>
                  </div>
                  {selectedRegisterData.daily_attendance && selectedRegisterData.daily_attendance.length > 0 ? (
                    [...selectedRegisterData.daily_attendance].reverse().map((entry, index) => {
                      console.log('Processing entry:', entry);
                      return (
                        <div key={index} className="attendance-row" style={{display: 'flex', width: '100%', borderBottom: '1px solid var(--border-light)'}}>
                          <span className="date-slot" style={{flex: '0 0 60%', padding: '12px 16px', borderRight: '1px solid var(--border-light)', color: 'var(--text-primary)'}}>
                            {entry.date_slot.split(' H ')[0]} H{entry.date_slot.split(' H ')[1]}
                          </span>
                          <span className="status" style={{flex: '0 0 40%', padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)'}}>
                            {entry.status === 'P' ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data">No daily attendance data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}