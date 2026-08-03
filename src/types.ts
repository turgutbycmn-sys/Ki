/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FootballEvent {
  time: string; // e.g., "43:12"
  seconds: number; // in-match seconds
  type: string; // "Goal" | "Save" | "Dribble" | "Pass" | "Tackle" | "Interception" | "Chance" | "Foul" etc.
  name: string; // Event label, e.g., "Bicycle Kick Goal", "Through Ball"
  baseScore: number;
  player: string;
  team: string; // e.g., "Real Madrid" or "Barcelona"
  details: string;
}

export interface PlayCoordinate {
  x: number; // 0 to 100 representing percentage of pitch width (left to right)
  y: number; // 0 to 100 representing percentage of pitch height (top to bottom)
  playerName?: string;
  action?: string; // "pass" | "dribble" | "shoot" | "intercept" | "save" | "idle"
}

export interface TacticalStep {
  timeOffset: number; // seconds from sequence start
  ball: PlayCoordinate;
  players: {
    id: string;
    name: string;
    team: "A" | "B";
    x: number;
    y: number;
    action?: string;
  }[];
  caption: string;
}

export interface ScoreComponents {
  eventImportance: number; // 40%
  technicalDifficulty: number; // 20%
  matchImportance: number; // 15%
  tempoDynamics: number; // 10%
  emotionalImpact: number; // 10%
  visualQuality: number; // 5%
}

export interface BonusModifier {
  name: string;
  value: number;
}

export interface HighlightSequence {
  id: string;
  title: string;
  matchTime: string; // e.g. "88:14"
  startTimestamp: number; // in-match seconds
  endTimestamp: number; // in-match seconds
  duration: number; // seconds
  seconds?: number; // fallback/calculated timestamp for video matching
  playersInvolved: string[];
  events: FootballEvent[];
  components: ScoreComponents;
  bonuses: BonusModifier[];
  finalScore: number; // Highlight Score (0.00 to 1.00)
  classification: "Elite" | "Premium" | "Standard" | "Excluded";
  explanation: string;
  tacticalAnimation: TacticalStep[]; // coordinates for the Veo 3 replay board
  contextWindow?: {
    beforeEvent: string;
    afterEvent: string;
    buildupPassesCount: number;
    defensivePressurePct: number;
    narrativeImpact: string;
  };
}

export interface VeoPlayerStat {
  name: string;
  jersey: number;
  team: string;
  position: string;
  sprints: number;
  topSpeed: number; // km/h
  distanceCovered: number; // km
  passAccuracy: number; // %
  heatmapData: { x: number; y: number; weight: number }[];
  successfulPasses: number;
  tackles: number;
}

export interface PassLink {
  from: string;
  to: string;
  count: number;
  success: boolean;
}

export interface MatchData {
  id: string;
  title: string;
  competition: string;
  date: string;
  teamA: { name: string; logo: string; score: number; color: string };
  teamB: { name: string; logo: string; score: number; color: string };
  stats: {
    possession: [number, number];
    xG: [number, number];
    shots: [number, number];
    saves: [number, number];
    passCompletion: [number, number];
    tackles: [number, number];
    sprintDistance: [number, number]; // in km
  };
  highlights: HighlightSequence[];
  playerStats: VeoPlayerStat[];
  passNetwork: {
    players: { name: string; x: number; y: number; team: "A" | "B"; avatar: string }[];
    links: PassLink[];
  };
  highPressZones: { x: number; y: number; radius: number; intensity: number; team: "A" | "B" }[];
}
