/**
 * Google Analytics Event Tracking Utility
 * 
 * This helper makes it easy to track custom events throughout your app.
 * 
 * Usage examples:
 * 
 * // Track feedback submission
 * trackEvent('feedback_submitted', {
 *   feedback_type: 'bug_report',
 *   has_contact: true
 * });
 * 
 * // Track attendance view
 * trackEvent('attendance_viewed', {
 *   course_code: '24AD2103',
 *   attendance_percentage: '96%'
 * });
 * 
 * // Track timetable sync
 * trackEvent('timetable_synced', {
 *   sync_method: 'captcha'
 * });
 */

/**
 * Track a custom event in Google Analytics
 * 
 * @param {string} eventName - The name of the event (e.g., 'feedback_submitted', 'button_clicked')
 * @param {object} eventParams - Additional parameters to send with the event (optional)
 * 
 * @example
 * trackEvent('feedback_submitted', { feedback_type: 'bug_report' });
 */
export const trackEvent = (eventName, eventParams = {}) => {
  // Only track if Google Analytics is loaded and measurement ID exists
  if (typeof window.gtag === 'undefined') {
    // Silent fail - don't break the app if GA isn't loaded
    return;
  }

  // Send the custom event to Google Analytics
  window.gtag('event', eventName, {
    ...eventParams,
    // You can add common parameters here that apply to all events
    // timestamp: new Date().toISOString(),
  });
};

/**
 * Track a conversion or important user action
 * Useful for tracking key milestones (e.g., first login, first attendance check)
 * 
 * @param {string} conversionName - Name of the conversion
 * @param {object} params - Additional parameters
 */
export const trackConversion = (conversionName, params = {}) => {
  trackEvent('conversion', {
    conversion_name: conversionName,
    ...params,
  });
};

/**
 * Track errors for analytics
 * 
 * @param {string} errorMessage - The error message
 * @param {string} errorLocation - Where the error occurred (component/page name)
 */
export const trackError = (errorMessage, errorLocation) => {
  trackEvent('error_occurred', {
    error_message: errorMessage,
    error_location: errorLocation,
  });
};

