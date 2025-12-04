import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG, getHandoutsFormData } from '../config/api';
import { getCredentials } from '../utils/storage';
import Header from '../components/Header';

const Handouts = () => {
  const navigate = useNavigate();
  const [handouts, setHandouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [groupedByCourse, setGroupedByCourse] = useState({});

  useEffect(() => {
    loadHandoutsFromStorage();
  }, []);

  const loadHandoutsFromStorage = () => {
    try {
      const stored = localStorage.getItem('handouts');
      if (stored) {
        const parsedHandouts = JSON.parse(stored);
        setHandouts(parsedHandouts);
        groupHandoutsByCourse(parsedHandouts);
      }
    } catch (err) {
      console.error('Error loading handouts:', err);
    }
  };

  const groupHandoutsByCourse = (handoutData) => {
    const grouped = {};
    handoutData.forEach(item => {
      const courseCode = item.course_code || item.courseCode || 'Unknown';
      if (!grouped[courseCode]) {
        grouped[courseCode] = {
          courseName: item.course_name || item.courseName || 'Unknown Course',
          syllabus: item.syllabus || '',
          coordinator: item.coordinator || '',
          credits: item.credits || '0'
        };
      }
    });
    setGroupedByCourse(grouped);
  };

  const handleReSync = async () => {
    const creds = getCredentials();
    if (!creds || !creds.username || !creds.password) {
      setError('No saved credentials found. Please login first.');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(API_CONFIG.CAPTCHA_URL, {
        responseType: 'blob'
      });
      
      const sessionIdFromHeader = response.headers['x-session-id'] || 
                                 response.headers['X-Session-ID'] || 
                                 response.headers['X-SESSION-ID'];
      
      if (sessionIdFromHeader) {
        setSessionId(sessionIdFromHeader);
      } else {
        const fallbackSessionId = `session_${Date.now()}`;
        setSessionId(fallbackSessionId);
      }
      
      const imageUrl = URL.createObjectURL(response.data);
      setCaptchaUrl(imageUrl);
      setShowCaptchaModal(true);
      setError(null);
    } catch (err) {
      console.error('Error loading CAPTCHA:', err);
      setError('Failed to load CAPTCHA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaSubmit = async () => {
    if (!captchaInput || !captchaInput.trim()) {
      setError('Please enter CAPTCHA');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const creds = getCredentials();
      const semester = localStorage.getItem('semester') || 'odd';
      const academicYear = localStorage.getItem('academicYear') || '2024-25';

      const formData = getHandoutsFormData(
        creds.username,
        creds.password,
        captchaInput.trim(),
        semester,
        academicYear,
        sessionId
      );

      const response = await axios.post(API_CONFIG.HANDOUTS_URL, formData);

      if (response.data && response.data.success && response.data.handouts) {
        localStorage.setItem('handouts', JSON.stringify(response.data.handouts));
        setHandouts(response.data.handouts);
        groupHandoutsByCourse(response.data.handouts);
        setShowCaptchaModal(false);
        setCaptchaInput('');
      } else {
        setError(response.data?.message || 'No handout data received from server');
      }
    } catch (err) {
      console.error('Error fetching handouts:', err);
      setError(err.response?.data?.message || 'Failed to fetch handout data');
    } finally {
      setLoading(false);
    }
  };

  const parseUnits = (syllabus) => {
    if (!syllabus) return [];
    const units = syllabus.split(/Unit \d+:/).filter(Boolean);
    return units.map((unit, index) => ({
      number: index + 1,
      content: unit.trim()
    }));
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="container">
      <Header />

      {/* Top Bar - Same as Attendance */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        gap: '10px'
      }}>
        <button onClick={handleLogout} className="secondary">
          Logout
        </button>
        <button 
          onClick={handleReSync} 
          className="primary"
          disabled={loading}
          style={{ minWidth: '100px' }}
        >
          {loading ? 'Loading...' : 'ReSync'}
        </button>
      </div>

      {/* Back to Home Button */}
      <button 
        onClick={() => navigate('/home')} 
        className="secondary full-width-mobile"
        style={{ marginBottom: '20px', width: '100%' }}
      >
        Back to Home
      </button>

      {/* Main Card */}
      <div className="card">
        <h2 style={{ margin: 0, marginBottom: '20px' }}>📚 Course Handouts</h2>

        {error && (
          <div style={{ 
            background: '#fee2e2', 
            border: '1px solid #fca5a5',
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            color: '#991b1b' 
          }}>
            ⚠️ {error}
          </div>
        )}

        {Object.keys(groupedByCourse).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
              Click "ReSync" to fetch your handouts and wait min 5 seconds because it also fetches register
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(groupedByCourse).map(([courseCode, data]) => (
              <div 
                key={courseCode}
                style={{ 
                  marginBottom: '30px',
                  paddingBottom: '20px',
                  borderBottom: '1px solid var(--border-color)'
                }}
              >
                <div style={{ 
                  marginBottom: '15px', 
                  borderBottom: '2px solid var(--primary-color)', 
                  paddingBottom: '10px' 
                }}>
                  <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>
                    {data.courseName}
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginTop: '8px', 
                    flexWrap: 'wrap', 
                    gap: '10px' 
                  }}>
                    <span style={{ 
                      background: 'var(--primary-color)', 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '6px', 
                      fontSize: '0.9em',
                      fontWeight: '500'
                    }}>
                      {courseCode}
                    </span>
                    {data.credits && (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Credits: {data.credits}
                      </span>
                    )}
                  </div>
                  {data.coordinator && (
                    <p style={{ 
                      margin: '8px 0 0 0', 
                      color: 'var(--text-secondary)', 
                      fontSize: '0.9em' 
                    }}>
                      Coordinator: {data.coordinator}
                    </p>
                  )}
                </div>
                
                <div>
                  <h4 style={{ 
                    color: 'var(--text-primary)', 
                    marginBottom: '15px',
                    fontSize: '1em'
                  }}>
                    📖 Syllabus
                  </h4>
                  {parseUnits(data.syllabus).map((unit) => (
                    <div 
                      key={unit.number} 
                      style={{ 
                        marginBottom: '15px', 
                        padding: '15px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '8px', 
                        borderLeft: '4px solid var(--primary-color)' 
                      }}
                    >
                      <h5 style={{ 
                        color: 'var(--primary-color)', 
                        marginBottom: '10px',
                        fontSize: '0.95em'
                      }}>
                        Unit {unit.number}
                      </h5>
                      <p style={{ 
                        lineHeight: '1.6', 
                        color: 'var(--text-primary)', 
                        margin: 0,
                        fontSize: '0.9em'
                      }}>
                        {unit.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CAPTCHA Modal */}
      {showCaptchaModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(5px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', margin: '20px' }}>
            <h3 style={{ marginTop: 0 }}>ReSync Handouts</h3>
            <p style={{ marginBottom: '20px' }}>Enter the CAPTCHA:</p>
            
            <div style={{ marginBottom: '20px' }}>
              <img 
                src={captchaUrl} 
                alt="CAPTCHA" 
                style={{ 
                  width: '100%', 
                  borderRadius: '8px', 
                  marginBottom: '10px',
                  border: '1px solid var(--border-color)'
                }} 
              />
              <button 
                type="button" 
                onClick={handleReSync} 
                className="secondary"
                style={{ width: '100%', padding: '8px' }}
              >
                🔄 Reload CAPTCHA
              </button>
            </div>
            
            <input
              type="text"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="Type CAPTCHA"
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '20px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-color)' 
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleCaptchaSubmit()}
              autoFocus
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => { 
                  setShowCaptchaModal(false); 
                  setCaptchaInput(''); 
                }} 
                className="secondary"
                style={{ flex: 1, padding: '10px' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCaptchaSubmit} 
                disabled={loading} 
                className="primary"
                style={{ flex: 1, padding: '10px' }}
              >
                {loading ? 'Loading...' : 'ReSync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Handouts;
