import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import reportsReducer from "./slices/reportsSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    reports: reportsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
