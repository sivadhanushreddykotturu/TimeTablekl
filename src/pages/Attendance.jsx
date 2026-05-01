import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";
import Header from "../components/Header";
import CalculatorModal from "../components/CalculatorModal";
import ShowCalculation from "../components/ShowCalculation";
import Toast from "../components/Toast";
import { trackEvent } from "../utils/analytics";
import axios from "axios";
import { getCredentials } from "../../utils/storage.js";
import { getFormData, API_CONFIG } from "../config/api.js";

export default function Attendance() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calculatorInitialCourse, setCalculatorInitialCourse] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedRegisterData, setSelectedRegisterData] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [selectedCourseData, setSelectedCourseData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const attendanceRef = useRef(null);
  const navigate = useNavigate();
    
  const friendCredentials = location.state?.friendCredentials || null;
  const [targetPercentage, setTargetPercentage] = useState(() => {
    const saved = localStorage.getItem("attendanceTargetPercentage");
    const parsed = saved ? parseFloat(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : 75;
  });
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");

  useEffect(() => {
    if (showTargetModal) {
      setTargetInput(String(targetPercentage));
      setTargetError("");
    }
  }, [showTargetModal]);

  const fetchAttendanceData = async () => {
    setIsLoading(true);
    setError("");

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "odd");
    const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

    try {
      const form = getFormData(creds.username, creds.password, "", semester, academicYear, "");
      const res = await axios.post(API_CONFIG.ATTENDANCE_URL, form);
      
      if (res.data.success) {
        handleAttendanceSuccess(res.data.attendance);
      } else {
        setError(res.data.message || "Failed to fetch attendance. Please try again.");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    // eslint-disable-next-line
  }, []);



  const handleAttendanceSuccess = (attendance) => {
    const grouped = groupAttendanceByCourse(attendance);
    const courseCount = grouped.length;
    const overallPercentages = grouped.map(c => c.overallPercentage);
    const avgPercentage = overallPercentages.length > 0 
      ? Math.round(overallPercentages.reduce((a, b) => a + b, 0) / overallPercentages.length)
      : 0;
    
    trackEvent('attendance_fetched', {
      course_count: courseCount,
      average_percentage: avgPercentage,
      is_friend: !!friendCredentials,
      friend_name: friendCredentials?.name || null
    });
    
    // Auto-map empty subject names upon attendance fetch
    try {
      if (!friendCredentials) { // Only map for the current user's attendance
        const savedMappings = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
        let madeChanges = false;
        
        attendance.forEach(item => {
          if (item.Coursecode && item.Coursedesc) {
            const match = item.Coursecode.match(/^[A-Za-z0-9]+/);
            const mainCode = match ? match[0] : item.Coursecode;
            
            // Only set if not already set, preserving user's manual edits
            if (!savedMappings[mainCode]) {
              const words = item.Coursedesc.trim().split(/\s+/);
              let acronym = "";
              if (words.length === 1) {
                acronym = words[0].substring(0, 5).toUpperCase();
              } else {
                words.forEach(word => {
                  if (
                    word.length > 0 &&
                    !["AND", "OF", "THE", "IN", "FOR", "TO"].includes(word.toUpperCase()) &&
                    !word.match(/^[0-9]+$/)
                  ) {
                    acronym += word[0].toUpperCase();
                  }
                });
                acronym = acronym.substring(0, 5);
              }
              if (acronym) {
                savedMappings[mainCode] = acronym;
                madeChanges = true;
              }
            }
          }
        });
        
        if (madeChanges) {
          localStorage.setItem("subjectMappings", JSON.stringify(savedMappings));
        }
      }
    } catch (err) {
      console.error("Error auto-mapping subjects:", err);
    }
    
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

  const saveTargetPercentage = (value) => {
    setTargetPercentage(value);
    try {
      localStorage.setItem("attendanceTargetPercentage", String(value));
    } catch (_) {}
  };

  const classesToReachTarget = (present, total, target) => {
    if (target >= 100) return Infinity;
    const needed = (target * total - 100 * present) / (100 - target);
    return Math.max(0, Math.ceil(needed));
  };

  const safeBunksAtTarget = (present, total, target) => {
    if (target <= 0) return Infinity;
    const available = (100 * present - target * total) / target;
    return Math.max(0, Math.floor(available));
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
      const tcbr = parseInt(item["Tcbr"] || "0");
      
      let rawPercentage = 0;
      if (totalConducted > 0) {
        const adjustedAttended = totalAttended + (tcbr > 0 ? tcbr : 0);
        rawPercentage = (adjustedAttended / totalConducted) * 100;
      }
      
      grouped[courseCode].sections.push({
        ltps: item.Ltps,
        section: item.Section,
        percentage: item.Percentage,
        totalConducted: item["Total Conducted"],
        totalAttended: item["Total Attended"],
        totalAbsent: item["Total Absent"],
        tcbr: tcbr,
        rawPercentage: rawPercentage.toFixed(2)
      });
    });
    
    Object.values(grouped).forEach(course => {
      if (course.sections.length > 0) {
        let weightedAttendedSum = 0;
        let weightedConductedSum = 0;

        course.sections.forEach(section => {
          const componentType = section.ltps.charAt(0).toUpperCase();
          const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS.O;

          const attended = parseInt(section.totalAttended);
          const conducted = parseInt(section.totalConducted);
          const tcbr = parseInt(section.tcbr || "0");
          const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
          const safeConducted = Number.isFinite(conducted) ? conducted : 0;

          weightedAttendedSum += adjustedAttended * weight;
          weightedConductedSum += safeConducted * weight;
        });

        if (weightedConductedSum > 0) {
          const calculated = (weightedAttendedSum / weightedConductedSum) * 100;
          course.overallPercentage = Math.ceil(Math.max(0, Math.min(100, calculated)));
        } else {
          course.overallPercentage = 0;
        }

        course.averageType = "Weighted (L/T/P/S)";
      } else {
        course.overallPercentage = 0;
        course.averageType = "N/A";
      }
    });

    return Object.values(grouped);
  };

  const generateHighQualityCanvas = useCallback(() => {
    if (!attendanceData || attendanceData.length === 0) return null;

    const groupedCourses = groupAttendanceByCourse(attendanceData);
    if (groupedCourses.length === 0) return null;

    const scale = 2;
    const padding = 40;
    const cardPadding = 16;
    const cardSpacing = 20;
    const headerHeight = 50;
    const componentRowHeight = 40;
    const componentIndent = 20;
    const maxWidth = 700;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Calculate dimensions
    let totalHeight = padding * 2 + 60; // Title + padding
    
    groupedCourses.forEach(course => {
      totalHeight += headerHeight; // Course header
      // Add height for each component (L, T, P, S)
      const components = ['L', 'T', 'P', 'S'];
      let componentCount = 0;
      components.forEach(comp => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) {
          componentCount++;
        }
      });
      totalHeight += componentCount * componentRowHeight;
      totalHeight += cardSpacing;
    });
    
    totalHeight += 40; // Watermark space
    
    canvas.width = maxWidth * scale;
    canvas.height = totalHeight * scale;
    ctx.scale(scale, scale);
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, maxWidth, totalHeight);
    
    // Title
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const titleText = friendCredentials ? `${friendCredentials.name}'s Attendance` : 'Attendance';
    ctx.fillText(titleText, maxWidth / 2, 35);
    
    let yPos = padding + 60;
    
    // Draw each course as a card
    groupedCourses.forEach((course, courseIndex) => {
      const cardX = padding;
      const cardWidth = maxWidth - (padding * 2);
      
      // Calculate card height
      const components = ['L', 'T', 'P', 'S'];
      let componentCount = 0;
      components.forEach(comp => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) componentCount++;
      });
      const cardHeight = headerHeight + (componentCount * componentRowHeight);
      
      // Draw card background with border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cardX, yPos, cardWidth, cardHeight);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);
      
      // Draw course header with purple background
      ctx.fillStyle = '#667eea';
      ctx.fillRect(cardX, yPos, cardWidth, headerHeight);
      ctx.strokeStyle = '#5568d3';
      ctx.strokeRect(cardX, yPos, cardWidth, headerHeight);
      
      // Course name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const courseName = course.courseName.length > 45 
        ? course.courseName.substring(0, 42) + '...' 
        : course.courseName;
      ctx.fillText(courseName, cardX + cardPadding, yPos + headerHeight / 2 + 6);
      
      // Overall percentage
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${course.overallPercentage}%`, cardX + cardWidth - cardPadding, yPos + headerHeight / 2 + 6);
      
      let componentY = yPos + headerHeight;
      
      // Draw L, T, P, S components (only if they exist)
      components.forEach((comp, compIndex) => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) {
          const attended = parseInt(section.totalAttended);
          const conducted = parseInt(section.totalConducted);
          const tcbr = parseInt(section.tcbr || "0");
          const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
          const safeConducted = Number.isFinite(conducted) ? conducted : 0;
          
          let individualPercentage = 0;
          if (safeConducted > 0) {
            individualPercentage = Math.ceil((adjustedAttended / safeConducted) * 100);
          }
          
          // Alternate row background
          ctx.fillStyle = compIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
          ctx.fillRect(cardX, componentY, cardWidth, componentRowHeight);
          
          // Component badge
          ctx.fillStyle = '#667eea';
          ctx.fillRect(cardX + cardPadding, componentY + 8, 32, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(comp, cardX + cardPadding + 16, componentY + 24);
          
          // Component percentage
          ctx.fillStyle = '#1a1a1a';
          ctx.font = '600 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${individualPercentage}%`, cardX + cardPadding + componentIndent + 32, componentY + componentRowHeight / 2 + 5);
          
          // Border between components
          if (compIndex < componentCount - 1) {
            ctx.strokeStyle = '#e0e0e0';
            ctx.beginPath();
            ctx.moveTo(cardX + cardPadding, componentY + componentRowHeight);
            ctx.lineTo(cardX + cardWidth - cardPadding, componentY + componentRowHeight);
            ctx.stroke();
          }
          
          componentY += componentRowHeight;
        }
      });
      
      // Card border
      ctx.strokeStyle = '#e0e0e0';
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);
      
      yPos += cardHeight + cardSpacing;
    });
    
    // Add watermark
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#999999';
    ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Attendance', maxWidth - 20, totalHeight - 15);
    ctx.restore();
    
    return canvas;
  }, [attendanceData, friendCredentials]);

  const exportAsImage = useCallback(async () => {
    if (!attendanceData || attendanceData.length === 0) return;
    setExporting(true);
    
    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert('Failed to generate image');
        setExporting(false);
        return;
      }
      
      const fileName = friendCredentials 
        ? `${friendCredentials.name}_Attendance_${new Date().toISOString().split('T')[0]}.png`
        : `Attendance_${new Date().toISOString().split('T')[0]}.png`;
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Failed to generate image');
          setExporting(false);
          return;
        }
        
        // Try to use Web Share API if available
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
              files: [file],
              title: friendCredentials ? `${friendCredentials.name}'s Attendance` : 'My Attendance',
              text: friendCredentials ? `Check out ${friendCredentials.name}'s attendance!` : 'Check out my attendance!'
            };
            
            // Check if we can share files
            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              setExporting(false);
              return;
            }
          } catch (shareError) {
            // If sharing fails or is cancelled, fall back to download
            if (shareError.name !== 'AbortError') {
              console.log('Share failed, falling back to download:', shareError);
            }
          }
        }
        
        // Fallback: download if Web Share API is not available or failed
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        setExporting(false);
      }, 'image/png', 1.0);
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
      setExporting(false);
    }
  }, [attendanceData, generateHighQualityCanvas, friendCredentials]);

  
  useEffect(() => {
    trackEvent('attendance_page_viewed', {
      has_attendance_data: attendanceData.length > 0,
      is_friend: !!friendCredentials,
      friend_name: friendCredentials?.name || null
    });
  }, []);

  return (
    <>
      <Header />

      <div style={{ marginTop: "16px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <button onClick={() => navigate("/home")} className="secondary">
          Back to Home
        </button>
      </div>

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            {friendCredentials ? `${friendCredentials.name}'s Attendance` : 'Attendance'}
          </h1>
          <div className="action-buttons">
            <button
              onClick={() => setShowTargetModal(true)}
              className="edit-target-btn"
            >
              Edit Safe % (now {targetPercentage}%)
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="card">
            <p className="text-center">
              <strong>Fetching {friendCredentials ? `${friendCredentials.name}'s` : 'your'} attendance...</strong>
            </p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="text-center" style={{ color: "#dc3545", marginBottom: "15px" }}>
              {error}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button onClick={fetchAttendanceData} className="primary">Retry</button>
            </div>
          </div>
        ) : attendanceData.length === 0 ? (
          <div className="card">
            <p className="text-center">
              No attendance data found.
            </p>
          </div>
        ) : (
          <div ref={attendanceRef} className="attendance-container">
            {groupAttendanceByCourse(attendanceData).map((course, index) => (
              <div key={index} className="attendance-card">
                <div className="course-header">
                  <h3 className="course-name">{course.courseName}</h3>
                  <span className="course-code">{course.courseCode}</span>
                </div>

                
                <div className="total-attendance-box">
                  <div className="total-info">
                    <span className="total-badge">TOTAL</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="total-label">Overall Attendance</span>
                      <button
                        onClick={() => {
                          const initData = course.sections.map(section => {
                            const type = section.ltps.charAt(0).toUpperCase();
                            return {
                              type,
                              attended: section.totalAttended,
                              conducted: section.totalConducted,
                              tcbr: section.tcbr || "0"
                            };
                          }).filter(item => ['L', 'T', 'P', 'S'].includes(item.type));
                          setCalculatorInitialCourse(initData);
                          setShowCalculatorModal(true);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          transition: "transform 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = "scale(1.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = "scale(1)";
                        }}
                        title="Open Calculator with components"
                      >
                        🧮
                      </button>
                    </div>
                  </div>
                  <div className="total-stats">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        className="total-percentage"
                        style={{ color: getPercentageColor(course.overallPercentage) }}
                      >
                        {course.overallPercentage}%
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCourseData(course);
                          setShowCalculationModal(true);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                          transition: "color 0.2s, transform 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = "var(--text-primary)";
                          e.target.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = "var(--text-secondary)";
                          e.target.style.transform = "scale(1)";
                        }}
                        title="Show calculation breakdown"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="total-details">
                      {course.averageType || 'Weighted Average'} from{" "}
                      {course.sections.length} component
                      {course.sections.length !== 1 ? "s" : ""}
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
                                  daily_attendance: []
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
                          style={{ color: getPercentageColor(section.rawPercentage) }} 
                        >
                          {Math.ceil(parseFloat(section.rawPercentage))}%
                          
                          {section.totalConducted > 0 && section.rawPercentage && (
                            <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                              ({section.rawPercentage}%)
                            </span>
                          )}
                        </div>
                <div className="attendance-details">
                  <span>{section.totalAttended}/{section.totalConducted}</span>
                  <span className="absent-count">({section.totalAbsent} absent)</span>
                  {(() => {
                    const tcbrValue = parseInt(section.tcbr || "0");
                    return tcbrValue > 0 ? (
                      <span className="absent-count" style={{ marginLeft: "4px" }}>tcbr={tcbrValue}</span>
                    ) : null;
                  })()}
                </div>
                
                {(() => {
                  const attended = parseInt(section.totalAttended);
                  const conducted = parseInt(section.totalConducted);
                  const tcbr = parseInt(section.tcbr || "0");
                  if (!Number.isFinite(attended) || !Number.isFinite(conducted) || conducted <= 0) {
                    return null;
                  }
                  
                  const adjustedAttended = attended + (tcbr > 0 ? tcbr : 0);
                  const current = (adjustedAttended / conducted) * 100;
                  if (current >= targetPercentage) {
                    const safe = safeBunksAtTarget(adjustedAttended, conducted, targetPercentage);
                    return (
                      <div style={{ marginTop: "4px", fontSize: "0.9em", color: "var(--text-secondary)" }}>
                        Safe sessions at {targetPercentage}%: <strong style={{ color: "var(--text-primary)" }}>{safe} (hrs)</strong>
                      </div>
                    );
                  }
                  const need = classesToReachTarget(adjustedAttended, conducted, targetPercentage);
                  return (
                    <div style={{ marginTop: "4px", fontSize: "0.9em", color: "var(--text-secondary)" }}>
                      Attend next <strong style={{ color: "var(--text-primary)" }}>{need} (hrs)</strong> to reach {targetPercentage}%
                    </div>
                  );
                })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>



      <CalculatorModal
        isOpen={showCalculatorModal}
        onClose={() => {
          setShowCalculatorModal(false);
          setCalculatorInitialCourse(null);
        }}
        initialCourseData={calculatorInitialCourse}
      />

      <ShowCalculation
        isOpen={showCalculationModal}
        onClose={() => {
          setShowCalculationModal(false);
          setSelectedCourseData(null);
        }}
        courseData={selectedCourseData}
      />

      {attendanceData.length > 0 && (
        <button
          className="export-icon-btn"
          onClick={exportAsImage}
          disabled={exporting}
          title="Share Attendance"
        >
          {exporting ? (
            <span style={{ fontSize: '20px' }}>⏳</span>
          ) : (
            <FiShare2 size={24} />
          )}
        </button>
      )}

      <button
        className="calculator-icon-btn"
        onClick={() => {
          setCalculatorInitialCourse(null);
          setShowCalculatorModal(true);
        }}
        title="Open Calculator"
        style={{ bottom: attendanceData.length > 0 ? '90px' : '20px' }}
      >
        🧮
      </button>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />

      
      {showRegisterModal && selectedRegisterData && (
        <div className="modal-overlay" onClick={closeRegisterModal}>
          <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Details</h2>
              <button className="close-btn" onClick={closeRegisterModal}>×</button>
            </div>
            
            <div className="register-content">
              
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

      
      {showTargetModal && (
        <div className="modal-overlay" onClick={() => setShowTargetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
            <div className="modal-header">
              <h2>Edit Safe Percentage</h2>
              <button className="close-btn" onClick={() => setShowTargetModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <label htmlFor="targetPercent" style={{ display: "block", marginBottom: "6px" }}>Target Percentage (0-100)</label>
              <input
                id="targetPercent"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
              {targetError && (
                <div style={{ color: "#dc3545", fontSize: "14px", marginTop: "8px" }}>{targetError}</div>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button className="secondary" onClick={() => setShowTargetModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button
                  className="primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const num = parseFloat((targetInput || "").trim());
                    if (!Number.isFinite(num) || num < 0 || num > 100) {
                      setTargetError("Enter a number between 0 and 100.");
                      return;
                    }
                    saveTargetPercentage(Math.round(num * 100) / 100);
                    setShowTargetModal(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}