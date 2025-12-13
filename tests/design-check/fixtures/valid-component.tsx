/**
 * Valid component - no design system violations
 * Uses proper tokens and accessibility patterns
 */
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      className="bg-primary text-white px-4 py-2 rounded"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg shadow">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      {children}
    </div>
  );
}

export function Form() {
  return (
    <form>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" className="border p-2 rounded" />

      <label htmlFor="name">Name</label>
      <input id="name" type="text" className="border p-2 rounded" />

      <img src="/logo.png" alt="Company Logo" />
    </form>
  );
}
