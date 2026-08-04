import type { DigitMetrics, DigitState, HandMetrics, LearnedProfile, RecognitionCandidate, SignDefinition, SignRule, TrainingExample } from "./types.ts";

const DIGIT_NAMES = ["thumb", "index", "middle", "ring", "pinky"] as const;
const METRIC_NAMES = ["angle1", "angle2", "straightness", "reach"] as const;
type FeatureMap = Record<string, number>;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

export function flattenMetrics(metrics: HandMetrics): FeatureMap {
  const features: FeatureMap = {};
  metrics.forEach((digit, digitIndex) => {
    METRIC_NAMES.forEach((metric) => {
      features[`${DIGIT_NAMES[digitIndex]}.${metric}`] = digit[metric];
    });
  });
  return features;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

const median = (values: number[]): number => percentile(values, 0.5);

function featureScale(feature: string): number {
  if (feature.endsWith("angle1") || feature.endsWith("angle2")) return 18;
  if (feature.endsWith("straightness")) return 0.1;
  return 0.12;
}

export function buildLearnedProfile(signId: string, examples: TrainingExample[]): LearnedProfile | null {
  const positives = examples.filter((example) => example.kind === "positive");
  const negatives = examples.filter((example) => example.kind === "negative");
  const positiveMetricFrames = positives.flatMap((example) => example.frames);
  const positiveFrames = positiveMetricFrames.map(flattenMetrics);
  const negativeFrames = negatives.flatMap((example) => example.frames).map(flattenMetrics);
  if (!positiveFrames.length) return null;

  const stateEvidence = Array.from({ length: 5 }, (_, digitIndex) => {
    const counts = new Map<DigitState, number>([
      ["ambiguous", 0],
      ["extended", 0],
      ["folded", 0]
    ]);
    positiveMetricFrames.forEach((frame) => {
      const state = frame[digitIndex]?.state;
      if (state) counts.set(state, (counts.get(state) || 0) + 1);
    });
    const [state, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { state, confidence: count / positiveMetricFrames.length };
  });

  const candidateRules: SignRule[] = Object.keys(positiveFrames[0]).map((feature) => {
    const positiveValues = positiveFrames.map((frame) => frame[feature]).filter(Number.isFinite);
    const negativeValues = negativeFrames.map((frame) => frame[feature]).filter(Number.isFinite);
    const low = percentile(positiveValues, 0.05);
    const high = percentile(positiveValues, 0.95);
    const padding = Math.max((high - low) * 0.18, featureScale(feature) * 0.2);
    const positiveMedian = median(positiveValues);
    const negativeMedian = negativeValues.length ? median(negativeValues) : null;
    const separation = negativeMedian === null
      ? 0.75
      : Math.abs(positiveMedian - negativeMedian) / Math.max(featureScale(feature), high - low, 0.0001);
    const stability = 1 / (1 + (high - low) / featureScale(feature));
    return {
      feature,
      min: low - padding,
      max: high + padding,
      positiveMedian,
      negativeMedian,
      negativeMin: negativeValues.length ? percentile(negativeValues, 0.05) : null,
      negativeMax: negativeValues.length ? percentile(negativeValues, 0.95) : null,
      separation,
      weight: clamp(0.5 + separation * 1.4 + stability, 0.5, 5),
      foundation: false
    };
  });
  const discriminatingRules = negativeFrames.length
    ? candidateRules.filter((rule) => (rule.separation || 0) >= 0.75)
    : candidateRules;
  const rules = (discriminatingRules.length ? discriminatingRules : candidateRules)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  return {
    signId,
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    evidence: {
      positiveClips: positives.length,
      negativeClips: negatives.length,
      positiveFrames: positiveFrames.length,
      negativeFrames: negativeFrames.length,
      maturity: positives.length >= 5 && negatives.length >= 3 ? "established" : "provisional"
    },
    learnedStatePattern: stateEvidence.map((evidence) => evidence.state),
    stateConfidence: stateEvidence.map((evidence) => evidence.confidence),
    rules
  };
}

function rangeScore(value: number, rule: SignRule): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= rule.min && value <= rule.max) return 1;
  const distance = value < rule.min ? rule.min - value : value - rule.max;
  const softness = Math.max((rule.max - rule.min) * 0.3, featureScale(rule.feature) * 0.35);
  return Math.exp(-Math.pow(distance / softness, 2));
}

function rulesScore(features: FeatureMap, rules: SignRule[]): number | null {
  if (!rules.length) return null;
  let score = 0;
  let weights = 0;
  rules.forEach((rule) => {
    score += rangeScore(features[rule.feature], rule) * rule.weight;
    weights += rule.weight;
  });
  return weights ? score / weights : null;
}

function ambiguousExtensionConfidence(digit: DigitMetrics, digitIndex: number): number {
  if (digitIndex === 0) {
    const reach = clamp((digit.reach - 0.01) / 0.28, 0, 1);
    const angle1 = clamp((digit.angle1 - 125) / 35, 0, 1);
    const angle2 = clamp((digit.angle2 - 135) / 30, 0, 1);
    const straightness = clamp((digit.straightness - 0.75) / 0.2, 0, 1);
    return reach * 0.85 + angle1 * 0.05 + angle2 * 0.05 + straightness * 0.05;
  }

  const angle1 = clamp((digit.angle1 - 120) / 40, 0, 1);
  const angle2 = clamp((digit.angle2 - 135) / 35, 0, 1);
  const straightness = clamp((digit.straightness - 0.72) / 0.23, 0, 1);
  const reach = clamp((digit.reach - 0.92) / 0.22, 0, 1);
  return angle1 * 0.35 + angle2 * 0.1 + straightness * 0.25 + reach * 0.3;
}

function statePatternScore(metrics: HandMetrics, pattern: SignDefinition["statePattern"], confidence?: number[]): number {
  const scores: number[] = pattern.map((expected, index): number => {
    const digit = metrics[index];
    const actual = digit?.state;
    if (actual === expected) return 1;
    if (expected === "ambiguous") return actual === "ambiguous" ? 1 : 0.25;
    if (actual === "ambiguous") {
      const extension = ambiguousExtensionConfidence(digit, index);
      return expected === "extended" ? extension : 1 - extension;
    }
    return 0;
  });
  const weights = scores.map((_, index) => clamp(confidence?.[index] ?? 1, 0.25, 1));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return scores.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

export function scoreSign(sign: SignDefinition, metrics: HandMetrics, profile?: LearnedProfile): number {
  const features = flattenMetrics(metrics);
  const baseRulesScore = rulesScore(features, sign.baseRules);
  const patternScore = statePatternScore(metrics, sign.statePattern);
  const baseScore = baseRulesScore === null ? patternScore : (baseRulesScore + patternScore) / 2;
  if (!profile) return baseScore;

  const positiveRulesScore = rulesScore(features, profile.rules);
  const learnedPatternScore = profile.learnedStatePattern?.length === 5
    ? statePatternScore(metrics, profile.learnedStatePattern, profile.stateConfidence)
    : patternScore;
  const positiveScore = positiveRulesScore === null
    ? learnedPatternScore
    : positiveRulesScore * 0.75 + learnedPatternScore * 0.25;
  const negativeRules = profile.rules
    .filter((rule) => rule.negativeMin !== null && rule.negativeMax !== null)
    .map((rule) => ({ ...rule, min: rule.negativeMin as number, max: rule.negativeMax as number }));
  const negativeScore = negativeRules.length ? rulesScore(features, negativeRules) : null;
  const learnedScore = negativeScore === null
    ? positiveScore || 0
    : clamp(0.5 + ((positiveScore || 0) - negativeScore) * 0.5, 0, 1);
  if (profile.schemaVersion >= 3 && profile.evidence.maturity === "established") {
    const negativeVeto = negativeScore !== null && negativeScore > positiveScore;
    return negativeVeto
      ? Math.min(baseScore, learnedScore)
      : Math.max(baseScore, learnedScore);
  }

  const evidenceWeight = clamp(
    profile.evidence.positiveClips / 5 * 0.5 + profile.evidence.negativeClips / 3 * 0.3,
    0.2,
    0.8
  );
  return baseScore * (1 - evidenceWeight) + learnedScore * evidenceWeight;
}

export function recognizeSign(signBank: SignDefinition[], metrics: HandMetrics, profiles = new Map<string, LearnedProfile>()): {
  match: RecognitionCandidate | null;
  results: RecognitionCandidate[];
  margin: number;
} {
  const results = signBank
    .filter((sign) => sign.recognitionType === "static" && sign.hands === 1)
    .map((sign) => ({ sign, score: scoreSign(sign, metrics, profiles.get(sign.id)) }))
    .sort((a, b) => b.score - a.score);
  const best = results[0];
  const runnerUp = results[1];
  const margin = best ? best.score - (runnerUp?.score || 0) : 0;
  const match = best && best.score >= best.sign.minimumScore && margin >= best.sign.minimumMargin ? best : null;
  return { match, results, margin };
}

export function recognizeHands(signBank: SignDefinition[], hands: HandMetrics[], profiles = new Map<string, LearnedProfile>()): {
  match: RecognitionCandidate | null;
  results: RecognitionCandidate[];
  margin: number;
} {
  if (!hands.length) return { match: null, results: [], margin: 0 };

  const results = signBank
    .filter((sign) => sign.recognitionType === "static" && hands.length >= sign.hands)
    .map((sign) => {
      if (sign.hands === 2) {
        const score = hands
          .slice(0, 2)
          .map((metrics) => scoreSign(sign, metrics, profiles.get(sign.id)))
          .reduce((sum, value) => sum + value, 0) / 2;
        return { sign, score };
      }

      const bestHandScore = Math.max(...hands.map((metrics) => scoreSign(sign, metrics, profiles.get(sign.id))));
      const extraHandPenalty = hands.length > 1 ? 0.65 : 1;
      return { sign, score: bestHandScore * extraHandPenalty };
    })
    .sort((a, b) => b.score - a.score);

  const best = results[0];
  const runnerUp = results[1];
  const margin = best ? best.score - (runnerUp?.score || 0) : 0;
  const match = best && best.score >= best.sign.minimumScore && margin >= best.sign.minimumMargin ? best : null;
  return { match, results, margin };
}
