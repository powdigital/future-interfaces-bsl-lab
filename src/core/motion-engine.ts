import type { Landmark } from "./types.ts";

export interface MotionObservation {
  timestamp: number;
  indexPinchDistance: number;
  middlePinchDistance: number;
  palmAngle: number;
  centerX: number;
  centerY: number;
  palmScale: number;
}


function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function average(points: Landmark[]): Landmark {
  return points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length,
    z: (sum.z || 0) + (point.z || 0) / points.length
  }), { x: 0, y: 0, z: 0 });
}

export function motionObservationFromLandmarks(landmarks: Landmark[], timestamp: number): MotionObservation {
  if (landmarks.length < 21) throw new Error("A complete hand requires 21 landmarks");
  const palmScale = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  const center = average([landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]);
  const palmDirection = {
    x: landmarks[9].x - landmarks[0].x,
    y: landmarks[9].y - landmarks[0].y
  };
  return {
    timestamp,
    indexPinchDistance: distance(landmarks[4], landmarks[8]) / palmScale,
    middlePinchDistance: distance(landmarks[4], landmarks[12]) / palmScale,
    palmAngle: Math.atan2(palmDirection.y, palmDirection.x) * 180 / Math.PI,
    centerX: center.x,
    centerY: center.y,
    palmScale
  };
}
