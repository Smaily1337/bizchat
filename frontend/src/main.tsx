import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { MaybeClerkProvider } from "./auth/ClerkProvider";
import "./styles/tokens.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MaybeClerkProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MaybeClerkProvider>
  </StrictMode>,
);
