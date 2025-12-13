/**
 * Component with design system violations
 * Used for testing detection rules
 */
import React from 'react';

// Violation: hardcoded colors
export function HeroSection() {
  return (
    <div style={{ backgroundColor: '#1e90ff', padding: '24px' }}>
      <h1 style={{ color: '#ffffff', fontSize: '32px', marginBottom: '16px' }}>
        Welcome to Our Site
      </h1>

      {/* Violation: missing alt text */}
      <img src="/hero-image.png" />

      {/* Violation: hardcoded color in Tailwind */}
      <button className="bg-[#ff6b6b] text-[#fff] p-[16px]">
        Click Me
      </button>

      {/* Violation: missing form label */}
      <input type="email" placeholder="Enter your email" />

      {/* Violation: raw spacing */}
      <p style={{ color: '#757575', marginTop: '8px' }}>
        Sign up for updates
      </p>
    </div>
  );
}

// Violation: inline styles
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

// Component with RGB colors
export function RgbExample() {
  return (
    <div style={{ backgroundColor: 'rgb(255, 0, 0)' }}>
      <span style={{ color: 'rgba(0, 128, 0, 0.5)' }}>RGB Colors</span>
    </div>
  );
}

// Component with HSL colors
export function HslExample() {
  return (
    <div style={{ backgroundColor: 'hsl(240, 100%, 50%)' }}>
      <span style={{ color: 'hsla(120, 100%, 25%, 0.8)' }}>HSL Colors</span>
    </div>
  );
}
