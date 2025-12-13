import React from 'react';

// This component has several design system violations

export function HeroSection() {
  return (
    <div style={{ backgroundColor: '#1e90ff', padding: '24px' }}>
      <h1 style={{ color: '#ffffff', fontSize: '32px', marginBottom: '16px' }}>
        Welcome to Our Site
      </h1>

      {/* Missing alt text */}
      <img src="/hero-image.png" />

      {/* Hardcoded colors in Tailwind */}
      <button className="bg-[#ff6b6b] text-[#fff] p-[20px]">
        Click Me
      </button>

      {/* Missing form label */}
      <input type="email" placeholder="Enter your email" />

      <p style={{ color: '#757575', marginTop: '8px' }}>
        Sign up for updates
      </p>
    </div>
  );
}

export function Card() {
  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
      }}
    >
      <img src="/card-icon.png" alt="Card icon" />
      <h2 style={{ color: '#212121' }}>Card Title</h2>
      <label htmlFor="card-input">Name</label>
      <input id="card-input" type="text" />
    </div>
  );
}
