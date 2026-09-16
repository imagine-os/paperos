import React from "react";

export function ReactComponent() {
  return (
    <div
      style={{
        width: "100%",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(128, 128, 128, 0.2)",
        borderTop: "1px solid #ccc",
        borderBottom: "1px solid #ccc",
      }}
    >
      <p style={{ fontStyle: "italic" }}>My React Component</p>
    </div>
  );
}
