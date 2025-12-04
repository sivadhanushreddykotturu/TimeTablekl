// Storage utilities for credentials
export const getCredentials = () => {
  try {
    const credentials = localStorage.getItem('credentials');
    return credentials ? JSON.parse(credentials) : null;
  } catch (error) {
    console.error('Error reading credentials:', error);
    return null;
  }
};

export const saveCredentials = (username, password) => {
  try {
    const credentials = { username, password };
    localStorage.setItem('credentials', JSON.stringify(credentials));
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
};

export const clearCredentials = () => {
  try {
    localStorage.removeItem('credentials');
    return true;
  } catch (error) {
    console.error('Error clearing credentials:', error);
    return false;
  }
};
