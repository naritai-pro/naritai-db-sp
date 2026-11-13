import type original from "./question.json";

export type Diagram = (typeof original.diagrams)[number] & {
  background?: string;
  endpointMarks?: boolean;
  extraNodes?: string[];
  sheetLayout?: Pick<Diagram, "viewBox" | "nodes" | "boxSize" | "nodeSizes" | "routes" | "fontSize">;
  subtypeJunctions?: Record<string, [number, number]>;
  fontSize?: number;
  regions?: { x: number; y: number; width: number; height: number; label: string; bottom?: boolean }[];
  annotations?: { x: number; y: number; text: string }[];
  selfRelations?: string[];
  allowParallel?: boolean;
  nodeFields?: Record<string, string>;
  fixedPath?: string;
  fixedParts?: Record<string, string>;
  solutionPath?: string;
  nodeSizes?: Record<string, [number, number]>;
  boxSize?: [number, number];
  viewBox?: string;
  labelLines?: Record<string, [string, string]>;
  routes?: Record<string, string>;
};
export interface MaterialBlock {
  underline?: string;
  text: string;
  reference?: number;
  heading?: boolean;
  lines?: string[];
  table?: { headers: string[]; rows: (string | null)[][] };
  diagramIndex?: number;
  illustration?: string;
  illustrationParts?: { viewBox: string; paths: Record<string, string> };
  description?: string;
  notes?: string[];
}

export type Question = Omit<typeof original, "diagrams" | "explanations"> & {
  diagrams: Diagram[];
  explanations?: { section?: number; before: string; title: string; text: string; quotes: string[] }[];
  materialBlocks?: MaterialBlock[];
  figures?: { caption: string; lines: string[] }[];
  controls?: Record<string, "schema" | "short" | "step" | "step5" | "normal" | string[] | number>;
};
