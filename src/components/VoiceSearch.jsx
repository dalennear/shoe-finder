import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Voice search component using Web Speech API

const islandTransition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 1,
};

export function VoiceSearch({ onFiltersApplied, shoes }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setIsSupported(false);
    }
  }, []);

  const applyFilters = useCallback(
    (filters) => {
      let filtered = [...shoes];

      // Filter by brand
      if (filters.brand && filters.brand !== "any") {
        filtered = filtered.filter((shoe) => shoe.brand === filters.brand);
      }

      // Filter by sub-brand (Jordan/Dunk)
      if (filters.subBrand && filters.subBrand !== "any") {
        const subBrandTerm = filters.subBrand.toLowerCase();
        filtered = filtered.filter((shoe) =>
          shoe.title.toLowerCase().includes(subBrandTerm)
        );
      }

      // Filter by max price
      if (filters.maxPrice) {
        filtered = filtered.filter((shoe) => {
          if (!shoe.price) return false;
          const priceNum = parseInt(shoe.price.replace(/[$,]/g, ""), 10);
          return priceNum <= filters.maxPrice;
        });
      }

      // Filter by color
      if (filters.color) {
        const colorTerm = filters.color.toLowerCase();
        filtered = filtered.filter(
          (shoe) =>
            shoe.primary_color?.toLowerCase().includes(colorTerm) ||
            shoe.title.toLowerCase().includes(colorTerm)
        );
      }

      // Filter by search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filtered = filtered.filter((shoe) =>
          shoe.title.toLowerCase().includes(searchLower)
        );
      }

      onFiltersApplied(filtered, filters.response);
    },
    [shoes, onFiltersApplied]
  );

  const processQuery = useCallback(
    async (query) => {
      setIsProcessing(true);
      setError("");

      try {
        const res = await fetch("/api/voice-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          throw new Error("Failed to process query");
        }

        const data = await res.json();

        if (data.success && data.filters) {
          setResponse(data.filters.response || "Here are your results!");
          applyFilters(data.filters);
        } else {
          setError("Sorry, I couldn't understand that. Please try again.");
        }
      } catch (err) {
        setError("Sorry, I couldn't process that. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [applyFilters]
  );

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Voice search is not supported in this browser.");
      return;
    }

    // Clear previous state
    setTranscript("");
    setResponse("");
    setError("");

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setError("Voice search is not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const text = result[0].transcript;
        setTranscript(text);

        if (result.isFinal) {
          setIsListening(false);
          processQuery(text);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === "no-speech") {
          setError("No speech detected. Please try again.");
        } else if (event.error === "not-allowed") {
          setError("Microphone access denied. Please allow microphone access.");
        } else if (event.error === "aborted") {
          // User stopped - not a real error
          return;
        } else if (event.error === "network") {
          setError("Network error. Please check your connection.");
        } else {
          setError(`Voice error: ${event.error}. Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setError(`Failed to start: ${err.message || "Unknown error"}`);
    }
  }, [isSupported, processQuery]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  if (!isSupported) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "100px",
        left: "0",
        right: "0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 90,
        pointerEvents: "none",
      }}
    >
      {/* Voice Button */}
      <motion.button
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          background: isListening
            ? "linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)"
            : "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          boxShadow: isListening
            ? "0 8px 32px rgba(255, 107, 107, 0.4)"
            : "0 8px 32px rgba(0, 0, 0, 0.1)",
          cursor: isProcessing ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          transition: "all 0.3s ease",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isListening ? "Stop listening" : "Start voice search"}
      >
        {isProcessing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#666"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </motion.div>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isListening ? "#fff" : "#333"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </motion.button>

      {/* Listening/Response Bubble */}
      <AnimatePresence>
        {(isListening || transcript || response || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={islandTransition}
            style={{
              marginTop: "12px",
              padding: "12px 20px",
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              maxWidth: "320px",
              textAlign: "center",
              pointerEvents: "auto",
            }}
          >
            {isListening && !transcript && (
              <motion.div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#ff6b6b",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Listening...
                </motion.span>
              </motion.div>
            )}

            {transcript && (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#333",
                  fontStyle: "italic",
                }}
              >
                &ldquo;{transcript}&rdquo;
              </p>
            )}

            {response && !error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  margin: transcript ? "8px 0 0" : 0,
                  fontSize: "14px",
                  color: "#000",
                  fontWeight: "500",
                }}
              >
                {response}
              </motion.p>
            )}

            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#ff4444",
                  fontWeight: "500",
                }}
              >
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint text */}
      <AnimatePresence>
        {!isListening && !transcript && !response && !error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#666",
              pointerEvents: "none",
            }}
          >
            Try: &ldquo;Show me blue Jordans under $300&rdquo;
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
