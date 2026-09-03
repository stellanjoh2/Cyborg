export interface PlaybackPlan {
  engine: 'sam'
  rate: number
  pitch: number
  /** 0 = clean/human, 1 = full metallic FX chain. */
  metallic: number
}

/** Maps slider 0–100 to FX intensity, capped below full chaos at 100. */
export function mapHumanRobotToMetallic(humanRobot: number): number {
  const blend = Math.min(Math.max(humanRobot, 0), 100) / 100
  const maxMetallic = 0.72
  return maxMetallic * blend ** 1.08
}

/** 0 = human, 100 = robot. Always uses SAM so playback works in every browser. */
export function resolveHumanRobotBlend(
  humanRobot: number,
  speed: number,
  pitch: number,
): PlaybackPlan {
  return {
    engine: 'sam',
    rate: speed,
    pitch,
    metallic: mapHumanRobotToMetallic(humanRobot),
  }
}
