import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface OnboardingState {
  dashboard: boolean;
  articles: boolean;
  analytics: boolean;
  strategy: boolean;
  keywords: boolean;
  content: boolean;
  calendar: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  dashboard: false,
  articles: false,
  analytics: false,
  strategy: false,
  keywords: false,
  content: false,
  calendar: false,
};

const LOCAL_STORAGE_KEY = "blogai_onboarding_progress";

export function useOnboarding(page: keyof OnboardingState) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingState>(DEFAULT_STATE);

  // Load onboarding state from localStorage and sync with database
  useEffect(() => {
    const loadProgress = async () => {
      // First, check localStorage for quick initial load
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localProgress: OnboardingState = DEFAULT_STATE;

      if (stored) {
        try {
          localProgress = { ...DEFAULT_STATE, ...JSON.parse(stored) };
          setProgress(localProgress);
        } catch (e) {
          console.error("Error parsing onboarding progress:", e);
        }
      }

      // Then sync with database if user is logged in
      if (user) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("onboarding_progress")
            .eq("user_id", user.id)
            .maybeSingle();

          if (data?.onboarding_progress) {
            const dbProgress = data.onboarding_progress as unknown as OnboardingState;
            const mergedProgress = { ...DEFAULT_STATE, ...dbProgress };
            setProgress(mergedProgress);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedProgress));
            localProgress = mergedProgress;
          }
        } catch (error) {
          console.error("Error loading onboarding progress:", error);
        }
      }

      // Only show onboarding automatically if page has never been completed
      // This ensures tour only appears on FIRST access, never again automatically
      const pageCompleted = localProgress[page];
      setShowOnboarding(!pageCompleted);
      setLoading(false);
    };

    loadProgress();
  }, [user, page]);

  // Mark page onboarding as complete
  const completeOnboarding = useCallback(async () => {
    const newProgress = { ...progress, [page]: true };
    setProgress(newProgress);
    setShowOnboarding(false);
    
    // Save to localStorage immediately
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProgress));

    // Sync with database if user is logged in
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ onboarding_progress: newProgress as unknown as null })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error saving onboarding progress:", error);
      }
    }
  }, [progress, page, user]);

  // Reset onboarding for a specific page
  const resetOnboarding = useCallback(async (targetPage?: keyof OnboardingState) => {
    const pageToReset = targetPage || page;
    const newProgress = { ...progress, [pageToReset]: false };
    setProgress(newProgress);
    
    if (pageToReset === page) {
      setShowOnboarding(true);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProgress));

    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ onboarding_progress: newProgress as unknown as null })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error resetting onboarding:", error);
      }
    }
  }, [progress, page, user]);

  // Reset all onboarding
  const resetAllOnboarding = useCallback(async () => {
    setProgress(DEFAULT_STATE);
    setShowOnboarding(true);
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_STATE));

    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ onboarding_progress: DEFAULT_STATE as unknown as null })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error resetting all onboarding:", error);
      }
    }
  }, [user]);

  // Skip onboarding AND persist as completed (won't reopen automatically)
  const skipOnboarding = useCallback(async () => {
    setShowOnboarding(false);
    
    // Mark as completed so it doesn't reopen automatically
    const newProgress = { ...progress, [page]: true };
    setProgress(newProgress);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProgress));

    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ onboarding_progress: newProgress as unknown as null })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error saving onboarding skip:", error);
      }
    }
  }, [progress, page, user]);

  // Manually start tour (for "Tour" button) - opens from step 1
  const startTour = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  return {
    showOnboarding,
    loading,
    progress,
    completeOnboarding,
    resetOnboarding,
    resetAllOnboarding,
    skipOnboarding,
    startTour,
  };
}
