// iOS Debugging Utilities

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const getIOSInfo = () => {
  if (!isIOS()) return null;
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    online: navigator.onLine,
    connectionType: navigator.connection ? navigator.connection.effectiveType : 'Unknown',
    connectionDownlink: navigator.connection ? navigator.connection.downlink : 'Unknown',
    connectionRtt: navigator.connection ? navigator.connection.rtt : 'Unknown',
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    localStorage: typeof(Storage) !== "undefined",
    sessionStorage: typeof(Storage) !== "undefined",
    webdriver: navigator.webdriver,
    vendor: navigator.vendor,
  };
};

export const logIOSInfo = () => {
  if (!isIOS()) return;
  
  const info = getIOSInfo();
  console.log('=== iOS Device Information ===');
  console.log(info);
  console.log('=============================');
};

export const testNetworkConnectivity = async (url) => {
  if (!isIOS()) return { success: true, message: 'Not iOS device' };
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    const endTime = Date.now();
    
    return {
      success: true,
      responseTime: endTime - startTime,
      message: 'Network connectivity test successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Network connectivity test failed'
    };
  }
};

export const testFormDataSupport = () => {
  if (!isIOS()) return { supported: true, message: 'Not iOS device' };
  
  try {
    const form = new FormData();
    form.append('test', 'value');
    
    // Test if we can iterate over FormData
    let canIterate = false;
    for (let [key, value] of form.entries()) {
      canIterate = true;
      break;
    }
    
    return {
      supported: canIterate,
      message: canIterate ? 'FormData is supported' : 'FormData iteration not supported'
    };
  } catch (error) {
    return {
      supported: false,
      error: error.message,
      message: 'FormData not supported'
    };
  }
}; 