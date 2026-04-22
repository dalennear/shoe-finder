import React, {
    useMemo,
    useState,
    useEffect,
    Suspense,
} from "react";
import { Canvas } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Leva } from "leva";
// --- REAL DATA IMPORT ---
import shoes from "../../../backend/shoes.json";
import MiniMap from "../MiniMap";
import { DEFAULT_CONFIG, CONFIG } from "./gridConfig";
import { rigState, calculateGridDimensions, EMPTY_COLORS, matchesFilter } from "./gridState";
import { useGridConfig } from "./useGridConfig";
import { Rig } from "./Rig";
import { GridCanvas } from "./GridCanvas";
import { UnifiedControlBar } from "../GridUI";
import Header from "../Header";
import { TopologyBackground } from "../TopologyBackground";
import { VoiceSearch } from "../VoiceSearch";
import "../HoloCardMaterial"; // Registers <holoCardMaterial /> with R3F

// --- PRELOAD ALL TEXTURES ---
// This ensures all shoe images are cached before switching collections
shoes.forEach((shoe) => {
    useTexture.preload(shoe.image_url);
});

// --- MAIN EXPORT ---
export default function ShoeGrid() {
    const [zoomTarget, setZoomTarget] = useState(null);
    const [initialZoom] = useState(DEFAULT_CONFIG.zoomOut);
    const [currentZoom, setCurrentZoom] = useState(
        rigState.zoom
    );
    const controls = useGridConfig();
    // Track zoom state for UI components
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentZoom(rigState.zoom);
        }, 50); // Update every 50ms
        return () => clearInterval(interval);
    }, []);
    // Track active selection state
    const [hasActiveSelection, setHasActiveSelection] =
        useState(false);
    useEffect(() => {
        const interval = setInterval(() => {
            setHasActiveSelection(rigState.activeId !== null);
        }, 16); // Update every frame (60fps) for smoother updates
        return () => clearInterval(interval);
    }, []);
    const isZoomedIn = currentZoom <= CONFIG.zoomIn + 0.5;

    // Responsive zoom for mobile viewports
    useEffect(() => {
        const updateResponsiveZoom = () => {
            const width = window.innerWidth;
            let newZoomOut;
            if (width < 480) {
                newZoomOut = 48; // Phone
            } else if (width < 768) {
                newZoomOut = 38; // Tablet portrait
            } else {
                newZoomOut = DEFAULT_CONFIG.zoomOut; // Desktop default (31)
            }
            CONFIG.zoomOut = newZoomOut;
            // Only update current zoom if we're in zoomed-out state
            if (rigState.zoom > CONFIG.zoomIn + 2) {
                rigState.zoom = newZoomOut;
                setCurrentZoom(newZoomOut);
            }
        };
        updateResponsiveZoom();
        window.addEventListener("resize", updateResponsiveZoom);
        return () => window.removeEventListener("resize", updateResponsiveZoom);
    }, []);

    // Filter state for Nike collection
    const [nikeFilter, setNikeFilter] = useState("all"); // 'all' | 'jordan' | 'dunk'
    const [colorFilter, setColorFilter] = useState(EMPTY_COLORS); // [] = all, ['blue','green'] = blue OR green
    
    // Voice search state
    const [voiceFilteredShoes, setVoiceFilteredShoes] = useState(null);
    const [voiceResponse, setVoiceResponse] = useState("");

    // Collections - Nike (all, unfiltered), New Balance, Under $150
    const collectionsData = useMemo(() => {
        // All Nike shoes (filtering happens in GridCanvas)
        const nike = shoes.filter((s) => s.brand === "Nike");
        // New Balance shoes - take half and double to make 30+ items
        const newBalanceFull = shoes.filter(
            (s) => s.brand === "New Balance"
        );
        const newBalanceHalf = newBalanceFull.slice(0, Math.ceil(newBalanceFull.length / 2));
        const newBalance = [
            ...newBalanceHalf,
            ...newBalanceHalf.map((s, i) => ({
                ...s,
                product_url: `${s.product_url}-dup-${i}`,
            })),
        ];
        // Under $150 (all brands)
        const budget = shoes.filter((s) => {
            const price = parseInt(
                s.price?.replace(/[$,]/g, "") || "999"
            );
            return price < 150;
        });
        return [nike, newBalance, budget];
    }, []);
    // --- Grid Stack State ---
    // Instead of one list of items, we keep a stack of "Rendered Layers".
    // This allows us to have one layer exiting and one layer entering simultaneously.
    // Initial grid uses Nike collection (index 0)
    const [gridLayers, setGridLayers] = useState(() => [
        {
            id: "init",
            items: shoes.filter((s) => s.brand === "Nike"),
            mode: "enter", // 'enter' | 'exit'
            startTime: 0,
        },
    ]);
    const [activeCollectionIdx, setActiveCollectionIdx] =
        useState(0);
    const handleCollectionSwitch = (index) => {
        if (index === activeCollectionIdx && activeCollectionIdx !== -1) return;
        const now = Date.now();
        setGridLayers((prev) => {
            // 1. Mark existing 'enter' layers as 'exit'
            const exitingLayers = prev.map((layer) =>
                layer.mode === "enter"
                    ? { ...layer, mode: "exit", startTime: now }
                    : layer
            );
            // 2. Add new 'enter' layer
            const newLayer = {
                id: `grid-${index}-${now}`, // Unique ID for key
                items: collectionsData[index],
                mode: "enter",
                startTime: now,
            };
            return [...exitingLayers, newLayer];
        });
        setActiveCollectionIdx(index);
        // Clear Nike filters when leaving Nike collection
        setNikeFilter("all");
        setColorFilter(EMPTY_COLORS);
        // Clear voice search when manually switching collections
        setVoiceFilteredShoes(null);
        setVoiceResponse("");
        rigState.target.set(0, 2, 0);
        rigState.activeId = null;
        // 3. Cleanup old layers after transition time
        setTimeout(() => {
            setGridLayers((prev) =>
                prev.filter((layer) => layer.mode === "enter")
            );
        }, CONFIG.cleanupTimeout);
    };
    // Handle filter change (for Nike collection) - just update filter state
    // The grid will animate items in place
    const handleFilterChange = (filter) => {
        if (filter === nikeFilter) return;
        setNikeFilter(filter);
        rigState.activeId = null;
    };

    // Handle color filter change (accepts array of colors)
    const handleColorFilterChange = (colors) => {
        setColorFilter(colors.length > 0 ? colors : EMPTY_COLORS);
        rigState.activeId = null;
    };

    // Handle voice search results
    const handleVoiceFilters = (filteredShoes, response) => {
        if (filteredShoes.length === 0) {
            setVoiceResponse("No shoes found matching your criteria. Try a different search!");
            return;
        }
        
        setVoiceFilteredShoes(filteredShoes);
        setVoiceResponse(response);
        
        // Create a new layer with voice search results
        const now = Date.now();
        setGridLayers((prev) => {
            const exitingLayers = prev.map((layer) =>
                layer.mode === "enter"
                    ? { ...layer, mode: "exit", startTime: now }
                    : layer
            );
            const newLayer = {
                id: `voice-${now}`,
                items: filteredShoes,
                mode: "enter",
                startTime: now,
            };
            return [...exitingLayers, newLayer];
        });
        
        // Reset other filters
        setNikeFilter("all");
        setColorFilter(EMPTY_COLORS);
        setActiveCollectionIdx(-1); // -1 indicates voice search mode
        rigState.target.set(0, 2, 0);
        rigState.activeId = null;
        
        // Cleanup old layers
        setTimeout(() => {
            setGridLayers((prev) =>
                prev.filter((layer) => layer.mode === "enter")
            );
        }, CONFIG.cleanupTimeout);
    };
    
    // Clear voice search and return to normal browsing
    const clearVoiceSearch = () => {
        setVoiceFilteredShoes(null);
        setVoiceResponse("");
        handleCollectionSwitch(0); // Return to Nike collection
    };

    useEffect(() => {
        if (zoomTarget === "OUT") {
            rigState.zoom = CONFIG.zoomOut;
            setCurrentZoom(CONFIG.zoomOut);
            rigState.target.set(0, 2, 0);
        } else if (typeof zoomTarget === "number") {
            rigState.zoom = zoomTarget;
            setCurrentZoom(zoomTarget);
        }
        setZoomTarget(null);
    }, [zoomTarget]);
    // Determine active grid dimensions for the Rig
    // We use the dimensions of the LAST layer (the incoming one)
    const activeLayer = gridLayers[gridLayers.length - 1];
    // Calculate filtered item count for Nike collection
    const filteredItemCount = useMemo(() => {
        if (activeCollectionIdx !== 0)
            return activeLayer.items.length;
        return activeLayer.items.filter((item) =>
            matchesFilter(item, nikeFilter, colorFilter)
        ).length;
    }, [activeLayer.items, activeCollectionIdx, nikeFilter, colorFilter]);

    const activeDims = calculateGridDimensions(
        filteredItemCount
    );

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                backgroundColor: "#f0f0f0",
                position: "relative",
                overflow: "hidden",
                touchAction: "none", // Prevent mobile browser touch gestures
            }}
        >
            <Leva collapsed={true} hidden={false} />
            <Header />
            <VoiceSearch
                onFiltersApplied={handleVoiceFilters}
                shoes={shoes}
            />
            <Canvas
                camera={{ position: [0, 0, initialZoom], fov: 45 }}
                dpr={[1, 2]}
                gl={{
                    antialias: true,
                    toneMapping: THREE.NoToneMapping,
                }}
            >
                {/* Rig is now shared, based on the dimensions of the active grid */}
                <Rig
                    gridW={activeDims.width}
                    gridH={activeDims.height}
                />
                {/* Tech Background - geometric lines and crosshairs for CAD/architectural feel */}
                <TopologyBackground
                    isZoomedIn={isZoomedIn}
                    color={CONFIG.bgColor}
                    opacity={CONFIG.bgOpacity}
                    speed={CONFIG.bgSpeed}
                    scale={CONFIG.bgScale}
                    lineThickness={CONFIG.bgLineThickness}
                />
                <fog
                    attach="fog"
                    args={[
                        "#f0f0f0",
                        controls?.fogNear ?? DEFAULT_CONFIG.fogNear,
                        controls?.fogFar ?? DEFAULT_CONFIG.fogFar,
                    ]}
                />
                {/* Suspense boundary for texture loading */}
                <Suspense fallback={null}>
                    {/* Render all active layers (Entering + Exiting) */}
                    {gridLayers.map((layer, layerIdx) => (
                        <GridCanvas
                            key={layer.id} // Essential for React to treat them as different trees
                            items={layer.items}
                            gridVisible={layer.mode === "enter"}
                            transitionStartTime={layer.startTime}
                            interactive={layer.mode === "enter"} // Only entering grid is clickable
                            filter={
                                activeCollectionIdx === 0
                                    ? nikeFilter
                                    : "all"
                            }
                            colorFilter={
                                activeCollectionIdx === 0
                                    ? colorFilter
                                    : EMPTY_COLORS
                            }
                        />
                    ))}
                </Suspense>
            </Canvas>
            <MiniMap
                gridDims={activeDims}
                rigState={rigState}
                config={CONFIG}
                totalItems={filteredItemCount}
                isZoomedIn={isZoomedIn}
            />
            <UnifiedControlBar
                currentCollection={activeCollectionIdx}
                onSwitch={handleCollectionSwitch}
                setZoomTrigger={setZoomTarget}
                isZoomedIn={isZoomedIn}
                hasActiveSelection={hasActiveSelection}
                nikeFilter={nikeFilter}
                onFilterChange={handleFilterChange}
            />
        </div>
    );
}
