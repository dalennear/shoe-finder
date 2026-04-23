import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { easing } from "maath";
import { CONFIG } from "./gridConfig";
import { rigState } from "./gridState";

// --- COMPONENT: RIG ---
// Controls the camera. Moved OUT of GridCanvas so it is persistent.
export function Rig({ gridW, gridH }) {
    const { camera, gl } = useThree();
    const prevPos = useRef(new THREE.Vector3());
    const hasSetInitialZoom = useRef(false);
    useEffect(() => {
        if (!hasSetInitialZoom.current && rigState.zoom) {
            camera.position.z = rigState.zoom;
            hasSetInitialZoom.current = true;
        }
    }, [camera]);
    const getBounds = () => {
        const dist = camera.position.z;
        const vFov = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
        const visibleWidth = visibleHeight * camera.aspect;
        const xLimit = Math.max(
            0,
            (gridW - visibleWidth) / 2 + 2
        );
        const yLimit = Math.max(
            0,
            (gridH - visibleHeight) / 2 + 2
        );
        return { x: xLimit, y: yLimit, visibleHeight };
    };

    useEffect(() => {
        const canvas = gl.domElement;
        let isDown = false;
        let startX = 0;
        let startY = 0;
        let initialRigX = 0;
        let initialRigY = 0;
        let maxDragDistance = 0; // Track max distance for click detection
        const onDown = (e) => {
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
            initialRigX = rigState.target.x;
            initialRigY = rigState.target.y;
            maxDragDistance = 0;
            rigState.isDragging = false; // Reset on new gesture
            canvas.style.cursor = "grabbing";
        };
        const onMove = (e) => {
            if (!isDown) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            maxDragDistance = Math.max(maxDragDistance, distance);
            // Use higher threshold for mobile (touch is less precise)
            const threshold =
                "ontouchstart" in window
                    ? 15
                    : CONFIG.clickThreshold;
            if (maxDragDistance > threshold) {
                rigState.isDragging = true;
                rigState.activeId = null;
            }
            const { x: bx, y: by, visibleHeight } = getBounds();
            const sensitivity =
                (visibleHeight / window.innerHeight) *
                CONFIG.dragSpeed;
            let rawTargetX = initialRigX + dx * sensitivity;
            let rawTargetY = initialRigY - dy * sensitivity;
            // Apply resistance when dragging past bounds
            if (rawTargetX > bx)
                rawTargetX =
                    bx + (rawTargetX - bx) * CONFIG.dragResistance;
            if (rawTargetX < -bx)
                rawTargetX =
                    -bx + (rawTargetX + bx) * CONFIG.dragResistance;
            if (rawTargetY > by)
                rawTargetY =
                    by + (rawTargetY - by) * CONFIG.dragResistance;
            if (rawTargetY < -by)
                rawTargetY =
                    -by + (rawTargetY + by) * CONFIG.dragResistance;
            // Hard limit on overshoot for snappier mobile feel
            const maxOvershoot = 3;
            rawTargetX = Math.max(
                -bx - maxOvershoot,
                Math.min(bx + maxOvershoot, rawTargetX)
            );
            rawTargetY = Math.max(
                -by - maxOvershoot,
                Math.min(by + maxOvershoot, rawTargetY)
            );
            rigState.target.set(rawTargetX, rawTargetY, 0);
        };
        const onUp = () => {
            if (!isDown) return; // Ignore spurious events
            isDown = false;
            rigState.isDragging = false;
            canvas.style.cursor = "grab";
            if (rigState.activeId !== null) return;
            const { x: bx, y: by } = getBounds();
            // When zoomed out, snap to center. When zoomed in, allow panning.
            const isZoomedOut =
                camera.position.z > CONFIG.zoomIn + 2;
            let snapX = isZoomedOut
                ? 0
                : Math.max(-bx, Math.min(bx, rigState.target.x));
            let snapY = isZoomedOut
                ? 2
                : Math.max(-by, Math.min(by, rigState.target.y));
            rigState.target.set(snapX, snapY, 0);
        };
        // Mouse wheel zoom
        const onWheel = (e) => {
            e.preventDefault();
            const zoomSpeed = 0.8;
            const delta = e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
            const newZoom = rigState.zoom + delta;
            // Clamp between zoomIn and zoomOut limits
            rigState.zoom = Math.max(CONFIG.zoomIn, Math.min(CONFIG.zoomOut, newZoom));
        };

        canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp); // Handle interrupted touch
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            canvas.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            canvas.removeEventListener("wheel", onWheel);
        };
    }, [gl, camera, gridW, gridH]);

    useFrame((state, delta) => {
        easing.damp3(
            rigState.current,
            rigState.target,
            CONFIG.dampFactor,
            delta
        );
        easing.damp(
            camera.position,
            "z",
            rigState.zoom,
            CONFIG.zoomDamp,
            delta
        );
        rigState.velocity
            .copy(rigState.current)
            .sub(prevPos.current);
        prevPos.current.copy(rigState.current);
        const zoomFactor = Math.min(
            1,
            CONFIG.zoomIn / rigState.zoom
        );
        const tiltX =
            rigState.velocity.y * CONFIG.tiltFactor * zoomFactor;
        const tiltY =
            -rigState.velocity.x * CONFIG.tiltFactor * zoomFactor;
        easing.damp(camera.rotation, "x", tiltX, 0.2, delta);
        easing.damp(camera.rotation, "y", tiltY, 0.2, delta);
    });
    return null;
}
