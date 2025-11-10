
export enum Emotion {
  HAPPY = "HAPPY",
  SAD = "SAD",
  STRESSED = "STRESSED",
  FOCUSED = "FOCUSED",
  TIRED = "TIRED",
  NEUTRAL = "NEUTRAL",
  SURPRISED = "SURPRISED",
  ANGRY = "ANGRY",
}

export interface AnalysisResult {
  emotion: Emotion;
  environmentAnalysis: string;
  encouragingMessage: string;
  productivityTip: string;
}
