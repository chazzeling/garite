import React from "react";
import ReactDOM from "react-dom/client";
import { ChatWindow } from "../ui/chat/ChatWindow";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChatWindow />
  </React.StrictMode>,
);
