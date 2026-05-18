import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ReportStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface Report {
  id: string;
  url: string;
  status: ReportStatus;
  costUsd: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
}

interface ReportsState {
  items: Report[];
  loading: boolean;
  activeReportId: string | null; // отчёт открытый в данный момент
}

const initialState: ReportsState = {
  items: [],
  loading: false,
  activeReportId: null,
};

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    setReports(state, action: PayloadAction<Report[]>) {
      state.items = action.payload;
    },
    addReport(state, action: PayloadAction<Report>) {
      state.items.unshift(action.payload);
    },
    updateReportStatus(
      state,
      action: PayloadAction<{ id: string; status: ReportStatus }>
    ) {
      const report = state.items.find((r) => r.id === action.payload.id);
      if (report) report.status = action.payload.status;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setActiveReport(state, action: PayloadAction<string | null>) {
      state.activeReportId = action.payload;
    },
  },
});

export const { setReports, addReport, updateReportStatus, setLoading, setActiveReport } =
  reportsSlice.actions;
export default reportsSlice.reducer;
