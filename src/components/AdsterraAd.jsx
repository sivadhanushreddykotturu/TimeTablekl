import React from 'react';

const AdsterraAd = () => {
  return (
    <div className="ad-wrapper">
      <div className="ad-placeholder">
        <span>This space is for ads</span>
      </div>
      <iframe
        src="/ad.html"
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
