import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@polydial/shared";
import "../../../packages/shared/src/styles.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AppProviders><App /></AppProviders></React.StrictMode>,
);
