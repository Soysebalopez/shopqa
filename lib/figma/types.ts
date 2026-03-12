export interface FigmaFileResponse {
  document: FigmaDocumentNode;
  name: string;
  lastModified: string;
  version: string;
}

export interface FigmaDocumentNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaDocumentNode[];
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  style?: FigmaTypeStyle;
  absoluteBoundingBox?: FigmaRect;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  effects?: FigmaEffect[];
}

export interface FigmaFill {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
}

export interface FigmaStroke {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
}

export interface FigmaTypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: string;
}

export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaEffect {
  type: string;
  visible: boolean;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

export interface FigmaImageResponse {
  images: Record<string, string>;
}

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}
