import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { installStorageShim } from "./lib/storage-shim.js";
import { installSupabaseStorage } from "./lib/supabase-shim.js";
import "./index.css";

import App from "./App.jsx";
import Preview from "./preview/Preview.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  installSupabaseStorage({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
} else {
  installStorageShim();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
