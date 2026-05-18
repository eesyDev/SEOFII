import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  plan: "FREE" | "STARTER" | "PRO";
  reportsUsed: number;
  reportsLimit: number;
}

const initialState: UserState = {
  id: null,
  name: null,
  email: null,
  image: null,
  plan: "FREE",
  reportsUsed: 0,
  reportsLimit: 3,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<Partial<UserState>>) {
      return { ...state, ...action.payload };
    },
    incrementReportsUsed(state) {
      state.reportsUsed += 1;
    },
    clearUser() {
      return initialState;
    },
  },
});

export const { setUser, incrementReportsUsed, clearUser } = userSlice.actions;
export default userSlice.reducer;
