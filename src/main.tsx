import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML =
    '<div style="padding: 20px; font-family: sans-serif;"><h1>Error: Root element not found</h1></div>';
} else {
  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Failed to render app:", error);
    document.body.innerHTML =
      '<div style="padding: 20px; font-family: sans-serif;"><h1>Failed to load app</h1><p>' +
      (error as Error).message +
      "</p></div>";
  }
}