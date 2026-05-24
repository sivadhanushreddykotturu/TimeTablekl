import React from "react";
import { useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();

  // Don't show footer on login page
  if (location.pathname === "/") return null;
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="social-links">
          <a 
            href="https://www.linkedin.com/in/kotturu-siva-dhanush-646b51322" 
            className="social-link linkedin"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
          >
            <ion-icon name="logo-linkedin"></ion-icon>
          </a>
          <a 
            href="https://github.com/sivadhanushreddykotturu" 
            className="social-link github"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
          >
            <ion-icon name="logo-github"></ion-icon>
          </a>
        </div>
        <div className="footer-text">
          <p>Fully vibecoded</p>
        </div>
      </div>
    </footer>
  );
} 