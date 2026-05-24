import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get register data from navigation state
  const registerData = location.state?.registerData;
  const friendCredentials = location.state?.friendCredentials;

  // Debug: Log the register data to see what we're receiving
  console.log('Register data received:', registerData);

  if (!registerData) {
    return (
      <>
        <Header onRefresh={() => {}} />
        <div className="container">
          <div className="card">
            <p className="text-center">No register data available</p>
            <button onClick={() => navigate("/attendance")} className="btn-primary">
              Back to Attendance
            </button>
          </div>
        </div>
      </>
    );
  }

  const { metadata, daily_attendance } = registerData;

  const formatDate = (dateSlot) => {
    // Extract date from format like "16/07/25 H 7"
    const datePart = dateSlot.split(' H ')[0];
    const [day, month, year] = datePart.split('/');
    const fullYear = '20' + year;
    return `${day}/${month}/${fullYear}`;
  };

  const getTimeSlot = (dateSlot) => {
    // Extract time slot from format like "16/07/25 H 7"
    const timePart = dateSlot.split(' H ')[1];
    return `H${timePart}`;
  };

  const getStatusColor = (status) => {
    return status === 'P' ? '#28a745' : '#dc3545';
  };

  const getStatusBg = (status) => {
    return status === 'P' ? '#d4edda' : '#f8d7da';
  };

  return (
    <>
      <Header onRefresh={() => {}} />
      
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            {friendCredentials ? `${friendCredentials.name}'s Register` : 'Register'}
          </h1>
          <div className="action-buttons">
            <button onClick={() => navigate("/attendance")} className="btn-secondary">
              Back to Attendance
            </button>
          </div>
        </div>

        <div className="register-container">
          {/* Course Header */}
          <div className="register-header">
            <h2 className="course-title">{metadata.Coursedesc}</h2>
            <div className="course-info">
              <span className="course-code">{metadata.Coursecode}</span>
              <span className="course-section">{metadata.Section}</span>
              <span className="course-ltps">{metadata.Ltps}</span>
            </div>
          </div>

          {/* Student Info */}
          <div className="student-info">
            <div className="student-details">
              <span className="student-id">{metadata["Student Uni Id"]}</span>
              <span className="student-name">{metadata["Student Name"]}</span>
            </div>
            <div className="attendance-summary">
              <div className="summary-item">
                <span className="label">Total:</span>
                <span className="value">{metadata["Total Conducted"]}</span>
              </div>
              <div className="summary-item">
                <span className="label">Present:</span>
                <span className="value present">{metadata["Total Attended"]}</span>
              </div>
              <div className="summary-item">
                <span className="label">Absent:</span>
                <span className="value absent">{metadata["Total Absent"]}</span>
              </div>
              <div className="summary-item">
                <span className="label">Percentage:</span>
                <span 
                  className="value percentage" 
                  style={{ color: metadata.Percentage >= '85' ? '#28a745' : metadata.Percentage >= '75' ? '#ffc107' : '#dc3545' }}
                >
                  {metadata.Percentage}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Attendance Grid */}
          <div className="attendance-grid">
            <h3 className="grid-title">Daily Attendance</h3>
            <div className="attendance-entries">
              {daily_attendance.map((entry, index) => (
                <div key={index} className="attendance-entry">
                  <div className="date-info">
                    <span className="date">{formatDate(entry.date_slot)}</span>
                    <span className="time-slot">{getTimeSlot(entry.date_slot)}</span>
                  </div>
                  <div 
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusBg(entry.status),
                      color: getStatusColor(entry.status)
                    }}
                  >
                    {entry.status === 'P' ? 'Present' : 'Absent'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}