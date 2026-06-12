import React from 'react';
import { useLocation } from 'react-router-dom';

const adHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '28e5767c16a07a4ccdc68ae4d088250f',
      'format' : 'iframe',
      'height' : 600,
      'width' : 160,
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://www.highperformanceformat.com/28e5767c16a07a4ccdc68ae4d088250f/invoke.js"></script>
</body>
</html>
`;

const AdsterraAd = () => {
  const location = useLocation();

  return (
    <div className="ad-wrapper">
      <div className="ad-placeholder">
        <span>This space is for ads</span>
      </div>
      <iframe
        key={location.pathname}
        srcDoc={adHTML}
        width="160"
        height="600"
        frameBorder="0"
        scrolling="no"
        title="Adsterra Ad"
        className="ad-iframe"
      ></iframe>
    </div>
  );
};

export default AdsterraAd;
