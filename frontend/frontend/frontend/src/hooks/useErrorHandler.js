import { useCallback, useState } from "react";
import { getErrorMessage, getErrorDebug } from "../utils/errors";

export function useErrorHandler() {
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");

  const handleError = useCallback((err, fallback = "An error occurred") => {
    setError(getErrorMessage(err, fallback));
    setDebug(getErrorDebug(err));
  }, []);

  const clearError = useCallback(() => {
    setError("");
    setDebug("");
  }, []);

  return { error, debug, handleError, clearError };
}
