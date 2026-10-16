import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

document.body.classList.add("overlay"); // 메인 창은 투명 창

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
