import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const islandTransition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 1,
};

export function VoiceSearch({ onFiltersApplied, shoes }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

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
      if (!query.trim()) return;
      
      setIsProcessing(true);
      setError("");
      setResponse("");

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
          setInputValue("");
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

  const handleSubmit = (e) => {
    e.preventDefault();
    processQuery(inputValue);
  };

  const handleExpand = () => {
    setIsExpanded(true);
    setError("");
    setResponse("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setInputValue("");
    setError("");
    setResponse("");
  };

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
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="search-button"
            onClick={handleExpand}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "none",
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open search"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#333"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </motion.button>
        ) : (
          <motion.div
            key="search-expanded"
            initial={{ opacity: 0, scale: 0.9, width: 56 }}
            animate={{ opacity: 1, scale: 1, width: 340 }}
            exit={{ opacity: 0, scale: 0.9, width: 56 }}
            transition={islandTransition}
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderRadius: "28px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
              padding: "8px",
              pointerEvents: "auto",
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0, 0, 0, 0.05)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                aria-label="Close search"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#666"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Blue Jordans under $300..."
                disabled={isProcessing}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: "15px",
                  color: "#000",
                  outline: "none",
                  padding: "8px 0",
                }}
              />

              <button
                type="submit"
                disabled={isProcessing || !inputValue.trim()}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "none",
                  background:
                    inputValue.trim() && !isProcessing
                      ? "#000"
                      : "rgba(0, 0, 0, 0.1)",
                  cursor:
                    inputValue.trim() && !isProcessing ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.2s ease",
                }}
                aria-label="Search"
              >
                {isProcessing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <svg
                      width="18"
                      height="18"
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
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={inputValue.trim() ? "#fff" : "#999"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 7-7 7 7" />
                    <path d="M12 19V5" />
                  </svg>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response/Error Bubble */}
      <AnimatePresence>
        {(response || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={islandTransition}
            style={{
              marginTop: "12px",
              padding: "12px 20px",
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.9) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              maxWidth: "320px",
              textAlign: "center",
              pointerEvents: "auto",
            }}
          >
            {response && !error && (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#000",
                  fontWeight: "500",
                }}
              >
                {response}
              </p>
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
        {!isExpanded && !response && !error && (
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
            Search with natural language
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
