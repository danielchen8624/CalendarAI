import Providers from "./providers";
import React from "react";
import "./globals.css";

import {Navbar} from "../components/NavBar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
