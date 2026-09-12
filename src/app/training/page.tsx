"use client";

import { Suspense } from "react";
import { TrainingClient } from "@/components/training/TrainingClient";

export default function TrainingPage() {
  return (
    <Suspense
      fallback={
        <div className="stage">
          <div className="app">
            <div className="screen">
              <p className="lede">Loading…</p>
            </div>
          </div>
        </div>
      }
    >
      <TrainingClient />
    </Suspense>
  );
}
