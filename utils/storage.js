// src/utils/storage.js
export const saveCredentials = (creds) => {
  localStorage.setItem("erp_creds", JSON.stringify(creds));
};

export const getCredentials = () => {
  const raw = localStorage.getItem("erp_creds");
  return raw ? JSON.parse(raw) : null;
};

export const clearCredentials = () => {
  localStorage.removeItem("erp_creds");
};
