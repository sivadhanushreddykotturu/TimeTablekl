import React, { useState, useEffect, useRef } from 'react';
import Toast from './Toast';

const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('Bug/Issue');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOffline) {
      setToast({ show: true, message: '❌ You are offline. Please connect to the internet to send feedback.' });
      return;
    }
    if (!description.trim()) {
      alert('Description cannot be empty.');
      return;
    }

    setIsSubmitting(true);

    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdaATurLdf2plEOpdDZNVAm4U8Ws7WLv4uu9LwmRBQM5LAUzg/formResponse';
    const formData = new FormData();
    formData.append('entry.1620430637', feedbackType);
    formData.append('entry.1057660527', description);
    formData.append('entry.1959359017', contact);

    try {
      await fetch(formUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });

      setIsOpen(false);
      setDescription('');
      setContact('');
      setFeedbackType('Bug/Issue');
      setToast({ show: true, message: '✅ Feedback sent!' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setIsOpen(true)}
        title="Give Feedback"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" ref={modalRef} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h2>Submit Feedback</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="feedbackType">What is this about?</label>
                  <select
                    id="feedbackType"
                    className="form-select"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                  >
                    <option>Bug/Issue</option>
                    <option>Suggestion/Idea</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="description">Describe the issue or idea</label>
                  <textarea
                    id="description"
                    rows="5"
                    placeholder="Your feedback..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      transition: 'all 0.3s ease',
                      resize: 'vertical',
                    }}
                  ></textarea>
                </div>
                <div className="form-group">
                <label htmlFor="contact">Contact (email or phone, optional)</label>
<input
  type="text"
  id="contact"
  required
  placeholder="email or phone"
  value={contact}
  onChange={(e) => setContact(e.target.value)}
/>
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={() => setIsOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type="success"
        isVisible={toast.show}
        onClose={() => setToast({ show: false, message: '' })}
      />
    </>
  );
};

export default FeedbackButton;
