import React from "react";
import ReactDOM from "react-dom/client";
import { ShopWindow } from "../ui/shop/ShopWindow";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ShopWindow />
  </React.StrictMode>,
);
