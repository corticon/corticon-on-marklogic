// ui/src/components/AccordionItem.jsx
import React, { useState } from 'react';

export default function AccordionItem({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="accordion-item">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>{title}</h4>
        <span className={`carrot ${isOpen ? 'open' : ''}`}>›</span>
      </div>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}
