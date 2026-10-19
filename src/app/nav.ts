/** Which step is shown. */
import { create } from 'zustand';
import type { StepId } from './steps';

export const useNav = create<{ step: StepId; go: (s: StepId) => void }>((set) => ({
  step: 'project',
  go: (step) => {
    set({ step });
    window.scrollTo({ top: 0 });
  },
}));
