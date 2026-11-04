import React from "react";

// Enhanced Icon Components
export const DeleteIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 12 22C9.44098 22 8.15402 22 7.19926 21.4159C6.72521 21.1271 6.31729 20.743 6.00058 20.2879C5.35858 19.3671 5.27812 18.0863 5.11963 15.525L4.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.89809 2.28601 9.80498 2.3459 9.71729 2.41317C9.32163 2.7167 9.10062 3.20155 8.6586 4.17126L8.05292 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const EditIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.2454 5.05L15.9954 3.3C16.3954 2.9 16.9954 2.9 17.3954 3.3L20.6954 6.6C21.0954 7 21.0954 7.6 20.6954 8L8.69543 20C8.49543 20.2 8.19543 20.3 7.99543 20.3L3.69543 21L4.39543 16.7C4.39543 16.5 4.49543 16.2 4.69543 16L14.2454 5.05Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2954 7L17.2954 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SearchIcon = () => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// New collapse/expand icon with animation
export const CollapseExpandIcon = ({ isExpanded }: { isExpanded?: boolean }) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease",
      }}
      aria-hidden="true"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const OpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-8 8M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GripIcon = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden="true">
    <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
    <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
    <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
  </svg>
);

export const ChevronIcon = ({ direction }: { direction: "left" | "right" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
    style={{ transform: direction === "right" ? "rotate(180deg)" : undefined }}>
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
